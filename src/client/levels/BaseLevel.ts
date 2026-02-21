import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Door } from '../entities/Door';
import { PickupKey } from '../entities/PickupKey';
import { type LevelConfig, type LevelObjectConfig } from '../game/levels';
import { CollisionSystem } from '../systems/CollisionSystem';
import { type GameStateManager } from '../systems/GameStateManager';
import { type InputManager } from '../systems/InputManager';
import { type SceneManager } from '../systems/SceneManager';
import { type UISystem } from '../systems/UISystem';
import { canOpenDoor } from '../../shared/puzzles/KeyLogic';

export interface LevelDependencies {
  sceneManager: SceneManager;
  inputManager: InputManager;
  ui: UISystem;
  state: GameStateManager;
  playerMesh: any;
  onCompleted: () => void;
}

const ROOM_EDGE_PADDING = 0.1;

export class BaseLevel {
  protected readonly config: LevelConfig;
  protected readonly deps: LevelDependencies;
  protected readonly worldRoot: any;
  protected readonly objectAnchors = new Map<string, any>();

  private readonly disposers: Array<() => void> = [];
  private readonly pickups: PickupKey[] = [];

  private collisionSystem: CollisionSystem;
  private door: Door | null = null;
  private doorObject: LevelObjectConfig | null = null;
  private startTs = 0;
  private finished = false;
  private wasTouchingDoor = false;

  protected readonly virtualPlayer = { x: 0, z: 0 };

  constructor(config: LevelConfig, deps: LevelDependencies) {
    this.config = config;
    this.deps = deps;

    this.worldRoot = new THREE.Group();
    this.deps.sceneManager.root.add(this.worldRoot);

    const roomHalf = this.config.environment.roomHalf;
    this.collisionSystem = new CollisionSystem({
      minX: -roomHalf + ROOM_EDGE_PADDING,
      maxX: roomHalf - ROOM_EDGE_PADDING,
      minZ: -roomHalf + ROOM_EDGE_PADDING,
      maxZ: roomHalf - ROOM_EDGE_PADDING,
      playerRadius: this.config.player.radius
    });
  }

  initialize(): void {
    this.deps.state.reset();
    this.deps.inputManager.reset();
    this.startTs = performance.now();
    this.finished = false;
    this.wasTouchingDoor = false;

    this.deps.sceneManager.setEnvironment(this.config.environment);
    this.deps.sceneManager.fitCameraToRoom(this.config.environment.roomHalf, this.config.environment.wallHeight);
    this.buildRoom();
    this.spawnObjects();
    this.buildCollisionMap();

    this.virtualPlayer.x = this.config.player.spawn.x;
    this.virtualPlayer.z = this.config.player.spawn.z;
    this.worldRoot.position.set(-this.virtualPlayer.x, 0, -this.virtualPlayer.z);
    this.deps.playerMesh.position.set(0, 0.45, 0);
    this.deps.playerMesh.rotation.y = this.config.player.rotationY;

    this.deps.ui.setTimer(0);
    this.deps.ui.setInventoryActive(false);
  }

  update(ts: number, dt: number): void {
    if (!this.finished && !this.deps.state.getDoorOpen()) {
      this.deps.state.updateTimer(ts - this.startTs);
      this.deps.ui.setTimer(this.deps.state.getTimerValue());
    }

    if (!this.finished) {
      this.updateMovement(dt);
      this.checkKeyPickups();
      this.checkDoorTouch();
      this.updateCustom(ts, dt);
    }

    for (const pickup of this.pickups) {
      pickup.update(dt);
    }
  }

  teardown(): void {
    for (const pickup of this.pickups) {
      pickup.dispose(this.worldRoot);
    }
    this.pickups.length = 0;

    if (this.door) {
      this.worldRoot.remove(this.door.object3D);
      this.door.dispose();
      this.door = null;
    }

    for (const anchor of this.objectAnchors.values()) {
      this.disposeObjectTree(anchor);
      this.worldRoot.remove(anchor);
    }
    this.objectAnchors.clear();

    for (const dispose of this.disposers) {
      dispose();
    }
    this.disposers.length = 0;

    this.disposeObjectTree(this.worldRoot);
    this.deps.sceneManager.root.remove(this.worldRoot);
  }

  protected updateCustom(_ts: number, _dt: number): void {
    // Intended override point for level-specific behavior.
  }

  protected getObjectAnchor(id: string): any | undefined {
    return this.objectAnchors.get(id);
  }

  protected findObjectConfig(id: string): LevelObjectConfig | undefined {
    return this.config.objects.find((object) => object.id === id);
  }

  protected getVirtualPlayerPosition(): { x: number; z: number } {
    return { ...this.virtualPlayer };
  }

