/**
 * Player input. Combines keyboard with an optional analog stick (mobile
 * joystick) and lets the UI inject one-shot actions (tap-to-interact).
 * Gameplay code still just reads axes / consume() — it does not care
 * whether a press came from a key or a thumb.
 */
export class Input {
  constructor(target = window) {
    this.held = new Set();
    this._pressed = new Set();
    this.enabled = true;
    this.axisX = 0;
    this.axisY = 0;

    target.addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      // avoid page scroll on arrows/space
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this._pressed.add(e.code);
      this.held.add(e.code);
    });
    target.addEventListener("keyup", (e) => this.held.delete(e.code));
    // don't leave keys "stuck" if focus is lost
    window.addEventListener("blur", () => {
      this.held.clear();
      this.setAxis(0, 0);
    });
  }

  isDown(...codes) {
    return codes.some((c) => this.held.has(c));
  }

  /** Consume a one-shot press (returns true once per keydown). */
  consume(...codes) {
    for (const c of codes) {
      if (this._pressed.has(c)) {
        this._pressed.delete(c);
        return true;
      }
    }
    return false;
  }

  /** Queue a one-shot action as if that key had just been pressed. */
  press(...codes) {
    if (!this.enabled) return;
    for (const c of codes) this._pressed.add(c);
  }

  /** Analog stick: x = turn (−1 left … 1 right), y = forward (−1 back … 1). */
  setAxis(x, y) {
    this.axisX = clamp(x, -1, 1);
    this.axisY = clamp(y, -1, 1);
  }

  /** Movement axes in screen-intuitive terms. */
  get moveForward() {
    const keys = (this.isDown("KeyW", "ArrowUp") ? 1 : 0) - (this.isDown("KeyS", "ArrowDown") ? 1 : 0);
    return clamp(keys + this.axisY, -1, 1);
  }
  get turn() {
    // positive = turn right
    const keys = (this.isDown("KeyD", "ArrowRight") ? 1 : 0) - (this.isDown("KeyA", "ArrowLeft") ? 1 : 0);
    return clamp(keys + this.axisX, -1, 1);
  }

  /** Clear one-shot buffer at end of frame. */
  endFrame() {
    this._pressed.clear();
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
