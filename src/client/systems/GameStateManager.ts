export interface RuntimeStateSnapshot {
  timerValue: number;
  isDoorOpen: boolean;
  inventory: string[];
}

export class GameStateManager {
  private timerValue = 0;
  private isDoorOpen = false;
  private readonly inventory = new Set<string>();

  reset(): void {
    this.timerValue = 0;
    this.isDoorOpen = false;
    this.inventory.clear();
  }

  updateTimer(elapsedMs: number): void {
    if (!this.isDoorOpen) {
      this.timerValue = elapsedMs;
    }
  }

  getTimerValue(): number {
    return this.timerValue;
  }

  addItem(itemId: string): void {
    this.inventory.add(itemId);
  }

  hasItem(itemId: string): boolean {
    return this.inventory.has(itemId);
  }

  getItemCountByPrefix(prefix: string): number {
    let count = 0;
    for (const item of this.inventory) {
      if (item.startsWith(prefix)) {
        count += 1;
      }
    }
    return count;
  }

  setDoorOpen(isOpen: boolean): void {
    this.isDoorOpen = isOpen;
  }

  getDoorOpen(): boolean {
    return this.isDoorOpen;
  }

  getSnapshot(): RuntimeStateSnapshot {
    return {
      timerValue: this.timerValue,
      isDoorOpen: this.isDoorOpen,
      inventory: [...this.inventory]
    };
  }
}
