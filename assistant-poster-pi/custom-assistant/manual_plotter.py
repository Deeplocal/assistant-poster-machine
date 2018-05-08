#! /usr/bin/env python

from serial import Serial

ser = None


def write_gcode_wait(gcode):

  if ser is None:
    print("Plotter: No serial device(write_gcode)")
    return

  if gcode == "":
    print("Nothing to send")
    return

  print("Send: {}".format(gcode))
  ser.write("{}\n".format(gcode).encode())

  while True:

    s_bytes = ser.readline()
    s = s_bytes.decode("utf8").strip()

    if s == "":
      continue
    if s == "ok":
      print("Plotter: Got 'ok'")
      break
    print("Receive: {}".format(s.encode()))


def main():

  try:
    global ser
    ser = Serial(port="/dev/ttyUSB0", baudrate=115200, timeout=5)
    print("Plotter: Serial port open")
  except Exception as e:
    print("Plotter: Serial port exception = {}".format(e))
    return

  while True:

    cmd = input('Command: ')

    if cmd == 'exit':
      break
    elif cmd == 'pen-up':
      cmd = 'M3 S0'
    elif cmd == 'pen-down':
      cmd = 'M3 S150'

    write_gcode_wait(cmd)

  print("Done")


if __name__ == '__main__':
  main()
