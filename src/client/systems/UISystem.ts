import { formatTimer } from '../game/timer';
import gameMusicUrl from '../../../assets/audio/game-music.mp3';

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
  private readonly colorBtns = document.querySelectorAll('.color-btn');
  private readonly sfxDecBtn = asHTMLElement('sfxDecBtn');
  private readonly sfxIncBtn = asHTMLElement('sfxIncBtn');
  private readonly sfxVolLabel = asHTMLElement('sfxVolLabel');
  private readonly musicDecBtn = asHTMLElement('musicDecBtn');
  private readonly musicIncBtn = asHTMLElement('musicIncBtn');
  private readonly musicVolLabel = asHTMLElement('musicVolLabel');
  private readonly bgMusic = asHTMLElement('bgMusic') as HTMLAudioElement;
  private colorChangeCallback?: (colorHex: number) => void;

  public settings = {
    color: parseInt(localStorage.getItem('xcaper.color') || '0x7ee787', 16),
    sfxVol: parseInt(localStorage.getItem('xcaper.sfxVol') || '5', 10),
    musicVol: parseInt(localStorage.getItem('xcaper.musicVol') || '5', 10),
  };

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

    // Options UI setup
    this.updateOptionsUI();
    this.applyMusicVolume();
    this.bgMusic.src = gameMusicUrl;

    // Color Picker
    this.colorBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const colorStr = target.dataset.color;
        if (colorStr) {
          this.settings.color = parseInt(colorStr, 16);
          localStorage.setItem('xcaper.color', colorStr);
          this.updateOptionsUI();
          if (this.colorChangeCallback) this.colorChangeCallback(this.settings.color);
        }
      });
    });

    // SFX Volume
    this.sfxDecBtn.addEventListener('click', () => this.setSfxVol(this.settings.sfxVol - 1));
    this.sfxIncBtn.addEventListener('click', () => this.setSfxVol(this.settings.sfxVol + 1));

    // Music Volume
    this.musicDecBtn.addEventListener('click', () => this.setMusicVol(this.settings.musicVol - 1));
    this.musicIncBtn.addEventListener('click', () => this.setMusicVol(this.settings.musicVol + 1));
    
    // Autoplay policy workaround: Play music on first user interaction anywhere
    const playMusicOnce = () => {
      this.bgMusic.play().catch(() => {}); // Catch if still blocked
      document.removeEventListener('click', playMusicOnce);
    };
    document.addEventListener('click', playMusicOnce);
  }

onPlayerColorChange(handler: (colorHex: number) => void): void {
    this.colorChangeCallback = handler;
  }

  private setSfxVol(val: number) {
    this.settings.sfxVol = Math.max(0, Math.min(10, val));
    localStorage.setItem('xcaper.sfxVol', this.settings.sfxVol.toString());
    this.updateOptionsUI();
    
    // Play the test sound with the newly selected volume
    this.playTestBeep(this.settings.sfxVol);
  }

  private playTestBeep(volumeLevel: number): void {
    if (volumeLevel === 0) return;

    // Support standard and webkit prefixes
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    const audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    // 440Hz is a standard, pleasant mid-range tone
    osc.frequency.value = 880;
    osc.type = 'triangle';
    
    // Scale the gain exactly how the game levels do it
    const maxGain = 0.04;
    gain.gain.value = maxGain * (volumeLevel / 10); 
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    
    // Stop the beep after 150ms
    setTimeout(() => {
      osc.stop();
      void audioCtx.close();
    }, 200);
  }

  private setMusicVol(val: number) {
    this.settings.musicVol = Math.max(0, Math.min(10, val));
    localStorage.setItem('xcaper.musicVol', this.settings.musicVol.toString());
    this.applyMusicVolume();
    this.updateOptionsUI();
  }

  private applyMusicVolume() {
    // Convert 0-10 linear scale to a 0.0 - 1.0 volume scale
    this.bgMusic.volume = this.settings.musicVol / 10;
  }

  private updateOptionsUI() {
    this.sfxVolLabel.textContent = this.settings.sfxVol.toString();
    this.musicVolLabel.textContent = this.settings.musicVol.toString();
    
    const hexStr = `0x${this.settings.color.toString(16).padStart(6, '0')}`;
    this.colorBtns.forEach(btn => {
      if ((btn as HTMLElement).dataset.color === hexStr) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
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
   // this.splashSubtitleEl.textContent = `Level ${levelNumber}`;
  }

  showLevelComplete(levelNumber: number): void {
    this.levelCompleteTitleEl.textContent = `Level ${levelNumber} Complete`;
    this.levelCompleteModal.classList.remove('hidden');
  }

  hideLevelComplete(): void {
    this.levelCompleteModal.classList.add('hidden');
  }
}
