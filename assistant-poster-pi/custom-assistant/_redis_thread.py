
import json

from threading import Thread
from redis import Redis

class RedisThread(Thread):

  def __init__(self, host, password, channel):

    Thread.__init__(self)

    self.plotter_thread = None

    self.redis_client = Redis(host=host, port=6379, db=0, password=password)
    self.channel = channel
    try:
      self.redis_client.ping()
      print("Redis: Connected")
    except Exception as e:
      print("Redis: {}".format(e))
      self.redis_client = None

  def set_plotter_thread(self, plotter_thread):
    self.plotter_thread = plotter_thread

  def send_msg(self, msg):
    # print("send_msg() msg={}".format(msg))
    self.redis_client.publish(self.channel, msg)

  def stop(self):

    # do nothing if the thread is already killed
    if self.is_alive() is False:
      return

    self.redis_client.publish(self.channel, "KILL")
    print("Redis: Published KILL")

  def run(self):

    if self.redis_client is not None:

      self.pubsub = self.redis_client.pubsub()
      self.pubsub.subscribe([self.channel])

      for item in self.pubsub.listen():

        # print(item)

        if (item["type"] == "subscribe"):
          print("Redis: Subscribed")
          continue

        if item["data"] == b'KILL':
          self.pubsub.unsubscribe()
          print("Redis: Unsubscribed")
          break
        elif (item["data"] == b'ALL_GOOD'):
          print("Redis: All good")
        elif (item["data"][0:6] == b'GCODE='):
          # print("Redis: GCode = {}".format(item["data"][6:]))
          if self.plotter_thread is not None:
            self.plotter_thread.parse_gcode(item["data"][6:])

    print ("Redis: Thread finished")
