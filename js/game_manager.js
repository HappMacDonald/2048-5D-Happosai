function GameManager(size, InputManager, Actuator, ScoreManager) {
  this.size         = size; // Size of the grid
  this.inputManager = new InputManager;
  this.scoreManager = new ScoreManager;
  this.actuator     = new Actuator;

  this.startTiles   = 2;

  this.saveTimer    = null;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.actuator.continue();
  localStorage.removeItem("GameBoard");
  this.setup();
};

// Keep playing after winning
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continue();
};

GameManager.prototype.isGameTerminated = function () {
  if (this.over || (this.won && !this.keepPlaying)) {
    return true;
  } else {
    return false;
  }
};

// Set up the game
GameManager.prototype.setup = function ()
{ let pickle = localStorage.getItem("GameBoard");
  this.grid = new Grid(this.size);

  if(pickle!=null)
  { let obj = JSON.retrocycle(JSON.parse(LZString.decompress(pickle)));
  // { let obj = JSON.parse(LZString.decompress(pickle));
//LZString.compress(JSON.stringify(JSON.decycle(this)))
    console.log("obj", obj);
    console.log("obj.grid.cells", obj.grid.cells);
    this.grid.setEachCell
    ( (x, y, z, w, v, cell) =>
      { cell = obj.grid.cells[x][y][z][w][v]; // value is local, does not change caller argument.
        if(cell==null)
        { return null;
        } else
        { return new Tile({ x: x, y: y, z: z, w: w, v: v }, cell.value);
        }
      }
    );
    this.score       = obj.score;
    this.over        = obj.over;
    this.won         = obj.won;
    this.keepPlaying = obj.keepPlaying;
    console.log("this", this);
  }
  else
  { this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.scoreManager.get() < this.score) {
    this.scoreManager.set(this.score);
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.scoreManager.get(),
    terminated: this.isGameTerminated()
  });

};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, z, w, v, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y][tile.z][tile.w][tile.v] = null;
  this.grid.cells[cell.x][cell.y][cell.z][cell.w][cell.v] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2:down, 3: left
  // x + 4: hyper-x
  // 8: ultra-left, 9: ultra-right

  var self = this;

  // Make "keep playing" only last long enough to get you past the "game won" screen, and then re-arm the "did I win again?" counter.
  if(this.keepPlaying && this.won)
  { this.keepPlaying = this.won = false;
  }

  if(this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      traversals.z.forEach(function (z) {
        traversals.w.forEach(function (w) {
          traversals.v.forEach(function(v) {
            cell = { x: x, y: y, z: z, w: w, v: v };
            tile = self.grid.cellContent(cell);

            if (tile) {
              var positions = self.findFarthestPosition(cell, vector);
              var next      = self.grid.cellContent(positions.next);

              // Only one merger per row traversal?
              if (next && next.value === tile.value && !next.mergedFrom) {
                var merged = new Tile(positions.next, tile.value * 2);
                merged.mergedFrom = [tile, next];

                self.grid.insertTile(merged);
                self.grid.removeTile(tile);

                // Converge the two tiles' positions
                tile.updatePosition(positions.next);

                // Update the score
                self.score += merged.value;

                // The mighty 2048 tile
                // if (merged.value === 2048) self.won = true;
                if (merged.value == 1024) self.won = true;
              } else {
                self.moveTile(tile, positions.farthest);
              }

              if (!self.positionsEqual(cell, tile)) {
                moved = true; // The tile moved from its original cell!
              }
            }
          });
        });
      });
    });
  });

  if (moved) {
    this.addRandomTile();

    if (Math.random() < 0.7) {
      this.addRandomTile();
    }

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
    this.saveStateToPersistantStartTimer();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1, z: 0,  w: 0,  v: 0  },  // up
    1: { x: 1,  y: 0,  z: 0,  w: 0,  v: 0  },  // right
    2: { x: 0,  y: 1,  z: 0,  w: 0,  v: 0  },  // down
    3: { x: -1, y: 0,  z: 0,  w: 0,  v: 0  },  // left
    4: { x: 0,  y: 0,  z: 0,  w: -1, v: 0  },  // hyper-up
    5: { x: 0,  y: 0,  z: 1,  w: 0,  v: 0  },  // hyper-right
    6: { x: 0,  y: 0,  z: 0,  w: 1,  v: 0  },  // hyper-down
    7: { x: 0,  y: 0,  z: -1, w: 0,  v: 0  },  // hyper-left
    8: { x: 0,  y: 0,  z: 0,  w: 0 , v: -1 },  // ultra-left
    9: { x: 0,  y: 0,  z: 0,  w: 0 , v: 1  },  // ultra-right
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [], z: [], w: [], v: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
    traversals.z.push(pos);
    traversals.w.push(pos);
    traversals.v.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();
  if (vector.z === 1) traversals.z = traversals.z.reverse();
  if (vector.w === 1) traversals.w = traversals.w.reverse();
  if (vector.v === 1) traversals.v = traversals.v.reverse();
  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y,
                 z: previous.z + vector.z, w: previous.w + vector.w,
                 v: previous.v + vector.v };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      for (var z = 0; z < this.size; z++) {
        for (var w = 0; w < this.size; w++) {
          for (var v = 0; v < this.size; v++) {
            tile = this.grid.cellContent({ x: x, y: y, z: z, w: w, v: v });

            if (tile) {
              for (var direction = 0; direction < 10; direction++) {
                var vector = self.getVector(direction);
                var cell   = { x: x + vector.x, y: y + vector.y,
                               z: z + vector.z, w: w + vector.w,
                               v: v + vector.v };

                var other  = self.grid.cellContent(cell);

                if (other && other.value === tile.value) {
                  return true; // These two tiles can be merged
                }
              }
            }
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y &&
         first.z === second.z && first.w == second.w &&
         first.v === second.v;
};

GameManager.prototype.saveStateToPersistantStartTimer = function()
{ clearTimeout(this.saveTimer);
  this.saveTimer = setTimeout(() => {this.saveStateToPersistantFinishTimer()}, 1000);
}

GameManager.prototype.saveStateToPersistantFinishTimer = function()
{ let pickle;
  clearTimeout(this.saveTimer);
  pickle =
    LZString.compress
    ( JSON.stringify
      ( JSON.decycle
        ( { "grid": { "cells": this.grid.cells }
          , "score": this.score
          , "over": this.over
          , "won": this.won
          , "keepPlaying": this.keepPlaying
          }
        )
      )
    );
  console.log("Trying to save "+ pickle.length +" bytes");
  console.log("this.grid", this.grid);
  console.log("this", this);

  if(pickle.length < 3500)
  { localStorage.setItem("GameBoard", pickle);
  }
  else
  { console.log("Couldn't save state because "+ pickle.length +" bytes is too many. D:");
  }
  console.log("obj", JSON.retrocycle(JSON.parse(LZString.decompress(localStorage.getItem("GameBoard")))));
}

// function setCookie(cname, cvalue)
// { let d = new Date();
//   d.setTime(d.getTime() + (99999*24*60*60*1000));
//   var expires = "expires="+ d.toUTCString();
//   document.cookie = cname + "=" + cvalue + ";" + expires;
// }

