import * as THREE from 'three';
import { Door } from './entities/Door';
import {
  createInitialState,
  collectKey,
  openDoor,
  updateTimer,
  type GameState
} from '../shared/state';
import { canOpenDoor } from '../shared/puzzles/KeyLogic';
import { resolvePlayerMovement, type RoomCollisionConfig } from '../shared/CollisionMath';

const ROOM_HALF = 5;
const WALL_HEIGHT = ROOM_HALF;
const PLAYER_Y = 0.45;
const MOVE_SPEED = 3.1;

const app = document.getElementById('app');
const splash = document.getElementById('splash');
const hud = document.getElementById('hud');
const aboutModal = document.getElementById('aboutModal');
const optionsModal = document.getElementById('optionsModal');
const startBtn = document.getElementById('startBtn');
const aboutBtn = document.getElementById('aboutBtn');
const optionsBtn = document.getElementById('optionsBtn');
const aboutCloseBtn = document.getElementById('aboutCloseBtn');
const optionsCloseBtn = document.getElementById('optionsCloseBtn');
const timerEl = document.getElementById('timer');
const inventoryEl = document.getElementById('inventory');
const statusEl = document.getElementById('status');
const joystickEl = document.getElementById('joystick');
const joystickKnobEl = document.getElementById('joystickKnob');

if (
  !app ||
  !splash ||
  !hud ||
  !aboutModal ||
  !optionsModal ||
  !startBtn ||
  !aboutBtn ||
  !optionsBtn ||
  !aboutCloseBtn ||
  !optionsCloseBtn ||
  !timerEl ||
  !inventoryEl ||
  !statusEl ||
  !joystickEl ||
  !joystickKnobEl
) {
  throw new Error('Missing required DOM elements.');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const ORTHO_SIZE = 7.5;
const cameraAspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -ORTHO_SIZE * cameraAspect,
  ORTHO_SIZE * cameraAspect,
  ORTHO_SIZE,
  -ORTHO_SIZE,
  0.1,
  100
);
camera.position.set(10, 9, 10);
camera.lookAt(0, 1.2, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const roomCollision: RoomCollisionConfig = {
  minX: -ROOM_HALF + 0.1,
  maxX: ROOM_HALF - 0.1,
  minZ: -ROOM_HALF + 0.1,
  maxZ: ROOM_HALF - 0.1,
  playerRadius: 0.38,
  closedDoorBounds: {
    minX: -0.95,
    maxX: 0.95,
    minZ: 4.05,
    maxZ: 4.9
  }
};

let gameState: GameState = createInitialState();
let gameStarted = false;
let gameStartTs = performance.now();
let lastStatusTs = 0;

const keyState = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

const joystickState = {
  x: 0,
  y: 0,
  pointerId: -1
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const interactables: any[] = [];

const ambient = new THREE.AmbientLight(0xffffff, 0.72);
scene.add(ambient);

const mainLight = new THREE.DirectionalLight(0xffffff, 0.75);
mainLight.position.set(7, 10, 4);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x7aa7ff, 0.35);
fillLight.position.set(-8, 6, -6);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2),
  new THREE.MeshStandardMaterial({ color: 0x263142, roughness: 0.92, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
scene.add(floor);

const roomFrame = new THREE.Mesh(
  new THREE.BoxGeometry(ROOM_HALF * 2, WALL_HEIGHT, ROOM_HALF * 2),
  new THREE.MeshStandardMaterial({
    color: 0x4a617f,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    roughness: 1
  })
);
roomFrame.position.set(0, WALL_HEIGHT * 0.5, 0);
scene.add(roomFrame);

const grid = new THREE.GridHelper(ROOM_HALF * 2, 10, 0x3b4b63, 0x253246);
grid.position.y = 0.01;
scene.add(grid);

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.33, 0.65, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0x7ee787, roughness: 0.65 })
);
player.position.set(-4, PLAYER_Y, -4);
scene.add(player);

const keyMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.45, 0.22, 0.22),
  new THREE.MeshStandardMaterial({ color: 0xe9c46a, metalness: 0.35, roughness: 0.2 })
);
keyMesh.position.set(4, 0.65, -4);
scene.add(keyMesh);
interactables.push(keyMesh);

const keyLight = new THREE.PointLight(0xffd76a, 14, 8);
keyLight.position.set(4, 2.1, -4);
scene.add(keyLight);

const door = new Door();
scene.add(door.object3D);
interactables.push(door.object3D);

const doorFrame = new THREE.Mesh(
  new THREE.BoxGeometry(2.1, 3.05, 0.36),
  new THREE.MeshStandardMaterial({ color: 0x3a2a22 })
);
doorFrame.position.set(0, 1.5, 4.47);
scene.add(doorFrame);

const clock = new THREE.Clock();

