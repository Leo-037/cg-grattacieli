"use strict"

import {
    cube_colors, cube_indices, cube_normals, cube_vertices, square_indices, square_normals, square_textcoords, square_vertices, plane_vertices, plane_normals, plane_indices,
} from "./resources/objects/geometry.js";
import { LoadMesh, degToRad, loadTexture } from "./libs/myutils.js"

const textureAtlas = {
    size: 512,
    textureWidth: 512 * 5,
    textureHeight: 512 * 5,
    pos: {
        1: { x: 0, y: 0 },
        2: { x: 1, y: 0 },
        3: { x: 2, y: 0 },
        4: { x: 3, y: 0 },
        5: { x: 4, y: 0 },
        6: { x: 0, y: 1 },
        7: { x: 1, y: 1 },
        8: { x: 2, y: 1 },
        9: { x: 3, y: 1 },
        "N": { x: 0, y: 2 },
        "E": { x: 1, y: 2 },
        "S": { x: 2, y: 2 },
        "W": { x: 3, y: 2 },
        "V": { x: 4, y: 2 },
        "tile": { x: 0, y: 3 },
        "empty": { x: 1, y: 3 },
        "wrong": { x: 2, y: 3 },
        "correct": { x: 3, y: 3 },
    }
}

const colors = {
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
const gameAreaColor = [0.8, 0.8, 1, 1];
const minimapColor = [1, 0.8, 0.3, 1];
const selectorColor = [0.2, 0.2, 0.2, 1];
const extraColor = [0.3, 0.7, 0.5, 1];


let playingGame = false;

export function play(settings, gameEndedCallback) {
    const BIN = 1;
    const CAMERA_N = 2;
    const CAMERA_E = 3;
    const CAMERA_S = 4;
    const CAMERA_W = 5;
    let binID = -1;
    let cameraNorthID = -1;
    let cameraEastID = -1;
    let cameraSouthID = -1;
    let cameraWestID = -1;

    const options = {
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
    const camera = {
        fov: 40,
        near: 1,
        far: 2000,
        zoom: 30,
        minZoom: 13,
        maxZoom: 100,
        angleX: 70,
        angleY: 70,
        slowness: 5,
        z: 4.5,
        keyMovement: 3,
        orto: false,
        lastOrtoAngle: 0,
    }
    const orto = {
        cam1Near: 1,
        cam1Far: 2000,
        gameareaSnapAngleX: 0,
        gameareaSnapAngleY: 0,
        gameareaCamOrthoUnits: 10,
        minimapCamOrthoUnits: settings.boardSize + 5,
        selectorCamOrthoUnits: settings.boardSize + 1.5,
    }
    const light = {
        x: 0, y: 10, z: 0,
        mode: 1, // 1 - all, 2 - ambient, 3 - diffuse, 4 - specular
        Ka: 0.7, Kd: .35, Ks: 0,
        shininessVal: 80,
        transparency: 0.5,
    }

    // ------- PAGE COMPONENTS -------

    /** @type {HTMLCanvasElement} */
    const canvas = document.querySelector('#canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
        return;
    }

    function getBooleanSymbol(value) {
        return value ? "✔" : "✘";
    }

    const optionsDiv = $('#options');
    for (const [k, option] of Object.entries(options)) {
        const toggle = () => { option.toggle(); $(`#${k}`).text(getBooleanSymbol(option.value)) };
        optionsDiv.append(
            $('<div/>', { "class": "options-line" })
                .append([
                    $('<span>', { "class": "btn-description", text: option.description }),
                    $('<button>', {
                        id: k,
                        class: 'options-button',
                        type: "button",
                        text: getBooleanSymbol(option.value),
                        on: { click: toggle, tap: toggle },
                    })
                ])
        );
    }
    optionsDiv.show();

    const gameEndedDiv = $('#gameEndedInfo');

    // Debug text nodes
    var angleXNode = document.createTextNode("");
    var angleYNode = document.createTextNode("");
    var idNode = document.createTextNode("");
    var extraNode = document.createTextNode("");

    // Add them to the debug overlay
    document.querySelector("#info-angleX").appendChild(angleXNode);
    document.querySelector("#info-angleY").appendChild(angleYNode);
    document.querySelector("#info-id").appendChild(idNode);
    document.querySelector("#info-extra").appendChild(extraNode);

    // ------- BUFFERS -------

    var skyscraperMeshData = [];
    skyscraperMeshData.sourceMesh = 'resources/objects/skyscraper/skyscraper.obj';
    var skyscraperMesh = LoadMesh(gl, skyscraperMeshData);

    var binMeshData = [];
    binMeshData.sourceMesh = 'resources/objects//trashbin/bin.obj';
    var binMesh = LoadMesh(gl, binMeshData);

    const grattacieloBufferInfo = createBufferFromMesh(gl, skyscraperMesh);
    const binBufferInfo = createBufferFromMesh(gl, binMesh);
    const cubeBufferInfo = createCubeBufferInfo(gl);

    const charactersBufferInfos = {}
    for (let i = 1; i <= settings.boardSize; i++) {
        charactersBufferInfos[i] = createCharacterBufferInfo(gl, i);
    }
    charactersBufferInfos["N"] = createCharacterBufferInfo(gl, "N");
    charactersBufferInfos["E"] = createCharacterBufferInfo(gl, "E");
    charactersBufferInfos["S"] = createCharacterBufferInfo(gl, "S");
    charactersBufferInfos["W"] = createCharacterBufferInfo(gl, "W");
    charactersBufferInfos["V"] = createCharacterBufferInfo(gl, "V");

    const tileBufferInfos = {
        tile: createTileBufferInfo(gl, "tile"),
        empty: createTileBufferInfo(gl, "empty"),
        correct: createTileBufferInfo(gl, "correct"),
        wrong: createTileBufferInfo(gl, "wrong"),
    }

    // ------- PROGRAMS -------

    const pickingProgramInfo = webglUtils.createProgramInfo(gl, ["pick-vertex-shader", "pick-fragment-shader"]);
    const texturedProgramInfo = webglUtils.createProgramInfo(gl, ['simple-texture-vertex-shader-3d', 'simple-texture-fragment-shader-3d']);
    const solidColorProgramInfo = webglUtils.createProgramInfo(gl, ['solid-color-vertex-shader', 'solid-color-fragment-shader']);

    // ------- TEXTURES -------

    const textureAtlas = loadTexture(gl, "./resources/images/atlas.png");
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // -------- picking --------

    // The texture to render to
    const targetTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // depth renderbuffer
    const depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);

    function setFramebufferAttachmentSizes(width, height) {
        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        const level = 0;
        const internalFormat = gl.RGBA;
        const border = 0;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;
        const data = null;
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
            width, height, border,
            format, type, data);

        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    }

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    const level = 0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, level);

    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    // ------- BOARD SETUP -------

    class DrawableObject {
        constructor(buffer, id) {
            this.id = id;
            this.buffer = buffer;
            this.transform = m4.identity();
            this.uniforms = {};
            this.view = m4.identity();
            this.projection = m4.identity();
            this.worldMatrix = m4.identity();
        }

        drawTextured(texture) {
            drawObject(texturedProgramInfo, this.buffer, {
                u_matrix: computeWorldViewProjection(this.projection, this.view, this.worldMatrix),
                u_texture: texture,
                u_worldInverseTranspose: m4.transpose(m4.inverse(this.worldMatrix)),
                u_reverseLightDirection: m4.normalize([0, light.y, 0])
            })
        }

        drawForPicking() {
            drawObject(pickingProgramInfo, this.buffer, {
                u_world: this.worldMatrix,
                u_id: getId(this.id),
                u_viewProjection: m4.multiply(this.projection, this.view),
            });
        }
    }

    class Tile extends DrawableObject {
        constructor(x, z, id) {
            super(tileBufferInfos.tile, id)
            this.x = x;
            this.z = z;
        }

        drawForPicking(projectionMatrix, viewMatrix,) {
            this.projection = projectionMatrix;
            this.view = viewMatrix;
            this.worldMatrix = m4.translate(m4.identity(), this.x, 0, this.z);
            super.drawForPicking();
        }

        drawTextured(viewMatrix, projectionMatrix) {
            this.view = viewMatrix;
            this.projection = projectionMatrix;
            var worldMatrix = m4.translate(m4.identity(), this.x, 0, this.z);
            this.worldMatrix = m4.multiply(worldMatrix, this.transform);
            super.drawTextured(textureAtlas);
        }

        drawNumber(n) {
            drawObject(texturedProgramInfo, charactersBufferInfos[n], {
                u_matrix: computeWorldViewProjection(this.projection, this.view, this.worldMatrix),
                u_texture: textureAtlas,
                u_worldInverseTranspose: m4.transpose(m4.inverse(this.worldMatrix)),
                u_reverseLightDirection: m4.normalize([0, light.y, 0])
            });
        }
    }

    class Square extends Tile {
        constructor(x, z, id) {
            super(x, z, id)
            this.skyscraper = 0;
            this.selected = false;
        }

        skyscraperTransform(height) {
            let worldMatrix = m4.translate(m4.identity(), this.x, height, this.z);
            worldMatrix = m4.scale(worldMatrix, .9, height, .9);
            return worldMatrix;
        }

        drawSkyscraper(skyscraper, ambient, diffuse, transparent, lightPos) {
            const worldMatrix = this.skyscraperTransform(skyscraper);
            drawObject(solidColorProgramInfo, grattacieloBufferInfo, {
                projection: m4.multiply(this.projection, this.view),
                modelview: worldMatrix,
                normalMat: m4.transpose(m4.inverse(worldMatrix)),
                mode: light.mode, Ka: ambient, Kd: diffuse, Ks: light.Ks,
                shininessVal: light.shininessVal,
                ambientColor: colors[skyscraper],
                diffuseColor: colors[skyscraper],
                specularColor: [1, 1, 1],
                alpha: transparent ? light.transparency : 1.0,
                lightPos: lightPos,
            });
        }

        drawSkyscraperForPicking() {
            const worldMatrix = this.skyscraperTransform(this.skyscraper);
            drawObject(pickingProgramInfo, grattacieloBufferInfo, {
                u_world: worldMatrix,
                u_id: getId(this.id + board.length),
                u_viewProjection: m4.multiply(this.projection, this.view),
            });
        }

        select() {
            this.selected = true;
            this.transform = m4.scale(m4.identity(), .9, 1, .9)
        }

        deselect() {
            this.selected = false;
            this.transform = m4.identity();
        }

        drawNumber(skyscraper) {
            this.worldMatrix = m4.translate(this.worldMatrix, 0, settings.boardSize * 2, 0);
            this.worldMatrix = m4.yRotate(this.worldMatrix, degToRad(90));
            super.drawNumber(skyscraper)
        }
    }

    class OuterNumber extends Tile {
        constructor(x, z, n, rotation = 0) {
            super(x, z, tileBufferInfos.empty, -1);
            this.n = n;
            this.duplicates = false;
            this.correct = false;
            this.rotation = rotation;
        }

        drawTextured(viewMatrix, projectionMatrix) {
            this.buffer = tileBufferInfos.empty;
            if (options.helpers.value) {
                if (this.correct && !this.duplicates) {
                    this.buffer = tileBufferInfos.correct;
                }
                if (this.duplicates) {
                    this.buffer = tileBufferInfos.wrong;
                }
            }
            super.drawTextured(viewMatrix, projectionMatrix);
        }
    }


    function getPosFromIndex(i) {
        return (i / (settings.boardSize - 1) - .5) * 2 * (settings.boardSize - 1)
    }

    let board = [];
    let numbersAround = [];
    let corners = [];

    let id = 0;
    if (settings.boardSize > 1) {
        for (var zz = 0; zz < settings.boardSize; ++zz) {
            var z = getPosFromIndex(zz)
            for (var xx = 0; xx < settings.boardSize; ++xx) {
                var x = getPosFromIndex(xx);
                id += 1;
                const square = new Square(x, z, id);
                board.push(square);
            }
        }
    }

    let placed = {}
    for (let i = 0; i < settings.boardSize; i++) {
        let p1 = getPosFromIndex(i);
        let p2 = settings.boardSize + 1;
        // top -  left to right
        numbersAround.push(new OuterNumber(p1, -p2, settings.disposition[i + 0], 270));
        // right - top to bottom
        numbersAround.push(new OuterNumber(p2, p1, settings.disposition[i + 1 * settings.boardSize], 180));
        // bottom - left to right
        numbersAround.push(new OuterNumber(p1, p2, settings.disposition[i + 2 * settings.boardSize],  90));
        // left - top to bottom
        numbersAround.push(new OuterNumber(-p2, p1, settings.disposition[i + 3 * settings.boardSize], 0));

        placed[i + 1] = 0;
    }

    corners.push(new OuterNumber(settings.boardSize + 1, settings.boardSize + 1, 0));
    corners.push(new OuterNumber(-(settings.boardSize + 1), settings.boardSize + 1, 0));
    corners.push(new OuterNumber(settings.boardSize + 1, -(settings.boardSize + 1), 0));
    corners.push(new OuterNumber(-(settings.boardSize + 1), -(settings.boardSize + 1), 0));

    // ------- RENDERING -------

    // computes the camera position as it orbits around the center
    function getCameraPos() {
        const X = camera.zoom * Math.cos(degToRad(camera.angleX)) * Math.sin(degToRad(camera.angleY))
        const Z = camera.zoom * Math.sin(degToRad(camera.angleX)) * Math.sin(degToRad(camera.angleY))
        const Y = camera.z + camera.zoom * Math.cos(degToRad(camera.angleY))

        return [X, Y, Z]
    }

    function drawObject(programInfo, bufferInfo, uniforms) {
        gl.useProgram(programInfo.program);

        webglUtils.setBuffersAndAttributes(gl, programInfo, bufferInfo);

        webglUtils.setUniforms(programInfo, uniforms);

        webglUtils.drawBufferInfo(gl, bufferInfo, gl.TRIANGLES);
    }

    function drawScene(projectionMatrix, viewMatrix, tileRotation, minimap = false) {
        gl.enable(gl.BLEND);

        let outerRingTransform = m4.identity();
        
        if (!minimap && camera.orto) {
            outerRingTransform = m4.zRotate(outerRingTransform, degToRad(90));
            outerRingTransform = m4.translate(outerRingTransform, -1, 0, 0)
        }
        
        numbersAround.forEach((/** @type OuterNumber */num) => {
            let rotation = options.rotateNumbers.value || minimap ? tileRotation : num.rotation;
            num.transform = m4.yRotate(outerRingTransform, degToRad(rotation));
            num.drawTextured(viewMatrix, projectionMatrix);

            if (num.n > 0) {
                num.drawNumber(num.n);
            }
        })

        if (options.drawCorners.value) {
            corners.forEach((corner) => {
                corner.transform = outerRingTransform;
                corner.drawTextured(viewMatrix, projectionMatrix);
            })
        }

        board.forEach((/** @type Square */ square) => {
            square.drawTextured(viewMatrix, projectionMatrix);

            let skyscraper;
            let Ka = light.Ka, Kd = light.Kd;
            let transparent = false;
            if (squareLookedAtId === square.id) {
                if (selectedSquare) {
                    skyscraper = selectedSquare.skyscraper;
                } else if (selectedSkyscraper > 0) {
                    skyscraper = selectedSkyscraper;
                } else {
                    skyscraper = square.skyscraper;
                }
                Ka = 1.0; Kd = 1.0;
            } else if (square.skyscraper > 0 && !(selectedSquare && selectedSquare.id === square.id)) {
                skyscraper = square.skyscraper;
            } else if (options.showGhost.value && squarePickedFrom?.id === square.id && !minimap) {
                transparent = true;
                skyscraper = squarePickedFrom.skyscraper;
                if (options.swap.value) {
                    let skyscraperLookedAt = board.filter(s => s.id === squareLookedAtId)[0];
                    if (skyscraperLookedAt?.skyscraper > 0) {
                        skyscraper = skyscraperLookedAt.skyscraper;
                    }
                }
            }

            if (skyscraper > 0) {
                const cameraPos = getCameraPos();
                const lightPos = minimap ? [square.x, 20, square.z] : [cameraPos[0], 8, cameraPos[2]];
                square.drawSkyscraper(skyscraper, Ka, Kd, transparent, lightPos);
                if (minimap) {
                    square.drawNumber(skyscraper);
                }
            }
        });
        gl.disable(gl.BLEND);
    }


    let gameareaHeight, gameareaWidth, gameareaAspect, gameareaX, gameareaY;
    let minimapWidth, minimapHeight, minimapAspect, minimapX, minimapY;
    let selectorWidth, selectorHeight, selectorAspect, selectorX, selectorY;
    let extraWidth, extraHeight, extraAspect, extraX, extraY;

    let mouseX = -1, mouseY = -1;
    let oldPickId = -1;

    let lastRotation = 0;

    let usingTouch = false;
    let clicking = false;
    let holding = false;
    let movingView = false;

    const selectorIdOffset = 2 * board.length + settings.boardSize;

    let squareLookedAtId = 0;
    let selectedSquare = null;
    let selectedSkyscraper = 0;
    let extraLookedAt = 0;
    let squarePickedFrom = null;

    let minimapMargin = 0;

    function render() {

        if (webglUtils.resizeCanvasToDisplaySize(gl.canvas)) {
            setFramebufferAttachmentSizes(gl.canvas.width, gl.canvas.height);

            gameareaHeight = Math.ceil(gl.canvas.height * (4 / 5));
            gameareaWidth = gameareaHeight; // gl.canvas.width * (2 / 3);
            gameareaAspect = gameareaWidth / gameareaHeight;
            gameareaX = 0;
            gameareaY = gl.canvas.height - gameareaHeight;

            selectorWidth = gl.canvas.width;
            selectorHeight = gl.canvas.height - gameareaHeight;
            selectorAspect = selectorWidth / selectorHeight;
            selectorX = 0;
            selectorY = 0;

            minimapMargin = 1 / 50 * gameareaWidth;

            minimapWidth = gl.canvas.width - gameareaWidth - minimapMargin * 2;
            minimapHeight = minimapWidth;
            minimapAspect = minimapWidth / minimapHeight;
            minimapX = gl.canvas.width - minimapMargin - minimapWidth;
            minimapY = selectorHeight + minimapMargin;

            extraWidth = minimapWidth;
            extraHeight = gl.canvas.height - minimapHeight - selectorHeight - minimapMargin * 3;
            extraAspect = extraWidth / extraHeight;
            extraX = minimapX;
            extraY = selectorHeight + minimapHeight + minimapMargin * 2;
        }

        optionsDiv.css({
            left: canvas.getBoundingClientRect().x + extraX,
            top: minimapMargin,
            "width": extraWidth,
            "height": extraHeight
        });

        if (!playingGame) {
            gameEndedDiv.css({
                left: canvas.getBoundingClientRect().x,
                top: gl.canvas.height - selectorHeight,
                width: selectorWidth,
                height: selectorHeight
            });
        }

        // ------ Draw the objects to the PICKING TEXTURE --------

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

        gl.enable(gl.SCISSOR_TEST);

        gl.viewport(gameareaX, gameareaY, gameareaWidth, gameareaHeight);
        gl.scissor(gameareaX, gameareaY, gameareaWidth, gameareaHeight);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const projectionMatrix = camera.orto || options.orthographic.value ?
            m4.orthographic(
                -orto.gameareaCamOrthoUnits * gameareaAspect,  // left
                orto.gameareaCamOrthoUnits * gameareaAspect,   // right
                -orto.gameareaCamOrthoUnits,                   // bottom
                orto.gameareaCamOrthoUnits,                    // top
                orto.cam1Near,
                orto.cam1Far) :
            m4.perspective(degToRad(camera.fov), gameareaAspect, camera.near, camera.far);

        const cameraPosition = getCameraPos();
        const target = [0, camera.z, 0];
        const up = [0, 1, 0];
        const cameraMatrix = m4.lookAt(cameraPosition, target, up);
        const viewMatrix = m4.inverse(cameraMatrix);

        board.forEach((/**@type Square*/ square) => {
            square.drawForPicking(projectionMatrix, viewMatrix);
            if (square.skyscraper > 0) {
                square.drawSkyscraperForPicking();
            }
        });

        gl.viewport(minimapX, minimapY, minimapWidth, minimapHeight);
        gl.scissor(minimapX, minimapY, minimapWidth, minimapHeight);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const minimapCameraPosition = [0, 20, 0];
        const minimapCameraMatrix = m4.lookAt(minimapCameraPosition, [0, -orto.cam1Far, -1], up);
        const minimapViewMatrix = m4.inverse(minimapCameraMatrix);

        const minimapProjectionMatrix =
            m4.orthographic(
                -orto.minimapCamOrthoUnits * minimapAspect,  // left
                orto.minimapCamOrthoUnits * minimapAspect,   // right
                -orto.minimapCamOrthoUnits,                  // bottom
                orto.minimapCamOrthoUnits,                   // top
                orto.cam1Near,
                orto.cam1Far);

        board.forEach((/**@type Square*/ square) => {
            square.drawForPicking(minimapProjectionMatrix, minimapViewMatrix);
            if (square.skyscraper > 0) {
                square.drawSkyscraperForPicking();
            }
        });

        const minimapViewProjectionMatrix = m4.multiply(minimapProjectionMatrix, minimapViewMatrix);
        function directionButtonForTexture(worldMatrix, id) {
            worldMatrix = m4.yRotate(worldMatrix, degToRad(0));
            drawObject(pickingProgramInfo, tileBufferInfos.empty, {
                u_world: worldMatrix, u_id: getId(id),
                u_viewProjection: minimapViewProjectionMatrix,
            });
        }

        var distance = getPosFromIndex(settings.boardSize + 1) + 1;
        cameraEastID = selectorIdOffset + 2;
        var worldMatrix = m4.translate(m4.identity(), distance, 0, 0);
        directionButtonForTexture(worldMatrix, cameraEastID);
        cameraWestID = selectorIdOffset + 3;
        var worldMatrix = m4.translate(m4.identity(), -distance, 0, 0);
        directionButtonForTexture(worldMatrix, cameraWestID);
        cameraSouthID = selectorIdOffset + 4;
        var worldMatrix = m4.translate(m4.identity(), 0, 0, distance);
        directionButtonForTexture(worldMatrix, cameraSouthID);
        cameraNorthID = selectorIdOffset + 5;
        var worldMatrix = m4.translate(m4.identity(), 0, 0, -distance);
        directionButtonForTexture(worldMatrix, cameraNorthID);

        gl.viewport(selectorX, selectorY, selectorWidth, selectorHeight);
        gl.scissor(selectorX, selectorY, selectorWidth, selectorHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const selectorCameraPosition = [0, 0, 5];
        const selectorCameraMatrix = m4.lookAt(selectorCameraPosition, [0, 0, 0], up);
        const selectorViewMatrix = m4.inverse(selectorCameraMatrix);

        const selectorProjectionMatrix =
            m4.orthographic(
                -orto.selectorCamOrthoUnits * selectorAspect, // left
                orto.selectorCamOrthoUnits * selectorAspect,  // right
                -orto.selectorCamOrthoUnits,                  // bottom
                orto.selectorCamOrthoUnits,                   // top
                orto.cam1Near,
                orto.cam1Far);

        const selectorViewProjectionMatrix = m4.multiply(selectorProjectionMatrix, selectorViewMatrix);

        let n, size, radius, occupiedSpace, nSpaces, width, spacing, xOffset, yOffset, binSize, binHeight;

        if (playingGame) {
            n = settings.boardSize + 1; // all skyscrapers + the bin
            size = 1.5;
            radius = Math.sqrt(2 * (size ** 2)); // the size of the diagonal of the skyscrapers
            occupiedSpace = 2 * radius * n; // the space taken up by all skyscrapers
            nSpaces = n + 1; // the number of spaces between the objects
            width = 2 * (1 / selectorProjectionMatrix[0]); // width of the selector in scene coordinates

            spacing = ((width - occupiedSpace) / nSpaces); // the distance between objects
            xOffset = - width / 2 + radius; // the starting point to draw the row
            yOffset = -(settings.boardSize * size) / 2;

            binSize = 2;
            binHeight = 3;

            // the skyscrapers
            for (let i = 1; i < n; i++) {
                const height = i;
                const xPos = xOffset + spacing * (i) + 2 * radius * (i - 1);
                const yPos = yOffset + (height / size);

                let worldMatrix = m4.identity();
                worldMatrix = m4.translate(worldMatrix, xPos, yPos, -40);
                worldMatrix = m4.xRotate(worldMatrix, degToRad(45));
                worldMatrix = m4.yRotate(worldMatrix, degToRad(45));
                worldMatrix = m4.scale(worldMatrix, size, height, size);

                drawObject(pickingProgramInfo, grattacieloBufferInfo, {
                    u_world: worldMatrix,
                    u_id: getId(2 * board.length + height),
                    u_viewProjection: selectorViewProjectionMatrix,
                });
            }

            // the bin
            {
                const xPos = xOffset + spacing * (n) + 2 * radius * (n - 1);
                const yPos = yOffset + binHeight / binSize;
                let worldMatrix = m4.identity();
                worldMatrix = m4.translate(worldMatrix, xPos, yPos, -40);
                worldMatrix = m4.xRotate(worldMatrix, degToRad(15));
                worldMatrix = m4.yRotate(worldMatrix, degToRad(45));
                worldMatrix = m4.scale(worldMatrix, binSize, binSize, binSize);
                binID = selectorIdOffset + 1;
                // on the texture, the bin is a cube to be easier to click
                drawObject(pickingProgramInfo, cubeBufferInfo, {
                    u_world: worldMatrix,
                    u_id: getId(binID),
                    u_viewProjection: selectorViewProjectionMatrix,
                })
            }
        }

        // ------ Read the pixel under the mouse

        const pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
        const pixelY = gl.canvas.height - mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;
        const data = new Uint8Array(4);
        gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
        const id = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);

        lookingAt(id);


        // ------------- Draw the objects to the CANVAS -------------

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // ------- Draw the game area ------- 

        gl.viewport(gameareaX, gameareaY, gameareaWidth, gameareaHeight);
        gl.scissor(gameareaX, gameareaY, gameareaWidth, gameareaHeight);
        gl.clearColor(...gameAreaColor);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        let rotation = lastRotation;
        const safeArea = 15; // the rotation will change only if the angle changes by a certain threshold
        if (camera.angleX > 315 + safeArea || camera.angleX < 45 - safeArea) {
            rotation = 180;
        } else if (camera.angleX >= 45 + safeArea && camera.angleX < 135 - safeArea) {
            rotation = 90;
        } else if (camera.angleX >= 135 + safeArea && camera.angleX < 225 - safeArea) {
            rotation = 0;
        } else if (camera.angleX >= 225 + safeArea && camera.angleX < 315 - safeArea) {
            rotation = 270;
        }
        lastRotation = rotation;

        drawScene(projectionMatrix, viewMatrix, rotation)

        // ------- Draw the minimap -------

        gl.viewport(minimapX, minimapY, minimapWidth, minimapHeight);
        gl.scissor(minimapX, minimapY, minimapWidth, minimapHeight);
        gl.clearColor(...minimapColor);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        drawScene(minimapProjectionMatrix, minimapViewMatrix, 90, true)

        function drawDirectionSquare(worldMatrix, dir) {
            worldMatrix = m4.yRotate(worldMatrix, degToRad(90));

            drawObject(texturedProgramInfo, charactersBufferInfos[dir], {
                u_matrix: computeWorldViewProjection(minimapProjectionMatrix, minimapViewMatrix, worldMatrix),
                u_texture: textureAtlas,
                u_worldInverseTranspose: m4.transpose(m4.inverse(worldMatrix)),
                u_reverseLightDirection: m4.normalize([0, light.y, 0])
            });
        }

        gl.enable(gl.BLEND);

        var distance = getPosFromIndex(settings.boardSize + 1) + 0.5;
        var worldMatrix = m4.translate(m4.identity(), distance, 0, 0);
        drawDirectionSquare(worldMatrix, "E");
        var worldMatrix = m4.translate(m4.identity(), -distance, 0, 0);
        drawDirectionSquare(worldMatrix, "W");
        var worldMatrix = m4.translate(m4.identity(), 0, 0, distance);
        drawDirectionSquare(worldMatrix, "S");
        var worldMatrix = m4.translate(m4.identity(), 0, 0, -distance);
        drawDirectionSquare(worldMatrix, "N");

        var point = followSquarePath(0, 0, distance, camera.angleX);
        var worldMatrix = m4.translate(m4.identity(), point.x, 1, point.y);
        worldMatrix = m4.yRotate(worldMatrix, degToRad(180 - camera.angleX));
        worldMatrix = m4.scale(worldMatrix, 1.5, 1, 1.5);
        drawDirectionSquare(worldMatrix, "V");

        gl.disable(gl.BLEND);

        // ------- Draw selector -------

        gl.viewport(selectorX, selectorY, selectorWidth, selectorHeight);
        gl.scissor(selectorX, selectorY, selectorWidth, selectorHeight);
        gl.clearColor(...selectorColor);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.disable(gl.CULL_FACE);

        if (playingGame) {
            // the skyscrapers
            for (let i = 1; i < n; i++) {
                const height = i;
                const xPos = xOffset + spacing * (i) + 2 * radius * (i - 1);
                const yPos = yOffset + (height / size);

                let worldMatrix = m4.identity();
                worldMatrix = m4.translate(worldMatrix, xPos, yPos, -40);
                worldMatrix = m4.xRotate(worldMatrix, degToRad(45));
                worldMatrix = m4.yRotate(worldMatrix, degToRad(45));
                worldMatrix = m4.scale(worldMatrix, size, height, size);

                let Ka = .6, Kd = .8;
                if (board.filter(s => s.skyscraper === height).length >= settings.boardSize) {
                    Ka = .2;
                    Kd = .4;
                }
                if (height === id - 2 * board.length && !movingView) {
                    Ka += .4;
                    Kd += .2;
                }

                drawObject(solidColorProgramInfo, grattacieloBufferInfo, {
                    projection: m4.multiply(selectorProjectionMatrix, selectorViewMatrix),
                    modelview: worldMatrix,
                    normalMat: m4.transpose(m4.inverse(worldMatrix)),
                    mode: light.mode, Ka: Ka, Kd: Kd, Ks: 0,
                    shininessVal: light.shininessVal,
                    ambientColor: colors[height], diffuseColor: colors[height],
                    specularColor: [1, 1, 1],
                    alpha: 1.0,
                    lightPos: [xPos - spacing / 2, yPos, 0],
                });

                if (options.showRemaining.value) {
                    let remaining = settings.boardSize - placed[height];
                    if (remaining > 0) {
                        worldMatrix = m4.translate(m4.identity(), xPos, -n / 2, 0);;
                        worldMatrix = m4.xRotate(worldMatrix, degToRad(90))
                        worldMatrix = m4.yRotate(worldMatrix, degToRad(90))
                        worldMatrix = m4.scale(worldMatrix, size, size, size);

                        gl.enable(gl.BLEND)
                        drawObject(texturedProgramInfo, charactersBufferInfos[remaining], {
                            u_matrix: computeWorldViewProjection(selectorProjectionMatrix, selectorViewMatrix, worldMatrix),
                            u_texture: textureAtlas,
                            u_worldInverseTranspose: m4.transpose(m4.inverse(worldMatrix)),
                            u_reverseLightDirection: m4.normalize([0, light.y, 0])
                        });
                        gl.disable(gl.BLEND)
                    }
                }
            }

            // the bin
            {
                const xPos = xOffset + spacing * (n) + 2 * radius * (n - 1);
                const yPos = yOffset + binHeight / binSize;
                let worldMatrix = m4.identity();
                worldMatrix = m4.translate(worldMatrix, xPos, yPos, -40);
                worldMatrix = m4.xRotate(worldMatrix, degToRad(15));
                worldMatrix = m4.yRotate(worldMatrix, degToRad(45));
                worldMatrix = m4.scale(worldMatrix, binSize, binSize, binSize);
                let Ka = .6, Kd = .8;
                if (extraLookedAt === BIN) {
                    Ka += .4;
                    Kd += .2;
                }
                let binColor = [0.8, 0.1, 0.1];
                drawObject(solidColorProgramInfo, binBufferInfo, {
                    projection: m4.multiply(selectorProjectionMatrix, selectorViewMatrix),
                    modelview: worldMatrix,
                    normalMat: m4.transpose(m4.inverse(worldMatrix)),
                    mode: light.mode, Ka: Ka, Kd: Kd, Ks: 0,
                    shininessVal: light.shininessVal,
                    ambientColor: binColor, diffuseColor: binColor,
                    specularColor: [1, 1, 1],
                    alpha: 1.0,
                    lightPos: [xPos - spacing / 2, yPos, 0],
                })
            }
        }

        // ------- Draw extra -------

        gl.viewport(extraX, extraY, extraWidth, extraHeight);
        gl.scissor(extraX, extraY, extraWidth, extraHeight);
        gl.clearColor(...extraColor);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // ------------------------------------------------

        // set the info nodes
        angleXNode.nodeValue = camera.angleX.toFixed(1);
        angleYNode.nodeValue = camera.angleY.toFixed(1);
        idNode.nodeValue = `${id} / click ${clicking} / hold ${holding}`;
        extraNode.nodeValue = `${point.x}, ${point.y}`;

        requestAnimationFrame(render);
    }

    // ------- GAME LOGIC -------

    function lookingAt(id) {
        function lookingAtCamera(dir) {
            extraLookedAt = dir;
            if (clicking) {
                setSnap(dir);
            }
        }

        // restore
        if (oldPickId >= 0) {
            /**@type Square*/
            let square;
            if (oldPickId <= board.length) {
                square = board.filter(s => s.id === oldPickId)[0]
            } else if (oldPickId > board.length) {
                square = board.filter(s => s.id + board.length === oldPickId)[0]
            }
            if (square) {
                square.deselect();
                squareLookedAtId = 0;
                extraLookedAt = 0;
                oldPickId = -1;
            }
        }

        // object under mouse
        if (id > 0 && !movingView && playingGame) {
            oldPickId = id;
            /**@type Square*/
            let square;
            if (id <= board.length) { // looking at a square
                square = board.filter(s => s.id === id)[0]
            } else if (id > board.length && id <= 2 * board.length) { // looking at a skyscraper
                square = board.filter(s => s.id + board.length === id)[0]
            } else if (id > 2 * board.length && id <= selectorIdOffset) {
                if (selectedSkyscraper === 0 && clicking && !holding) {
                    holding = true;
                    selectedSkyscraper = id - 2 * board.length;
                }
            } else if (id > selectorIdOffset) {
                if (id === binID) {
                    extraLookedAt = BIN;
                    if (!clicking && holding) {
                        if (selectedSquare) { // picked from the grid
                            selectedSquare.skyscraper = 0
                        }
                        selectedSkyscraper = 0;
                        squarePickedFrom = null;
                        selectedSquare = false;
                        holding = false;
                    }
                }
                if (id === cameraNorthID && !holding) {
                    lookingAtCamera(CAMERA_N);
                }
                if (id === cameraEastID && !holding) {
                    lookingAtCamera(CAMERA_E);
                }
                if (id === cameraSouthID && !holding) {
                    lookingAtCamera(CAMERA_S);
                }
                if (id === cameraWestID && !holding) {
                    lookingAtCamera(CAMERA_W);
                }
            }
            if (usingTouch && !clicking && !holding) {
                if (square)
                    square.deselect();
                if (selectedSquare != null) {
                    selectedSkyscraper = 0
                    selectedSquare = null;
                }
                extraLookedAt = 0;
            }
            if (square) {
                if (usingTouch && !clicking && !holding) {
                    square.deselect();
                    if (selectedSquare != null) {
                        selectedSkyscraper = 0
                        selectedSquare = null;
                    }
                    extraLookedAt = 0;
                } else {
                    squareLookedAtId = square.id;
                    square.select();
                }

                if (clicking && !holding) { // picking a skyscraper from the grid
                    holding = true;
                    if (square.skyscraper > 0) {
                        squarePickedFrom = square;
                        selectedSquare = square;
                    }
                }
                if (!clicking && holding) { // letting go of a skyscraper
                    if (selectedSquare && selectedSquare.id !== square.id) { // picked from the grid
                        let temp = options.swap.value ? square.skyscraper : 0;
                        square.skyscraper = selectedSquare.skyscraper;
                        selectedSquare.skyscraper = temp;
                    }
                    if (selectedSkyscraper > 0) { // picked from selector
                        square.skyscraper = selectedSkyscraper;
                    }
                    selectedSkyscraper = 0;
                    selectedSquare = null;
                    squarePickedFrom = null;
                    holding = false;
                }
            }
            let won = check(settings.boardSize, board, numbersAround, placed);
            if (won) {
                playingGame = false;
                gameEndedCallback();
            }
        } else {
            if (!clicking) {
                movingView = false;
                if (holding) {
                    if (squarePickedFrom && selectedSquare) {
                        squarePickedFrom.skyscraper = selectedSquare.skyscraper
                    }
                    selectedSquare = null;
                    squarePickedFrom = null;
                    holding = false;
                } else {
                    selectedSkyscraper = 0;
                }
            }
            if (clicking && !holding && insideRegion(mouseX, mouseY, gameareaX, gameareaY, gameareaWidth, gameareaHeight)) {
                movingView = true;
            }
            extraLookedAt = 0;
        }
    }

    function insideRegion(x, y, startX, startY, endX, endY) {
        return (x >= startX && x <= endX && y >= startY && y <= endY);
    }

    function correctAngles() {
        camera.orto = false;
        if (camera.angleX <= 0) {
            camera.angleX = 360
        } else if (camera.angleX >= 360) {
            camera.angleX = 0
        }
        if (camera.angleY >= 90) {
            camera.angleY = 89.99 // a view completely from the top messes up the camera
        }
        if (camera.angleY <= 0) {
            camera.angleY = 0.01
        }
    }

    let startMousePos;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);

    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);

    canvas.addEventListener('wheel', handleWheel);

    function handleMouseDown(e) {
        if (e.which === 1) { // the left button
            e.preventDefault();
            usingTouch = false;

            clicking = true;
            window.addEventListener('mouseup', handleMouseUp);

            startMousePos = [e.clientX, e.clientY];
        }
    }

    function handleMouseUp(e) {
        if (e.which === 1) { // the left button
            e.preventDefault();

            clicking = false;
            window.removeEventListener('mouseup', handleMouseUp);
        }
    }

    function handleMouseMove(e) {
        e.preventDefault();
        usingTouch = false;

        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;

        if (movingView) {
            camera.angleX += -1 / camera.slowness * (startMousePos[0] - e.clientX);
            camera.angleY += 1 / camera.slowness * (startMousePos[1] - e.clientY);
            correctAngles();
        }
        startMousePos = [e.clientX, e.clientY];
    }

    function handleTouchStart(e) {
        e.preventDefault();
        usingTouch = true;

        clicking = true;
        window.addEventListener('touchend', handleTouchEnd);

        const rect = canvas.getBoundingClientRect();
        mouseX = e.touches[0].clientX - rect.left;
        mouseY = e.touches[0].clientY - rect.top;

        startMousePos = [e.touches[0].clientX, e.touches[0].clientY];
    }

    function handleTouchEnd(e) {
        e.preventDefault();

        clicking = false;

        window.removeEventListener('mouseup', handleTouchStart);
    }

    function handleTouchMove(e) {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        mouseX = e.touches[0].clientX - rect.left;
        mouseY = e.touches[0].clientY - rect.top;

        if (movingView) {
            camera.angleX += -1 / camera.slowness * (startMousePos[0] - e.touches[0].clientX);
            camera.angleY += 1 / camera.slowness * (startMousePos[1] - e.touches[0].clientY);
            correctAngles();
        }
        startMousePos = [e.touches[0].clientX, e.touches[0].clientY];
    }

    function handleWheel(e) {
        e.preventDefault();

        if (!camera.orto) { // zoom only when in perspective view
            const newZoom = camera.zoom * Math.pow(2, e.deltaY * 0.001);
            camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, newZoom));
        }
    }

    document.addEventListener('keydown', function (event) {
        const key = event.key;
        switch (key.toLowerCase()) {
            case "w":
                rotateUp();
                break;
            case "a":
                rotateLeft();
                break;
            case "s":
                rotateDown();
                break;
            case "d":
                rotateRight();
                break;
            case "e":
                changeViewSnapClockwise();
                break;
            case "q":
                changeViewSnapCounterclockwise();
                break;
        }
    });

    function rotateRight() {
        camera.angleX -= camera.keyMovement;
        correctAngles();
    }
    function rotateLeft() {
        camera.angleX += camera.keyMovement;
        correctAngles();
    }
    function rotateUp() {
        camera.angleY -= camera.keyMovement;
        correctAngles();
    }
    function rotateDown() {
        camera.angleY += camera.keyMovement;
        correctAngles();
    }
    function changeViewSnapCounterclockwise() {
        if (camera.orto) {
            camera.angleX -= 90;
            if (camera.angleX < 0) {
                camera.angleX = 270;
            }
        } else {
            // snap to the nearest multiple of 90
            camera.angleX = Math.round(camera.angleX / 90) * 90;
        }
        camera.angleY = 90;
        camera.orto = true;
    }
    function changeViewSnapClockwise() {
        if (camera.orto) {
            camera.angleX += 90;
            if (camera.angleX > 360) {
                camera.angleX = 90;
            }
        } else {
            // snap to the nearest multiple of 90
            camera.angleX = Math.round(camera.angleX / 90) * 90;;
        }
        camera.angleY = 90;
        camera.orto = true;
    }

    function setSnap(dir) {
        switch (dir) {
            case CAMERA_E:
                camera.angleX = 0;
                break;
            case CAMERA_S:
                camera.angleX = 90;
                break;
            case CAMERA_W:
                camera.angleX = 180;
                break;
            case CAMERA_N:
                camera.angleX = 270;
                break;
        }
        camera.angleY = 90;
        camera.orto = true;
    }

    playingGame = true;
    requestAnimationFrame(render);
}

