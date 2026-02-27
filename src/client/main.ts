import * as THREE from 'three';
import { LEVELS, collectLevelAssetUrls } from './game/levels';
import { getEscapeLog, recordEscapeLogEntry } from './game/escapeLog';
import { LevelController } from './game/LevelController';
import { GameStateManager } from './systems/GameStateManager';
import { InputManager } from './systems/InputManager';
import { SceneManager } from './systems/SceneManager';
import { UISystem } from './systems/UISystem';

const PLAYER_Y = 0.45;
const TOTAL_LEVEL_SLOTS = 9;
const STORAGE_KEY_UNLOCKED = 'xcaper.maxUnlockedPlayableLevel';

const createPlayerSunglasses = () => {
  const glasses = new THREE.Group();
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x101216,
    roughness: 0.4,
    metalness: 0.2,
    flatShading: true
  });
  const lensMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f1726,
    roughness: 0.15,
    metalness: 0.5,
    flatShading: true
  });

  const lensGeometry = new THREE.BoxGeometry(0.22, 0.11, 0.03);
  const leftLens = new THREE.Mesh(lensGeometry, lensMaterial);
  leftLens.position.set(-0.14, 0.2, 0.3);
  glasses.add(leftLens);

  const rightLens = leftLens.clone();
  rightLens.position.x = 0.14;
  glasses.add(rightLens);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.03), frameMaterial);
  bridge.position.set(0, 0.2, 0.3);
  glasses.add(bridge);

  const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.03), frameMaterial);
  topBar.position.set(0, 0.245, 0.3);
  glasses.add(topBar);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.2), frameMaterial);
  leftArm.position.set(-0.26, 0.2, 0.22);
  leftArm.rotation.y = 0.25;
  glasses.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.26;
  rightArm.rotation.y = -0.25;
  glasses.add(rightArm);

  return glasses;
};

const app = document.getElementById('app');
const joystickEl = document.getElementById('joystick');
const joystickKnobEl = document.getElementById('joystickKnob');
const splashEl = document.getElementById('splash');

if (!app || !joystickEl || !joystickKnobEl) {
  throw new Error('Missing required DOM elements.');
}

if (splashEl) {
  splashEl.style.background = 'transparent';
}

const ui = new UISystem();
const sceneManager = new SceneManager(app);
const inputManager = new InputManager(joystickEl, joystickKnobEl);
const state = new GameStateManager();

const playerMaterial = new THREE.MeshStandardMaterial({ 
  color: ui.settings.color,
  roughness: 0.65 
});

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.33, 0.65, 4, 8),
  playerMaterial
);

ui.onPlayerColorChange((newColor) => {
  playerMaterial.color.setHex(newColor);
});

player.add(createPlayerSunglasses());
player.position.set(0, PLAYER_Y, 0);
player.visible = false;
sceneManager.scene.add(player);

const levelController = new LevelController(LEVELS, {
  sceneManager,
  inputManager,
  ui,
  state,
  playerMesh: player,
  onCompleted: (index) => {
    recordEscapeLogEntry({
      levelNumber: index + 1,
      timeMs: state.getTimerValue(),
      levelCount: TOTAL_LEVEL_SLOTS
    });
    completedLevelIndexes.add(index);
    const nextUnlocked = Math.min(LEVELS.length, Math.max(maxUnlockedPlayableLevels, index + 2));
    if (nextUnlocked !== maxUnlockedPlayableLevels) {
      maxUnlockedPlayableLevels = nextUnlocked;
      localStorage.setItem(STORAGE_KEY_UNLOCKED, String(maxUnlockedPlayableLevels));
    }
    gameStarted = false;
    ui.showLevelComplete(index + 1);
  }
});

