"use strict"

import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { colors, Game } from './grattacieli.js';
import { DragControls } from 'three/addons/controls/DragControls.js';


const numbers = {
    1: { x: 0, y: 4 },
    2: { x: 1, y: 4 },
    3: { x: 2, y: 4 },
    4: { x: 3, y: 4 },
    5: { x: 4, y: 4 },
    6: { x: 0, y: 3 },
    7: { x: 1, y: 3 },
    8: { x: 2, y: 3 },
    9: { x: 3, y: 3 },
}

export async function ThreejsRenderer(/** @type {Game} */ game, gui) {
    $('#three-container').show();


    var settings = {
        spotIntensity: 600,
        ambientIntensity: 45,
    }
    const threeFolder = gui.addFolder('Three');
    threeFolder.add(settings, 'spotIntensity', 0, 1000);
    threeFolder.add(settings, 'ambientIntensity', 0, 100);

    const stats = Stats()
    document.body.appendChild(stats.dom)

    const objLoader = new OBJLoader();
    function loadObj(url) {
        return new Promise((resolve, reject) => {
            objLoader.load(
                url,
                function (object) {
                    console.log("Geometry succesfully loaded")
                    resolve(object);
                },
                function (xhr) {
                    // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                function (error) {
                    console.log('An error happened while loading the model', error);
                    reject();
                }
            );
        });
    }

    const textureLoader = new THREE.TextureLoader();
    function loadTexture(url) {
        return new Promise((resolve, reject) => {
            textureLoader.load(
                url,
                function (object) {
                    resolve(object);
                },
                undefined,
                function (error) {
                    console.log('An error happened while loading the texture', error);
                    reject();
                }
            );
        });
    }

    let skyscrapersModels = {}
    for (let i = 1; i <= game.size; i++) {
        skyscrapersModels[i] = await loadObj(`resources/objects/skyscrapers/${i}.obj`);
    }

    // Add a RENDERER to the document
    const container = $('#three-container');
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(container.innerWidth(), container.innerHeight());
    renderer.setClearColor(0xEEEEEE, 1);
    renderer.shadowMap.enabled = true;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.append(renderer.domElement);

    const canvas = renderer.domElement;

    // SCENE
    const scene = new THREE.Scene();

    // Add AXES helper
    // const axes = new THREE.AxesHelper(20);
    // scene.add(axes);

    const size = 1;
    const cubeGeometry = new THREE.BoxGeometry(size, size / 10, size);
    const planeGeometry = new THREE.PlaneGeometry(size, size);

    const atlas = await loadTexture("resources/images/atlas.png");
    atlas.colorSpace = THREE.SRGBColorSpace;

    function createNumber(n, scale = 0.2) {
        let texture = atlas.clone();
        texture.offset.set(numbers[n].x * scale, numbers[n].y * scale);
        texture.repeat.set(scale, scale);

        let mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.FrontSide });
        let mesh = new THREE.Mesh(planeGeometry, mat);
        mesh.rotation.x = THREE.MathUtils.degToRad(270);

        return mesh;
    }

    function createTile(x, y, scale = 0.2) {
        let texture = atlas.clone();
        texture.offset.set(x * scale, y * scale);
        texture.repeat.set(scale, scale);

        let mat = new THREE.MeshPhongMaterial({ map: texture, transparent: false, toneMapped: false, });
        let mesh = new THREE.Mesh(cubeGeometry, mat);
        mesh.receiveShadow = true;

        return mesh;
    }

    const basicLot = createTile(0, 1);
    const basicObjective = createTile(1, 1);

    let drawnSkyscrapers = []

    function makeSkyscraper(height, lot, transparent = false) {
        let skyscraper = skyscrapersModels[height].clone(true);
        skyscraper.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
                let material = new THREE.MeshPhongMaterial();
                const color = colors[height];
                material.color.setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace);
                material.transparent = true;
                material.opacity = transparent ? 0.5 : 1.0;
                child.material = material;
                child.castShadow = transparent ? false : true;
                child.receiveShadow = transparent ? false : true;;
            }
        });
        skyscraper.position.set(lot.square.x * size / 2, 0, lot.square.z * size / 2);
        
        return skyscraper;
    }

    class Objective {
        constructor(square) {
            this.square = square;
            this.obj = this.loadSquare();
        }

        get n() {
            return this.square.n;
        }

        loadSquare() {
            let tile = basicObjective.clone(true);
            tile.position.set(this.square.x * size / 2, -0.05, this.square.z * size / 2);
            if (this.n > 0) {
                var num = createNumber(this.n);
                num.position.set(this.square.x * size / 2, 0.01, this.square.z * size / 2);
                scene.add(num);
            }
            return tile;
        }
    }

    class Lot {
        constructor(square) {
            this.square = square;
            this.obj = this.loadSquare();
            this.skyscraperObj = null;
            this.ghost = null;

            this.lastDrawn = 0;
        }

        get skyscraper() {
            return this.square.skyscraper;
        }

        set skyscraper(n) {
            this.square.skyscraper = n;
        }

        loadSquare() {
            let tile = basicLot.clone(true);
            tile.position.set(this.square.x * size / 2, -0.05, this.square.z * size / 2);

            return tile;
        }

        prepareSkyscraper() {
            let skyscraper = makeSkyscraper(this.skyscraper, this);
            skyscraper.userData = { lot: this }

            this.lastDrawn = this.skyscraper;

            this.skyscraperObj = skyscraper;
            scene.add(this.skyscraperObj);
            drawnSkyscrapers.push(this.skyscraperObj);
        }

        drawSkyscraper() {
            if (this.skyscraper > 0) {
                if (this.lastDrawn === 0) {
                    this.prepareSkyscraper();
                } else if (this.lastDrawn !== this.skyscraper) {
                    scene.remove(this.skyscraperObj);
                    this.prepareSkyscraper();
                }
            } else {
                if (this.lastDrawn > 0) {
                    scene.remove(this.skyscraperObj);
                    drawnSkyscrapers.splice(drawnSkyscrapers.indexOf(this.skyscraperObj));
                    this.skyscraperObj = null;
                    this.lastDrawn = 0;
                }
            }
        }

        hideSkyscraper() {
            if (this.skyscraperObj) {
                this.skyscraperObj.visible = false;
            }
        }

        showSkyscraper() {
            if (this.skyscraperObj) {
                this.skyscraperObj.visible = true;
            }
        }

        showGhost(n) {
            if (n > 0 && this.ghost === null) {
                this.ghost = makeSkyscraper(n, this, true);
                this.ghost.opacity = 0.5;
                scene.add(this.ghost);
            }
        }

        hideGhost() {
            if (this.ghost != null) {
                scene.remove(this.ghost);
                this.ghost = null;
            }
        }
    }

    /**@type {[Lot]}*/  const board = [];
    for (let square of game.board) {
        const lot = new Lot(square);
        board.push(lot);
        scene.add(lot.obj);
    }

    for (let square of game.numbersAround) {
        const objective = new Objective(square);
        scene.add(objective.obj);
    }


    // CAMERA
    const camera = new THREE.PerspectiveCamera(game.camera.fov, canvas.clientWidth / canvas.clientHeight, game.camera.near, game.camera.far);

    const orbitControls = new OrbitControls(camera, canvas);
    orbitControls.enablePan = false;
    orbitControls.minDistance = game.camera.minZoom;
    orbitControls.maxDistance = game.camera.maxZoom;
    orbitControls.minPolarAngle = THREE.MathUtils.degToRad(0.1);
    orbitControls.maxPolarAngle = THREE.MathUtils.degToRad(89.9);
    orbitControls.rotateSpeed = game.camera.slowness / 10;

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0x404040, settings.ambientIntensity);
    scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 30000);
    spotLight.castShadow = true;
    spotLight.shadow.camera.near = 0.5
    spotLight.shadow.camera.far = 50
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    scene.add(spotLight);

    // ------- DRAG ------- 

    const dragControls = new DragControls([], camera, canvas);
    dragControls.recursive = true;
    dragControls.transformGroup = true;
    dragControls.enabled = true;

    dragControls.addEventListener('hoveron', function (event) {
        event.object.material.emissive.set(0xaaaaaa);
    });

    dragControls.addEventListener('dragstart', function (event) {
        orbitControls.enabled = false;
    });

    dragControls.addEventListener('drag', (event) => {
        event.object.position.y = 0;

        let maxcoordOffset = 1, offsetX = 0, offsetZ = 0;
        if (game.size % 2 === 0) {
            maxcoordOffset = .5;
            if (event.object.position.x > 0) {
                offsetX = +.5;
            } else {
                offsetX = -.5;
            }
            if (event.object.position.z > 0) {
                offsetZ = +.5;
            } else {
                offsetZ = -.5;
            }
        }

        const maxcoord = Math.round((game.size / 2)) - maxcoordOffset;

        let x, z;
        x = Math.round(event.object.position.x) + offsetX;
        if (x > maxcoord) {
            x = maxcoord;
        } else if (x < -maxcoord) {
            x = -maxcoord;
        }
        event.object.position.x = x;

        z = Math.round(event.object.position.z) + offsetZ;
        if (z > maxcoord) {
            z = maxcoord;
        } else if (z < -maxcoord) {
            z = -maxcoord;
        }
        event.object.position.z = z;

        let shouldGhost = 0;
        board.forEach(l => {
            if (l != event.object.userData.lot && x * 2 == Math.round(l.square.x) && z * 2 == Math.round(l.square.z)) {
                if (game.options.swap.value) {
                    shouldGhost = l.skyscraper
                }
                l.hideSkyscraper();
            } else {
                l.hideGhost();
                l.showSkyscraper();
            }
        });
        if (shouldGhost > 0) {
            event.object.userData.lot.showGhost(shouldGhost);
        }
    });

    dragControls.addEventListener('dragend', function (event) {
        let src = event.object.userData.lot;
        let destination = board.find(l => event.object.position.x * 2 == Math.round(l.square.x) && event.object.position.z * 2 == Math.round(l.square.z));
        if (destination && destination != src) {
            let temp = destination.skyscraper;
            destination.skyscraper = src.skyscraper;
            if (game.options.swap.value) {
                src.hideGhost();
                src.skyscraper = temp;
            } else {
                src.skyscraper = 0;
            }
            src.drawSkyscraper();
        }

        orbitControls.enabled = true;
    });

    dragControls.addEventListener('hoveroff', function (event) {
        event.object.material.emissive.set(0x000000);
    });

    // ------- RENDER -------

    $(window).on('resize', function () {
        camera.aspect = container.innerWidth() / container.innerHeight();
        camera.updateProjectionMatrix();
        renderer.setSize(container.innerWidth(), container.innerHeight());
    });


    function animate() {
        orbitControls.update();

        camera.lookAt(new THREE.Vector3(0, game.camera.y / 2, 0));
        camera.updateProjectionMatrix();

        spotLight.position.set(camera.position.x + game.light.x, 20, camera.position.z+ game.light.z);
        spotLight.intensity = settings.spotIntensity;

        ambientLight.intensity = settings.ambientIntensity;

        for (let lot of board) {
            lot.drawSkyscraper();
        }
        dragControls.setObjects(board.filter(l => l.skyscraperObj !== null).map(l => l.skyscraperObj));

        stats.update()

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    animate();
}
