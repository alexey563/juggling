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
const APP_VERSION = '2.4.2';
const CACHE_BUSTER = Date.now();

// Проверка и принудительное обновление
function checkForUpdates() {
    // Отключено для предотвращения перезагрузки
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

// Переменные для новой логики перемещения
let holdTimer = null;
let isHolding = false;
let holdStartTime = 0;
const HOLD_DURATION = 800; // 800ms для активации перемещения
let controlsActive = false;

// Переменные для определения намерения пользователя
let pointerStartPos = { x: 0, y: 0 };
let hasMovedDuringHold = false;
const MOVEMENT_THRESHOLD = 10; // пикселей - если пользователь сдвинул мышь больше этого, считаем что он хочет повернуть камеру

// Переменные для анимации
let keyframes = []; // Массив ключевых кадров
let isAnimating = false;
let animationSpeed = 1.0;
let currentKeyframe = 0;
let animationInterval = null;

// Raycaster для выбора объектов
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Инициализация
function init() {
    // Создание сцены
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // Создание камеры
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 10);

    // Создание рендерера
    const container = document.getElementById('canvas-container');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Управление камерой
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Отслеживаем события OrbitControls
    controls.addEventListener('start', function () {
        controlsActive = true;
    });

    controls.addEventListener('end', function () {
        controlsActive = false;
    });

    // Освещение
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Пол
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Сетка
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x444444);
    scene.add(gridHelper);

    // Создание плоскости для перетаскивания
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshBasicMaterial({ visible: false });
    dragPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    dragPlane.rotation.x = -Math.PI / 2;
    scene.add(dragPlane);

    // Обработчики событий - используем pointer события которые срабатывают раньше
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener('contextmenu', onRightClick);
    renderer.domElement.addEventListener('wheel', onMouseWheel);

    // Глобальный обработчик движения для отслеживания намерения пользователя
    document.addEventListener('pointermove', onGlobalPointerMove);



    // Мобильные события
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });

    window.addEventListener('resize', onWindowResize);

    // Запуск анимации
    animate();
}

// Создание жонглёра
function createJuggler() {
    const group = new THREE.Group();

    // Тело (более правильная форма)
    const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 12);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    // Голова
    const headGeometry = new THREE.SphereGeometry(0.15, 12, 8);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.45;
    head.castShadow = true;
    group.add(head);

    // Шея
    const neckGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8);
    const neckMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.position.y = 1.35;
    neck.castShadow = true;
    group.add(neck);

    // Плечи
    const shoulderGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
    const shoulderMaterial = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
    const shoulders = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
    shoulders.position.y = 1.25;
    shoulders.rotation.z = Math.PI / 2;
    shoulders.castShadow = true;
    group.add(shoulders);

    // Руки (верхняя часть)
    const upperArmGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8);
    const armMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });

    const leftUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
    leftUpperArm.position.set(-0.3, 1.05, 0);
    leftUpperArm.castShadow = true;
    group.add(leftUpperArm);

    const rightUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
    rightUpperArm.position.set(0.3, 1.05, 0);
    rightUpperArm.castShadow = true;
    group.add(rightUpperArm);

    // Руки (нижняя часть)
    const lowerArmGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.25, 8);

    const leftLowerArm = new THREE.Mesh(lowerArmGeometry, armMaterial);
    leftLowerArm.position.set(-0.3, 0.75, 0);
    leftLowerArm.castShadow = true;
    group.add(leftLowerArm);

    const rightLowerArm = new THREE.Mesh(lowerArmGeometry, armMaterial);
    rightLowerArm.position.set(0.3, 0.75, 0);
    rightLowerArm.castShadow = true;
    group.add(rightLowerArm);

    // Кисти рук
    const handGeometry = new THREE.SphereGeometry(0.04, 8, 6);

    const leftHand = new THREE.Mesh(handGeometry, armMaterial);
    leftHand.position.set(-0.3, 0.6, 0);
    leftHand.castShadow = true;
    group.add(leftHand);

    const rightHand = new THREE.Mesh(handGeometry, armMaterial);
    rightHand.position.set(0.3, 0.6, 0);
    rightHand.castShadow = true;
    group.add(rightHand);

    // Ноги (бедра) - правильно позиционированы
    const thighGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0x2196F3 });

    const leftThigh = new THREE.Mesh(thighGeometry, legMaterial);
    leftThigh.position.set(-0.1, 0.4, 0);
    leftThigh.castShadow = true;
    group.add(leftThigh);

    const rightThigh = new THREE.Mesh(thighGeometry, legMaterial);
    rightThigh.position.set(0.1, 0.4, 0);
    rightThigh.castShadow = true;
    group.add(rightThigh);

    // Ноги (голени)
    const shinGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);

    const leftShin = new THREE.Mesh(shinGeometry, legMaterial);
    leftShin.position.set(-0.1, 0.15, 0);
    leftShin.castShadow = true;
    group.add(leftShin);

    const rightShin = new THREE.Mesh(shinGeometry, legMaterial);
    rightShin.position.set(0.1, 0.15, 0);
    rightShin.castShadow = true;
    group.add(rightShin);

    // Ступни - точно на уровне пола
    const footGeometry = new THREE.BoxGeometry(0.12, 0.06, 0.2);
    const footMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });

    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(-0.1, 0.03, 0.04);
    leftFoot.castShadow = true;
    group.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0.1, 0.03, 0.04);
    rightFoot.castShadow = true;
    group.add(rightFoot);

    group.userData = {
        type: 'juggler',
        id: Date.now() + Math.random(),
        height: 1.6
    };
    return group;
}

// Добавление жонглёра
function addJuggler() {
    const juggler = createJuggler();
    juggler.position.set(
        Math.random() * 6 - 3,
        0,
        Math.random() * 6 - 3
    );
    scene.add(juggler);
    jugglers.push(juggler);
}

// Добавление куба с настраиваемыми размерами
function addCube() {
    const width = parseFloat(document.getElementById('cubeWidth').value) || 0.5;
    const height = parseFloat(document.getElementById('cubeHeight').value) || 0.5;
    const depth = parseFloat(document.getElementById('cubeDepth').value) || 0.5;

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshLambertMaterial({ color: 0xff9800 });
    const cube = new THREE.Mesh(geometry, material);

    cube.position.set(
        Math.random() * 6 - 3,
        height / 2,
        Math.random() * 6 - 3
    );
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData = {
        type: 'cube',
        id: Date.now() + Math.random(),
        height: height,
        width: width,
        depth: depth
    };

    scene.add(cube);
    cubes.push(cube);
}

// Создание куба из данных кадра
function createCubeFromData(cubeData) {
    const geometry = new THREE.BoxGeometry(cubeData.width, cubeData.height, cubeData.depth);
    const material = new THREE.MeshLambertMaterial({ color: 0xff9800 });
    const cube = new THREE.Mesh(geometry, material);

    cube.position.set(cubeData.x, cubeData.y, cubeData.z);
    cube.rotation.set(cubeData.rotationX, cubeData.rotationY, cubeData.rotationZ);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData = {
        type: 'cube',
        id: cubeData.id,
        height: cubeData.height,
        width: cubeData.width,
        depth: cubeData.depth
    };

    return cube;
}

// Создание перекидки из данных кадра
function createPassFromData(passData, juggler1, juggler2) {
    const color = passData.color;
    const height = passData.height;
    const passCount = passData.count;

    // Получение центральных позиций
    const start = getCenterPosition(juggler1);
    const end = getCenterPosition(juggler2);

    // Создание кривой линии
    const middle = start.clone().add(end).multiplyScalar(0.5);
    middle.y += height;

    const curve = new THREE.QuadraticBezierCurve3(start, middle, end);

    // Создание толстой линии с помощью TubeGeometry
    const tubeGeometry = new THREE.TubeGeometry(curve, 50, 0.05, 8, false);
    const tubeMaterial = new THREE.MeshLambertMaterial({ color: color });
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.castShadow = true;

    // Создание спрайта с числом
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;

    // Белый круг с цветной границей
    context.fillStyle = 'white';
    context.beginPath();
    context.arc(64, 64, 50, 0, 2 * Math.PI);
    context.fill();

    // Цветная граница
    context.strokeStyle = color;
    context.lineWidth = 6;
    context.stroke();

    // Число в центре
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
    passGroup.userData = {
        type: 'pass',
        id: passData.id,
        juggler1: juggler1,
        juggler2: juggler2,
        count: passCount,
        color: color,
        height: height,
        line: tube,
        sprite: sprite,
        curve: curve
    };

    return passGroup;
}