const preloadAssets = async (
  urls: string[],
  onProgress: (ratio: number) => void
): Promise<void> => {
  let loaded = 0;
  onProgress(0);

  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) {
          throw new Error(`Failed to preload: ${url}`);
        }
        await response.arrayBuffer();
      } catch (error) {
        console.warn('Preload warning:', error);
      } finally {
        loaded += 1;
        onProgress(loaded / urls.length);
      }
    })
  );
};

let gameStarted = false;
const completedLevelIndexes = new Set<number>();
const storedUnlockedRaw = Number(localStorage.getItem(STORAGE_KEY_UNLOCKED));
let maxUnlockedPlayableLevels = Number.isFinite(storedUnlockedRaw)
  ? Math.min(LEVELS.length, Math.max(1, Math.floor(storedUnlockedRaw)))
  : 1;

const showLevelSelect = (): void => {
  gameStarted = false;
  levelController.dispose();
  player.visible = false;
  ui.hideLevelComplete();
  ui.renderLevelSelect({
    totalSlots: TOTAL_LEVEL_SLOTS,
    availableLevels: LEVELS.length,
    unlockedPlayableLevels: maxUnlockedPlayableLevels,
    completedLevelIndexes
  });
  ui.showLevelSelect();
};

const showEscapeLog = (): void => {
  gameStarted = false;
  levelController.dispose();
  player.visible = false;
  ui.hideLevelComplete();
  ui.renderEscapeLog({
    totalSlots: TOTAL_LEVEL_SLOTS,
    logsByLevel: getEscapeLog(TOTAL_LEVEL_SLOTS)
  });
  ui.showEscapeLog();
};

const startLevel = (levelIndex: number): void => {
  if (levelIndex < 0 || levelIndex >= maxUnlockedPlayableLevels || levelIndex >= LEVELS.length) {
    return;
  }
  levelController.load(levelIndex);
  player.visible = true;
  gameStarted = true;
  ui.revealGame();
  ui.hideLevelComplete();
  ui.setStatus('Find the key and unlock the door.');
};

ui.onStart(() => {
  showLevelSelect();
});

ui.onOpenLevelSelect(() => {
  showLevelSelect();
});

ui.onLevelSelectBack(() => {
  ui.showSplash();
});

ui.onOpenEscapeLog(() => {
  showEscapeLog();
});

ui.onEscapeLogBack(() => {
  ui.showSplash();
});

ui.onLevelSelected((levelIndex) => {
  startLevel(levelIndex);
});

ui.onRestart(() => {
  gameStarted = true;
  levelController.restart();
  ui.setStatus('Find the key and unlock the door.');
});

ui.onNext(() => {
  const nextIndex = levelController.currentIndex + 1;
  if (nextIndex < maxUnlockedPlayableLevels && nextIndex < LEVELS.length) {
    startLevel(nextIndex);
    return;
  }
  showLevelSelect();
  ui.setStatus('Pick an unlocked level.');
});

// --- Splash Screen Floating Objects ---
const splashGroup = new THREE.Group();
sceneManager.scene.add(splashGroup);

const splashAmbient = new THREE.AmbientLight(0xffffff, 0.6);
splashGroup.add(splashAmbient);

const splashDirectional = new THREE.DirectionalLight(0xffffff, 1);
splashDirectional.position.set(5, 10, 7);
splashGroup.add(splashDirectional);

interface FloatingObj {
  mesh: THREE.Mesh;
  vX: number; vY: number; vZ: number;
  rX: number; rY: number; rZ: number;
}
const splashObjects: FloatingObj[] = [];
let nextSplashSpawn = 0;

