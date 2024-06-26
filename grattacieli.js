"use strict"

import { WebGLRenderer } from "./webgl-renderer.js"
import { ThreejsRenderer } from "./three-renderer.js"
import { degToRad } from "./libs/myutils.js"


export const CAMERA_N = 1;
export const CAMERA_E = 2;
export const CAMERA_S = 3;
export const CAMERA_W = 4;

export const colors = {
    1: m4.normalize([20, 200, 255]),
    2: m4.normalize([120, 100, 255]),
    3: m4.normalize([110, 255, 120]),
    4: m4.normalize([255, 200, 0]),
    5: m4.normalize([220, 50, 0]),
    6: m4.normalize([250, 0, 230]),
    7: m4.normalize([196, 0, 255]),
    8: m4.normalize([0, 0, 0]),
    9: m4.normalize([0, 0, 0]),
}

class Tile {
    constructor(x, z) {
        this.x = x;
        this.z = z;
    }
}

class Lot extends Tile {
    constructor(x, z) {
        super(x, z);
        this.skyscraper = 0;
        this.selected = false;
    }
}

class Objective extends Tile {
    constructor(x, z, n, rotation = 0) {
        super(x, z);
        this.n = n;
        this.rotation = rotation;
        this.correct = false;
        this.duplicates = false;
    }
}

export class Game {
    options = {
        // swap or overwrite the skyscraper looked at
        swap: { value: true, description: "Swap skyscrapers", toggle: function () { this.value = !this.value } },
        // show a shadow of the skyscraper you picked up
        showGhost: { value: true, description: "Show ghosts", toggle: function () { this.value = !this.value } },
        // show how many skyscrapers are left to place
        showRemaining: { value: false, description: "Show remaining", toggle: function () { this.value = !this.value } },
        // change the color of the tiles to help the player
        helpers: { value: true, description: "Show correct and duplicates", toggle: function () { this.value = !this.value } },
        // numbers rotate to follow camera
        rotateNumbers: { value: true, description: "Rotate numbers with view", toggle: function () { this.value = !this.value } },
        // draw the corners of the grid
        drawCorners: { value: true, description: "Draw corners", toggle: function () { this.value = !this.value } },
        // show the entire scene in orthographic projection
        orthographic: { value: false, description: "Orthographic view", toggle: function () { this.value = !this.value } },
    }
    camera = {
        fov: 40,
        near: 1, far: 2000,
        zoom: 30, minZoom: 13, maxZoom: 100,
        angleX: 70, angleY: 70,
        slowness: 5,
        panSlowness: 15,
        y: 4.5,
        keyMovement: 3,
        orto: false,
        lastOrtoAngle: 0,
    }
    orto = {
        cam1Near: 1, cam1Far: 2000,
        gameareaSnapAngleX: 0, gameareaSnapAngleY: 0,
        gameareaCamOrthoUnits: 10,
        minimapCamOrthoUnits: 0,
        selectorCamOrthoUnits: 0,
    }
    light = {
        x: 0, y: 10, z: 0,
        mode: 1, // 1 - all, 2 - ambient, 3 - diffuse, 4 - specular
        Ka: 0.7, Kd: .35, Ks: 0,
        shininessVal: 80,
        transparency: 0.5,
        selectorX: -7,
        selectorKa: 0.4, selectorKd: 0.8,
    }
    controls = {
        mouseX: -1,
        mouseY: -1,
        usingTouch: false,
        clicking: false,
        holding: false,
        movingView: false,
        panning: false,
    }

    constructor(settings, gameEndedCallback) {
        this.size = settings.boardSize;
        this.disposition = settings.disposition;
        /** @type Lot[] */ this.board = [];
        /** @type Objective[] */ this.numbersAround = []; //TODO: possono essere accorpati alla board?
        /** @type Tile[] */ this.corners = [];
        this.placed = {};
        this.playing = false;
        this.gameEndedCallback = gameEndedCallback;

        this.orto.minimapCamOrthoUnits = settings.boardSize + 5;
        this.orto.selectorCamOrthoUnits = settings.boardSize + 1.5;

        this.setupBoard();
    }

