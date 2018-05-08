'use strict'

var XmlToJs = require('xml2js');

var PEN_LIFT_POS = 0;
var PEN_DROP_POS = 150;
var PEN_MOVE_SEC = 0.25;

var CANVAS_MIN_X = 73;
var CANVAS_MAX_X = 481;
var CANVAS_MIN_Y = 155;
var CANVAS_MAX_Y = 699;

var BED_MIN_X = 3;
var BED_MAX_X = 69;
var BED_MIN_Y = 7;
var BED_MAX_Y = 95;

var PEN_COLOR_MAP = {
  '#35e9b7': 0, // green
  '#5970fb': 1, // blue
  '#fb6b1f': 2, // orange
  '#db3f3f': 3, // red
  '#9932cc': 4 // purple
};

var _firstSvgPos;
var _currentSvgPos;
var _isAbsPos = false;
var _isPenDown = false;

exports.getGcode = (svgString) => {

  return new Promise((resolve, reject) => {

    if (!svgString) {
      return reject(new Error('SVG string required'));
    }

    XmlToJs.parseString(svgString, (err, result) => {

      if (err) {
        return reject(err);
      }

      // console.log(`Result = ${JSON.stringify(result)}`);
      // console.log(`d = ${JSON.stringify(result.path.$.d)}`);
      // console.log(`stroke = ${JSON.stringify(result.path.$.stroke)}`);

      // to hold string of gcode commands
      let gcode = '';

      // append gcode command for pen color
      if (!result.path.$.stroke) {
        console.log(`Result = ${JSON.stringify(result)}`);
        console.log('Error: No stroke color');
      } else {
        gcode += getGcodePenColor(result.path.$.stroke);
      }

      // set current position
      _currentSvgPos = { x:0, y:0 };

      parseD(result.path.$.d)
        .then((cmds) => {

          // console.log(`cmds=${cmds}`);

          let transformObject = getTransformObject(result.path.$.transform);

          if (!Array.isArray(cmds) || (cmds.length === 0)) {
            throw new Error('Bad cmds array');
          }

          setFirstPoint(cmds[0], transformObject);

          // add gcode for each command
          for (let i = 0; i < cmds.length; i++) {
            gcode += interpretCmd(cmds[i], transformObject);
          }

          // reset current position
          _firstSvgPos = null;
          _currentSvgPos = null;

          resolve(gcode);
        });
    });
  });
};

/*
 *  Parse d attribute of SVG XML into individual SVG commands
 */
const parseD = (d) => {

  return new Promise((resolve, reject) => {

    recursiveSplit([d], ['m', 'M', 'h', 'H', 'v', 'V', 'l', 'L', 'c', 'z', 'Z'])
      .then((cmds) => {
        // console.log(`cmds = ${cmds}`);
        return resolve(cmds);
      });
  });
};

/*
 * Split string in input (type:array) on strings in splitOn (type:array)
 */
const recursiveSplit = (input, splitOn) => {

  return new Promise((resolve, reject) => {

    // console.log(`recursiveSplit(input=${JSON.stringify(input)}, splitOn=${JSON.stringify(splitOn)}`);

    if (!Array.isArray(input) || !Array.isArray(splitOn)) {
      return reject(new Error('Error = input and splitOn must be arrays'));
    }

    let returnArray = [];
    let separator = splitOn.shift();

    let index, currentIndex, newInput;
    for (let i = 0; i < input.length; i++) {

      // console.log(`Splitting ${input[i]} on ${separator}`);

      index = -1;
      // currentIndex = 0;
      newInput = [];

      while ((index = input[i].indexOf(separator, 1)) !== -1) {
        // console.log(`Found ${separator} at index=${index}`);
        let left = input[i].substring(0, index);
        let right = input[i].substring(index);
        // console.log(`left = ${JSON.stringify(left)}`);
        // console.log(`right = ${JSON.stringify(right)}`);
        newInput.push(left);
        input[i] = right;
      }

      // console.log(`Adding ${JSON.stringify(newInput)} and ${input[i]} to return array`);

      returnArray = returnArray.concat(newInput);
      returnArray.push(input[i]);
    }

    if (splitOn.length === 0) {
      // console.log('Ending function');
      return resolve(returnArray);
    }

    return recursiveSplit(returnArray, splitOn).then(resolve);
  });
};

