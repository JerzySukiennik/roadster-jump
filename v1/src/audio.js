// Roadster Jump audio: Web Audio engine with Jurek's EV motor synth, cold-gas roar (noise bands + CC0 thrust loop, valve puffs, boost and start/stop one-shots), suction fan, tyre roll and skid, wind, doors, flap servo, landing impacts and the Film14 song as looping music, all driven by the packed car pose so replays sound the same.
import { MotorSynth, DEFAULT_MOTOR } from './motorSound.js';

const BASE = 'assets/audio/';
const FILES = {
  thrust_loop: ['thrust_loop'], thrust_start: ['thrust_start_1', 'thrust_start_2', 'thrust_start_3'], thrust_stop: ['thrust_stop'],
  valve_puff: ['valve_puff_1', 'valve_puff_2'], boost_big: ['boost_big_1', 'boost_big_2'], flap_servo: ['flap_servo'],
  tyre_skid_loop: ['tyre_skid_loop'], tyre_roll_loop: ['tyre_roll_loop'], wind_loop: ['wind_loop'], fan_loop: ['fan_server'],
  door_open: ['door_open'], door_close: ['door_close'], impact_heavy: ['impact_heavy_1'], impact_medium: ['impact_medium_1'], impact_light: ['impact_light_1'],
};

export class GameAudio {
  constructor() {
    this.ctx = null; this.buf = new Map(); this.loops = new Map(); this.cool = new Map();
    this.musicVol = 0.5; this.sfxVol = 0.9; this.musicOn = true; this.ready = false;
    this.prev = { tot: 0, valves: new Float32Array(10), flap: 0, rear: false };
  }

  async unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(comp); comp.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol;
    this.cabin = ctx.createBiquadFilter(); this.cabin.type = 'lowpass'; this.cabin.frequency.value = 20000;
    this.sfx.connect(this.cabin); this.cabin.connect(this.master);
    this.carBus = ctx.createGain(); this.carBus.connect(this.sfx);
    this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (this.pan) { this.carBus.disconnect(); this.carBus.connect(this.pan); this.pan.connect(this.sfx); }
    this.music = ctx.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
    const n = Math.floor(ctx.sampleRate * 2), nb = ctx.createBuffer(1, n, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.motor = new MotorSynth(ctx, this.carBus, DEFAULT_MOTOR);
    this.wind = this.noise('lowpass', 600, 0.7, this.sfx);
    this.jet = [this.noise('bandpass', 420, 0.7, this.carBus), this.noise('bandpass', 1300, 0.9, this.carBus), this.noise('highpass', 2600, 0.5, this.carBus)];
    this.ready = true;
    const load = async (k, f) => { try { const r = await fetch(BASE + f + '.mp3'); const b = await ctx.decodeAudioData(await r.arrayBuffer()); if (!this.buf.has(k)) this.buf.set(k, []); this.buf.get(k).push(b); } catch (e) { /* missing sound */ } };
    await Promise.all(Object.entries(FILES).flatMap(([k, fs]) => fs.map((f) => load(k, f))));
    try { const r = await fetch('assets/music/desert-propher.mp3'); this.song = await ctx.decodeAudioData(await r.arrayBuffer()); this.startMusic(); } catch (e) { this.song = null; }
  }

