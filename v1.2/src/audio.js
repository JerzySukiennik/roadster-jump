// Roadster Jump audio, mixed like the Film14 soundtrack: the song, Jurek's EV motor synth kept low, and CC0 samples only for the car: cold-gas roar (thrust loop layers scaled by open valves, a burst for every nozzle group that fires, boost on the rear group, valve puffs, a stop when the jets cut), the gullwing door and the flap servo. Car sounds sit in 3D around the camera with a subtle arena reverb, go muffled in the cockpit and slow down and darken in slow-motion replays like the film's replay copies. Tyres and wind stay barely audible; no fan whine and no impacts.
import { MotorSynth, DEFAULT_MOTOR } from './motorSound.js';

const BASE = 'assets/audio/';
const FILES = {
  thrust_loop: [['thrust_loop', 1]], thrust_start: [['thrust_start_1', 1.7], ['thrust_start_2', 1], ['thrust_start_3', 0.95]], thrust_stop: [['thrust_stop', 1.25]],
  valve_puff: [['valve_puff_1', 1], ['valve_puff_2', 1]], boost_big: [['boost_big_1', 1], ['boost_big_2', 0.9]], flap_servo: [['flap_servo', 1]],
  door_open: [['door_open', 1.3]], door_close: [['door_close', 1.3]], tyre_skid_loop: [['tyre_skid_loop', 1]], tyre_roll_loop: [['tyre_roll_loop', 1]], wind_loop: [['wind_loop', 1]],
};
const GROUPS = [[0, 1, 2, 3], [4, 5], [6, 7, 8, 9]];

export class GameAudio {
  constructor() {
    this.ctx = null; this.buf = new Map(); this.loops = new Map(); this.cool = new Map();
    this.musicVol = 0.6; this.sfxVol = 0.9; this.musicOn = true; this.ready = false; this.rate = 1;
    this.prev = { valves: new Float32Array(10), shut: new Float32Array(10).fill(9), on: [false, false, false], offT: [9, 9, 9], tot: 0, peak: 0, flap: 0, rearHot: false, liftHot: false };
  }

  now() { return this.vt ?? this.ctx.currentTime; }

  async unlock(mobile, offline) {
    if (this.ctx) { if (this.ctx.state !== 'running' && !offline) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC && !offline) return;
    const ctx = this.ctx = offline || new AC({ latencyHint: 'interactive' });
    this.mobile = !!mobile;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(comp); comp.connect(ctx.destination);
    this.out = comp;
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol;
    this.cabin = ctx.createBiquadFilter(); this.cabin.type = 'lowpass'; this.cabin.frequency.value = 20000; this.cabin.Q.value = 0.5;
    this.slow = ctx.createBiquadFilter(); this.slow.type = 'lowpass'; this.slow.frequency.value = 20000; this.slow.Q.value = 0.4;
    this.sfx.connect(this.cabin); this.cabin.connect(this.slow); this.slow.connect(this.master);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(this.mobile ? 1.3 : 2.4);
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.16; this.verbSend.connect(this.verb); this.verb.connect(this.slow);
    this.panner = ctx.createPanner(); this.panner.panningModel = this.mobile ? 'equalpower' : 'HRTF'; this.panner.distanceModel = 'inverse'; this.panner.refDistance = 6; this.panner.rolloffFactor = 0.9; this.panner.maxDistance = 400;
    this.carBus = ctx.createGain(); this.carBus.connect(this.panner); this.panner.connect(this.sfx); this.panner.connect(this.verbSend);
    this.jetBus = ctx.createGain(); this.jetBus.gain.value = 0.8; this.jetBus.connect(this.carBus);
    this.music = ctx.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
    this.motor = new MotorSynth(ctx, this.carBus, DEFAULT_MOTOR);
    this.ready = true;
    const load = async (k, f, trim) => { try { const r = await fetch(BASE + f + '.mp3'); const b = await ctx.decodeAudioData(await r.arrayBuffer()); if (!this.buf.has(k)) this.buf.set(k, []); this.buf.get(k).push({ b, trim }); } catch (e) { /* missing sound */ } };
    await Promise.all(Object.entries(FILES).flatMap(([k, fs]) => fs.map(([f, trim]) => load(k, f, trim))));
    try { const r = await fetch('assets/music/desert-propher.mp3'); this.song = await ctx.decodeAudioData(await r.arrayBuffer()); this.startMusic(); } catch (e) { this.song = null; }
  }

