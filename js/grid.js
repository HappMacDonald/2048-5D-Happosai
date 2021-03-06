function Grid(size) {
  this.size = size;

  this.cells = [];

  this.build();
}

// Build a grid of the specified size
Grid.prototype.build = function () {
  for (var x = 0; x < this.size; x++) {
    var row = this.cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      var col = [];
      row.push(col);
      for (var z = 0; z < this.size; z++) {
        var beam = [];
        col.push(beam);
        for (var w = 0; w < this.size; w++) {
          var something = [];
          beam.push(something);
          for (var v = 0; v < this.size; ++v) {
            something.push(null);
          }
        }
      }
    }
  }
};

// Find the first available random position
Grid.prototype.randomAvailableCell = function () {
  var cells = this.availableCells();

  if (cells.length) {
    return cells[Math.floor(Math.random() * cells.length)];
  }
};

Grid.prototype.availableCells = function () {
  var cells = [];

  this.eachCell(function (x, y, z, w, v, tile) {
    if (!tile) {
      cells.push({ x: x, y: y, z: z, w: w, v: v });
    }
  });

  return cells;
};

// Call callback for every cell
Grid.prototype.eachCell = function (callback) {
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      for (var z = 0; z < this.size; z++) {
        for (var w = 0; w < this.size; w++) {
          for (var v = 0; v < this.size; ++v) {
            callback(x, y, z, w, v, this.cells[x][y][z][w][v]);
          }
        }
      }
    }
  }
};

Grid.prototype.setEachCell = function (callback)
{ for (var x = 0; x < this.size; x++)
  { for (var y = 0; y < this.size; y++)
    { for (var z = 0; z < this.size; z++)
      { for (var w = 0; w < this.size; w++)
        { for (var v = 0; v < this.size; ++v)
          { this.cells[x][y][z][w][v] = callback(x, y, z, w, v, this.cells[x][y][z][w][v]);
          }
        }
      }
    }
  }
};


// Check if there are any cells available
Grid.prototype.cellsAvailable = function () {
  return !!this.availableCells().length;
};

// Check if the specified cell is taken
Grid.prototype.cellAvailable = function (cell) {
  return !this.cellOccupied(cell);
};

Grid.prototype.cellOccupied = function (cell) {
  return !!this.cellContent(cell);
};

Grid.prototype.cellContent = function (cell) {
  if (this.withinBounds(cell)) {
    return this.cells[cell.x][cell.y][cell.z][cell.w][cell.v];
  } else {
    return null;
  }
};

// Inserts a tile at its position
Grid.prototype.insertTile = function (tile) {
  this.cells[tile.x][tile.y][tile.z][tile.w][tile.v] = tile;
};

Grid.prototype.removeTile = function (tile) {
  this.cells[tile.x][tile.y][tile.z][tile.w][tile.v] = null;
};

Grid.prototype.withinBounds = function (position) {
  return position.x >= 0 && position.x < this.size &&
         position.y >= 0 && position.y < this.size &&
         position.z >= 0 && position.z < this.size &&
         position.w >= 0 && position.w < this.size &&
         position.v >= 0 && position.v < this.size;
};
