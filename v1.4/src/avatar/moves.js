// Roadster Jump avatar moves (from Roadster 88): scripted mocap sequences instead of teleports: getting in (walk around the nose or tail to the driver door, the gullwing lifts, sit down backwards, swing in) and getting out (door opens, turn out of the seat, stand up beside the car).
import * as THREE from 'three';

const DOOR = new THREE.Vector3(1.45, 0, -0.15);
const SEAT_UP = 0.55, SEAT_BACK = 0.29, Y = new THREE.Vector3(0, 1, 0);
const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const turn = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; };

export class Moves {
  constructor(game) {
    this.g = game; this.cur = null;
    this.w = { pose: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 0, grounded: true, vy: 0, tumble: 0, dead: false, swim: false };
  }

  get busy() { return !!this.cur; }

  carYaw(car) { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(car.curr.quat); return Math.atan2(f.x, f.z); }
  local(car, v) { return v.clone().applyQuaternion(car.curr.quat).add(car.curr.pos); }
  ground(p, from) { const h = this.g.groundHeight(p.x, p.z, from); return h === null ? p.y : h; }

  seatRoot(car, yaw) {
    const seat = car.view.n.Seat_Driver, p = seat ? seat.getWorldPosition(new THREE.Vector3()) : this.local(car, new THREE.Vector3(0.36, 0.26, -0.3));
    return p.addScaledVector(Y, -SEAT_UP).add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(SEAT_BACK));
  }

  start(kind, car, o) {
    if (!this.g.driver.anim) { if (o.done) o.done(); return false; }
    this.cur = { kind, car, t: 0, step: -1, ...o };
    this.g.walker.lock = Math.max(this.g.walker.lock, o.dur + 0.1);
    return true;
  }

  motion() {
    const D = this.g.driver;
    if (D.motionOn) return;
    D.resetPose(); D.anim.reset(); D.motionOn = true; D.drop = 0;
  }

  exit(car, stand, yaw, done) {
    const out = Math.atan2(car.sim.left.x, car.sim.left.z);
    this.g.doorPulse(car, true);
    if (!this.start('exit', car, { dur: 1.65, stand: stand.clone(), out, yaw, done })) return false;
    return true;
  }

  enter(car, done) {
    const W = this.g.walker, out = Math.atan2(car.sim.left.x, car.sim.left.z), stand = this.local(car, DOOR);
    stand.y = this.ground(stand, car.sim.pos.y + 2.5);
    const from = new THREE.Vector3(W.pos.x, W.pos.y, W.pos.z), path = this.around(car, from, stand);
    let len = 0; for (let i = 1; i < path.length; i++) len += path[i].distanceTo(path[i - 1]);
    const walk = Math.max(0.35, len / 2.6);
    return this.start('enter', car, { dur: walk + 1.15 + 0.35, walk, path, len, from, stand, out, yaw0: W.yaw, done });
  }

  around(car, from, stand) {
    const inv = car.curr.quat.clone().invert(), L = from.clone().sub(car.curr.pos).applyQuaternion(inv), pts = [from];
    const at = (x, z) => { const p = this.local(car, new THREE.Vector3(x, 0, z)); p.y = this.ground(p, car.sim.pos.y + 2.5); return p; };
    if (L.x < -1.05) { const z = L.z > 0 ? 2.75 : -2.85; pts.push(at(-1.5, z), at(1.5, z)); }
    else if (L.x < 1.2 && Math.abs(L.z) > 1.4) pts.push(at(1.5, Math.max(-2.6, Math.min(2.6, L.z))));
    pts.push(stand);
    return pts;
  }

  along(path, len, u) {
    let d = u * len;
    for (let i = 1; i < path.length; i++) { const s = path[i].distanceTo(path[i - 1]); if (d <= s || i === path.length - 1) return { p: path[i - 1].clone().lerp(path[i], s > 1e-6 ? Math.min(1, d / s) : 1), dir: Math.atan2(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z) }; d -= s; }
    return { p: path[path.length - 1].clone(), dir: 0 };
  }

  play(name, opt) { const A = this.g.driver.anim; if (A) A.play(name, { lock: true, ...opt }); }
  stepTo(n, fn) { const c = this.cur; if (c.step < n) { c.step = n; fn(); } }

  abort() {
    const c = this.cur; this.cur = null;
    this.g.walker.lock = 0;
    if (c && c.kind === 'exit' && c.done) c.done();
  }

  render(dt) {
    const c = this.cur, g = this.g, D = g.driver;
    if (!c || !D.ready) return false;
    c.t += dt;
    const car = c.car, w = this.w, t = c.t;
    w.speed = 0; w.grounded = true; w.vy = 0;
    const groundFn = (x, z) => { const h = g.groundHeight(x, z, car.sim.pos.y + 2.5); return h === null ? 0 : h; };
    if (c.kind === 'exit') {
      if (t < 0.35) { if (D.root.parent !== car.view.seatRoot) D.attach(car.view.seatRoot, false); D.pose(car.view.driverView, dt, {}); return true; }
      if (D.root.parent !== g.scene) D.attach(g.scene, true);
      this.stepTo(0, () => { this.motion(); this.play('Sitting_Idle_Loop', { until: 0.3 }); });
      const carYaw = this.carYaw(car), yaw = turn(carYaw, c.out, ease((t - 0.35) / 0.25));
      if (t < 0.6) { const r = this.seatRoot(car, yaw); Object.assign(w.pose, { x: r.x, y: r.y, z: r.z }); w.yaw = yaw; }
      else {
        this.stepTo(1, () => this.play('Sitting_Exit'));
        const u = ease((t - 0.6) / 1.0), r = this.seatRoot(car, c.out).lerp(c.stand, u);
        Object.assign(w.pose, { x: r.x, y: r.y, z: r.z }); w.yaw = turn(c.out, c.yaw, ease((t - 1.3) / 0.35));
      }
      D.walkPose(w, dt, { ground: null });
      if (t >= c.dur) { this.cur = null; g.walker.lock = 0; g.walker.yaw = c.yaw; if (c.done) c.done(); }
      return true;
    }
    if (D.root.parent !== g.scene) D.attach(g.scene, true);
    let ground = null;
    if (t < c.walk) {
      const u = t / c.walk, a = this.along(c.path, c.len, u), p = a.p;
      Object.assign(w.pose, { x: p.x, y: p.y, z: p.z });
      c.dirS = c.dirS === undefined ? c.yaw0 : turn(c.dirS, a.dir, Math.min(1, dt * 10));
      w.yaw = u < 0.82 ? c.dirS : turn(c.dirS, c.out, ease((u - 0.82) / 0.18));
      w.speed = c.len / c.walk;
      ground = groundFn;
      this.stepTo(0, () => g.doorPulse(car, true));
    } else if (t < c.walk + 1.15) {
      this.stepTo(1, () => this.play('Sitting_Enter'));
      const u = ease((t - c.walk) / 1.15), r = c.stand.clone().lerp(this.seatRoot(car, c.out), u);
      Object.assign(w.pose, { x: r.x, y: r.y, z: r.z }); w.yaw = c.out;
    } else {
      this.stepTo(2, () => this.play('Sitting_Idle_Loop', { until: 0.6 }));
      const yaw = turn(c.out, this.carYaw(car), ease((t - c.walk - 1.15) / 0.3)), r = this.seatRoot(car, yaw);
      Object.assign(w.pose, { x: r.x, y: r.y, z: r.z }); w.yaw = yaw;
    }
    D.walkPose(w, dt, { ground });
    if (t >= c.dur) { this.cur = null; c.done(); }
    return true;
  }
}
