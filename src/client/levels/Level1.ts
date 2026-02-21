import { BaseLevel } from './BaseLevel';

export class Level1 extends BaseLevel {
  private wasTouchingCat = false;
  private meowAudio: HTMLAudioElement | null = null;
  private meowChance = 0.5;

  override initialize(): void {
    super.initialize();
    this.wasTouchingCat = false;
    this.meowChance = this.config.custom?.catMeowChance ?? 0.5;
    if (this.config.custom?.catMeowUrl) {
      this.meowAudio = new Audio(this.config.custom.catMeowUrl);
      this.meowAudio.preload = 'auto';
      this.meowAudio.volume = 0.45;
    } else {
      this.meowAudio = null;
    }
  }

  override teardown(): void {
    this.wasTouchingCat = false;
    this.meowAudio = null;
    super.teardown();
  }

  protected override updateCustom(): void {
    const catObject = this.findObjectConfig('cat.pet');
    if (!catObject) {
      this.wasTouchingCat = false;
      return;
    }

    const catAnchor = this.getObjectAnchor(catObject.id);
    if (!catAnchor) {
      this.wasTouchingCat = false;
      return;
    }

    const playerPos = this.getVirtualPlayerPosition();
    const distance = Math.hypot(playerPos.x - catAnchor.position.x, playerPos.z - catAnchor.position.z);
    const touchRadius = catObject.interaction?.touchRadius ?? 0.85;
    const touching = distance <= touchRadius;

    if (!touching) {
      this.wasTouchingCat = false;
      return;
    }

    if (!this.wasTouchingCat) {
      this.maybePlayMeow();
    }
    this.wasTouchingCat = true;
  }

  private maybePlayMeow(): void {
    if (!this.meowAudio || Math.random() > this.meowChance) {
      return;
    }

    const meow = this.meowAudio.cloneNode(true) as HTMLAudioElement;
    meow.volume = this.meowAudio.volume;
    void meow.play().catch(() => {
      // Ignore playback errors caused by browser autoplay policies.
    });
  }
}
