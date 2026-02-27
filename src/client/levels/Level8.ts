import * as THREE from 'three';
import { BaseLevel } from './BaseLevel';

interface SudokuCell {
  readonly row: number;
  readonly col: number;
  readonly center: { x: number; z: number };
  readonly tileMesh: any;
  readonly outline: any;
  readonly locked: boolean;
  colorIndex: number | null;
  wasInside: boolean;
}

const GRID_SIZE = 4;
const SUBGRID_SIZE = 2;
const TILE_SIZE = 0.82;
const TILE_GAP = 0.34;
const BOARD_CENTER_Z = 0;
const CELL_TOUCH_RADIUS = 0.48;

const BASE_TILE_COLOR = 0x223043;
const BASE_OUTLINE_COLOR = 0x7aa7ff;
const LOCKED_OUTLINE_COLOR = 0xd04646;
const LOCKED_TILE_MULTIPLIER = 0.72;
const SOLVED_OUTLINE_COLOR = 0x5ef28c;

const COLOR_PALETTE: number[] = [
  0xe84b4b, // red
  0x4c78e8, // blue
  0x4bd17a, // green
  0xe5cf45  // yellow
];

const BASE_SOLUTION_GRID: number[][] = [
  [0, 1, 2, 3],
  [2, 3, 0, 1],
  [1, 0, 3, 2],
  [3, 2, 1, 0]
];

export class Level8 extends BaseLevel {
  private readonly cells: SudokuCell[] = [];
  private solutionGrid: number[][] = [];
  private lockedPositions = new Set<string>();
  private puzzleLocked = false;
  private keyRevealed = false;

  override initialize(): void {
    super.initialize();
    this.cells.length = 0;
    this.solutionGrid = [];
    this.lockedPositions.clear();
    this.puzzleLocked = false;
    this.keyRevealed = false;

    this.generatePuzzleLayout();
    this.createBoard();
    this.deps.ui.setStatus('Solve the 4x4 color Sudoku to reveal the key.');
  }

  override teardown(): void {
    this.cells.length = 0;
    this.solutionGrid = [];
    this.lockedPositions.clear();
    this.puzzleLocked = false;
    this.keyRevealed = false;
    super.teardown();
  }

  protected override updateCustom(_ts: number, _dt: number): void {
    if (this.puzzleLocked) {
      return;
    }

    const player = this.getVirtualPlayerPosition();
    for (const cell of this.cells) {
      const inside = Math.hypot(player.x - cell.center.x, player.z - cell.center.z) <= CELL_TOUCH_RADIUS;
      if (inside && !cell.wasInside) {
        this.handleCellTouch(cell);
      }
      cell.wasInside = inside;
    }
  }

