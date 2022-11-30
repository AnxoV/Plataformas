/**
 * A canvas is a type of display that uses
 * the Canvas DOM Element as the graphic interface.
 */
class Canvas {
    /**
     * @param {HTMLElement} parent The canvas element parent
     * @param {Number} width The canvas width
     * @param {Number} height The canvas height
     */
    constructor(parent=document.body, width=500, height=500) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        parent.appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");
    }

    /**
     * Resizes the canvas.
     * @param {Number} width The new width
     * @param {Number} height The new height
     */
    resize(width, height) {
        this.canvas.width = width,
        this.canvas.height = height;
    }

    /**
     * Clears the canvas.
     */
    clear() {
        this.ctx.fillStyle = "rgb(255, 255, 255)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draws an actor on the canvas
     * @param {*} actor The actor
     */
    drawRect(actor) {
        this.ctx.fillStyle = actor.colour;
        this.ctx.fillRect(actor.position.x*config.blockSize,
                          actor.position.y*config.blockSize,
                          actor.size.x*config.blockSize,
                          actor.size.y*config.blockSize);
    }

    /**
     * Renders the canvas from an state.
     * @param {State} state The new state
     */
    sync(state) {
        this.clear();
        this.drawBackground(state.level);
        this.drawActors(state.actors);
    }

    /**
     * Draws the background static elements of the canvas.
     * @param {Level} level The level
     */
    drawBackground(level) {
        level.rows.forEach((row, y)=> {
            row.forEach((block, x) => {
                this.drawRect({position: {x: x, y: y}, size: {x: 1, y: 1}, colour: config.colours[block]});
            })
        })
    }

    /**
     * Draws the actors (dynamic elements) on the canvas.
     * @param {*} actors The actor
     */
    drawActors(actors) {
        actors.forEach(actor => {
            this.drawRect(actor);
        });
    }
}

/**
 * A level is the set of dynamic and static elements
 * that can be displayed and interacted with.
 */
class Level {
    /**
     * Constructs a level from a given model.
     * 
     * A model is a multiline string made from the characters
     * specified at config.
     * @param {String} plan The model of the level
     */
    constructor(plan) {
        const rows = plan.trim().split("\n").map(e => [...e]);
        this.width = rows[0].length;
        this.height = rows.length;
        this.actors = [];

        this.rows = rows.map((row, y) => {
            return row.map((char, x) => {
                let type = config.levelChars[char];
                if (typeof type == "string") return type;
                this.actors.push(type.create(new Vector(x, y), char));
                return "empty";
            });
        });
    }
}
/**
 * Calculates if an actor (given as position and size)
 * is touching (colliding with / inside of) a certaing element.
 * @param {Vector} position The actor's position
 * @param {Vector} size The actor's size
 * @param {String} type The element type
 * @returns True if the actor is touchin the element, false otherwise
 */
Level.prototype.touches = function(position, size, type) {
    const xStart = Math.floor(position.x);
    const xEnd = Math.ceil(position.x + size.x);
    const yStart = Math.floor(position.y);
    const yEnd = Math.ceil(position.y + size.y);

    for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
            const isOutside = x < 0 || x >= this.width
                            || y < 0 || y >= this.height;
            const here = isOutside ? "wall" : this.rows[y][x];
            if (here == type) return true;
        }
    }
    return false;
};  

/**
 * A state is a snapshot of the program state in
 * a given moment of time during its execution.
 */
class State {
    /**
     * @param {Level} level The state level
     * @param {*[]} actors The state actors
     * @param {String} status The state status ("playing", "won", "lost", etc)
     */
    constructor(level, actors, status) {
        this.level = level;
        this.actors = actors;
        this.status = status;
    }

    /**
     * Returns a new State object from a given level.
     * @param {Level} level The level
     * @returns The new state
     */
    static start(level) {
        return new State(level, level.actors, "playing");
    }

    /**
     * @returns The player actor
     */
    get player() {
        return this.actors.find(e => e.type == "player");
    }
}
/**
 * Updates the state of the program and returns a new State object.
 * @param {Number} time Milliseconds from the last frame
 * @param {{key: boolean}} keys The key states
 * @returns The new state
 */
State.prototype.update = function(time, keys) {
    const actors = this.actors.map(actor => {
        return actor.update(time, this, keys);
    });

    let newState = new State(this.level, actors, this.status);
    if (newState.status != "playing") return newState;
    let player = newState.player;
    if (this.level.touches(player.position, player.size, "lava")) {
        return new State(this.level, actors, "lost");
    }

    actors.forEach(actor => {
        if (actor != player && overlap(actor, player)) {
            newState = actor.collide(newState);
        }
    });

    return newState;
};

/**
 * A set of coordinates from (0, 0).
 */
class Vector {
    /**
     * @param {Number} x The x value
     * @param {Number} y The y value
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Adds a vector.
     * 
     * Vo = (Vnx + Vmx, Vny + Vmy)
     * @param {Vector} vector The vector to add
     * @returns The new vector
     */
    add(vector) {
        return new Vector(
            this.x + vector.x,
            this.y + vector.y
        );
    }

