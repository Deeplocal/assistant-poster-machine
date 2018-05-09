// ========================================================
// Shape Primitives class
// ========================================================

class Primitive {

  constructor(shape, size, strokeColor, position, index, rotation, boundingShape, style, extraShape) {
    this.shape = shape;
    this.size = size;
    this.strokeColor = strokeColor;
    this.position = position;
    this.index = index;
    this.rotation = rotation;
    this.boundingShape = boundingShape;
    this.style = style;
    this.extraShape = extraShape;

    this.path;
    this.boundaries = [];
    
    this.initPath();
    this.initBoundaries();
  }

  initPath() {

    if (this.boundingShape == "custom") {

      var SVGs;
      if (this.extraShape != "none") {
        SVGs = extraSVGs;
      } else {
        if (this.shape == "circle") {
          SVGs = circleSVGs;
        } else if (this.shape == "square") {
          SVGs = squareSVGs;
        } else if (this.shape == "triangle") {
          SVGs = triangleSVGs;
        }
      }

      var path = SVGs[this.index][MAX_CONTOURS].clone();
      path.position = this.position;

      var scale = this.size / Math.max(path.bounds.width, path.bounds.height);
      if (this.extraShape != "none") {
        scale *= 0.8;
      }
      path.scale(scale);

      path.strokeColor = this.strokeColor;
      if (this.extraShape != "none" && this.extraShape != "rectangle" && this.extraShape != "diamond") {
        path.strokeWidth = STROKE_WIDTH / scale;
      } else {
        path.strokeWidth = STROKE_WIDTH;
      }
      path.parent = results;
      path.rotate(this.rotation);

      this.path = path;

      var boundaryScale = scale;
      for (var i = 0; i < MAX_CONTOURS; i++) {
        var boundary = SVGs[this.index][i].clone();
        boundary.position = this.position;

        boundary.scale(boundaryScale);

        boundary.strokeWidth = STROKE_WIDTH;
        boundary.parent = originals;
        boundary.rotate(this.rotation);

        this.boundaries.push(boundary);
      }

    } else if (this.boundingShape == "double") {

      var SVGs;
      if (this.shape == "circle") {
        SVGs = doubleCircleSVGs;
      } else if (this.shape == "square") {
        SVGs = doubleSquareSVGs;
      } else if (this.shape == "triangle") {
        SVGs = doubleTriangleSVGs;
      }

      var path = SVGs[this.index][MAX_CONTOURS].clone();
      path.position = this.position;

      var scale = (2 * MEDIUM) / Math.max(path.bounds.width, path.bounds.height);
      path.scale(scale);

      path.strokeColor = this.strokeColor;
      path.strokeWidth = STROKE_WIDTH;
      path.parent = results;
      path.rotate(this.rotation);

      this.path = path;

      var boundaryScale = scale;
      for (var i = 0; i < MAX_CONTOURS; i++) {
        var boundary = SVGs[this.index][i].clone();
        boundary.position = this.position;

        boundary.scale(boundaryScale);

        boundary.strokeWidth = STROKE_WIDTH;
        boundary.parent = originals;
        boundary.rotate(this.rotation);

        this.boundaries.push(boundary);
      }

    } else {

      var path;
      if (this.shape == "circle") {

        if (this.style == "striped") {
          path = stripedCircleSVGs[this.index][0].clone();
        } else {
          path = circleSVGs[this.index][0].clone();
        }

        path.position = this.position;

        var scale = this.size / Math.max(path.bounds.width, path.bounds.height);
        path.scale(scale);
        path.rotate(this.rotation);

      } else if (this.shape == "square") {

        // reduce size of rotated squares
        if (this.rotation % 90 == 45) {
          this.size *= 0.8;
        }

        if (this.style == "striped") {
          path = stripedSquareSVGs[this.index][0].clone();
        } else {
          path = squareSVGs[this.index][0].clone();
        }

        path.position = this.position;
        var scale = this.size / Math.max(path.bounds.width, path.bounds.height);
        path.scale(scale);
        path.rotate(this.rotation);

      } else if (this.shape == "triangle") {

        if (this.style == "striped") {
          path = stripedTriangleSVGs[this.index][0].clone();
        } else {
          path = triangleSVGs[this.index][0].clone();
        }

        if (this.boundingShape == "triangle") {

          // hard-coded triangle offset to center in grid square
          if (this.rotation == 0) {
            this.position = new paper.Point(this.position.x, this.position.y + 15);
          } else {
            this.position = new paper.Point(this.position.x, this.position.y - 15);
          }

          path.position = this.position;

          var scale = this.size / Math.max(path.bounds.width, path.bounds.height);
          path.scale(scale);

          var pointA = path.bounds.bottomLeft;
          var pointB = path.bounds.bottomRight;
          var midX = (path.bounds.topLeft.x + path.bounds.topRight.x) / 2;
          var midY = (path.bounds.topLeft.y + path.bounds.topRight.y) / 2;
          var pointC = new paper.Point(midX, midY);

          var offset = getCentroidDistance3(pointA, pointB, pointC, path.position);
          path.position = new paper.Point(this.position.x, this.position.y - offset);
          path.rotate(this.rotation, this.position);

        } else if (this.boundingShape == "square") {

          // reduce size of rotated squares
          if (this.rotation % 90 == 45) {
            this.size *= 0.8;
          }

          path.position = this.position;
          var scale = this.size / Math.max(path.bounds.width, path.bounds.height);
          path.scale(scale);
          path.rotate(this.rotation);

        } else if (this.boundingShape == "hexagon") {

          path.position = this.position;
          var scale = this.size / Math.max(path.bounds.width, path.bounds.height);
          path.scale(scale);
          path.rotate(this.rotation);
        }
      }

      path.strokeColor = this.strokeColor;
      path.strokeWidth = STROKE_WIDTH;
      path.parent = results;
      this.path = path;
    }
  }

