
import requests
import os
import time

from serial import Serial
from random import randint
from threading import Thread, Timer

"""
  For our specific plotter setup:
    X,Y = (0,0) is top left and (x_max, y_max) is bottom right
    Z = change pen color
    M3 = change pen up/down
"""

MAX_SHAPES = 6
MAX_CONTOURS = 4
MAX_SHAPE_TIME_SEC = 180
MAX_CONTOUR_TIME_SEC = 240

class PlotterThread(Thread):
  """ Handle plotter control """


  def __init__(self):

    Thread.__init__(self)
    self.should_stop = False

    self.ser = None
    self.redis_thread = None

    self.is_drawing = False
    self.has_first_shape = False
    self.num_shapes = 0
    self.num_contours = 0
    self.user_done = False
    self.poster_start_time = None
    

  def set_redis_thread(self, redis_thread):
    self.redis_thread = redis_thread


  def stop(self):

    # if self.is_drawing:
    #   self.finish_drawing()

    self.should_stop = True
    print("Plotter: Stopping thread")


  def do_test_routine(self):

    # unlock / home
    self.write_gcode_wait("$H")

    # open file
    file = "test-routine"
    f = open('./custom-assistant/{}.gcode'.format(file),'r')

    # for each line
    for line in f:

      # clean up line
      l = line.strip()

      # write gcode
      self.write_gcode_wait(l)

      # check for stop condition
      if self.should_stop is True:
        break

    # close file
    f.close()

    self.finish_drawing()


  def write_gcode(self, gcode):

    if self.ser is None:
      print("Plotter: No serial device (write_gcode)")
      return

    print("Send: {}".format(gcode))
    self.ser.write("{}\n".format(gcode).encode())

    s_bytes = self.ser.readline()
    s = s_bytes.decode("utf8").strip()
    print("Receive: {}".format(s))


  def write_gcode_wait(self, gcode):

    # safety check for serial device
    if self.ser is None:
      print("Plotter: No serial device(write_gcode)")
      return

    # check for empty gcode input
    if gcode == "":
      # print("Plotter: Nothing to send")
      return

    # write gcode to serial device
    print("Send: {}".format(gcode))
    self.ser.write("{}\n".format(gcode).encode())

    # loop to wait for ok output
    while True:

      s_bytes = self.ser.readline()
      s = s_bytes.decode("utf8").strip()

      # check for thread stop condition
      if self.should_stop is True:
        break

      # skip empty output
      if s == "":
        continue

      # break for ok
      if s == "ok":
        print("Plotter: Got 'ok'")
        break

      # print other output
      print("Receive: {}".format(s.encode()))


  ''' gcode should be an entire shape '''
  def parse_gcode(self, gcode):

    # set poster start time if unassigned
    if self.poster_start_time is None:
      self.poster_start_time = int(time.time())

    # convert commands to string and clean up
    commands = gcode.decode("utf8").strip()

    # parse each command
    for command in commands.split(";"):

      # do gcode if its not the end of a shape/contour
      if command != "END!":
        self.write_gcode_wait(command)
        continue

      # if we havent drawn max shapes
      if self.num_shapes < MAX_SHAPES:

        # increment num shapes
        self.num_shapes += 1
        print("num_shapes={}".format(self.num_shapes))

        # if user said "im done"
        if self.user_done:

          # set num shapes to max shapes in order to move to contours
          print("User done with shapes")
          self.num_shapes = MAX_SHAPES
          self.user_done = False

        # if shapes can still be drawn
        if self.num_shapes < MAX_SHAPES:

          # get time delta between start and now
          time_delta_shape = int(time.time()) - self.poster_start_time

          # draw shape if theres still time
          if time_delta_shape < MAX_SHAPE_TIME_SEC:
            self.redis_thread.send_msg("next-shape")

          # draw contour if theres still time
          elif time_delta_shape < MAX_CONTOUR_TIME_SEC:
            print("Plotter: Reached shape time limit")
            self.num_shapes = MAX_SHAPES
            self.redis_thread.send_msg("fill-contour")

          # finish poster if out of time
          else:
            print("Plotter: Reached poster time limit")
            self.finish_drawing()
            break

        # no more shapes so start contours
        else:
          self.redis_thread.send_msg("fill-contour")

        # break out of loop to not increment contours
        break

      # increment num contours
      self.num_contours += 1
      print("num_contours={}".format(self.num_contours))

      # get time delta between start and now
      time_delta_contour = int(time.time()) - self.poster_start_time

      # if user said "im done"
      if self.user_done:

        # set num contours to max contours in order to finish poster
        print("User done with contours")
        self.num_contours = MAX_CONTOURS

      # if no more contours canbe drawn or out of time
      if self.num_contours == MAX_CONTOURS:
        self.finish_drawing()
      elif time_delta_contour >= MAX_CONTOUR_TIME_SEC:
        print("Plotter: Reached contour time limit")
        self.finish_drawing()
      else:
        self.redis_thread.send_msg("fill-contour")

    print("Plotter: Parsed gcode")


  def cmd_new_poster(self):

    if self.is_drawing:
      print("Plotter: Can't start new poster, already drawing")
      return

    # send new poster command over redis
    if self.redis_thread is not None:
      self.redis_thread.send_msg("new-poster")
    else:
      print("Plotter: No redis thread")
      return

    self.start_drawing()


  def draw(self, shape=None, color=None):

    if self.is_drawing is False:
      print("Plotter: Can't draw(), not drawing")
      return

    if shape is not None:
      self.redis_thread.send_msg("shape:{}".format(shape))

    if color is not None:
      self.redis_thread.send_msg("color:{}".format(color))

    # start drawing first shape
    if not self.has_first_shape:
      self.has_first_shape = True
      self.redis_thread.send_msg("next-shape")


  def draw_random(self):

    if self.is_drawing is False:
      print("Plotter: Can't draw(), not drawing")
      return

    # all possible shapes and colors
    shapes = ["circle", "square", "triangle", "rhombus", "parallelogram", "hexagon", "octagon", "decagon", "diamond", "heptagon", "t-shape", "nonagon", "pentagon", "x", "plus-sign", "dodecagon", "rectangle"]
    colors = ["green", "blue", "red", "orange", "purple"]

    # get random shape and color
    self.redis_thread.send_msg("shape:{}".format(shapes[randint(0, len(shapes) - 1)]))
    self.redis_thread.send_msg("color:{}".format(colors[randint(0, len(colors) - 1)]))

    # start drawing first shape
    if not self.has_first_shape:
      self.has_first_shape = True
      self.redis_thread.send_msg("next-shape")


  def change_size(self, size):
    self.redis_thread.send_msg("size:{}".format(size))


  def do_stripes(self):
    self.redis_thread.send_msg("style:striped")


  def start_drawing(self):

    # reset drawing vars
    self.is_drawing = True
    self.has_first_shape = False
    self.num_shapes = 0
    self.num_contours = 0
    self.user_done = False
    self.poster_start_time = None

    # go home
    self.write_gcode("$H")


  def finish_drawing(self):

    # lift pen and dwell
    self.write_gcode_wait("M3 S0")
    self.write_gcode_wait("G4 P0.25")

    # reset pen, move to home, and dwell
    self.write_gcode_wait("G0 Z0")
    self.write_gcode_wait("G0 X0 Y0")
    self.write_gcode_wait("G4 P1")

    self.is_drawing = False
    print("Done drawing")


  def set_user_done(self, user_done=True):
    self.user_done = user_done


  def send_transcript(self, transcript):
    self.redis_thread.send_msg("transcript:{}".format(transcript))


  def run(self):

    # open serial device
    try:
      self.ser = Serial(port="/dev/ttyUSB0", baudrate=115200, timeout=5)
      print("Plotter: Serial port open")
    except Exception as e:
      print("Plotter: Serial port exception = {}".format(e))
      self.ser = None
      self.should_stop = True

    if self.ser is not None:

      # wake up grbl
      self.ser.write("\r\n\r\n".encode())

      # wait for initialize message
      while True:

        # read from device
        s_bytes = self.ser.readline()
        s = s_bytes.decode("utf8").strip()
        print(s)

        if self.should_stop == True:
          break

        # grbl board is ready and initialized
        if s == "Grbl 1.1f ['$' for help]":
          print("Plotter: Grbl ready")
          # self.do_test_routine()
          self.write_gcode_wait("$H")
          break

      while not self.should_stop:
        time.sleep(1)

      self.ser.close()
      print("Plotter: Closed serial object")

    print("Plotter: Thread finished")