function check(size, board, /** @type Number[] */numbersAround, placed) {
    let won = board.filter(s => s.skyscraper > 0).length === board.length;

    for (let [k, v] of Object.entries(placed)) {
        placed[k] = 0;
    }

    for (let i = 0; i < size; i++) {
        let row = [];
        let col = [];
        let topN = numbersAround[4 * i + 0];
        let rightN = numbersAround[4 * i + 1];
        let bottomN = numbersAround[4 * i + 2];
        let leftN = numbersAround[4 * i + 3];
        topN.duplicates = false;
        rightN.duplicates = false;
        bottomN.duplicates = false;
        leftN.duplicates = false;
        for (let j = 0; j < size; j++) {
            let rowPiece = board[i * size + j].skyscraper;
            let colPiece = board[i + j * size].skyscraper;
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
                if (s in placed) {
                    placed[s] += 1;
                }
            }
        }

        topN.correct = topN.n > 0 && countVisible(col) === topN.n;
        rightN.correct = rightN.n > 0 && countVisible(row.toReversed()) === rightN.n;
        bottomN.correct = bottomN.n > 0 && countVisible(col.toReversed()) === bottomN.n;
        leftN.correct = leftN.n > 0 && countVisible(row) === leftN.n;
    };
    return won;
}

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

