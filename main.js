/**
 * Es discutible si está bien el dónde guardo los colores para el fondo,
 * habría que buscar una solución más óptima si la hay
 */

class Canvas {
    constructor(parent=document.body, width=500, height=500) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        parent.appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");
    }
    
    refresh(colour="transparent") {
        this.ctx.fillStyle = colour;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawRect(actor) {
        this.ctx.fillStyle = actor.colour;
        this.ctx.fillRect(actor.position.x*blockSize, actor.position.y*blockSize, actor.size.x*blockSize, actor.size.y*blockSize);
    }

    sync(state) {
        this.clearDisplay();
        this.drawBackground(state.level);
        this.drawActors(state.actors);
    }

    clearDisplay() {
        this.ctx.fillStyle = "rgb(255, 255, 255)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackground(level) {
        level.rows.forEach((row, y)=> {
            row.forEach((block, x) => {
                this.drawRect({position: {x: x, y: y}, size: {x: 1, y: 1}, colour: colours[block]});
            })
        })
    }

    drawActors(actors) {
        actors.forEach(actor => {
            this.drawRect(actor);
        });
    }
}

class Level {
    constructor(plan) {
        const rows = plan.trim().split("\n").map(e => [...e]);
        this.width = rows[0].length;
        this.height = rows.length;
        this.actors = [];

        this.rows = rows.map((row, y) => {
            return row.map((char, x) => {
                let type = levelChars[char];
                if (typeof type == "string") return type;
                this.actors.push(type.create(new Vector(x, y), char));
                return "empty";
            });
        });
    }
}

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

class State {
    constructor(level, actors, status) {
        this.level = level;
        this.actors = actors;
        this.status = status;
    }

    static start(level) {
        return new State(level, level.actors, "playing");
    }

    get player() {
        return this.actors.find(e => e.type == "player");
    }
}

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

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(vector) {
        return new Vector(
            this.x + vector.x,
            this.y + vector.y
        );
    }

    substract(vector) {
        return new Vector(
            this.x - vector.x,
            this.y - vector.y
        );
    }

    multiply(scalar) {
        return new Vector(
            this.x * scalar,
            this.y * scalar
        );
    }

    dotProduct(vector) {
        return this.x * vector.x + this.y * vector.y;
    }

    get magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }

    get direction() {
        return Math.atan2(this.x, this.y);
    }
}

class Player {
    constructor(position, speed) {
        this.position = position;
        this.speed = speed;
    }

    get type() { return "player"; }

    static create(position) {
        return new Player(position.add(new Vector(0, -0.5)), new Vector(0, 0));
    }
}

Player.prototype.size = new Vector(0.8, 1.5);
Player.prototype.colour = "blue";
Player.prototype.update = function(time, state, keys) {
    let xSpeed = 0;
    if (keys.ArrowLeft) xSpeed -= playerXSpeed;
    if (keys.ArrowRight) xSpeed += playerXSpeed;
    let position = this.position;
    let movedX = position.add(new Vector(xSpeed * time, 0));
    if (!state.level.touches(movedX, this.size, "wall")) {
        position = movedX;
    }

    let ySpeed = this.speed.y + time * gravity;
    let movedY = position.add(new Vector(0, ySpeed * time));
    if (!state.level.touches(movedY, this.size, "wall")) {
        position = movedY;
    } else if (keys.ArrowUp && ySpeed > 0) {
        ySpeed = -jumpSpeed;
    } else {
        ySpeed = 0;
    }

    return new Player(position, new Vector(xSpeed, ySpeed));
};

class Lava {
    constructor(position, speed, reset) {
        this.position = position;
        this.speed = speed;
        this.reset = reset;
    }

    get type() { return "lava"; }

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

Lava.prototype.size = new Vector(1, 1);
Lava.prototype.colour = "red";
Lava.prototype.collide = function(state) {
    return new State(state.level, state.actors, "lost");
};
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

class Coin {
    constructor(position, basePosition, wobble) {
        this.position = position;
        this.basePosition = basePosition;
        this.wobble = wobble;
    }

    get type() { return "coin"; }

    static create(position) {
        let basePosition = position.add(new Vector(0.2, 0.1));
        return new Coin(basePosition, basePosition, Math.random()*Math.PI*2);
    }
}

Coin.prototype.size = new Vector(0.6, 0.6);
Coin.prototype.colour = "yellow";
Coin.prototype.collide = function(state) {
    let filtered = state.actors.filter(e => e != this);
    let status = state.status;
    if (!filtered.some(a => a.type == "coin")) status = "won";
    return new State(state.level, filtered, status);
};
Coin.prototype.update = function(time) {
    const wobble = this.wobble + time * wobbleSpeed;
    const wobblePosition =  Math.sin(wobble) * wobbleDist;
    return new Coin(this.basePosition.add(new Vector(0, wobblePosition)),
                    this.basePosition, wobble);
};

const runAnimation = function(animation) {
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

const overlap = function(actor1, actor2) {
    return actor1.position.x + actor1.size.x > actor2.position.x
            && actor1.position.x < actor2.position.x + actor2.size.x
            && actor1.position.y + actor1.size.y > actor2.position.y
            && actor1.position.y < actor2.position.y + actor2.size.y;
}

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

const arrowKeys = trackKeys(["ArrowLeft", "ArrowRight", "ArrowUp"]);

const levelChars = {
    ".": "empty",
    "#": "wall",
    "+": "lava",
    "@": Player,
    "o": Coin,
    "=": Lava,
    "|": Lava,
    "v": Lava,
}

const colours = {
    "empty": "white",
    "wall": "gray",
    "lava": "red",
}

const wobbleSpeed = 8, wobbleDist = 0.07;
const playerXSpeed = 7, gravity = 30, jumpSpeed = 15;

const plans = [`
......................
..#................#..
..#..............=.#..
..#.........o.o....#..
..#.@......#####...#..
..#####............#..
......#++++++++++++#..
......##############..
......................`];
const blockSize = 50;

const runLevel = function(display, level) {
    let ending = 1;
    let state = State.start(level);
    return new Promise(resolve => {
        runAnimation(time => {
            state = state.update(time, arrowKeys);
            display.sync(state);
            if (state.status == "playing") 
                return true;
            else if (ending > 0) {
                ending -= time;
                return true;
            } else {
                display.clearDisplay();
                resolve(state.status);
                return false;
            }
        });
    });
    
}

const runGame = async function(plans) {
    for (let i = 0; i < plans.length;) {
        const level = new Level(plans[i]);
        const display = new Canvas(
            document.body,
            level.width*blockSize,
            level.height*blockSize
        );
        let status = await runLevel(display, level);
        if (status == "won") i++;
    }
    console.log("You've won!");
}

runGame(plans);