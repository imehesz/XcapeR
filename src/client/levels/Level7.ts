import * as THREE from 'three';
import { BaseLevel, type LevelDependencies } from './BaseLevel';
import { type LevelConfig } from '../game/levels';

type MirrorKind = 'block' | 'ball' | 'pyramid' | 'cylinder';

interface MirrorPiece {
  id: string;
  kind: MirrorKind;
  color: number;
  movable: boolean;
  mesh: any;
  placed: boolean;
  baseY: number;
  mirrorTarget?: { x: number; z: number };
}

const SHAPE_ORDER: MirrorKind[] = ['block', 'ball', 'pyramid', 'cylinder'];

const SHAPE_COLORS: Record<MirrorKind, number> = {
  block: 0xe24a4a,
  ball: 0x4a84e2,
  pyramid: 0xe3cb45,
  cylinder: 0x54c77a
};

const PIECE_SIZE: Record<MirrorKind, { y: number; pickupRadius: number }> = {
  block: { y: 0.21, pickupRadius: 0.78 },
  ball: { y: 0.23, pickupRadius: 0.78 },
  pyramid: { y: 0.22, pickupRadius: 0.8 },
  cylinder: { y: 0.23, pickupRadius: 0.8 }
};

const RANDOM_BOUNDS = {
  minX: -4.3,
  maxX: -1.0,
  minZ: -3.9,
  maxZ: 3.9
};

const MIN_SPAWN_SEPARATION = 0.95;
const CARRY_DISTANCE = 0.82;
const SNAP_DISTANCE = 0.62;

export class Level7 extends BaseLevel {
  private readonly pieces: MirrorPiece[] = [];
  private readonly dividerVisuals: any[] = [];
  private carryingPiece: MirrorPiece | null = null;
  private keyRevealed = false;

  constructor(config: LevelConfig, deps: LevelDependencies) {
    super(config, deps);
  }

  override initialize(): void {
    super.initialize();
    this.pieces.length = 0;
    this.dividerVisuals.length = 0;
    this.carryingPiece = null;
    this.keyRevealed = false;

    this.createDividerLine();
    this.createMirrorPieces();
    this.deps.ui.setStatus('Find the key, leave the room.');
  }

  override teardown(): void {
    for (const piece of this.pieces) {
      this.worldRoot.remove(piece.mesh);
      piece.mesh.geometry.dispose();
      if (Array.isArray(piece.mesh.material)) {
        for (const material of piece.mesh.material) {
          material.dispose();
        }
      } else {
        piece.mesh.material.dispose();
      }
    }
    this.pieces.length = 0;

    for (const visual of this.dividerVisuals) {
      this.worldRoot.remove(visual);
      if (visual.geometry) {
        visual.geometry.dispose();
      }
      const material = visual.material;
      if (Array.isArray(material)) {
        for (const one of material) {
          one.dispose();
        }
      } else {
        material?.dispose?.();
      }
    }
    this.dividerVisuals.length = 0;

    this.carryingPiece = null;
    this.keyRevealed = false;
    super.teardown();
  }

  protected override updateCustom(_ts: number, _dt: number): void {
    this.tryPickupNearestMovable();

    if (this.carryingPiece) {
      this.updateCarryPose(this.carryingPiece);
      this.tryAutoPlace(this.carryingPiece);
    }

    if (!this.keyRevealed && this.isSolved()) {
      this.revealKey();
    }
  }