const interpretCmd = (cmd, transformObject) => {

  // moveto
  if ((cmd.charAt(0) === 'm') || (cmd.charAt(0) === 'M')) {
    return parseMoveTo(cmd, transformObject);
  }

  // lineto
  if ((cmd.charAt(0) === 'h') || (cmd.charAt(0) === 'H') || (cmd.charAt(0) === 'v') || (cmd.charAt(0) === 'V')|| (cmd.charAt(0) === 'l') || (cmd.charAt(0) === 'L')) {
    return parseLineTo(cmd, transformObject);
  }

  // curveto
  if (cmd.charAt(0) === 'c') {
    return parseCurveTo(cmd);
  }

  // closepath
  if ((cmd.charAt(0) === 'z') || (cmd.charAt(0) === 'Z')) {
    return parseClosePath();
  }

  throw new Error(`Unknown SVG command '${cmd}'`);
};

// === Parse SVG command to determine GCode ===

const parseMoveTo = (cmd, transformObject) => {

  // console.log(`parseMoveTo(cmd=${cmd})`);

  // remove spaces from cmd
  cmd = obliterateSpaces(cmd);

  // lift pen
  let gcode = getGcodeLiftPen();

  // parse x and y
  let distances = cmd.substr(1).split(',');
  let svgCoords = {
    x: parseFloat(distances[0]),
    y: parseFloat(distances[1])
  };

  if (transformObject) {

    // scale
    svgCoords.x *= transformObject.scale.x;
    svgCoords.y *= transformObject.scale.y;

    // translate
    svgCoords.x += transformObject.translate.x;
    svgCoords.y += transformObject.translate.y;
  }

  // set positioning mode and update current position
  let cmdChar = cmd.charAt(0);
  if (cmdChar === 'm') {
    gcode += getGcodeSetPositioningMode(false); // relative
    _currentSvgPos.x += svgCoords.x;
    _currentSvgPos.y += svgCoords.y;
  } else if (cmdChar === 'M') {
    gcode += getGcodeSetPositioningMode(true); // absolute
    _currentSvgPos = svgCoords;
  } else {
    throw new Error('Invalid SVG moveto command');
  }

  // convert svg coords to gcode coords and get movement gcode
  let gcodeCoords = svgToGcodeCoords(svgCoords);
  gcode += getGcodeMove(gcodeCoords.x, gcodeCoords.y);

  return gcode;
}

const parseLineTo = (cmd, transformObject) => {

  // console.log(`parseLineTo(cmd=${cmd})`);

  // set positioning mode and drop pen
  let gcode = getGcodeSetPositioningMode(true); // absolute
  gcode += getGcodeDropPen();

  // parse x and y
  let xy = cmd.substr(1).split(',');
  if (xy.length > 0) {
    xy[0] = parseFloat(xy[0]);
  }
  if (xy.length > 1) {
    xy[1] = parseFloat(xy[1]);
  }

  // calculate new svg position based on command char
  let svgCoords = _currentSvgPos;
  let cmdChar = cmd.charAt(0);
  if (cmdChar === 'h') { // relative horizontal line
    if (transformObject) {
      xy[0] *= transformObject.scale.x; // scale x
      // no translate because its relative
    }
    svgCoords.x += xy[0];
  } else if (cmdChar === 'H') { // absolute horizontal line
    if (transformObject) {
      xy[0] *= transformObject.scale.x; // scale x
      xy[0] += transformObject.translate.x; // translate x
    }
    svgCoords.x = xy[0];
  } else if (cmdChar === 'v') { // relative vertical line
    if (transformObject) {
      xy[0] *= transformObject.scale.y; // scale y
      // no translate because its relative
    }
    svgCoords.y += xy[0];
  } else if (cmdChar === 'V') { // absolute vertical line
    if (transformObject) {
      xy[0] *= transformObject.scale.y; // scale y
      xy[0] += transformObject.translate.y; // translate y
    }
    svgCoords.y = xy[0];
  } else if (cmdChar === 'l') { // relative line
    if (transformObject) {
      xy[0] *= transformObject.scale.x; // scale x
      // no translate because its relative
      xy[1] *= transformObject.scale.y; // scale y
      // no translate because its relative
    }
    svgCoords.x += xy[0];
    svgCoords.y += xy[1];
  } else if (cmdChar === 'L') { // absolute line
    if (transformObject) {
      xy[0] *= transformObject.scale.x; // scale x
      xy[0] += transformObject.translate.x; // translate x
      xy[1] *= transformObject.scale.y; // scale y
      xy[1] += transformObject.translate.y; // translate y
    }
    svgCoords.x = xy[0];
    svgCoords.y = xy[1];
  } else {
    throw new Error('Invalid SVG lineto command');
  }

  // update new current position
  _currentSvgPos = svgCoords;

  // get move gcode and return
  let gcodeCoords = svgToGcodeCoords(svgCoords);
  gcode += getGcodeMove(gcodeCoords.x, gcodeCoords.y);
  return gcode;
};

