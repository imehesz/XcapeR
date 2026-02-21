export interface MovementVector {
  x: number;
  z: number;
}

export class InputManager {
  private readonly joystickEl: HTMLElement;
  private readonly joystickKnobEl: HTMLElement;

  private readonly keyState = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };

  private readonly joystickState = {
    x: 0,
    y: 0,
    pointerId: -1
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => this.onKeyChange(e, true);
  private readonly onKeyUp = (e: KeyboardEvent): void => this.onKeyChange(e, false);
  private readonly onTouchStart = (event: TouchEvent): void => {
    if (this.joystickState.pointerId !== -1) {
      return;
    }

    for (const touch of event.changedTouches) {
      this.joystickState.pointerId = touch.identifier;
      this.handleJoystickMove(touch.clientX, touch.clientY);
      break;
    }

    event.preventDefault();
  };
  private readonly onTouchMove = (event: TouchEvent): void => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === this.joystickState.pointerId) {
        this.handleJoystickMove(touch.clientX, touch.clientY);
      }
    }

    event.preventDefault();
  };
  private readonly onTouchEnd = (event: TouchEvent): void => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === this.joystickState.pointerId) {
        this.resetJoystickState();
      }
    }
  };
  private readonly onTouchCancel = (): void => {
    this.resetJoystickState();
  };

  constructor(joystickEl: HTMLElement, joystickKnobEl: HTMLElement) {
    this.joystickEl = joystickEl;
    this.joystickKnobEl = joystickKnobEl;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.joystickEl.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.joystickEl.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd);
    window.addEventListener('touchcancel', this.onTouchCancel);
  }

  getMovementVector(): MovementVector {
    return {
      x: Number(this.keyState.right) - Number(this.keyState.left) + this.joystickState.x,
      z: Number(this.keyState.forward) - Number(this.keyState.backward) + this.joystickState.y
    };
  }

  reset(): void {
    this.keyState.forward = false;
    this.keyState.backward = false;
    this.keyState.left = false;
    this.keyState.right = false;
    this.resetJoystickState();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.joystickEl.removeEventListener('touchstart', this.onTouchStart);
    this.joystickEl.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchCancel);
  }

  private onKeyChange(event: KeyboardEvent, pressed: boolean): void {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.keyState.backward = pressed;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.keyState.forward = pressed;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.keyState.left = pressed;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keyState.right = pressed;
        break;
      default:
        return;
    }

    event.preventDefault();
  }

  private resetJoystickVisual(): void {
    this.joystickKnobEl.style.transform = 'translate(-50%, -50%)';
  }

  private resetJoystickState(): void {
    this.joystickState.pointerId = -1;
    this.joystickState.x = 0;
    this.joystickState.y = 0;
    this.resetJoystickVisual();
  }

  private handleJoystickMove(clientX: number, clientY: number): void {
    const rect = this.joystickEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const radius = rect.width * 0.33;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(radius, len);
    const nx = (dx / len) * clamped;
    const ny = (dy / len) * clamped;

    this.joystickState.x = nx / radius;
    this.joystickState.y = ny / radius;
    this.joystickKnobEl.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
  }
}
