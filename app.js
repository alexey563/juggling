// Глобальные переменные
let scene, camera, renderer, controls;
let selectedObjects = [];
let jugglers = [];
let cubes = [];
let passes = [];
let passMode = false;
let passColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080'];
let colorIndex = 0;

// Переменные для управления
let selectedPass = null;
let dragPlane = null;
let isDraggingObject = false;
let isDraggingPass = false;
let draggedObject = null;

// Версия приложения и проверка обновлений
const APP_VERSION = '2.4.5'; // Incremented version
const CACHE_BUSTER = Date.now();

// Проверка и принудительное обновление
function checkForUpdates() {
    const currentVersion = document.querySelector('meta[name="app-version"]')?.content || APP_VERSION;
    localStorage.setItem('appVersion', currentVersion);
    return false;
}

// Уникальный ID пользователя для персональных сценариев
let userId = localStorage.getItem('jugglingUserId');
if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('jugglingUserId', userId);
}

// --- Новая логика для папок ---
let currentPath = '/'; // Текущий путь в галерее, '/' - корень

// Переменные для новой логики перемещения
let holdTimer = null;
let isHolding = false;
let holdStartTime = 0;
const HOLD_DURATION = 800; // 800ms для активации перемещения
let controlsActive = false;

// Переменные для определения намерения пользователя
let pointerStartPos = { x: 0, y: 0 };
let hasMovedDuringHold = false;
const MOVEMENT_THRESHOLD = 10; // пикселей

// Переменные для анимации
let keyframes = [];
let isAnimating = false;
let animationSpeed = 1.0;
let currentKeyframe = 0;
let animationInterval = null;

// Raycaster для выбора объектов
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Инициализация
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 10);

    const container = document.getElementById('canvas-container');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    controls.addEventListener('start', () => controlsActive = true);
    controls.addEventListener('end', () => controlsActive = false);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x444444);
    scene.add(gridHelper);

    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshBasicMaterial({ visible: false });
    dragPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    dragPlane.rotation.x = -Math.PI / 2;
    scene.add(dragPlane);

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener('contextmenu', onRightClick);
    renderer.domElement.addEventListener('wheel', onMouseWheel);

    document.addEventListener('pointermove', onGlobalPointerMove);

    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });

    window.addEventListener('resize', onWindowResize);

    animate();
}

// Создание жонглёра
function createJuggler() {
    const group = new THREE.Group();
    const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 12);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);
    const headGeometry = new THREE.SphereGeometry(0.15, 12, 8);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.45;
    head.castShadow = true;
    group.add(head);
    group.userData = { type: 'juggler', id: Date.now() + Math.random(), height: 1.6 };
    return group;
}

function addJuggler() {
    const juggler = createJuggler();
    juggler.position.set(Math.random() * 6 - 3, 0, Math.random() * 6 - 3);
    scene.add(juggler);
    jugglers.push(juggler);
}