function followSquarePath(centerX, centerY, size, deg) {
    var theta = degToRad(360 - deg);

    while (theta < -Math.PI) {
        theta += Math.PI * 2;
    }
    while (theta > Math.PI) {
        theta -= Math.PI * 2;
    }

    var squareAtan = Math.atan2(2 * size, 2 * size);
    var tanTheta = Math.tan(theta);
    var region;
    if ((theta > -squareAtan) && (theta <= squareAtan)) {
        region = 1;
    } else if ((theta > squareAtan) && (theta <= (Math.PI - squareAtan))) {
        region = 2;
    } else if ((theta > (Math.PI - squareAtan)) || (theta <= -(Math.PI - squareAtan))) {
        region = 3;
    } else {
        region = 4;
    }

    var point = { x: centerX, y: centerY };
    var xFactor = 1, yFactor = 1;

    switch (region) {
        case 1: yFactor = -1; break;
        case 2: yFactor = -1; break;
        case 3: xFactor = -1; break;
        case 4: xFactor = -1; break;
    }

    if ((region === 1) || (region === 3)) {
        point.x += xFactor * (size);
        point.y += yFactor * (size) * tanTheta;
    } else {
        point.x += xFactor * (2 * size / (2. * tanTheta));
        point.y += yFactor * (size);
    }

    return point;
};