// Обработка клика мыши
function onMouseClick(event) {
    // Игнорируем клик если он был частью удержания
    if (isHolding || isDraggingObject || isDraggingPass) {
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Проверка пересечения с перекидками
    const passObjects = passes.map(p => p.userData.line);
    const passIntersects = raycaster.intersectObjects(passObjects);
    if (passIntersects.length > 0) {
        const passLine = passIntersects[0].object;
        const pass = passes.find(p => p.userData.line === passLine);
        if (pass) {
            selectPass(pass);
            return;
        }
    }

    const allObjects = [...jugglers, ...cubes];
    const intersects = raycaster.intersectObjects(allObjects, true);

    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;

        // Найти родительский объект (группу)
        while (clickedObject.parent && !clickedObject.userData.type) {
            clickedObject = clickedObject.parent;
        }

        if (passMode && clickedObject.userData.type === 'juggler') {
            handlePassCreation(clickedObject);
        } else {
            // Простое выделение объекта
            handleObjectSelection(clickedObject, event.shiftKey);
        }
    } else if (!event.shiftKey) {
        clearSelection();
    }
}

// Начало удержания объекта
function startObjectHold(object, event) {
    clearHoldTimer();
    isHolding = true;
    holdStartTime = Date.now();
    hasMovedDuringHold = false;

    holdTimer = setTimeout(() => {
        if (isHolding && !hasMovedDuringHold) {
            // Пользователь не двигал мышь - начинаем перетаскивание
            if (!selectedObjects.includes(object)) {
                clearSelection();
                selectObject(object);
            }
            startObjectDragging(object);
        } else if (hasMovedDuringHold) {
            // Пользователь двигал мышь - просто выделяем объект
            if (!selectedObjects.includes(object)) {
                clearSelection();
                selectObject(object);
            }
        }
    }, HOLD_DURATION);
}

// Начало удержания перекидки
function startPassHold(pass, event) {
    clearHoldTimer();
    isHolding = true;
    holdStartTime = Date.now();
    hasMovedDuringHold = false;

    selectPass(pass);

    holdTimer = setTimeout(() => {
        if (isHolding && !hasMovedDuringHold) {
            // Пользователь не двигал мышь - начинаем изменение высоты
            startPassDragging(pass);
        }
        // Если пользователь двигал мышь - просто оставляем перекидку выделенной
    }, HOLD_DURATION);
}

// Очистка таймера удержания
function clearHoldTimer() {
    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
    }
    isHolding = false;

    // Включаем OrbitControls обратно если не перетаскиваем
    if (!isDraggingObject && !isDraggingPass) {
        controls.enabled = true;
    }
}

// Обработка нажатия указателя (мышь/палец)
function onPointerDown(event) {
    if (event.button === 0 || event.pointerType === 'touch') { // Левая кнопка мыши или касание

        // Запоминаем начальную позицию указателя
        pointerStartPos.x = event.clientX;
        pointerStartPos.y = event.clientY;
        hasMovedDuringHold = false;

        // Сначала проверяем, есть ли объект под курсором
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // Проверяем все объекты и перекидки
        const passObjects = passes.map(p => p.userData.line);
        const passIntersects = raycaster.intersectObjects(passObjects);
        const allObjects = [...jugglers, ...cubes];
        const objectIntersects = raycaster.intersectObjects(allObjects, true);

        if (passIntersects.length > 0 || objectIntersects.length > 0) {
            // Есть объект под курсором - временно отключаем OrbitControls
            controls.enabled = false;

            // Обрабатываем объект
            handlePointerDownOnObjects(event);
        }
    }
}

// Обработка объектов при нажатии
function handlePointerDownOnObjects(event) {
    // Координаты уже вычислены в onPointerDown, используем raycaster

    // Проверка пересечения с перекидками
    const passObjects = passes.map(p => p.userData.line);
    const passIntersects = raycaster.intersectObjects(passObjects);
    if (passIntersects.length > 0) {
        const passLine = passIntersects[0].object;
        const pass = passes.find(p => p.userData.line === passLine);
        if (pass) {
            startPassHold(pass, event);
            return;
        }
    }

    const allObjects = [...jugglers, ...cubes];
    const intersects = raycaster.intersectObjects(allObjects, true);

    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;

        // Найти родительский объект (группу)
        while (clickedObject.parent && !clickedObject.userData.type) {
            clickedObject = clickedObject.parent;
        }

        if (!passMode || clickedObject.userData.type !== 'juggler') {
            startObjectHold(clickedObject, event);
        }
    }
}

// Обработка отпускания указателя
function onPointerUp(event) {
    if (event.button === 0 || event.pointerType === 'touch') { // Левая кнопка мыши или касание
        clearHoldTimer();

        // Если перетаскиваем объект, завершаем перетаскивание
        if (isDraggingObject) {
            finishObjectDragging();
        }

        // Если изменяем высоту перекидки, завершаем изменение
        if (isDraggingPass) {
            finishPassDragging();
        }
    }
}

// Обработка правого клика
function onRightClick(event) {
    event.preventDefault();
    clearHoldTimer();
}

// Глобальный обработчик движения для отслеживания намерения пользователя
function onGlobalPointerMove(event) {
    // Проверяем движение только во время удержания, но до начала перетаскивания
    if (isHolding && !isDraggingObject && !isDraggingPass) {
        const deltaX = Math.abs(event.clientX - pointerStartPos.x);
        const deltaY = Math.abs(event.clientY - pointerStartPos.y);
        const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (totalMovement > MOVEMENT_THRESHOLD) {
            hasMovedDuringHold = true;
            clearHoldTimer(); // Отменяем удержание
            controls.enabled = true; // Включаем управление камерой
        }
    }
}

// Обработка движения указателя
function onPointerMove(event) {
    if (!isDraggingObject && !isDraggingPass) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (isDraggingObject && draggedObject) {
        // Перемещение объекта
        const intersects = raycaster.intersectObject(dragPlane);
        if (intersects.length > 0) {
            const targetPosition = intersects[0].point;
            const newPosition = findValidPosition(draggedObject, targetPosition);
            draggedObject.position.copy(newPosition);
            updatePasses();
        }
    } else if (isDraggingPass && selectedPass) {
        // Изменение высоты перекидки по движению мыши вверх/вниз
        const deltaY = event.movementY * -0.01;
        const currentHeight = selectedPass.userData.height || 2;
        const newHeight = Math.max(0, Math.min(5, currentHeight + deltaY));
        selectedPass.userData.height = newHeight;
        updateSinglePass(selectedPass);
    }
}

// Начало перетаскивания объекта
function startObjectDragging(object) {
    isDraggingObject = true;
    draggedObject = object;
    controls.enabled = false;

    // Делаем объект полупрозрачным
    object.traverse((child) => {
        if (child.isMesh && child.material) {
            if (!child.userData.originalMaterial) {
                child.userData.originalMaterial = child.material;
            }
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = 0.5;
        }
    });

    clearSelection();
    selectObject(object);
}

