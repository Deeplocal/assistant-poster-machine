
import requests
import os
import time

from random import randint
from threading import Thread
from google.assistant.library import Assistant
from google.assistant.library.event import EventType

# TODO - move force local responses into config and into this flow

class AssistantThread(Thread):
  """ Handle Assistant input/output """

  def __init__(self, credentials):

    # thread-related
    Thread.__init__(self)
    self.should_stop = False

    # assistant-related
    self.device_id = "ASSISTANT_DEVICE_ID"
    self.credentials = credentials
    self.assistant = None
    self.assistant_ready = False

    self.serial_thread = None
    self.plotter_thread = None
    self.db_conn = None
    self.device_location = None

    self.query = None

  def get_assistant(self):
    return self.assistant

  def is_assistant_ready(self):
    return self.assistant_ready

  def set_plotter_thread(self, plotter_thread):
    self.plotter_thread = plotter_thread

  def set_serial_thread(self, serial_thread):
    self.serial_thread = serial_thread

  def set_db_items(self, db_conn, device_location):
    self.db_conn = db_conn
    self.device_location = device_location

  def stop(self):
    self.should_stop = True
    self.assistant.set_mic_mute(True) # do this to trigger an assistant event
    print("Assistant: Stopping thread")

  def run(self):

    with Assistant(self.credentials, self.device_id) as assistant:

      self.assistant = assistant
      assistant.set_mic_mute(False)

      for event in assistant.start():

        # check if the thread should stop
        if self.should_stop is True:
          break

        try:
          self.process_event(event)

        except Exception as e:
          print("Assistant exception:", e) # log exception
          self.assistant.stop_conversation() # stop conversation to recover

    self.assistant = None
    print("Assistant: Thread finished")

  def process_event(self, event):
    """Pretty prints events.

    Prints all events that occur with two spaces between each new
    conversation and a single space between turns of a conversation.

    Args:
        event(event.Event): The current event to process.
    """

    # print(event)

    if event.type == EventType.ON_START_FINISHED:
      print("Assistant: Start finished")
      self.assistant_ready = True

    elif event.type == EventType.ON_CONVERSATION_TURN_STARTED:
      print("Assistant: Turn started")

    elif event.type == EventType.ON_MUTED_CHANGED:

      if event.args:
        print("Assistant: Mic muted =", event.args['is_muted'])

    elif event.type == EventType.ON_CONVERSATION_TURN_TIMEOUT:
      print("Assistant: No discernable user input")

    elif event.type == EventType.ON_RECOGNIZING_SPEECH_FINISHED:

      if event.args and event.args['text']:

        # print query
        print("Assistant: Speech to text = {}".format(event.args['text']))
        self.query = event.args['text']

    elif event.type == EventType.ON_RESPONDING_STARTED:
      print("Assistant: Responding started")

    elif event.type == EventType.ON_NO_RESPONSE:
      print("Assistant: No response")

    elif event.type == EventType.ON_CONVERSATION_TURN_FINISHED:
      print("Assistant: Conversation turn finished")
      self.query = None

      if event.args and event.args['with_follow_on_turn']:
        print("Follow on turn")

    elif event.type == EventType.ON_DEVICE_ACTION:

      print("Assistant: On device action")
      # print(event)

      # send query
      if self.plotter_thread is not None:
        self.plotter_thread.send_transcript(self.query)

      for command, params in process_device_actions(event):

        print('Do command', command, 'with params', str(params))

        if command == "com.deeplocal.commands.new_poster":
          if self.plotter_thread is not None:
            self.plotter_thread.cmd_new_poster()

        elif command == "com.deeplocal.commands.draw_shape":
          if params["shape"] and self.plotter_thread is not None:
            self.plotter_thread.draw(shape=params["shape"])

        elif command == "com.deeplocal.commands.draw_color_shape":
          if params["shape"] and params["color"] and self.plotter_thread is not None:
            self.plotter_thread.draw(shape=params["shape"], color=params["color"])

        elif command == "com.deeplocal.commands.use_color":
          if params["color"] and self.plotter_thread is not None:
            self.plotter_thread.draw(color=params["color"])

        elif command == "com.deeplocal.commands.random":
          if self.plotter_thread is not None:
            self.plotter_thread.draw_random()

        elif command == "com.deeplocal.commands.stripes":
          if self.plotter_thread is not None:
            self.plotter_thread.do_stripes()

        elif command == "com.deeplocal.commands.change_size":
          if params["size"] and self.plotter_thread is not None:
            self.plotter_thread.change_size(params["size"])

        elif command == "com.deeplocal.commands.finished":
          if self.plotter_thread is not None:
            self.plotter_thread.set_user_done()


    elif event.type == EventType.ON_ASSISTANT_ERROR:
      if event.args:
        if event.args['is_fatal']:
          print("Assistant: Fatal error")
        else:
          print("Assistant: Non-fatal error")


def process_device_actions(event):
  if "inputs" in event.args:
    for inpt in event.args["inputs"]:
      if inpt["intent"] == "action.devices.EXECUTE":
        for cmd in inpt["payload"]["commands"]:
          if "execution" in cmd:
            for exe in cmd["execution"]:
              if "params" in exe:
                yield exe["command"], exe["params"]
              else:
                yield exe["command"], None
