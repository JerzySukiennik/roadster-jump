// Roadster Jump showroom: the title-screen Roadster you can play with. Orbit camera with drag momentum and zoom, BVH raycasts on the real car meshes, hover (or tap) reactions on critically damped springs that can be interrupted at any time: gullwing doors, front flap and thrusters, rear boost, lift jets with a hover, wheels, targa roof, headlights, suction squat and the yoke; and an exploded view that pulls apart the parts around the cursor (click to explode everything).
import * as THREE from 'three';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { CarPose } from './carView.js';
import { thrustDir, BASIS } from './sim/thrusters.js';
import { V3 } from './sim/math.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const PARTS = {
  doorL: ['Gullwing door', 'Opens up 118 degrees on a roof hinge'], doorR: ['Gullwing door', 'Opens up 118 degrees on a roof hinge'],
  front: ['Front thrusters', 'The flap opens and two nozzles slide out'], rear: ['Rear thrusters', 'Four gimballed nozzles, 22 kN of boost'],
  lift: ['Lift jets', 'Four nozzles under the sills hold it in the air'], wheelF: ['Front wheel', '265/35 R20, steers up to 36 degrees'], wheelR: ['Rear wheel', '325/30 R21, 950 kW to all four'],
  targa: ['Targa roof', 'Lifts off in one piece'], lights: ['Headlights', 'Full-width LED bar'], body: ['Suction fan', 'Holds the car to the wall and the ceiling'],
  glass: ['Black glass', 'Tinted all the way round'], cabin: ['Yoke', 'Steer-by-wire, two turns lock to lock'],
};
const NAMES = {
  Body_Shell: 'Body shell', Hood: 'Hood', Bumper_F: 'Front bumper', Flap_F: 'Thruster flap', NozzleMount_F: 'Front nozzles', Bumper_R: 'Rear bumper', Light_Tail: 'Tail light',
  Nozzle_RL1: 'Rear nozzle', Nozzle_RL2: 'Rear nozzle', Nozzle_RR1: 'Rear nozzle', Nozzle_RR2: 'Rear nozzle', Door_L: 'Left door', Door_R: 'Right door', Glass_Windshield: 'Windshield',
  Glass_Rear: 'Rear glass', Glass_Quarter_L: 'Quarter glass', Glass_Quarter_R: 'Quarter glass', Roof_Targa: 'Targa roof', Light_Head_L: 'Headlight', Light_Head_R: 'Headlight',
  Steer_FL: 'Front left wheel', Steer_FR: 'Front right wheel', Wheel_RL: 'Rear left wheel', Wheel_RR: 'Rear right wheel', Brake_RL: 'Rear brake', Brake_RR: 'Rear brake',
  Underbody: 'Underbody', NozzleMount_S: 'Lift nozzles', Interior: 'Interior', SteeringWheel: 'Yoke',
};
const EXPLODE = { Body_Shell: [0, 0.05, 0, 0.1], Hood: [0, 1, 0.5, 0.55], Bumper_F: [0, 0.1, 1, 0.6], Flap_F: [0, -0.3, 1, 0.75], NozzleMount_F: [0, -0.4, 1, 0.9],
  Bumper_R: [0, 0.1, -1, 0.6], Light_Tail: [0, 0.5, -1, 0.7], Nozzle_RL1: [0.3, -0.2, -1, 0.95], Nozzle_RL2: [0.1, -0.2, -1, 0.95], Nozzle_RR1: [-0.3, -0.2, -1, 0.95], Nozzle_RR2: [-0.1, -0.2, -1, 0.95],
  Door_L: [1, 0.45, 0, 0.75], Door_R: [-1, 0.45, 0, 0.75], Glass_Windshield: [0, 1, 0.45, 0.7], Glass_Rear: [0, 1, -0.45, 0.7], Glass_Quarter_L: [1, 0.6, -0.2, 0.6], Glass_Quarter_R: [-1, 0.6, -0.2, 0.6],
  Roof_Targa: [0, 1, 0, 0.95], Light_Head_L: [0.3, 0.2, 1, 0.8], Light_Head_R: [-0.3, 0.2, 1, 0.8], Steer_FL: [1, 0, 0.1, 0.65], Steer_FR: [-1, 0, 0.1, 0.65], Wheel_RL: [1, 0, -0.1, 0.65],
  Wheel_RR: [-1, 0, -0.1, 0.65], Brake_RL: [1, 0, -0.1, 0.4], Brake_RR: [-1, 0, -0.1, 0.4], Underbody: [0, -1, 0, 0.35], NozzleMount_S: [0, -1, 0, 0.6], Interior: [0, 0.6, 0, 0.35], SteeringWheel: [0, 0.8, 0.3, 0.55] };