// Завершение перетаскивания объекта
function finishObjectDragging() {
    if (draggedObject) {
        // Восстанавливаем непрозрачность
        draggedObject.traverse((child) => {
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

// Начало изменения высоты перекидки
function startPassDragging(pass) {
    isDraggingPass = true;
    selectedPass = pass;
    controls.enabled = false;

    clearSelection();
    selectPass(pass);
}

// Завершение изменения высоты перекидки
function finishPassDragging() {
    isDraggingPass = false;
    controls.enabled = true;

    // Обновляем пересечения после изменения высоты
    checkPassIntersections();
}

// Обработка колеса мыши для поворота объектов
function onMouseWheel(event) {
    if (isDraggingObject && draggedObject) {
        event.preventDefault();

        // Поворот объекта на 45 градусов при перетаскивании
        const direction = event.deltaY > 0 ? 1 : -1;

        // Получаем текущий поворот в градусах
        let currentRotationDegrees = draggedObject.rotation.y * 180 / Math.PI;

        // Добавляем 45 градусов в нужном направлении
        currentRotationDegrees += direction * 45;

        // Нормализуем к диапазону 0-360 градусов
        currentRotationDegrees = ((currentRotationDegrees % 360) + 360) % 360;

        // Устанавливаем новый поворот
        draggedObject.rotation.y = currentRotationDegrees * Math.PI / 180;

        // Обновляем UI
        updateUI();

        return;
    }

    // Если не перетаскиваем объект, позволяем обычное управление камерой
}



// Поиск валидной позиции для размещения объекта
function findValidPosition(object, targetPosition) {
    let finalY = 0; // Минимальная высота - уровень пола

    // Для кубов учитываем их высоту
    if (object.userData.type === 'cube') {
        finalY = object.userData.height / 2;
    }

    // Проверка на размещение на кубах или других жонглёрах
    const allObjects = [...jugglers, ...cubes].filter(obj => obj !== object);

    for (const otherObject of allObjects) {
        const distance = new THREE.Vector2(
            targetPosition.x - otherObject.position.x,
            targetPosition.z - otherObject.position.z
        ).length();

        // Определяем размеры объектов для проверки пересечения
        let objectRadius, otherRadius;

        if (object.userData.type === 'juggler') {
            objectRadius = 0.3;
        } else {
            objectRadius = Math.max(object.userData.width, object.userData.depth) / 2;
        }

        if (otherObject.userData.type === 'juggler') {
            otherRadius = 0.3;
        } else {
            otherRadius = Math.max(otherObject.userData.width, otherObject.userData.depth) / 2;
        }

        const minDistance = objectRadius + otherRadius + 0.1; // Небольшой зазор

        if (distance < minDistance) {
            // Объект размещается на другом объекте
            let supportHeight;
            if (otherObject.userData.type === 'cube') {
                supportHeight = otherObject.position.y + otherObject.userData.height / 2;
            } else {
                supportHeight = otherObject.position.y + otherObject.userData.height;
            }

            if (object.userData.type === 'cube') {
                finalY = Math.max(finalY, supportHeight + object.userData.height / 2);
            } else {
                finalY = Math.max(finalY, supportHeight);
            }
        }
    }

    return new THREE.Vector3(targetPosition.x, finalY, targetPosition.z);
}

// Создание перекидки между жонглёрами
function handlePassCreation(juggler) {
    if (selectedObjects.length === 0) {
        selectObject(juggler);
    } else if (selectedObjects.length === 1 && selectedObjects[0] !== juggler) {
        createPass(selectedObjects[0], juggler);
        clearSelection();
    }
}

// Создание линии перекидки
function createPass(juggler1, juggler2) {
    const passCount = parseInt(document.getElementById('passCount').value) || 1;
    const color = passColors[colorIndex % passColors.length];
    colorIndex++;

    // Получение центральных позиций
    const start = getCenterPosition(juggler1);
    const end = getCenterPosition(juggler2);
    const height = 2; // Начальная высота

    // Создание кривой линии
    const middle = start.clone().add(end).multiplyScalar(0.5);
    middle.y += height;

    const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
    const points = curve.getPoints(50);

    // Создание толстой линии с помощью TubeGeometry
    const tubeGeometry = new THREE.TubeGeometry(curve, 50, 0.05, 8, false);
    const tubeMaterial = new THREE.MeshLambertMaterial({ color: color });
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.castShadow = true;

    // Создание красивого спрайта с числом
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;

    // Белый круг с цветной границей
    context.fillStyle = 'white';
    context.beginPath();
    context.arc(64, 64, 50, 0, 2 * Math.PI);
    context.fill();

    // Цветная граница
    context.strokeStyle = color;
    context.lineWidth = 6;
    context.stroke();

    // Число в центре
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
    passGroup.userData = {
        type: 'pass',
        id: Date.now() + Math.random(),
        juggler1: juggler1,
        juggler2: juggler2,
        count: passCount,
        color: color,
        height: height,
        line: tube,
        sprite: sprite,
        curve: curve
    };

    scene.add(passGroup);
    passes.push(passGroup);

    // Проверка пересечений
    checkPassIntersections();
}

// Получение центральной позиции жонглёра
function getCenterPosition(juggler) {
    const center = juggler.position.clone();
    center.y += 0.8; // Высота центра тела
    return center;
}

// Обновление одной перекидки
function updateSinglePass(pass) {
    const start = getCenterPosition(pass.userData.juggler1);
    const end = getCenterPosition(pass.userData.juggler2);
    const height = pass.userData.height;

    // Правильное позиционирование средней точки
    const middle = start.clone().add(end).multiplyScalar(0.5);

    // Минимальная высота - на уровне жонглёров, максимальная - заданная высота
    const minHeight = Math.max(start.y, end.y) + 0.3;
    const actualHeight = Math.max(minHeight, middle.y + height);
    middle.y = actualHeight;

    const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
    pass.userData.curve = curve;

    // Обновление геометрии трубы
    const tubeGeometry = new THREE.TubeGeometry(curve, 50, 0.05, 8, false);
    pass.userData.line.geometry.dispose();
    pass.userData.line.geometry = tubeGeometry;

    // Позиционирование спрайта выше середины кривой
    const spritePosition = curve.getPoint(0.5);
    spritePosition.y += 0.3; // Поднимаем спрайт над линией
    pass.userData.sprite.position.copy(spritePosition);
}

// Выбор объекта
function handleObjectSelection(object, shiftKey) {
    if (shiftKey) {
        if (selectedObjects.includes(object)) {
            deselectObject(object);
        } else {
            selectObject(object);
        }
    } else {
        clearSelection();
        selectObject(object);
    }
}

// Выделение объекта
function selectObject(object) {
    if (!selectedObjects.includes(object)) {
        // Сначала очищаем выделение перекидок
        clearPassSelection();

        selectedObjects.push(object);

        // Создание контура выделения
        const box = new THREE.BoxHelper(object, 0xffff00);
        object.userData.selectionBox = box;
        scene.add(box);

        updateUI();
    }
}

// Выделение перекидки
function selectPass(pass) {
    // Сначала очищаем выделение объектов
    clearSelection();

    selectedPass = pass;

    // Выделяем перекидку желтым цветом
    pass.userData.line.material.emissive.setHex(0xffff00);
    pass.userData.isSelected = true;
}

// Очистка выделения перекидок
function clearPassSelection() {
    if (selectedPass) {
        // Убираем выделение, но сохраняем красный цвет если есть пересечение
        if (selectedPass.userData.isSelected) {
            selectedPass.userData.line.material.emissive.setHex(0x000000);
            selectedPass.userData.isSelected = false;
        }
        selectedPass = null;
    }
}

// Снятие выделения с объекта
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

// Очистка выделения
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

// Обновление интерфейса
function updateUI() {
    if (selectedObjects.length === 1) {
        const object = selectedObjects[0];
        let degrees = object.rotation.y * 180 / Math.PI;
        // Нормализуем к диапазону 0-360 и округляем до ближайшего кратного 45
        degrees = ((degrees % 360) + 360) % 360;
        degrees = Math.round(degrees / 45) * 45;
        document.getElementById('rotation').value = degrees;
    } else {
        document.getElementById('rotation').value = '';
    }
}



// Обновление поворота выбранного объекта
function updateSelectedRotation() {
    if (selectedObjects.length === 1) {
        const object = selectedObjects[0];
        let rotation = parseFloat(document.getElementById('rotation').value) || 0;
        // Округляем до ближайшего кратного 45
        rotation = Math.round(rotation / 45) * 45;
        // Нормализуем к диапазону 0-360
        rotation = ((rotation % 360) + 360) % 360;
        object.rotation.y = rotation * Math.PI / 180;
        // Обновляем поле ввода с нормализованным значением
        document.getElementById('rotation').value = rotation;
    }
}

// Поворот выбранного объекта влево (для мобильных)
function rotateSelectedLeft() {
    if (selectedObjects.length === 1) {
        const object = selectedObjects[0];
        let currentRotation = object.rotation.y * 180 / Math.PI;
        currentRotation -= 45;
        currentRotation = ((currentRotation % 360) + 360) % 360;
        object.rotation.y = currentRotation * Math.PI / 180;
        updateUI();
    }
}

// Поворот выбранного объекта вправо (для мобильных)
function rotateSelectedRight() {
    if (selectedObjects.length === 1) {
        const object = selectedObjects[0];
        let currentRotation = object.rotation.y * 180 / Math.PI;
        currentRotation += 45;
        currentRotation = ((currentRotation % 360) + 360) % 360;
        object.rotation.y = currentRotation * Math.PI / 180;
        updateUI();
    }
}

// Проверка пересечений перекидок
function checkPassIntersections() {
    // Удаляем старые маркеры пересечений
    passes.forEach(pass => {
        if (pass.userData.intersectionMarkers) {
            pass.userData.intersectionMarkers.forEach(marker => {
                pass.remove(marker);
            });
            pass.userData.intersectionMarkers = [];
        }

        // Сбрасываем цвет только если перекидка не выделена
        if (!pass.userData.isSelected) {
            pass.userData.line.material.emissive.setHex(0x000000);
        }
    });

    // Получаем только видимые перекидки
    const visiblePasses = passes.filter(pass => pass.visible);

    // Проверка всех пар видимых перекидок
    for (let i = 0; i < visiblePasses.length; i++) {
        for (let j = i + 1; j < visiblePasses.length; j++) {
            const pass1 = visiblePasses[i];
            const pass2 = visiblePasses[j];

            const intersectionPoints = findIntersectionPoints(pass1, pass2);

            if (intersectionPoints.length > 0) {
                // Добавить маркеры в точках пересечения (без изменения цвета линий)
                intersectionPoints.forEach(point => {
                    addIntersectionMarker(pass1, point);
                    addIntersectionMarker(pass2, point);
                });
            }
        }
    }
}

// Поиск точек пересечения двух перекидок
function findIntersectionPoints(pass1, pass2) {
    const curve1 = pass1.userData.curve;
    const curve2 = pass2.userData.curve;
    const intersectionPoints = [];

    // Проверяем точки на кривых с более высокой точностью
    for (let t1 = 0; t1 <= 1; t1 += 0.05) {
        const point1 = curve1.getPoint(t1);

        for (let t2 = 0; t2 <= 1; t2 += 0.05) {
            const point2 = curve2.getPoint(t2);

            const distance = point1.distanceTo(point2);
            if (distance < 0.2) {
                // Найдена точка пересечения
                const intersectionPoint = point1.clone().add(point2).multiplyScalar(0.5);
                intersectionPoints.push(intersectionPoint);
            }
        }
    }

    return intersectionPoints;
}

// Добавление маркера пересечения
function addIntersectionMarker(pass, point) {
    const markerGeometry = new THREE.SphereGeometry(0.08, 8, 6);
    const markerMaterial = new THREE.MeshLambertMaterial({
        color: 0xffff00,
        emissive: 0xff0000,
        emissiveIntensity: 0.3
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(point);

    if (!pass.userData.intersectionMarkers) {
        pass.userData.intersectionMarkers = [];
    }
    pass.userData.intersectionMarkers.push(marker);
    pass.add(marker);
}



// Обновление перекидок при перемещении жонглёров
function updatePasses() {
    passes.forEach(pass => {
        if (pass.visible) {
            updateSinglePass(pass);
        }
    });
    checkPassIntersections();
}

// Переключение режима создания перекидок
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


// Удаление выбранных объектов
function deleteSelected() {
    // Удаление выбранной перекидки
    if (selectedPass) {
        const index = passes.indexOf(selectedPass);
        if (index > -1) {
            scene.remove(selectedPass);
            passes.splice(index, 1);
        }
        clearPassSelection();
        return;
    }

    // Удаление выбранных объектов
    selectedObjects.forEach(object => {
        scene.remove(object);

        if (object.userData.type === 'juggler') {
            const index = jugglers.indexOf(object);
            if (index > -1) jugglers.splice(index, 1);
        } else if (object.userData.type === 'cube') {
            const index = cubes.indexOf(object);
            if (index > -1) cubes.splice(index, 1);
        }

        // Удаление связанных перекидок
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

// Очистка всей сцены
function clearAll() {
    [...jugglers, ...cubes, ...passes].forEach(object => {
        scene.remove(object);
    });

    jugglers = [];
    cubes = [];
    passes = [];

    // Очищаем анимацию
    stopAnimation();
    keyframes = [];
    updateKeyframesList();

    clearSelection();
}

// Обработка изменения размера окна
function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Анимационный цикл
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Создание скриншота сцены
function captureSceneThumbnail() {
    // Рендерим сцену
    renderer.render(scene, camera);

    // Создаем canvas для миниатюры
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');

    // Копируем изображение из рендерера с масштабированием
    ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.8);
}

// Сохранение сценария
function saveScenario() {
    const scenarioName = document.getElementById('scenarioName').value.trim();
    if (!scenarioName) {
        alert('Пожалуйста, введите название сценария');
        return;
    }

    // Создаем скриншот
    const thumbnail = captureSceneThumbnail();

    const scenario = {
        name: scenarioName,
        userId: userId, // Добавляем ID пользователя
        timestamp: new Date().toISOString(),
        thumbnail: thumbnail,
        jugglers: jugglers.map(juggler => ({
            id: juggler.userData.id,
            position: {
                x: juggler.position.x,
                y: juggler.position.y,
                z: juggler.position.z
            },
            rotation: {
                x: juggler.rotation.x,
                y: juggler.rotation.y,
                z: juggler.rotation.z
            }
        })),
        cubes: cubes.map(cube => ({
            id: cube.userData.id,
            position: {
                x: cube.position.x,
                y: cube.position.y,
                z: cube.position.z
            },
            rotation: {
                x: cube.rotation.x,
                y: cube.rotation.y,
                z: cube.rotation.z
            },
            dimensions: {
                width: cube.userData.width,
                height: cube.userData.height,
                depth: cube.userData.depth
            }
        })),
        passes: passes.map(pass => ({
            id: pass.userData.id,
            juggler1Index: jugglers.indexOf(pass.userData.juggler1),
            juggler2Index: jugglers.indexOf(pass.userData.juggler2),
            juggler1Id: pass.userData.juggler1.userData.id,
            juggler2Id: pass.userData.juggler2.userData.id,
            count: pass.userData.count,
            color: pass.userData.color,
            height: pass.userData.height
        })),
        // Добавляем анимацию
        animation: {
            keyframes: keyframes.map(keyframe => ({
                id: keyframe.id,
                name: keyframe.name,
                objects: keyframe.objects || null,
                positions: keyframe.positions || null
            })),
            speed: animationSpeed
        }
    };

    // Сохраняем в localStorage с уникальным ключом для пользователя
    const storageKey = `jugglingScenarios_${userId}`;
    const savedScenarios = JSON.parse(localStorage.getItem(storageKey) || '{}');
    savedScenarios[scenarioName] = scenario;
    localStorage.setItem(storageKey, JSON.stringify(savedScenarios));

    // Обновляем галерею сценариев
    updateScenarioGallery();

    // Очищаем поле ввода
    document.getElementById('scenarioName').value = '';

    alert(`Сценарий "${scenarioName}" сохранен!`);
}

// Загрузка сценария
function loadScenario(scenarioName) {
    const storageKey = `jugglingScenarios_${userId}`;
    const savedScenarios = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const scenario = savedScenarios[scenarioName];

    if (!scenario) {
        alert('Сценарий не найден');
        return;
    }

    // Очищаем текущую сцену
    clearAll();

    // Восстанавливаем жонглёров
    scenario.jugglers.forEach((jugglerData, index) => {
        const juggler = createJuggler();
        juggler.userData.id = jugglerData.id || `loaded_juggler_${index}_${Date.now()}`;
        juggler.position.set(jugglerData.position.x, jugglerData.position.y, jugglerData.position.z);
        juggler.rotation.set(jugglerData.rotation.x, jugglerData.rotation.y, jugglerData.rotation.z);
        scene.add(juggler);
        jugglers.push(juggler);
    });

    // Восстанавливаем кубы
    scenario.cubes.forEach(cubeData => {
        const geometry = new THREE.BoxGeometry(
            cubeData.dimensions.width,
            cubeData.dimensions.height,
            cubeData.dimensions.depth
        );
        const material = new THREE.MeshLambertMaterial({ color: 0xff9800 });
        const cube = new THREE.Mesh(geometry, material);

        cube.position.set(cubeData.position.x, cubeData.position.y, cubeData.position.z);
        cube.rotation.set(cubeData.rotation.x, cubeData.rotation.y, cubeData.rotation.z);
        cube.castShadow = true;
        cube.receiveShadow = true;
        cube.userData = {
            type: 'cube',
            id: cubeData.id || `loaded_cube_${cubes.length}_${Date.now()}`,
            height: cubeData.dimensions.height,
            width: cubeData.dimensions.width,
            depth: cubeData.dimensions.depth
        };

        scene.add(cube);
        cubes.push(cube);
    });

    // Восстанавливаем перекидки
    scenario.passes.forEach(passData => {
        if (passData.juggler1Index >= 0 && passData.juggler2Index >= 0 &&
            passData.juggler1Index < jugglers.length && passData.juggler2Index < jugglers.length) {

            const juggler1 = jugglers[passData.juggler1Index];
            const juggler2 = jugglers[passData.juggler2Index];

            // Создаем перекидку
            const start = getCenterPosition(juggler1);
            const end = getCenterPosition(juggler2);
            const height = passData.height;

            const middle = start.clone().add(end).multiplyScalar(0.5);
            const minHeight = Math.max(start.y, end.y) + 0.3;
            const actualHeight = Math.max(minHeight, middle.y + height);
            middle.y = actualHeight;

            const curve = new THREE.QuadraticBezierCurve3(start, middle, end);

            // Создание трубы
            const tubeGeometry = new THREE.TubeGeometry(curve, 50, 0.05, 8, false);
            const tubeMaterial = new THREE.MeshLambertMaterial({ color: passData.color });
            const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            tube.castShadow = true;

            // Создание спрайта с числом
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 128;
            canvas.height = 128;

            context.fillStyle = 'white';
            context.beginPath();
            context.arc(64, 64, 50, 0, 2 * Math.PI);
            context.fill();

            context.strokeStyle = passData.color;
            context.lineWidth = 6;
            context.stroke();

            context.fillStyle = 'black';
            context.font = 'bold 48px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(passData.count.toString(), 64, 64);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);

            const spritePosition = curve.getPoint(0.5);
            spritePosition.y += 0.3;
            sprite.position.copy(spritePosition);
            sprite.scale.set(0.8, 0.8, 1);

            const passGroup = new THREE.Group();
            passGroup.add(tube);
            passGroup.add(sprite);
            passGroup.userData = {
                type: 'pass',
                id: passData.id || `loaded_pass_${passes.length}_${Date.now()}`,
                juggler1: juggler1,
                juggler2: juggler2,
                count: passData.count,
                color: passData.color,
                height: height,
                line: tube,
                sprite: sprite,
                curve: curve
            };

            scene.add(passGroup);
            passes.push(passGroup);
        }
    });

    // Загружаем анимацию если она есть
    if (scenario.animation) {
        keyframes = scenario.animation.keyframes || [];
        animationSpeed = scenario.animation.speed || 1.0;

        // Обновляем слайдер скорости
        const speedSlider = document.getElementById('animationSpeed');
        if (speedSlider) {
            speedSlider.value = animationSpeed;
            updateAnimationSpeed();
        }

        // Обновляем список кадров
        updateKeyframesList();
    } else {
        // Очищаем анимацию если её нет в сценарии
        keyframes = [];
        animationSpeed = 1.0;
        updateKeyframesList();
    }

    // Проверяем пересечения
    checkPassIntersections();

    alert(`Сценарий "${scenarioName}" загружен!`);
}

// Удаление сценария
function deleteScenario(scenarioName, event) {
    event.stopPropagation(); // Предотвращаем загрузку сценария при клике на кнопку удаления

    if (confirm(`Вы уверены, что хотите удалить сценарий "${scenarioName}"?`)) {
        const storageKey = `jugglingScenarios_${userId}`;
        const savedScenarios = JSON.parse(localStorage.getItem(storageKey) || '{}');
        delete savedScenarios[scenarioName];
        localStorage.setItem(storageKey, JSON.stringify(savedScenarios));

        updateScenarioGallery();
        alert(`Сценарий "${scenarioName}" удален!`);
    }
}

// Обновление галереи сценариев
function updateScenarioGallery() {
    const gallery = document.getElementById('scenarioGallery');
    const storageKey = `jugglingScenarios_${userId}`;
    const savedScenarios = JSON.parse(localStorage.getItem(storageKey) || '{}');

    // Очищаем галерею
    gallery.innerHTML = '';

    // Добавляем сохраненные сценарии
    Object.keys(savedScenarios).sort().forEach(name => {
        const scenario = savedScenarios[name];

        const item = document.createElement('div');
        item.className = 'scenario-item';
        item.onclick = () => loadScenario(name);

        const thumbnail = document.createElement('img');
        thumbnail.className = 'scenario-thumbnail';
        thumbnail.src = scenario.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
        thumbnail.alt = name;

        const info = document.createElement('div');
        info.className = 'scenario-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'scenario-name';
        nameDiv.textContent = name;

        const dateDiv = document.createElement('div');
        dateDiv.className = 'scenario-date';
        dateDiv.textContent = new Date(scenario.timestamp).toLocaleString();

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'scenario-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.onclick = (event) => deleteScenario(name, event);

        info.appendChild(nameDiv);
        info.appendChild(dateDiv);

        item.appendChild(thumbnail);
        item.appendChild(info);
        item.appendChild(deleteBtn);

        gallery.appendChild(item);
    });
}

// Синхронизация полей
function syncFields() {
    // Синхронизация количества реквизита
    const passCountField = document.getElementById('passCount');
    const mobilePassCountField = document.getElementById('mobilePassCount');

    if (passCountField && mobilePassCountField) {
        passCountField.addEventListener('input', function () {
            mobilePassCountField.value = this.value;
        });

        mobilePassCountField.addEventListener('input', function () {
            passCountField.value = this.value;
        });
    }
}

// Регистрация Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker зарегистрирован:', registration);

                // Проверка обновлений каждые 30 секунд
                setInterval(() => {
                    registration.update();
                }, 30000);

                // Обработка обновлений
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Новая версия доступна
                            console.log('Новая версия приложения доступна');

                            // Автоматическое обновление через 2 секунды
                            setTimeout(() => {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                window.location.reload();
                            }, 2000);
                        }
                    });
                });
            })
            .catch(error => {
                console.log('Ошибка регистрации Service Worker:', error);
            });
    }
}

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', function () {
    // Проверяем обновления перед инициализацией
    const isUpdating = checkForUpdates();

    if (!isUpdating) {
        init();
        updateScenarioGallery();
        detectMobile();
        updateMobileUI();
        syncFields();
        setupPanelScrolling();
        setupAnimation();

        // Регистрируем Service Worker после инициализации
        registerServiceWorker();
    }
});