const parseCurveTo = (cmd) => {

  // console.log(`parseCurveTo(cmd=${cmd})`);

  let gcode = getGcodeDropPen();
  getGcodeSetPositioningMode(true); // absolute

  // set positioning mode
  let cmdChar = cmd.charAt(0);

  // parse points array into usable numbers
  let pointsArr = cmd.substr(1).split(' ');
  if (pointsArr.length !== 3) {
    throw new Error('Bad number of SVG curve points');
  }

  // safety check
  if (!_currentSvgPos) {
    throw new Error('Error = No _currentSvgPos');
  }

  // parse curve handles from command
  let curvePoints = [ _currentSvgPos ];
  for (let i = 0; i < pointsArr.length; i++) {

    // parse point
    let xy = pointsArr[i].split(',');
    let point = {
      x: parseFloat(xy[0]),
      y: parseFloat(xy[1])
    };

    // relative to starting position?
    if (cmdChar === 'c') {
      point.x += curvePoints[0].x;
      point.y += curvePoints[0].y;
    }

    // append
    curvePoints.push(point);
  }

  // console.log(`curvePoints = ${JSON.stringify(curvePoints)}`);

  // calculate number of points needed to estimate the curve
  let distance = Math.sqrt(Math.pow(curvePoints[3].x - curvePoints[0].x, 2) + Math.pow(curvePoints[3].y - curvePoints[0].y, 2));
  let numLines = 10; // todo: base on length of curve

  // get svg points over bezier curve to estimate curve
  let pointsList = getPointsForBezierCurve(curvePoints, numLines);
  // console.log(`pointsList = ${JSON.stringify(pointsList)}`);

  // for each point, generate gcode to move there (straight line)
  for (let i = 1; i < pointsList.length; i++) {
    let gcodeCoords = svgToGcodeCoords(pointsList[i]);
    gcode += getGcodeMove(gcodeCoords.x, gcodeCoords.y);
  }

  // update current position
  _currentSvgPos = pointsList[pointsList.length - 1];

  // console.log(`curve gcode = ${gcode}`);

  return gcode;
};

const parseClosePath = () => {

  // console.log(`parseClosePath()`);

  if (!_firstSvgPos || !_currentSvgPos) {
    throw new Error(`Error: _firstSvgPos or _currentSvgPos is undefined`);
  }

  // if first and current points are the same
  if ((_firstSvgPos.x === _currentSvgPos.x) && (_firstSvgPos.y === _currentSvgPos.y)) {

    // console.log('no movement needed');

    // reset globals
    _firstSvgPos = null;
    _currentSvgPos = null;

    // no movement needed
    return '';
  }

  // console.log('calculating final movement');

  // get gcode to drop pen and move to first position
  let gcode = getGcodeSetPositioningMode(true); // absolute
  gcode += getGcodeDropPen();
  let gcodeCoords = svgToGcodeCoords(_firstSvgPos);
  gcode += getGcodeMove(gcodeCoords.x, gcodeCoords.y);
  // console.log(`gcode = ${gcode}`);

  // reset globals
  _firstSvgPos = null;
  _currentSvgPos = null;

  return gcode;
};


// === Native GCode commands ===

// assumes gcode device uses sticky coordinates i.e. only include arguments for the axes you want to move
const getGcodeMove = (x, y, z) => {

  if (z === undefined) {
    z = null;
  }
  
  // let gcode = 'G1 ';
  let gcode = 'G0'; // TODO testing
  if (x !== null) gcode += ` X${x}`;
  if (y !== null) gcode += ` Y${y}`;
  if (z !== null) gcode += ` Z${z}`;
  return `${gcode};`;
};

/*
 * Dwell command
 *   p = time in s
 *   s = time in sec
 */
const getGcodeDwell = (p, s) => {
  if (!p) return '';
  let gcode = `G4 P${p}`;
  if (s) gcode += ` S${s}`;
  return `${gcode};`;
};

const getGcodeSetPositioningMode = (absolute) => {
  if (absolute) {
    if (_isAbsPos) return '';
    _isAbsPos = true;
    return 'G90 ;'; // absolute
  }
  if (!_isAbsPos) return '';
  _isAbsPos = false;
  return 'G91 ;'; //relative
};

/*
 * You can quickly override the current axe(s) position so that
 * all future commands will now be relative to this new value
 */
const getGcodeSetCurrentPosition = (x, y, z, e) => {
  let gcode = 'G92 ';
  if (x) gcode += `X${x} `;
  if (y) gcode += `Y${y} `
  if (z) gcode += `Z${z} `;
  if (z) gcode += `E${e} `;
  return `${gcode};`;
};