const CLIP_POS = ['front_nozzles_deploy', 'side_nozzles_deploy', 'targa_remove'];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const approach = (v, t, dt, tau) => v + (t - v) * (1 - Math.exp(-dt / tau));

function partOf(o) {
  for (let p = o; p; p = p.parent) {
    const n = p.name || '';
    if (/^Door_[LR]$/.test(n)) return { key: n === 'Door_L' ? 'doorL' : 'doorR', node: n };
    if (/^Steer_F[LR]$/.test(n)) return { key: 'wheelF', node: n, wheel: n.endsWith('L') ? 0 : 1 };
    if (/^(Wheel_R[LR]|Brake_R[LR])$/.test(n)) return { key: 'wheelR', node: n, wheel: n.endsWith('L') ? 2 : 3 };
    if (n === 'NozzleMount_F') return { key: 'front', node: n };
    if (n === 'NozzleMount_S') return { key: 'lift', node: n };
    if (n === 'Roadster') break;
  }
  for (let p = o; p; p = p.parent) {
    const n = p.name || '';
    if (/^Door_L/.test(n)) return { key: 'doorL', node: 'Door_L' };
    if (/^Door_R/.test(n)) return { key: 'doorR', node: 'Door_R' };
    if (/^(Bumper_F|Flap_F|NozzleMount_F|Hood)$/.test(n)) return { key: 'front', node: n };
    if (/^(Bumper_R|Light_Tail|Nozzle_R[LR]\d)$/.test(n)) return { key: 'rear', node: n };
    if (/^(Underbody|NozzleMount_S|Pod_Nozzle_S)/.test(n)) return { key: 'lift', node: n.startsWith('Pod') ? 'Body_Shell' : n };
    if (/^(Steer_F[LR])$/.test(n)) return { key: 'wheelF', node: n, wheel: n.endsWith('L') ? 0 : 1 };
    if (/^(Wheel_R[LR]|Brake_R[LR])$/.test(n)) return { key: 'wheelR', node: n, wheel: n.endsWith('L') ? 2 : 3 };
    if (n === 'Roof_Targa') return { key: 'targa', node: n };
    if (/^Light_Head/.test(n)) return { key: 'lights', node: n };
    if (/^Glass_/.test(n)) return { key: 'glass', node: n };
    if (/^(Interior|SteeringWheel|Screen|Cluster)$/.test(n)) return { key: 'cabin', node: n === 'Screen' || n === 'Cluster' ? 'Interior' : n };
    if (n === 'Body_Shell') return { key: 'body', node: n };
  }
  return null;
}