  private createDividerLine(): void {
    const roomHalf = this.config.environment.roomHalf;

    const linePoints = [
      new THREE.Vector3(0, 0.03, -roomHalf + 0.1),
      new THREE.Vector3(0, 0.03, roomHalf - 0.1)
    ];
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x78b8ff,
      transparent: true,
      opacity: 0.55
    });
    const divider = new THREE.Line(lineGeometry, lineMaterial);

    // Slight glow strip to make the split line readable on darker floor colors.
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, roomHalf * 2 - 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x3b74d8,
        emissive: 0x1f4ea7,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.32,
        roughness: 0.95,
        metalness: 0
      })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.016, 0);

    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, roomHalf * 2 - 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x6eb3ff,
        emissive: 0x2d74cf,
        emissiveIntensity: 0.42,
        transparent: true,
        opacity: 0.14,
        roughness: 1,
        metalness: 0
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(0, 0.012, 0);

    this.worldRoot.add(divider);
    this.worldRoot.add(strip);
    this.worldRoot.add(halo);
    this.dividerVisuals.push(divider, strip, halo);
  }

  private createMirrorPieces(): void {
    const staticSlots = this.generateSpawnPositions(4);
    const movableSlots = this.generateSpawnPositions(4, staticSlots);

    for (let i = 0; i < SHAPE_ORDER.length; i += 1) {
      const kind = SHAPE_ORDER[i];
      const color = SHAPE_COLORS[kind];

      const staticMesh = this.createMesh(kind, color);
      staticMesh.position.set(staticSlots[i].x, PIECE_SIZE[kind].y, staticSlots[i].z);
      this.worldRoot.add(staticMesh);
      this.pieces.push({
        id: `mirror.static.${kind}`,
        kind,
        color,
        movable: false,
        mesh: staticMesh,
        placed: true,
        baseY: PIECE_SIZE[kind].y
      });

      const movableMesh = this.createMesh(kind, color);
      movableMesh.position.set(movableSlots[i].x, PIECE_SIZE[kind].y, movableSlots[i].z);
      this.worldRoot.add(movableMesh);
      this.pieces.push({
        id: `mirror.movable.${kind}`,
        kind,
        color,
        movable: true,
        mesh: movableMesh,
        placed: false,
        baseY: PIECE_SIZE[kind].y,
        mirrorTarget: {
          x: -staticSlots[i].x,
          z: staticSlots[i].z
        }
      });
    }
  }

  private createMesh(kind: MirrorKind, color: number): any {
    let geometry: any;

    if (kind === 'ball') {
      geometry = new THREE.SphereGeometry(0.23, 18, 14);
    } else if (kind === 'pyramid') {
      geometry = new THREE.ConeGeometry(0.26, 0.44, 4);
    } else if (kind === 'cylinder') {
      geometry = new THREE.CylinderGeometry(0.22, 0.22, 0.46, 18);
    } else {
      geometry = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.72,
      metalness: 0.08,
      flatShading: true
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    if (kind === 'pyramid') {
      mesh.rotation.y = Math.PI * 0.25;
    }

    return mesh;
  }

  private generateSpawnPositions(count: number, existing: Array<{ x: number; z: number }> = []): Array<{ x: number; z: number }> {
    const positions: Array<{ x: number; z: number }> = [];
    const occupied = [...existing];

    for (let i = 0; i < count; i += 1) {
      let attempts = 0;
      let placed = false;

      while (!placed && attempts < 200) {
        attempts += 1;
        const x = RANDOM_BOUNDS.minX + Math.random() * (RANDOM_BOUNDS.maxX - RANDOM_BOUNDS.minX);
        const z = RANDOM_BOUNDS.minZ + Math.random() * (RANDOM_BOUNDS.maxZ - RANDOM_BOUNDS.minZ);

        const clear = occupied.every((slot) => Math.hypot(slot.x - x, slot.z - z) >= MIN_SPAWN_SEPARATION);
        if (!clear) {
          continue;
        }

        const spot = { x, z };
        positions.push(spot);
        occupied.push(spot);
        placed = true;
      }

      if (!placed) {
        const fallback = {
          x: -4.1 + i * 0.65,
          z: -3.3 + i * 1.6
        };
        positions.push(fallback);
        occupied.push(fallback);
      }
    }

    return positions;
  }

  private tryPickupNearestMovable(): void {
    if (this.carryingPiece) {
      return;
    }

    const player = this.getVirtualPlayerPosition();
    let best: MirrorPiece | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const piece of this.pieces) {
      if (!piece.movable || piece.placed) {
        continue;
      }
      const pickupRadius = PIECE_SIZE[piece.kind].pickupRadius;
      const distance = Math.hypot(player.x - piece.mesh.position.x, player.z - piece.mesh.position.z);
      if (distance > pickupRadius || distance >= bestDistance) {
        continue;
      }

      best = piece;
      bestDistance = distance;
    }

    if (!best) {
      return;
    }

    this.carryingPiece = best;
    this.deps.ui.setStatus(`Picked up ${best.kind}. Mirror it to the right side.`);
  }

  private updateCarryPose(piece: MirrorPiece): void {
    const player = this.getVirtualPlayerPosition();
    const heading = this.deps.playerMesh.rotation.y;
    piece.mesh.position.set(
      player.x + Math.sin(heading) * CARRY_DISTANCE,
      0.78,
      player.z + Math.cos(heading) * CARRY_DISTANCE
    );
  }

  private tryAutoPlace(piece: MirrorPiece): void {
    if (!piece.mirrorTarget) {
      return;
    }

    const player = this.getVirtualPlayerPosition();
    const distanceToTarget = Math.hypot(player.x - piece.mirrorTarget.x, player.z - piece.mirrorTarget.z);
    if (player.x <= 0 || distanceToTarget > SNAP_DISTANCE) {
      return;
    }

    piece.mesh.position.set(piece.mirrorTarget.x, piece.baseY, piece.mirrorTarget.z);
    piece.placed = true;
    this.carryingPiece = null;
    this.deps.ui.setStatus(`${piece.kind} mirrored into place.`, 'good');
  }

  private dropPiece(piece: MirrorPiece): void {
    const player = this.getVirtualPlayerPosition();
    const heading = this.deps.playerMesh.rotation.y;
    piece.mesh.position.set(
      player.x + Math.sin(heading) * (CARRY_DISTANCE * 0.7),
      piece.baseY,
      player.z + Math.cos(heading) * (CARRY_DISTANCE * 0.7)
    );
    this.carryingPiece = null;
  }

  private isSolved(): boolean {
    const movablePieces = this.pieces.filter((piece) => piece.movable);
    return movablePieces.length === 4 && movablePieces.every((piece) => piece.placed);
  }

  private revealKey(): void {
    if (this.keyRevealed) {
      return;
    }

    this.createCarryableKey(
      { x: 3.6, y: 0.65, z: 3.4 },
      0.75,
      'key.main',
      {
        collectedStatus: 'Mirror complete. Carry the key to the door.'
      }
    );

    this.keyRevealed = true;
    this.deps.ui.setStatus('All mirrors matched. A key has appeared.', 'good');
  }
}
