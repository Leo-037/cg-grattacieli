"use strict"

import { cube_colors, cube_indices, cube_normals, cube_vertices, square_indices, square_normals, square_textcoords, square_vertices } from "./geometry.js";
import { LoadMesh, degToRad, getRandomInt, loadTexture } from "./resources/myutils.js"

var skyscraperMeshData = new Array();
var binMeshData = new Array();

const BIN = 1;
let binID = -1;

const numberTextureInfo = {
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
        0: { x: 4, y: 1 },
    }
}

const colors = {
    1: m4.normalize([20, 200, 255]),
    2: m4.normalize([120, 100, 255]),
    3: m4.normalize([110, 255, 120]),
    4: m4.normalize([255, 200, 0]),
    5: m4.normalize([220, 50, 0]),
    6: m4.normalize([0, 0, 0]),
    7: m4.normalize([0, 0, 0]),
    8: m4.normalize([0, 0, 0]),
    9: m4.normalize([0, 0, 0]),
}

function toFixedFloat(n, f) {
    return Math.floor((n * 10 ** f).toFixed(f)) / 10 ** f
}

function getTextureCoordinatesForNumber(n) {
    // fill the texture with 1s
    var texcoords = []
    for (let i = 0; i < 48; i++) {
        texcoords.push(1)
    }
    var maxX = numberTextureInfo.textureWidth;
    var maxY = numberTextureInfo.textureHeight;

    const offset = 16; // edit the top face
    if (n >= 0 && n <= 9) {
        var number = numberTextureInfo.pos[n];
        var u1 = toFixedFloat(number.x * numberTextureInfo.size / maxX, 2);
        var v1 = toFixedFloat(1 - ((number.y + 1) * numberTextureInfo.size) / maxY, 2);
        var u2 = toFixedFloat(((number.x + 1) * numberTextureInfo.size) / maxX, 2);
        var v2 = toFixedFloat(1 - number.y * numberTextureInfo.size / maxY, 2);

        texcoords[offset + 0] = u1;
        texcoords[offset + 1] = v1;

        texcoords[offset + 2] = u2;
        texcoords[offset + 3] = v1;

        texcoords[offset + 4] = u2;
        texcoords[offset + 5] = v2;

        texcoords[offset + 6] = u1;
        texcoords[offset + 7] = v2;
    }

    return texcoords;
}

