// Roadster Jump photo mode: the glass bar over a frozen moment (live play or a replay) flown with the ghost camera. Field of view, focus distance and blur (real depth of field in post), exposure, tilt and three looks (Natural, Film, Noir); Save renders the frame at up to 2x resolution and downloads it as a PNG, or opens the share sheet on phones.
const $ = (id) => document.getElementById(id);
const LOOKS = {
  natural: { sat: 1.06, con: 1.05, tint: [1, 1, 1], grain: 0.02, vig: 2.4 },
  film: { sat: 0.86, con: 1.12, tint: [1.05, 1.0, 0.9], grain: 0.055, vig: 3.4 },
  noir: { sat: 0, con: 1.32, tint: [1, 1, 1], grain: 0.045, vig: 3.2 },
};

export class PhotoMode {
  constructor({ post, ghost, touch, capture, toast }) {
    this.post = post; this.ghost = ghost; this.touch = touch; this.capture = capture; this.toast = toast;
    this.el = $('photo'); this.active = false; this.look = 'natural';
    this.focusM = (v) => 0.5 * Math.pow(240, v / 100);
    const bind = (id, fn) => { const inp = $(id), out = $(id + 'V'); const upd = () => { inp.style.setProperty('--p', `${((inp.value - inp.min) / (inp.max - inp.min)) * 100}%`); out.textContent = fn(+inp.value); }; inp.addEventListener('input', upd); this[id] = { inp, upd }; upd(); };
    bind('phFov', (v) => { this.ghost.fov = v; return `${v}°`; });
    bind('phFocus', (v) => { const m = this.focusM(v); this.post.dof.focus = m; return m < 10 ? `${m.toFixed(1)} m` : `${Math.round(m)} m`; });
    bind('phBlur', (v) => { this.post.dof.blur = v / 100; this.post.dof.on = v > 0 && this.active; return v ? `${v}%` : 'Off'; });
    bind('phExp', (v) => { this.post.final.uniforms.uExp.value = Math.pow(2, v / 10); return `${v > 0 ? '+' : ''}${(v / 10).toFixed(1)} EV`; });
    bind('phRoll', (v) => { this.ghost.roll = -v * Math.PI / 180; return `${v}°`; });
    for (const b of this.el.querySelectorAll('#phLook button')) b.addEventListener('click', () => this.setLook(b.dataset.v));
    $('phSave').addEventListener('click', () => this.save());
    $('phExit').addEventListener('click', () => this.onExit && this.onExit());
    for (const ev of ['pointerdown', 'wheel', 'touchstart']) this.el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  setLook(k) {
    this.look = k; const L = LOOKS[k], U = this.post.final.uniforms;
    U.uSat.value = L.sat; U.uCon.value = L.con; U.uTint.value.set(...L.tint); U.uGrain.value = L.grain; U.uVig.value = L.vig;
    for (const b of this.el.querySelectorAll('#phLook button')) b.classList.toggle('on', b.dataset.v === k);
  }

  open(focus) {
    this.active = true;
    const fv = Math.round(Math.max(0, Math.min(100, Math.log(Math.max(0.5, focus) / 0.5) / Math.log(240) * 100)));
    this.phFov.inp.value = Math.round(this.ghost.fov); this.phFocus.inp.value = fv; this.phBlur.inp.value = 0; this.phExp.inp.value = 0; this.phRoll.inp.value = 0;
    for (const k of ['phFov', 'phFocus', 'phBlur', 'phExp', 'phRoll']) this[k].upd();
    this.setLook('natural');
    $('phTip').textContent = this.touch ? 'Stick to fly · Go and Brake up, down · drag to look' : 'WASD fly · Q/E down, up · Shift fast · drag to look · wheel speed · O or Esc to leave';
    this.el.classList.remove('hidden'); void this.el.offsetWidth; this.el.classList.add('on');
  }

  close() {
    this.active = false; this.post.dof.on = false; this.post.final.uniforms.uExp.value = 1; this.ghost.roll = 0;
    this.setLook('natural');
    this.el.classList.remove('on'); this.el.classList.add('hidden');
  }

  async save() {
    const btn = $('phSave'); if (btn.disabled) return;
    btn.disabled = true; btn.textContent = 'Saving';
    try {
      const blob = await this.capture();
      if (!blob) throw new Error('no image');
      const d = new Date(), p2 = (n) => String(n).padStart(2, '0'), name = `roadster-jump-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.png`;
      const fl = $('phFlash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
      const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
      if (this.touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Roadster Jump' }); this.toast('Photo shared'); return; } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      this.toast('Photo saved');
    } catch (e) { this.toast('Could not save the photo'); } finally { btn.disabled = false; btn.textContent = 'Save photo'; }
  }
}