  private createBoard(): void {
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const x = (col - 1.5) * (TILE_SIZE + TILE_GAP);
        const z = BOARD_CENTER_Z + (row - 1.5) * (TILE_SIZE + TILE_GAP);
        const locked = this.lockedPositions.has(`${row},${col}`);

        const tileMaterial = new THREE.MeshStandardMaterial({
          color: BASE_TILE_COLOR,
          roughness: 0.78,
          metalness: 0.08,
          flatShading: true
        });

        const tile = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, 0.08, TILE_SIZE), tileMaterial);
        tile.position.set(x, 0.04, z);
        this.worldRoot.add(tile);

        const outlineColor = locked ? LOCKED_OUTLINE_COLOR : BASE_OUTLINE_COLOR;
        const outline = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(TILE_SIZE, 0.02, TILE_SIZE)),
          new THREE.LineBasicMaterial({ color: outlineColor, transparent: true, opacity: 0.88 })
        );
        outline.position.set(x, 0.125, z);
        this.worldRoot.add(outline);

        const colorIndex = locked ? this.solutionGrid[row][col] : null;
        if (colorIndex !== null) {
          this.applyColorVisual(tile, colorIndex, locked);
        }

        this.cells.push({
          row,
          col,
          center: { x, z },
          tileMesh: tile,
          outline,
          locked,
          colorIndex,
          wasInside: false
        });
      }
    }
  }

  private generatePuzzleLayout(): void {
    const symbolMap = this.shuffle([0, 1, 2, 3]);
    const rowOrder = this.createBandOrder();
    const colOrder = this.createBandOrder();

    this.solutionGrid = Array.from({ length: GRID_SIZE }, () => Array<number>(GRID_SIZE).fill(0));
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const baseValue = BASE_SOLUTION_GRID[rowOrder[row]][colOrder[col]];
        this.solutionGrid[row][col] = symbolMap[baseValue];
      }
    }

    const allPositions: string[] = [];
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        allPositions.push(`${row},${col}`);
      }
    }
    const randomPositions = this.shuffle(allPositions).slice(0, 8);
    this.lockedPositions = new Set(randomPositions);
  }

  private createBandOrder(): number[] {
    const bandIndexes = this.shuffle([0, 1]);
    const order: number[] = [];
    for (const band of bandIndexes) {
      const offsetOrder = this.shuffle([0, 1]);
      for (const offset of offsetOrder) {
        order.push(band * SUBGRID_SIZE + offset);
      }
    }
    return order;
  }

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  private handleCellTouch(cell: SudokuCell): void {
    if (cell.locked) {
      return;
    }

    cell.colorIndex = this.nextColorState(cell.colorIndex);
    this.applyColorVisual(cell.tileMesh, cell.colorIndex, false);

    if (this.isBoardComplete() && this.isSolved()) {
      this.onPuzzleComplete();
    }
  }

  private nextColorState(current: number | null): number | null {
    if (current === null) {
      return 0;
    }
    const next = current + 1;
    if (next >= COLOR_PALETTE.length) {
      return null;
    }
    return next;
  }

  private applyColorVisual(mesh: THREE.Mesh, colorIndex: number | null, locked: boolean): void {
    const material = mesh.material as THREE.MeshStandardMaterial;

    if (colorIndex === null) {
      material.color.setHex(BASE_TILE_COLOR);
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0;
      return;
    }

    const color = COLOR_PALETTE[colorIndex];
    const finalColor = locked ? this.dimColor(color, LOCKED_TILE_MULTIPLIER) : color;

    material.color.setHex(finalColor);
    material.emissive.setHex(finalColor);
    material.emissiveIntensity = locked ? 0.14 : 0.24;
  }

  private dimColor(hex: number, factor: number): number {
    const color = new THREE.Color(hex);
    color.multiplyScalar(factor);
    return color.getHex();
  }

  private isBoardComplete(): boolean {
    for (const cell of this.cells) {
      if (cell.colorIndex === null) {
        return false;
      }
    }
    return true;
  }

  private isSolved(): boolean {
    const grid = this.toGrid();
    return this.validateRows(grid) && this.validateColumns(grid) && this.validateQuadrants(grid);
  }

  private validateRows(grid: Array<Array<number | null>>): boolean {
    for (let row = 0; row < GRID_SIZE; row += 1) {
      const seen = new Set<number>();
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const value = grid[row][col];
        if (value === null || seen.has(value)) {
          return false;
        }
        seen.add(value);
      }
      if (seen.size !== GRID_SIZE) {
        return false;
      }
    }
    return true;
  }

  private validateColumns(grid: Array<Array<number | null>>): boolean {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const seen = new Set<number>();
      for (let row = 0; row < GRID_SIZE; row += 1) {
        const value = grid[row][col];
        if (value === null || seen.has(value)) {
          return false;
        }
        seen.add(value);
      }
      if (seen.size !== GRID_SIZE) {
        return false;
      }
    }
    return true;
  }

  private validateQuadrants(grid: Array<Array<number | null>>): boolean {
    for (let rowStart = 0; rowStart < GRID_SIZE; rowStart += SUBGRID_SIZE) {
      for (let colStart = 0; colStart < GRID_SIZE; colStart += SUBGRID_SIZE) {
        const seen = new Set<number>();

        for (let rowOffset = 0; rowOffset < SUBGRID_SIZE; rowOffset += 1) {
          for (let colOffset = 0; colOffset < SUBGRID_SIZE; colOffset += 1) {
            const value = grid[rowStart + rowOffset][colStart + colOffset];
            if (value === null || seen.has(value)) {
              return false;
            }
            seen.add(value);
          }
        }

        if (seen.size !== GRID_SIZE) {
          return false;
        }
      }
    }

    return true;
  }

  private toGrid(): Array<Array<number | null>> {
    const grid: Array<Array<number | null>> = Array.from({ length: GRID_SIZE }, () =>
      Array<number | null>(GRID_SIZE).fill(null)
    );

    for (const cell of this.cells) {
      grid[cell.row][cell.col] = cell.colorIndex;
    }

    return grid;
  }

  private onPuzzleComplete(): void {
    if (this.puzzleLocked || this.keyRevealed) {
      return;
    }

    this.puzzleLocked = true;
    for (const cell of this.cells) {
      const material = cell.outline.material as any;
      material.color.setHex(SOLVED_OUTLINE_COLOR);
    }

    this.playSuccessCue();
    this.createCarryableKey(
      { x: 0, y: 0.65, z: 2.9 },
      0.75,
      'key.main',
      {
        collectedStatus: 'Puzzle solved. Carry the key to the door.'
      }
    );

    this.keyRevealed = true;
    this.deps.ui.setStatus('4x4 Sudoku solved. A key has appeared.', 'good');
  }

  private playSuccessCue(): void {
    const sfxVolSetting = this.deps.ui.settings.sfxVol;
    if (sfxVolSetting === 0) {
      return;
    }

    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    const audioCtx = new AudioCtx();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.05 * (sfxVolSetting / 10);
    gain.connect(audioCtx.destination);

    const notes = [784, 988, 1175];
    const startAt = audioCtx.currentTime;
    for (let i = 0; i < notes.length; i += 1) {
      const osc = audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      osc.connect(gain);
      osc.start(startAt + i * 0.11);
      osc.stop(startAt + i * 0.11 + 0.16);
    }

    setTimeout(() => {
      void audioCtx.close();
    }, 500);
  }
}
