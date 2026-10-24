// Roadster Jump remote players: everyone else in the shared arena, rebuilt from their packed state with 120 ms of interpolation and a short extrapolation: their Roadster (a light LOD1 copy without lamps, wheels that spin and steer, cold-gas vapour from the nozzles), the lineup Tesla they are driving, or Jurek on foot as a simple hand-built figure, each with a name tag. Cars carry hulls with their real mass (no gravity) that are steered onto the network pose every physics step, so a crash trades momentum with your car instead of bouncing off a wall, and teleports snap instead of sweeping across the arena.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CarPose, NOZZLES } from './carView.js';
import { carHull, GROUP, groups } from './sim/car.js';

const DELAY = 120, X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const f2 = (v) => (Math.round(v * 100) / 100).toString(), f3 = (v) => (Math.round(v * 1000) / 1000).toString();

export function packCar(sim, door, air) {
  const p = sim.pos, q = sim.q, v = sim.vel, valves = sim.thrusters.all.map((n) => Math.min(9, Math.round(n.valve * 9))).join('');
  return [f2(p.x), f2(p.y), f2(p.z), f3(q.x), f3(q.y), f3(q.z), f3(q.w), f2(v.x), f2(v.y), f2(v.z), f2(sim.steerAngle), f2(door), valves, air ? 1 : 0].join(',');
}

export function packWalker(w) { return [f2(w.pos.x), f2(w.pos.y), f2(w.pos.z), f2(w.yaw), f2(w.speed), w.grounded ? 1 : 0].join(','); }

function unCar(s) {
  const a = s.split(',');
  if (a.length < 14) return null;
  const n = a.map(Number);
  return { p: [n[0], n[1], n[2]], q: [n[3], n[4], n[5], n[6]], v: [n[7], n[8], n[9]], steer: n[10], door: n[11], valves: a[12].split('').map((c) => +c / 9), air: n[13] === 1 };
}

function unpack(s) {
  const parts = s.split('|');
  if (parts[0] !== 'v1') return null;
  const vid = +parts[1], o = { vid, R: unCar(parts[2] || ''), A: null, W: null };
  for (const x of parts.slice(3)) { if (x.startsWith('A:')) o.A = unCar(x.slice(2)); else if (x.startsWith('W:')) { const n = x.slice(2).split(',').map(Number); o.W = { p: [n[0], n[1], n[2]], yaw: n[3], speed: n[4], grounded: n[5] === 1 }; } }
  return o.R ? o : null;
}

function figure() {
  const g = new THREE.Group(), M = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const tee = M(0x15161a), skin = M(0xc8946e, 0.6), pants = M(0x5a5d63), shoe = M(0x3fbf5a, 0.5), hair = M(0x2a1d14);
  const part = (w, h, d, mat, x, y, z, py) => { const pivot = new THREE.Group(); pivot.position.set(x, py, z); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.y = y - py; m.castShadow = true; pivot.add(m); g.add(pivot); return pivot; };
  const legs = [-1, 1].map((s) => { const l = part(0.16, 0.84, 0.18, pants, s * 0.1, 0.5, 0, 0.9); const sh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.3), shoe); sh.position.set(0, -0.86, 0.05); l.add(sh); return l; });
  const arms = [-1, 1].map((s) => { const a = part(0.12, 0.62, 0.13, tee, s * 0.29, 1.12, 0, 1.42); const h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), skin); h.position.y = -0.62; a.add(h); return a; });
  part(0.46, 0.62, 0.26, tee, 0, 1.2, 0, 1.2);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skin); head.position.y = 1.67; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair); cap.position.y = 1.69; g.add(cap);
  return { g, legs, arms, phase: 0 };
}

export class Remotes {
  constructor({ scene, R, world, lineup, smoke, tuning, url, tags }) {
    this.scene = scene; this.R = R; this.world = world; this.lineup = lineup; this.smoke = smoke; this.tu = tuning; this.url = url; this.tags = tags;
    this.list = new Map(); this.tpl = null; this.tplP = null; this.hull = carHull(tuning);
    this._q = new THREE.Quaternion(); this._qa = new THREE.Quaternion(); this._qb = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._p = new THREE.Vector3();
  }