    setupBoard() {
        if (this.size > 1) {
            for (var zz = 0; zz < this.size; ++zz) {
                var z = getPosFromIndex(zz, this.size)
                for (var xx = 0; xx < this.size; ++xx) {
                    var x = getPosFromIndex(xx, this.size);
                    this.board.push(new Lot(x, z));
                    // id += 1; // TODO: servono ancora gli id?
                }
            }
        }

        for (let i = 0; i < this.size; i++) {
            let p1 = getPosFromIndex(i, this.size);
            let p2 = this.size + 1;
            // top -  left to right
            this.numbersAround.push(new Objective(p1, -p2, this.disposition[i + 0], 270));
            // right - top to bottom
            this.numbersAround.push(new Objective(p2, p1, this.disposition[i + 1 * this.size], 180));
            // bottom - left to right
            this.numbersAround.push(new Objective(p1, p2, this.disposition[i + 2 * this.size], 90));
            // left - top to bottom
            this.numbersAround.push(new Objective(-p2, p1, this.disposition[i + 3 * this.size], 0));

            this.placed[i + 1] = 0;
        }

        this.corners.push(new Tile(this.size + 1, this.size + 1, 0));
        this.corners.push(new Tile(-(this.size + 1), this.size + 1, 0));
        this.corners.push(new Tile(this.size + 1, -(this.size + 1), 0));
        this.corners.push(new Tile(-(this.size + 1), -(this.size + 1), 0));
    }

    check() {
        function countVisible(row) {
            let notEmpty = row.filter(s => s > 0);
            let visible = notEmpty.length > 0 ? 1 : 0; // check if there is at least one skyscraper
            var tallest = notEmpty[0];
            for (let i = 1; i < notEmpty.length; i++) {
                if (notEmpty[i] > notEmpty[i - 1] && notEmpty[i] > tallest) {
                    tallest = notEmpty[i];
                    visible += 1;
                }
            }
            return visible;
        }

        let won = this.board.filter(s => s.skyscraper > 0).length === this.board.length;

        for (let [k, _] of Object.entries(this.placed)) {
            this.placed[k] = 0;
        }

        for (let i = 0; i < this.size; i++) {
            let row = [];
            let col = [];
            let topN = this.numbersAround[4 * i + 0];
            let rightN = this.numbersAround[4 * i + 1];
            let bottomN = this.numbersAround[4 * i + 2];
            let leftN = this.numbersAround[4 * i + 3];
            topN.duplicates = false;
            rightN.duplicates = false;
            bottomN.duplicates = false;
            leftN.duplicates = false;
            for (let j = 0; j < this.size; j++) {
                let rowPiece = this.board[i * this.size + j].skyscraper;
                let colPiece = this.board[i + j * this.size].skyscraper;
                if (row.includes(rowPiece) && rowPiece !== 0) {
                    won = false;
                    leftN.duplicates = true;
                    rightN.duplicates = true;
                }
                if (col.includes(colPiece) && colPiece !== 0) {
                    won = false;
                    topN.duplicates = true;
                    bottomN.duplicates = true;
                }
                row.push(rowPiece);
                col.push(colPiece);
            }

            for (let s of row) {
                if (s > 0) {
                    if (s in this.placed) {
                        this.placed[s] += 1;
                    }
                }
            }

            topN.correct = topN.n > 0 && countVisible(col) === topN.n;
            rightN.correct = rightN.n > 0 && countVisible(row.toReversed()) === rightN.n;
            bottomN.correct = bottomN.n > 0 && countVisible(col.toReversed()) === bottomN.n;
            leftN.correct = leftN.n > 0 && countVisible(row) === leftN.n;
        };

        if (won) {
            this.end();
        }

        return won;
    }

    end() {
        this.playing = false;
        this.gameEndedCallback();
    }

    // computes the camera position as it orbits around the center
    getCameraPos() {
        const X = this.camera.zoom * Math.cos(degToRad(this.camera.angleX)) * Math.sin(degToRad(this.camera.angleY));
        const Z = this.camera.zoom * Math.sin(degToRad(this.camera.angleX)) * Math.sin(degToRad(this.camera.angleY));
        const Y = this.camera.zoom * Math.cos(degToRad(this.camera.angleY)) + this.camera.y;

        return [X, Y, Z];
    }

