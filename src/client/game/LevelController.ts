import { type LevelConfig } from './levels';

export class LevelController {
  private currentIndexValue = 0;
  private readonly levels: LevelConfig[];
  private readonly onLoad: (level: LevelConfig, index: number) => void;

  constructor(levels: LevelConfig[], onLoad: (level: LevelConfig, index: number) => void) {
    if (levels.length === 0) {
      throw new Error('At least one level is required.');
    }

    this.levels = levels;
    this.onLoad = onLoad;
  }

  get currentIndex(): number {
    return this.currentIndexValue;
  }

  load(index: number): void {
    this.currentIndexValue = ((index % this.levels.length) + this.levels.length) % this.levels.length;
    this.onLoad(this.levels[this.currentIndexValue], this.currentIndexValue);
  }

  restart(): void {
    this.load(this.currentIndexValue);
  }

  next(): void {
    this.load(this.currentIndexValue + 1);
  }
}
