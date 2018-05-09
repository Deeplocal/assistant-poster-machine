// ========================================================
// Global variables
// ========================================================

var STROKE_WIDTH = 4;

var NUM_ROWS = 4;
var NUM_COLS = 3;
var GRID_SIZE = 136;
var SMALL = GRID_SIZE * 0.60;
var MEDIUM = GRID_SIZE * 0.95;
var LARGE = GRID_SIZE * 1.1;

// layouts
var GRID_0 = [ 1, 1, 1,
               0, 1, 2,
               1, 1, 2,
               0, 0, 1 ];
var GRID_1 = [ 1, 1, 0,
               1, 0, 1,
               0, 1, 1,
               1, 1, 0 ];
var GRID_2 = [ 1, 0, 1,
               1, 1, 1,
               0, 2, 2,
               1, 1, 0 ];
// var gridList = [GRID_0, GRID_1, GRID_2];
var gridList = [GRID_0, GRID_2]; // temporarily removing grid 1
var croppedGrids = [2];

var currentGrid = 0;
var currentColor = palette.green;
var currentSize = MEDIUM;
var shapeSize = currentSize;
var currentShape = "circle";
var currentStyle = "random-primitive";
var currentExtraShape = "none";
var currentIndex = 1;
var currentRotation = 0;
var currentBorder = currentShape;

var grid;
var SHOW_GRID = false;    // visualize shape placement
var originals, results;   // groups for inserting 
var primitives = [];      // array of generated shapes
var borderPaths = [];     // array of borders for contours
var contours = [];        // array of contours
var contourCounter = 0;   // depth of current contour
var borderCounter = 0;    // depth of border contour

// flags
// avoid: avoid using shape
// break: break sizing option and use SMALL
// rotate: only flip upside down
// vertical: don't crop double shape
var circleAvoidFlag = [0, 4, 5, 12];
var circleBreakFlag = [8, 9, 18];
var circleRotateFlag = [18];

var squareAvoidFlag = [0];
var squareBreakFlag = [2, 5, 7, 8, 11, 14, 17];
var squareRotateFlag = [11, 17];
var squareVerticalFlag = [2];

var triangleAvoidFlag = [0];
var triangleBreakFlag = [4];
var triangleRotateFlag = [11];
var triangleVerticalFlag = [0];

var ws; // web socket

// shape order for video
var OVERRIDE = false;
var videoCount = 0;
var videoContourCount = 0;

// video poster 0 setup
var SHAPES_1 = [ "circle",
                 "circle",
                 "circle",
                 "square",
                 "square",
                 "square",
                 "square",
                 "square" ];
var COLORS_1 = [ 2, 2, 2, 2, 2, 1, 1, 1 ];
var SIZES_1 = [ LARGE, SMALL, SMALL, SMALL, MEDIUM, MEDIUM, MEDIUM, MEDIUM ];
var INDICES_1 = [ 2, 8, 13, 9, 3, 4, 3, 14 ];
var ROTATIONS_1 = [ 225, 315, 45, 225, 180, 225, 45, 315 ];
var CONTOUR_COLORS_1 = [ 1, 3, 3, 1 ];

var isDouble = true; // draw double shape first

// ========================================================
// Initialization
// ========================================================

