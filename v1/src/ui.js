// Roadster Jump UI: loading and start screen, HUD (speed, thruster dots, suction/assist/camera chips, live rotation counter, jump result card, best score, prompts, toasts, replay bar), the pause menu with settings and the three online leaderboards.
import { BOARDS } from './online.js';

const $ = (id) => document.getElementById(id);
const CAM = { chase: 'Chase', level: 'Horizon', fpp: 'Cockpit', foot: 'On foot' };

export class UI {
  constructor(settings, online) {
    this.S = settings; this.online = online;
    this.el = { mph: $('mph'), dots: $('dots'), fan: $('chipFan'), assist: $('chipAssist'), cam: $('camName'), trick: $('trick'), tBig: $('trickBig'), tSub: $('trickSub'), result: $('result'),
      rNames: $('resNames'), rQ: $('resQuality'), rPts: $('resPts'), rStats: $('resStats'), best: $('best'), session: $('session'), prompt: $('prompt'), toast: $('toast'), replay: $('replay'), rpFill: $('rpFill'), rpMode: $('rpMode'), rpHelp: $('rpHelp'), fps: $('fps') };
    for (let i = 0; i < 10; i++) { const d = document.createElement('i'); if (i === 4 || i === 6) d.className = 'g'; this.el.dots.appendChild(d); }
    this.dots = [...this.el.dots.children];
    this.last = {}; this.toastT = 0; this.resultT = 0; this.board = 'score';
    this.bindMenu();
  }

  loading(p, text) { $('loadBar').style.width = `${Math.round(p * 100)}%`; if (text) $('loadText').textContent = text; }

  ready(onPlay) {
    const b = $('play'); b.disabled = false; b.textContent = 'Play';
    $('loadText').textContent = 'Ready';
    const n = $('nameIn'); n.value = this.S.name || '';
    b.onclick = () => { this.S.name = n.value.trim().slice(0, 16); this.save(); onPlay(); };
  }

  hideStart() { $('start').classList.add('hidden'); }

  showHud(on) { $('hud').classList.toggle('hidden', !on); }

  set(k, v, fn) { if (this.last[k] === v) return; this.last[k] = v; fn(v); }

  hud(h) {
    const E = this.el;
    this.set('mph', Math.round(h.mph), (v) => { E.mph.textContent = v; });
    this.set('fan', h.fan, (v) => E.fan.classList.toggle('on', v));
    this.set('assist', h.assist, (v) => E.assist.classList.toggle('on', v));
    this.set('cam', h.cam, (v) => { E.cam.textContent = CAM[v] || v; });
    for (let i = 0; i < 10; i++) { const on = h.valves[i] > 0.08; if (this.dots[i]._on !== on) { this.dots[i]._on = on; this.dots[i].classList.toggle('on', on); } }
    const L = h.live;
    if (L && L.air > 0.35) {
      const deg = Math.round(Math.max(L.roll, L.pitch, L.yaw));
      const main = L.roll >= L.pitch && L.roll >= L.yaw ? (L.heel ? 'heel' : 'roll') : L.pitch >= L.yaw ? (L.back ? 'back' : 'flip') : 'spin';
      this.set('tBig', deg, (v) => { E.tBig.textContent = `${v}°`; });
      this.set('tSub', main, (v) => { E.tSub.textContent = { roll: 'Kickflip', heel: 'Heelflip', flip: 'Frontflip', back: 'Backflip', spin: 'Spin' }[v]; });
      this.set('tOn', true, () => E.trick.classList.add('on'));
    } else this.set('tOn', false, () => E.trick.classList.remove('on'));
    this.set('prompt', h.prompt || '', (v) => { E.prompt.classList.toggle('on', !!v); if (v) E.prompt.innerHTML = v; });
    this.set('best', this.online.best.score || 0, (v) => { E.best.textContent = Math.round(v).toLocaleString('en-US'); });
    this.set('session', h.session || '', (v) => { E.session.textContent = v; });
    if (this.toastT > 0) { this.toastT -= h.dt; if (this.toastT <= 0) E.toast.classList.remove('on'); }
    if (this.resultT > 0) { this.resultT -= h.dt; if (this.resultT <= 0) E.result.classList.remove('on'); }
    this.set('replay', !!h.replay, (v) => E.replay.classList.toggle('on', v));
    if (h.replay) { E.rpFill.style.width = `${(h.replay.p * 100).toFixed(1)}%`; this.set('rpMode', h.replay.mode, (v) => { E.rpMode.textContent = v === 'tv' ? 'TV' : 'Free'; E.rpHelp.textContent = v === 'tv' ? (h.touch ? 'Cam for free view' : 'C free cam · P exit') : (h.touch ? 'Drag to orbit' : 'Mouse orbit · Space pause · ← → scrub · P exit'); }); }
    if (h.fps) E.fps.textContent = h.fps;
  }

