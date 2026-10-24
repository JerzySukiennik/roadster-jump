// Roadster Jump touch controls: left analog stick (steer on the ground, flip and roll in the air, walk on foot), hold buttons for throttle, brake, boost and jets, tap buttons for suction, camera, the flight to the lineup and back, reset, replay, menu and get in or out, and drag anywhere else on the screen to look around.
export class Touch {
  constructor(input) {
    this.input = input; this.root = document.getElementById('touch');
    this.stick = document.getElementById('stick'); this.knob = document.getElementById('knob'); this.enter = document.getElementById('tEnter');
    this.stickId = null; this.lookId = null; this.last = { x: 0, y: 0 }; this.held = new Map();
    const R = 75;
    const setStick = (t) => {
      const b = this.stick.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      let dx = t.clientX - cx, dy = t.clientY - cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const S = input.stick; S.on = true; S.x = dx / R; S.y = -dy / R;
      const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88); S.x = dz(S.x); S.y = dz(S.y);
    };
    const resetStick = () => { this.stick.classList.remove('active'); this.knob.style.transform = ''; Object.assign(input.stick, { x: 0, y: 0, on: false }); this.stickId = null; };
    this.stick.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; this.stickId = t.identifier; this.stick.classList.add('active'); setStick(t); }, { passive: false });
    for (const el of this.root.querySelectorAll('[data-k]')) {
      const code = el.dataset.k;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); for (const t of e.changedTouches) this.held.set(t.identifier, el); input.press(code); el.classList.add('down'); if (navigator.vibrate) navigator.vibrate(8); }, { passive: false });
    }
    for (const el of this.root.querySelectorAll('[data-t]')) {
      el.addEventListener('touchstart', (e) => { e.preventDefault(); input.tap(el.dataset.t); el.classList.add('down'); setTimeout(() => el.classList.remove('down'), 140); }, { passive: false });
    }
    addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('.touch [data-k], .touch [data-t], .stick, .menu, .title-screen')) continue;
        if (this.lookId === null) { this.lookId = t.identifier; this.last.x = t.clientX; this.last.y = t.clientY; }
      }
    }, { passive: true });
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) setStick(t);
        else if (t.identifier === this.lookId) { input.mdx += (t.clientX - this.last.x) * 1.6; input.mdy += (t.clientY - this.last.y) * 1.6; this.last.x = t.clientX; this.last.y = t.clientY; }
      }
      if (e.cancelable && !(e.target.closest && e.target.closest('.menu, .title-screen'))) e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) resetStick();
        if (t.identifier === this.lookId) this.lookId = null;
        const el = this.held.get(t.identifier);
        if (el) { this.held.delete(t.identifier); if (![...this.held.values()].includes(el)) { input.release(el.dataset.k); el.classList.remove('down'); } }
      }
    };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
  }

  show(on) { this.root.classList.toggle('hidden', !on); }
  setEnter(label) { this.enter.classList.toggle('on', !!label); if (label) this.enter.textContent = label; }
  setGo(label) { const b = this.root.querySelector('[data-t="KeyL"] span'); if (b && b.textContent !== label) b.textContent = label; }
  setFan(on) { const b = this.root.querySelector('[data-t="KeyF"]'); if (b) b.classList.toggle('on', on); }
}
