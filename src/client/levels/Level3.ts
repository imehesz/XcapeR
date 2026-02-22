import * as THREE from 'three';
import { PickupKey } from '../entities/PickupKey';
import { BaseLevel } from './BaseLevel';

type MarkSymbol = 'X' | 'O';
type CellSymbol = MarkSymbol | null;
type ActiveSymbol = MarkSymbol | null;

interface BoardCell {
  readonly center: { x: number; z: number };
  readonly tileMesh: any;
  readonly xMarker: any;
  readonly oMarker: any;
  symbol: CellSymbol;
  wasInside: boolean;
}

const BUTTON_RADIUS = 0.58;
const CELL_TOUCH_RADIUS = 0.5;
const BOARD_TILE_SIZE = 0.9;
const BOARD_TILE_GAP = 0.2;
const BOARD_CENTER_Z = 0;
const O_BUTTON_POS = { x: -1.45, z: -3.65 };
const X_BUTTON_POS = { x: 1.45, z: -3.65 };
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

export class Level3 extends BaseLevel {
  private readonly boardCells: BoardCell[] = [];
  private keyPickup: PickupKey | null = null;
  private keyCollected = false;
  private puzzleLocked = false;
  private activeSymbol: ActiveSymbol = null;
  private wasOnOButton = false;
  private wasOnXButton = false;

  private oLetterMaterial: any;
  private xLetterMaterial: any;

  override initialize(): void {
    super.initialize();
    this.boardCells.length = 0;
    this.keyPickup = null;
    this.keyCollected = false;
    this.puzzleLocked = false;
    this.activeSymbol = null;
    this.wasOnOButton = false;
    this.wasOnXButton = false;
    this.oLetterMaterial = null;
    this.xLetterMaterial = null;
    this.createPuzzleScene();
    this.updateLetterColors();
  }

  override teardown(): void {
    if (this.keyPickup) {
      this.keyPickup.dispose(this.worldRoot);
      this.keyPickup = null;
    }
    this.boardCells.length = 0;
    super.teardown();
  }

  protected override updateCustom(ts: number, dt: number): void {
    if (this.keyPickup && !this.keyCollected) {
      this.keyPickup.update(dt);
      if (this.keyPickup.tryPickup(this.getVirtualPlayerPosition())) {
        this.keyPickup.removeFrom(this.worldRoot);
        this.keyCollected = true;
      }
    }

    this.animateLetters(ts);
    if (this.puzzleLocked) {
      return;
    }

    const player = this.getVirtualPlayerPosition();
    this.handleButtons(player);
    this.handleBoardTouches(player);
  }

  private createPuzzleScene(): void {
    this.createWallLetters();
    this.createSelectorButtons();
    this.createBoard();
  }

