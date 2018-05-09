'use strict';

// === Imports ===
const express      = require('express');
const morgan       = require('morgan');
const path         = require('path');
const bodyParser   = require('body-parser');
const redis        = require('redis');
const websocket    = require('ws');
const svgToGcode   = require('svg-to-gcode-node');


// === Errors ===
process.on('uncaughtException', function(err) {
  console.log('Uncaught Error:', err);
  process.exit();
});


// === Redis ===
const redisChannel = 'poster-messages';
const redisConf = {
  // TODO: make env variables
  host: '127.0.0.1',
  port: 6379,
  password: 'Th1sISaToughP4ssw0rd2Crack!'
};

// = Redis Subscriber =
const redisSub = redis.createClient(redisConf);
redisSub.on('error', (err) => {

  if (err.code == 'ECONNREFUSED') {
    console.log('Redis: Subscriber connection refused');
    return;
  }

  console.log(`Redis: Error ${err.code}`);
});
redisSub.on('connect', () => {
  console.log(`Redis: Subscriber connected`);
});
redisSub.on('message', (channel, msg) => {

  // console.log(`Redis: Received msg=${msg} on channel=${channel}`);

  // dont send gcode back to frontend
  if (msg.startsWith('GCODE=')) {
    return;
  }

  if (msg.startsWith('transcript')) {
    if (liveSocket !== null) {
      liveSocket.send(msg);
    }
    return;
  }

  if (clientSocket) {
    clientSocket.send(msg);
  }
});
redisSub.subscribe(redisChannel);

// = Redis Publisher =
const redisPub = redis.createClient(redisConf);
redisPub.on('error', (err) => {

  if (err.code == 'ECONNREFUSED') {
    console.log('Redis: Publisher connection refused');
    return;
  }
  
  console.log(`Redis: Error ${err.code}`);
});
redisPub.on('connect', () => {
  console.log(`Redis: Publisher connected`);
});

// used to combine gcode from separate paths
var partialGcode = '';
var expectedSvgs = 0;
var numSvgs = 0;

// === Websockets ===
const wss = new websocket.Server({ port: 8081 });
let clientSocket = null, liveSocket = null;
wss.on('connection', (ws) => {
  // console.log('socket connected');

  ws.on('message', function(msg) {

    // console.log(`Socket: Received ${msg}`);

    let recd = JSON.parse(msg);

    if (!recd.cmd) {
      console.log(`Websockets: Error - No cmd in ${msg}`);
      return;
    }

    if (recd.cmd == 'id') {
      // console.log(recd.extra);
      if (recd.extra == 'index') {
        clientSocket = ws;
        console.log('set index socket');
      } else if (recd.extra == 'live') {
        liveSocket = ws;
        console.log('set live socket');
      }
      return;
    }

    if (recd.cmd === 'live-preview') {
      if (liveSocket != null) {
        liveSocket.send(JSON.stringify(recd.extra));
      }
      return;
    }

    if (recd.cmd === 'clear') {
      if (liveSocket != null) {
        liveSocket.send(JSON.stringify(recd.cmd));
      }
      return;
    }
    
    if (recd.cmd === 'start-svgs') {
      expectedSvgs = parseInt(recd.extra);
      return;
    }

    if (recd.cmd === 'next-shape-svg') {

      // console.log(`Convert ${recd.extra}`);

      // pass gcode over redis
      svgToGcode.getGcode(recd.extra)
        .then((gcode) => {

          // console.log(`gcode=${gcode}\n\n`)
          partialGcode += gcode;

          numSvgs += 1

          if (numSvgs == expectedSvgs) {

            // let gcodes = partialGcode.split(';')
            // for (let i = 0; i < gcodes.length; i++) {
            //   console.log(gcodes[i])
            // }

            partialGcode += 'END!';
            redisPub.publish(redisChannel, `GCODE=${partialGcode}\n\n`);
            console.log(`Published gcode over redis: partialGcode=${partialGcode}`)

            partialGcode = '';
            expectedSvgs = 0;
            numSvgs = 0;
          }
        });

      return;
    }
  });
});


// === Express ===
const app = express();
app.use(morgan('dev'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public'), {
  index: false
}));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.enable('trust proxy'); // enable reverse proxy support

// endpoints
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/list', (req, res) => {
  res.render('list');
});

app.get('/live', (req, res) => {
  res.render('live');
});

app.get('*', (req, res) => {
  res.redirect('/');
});

// start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

