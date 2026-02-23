import * as THREE from 'three';
import { BaseLevel } from './BaseLevel';

interface ColorSquare {
  readonly index: number;
  readonly center: { x: number; z: number };
  readonly tileMesh: any;
  readonly outline: any;
  colorIndex: number | null;
  wasInside: boolean;
}

interface ColorPickup {
  readonly index: number;
  readonly color: number;
  readonly mesh: any;
  wasInside: boolean;
}

const BUTTON_RADIUS = 0.58;
const CELL_TOUCH_RADIUS = 0.5;
const PICKUP_TOUCH_RADIUS = 0.5;
const TILE_SIZE = 0.9;
const TILE_GAP = 0.2;
const BOARD_CENTER_Z = 0;
const LEFT_BUTTON_POS = { x: -1.45, z: -3.65 };
const RIGHT_BUTTON_POS = { x: 1.45, z: -3.65 };
const FLASH_COLOR_MS = 500;
const FLASH_BLACK_MS = 150;
const BASE_TILE_COLOR = 0x223043;
const BASE_OUTLINE_COLOR = 0x7aa7ff;
const SOLVED_OUTLINE_COLOR = 0x5ef28c;
const SCREEN_BLACK = 0x050505;

const PALETTE: number[] = [
  0xff0000, // red
  0x00ff00, // green
  0x0000ff, // blue
  0xffff00, // yellow
  0x00ffff, // cyan
  0xff00ff, // magenta
  0xff8000, // orange
  0xffffff, // white
  0x8000ff  // purple
];

export class Level4 extends BaseLevel {
  private readonly squares: ColorSquare[] = [];
  private readonly colorPickups: ColorPickup[] = [];

  private sequence: number[] = [];
  private keyRevealed = false;
  private puzzleLocked = false;

  private wasOnLeftButton = false;
  private wasOnRightButton = false;
  private carriedColorIndex: number | null = null;
  private carriedIndicator: any = null;
  private screenMaterial: any = null;

  private sequenceRunning = false;
  private sequenceCursor = 0;
  private nextSequenceSwitchTs = 0;

  private previousKeyCount = 0;

  override initialize(): void {
    super.initialize();
    this.squares.length = 0;
    this.colorPickups.length = 0;
    this.keyRevealed = false;
    this.puzzleLocked = false;
    this.wasOnLeftButton = false;
    this.wasOnRightButton = false;
    this.carriedColorIndex = null;
    this.carriedIndicator = null;
    this.screenMaterial = null;
    this.sequenceRunning = false;
    this.sequenceCursor = 0;
    this.nextSequenceSwitchTs = 0;
    this.previousKeyCount = this.deps.state.getItemCountByPrefix('key');

    this.sequence = this.createSequence();
    this.createPuzzleScene();
    this.deps.ui.setStatus('Press the right button, memorize 9 colors, then paint the floor squares in order.');
  }

  override teardown(): void {
    this.squares.length = 0;
    this.colorPickups.length = 0;
    this.sequence = [];
    this.carriedIndicator = null;
    super.teardown();
  }

  protected override updateCustom(ts: number, _dt: number): void {
    const player = this.getVirtualPlayerPosition();

    this.handleButtons(player, ts);
    this.updateSequence(ts);

    if (this.puzzleLocked) {
      this.handleKeyPickupDrop();
      return;
    }

    this.handleColorPickups(player);
    this.handleSquareTouches(player);
    this.handleKeyPickupDrop();
  }

  private createSequence(): number[] {
    const sequence: number[] = [];
    for (let i = 0; i < 9; i += 1) {
      sequence.push(Math.floor(Math.random() * PALETTE.length));
    }
    return sequence;
  }

  private createPuzzleScene(): void {
    this.createScreen();
    this.createButtons();
    this.createBoard();
    this.createOneMarker();
    this.createColorPickups();
    this.createCarryIndicator();
  }

