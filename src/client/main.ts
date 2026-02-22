import * as THREE from 'three';
import { LEVELS, collectLevelAssetUrls } from './game/levels';
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

if (!app || !joystickEl || !joystickKnobEl) {
  throw new Error('Missing required DOM elements.');
}

const ui = new UISystem();
const sceneManager = new SceneManager(app);
const inputManager = new InputManager(joystickEl, joystickKnobEl);
const state = new GameStateManager();

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.33, 0.65, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0x7ee787, roughness: 0.65 })
);
player.add(createPlayerSunglasses());
player.position.set(0, PLAYER_Y, 0);
sceneManager.scene.add(player);

const levelController = new LevelController(LEVELS, {
  sceneManager,
  inputManager,
  ui,
  state,
  playerMesh: player,
  onCompleted: (index) => {
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
  ui.hideLevelComplete();
  ui.renderLevelSelect({
    totalSlots: TOTAL_LEVEL_SLOTS,
    availableLevels: LEVELS.length,
    unlockedPlayableLevels: maxUnlockedPlayableLevels,
    completedLevelIndexes
  });
  ui.showLevelSelect();
};

const startLevel = (levelIndex: number): void => {
  if (levelIndex < 0 || levelIndex >= maxUnlockedPlayableLevels || levelIndex >= LEVELS.length) {
    return;
  }
  levelController.load(levelIndex);
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

levelController.load(0);

const animate = (ts: number): void => {
  requestAnimationFrame(animate);
  const dt = sceneManager.getDelta();

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
