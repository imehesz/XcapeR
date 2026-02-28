import * as THREE from 'three';
import { BaseLevel } from './BaseLevel';

type ItemType = 'red' | 'green' | 'cat';
type ItemState = 'floor' | 'held' | 'consumed';
type ContainerKind = 'collector' | 'cloner' | 'converter' | 'sacrifice';

interface PuzzleItem {
  id: string;
  type: ItemType;
  state: ItemState;
  mesh: any;
  pickupRadius: number;
  floorY: number;
  velocityY: number;
  dropping: boolean;
}

interface ContainerSlot {
  id: string;
  kind: ContainerKind;
  position: { x: number; z: number };
  triggerRadius: number;
  root: any;
  wasInside: boolean;
}

const CARRY_DISTANCE = 0.82;
const CARRY_HEIGHT_BLOCK = 0.72;
const CARRY_HEIGHT_CAT = 0.82;
const PICKUP_SWAP_COOLDOWN_MS = 1500;
const MAX_FLOOR_ITEMS_PER_TYPE = 4;
const DROP_HEIGHT = 4.7;
const GRAVITY = 16;
const ENDLESS_RESPAWN_MS = 15000;

const FLOOR_SPAWN_POINTS: Array<{ x: number; z: number }> = [
  { x: -2.2, z: 2.8 },
  { x: 2.4, z: 3.1 },
  { x: 3.5, z: 0.7 },
  { x: 1.8, z: -0.9 },
  { x: -1.0, z: 1.4 },
  { x: 3.3, z: -2.1 }
];

const CEILING_SPAWN_POINTS: Array<{ x: number; z: number }> = [
  { x: -2.4, z: 2.6 },
  { x: -0.4, z: 3.4 },
  { x: 2.2, z: 2.7 },
  { x: 3.4, z: 0.5 },
  { x: 2.4, z: -2.4 },
  { x: -1.6, z: -1.8 }
];

export class Level9 extends BaseLevel {
  private readonly items: PuzzleItem[] = [];
  private readonly containers: ContainerSlot[] = [];
  private readonly indicatorSegments: any[] = [];
  private readonly indicatorBackplates: any[] = [];

  private carryingItem: PuzzleItem | null = null;
  private itemIdCounter = 0;
  private greenDeposits = 0;
  private keyRevealed = false;
  private endlessTimerStartMs: number | null = null;
  private meowAudio: HTMLAudioElement | null = null;
  private lastPickupSwapAtMs = 0;

  override initialize(): void {
    super.initialize();

    this.items.length = 0;
    this.containers.length = 0;
    this.indicatorSegments.length = 0;
    this.indicatorBackplates.length = 0;
    this.carryingItem = null;
    this.itemIdCounter = 0;
    this.greenDeposits = 0;
    this.keyRevealed = false;
    this.endlessTimerStartMs = null;
    this.lastPickupSwapAtMs = 0;

    this.createContainers();
    this.createProgressIndicator();
    this.updateProgressIndicator();

    this.spawnItemOnFloor('red');
    this.spawnItemOnFloor('cat');
    this.prepareCatAudio();

    this.deps.ui.setStatus('Feed green blocks to the green container to reveal the key.');
  }

  override teardown(): void {
    this.meowAudio = null;
    this.carryingItem = null;
    this.items.length = 0;
    this.containers.length = 0;
    this.indicatorSegments.length = 0;
    this.indicatorBackplates.length = 0;
    this.endlessTimerStartMs = null;
    super.teardown();
  }

  protected override updateCustom(ts: number, dt: number): void {
    this.enforceSingleHeldInvariant();
    this.updateFallingItems(dt);
    if (this.keyRevealed) {
      if (this.carryingItem) {
        this.dropCarriedItem();
      }
      this.endlessTimerStartMs = null;
      this.animateIndicator(ts);
      return;
    }

    this.tryPickupNearestItem(ts);
    this.updateCarryPose();
    this.tryDepositToContainers();
    this.updateEndlessRespawnTimer(ts);
    this.animateIndicator(ts);
  }