  private createScreen(): void {
    this.screenMaterial = new THREE.MeshStandardMaterial({
      color: SCREEN_BLACK,
      emissive: SCREEN_BLACK,
      emissiveIntensity: 0.12,
      roughness: 0.3,
      metalness: 0.02
    });

    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.25, 3.45), this.screenMaterial);
    screen.position.set(-4.93, 2.1, 0);
    this.worldRoot.add(screen);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 2.45, 3.65),
      new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.82, metalness: 0.2 })
    );
    frame.position.set(-4.98, 2.1, 0);
    this.worldRoot.add(frame);
  }

  private createButtons(): void {
    const makeButton = (x: number, z: number, color: number): void => {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.11, 8),
        new THREE.MeshStandardMaterial({ color: 0x1f2735, roughness: 0.68, metalness: 0.14, flatShading: true })
      );
      base.position.set(x, 0.055, z);
      this.worldRoot.add(base);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.29, 0.05, 8),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.42,
          roughness: 0.4,
          metalness: 0.16,
          flatShading: true
        })
      );
      cap.position.set(x, 0.13, z);
      this.worldRoot.add(cap);
    };

    makeButton(LEFT_BUTTON_POS.x, LEFT_BUTTON_POS.z, 0x8ea2bc);
    makeButton(RIGHT_BUTTON_POS.x, RIGHT_BUTTON_POS.z, 0x8ea2bc);
  }

  private createBoard(): void {
    const tileMaterial = new THREE.MeshStandardMaterial({
      color: BASE_TILE_COLOR,
      roughness: 0.78,
      metalness: 0.08,
      flatShading: true
    });

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const x = (col - 1) * (TILE_SIZE + TILE_GAP);
        const z = BOARD_CENTER_Z + (row - 1) * (TILE_SIZE + TILE_GAP);
        const index = row * 3 + col;

        const tile = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, 0.08, TILE_SIZE), tileMaterial.clone());
        tile.position.set(x, 0.04, z);
        this.worldRoot.add(tile);

        const outline = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(TILE_SIZE, 0.02, TILE_SIZE)),
          new THREE.LineBasicMaterial({ color: BASE_OUTLINE_COLOR, transparent: true, opacity: 0.85 })
        );
        outline.position.set(x, 0.125, z);
        this.worldRoot.add(outline);

        this.squares.push({
          index,
          center: { x, z },
          tileMesh: tile,
          outline,
          colorIndex: null,
          wasInside: false
        });
      }
    }
  }

  private createOneMarker(): void {
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2f4f8,
      emissive: 0x98a6c2,
      emissiveIntensity: 0.6,
      roughness: 0.34,
      metalness: 0.18,
      flatShading: true
    });

    const one = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.23), markerMaterial);
    stem.position.set(0.02, 0.01, 0);
    one.add(stem);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.04), markerMaterial);
    base.position.set(0.02, 0.01, 0.11);
    one.add(base);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.04), markerMaterial);
    cap.position.set(-0.01, 0.01, -0.1);
    cap.rotation.y = -0.35;
    one.add(cap);

    one.position.set(-1.86, 0.02, -1.56);
    this.worldRoot.add(one);
  }

  private createColorPickups(): void {
    const positions = [
      { x: -4.2, z: -2.0 },
      { x: -4.2, z: 0.0 },
      { x: -4.2, z: 2.0 },
      { x: 4.2, z: -2.0 },
      { x: 4.2, z: 0.0 },
      { x: 4.2, z: 2.0 },
      { x: -2.8, z: 4.2 },
      { x: 0.0, z: 4.2 },
      { x: 2.8, z: 4.2 }
    ];

    for (let i = 0; i < PALETTE.length; i += 1) {
      const color = PALETTE[i];
      const pos = positions[i];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.34, 0.34),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.32,
          roughness: 0.36,
          metalness: 0.14,
          flatShading: true
        })
      );
      mesh.position.set(pos.x, 0.17, pos.z);
      this.worldRoot.add(mesh);

      this.colorPickups.push({
        index: i,
        color,
        mesh,
        wasInside: false
      });
    }
  }

  private createCarryIndicator(): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.55,
        roughness: 0.28,
        metalness: 0.18,
        flatShading: true
      })
    );
    mesh.visible = false;
    this.worldRoot.add(mesh);
    this.carriedIndicator = mesh;
  }

  private handleButtons(player: { x: number; z: number }, ts: number): void {
    const onLeft = Math.hypot(player.x - LEFT_BUTTON_POS.x, player.z - LEFT_BUTTON_POS.z) <= BUTTON_RADIUS;
    if (onLeft && !this.wasOnLeftButton) {
      this.resetSquares();
      this.deps.ui.setStatus('Squares reset. Sequence is unchanged.');
    }
    this.wasOnLeftButton = onLeft;

    const onRight = Math.hypot(player.x - RIGHT_BUTTON_POS.x, player.z - RIGHT_BUTTON_POS.z) <= BUTTON_RADIUS;
    if (onRight && !this.wasOnRightButton) {
      this.startSequence(ts);
      this.deps.ui.setStatus('Sequence playing. Match the 9 squares in order.');
    }
    this.wasOnRightButton = onRight;
  }

  private startSequence(ts: number): void {
    this.sequenceRunning = true;
    this.sequenceCursor = 0;
    this.setScreenColor(PALETTE[this.sequence[0]]);
    this.nextSequenceSwitchTs = ts + FLASH_COLOR_MS;
  }

  private updateSequence(ts: number): void {
    if (!this.sequenceRunning || this.sequence.length === 0) {
      return;
    }

    while (this.sequenceRunning && ts >= this.nextSequenceSwitchTs) {
      this.sequenceCursor += 1;

      if (this.sequenceCursor >= this.sequence.length * 2) {
        this.sequenceRunning = false;
        this.setScreenColor(SCREEN_BLACK);
        return;
      }

      const isBlackStep = this.sequenceCursor % 2 === 1;
      if (isBlackStep) {
        this.setScreenColor(SCREEN_BLACK);
        this.nextSequenceSwitchTs += FLASH_BLACK_MS;
      } else {
        const colorStep = this.sequenceCursor / 2;
        this.setScreenColor(PALETTE[this.sequence[colorStep]]);
        this.nextSequenceSwitchTs += FLASH_COLOR_MS;
      }
    }
  }

  private setScreenColor(color: number): void {
    if (!this.screenMaterial) {
      return;
    }
    this.screenMaterial.color.setHex(color);
    this.screenMaterial.emissive.setHex(color);
    this.screenMaterial.emissiveIntensity = color === SCREEN_BLACK ? 0.12 : 0.78;
  }

  private handleColorPickups(player: { x: number; z: number }): void {
    for (const pickup of this.colorPickups) {
      const inside = Math.hypot(player.x - pickup.mesh.position.x, player.z - pickup.mesh.position.z) <= PICKUP_TOUCH_RADIUS;
      if (inside && !pickup.wasInside) {
        this.carriedColorIndex = pickup.index;
        this.updateCarryIndicator(player);
        this.deps.ui.setStatus('Color block picked. Paint the floor squares.');
      }
      pickup.wasInside = inside;
    }

    if (this.carriedColorIndex !== null) {
      this.updateCarryIndicator(player);
    }
  }

  private handleSquareTouches(player: { x: number; z: number }): void {
    if (this.carriedColorIndex === null) {
      return;
    }

    for (const square of this.squares) {
      const inside = Math.hypot(player.x - square.center.x, player.z - square.center.z) <= CELL_TOUCH_RADIUS;
      if (inside && !square.wasInside) {
        square.colorIndex = this.carriedColorIndex;
        const material = square.tileMesh.material as any;
        material.color.setHex(PALETTE[this.carriedColorIndex]);
        material.emissive.setHex(PALETTE[this.carriedColorIndex]);
        material.emissiveIntensity = 0.16;

        if (this.isSolved()) {
          this.revealKey();
        }
      }
      square.wasInside = inside;
    }

  }

  private handleKeyPickupDrop(): void {
    const keyCount = this.deps.state.getItemCountByPrefix('key');
    if (keyCount > this.previousKeyCount) {
      this.clearCarryColor();
    }
    this.previousKeyCount = keyCount;
  }

  private clearCarryColor(): void {
    this.carriedColorIndex = null;
    if (this.carriedIndicator) {
      this.carriedIndicator.visible = false;
    }
  }

  private updateCarryIndicator(player: { x: number; z: number }): void {
    if (!this.carriedIndicator || this.carriedColorIndex === null) {
      return;
    }

    const heading = this.deps.playerMesh.rotation.y;
    const carryDistance = 0.8;
    this.carriedIndicator.visible = true;
    this.carriedIndicator.position.set(
      player.x + Math.sin(heading) * carryDistance,
      0.9,
      player.z + Math.cos(heading) * carryDistance
    );
    const material = this.carriedIndicator.material as any;
    material.color.setHex(PALETTE[this.carriedColorIndex]);
    material.emissive.setHex(PALETTE[this.carriedColorIndex]);
  }

  private resetSquares(): void {
    for (const square of this.squares) {
      square.colorIndex = null;
      square.wasInside = false;
      const tileMaterial = square.tileMesh.material as any;
      tileMaterial.color.setHex(BASE_TILE_COLOR);
      tileMaterial.emissive.setHex(0x000000);
      tileMaterial.emissiveIntensity = 0;

      const outlineMaterial = square.outline.material as any;
      outlineMaterial.color.setHex(BASE_OUTLINE_COLOR);
    }
  }

  private isSolved(): boolean {
    for (const square of this.squares) {
      const expected = this.sequence[square.index];
      if (square.colorIndex !== expected) {
        return false;
      }
    }
    return true;
  }

  private revealKey(): void {
    if (this.keyRevealed || this.puzzleLocked) {
      return;
    }

    this.puzzleLocked = true;
    for (const square of this.squares) {
      const outlineMaterial = square.outline.material as any;
      outlineMaterial.color.setHex(SOLVED_OUTLINE_COLOR);
    }

    this.createCarryableKey(
      { x: 0, y: 0.65, z: 2.95 },
      0.75,
      'key.main',
      {
        collectedStatus: 'Color sequence solved. Carry the key to the door.'
      }
    );
    this.keyRevealed = true;
    this.deps.ui.setStatus('Correct sequence. A key has appeared.', 'good');
  }
}
