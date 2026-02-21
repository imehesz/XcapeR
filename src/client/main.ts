import * as THREE from 'three';
import { LEVELS, collectLevelAssetUrls } from './game/levels';
import { LevelController } from './game/LevelController';
import { GameStateManager } from './systems/GameStateManager';
import { InputManager } from './systems/InputManager';
import { SceneManager } from './systems/SceneManager';
import { UISystem } from './systems/UISystem';

const PLAYER_Y = 0.45;

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
player.position.set(0, PLAYER_Y, 0);
sceneManager.scene.add(player);

const levelController = new LevelController(LEVELS, {
  sceneManager,
  inputManager,
  ui,
  state,
  playerMesh: player,
  onCompleted: (index) => {
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

ui.onStart(() => {
  ui.revealGame();
  if (!gameStarted) {
    gameStarted = true;
    levelController.restart();
    ui.setStatus('Move the character, find the key, unlock the door.');
  }
});

ui.onRestart(() => {
  levelController.restart();
  ui.setStatus(`Level ${levelController.currentIndex + 1} restarted.`);
});

ui.onNext(() => {
  levelController.next();
  ui.setStatus(`Level ${levelController.currentIndex + 1} started.`);
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