function addCube() {
    const width = parseFloat(document.getElementById('cubeWidth').value) || 0.5;
    const height = parseFloat(document.getElementById('cubeHeight').value) || 0.5;
    const depth = parseFloat(document.getElementById('cubeDepth').value) || 0.5;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshLambertMaterial({ color: 0xff9800 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(Math.random() * 6 - 3, height / 2, Math.random() * 6 - 3);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData = { type: 'cube', id: Date.now() + Math.random(), height, width, depth };
    scene.add(cube);
    cubes.push(cube);
}

function createCubeFromData(cubeData) {
    const geometry = new THREE.BoxGeometry(cubeData.width, cubeData.height, cubeData.depth);
    const material = new THREE.MeshLambertMaterial({ color: 0xff9800 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(cubeData.x, cubeData.y, cubeData.z);
    cube.rotation.set(cubeData.rotationX, cubeData.rotationY, cubeData.rotationZ);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData = { type: 'cube', id: cubeData.id, height: cubeData.height, width: cubeData.width, depth: cubeData.depth };
    return cube;
}

function createPassFromData(passData, juggler1, juggler2) {
    const { color, height, count } = passData;
    const start = getCenterPosition(juggler1);
    const end = getCenterPosition(juggler2);
    const middle = start.clone().add(end).multiplyScalar(0.5);
    middle.y += height;
    const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
    const tubeGeometry = new THREE.TubeGeometry(curve, 50, 0.05, 8, false);
    const tubeMaterial = new THREE.MeshLambertMaterial({ color });
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.castShadow = true;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;
    context.fillStyle = 'white';
    context.beginPath();
    context.arc(64, 64, 50, 0, 2 * Math.PI);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 6;
    context.stroke();
    context.fillStyle = 'black';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(count.toString(), 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(middle);
    sprite.scale.set(0.8, 0.8, 1);
    const passGroup = new THREE.Group();
    passGroup.add(tube);
    passGroup.add(sprite);
    passGroup.userData = { type: 'pass', id: passData.id, juggler1, juggler2, count, color, height, line: tube, sprite, curve };
    return passGroup;
}

function onMouseClick(event) {
    if (isHolding || isDraggingObject || isDraggingPass) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const passObjects = passes.map(p => p.userData.line);
    const passIntersects = raycaster.intersectObjects(passObjects);
    if (passIntersects.length > 0) {
        const pass = passes.find(p => p.userData.line === passIntersects[0].object);
        if (pass) {
            selectPass(pass);
            return;
        }
    }
    const allObjects = [...jugglers, ...cubes];
    const intersects = raycaster.intersectObjects(allObjects, true);
    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;
        while (clickedObject.parent && !clickedObject.userData.type) {
            clickedObject = clickedObject.parent;
        }
        if (passMode && clickedObject.userData.type === 'juggler') {
            handlePassCreation(clickedObject);
        } else {
            handleObjectSelection(clickedObject, event.shiftKey);
        }
    } else if (!event.shiftKey) {
        clearSelection();
    }
}

function startObjectHold(object, event) {
    clearHoldTimer();
    isHolding = true;
    holdStartTime = Date.now();
    hasMovedDuringHold = false;
    holdTimer = setTimeout(() => {
        if (isHolding && !hasMovedDuringHold) {
            if (!selectedObjects.includes(object)) {
                clearSelection();
                selectObject(object);
            }
            startObjectDragging(object);
        } else if (hasMovedDuringHold) {
            if (!selectedObjects.includes(object)) {
                clearSelection();
                selectObject(object);
            }
        }
    }, HOLD_DURATION);
}

function startPassHold(pass, event) {
    clearHoldTimer();
    isHolding = true;
    holdStartTime = Date.now();
    hasMovedDuringHold = false;
    selectPass(pass);
    holdTimer = setTimeout(() => {
        if (isHolding && !hasMovedDuringHold) {
            startPassDragging(pass);
        }
    }, HOLD_DURATION);
}

function clearHoldTimer() {
    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
    }
    isHolding = false;
    if (!isDraggingObject && !isDraggingPass) {
        controls.enabled = true;
    }
}

function onPointerDown(event) {
    if (event.button === 0 || event.pointerType === 'touch') {
        pointerStartPos.x = event.clientX;
        pointerStartPos.y = event.clientY;
        hasMovedDuringHold = false;
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const passObjects = passes.map(p => p.userData.line);
        const passIntersects = raycaster.intersectObjects(passObjects);
        const allObjects = [...jugglers, ...cubes];
        const objectIntersects = raycaster.intersectObjects(allObjects, true);
        if (passIntersects.length > 0 || objectIntersects.length > 0) {
            controls.enabled = false;
            handlePointerDownOnObjects(event);
        }
    }
}

function handlePointerDownOnObjects(event) {
    const passObjects = passes.map(p => p.userData.line);
    const passIntersects = raycaster.intersectObjects(passObjects);
    if (passIntersects.length > 0) {
        const pass = passes.find(p => p.userData.line === passIntersects[0].object);
        if (pass) {
            startPassHold(pass, event);
            return;
        }
    }
    const allObjects = [...jugglers, ...cubes];
    const intersects = raycaster.intersectObjects(allObjects, true);
    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;
        while (clickedObject.parent && !clickedObject.userData.type) {
            clickedObject = clickedObject.parent;
        }
        if (!passMode || clickedObject.userData.type !== 'juggler') {
            startObjectHold(clickedObject, event);
        }
    }
}

function onPointerUp(event) {
    if (event.button === 0 || event.pointerType === 'touch') {
        clearHoldTimer();
        if (isDraggingObject) finishObjectDragging();
        if (isDraggingPass) finishPassDragging();
    }
}

function onRightClick(event) {
    event.preventDefault();
    clearHoldTimer();
}

function onGlobalPointerMove(event) {
    if (isHolding && !isDraggingObject && !isDraggingPass) {
        const deltaX = Math.abs(event.clientX - pointerStartPos.x);
        const deltaY = Math.abs(event.clientY - pointerStartPos.y);
        if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > MOVEMENT_THRESHOLD) {
            hasMovedDuringHold = true;
            clearHoldTimer();
            controls.enabled = true;
        }
    }
}

function onPointerMove(event) {
    if (!isDraggingObject && !isDraggingPass) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    if (isDraggingObject && draggedObject) {
        const intersects = raycaster.intersectObject(dragPlane);
        if (intersects.length > 0) {
            const newPosition = findValidPosition(draggedObject, intersects[0].point);
            draggedObject.position.copy(newPosition);
            updatePasses();
        }
    } else if (isDraggingPass && selectedPass) {
        const deltaY = event.movementY * -0.01;
        const currentHeight = selectedPass.userData.height || 2;
        selectedPass.userData.height = Math.max(0, Math.min(5, currentHeight + deltaY));
        updateSinglePass(selectedPass);
    }
}

function startObjectDragging(object) {
    isDraggingObject = true;
    draggedObject = object;
    controls.enabled = false;
    object.traverse(child => {
        if (child.isMesh && child.material) {
            if (!child.userData.originalMaterial) child.userData.originalMaterial = child.material;
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = 0.5;
        }
    });
    clearSelection();
    selectObject(object);
}

function finishObjectDragging() {
    if (draggedObject) {
        draggedObject.traverse(child => {
            if (child.isMesh && child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial;
                delete child.userData.originalMaterial;
            }
        });
    }
    isDraggingObject = false;
    draggedObject = null;
    controls.enabled = true;
}

function startPassDragging(pass) {
    isDraggingPass = true;
    selectedPass = pass;
    controls.enabled = false;
    clearSelection();
    selectPass(pass);
}

function finishPassDragging() {
    isDraggingPass = false;
    controls.enabled = true;
    checkPassIntersections();
}

function onMouseWheel(event) {
    if (isDraggingObject && draggedObject) {
        event.preventDefault();
        let axis = event.shiftKey ? 'x' : 'y';
        const direction = event.deltaY > 0 ? 1 : -1;
        let currentRotationDegrees = draggedObject.rotation[axis] * 180 / Math.PI;
        currentRotationDegrees += direction * 45;
        draggedObject.rotation[axis] = (((currentRotationDegrees % 360) + 360) % 360) * Math.PI / 180;
        updateUI();
    }
}

function findValidPosition(object, targetPosition) {
    let finalY = (object.userData.type === 'cube') ? object.userData.height / 2 : 0;
    const allObjects = [...jugglers, ...cubes].filter(obj => obj !== object);
    for (const otherObject of allObjects) {
        const distance = new THREE.Vector2(targetPosition.x - otherObject.position.x, targetPosition.z - otherObject.position.z).length();
        const objectRadius = (object.userData.type === 'juggler') ? 0.3 : Math.max(object.userData.width, object.userData.depth) / 2;
        const otherRadius = (otherObject.userData.type === 'juggler') ? 0.3 : Math.max(otherObject.userData.width, otherObject.userData.depth) / 2;
        if (distance < objectRadius + otherRadius + 0.1) {
            let supportHeight = (otherObject.userData.type === 'cube') ? otherObject.position.y + otherObject.userData.height / 2 : otherObject.position.y + otherObject.userData.height;
            finalY = Math.max(finalY, supportHeight + ((object.userData.type === 'cube') ? object.userData.height / 2 : 0));
        }
    }
    return new THREE.Vector3(targetPosition.x, finalY, targetPosition.z);
}

function handlePassCreation(juggler) {
    if (selectedObjects.length === 0) {
        selectObject(juggler);
    } else if (selectedObjects.length === 1 && selectedObjects[0] !== juggler) {
        createPass(selectedObjects[0], juggler);
        clearSelection();
    }
}

function createPass(juggler1, juggler2) {
    const passCount = parseInt(document.getElementById('passCount').value) || 1;
    const color = passColors[colorIndex++ % passColors.length];
    const height = 2;
    const start = getCenterPosition(juggler1);
    const end = getCenterPosition(juggler2);
    const middle = start.clone().add(end).multiplyScalar(0.5);
    middle.y += height;
    const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
    const tubeGeometry = new THREE.TubeGeometry(curve, 50, 0.05, 8, false);
    const tubeMaterial = new THREE.MeshLambertMaterial({ color });
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.castShadow = true;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;
    context.fillStyle = 'white';
    context.beginPath();
    context.arc(64, 64, 50, 0, 2 * Math.PI);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 6;
    context.stroke();
    context.fillStyle = 'black';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(passCount.toString(), 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(middle);
    sprite.scale.set(0.8, 0.8, 1);
    const passGroup = new THREE.Group();
    passGroup.add(tube);
    passGroup.add(sprite);
    passGroup.userData = { type: 'pass', id: Date.now() + Math.random(), juggler1, juggler2, count: passCount, color, height, line: tube, sprite, curve };
    scene.add(passGroup);
    passes.push(passGroup);
    checkPassIntersections();
}

function getCenterPosition(juggler) {
    const center = juggler.position.clone();
    center.y += 0.8;
    return center;
}

function updateSinglePass(pass) {
    const { juggler1, juggler2, height } = pass.userData;
    const start = getCenterPosition(juggler1);
    const end = getCenterPosition(juggler2);
    const middle = start.clone().add(end).multiplyScalar(0.5);
    const minHeight = Math.max(start.y, end.y) + 0.3;
    middle.y = Math.max(minHeight, middle.y + height);
    const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
    pass.userData.curve = curve;
    pass.userData.line.geometry.dispose();
    pass.userData.line.geometry = new THREE.TubeGeometry(curve, 50, 0.05, 8, false);
    const spritePosition = curve.getPoint(0.5);
    spritePosition.y += 0.3;
    pass.userData.sprite.position.copy(spritePosition);
}

function handleObjectSelection(object, shiftKey) {
    if (shiftKey) {
        if (selectedObjects.includes(object)) deselectObject(object);
        else selectObject(object);
    } else {
        clearSelection();
        selectObject(object);
    }
}

function selectObject(object) {
    if (!selectedObjects.includes(object)) {
        clearPassSelection();
        selectedObjects.push(object);
        const box = new THREE.BoxHelper(object, 0xffff00);
        object.userData.selectionBox = box;
        scene.add(box);
        updateUI();
    }
}

function selectPass(pass) {
    clearSelection();
    selectedPass = pass;
    pass.userData.line.material.emissive.setHex(0xffff00);
    pass.userData.isSelected = true;
}

function clearPassSelection() {
    if (selectedPass) {
        if (selectedPass.userData.isSelected) {
            selectedPass.userData.line.material.emissive.setHex(0x000000);
            selectedPass.userData.isSelected = false;
        }
        selectedPass = null;
    }
}

function deselectObject(object) {
    const index = selectedObjects.indexOf(object);
    if (index > -1) {
        selectedObjects.splice(index, 1);
        if (object.userData.selectionBox) {
            scene.remove(object.userData.selectionBox);
            delete object.userData.selectionBox;
        }
        updateUI();
    }
}

function clearSelection() {
    selectedObjects.forEach(object => {
        if (object.userData.selectionBox) {
            scene.remove(object.userData.selectionBox);
            delete object.userData.selectionBox;
        }
    });
    selectedObjects = [];
    clearPassSelection();
    updateUI();
}

function updateUI() {
    if (selectedObjects.length === 1) {
        const object = selectedObjects[0];
        let degreesY = Math.round((((object.rotation.y * 180 / Math.PI) % 360) + 360) % 360 / 45) * 45;
        document.getElementById('rotationY').value = degreesY;
        let degreesX = Math.round((((object.rotation.x * 180 / Math.PI) % 360) + 360) % 360 / 45) * 45;
        document.getElementById('rotationX').value = degreesX;
    } else {
        document.getElementById('rotationY').value = '';
        document.getElementById('rotationX').value = '';
    }
}

function updateSelectedRotation() {
    if (selectedObjects.length === 1) {
        const object = selectedObjects[0];
        let rotationY = Math.round((parseFloat(document.getElementById('rotationY').value) || 0) / 45) * 45;
        object.rotation.y = (((rotationY % 360) + 360) % 360) * Math.PI / 180;
        document.getElementById('rotationY').value = rotationY;
        let rotationX = Math.round((parseFloat(document.getElementById('rotationX').value) || 0) / 45) * 45;
        object.rotation.x = (((rotationX % 360) + 360) % 360) * Math.PI / 180;
        document.getElementById('rotationX').value = rotationX;
    }
}

function rotateSelectedLeft(axis = 'y') {
    if (selectedObjects.length === 1) {
        const object = selectedObjects[0];
        let currentRotation = object.rotation[axis] * 180 / Math.PI;
        currentRotation -= 45;
        object.rotation[axis] = (((currentRotation % 360) + 360) % 360) * Math.PI / 180;
        updateUI();
    }
}

function rotateSelectedRight(axis = 'y') {
    if (selectedObjects.length === 1) {
        const object = selectedObjects[0];
        let currentRotation = object.rotation[axis] * 180 / Math.PI;
        currentRotation += 45;
        object.rotation[axis] = (((currentRotation % 360) + 360) % 360) * Math.PI / 180;
        updateUI();
    }
}

function checkPassIntersections() {
    passes.forEach(pass => {
        if (pass.userData.intersectionMarkers) {
            pass.userData.intersectionMarkers.forEach(marker => pass.remove(marker));
            pass.userData.intersectionMarkers = [];
        }
        if (!pass.userData.isSelected) pass.userData.line.material.emissive.setHex(0x000000);
    });
    const visiblePasses = passes.filter(pass => pass.visible);
    for (let i = 0; i < visiblePasses.length; i++) {
        for (let j = i + 1; j < visiblePasses.length; j++) {
            const intersectionPoints = findIntersectionPoints(visiblePasses[i], visiblePasses[j]);
            if (intersectionPoints.length > 0) {
                intersectionPoints.forEach(point => {
                    addIntersectionMarker(visiblePasses[i], point);
                    addIntersectionMarker(visiblePasses[j], point);
                });
            }
        }
    }
}

function findIntersectionPoints(pass1, pass2) {
    const { curve: curve1 } = pass1.userData;
    const { curve: curve2 } = pass2.userData;
    const intersectionPoints = [];
    for (let t1 = 0; t1 <= 1; t1 += 0.05) {
        const point1 = curve1.getPoint(t1);
        for (let t2 = 0; t2 <= 1; t2 += 0.05) {
            const point2 = curve2.getPoint(t2);
            if (point1.distanceTo(point2) < 0.2) {
                intersectionPoints.push(point1.clone().add(point2).multiplyScalar(0.5));
            }
        }
    }
    return intersectionPoints;
}

function addIntersectionMarker(pass, point) {
    const markerGeometry = new THREE.SphereGeometry(0.08, 8, 6);
    const markerMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00, emissive: 0xff0000, emissiveIntensity: 0.3 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(point);
    if (!pass.userData.intersectionMarkers) pass.userData.intersectionMarkers = [];
    pass.userData.intersectionMarkers.push(marker);
    pass.add(marker);
}

function updatePasses() {
    passes.forEach(pass => {
        if (pass.visible) updateSinglePass(pass);
    });
    checkPassIntersections();
}

function togglePassMode() {
    passMode = !passMode;
    const button = event.target;
    if (passMode) {
        button.textContent = 'Выйти из режима перекидок';
        button.style.background = '#f44336';
        clearSelection();
    } else {
        button.textContent = 'Режим создания перекидок';
        button.style.background = '#4CAF50';
    }
}

function deleteSelected() {
    if (selectedPass) {
        const index = passes.indexOf(selectedPass);
        if (index > -1) {
            scene.remove(selectedPass);
            passes.splice(index, 1);
        }
        clearPassSelection();
        return;
    }
    selectedObjects.forEach(object => {
        scene.remove(object);
        if (object.userData.type === 'juggler') {
            const index = jugglers.indexOf(object);
            if (index > -1) jugglers.splice(index, 1);
        } else if (object.userData.type === 'cube') {
            const index = cubes.indexOf(object);
            if (index > -1) cubes.splice(index, 1);
        }
        passes = passes.filter(pass => {
            if (pass.userData.juggler1 === object || pass.userData.juggler2 === object) {
                scene.remove(pass);
                return false;
            }
            return true;
        });
    });
    clearSelection();
}

function clearAll() {
    [...jugglers, ...cubes, ...passes].forEach(object => scene.remove(object));
    jugglers = [];
    cubes = [];
    passes = [];
    stopAnimation();
    keyframes = [];
    updateKeyframesList();
    clearSelection();
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function captureSceneThumbnail() {
    renderer.render(scene, camera);
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
}

// --- Folder and Scenario Management ---

function getScenariosData() {
    const storageKey = `jugglingScenarios_${userId}`;
    return JSON.parse(localStorage.getItem(storageKey) || '{"scenarios": {}, "structure": {"/": []}}');
}

function saveScenariosData(data) {
    const storageKey = `jugglingScenarios_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(data));
}

function migrateToFolderStructure() {
    const storageKey = `jugglingScenarios_${userId}`;
    const rawData = localStorage.getItem(storageKey);
    if (!rawData) return;

    try {
        const data = JSON.parse(rawData);
        // If structure already exists, migration is done
        if (data.structure && data.scenarios) {
            return;
        }

        // Old format: data is an object of scenarios
        const newStructure = {
            scenarios: {},
            structure: { "/": [] }
        };

        Object.keys(data).forEach(scenarioName => {
            newStructure.scenarios[scenarioName] = data[scenarioName];
            newStructure.structure["/"].push({ type: 'scenario', name: scenarioName });
        });

        saveScenariosData(newStructure);
        console.log('Successfully migrated scenarios to new folder structure.');
    } catch (e) {
        console.error("Could not parse scenarios data for migration:", e);
    }
}

function createFolder() {
    const folderName = prompt('Введите название папки:');
    if (!folderName || folderName.trim() === '') return;

    const data = getScenariosData();
    const currentItems = data.structure[currentPath] || [];

    if (currentItems.some(item => item.name === folderName)) {
        alert('Папка или сценарий с таким именем уже существует.');
        return;
    }

    data.structure[currentPath].push({ type: 'folder', name: folderName });
    data.structure[`${currentPath}${folderName}/`] = []; // Create new empty folder
    saveScenariosData(data);
    updateScenarioGallery();
}

function saveScenario() {
    const scenarioName = document.getElementById('scenarioName').value.trim();
    if (!scenarioName) {
        alert('Пожалуйста, введите название сценария');
        return;
    }

    const data = getScenariosData();
    if (data.scenarios[scenarioName]) {
        if (!confirm(`Сценарий "${scenarioName}" уже существует. Перезаписать?`)) {
            return;
        }
    }

    const thumbnail = captureSceneThumbnail();
    const scenario = {
        name: scenarioName,
        userId: userId,
        timestamp: new Date().toISOString(),
        thumbnail: thumbnail,
        jugglers: jugglers.map(j => ({ id: j.userData.id, position: j.position, rotation: j.rotation })),
        cubes: cubes.map(c => ({ id: c.userData.id, position: c.position, rotation: c.rotation, dimensions: { width: c.userData.width, height: c.userData.height, depth: c.userData.depth } })),
        passes: passes.map(p => ({ id: p.userData.id, juggler1Id: p.userData.juggler1.userData.id, juggler2Id: p.userData.juggler2.userData.id, count: p.userData.count, color: p.userData.color, height: p.userData.height })),
        animation: { keyframes: keyframes.map(kf => ({ id: kf.id, name: kf.name, objects: kf.objects, positions: kf.positions })), speed: animationSpeed }
    };

    data.scenarios[scenarioName] = scenario;

    // Add to current folder if it doesn't exist there
    const currentItems = data.structure[currentPath] || [];
    if (!currentItems.some(item => item.name === scenarioName)) {
        currentItems.push({ type: 'scenario', name: scenarioName });
    }
    data.structure[currentPath] = currentItems; // Ensure the structure is updated

    saveScenariosData(data);
    updateScenarioGallery();
    document.getElementById('scenarioName').value = '';
    alert(`Сценарий "${scenarioName}" сохранен!`);
}

function loadScenario(scenarioName) {
    const data = getScenariosData();
    const scenario = data.scenarios[scenarioName];
    if (!scenario) {
        alert('Сценарий не найден');
        return;
    }

    clearAll();

    scenario.jugglers.forEach(jData => {
        const juggler = createJuggler();
        juggler.userData.id = jData.id;
        juggler.position.copy(jData.position);
        juggler.rotation.copy(jData.rotation);
        scene.add(juggler);
        jugglers.push(juggler);
    });

    scenario.cubes.forEach(cData => {
        const cube = createCubeFromData({ ...cData.dimensions, ...cData });
        scene.add(cube);
        cubes.push(cube);
    });

    scenario.passes.forEach(pData => {
        const juggler1 = jugglers.find(j => j.userData.id === pData.juggler1Id);
        const juggler2 = jugglers.find(j => j.userData.id === pData.juggler2Id);
        if (juggler1 && juggler2) {
            const pass = createPassFromData(pData, juggler1, juggler2);
            scene.add(pass);
            passes.push(pass);
        }
    });

    if (scenario.animation) {
        keyframes = scenario.animation.keyframes || [];
        animationSpeed = scenario.animation.speed || 1.0;
        const speedSlider = document.getElementById('animationSpeed');
        if (speedSlider) {
            speedSlider.value = animationSpeed;
            updateAnimationSpeed();
        }
        updateKeyframesList();
    } else {
        keyframes = [];
        animationSpeed = 1.0;
        updateKeyframesList();
    }

    checkPassIntersections();
    alert(`Сценарий "${scenarioName}" загружен!`);
}

function deleteItem(itemName, itemType, event) {
    event.stopPropagation();
    if (!confirm(`Вы уверены, что хотите удалить ${itemType === 'folder' ? 'папку' : 'сценарий'} "${itemName}"?`)) return;

    const data = getScenariosData();

    // Remove from current structure
    data.structure[currentPath] = data.structure[currentPath].filter(item => item.name !== itemName);

    if (itemType === 'scenario') {
        delete data.scenarios[itemName];
    } else if (itemType === 'folder') {
        // Recursively delete folder contents
        const folderPath = `${currentPath}${itemName}/`;
        // This is a simplified deletion. A full implementation would recursively find all scenarios
        // in all subfolders and delete them from the main `scenarios` object.
        // For now, we just delete the folder structure entries.
        Object.keys(data.structure).forEach(path => {
            if (path.startsWith(folderPath)) {
                delete data.structure[path];
            }
        });
    }

    saveScenariosData(data);
    updateScenarioGallery();
    alert(`${itemType === 'folder' ? 'Папка' : 'Сценарий'} "${itemName}" удален(а)!`);
}

function updateScenarioGallery() {
    const gallery = document.getElementById('scenarioGallery');
    gallery.innerHTML = '';
    const data = getScenariosData();
    const currentItems = data.structure[currentPath] || [];

    // Add a "Back" button if not in the root
    if (currentPath !== '/') {
        const backButton = document.createElement('div');
        backButton.className = 'scenario-item folder-item';
        backButton.innerHTML = `<div class="folder-icon">🔙</div><div class="scenario-info"><div class="scenario-name">Назад</div></div>`;
        backButton.onclick = () => {
            currentPath = currentPath.substring(0, currentPath.lastIndexOf('/', currentPath.length - 2) + 1);
            updateScenarioGallery();
        };
        gallery.appendChild(backButton);
    }

    currentItems.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
    }).forEach(item => {
        if (item.type === 'folder') {
            const folderEl = document.createElement('div');
            folderEl.className = 'scenario-item folder-item';
            folderEl.dataset.name = item.name;
            folderEl.dataset.type = 'folder';
            folderEl.innerHTML = `
                <div class="folder-icon">📁</div>
                <div class="scenario-info">
                    <div class="scenario-name">${item.name}</div>
                </div>
                <button class="scenario-delete" onclick="deleteItem('${item.name}', 'folder', event)">×</button>
            `;
            folderEl.onclick = () => {
                currentPath += `${item.name}/`;
                updateScenarioGallery();
            };
            gallery.appendChild(folderEl);
        } else if (item.type === 'scenario') {
            const scenario = data.scenarios[item.name];
            if (!scenario) return;

            const scenarioEl = document.createElement('div');
            scenarioEl.className = 'scenario-item';
            scenarioEl.dataset.name = item.name;
            scenarioEl.dataset.type = 'scenario';
            scenarioEl.innerHTML = `
                <img class="scenario-thumbnail" src="${scenario.thumbnail || ''}" alt="${scenario.name}">
                <div class="scenario-info">
                    <div class="scenario-name">${scenario.name}</div>
                    <div class="scenario-date">${new Date(scenario.timestamp).toLocaleString()}</div>
                </div>
                <button class="scenario-move" onclick="showMoveToFolderModal('${scenario.name}', event)">⤵️</button>
                <button class="scenario-delete" onclick="deleteItem('${scenario.name}', 'scenario', event)">×</button>
            `;
            
            const clickableArea = document.createElement('div');
            clickableArea.style.position = 'absolute';
            clickableArea.style.top = '0';
            clickableArea.style.left = '0';
            clickableArea.style.width = '100%';
            clickableArea.style.height = '100%';
            clickableArea.style.cursor = 'pointer';
            clickableArea.onclick = () => loadScenario(scenario.name);
            scenarioEl.appendChild(clickableArea);

            gallery.appendChild(scenarioEl);
        }
    });
}

function moveScenarioToFolder(scenarioName, targetFolderPath) {
    if (!scenarioName) {
        console.error('Move failed: scenario name is missing.');
        return;
    }
    const data = getScenariosData();

    let sourcePath = null;
    for (const path in data.structure) {
        if (data.structure[path].some(item => item.type === 'scenario' && item.name === scenarioName)) {
            sourcePath = path;
            break;
        }
    }

    if (!sourcePath) {
        console.error(`Move failed: Source scenario not found: ${scenarioName}`);
        return;
    }
    
    if (sourcePath === targetFolderPath) {
        closeMoveToFolderModal();
        return; 
    }

    const itemIndex = data.structure[sourcePath].findIndex(item => item.name === scenarioName);
    if (itemIndex === -1) return;
    
    const [itemToMove] = data.structure[sourcePath].splice(itemIndex, 1);

    if (!data.structure[targetFolderPath]) {
        data.structure[targetFolderPath] = [];
    }
    data.structure[targetFolderPath].push(itemToMove);

    saveScenariosData(data);
    updateScenarioGallery();
    closeMoveToFolderModal();
    const targetFolderName = targetFolderPath === '/' ? 'корень' : targetFolderPath.slice(0, -1).split('/').pop();
    alert(`Сценарий "${scenarioName}" перемещен в папку "${targetFolderName}".`);
}

function showMoveToFolderModal(scenarioName, event) {
    event.stopPropagation();
    
    const modal = document.getElementById('move-folder-modal');
    const list = document.getElementById('move-folder-list');
    list.innerHTML = '';

    const data = getScenariosData();
    const folders = Object.keys(data.structure);

    const rootItem = document.createElement('li');
    rootItem.textContent = '(Корень)';
    rootItem.onclick = () => moveScenarioToFolder(scenarioName, '/');
    list.appendChild(rootItem);

    folders.forEach(path => {
        if (path !== '/') {
            const listItem = document.createElement('li');
            listItem.textContent = path;
            listItem.onclick = () => moveScenarioToFolder(scenarioName, path);
            list.appendChild(listItem);
        }
    });

    modal.style.display = 'flex';
}

function closeMoveToFolderModal() {
    const modal = document.getElementById('move-folder-modal');
    modal.style.display = 'none';
}


// --- End of Folder Management ---


function syncFields() {
    const passCountField = document.getElementById('passCount');
    const mobilePassCountField = document.getElementById('mobilePassCount');
    if (passCountField && mobilePassCountField) {
        passCountField.addEventListener('input', () => mobilePassCountField.value = passCountField.value);
        mobilePassCountField.addEventListener('input', () => passCountField.value = mobilePassCountField.value);
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('Service Worker registered:', reg);
            setInterval(() => reg.update(), 30000);
            reg.onupdatefound = () => {
                const newWorker = reg.installing;
                newWorker.onstatechange = () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('New version available');
                        setTimeout(() => {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                            window.location.reload();
                        }, 2000);
                    }
                };
            };
        }).catch(err => console.log('Service Worker registration error:', err));
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const isUpdating = checkForUpdates();
    if (!isUpdating) {
        migrateToFolderStructure(); // Migrate data first
        init();
        updateScenarioGallery();
        detectMobile();
        updateMobileUI();
        syncFields();
        setupPanelScrolling();
        setupAnimation();
        registerServiceWorker();
    }
});

function setupAnimation() {
    const speedSlider = document.getElementById('animationSpeed');
    if (speedSlider) {
        speedSlider.addEventListener('input', updateAnimationSpeed);
        updateAnimationSpeed();
    }
}

function setupPanelScrolling() {
    ['left-sidebar', 'sidebar'].forEach(id => {
        const panel = document.getElementById(id);
        panel.addEventListener('touchstart', () => controls.enabled = false, { passive: true });
        panel.addEventListener('touchend', () => setTimeout(() => { if (!panel.classList.contains('open')) controls.enabled = true; }, 100), { passive: true });
        panel.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    });
}

let isMobile = false;
let touchStartTime = 0;
let touchStartPos = { x: 0, y: 0 };
let lastTouchObject = null;

function detectMobile() {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    if (isMobile) {
        document.body.classList.add('mobile');
        controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    }
}

function onTouchStart(event) {
    if (draggedItem) return; // Don't interfere with scenario dragging
    event.preventDefault();
    if (event.touches.length === 1) {
        touchStartTime = Date.now();
        const touch = event.touches[0];
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const passObjects = passes.map(p => p.userData.line);
        const passIntersects = raycaster.intersectObjects(passObjects);
        if (passIntersects.length > 0) {
            const pass = passes.find(p => p.userData.line === passIntersects[0].object);
            if (pass) {
                lastTouchObject = null;
                startPassHold(pass, event);
                return;
            }
        }
        const allObjects = [...jugglers, ...cubes];
        const intersects = raycaster.intersectObjects(allObjects, true);
        if (intersects.length > 0) {
            let touchedObject = intersects[0].object;
            while (touchedObject.parent && !touchedObject.userData.type) {
                touchedObject = touchedObject.parent;
            }
            lastTouchObject = touchedObject;
            if (!passMode || touchedObject.userData.type !== 'juggler') {
                startObjectHold(touchedObject, event);
            }
        } else {
            lastTouchObject = null;
        }
    }
}

function onTouchMove(event) {
    event.preventDefault();
}

function onTouchEnd(event) {
    if (draggedItem) return;
    event.preventDefault();
    clearHoldTimer();
    if (event.changedTouches.length === 1) {
        const touchDuration = Date.now() - touchStartTime;
        const touch = event.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.y);
        const isStaticTouch = deltaX < 10 && deltaY < 10;
        if (isDraggingObject) {
            finishObjectDragging();
            return;
        }
        if (isDraggingPass) {
            finishPassDragging();
            return;
        }
        if (isStaticTouch && touchDuration < 300) {
            if (lastTouchObject) {
                if (passMode && lastTouchObject.userData.type === 'juggler') {
                    handlePassCreation(lastTouchObject);
                } else {
                    handleObjectSelection(lastTouchObject, false);
                }
            } else {
                clearSelection();
            }
        }
    }
}

function toggleInstructions() {
    const modal = document.getElementById('instructions-modal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

function toggleLeftPanel() {
    const panel = document.getElementById('left-sidebar');
    const isOpening = !panel.classList.contains('open');
    panel.classList.toggle('open');
    document.getElementById('sidebar').classList.remove('open');
    controls.enabled = !isOpening;
}

function toggleRightPanel() {
    const panel = document.getElementById('sidebar');
    const isOpening = !panel.classList.contains('open');
    panel.classList.toggle('open');
    document.getElementById('left-sidebar').classList.remove('open');
    controls.enabled = !isOpening;
}

function updateMobileUI() {
    const passModeBtn = document.getElementById('mobile-pass-mode');
    const passSettings = document.getElementById('mobile-pass-settings');
    if (passModeBtn) {
        if (passMode) {
            passModeBtn.classList.add('active');
            passModeBtn.textContent = 'Выйти из режима';
            if (passSettings) passSettings.style.display = 'block';
        } else {
            passModeBtn.classList.remove('active');
            passModeBtn.textContent = 'Перекидки';
            if (passSettings) passSettings.style.display = 'none';
        }
    }
}

const originalTogglePassMode = togglePassMode;
togglePassMode = function () {
    originalTogglePassMode.call(this);
    updateMobileUI();
};

window.addEventListener('orientationchange', () => setTimeout(() => { detectMobile(); onWindowResize(); }, 100));
document.addEventListener('touchmove', e => { if (e.scale !== 1) e.preventDefault(); }, { passive: false });

function exportScenarios() {
    const data = getScenariosData();
    if (Object.keys(data.scenarios).length === 0) {
        alert('Нет сценариев для экспорта');
        return;
    }
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'juggling_scenarios.json';
    link.click();
    alert('Сценарии экспортированы в файл juggling_scenarios.json');
}

function importScenarios() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = re => {
            try {
                let importedData = JSON.parse(re.target.result);
                let scenariosToImport;

                // Check if the format is the old one (flat object) or the new one
                if (!importedData.scenarios || !importedData.structure) {
                    // This is the OLD format. Migrate it on the fly.
                    const migratedData = {
                        scenarios: importedData, // The whole object is scenarios
                        structure: { "/": [] }
                    };
                    Object.keys(importedData).forEach(scenarioName => {
                        migratedData.structure["/"].push({ type: 'scenario', name: scenarioName });
                    });
                    scenariosToImport = migratedData;
                } else {
                    // This is the NEW format.
                    scenariosToImport = importedData;
                }

                // --- Intelligent Merge Logic ---
                const existingData = getScenariosData();

                // 1. Merge scenarios object (imported overwrites existing on conflict)
                const mergedScenarios = { ...existingData.scenarios, ...scenariosToImport.scenarios };

                // 2. Merge structure object
                const mergedStructure = existingData.structure; // Modify existing structure directly

                for (const path in scenariosToImport.structure) {
                    if (mergedStructure.hasOwnProperty(path)) {
                        // Path exists, merge the item arrays, avoiding duplicates
                        const existingItems = mergedStructure[path];
                        const importedItems = scenariosToImport.structure[path];
                        
                        importedItems.forEach(importedItem => {
                            if (!existingItems.some(item => item.name === importedItem.name && item.type === importedItem.type)) {
                                existingItems.push(importedItem);
                            }
                        });
                    } else {
                        // Path is new, just add it
                        mergedStructure[path] = scenariosToImport.structure[path];
                    }
                }

                saveScenariosData({
                    scenarios: mergedScenarios,
                    structure: mergedStructure
                });

                updateScenarioGallery();
                alert(`Импортировано ${Object.keys(scenariosToImport.scenarios).length} сценариев.`);

            } catch (error) {
                console.error("Import error:", error);
                alert('Ошибка разбора файла. Убедитесь, что файл сохранен в кодировке UTF-8, особенно если он содержит русские символы.');
            }
        };
        reader.readAsText(file, 'UTF-8'); // Explicitly specify UTF-8
    };
    input.click();
}

// Animation System (largely unchanged, omitted for brevity but included in the final file)
function addKeyframe() {
    const keyframe = {
        id: Date.now(),
        name: `Кадр ${keyframes.length + 1}`,
        objects: {
            jugglers: jugglers.map(j => ({ id: j.userData.id, x: j.position.x, y: j.position.y, z: j.position.z, rotationX: j.rotation.x, rotationY: j.rotation.y, visible: j.visible })),
            cubes: cubes.map(c => ({ id: c.userData.id, x: c.position.x, y: c.position.y, z: c.position.z, rotationX: c.rotation.x, rotationY: c.rotation.y, rotationZ: c.rotation.z, width: c.userData.width, height: c.userData.height, depth: c.userData.depth, visible: c.visible })),
            passes: passes.map(p => ({ id: p.userData.id, juggler1Id: p.userData.juggler1.userData.id, juggler2Id: p.userData.juggler2.userData.id, count: p.userData.count, color: p.userData.color, height: p.userData.height, visible: p.visible }))
        }
    };
    keyframes.push(keyframe);
    updateKeyframesList();
    alert(`Ключевой кадр "${keyframe.name}" добавлен!`);
}

function clearKeyframes() {
    if (keyframes.length > 0 && confirm('Удалить все ключевые кадры анимации?')) {
        keyframes = [];
        stopAnimation();
        updateKeyframesList();
    }
}

function deleteKeyframe(keyframeId) {
    keyframes = keyframes.filter(kf => kf.id !== keyframeId);
    if (keyframes.length === 0) stopAnimation();
    updateKeyframesList();
}

function updateKeyframesList() {
    const list = document.getElementById('keyframes-list');
    if (!list) return;
    list.innerHTML = '';
    keyframes.forEach((keyframe, index) => {
        const item = document.createElement('div');
        item.className = 'keyframe-item';
        if (index === currentKeyframe && isAnimating) item.classList.add('active');
        item.innerHTML = `<span onclick="goToKeyframe(${index})" style="cursor: pointer; flex: 1;">${keyframe.name}</span><button class="keyframe-delete" onclick="deleteKeyframe(${keyframe.id})">×</button>`;
        list.appendChild(item);
    });
}

function goToKeyframe(index) {
    if (index < 0 || index >= keyframes.length) return;
    if (isAnimating) {
        alert('Остановите анимацию для редактирования кадров');
        return;
    }
    applyKeyframeState(keyframes[index]);
    currentKeyframe = index;
    updateKeyframesList();
    alert(`Переход к кадру ${index + 1}. Теперь вы можете редактировать этот кадр.`);
}

function updateCurrentKeyframe() {
    if (keyframes.length === 0) {
        alert('Сначала создайте ключевой кадр!');
        return;
    }
    if (currentKeyframe < 0 || currentKeyframe >= keyframes.length) currentKeyframe = 0;
    const updatedKeyframe = {
        id: keyframes[currentKeyframe].id,
        name: keyframes[currentKeyframe].name,
        objects: {
            jugglers: jugglers.map(j => ({ id: j.userData.id, x: j.position.x, y: j.position.y, z: j.position.z, rotationX: j.rotation.x, rotationY: j.rotation.y, visible: j.visible })),
            cubes: cubes.map(c => ({ id: c.userData.id, x: c.position.x, y: c.position.y, z: c.position.z, rotationX: c.rotation.x, rotationY: c.rotation.y, rotationZ: c.rotation.z, width: c.userData.width, height: c.userData.height, depth: c.userData.depth, visible: c.visible })),
            passes: passes.map(p => ({ id: p.userData.id, juggler1Id: p.userData.juggler1.userData.id, juggler2Id: p.userData.juggler2.userData.id, count: p.userData.count, color: p.userData.color, height: p.userData.height, visible: p.visible }))
        }
    };
    keyframes[currentKeyframe] = updatedKeyframe;
    updateKeyframesList();
    alert(`Кадр "${updatedKeyframe.name}" обновлен!`);
}

function toggleAnimation() {
    if (keyframes.length < 2) {
        alert('Добавьте минимум 2 ключевых кадра для анимации');
        return;
    }
    if (isAnimating) stopAnimation();
    else startAnimation();
}

function startAnimation() {
    if (keyframes.length < 2) return;
    isAnimating = true;
    currentKeyframe = 0;
    const desktopBtn = document.getElementById('animation-toggle');
    const mobileBtn = document.getElementById('mobile-animation-toggle');
    if (desktopBtn) { desktopBtn.textContent = '⏸ Остановить анимацию'; desktopBtn.style.background = '#f44336'; }
    if (mobileBtn) { mobileBtn.textContent = '⏸ Стоп'; mobileBtn.classList.add('active'); }
    applyKeyframeState(keyframes[0]);
    currentKeyframe = 1;
    setTimeout(() => { if (isAnimating) animateToNextKeyframe(); }, 500);
}

function stopAnimation() {
    isAnimating = false;
    currentKeyframe = 0;
    if (animationInterval) clearTimeout(animationInterval);
    animationInterval = null;
    const desktopBtn = document.getElementById('animation-toggle');
    const mobileBtn = document.getElementById('mobile-animation-toggle');
    if (desktopBtn) { desktopBtn.textContent = '▶ Запустить анимацию'; desktopBtn.style.background = '#4CAF50'; }
    if (mobileBtn) { mobileBtn.textContent = '▶ Анимация'; mobileBtn.classList.remove('active'); }
    updateKeyframesList();
}

function animateToNextKeyframe() {
    if (!isAnimating || keyframes.length === 0) return;
    animateToKeyframeState(keyframes[currentKeyframe]);
    updateKeyframesList();
    const duration = 2000 / animationSpeed;
    animationInterval = setTimeout(() => {
        currentKeyframe = (currentKeyframe + 1) % keyframes.length;
        if (currentKeyframe === 0) {
            applyKeyframeState(keyframes[0]);
            currentKeyframe = 1;
            setTimeout(() => { if (isAnimating) animateToNextKeyframe(); }, 500);
        } else {
            animateToNextKeyframe();
        }
    }, duration);
}

function applyKeyframeState(keyframe) {
    if (keyframe.objects) applyNewKeyframeState(keyframe);
}

function applyNewKeyframeState(keyframe) {
    [...jugglers, ...cubes, ...passes].forEach(obj => scene.remove(obj));
    jugglers.length = 0;
    cubes.length = 0;
    passes.length = 0;
    keyframe.objects.jugglers.forEach(jData => {
        const juggler = createJuggler();
        juggler.userData.id = jData.id;
        juggler.position.set(jData.x, jData.y, jData.z);
        juggler.rotation.set(jData.rotationX || 0, jData.rotationY || 0, 0);
        scene.add(juggler);
        jugglers.push(juggler);
    });
    keyframe.objects.cubes.forEach(cData => {
        const cube = createCubeFromData(cData);
        scene.add(cube);
        cubes.push(cube);
    });
    keyframe.objects.passes.forEach(pData => {
        const juggler1 = jugglers.find(j => j.userData.id === pData.juggler1Id);
        const juggler2 = jugglers.find(j => j.userData.id === pData.juggler2Id);
        if (juggler1 && juggler2) {
            const pass = createPassFromData(pData, juggler1, juggler2);
            scene.add(pass);
            passes.push(pass);
        }
    });
    updatePasses();
}

function animateToKeyframeState(keyframe) {
    if (keyframe.objects) animateToNewKeyframeState(keyframe);
}

function animateToNewKeyframeState(keyframe) {
    const targetJugglerIds = keyframe.objects.jugglers.map(j => j.id);
    jugglers.forEach(j => { if (!targetJugglerIds.includes(j.userData.id)) scene.remove(j); });
    jugglers = jugglers.filter(j => targetJugglerIds.includes(j.userData.id));
    keyframe.objects.jugglers.forEach(jData => {
        let juggler = jugglers.find(j => j.userData.id === jData.id);
        if (!juggler) {
            juggler = createJuggler();
            juggler.userData.id = jData.id;
            juggler.position.set(jData.x, jData.y, jData.z);
            juggler.rotation.set(jData.rotationX || 0, jData.rotationY || 0, 0);
            scene.add(juggler);
            jugglers.push(juggler);
        } else {
            animateObjectToState(juggler, jData);
        }
    });

    const targetCubeIds = keyframe.objects.cubes.map(c => c.id);
    cubes.forEach(c => { if (!targetCubeIds.includes(c.userData.id)) scene.remove(c); });
    cubes = cubes.filter(c => targetCubeIds.includes(c.userData.id));
    keyframe.objects.cubes.forEach(cData => {
        let cube = cubes.find(c => c.userData.id === cData.id);
        if (!cube) {
            cube = createCubeFromData(cData);
            scene.add(cube);
            cubes.push(cube);
        } else {
            animateObjectToState(cube, cData);
        }
    });

    const targetPassIds = keyframe.objects.passes.map(p => p.id);
    passes.forEach(p => { if (!targetPassIds.includes(p.userData.id)) scene.remove(p); });
    passes = passes.filter(p => targetPassIds.includes(p.userData.id));
    keyframe.objects.passes.forEach(pData => {
        if (!passes.some(p => p.userData.id === pData.id)) {
            const juggler1 = jugglers.find(j => j.userData.id === pData.juggler1Id);
            const juggler2 = jugglers.find(j => j.userData.id === pData.juggler2Id);
            if (juggler1 && juggler2) {
                const pass = createPassFromData(pData, juggler1, juggler2);
                scene.add(pass);
                passes.push(pass);
            }
        }
    });
    updatePasses();
}

function animateObjectToState(object, targetState) {
    const startState = {
        x: object.position.x, y: object.position.y, z: object.position.z,
        rotationX: object.rotation.x, rotationY: object.rotation.y, rotationZ: object.rotation.z
    };
    const duration = 1500 / animationSpeed;
    const startTime = Date.now();
    function animate() {
        const progress = Math.min((Date.now() - startTime) / duration, 1);
        const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        object.position.x = startState.x + (targetState.x - startState.x) * easeProgress;
        object.position.y = startState.y + (targetState.y - startState.y) * easeProgress;
        object.position.z = startState.z + (targetState.z - startState.z) * easeProgress;
        object.rotation.x = startState.rotationX + ((targetState.rotationX || 0) - startState.rotationX) * easeProgress;
        object.rotation.y = startState.rotationY + ((targetState.rotationY || 0) - startState.rotationY) * easeProgress;
        if (object.rotation.z !== undefined) {
            object.rotation.z = startState.rotationZ + ((targetState.rotationZ || 0) - startState.rotationZ) * easeProgress;
        }
        updatePasses();
        if (progress < 1 && isAnimating) requestAnimationFrame(animate);
    }
    animate();
}

function updateAnimationSpeed() {
    const speedSlider = document.getElementById('animationSpeed');
    const speedValue = document.getElementById('speedValue');
    if (speedSlider && speedValue) {
        animationSpeed = parseFloat(speedSlider.value);
        speedValue.textContent = `${animationSpeed.toFixed(1)}x`;
    }
}

document.getElementById('instructions-modal').addEventListener('click', function (e) {
    if (e.target === this) toggleInstructions();
});

document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('instructions-modal');
    const modalContent = modal.querySelector('.modal-content');
    const originalToggleInstructions = window.toggleInstructions;
    window.toggleInstructions = function () {
        originalToggleInstructions();
        if (controls) controls.enabled = modal.style.display !== 'flex';
    };
    modalContent.addEventListener('touchstart', e => { if (controls) controls.enabled = false; }, { passive: true });
    modalContent.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
});