const spawnFloatingObject = (ts: number, initialY?: number) => {
  const types = ['box', 'sphere', 'pyramid', 'cylinder'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  // Pick a vibrant, random color
  const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.6);
  const mat = new THREE.MeshStandardMaterial({ 
    color, 
    roughness: 0.3, 
    metalness: 0.4, 
    transparent: true, 
    opacity: 0.7 
  });

  let geo: any;
  const size = Math.random() * 0.8 + 0.3; // Random sizes
  
  if (type === 'box') geo = new THREE.BoxGeometry(size, size, size);
  else if (type === 'sphere') geo = new THREE.SphereGeometry(size * 0.6, 16, 16);
  else if (type === 'pyramid') geo = new THREE.ConeGeometry(size * 0.7, size * 1.2, 4); 
  else geo = new THREE.CylinderGeometry(size * 0.4, size * 0.4, size * 1.2, 16);

  const mesh = new THREE.Mesh(geo, mat);
  
  // Spawn at the bottom, randomly spread out
  const pos = new THREE.Vector3((Math.random() - 0.5) * 15, initialY ?? -6, (Math.random() - 0.5) * 10 - 2);
  mesh.position.copy(pos);
  splashGroup.add(mesh);

  splashObjects.push({
    mesh,
    vX: (Math.random() - 0.5) * 0.2,       // Drift slightly left/right
    vY: Math.random() * 0.8 + 0.4,         // Float upwards
    vZ: (Math.random() - 0.5) * 0.2,       // Drift slightly forward/back
    rX: (Math.random() - 0.5) * 1.5,       // Tumble
    rY: (Math.random() - 0.5) * 1.5,
    rZ: (Math.random() - 0.5) * 1.5
  });

  // Schedule next spawn (every 1.5 to 4 seconds)
  nextSplashSpawn = ts + Math.random() * 2500 + 1500; 
};

// Pre-spawn some objects so the screen isn't empty
for (let i = 0; i < 15; i++) {
  spawnFloatingObject(0, Math.random() * 15 - 6);
}

const updateSplashObjects = (ts: number, dt: number) => {
  if (!gameStarted) {
    splashGroup.visible = true;
    // Spawn new objects occasionally
    if (ts > nextSplashSpawn) {
      spawnFloatingObject(ts);
    }

    // Move and spin existing objects
    for (let i = splashObjects.length - 1; i >= 0; i--) {
      const obj = splashObjects[i];
      obj.mesh.position.x += obj.vX * dt;
      obj.mesh.position.y += obj.vY * dt;
      obj.mesh.position.z += obj.vZ * dt;
      obj.mesh.rotation.x += obj.rX * dt;
      obj.mesh.rotation.y += obj.rY * dt;
      obj.mesh.rotation.z += obj.rZ * dt;

      // Remove them when they float too high out of frame
      if (obj.mesh.position.y > 10) {
        splashGroup.remove(obj.mesh);
        obj.mesh.geometry.dispose();
        const material = obj.mesh.material;
        if (Array.isArray(material)) {
          material.forEach(m => m.dispose());
        } else {
          material.dispose();
        }
        splashObjects.splice(i, 1);
      }
    }
  } else {
    splashGroup.visible = false;
    if (splashObjects.length > 0) {
    // Game started! Quickly clean up all floating objects so the level is clear
    splashObjects.forEach(obj => {
      splashGroup.remove(obj.mesh);
      obj.mesh.geometry.dispose();
      const material = obj.mesh.material;
      if (Array.isArray(material)) {
        material.forEach(m => m.dispose());
      } else {
        material.dispose();
      }
    });
    splashObjects.length = 0;
    }
  }
};

const animate = (ts: number): void => {
  requestAnimationFrame(animate);
  const dt = sceneManager.getDelta();

  updateSplashObjects(ts, dt);

  if (gameStarted) {
    levelController.update(ts, dt);
    ui.tick(ts);
  }

  sceneManager.render();
};

requestAnimationFrame(animate);

void preloadAssets(collectLevelAssetUrls(LEVELS), (ratio) => {
  ui.setPreloadProgress(ratio);
}).then(() => {
  ui.setPreloadReady();
  ui.hidePreloader();
});

window.addEventListener('beforeunload', () => {
  levelController.dispose();
  inputManager.dispose();
  sceneManager.dispose();
});