function getId(id) {
    return [
        ((id >> 0) & 0xFF) / 0xFF,
        ((id >> 8) & 0xFF) / 0xFF,
        ((id >> 16) & 0xFF) / 0xFF,
        ((id >> 24) & 0xFF) / 0xFF,
    ]
}

function showError(errorText) {
    const errorBox = $('#error-box');
    const errorSpan = document.createElement('p');
    errorSpan.innerText = errorText;
    errorBox.empty().append(errorSpan)
    errorBox.show();
}

function computeWorldViewProjection(projectionMatrix, viewMatrix, worldMatrix) {
    // The matrix that maps the 3D space as seen from the camera to the 2D projection 
    const viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    // Apply the "world" changes to the 3D space
    const worldViewProjectionMatrix = m4.multiply(viewProjectionMatrix, worldMatrix);

    return worldViewProjectionMatrix;
}

function toFixedFloat(n, f) {
    return Math.floor((n * 10 ** f).toFixed(f)) / 10 ** f
}

function getTextureCoordinatesFromAtlas(c, pixelOffset = 5) {
    let char = textureAtlas.pos[c];

    let maxX = textureAtlas.textureWidth;
    let maxY = textureAtlas.textureHeight;
    let u1 = char.x * textureAtlas.size / maxX;
    let v1 = 1 - ((char.y + 1) * textureAtlas.size) / maxY;
    let u2 = ((char.x + 1) * textureAtlas.size) / maxX;
    let v2 = 1 - char.y * textureAtlas.size / maxY;

    // Adjust coordinates to avoid bleeding
    let u1Safe = toFixedFloat(u1 + pixelOffset / maxX, 4);
    let v1Safe = toFixedFloat(v1 + pixelOffset / maxY, 4);
    let u2Safe = toFixedFloat(u2 - pixelOffset / maxX, 4);
    let v2Safe = toFixedFloat(v2 - pixelOffset / maxY, 4);

    return { u1: u1Safe, v1: v1Safe, u2: u2Safe, v2: v2Safe }
}

