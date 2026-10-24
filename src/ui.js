// Roadster Jump UI: the ramp loader (a dot rides the curl as assets arrive and jumps off the lip when done), the title screen over the showroom car (cursor tooltips, Interact/Exploded switch, live leaderboard preview, progress inside Play), the HUD (rolling speed, gear, suction spool, thruster dots, live flip counter and hang timer, result card with counting points and a breakdown, best score, prompts, toasts, replay bar) and the menu (sliding tab and segment inks, settings with live values, quick actions, interactive keyboard, leaderboards).
import { BOARDS } from './online.js';

const $ = (id) => document.getElementById(id);
const CAM = { chase: 'Chase', level: 'Horizon', fpp: 'Cockpit', foot: 'On foot' };
const KEYS = {
  KeyW: ['W', 'Throttle. On foot, walk.'], KeyS: ['S', 'Brake. Hold it when stopped to reverse.'], KeyA: ['A', 'Steer left. In the air, spin.'], KeyD: ['D', 'Steer right. In the air, spin.'],
  KeyF: ['F', 'Suction fan: sticks the car to the wall and the ceiling.'], KeyE: ['E', 'Get in or out of the Roadster.'], KeyC: ['C', 'Camera: chase, horizon, cockpit.'], KeyR: ['R', 'Reset the car to the start.'],
  KeyT: ['T', 'Flight assist on or off. Off gives x1.5 points.'], KeyP: ['P', 'Replay the last jump.'], KeyM: ['M', 'Music on or off.'], KeyG: ['G', 'Show or hide the film stunts list.'],
  ShiftLeft: ['Shift', 'Rear thrusters boost. On foot, run.'], Space: ['Space', 'Jets: hop on the ground, soft landing in the air.'], Escape: ['Esc', 'Menu.'],
  ArrowUp: ['↑', 'Frontflip in the air.'], ArrowDown: ['↓', 'Backflip in the air.'], ArrowLeft: ['←', 'Heelflip roll in the air.'], ArrowRight: ['→', 'Kickflip roll in the air.'],
};
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class UI {
  constructor(settings, online) {
    this.S = settings; this.online = online;
    this.el = { mph: $('mph'), gear: $('gear'), spool: $('spool'), dots: $('dots'), fan: $('chipFan'), assist: $('chipAssist'), cam: $('camName'), trick: $('trick'), tBig: $('trickBig'), tSub: $('trickSub'), tMeta: $('trickMeta'),
      result: $('result'), rNames: $('resNames'), rQ: $('resQuality'), rPts: $('resPts'), rParts: $('resParts'), rRank: $('resRank'), best: $('best'), session: $('session'), prompt: $('prompt'), toast: $('toast'),
      replay: $('replay'), rpFill: $('rpFill'), rpMode: $('rpMode'), rpHelp: $('rpHelp'), fps: $('fps'), tip: $('tip'), tipT: $('tipT'), tipD: $('tipD') };
    for (let i = 0; i < 10; i++) { const d = document.createElement('i'); if (i === 4 || i === 6) d.className = 'g'; this.el.dots.appendChild(d); }
    this.dots = [...this.el.dots.children];
    this.last = {}; this.toastT = 0; this.resultT = 0; this.board = 'score'; this.mphShown = 0; this.lastHalf = 0;
    this.track = $('ldTrack'); this.trackLen = this.track.getTotalLength(); this.fill = $('ldFill'); this.dot = $('ldDot');
    this.fill.style.strokeDasharray = `${this.trackLen}`; this.fill.style.strokeDashoffset = `${this.trackLen}`;
    this.ldp = 0; this.ldTarget = 0;
    const tick = () => { if (this.ldDone) return; this.ldp += (this.ldTarget - this.ldp) * 0.12; this.drawLoad(this.ldp); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    this.bindMenu(); this.bindKeys();
  }

  drawLoad(p) {
    const L = this.trackLen * p;
    this.fill.style.strokeDashoffset = `${this.trackLen - L}`;
    const pt = this.track.getPointAtLength(Math.max(0.01, L)), n = this.track.getPointAtLength(Math.min(this.trackLen, L + 0.5));
    const nx = n.x - pt.x, ny = n.y - pt.y, l = Math.hypot(nx, ny) || 1;
    this.dot.setAttribute('cx', pt.x - ny / l * 1.1); this.dot.setAttribute('cy', pt.y + nx / l * 1.1);
  }

  loading(p, text) { this.ldTarget = Math.max(this.ldTarget, Math.min(1, p)); $('loadPct').textContent = `${Math.round(this.ldTarget * 100)}%`; if (text) $('loadText').textContent = text; }

  loaderDone() {
    return new Promise((res) => {
      this.ldDone = true; this.drawLoad(1);
      const L = $('loader'), arc = $('ldArc'), len = arc.getTotalLength(); L.classList.add('jump');
      arc.style.strokeDasharray = `${len}`; arc.style.strokeDashoffset = `${len}`;
      const t0 = performance.now(), dur = 900;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur), k = t * t * 0.6 + t * 0.4, p = arc.getPointAtLength(len * k);
        this.dot.setAttribute('cx', p.x); this.dot.setAttribute('cy', p.y - 1.1); arc.style.strokeDashoffset = `${len * (1 - k)}`;
        if (t < 1) requestAnimationFrame(step);
        else { L.classList.add('landed'); setTimeout(() => { L.classList.add('out'); setTimeout(() => { L.classList.add('hidden'); res(); }, 800); }, 380); }
      };
      $('loadText').textContent = 'Ready'; $('loadPct').textContent = '100%';
      requestAnimationFrame(step);
    });
  }

  showTitle() {
    const s = $('start'); s.classList.remove('hidden', 'out');
    $('nameIn').value = this.S.name || '';
    $('tsb').onclick = () => this.onOpenMenu && this.onOpenMenu('boards');
    $('tsBoards').onclick = () => this.onOpenMenu && this.onOpenMenu('boards');
    $('tsKeys').onclick = () => this.onOpenMenu && this.onOpenMenu('keys');
    requestAnimationFrame(() => this.segInk($('showMode')));
    for (const b of $('showMode').querySelectorAll('button')) b.onclick = () => { for (const x of $('showMode').querySelectorAll('button')) x.classList.toggle('on', x === b); this.segInk($('showMode')); const tch = document.body.classList.contains('touchdev'); $('showHint').textContent = b.dataset.v === 'explode' ? (tch ? 'Tap to explode it all.' : 'Hover to pull parts apart. Click to explode it all.') : (tch ? 'Tap a part. Drag to turn it.' : 'Hover the car. Drag to turn it.'); this.onShowMode && this.onShowMode(b.dataset.v); };
    this.titleBoard();
  }

  playProgress(p, text) { $('playFill').style.width = `${Math.round(p * 100)}%`; $('playLabel').textContent = text || `Loading ${Math.round(p * 100)}%`; }

  ready(onPlay) {
    const b = $('play'); b.disabled = false; $('playLabel').textContent = 'Play'; b.classList.add('ready');
    const go = () => { if (b.disabled) return; b.disabled = true; this.S.name = $('nameIn').value.trim().slice(0, 16); this.save(); onPlay(); };
    b.onclick = go;
    this.enterHandler = (e) => { if (e.code === 'Enter' && !$('start').classList.contains('hidden') && !this.menuOpen) { e.preventDefault(); go(); } };
    addEventListener('keydown', this.enterHandler);
  }

  hideStart() { const s = $('start'); s.classList.add('out'); this.tip(false); setTimeout(() => s.classList.add('hidden'), 650); if (this.enterHandler) removeEventListener('keydown', this.enterHandler); }

  async titleBoard() {
    const list = $('tsbList'), rows = await this.online.top('score', 5);
    if (!rows) { list.innerHTML = '<div class="tsb-empty">Leaderboard offline</div>'; return; }
    if (!rows.length) { list.innerHTML = '<div class="tsb-empty">No jumps yet. Be the first.</div>'; return; }
    list.innerHTML = '';
    rows.forEach((r, i) => { const d = document.createElement('div'); d.className = 'tsb-row' + (i < 3 ? ' top' : '') + (r.uid === this.online.uid ? ' me' : ''); d.style.animationDelay = `${0.6 + i * 0.07}s`; d.innerHTML = `<span>${i + 1}</span><span></span><span>${Math.round(r.v).toLocaleString('en-US')}</span>`; d.children[1].textContent = r.n || 'Player'; list.appendChild(d); });
  }

  tip(on, x, y, t, d) {
    const E = this.el;
    if (!on) { if (this.tipOn) { E.tip.classList.remove('on'); this.tipOn = false; } return; }
    if (t !== this.tipLast || d !== this.tipLastD) { E.tipT.textContent = t; E.tipD.textContent = d || ''; this.tipLast = t; this.tipLastD = d; }
    const w = E.tip.offsetWidth || 200, X = Math.min(innerWidth - w - 12, x + 18), Y = Math.min(innerHeight - 60, y + 18);
    E.tip.style.transform = `translate3d(${X}px, ${Y}px, 0) scale(${this.tipOn ? 1 : 0.92})`;
    if (!this.tipOn) { E.tip.classList.add('on'); this.tipOn = true; requestAnimationFrame(() => { E.tip.style.transform = `translate3d(${X}px, ${Y}px, 0) scale(1)`; }); }
  }

  showHud(on) { $('hud').classList.toggle('hidden', !on); }

  set(k, v, fn) { if (this.last[k] === v) return; this.last[k] = v; fn(v); }

  hud(h) {
    const E = this.el;
    this.mphShown += (h.mph - this.mphShown) * Math.min(1, h.dt * 14);
    this.set('mph', Math.round(this.mphShown), (v) => { E.mph.textContent = v; });
    this.set('gear', h.gear, (v) => { E.gear.textContent = v; E.gear.classList.toggle('rev', v === 'R'); });
    this.set('spool', Math.round(h.spool * 100), (v) => { E.spool.style.width = `${v}%`; });
    this.set('fan', h.fan, (v) => { E.fan.classList.toggle('on', v); this.ping(E.fan); });
    this.set('assist', h.assist, (v) => { E.assist.classList.toggle('on', v); this.ping(E.assist); });
    this.set('cam', h.cam, (v) => { E.cam.textContent = CAM[v] || v; });
    for (let i = 0; i < 10; i++) { const on = h.valves[i] > 0.08; if (this.dots[i]._on !== on) { this.dots[i]._on = on; this.dots[i].classList.toggle('on', on); } }
    const L = h.live;
    if (L && L.air > 0.35) {
      const deg = Math.round(Math.max(L.roll, L.pitch, L.yaw));
      const main = L.roll >= L.pitch && L.roll >= L.yaw ? (L.heel ? 'heel' : 'roll') : L.pitch >= L.yaw ? (L.back ? 'back' : 'flip') : 'spin';
      this.set('tBig', `${deg}°`, (v) => { E.tBig.textContent = v; });
      const half = Math.floor(deg / 180); if (half > this.lastHalf) { E.tBig.classList.remove('pop'); void E.tBig.offsetWidth; E.tBig.classList.add('pop'); } this.lastHalf = half;
      this.set('tSub', main, (v) => { E.tSub.textContent = { roll: 'Kickflip', heel: 'Heelflip', flip: 'Frontflip', back: 'Backflip', spin: 'Spin' }[v]; });
      this.set('tMeta', `Air ${L.air.toFixed(1)} s · ${Math.round(L.h)} m`, (v) => { E.tMeta.textContent = v; });
      this.set('tOn', true, () => E.trick.classList.add('on'));
    } else if (h.hang > 0.4) {
      this.lastHalf = 0;
      this.set('tBig', `${h.hang.toFixed(1)} s`, (v) => { E.tBig.textContent = v; });
      this.set('tSub', 'hang', () => { E.tSub.textContent = 'Upside down'; });
      this.set('tMeta', h.hang < 5 ? 'Hang 5 s for the stunt' : 'Film stunt done', (v) => { E.tMeta.textContent = v; });
      this.set('tOn', true, () => E.trick.classList.add('on'));
    } else { this.lastHalf = 0; this.set('tOn', false, () => E.trick.classList.remove('on')); }
    this.set('prompt', h.prompt || '', (v) => { E.prompt.classList.toggle('on', !!v); if (v) E.prompt.innerHTML = v; });
    this.set('best', this.online.best.score || 0, (v) => { E.best.textContent = Math.round(v).toLocaleString('en-US'); if (v) this.ping(E.best, 'bump'); });
    this.set('session', h.session || '', (v) => { E.session.textContent = v; });
    if (this.toastT > 0) { this.toastT -= h.dt; if (this.toastT <= 0) E.toast.classList.remove('on'); }
    if (this.resultT > 0) { this.resultT -= h.dt; if (this.resultT <= 0) { E.result.classList.add('leave'); E.result.classList.remove('on'); } }
    this.set('replay', !!h.replay, (v) => E.replay.classList.toggle('on', v));
    if (h.replay) { E.rpFill.style.width = `${(h.replay.p * 100).toFixed(1)}%`; this.set('rpMode', h.replay.mode, (v) => { E.rpMode.textContent = v === 'tv' ? 'TV' : 'Free'; E.rpHelp.textContent = v === 'tv' ? (h.touch ? 'Cam for free view' : 'C free cam · P exit') : (h.touch ? 'Drag to orbit' : 'Mouse orbit · Space pause · ← → scrub · P exit'); }); }
    if (h.fps) E.fps.textContent = h.fps;
  }

  ping(el, cls = 'ping') { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  toast(msg, t = 1.6) { const E = this.el; E.toast.textContent = msg; E.toast.classList.remove('on'); void E.toast.offsetWidth; E.toast.classList.add('on'); this.toastT = t; }

  result(r, newBest) {
    const E = this.el;
    E.result.classList.remove('leave', 'on'); void E.result.offsetWidth;
    E.rRank.classList.remove('on'); E.rRank.textContent = '';
    if (!r.ok) { E.rNames.textContent = r.names.length ? r.names.join(' + ') : 'Wipeout'; E.rQ.textContent = 'Crash · R to reset'; E.rQ.classList.add('bad'); E.rPts.textContent = '0'; E.rParts.innerHTML = ''; }
    else {
      E.rNames.textContent = r.names.length ? r.names.join(' + ') : r.air > 1.2 ? 'Big air' : 'Jump';
      E.rQ.classList.remove('bad'); E.rQ.innerHTML = `${r.quality}${newBest ? ' · <span class="nb">New best</span>' : ''}`;
      E.rParts.innerHTML = '';
      const rows = (r.parts || []).map((p) => [p[0] + (p[1] ? ` · ${p[1]}` : ''), `+${p[2].toLocaleString('en-US')}`, false]).concat((r.mults || []).map((m) => [m[0], `×${m[1]}`, true]));
      rows.forEach(([a, b, mul], i) => { const d = document.createElement('div'); d.className = 'p' + (mul ? ' mul' : ''); d.style.animationDelay = `${0.25 + i * 0.07}s`; d.innerHTML = '<span></span><b></b>'; d.children[0].textContent = a; d.children[1].textContent = b; E.rParts.appendChild(d); });
      const t0 = performance.now(), dur = 900, total = r.total;
      const step = (now) => { const t = Math.min(1, (now - t0) / dur); E.rPts.textContent = `+${Math.round(total * easeOut(t)).toLocaleString('en-US')}`; if (t < 1) requestAnimationFrame(step); };
      E.rPts.textContent = '+0'; requestAnimationFrame(step);
    }
    E.result.classList.add('on'); this.resultT = r.ok ? 5.5 : 3.5;
  }

  rank(text) { const E = this.el; E.rRank.textContent = text; E.rRank.classList.add('on'); this.resultT = Math.max(this.resultT, 2.5); }

  save() { try { localStorage.setItem('rj.settings', JSON.stringify(this.S)); } catch (e) { /* storage off */ } }

  segInk(seg) {
    const ink = seg.querySelector('.seg-ink, .tab-ink'), on = seg.querySelector('button.on'); if (!ink || !on) return;
    ink.style.width = `${on.offsetWidth}px`; ink.style.transform = `translateX(${on.offsetLeft}px)`;
  }

  bindMenu() {
    const S = this.S;
    for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => this.tab(b.dataset.tab);
    const seg = (id, key, cb) => { const el = $(id); const sync = () => { for (const b of el.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === S[key]); this.segInk(el); }; for (const b of el.querySelectorAll('button')) b.onclick = () => { S[key] = b.dataset.v; sync(); this.save(); cb && cb(S[key]); }; sync(); return sync; };
    this.syncCam = seg('optCam', 'cam', (v) => this.onCam && this.onCam(v));
    this.syncQ = seg('optQ', 'quality', () => { $('qNote').textContent = 'Applies after a reload.'; this.toast('Graphics change applies after reload', 2.4); });
    const tog = (id, key, cb) => { const el = $(id); const sync = () => el.classList.toggle('on', !!S[key]); el.onclick = () => { S[key] = !S[key]; sync(); this.save(); cb && cb(S[key]); }; sync(); return sync; };
    this.syncAssist = tog('optAssist', 'assist', (v) => this.onAssist && this.onAssist(v));
    this.syncGoals = tog('optGoals', 'goals', (v) => this.onGoals && this.onGoals(v));
    const rng = (id, key, fmt, cb) => { const el = $(id), v = $(id + 'V'); const upd = () => { const p = (S[key] - el.min) / (el.max - el.min) * 100; el.style.setProperty('--p', `${p}%`); v.textContent = fmt(S[key]); }; el.value = S[key]; upd(); el.oninput = () => { S[key] = +el.value; upd(); this.save(); cb && cb(); }; };
    const pct = (x) => `${Math.round(x * 100)}%`;
    rng('optMusic', 'musicVol', pct, () => this.onVolume && this.onVolume()); rng('optSfx', 'sfxVol', pct, () => this.onVolume && this.onVolume()); rng('optSens', 'sens', (x) => `${x.toFixed(2)}×`, () => this.onSens && this.onSens());
    const nm = $('optName'); nm.value = S.name || ''; nm.onchange = () => { S.name = nm.value.trim().slice(0, 16); this.save(); this.online.rename(S.name); $('nameIn').value = S.name; };
    const sel = $('boardSel');
    for (const b of BOARDS) { const x = document.createElement('button'); x.dataset.v = b.id; x.textContent = b.label; x.onclick = () => { this.board = b.id; for (const y of sel.querySelectorAll('button')) y.classList.toggle('on', y === x); this.segInk(sel); this.loadBoard(); }; sel.appendChild(x); }
    sel.querySelector('button').classList.add('on');
    $('resume').onclick = () => this.onResume && this.onResume();
    $('mcClose').onclick = () => this.onResume && this.onResume();
    $('mReset').onclick = () => this.onReset && this.onReset();
    $('mReplay').onclick = () => this.onReplay && this.onReplay();
    $('menu').addEventListener('pointerdown', (e) => { if (e.target === $('menu')) this.onResume && this.onResume(); });
  }

  bindKeys() {
    const kb = $('kb'), info = $('kbInfo');
    const show = (code) => { const k = KEYS[code]; if (!k) return; info.innerHTML = '<b></b><span></span>'; info.children[0].textContent = k[0]; info.children[1].textContent = k[1]; info.classList.remove('flash'); void info.offsetWidth; info.classList.add('flash'); };
    for (const k of kb.querySelectorAll('.k')) { k.onpointerdown = () => { k.classList.add('down'); show(k.dataset.code); }; k.onpointerup = k.onpointerleave = () => k.classList.remove('down'); }
    const map = { ShiftRight: 'ShiftLeft' };
    addEventListener('keydown', (e) => { if (!this.menuOpen || this.curTab !== 'keys') return; const c = map[e.code] || e.code, el = kb.querySelector(`[data-code="${c}"]`); if (el) { el.classList.add('down'); show(c); } });
    addEventListener('keyup', (e) => { const c = map[e.code] || e.code, el = kb.querySelector(`[data-code="${c}"]`); if (el) el.classList.remove('down'); });
  }

  tab(t) {
    this.curTab = t;
    for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === t);
    this.segInk($('tabs'));
    for (const d of document.querySelectorAll('.tab')) d.classList.toggle('hidden', d.dataset.tab !== t);
    if (t === 'boards') { requestAnimationFrame(() => this.segInk($('boardSel'))); this.loadBoard(); }
    if (t === 'play') requestAnimationFrame(() => { this.segInk($('optCam')); this.segInk($('optQ')); });
  }

  async loadBoard() {
    const list = $('boardList'), B = BOARDS.find((b) => b.id === this.board), mine = this.online.best[this.board];
    $('boardMine').textContent = mine ? `Your best: ${B.fmt(mine)} ${B.unit}${this.S.name ? '' : ' · add a name in Game to appear here'}` : 'No jump on this board yet';
    list.innerHTML = '<div class="skel"></div>'.repeat(6);
    const rows = await this.online.top(this.board, 50);
    if (this.board !== B.id) return;
    if (!rows) { list.innerHTML = '<div class="msg">Leaderboard offline</div>'; return; }
    if (!rows.length) { list.innerHTML = '<div class="msg">Nobody here yet. Land a jump.</div>'; return; }
    list.innerHTML = '';
    const me = rows.findIndex((r) => r.uid === this.online.uid);
    rows.slice(0, 10).forEach((r, i) => { const d = document.createElement('div'); d.className = 'r' + (r.uid === this.online.uid ? ' me' : ''); d.style.animationDelay = `${i * 0.04}s`; d.innerHTML = `<span>${i + 1}</span><span></span><span>${B.fmt(r.v)} ${B.unit}</span>`; d.children[1].textContent = r.n || 'Player'; list.appendChild(d); });
    if (me >= 10) $('boardMine').textContent = `You are #${me + 1} with ${B.fmt(rows[me].v)} ${B.unit}`;
  }

  menu(on, opt = {}) {
    const m = $('menu');
    if (on) {
      m.classList.remove('hidden', 'closing'); this.menuOpen = true;
      $('mcTitle').textContent = opt.title || 'Paused'; $('mcSub').textContent = opt.sub || '';
      $('resume').textContent = opt.resume || 'Resume';
      for (const id of ['mReset', 'mReplay']) $(id).classList.toggle('hidden', !!opt.title);
      this.syncCam(); this.syncAssist(); this.syncGoals(); $('optName').value = this.S.name || '';
      this.tab(opt.tab || 'play');
    } else if (this.menuOpen) {
      this.menuOpen = false; m.classList.add('closing'); setTimeout(() => { if (!this.menuOpen) m.classList.add('hidden'); }, 220);
    }
  }
}