    /**
     * Substracts a vector.
     * 
     * Vo = (Vnx - Vmx, Vny - Vmy)
     * @param {Vector} vector The vector to substract
     * @returns The new vector
     */
    substract(vector) {
        return new Vector(
            this.x - vector.x,
            this.y - vector.y
        );
    }

    /**
     * Multiplies the vector by a value.
     * 
     * Vo = (Vx * scalar, Vy * scalar)
     * @param {Number} scalar The value to multiply
     * @returns The new vector
     */
    multiply(scalar) {
        return new Vector(
            this.x * scalar,
            this.y * scalar
        );
    }

    /**
     * Multiplies the vector, using the dot product, by another vector.
     * @param {Vector} vector The vector to multiply
     * @returns The scalar result of the dot product
     */
    dotProduct(vector) {
        return this.x * vector.x + this.y * vector.y;
    }

    /**
     * @returns The magnitude of the vector
     */
    get magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }

    /**
     * @returns The direction (in radians) of the vector
     */
    get direction() {
        return Math.atan2(this.x, this.y);
    }
}

/**
 * The actor the user can control and interact with.
 */
class Player {
    /**
     * @param {Vector} position The player position
     * @param {Vector} speed The player speed
     */
    constructor(position, speed) {
        this.position = position;
        this.speed = speed;
    }

    /**
     * @returns The type of the player
     */
    get type() { return "player"; }

    /**
     * Returns a new Player object from a given position.
     * @param {Vector} position The player position
     * @returns The new player
     */
    static create(position) {
        return new Player(position.add(new Vector(0, -0.5)), new Vector(0, 0));
    }
}
/** The player size relative to a block unit. */
Player.prototype.size = new Vector(0.8, 1.5);
Player.prototype.colour = "blue";
/**
 * Updates the state of the player and returns a new Player object.
 * @param {Number} time Milliseconds from the last frame
 * @param {State} state The program state
 * @param {{key: boolean}} keys The key states
 * @returns The new player
 */
Player.prototype.update = function(time, state, keys) {
    let xSpeed = 0;
    if (keys.ArrowLeft) xSpeed -= config.playerXSpeed;
    if (keys.ArrowRight) xSpeed += config.playerXSpeed;
    let position = this.position;
    let movedX = position.add(new Vector(xSpeed * time, 0));
    if (!state.level.touches(movedX, this.size, "wall")) {
        position = movedX;
    }

    let ySpeed = this.speed.y + time * config.gravity;
    let movedY = position.add(new Vector(0, ySpeed * time));
    if (!state.level.touches(movedY, this.size, "wall")) {
        position = movedY;
    } else if (keys.ArrowUp && ySpeed > 0) {
        ySpeed = -config.jumpSpeed;
    } else {
        ySpeed = 0;
    }

    return new Player(position, new Vector(xSpeed, ySpeed));
};

/**
 * The actor that damages the player.
 */
class Lava {
    /**
     * @param {Vector} position The lava position
     * @param {Vector} speed The lava speed
     * @param {Vector} reset The lava reset position. When dripping and colliding with the floor, revert to this position
     */
    constructor(position, speed, reset) {
        this.position = position;
        this.speed = speed;
        this.reset = reset;
    }

    /**
     * @returns The type of the lava
     */
    get type() { return "lava"; }

    /**
     * Returns a new Lava object from a given position and type.
     * @param {Vector} position The lava position
     * @param {String} char The lava type
     * @returns The new lava
     */
    static create(position, char) {
        if (char == "=") {
            return new Lava(position, new Vector(2, 0))
        } else if (char == "|") {
            return new Lava(position, new Vector(0, 2));
        } else if (char == "v") {
            return new Lava(position, new Vector(0, 3), position);
        }
    }
}
/** The lava size relative to a block unit. */
Lava.prototype.size = new Vector(1, 1);
Lava.prototype.colour = "red";
/**
 * Returns a new State object with the status property set to "lost".
 * @param {State} state The program state
 * @returns The new state
 */
Lava.prototype.collide = function(state) {
    return new State(state.level, state.actors, "lost");
};
/**
 * Updates the state of the lava and returns a new Lava object.
 * @param {Number} time Milliseconds from the last frame
 * @param {State} state The program state
 * @returns The new lava
 */
Lava.prototype.update = function(time, state) {
    const newPos = this.position.add(this.speed.multiply(time));
    if (!state.level.touches(newPos, this.size, "wall")) {
        return new Lava(newPos, this.speed, this.reset);
    } else if (this.reset) {
        return new Lava(this.reset, this.speed, this.reset);
    } else {
        return new Lava(this.position, this.speed.multiply(-1));
    }
};

/**
 * The actor the player can collect.
 */
class Coin {
    /**
     * @param {Vector} position The coin position
     * @param {Vector} basePosition The coin initial position
     * @param {Number} wobble The coin wobble factor
     */
    constructor(position, basePosition, wobble) {
        this.position = position;
        this.basePosition = basePosition;
        this.wobble = wobble;
    }

    /**
     * @returns The type of the coin.
     */
    get type() { return "coin"; }

