// Roadster Jump replay: a 60 Hz ring buffer of packed car poses with event marks (ramp entry, takeoff, landing), and playback of the last jump either through the TV director (ramp: tele from behind the run-in, wide side, low under the lip; lineup: tele behind the approach, the straight-on front shot from the film, low three-quarter at the exit end; landing cam and slow motion in the air for both) or the ghost camera flown by the player (main.js) with pause and scrub.
import * as THREE from 'three';
import { CarPose } from './carView.js';
import { rampLocate } from './ramp.js';
import { LINEUP } from './lineup.js';

const HZ = 60, SEC = 75;

export class Recorder {
  constructor() {
    this.N = HZ * SEC; this.size = CarPose.SIZE;
    this.data = new Float32Array(this.N * this.size); this.times = new Float64Array(this.N);
    this.head = 0; this.count = 0; this.acc = 0; this.marks = [];
  }

  clear() { this.head = 0; this.count = 0; this.marks = []; }

  push(t, pose) {
    pose.write(this.data, this.head * this.size); this.times[this.head] = t;
    this.head = (this.head + 1) % this.N; this.count = Math.min(this.N, this.count + 1);
  }

  mark(kind, t, extra) { this.marks.push({ kind, t, ...extra }); if (this.marks.length > 200) this.marks.shift(); }

  first() { return this.times[(this.head - this.count + this.N) % this.N]; }
  last() { return this.times[(this.head - 1 + this.N) % this.N]; }

  sample(t, out, tmpA, tmpB) {
    if (!this.count) return null;
    let lo = 0, hi = this.count - 1;
    const at = (i) => (this.head - this.count + i + this.N) % this.N;
    if (t <= this.times[at(0)]) return out.read(this.data, at(0) * this.size);
    if (t >= this.times[at(hi)]) return out.read(this.data, at(hi) * this.size);
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.times[at(m)] <= t) lo = m; else hi = m; }
    const a = at(lo), b = at(hi), k = (t - this.times[a]) / Math.max(1e-6, this.times[b] - this.times[a]);
    tmpA.read(this.data, a * this.size); tmpB.read(this.data, b * this.size);
    return out.lerp(tmpA, tmpB, k);
  }

  lastJump() {
    const land = [...this.marks].reverse().find((m) => (m.kind === 'land' || m.kind === 'crash') && m.t > this.first());
    if (!land) return null;
    const take = [...this.marks].reverse().find((m) => m.kind === 'takeoff' && m.t < land.t);
    if (!take) return null;
    const ramp = [...this.marks].reverse().find((m) => m.kind === 'ramp' && m.t < take.t && m.t > take.t - 20);
    const t0 = Math.max(this.first(), Math.min(take.t - 3.5, ramp ? ramp.t - 2.0 : take.t - 3.5));
    return { t0, t1: Math.min(this.last(), land.t + 3.2), take: take.t, land: land.t, ramp: ramp ? ramp.t : null, fromCeil: !!take.fromCeil, landPos: land.pos, lineup: !!take.lineup, dir: take.dir || 1 };
  }
}

export class Replay {
  constructor(rec) {
    this.rec = rec; this.active = false; this.mode = 'tv'; this.t = 0; this.paused = false;
    this.pose = new CarPose(); this.a = new CarPose(); this.b = new CarPose();
    this.orbit = { yaw: 0.8 }; this.shot = null; this.shotStart = 0;
    this._v = new THREE.Vector3(); this._c = new THREE.Vector3(); this.focus = new THREE.Vector3(); this.focusInit = false;
  }

  start(mode) {
    const J = this.rec.lastJump();
    const now = this.rec.last();
    this.J = J || { t0: Math.max(this.rec.first(), now - 12), t1: now, take: null, land: null, ramp: null };
    this.t = this.J.t0; this.active = true; this.mode = mode || 'tv'; this.paused = false; this.focusInit = false; this.shot = null;
    return !!J;
  }

  stop() { this.active = false; }

