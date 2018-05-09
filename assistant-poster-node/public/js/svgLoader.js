// ========================================================
// SVG Loaders
// ========================================================

// svgs
var prefix = "../img/SVG/"
var suffix = ".svg";

var extraList = [ "rhombus", "parallelogram", "hexagon", "octagon", "decagon",
                  "diamond", "heptagon", "t-shape", "nonagon", "pentagon", "x",
                  "plus-sign", "dodecagon", "rectangle" ];

var numCircleSVGs = 13;
var numCircleBorderSVGs = 6;

var numSquareSVGs = 16;
var numSquareBorderSVGs = 3;

var numTriangleSVGs = 9;
var numTriangleSquareSVGs = 5;
var numTriangleHexagonSVGs = 1;
var numTriangleBorderSVGs = 0;

var numDoubleCircleSVGs = 3;
var numDoubleSquareSVGs = 3;
var numDoubleTriangleSVGs = 2;

var numStripedSVGs = 3;

var circleSVGs = [];
var squareSVGs = [];
var triangleSVGs = [];

var circleBorders = [];
var squareBorders = [];
var triangleBorders = [];

var doubleCircleSVGs = [];
var doubleSquareSVGs = [];
var doubleTriangleSVGs = [];

var stripedCircleSVGs = [];
var stripedSquareSVGs = [];
var stripedTriangleSVGs = [];

var extraSVGs = [];

function initSVGs() {
      // initialize all SVGs
  for (var i = 0; i < numCircleSVGs; i++) {
    importSVG("circle", i, false);
  }

  for (var i = 0; i < numCircleBorderSVGs; i++) {
    importSVG("circle-border", i, true);
  }

  for (var i = 0; i < numDoubleCircleSVGs; i++) {
    importSVG("circle-double", i, true);
  }

  for (var i = 0; i < numStripedSVGs; i++) {
    importSVG("circle-striped", i, false);
  }

  for (var i = 0; i < numSquareSVGs; i++) {
    importSVG("square", i, false);
  }

  for (var i = 0; i < numSquareBorderSVGs; i++) {
    importSVG("square-border", i, true);
  }

  for (var i = 0; i < numDoubleSquareSVGs; i++) {
    importSVG("square-double", i, true);
  }

  for (var i = 0; i < numStripedSVGs; i++) {
    importSVG("square-striped", i, false);
  }

  for (var i = 0; i < numTriangleSVGs; i++) {
    importSVG("triangle", i, false);
  }

  for (var i = 0; i < numTriangleSquareSVGs; i++) {
    importSVG("triangle-square", i, false);
  }

  for (var i = 0; i < numTriangleHexagonSVGs; i++) {
    importSVG("triangle-hexagon", i, false);
  }

  for (var i = 0; i < numTriangleBorderSVGs; i++) {
    importSVG("triangle-border", i, true);
  }

  for (var i = 0; i < numDoubleTriangleSVGs; i++) {
    importSVG("triangle-double", i, true);
  }

  for (var i = 0; i < numStripedSVGs; i++) {
    importSVG("triangle-striped", i, false);
  }

  for (var i = 0; i < extraList.length; i++) {
    importSVG(extraList[i], i, true);
  }
}

function importSVG(shape, index, hasBorder) {

  var filepath;
  if (extraList.indexOf(shape) > -1) {
    filepath = prefix + "extras/" + shape + suffix;
  } else {
    filepath = prefix + shape + "-" + index.toString() + suffix;
  }

  var newShape = paper.project.importSVG(filepath, {
    onLoad: function(item){ SVGLoad(item, shape, hasBorder) },
    expandShapes: true
  });
}

function compare(pathA, pathB) {
  if (pathA.bounds.area < pathB.bounds.area) {
    return -1;
  } else if (pathA.bounds.area > pathB.bounds.area) {
    return 1;
  }
  return 0;
}

function SVGLoad(item, shape, hasBorder) {

  var paths = [];

  if (hasBorder) {

    var original = item.children[1].children[0].children[MAX_CONTOURS].clone();
    original.fillColor = null;
    original.strokeWidth = STROKE_WIDTH;
    original.parent = originals;

    for (var i = 0; i < MAX_CONTOURS; i++) {
      var path = item.children[1].children[0].children[i].clone();
      path.fillColor = null;
      path.strokeWidth = STROKE_WIDTH;
      path.parent = originals;
      paths.push(path);
    }

    paths.sort(compare);
    paths.push(original);

  } else {
    var path = item.children[1].children[0].children[0].clone();

    path.fillColor = null;
    path.strokeWidth = STROKE_WIDTH;
    path.parent = originals;
    paths.push(path);
  }

  item.remove();

  switch(shape) {

    case "circle":
      circleSVGs.push(paths);
      circleBorders.push("circle");
      break;

    case "circle-border":
      circleSVGs.push(paths);
      circleBorders.push("custom");
      break;

    case "circle-double":
      doubleCircleSVGs.push(paths);
      break;

    case "circle-striped":
      stripedCircleSVGs.push(paths);
      break;

    case "square":
      squareSVGs.push(paths);
      squareBorders.push("square");
      break;

    case "square-border":
      squareSVGs.push(paths);
      squareBorders.push("custom");
      break;

    case "square-double":
      doubleSquareSVGs.push(paths);
      break;

    case "square-striped":
      stripedSquareSVGs.push(paths);
      break;

    case "triangle":
      triangleSVGs.push(paths);
      triangleBorders.push("triangle");
      break;

    case "triangle-square":
      triangleSVGs.push(paths);
      triangleBorders.push("square");
      break;

    case "triangle-hexagon":
      triangleSVGs.push(paths);
      triangleBorders.push("hexagon");
      break;

    case "triangle-border":
      triangleSVGs.push(paths);
      triangleBorders.push("custom");
      break;

    case "triangle-double":
      doubleTriangleSVGs.push(paths);
      break

    case "triangle-striped":
      stripedTriangleSVGs.push(paths);
      break;

    default: // extra shapes
      extraSVGs.push(paths);
      break;
  }
}