const getGcodeLiftPen = () => {
  if (!_isPenDown) return '';
  _isPenDown = false;
  let gcode = `M3 S${PEN_LIFT_POS};`
  gcode += getGcodeDwell(PEN_MOVE_SEC); // dwell to let pen settle
  return gcode;
};

const getGcodeDropPen = () => {
  if (_isPenDown) return '';
  _isPenDown = true;
  let gcode = `M3 S${PEN_DROP_POS};`;
  gcode += getGcodeDwell(PEN_MOVE_SEC); // dwell to let pen settle
  return gcode;
};

const getGcodePenColor = (color) => {

  // TODO Array.prototype.includes not working ???
  // if (!Object.keys(PEN_COLOR_MAP).includes(color)) {
  //   console.log(`Invalid color ${color}`)
  //   return '';
  // }

  let gcode = getGcodeLiftPen();
  gcode += getGcodeMove(null, null, PEN_COLOR_MAP[color]);
  return gcode;
};

// === Utilities ===

const obliterateSpaces = (s) => {
  while (s.indexOf(' ') != -1) {
    s = s.replace(' ', '');
  }
  return s;
};

const svgToGcodeCoords = (svgCoords) => {
  return {
    x: mapVal(svgCoords.x, CANVAS_MIN_X, CANVAS_MAX_X, BED_MIN_X, BED_MAX_X, true),
    y: mapVal(svgCoords.y, CANVAS_MIN_Y, CANVAS_MAX_Y, BED_MIN_Y, BED_MAX_Y, true)
  };
};

const mapVal = (val, inMin, inMax, outMin, outMax, clip) => {
  let outVal = (val - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  if ((clip === true) && (outVal < outMin)) return outMin;
  if ((clip === true) && (outVal > outMax)) return outMax;
  return outVal;
};

// https://javascript.info/bezier-curve
const getPointsForBezierCurve = (curvePoints, numLines) => {

  // console.log('getPointsForBezierCurve()');

  if (!Array.isArray(curvePoints) || (curvePoints.length !== 4)) {
    throw new Error('Bad curvePoints array');
  }

  let points = [];

  for (let i = 0; i < numLines; i++) {
    // console.log(`iter ${i}`);
    let t = i / numLines; // convert from [0, numLines) to [0, 1)
    let x = (Math.pow(1 - t, 3) * curvePoints[0].x) + (3 * Math.pow(1 - t, 2) * t * curvePoints[1].x) + (3 * (1 - t) * Math.pow(t, 2) * curvePoints[2].x) + (Math.pow(t, 3) * curvePoints[3].x);
    let y = (Math.pow(1 - t, 3) * curvePoints[0].y) + (3 * Math.pow(1 - t, 2) * t * curvePoints[1].y) + (3 * (1 - t) * Math.pow(t, 2) * curvePoints[2].y) + (Math.pow(t, 3) * curvePoints[3].y);
    points.push({ 'x': x, 'y': y});
  }

  points.push(curvePoints[3]);

  return points;
};

const setFirstPoint = (cmd, transformObject) => {

  let cmdChar = cmd.charAt(0);
  if (cmdChar === 'M') {

    // parse x and y
    let xy = cmd.substr(1).split(',');
    _firstSvgPos = {
      x: parseFloat(xy[0]),
      y: parseFloat(xy[1])
    };

    if (transformObject) {

      // scale
      _firstSvgPos.x *= transformObject.scale.x;
      _firstSvgPos.y *= transformObject.scale.y;

      // translate
      _firstSvgPos.x += transformObject.translate.x;
      _firstSvgPos.y += transformObject.translate.y;
    }

    return;
  }

  throw new Error(`Unknown setFirstPoint() cmd=${cmd}`);
};

const getTransformObject = (transformString) => {

  if (!transformString) {
    return;
  }

  let transformObject = {
    scale: { x: 1, y: 1 },
    translate: { x: 0, y: 0 }
  };

  let i = transformString.indexOf('scale(');
  let j = transformString.indexOf(')', i);
  let scaleString = transformString.substr(i + 6, j - 1);
  let scaleArr = scaleString.split(',');
  transformObject.scale.x = parseFloat(scaleArr[0]);
  transformObject.scale.y = parseFloat(scaleArr[1]);

  i = transformString.indexOf('translate(');
  j = transformString.indexOf(')', i);
  let translateString = transformString.substr(i + 10, j - 1);
  let translateArr = translateString.split(',');
  transformObject.translate.x = parseFloat(translateArr[0]);
  transformObject.translate.y = parseFloat(translateArr[1]);

  // console.log(`transformObject = ${JSON.stringify(transformObject)}`)

  return transformObject;
};
