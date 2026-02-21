import { formatTimer } from '../game/timer';

type StatusTone = 'normal' | 'good';

const asHTMLElement = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required DOM element: ${id}`);
  }
  return element;
};

export class UISystem {
  private readonly preloadScreen = asHTMLElement('preloadScreen');
  private readonly preloadProgressFill = asHTMLElement('preloadProgressFill');
  private readonly preloadPercentEl = asHTMLElement('preloadPercent');
  private readonly preloadHint = asHTMLElement('preloadHint');
  private readonly splash = asHTMLElement('splash');
  private readonly levelSelectScreen = asHTMLElement('levelSelectScreen');
  private readonly levelSelectGrid = asHTMLElement('levelSelectGrid');
  private readonly hud = asHTMLElement('hud');
  private readonly aboutModal = asHTMLElement('aboutModal');
  private readonly optionsModal = asHTMLElement('optionsModal');
  private readonly levelCompleteModal = asHTMLElement('levelCompleteModal');
  private readonly startBtn = asHTMLElement('startBtn');
  private readonly aboutBtn = asHTMLElement('aboutBtn');
  private readonly optionsBtn = asHTMLElement('optionsBtn');
  private readonly restartLevelBtn = asHTMLElement('restartLevelBtn');
  private readonly nextLevelBtn = asHTMLElement('nextLevelBtn');
  private readonly levelSelectBtn = asHTMLElement('levelSelectBtn');
  private readonly levelSelectBackBtn = asHTMLElement('levelSelectBackBtn');
  private readonly levelCompleteTitleEl = asHTMLElement('levelCompleteTitle');
  private readonly aboutCloseBtn = asHTMLElement('aboutCloseBtn');
  private readonly optionsCloseBtn = asHTMLElement('optionsCloseBtn');
  private readonly splashSubtitleEl = asHTMLElement('splashSubtitle');
  private readonly timerEl = asHTMLElement('timer');
  private readonly inventoryEl = asHTMLElement('inventory');
  private readonly statusEl = asHTMLElement('status');

  private statusShownAt = 0;

  constructor() {
    this.aboutBtn.addEventListener('click', () => {
      this.aboutModal.classList.remove('hidden');
    });

    this.optionsBtn.addEventListener('click', () => {
      this.optionsModal.classList.remove('hidden');
    });

    this.aboutCloseBtn.addEventListener('click', () => {
      this.aboutModal.classList.add('hidden');
    });

    this.optionsCloseBtn.addEventListener('click', () => {
      this.optionsModal.classList.add('hidden');
    });
  }

  onStart(handler: () => void): void {
    this.startBtn.addEventListener('click', handler);
  }

  onRestart(handler: () => void): void {
    this.restartLevelBtn.addEventListener('click', handler);
  }

  onNext(handler: () => void): void {
    this.nextLevelBtn.addEventListener('click', handler);
  }

  onOpenLevelSelect(handler: () => void): void {
    this.levelSelectBtn.addEventListener('click', handler);
  }

  onLevelSelectBack(handler: () => void): void {
    this.levelSelectBackBtn.addEventListener('click', handler);
  }

  onLevelSelected(handler: (index: number) => void): void {
    this.levelSelectGrid.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest<HTMLElement>('[data-level-index]');
      if (!button) {
        return;
      }
      const levelIndexRaw = button.dataset.levelIndex;
      if (!levelIndexRaw) {
        return;
      }
      const levelIndex = Number(levelIndexRaw);
      if (Number.isInteger(levelIndex) && levelIndex >= 0) {
        handler(levelIndex);
      }
    });
  }

  revealGame(): void {
    this.splash.classList.add('hidden');
    this.levelSelectScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  showSplash(): void {
    this.splash.classList.remove('hidden');
    this.levelSelectScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
  }

  showLevelSelect(): void {
    this.splash.classList.add('hidden');
    this.levelSelectScreen.classList.remove('hidden');
  }

  hideLevelSelect(): void {
    this.levelSelectScreen.classList.add('hidden');
  }

  renderLevelSelect(params: {
    totalSlots: number;
    availableLevels: number;
    unlockedPlayableLevels: number;
    completedLevelIndexes: ReadonlySet<number>;
  }): void {
    this.levelSelectGrid.textContent = '';

    for (let i = 0; i < params.totalSlots; i += 1) {
      const isAvailable = i < params.availableLevels;
      const isUnlocked = isAvailable && i < params.unlockedPlayableLevels;
      const isComplete = params.completedLevelIndexes.has(i);
      const levelBtn = document.createElement('button');
      const label = document.createElement('span');
      const note = document.createElement('span');

      levelBtn.type = 'button';
      levelBtn.className = 'level-slot';
      label.className = 'level-slot-label';
      note.className = 'level-slot-note';
      label.textContent = `Level ${i + 1}`;

      if (isUnlocked) {
        levelBtn.dataset.levelIndex = String(i);
        note.textContent = isComplete ? 'COMPLETE' : 'UNLOCKED';
      } else {
        levelBtn.disabled = true;
        if (!isAvailable) {
          levelBtn.classList.add('level-slot-unavailable');
          note.textContent = 'SOON 🔒';
        } else {
          levelBtn.classList.add('level-slot-locked');
          note.textContent = 'LOCKED 🔒';
        }
      }

      if (isComplete) {
        levelBtn.classList.add('level-slot-complete');
      }

      levelBtn.append(label, note);
      this.levelSelectGrid.append(levelBtn);
    }
  }

  setPreloadProgress(ratio: number): void {
    const clamped = Math.min(1, Math.max(0, ratio));
    const percent = Math.round(clamped * 100);
    this.preloadProgressFill.style.width = `${percent}%`;
    this.preloadPercentEl.textContent = `${percent}%`;
  }

  setPreloadReady(): void {
    this.preloadHint.textContent = 'All assets loaded.';
  }

  hidePreloader(): void {
    this.preloadScreen.classList.add('hidden');
  }

  setTimer(ms: number): void {
    this.timerEl.textContent = formatTimer(ms);
  }

  setInventoryActive(active: boolean): void {
    this.inventoryEl.classList.toggle('active', active);
  }

  setStatus(message: string, tone: StatusTone = 'normal'): void {
    this.statusEl.textContent = message;
    this.statusEl.classList.add('visible');
    this.statusEl.classList.toggle('good', tone === 'good');
    this.statusShownAt = performance.now();
  }

  tick(ts: number): void {
    if (this.statusEl.classList.contains('visible') && ts - this.statusShownAt > 1800) {
      this.statusEl.classList.remove('visible');
    }
  }

  resetStatusTimer(): void {
    this.statusShownAt = 0;
  }

  setLevelLabel(levelNumber: number): void {
    this.splashSubtitleEl.textContent = `Level ${levelNumber}`;
  }

  showLevelComplete(levelNumber: number): void {
    this.levelCompleteTitleEl.textContent = `Level ${levelNumber} Complete`;
    this.levelCompleteModal.classList.remove('hidden');
  }

  hideLevelComplete(): void {
    this.levelCompleteModal.classList.add('hidden');
  }
}
