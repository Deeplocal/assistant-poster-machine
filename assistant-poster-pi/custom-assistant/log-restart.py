#!/usr/bin/env python

import os
import json
import pymysql.cursors

def foo():

  try:
    # connect to database
    db_conn = pymysql.connect(host=CONFIG["db_host"],
                              port=CONFIG["db_port"],
                              user=CONFIG["db_user"],
                              password=CONFIG["db_pass"],
                              db=CONFIG["db_name"],
                              charset='utf8mb4',
                              cursorclass=pymysql.cursors.DictCursor)
    print("Connected to database")

    # execute query
    with db_conn.cursor() as cursor:

      query = "INSERT INTO `error` (`location`, `text`, `datetime`) VALUES (%s, %s, NOW())"
      params = (CONFIG["location"], "Restart")
      cursor.execute(query, params)
      db_conn.commit() # connection is not autocommit by default
      print("Wrote restart to database")

  except pymysql.err.OperationalError as e:
    print("Database error:", e)
    return False


print("Attempting to log restart in database")

# load config
config_filepath = os.path.dirname(os.path.realpath(__file__)) + "/config.json"
with open(config_filepath, 'r') as f:
  CONFIG = json.load(f)

if CONFIG["use_db"]:
  foo()
else:
  print("Config says do not use database")