    /**
     * Returns a new Coin object from a given position.
     * @param {Vector} position The coin position
     * @returns The new coin
     */
    static create(position) {
        let basePosition = position.add(new Vector(0.2, 0.1));
        return new Coin(basePosition, basePosition, Math.random()*Math.PI*2);
    }
}
/** The coin size relative to a block unit. */
Coin.prototype.size = new Vector(0.6, 0.6);
Coin.prototype.colour = "yellow";
/**
 * Returns a new State object with the coin removed.
 * @param {State} state The program state
 * @returns The new state
 */
Coin.prototype.collide = function(state) {
    let filtered = state.actors.filter(e => e != this);
    let status = state.status;
    if (!filtered.some(a => a.type == "coin")) status = "won";
    return new State(state.level, filtered, status);
};
/**
 * Updates the state of the coin and returns a new Coin object.
 * @param {Number} time Milliseconds from the last frame
 * @returns The new coin
 */
Coin.prototype.update = function(time) {
    const wobble = this.wobble + time * config.wobbleSpeed;
    const wobblePosition =  Math.sin(wobble) * config.wobbleDist;
    return new Coin(this.basePosition.add(new Vector(0, wobblePosition)),
                    this.basePosition, wobble);
};

/**
 * Returns wether a given actor is inside of the other, or viceversa.
 * @param {*} actor1 The first actor
 * @param {*} actor2 The sencond actor
 * @returns True if they overlap, false otherwise
 */
const overlap = function(actor1, actor2) {
    return actor1.position.x + actor1.size.x > actor2.position.x
            && actor1.position.x < actor2.position.x + actor2.size.x
            && actor1.position.y + actor1.size.y > actor2.position.y
            && actor1.position.y < actor2.position.y + actor2.size.y;
}

/**
 * Tracks the keypress of any given key.
 * @param {String[]} keys The keys to track
 * @returns The key states
 */
const trackKeys = function(keys) {
    let down = Object.create(null);
    const track = function(event) {
        if (keys.includes(event.key)) {
            down[event.key] = event.type == "keydown";
            event.preventDefault();
        }
    };
    window.addEventListener("keydown", track);
    window.addEventListener("keyup", track);
    return down;
}

/**
 * Animation loop
 */
const runAnimation = animation => {
    let then = null;
    const frame = now => {
        if (then !== null) {
            const deltatime = Math.min(100, now-then) / 1000;

            if (animation(deltatime) === false) {
                return;
            }
        }

        then = now;
        requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
};

/**
 * Displays and runs a level.
 * @param {Canvas} display The display
 * @param {Level} level The level
 * @returns A promise from the level
 */
const runLevel = function(display, level) {
    let ending = 1;
    let state = State.start(level);
    return new Promise(resolve => {
        runAnimation(time => {
            state = state.update(time, config.arrowKeys);
            display.sync(state);
            if (state.status == "playing") 
                return true;
            else if (ending > 0) {
                ending -= time;
                return true;
            } else {
                display.clear();
                resolve(state.status);
                return false;
            }
        });
    });
    
}

/**
 * Runs a game from a list of levels and a set of configurations.
 * @param {Level[]} plans The levels
 * @param {*} config The configuration
 */
const runGame = async function(plans, config) {
    let level;
    let display = new Canvas(document.body);
    let status;
    for (let i = 0; i < plans.length;) {
        level = new Level(plans[i]);
        display.resize(level.width*config.blockSize, level.height*config.blockSize);
        status = await runLevel(display, level);
        if (status == "won") i++;
    }
    console.log("You've won!");
}

const plans = [
`
....................
..#..............#..
..#..............#..
..#.@...o..o..o..#..
..################..
....................`,
`
....................
..#=.......o.....#..
..#..............#..
..#.@...o.....o.=#..
..################..
....................`,
`
........#####.........
..#......|........#..
..#.@.............#..
..######..o..######..
..#...............#..
..#...............#..
..######..o..######..
..#...............#..
..#........|......#..
..#.....#####.....#..
..#################.
....................`,
`
.....................
.....................
.....................
.....................
.....................
..#...............#..
..#.@...........o.#..
..######.......####..
.......#.......#.....
.......#+++++++#.....
.......#########.....
.....................`,

`
######################
######.###v#..##v#.###
##..#..........o.....#
#....................#
#.@................o.#
######################`,
`
........................
........................
........................
........................
........................
......@.................
#....###..###..#..#....#
|....#.....#...##.#.....
.#...###...#...#.##...#.
.....#....###..#..#....|
#......................#
........................
........................
........................
++++++++++++++++++++++++`
];

const config = {
    blockSize: 40,
    playerXSpeed: 7,
    jumpSpeed: 15,
    gravity: 30,
    wobbleSpeed: 7,
    wobbleDist: 0.05,
    levelChars: {
        ".": "empty",
        "#": "wall",
        "+": "lava",
        "@": Player,
        "o": Coin,
        "=": Lava,
        "|": Lava,
        "v": Lava,
    },
    colours: {
        "empty": "white",
        "wall": "gray",
        "lava": "red",
    },
    arrowKeys: trackKeys(["ArrowLeft", "ArrowRight", "ArrowUp"]),
}


runGame(plans, config);