const formatTimer = (ms: number): string => {
  const totalCentiseconds = Math.floor(ms / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`;
};

const setStatus = (message: string, tone: 'normal' | 'good' = 'normal'): void => {
  statusEl.textContent = message;
  statusEl.classList.add('visible');
  statusEl.classList.toggle('good', tone === 'good');
  lastStatusTs = performance.now();
};

const beep = (frequency: number, durationMs: number): void => {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  const audioCtx = new AudioCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.frequency.value = frequency;
  osc.type = 'triangle';
  gain.gain.value = 0.04;

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  setTimeout(() => {
    osc.stop();
    void audioCtx.close();
  }, durationMs);
};

const syncHud = (): void => {
  timerEl.textContent = formatTimer(gameState.timerValue);
  inventoryEl.classList.toggle('active', gameState.isKeyCollected);
};

const removeInteractable = (target: any): void => {
  const idx = interactables.indexOf(target);
  if (idx >= 0) {
    interactables.splice(idx, 1);
  }
};

const tryInteract = (clientX: number, clientY: number): void => {
  if (!gameStarted) {
    return;
  }

  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(interactables, true);
  if (!hits.length) {
    return;
  }

  const root = hits[0].object === keyMesh ? keyMesh : door.object3D;

  if (root === keyMesh && !gameState.isKeyCollected) {
    gameState = collectKey(gameState);
    scene.remove(keyMesh);
    removeInteractable(keyMesh);
    setStatus('Key collected.', 'good');
    beep(740, 120);
    syncHud();
    return;
  }

  if (root === door.object3D && !gameState.isDoorOpen) {
    if (!canOpenDoor(gameState.isKeyCollected)) {
      setStatus('Door is locked. Find the key.');
      door.lockedShake();
      beep(180, 160);
      return;
    }

    gameState = openDoor(gameState);
    void door.open();
    setStatus('Door opened. You escaped.', 'good');
    beep(880, 180);
    syncHud();
  }
};

const updateMovement = (dt: number): void => {
  const inputX = Number(keyState.right) - Number(keyState.left) + joystickState.x;
  const inputZ = Number(keyState.forward) - Number(keyState.backward) - joystickState.y;
  const length = Math.hypot(inputX, inputZ);

  if (length < 0.001) {
    return;
  }

  const nx = inputX / length;
  const nz = inputZ / length;

  const previous = { x: player.position.x, z: player.position.z };
  const next = {
    x: player.position.x + nx * MOVE_SPEED * dt,
    z: player.position.z + nz * MOVE_SPEED * dt
  };

  const resolved = resolvePlayerMovement(next, previous, gameState.isDoorOpen, roomCollision);
  player.position.x = resolved.x;
  player.position.z = resolved.z;
  player.rotation.y = Math.atan2(nx, nz);
};

const animate = (ts: number): void => {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!gameState.isDoorOpen) {
    gameState = updateTimer(gameState, ts - gameStartTs);
    syncHud();
  }

  if (gameStarted) {
    updateMovement(dt);
    keyMesh.rotation.y += dt * 1.8;

    if (statusEl.classList.contains('visible') && ts - lastStatusTs > 1800) {
      statusEl.classList.remove('visible');
    }
  }

  renderer.render(scene, camera);
};

const onKeyChange = (event: KeyboardEvent, pressed: boolean): void => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      keyState.backward = pressed;
      break;
    case 'ArrowDown':
    case 'KeyS':
      keyState.forward = pressed;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      keyState.left = pressed;
      break;
    case 'ArrowRight':
    case 'KeyD':
      keyState.right = pressed;
      break;
    default:
      return;
  }

  event.preventDefault();
};

const resetJoystickVisual = (): void => {
  joystickKnobEl.style.transform = 'translate(-50%, -50%)';
};

const handleJoystickMove = (clientX: number, clientY: number): void => {
  const rect = joystickEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const radius = rect.width * 0.33;
  const len = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(radius, len);
  const nx = (dx / len) * clamped;
  const ny = (dy / len) * clamped;

  joystickState.x = nx / radius;
  joystickState.y = ny / radius;

  joystickKnobEl.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
};

const isInside = (el: HTMLElement, clientX: number, clientY: number): boolean => {
  const rect = el.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
};

window.addEventListener('resize', () => {
  const nextAspect = window.innerWidth / window.innerHeight;
  camera.left = -ORTHO_SIZE * nextAspect;
  camera.right = ORTHO_SIZE * nextAspect;
  camera.top = ORTHO_SIZE;
  camera.bottom = -ORTHO_SIZE;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (e: KeyboardEvent) => onKeyChange(e, true));
window.addEventListener('keyup', (e: KeyboardEvent) => onKeyChange(e, false));

renderer.domElement.addEventListener('click', (e: MouseEvent) => {
  tryInteract(e.clientX, e.clientY);
});

renderer.domElement.addEventListener(
  'touchstart',
  (event: TouchEvent) => {
    for (const touch of event.changedTouches) {
      if (isInside(joystickEl, touch.clientX, touch.clientY) && joystickState.pointerId === -1) {
        joystickState.pointerId = touch.identifier;
        handleJoystickMove(touch.clientX, touch.clientY);
        continue;
      }

      tryInteract(touch.clientX, touch.clientY);
    }
  },
  { passive: false }
);

renderer.domElement.addEventListener(
  'touchmove',
  (event: TouchEvent) => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === joystickState.pointerId) {
        handleJoystickMove(touch.clientX, touch.clientY);
      }
    }

    event.preventDefault();
  },
  { passive: false }
);

renderer.domElement.addEventListener('touchend', (event: TouchEvent) => {
  for (const touch of event.changedTouches) {
    if (touch.identifier === joystickState.pointerId) {
      joystickState.pointerId = -1;
      joystickState.x = 0;
      joystickState.y = 0;
      resetJoystickVisual();
    }
  }
});

renderer.domElement.addEventListener('touchcancel', () => {
  joystickState.pointerId = -1;
  joystickState.x = 0;
  joystickState.y = 0;
  resetJoystickVisual();
});

startBtn.addEventListener('click', () => {
  splash.classList.add('hidden');
  hud.classList.remove('hidden');

  if (!gameStarted) {
    gameStarted = true;
    syncHud();
    setStatus('Move the character, find the key, unlock the door.');
  }
});

aboutBtn.addEventListener('click', () => {
  aboutModal.classList.remove('hidden');
});

optionsBtn.addEventListener('click', () => {
  optionsModal.classList.remove('hidden');
});

aboutCloseBtn.addEventListener('click', () => {
  aboutModal.classList.add('hidden');
});

optionsCloseBtn.addEventListener('click', () => {
  optionsModal.classList.add('hidden');
});

syncHud();
requestAnimationFrame(animate);