  protected override resolveCustomCollisions(): void {
    const roomHalf = this.config.environment.roomHalf;
    const playerRadius = this.config.player.radius;
    const roomMin = -roomHalf + 0.1 + playerRadius;
    const roomMax = roomHalf - 0.1 - playerRadius;

    const pushOutCircle = (cx: number, cz: number, obstacleRadius: number): void => {
      const dx = this.virtualPlayer.x - cx;
      const dz = this.virtualPlayer.z - cz;
      const distSq = (dx * dx) + (dz * dz);
      const minDist = obstacleRadius + playerRadius;
      const minDistSq = minDist * minDist;
      if (distSq >= minDistSq) {
        return;
      }

      const dist = Math.sqrt(distSq);
      if (dist < 0.0001) {
        this.virtualPlayer.x = cx + minDist;
        this.virtualPlayer.z = cz;
        return;
      }

      this.virtualPlayer.x = cx + (dx / dist) * minDist;
      this.virtualPlayer.z = cz + (dz / dist) * minDist;
    };

    for (let i = 0; i < 2; i += 1) {
      for (const container of this.containers) {
        pushOutCircle(container.position.x, container.position.z, 0.58);
      }
      this.virtualPlayer.x = Math.max(roomMin, Math.min(roomMax, this.virtualPlayer.x));
      this.virtualPlayer.z = Math.max(roomMin, Math.min(roomMax, this.virtualPlayer.z));
    }
    this.worldRoot.position.set(-this.virtualPlayer.x, 0, -this.virtualPlayer.z);
  }

  private createContainers(): void {
    this.containers.push(
      this.createContainer({
        id: 'container.collector',
        kind: 'collector',
        position: { x: -2.5, z: -4.25 },
        bodyColor: 0x1f8a45
      }),
      this.createContainer({
        id: 'container.cloner',
        kind: 'cloner',
        position: { x: -4.05, z: -2.45 },
        bodyColor: 0xb23f3f
      }),
      this.createContainer({
        id: 'container.converter',
        kind: 'converter',
        position: { x: -4.05, z: 0 },
        bodyColor: 0x222222,
        splitTopColor: 0xb23f3f,
        splitBottomColor: 0x1f8a45
      }),
      this.createContainer({
        id: 'container.sacrifice',
        kind: 'sacrifice',
        position: { x: -4.05, z: 2.45 },
        bodyColor: 0x151515
      })
    );
  }