$(document).ready(function() {

  console.log('document ready');

  initWebsocket();

  $('button#btn-next-shape').on('click', nextShape);
  // $('button#btn-finish').on('click', finishPoster);
  $('button#btn-fill-contour').on('click', fillContour);
  $('button#btn-clear').on('click', clear);

  // styling options
  $('input[name="color"]:radio').change(setColor);
  $('input[name="shape"]:radio').change(setShape);
  $('input[name="size"]:radio').change(setSize);
  $('input[name="style"]:radio').change(setStyle);
  $('input[name="extra"]:radio').change(setExtra);

  // setup paper canvas
  var canvas = document.getElementById('paper-canvas');
  paper.setup(canvas);

  var size = paper.view.size; // 554x854

  var gridWidth = NUM_COLS * GRID_SIZE;
  var gridHeight = NUM_ROWS * GRID_SIZE;
  var horizontalMargin = (size.width - gridWidth) / 2;
  var verticalMargin = (size.height - gridHeight) / 2;
  var from = new paper.Point(horizontalMargin, verticalMargin);
  var to = new paper.Point(size.width - horizontalMargin, size.height - verticalMargin);
  
  // populate grid to control overlap
  currentGrid = Math.floor(Math.random() * gridList.length);
  grid = new Grid(GRID_SIZE, from, to, gridList[currentGrid]);
  console.log("current grid", currentGrid);

  // original paths that won't be inserted into the DOM
  originals = new paper.Group({insert: false});
  // result paths that will be inserted into the DOM
  results = new paper.Group({insert: true});

  // border rectangles for contours and cropping
  for (var i = 0; i < MAX_CONTOURS; i++) {
    var fromX = from.x + CONTOUR_SPACING * i;
    var fromY = from.y + CONTOUR_SPACING * i;
    var toX = to.x - CONTOUR_SPACING * i;
    var toY = to.y - CONTOUR_SPACING * i;
    var newFrom = new paper.Point(fromX, fromY);
    var newTo = new paper.Point(toX, toY);

    var borderPath = new paper.Path.Rectangle(newFrom, newTo);
    borderPath.parent = originals;
    borderPaths.push(borderPath);
  }

  initSVGs();
});

// ========================================================
// Main program functions
// ========================================================

const initWebsocket = () => {

  ws = new WebSocket('ws://127.0.0.1:8081');

  ws.onopen = () => {
    console.log('Websocket open');
    ws.send(JSON.stringify({
      'cmd': 'id',
      'extra': 'index'
    }));
  };

  ws.onmessage = (event) => {

    console.log(`Websocket message = ${event.data}`);

    const cmd = event.data.split(':');

    if (cmd[0] == 'new-poster') {
      clear();
      return;
    }

    if (cmd[0] == 'next-shape') {
      websocketGetSvgs('shape');
      return;
    }

    if (cmd[0] == 'fill-contour') {
      websocketGetSvgs('contour');
      return;
    }

    if (cmd[0] == 'color') {
      $(`input[name='color'][value=${cmd[1]}]`).prop('checked', true);
      setColor();
      return;
    }

    if (cmd[0] == 'shape') {
      if ((cmd[1] == 'square') || (cmd[1] == 'circle') || (cmd[1] == 'triangle')) {
        $(`input[name='shape'][value=${cmd[1]}]`).prop('checked', true);
        setShape();
      } else {
        $(`input[name='extra'][value=${cmd[1]}]`).prop('checked', true);
        setExtra()
      }
      return;
    }

    if (cmd[0] == 'style') {
      if (cmd[1] == 'striped') {
        $(`input[name='style'][value=striped`).prop('checked', true);
      } else {
        $(`input[name='style'][value=random-primitive`).prop('checked', true);
      }
      setStyle();
      return;
    }

    if (cmd[0] == 'size') {
      updateSize(cmd[1])
      return;
    }
  };
};

const websocketGetSvgs = (type) => {

  if (!ws) {
    console.log('Error: No websocket');
    return;
  }

  if (type == 'shape') {
    let returnSvgs = newShapeReturnSvg();
    svgOverWebsocket(returnSvgs);
  } else if (type == 'contour') {
    let returnSvgs = fillContourReturnSvg();
    svgOverWebsocket(returnSvgs);
  } else if (type == 'sig') {
    returnSvgs = signPosterReturnSvgs(12, (returnSvgs) => { // TODO update number
      svgOverWebsocket(returnSvgs);
    });
  } else {
    console.error(`Bad websocketGetSvgs() type (type=${type})`);
    return;
  }
};

const svgOverWebsocket = (svgs) => {

  // TODO when and where do you switch from shapes to contours ?
  if (!svgs) {
    return;
  }

  ws.send(JSON.stringify({
    'cmd': 'start-svgs',
    'extra': svgs.length
  }));

  for (var i = 0; i < svgs.length; i++) {
    ws.send(JSON.stringify({
      'cmd': 'next-shape-svg',
      'extra': svgs[i]
    }));
    console.log('Sent websocket messages');
  }
};

