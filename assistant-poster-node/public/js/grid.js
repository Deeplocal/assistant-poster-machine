// ========================================================
// Grid and GridUnit class
// ========================================================

class Grid {

  constructor(gridSize, from, to, layout) {

    this.gridSize = gridSize;

    this.from = new paper.Point(from.x + gridSize / 2, from.y + gridSize / 2);
    this.to = new paper.Point(to.x - gridSize / 2, to.y - gridSize / 2);

    this.grid = [];
    this.width = Math.floor((this.to.x - this.from.x) / this.gridSize) + 1;
    this.height = Math.floor((this.to.y - this.from.y) / this.gridSize) + 1;
    this.midPoint = new paper.Point(paper.view.center.x, paper.view.center.y);

    this.layout = layout;

    this.double, this.neighbor;
    this.doubleRotation;
    this.hasDouble = false;

    this.initGrid();
  }

  reset(layout) {
    this.layout = layout;
    this.double = null;
    this.neighbor = null;
    this.doubleRotation = null;
    this.hasDouble = false;

    this.grid = [];
    this.initGrid();
  }

  initGrid() {

    var startX = this.from.x;
    var startY = this.from.y;
    var endX = this.to.x;
    var endY = this.to.y;
    var i = 0;

    for (var y = startY; y <= endY; y += this.gridSize) {
      for (var x = startX; x <= endX; x += this.gridSize) {

        var isFilled = !this.layout[i];

        var newPoint = new paper.Point(x, y);
        var newUnit = new GridUnit(newPoint, isFilled, i);

        if (this.layout[i] == 2) {
          if (this.double == null) {
            this.hasDouble = true;
            this.double = i;
          } else {
            this.neighbor = i;
          }
        }

        this.grid.push(newUnit);
        i++;

        // for visualization testing
        if (SHOW_GRID) {
          var size = new paper.Size(this.gridSize, this.gridSize);
          var path = new paper.Path.Rectangle({position: newPoint, size: size});
          path.strokeColor = "black";
        }
      }
    }

    if (this.hasDouble) {
      this.grid[this.double].neighbor = this.grid[this.neighbor];
      this.grid[this.neighbor].neighbor = this.grid[this.double];
      this.grid[this.neighbor].fill();

      var x1 = this.grid[this.double].point.x;
      var x2 = this.grid[this.neighbor].point.x;

      if (x1 - x2 < 0) {
        this.doubleRotation = 0;
      } else {
        this.doubleRotation = 90;
      }
    }
  }

  getUnit(isDouble) {

    if (this.hasDouble && isDouble && !this.isDoubleFilled()) {

        var newPoint = this.grid[this.double].getPoint();
        return newPoint;

    } else {

      var availableUnits = this.grid.filter(gridUnit => this.filterAvailable(gridUnit));

      if (availableUnits.length > 0) {

        var closestUnit = availableUnits[0];
        var closestDistance = closestUnit.getPoint().getDistance(this.midPoint);

        for (var i = 1; i < availableUnits.length; i++) {
          var unit = availableUnits[i];
          var point = unit.getPoint().clone();
          var distance = point.getDistance(this.midPoint);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestUnit = unit;
          }
        }

        var newUnit = closestUnit;
        var newPoint = newUnit.getPoint().clone();

        newUnit.fill();

        return newPoint;
      }
    }
  }

  filterAvailable(gridUnit) {
    return !gridUnit.isFilled;
  }

  isDoubleFilled() {
    return this.grid[this.double].isFilled;
  }

  fillDouble() {
    this.grid[this.double].fill();
  }
}

class GridUnit {

  constructor(point, isFilled, index) {
    this.point = point;
    this.isFilled = isFilled;
    this.index = index;
    this.neighbor;
  }

  getPoint() {
    var point;
    if (this.neighbor != null) {
      var x = (this.point.x + this.neighbor.point.x) / 2;
      var y = (this.point.y + this.neighbor.point.y) / 2;
      var point = new paper.Point(x, y);
    } else {
      point = this.point;
    }
    return point;
  }

  getIndex() {
    return this.index;
  }

  fill() {
    this.isFilled = true;

    // for visualization testing
    if (SHOW_GRID) {
      var size = new paper.Size(GRID_SIZE, GRID_SIZE);
      var path = new paper.Path.Rectangle({position: this.point, size: size});
      path.strokeColor = "red";
      path.strokeWidth = 2;
    }
  }
}