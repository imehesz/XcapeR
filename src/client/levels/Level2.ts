import * as THREE from 'three';
import { BaseLevel } from './BaseLevel';

type PieceKind = 'block' | 'ball' | 'pyramid';

interface PuzzlePiece {
  kind: PieceKind;
  mesh: any;
  home: { x: number; z: number };
  target: { x: number; z: number };
  placed: boolean;
  placedY: number;
}

export class Level2 extends BaseLevel {
  private readonly pieces: PuzzlePiece[] = [];
  private readonly outlines: any[] = [];
  private carriedPiece: PuzzlePiece | null = null;
  private keyRevealed = false;

  override initialize(): void {
    super.initialize();
    this.keyRevealed = false;
    this.carriedPiece = null;
    this.createPuzzleObjects();
  }

  override teardown(): void {
    for (const piece of this.pieces) {
      this.worldRoot.remove(piece.mesh);
      piece.mesh.geometry?.dispose?.();
      if (Array.isArray(piece.mesh.material)) {
        for (const material of piece.mesh.material) {
          material?.dispose?.();
        }
      } else {
        piece.mesh.material?.dispose?.();
      }
    }
    this.pieces.length = 0;

    for (const outline of this.outlines) {
      this.worldRoot.remove(outline);
      outline.geometry?.dispose?.();
      outline.material?.dispose?.();
    }
    this.outlines.length = 0;

    this.carriedPiece = null;
    this.keyRevealed = false;
    super.teardown();
  }

  protected override updateCustom(_ts: number, _dt: number): void {
    const player = this.getVirtualPlayerPosition();

    if (this.isPuzzleSolved()) {
      return;
    }

    if (this.carriedPiece) {
      const heading = this.deps.playerMesh.rotation.y;
      const carryDistance = 0.8;
      this.carriedPiece.mesh.position.set(
        player.x + Math.sin(heading) * carryDistance,
        0.78,
        player.z + Math.cos(heading) * carryDistance
      );
      const distanceToTarget = Math.hypot(
        player.x - this.carriedPiece.target.x,
        player.z - this.carriedPiece.target.z
      );
      if (distanceToTarget <= 0.7) {
        this.carriedPiece.mesh.position.set(
          this.carriedPiece.target.x,
          this.carriedPiece.placedY,
          this.carriedPiece.target.z
        );
        this.carriedPiece.placed = true;
        this.deps.ui.setStatus('Shape placed.', 'good');
        this.carriedPiece = null;

        if (this.isPuzzleSolved()) {
          this.revealKey();
        }
      }
      return;
    }

    for (const piece of this.pieces) {
      if (piece.placed) {
        continue;
      }
      const distanceToPiece = Math.hypot(player.x - piece.mesh.position.x, player.z - piece.mesh.position.z);
      if (distanceToPiece <= 0.78) {
        this.carriedPiece = piece;
        this.deps.ui.setStatus(`Picked up ${piece.kind}.`);
        break;
      }
    }
  }

  private createPuzzleObjects(): void {
    const targets = [
      { kind: 'block' as const, x: -0.9, z: 0, color: 0xe24a4a },
      { kind: 'ball' as const, x: 0, z: 0, color: 0x4a84e2 },
      { kind: 'pyramid' as const, x: 0.9, z: 0, color: 0xe3cb45 }
    ];

    for (const target of targets) {
      const outline = this.createOutline(target.kind, target.color);
      outline.position.set(target.x, 0.03, target.z);
      this.worldRoot.add(outline);
      this.outlines.push(outline);
    }

    const redBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xe24a4a, roughness: 0.76, metalness: 0.06, flatShading: true })
    );
    redBlock.position.set(-3.65, 0.21, -3.65);
    this.worldRoot.add(redBlock);
    this.pieces.push({
      kind: 'block',
      mesh: redBlock,
      home: { x: -3.65, z: -3.65 },
      target: { x: -0.9, z: 0 },
      placed: false,
      placedY: 0.21
    });

    const blueBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0x4a84e2, roughness: 0.62, metalness: 0.14, flatShading: true })
    );
    blueBall.position.set(3.65, 0.23, -3.65);
    this.worldRoot.add(blueBall);
    this.pieces.push({
      kind: 'ball',
      mesh: blueBall,
      home: { x: 3.65, z: -3.65 },
      target: { x: 0, z: 0 },
      placed: false,
      placedY: 0.23
    });

    const yellowPyramid = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.44, 4),
      new THREE.MeshStandardMaterial({ color: 0xe3cb45, roughness: 0.72, metalness: 0.08, flatShading: true })
    );
    yellowPyramid.rotation.y = Math.PI * 0.25;
    yellowPyramid.position.set(-3.65, 0.22, 3.65);
    this.worldRoot.add(yellowPyramid);
    this.pieces.push({
      kind: 'pyramid',
      mesh: yellowPyramid,
      home: { x: -3.65, z: 3.65 },
      target: { x: 0.9, z: 0 },
      placed: false,
      placedY: 0.22
    });
  }

  private isPuzzleSolved(): boolean {
    return this.pieces.length > 0 && this.pieces.every((piece) => piece.placed);
  }

  private revealKey(): void {
    if (this.keyRevealed) {
      return;
    }

    this.createCarryableKey(
      { x: 3.5, y: 0.65, z: 3.4 },
      0.75,
      'key.main',
      {
        collectedStatus: 'Puzzle solved. Carry the key to the door.'
      }
    );
    this.keyRevealed = true;
    this.deps.ui.setStatus('All shapes matched. A key has appeared.', 'good');
  }

  private createOutline(kind: PieceKind, color: number): any {
    const material = new THREE.LineBasicMaterial({ color });
    if (kind === 'block') {
      const size = 0.56;
      const points = [
        new THREE.Vector3(-size * 0.5, 0, -size * 0.5),
        new THREE.Vector3(size * 0.5, 0, -size * 0.5),
        new THREE.Vector3(size * 0.5, 0, size * 0.5),
        new THREE.Vector3(-size * 0.5, 0, size * 0.5)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.LineLoop(geometry, material);
    }

    if (kind === 'ball') {
      const radius = 0.3;
      const points: any[] = [];
      const segments = 28;
      for (let i = 0; i < segments; i += 1) {
        const t = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.LineLoop(geometry, material);
    }

    const points = [
      new THREE.Vector3(0, 0, -0.34),
      new THREE.Vector3(0.31, 0, 0.22),
      new THREE.Vector3(-0.31, 0, 0.22)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineLoop(geometry, material);
  }
}