  initBoundaries() {

    if (this.boundingShape != "custom" && this.boundingShape != "double") {
      for (var i = 0; i < MAX_CONTOURS; i++) {
        var boundary = this.initBoundary(i + 1);
        this.boundaries.push(boundary);
      }
    }
  }

  initBoundary(depth) {

    if (this.boundingShape != "custom" && this.boundingShape != "double") {
      var boundary;
      var size = this.size;
      var position = this.position;

      size += 2 * CONTOUR_SPACING * depth;

      if (this.boundingShape == "square") {

        boundary = new paper.Path.Rectangle({
          position: position,
          size: size
        });

        boundary.rotate(this.rotation);

      } else if (this.boundingShape == "circle") {

        boundary = new paper.Path.Ellipse({
          position: position,
          size: size
        });

        boundary.rotate(this.rotation);

      } else if (this.boundingShape == "triangle") {

        size += CONTOUR_SPACING * depth;
        size *= 0.8;
        var boundary = triangleEquilateral(this.position, size, this.strokeColor);

        boundary.rotate(this.rotation, this.position);

      } else if (this.boundingShape == "hexagon") {

        size += CONTOUR_SPACING * depth;
        var boundary = new paper.Path.RegularPolygon({
          position: position,
          radius: size / 2,
          sides: 6
        });

        boundary.rotate(this.rotation + 30, this.position);
      }

      boundary.strokeColor = this.strokeColor;
      boundary.strokeWidth = STROKE_WIDTH;
      boundary.parent = originals;

      return boundary;
    }
  }

  intersects(primitive) {
    var intersects = false;
    
    intersects = intersects || primitive.boundaries[0].intersects(this.path);
    intersects = intersects || this.path.intersects(primitive.path);

    return intersects;
  }

  drawBehind(primitive) {
    var result = this.path.subtract(primitive.boundaries[0]);
    this.path.remove();
    this.path = result;
  }

  crop(path) {
    if (path.intersects(this.path)) {
      var result = this.path.intersect(path);
      this.path.remove();
      this.path = result;
    }
  }

  clear() {
    this.path.remove();
    for (var i = 0; i < this.boundaries.length; i++) {
      this.boundaries[i].remove();
    }
  }
}

// ========================================================
// Triangle helpers
// ========================================================

function triangleEquilateral(position, size, strokeColor) {

  var triangle = new paper.Path.RegularPolygon({
    position: position,
    sides: 3,
    radius: size / 1.2,
    strokeColor: strokeColor,
    strokeWidth: STROKE_WIDTH,
    parent: results
  });

  var offset = getCentroidDistance(triangle);

  triangle.position = new paper.Point(position.x, triangle.position.y - offset);

  return triangle;
}

function getHeight(triangle) {
  var height = triangle.bounds.height;
  return height;
}

function getCenterY(triangle) {
  var center = triangle.bounds.center;
  return center.y;
}

function getCentroidDistance(triangle) {

  var pointA = triangle.segments[0].point;
  var pointB = triangle.segments[1].point;
  var pointC = triangle.segments[2].point;

  var centroidX = (pointA.x + pointB.x + pointC.x) / 3.0;
  var centroidY = (pointA.y + pointB.y + pointC.y) / 3.0;

  return centroidY - triangle.position.y;
}

function getCentroidDistance3(pointA, pointB, pointC, position) {

  var centroidX = (pointA.x + pointB.x + pointC.x) / 3.0;
  var centroidY = (pointA.y + pointB.y + pointC.y) / 3.0;

  return centroidY - position.y;
}

// for testing purposes
function drawPoint(point) {
  var dot = new paper.Path.Ellipse({
    position: point,
    size: 10,
    strokeColor: palette.orange
  });
}