  noise(type, freq, q, dest) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(dest); src.start();
    return { src, f, g };
  }

  startMusic() {
    if (!this.song || this.songSrc) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.song; s.loop = true; s.connect(this.music); s.start();
    this.songSrc = s; this.setMusic(this.musicOn);
  }

  setMusic(on) { this.musicOn = on; if (this.ctx) this.music.gain.setTargetAtTime(on ? this.musicVol : 0, this.ctx.currentTime, 0.4); }
  setVolumes(music, sfx) { this.musicVol = music; this.sfxVol = sfx; if (!this.ctx) return; this.setMusic(this.musicOn); this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.1); }

  play(name, o = {}) {
    if (!this.ctx) return;
    const list = this.buf.get(name); if (!list || !list.length) return;
    const now = this.ctx.currentTime;
    if (o.cooldown && (this.cool.get(name) || 0) > now) return;
    if (o.cooldown) this.cool.set(name, now + o.cooldown);
    const s = this.ctx.createBufferSource(); s.buffer = list[Math.floor(Math.random() * list.length)]; s.playbackRate.value = o.rate || 1;
    const g = this.ctx.createGain(); g.gain.value = o.gain ?? 1;
    s.connect(g); g.connect(o.car === false ? this.sfx : this.carBus); s.start();
  }

  loop(name, gain, rate = 1, tc = 0.1) {
    if (!this.ctx) return;
    let L = this.loops.get(name);
    if (!L) {
      const list = this.buf.get(name); if (!list) return;
      const s = this.ctx.createBufferSource(); s.buffer = list[0]; s.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0; s.connect(g); g.connect(this.carBus); s.start(0, Math.random() * list[0].duration);
      L = { s, g }; this.loops.set(name, L);
    }
    const t = this.ctx.currentTime;
    L.g.gain.setTargetAtTime(gain, t, tc); L.s.playbackRate.setTargetAtTime(rate, t, tc);
  }

  thump(k) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 + 0.6 * k, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(this.carBus); o.start(t); o.stop(t + 0.45);
  }

  land(k) {
    this.thump(k);
    this.play(k > 0.7 ? 'impact_heavy' : k > 0.35 ? 'impact_medium' : 'impact_light', { gain: 0.35 + 0.6 * k, cooldown: 0.2 });
  }

  update(dt, P, o) {
    if (!this.ctx || !this.ready) return;
    const t = this.ctx.currentTime, sp = P.speed;
    const dist = o.dist || 0, att = 1 / (1 + Math.max(0, dist - 4) / 14);
    this.carBus.gain.setTargetAtTime(att, t, 0.08);
    if (this.pan) this.pan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, o.pan || 0)), t, 0.08);
    this.cabin.frequency.setTargetAtTime(o.inside ? 2600 : 20000, t, 0.15);
    const contacts = P.contact[0] + P.contact[1] + P.contact[2] + P.contact[3];
    this.motor.update(dt, sp, o.load || 0, contacts, o.inside ? 1.15 : 0.85);
    this.wind.f.frequency.setTargetAtTime(300 + sp * 22, t, 0.1);
    this.wind.g.gain.setTargetAtTime(Math.min(0.5, (sp / 70) ** 2 * 0.45), t, 0.1);
    let slip = 0; for (let i = 0; i < 4; i++) if (P.contact[i]) slip = Math.max(slip, P.slip[i]);
    this.loop('tyre_skid_loop', Math.min(0.8, Math.max(0, slip - 3) * 0.09), 0.9 + Math.min(0.3, slip * 0.02));
    this.loop('tyre_roll_loop', contacts ? Math.min(0.35, sp / 40) : 0, 0.7 + Math.min(0.8, sp / 50));
    this.loop('fan_loop', P.fan * 0.16, 0.55 + 0.5 * P.fan, 0.2);
    let tot = 0, rear = 0; for (let i = 0; i < 10; i++) { tot += P.valve[i]; if (i < 4) rear += P.valve[i]; }
    const r = Math.sqrt(tot);
    this.jet[0].g.gain.setTargetAtTime(Math.min(0.5, r * 0.16), t, 0.04); this.jet[1].g.gain.setTargetAtTime(Math.min(0.35, r * 0.1), t, 0.04); this.jet[2].g.gain.setTargetAtTime(Math.min(0.25, r * 0.07), t, 0.04);
    this.loop('thrust_loop', Math.min(0.6, r * 0.32), 0.8 + tot * 0.03, 0.06);
    for (let i = 0; i < 10; i++) { const v = P.valve[i], pv = this.prev.valves[i]; if (v > 0.05 && pv <= 0.05) this.play('valve_puff', { gain: 0.25, rate: 0.85 + Math.random() * 0.2, cooldown: 0.07 }); this.prev.valves[i] = v; }
    if (tot > 0.1 && this.prev.tot <= 0.1) this.play('thrust_start', { gain: 0.45 });
    if (tot < 0.05 && this.prev.tot >= 0.05) this.play('thrust_stop', { gain: 0.35 });
    const rearOn = rear > 3.2; if (rearOn && !this.prev.rear) this.play('boost_big', { gain: 0.6 }); this.prev.rear = rearOn;
    if (P.flap > 0.05 && this.prev.flap <= 0.05) this.play('flap_servo', { gain: 0.5 });
    this.prev.flap = P.flap; this.prev.tot = tot;
  }
}