    correctAngles() {
        this.camera.orto = false;
        if (this.camera.angleX <= 0) {
            this.camera.angleX = 360
        } else if (this.camera.angleX >= 360) {
            this.camera.angleX = 0
        }
        if (this.camera.angleY >= 90) {
            this.camera.angleY = 89.99 // a view completely from the top messes up the camera
        }
        if (this.camera.angleY <= 0) {
            this.camera.angleY = 0.01
        }
    }
    rotateRight() {
        this.camera.angleX -= this.camera.keyMovement;
        this.correctAngles();
    }
    rotateLeft() {
        this.camera.angleX += this.camera.keyMovement;
        this.correctAngles();
    }
    rotateUp() {
        this.camera.angleY -= this.camera.keyMovement;
        this.correctAngles();
    }
    rotateDown() {
        this.camera.angleY += this.camera.keyMovement;
        this.correctAngles();
    }
    changeViewSnapCounterclockwise() {
        if (this.camera.orto) {
            this.camera.angleX -= 90;
            if (this.camera.angleX < 0) {
                this.camera.angleX = 270;
            }
        } else {
            // snap to the nearest multiple of 90
            this.camera.angleX = Math.round(this.camera.angleX / 90) * 90;
        }
        this.camera.angleY = 90;
        this.camera.orto = true;
    }
    changeViewSnapClockwise() {
        if (this.camera.orto) {
            this.camera.angleX += 90;
            if (this.camera.angleX > 360) {
                this.camera.angleX = 90;
            }
        } else {
            // snap to the nearest multiple of 90
            this.camera.angleX = Math.round(this.camera.angleX / 90) * 90;;
        }
        this.camera.angleY = 90;
        this.camera.orto = true;
    }
    setSnap(dir) {
        switch (dir) {
            case CAMERA_E:
                this.camera.angleX = 0;
                break;
            case CAMERA_S:
                this.camera.angleX = 90;
                break;
            case CAMERA_W:
                this.camera.angleX = 180;
                break;
            case CAMERA_N:
                this.camera.angleX = 270;
                break;
        }
        this.camera.angleY = 90;
        this.camera.orto = true;
    }
}


export function play(settings, gameEndedCallback) {
    
    const game = new Game(settings, gameEndedCallback);
    
    var gui = new dat.GUI();
    gui.close();

    const cameraFolder = gui.addFolder('Camera');
    cameraFolder.add(game.camera, 'fov'); 
    cameraFolder.add(game.camera, 'near');
    cameraFolder.add(game.camera, 'far'); 
    cameraFolder.add(game.camera, 'minZoom'); 
    cameraFolder.add(game.camera, 'maxZoom'); 
    cameraFolder.add(game.camera, 'slowness');
    cameraFolder.add(game.camera, 'panSlowness');
    cameraFolder.add(game.camera, 'y'); 
    cameraFolder.add(game.camera, 'keyMovement'); 
    cameraFolder.add(game.camera, 'orto');

    const lightFolder = gui.addFolder("Light");
    lightFolder.add(game.light, 'x', -50, 50).step(1);
    lightFolder.add(game.light, 'y', -50, 50).step(1);
    lightFolder.add(game.light, 'z', -50, 50).step(1);
    lightFolder.add(game.light, 'mode', 1, 4).step(1);
    lightFolder.add(game.light, 'Ka', 0, 1).step(0.01);
    lightFolder.add(game.light, 'Kd', 0, 1).step(0.01);
    lightFolder.add(game.light, 'Ks', 0, 1).step(0.01);
    lightFolder.add(game.light, 'shininessVal');
    lightFolder.add(game.light, 'transparency', 0, 1).step(0.05);
    lightFolder.add(game.light, 'selectorX', -75, 75).step(1);
    lightFolder.add(game.light, 'selectorKa', 0, 1).step(0.01);
    lightFolder.add(game.light, 'selectorKd', 0, 1).step(0.01);


    WebGLRenderer(game);

    // ThreejsRenderer(game);

}

export function getPosFromIndex(i, size) {
    return (i / (size - 1) - .5) * 2 * (size - 1)
}
