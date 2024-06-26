import {
    cube_colors, cube_indices, cube_normals, cube_vertices, square_indices, square_normals, square_textcoords, square_vertices, plane_vertices, plane_normals, plane_indices,
} from "./resources/objects/geometry.js";
import { LoadMesh, degToRad, loadTexture } from "./libs/myutils.js"
import { Game, getPosFromIndex, CAMERA_N, CAMERA_E, CAMERA_S, CAMERA_W, colors } from "./grattacieli.js";

const textureAtlasInfo = {
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


const gameAreaColor = [0.8, 0.8, 1, 1];
const minimapColor = [1, 0.8, 0.3, 1];
const selectorColor = [0.2, 0.2, 0.2, 1];
const extraColor = selectorColor;

export const BIN = 5;

export function WebGLRenderer(/** @type {Game} */ game) {
    $('#canvas-container').show();

    const gameEndedDiv = $('#gameEndedInfo');
    const optionsDiv = $('#options');
    /** @type {HTMLCanvasElement} */
    const canvas = $('#canvas');
    const gl = canvas[0].getContext('webgl');
    if (!gl) {
        return;
    }

    canvas.on('mousedown', (e) => handleMouseDown(e));
    $('#canvas-container').on('mousemove', (e) => handleMouseMove(e));

    canvas.on('touchstart', (e) => handleTouchStart(e));
    canvas.on('touchmove', (e) => handleTouchMove(e));

    canvas.on('wheel', (e) => handleWheel(e));
    $(document).on('keydown', (e) => handleKeyDown(e));

    // ------- BUFFERS -------

    var binMeshData = [];
    binMeshData.sourceMesh = 'resources/objects/trashbin/bin.obj';
    var binMesh = LoadMesh(gl, binMeshData);

    const available_models = 6;
    const skyscrapersBufferInfos = {};
    for (let i = 1; i <= available_models; i++) {
        let skyscraperMeshData = [];
        skyscraperMeshData.sourceMesh = `resources/objects/skyscrapers/${i}.obj`;
        let skyscraperMesh = LoadMesh(gl, skyscraperMeshData);
        skyscrapersBufferInfos[i] = createBufferFromMesh(gl, skyscraperMesh);
    }

    const binBufferInfo = createBufferFromMesh(gl, binMesh);
    const cubeBufferInfo = createCubeBufferInfo(gl);

    const charactersBufferInfos = {};
    for (let i = 1; i <= game.size; i++) {
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

    const pickingProgramInfo = webglUtils.createProgramInfo(gl, ["picking-vertex-shader", "picking-fragment-shader"]);
    const texturedProgramInfo = webglUtils.createProgramInfo(gl, ['texture-vertex-shader', 'texture-fragment-shader']);
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

    // ------- SETUP OBJECTS -------

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
                u_reverseLightDirection: m4.normalize([game.light.x, game.light.y, game.light.z])
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

    class Tile3D extends DrawableObject {
        constructor(x, z, id) {
            super(tileBufferInfos.tile, id)
            this.x = x;
            this.y = 0;
            this.z = z;
        }

        drawForPicking(projectionMatrix, viewMatrix,) {
            this.projection = projectionMatrix;
            this.view = viewMatrix;
            this.worldMatrix = m4.translate(m4.identity(), this.x, this.y, this.z);
            super.drawForPicking();
        }

        drawTextured(viewMatrix, projectionMatrix) {
            this.view = viewMatrix;
            this.projection = projectionMatrix;
            var worldMatrix = m4.translate(m4.identity(), this.x, this.y, this.z);
            this.worldMatrix = m4.multiply(worldMatrix, this.transform);
            super.drawTextured(textureAtlas);
        }

        drawNumber(n) {
            drawObject(texturedProgramInfo, charactersBufferInfos[n], {
                u_matrix: computeWorldViewProjection(this.projection, this.view, this.worldMatrix),
                u_texture: textureAtlas,
                u_worldInverseTranspose: m4.transpose(m4.inverse(this.worldMatrix)),
                u_reverseLightDirection: m4.normalize([game.light.x, game.light.y, game.light.z])
            });
        }
    }

    class Lot3D extends Tile3D {
        constructor(lot, id) {
            super(lot.x, lot.z, id);
            this.lot = lot;
            this.selected = false;
        }

        get skyscraper() {
            return this.lot.skyscraper;
        }

        set skyscraper(n) {
            this.lot.skyscraper = n;
        }

        skyscraperTransform(height) {
            let worldMatrix = m4.translate(m4.identity(), this.x, height, this.z);
            worldMatrix = m4.scale(worldMatrix, height * .9, height, height * .9);

            return worldMatrix;
        }

        drawSkyscraper(skyscraper, ambient, diffuse, transparent, lightPos) {
            const worldMatrix = this.skyscraperTransform(skyscraper);
            drawObject(solidColorProgramInfo, skyscrapersBufferInfos[skyscraper], {
                projection: m4.multiply(this.projection, this.view),
                modelview: worldMatrix,
                normalMat: m4.transpose(m4.inverse(worldMatrix)),
                mode: game.light.mode, Ka: ambient, Kd: diffuse, Ks: game.light.Ks,
                shininessVal: game.light.shininessVal,
                ambientColor: colors[skyscraper],
                diffuseColor: colors[skyscraper],
                specularColor: [1, 1, 1],
                alpha: transparent ? game.light.transparency : 1.0,
                lightPos: lightPos,
            });
        }

        drawSkyscraperForPicking() {
            const worldMatrix = this.skyscraperTransform(this.skyscraper);
            drawObject(pickingProgramInfo, skyscrapersBufferInfos[this.skyscraper], {
                u_world: worldMatrix,
                u_id: getId(this.id + game.board.length),
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
            this.worldMatrix = m4.translate(this.worldMatrix, 0, game.size * 2, 0);
            this.worldMatrix = m4.yRotate(this.worldMatrix, degToRad(90));
            super.drawNumber(skyscraper)
        }
    }

    class Objective3D extends Tile3D {
        constructor(objective) {
            super(objective.x, objective.z, -1);
            this.objective = objective;
            this.rotation = objective.rotation;
        }

        get n() {
            return this.objective.n;
        }

        drawTextured(viewMatrix, projectionMatrix) {
            this.buffer = tileBufferInfos.empty;
            if (game.options.helpers.value) {
                if (this.objective.correct && !this.objective.duplicates) {
                    this.buffer = tileBufferInfos.correct;
                }
                if (this.objective.duplicates) {
                    this.buffer = tileBufferInfos.wrong;
                }
            }
            super.drawTextured(viewMatrix, projectionMatrix);
        }
    }

    const board = game.board.map((s, i) => new Lot3D(s, i + 1))
    const numbersAround = game.numbersAround.map((s) => new Objective3D(s));
    const corners = game.corners.map((s) => new Objective3D(s));

    // ------- RENDERING -------

    function drawObject(programInfo, bufferInfo, uniforms) {
        gl.useProgram(programInfo.program);

        webglUtils.setBuffersAndAttributes(gl, programInfo, bufferInfo);

        webglUtils.setUniforms(programInfo, uniforms);

        webglUtils.drawBufferInfo(gl, bufferInfo, gl.TRIANGLES);
    }

    function drawBoard(projectionMatrix, viewMatrix, tileRotation, minimap = false) {
        gl.enable(gl.BLEND);

        numbersAround.forEach((/** @type Objective3D */num) => {
            let rotation = game.options.rotateNumbers.value || minimap ? tileRotation : num.rotation;
            let outerRingTransform = m4.yRotate(m4.identity(), degToRad(rotation))
            if (!minimap && game.camera.orto) {
                outerRingTransform = m4.zRotate(outerRingTransform, degToRad(90));
                outerRingTransform = m4.translate(outerRingTransform, -1, 0, 0)
            }
            num.transform = outerRingTransform;
            num.drawTextured(viewMatrix, projectionMatrix);

            if (num.n > 0) {
                num.drawNumber(num.n);
            }
        })

        if (game.options.drawCorners.value || (game.camera.orto && !minimap)) {
            corners.forEach((corner) => {
                let outerRingTransform = m4.yRotate(m4.identity(), degToRad(tileRotation))
                if (!minimap && game.camera.orto) {
                    outerRingTransform = m4.zRotate(outerRingTransform, degToRad(90));
                    outerRingTransform = m4.translate(outerRingTransform, -1, 0, 0)
                }

                corner.transform = outerRingTransform;
                corner.drawTextured(viewMatrix, projectionMatrix);
            })
        }

        board.forEach((/** @type Lot3D */ square) => {
            square.drawTextured(viewMatrix, projectionMatrix);

            let skyscraper;
            let Ka = game.light.Ka, Kd = game.light.Kd;
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
            } else if (game.options.showGhost.value && squarePickedFrom?.id === square.id && !minimap) {
                transparent = true;
                skyscraper = squarePickedFrom.skyscraper;
                if (game.options.swap.value) {
                    let skyscraperLookedAt = board.filter(s => s.id === squareLookedAtId)[0];
                    if (skyscraperLookedAt?.skyscraper > 0) {
                        skyscraper = skyscraperLookedAt.skyscraper;
                    }
                }
            }

            if (skyscraper > 0) {
                const cameraPos = game.getCameraPos();
                const lightPos = minimap ? [square.x, 20, square.z] : [cameraPos[0] + game.light.x, 8, cameraPos[2] + game.light.z];
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

    let lastRotation = 0;

    let binID = -1;
    let cameraNorthID = -1;
    let cameraEastID = -1;
    let cameraSouthID = -1;
    let cameraWestID = -1;

    const selectorIdOffset = 2 * board.length + game.size;

    let oldPickId = -1;
    let squareLookedAtId = 0;
    let selectedSquare = null;
    let selectedSkyscraper = 0;
    let extraLookedAt = 0;
    let squarePickedFrom = null;

    function render() {
        if (webglUtils.resizeCanvasToDisplaySize(gl.canvas)) {
            setFramebufferAttachmentSizes(gl.canvas.width, gl.canvas.height);

            gameareaHeight = Math.ceil(gl.canvas.height * (5 / 7));
            gameareaWidth = Math.ceil(gl.canvas.width * (2 / 3));
            gameareaAspect = gameareaWidth / gameareaHeight;
            gameareaX = 0;
            gameareaY = gl.canvas.height - gameareaHeight;

            minimapWidth = gl.canvas.width - gameareaWidth;
            minimapHeight = minimapWidth;
            minimapAspect = minimapWidth / minimapHeight;
            minimapX = gl.canvas.width - minimapWidth;
            minimapY = gl.canvas.height - minimapHeight;

            selectorWidth = gl.canvas.width - minimapWidth;
            selectorHeight = gl.canvas.height - gameareaHeight;
            selectorAspect = selectorWidth / selectorHeight;
            selectorX = 0;
            selectorY = 0;

            extraWidth = gl.canvas.width - selectorWidth;
            extraHeight = gl.canvas.height - minimapHeight;
            extraAspect = extraWidth / extraHeight;
            extraX = minimapX;
            extraY = 0;
        }

        optionsDiv.css({
            left: canvas[0].getBoundingClientRect().x + extraX,
            top: minimapHeight,
            "width": extraWidth - 10,
            "height": extraHeight - 10
        });

        if (!game.playing) {
            gameEndedDiv.css({
                left: canvas[0].getBoundingClientRect().x,
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

        let projectionMatrix = game.camera.orto || game.options.orthographic.value ?
            m4.orthographic(
                -game.orto.gameareaCamOrthoUnits * gameareaAspect,  // left
                game.orto.gameareaCamOrthoUnits * gameareaAspect,   // right
                -game.orto.gameareaCamOrthoUnits,  // bottom
                game.orto.gameareaCamOrthoUnits,   // top
                game.orto.cam1Near,
                game.orto.cam1Far) :
            m4.perspective(degToRad(game.camera.fov), gameareaAspect, game.camera.near, game.camera.far);

        const up = [0, 1, 0];
        const cameraPosition = game.getCameraPos();
        const target = [0, game.camera.y, 0];
        const cameraMatrix = m4.lookAt(cameraPosition, target, up);
        const viewMatrix = m4.inverse(cameraMatrix);

        board.forEach((/**@type Lot3D*/ square) => {
            square.drawForPicking(projectionMatrix, viewMatrix);
            if (square.skyscraper > 0) {
                square.drawSkyscraperForPicking();
            }
        });

        gl.viewport(minimapX, minimapY, minimapWidth, minimapHeight);
        gl.scissor(minimapX, minimapY, minimapWidth, minimapHeight);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const minimapCameraPosition = [0, 20, 0];
        const minimapTarget = [0, -game.orto.cam1Far, -1];
        const minimapCameraMatrix = m4.lookAt(minimapCameraPosition, minimapTarget, up);
        const minimapViewMatrix = m4.inverse(minimapCameraMatrix);

        const minimapProjectionMatrix =
            m4.orthographic(
                -game.orto.minimapCamOrthoUnits * minimapAspect,  // left
                game.orto.minimapCamOrthoUnits * minimapAspect,   // right
                -game.orto.minimapCamOrthoUnits,  // bottom
                game.orto.minimapCamOrthoUnits,   // top
                game.orto.cam1Near,
                game.orto.cam1Far);

        board.forEach((/**@type Lot3D*/ square) => {
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

        var distance = getPosFromIndex(game.size + 1, game.size) + 0.5;
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
        const selectorTarget = [0, 0, 0];
        const selectorCameraMatrix = m4.lookAt(selectorCameraPosition, selectorTarget, up);
        const selectorViewMatrix = m4.inverse(selectorCameraMatrix);

        const selectorProjectionMatrix =
            m4.orthographic(
                -game.orto.selectorCamOrthoUnits * selectorAspect, // left
                game.orto.selectorCamOrthoUnits * selectorAspect,  // right
                -game.orto.selectorCamOrthoUnits,                  // bottom
                game.orto.selectorCamOrthoUnits,                   // top
                game.orto.cam1Near,
                game.orto.cam1Far);

        const selectorViewProjectionMatrix = m4.multiply(selectorProjectionMatrix, selectorViewMatrix);

        let n, radius, occupiedSpace, nSpaces, width, spacing, xOffset, yOffset, binSize, binHeight;

        if (game.playing) {
            n = game.size + 1; // all skyscrapers + the bin

            radius = Math.sqrt(2); // the size of the diagonal of the skyscrapers
            occupiedSpace = 2 * radius * n; // the space taken up by all skyscrapers
            nSpaces = n + 1; // the number of spaces between the objects
            width = 2 * (1 / selectorProjectionMatrix[0]); // width of the selector in scene coordinates

            spacing = ((width - occupiedSpace) / nSpaces); // the distance between objects
            xOffset = - width / 2 + radius; // the starting point to draw the row
            yOffset = -game.size;

            binSize = 2;
            binHeight = 3;

            // the skyscrapers
            for (let i = 1; i < n; i++) {
                const height = i;
                const xPos = xOffset + spacing * (i) + 2 * radius * (i - 1);
                const yPos = yOffset + height;

                let worldMatrix = m4.identity();
                worldMatrix = m4.translate(worldMatrix, xPos, yPos, -40);
                worldMatrix = m4.xRotate(worldMatrix, degToRad(15));
                worldMatrix = m4.yRotate(worldMatrix, degToRad(45));
                worldMatrix = m4.scale(worldMatrix, height, height, height);

                drawObject(pickingProgramInfo, skyscrapersBufferInfos[height], {
                    u_world: worldMatrix,
                    u_id: getId(2 * board.length + height),
                    u_viewProjection: selectorViewProjectionMatrix,
                });
            }

            // the bin
            {
                const xPos = xOffset + spacing * (n) + 2 * radius * (n - 1);
                const yPos = -(binHeight / binSize) / 2;
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

        const pixelX = game.controls.mouseX * gl.canvas.width / gl.canvas.clientWidth;
        const pixelY = gl.canvas.height - game.controls.mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;
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
        if (game.camera.angleX > 315 + safeArea || game.camera.angleX < 45 - safeArea) {
            rotation = 180;
        } else if (game.camera.angleX >= 45 + safeArea && game.camera.angleX < 135 - safeArea) {
            rotation = 90;
        } else if (game.camera.angleX >= 135 + safeArea && game.camera.angleX < 225 - safeArea) {
            rotation = 0;
        } else if (game.camera.angleX >= 225 + safeArea && game.camera.angleX < 315 - safeArea) {
            rotation = 270;
        }
        lastRotation = rotation;

        drawBoard(projectionMatrix, viewMatrix, rotation)

        // ------- Draw the minimap -------

        gl.viewport(minimapX, minimapY, minimapWidth, minimapHeight);
        gl.scissor(minimapX, minimapY, minimapWidth, minimapHeight);
        gl.clearColor(...minimapColor);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        drawBoard(minimapProjectionMatrix, minimapViewMatrix, 90, true)

        function drawDirectionSquare(worldMatrix, dir) {
            worldMatrix = m4.yRotate(worldMatrix, degToRad(90));

            drawObject(texturedProgramInfo, charactersBufferInfos[dir], {
                u_matrix: computeWorldViewProjection(minimapProjectionMatrix, minimapViewMatrix, worldMatrix),
                u_texture: textureAtlas,
                u_worldInverseTranspose: m4.transpose(m4.inverse(worldMatrix)),
                u_reverseLightDirection: m4.normalize([game.light.x, game.light.y, game.light.z])
            });
        }

        gl.enable(gl.BLEND);

        var distance = getPosFromIndex(game.size + 1, game.size) + 0.5;
        var worldMatrix = m4.translate(m4.identity(), distance, 0, 0);
        drawDirectionSquare(worldMatrix, "E");
        var worldMatrix = m4.translate(m4.identity(), -distance, 0, 0);
        drawDirectionSquare(worldMatrix, "W");
        var worldMatrix = m4.translate(m4.identity(), 0, 0, distance);
        drawDirectionSquare(worldMatrix, "S");
        var worldMatrix = m4.translate(m4.identity(), 0, 0, -distance);
        drawDirectionSquare(worldMatrix, "N");

        var point = followSquarePath(0, 0, distance, game.camera.angleX);
        var worldMatrix = m4.translate(m4.identity(), point.x, 1, point.y);
        worldMatrix = m4.yRotate(worldMatrix, degToRad(180 - game.camera.angleX));
        worldMatrix = m4.scale(worldMatrix, 1.5, 1, 1.5);
        drawDirectionSquare(worldMatrix, "V");

        gl.disable(gl.BLEND);

        // ------- Draw selector -------

        gl.viewport(selectorX, selectorY, selectorWidth, selectorHeight);
        gl.scissor(selectorX, selectorY, selectorWidth, selectorHeight);
        gl.clearColor(...selectorColor);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.disable(gl.CULL_FACE);

        if (game.playing) {
            // the skyscrapers
            for (let i = 1; i < n; i++) {
                const height = i;
                const xPos = xOffset + spacing * (i) + 2 * radius * (i - 1);
                const yPos = yOffset + height;

                let worldMatrix = m4.identity();
                worldMatrix = m4.translate(worldMatrix, xPos, yPos, -40);
                worldMatrix = m4.xRotate(worldMatrix, degToRad(15));
                worldMatrix = m4.yRotate(worldMatrix, degToRad(45));
                worldMatrix = m4.scale(worldMatrix, height, height, height);

                let Ka = game.light.selectorKa, Kd = game.light.selectorKd;
                if (board.filter(s => s.skyscraper === height).length >= game.size) {
                    Ka = .2;
                    Kd = .4;
                }
                if (selectedSkyscraper === height || (height === id - 2 * board.length && !game.controls.movingView && !game.controls.holding)) {
                    Ka += .4;
                    Kd += .2;
                }

                drawObject(solidColorProgramInfo, skyscrapersBufferInfos[height], {
                    projection: m4.multiply(selectorProjectionMatrix, selectorViewMatrix),
                    modelview: worldMatrix,
                    normalMat: m4.transpose(m4.inverse(worldMatrix)),
                    mode: game.light.mode, Ka: Ka, Kd: Kd, Ks: 0,
                    shininessVal: game.light.shininessVal,
                    ambientColor: colors[height], diffuseColor: colors[height],
                    specularColor: [1, 1, 1],
                    alpha: 1.0,
                    lightPos: [xPos + game.light.selectorX, yPos, 0],
                });

                if (game.options.showRemaining.value) {
                    let remaining = game.size - game.placed[height];
                    if (remaining > 0) {
                        worldMatrix = m4.translate(m4.identity(), xPos, yPos - height + 0.8, 0);
                        worldMatrix = m4.xRotate(worldMatrix, degToRad(90));
                        worldMatrix = m4.yRotate(worldMatrix, degToRad(90));
                        worldMatrix = m4.scale(worldMatrix, 1.5, 1.5, 1.5);

                        gl.enable(gl.BLEND)
                        drawObject(texturedProgramInfo, charactersBufferInfos[remaining], {
                            u_matrix: computeWorldViewProjection(selectorProjectionMatrix, selectorViewMatrix, worldMatrix),
                            u_texture: textureAtlas,
                            u_worldInverseTranspose: m4.transpose(m4.inverse(worldMatrix)),
                            u_reverseLightDirection: m4.normalize([game.light.x, game.light.y, game.light.z])
                        });
                        gl.disable(gl.BLEND)
                    }
                }
            }

            // the bin
            {
                const xPos = xOffset + spacing * (n) + 2 * radius * (n - 1);
                const yPos = -(binHeight / binSize) / 2;
                let worldMatrix = m4.identity();
                worldMatrix = m4.translate(worldMatrix, xPos, yPos, -40);
                worldMatrix = m4.xRotate(worldMatrix, degToRad(15));
                worldMatrix = m4.yRotate(worldMatrix, degToRad(45));
                worldMatrix = m4.scale(worldMatrix, binSize, binSize, binSize);
                let Ka = game.light.selectorKa, Kd = game.light.selectorKd;
                if (extraLookedAt === BIN && game.controls.holding && selectedSquare != null && selectedSkyscraper === 0) {
                    Ka += .4;
                    Kd += .2;
                }
                let binColor = [0.8, 0.1, 0.1];
                drawObject(solidColorProgramInfo, binBufferInfo, {
                    projection: m4.multiply(selectorProjectionMatrix, selectorViewMatrix),
                    modelview: worldMatrix,
                    normalMat: m4.transpose(m4.inverse(worldMatrix)),
                    mode: game.light.mode, Ka: Ka, Kd: Kd, Ks: 0,
                    shininessVal: game.light.shininessVal,
                    ambientColor: binColor, diffuseColor: binColor,
                    specularColor: [1, 1, 1],
                    alpha: 1.0,
                    lightPos: [xPos, yPos, 0],
                })
            }
        }

        // ------- Draw extra -------

        gl.viewport(extraX, extraY, extraWidth, extraHeight);
        gl.scissor(extraX, extraY, extraWidth, extraHeight);
        gl.clearColor(...extraColor);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // ------------------------------------------------

        if (game.controls.holding && (selectedSkyscraper > 0 || selectedSquare != null)) {
            document.body.style.cursor = "grabbing";
        }

        // set the info nodes
        idNode.nodeValue = `${id}`;
        mouseNode.nodeValue = `${game.controls.mouseX}, ${game.controls.mouseY}`;

        requestAnimationFrame(render);
    }

    // ------- GAME LOGIC -------

    function lookingAt(id) {
        function lookingAtCamera(dir) {
            document.body.style.cursor = "pointer";
            extraLookedAt = dir;
            if (game.controls.clicking) {
                game.setSnap(dir);
            }
        }

        // restore
        if (oldPickId >= 0) {
            document.body.style.cursor = "auto";
            /**@type Lot3D*/
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
        if (id > 0 && !game.controls.movingView && game.playing) {
            oldPickId = id;
            /**@type Lot3D*/
            let square;
            if (id <= board.length) { // looking at a square
                square = board.filter(s => s.id === id)[0]
            } else if (id > board.length && id <= 2 * board.length) { // looking at a skyscraper
                document.body.style.cursor = "grab";
                square = board.filter(s => s.id + board.length === id)[0]
            } else if (id > 2 * board.length && id <= selectorIdOffset) { // skyscraper in the selector
                document.body.style.cursor = "grab";
                if (selectedSkyscraper === 0 && game.controls.clicking && !game.controls.holding) {
                    game.controls.holding = true;
                    selectedSkyscraper = id - 2 * board.length;
                }
            } else if (id > selectorIdOffset) {
                if (id === binID) {
                    extraLookedAt = BIN;
                    if (!game.controls.clicking && game.controls.holding) {
                        if (selectedSquare) { // picked from the grid
                            selectedSquare.skyscraper = 0
                        }
                        selectedSkyscraper = 0;
                        squarePickedFrom = null;
                        selectedSquare = false;
                        game.controls.holding = false;
                    }
                }
                if (id === cameraNorthID && !game.controls.holding) {
                    lookingAtCamera(CAMERA_N);
                }
                if (id === cameraEastID && !game.controls.holding) {
                    lookingAtCamera(CAMERA_E);
                }
                if (id === cameraSouthID && !game.controls.holding) {
                    lookingAtCamera(CAMERA_S);
                }
                if (id === cameraWestID && !game.controls.holding) {
                    lookingAtCamera(CAMERA_W);
                }
            }
            if (game.controls.usingTouch && !game.controls.clicking && !game.controls.holding) {
                if (square)
                    square.deselect();
                if (selectedSquare != null) {
                    selectedSkyscraper = 0
                    selectedSquare = null;
                }
                extraLookedAt = 0;
            }
            if (square) {
                if (game.controls.usingTouch && !game.controls.clicking && !game.controls.holding) {
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

                if (game.controls.clicking && !game.controls.holding) { // picking a skyscraper from the grid
                    game.controls.holding = true;
                    if (square.skyscraper > 0) {
                        squarePickedFrom = square;
                        selectedSquare = square;
                    }
                }
                if (!game.controls.clicking && game.controls.holding) { // letting go of a skyscraper
                    if (selectedSquare && selectedSquare.id !== square.id) { // picked from the grid
                        let temp = game.options.swap.value ? square.skyscraper : 0;
                        square.skyscraper = selectedSquare.skyscraper;
                        selectedSquare.skyscraper = temp;
                    }
                    if (selectedSkyscraper > 0) { // picked from selector
                        square.skyscraper = selectedSkyscraper;
                    }
                    selectedSkyscraper = 0;
                    selectedSquare = null;
                    squarePickedFrom = null;
                    game.controls.holding = false;
                }
            }

            game.check();

        } else {
            if (game.controls.mouseX <= gameareaWidth && game.controls.mouseY <= gameareaHeight) {
                document.body.style.cursor = "move";
                if (game.controls.clicking && !game.controls.holding) {
                    game.controls.movingView = true;
                }
            } else {
                document.body.style.cursor = "auto";
            }
            if (!game.controls.clicking) {
                game.controls.movingView = false;
                if (game.controls.holding) {
                    if (squarePickedFrom && selectedSquare) {
                        squarePickedFrom.skyscraper = selectedSquare.skyscraper
                    }
                    selectedSquare = null;
                    squarePickedFrom = null;
                    game.controls.holding = false;
                } else {
                    selectedSkyscraper = 0;
                }
            }

            extraLookedAt = 0;
        }
    }

    function getBooleanSymbol(value) {
        return value ? "✔" : "✘";
    }

    for (const [k, option] of Object.entries(game.options)) {
        const toggle = () => {
            option.toggle();
            $(`#${k}`).text(getBooleanSymbol(option.value)).css('color', option.value ? 'blue' : 'red');
        };
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
                    }).css('color', option.value ? 'blue' : 'red')
                ])
        );
    }
    optionsDiv.show();

    // Debug text nodes
    var idNode = document.createTextNode("");
    document.querySelector("#info-id").appendChild(idNode);
    var mouseNode = document.createTextNode("");
    document.querySelector("#info-mouse").appendChild(mouseNode);

    let startMousePos = [-1, -1];

    function handleKeyDown(event) {
        const key = event.key;
        switch (key.toLowerCase()) {
            case "w":
                game.rotateUp();
                break;
            case "a":
                game.rotateLeft();
                break;
            case "s":
                game.rotateDown();
                break;
            case "d":
                game.rotateRight();
                break;
            case "e":
                game.changeViewSnapClockwise();
                break;
            case "q":
                game.changeViewSnapCounterclockwise();
                break;
        }
    }

    function handleMouseDown(e) {
        switch (e.which) {
            case 1 || 2:
                e.preventDefault();
                game.controls.usingTouch = false;
                startMousePos = [e.clientX, e.clientY];
                window.addEventListener('mouseup', (e) => handleMouseUp(e));
            case 1: // the left button
                game.controls.clicking = true;
                break;
            case 2: // the middle button
                game.controls.panning = true;
                break;

        }
    }

    function handleMouseUp(e) {
        switch (e.which) {
            case 1 || 2:
                e.preventDefault();
                window.removeEventListener('mouseup', handleMouseUp);
            case 1: // the left button
                game.controls.clicking = false;
                break;
            case 2: // the middle button
                game.controls.panning = false;
                break;
        }
    }

    function handleMouseMove(e) {
        e.preventDefault();
        game.controls.usingTouch = false;

        const rect = canvas[0].getBoundingClientRect();
        game.controls.mouseX = e.clientX - rect.left;
        game.controls.mouseY = e.clientY - rect.top;

        if (game.controls.movingView || game.controls.panning) {
            game.camera.angleX += -1 / game.camera.slowness * (startMousePos[0] - e.clientX);
            game.camera.angleY += 1 / game.camera.slowness * (startMousePos[1] - e.clientY);
            game.correctAngles();
        }

        startMousePos = [e.clientX, e.clientY];
    }

    function handleTouchStart(e) {
        e.preventDefault();
        game.controls.usingTouch = true;

        game.controls.clicking = true;
        window.addEventListener('touchend', (e) => handleTouchEnd(e));

        const rect = canvas[0].getBoundingClientRect();
        game.controls.mouseX = e.touches[0].clientX - rect.left;
        game.controls.mouseY = e.touches[0].clientY - rect.top;

        startMousePos = [e.touches[0].clientX, e.touches[0].clientY];
    }

    function handleTouchEnd(e) {
        e.preventDefault();

        game.controls.clicking = false;

        window.removeEventListener('mouseup', handleTouchStart);
    }

    function handleTouchMove(e) {
        e.preventDefault();

        const rect = canvas[0].getBoundingClientRect();
        game.controls.mouseX = e.touches[0].clientX - rect.left;
        game.controls.mouseY = e.touches[0].clientY - rect.top;

        if (game.controls.movingView) {
            game.camera.angleX += -1 / game.camera.slowness * (startMousePos[0] - e.touches[0].clientX);
            game.camera.angleY += 1 / game.camera.slowness * (startMousePos[1] - e.touches[0].clientY);
            game.correctAngles();
        }
        startMousePos = [e.touches[0].clientX, e.touches[0].clientY];
    }

    function handleWheel(e) {
        e.preventDefault();

        if (!game.camera.orto && !game.options.orthographic.value) { // zoom only when in perspective view
            const newZoom = game.camera.zoom * Math.pow(2, e.originalEvent.deltaY * 0.001);
            game.camera.zoom = Math.max(game.camera.minZoom, Math.min(game.camera.maxZoom, newZoom));
        }
    }

    game.playing = true;
    requestAnimationFrame(render);
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
        case 1:
        case 2: yFactor = -1; break;
        case 3:
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
    let char = textureAtlasInfo.pos[c];

    let maxX = textureAtlasInfo.textureWidth;
    let maxY = textureAtlasInfo.textureHeight;
    let u1 = char.x * textureAtlasInfo.size / maxX;
    let v1 = 1 - ((char.y + 1) * textureAtlasInfo.size) / maxY;
    let u2 = ((char.x + 1) * textureAtlasInfo.size) / maxX;
    let v2 = 1 - char.y * textureAtlasInfo.size / maxY;

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