  impulse(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.1) * (t < 0.012 ? t / 0.012 : 1); }
      for (const [t, g] of [[0.045, 0.5], [0.083, 0.35], [0.131, 0.28], [0.19, 0.2]]) { const i0 = Math.floor((t + c * 0.007) * ctx.sampleRate); for (let i = 0; i < 220 && i0 + i < n; i++) d[i0 + i] += (Math.random() * 2 - 1) * g * (1 - i / 220); }
    }
    return b;
  }

  startMusic() {
    if (!this.song || this.songSrc) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.song; s.loop = true; s.connect(this.music); s.start(this.now());
    this.songSrc = s; this.setMusic(this.musicOn);
  }

  setMusic(on) { this.musicOn = on; if (this.ctx) this.music.gain.setTargetAtTime(on ? this.musicVol : 0, this.now(), 0.4); }
  setVolumes(music, sfx) { this.musicVol = music; this.sfxVol = sfx; if (!this.ctx) return; this.setMusic(this.musicOn); this.sfx.gain.setTargetAtTime(sfx, this.now(), 0.1); }

  play(name, o = {}) {
    if (!this.ctx) return;
    const list = this.buf.get(name); if (!list || !list.length || (this.mute && this.mute.has(name))) return;
    const now = this.now();
    if (o.cooldown && (this.cool.get(name) || 0) > now) return;
    if (o.cooldown) this.cool.set(name, now + o.cooldown);
    const pick = list[Math.floor(Math.random() * list.length)];
    const s = this.ctx.createBufferSource(); s.buffer = pick.b; s.playbackRate.value = (o.rate || 1) * this.rate * (0.97 + Math.random() * 0.06);
    const g = this.ctx.createGain(); g.gain.value = (o.gain ?? 1) * pick.trim;
    s.connect(g); g.connect(o.jet ? this.jetBus : this.carBus); s.start(this.now());
  }

  loop(name, gain, rate = 1, tc = 0.1, key = name, offset = 0) {
    if (!this.ctx) return;
    if (this.mute && this.mute.has(name)) gain = 0;
    let L = this.loops.get(key);
    if (!L) {
      const list = this.buf.get(name); if (!list) return;
      const s = this.ctx.createBufferSource(); s.buffer = list[0].b; s.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0; s.connect(g); g.connect(name === 'thrust_loop' ? this.jetBus : this.carBus); s.start(this.now(), (offset || Math.random()) * list[0].b.duration);
      L = { s, g, trim: list[0].trim }; this.loops.set(key, L);
    }
    const t = this.now();
    L.g.gain.setTargetAtTime(gain * L.trim, t, tc); L.s.playbackRate.setTargetAtTime(Math.max(0.2, rate * this.rate), t, tc);
  }

  land() {}

  listener(cam) {
    if (!this.ctx) return;
    const L = this.ctx.listener, p = cam.position, t = this.now();
    const f = cam.getWorldDirection ? cam.getWorldDirection(this._f || (this._f = cam.position.clone())) : null;
    const u = this._u || (this._u = cam.up.clone()); u.set(0, 1, 0).applyQuaternion(cam.quaternion);
    if (L.positionX) { L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02); L.forwardX.setTargetAtTime(f.x, t, 0.02); L.forwardY.setTargetAtTime(f.y, t, 0.02); L.forwardZ.setTargetAtTime(f.z, t, 0.02); L.upX.setTargetAtTime(u.x, t, 0.02); L.upY.setTargetAtTime(u.y, t, 0.02); L.upZ.setTargetAtTime(u.z, t, 0.02); }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
  }

  update(dt, P, o) {
    if (!this.ctx || !this.ready) return;
    const t = this.now(), sp = P.speed;
    this.rate = o.rate || 1;
    const pn = this.panner, x = P.p[0], y = P.p[1] + 0.6, z = P.p[2];
    if (pn.positionX) { pn.positionX.setTargetAtTime(x, t, 0.02); pn.positionY.setTargetAtTime(y, t, 0.02); pn.positionZ.setTargetAtTime(z, t, 0.02); } else pn.setPosition(x, y, z);
    if (o.cam) this.listener(o.cam);
    this.cabin.frequency.setTargetAtTime(o.inside ? 2400 : 20000, t, 0.15);
    this.slow.frequency.setTargetAtTime(this.rate < 0.8 ? 1900 : 20000, t, 0.2);
    this.verbSend.gain.setTargetAtTime(o.inside ? 0.05 : 0.16, t, 0.2);
    const contacts = P.contact[0] + P.contact[1] + P.contact[2] + P.contact[3];
    this.motor.update(dt, sp, o.load || 0, contacts, (o.inside ? 0.95 : 0.6) * (this.rate < 0.8 ? 0.4 : 1), t);
    this.loop('wind_loop', Math.min(0.2, (sp / 60) ** 2 * 0.2) * (contacts ? 1 : 1.3), 0.75 + Math.min(0.5, sp / 90), 0.15);
    let slip = 0; for (let i = 0; i < 4; i++) if (P.contact[i]) slip = Math.max(slip, P.slip[i]);
    this.loop('tyre_skid_loop', Math.min(0.18, Math.max(0, slip - 6) * 0.025), 0.9 + Math.min(0.25, slip * 0.015), 0.12);
    this.loop('tyre_roll_loop', contacts ? Math.min(0.1, sp / 45 * 0.1) : 0, 0.7 + Math.min(0.7, sp / 55), 0.2);
    let tot = 0; const gs = [0, 0, 0];
    for (let i = 0; i < 10; i++) { tot += P.valve[i]; gs[i < 4 ? 0 : i < 6 ? 1 : 2] += P.valve[i]; }
    const r0 = Math.sqrt(tot / 10); this.jr = (this.jr || 0) + (r0 - (this.jr || 0)) * (1 - Math.exp(-dt / (r0 > (this.jr || 0) ? 0.04 : 0.14)));
    const r = this.jr;
    this.loop('thrust_loop', Math.min(1.1, r * 1.5), 0.94 + r * 0.1, 0.06, 'jetA', 0.1);
    this.loop('thrust_loop', Math.min(0.8, Math.max(0, r - 0.35) * 1.5), 0.8 + r * 0.08, 0.08, 'jetB', 0.55);
    const pr = this.prev, rdt = dt * this.rate;
    for (let g = 0; g < 3; g++) {
      const v = gs[g] / GROUPS[g].length;
      if (!pr.on[g] && v > 0.3) { pr.on[g] = true; if (pr.offT[g] > 0.4) this.play('thrust_start', { gain: 0.8, cooldown: 0.35, jet: true }); }
      else if (pr.on[g] && v < 0.05) { pr.on[g] = false; pr.offT[g] = 0; }
      if (!pr.on[g]) pr.offT[g] += rdt;
    }
    for (let i = 0; i < 10; i++) {
      const v = P.valve[i];
      if (v > 0.3 && pr.valves[i] <= 0.3 && pr.shut[i] > 0.25) this.play('valve_puff', { gain: 0.3, cooldown: 0.25, jet: true });
      pr.shut[i] = v < 0.02 ? pr.shut[i] + rdt : 0; pr.valves[i] = v;
    }
    if (!pr.rearHot && gs[0] > 2.6) { pr.rearHot = true; this.play('boost_big', { gain: 0.9, cooldown: 0.8, jet: true }); } else if (pr.rearHot && gs[0] < 0.8) pr.rearHot = false;
    if (!pr.liftHot && gs[1] + gs[2] > 3.6) { pr.liftHot = true; this.play('boost_big', { gain: 0.95, cooldown: 0.8, jet: true }); } else if (pr.liftHot && gs[1] + gs[2] < 1.2) pr.liftHot = false;
    this.prev.peak = Math.max(this.prev.peak, tot);
    if (tot < 0.06 && this.prev.peak > 0.6) { this.prev.peak = 0; this.play('thrust_stop', { gain: 0.75, cooldown: 0.4, jet: true }); }
    if (P.flap > 0.05 && this.prev.flap <= 0.05) this.play('flap_servo', { gain: 0.3, rate: 0.8 });
    this.prev.flap = P.flap; this.prev.tot = tot;
  }

  tap(stream) { if (!this.ctx) return null; const d = this.ctx.createMediaStreamDestination(); this.out.connect(d); return d.stream; }
}