function main() {
    /** @type {HTMLCanvasElement} */
    const canvas = document.querySelector('#canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
        return;
    }

    const settings = {
        dimScacchiera: 5,
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
        slowness: 10,
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
        minimapCamOrthoUnits: settings.dimScacchiera + 5,
        selectorCamOrthoUnits: settings.dimScacchiera + 1.5,
    }
    const light = {
        x: 0, y: 10, z: 0,
        mode: 1, // 1 - normal, 2 - ambient, 3 - diffuse, 4 - specular
        Ka: 0.7, Kd: .35, Ks: 0,
        shininessVal: 80,
    }

    // var gui = new dat.GUI();
    // gui.close();
    // gui.add(orto, 'selectorCamOrthoUnits')

    skyscraperMeshData.sourceMesh = 'data/skyscraper/skyscraper.obj';
    var skyscraperMesh = LoadMesh(gl, skyscraperMeshData);

    binMeshData.sourceMesh = 'data/bin/bin.obj';
    var binMesh = LoadMesh(gl, binMeshData);

    const squareBufferInfo = createSquareBufferInfo(gl);
    const grattacieloBufferInfo = createBufferFromMesh(gl, skyscraperMesh);
    const binBufferInfo = createBufferFromMesh(gl, binMesh);
    const cubeBufferInfo = createCubeBufferInfo(gl);

    const numbersBufferInfos = {}
    for (let i = 0; i < settings.dimScacchiera + 1; i++) {
        numbersBufferInfos[i] = webglUtils.createBufferInfoFromArrays(gl, {
            position: { numComponents: 3, data: new Float32Array(square_vertices) },
            texcoord: { numComponents: 2, data: new Float32Array(getTextureCoordinatesForNumber(i)) },
            normal: { numComponents: 3, data: new Float32Array(square_normals) },
            indices: { numComponents: 3, data: new Uint16Array(square_indices) },
        });
    }

    const pickingProgramInfo = webglUtils.createProgramInfo(gl, ["pick-vertex-shader", "pick-fragment-shader"]);
    const texturedProgramInfo = webglUtils.createProgramInfo(gl, ['simple-texture-vertex-shader-3d', 'simple-texture-fragment-shader-3d']);
    const solidColorProgramInfo = webglUtils.createProgramInfo(gl, ['solid-color-vertex-shader', 'solid-color-fragment-shader']);


    class DrawableObject {
        constructor(buffer, programInfo, transform, uniforms, id, projection) {
            this.id = id;
            this.buffer = buffer;
            this.programInfo = programInfo;
            this.transform = transform;
            this.uniforms = uniforms;
            this.projection = projection;
        }
    }

    class Square extends DrawableObject {
        constructor(x, z, id) {
            super(squareBufferInfo, texturedProgramInfo, m4.identity(), {}, id, m4.identity())
            this.x = x;
            this.z = z;
            this.skyscraper = 0;
            this.selected = false;
        }

        select() {
            this.selected = true;
            this.transform = m4.scale(m4.identity(), .9, 1, .9)
        }

        deselect() {
            this.selected = false;
            this.transform = m4.identity();
        }
    }

    class Number {
        constructor(x, z, n) {
            this.x = x;
            this.z = z;
            this.n = n;
        }
    }

    let scacchiera = [];

    let id = 0;
    if (settings.dimScacchiera > 1) {
        for (var zz = 0; zz < settings.dimScacchiera; ++zz) {
            var v = zz / (settings.dimScacchiera - 1);
            var z = (v - .5) * 2 * (settings.dimScacchiera - 1);
            for (var xx = 0; xx < settings.dimScacchiera; ++xx) {
                var u = xx / (settings.dimScacchiera - 1);
                var x = (u - .5) * 2 * (settings.dimScacchiera - 1);
                id += 1;
                const square = new Square(x, z, id);
                scacchiera.push(square);
            }
        }
    }

    const partita = [
        1, 4, 3, 2, 2,
        3, 4, 1, 2, 2,
        4, 2, 1, 2, 3,
        3, 2, 3, 2, 1]
    let numeriAttorno = [];
    for (let i = 0; i < settings.dimScacchiera; i++) {
        let d1 = (i / (settings.dimScacchiera - 1) - .5) * 2 * (settings.dimScacchiera - 1);
        let d2 = settings.dimScacchiera + 1;
        numeriAttorno.push(new Number(d1, d2, settings.dimScacchiera === 5 ? partita[i + 0] : getRandomInt(1, settings.dimScacchiera)));
        numeriAttorno.push(new Number(d2, d1, settings.dimScacchiera === 5 ? partita[i + 1 * settings.dimScacchiera] : getRandomInt(1, settings.dimScacchiera)));
        numeriAttorno.push(new Number(d1, -d2, settings.dimScacchiera === 5 ? partita[i + 2 * settings.dimScacchiera] : getRandomInt(1, settings.dimScacchiera)));
        numeriAttorno.push(new Number(-d2, d1, settings.dimScacchiera === 5 ? partita[i + 3 * settings.dimScacchiera] : getRandomInt(1, settings.dimScacchiera)));
    }

    // generate some skyscrapers in random spots
    for (let i = 0; i < settings.dimScacchiera * 2; i++) {
    /**@type Square*/let square = scacchiera[Math.floor(Math.random() * scacchiera.length)];;
        square.skyscraper = getRandomInt(1, settings.dimScacchiera + 1);
    }


    // computes the camera position as it orbits around the center
    function getCameraPos() {
        const X = camera.zoom * Math.cos(degToRad(camera.angleX)) * Math.sin(degToRad(camera.angleY))
        const Z = camera.zoom * Math.sin(degToRad(camera.angleX)) * Math.sin(degToRad(camera.angleY))
        const Y = camera.z + camera.zoom * Math.cos(degToRad(camera.angleY))

        return [X, Y, Z]
    }


    const squareTexture = loadTexture(gl, "./resources/images/square.png")
    const numberTexture = loadTexture(gl, "./resources/images/numbers/allNumbers.png");
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // -------- TEXTURE FOR PICKING --------

    // Create a texture to render to
    const targetTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // create a depth renderbuffer
    const depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);

    function setFramebufferAttachmentSizes(width, height) {
        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        // define size and format of level 0
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


    // Create and bind the framebuffer
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

    // attach the texture as the first color attachment
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    const level = 0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, level);

    // make a depth buffer and the same size as the targetTexture
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);


    function drawObject(programInfo, bufferInfo, uniforms) {
        gl.useProgram(programInfo.program);

        webglUtils.setBuffersAndAttributes(gl, programInfo, bufferInfo);

        webglUtils.setUniforms(programInfo, uniforms);

        webglUtils.drawBufferInfo(gl, bufferInfo, gl.TRIANGLES);
    }

    function drawScene(projectionMatrix, viewMatrix, tileRotation, minimap = false) {

        scacchiera.forEach((/** @type Square */ square) => {
            let worldMatrix = m4.translate(m4.identity(), square.x, 0, square.z);
            worldMatrix = m4.multiply(worldMatrix, square.transform);

            drawObject(texturedProgramInfo, squareBufferInfo, {
                u_matrix: computeWorldViewProjection(projectionMatrix, viewMatrix, worldMatrix),
                u_texture: squareTexture,
                u_worldInverseTranspose: m4.transpose(m4.inverse(worldMatrix)),
                u_reverseLightDirection: m4.normalize([0, light.y, 0])
            });

            if (squareLookedAt === square.id) {
                let skyscraper;
                if (selectedSquare) {
                    skyscraper = selectedSquare.skyscraper;
                } else if (selectedSkyscraper > 0) {
                    skyscraper = selectedSkyscraper;
                } else {
                    skyscraper = square.skyscraper;
                }
                if (skyscraper > 0) {
                    let worldMatrix = m4.translate(m4.identity(), square.x, skyscraper, square.z);
                    worldMatrix = m4.scale(worldMatrix, .9, skyscraper, .9);
                    const cameraPos = getCameraPos();
                    drawObject(solidColorProgramInfo, grattacieloBufferInfo, {
                        projection: m4.multiply(projectionMatrix, viewMatrix),
                        modelview: worldMatrix,
                        normalMat: m4.transpose(m4.inverse(worldMatrix)),
                        mode: light.mode, Ka: 1.0, Kd: 1.0, Ks: light.Ks,
                        shininessVal: light.shininessVal,
                        ambientColor: colors[skyscraper],
                        diffuseColor: colors[skyscraper],
                        specularColor: [1, 1, 1],
                        lightPos: minimap ? [square.x, 20, square.z] : [cameraPos[0], 8, cameraPos[2]],
                    });
                }
            } else if (square.skyscraper > 0 && !(selectedSquare && selectedSquare.id === square.id)) {
                let worldMatrix = m4.translate(m4.identity(), square.x, square.skyscraper, square.z);
                worldMatrix = m4.scale(worldMatrix, .9, square.skyscraper, .9);
                const cameraPos = getCameraPos();
                drawObject(solidColorProgramInfo, grattacieloBufferInfo, {
                    projection: m4.multiply(projectionMatrix, viewMatrix),
                    modelview: worldMatrix,
                    normalMat: m4.transpose(m4.inverse(worldMatrix)),
                    mode: light.mode,
                    Ka: light.Ka,     // ambient
                    Kd: light.Kd,     // diffuse
                    Ks: light.Ks,     // specular
                    shininessVal: light.shininessVal,
                    ambientColor: colors[square.skyscraper],
                    diffuseColor: colors[square.skyscraper],
                    specularColor: [1, 1, 1],
                    lightPos: minimap ? [square.x, 20, square.z] : [cameraPos[0], 8, cameraPos[2]],
                });
            }
        });

        numeriAttorno.forEach((/** @type Number */num) => {
            let worldMatrix = m4.translate(m4.identity(), num.x, 0, num.z);
            worldMatrix = m4.yRotate(worldMatrix, degToRad(tileRotation));
            if (!minimap && camera.orto) {
                worldMatrix = m4.zRotate(worldMatrix, degToRad(90));
                worldMatrix = m4.translate(worldMatrix, -1, 0, 0)
            }

            drawObject(texturedProgramInfo, numbersBufferInfos[num.n], {
                u_matrix: computeWorldViewProjection(projectionMatrix, viewMatrix, worldMatrix),
                u_texture: numberTexture,
                u_worldInverseTranspose: m4.transpose(m4.inverse(worldMatrix)),
                u_reverseLightDirection: m4.normalize([0, light.y, 0])
            });
        })

        function drawEmptySquare(worldMatrix) {
            if (!minimap && camera.orto) {
                worldMatrix = m4.yRotate(worldMatrix, degToRad(tileRotation));
                worldMatrix = m4.zRotate(worldMatrix, degToRad(90));
                worldMatrix = m4.translate(worldMatrix, -1, 0, 0)
            }
            drawObject(texturedProgramInfo, numbersBufferInfos[0], {
                u_matrix: computeWorldViewProjection(projectionMatrix, viewMatrix, worldMatrix), u_texture: numberTexture,
                u_worldInverseTranspose: m4.transpose(m4.inverse(worldMatrix)),
                u_reverseLightDirection: m4.normalize([0, light.y, 0])
            });
        }
        var worldMatrix = m4.translate(m4.identity(), settings.dimScacchiera + 1, 0, settings.dimScacchiera + 1);
        drawEmptySquare(worldMatrix)
        var worldMatrix = m4.translate(m4.identity(), -(settings.dimScacchiera + 1), 0, settings.dimScacchiera + 1);
        drawEmptySquare(worldMatrix)
        var worldMatrix = m4.translate(m4.identity(), settings.dimScacchiera + 1, 0, -(settings.dimScacchiera + 1));
        drawEmptySquare(worldMatrix)
        var worldMatrix = m4.translate(m4.identity(), -(settings.dimScacchiera + 1), 0, -(settings.dimScacchiera + 1));
        drawEmptySquare(worldMatrix)
    }


    let mouseX = -1;
    let mouseY = -1;
    let oldPickId = -1;

    let usingTouch = false;
    let clicking = false;
    let holding = false;
    let movingView = false;

    const selectorOffset = 2 * scacchiera.length + settings.dimScacchiera;

    let squareLookedAt = 0;
    let selectedSquare = null;
    let selectedSkyscraper = 0;
    let extraLookedAt = 0;
    let squarePickedFrom = null;

    function render() {
        if (webglUtils.resizeCanvasToDisplaySize(gl.canvas)) {
            setFramebufferAttachmentSizes(gl.canvas.width, gl.canvas.height);
        }

        const gameareaHeight = Math.ceil(gl.canvas.height * (4 / 5));
        const gameareaWidth = gameareaHeight; // gl.canvas.width * (2 / 3);
        const gameareaAspect = gameareaWidth / gameareaHeight;
        const gameareaX = 0;
        const gameareaY = gl.canvas.height - gameareaHeight;

        const minimapWidth = gl.canvas.width - gameareaWidth;
        const minimapHeight = minimapWidth;
        const minimapAspect = minimapWidth / minimapHeight;
        const minimapX = gameareaWidth;
        const minimapY = gl.canvas.height - minimapHeight;

        const selectorWidth = gameareaWidth;
        const selectorHeight = gl.canvas.height - gameareaHeight;
        const selectorAspect = selectorWidth / selectorHeight;
        const selectorX = 0;
        const selectorY = 0;

        const extraWidth = gl.canvas.width - gameareaWidth;
        const extraHeight = gl.canvas.height - minimapHeight;
        const extraAspect = extraWidth / extraHeight;
        const extraX = gameareaWidth;
        const extraY = 0;


        const projectionMatrix = camera.orto ?
            m4.orthographic(
                -orto.gameareaCamOrthoUnits * gameareaAspect,  // left
                orto.gameareaCamOrthoUnits * gameareaAspect,   // right
                -orto.gameareaCamOrthoUnits,                  // bottom
                orto.gameareaCamOrthoUnits,                   // top
                orto.cam1Near,
                orto.cam1Far) :
            m4.perspective(degToRad(camera.fov), gameareaAspect, camera.near, camera.far);

        const cameraPosition = getCameraPos();
        const target = [0, camera.z, 0];
        const up = [0, 1, 0];
        const cameraMatrix = m4.lookAt(cameraPosition, target, up);
        const viewMatrix = m4.inverse(cameraMatrix);

        const viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);


        // ------ Draw the objects to the texture --------

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

        gl.enable(gl.SCISSOR_TEST);

        gl.viewport(gameareaX, gameareaY, gameareaWidth, gameareaHeight);
        gl.scissor(gameareaX, gameareaY, gameareaWidth, gameareaHeight);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        scacchiera.forEach((/**@type Square*/ square) => {
            let worldMatrix = m4.translate(m4.identity(), square.x, 0, square.z);

            drawObject(pickingProgramInfo, squareBufferInfo, {
                u_world: worldMatrix,
                u_id: getId(square.id),
                u_viewProjection: viewProjectionMatrix,
            });

            if (square.skyscraper > 0) {
                let worldMatrix = m4.translate(m4.identity(), square.x, square.skyscraper, square.z);
                worldMatrix = m4.scale(worldMatrix, .9, square.skyscraper, .9);

                drawObject(pickingProgramInfo, grattacieloBufferInfo, {
                    u_world: worldMatrix,
                    u_id: getId(square.id + scacchiera.length),
                    u_viewProjection: viewProjectionMatrix,
                });
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

        const minimapViewProjectionMatrix = m4.multiply(minimapProjectionMatrix, minimapViewMatrix);

        scacchiera.forEach((/**@type Square*/ square) => {
            let worldMatrix = m4.translate(m4.identity(), square.x, 0, square.z);

            drawObject(pickingProgramInfo, squareBufferInfo, {
                u_world: worldMatrix,
                u_id: getId(square.id),
                u_viewProjection: minimapViewProjectionMatrix,
            });

            if (square.skyscraper > 0) {
                let worldMatrix = m4.translate(m4.identity(), square.x, square.skyscraper, square.z);
                worldMatrix = m4.scale(worldMatrix, 1, square.skyscraper, 1);

                drawObject(pickingProgramInfo, grattacieloBufferInfo, {
                    u_world: worldMatrix,
                    u_id: getId(square.id + scacchiera.length),
                    u_viewProjection: minimapViewProjectionMatrix,
                });
            }
        });

        gl.viewport(selectorX, selectorY, selectorWidth, selectorHeight);
        gl.scissor(selectorX, selectorY, selectorWidth, selectorHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const selectorCameraPosition = [0, 0, 5];
        const selectorCameraMatrix = m4.lookAt(selectorCameraPosition, [0, 0, 0], up);
        const selectorViewMatrix = m4.inverse(selectorCameraMatrix);

        const selectorProjectionMatrix =
            m4.orthographic(
                -orto.selectorCamOrthoUnits * selectorAspect,  // left
                orto.selectorCamOrthoUnits * selectorAspect,   // right
                -orto.selectorCamOrthoUnits,                  // bottom
                orto.selectorCamOrthoUnits,                   // top
                orto.cam1Near,
                orto.cam1Far);

        const selectorViewProjectionMatrix = m4.multiply(selectorProjectionMatrix, selectorViewMatrix);

        var n = settings.dimScacchiera + 1; // all skyscrapers + the bin
        var size = 1.5;
        var radius = Math.sqrt(2 * (size ** 2)); // the size of the diagonal of the skyscrapers
        var occupiedSpace = 2 * radius * n; // the space taken up by all skyscrapers
        var nSpaces = n + 1; // the number of spaces between the objects
        var width = 2 * (1 / selectorProjectionMatrix[0]); // width of the selector in scene coordinates 

        var spacing = ((width - occupiedSpace) / nSpaces); // the distance between objects
        var xOffset = - width / 2 + radius; // the starting point to draw the row
        var yOffset = -(settings.dimScacchiera * size) / 2;

        var binSize = 2;
        var binHeight = 3;
        // the bin
        {
            const xPos = xOffset + spacing;
            const yPos = yOffset + binHeight / binSize;
            let worldMatrix = m4.identity();
            worldMatrix = m4.translate(worldMatrix, xPos, yPos, -40);
            worldMatrix = m4.xRotate(worldMatrix, degToRad(15));
            worldMatrix = m4.yRotate(worldMatrix, degToRad(45));
            worldMatrix = m4.scale(worldMatrix, binSize, binSize, binSize);
            binID = selectorOffset + 1;
            // on the texture the bin is a cube to be more
            drawObject(pickingProgramInfo, cubeBufferInfo, {
                u_world: worldMatrix,
                u_id: getId(binID),
                u_viewProjection: selectorViewProjectionMatrix,
            })
        }

        // the skyscrapers
        for (let i = 1; i < n; i++) {
            const height = i;
            const xPos = xOffset + spacing * (i + 1) + 2 * radius * i;
            const yPos = yOffset + (height / size);

            let worldMatrix = m4.identity();
            worldMatrix = m4.translate(worldMatrix, xPos, yPos, -40);
            worldMatrix = m4.xRotate(worldMatrix, degToRad(45));
            worldMatrix = m4.yRotate(worldMatrix, degToRad(45));
            worldMatrix = m4.scale(worldMatrix, size, height, size);

            drawObject(pickingProgramInfo, grattacieloBufferInfo, {
                u_world: worldMatrix,
                u_id: getId(2 * scacchiera.length + height),
                u_viewProjection: selectorViewProjectionMatrix,
            });
        }


        // ------ Read the 1 pixel

        const pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
        const pixelY = gl.canvas.height - mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;
        const data = new Uint8Array(4);
        gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
        const id = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);

        lookingAt(id);

        // ------------- Draw the objects to the canvas -------------

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // ------- Draw the game area ------- 

        gl.viewport(gameareaX, gameareaY, gameareaWidth, gameareaHeight);
        gl.scissor(gameareaX, gameareaY, gameareaWidth, gameareaHeight);
        gl.clearColor(0.8, 0.8, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        let rotation = 0;
        if (camera.angleX > 315 || camera.angleX < 45) {
            rotation = 180;
        } else if (camera.angleX >= 45 && camera.angleX < 135) {
            rotation = 90;
        } else if (camera.angleX >= 135 && camera.angleX < 225) {
            rotation = 0;
        } else if (camera.angleX >= 225 && camera.angleX < 315) {
            rotation = 270
        }

        drawScene(projectionMatrix, viewMatrix, rotation)

        // ------- Draw the minimap -------

        gl.viewport(minimapX, minimapY, minimapWidth, minimapHeight);
        gl.scissor(minimapX, minimapY, minimapWidth, minimapHeight);
        gl.clearColor(1, 0.8, 0.3, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        drawScene(minimapProjectionMatrix, minimapViewMatrix, 90, true)

        // ------- Draw selector -------

        gl.viewport(selectorX, selectorY, selectorWidth, selectorHeight);
        gl.scissor(selectorX, selectorY, selectorWidth, selectorHeight);
        gl.clearColor(0.2, 0.2, 0.2, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.disable(gl.CULL_FACE);

        // the bin
        {
            const xPos = xOffset + spacing;
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
                lightPos: [xPos - spacing / 2, yPos, 0],
            })
        }

        // the skyscrapers
        for (let i = 1; i < n; i++) {
            const height = i;
            const xPos = xOffset + spacing * (i + 1) + 2 * radius * i;
            const yPos = yOffset + (height / size);

            let worldMatrix = m4.identity();
            worldMatrix = m4.translate(worldMatrix, xPos, yPos, -40);
            worldMatrix = m4.xRotate(worldMatrix, degToRad(45));
            worldMatrix = m4.yRotate(worldMatrix, degToRad(45));
            worldMatrix = m4.scale(worldMatrix, size, height, size);

            let Ka = .6, Kd = .8;
            if (scacchiera.filter(s => s.skyscraper === height).length >= settings.dimScacchiera) {
                Ka = .2;
                Kd = .4;
            }
            if (height === id - 2 * scacchiera.length && !movingView) {
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
                lightPos: [xPos - spacing / 2, yPos, 0],
            });
        }

        // ------- Draw extra -------

        gl.viewport(extraX, extraY, extraWidth, extraHeight);
        gl.scissor(extraX, extraY, extraWidth, extraHeight);
        gl.clearColor(0.3, 0.7, 0.5, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // ------------------------------------------------

        // set the info nodes
        angleXNode.nodeValue = camera.angleX.toFixed(1);
        angleYNode.nodeValue = camera.angleY.toFixed(1);
        idNode.nodeValue = `${id} / click ${clicking} / hold ${holding}`;
        extraNode.nodeValue = ``;

        requestAnimationFrame(render);
    }


    function lookingAt(id) {
        // restore
        if (oldPickId >= 0) {
            /**@type Square*/let square;
            if (oldPickId <= scacchiera.length) {
                square = scacchiera.filter(s => s.id == oldPickId)[0]
            } else if (oldPickId > scacchiera.length) {
                square = scacchiera.filter(s => s.id + scacchiera.length == oldPickId)[0]
            }
            if (square) {
                square.deselect();
                squareLookedAt = 0;
                extraLookedAt = 0;
                oldPickId = -1;
            }
        }

        // object under mouse
        if (id > 0 && !movingView) {
            oldPickId = id;
            /**@type Square*/
            let square;
            if (id <= scacchiera.length) { // looking at a square
                square = scacchiera.filter(s => s.id == id)[0]
            } else if (id > scacchiera.length && id <= 2 * scacchiera.length) { // looking at a skyscraper
                square = scacchiera.filter(s => s.id + scacchiera.length == id)[0]
            } else if (id > 2 * scacchiera.length && id <= selectorOffset) {
                if (selectedSkyscraper === 0 && clicking && !holding) {
                    holding = true;
                    selectedSkyscraper = id - 2 * scacchiera.length;
                }
            } else if (id > selectorOffset) {
                if (id === binID) {
                    extraLookedAt = BIN;
                    if (!clicking && holding) {
                        if (selectedSquare) { // picked from the grid
                            selectedSquare.skyscraper = 0
                        }
                        selectedSkyscraper = 0;
                        selectedSquare = false;
                        holding = false;
                    }
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
                    squareLookedAt = square.id;
                    square.select();
                }

                if (clicking && !holding) { // picking a skyscraper from the grid
                    holding = true;
                    if (square.skyscraper > 0) {
                        squarePickedFrom = square;
                        selectedSquare = square;
                    }
                }
                if (!clicking && holding) { // letting go of skyscraper
                    if (selectedSquare && selectedSquare.id !== square.id) { // picked from the grid
                        square.skyscraper = selectedSquare.skyscraper
                        selectedSquare.skyscraper = 0
                    }
                    if (selectedSkyscraper > 0) { // picked from selector
                        square.skyscraper = selectedSkyscraper;
                    }
                    selectedSkyscraper = 0;
                    selectedSquare = null;
                    holding = false;
                }
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
                }
            }
            if (clicking && !holding) {
                movingView = true;
            }
            extraLookedAt = 0;
        }
    }

    function correctAngles() {
        camera.orto = false;
        if (camera.angleX <= 0) {
            camera.angleX = 360
        } else if (camera.angleX >= 360) {
            camera.angleX = 0
        }
        if (camera.angleY >= 90) {
            camera.angleY = 89.99
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
        e.preventDefault();
        usingTouch = false;

        clicking = true;
        window.addEventListener('mouseup', handleMouseUp);

        startMousePos = [e.clientX, e.clientY];
    };

    function handleMouseUp(e) {
        e.preventDefault();

        clicking = false;
        window.removeEventListener('mouseup', handleMouseUp);
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
    };

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
            case "q":
                changeViewSnapLeft();
                break;
            case "e":
                changeViewSnapRight();
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
    function changeViewSnapRight() {
        if (camera.orto) {
            camera.angleX -= 90;
            if (camera.angleX < 0) {
                camera.angleX = 270;
            }
        } else {
            camera.angleX = Math.round(camera.angleX / 90) * 90;;
        }
        camera.angleY = 90;
        camera.orto = true;
    }
    function changeViewSnapLeft() {
        if (camera.orto) {
            camera.angleX += 90;
            if (camera.angleX > 360) {
                camera.angleX = 90;
            }
        } else {
            camera.angleX = Math.round(camera.angleX / 90) * 90;;
        }
        camera.angleY = 90;
        camera.orto = true;
    }

    // Create text nodes to save some time for the browser.
    var angleXNode = document.createTextNode("");
    var angleYNode = document.createTextNode("");
    var idNode = document.createTextNode("");
    var extraNode = document.createTextNode("");

    // Add those text nodes where they need to go
    document.querySelector("#info-angleX").appendChild(angleXNode);
    document.querySelector("#info-angleY").appendChild(angleYNode);
    document.querySelector("#info-id").appendChild(idNode);
    document.querySelector("#info-extra").appendChild(extraNode);

    requestAnimationFrame(render);
}

function showMessage(errorText) {
    const errorBoxDiv = document.getElementById('error-box');
    const errorSpan = document.createElement('p');
    errorSpan.innerText = errorText;
    errorBoxDiv.replaceChildren(errorSpan)
}

function computeWorldViewProjection(projectionMatrix, viewMatrix, worldMatrix) {
    // The matrix that maps the 3D space as seen from the camera to the 2D projection 
    let viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    // Apply the "world" changes to the 3D space
    var worldViewProjectionMatrix = m4.multiply(viewProjectionMatrix, worldMatrix);

    return worldViewProjectionMatrix;
}

function createSquareBufferInfo(gl) {
    return webglUtils.createBufferInfoFromArrays(gl, {
        position: { numComponents: 3, data: new Float32Array(square_vertices) },
        texcoord: { numComponents: 2, data: new Uint16Array(square_textcoords) },
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

function getId(id) {
    return [
        ((id >> 0) & 0xFF) / 0xFF,
        ((id >> 8) & 0xFF) / 0xFF,
        ((id >> 16) & 0xFF) / 0xFF,
        ((id >> 24) & 0xFF) / 0xFF,
    ]
}


main();