// get svg for the last shape drawn
const newShapeReturnSvg = () => {

  let strokeColor;
  let returnSvgs = [];
  let newPrimitive = nextShape();

  // newPrimitive = null if theres no more room for shapes
  if (!newPrimitive) {
    return;
  }

  // set color
  if (!newPrimitive.strokeColor) {
    console.log('No stroke color!');
  } else {
    strokeColor = newPrimitive.strokeColor;
  }

  // handle paperjs paths
  if (newPrimitive.path.className === 'Path') {

    let svgString = paperjsPathToSvg(newPrimitive.path, strokeColor);
    console.log(`Path: ${svgString}`);
    returnSvgs.push(svgString);

    return returnSvgs;
  }

  // handle paperjs compound paths 
  if (newPrimitive.path.className === 'CompoundPath') {

    // for each child object
    for (let i = 0; i < newPrimitive.path.children.length; i++) {

      // handle paperjs paths
      if (newPrimitive.path.children[i].className === 'Path') {

        let svgString = paperjsPathToSvg(newPrimitive.path.children[i], strokeColor);
        console.log(`Path ${i}: ${svgString}`);
        returnSvgs.push(svgString);

        continue;
      }

      console.error(`Unknown newPrimitive className=${newPrimitive.path.children[i].className}`)
    }

    return returnSvgs;
  }

  // TODO check that this isnt called
  console.error('here');
  console.log(newPrimitive.path.className);

  for (var i = 0; i < newPrimitive.path.length; i++) {

    // TODO remove
    console.log(typeof newPrimitive.path);
    console.log(newPrimitive.path.className);

    if (newPrimitive.path[i].className === 'CompoundPath') {

      for (var j = 0; j < newPrimitive.path[i].children.length; j++) {

        let svgString = paperjsPathToSvg(newPrimitive.path[i].children[j], strokeColor);
        console.log(`CompoundPath ${i} Path ${j}: ${svgString}`);
        returnSvgs.push(svgString);
      }

      continue;
    }

    if (newPrimitive.path[i].className === 'Path') {

      let svgString = paperjsPathToSvg(newPrimitive.path[i], strokeColor);
      console.log(`Path ${i}: ${svgString}`);
      returnSvgs.push(svgString);

      continue;
    }
    
    console.error(`Unknown path className=${newPrimitive.path[i].className}`)
  }

  // export patterns
  for (var i = 0; i < newPrimitive.pattern.length; i++) {

    if (newPrimitive.pattern[i].className !== 'Path') {
      console.error(`Unknown pattern className=${newPrimitive.pattern[i].className}`)
      continue;
    }

    let svgString = paperjsPathToSvg(newPrimitive.pattern[i], strokeColor);
    console.log(`Pattern path ${i}: ${svgString}`);
    returnSvgs.push(svgString);
  }

  return returnSvgs;
};

const replaceStrokeColorNone = (svgString, strokeColor) => {

  let count = (svgString.match(/stroke="none"/g) || []).length;
  if (count != 1) {
    console.log(`Did not replace stroke color (count=${count})`);
    return svgString;
  }

  return svgString.replace('stroke="none"', `stroke="${strokeColor}"`);
};

const fillContourReturnSvg = () => {

  let strokeColor;
  let returnSvgs = [];
  let newContour = fillContour();

  // newCountour = null if no shapes have been drawn
  if (!newContour) {
    return;
  }

  // set color
  if (!newContour.strokeColor) {
    console.log('No stroke color!');
  } else {
    if (newContour.strokeColor.className === 'Color') {
      let r = Math.round(newContour.strokeColor.red * 255);
      let g = Math.round(newContour.strokeColor.green * 255);
      let b = Math.round(newContour.strokeColor.blue * 255);
      strokeColor = rgbToHex(r, g, b);
    } else {
      console.error('TODO check this!');
      strokeColor = newContour.strokeColor;
    }
  }

  // handle paperjs paths
  if (newContour.className == 'Path') {

    let svgString = paperjsPathToSvg(newContour, strokeColor);
    console.log(`Path: ${svgString}`);
    returnSvgs.push(svgString);

    return returnSvgs;
  }

  // handle paperjs compound paths
  if (newContour.className == 'CompoundPath') {

    for (let i = 0; i < newContour.children.length; i++) {

      // handle paperjs paths
      if (newContour.children[i].className === 'Path') {

        let svgString = paperjsPathToSvg(newContour.children[i], strokeColor);
        console.log(`Path ${i}: ${svgString}`);
        returnSvgs.push(svgString);

        continue;
      }
      
      console.error(`Unknown path className=${newContour.children[i].className}`)
    }

    return returnSvgs;
  }

  console.error(`Unknown newContour.className = ${newContour.className})`);
  return;
};