  private createContainer(options: {
    id: string;
    kind: ContainerKind;
    position: { x: number; z: number };
    bodyColor: number;
    splitTopColor?: number;
    splitBottomColor?: number;
  }): ContainerSlot {
    const root = new THREE.Group();
    root.position.set(options.position.x, 0, options.position.z);

    const bodyRadiusTop = 0.52;
    const bodyRadiusBottom = 0.56;
    const bodyHeight = 1.08;

    if (options.splitTopColor !== undefined && options.splitBottomColor !== undefined) {
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(bodyRadiusTop, bodyRadiusTop, bodyHeight * 0.5, 16),
        new THREE.MeshStandardMaterial({
          color: options.splitTopColor,
          roughness: 0.82,
          metalness: 0.08
        })
      );
      top.position.y = bodyHeight * 0.75;
      root.add(top);

      const bottom = new THREE.Mesh(
        new THREE.CylinderGeometry(bodyRadiusBottom, bodyRadiusBottom, bodyHeight * 0.5, 16),
        new THREE.MeshStandardMaterial({
          color: options.splitBottomColor,
          roughness: 0.82,
          metalness: 0.08
        })
      );
      bottom.position.y = bodyHeight * 0.25;
      root.add(bottom);
    } else {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(bodyRadiusTop, bodyRadiusBottom, bodyHeight, 16),
        new THREE.MeshStandardMaterial({
          color: options.bodyColor,
          roughness: 0.82,
          metalness: 0.08
        })
      );
      body.position.y = bodyHeight * 0.5;
      root.add(body);
    }

    const funnel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.32, 0.36, 4),
      new THREE.MeshStandardMaterial({
        color: 0x8f97a8,
        roughness: 0.72,
        metalness: 0.16
      })
    );
    funnel.position.y = bodyHeight + 0.2;
    root.add(funnel);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.04, 10, 24),
      new THREE.MeshStandardMaterial({
        color: 0x151922,
        roughness: 0.66,
        metalness: 0.22
      })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = bodyHeight + 0.36;
    root.add(rim);

    this.worldRoot.add(root);
    return {
      id: options.id,
      kind: options.kind,
      position: options.position,
      triggerRadius: 1.02,
      root,
      wasInside: false
    };
  }

  private createProgressIndicator(): void {
    const root = new THREE.Group();
    root.position.set(2, 1.75, -4.8);
    root.rotation.y = Math.PI * 0.5;

    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.68, 0.8),
      new THREE.MeshStandardMaterial({
        color: 0x0b1018,
        roughness: 0.9,
        metalness: 0.05
      })
    );
    root.add(plate);

    for (let i = 0; i < 4; i += 1) {
      const y = -0.54 + i * 0.36;
      const backplate = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.28, 0.6),
        new THREE.MeshStandardMaterial({
          color: 0x152231,
          roughness: 0.9,
          metalness: 0.04
        })
      );
      backplate.position.set(-0.12, y, 0);
      root.add(backplate);
      this.indicatorBackplates.push(backplate);

      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.24, 0.56),
        new THREE.MeshStandardMaterial({
          color: 0x2a3825,
          emissive: 0x000000,
          emissiveIntensity: 0,
          roughness: 0.66,
          metalness: 0.09
        })
      );
      segment.position.set(-0.15, y, 0);
      root.add(segment);
      this.indicatorSegments.push(segment);
    }

    this.worldRoot.add(root);
  }

  private spawnItemOnFloor(type: ItemType): void {
    const point = this.pickFloorSpawnPoint();
    this.spawnItem(type, { x: point.x, y: 0, z: point.z }, false);
  }

  private spawnItemFromCeiling(type: ItemType, requestedCount: number): number {
    const currentFloorCount = this.getTypeCount('floor', type);
    const allowed = Math.max(0, MAX_FLOOR_ITEMS_PER_TYPE - currentFloorCount);
    const toSpawn = Math.min(requestedCount, allowed);
    const reserved: Array<{ x: number; z: number }> = [];

    for (let i = 0; i < toSpawn; i += 1) {
      const point = this.pickCeilingSpawnPoint(reserved);
      reserved.push(point);
      this.spawnItem(type, { x: point.x, y: DROP_HEIGHT, z: point.z }, true);
    }
    return toSpawn;
  }

  private spawnItem(type: ItemType, position: { x: number; y: number; z: number }, dropping: boolean): void {
    const mesh = this.createItemMesh(type);
    const floorY = type === 'cat' ? 0.36 : 0.28;
    mesh.position.set(position.x, dropping ? position.y : floorY, position.z);
    this.worldRoot.add(mesh);

    this.items.push({
      id: `l9.item.${this.itemIdCounter++}`,
      type,
      state: 'floor',
      mesh,
      pickupRadius: type === 'cat' ? 0.92 : 0.8,
      floorY,
      velocityY: 0,
      dropping
    });
  }

  private createItemMesh(type: ItemType): any {
    if (type === 'red' || type === 'green') {
      const color = type === 'red' ? 0xca3d3d : 0x2ca851;
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.56, 0.56),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.72,
          metalness: 0.08,
          flatShading: true
        })
      );
    }
    return this.createCatMesh();
  }

  private createCatMesh(): any {
    const fur = new THREE.MeshStandardMaterial({
      color: 0xd7b282,
      roughness: 0.84,
      metalness: 0.03,
      flatShading: true
    });
    const darkFur = new THREE.MeshStandardMaterial({
      color: 0x9f7b55,
      roughness: 0.88,
      metalness: 0.03,
      flatShading: true
    });
    const face = new THREE.MeshStandardMaterial({
      color: 0xe28f8f,
      roughness: 0.7,
      metalness: 0.02,
      flatShading: true
    });
    const frame = new THREE.MeshStandardMaterial({
      color: 0x0f1116,
      roughness: 0.3,
      metalness: 0.25,
      flatShading: true
    });
    const lens = new THREE.MeshStandardMaterial({
      color: 0x0d1422,
      roughness: 0.12,
      metalness: 0.45,
      flatShading: true
    });

    const kitty = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.62), fur);
    body.position.set(0, 0.31, 0);
    kitty.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.46, 0.5), fur);
    head.position.set(0, 0.75, 0.2);
    kitty.add(head);

    const earLeft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), fur);
    earLeft.position.set(-0.17, 1.09, 0.18);
    earLeft.rotation.z = Math.PI * 0.08;
    kitty.add(earLeft);

    const earRight = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), fur);
    earRight.position.set(0.17, 1.09, 0.18);
    earRight.rotation.z = -Math.PI * 0.08;
    kitty.add(earRight);

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.65, 6), darkFur);
    tail.position.set(-0.35, 0.63, -0.2);
    tail.rotation.x = Math.PI * 0.34;
    tail.rotation.z = Math.PI * 0.18;
    kitty.add(tail);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.06), face);
    nose.position.set(0, 0.73, 0.47);
    kitty.add(nose);

    const lensLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.04), lens);
    lensLeft.position.set(-0.14, 0.82, 0.48);
    kitty.add(lensLeft);

    const lensRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.04), lens);
    lensRight.position.set(0.14, 0.82, 0.48);
    kitty.add(lensRight);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.04), frame);
    bridge.position.set(0, 0.82, 0.48);
    kitty.add(bridge);

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.04), frame);
    topBar.position.set(0, 0.89, 0.48);
    kitty.add(topBar);

    kitty.scale.setScalar(0.62);
    kitty.rotation.y = Math.PI * 0.17;
    return kitty;
  }

  private updateFallingItems(dt: number): void {
    for (const item of this.items) {
      if (item.state !== 'floor' || !item.dropping) {
        continue;
      }
      item.velocityY -= GRAVITY * dt;
      item.mesh.position.y += item.velocityY * dt;
      if (item.mesh.position.y <= item.floorY) {
        item.mesh.position.y = item.floorY;
        item.velocityY = 0;
        item.dropping = false;
      }
    }
  }

  private tryPickupNearestItem(ts: number): void {
    if (ts - this.lastPickupSwapAtMs < PICKUP_SWAP_COOLDOWN_MS) {
      return;
    }

    const player = this.getVirtualPlayerPosition();
    let nearest: PuzzleItem | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const item of this.items) {
      if (item.state !== 'floor' || item.dropping) {
        continue;
      }
      const distance = Math.hypot(player.x - item.mesh.position.x, player.z - item.mesh.position.z);
      if (distance > item.pickupRadius || distance >= nearestDistance) {
        continue;
      }
      nearest = item;
      nearestDistance = distance;
    }

    if (!nearest) {
      return;
    }

    // Swap behavior: if already carrying one item and touching another,
    // drop the carried one first, then pick up the nearby floor item.
    if (this.carryingItem && this.carryingItem.id !== nearest.id) {
      this.dropCarriedItem();
      this.lastPickupSwapAtMs = ts;
    } else if (this.carryingItem) {
      return;
    }

    nearest.state = 'held';
    this.carryingItem = nearest;
    this.lastPickupSwapAtMs = ts;
    if (nearest.type === 'cat') {
      this.deps.ui.setStatus('Carrying cat. Find the right container.');
      return;
    }
    this.deps.ui.setStatus(`Carrying ${nearest.type} block.`);
  }

  private updateCarryPose(): void {
    if (!this.carryingItem) {
      return;
    }
    const player = this.getVirtualPlayerPosition();
    const heading = this.deps.playerMesh.rotation.y;
    const y = this.carryingItem.type === 'cat' ? CARRY_HEIGHT_CAT : CARRY_HEIGHT_BLOCK;
    this.carryingItem.mesh.position.set(
      player.x + Math.sin(heading) * CARRY_DISTANCE,
      y,
      player.z + Math.cos(heading) * CARRY_DISTANCE
    );
  }

  private tryDepositToContainers(): void {
    const item = this.carryingItem;
    const player = this.getVirtualPlayerPosition();

    for (const container of this.containers) {
      const inside = Math.hypot(player.x - container.position.x, player.z - container.position.z) <= container.triggerRadius;
      if (inside && !container.wasInside && item) {
        this.handleContainerInput(container, item);
      }
      container.wasInside = inside;
    }
  }

  private handleContainerInput(container: ContainerSlot, item: PuzzleItem): void {
    if (!this.canContainerAccept(container.kind, item.type)) {
      this.deps.ui.setStatus('That item does not fit this container.');
      return;
    }

    const inputType = item.type;
    this.consumeItem(item);

    if (container.kind === 'collector') {
      this.greenDeposits = Math.min(4, this.greenDeposits + 1);
      this.updateProgressIndicator();
      if (this.greenDeposits >= 4 && !this.keyRevealed) {
        this.revealKey();
      } else {
        this.deps.ui.setStatus(`Green collector: ${this.greenDeposits}/4`, 'good');
      }
      return;
    }

    if (container.kind === 'cloner') {
      const spawned = this.spawnItemFromCeiling(inputType, 2);
      if (inputType === 'cat') {
        this.playCatMeow();
      }
      if (spawned === 0) {
        this.deps.ui.setStatus('Cloner full for this item type. Input consumed.');
      } else {
        this.deps.ui.setStatus(`Cloner produced ${spawned} ${inputType} item${spawned === 1 ? '' : 's'}.`, 'good');
      }
      return;
    }

    if (container.kind === 'converter') {
      const spawned = this.spawnItemFromCeiling('green', 1);
      this.deps.ui.setStatus(
        spawned > 0 ? 'Converter output: 1 green block.' : 'Converter output blocked: green cap reached.',
        spawned > 0 ? 'good' : 'normal'
      );
      return;
    }

    if (container.kind === 'sacrifice') {
      this.playCatMeow();
      const spawned = this.spawnItemFromCeiling('red', 1);
      this.deps.ui.setStatus(
        spawned > 0 ? 'Sacrifice accepted. Red block dropped.' : 'Sacrifice accepted, but red cap reached.',
        spawned > 0 ? 'good' : 'normal'
      );
    }
  }

  private canContainerAccept(kind: ContainerKind, itemType: ItemType): boolean {
    if (kind === 'collector') {
      return itemType === 'green';
    }
    if (kind === 'cloner') {
      return itemType === 'red' || itemType === 'cat';
    }
    if (kind === 'converter') {
      return itemType === 'red';
    }
    return itemType === 'cat';
  }

  private consumeItem(item: PuzzleItem): void {
    item.state = 'consumed';
    if (this.carryingItem === item) {
      this.carryingItem = null;
    }
    this.worldRoot.remove(item.mesh);
    this.disposeMesh(item.mesh);
    const index = this.items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }

  private disposeMesh(root: any): void {
    root.traverse((node: any) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.geometry?.dispose?.();
      if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) {
          material?.dispose?.();
        }
      } else {
        mesh.material?.dispose?.();
      }
    });
  }

  private updateEndlessRespawnTimer(ts: number): void {
    const activeCount = this.items.filter((item) => item.state === 'floor' || item.state === 'held').length;
    if (activeCount > 0) {
      this.endlessTimerStartMs = null;
      return;
    }

    if (this.endlessTimerStartMs === null) {
      this.endlessTimerStartMs = ts;
      return;
    }

    if (ts - this.endlessTimerStartMs < ENDLESS_RESPAWN_MS) {
      return;
    }

    this.spawnItemFromCeiling('red', 1);
    this.endlessTimerStartMs = null;
    this.deps.ui.setStatus('Failsafe spawned a red block.');
  }

  private getTypeCount(state: ItemState, type: ItemType): number {
    let count = 0;
    for (const item of this.items) {
      if (item.state === state && item.type === type) {
        count += 1;
      }
    }
    return count;
  }

  private updateProgressIndicator(): void {
    for (let i = 0; i < this.indicatorSegments.length; i += 1) {
      const lit = i < this.greenDeposits;
      const segmentMaterial = this.indicatorSegments[i].material as THREE.MeshStandardMaterial;
      segmentMaterial.color.setHex(lit ? 0x43d26a : 0x2a3825);
      segmentMaterial.emissive.setHex(lit ? 0x1c7c39 : 0x000000);
      segmentMaterial.emissiveIntensity = lit ? 0.45 : 0;
    }
  }

  private animateIndicator(ts: number): void {
    if (this.greenDeposits < 4) {
      return;
    }
    const pulse = 0.55 + Math.sin(ts * 0.01) * 0.2;
    for (const segment of this.indicatorSegments) {
      const material = segment.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = pulse;
    }
  }

  private revealKey(): void {
    if (this.keyRevealed) {
      return;
    }
    this.createCarryableKey(
      { x: 2.95, y: 0.65, z: 2.55 },
      0.75,
      'key.main',
      {
        collectedStatus: 'Key collected. Bring it to the door.'
      }
    );
    this.keyRevealed = true;
    this.deps.ui.setStatus('Collector full. A key has appeared.', 'good');
  }

  private pickRandomPoint(pool: Array<{ x: number; z: number }>): { x: number; z: number } {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private pickFloorSpawnPoint(): { x: number; z: number } {
    const floorItems = this.items.filter((item) => item.state === 'floor');
    const minSeparation = 1.3;
    const shuffled = this.shufflePoints(FLOOR_SPAWN_POINTS);
    for (const point of shuffled) {
      const clear = floorItems.every(
        (item) => Math.hypot(item.mesh.position.x - point.x, item.mesh.position.z - point.z) >= minSeparation
      );
      if (clear) {
        return point;
      }
    }

    // Fallback: pick the spot farthest from current floor items.
    let best = FLOOR_SPAWN_POINTS[0];
    let bestDistance = -1;
    for (const point of FLOOR_SPAWN_POINTS) {
      const minDist = floorItems.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(...floorItems.map((item) => Math.hypot(item.mesh.position.x - point.x, item.mesh.position.z - point.z)));
      if (minDist > bestDistance) {
        bestDistance = minDist;
        best = point;
      }
    }
    return best;
  }

  private pickCeilingSpawnPoint(reserved: Array<{ x: number; z: number }>): { x: number; z: number } {
    const floorItems = this.items.filter((item) => item.state === 'floor');
    const separationFromItems = 1.55;
    const separationFromReserved = 1.2;
    const shuffled = this.shufflePoints(CEILING_SPAWN_POINTS);

    for (const point of shuffled) {
      const farFromFloorItems = floorItems.every(
        (item) => Math.hypot(item.mesh.position.x - point.x, item.mesh.position.z - point.z) >= separationFromItems
      );
      const farFromReserved = reserved.every(
        (spot) => Math.hypot(spot.x - point.x, spot.z - point.z) >= separationFromReserved
      );
      if (farFromFloorItems && farFromReserved) {
        return point;
      }
    }

    // Fallback: pick the candidate with the largest minimum distance to floor items.
    let best = CEILING_SPAWN_POINTS[0];
    let bestScore = -1;
    for (const point of CEILING_SPAWN_POINTS) {
      const itemScore = floorItems.length === 0
        ? 100
        : Math.min(...floorItems.map((item) => Math.hypot(item.mesh.position.x - point.x, item.mesh.position.z - point.z)));
      const reserveScore = reserved.length === 0
        ? 100
        : Math.min(...reserved.map((spot) => Math.hypot(spot.x - point.x, spot.z - point.z)));
      const score = Math.min(itemScore, reserveScore);
      if (score > bestScore) {
        bestScore = score;
        best = point;
      }
    }
    return best;
  }

  private shufflePoints(pool: Array<{ x: number; z: number }>): Array<{ x: number; z: number }> {
    const points = [...pool];
    for (let i = points.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = points[i];
      points[i] = points[j];
      points[j] = temp;
    }
    return points;
  }

  private dropCarriedItem(): void {
    if (!this.carryingItem) {
      return;
    }
    const player = this.getVirtualPlayerPosition();
    const heading = this.deps.playerMesh.rotation.y;
    const item = this.carryingItem;
    item.state = 'floor';
    item.dropping = false;
    item.velocityY = 0;
    item.mesh.position.set(
      player.x - Math.sin(heading) * 0.55,
      item.floorY,
      player.z - Math.cos(heading) * 0.55
    );
    this.carryingItem = null;
  }

  private enforceSingleHeldInvariant(): void {
    const carriedId = this.carryingItem?.id ?? null;
    for (const item of this.items) {
      if (item.state !== 'held') {
        continue;
      }
      if (carriedId && item.id === carriedId) {
        continue;
      }
      item.state = 'floor';
      item.dropping = false;
      item.velocityY = 0;
      item.mesh.position.y = item.floorY;
    }

    if (this.carryingItem && this.carryingItem.state !== 'held') {
      this.carryingItem.state = 'held';
    }
  }

  private prepareCatAudio(): void {
    if (!this.config.custom?.catMeowUrl) {
      this.meowAudio = null;
      return;
    }
    const meow = new Audio(this.config.custom.catMeowUrl);
    meow.preload = 'auto';
    meow.volume = 0.5 * (this.deps.ui.settings.sfxVol / 10);
    this.meowAudio = meow;
  }

  private playCatMeow(): void {
    if (!this.meowAudio || this.deps.ui.settings.sfxVol === 0) {
      return;
    }
    const meow = this.meowAudio.cloneNode(true) as HTMLAudioElement;
    meow.playbackRate = 0.78 + Math.random() * 0.18;
    meow.volume = 0.42 * (this.deps.ui.settings.sfxVol / 10);
    void meow.play().catch(() => {
      // Ignore browser autoplay rejections.
    });
  }
}