export class Showroom {
  constructor(o) {
    Object.assign(this, o);
    this.active = false; this.mode = 'play'; this.t = 0;
    this.yaw = 3.75; this.pitch = 0.2; this.dist = 8.0; this.vyaw = 0; this.vpitch = 0; this.idle = 9;
    this.pointer = { x: 0, y: 0, in: false, down: false, moved: 0, hist: [] };
    this.hover = null; this.latched = new Set(); this.all = 0; this.allTarget = 0;
    this.st = { doorL: 0, doorR: 0, front: 0, rear: 0, lift: 0, targa: 0, lights: 0, body: 0, cabin: 0, wheelF: 0, wheelR: 0 };
    this.spin = [0, 0, 0, 0]; this.spinV = [0, 0, 0, 0];
    this.pose = new CarPose(); this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    this.carNode = this.view.carNode; this.parts = [];
    this.view.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.carNode.matrixWorld).invert(), box = new THREE.Box3();
    for (const [name, e] of Object.entries(EXPLODE)) {
      const node = this.view.n[name]; if (!node) continue;
      box.setFromObject(node); const c = box.getCenter(new THREE.Vector3()).applyMatrix4(inv);
      const dir = new THREE.Vector3(e[0], e[1], e[2]).normalize();
      this.parts.push({ name, node, dir, mag: e[3], center: c, off: new THREE.Vector3(), k: 0 });
    }
    this.byName = new Map(this.parts.map((p) => [p.name, p]));
    this.meshes = []; this.view.gltf.traverse((m) => { if (m.isMesh && m.visible && m.material && m.material.colorWrite !== false && !/ShadowProxy/.test(m.name)) this.meshes.push(m); });
    this.bvhDone = false;
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._m = new THREE.Matrix4();
    this.prevDoor = { doorL: 0, doorR: 0 };
  }

  buildBVH() {
    if (this.bvhDone) return;
    this.bvhDone = true;
    const list = this.meshes.slice(), step = () => { const t0 = performance.now(); while (list.length && performance.now() - t0 < 12) { const m = list.pop(); try { if (!m.geometry.boundsTree) m.geometry.computeBoundsTree(); } catch (e) { /* plain raycast */ } } if (list.length) setTimeout(step, 0); };
    step();
  }

  start() {
    this.active = true; this.ending = false; this.t = 0; this.idle = 9;
    document.body.classList.add('showroom');
    this.buildBVH();
  }

  end() { this.ending = true; this.latched.clear(); this.allTarget = 0; this.hover = null; }

  finish() {
    this.active = false; this.ending = false;
    document.body.classList.remove('showroom', 'hovering', 'dragging');
    for (const p of this.parts) p.off.set(0, 0, 0);
    this.restoreParts(); this.view.doorR = 0; this.view.targa = 0; this.view.lightsOn = 1;
  }

  setMode(m) { this.mode = m; this.latched.clear(); this.allTarget = 0; }

  onDown(x, y) { const P = this.pointer; P.down = true; P.moved = 0; P.x = x; P.y = y; P.hist = [[x, y, performance.now()]]; this.vyaw = this.vpitch = 0; }
  onMove(x, y) {
    const P = this.pointer, dx = x - P.x, dy = y - P.y;
    P.x = x; P.y = y; P.in = true;
    if (P.down) {
      P.moved += Math.abs(dx) + Math.abs(dy);
      if (P.moved > 6) { document.body.classList.add('dragging'); this.yaw -= dx * 0.006; this.pitch = Math.max(-0.05, Math.min(0.75, this.pitch + dy * 0.004)); this.idle = 0; }
      P.hist.push([x, y, performance.now()]); if (P.hist.length > 6) P.hist.shift();
    }
  }
  onUp() {
    const P = this.pointer; if (!P.down) return null;
    P.down = false; document.body.classList.remove('dragging');
    if (P.moved > 6) {
      const h = P.hist, a = h[0], b = h[h.length - 1], dt = Math.max(16, b[2] - a[2]) / 1000;
      this.vyaw = -(b[0] - a[0]) / dt * 0.006; this.vpitch = (b[1] - a[1]) / dt * 0.004; this.idle = 0;
      return null;
    }
    return this.click();
  }
  onLeave() { this.pointer.in = false; this.hover = null; }
  onWheel(d) { this.dist = Math.max(4.6, Math.min(12, this.dist * (1 + d * 0.08))); this.idle = 0; }

  click() {
    const h = this.pick();
    if (this.touch) { this.hover = h; this.hoverT = 1.8; }
    if (this.mode === 'explode') { this.allTarget = this.allTarget > 0.5 ? 0 : 1; return 'explode'; }
    if (!h) return null;
    if (this.latched.has(h.key)) this.latched.delete(h.key); else this.latched.add(h.key);
    if (h.key === 'lights') this.blink = 1.2;
    return h.key;
  }

  pick() {
    if (!this.pointer.in && !this.touch) return null;
    const w = innerWidth, h = innerHeight;
    this.ndc.set(this.pointer.x / w * 2 - 1, -(this.pointer.y / h) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    this.ray.firstHitOnly = true;
    const hit = this.ray.intersectObjects(this.meshes, false)[0];
    if (!hit) return null;
    let p = partOf(hit.object);
    if (p && p.key === 'body') {
      const l = this.carNode.worldToLocal(hit.point.clone());
      if (l.z < -1.5) p = { key: 'rear', node: 'Bumper_R' };
      else if (l.z > 1.7) p = { key: 'front', node: 'Bumper_F' };
      else if (l.y < 0.36 && Math.abs(l.x) > 0.62) p = { key: 'lift', node: 'NozzleMount_S' };
    }
    return p ? { ...p, point: hit.point } : null;
  }

  restoreParts() {
    const R = this.view.rest;
    for (const p of this.parts) { const r = R.get(p.node); if (r) p.node.position.copy(r.p); }
    for (const c of CLIP_POS) if (this.view.clips[c]) this.view.clips[c].last = -1;
  }

  update(dt, startPose) {
    this.t += dt;
    const st = this.st, T = {}, now = this.t;
    if (!this.pointer.down && !this.ending) {
      if (!this.touch) this.hover = this.pointer.in ? this.pick() : null;
      else if (this.hoverT > 0) { this.hoverT -= dt; if (this.hoverT <= 0) this.hover = null; }
    }
    if (this.ending) this.hover = null;
    document.body.classList.toggle('hovering', !!this.hover && !this.pointer.down);
    const hk = this.mode === 'play' && !this.ending ? (this.hover ? this.hover.key : null) : null;
    const hold = this.hold || (this.hold = {});
    for (const k in st) hold[k] = Math.max(0, (hold[k] || 0) - dt);
    if (hk) hold[hk] = hk === 'doorL' || hk === 'doorR' || hk === 'targa' ? 0.9 : 0.25;
    if ((hk === 'cabin' || hk === 'glass') && !this.ending) for (const k of ['doorL', 'doorR', 'targa']) if (st[k] > 0.25) hold[k] = 0.9;
    for (const k in st) T[k] = (hold[k] > 0 || (this.mode === 'play' && this.latched.has(k))) && !this.ending ? 1 : 0;
    const tau = { doorL: 0.32, doorR: 0.32, front: 0.22, rear: 0.12, lift: 0.3, targa: 0.35, lights: 0.1, body: 0.18, cabin: 0.25, wheelF: 0.3, wheelR: 0.3 };
    for (const k in st) st[k] = approach(st[k], T[k], dt, (T[k] < st[k] ? 1.4 : 1) * tau[k]);
    for (const k of ['doorL', 'doorR']) { const open = T[k] > 0.5; if (open !== this.prevDoor[k]) { this.prevDoor[k] = open; if (this.audio) this.audio.play(open ? 'door_open' : 'door_close', { gain: 0.6 }); } }
    if (this.hover && this.hover.wheel !== undefined && this.mode === 'play') this.spinV[this.hover.wheel] = Math.min(28, this.spinV[this.hover.wheel] + dt * 60);
    for (let i = 0; i < 4; i++) { this.spinV[i] *= Math.exp(-dt * 0.8); this.spin[i] += this.spinV[i] * dt; }
    if (this.blink) this.blink = Math.max(0, this.blink - dt);
    const P = this.pose;
    P.read(startPose, 0);
    const lift = st.lift, squat = st.body;
    P.p[1] += lift * (0.16 + 0.025 * Math.sin(now * 2.4)) - squat * 0.035;
    for (let i = 0; i < 4; i++) { P.len[i] += lift * 0.09 - squat * 0.03; P.spin[i] = this.spin[i]; P.contact[i] = lift > 0.3 ? 0 : 1; P.slip[i] = 0; }
    const steer = Math.sin(now * 2.2) * 0.42 * st.wheelF + Math.sin(now * 1.4) * 0.5 * st.cabin;
    P.steer[0] = steer; P.steer[1] = steer; P.steerAngle = steer;
    P.door = st.doorL; this.view.doorR = st.doorR; this.view.targa = st.targa;
    P.flap = clamp01(st.front / 0.45); P.extend = clamp01((st.front - 0.35) / 0.65); P.side = st.lift;
    const d = new V3();
    for (let i = 0; i < 10; i++) { P.valve[i] = 0; P.ground[i] = 99; }
    const setDir = (i, grp, pitch, side) => { thrustDir(BASIS[grp], pitch, side, d); P.dir[i * 3] = d.x; P.dir[i * 3 + 1] = d.y; P.dir[i * 3 + 2] = d.z; };
    for (let i = 0; i < 4; i++) setDir(i, 'rear', 0, 0);
    for (let i = 4; i < 6; i++) setDir(i, 'front', 0.75, (i === 4 ? 1 : -1) * 0.25);
    for (let i = 6; i < 10; i++) setDir(i, 'side', Math.sin(now * 3 + i) * 0.12, 0);
    const flick = (i) => 0.82 + 0.18 * Math.sin(now * 31 + i * 1.7);
    if (st.rear > 0.25) for (let i = 0; i < 4; i++) P.valve[i] = st.rear * flick(i);
    if (P.extend > 0.85) for (let i = 4; i < 6; i++) P.valve[i] = (0.5 + 0.5 * (Math.sin(now * 5.2) > -0.2 ? 1 : 0)) * flick(i) * sm(0.85, 1, P.extend);
    if (st.lift > 0.5) for (let i = 6; i < 10; i++) { P.valve[i] = (st.lift - 0.4) / 0.6 * flick(i); P.ground[i] = 0.35 + lift * 0.18; }
    this.view.lightsOn = 1 + st.lights * 1.6 * (0.6 + 0.4 * Math.sin(now * 18)) + (this.blink ? (Math.sin(this.blink * 30) > 0 ? 1.8 : 0) : 0);
    P.brake = st.rear > 0.3 ? 1 : 0; P.speed = 0; P.vx = P.vy = P.vz = 0; P.fan = st.body;
    this.restoreParts();
    this.applyExplode(dt);
    if (!this.pointer.down && !this.ending) {
      this.idle += dt;
      this.yaw += this.vyaw * dt; this.pitch = Math.max(-0.05, Math.min(0.75, this.pitch + this.vpitch * dt));
      this.vyaw *= Math.exp(-dt * 2.2); this.vpitch *= Math.exp(-dt * 3);
      if (this.idle > 3.5 && !this.hover) this.yaw += dt * 0.09 * Math.min(1, (this.idle - 3.5) / 2);
    }
    return P;
  }

  applyExplode(dt) {
    const target = this.mode === 'explode' && !this.ending;
    this.all = approach(this.all, target ? this.allTarget : 0, dt, 0.35);
    let hp = null, hn = null;
    if (target && this.hover) { hp = this.carNode.worldToLocal(this.hover.point.clone()); hn = this.hover.node; }
    this.explodeTargets = [];
    for (const p of this.parts) {
      let k = this.all;
      if (hp) { const d = p.center.distanceTo(hp); k = Math.max(k, p.name === hn ? 1 : sm(1.5, 0.25, d) * 0.85); }
      p.k = approach(p.k, k, dt, k > p.k ? 0.16 : 0.28);
      if (p.k > 0.002) { p.off.copy(p.dir).multiplyScalar(p.mag * p.k); }
      else p.off.set(0, 0, 0);
    }
  }

  afterApply() {
    for (const p of this.parts) if (p.off.lengthSq() > 1e-8) p.node.position.add(p.off);
  }

  label() {
    if (!this.hover || this.pointer.down) return null;
    if (this.mode === 'explode') return [NAMES[this.hover.node] || 'Part', this.allTarget > 0.5 ? 'Click to put it back together' : 'Click to explode everything'];
    const P = PARTS[this.hover.key]; return P ? [P[0], P[1]] : null;
  }

  camPose(target, out) {
    const cp = Math.cos(this.pitch);
    out.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.dist).add(target);
    return out;
  }
}
