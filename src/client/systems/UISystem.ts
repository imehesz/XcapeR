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
  private readonly hud = asHTMLElement('hud');
  private readonly aboutModal = asHTMLElement('aboutModal');
  private readonly optionsModal = asHTMLElement('optionsModal');
  private readonly levelCompleteModal = asHTMLElement('levelCompleteModal');
  private readonly startBtn = asHTMLElement('startBtn');
  private readonly aboutBtn = asHTMLElement('aboutBtn');
  private readonly optionsBtn = asHTMLElement('optionsBtn');
  private readonly restartLevelBtn = asHTMLElement('restartLevelBtn');
  private readonly nextLevelBtn = asHTMLElement('nextLevelBtn');
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

  revealGame(): void {
    this.splash.classList.add('hidden');
    this.hud.classList.remove('hidden');
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
