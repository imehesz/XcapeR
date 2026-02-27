import { type LevelConfig } from './levels';
import { BaseLevel, type LevelDependencies } from '../levels/BaseLevel';
import { Level1 } from '../levels/Level1';
import { Level2 } from '../levels/Level2';
import { Level3 } from '../levels/Level3';
import { Level4 } from '../levels/Level4';
import { Level5 } from '../levels/Level5';
import { Level6 } from '../levels/Level6';
import { Level7 } from '../levels/Level7';
import { Level8 } from '../levels/Level8';

export class LevelController {
  private readonly levels: LevelConfig[];
  private readonly deps: LevelDependencies;
  private currentLevel: BaseLevel | null = null;
  private currentIndexValue = 0;

  constructor(levels: LevelConfig[], deps: Omit<LevelDependencies, 'onCompleted'> & { onCompleted: (index: number) => void }) {
    if (levels.length === 0) {
      throw new Error('At least one level is required.');
    }

    this.levels = levels;
    this.deps = {
      ...deps,
      onCompleted: () => {
        deps.onCompleted(this.currentIndexValue);
      }
    };
  }

  get currentIndex(): number {
    return this.currentIndexValue;
  }

  load(index: number): void {
    if (this.currentLevel) {
      this.currentLevel.teardown();
      this.currentLevel = null;
    }

    this.currentIndexValue = ((index % this.levels.length) + this.levels.length) % this.levels.length;
    const config = this.levels[this.currentIndexValue];

    this.currentLevel = this.createLevel(config);
    this.currentLevel.initialize();
    this.deps.ui.setLevelLabel(this.currentIndexValue + 1);
    this.deps.ui.hideLevelComplete();
  }

  restart(): void {
    this.load(this.currentIndexValue);
  }

  next(): void {
    this.load(this.currentIndexValue + 1);
  }

  update(ts: number, dt: number): void {
    this.currentLevel?.update(ts, dt);
    this.deps.ui.setTimer(this.deps.state.getTimerValue());
    this.deps.ui.setInventoryActive(this.deps.state.getItemCountByPrefix('key') > 0);
  }

  dispose(): void {
    this.currentLevel?.teardown();
    this.currentLevel = null;
  }

  private createLevel(config: LevelConfig): BaseLevel {
    switch (config.id) {
      case 'level-1':
        return new Level1(config, this.deps);
      case 'level-2':
        return new Level2(config, this.deps);
      case 'level-3':
        return new Level3(config, this.deps);
      case 'level-4':
        return new Level4(config, this.deps);
      case 'level-5':
        return new Level6(config, this.deps);
      case 'level-6':
        return new Level5(config, this.deps);
      case 'level-7':
        return new Level7(config, this.deps);
      case 'level-8':
        return new Level8(config, this.deps);
      default:
        return new BaseLevel(config, this.deps);
    }
  }
}