  private createWallLetters(): void {
    const letterY = 2.05;
    const letterZ = -4.82;

    this.oLetterMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a2f2f,
      emissive: 0xcf2f2f,
      emissiveIntensity: 0.75,
      roughness: 0.34,
      metalness: 0.12,
      flatShading: true
    });
    const oLetter = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 16), this.oLetterMaterial);
    oLetter.position.set(-1.45, letterY, letterZ);
    this.worldRoot.add(oLetter);

    this.xLetterMaterial = new THREE.MeshStandardMaterial({
      color: 0x2f7a44,
      emissive: 0x2fcf61,
      emissiveIntensity: 1.2,
      roughness: 0.34,
      metalness: 0.12,
      flatShading: true
    });
    const xLetter = new THREE.Group();
    const xBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.08), this.xLetterMaterial);
    xBar1.rotation.z = Math.PI * 0.25;
    const xBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.08), this.xLetterMaterial);
    xBar2.rotation.z = -Math.PI * 0.25;
    xLetter.add(xBar1);
    xLetter.add(xBar2);
    xLetter.position.set(1.45, letterY, letterZ);
    this.worldRoot.add(xLetter);
  }

  private createSelectorButtons(): void {
    const makeButton = (x: number, z: number, color: number): void => {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.11, 8),
        new THREE.MeshStandardMaterial({
          color: 0x1f2735,
          roughness: 0.68,
          metalness: 0.14,
          flatShading: true
        })
      );
      base.position.set(x, 0.055, z);
      this.worldRoot.add(base);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.29, 0.05, 8),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.45,
          roughness: 0.4,
          metalness: 0.16,
          flatShading: true
        })
      );
      cap.position.set(x, 0.13, z);
      this.worldRoot.add(cap);
    };

    makeButton(O_BUTTON_POS.x, O_BUTTON_POS.z, 0x8492a4);
    makeButton(X_BUTTON_POS.x, X_BUTTON_POS.z, 0x8492a4);
  }

  private createBoard(): void {
    const tileMaterial = new THREE.MeshStandardMaterial({
      color: 0x223043,
      roughness: 0.78,
      metalness: 0.08,
      flatShading: true
    });

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const x = (col - 1) * (BOARD_TILE_SIZE + BOARD_TILE_GAP);
        const z = BOARD_CENTER_Z + (row - 1) * (BOARD_TILE_SIZE + BOARD_TILE_GAP);

        const tile = new THREE.Mesh(new THREE.BoxGeometry(BOARD_TILE_SIZE, 0.08, BOARD_TILE_SIZE), tileMaterial);
        tile.position.set(x, 0.04, z);
        this.worldRoot.add(tile);

        const xMarker = this.createBoardXMarker();
        xMarker.position.set(x, 0.11, z);
        xMarker.visible = false;
        this.worldRoot.add(xMarker);

        const oMarker = this.createBoardOMarker();
        oMarker.position.set(x, 0.11, z);
        oMarker.visible = false;
        this.worldRoot.add(oMarker);

        this.boardCells.push({
          center: { x, z },
          tileMesh: tile,
          xMarker,
          oMarker,
          symbol: null,
          wasInside: false
        });
      }
    }
  }

  private createBoardXMarker(): any {
    const material = new THREE.MeshStandardMaterial({
      color: 0x35c764,
      emissive: 0x1f6d39,
      emissiveIntensity: 0.6,
      roughness: 0.32,
      metalness: 0.14,
      flatShading: true
    });
    const xMarker = new THREE.Group();
    const barA = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.08), material);
    barA.rotation.y = Math.PI * 0.25;
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.08), material);
    barB.rotation.y = -Math.PI * 0.25;
    xMarker.add(barA);
    xMarker.add(barB);
    return xMarker;
  }

  private createBoardOMarker(): any {
    const material = new THREE.MeshStandardMaterial({
      color: 0xcc3a3a,
      emissive: 0x6e2323,
      emissiveIntensity: 0.6,
      roughness: 0.32,
      metalness: 0.14,
      flatShading: true
    });
    const oMarker = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.05, 8, 16), material);
    oMarker.rotation.x = Math.PI / 2;
    return oMarker;
  }

  private handleButtons(player: { x: number; z: number }): void {
    const onOButton = Math.hypot(player.x - O_BUTTON_POS.x, player.z - O_BUTTON_POS.z) <= BUTTON_RADIUS;
    if (onOButton && !this.wasOnOButton) {
      this.applyActiveSymbol('O', true);
    }
    this.wasOnOButton = onOButton;

    const onXButton = Math.hypot(player.x - X_BUTTON_POS.x, player.z - X_BUTTON_POS.z) <= BUTTON_RADIUS;
    if (onXButton && !this.wasOnXButton) {
      this.applyActiveSymbol('X', true);
    }
    this.wasOnXButton = onXButton;
  }

  private handleBoardTouches(player: { x: number; z: number }): void {
    if (this.activeSymbol === null) {
      return;
    }

    for (const cell of this.boardCells) {
      const inside = Math.hypot(player.x - cell.center.x, player.z - cell.center.z) <= CELL_TOUCH_RADIUS;
      if (inside && !cell.wasInside) {
        this.toggleCell(cell);
      }
      cell.wasInside = inside;
    }
  }

  private toggleCell(cell: BoardCell): void {
    if (this.activeSymbol === null) {
      return;
    }

    const nextSymbol: CellSymbol = cell.symbol === this.activeSymbol ? null : this.activeSymbol;
    cell.symbol = nextSymbol;
    cell.xMarker.visible = nextSymbol === 'X';
    cell.oMarker.visible = nextSymbol === 'O';

    if (this.hasWinningLine()) {
      this.revealKey();
    }
  }

  private clearBoard(): void {
    for (const cell of this.boardCells) {
      cell.symbol = null;
      cell.xMarker.visible = false;
      cell.oMarker.visible = false;
      cell.wasInside = false;
    }
  }

  private applyActiveSymbol(symbol: MarkSymbol, resetBoard: boolean): void {
    this.activeSymbol = symbol;
    if (resetBoard) {
      this.clearBoard();
      this.deps.ui.setStatus(`${symbol} selected. Board reset.`);
    }
    this.updateLetterColors();
  }

  private updateLetterColors(): void {
    if (!this.xLetterMaterial || !this.oLetterMaterial) {
      return;
    }

    const xActive = this.activeSymbol === 'X';
    const oActive = this.activeSymbol === 'O';

    this.xLetterMaterial.color.setHex(xActive ? 0x2f7a44 : 0x8a2f2f);
    this.xLetterMaterial.emissive.setHex(xActive ? 0x2fcf61 : 0xcf2f2f);

    this.oLetterMaterial.color.setHex(oActive ? 0x2f7a44 : 0x8a2f2f);
    this.oLetterMaterial.emissive.setHex(oActive ? 0x2fcf61 : 0xcf2f2f);
  }

  private animateLetters(ts: number): void {
    if (!this.xLetterMaterial || !this.oLetterMaterial) {
      return;
    }

    const pulse = 0.5 + Math.sin(ts * 0.005) * 0.5;
    const activeIntensity = 0.95 + pulse * 0.35;
    const inactiveIntensity = 0.52 + pulse * 0.16;

    this.xLetterMaterial.emissiveIntensity = this.activeSymbol === 'X' ? activeIntensity : inactiveIntensity;
    this.oLetterMaterial.emissiveIntensity = this.activeSymbol === 'O' ? activeIntensity : inactiveIntensity;
  }

  private hasWinningLine(): boolean {
    for (const [a, b, c] of WIN_LINES) {
      const symbol = this.boardCells[a].symbol;
      if (!symbol) {
        continue;
      }
      if (symbol === this.boardCells[b].symbol && symbol === this.boardCells[c].symbol) {
        return true;
      }
    }
    return false;
  }

  private revealKey(): void {
    if (this.keyPickup || this.puzzleLocked) {
      return;
    }

    this.puzzleLocked = true;
    this.keyPickup = new PickupKey(
      { x: 0, y: 0.65, z: 2.95 },
      0.75,
      'key.main',
      (itemId: string) => {
        this.deps.state.addItem(itemId);
        this.deps.ui.setInventoryActive(this.deps.state.getItemCountByPrefix('key') > 0);
        this.deps.ui.setStatus('Tic-tac-toe solved. Key collected.', 'good');
      }
    );
    this.keyPickup.addTo(this.worldRoot);
    this.deps.ui.setStatus('Tic-tac-toe solved. A key has appeared.', 'good');
  }
}