  private buildRoom(): void {
    const environment = this.config.environment;
    const roomHalf = environment.roomHalf;
    const wallHeight = environment.wallHeight;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(roomHalf * 2, roomHalf * 2),
      new THREE.MeshStandardMaterial({ color: environment.floorColor, roughness: 0.92, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.worldRoot.add(floor);

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: environment.wallColor,
      transparent: true,
      opacity: environment.wallOpacity,
      side: THREE.DoubleSide,
      roughness: 1
    });
    const wallThickness = 0.12;

    if (environment.visibleWalls.left) {
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, roomHalf * 2), wallMaterial);
      leftWall.position.set(-roomHalf, wallHeight * 0.5, 0);
      this.worldRoot.add(leftWall);
    }

    if (environment.visibleWalls.right) {
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, roomHalf * 2), wallMaterial);
      rightWall.position.set(roomHalf, wallHeight * 0.5, 0);
      this.worldRoot.add(rightWall);
    }

    if (environment.visibleWalls.back) {
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomHalf * 2, wallHeight, wallThickness), wallMaterial);
      backWall.position.set(0, wallHeight * 0.5, -roomHalf);
      this.worldRoot.add(backWall);
    }

    if (environment.visibleWalls.front) {
      const frontWall = new THREE.Mesh(new THREE.BoxGeometry(roomHalf * 2, wallHeight, wallThickness), wallMaterial);
      frontWall.position.set(0, wallHeight * 0.5, roomHalf);
      this.worldRoot.add(frontWall);
    }

    const grid = new THREE.GridHelper(roomHalf * 2, 10, 0x3b4b63, 0x253246);
    grid.position.y = 0.01;
    this.worldRoot.add(grid);
  }

  private spawnObjects(): void {
    for (const object of this.config.objects) {
      switch (object.type) {
        case 'door':
          this.spawnDoor(object);
          break;
        case 'key':
          this.spawnKey(object);
          break;
        case 'cat':
        case 'prop':
          this.spawnModelObject(object);
          break;
        default:
          break;
      }
    }
  }

  private buildCollisionMap(): void {
    const roomHalf = this.config.environment.roomHalf;
    const obstacleBounds = this.config.objects
      .filter((object) => object.collision?.isCollidable && object.id !== this.config.winCondition.doorObjectId)
      .map((object) =>
        CollisionSystem.toAabb(
          object.transform.position.x,
          object.transform.position.z,
          object.collision?.halfX ?? 0,
          object.collision?.halfZ ?? 0
        )
      );

    const doorObject = this.config.objects.find((object) => object.id === this.config.winCondition.doorObjectId);
    const closedDoorBounds = doorObject?.collision?.isCollidable
      ? CollisionSystem.toAabb(
        doorObject.transform.position.x,
        doorObject.transform.position.z,
        doorObject.collision.halfX,
        doorObject.collision.halfZ
      )
      : undefined;

    this.collisionSystem.updateConfig({
      minX: -roomHalf + ROOM_EDGE_PADDING,
      maxX: roomHalf - ROOM_EDGE_PADDING,
      minZ: -roomHalf + ROOM_EDGE_PADDING,
      maxZ: roomHalf - ROOM_EDGE_PADDING,
      playerRadius: this.config.player.radius,
      closedDoorBounds,
      obstacleBounds
    });
  }

  private spawnDoor(config: LevelObjectConfig): void {
    this.door = new Door();
    this.door.object3D.position.set(config.transform.position.x, config.transform.position.y, config.transform.position.z);
    this.door.object3D.rotation.y = config.transform.rotationY;
    this.door.object3D.scale.setScalar(config.transform.scale);
    this.worldRoot.add(this.door.object3D);
    this.doorObject = config;
  }

  private spawnKey(config: LevelObjectConfig): void {
    const pickup = new PickupKey(
      config.transform.position,
      config.interaction?.pickupRadius ?? 0.75,
      config.interaction?.itemId ?? config.id,
      (itemId: string) => {
        this.deps.state.addItem(itemId);
        this.deps.ui.setInventoryActive(this.deps.state.getItemCountByPrefix('key') > 0);
        this.deps.ui.setStatus('Key collected.', 'good');
        this.playBeep(740, 120);
      }
    );
    pickup.addTo(this.worldRoot);
    this.pickups.push(pickup);
  }

  private spawnModelObject(config: LevelObjectConfig): void {
    const anchor = new THREE.Group();
    anchor.position.set(config.transform.position.x, config.transform.position.y, config.transform.position.z);
    anchor.rotation.y = config.transform.rotationY;
    anchor.scale.setScalar(config.transform.scale);
    this.worldRoot.add(anchor);
    this.objectAnchors.set(config.id, anchor);

    if (!config.assetUrl) {
      return;
    }

    const loader = new OBJLoader();
    loader.load(
      config.assetUrl,
      (object: any) => {
        let texture: any;
        if (config.textureUrl) {
          texture = new THREE.TextureLoader().load(config.textureUrl);
          texture.colorSpace = THREE.SRGBColorSpace;
          this.disposers.push(() => texture?.dispose?.());
        }

        object.traverse((child: any) => {
          if (!(child instanceof THREE.Mesh)) {
            return;
          }

          if (!child.geometry.getAttribute('normal')) {
            child.geometry.computeVertexNormals();
          }

          child.castShadow = false;
          child.receiveShadow = false;
          child.material = texture
            ? new THREE.MeshStandardMaterial({
              map: texture,
              roughness: 0.8,
              metalness: 0.04
            })
            : new THREE.MeshStandardMaterial({
              color: config.type === 'cat' ? 0xd9b37a : 0x9bb0c9,
              roughness: 0.86,
              metalness: 0.03,
              flatShading: config.type === 'cat'
            });
        });

        // Keep imported assets at a usable in-room size.
        const rawBounds = new THREE.Box3().setFromObject(object);
        const rawSize = rawBounds.getSize(new THREE.Vector3());
        if (config.type === 'cat' && rawSize.y > 0.0001) {
          const targetHeight = 1.1;
          const uniformScale = targetHeight / rawSize.y;
          object.scale.setScalar(uniformScale);
        }

        const fittedBounds = new THREE.Box3().setFromObject(object);
        const center = fittedBounds.getCenter(new THREE.Vector3());
        const yOffset = -fittedBounds.min.y;
        object.position.set(-center.x, yOffset, -center.z);

        anchor.add(object);
      },
      undefined,
      (error: unknown) => {
        console.error(`Failed to load object ${config.id}`, error);
      }
    );
  }

  private updateMovement(dt: number): void {
    const movement = this.deps.inputManager.getMovementVector();
    const length = Math.hypot(movement.x, movement.z);
    if (length < 0.001) {
      return;
    }

    const nx = movement.x / length;
    const nz = movement.z / length;
    const previous = { x: this.virtualPlayer.x, z: this.virtualPlayer.z };
    const next = {
      x: this.virtualPlayer.x + nx * this.config.player.speed * dt,
      z: this.virtualPlayer.z + nz * this.config.player.speed * dt
    };

    const resolved = this.collisionSystem.resolve(next, previous, this.deps.state.getDoorOpen());
    this.virtualPlayer.x = resolved.x;
    this.virtualPlayer.z = resolved.z;
    this.worldRoot.position.set(-this.virtualPlayer.x, 0, -this.virtualPlayer.z);
    this.deps.playerMesh.rotation.y = Math.atan2(nx, nz);
  }

  private checkKeyPickups(): void {
    for (const pickup of this.pickups) {
      const picked = pickup.tryPickup(this.virtualPlayer);
      if (!picked) {
        continue;
      }
      pickup.removeFrom(this.worldRoot);
    }
  }

  private checkDoorTouch(): void {
    if (!this.door || !this.doorObject) {
      return;
    }

    if (this.deps.state.getDoorOpen()) {
      this.wasTouchingDoor = true;
      return;
    }

    const doorPoint = this.door.object3D.position;
    const touchRadius = this.doorObject.interaction?.touchRadius ?? 1.05;
    const distance = Math.hypot(
      this.virtualPlayer.x - doorPoint.x,
      this.virtualPlayer.z - doorPoint.z
    );
    if (distance > touchRadius) {
      this.wasTouchingDoor = false;
      return;
    }

    const keyCount = this.deps.state.getItemCountByPrefix('key');
    const canUnlock =
      canOpenDoor(keyCount > 0) &&
      this.door.checkUnlockCriteria(keyCount, this.config.winCondition.keysRequired);
    if (!canUnlock) {
      if (!this.wasTouchingDoor) {
        this.deps.ui.setStatus('Door is locked. Find the key.');
        this.door.lockedShake();
        this.playBeep(180, 160);
      }
      this.wasTouchingDoor = true;
      return;
    }

    this.deps.state.setDoorOpen(true);
    this.finished = true;
    this.deps.ui.setStatus('Door opened. You escaped.', 'good');
    this.playBeep(880, 180);
    this.deps.ui.setTimer(this.deps.state.getTimerValue());
    void this.door.open().then(() => {
      this.deps.onCompleted();
    });
    this.wasTouchingDoor = true;
  }

  private playBeep(frequency: number, durationMs: number): void {
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
  }

  private disposeObjectTree(node: any): void {
    node.traverse?.((child: any) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        for (const material of child.material) {
          material?.dispose?.();
        }
      } else {
        child.material?.dispose?.();
      }
    });
  }
}
