import * as THREE from 'three';
import { Door } from './entities/Door';
import { LEVELS, type LevelConfig } from './game/levels';
import { LevelController } from './game/LevelController';
import { UISystem } from './systems/UISystem';
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
const KEY_PICKUP_RADIUS = 0.75;
const DOOR_TOUCH_RADIUS = 1.05;

const app = document.getElementById('app');
const joystickEl = document.getElementById('joystick');
const joystickKnobEl = document.getElementById('joystickKnob');

if (
  !app ||
  !joystickEl ||
  !joystickKnobEl
) {
  throw new Error('Missing required DOM elements.');
}

const ui = new UISystem();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const FIT_MARGIN = 1.12;
const cameraAspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -8 * cameraAspect,
  8 * cameraAspect,
  8,
  -8,
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
let levelFinished = false;
let gameStartTs = performance.now();

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

let wasTouchingDoor = false;

const fitCameraToRoom = (): void => {
  const aspect = window.innerWidth / window.innerHeight;
  const roomBounds = new THREE.Box3(
    new THREE.Vector3(-ROOM_HALF, 0, -ROOM_HALF),
    new THREE.Vector3(ROOM_HALF, WALL_HEIGHT, ROOM_HALF)
  );

  const corners = [
    new THREE.Vector3(roomBounds.min.x, roomBounds.min.y, roomBounds.min.z),
    new THREE.Vector3(roomBounds.min.x, roomBounds.min.y, roomBounds.max.z),
    new THREE.Vector3(roomBounds.min.x, roomBounds.max.y, roomBounds.min.z),
    new THREE.Vector3(roomBounds.min.x, roomBounds.max.y, roomBounds.max.z),
    new THREE.Vector3(roomBounds.max.x, roomBounds.min.y, roomBounds.min.z),
    new THREE.Vector3(roomBounds.max.x, roomBounds.min.y, roomBounds.max.z),
    new THREE.Vector3(roomBounds.max.x, roomBounds.max.y, roomBounds.min.z),
    new THREE.Vector3(roomBounds.max.x, roomBounds.max.y, roomBounds.max.z)
  ];

  camera.updateMatrixWorld(true);

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const corner of corners) {
    const view = corner.clone().applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, view.x);
    maxX = Math.max(maxX, view.x);
    minY = Math.min(minY, view.y);
    maxY = Math.max(maxY, view.y);
  }

  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const halfWidth = ((maxX - minX) * 0.5) * FIT_MARGIN;
  const halfHeight = ((maxY - minY) * 0.5) * FIT_MARGIN;

  const fittedHalfHeight = Math.max(halfHeight, halfWidth / aspect);
  const fittedHalfWidth = fittedHalfHeight * aspect;

  camera.left = centerX - fittedHalfWidth;
  camera.right = centerX + fittedHalfWidth;
  camera.top = centerY + fittedHalfHeight;
  camera.bottom = centerY - fittedHalfHeight;
  camera.updateProjectionMatrix();
};

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
player.position.set(LEVELS[0].playerStart.x, PLAYER_Y, LEVELS[0].playerStart.z);
scene.add(player);

const keyMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.45, 0.22, 0.22),
  new THREE.MeshStandardMaterial({ color: 0xe9c46a, metalness: 0.35, roughness: 0.2 })
);
keyMesh.position.set(LEVELS[0].keyPosition.x, 0.65, LEVELS[0].keyPosition.z);
scene.add(keyMesh);

const keyLight = new THREE.PointLight(0xffd76a, 14, 8);
keyLight.position.set(LEVELS[0].keyPosition.x, 2.1, LEVELS[0].keyPosition.z);
scene.add(keyLight);

const door = new Door();
scene.add(door.object3D);

const doorFrame = new THREE.Mesh(
  new THREE.BoxGeometry(2.1, 3.05, 0.36),
  new THREE.MeshStandardMaterial({ color: 0x3a2a22 })
);
doorFrame.position.set(0, 1.5, 4.47);
scene.add(doorFrame);

const clock = new THREE.Clock();