// Настройка системы анимации
function setupAnimation() {
    const speedSlider = document.getElementById('animationSpeed');
    if (speedSlider) {
        speedSlider.addEventListener('input', updateAnimationSpeed);
        updateAnimationSpeed(); // Инициализация
    }
}

// Настройка прокрутки для панелей
function setupPanelScrolling() {
    const leftPanel = document.getElementById('left-sidebar');
    const rightPanel = document.getElementById('sidebar');

    // Отключаем OrbitControls при касании панелей
    [leftPanel, rightPanel].forEach(panel => {
        panel.addEventListener('touchstart', function (e) {
            controls.enabled = false;
        }, { passive: true });

        panel.addEventListener('touchend', function (e) {
            // Включаем OrbitControls обратно только если панель закрыта
            setTimeout(() => {
                if (!panel.classList.contains('open')) {
                    controls.enabled = true;
                }
            }, 100);
        }, { passive: true });

        // Предотвращаем всплытие событий прокрутки
        panel.addEventListener('touchmove', function (e) {
            e.stopPropagation();
        }, { passive: true });
    });
}

// Переменные для мобильного управления
let isMobile = false;
let touchStartTime = 0;
let touchStartPos = { x: 0, y: 0 };
let lastTouchObject = null;

// Определение мобильного устройства
function detectMobile() {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768;

    if (isMobile) {
        document.body.classList.add('mobile');
        // Настройка управления камерой для мобильных
        controls.enablePan = true;
        controls.enableZoom = true;
        controls.enableRotate = true;
        controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
    }
}