  toast(msg, t = 1.6) { const E = this.el; E.toast.textContent = msg; E.toast.classList.add('on'); this.toastT = t; }

  result(r, newBest) {
    const E = this.el;
    if (!r.ok) { E.rNames.textContent = r.names.length ? r.names.join(' + ') : 'Wipeout'; E.rQ.textContent = 'Crash · R to reset'; E.rQ.classList.add('bad'); E.rPts.textContent = '0'; }
    else {
      E.rNames.textContent = r.names.length ? r.names.join(' + ') : r.air > 1.2 ? 'Big air' : 'Jump';
      E.rQ.textContent = `${r.quality}${r.pro ? ' · Assist off ×1.5' : ''}${newBest ? ' · New best' : ''}`; E.rQ.classList.remove('bad');
      E.rPts.textContent = `+${r.total.toLocaleString('en-US')}`;
    }
    E.rStats.innerHTML = `<b>${r.dist.toFixed(1)} m</b> · <b>${r.air.toFixed(2)} s</b> air · <b>${r.rotDeg}°</b>${r.ceil > 0.2 ? ` · ceiling <b>${r.ceil.toFixed(1)} s</b>` : ''}`;
    E.result.classList.add('on'); this.resultT = 4.5;
  }

  save() { try { localStorage.setItem('rj.settings', JSON.stringify(this.S)); } catch (e) { /* storage off */ } }

  bindMenu() {
    const S = this.S;
    for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => this.tab(b.dataset.tab);
    const seg = (id, key, cb) => { const el = $(id); const sync = () => { for (const b of el.children) b.classList.toggle('on', b.dataset.v === S[key]); }; for (const b of el.children) b.onclick = () => { S[key] = b.dataset.v; sync(); this.save(); cb && cb(S[key]); }; sync(); return sync; };
    this.syncCam = seg('optCam', 'cam', (v) => this.onCam && this.onCam(v));
    seg('optQ', 'quality', () => this.toast('Graphics change applies after reload', 2.4));
    const tog = $('optAssist'); this.syncAssist = () => tog.classList.toggle('on', S.assist); tog.onclick = () => { S.assist = !S.assist; this.syncAssist(); this.save(); this.onAssist && this.onAssist(S.assist); }; this.syncAssist();
    const rng = (id, key, cb) => { const el = $(id); el.value = S[key]; el.oninput = () => { S[key] = +el.value; this.save(); cb && cb(); }; };
    rng('optMusic', 'musicVol', () => this.onVolume && this.onVolume()); rng('optSfx', 'sfxVol', () => this.onVolume && this.onVolume()); rng('optSens', 'sens', () => this.onSens && this.onSens());
    const nm = $('optName'); nm.value = S.name || ''; nm.onchange = () => { S.name = nm.value.trim().slice(0, 16); this.save(); this.online.rename(S.name); };
    const sel = $('boardSel');
    for (const b of BOARDS) { const x = document.createElement('button'); x.dataset.v = b.id; x.textContent = b.label; x.onclick = () => { this.board = b.id; for (const y of sel.children) y.classList.toggle('on', y === x); this.loadBoard(); }; sel.appendChild(x); }
    sel.children[0].classList.add('on');
    $('resume').onclick = () => this.onResume && this.onResume();
  }

  tab(t) {
    for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === t);
    for (const d of document.querySelectorAll('.tab')) d.classList.toggle('hidden', d.dataset.tab !== t);
    if (t === 'boards') this.loadBoard();
  }

  async loadBoard() {
    const list = $('boardList'), B = BOARDS.find((b) => b.id === this.board), mine = this.online.best[this.board];
    $('boardMine').textContent = mine ? `Your best: ${B.fmt(mine)} ${B.unit}${this.S.name ? '' : ' · set a name in Game to appear here'}` : 'No jump on this board yet';
    list.innerHTML = '<div class="msg">Loading</div>';
    const rows = await this.online.top(this.board, 10);
    if (this.board !== B.id) return;
    if (!rows) { list.innerHTML = '<div class="msg">Leaderboard offline</div>'; return; }
    if (!rows.length) { list.innerHTML = '<div class="msg">Nobody here yet. Land a jump.</div>'; return; }
    list.innerHTML = '';
    rows.forEach((r, i) => { const d = document.createElement('div'); d.className = 'r' + (r.uid === this.online.uid ? ' me' : ''); d.innerHTML = `<span>${i + 1}</span><span></span><span>${B.fmt(r.v)} ${B.unit}</span>`; d.children[1].textContent = r.n || 'Player'; list.appendChild(d); });
  }

  menu(on) { $('menu').classList.toggle('hidden', !on); if (on) { this.syncCam(); this.syncAssist(); $('optName').value = this.S.name || ''; this.tab('play'); } }
  get menuOpen() { return !$('menu').classList.contains('hidden'); }
}
