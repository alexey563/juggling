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
    controls.addEventListener('start', function() {
        controlsActive = true;
    });
    
    controls.addEventListener('end', function() {
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
        id: jugglers.length,
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
        id: cubes.length, 
        height: height,
        width: width,
        depth: depth
    };
    
    scene.add(cube);
    cubes.push(cube);
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
    
    // Проверка всех пар перекидок
    for (let i = 0; i < passes.length; i++) {
        for (let j = i + 1; j < passes.length; j++) {
            const pass1 = passes[i];
            const pass2 = passes[j];
            
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
        updateSinglePass(pass);
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
            juggler1Index: jugglers.indexOf(pass.userData.juggler1),
            juggler2Index: jugglers.indexOf(pass.userData.juggler2),
            count: pass.userData.count,
            color: pass.userData.color,
            height: pass.userData.height
        }))
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
    scenario.jugglers.forEach(jugglerData => {
        const juggler = createJuggler();
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
            id: cubes.length,
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
        passCountField.addEventListener('input', function() {
            mobilePassCountField.value = this.value;
        });
        
        mobilePassCountField.addEventListener('input', function() {
            passCountField.value = this.value;
        });
    }
}

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    init();
    updateScenarioGallery();
    detectMobile();
    updateMobileUI();
    syncFields();
    setupPanelScrolling();
});

// Настройка прокрутки для панелей
function setupPanelScrolling() {
    const leftPanel = document.getElementById('left-sidebar');
    const rightPanel = document.getElementById('sidebar');
    
    // Отключаем OrbitControls при касании панелей
    [leftPanel, rightPanel].forEach(panel => {
        panel.addEventListener('touchstart', function(e) {
            controls.enabled = false;
        }, { passive: true });
        
        panel.addEventListener('touchend', function(e) {
            // Включаем OrbitControls обратно только если панель закрыта
            setTimeout(() => {
                if (!panel.classList.contains('open')) {
                    controls.enabled = true;
                }
            }, 100);
        }, { passive: true });
        
        // Предотвращаем всплытие событий прокрутки
        panel.addEventListener('touchmove', function(e) {
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
togglePassMode = function() {
    originalTogglePassMode.call(this);
    updateMobileUI();
};

// Обновление размеров при изменении ориентации
window.addEventListener('orientationchange', function() {
    setTimeout(() => {
        detectMobile();
        onWindowResize();
    }, 100);
});

// Предотвращение масштабирования страницы на мобильных
document.addEventListener('touchmove', function(event) {
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
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
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
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedScenarios = JSON.parse(e.target.result);
                const storageKey = `jugglingScenarios_${userId}`;
                const existingScenarios = JSON.parse(localStorage.getItem(storageKey) || '{}');
                
                // Объединяем существующие и импортированные сценарии
                const mergedScenarios = {...existingScenarios, ...importedScenarios};
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

// Закрытие модального окна при клике вне его
document.getElementById('instructions-modal').addEventListener('click', function(event) {
    if (event.target === this) {
        toggleInstructions();
    }
});

// Предотвращение закрытия модального окна при прокрутке на мобильных
document.getElementById('instructions-modal').addEventListener('touchmove', function(event) {
    // Разрешаем прокрутку только внутри modal-content
    if (!event.target.closest('.modal-content')) {
        event.preventDefault();
    }
}, { passive: false });

