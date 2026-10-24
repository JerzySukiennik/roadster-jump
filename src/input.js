// Roadster Jump input: keyboard with edge detection, mouse look through pointer lock, and the touch layer (left stick, right-hand pedals and thruster buttons, drag-to-look) merged into one set of sim controls and one-shot actions.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set(); this.pressed = new Set(); this.touch = new Set(); this.touchPressed = new Set();
    this.mdx = 0; this.mdy = 0; this.wheel = 0; this.locked = false; this.steer = 0;
    this.stick = { x: 0, y: 0, on: false };
    this.override = null;
    const block = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (block.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => { this.down.delete(e.code); });
    addEventListener('blur', () => { this.down.clear(); this.touch.clear(); this.stick.x = this.stick.y = 0; });
    addEventListener('mousemove', (e) => { if (this.locked) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; } else if (this.dragging) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; } });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 2 || e.button === 0) this.dragging = !this.locked && this.dragOk; });
    addEventListener('mouseup', () => { this.dragging = false; });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; if (this.onLockChange) this.onLockChange(this.locked); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  requestLock() {
    if (this.isTouch) return;
    const plain = () => { try { const q = this.canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (e) { this.locked = false; } };
    try { const p = this.canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(plain); } catch (e) { plain(); }
  }

  is(code) { return this.down.has(code) || this.touch.has(code); }
  hit(code) { return this.pressed.has(code) || this.touchPressed.has(code); }
  press(code) { if (!this.touch.has(code)) this.touchPressed.add(code); this.touch.add(code); }
  release(code) { this.touch.delete(code); }
  tap(code) { this.touchPressed.add(code); }

  controls(dt, airborne) {
    if (this.override) return this.override;
    const k = (c) => this.is(c);
    const left = k('KeyA'), right = k('KeyD');
    const target = (left ? 1 : 0) - (right ? 1 : 0);
    const rate = target === 0 ? 7 : Math.sign(target) !== Math.sign(this.steer) && this.steer !== 0 ? 9 : 5;
    this.steer += Math.max(-rate * dt, Math.min(rate * dt, target - this.steer));
    const S = this.stick, sx = S.on ? S.x : 0, sy = S.on ? S.y : 0;
    const pitch = (k('ArrowUp') ? 1 : 0) - (k('ArrowDown') ? 1 : 0) + (airborne ? sy : 0);
    const roll = (k('ArrowRight') ? 1 : 0) - (k('ArrowLeft') ? 1 : 0) + (airborne ? sx : 0);
    return {
      throttle: k('KeyW') ? 1 : 0,
      brake: k('KeyS') ? 1 : 0,
      steer: Math.max(-1, Math.min(1, this.steer - (airborne ? 0 : sx))),
      boost: k('ShiftLeft') || k('ShiftRight'),
      lift: k('Space'),
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
    };
  }

  move() {
    const k = (c) => this.is(c), S = this.stick;
    let x = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0), z = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    if (S.on) { x += S.x; z += S.y; }
    const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
    return { x, z, run: k('ShiftLeft') || k('ShiftRight') || (S.on && Math.hypot(S.x, S.y) > 0.92), jump: this.hit('Space') };
  }

  consumeMouse() { const d = [this.mdx, this.mdy, this.wheel]; this.mdx = 0; this.mdy = 0; this.wheel = 0; return d; }
  endFrame() { this.pressed.clear(); this.touchPressed.clear(); }
}