const setStatus = (message: string, tone: 'normal' | 'good' = 'normal'): void => {
  ui.setStatus(message, tone);
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

const resetInput = (): void => {
  keyState.forward = false;
  keyState.backward = false;
  keyState.left = false;
  keyState.right = false;
  joystickState.pointerId = -1;
  joystickState.x = 0;
  joystickState.y = 0;
  joystickKnobEl.style.transform = 'translate(-50%, -50%)';
};

const applyLevel = (level: LevelConfig, levelIndex: number): void => {
  gameState = createInitialState();
  levelFinished = false;
  gameStartTs = performance.now();
  wasTouchingDoor = false;
  ui.resetStatusTimer();

  player.position.set(level.playerStart.x, PLAYER_Y, level.playerStart.z);
  player.rotation.y = 0;

  keyMesh.position.set(level.keyPosition.x, 0.65, level.keyPosition.z);
  keyLight.position.set(level.keyPosition.x, 2.1, level.keyPosition.z);
  if (!scene.children.includes(keyMesh)) {
    scene.add(keyMesh);
  }

  door.reset();
  resetInput();
  ui.setLevelLabel(levelIndex + 1);
  ui.hideLevelComplete();
  syncHud();
};

const levelController = new LevelController(LEVELS, applyLevel);

const syncHud = (): void => {
  ui.setTimer(gameState.timerValue);
  ui.setInventoryActive(gameState.isKeyCollected);
};

const updateMovement = (dt: number): void => {
  const inputX = Number(keyState.right) - Number(keyState.left) + joystickState.x;
  const inputZ = Number(keyState.forward) - Number(keyState.backward) + joystickState.y;
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

const checkKeyPickup = (): void => {
  if (gameState.isKeyCollected) {
    return;
  }

  const dx = player.position.x - keyMesh.position.x;
  const dz = player.position.z - keyMesh.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance > KEY_PICKUP_RADIUS) {
    return;
  }

  gameState = collectKey(gameState);
  scene.remove(keyMesh);
  setStatus('Key collected.', 'good');
  beep(740, 120);
  syncHud();
};

const checkDoorTouch = (): void => {
  if (levelFinished) {
    return;
  }

  if (gameState.isDoorOpen) {
    wasTouchingDoor = true;
    return;
  }

  const doorPoint = door.object3D.position;
  const dx = player.position.x - doorPoint.x;
  const dz = player.position.z - doorPoint.z;
  const distance = Math.hypot(dx, dz);
  const isTouchingDoor = distance <= DOOR_TOUCH_RADIUS;

  if (!isTouchingDoor) {
    wasTouchingDoor = false;
    return;
  }

  if (!canOpenDoor(gameState.isKeyCollected)) {
    if (!wasTouchingDoor) {
      setStatus('Door is locked. Find the key.');
      door.lockedShake();
      beep(180, 160);
    }
    wasTouchingDoor = true;
    return;
  }

  gameState = openDoor(gameState);
  void door.open();
  levelFinished = true;
  setStatus('Door opened. You escaped.', 'good');
  beep(880, 180);
  syncHud();
  ui.showLevelComplete(levelController.currentIndex + 1);
  wasTouchingDoor = true;
};

const animate = (ts: number): void => {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameStarted && !levelFinished && !gameState.isDoorOpen) {
    gameState = updateTimer(gameState, ts - gameStartTs);
    syncHud();
  }

  if (gameStarted) {
    if (!levelFinished) {
      updateMovement(dt);
      checkKeyPickup();
      checkDoorTouch();
    }
    keyMesh.rotation.y += dt * 1.8;
    ui.tick(ts);
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

window.addEventListener('resize', () => {
  fitCameraToRoom();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (e: KeyboardEvent) => onKeyChange(e, true));
window.addEventListener('keyup', (e: KeyboardEvent) => onKeyChange(e, false));

joystickEl.addEventListener(
  'touchstart',
  (event: TouchEvent) => {
    if (joystickState.pointerId !== -1) {
      return;
    }

    for (const touch of event.changedTouches) {
      joystickState.pointerId = touch.identifier;
      handleJoystickMove(touch.clientX, touch.clientY);
      break;
    }

    event.preventDefault();
  },
  { passive: false }
);

joystickEl.addEventListener(
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

window.addEventListener('touchend', (event: TouchEvent) => {
  for (const touch of event.changedTouches) {
    if (touch.identifier === joystickState.pointerId) {
      joystickState.pointerId = -1;
      joystickState.x = 0;
      joystickState.y = 0;
      resetJoystickVisual();
    }
  }
});

window.addEventListener('touchcancel', () => {
  joystickState.pointerId = -1;
  joystickState.x = 0;
  joystickState.y = 0;
  resetJoystickVisual();
});

ui.onStart(() => {
  ui.revealGame();
  if (!gameStarted) {
    gameStarted = true;
    levelController.restart();
    setStatus('Move the character, find the key, unlock the door.');
  }
});

ui.onRestart(() => {
  levelController.restart();
  setStatus(`Level ${levelController.currentIndex + 1} restarted.`);
});

ui.onNext(() => {
  levelController.next();
  setStatus(`Level ${levelController.currentIndex + 1} started.`);
});

levelController.load(0);
fitCameraToRoom();
requestAnimationFrame(animate);