const componentToHex = (c) => {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
};

const rgbToHex = (r, g, b) => {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

const paperjsPathToSvg = (path, strokeColor) => {

  // safety check
  if (path.className !== 'Path') {
    console.error(`paperjsPathToSvg() error: path.className=${path.className}`);
    return;
  }

  // export path
  let svgString = path.exportSVG({
    'asString': true,
    'matchShapes': false
  });

  // replace stroke color
  if (strokeColor) {
    svgString = replaceStrokeColorNone(svgString, strokeColor);
  }

  return svgString;
};

const signPosterReturnSvgs = (number, cb) => {

  let numberString = `${number}`;
  if (number < 10) {
    numberString = '00' + numberString;
  } else if (numberString < 100) {
    numberString = '0' + numberString;
  }

  let promises = [];

  for (let i = 0; i < numberString.length; i++) {

    let p = new Promise((resolve, reject) => {

      paper.project.importSVG(`img/SVG/sig-${numberString[i]}-line.svg`, {
        onLoad: (item, svgData) => {

          // console.log(item)
          // console.log(svgData);
          // console.log('loaded svg');

          item.scale(0.35);

          item.position.x = 90 + (i * 18);
          item.position.y = 790

          resolve(item);
        }
      });
    });

    promises.push(p); 
  }

  Promise.all(promises)
    .then((svgs) => {

      console.log('RESULT');
      console.log(svgs);

      let exportedSvgs = [];

      for (let i = 0; i < svgs.length; i++) {

        for (let j = 0; j < svgs[i].children.length; j++) {

          if (svgs[i].children[j].className == 'Shape') {
            continue;
          }

          if (svgs[i].children[j].className == 'Path') {

            let p = paperjsPathToSvg(svgs[i].children[j], palette[0]); // TODO stroke color
            console.log(p);
            exportedSvgs.push(p);
            
            continue;
          }

          if (svgs[i].children[j].className == 'CompoundPath') {

            for (let k = 0; k < svgs[i].children[j].children.length; k++) {

              // console.log(svgs[i].children[j].children[k].className);
              // console.log(svgs[i].children[j].children[k]);

              if (svgs[i].children[j].children[k].className == 'Path') {

                let p = paperjsPathToSvg(svgs[i].children[j].children[k], palette[0]); // TODO stroke color
                console.log(p);
                exportedSvgs.push(p);

                continue;
              }

              console.error(`Unknown className=${svgs[i].children[j].children[k].className}`);
            }

            continue;
          }

          console.error(`Unknown className=${svgs[i].children[j].className}`);
        }
      }

      return cb(exportedSvgs);
    });
};

// ========================================================
// Shape generation functions
// ========================================================

// overrides customizable options with list of commands
function videoOverride(shapes, colors, sizes, indices, rotations) {

  currentShape = shapes[videoCount];
  shapeSize = sizes[videoCount];
  currentColor = paletteList[colors[videoCount]];
  currentIndex = indices[videoCount];
  currentRotation = rotations[videoCount];

  if (currentShape == "square" && squareBreakFlag.indexOf(currentIndex) > -1) {
    shapeSize = SMALL;
  } else if (currentShape == "circle" && circleBreakFlag.indexOf(currentIndex) > -1) {
    shapeSize = SMALL;
  }
}

function getConsoleIndex() {
  var consoleIndex;

  switch(currentShape) {

    case "circle":
      if (currentIndex < numCircleSVGs) {
        consoleIndex = currentIndex;
      } else {
        consoleIndex = currentIndex - numCircleSVGs;
      }
      break;

    case "square":
      if (currentIndex < numSquareSVGs) {
        consoleIndex = currentIndex;
      } else {
        consoleIndex = currentIndex - numSquareSVGs;
      }
      break;

    case "triangle":
      switch (currentBorder) {
        case "triangle":
          consoleIndex = currentIndex;
          break;
        case "square":
          consoleIndex = currentIndex - numTriangleSVGs;
          break;
        case "hexagon":
          consoleIndex = currentIndex - numTriangleSVGs - numTriangleSquareSVGs;
          break;
        default:
          consoleIndex = currentIndex - numTriangleSVGs - numTriangleSquareSVGs - numTriangleHexagonSVGs;
          break;
      }
      break;

    default:
      break;
  }

  return consoleIndex;
}

// generates the next shape and pattern that should be printed
const nextShape = () => {

  // fill the grid radially from the center outwards
  var nextPosition = grid.getUnit(isDouble);
  shapeSize = currentSize;

  if (nextPosition) {

    if (grid.hasDouble && !grid.isDoubleFilled() && isDouble) {

      var numDoubles;
      if (currentShape == "circle") {
        numDoubles = numDoubleCircleSVGs;
        currentIndex = Math.floor(Math.random() * numDoubles);

      } else if (currentShape == "square") {
        numDoubles = numDoubleSquareSVGs;

        if (croppedGrids.indexOf(currentGrid) > -1) {
          currentIndex = Math.floor(Math.random() * numDoubles);

          while (squareVerticalFlag.indexOf(currentIndex) > -1) {
            currentIndex = Math.floor(Math.random() * numDoubles);
          }
        } else {
          currentIndex = Math.floor(Math.random() * numDoubles);
        }

      } else if (currentShape == "triangle") {
        numDoubles = numDoubleTriangleSVGs;

        if (croppedGrids.indexOf(currentGrid) > -1) {
          currentIndex = Math.floor(Math.random() * numDoubles);
          while (triangleVerticalFlag.indexOf(currentIndex) > -1) {
            currentIndex = Math.floor(Math.random() * numDoubles);
          }
        } else {
          currentIndex = Math.floor(Math.random() * numDoubles);
        }
      }
      
      currentRotation = grid.doubleRotation;
      currentBorder = "double";
      shapeSize = MEDIUM;
      grid.fillDouble();

      isDouble = false;

    } else {

      if (currentExtraShape != "none") {

        currentIndex = extraList.indexOf(currentExtraShape);
        currentBorder = "custom";
        currentRotation = 0;

      } else {

        switch (currentShape) {

          case "circle":

            if (currentStyle == "striped") {

              currentIndex = Math.floor(Math.random() * numStripedSVGs);
              currentBorder = "circle";
              shapeSize = SMALL;
              currentRotation = Math.floor(Math.random() * 8) * 45;

            } else {
              currentIndex = Math.floor(Math.random() * circleSVGs.length);
              while (circleAvoidFlag.indexOf(currentIndex) > -1) {
                currentIndex = Math.floor(Math.random() * circleSVGs.length);
              }

              currentBorder = circleBorders[currentIndex];

              if (circleRotateFlag.indexOf(currentIndex) > -1) {
                currentRotation = Math.floor(Math.random() * 4) * 90;
              } else {
                currentRotation = Math.floor(Math.random() * 8) * 45;
              }

              if (circleBreakFlag.indexOf(currentIndex) > -1) {
                shapeSize = SMALL;
              }
            }
            break;

          case "square":

            if (currentStyle == "striped") {
              
              currentIndex = Math.floor(Math.random() * numStripedSVGs);
              currentBorder = "square";
              shapeSize = SMALL;
              currentRotation = Math.floor(Math.random() * 4) * 90;

            } else {
              currentIndex = Math.floor(Math.random() * squareSVGs.length);
              while (squareAvoidFlag.indexOf(currentIndex) > -1) {
                currentIndex = Math.floor(Math.random() * squareSVGs.length);
              }

              currentBorder = squareBorders[currentIndex];

              if (squareRotateFlag.indexOf(currentIndex) > -1) {
                currentRotation = Math.floor(Math.random() * 4) * 90;
              } else {
                currentRotation = Math.floor(Math.random() * 8) * 45;
              }

              if (squareBreakFlag.indexOf(currentIndex) > -1) {
                shapeSize = SMALL;
              }
            }
            break;

          case "triangle":

            if (currentStyle == "striped") {
              
              currentIndex = Math.floor(Math.random() * numStripedSVGs);
              currentBorder = "triangle";
              shapeSize = SMALL;
              currentRotation = Math.floor(Math.random() * 2) * 180;

            } else {
              currentIndex = Math.floor(Math.random() * triangleSVGs.length);
              while (triangleAvoidFlag.indexOf(currentIndex) > -1) {
                currentIndex = Math.floor(Math.random() * triangleSVGs.length);
              }

              currentBorder = triangleBorders[currentIndex];

              if (currentBorder == "square") {
                currentRotation = Math.floor(Math.random() * 8) * 45;
              } else {
                currentRotation = Math.floor(Math.random() * 2) * 180;
              }

              if (triangleRotateFlag.indexOf(currentIndex) > -1) {
                currentRotation = Math.floor(Math.random() * 2) * 180;
              }

              if (triangleBreakFlag.indexOf(currentIndex) > -1) {
                shapeSize = SMALL;
              }
            }
            break;

          default:
            console.log("not a shape!");
            break;
        }
      }
    }

    if (OVERRIDE) {
      videoOverride(SHAPES_1, COLORS_1, SIZES_1, INDICES_1, ROTATIONS_1);
    }

    if (currentExtraShape != "none") {
      console.log(currentExtraShape + "-" + getConsoleIndex().toString(),
                  "color", currentColor);
    } else {
      console.log(currentShape + "-" + currentBorder + "-" + getConsoleIndex().toString(),
                  "size", Math.floor(shapeSize),
                  "color", currentColor,
                  "rotation", currentRotation,
                  "styling", currentStyle);
    }

    // create a new primitive according to the parameters
    var newPrimitive = new Primitive(
      currentShape,
      shapeSize,
      currentColor,
      nextPosition,
      currentIndex,
      currentRotation,
      currentBorder,
      currentStyle,
      currentExtraShape
    );

    sendPreview(
      currentShape,
      currentColor,
      currentIndex,
      currentBorder,
      currentStyle,
      currentExtraShape
    );

    // draw new shape behind all generated shapes
    for (var i = 0; i < primitives.length; i++) {
      var primitive = primitives[i];
      if (newPrimitive.intersects(primitive)) {
        newPrimitive.drawBehind(primitive);
      }
    }

    // crop shapes according to the outer border
    var outerBorder = borderPaths[0];
    newPrimitive.crop(outerBorder);
    
    // finish shape by adding it to the list
    primitives.push(newPrimitive);

    if (OVERRIDE) {
      videoCount++;
    }

    // reset options
    currentStyle = "random-primitive";
    var ele = document.getElementsByName("style");
    ele[0].checked = true;
    ele[1].checked = false;

    currentExtraShape = "none";
    var ele = document.getElementsByName("extra");
    for (var i = 0; i < ele.length - 1; i++) {
      ele[i].checked = false;
    }
    ele[ele.length - 1].checked = true;

    return newPrimitive;

  } else {
    console.log("no more space for that kind of shape!");
  }
};

// fills the empty space with contours
// should only be called after primitives are completed
const fillContour = () => {

  if (primitives.length > 0) {
    
    if (contourCounter < MAX_CONTOURS) {

      if (OVERRIDE) {
        currentColor = paletteList[CONTOUR_COLORS_1[videoContourCount]];
        videoContourCount++;
      }

      console.log("contour", currentColor);

      var isCropped = false;

      var contour = new paper.Path();

      // create a contour outline from each shape's boundaries
      for (var i = 0; i < primitives.length; i++) {
        var primitive = primitives[i];
        var merge = contour.unite(primitive.boundaries[contourCounter]);
        contour.remove();
        contour = merge;
      }

      // check if border contains contour
      var borderPath = borderPaths[borderCounter];

      // merge shape contours with the border contour      
      if (borderPath.intersects(contour)) {
        var crop = borderPath.subtract(contour);
        contour.remove();
        contour = crop;

        isCropped = true;
      }

      var doesIntersect = false;
      for (var i = 0; i < contours.length - 1; i++) {
        doesIntersect = doesIntersect || contour.intersects(contours[i]);
      }

      if (!doesIntersect && contour.area < borderPaths[0].area) {

        // add contour to the DOM
        contour.parent = results;
        contour.strokeColor = currentColor;
        contour.strokeWidth = STROKE_WIDTH;

        // increment depth of contour being drawn
        contourCounter++;
        contours.push(contour);

        if (isCropped) {
          // increment depth of border being drawn
          borderCounter++;
        }

        return contour;

      } else {
        contour.remove();
        console.log("no more space for contours!");
      }

    } else {
      console.log("no more contours!");
    }

  } else {
    console.log("no shapes have been drawn!");
  }
};

const finishPoster = () => {
  console.log("finishing poster");
};

const clear = () => {
  console.log("clearing canvas");

  // clear primitives
  for (var i = 0; i < primitives.length; i++) {
    primitives[i].clear();
  }
  primitives = [];

  // clear contours
  for (var i = 0; i < contours.length; i++) {
    contours[i].remove();
  }
  contours = [];

  // reset variables
  contourCounter = 0;
  borderCounter = 0;
  videoCount = 0;
  videoContourCount = 0;
  isDouble = true;

  currentColor = palette.green;
  currentSize = MEDIUM;
  shapeSize = currentSize;
  currentShape = "circle";
  currentStyle = "random-primitive";
  currentExtraShape = "none";
  currentIndex = 1;
  currentRotation = 0;
  currentBorder = currentShape;

  currentGrid = Math.floor(Math.random() * gridList.length);
  console.log("current grid", currentGrid);

  // clear and randomize grid
  grid.reset(gridList[currentGrid]);

  ws.send(
    JSON.stringify({
      cmd: 'clear'
    })
  );
};

const sendPreview = (shape, color, index, border, style, extra) => {
  ws.send(
    JSON.stringify({
      cmd: 'live-preview',
      extra: [shape, color, index, border, style, extra]
    })
  );
  console.log('sent preview shape over websocket');
};

// ========================================================
// User input setters
// ========================================================

const setColor = () => {

  switch ($("input[name='color']:checked").val()) {

    case "green":
      currentColor = palette.green;
      break;

    case "blue":
      currentColor = palette.blue;
      break;

    case "red":
      currentColor = palette.red;
      break;

    case "orange":
      currentColor = palette.orange;
      break;

    case "purple":
      currentColor = palette.purple;
      break;

    default:
      break;
  }
}

const setShape = () => {
  currentShape = $("input[name='shape']:checked").val();
}

const setSize = () => {

  switch ($("input[name='size']:checked").val()) {

    case "small":
      currentSize = SMALL;
      break;

    case "medium":
      currentSize = MEDIUM;
      break;

    case "large":
      currentSize = LARGE;
      break;

    default:
      currentSize = MEDIUM;
      break;
  }
};

const updateSize = (sizeString) => {

  switch (currentSize) {

    case SMALL:
      if (sizeString == 'bigger') currentSize = MEDIUM;
      break;

    case MEDIUM:
      if (sizeString == 'smaller') currentSize = SMALL;
      if (sizeString == 'bigger') currentSize = LARGE;
      break;

    case LARGE:
      if (sizeString == 'smaller') currentSize = MEDIUM;
      break;

    default:
      currentSize = MEDIUM;
      break;
  }

  let val = 'medium';
  if (currentSize == SMALL) val = 'small';
  if (currentSize == LARGE) val = 'large';
  $(`input[name='size'][value=${val}]`).prop('checked', true);

};

const setStyle = () => {
  currentStyle = $("input[name='style']:checked").val();
}

const setExtra = () => {
  currentExtraShape = $("input[name='extra']:checked").val();
}