  loadTpl() {
    if (!this.tplP) this.tplP = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(this.url).then((g) => {
      g.scene.traverse((o) => { if (!o.isMesh) return; o.castShadow = false; o.receiveShadow = true; for (const m of [].concat(o.material)) { if (m.isMeshPhysicalMaterial && m.name !== 'Paint') m.clearcoat = 0; if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = 0.55; m.depthWrite = false; } } });
      if (this.onTpl) this.onTpl(g.scene);
      const w = g.scene.getObjectByName('Wing'); if (w) w.visible = false;
      this.tpl = g.scene; return g.scene;
    });
    return this.tplP;
  }

  body(points, mass, I) {
    const R = this.R, b = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setGravityScale(0).setCcdEnabled(true).setCanSleep(false).setTranslation(0, -50, 0));
    for (const pts of points) { const d = R.ColliderDesc.convexHull(pts); if (d) this.world.createCollider(d.setDensity(0).setFriction(0.5).setRestitution(0.1).setCollisionGroups(groups(GROUP.CAR, GROUP.CAR | GROUP.PROP)), b); }
    b.setAdditionalMassProperties(mass, { x: 0, y: 0.5, z: 0 }, { x: I[0], y: I[1], z: I[2] }, { x: 0, y: 0, z: 0, w: 1 }, true);
    b.fresh = true;
    return b;
  }

  drive(b, k, h) {
    const t = b.translation(), dx = k.p[0] - t.x, dy = k.p[1] - t.y, dz = k.p[2] - t.z;
    if (b.fresh || dx * dx + dy * dy + dz * dz > 36) { b.setTranslation({ x: k.p[0], y: k.p[1], z: k.p[2] }, true); b.setRotation({ x: k.q[0], y: k.q[1], z: k.q[2], w: k.q[3] }, true); b.setLinvel({ x: k.v[0], y: k.v[1], z: k.v[2] }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); b.fresh = false; return; }
    const kp = 4, al = 1 - Math.exp(-h * 9), v = b.linvel();
    b.setLinvel({ x: v.x + (k.v[0] + dx * kp - v.x) * al, y: v.y + (k.v[1] + dy * kp - v.y) * al, z: v.z + (k.v[2] + dz * kp - v.z) * al }, true);
    const r = b.rotation(); this._qa.set(r.x, r.y, r.z, r.w); this._qb.set(...k.q).multiply(this._qa.invert());
    if (this._qb.w < 0) { this._qb.x *= -1; this._qb.y *= -1; this._qb.z *= -1; this._qb.w *= -1; }
    const ang = 2 * Math.acos(Math.min(1, this._qb.w)), sn = Math.sqrt(Math.max(1e-9, 1 - this._qb.w * this._qb.w)), kr = Math.min(1 / h, 12) * ang / sn;
    b.setAngvel({ x: this._qb.x * kr, y: this._qb.y * kr, z: this._qb.z * kr }, true);
  }

  roadster(e) {
    if (e.rv || !this.tpl) return;
    const g = this.tpl.clone(true), n = {}; g.traverse((o) => { if (o.name && !n[o.name]) n[o.name] = o; });
    const root = new THREE.Group(); root.add(g); this.scene.add(root);
    const wheels = ['FL', 'FR', 'RL', 'RR'].map((id, i) => { const w = n['Wheel_' + id], st = n['Steer_' + id]; return { w, st, wq: w ? w.quaternion.clone() : null, sq: st ? st.quaternion.clone() : null, front: i < 2 }; });
    e.rv = { root, wheels, spin: 0, fake: { nozzleRig: NOZZLES.map((id) => ({ ex: n['Exhaust_Nozzle_' + id] || n['Nozzle_' + id] || g })) }, pose: new CarPose() };
  }

  update(u, name, s, t) {
    const o = unpack(s); if (!o) return;
    let e = this.list.get(u);
    if (!e) {
      const c = this.tu.car;
      e = { u, name, snaps: [], rb: this.body([this.hull.body, this.hull.cabin], c.mass, [c.inertia.pitch, c.inertia.yaw, c.inertia.roll]), ab: null, avid: 0, av: null, fig: null, tag: document.createElement('div') };
      e.tag.className = 'mp-tag'; this.tags.appendChild(e.tag); this.list.set(u, e); this.loadTpl().then(() => this.roadster(e));
    }
    e.name = name; e.tag.textContent = name;
    o.t = t; e.snaps.push(o); if (e.snaps.length > 12) e.snaps.shift();
    if (o.vid !== e.avid) {
      if (e.ab) { this.world.removeRigidBody(e.ab); e.ab = null; }
      if (e.av) { e.av.root.removeFromParent(); e.av = null; }
      e.avid = o.vid;
      if (o.vid > 0) { const P = this.lineup.kits[o.vid - 1].spec.phys; e.ab = this.body(this.lineup.hull(o.vid - 1), P.mass, P.I); e.av = this.lineup.spawnView(o.vid - 1, this.scene); e.av.y0 = this.lineup.wheelY(o.vid - 1); e.av.spin = 0; }
    }
  }

  remove(u) {
    const e = this.list.get(u); if (!e) return;
    this.world.removeRigidBody(e.rb); if (e.ab) this.world.removeRigidBody(e.ab);
    if (e.rv) e.rv.root.removeFromParent(); if (e.av) e.av.root.removeFromParent(); if (e.fig) e.fig.g.removeFromParent();
    e.tag.remove(); this.list.delete(u);
  }

  sample(e, key, t, out) {
    const S = e.snaps; let a = null, b = null;
    for (let i = S.length - 1; i >= 0; i--) { const s = S[i]; if (!s[key]) continue; if (s.t <= t) { a = s; break; } b = s; }
    if (!a && !b) return null;
    if (!a) { const c = b[key]; return Object.assign(out, c, { p: c.p.slice(), q: c.q.slice() }); }
    const ca = a[key];
    if (!b) { const dt = Math.min(0.3, Math.max(0, (t - a.t) / 1000)), p = [ca.p[0] + ca.v[0] * dt, ca.p[1] + ca.v[1] * dt, ca.p[2] + ca.v[2] * dt]; return Object.assign(out, ca, { p, q: ca.q.slice() }); }
    const cb = b[key], k = Math.max(0, Math.min(1, (t - a.t) / Math.max(1, b.t - a.t)));
    if ((cb.p[0] - ca.p[0]) ** 2 + (cb.p[2] - ca.p[2]) ** 2 > 64) return Object.assign(out, k < 0.5 ? ca : cb, { p: (k < 0.5 ? ca : cb).p.slice(), q: (k < 0.5 ? ca : cb).q.slice() });
    this._qa.set(...ca.q); this._qb.set(...cb.q); this._qa.slerp(this._qb, k);
    return Object.assign(out, cb, { p: [ca.p[0] + (cb.p[0] - ca.p[0]) * k, ca.p[1] + (cb.p[1] - ca.p[1]) * k, ca.p[2] + (cb.p[2] - ca.p[2]) * k], q: [this._qa.x, this._qa.y, this._qa.z, this._qa.w], steer: ca.steer + (cb.steer - ca.steer) * k });
  }

  latestWalker(e) { for (let i = e.snaps.length - 1; i >= 0; i--) if (e.snaps[i].W !== undefined) return e.snaps[i]; return null; }

  kinematic(now, h) {
    const t = now - DELAY;
    for (const e of this.list.values()) {
      const r = this.sample(e, 'R', t, e.kr || (e.kr = {}));
      if (r) this.drive(e.rb, r, h);
      if (e.ab) { const a = this.sample(e, 'A', t, e.ka || (e.ka = {})); if (a) this.drive(e.ab, a, h); }
    }
  }

  movers(out, pool) {
    for (const e of this.list.values()) {
      const r = e.kr; if (r && r.p) { const m = pool(); m.x = r.p[0]; m.y = r.p[1]; m.z = r.p[2]; m.r = 2.7; m.h = 1.6; out.push(m); }
      const a = e.ka; if (e.ab && a && a.p) { const m = pool(); m.x = a.p[0]; m.y = a.p[1]; m.z = a.p[2]; m.r = 4.5; m.h = 3; out.push(m); }
    }
  }

  render(dt, now, camera, W, H, smokeOn) {
    const t = now - DELAY;
    for (const e of this.list.values()) {
      let tagAt = null;
      const r = this.sample(e, 'R', t, e.vr || (e.vr = {}));
      if (r && e.rv) {
        const v = e.rv; v.root.position.set(...r.p); v.root.quaternion.set(...r.q);
        const sp = Math.hypot(r.v[0], r.v[1], r.v[2]), fwd = this._v.set(0, 0, 1).applyQuaternion(v.root.quaternion), sgn = Math.sign(fwd.x * r.v[0] + fwd.y * r.v[1] + fwd.z * r.v[2]) || 1;
        v.spin += sgn * sp * dt / 0.355;
        for (const w of v.wheels) { if (w.st) w.st.quaternion.copy(w.sq).multiply(this._q.setFromAxisAngle(Y, w.front ? r.steer * 0.9 : 0)); if (w.w) w.w.quaternion.copy(w.wq).multiply(this._q.setFromAxisAngle(X, v.spin % (Math.PI * 2))); }
        if (smokeOn && r.valves.some((x) => x > 0.05)) {
          const P = v.pose; P.p.set(r.p); P.q.set(r.q); P.vx = r.v[0]; P.vy = r.v[1]; P.vz = r.v[2]; P.contact.fill(r.air ? 0 : 1); P.slip.fill(0);
          for (let i = 0; i < 10; i++) { P.valve[i] = r.valves[i]; const rear = i < 4; P.dir[i * 3] = 0; P.dir[i * 3 + 1] = rear && !r.air ? 0 : 1; P.dir[i * 3 + 2] = rear && !r.air ? 1 : 0; P.ground[i] = Math.max(0.2, r.p[1]); }
          v.root.updateMatrixWorld(true); this.smoke.fromCar(dt, P, v.fake, { land: 0 });
        }
        if (e.avid === 0 && !e.walking) tagAt = this._p.set(r.p[0], r.p[1] + 2.0, r.p[2]);
      }
      if (e.av) {
        const a = this.sample(e, 'A', t, e.va || (e.va = {}));
        if (a) {
          const sp = Math.hypot(a.v[0], a.v[2]); e.av.spin += sp * dt / 0.4; const sp4 = [e.av.spin, e.av.spin, e.av.spin, e.av.spin];
          e.av.pose(a.p, a.q, [0, 0, 0, 0].map((_, i) => e.av.y0[i] - this.lineup.kits[e.avid - 1].spec.R), sp4, [a.steer * 0.9, a.steer * 0.9], e.av.y0);
          tagAt = this._p.set(a.p[0], a.p[1] + this.lineup.kits[e.avid - 1].spec.H + 0.8, a.p[2]);
        }
      }
      const ws = this.latestWalker(e), w = ws && ws.W;
      e.walking = !!w;
      if (w) {
        if (!e.fig) { e.fig = figure(); this.scene.add(e.fig.g); e.wp = new THREE.Vector3(...w.p); e.wy = w.yaw; }
        const F = e.fig, k = 1 - Math.exp(-dt * 10);
        e.wp.lerp(this._v.set(...w.p), k); let dy = w.yaw - e.wy; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.wy += dy * k;
        F.g.position.copy(e.wp); F.g.rotation.y = e.wy; F.g.visible = true;
        F.phase += dt * (2 + w.speed * 2.1); const sw = Math.min(1, w.speed / 2) * (w.speed > 3.5 ? 0.85 : 0.55);
        F.legs[0].rotation.x = Math.sin(F.phase) * sw; F.legs[1].rotation.x = -Math.sin(F.phase) * sw; F.arms[0].rotation.x = -Math.sin(F.phase) * sw * 0.8; F.arms[1].rotation.x = Math.sin(F.phase) * sw * 0.8;
        tagAt = this._p.set(e.wp.x, e.wp.y + 2.1, e.wp.z);
      } else if (e.fig) e.fig.g.visible = false;
      if (tagAt) {
        const d = tagAt.distanceTo(camera.position); tagAt.project(camera);
        const on = tagAt.z < 1 && tagAt.z > -1 && d < 160;
        e.tag.style.display = on ? 'block' : 'none';
        if (on) { e.tag.style.transform = `translate(${((tagAt.x + 1) / 2 * W).toFixed(1)}px, ${((1 - tagAt.y) / 2 * H).toFixed(1)}px) translate(-50%, -100%) scale(${Math.max(0.6, Math.min(1, 30 / d)).toFixed(2)})`; }
      } else e.tag.style.display = 'none';
    }
  }

  get size() { return this.list.size; }
}