function makeTextureForFace(c, texcoords = [], offset = 0) {
    const face = getTextureCoordinatesFromAtlas(c);

    texcoords[offset + 0] = face.u1;
    texcoords[offset + 1] = face.v1;

    texcoords[offset + 2] = face.u2;
    texcoords[offset + 3] = face.v1;

    texcoords[offset + 4] = face.u2;
    texcoords[offset + 5] = face.v2;

    texcoords[offset + 6] = face.u1;
    texcoords[offset + 7] = face.v2;

    return texcoords;
}

function makeTextureForTile(c) {
    var texcoords = []
    for (let i = 0; i < 6; i++) {
        texcoords = makeTextureForFace(c, texcoords, i * 8)
    }

    return texcoords;
}

function createCharacterBufferInfo(gl, char) {
    return webglUtils.createBufferInfoFromArrays(gl, {
        position: { numComponents: 3, data: new Float32Array(plane_vertices) },
        texcoord: { numComponents: 2, data: new Float32Array(makeTextureForFace(char)) },
        normal: { numComponents: 3, data: new Float32Array(plane_normals) },
        indices: { numComponents: 3, data: new Uint16Array(plane_indices) },
    });
}

function createTileBufferInfo(gl, char) {
    return webglUtils.createBufferInfoFromArrays(gl, {
        position: { numComponents: 3, data: new Float32Array(square_vertices) },
        texcoord: { numComponents: 2, data: new Float32Array(makeTextureForTile(char)) },
        normal: { numComponents: 3, data: new Float32Array(square_normals) },
        indices: { numComponents: 3, data: new Uint16Array(square_indices) },
    });
}

function createCubeBufferInfo(gl) {
    const attribs = {
        position: { numComponents: 3, data: new Float32Array(cube_vertices) },
        color: { numComponents: 3, data: new Float32Array(cube_colors) },
        texcoord: { numComponents: 2, data: new Float32Array(square_textcoords) },
        normal: { numComponents: 3, data: new Float32Array(cube_normals) },
        indices: { numComponents: 3, data: new Uint16Array(cube_indices) },
    }
    return webglUtils.createBufferInfoFromArrays(gl, attribs);
}

function createBufferFromMesh(gl, mesh) {
    return webglUtils.createBufferInfoFromArrays(gl, {
        position: { numComponents: 3, data: new Float32Array(mesh.positions) },
        texcoord: { numComponents: 2, data: new Float32Array(mesh.texcoords) },
        normal: { numComponents: 3, data: new Float32Array(mesh.normals) },
    });
}
