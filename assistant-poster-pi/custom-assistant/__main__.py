#! /usr/bin/env python

import argparse
import os
import json
import signal
import google.oauth2.credentials
import time
import pymysql

from google.assistant.library.file_helpers import existing_file

from ._assistant_thread import AssistantThread
from ._redis_thread import RedisThread
from ._plotter_thread import PlotterThread


def signal_handler(signal, frame):
  """ Ctrl+C handler to stop threads """

  print("Stopping Custom Assistant (wait up to 5 seconds)")

  global assistant_thread
  if assistant_thread is not None:
    assistant_thread.stop()

  global redis_thread
  if redis_thread is not None:
    redis_thread.stop()

  global plotter_thread
  if plotter_thread is not None:
    plotter_thread.stop()


def main():

  # load config
  config_filepath = os.path.dirname(os.path.realpath(__file__)) + "/config.json"
  config = None
  try:
    with open(config_filepath, 'r') as f:
      config = json.load(f)
  except FileNotFoundError:
    print("Error: config.json not found")
    return

  print("Custom Assistant Started")

  # check for credentials argument
  parser = argparse.ArgumentParser(formatter_class=argparse.RawTextHelpFormatter)
  parser.add_argument('--credentials',
                      type=existing_file,
                      metavar='OAUTH2_CREDENTIALS_FILE',
                      default=os.path.join(
                        os.path.expanduser('~/.config'),
                        'google-oauthlib-tool',
                        'credentials.json'),
                      help='Path to store and read OAuth2 credentials')
  args = parser.parse_args()
  with open(args.credentials, 'r') as f:
    credentials = google.oauth2.credentials.Credentials(token=None, **json.load(f))

  # start assistant thread
  global assistant_thread
  assistant_thread = AssistantThread(credentials)
  assistant_thread.start()

  # wait to continue until assistant is ready (10 second timeout)
  for i in range(0, 10):
    if assistant_thread.is_assistant_ready() is True:
      break
    time.sleep(1) # sleep 1 second and try again

  # check that assistant is ready (in case it timed out)
  if assistant_thread.is_assistant_ready is False:
    print("Could not start Assistant")
    return

  else:

    # start redis thread
    global redis_thread
    redis_thread = RedisThread(config["redis_host"], config["redis_password"], config["redis_channel"])
    redis_thread.start()

    # start plotter thread
    global plotter_thread
    plotter_thread = PlotterThread()
    plotter_thread.set_redis_thread(redis_thread)
    plotter_thread.start()

    # other threads need plotter thread
    assistant_thread.set_plotter_thread(plotter_thread)
    redis_thread.set_plotter_thread(plotter_thread)

    print("-- {} Custom Assistant Ready --".format(config["device_location"]))

    # keep the main thread alive while all background threads are alive
    while True:
      time.sleep(1)
      if (assistant_thread.is_alive() is False) and \
         (redis_thread.is_alive() is False) and \
         (plotter_thread.is_alive() is False):
        break

  print("-- {} Custom Assistant Stopped --".format(config["device_location"]))


if __name__ == '__main__':
  """ Script entry point """

  signal.signal(signal.SIGINT, signal_handler) # handle SIGINT gracefully
  main()
