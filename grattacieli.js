"use strict"

import { cube_colors, cube_indices, cube_normals, cube_textcoords, cube_vertices, square_indices, square_normals, square_textcoords, square_vertices } from "./geometry.js";
import { degToRad, getRandomInt, loadTexture } from "./resources/myutils.js"



function main() {
    /** @type {HTMLCanvasElement} */
    const canvas = document.querySelector('#canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
        return;
    }

    const settings = {
        dimScacchiera: 5,
        fov: 40,
    }
    const camera = {
        zoom: 30,
        angleX: 45,
        angleY: 60,
        slowness: 5,
    }
    // var gui = new dat.GUI();
    // gui.add(settings, 'fov', 0, 180).step(1);
    // gui.add(camera, 'slowness', 1, 15);


    const pickingProgramInfo = webglUtils.createProgramInfo(gl, ["pick-vertex-shader", "pick-fragment-shader"]);
    const texturedProgramInfo = webglUtils.createProgramInfo(gl, ['simple-texture-vertex-shader-3d', 'simple-texture-fragment-shader-3d']);
    const solidColorProgramInfo = webglUtils.createProgramInfo(gl, ['solid-color-vertex-shader', 'solid-color-fragment-shader']);

    const squareBufferInfo = createSquareBufferInfo(gl);
    const grattacieloBufferInfo = createCubeBufferInfo(gl);


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

    // generate some skyscrapers in random spots
    for (let i = 0; i < settings.dimScacchiera * 2; i++) {
    /**@type Square*/let square = scacchiera[Math.floor(Math.random() * scacchiera.length)];;
        square.skyscraper = getRandomInt(1, settings.dimScacchiera + 1);
    }

    // computes the camera position as it orbits around the center
    function getCameraPos() {
        const X = camera.zoom * Math.cos(degToRad(camera.angleX)) * Math.sin(degToRad(camera.angleY))
        const Z = camera.zoom * Math.sin(degToRad(camera.angleX)) * Math.sin(degToRad(camera.angleY))
        const Y = camera.zoom * Math.cos(degToRad(camera.angleY))

        return [X, Y, Z]
    }

    const texture = loadTexture(gl, "./resources/images/square.jpg")


    // -------- PICKING --------

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
    setFramebufferAttachmentSizes(1, 1);

    // Create and bind the framebuffer
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

    // attach the texture as the first color attachment
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    const level = 0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, level);

    // make a depth buffer and the same size as the targetTexture
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    let pickingViewProjectionMatrix = m4.identity();


    function drawObject(programInfo, bufferInfo, uniforms) {
        gl.useProgram(programInfo.program);

        webglUtils.setBuffersAndAttributes(gl, programInfo, bufferInfo);

        webglUtils.setUniforms(programInfo, uniforms);

        webglUtils.drawBufferInfo(gl, bufferInfo, gl.TRIANGLES);
    }


    function getId(id) {
        return [
            ((id >> 0) & 0xFF) / 0xFF,
            ((id >> 8) & 0xFF) / 0xFF,
            ((id >> 16) & 0xFF) / 0xFF,
            ((id >> 24) & 0xFF) / 0xFF,
        ]
    }

    // mouseX and mouseY are in CSS display space relative to canvas
    let mouseX = -1;
    let mouseY = -1;
    let oldPickNdx = -1;
    let onEmpty = false;
    let dragging = false;
    let movingView = false;

    let selectedSquare = null;


    function render() {
        webglUtils.resizeCanvasToDisplaySize(gl.canvas);

        const cameraPosition = getCameraPos();
        const target = [0, 3, 0];
        const up = [0, 1, 0];
        const cameraMatrix = m4.lookAt(cameraPosition, target, up);

        // Make a view matrix from the camera matrix.
        const viewMatrix = m4.inverse(cameraMatrix);


        // Figure out what pixel is under the mouse and setup
        // a frustum to render just that pixel
        {
            // compute the rectangle the near plane of our frustum covers
            const near = 1, far = 2000;
            const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
            const top = Math.tan(degToRad(settings.fov) * 0.5) * near;
            const bottom = -top;
            const left = aspect * bottom;
            const right = aspect * top;
            const width = Math.abs(right - left);
            const height = Math.abs(top - bottom);

            // compute the portion of the near plane covers the 1 pixel
            // under the mouse.
            const pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
            const pixelY = gl.canvas.height - mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;

            const subLeft = left + pixelX * width / gl.canvas.width;
            const subBottom = bottom + pixelY * height / gl.canvas.height;
            const subWidth = width / gl.canvas.width;
            const subHeight = height / gl.canvas.height;

            // make a frustum for that 1 pixel
            const projectionMatrix = m4.frustum(
                subLeft,
                subLeft + subWidth,
                subBottom,
                subBottom + subHeight,
                near,
                far);
            pickingViewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);
        }

        // ------ Draw the objects to the texture --------

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        scacchiera.forEach((/**@type Square*/ square) => {
            let worldMatrix = m4.translate(m4.identity(), square.x, 0, square.z);
            // worldMatrix = m4.multiply(worldMatrix, square.transform);

            drawObject(pickingProgramInfo, squareBufferInfo, {
                u_world: worldMatrix,
                u_id: getId(square.id),
                u_viewProjection: pickingViewProjectionMatrix,
            });

            if (square.skyscraper > 0) {
                let worldMatrix = m4.translate(m4.identity(), square.x, square.skyscraper, square.z);
                worldMatrix = m4.scale(worldMatrix, .9, square.skyscraper, .9);

                drawObject(pickingProgramInfo, grattacieloBufferInfo, {
                    u_world: worldMatrix,
                    u_id: getId(square.id + scacchiera.length),
                    u_viewProjection: pickingViewProjectionMatrix,
                });
            }
        });


        // ------ Read the 1 pixel

        const data = new Uint8Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
        const id = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);

        showMessage(id)

        // restore
        if (oldPickNdx >= 0) {
            if (oldPickNdx <= scacchiera.length) {
                /**@type Square*/const object = scacchiera.filter(s => s.id == oldPickNdx)[0]
                if (object) {
                    object.transform = m4.identity();
                    oldPickNdx = -1;
                }
            } else if (oldPickNdx > scacchiera.length) {
                const object = scacchiera.filter(s => s.id + scacchiera.length == oldPickNdx)[0]
                if (object) {
                    object.transform = m4.identity();
                    oldPickNdx = -1;
                }
            }
        }

        // object under mouse
        if (id > 0 && !movingView) {
            onEmpty = false;
            oldPickNdx = id;
            if (id <= scacchiera.length) { // looking at a square
                /**@type Square*/const object = scacchiera.filter(s => s.id == id)[0]
                if (object) {
                    if (object.skyscraper === 0)
                        object.transform = m4.scale(m4.identity(), .9, 1, .9)

                    if (selectedSquare && !dragging) {
                        object.skyscraper = selectedSquare.skyscraper
                        selectedSquare.skyscraper = 0
                        selectedSquare = null;
                    }
                }
            } else if (id > scacchiera.length) { // looking at a skyscraper
                /**@type Square*/const object = scacchiera.filter(s => s.id + scacchiera.length == id)[0]
                if (object) {
                    object.transform = m4.scale(m4.identity(), .9, 1, .9)

                    if (selectedSquare == null && dragging) {
                        selectedSquare = object;
                    }
                    if (selectedSquare && !dragging) {
                        if (selectedSquare.id !== object.id) {
                            object.skyscraper = selectedSquare.skyscraper
                            selectedSquare.skyscraper = 0
                        }
                        selectedSquare = null;
                    }
                }
            }
        } else {
            onEmpty = true;
            if (!dragging) {
                selectedSquare = null;
            }
        }


        // ------ Draw the objects to the canvas ------

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.clearColor(0.8, 0.8, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const near = 1, far = 2000;
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
        const projectionMatrix =
            m4.perspective(degToRad(settings.fov), aspect, near, far);


        scacchiera.forEach((/** @type Square */ square) => {
            let worldMatrix = m4.translate(m4.identity(), square.x, 0, square.z);
            worldMatrix = m4.multiply(worldMatrix, square.transform);

            drawObject(texturedProgramInfo, squareBufferInfo, {
                u_matrix: computeWorldViewProjection(projectionMatrix, viewMatrix, worldMatrix),
                u_texture: texture,
            });

            if (square.skyscraper > 0) {
                let worldMatrix = m4.translate(m4.identity(), square.x, square.skyscraper, square.z);
                worldMatrix = m4.scale(worldMatrix, .9, square.skyscraper, .9);

                drawObject(solidColorProgramInfo, grattacieloBufferInfo, {
                    u_matrix: computeWorldViewProjection(projectionMatrix, viewMatrix, worldMatrix),
                    u_color: [square.skyscraper / settings.dimScacchiera, .4, square.skyscraper / 3 * settings.dimScacchiera, 1],
                });
            }
        });

        requestAnimationFrame(render);
    }


    let startMousePos;

    function handleMouseMove(e) {
        camera.angleX += -1 / camera.slowness * (startMousePos[0] - e.clientX);
        camera.angleY += 1 / camera.slowness * (startMousePos[1] - e.clientY);
        if (camera.angleX >= 360) {
            camera.angleX = 0
        }
        if (camera.angleX <= -360) {
            camera.angleX = 0
        }
        if (camera.angleY >= 90) {
            camera.angleY = 89.99
        }
        if (camera.angleY <= 0) {
            camera.angleY = 0.01
        }
        startMousePos = [e.clientX, e.clientY];
        // showMessage(`X: ${camera.angleX} / Y: ${camera.angleY}`)
    }

    function handleMouseUp(e) {
        dragging = false;
        movingView = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }

    canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();

        if (onEmpty) {
            window.addEventListener('mousemove', handleMouseMove);
            movingView = true;
        }
        dragging = true;

        window.addEventListener('mouseup', handleMouseUp);

        startMousePos = [e.clientX, e.clientY];
    });

    gl.canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();

        // multiply the wheel movement by the current zoom level
        // so we zoom less when zoomed in and more when zoomed out
        const newZoom = camera.zoom * Math.pow(2, e.deltaY * 0.001);
        camera.zoom = Math.max(0.02, Math.min(100, newZoom));
    });

    requestAnimationFrame(render);
}

function showMessage(errorText) {
    const infoBoxDiv = document.getElementById('info-box');
    const infoSpan = document.createElement('p');
    infoSpan.innerText = errorText;
    infoBoxDiv.replaceChildren(infoSpan)
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

main();