  speed() {
    const J = this.J;
    if (this.mode === 'free') return this.paused ? 0 : 1;
    if (J.take !== null && this.t > J.take - 0.25 && this.t < J.land + 0.35) return 0.45;
    return 1;
  }

  step(dt, scrub) {
    const J = this.J;
    if (this.mode === 'free' && scrub) this.t += scrub;
    this.t += dt * this.speed();
    if (this.t > J.t1) this.t = J.t0 + (this.t - J.t1) % Math.max(0.01, J.t1 - J.t0);
    if (this.t < J.t0) this.t = J.t0;
    this.rec.sample(this.t, this.pose, this.a, this.b);
    return this.pose;
  }

  progress() { return (this.t - this.J.t0) / Math.max(0.01, this.J.t1 - this.J.t0); }

  pickShot(P) {
    const J = this.J, t = this.t;
    const loc = rampLocate(P.p[0], P.p[1], P.p[2]);
    if (J.take === null) return 'orbit';
    if (J.lineup) return t < J.take - 0.9 ? 'lapp' : t < J.take + Math.max(0.6, (J.land - J.take) * 0.5) ? 'lfront' : t < J.land - 0.1 ? 'lside' : 'land';
    if (t < (J.ramp ?? J.take - 2.5) - 0.2) return 'tele';
    if (t < J.take - (J.fromCeil ? 1.1 : 0.4)) return loc.s > 2 && loc.s < 24 ? 'side' : 'tele';
    if (t < J.take + Math.max(0.5, (J.land - J.take) * 0.45)) return J.fromCeil ? 'lip' : 'side';
    return 'land';
  }

  camera(cam, dt, P) {
    const carPos = this._c.set(P.p[0], P.p[1], P.p[2]);
    const com = carPos.clone().add(new THREE.Vector3(0, 0.5, 0).applyQuaternion(new THREE.Quaternion(P.q[0], P.q[1], P.q[2], P.q[3])));
    if (!this.focusInit) { this.focus.copy(com); this.focusInit = true; }
    this.focus.lerp(com, 1 - Math.exp(-dt * 7));
    let pos, fov = 40, tg = this.focus;
    const shot = this.pickShot(P);
    if (shot !== this.shot) { this.shot = shot; this.focus.copy(com); }
    const frame = (p, size) => { const d = p.distanceTo(tg); return Math.max(4, Math.min(60, 2 * Math.atan(size / d) * 180 / Math.PI)); };
    if (shot === 'tele') { pos = new THREE.Vector3(-43.2, 0.95, -0.3); fov = frame(pos, 4.2); }
    else if (shot === 'side') { pos = new THREE.Vector3(-46, 3.5, 30); fov = frame(pos, 9); }
    else if (shot === 'lip') { pos = new THREE.Vector3(-21, 0.5, 6.5); fov = 58; }
    else if (shot === 'lapp') { const S = LINEUP.stage; pos = new THREE.Vector3(this.J.dir > 0 ? S.x0 - 46 : S.x1 + 46, 1.0, LINEUP.line + 2.2); fov = frame(pos, 5); }
    else if (shot === 'lfront') { const S = LINEUP.stage, mid = new THREE.Vector3((S.x0 + S.x1) / 2, 2.8, (S.z0 + S.z1) / 2); tg = mid.lerp(this.focus, 0.35); pos = new THREE.Vector3(mid.x, 1.3, S.z0 - 22); fov = 40; }
    else if (shot === 'lside') { const S = LINEUP.stage; pos = new THREE.Vector3(this.J.dir > 0 ? S.x1 + 9 : S.x0 - 9, 0.75, S.z0 - 8); fov = frame(pos, 7.5); }
    else if (shot === 'land') { const L = this.J.landPos || { x: -55, z: 0 }; pos = new THREE.Vector3(L.x - 9, 0.6, L.z + 9); fov = frame(pos, 7); }
    else { const o = this.orbit; o.yaw += dt * 0.25; pos = tg.clone().add(new THREE.Vector3(Math.sin(o.yaw) * 9, 2.4, Math.cos(o.yaw) * 9)); fov = 45; }
    cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(tg);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    return this.shot;
  }
}
