/**
 * On-screen analog stick. Pointer-driven so one thumb can steer while the
 * other taps Interact. Reports a deadzoned −1…1 vector; the knob follows
 * the finger inside the base so it reads as a little physical control.
 */
export class Joystick {
  constructor(el, onChange) {
    this.el = el;
    this.knob = el.querySelector(".joystick-knob");
    this.onChange = onChange;
    this.maxDist = 38;
    this.dead = 0.18;
    this.pointerId = null;

    el.addEventListener("pointerdown", (e) => this._down(e));
    el.addEventListener("pointermove", (e) => this._move(e));
    el.addEventListener("pointerup", (e) => this._up(e));
    el.addEventListener("pointercancel", (e) => this._up(e));
  }

  _down(e) {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.el.classList.add("active");
    try { this.el.setPointerCapture(e.pointerId); } catch { /* older Safari */ }
    this._apply(e.clientX, e.clientY);
    e.preventDefault();
  }

  _move(e) {
    if (e.pointerId !== this.pointerId) return;
    this._apply(e.clientX, e.clientY);
    e.preventDefault();
  }

  _up(e) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.el.classList.remove("active");
    this._setKnob(0, 0);
    this.onChange(0, 0);
  }

  _apply(clientX, clientY) {
    const r = this.el.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    const mag = Math.hypot(dx, dy);
    const clamped = mag > this.maxDist ? this.maxDist / mag : 1;
    const kx = dx * clamped;
    const ky = dy * clamped;
    this._setKnob(kx, ky);

    let nx = kx / this.maxDist;
    let ny = ky / this.maxDist;
    const len = Math.hypot(nx, ny);
    if (len < this.dead) {
      this.onChange(0, 0);
      return;
    }
    const t = (len - this.dead) / (1 - this.dead);
    nx = (nx / len) * t;
    ny = (ny / len) * t;
    // screen-up is forward, screen-right is turn-right
    this.onChange(nx, -ny);
  }

  _setKnob(x, y) {
    this.knob.style.transform = `translate(${x}px, ${y}px)`;
  }
}