// Обработка касаний
function onTouchStart(event) {
    event.preventDefault();

    if (event.touches.length === 1) {
        touchStartTime = Date.now();
        const touch = event.touches[0];
        touchStartPos.x = touch.clientX;
        touchStartPos.y = touch.clientY;

        // Определяем объект под касанием
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // Проверка пересечения с перекидками
        const passObjects = passes.map(p => p.userData.line);
        const passIntersects = raycaster.intersectObjects(passObjects);
        if (passIntersects.length > 0) {
            const passLine = passIntersects[0].object;
            const pass = passes.find(p => p.userData.line === passLine);
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

            // Начинаем удержание для объекта
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
    // Позволяем OrbitControls обрабатывать движение
}

function onTouchEnd(event) {
    event.preventDefault();
    clearHoldTimer();

    if (event.changedTouches.length === 1) {
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - touchStartTime;
        const touch = event.changedTouches[0];

        const deltaX = Math.abs(touch.clientX - touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.y);
        const isStaticTouch = deltaX < 10 && deltaY < 10;

        // Если перетаскиваем объект или перекидку, завершаем
        if (isDraggingObject) {
            finishObjectDragging();
            return;
        }

        if (isDraggingPass) {
            finishPassDragging();
            return;
        }

        if (isStaticTouch && touchDuration < 300) {
            // Короткое касание - выделение
            if (lastTouchObject) {
                if (passMode && lastTouchObject.userData.type === 'juggler') {
                    handlePassCreation(lastTouchObject);
                } else {
                    handleObjectSelection(lastTouchObject, false);
                }
            } else {
                clearSelection();
            }
        } else if (isStaticTouch && touchDuration >= HOLD_DURATION) {
            // Длинное касание уже обработано в таймере
            // Ничего не делаем, объект уже в режиме перетаскивания
        }
    }
}

// Функции для управления интерфейсом
function toggleInstructions() {
    const modal = document.getElementById('instructions-modal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

function toggleLeftPanel() {
    const panel = document.getElementById('left-sidebar');
    const isOpening = !panel.classList.contains('open');

    panel.classList.toggle('open');

    // Закрываем правую панель если открыта
    const rightPanel = document.getElementById('sidebar');
    rightPanel.classList.remove('open');

    // Отключаем OrbitControls когда панель открыта
    if (isOpening) {
        controls.enabled = false;
    } else {
        controls.enabled = true;
    }
}

function toggleRightPanel() {
    const panel = document.getElementById('sidebar');
    const isOpening = !panel.classList.contains('open');

    panel.classList.toggle('open');

    // Закрываем левую панель если открыта
    const leftPanel = document.getElementById('left-sidebar');
    leftPanel.classList.remove('open');

    // Отключаем OrbitControls когда панель открыта
    if (isOpening) {
        controls.enabled = false;
    } else {
        controls.enabled = true;
    }
}

// Обновление мобильного интерфейса
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

// Переопределяем функцию togglePassMode для мобильного интерфейса
const originalTogglePassMode = togglePassMode;
togglePassMode = function () {
    originalTogglePassMode.call(this);
    updateMobileUI();
};

// Обновление размеров при изменении ориентации
window.addEventListener('orientationchange', function () {
    setTimeout(() => {
        detectMobile();
        onWindowResize();
    }, 100);
});

// Предотвращение масштабирования страницы на мобильных
document.addEventListener('touchmove', function (event) {
    if (event.scale !== 1) {
        event.preventDefault();
    }
}, { passive: false });

// Экспорт сценариев в файл
function exportScenarios() {
    const storageKey = `jugglingScenarios_${userId}`;
    const savedScenarios = JSON.parse(localStorage.getItem(storageKey) || '{}');

    if (Object.keys(savedScenarios).length === 0) {
        alert('Нет сценариев для экспорта');
        return;
    }

    const dataStr = JSON.stringify(savedScenarios, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'juggling_scenarios.json';
    link.click();

    alert('Сценарии экспортированы в файл juggling_scenarios.json');
}

// Импорт сценариев из файла
function importScenarios() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const importedScenarios = JSON.parse(e.target.result);
                const storageKey = `jugglingScenarios_${userId}`;
                const existingScenarios = JSON.parse(localStorage.getItem(storageKey) || '{}');

                // Объединяем существующие и импортированные сценарии
                const mergedScenarios = { ...existingScenarios, ...importedScenarios };
                localStorage.setItem(storageKey, JSON.stringify(mergedScenarios));

                updateScenarioGallery();
                alert(`Импортировано ${Object.keys(importedScenarios).length} сценариев`);
            } catch (error) {
                alert('Ошибка при импорте файла. Проверьте формат файла.');
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

// Система анимации
function addKeyframe() {
    const keyframe = {
        id: Date.now(),
        name: `Кадр ${keyframes.length + 1}`,
        // Сохраняем все объекты с их ID и состоянием видимости
        objects: {
            jugglers: jugglers.map(juggler => ({
                id: juggler.userData.id,
                x: juggler.position.x,
                y: juggler.position.y,
                z: juggler.position.z,
                rotationY: juggler.rotation.y,
                visible: juggler.visible
            })),
            cubes: cubes.map(cube => ({
                id: cube.userData.id,
                x: cube.position.x,
                y: cube.position.y,
                z: cube.position.z,
                rotationX: cube.rotation.x,
                rotationY: cube.rotation.y,
                rotationZ: cube.rotation.z,
                width: cube.userData.width,
                height: cube.userData.height,
                depth: cube.userData.depth,
                visible: cube.visible
            })),
            passes: passes.map(pass => ({
                id: pass.userData.id,
                juggler1Id: pass.userData.juggler1.userData.id,
                juggler2Id: pass.userData.juggler2.userData.id,
                count: pass.userData.count,
                color: pass.userData.color,
                height: pass.userData.height,
                visible: pass.visible
            }))
        }
    };

    keyframes.push(keyframe);
    updateKeyframesList();
    alert(`Ключевой кадр "${keyframe.name}" добавлен!`);
}

function clearKeyframes() {
    if (keyframes.length === 0) return;

    if (confirm('Удалить все ключевые кадры анимации?')) {
        keyframes = [];
        stopAnimation();
        updateKeyframesList();
    }
}

function deleteKeyframe(keyframeId) {
    keyframes = keyframes.filter(kf => kf.id !== keyframeId);
    if (keyframes.length === 0) {
        stopAnimation();
    }
    updateKeyframesList();
}

function updateKeyframesList() {
    const list = document.getElementById('keyframes-list');
    if (!list) return;

    list.innerHTML = '';

    keyframes.forEach((keyframe, index) => {
        const item = document.createElement('div');
        item.className = 'keyframe-item';
        if (index === currentKeyframe && isAnimating) {
            item.classList.add('active');
        }

        item.innerHTML = `
            <span onclick="goToKeyframe(${index})" style="cursor: pointer; flex: 1;">${keyframe.name}</span>
            <button class="keyframe-delete" onclick="deleteKeyframe(${keyframe.id})">×</button>
        `;

        list.appendChild(item);
    });
}

// Переход к определенному ключевому кадру для редактирования
function goToKeyframe(index) {
    if (index < 0 || index >= keyframes.length) return;

    // Если анимация запущена, не позволяем ручной переход
    if (isAnimating) {
        alert('Остановите анимацию для редактирования кадров');
        return;
    }

    const keyframe = keyframes[index];

    // Применяем состояние кадра
    applyKeyframeState(keyframe);

    // Показываем какой кадр активен для редактирования
    currentKeyframe = index;
    updateKeyframesList();

    alert(`Переход к кадру ${index + 1}. Теперь вы можете редактировать этот кадр: добавлять/удалять объекты, перемещать их. Создайте новый кадр для сохранения изменений или нажмите "Обновить кадр".`);
}

// Обновление текущего кадра
function updateCurrentKeyframe() {
    if (keyframes.length === 0) {
        alert('Сначала создайте ключевой кадр!');
        return;
    }

    if (currentKeyframe < 0 || currentKeyframe >= keyframes.length) {
        currentKeyframe = 0;
    }

    console.log('Обновляем кадр', currentKeyframe + 1);

    // Создаем новое состояние кадра
    const updatedKeyframe = {
        id: keyframes[currentKeyframe].id,
        name: keyframes[currentKeyframe].name,
        objects: {
            jugglers: jugglers.map(juggler => ({
                id: juggler.userData.id,
                x: juggler.position.x,
                y: juggler.position.y,
                z: juggler.position.z,
                rotationY: juggler.rotation.y,
                visible: juggler.visible
            })),
            cubes: cubes.map(cube => ({
                id: cube.userData.id,
                x: cube.position.x,
                y: cube.position.y,
                z: cube.position.z,
                rotationX: cube.rotation.x,
                rotationY: cube.rotation.y,
                rotationZ: cube.rotation.z,
                width: cube.userData.width,
                height: cube.userData.height,
                depth: cube.userData.depth,
                visible: cube.visible
            })),
            passes: passes.map(pass => ({
                id: pass.userData.id,
                juggler1Id: pass.userData.juggler1.userData.id,
                juggler2Id: pass.userData.juggler2.userData.id,
                count: pass.userData.count,
                color: pass.userData.color,
                height: pass.userData.height,
                visible: pass.visible
            }))
        }
    };

    // Заменяем кадр
    keyframes[currentKeyframe] = updatedKeyframe;
    updateKeyframesList();
    alert(`Кадр "${updatedKeyframe.name}" обновлен!`);
}

function toggleAnimation() {
    if (keyframes.length < 2) {
        alert('Добавьте минимум 2 ключевых кадра для анимации');
        return;
    }

    if (isAnimating) {
        stopAnimation();
    } else {
        startAnimation();
    }
}

function startAnimation() {
    if (keyframes.length < 2) return;

    isAnimating = true;
    currentKeyframe = 0;

    // Обновляем кнопки
    const desktopBtn = document.getElementById('animation-toggle');
    const mobileBtn = document.getElementById('mobile-animation-toggle');

    if (desktopBtn) {
        desktopBtn.textContent = '⏸ Остановить анимацию';
        desktopBtn.style.background = '#f44336';
    }
    if (mobileBtn) {
        mobileBtn.textContent = '⏸ Стоп';
        mobileBtn.classList.add('active');
    }

    // Применяем состояние первого кадра
    applyKeyframeState(keyframes[0]);

    // Переходим ко второму кадру
    currentKeyframe = 1;

    // Небольшая задержка перед началом анимации к следующему кадру
    setTimeout(() => {
        if (isAnimating) {
            animateToNextKeyframe();
        }
    }, 500);
}

function stopAnimation() {
    isAnimating = false;
    currentKeyframe = 0;

    if (animationInterval) {
        clearTimeout(animationInterval);
        animationInterval = null;
    }

    // Обновляем кнопки
    const desktopBtn = document.getElementById('animation-toggle');
    const mobileBtn = document.getElementById('mobile-animation-toggle');

    if (desktopBtn) {
        desktopBtn.textContent = '▶ Запустить анимацию';
        desktopBtn.style.background = '#4CAF50';
    }
    if (mobileBtn) {
        mobileBtn.textContent = '▶ Анимация';
        mobileBtn.classList.remove('active');
    }

    // Убираем флаг анимации (Three.js объекты не имеют classList)
    jugglers.forEach(juggler => {
        juggler.userData.isAnimated = false;
    });

    updateKeyframesList();
}

function animateToNextKeyframe() {
    if (!isAnimating || keyframes.length === 0) return;

    const keyframe = keyframes[currentKeyframe];

    // Анимируем к состоянию кадра
    animateToKeyframeState(keyframe);

    updateKeyframesList();

    // Переход к следующему кадру
    const duration = 2000 / animationSpeed;
    animationInterval = setTimeout(() => {
        currentKeyframe = (currentKeyframe + 1) % keyframes.length;

        // Если вернулись к первому кадру, делаем мгновенный переход
        if (currentKeyframe === 0) {
            applyKeyframeState(keyframes[0]);
            currentKeyframe = 1;

            setTimeout(() => {
                if (isAnimating) {
                    animateToNextKeyframe();
                }
            }, 500);
        } else {
            animateToNextKeyframe();
        }
    }, duration);
}

// Мгновенное применение состояния кадра
function applyKeyframeState(keyframe) {
    // Проверяем формат кадра
    if (keyframe.objects) {
        // Новый формат с поддержкой видимости
        applyNewKeyframeState(keyframe);
    } else if (keyframe.positions) {
        // Старый формат - только позиции жонглёров
        applyOldKeyframeState(keyframe);
    }
}

// Применение нового формата кадра
function applyNewKeyframeState(keyframe) {
    // Удаляем все существующие объекты из сцены
    [...jugglers, ...cubes, ...passes].forEach(obj => {
        scene.remove(obj);
    });

    // Очищаем массивы
    jugglers.length = 0;
    cubes.length = 0;
    passes.length = 0;

    // Создаем объекты из кадра
    keyframe.objects.jugglers.forEach(jugglerData => {
        const juggler = createJuggler();
        juggler.userData.id = jugglerData.id;
        juggler.position.set(jugglerData.x, jugglerData.y, jugglerData.z);
        juggler.rotation.y = jugglerData.rotationY;
        scene.add(juggler);
        jugglers.push(juggler);
    });

    keyframe.objects.cubes.forEach(cubeData => {
        const cube = createCubeFromData(cubeData);
        scene.add(cube);
        cubes.push(cube);
    });

    keyframe.objects.passes.forEach(passData => {
        // Находим жонглёров для перекидки
        const juggler1 = jugglers.find(j => j.userData.id === passData.juggler1Id);
        const juggler2 = jugglers.find(j => j.userData.id === passData.juggler2Id);

        if (juggler1 && juggler2) {
            const pass = createPassFromData(passData, juggler1, juggler2);
            scene.add(pass);
            passes.push(pass);
        }
    });

    updatePasses();
}

// Применение старого формата кадра
function applyOldKeyframeState(keyframe) {
    jugglers.forEach((juggler, index) => {
        juggler.visible = true;
        if (keyframe.positions[index]) {
            const pos = keyframe.positions[index];
            juggler.position.set(pos.x, pos.y, pos.z);
            juggler.rotation.y = pos.rotationY;
        }
    });

    cubes.forEach(cube => cube.visible = true);
    passes.forEach(pass => pass.visible = true);
    updatePasses();
}

// Плавная анимация к состоянию кадра
function animateToKeyframeState(keyframe) {
    if (keyframe.objects) {
        animateToNewKeyframeState(keyframe);
    } else if (keyframe.positions) {
        animateToOldKeyframeState(keyframe);
    }
}

// Анимация к новому формату кадра
function animateToNewKeyframeState(keyframe) {
    // Анимируем существующие объекты и создаем/удаляем новые

    // Обрабатываем жонглёров
    const currentJugglerIds = jugglers.map(j => j.userData.id);
    const targetJugglerIds = keyframe.objects.jugglers.map(j => j.id);

    // Удаляем жонглёров, которых нет в целевом кадре
    jugglers.forEach(juggler => {
        if (!targetJugglerIds.includes(juggler.userData.id)) {
            scene.remove(juggler);
        }
    });
    jugglers = jugglers.filter(j => targetJugglerIds.includes(j.userData.id));

    // Создаем новых жонглёров и анимируем существующих
    keyframe.objects.jugglers.forEach(jugglerData => {
        let juggler = jugglers.find(j => j.userData.id === jugglerData.id);

        if (!juggler) {
            // Создаем нового жонглёра
            juggler = createJuggler();
            juggler.userData.id = jugglerData.id;
            juggler.position.set(jugglerData.x, jugglerData.y, jugglerData.z);
            juggler.rotation.y = jugglerData.rotationY;
            scene.add(juggler);
            jugglers.push(juggler);
        } else {
            // Анимируем существующего жонглёра
            animateJugglerToPosition(juggler, jugglerData);
        }
    });

    // Аналогично для кубов
    const currentCubeIds = cubes.map(c => c.userData.id);
    const targetCubeIds = keyframe.objects.cubes.map(c => c.id);

    // Удаляем кубы, которых нет в целевом кадре
    cubes.forEach(cube => {
        if (!targetCubeIds.includes(cube.userData.id)) {
            scene.remove(cube);
        }
    });
    cubes = cubes.filter(c => targetCubeIds.includes(c.userData.id));

    // Создаем новые кубы и анимируем существующие
    keyframe.objects.cubes.forEach(cubeData => {
        let cube = cubes.find(c => c.userData.id === cubeData.id);

        if (!cube) {
            // Создаем новый куб
            cube = createCubeFromData(cubeData);
            scene.add(cube);
            cubes.push(cube);
        } else {
            // Анимируем существующий куб
            animateCubeToPosition(cube, cubeData);
        }
    });

    // Аналогично для перекидок
    const currentPassIds = passes.map(p => p.userData.id);
    const targetPassIds = keyframe.objects.passes.map(p => p.id);

    // Удаляем перекидки, которых нет в целевом кадре
    passes.forEach(pass => {
        if (!targetPassIds.includes(pass.userData.id)) {
            scene.remove(pass);
        }
    });
    passes = passes.filter(p => targetPassIds.includes(p.userData.id));

    // Создаем новые перекидки
    keyframe.objects.passes.forEach(passData => {
        let pass = passes.find(p => p.userData.id === passData.id);

        if (!pass) {
            // Находим жонглёров для перекидки
            const juggler1 = jugglers.find(j => j.userData.id === passData.juggler1Id);
            const juggler2 = jugglers.find(j => j.userData.id === passData.juggler2Id);

            if (juggler1 && juggler2) {
                pass = createPassFromData(passData, juggler1, juggler2);
                scene.add(pass);
                passes.push(pass);
            }
        }
    });

    updatePasses();
}

// Анимация к старому формату кадра
function animateToOldKeyframeState(keyframe) {
    jugglers.forEach((juggler, index) => {
        juggler.visible = true;
        if (keyframe.positions[index]) {
            animateJugglerToPosition(juggler, keyframe.positions[index]);
        }
    });

    cubes.forEach(cube => cube.visible = true);
    passes.forEach(pass => pass.visible = true);
}



// Анимация куба к позиции
function animateCubeToPosition(cube, targetData) {
    const startPos = {
        x: cube.position.x,
        y: cube.position.y,
        z: cube.position.z,
        rotationX: cube.rotation.x,
        rotationY: cube.rotation.y,
        rotationZ: cube.rotation.z
    };

    const duration = 1500 / animationSpeed;
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        cube.position.x = startPos.x + (targetData.x - startPos.x) * progress;
        cube.position.y = startPos.y + (targetData.y - startPos.y) * progress;
        cube.position.z = startPos.z + (targetData.z - startPos.z) * progress;
        cube.rotation.x = startPos.rotationX + (targetData.rotationX - startPos.rotationX) * progress;
        cube.rotation.y = startPos.rotationY + (targetData.rotationY - startPos.rotationY) * progress;
        cube.rotation.z = startPos.rotationZ + (targetData.rotationZ - startPos.rotationZ) * progress;

        if (progress < 1 && isAnimating) {
            requestAnimationFrame(animate);
        }
    }

    animate();
}

function animateJugglerToPosition(juggler, targetPos) {
    const startPos = {
        x: juggler.position.x,
        y: juggler.position.y,
        z: juggler.position.z,
        rotationY: juggler.rotation.y
    };

    const duration = 1500 / animationSpeed;
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-in-out)
        const easeProgress = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Интерполяция позиции
        juggler.position.x = startPos.x + (targetPos.x - startPos.x) * easeProgress;
        juggler.position.y = startPos.y + (targetPos.y - startPos.y) * easeProgress;
        juggler.position.z = startPos.z + (targetPos.z - startPos.z) * easeProgress;
        juggler.rotation.y = startPos.rotationY + (targetPos.rotationY - startPos.rotationY) * easeProgress;

        // Обновляем перекидки
        updatePasses();

        if (progress < 1 && isAnimating) {
            requestAnimationFrame(animate);
        }
    }

    animate();
}

// Обновление скорости анимации
function updateAnimationSpeed() {
    const speedSlider = document.getElementById('animationSpeed');
    const speedValue = document.getElementById('speedValue');

    if (speedSlider && speedValue) {
        animationSpeed = parseFloat(speedSlider.value);
        speedValue.textContent = animationSpeed.toFixed(1) + 'x';
    }
}

// Закрытие модального окна при клике вне его
document.getElementById('instructions-modal').addEventListener('click', function (event) {
    if (event.target === this) {
        toggleInstructions();
    }
});

// Функция принудительного обновления
function forceUpdate() {
    console.log('Принудительное обновление приложения...');

    // Очищаем localStorage (кроме пользовательских данных)
    const userScenarios = localStorage.getItem(`jugglingScenarios_${userId}`);
    const userIdBackup = localStorage.getItem('jugglingUserId');

    localStorage.clear();

    // Восстанавливаем пользовательские данные
    if (userIdBackup) localStorage.setItem('jugglingUserId', userIdBackup);
    if (userScenarios) localStorage.setItem(`jugglingScenarios_${userId}`, userScenarios);

    // Очищаем кэш Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
            if (registration) {
                registration.unregister().then(() => {
                    // Очищаем кэш браузера
                    if ('caches' in window) {
                        caches.keys().then(names => {
                            names.forEach(name => caches.delete(name));
                        });
                    }

                    // Перезагружаем страницу
                    window.location.reload(true);
                });
            }
        });
    } else {
        // Если Service Worker не поддерживается, просто перезагружаем
        window.location.reload(true);
    }
}

// Проверка при фокусе окна (когда пользователь возвращается на вкладку)
window.addEventListener('focus', () => {
    checkForUpdates();
});

// Проверка при изменении видимости страницы
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        checkForUpdates();
    }
});

// Настройка модального окна инструкций
document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('instructions-modal');
    const modalContent = modal.querySelector('.modal-content');

    // Отключаем OrbitControls когда модальное окно открыто
    const originalToggleInstructions = window.toggleInstructions;
    window.toggleInstructions = function () {
        const isVisible = modal.style.display === 'flex';
        originalToggleInstructions();

        // Управляем OrbitControls
        if (controls) {
            controls.enabled = isVisible; // Если закрываем - включаем, если открываем - отключаем
        }
    };

    // Настройка прокрутки для мобильных (аналогично панелям)
    modalContent.addEventListener('touchstart', function (e) {
        if (controls) controls.enabled = false;
    }, { passive: true });

    modalContent.addEventListener('touchmove', function (e) {
        e.stopPropagation();
    }, { passive: true });

    modalContent.addEventListener('touchend', function (e) {
        // OrbitControls включится при закрытии модального окна
    }, { passive: true });
});

