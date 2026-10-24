// Roadster Jump lineup (from the "Do a kickflip" film): its own site about 440 m from the curl with the five Teslas the Roadster ollies over, parked side by side on a black LED stage (Model 3, Model Y, Semi, Cybertruck, Cybercab). Each car is a drivable vehicle: a hand-built lofted or faceted body merged per material in its own frame, instanced tyres and rims that spin, steer and ride the suspension, a contact shadow, its hull, tuning (mass, power, springs, camera distance) and driver door for the plain-car sim, with an event-lighting reflection map shared by all; plus floodlight towers with haze, power poles and wires, stage LEDs and smoke cannons that react to the Roadster flying over, the lamp road and the site light, start spot and footprints used by physics, scoring, travel and reset.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

const SPECS = [
  { id: 'm3', name: 'Model 3', W: 1.89, L: 4.72, H: 1.44, R: 0.335, tw: 0.235, axles: [1.5, -1.375], wmax: 0.925, rim: 0, paint: [0x1d45a8, 0.42, 0.24], intake: [0.31, 0.1, 0.56],
    phys: { mass: 1850, com: [0, 0.5, 0.05], I: [2600, 2900, 640], kw: 380, F: 15000, mph: 155, cd: 0.52, steer: 34, cam: 1.05, seat: [0.4, 0.62, 0.15] },
    boxes: [[0, 0.52, 0, 0.93, 0.36, 2.33], [0, 1.12, -0.25, 0.68, 0.32, 1.2]],
    st: [[-2.36, 0.36, 0.84, 0.87, 0.76, 0.7], [-2.3, 0.27, 0.91, 0.96, 0.86, 0.8], [-2.15, 0.22, 0.94, 1.02, 0.9, 0.84], [-1.85, 0.18, 0.95, 1.03, 0.92, 0.84], [-1.55, 0.17, 0.94, 1.16, 0.925, 0.74], [-1.0, 0.16, 0.92, 1.36, 0.925, 0.66], [-0.35, 0.16, 0.9, 1.44, 0.925, 0.65], [0.25, 0.16, 0.88, 1.4, 0.925, 0.67], [0.75, 0.16, 0.86, 1.18, 0.925, 0.72], [1.1, 0.16, 0.84, 0.94, 0.92, 0.8], [1.6, 0.17, 0.8, 0.86, 0.91, 0.82], [2.0, 0.19, 0.74, 0.79, 0.88, 0.8], [2.22, 0.22, 0.69, 0.73, 0.86, 0.78], [2.33, 0.26, 0.62, 0.66, 0.8, 0.72], [2.36, 0.34, 0.54, 0.57, 0.72, 0.64]],
    glass: [-1.58, 1.08], mirror: 1.0,
    lights: [['white', 0.655, 0.026, 0.46, 0.86, 0], ['red', 0.9, 0.05, 0.5, 0.9, 1]] },
  { id: 'my', name: 'Model Y', W: 1.96, L: 4.79, H: 1.62, R: 0.36, tw: 0.255, axles: [1.445, -1.445], wmax: 0.96, rim: 1, paint: [0xa8121b, 0.38, 0.22], intake: [0.34, 0.12, 0.6],
    phys: { mass: 2000, com: [0, 0.56, 0], I: [2900, 3200, 760], kw: 340, F: 15000, mph: 135, cd: 0.65, steer: 34, cam: 1.12, seat: [0.4, 0.7, 0.1] },
    boxes: [[0, 0.58, 0, 0.97, 0.41, 2.37], [0, 1.31, -0.3, 0.72, 0.31, 1.3]],
    st: [[-2.395, 0.4, 0.88, 0.92, 0.78, 0.72], [-2.34, 0.3, 0.96, 1.02, 0.89, 0.82], [-2.22, 0.24, 1.0, 1.07, 0.92, 0.86], [-2.0, 0.19, 1.02, 1.14, 0.95, 0.8], [-1.6, 0.18, 1.02, 1.38, 0.96, 0.7], [-1.1, 0.17, 1.01, 1.55, 0.96, 0.68], [-0.4, 0.17, 1.0, 1.62, 0.96, 0.68], [0.25, 0.17, 0.99, 1.585, 0.96, 0.7], [0.75, 0.17, 0.98, 1.38, 0.96, 0.75], [1.12, 0.17, 0.965, 1.1, 0.96, 0.82], [1.6, 0.18, 0.93, 1.0, 0.955, 0.86], [2.0, 0.21, 0.88, 0.93, 0.93, 0.84], [2.25, 0.25, 0.83, 0.87, 0.9, 0.82], [2.36, 0.3, 0.76, 0.8, 0.85, 0.77], [2.395, 0.38, 0.66, 0.7, 0.76, 0.7]],
    glass: [-2.02, 1.14], mirror: 1.12,
    lights: [['white', 0.8, 0.022, 0, 0.82, 0], ['white', 0.7, 0.045, 0.56, 0.86, 0], ['red', 0.985, 0.03, 0, 0.9, 1]] },
  { id: 'semi', name: 'Semi', W: 2.6, L: 6.9, H: 3.98, R: 0.52, tw: 0.32, axles: [2.3], wmax: 1.295, rim: 4, paint: [0xe6e7e8, 0.05, 0.3], box: true, rearAxle: -2.4,
    phys: { mass: 9500, com: [0, 1.15, 0.9], I: [38000, 40000, 9500], kw: 800, F: 70000, mph: 65, cd: 3.4, steer: 30, cam: 1.9, rest: 0.42, travel: 0.17, seat: [0, 2.35, 1.8] },
    boxes: [[0, 2.25, 0.33, 1.3, 1.75, 1.58], [0, 1.8, 2.43, 1.28, 1.3, 0.52], [0, 1.08, 3.2, 1.24, 0.56, 0.25], [0, 0.8, -2.35, 1.15, 0.6, 1.1]],
    st: [[-1.25, 0.95, 3.6, 3.95, 1.26, 1.14], [-1.15, 0.7, 3.62, 3.97, 1.295, 1.18], [0.6, 0.62, 3.62, 3.98, 1.295, 1.18], [1.3, 0.6, 3.5, 3.86, 1.295, 1.17], [1.9, 0.58, 3.05, 3.4, 1.29, 1.16], [2.4, 0.56, 2.5, 2.85, 1.285, 1.15], [2.9, 0.54, 1.95, 2.25, 1.27, 1.14], [3.2, 0.52, 1.55, 1.85, 1.24, 1.12], [3.4, 0.55, 1.12, 1.38, 1.18, 1.06], [3.45, 0.66, 0.9, 1.05, 1.08, 0.98]],
    lights: [['white', 1.22, 0.035, 0, 1.05, 0], ['white', 1.08, 0.08, 0.8, 1.16, 0]] },
  { id: 'ct', name: 'Cybertruck', W: 2.16, L: 5.68, H: 1.79, R: 0.455, tw: 0.33, axles: [1.9, -1.9], wmax: 1.0, rim: 2,
    phys: { mass: 3100, com: [0, 0.72, 0], I: [6000, 6500, 1500], kw: 630, F: 32000, mph: 112, cd: 0.95, steer: 32, cam: 1.3, seat: [0.45, 1.0, 0.1] },
    boxes: [[0, 0.72, 0, 1.0, 0.3, 2.84], [0, 1.33, -0.15, 0.88, 0.32, 1.35], [0, 1.15, -2.15, 0.95, 0.14, 0.69], [0, 1.1, 1.95, 0.95, 0.1, 0.89]] },
  { id: 'cab', name: 'Cybercab', W: 2.0, L: 4.25, H: 1.34, R: 0.37, tw: 0.27, axles: [1.42, -1.42], wmax: 0.975, rim: 3, paint: [0xc9a46a, 0.62, 0.26],
    phys: { mass: 1700, com: [0, 0.48, 0], I: [2200, 2500, 560], kw: 170, F: 8500, mph: 85, cd: 0.55, steer: 36, cam: 1.0, seat: [0.42, 0.6, 0.0] },
    boxes: [[0, 0.52, 0, 0.98, 0.34, 2.12], [0, 1.08, -0.15, 0.72, 0.27, 1.35]],
    st: [[-2.125, 0.4, 0.84, 0.88, 0.8, 0.74], [-2.06, 0.3, 0.92, 0.98, 0.9, 0.83], [-1.92, 0.25, 0.94, 1.02, 0.95, 0.84], [-1.6, 0.21, 0.94, 1.08, 0.97, 0.8], [-1.2, 0.2, 0.92, 1.22, 0.975, 0.72], [-0.5, 0.2, 0.88, 1.34, 0.975, 0.68], [0.15, 0.2, 0.84, 1.32, 0.975, 0.7], [0.75, 0.2, 0.8, 1.12, 0.975, 0.76], [1.25, 0.2, 0.76, 0.9, 0.97, 0.82], [1.65, 0.22, 0.7, 0.76, 0.95, 0.84], [1.95, 0.25, 0.65, 0.69, 0.92, 0.84], [2.08, 0.29, 0.6, 0.63, 0.87, 0.79], [2.125, 0.36, 0.53, 0.56, 0.78, 0.72]],
    glass: [-1.5, 1.32],
    lights: [['white', 0.6, 0.025, 0, 0.86, 0], ['red', 0.9, 0.032, 0, 0.92, 1]] },
];

export const LINEUP = (() => {
  const GAP = 0.95, CX = 420, LINE = 0, FRONT = LINE - 2.6, Y0 = 0.1;
  const total = SPECS.reduce((a, s) => a + s.W, 0) + GAP * (SPECS.length - 1);
  let x = CX + total / 2;
  const cars = SPECS.map((s) => { const cx = x - s.W / 2; x -= s.W + GAP; return { id: s.id, name: s.name, W: s.W, L: s.L, x: cx, z: FRONT + s.L / 2, top: Y0 + s.H }; });
  const stage = { x0: CX - 10.5, x1: CX + 10.5, z0: FRONT - 0.7, z1: FRONT + 7.7, y: Y0 };
  return {
    cars, stage, line: LINE, y0: Y0, cx: CX,
    start: { p: [CX - 53, 0.05, LINE], yaw: PI / 2, foot: [CX - 55, 0, LINE - 2.6], footYaw: 0.9 },
    light: { pos: [CX, 22, LINE - 9], tgt: [CX, 0.5, LINE + 0.4], angle: 0.56, pen: 0.5, I: 3200 },
    towers: [[CX - 17, LINE - 27, 18, CX - 3, LINE + 1], [CX + 17, LINE - 27, 18, CX + 3, LINE + 1], [CX - 26, LINE + 31, 21, CX - 6, LINE - 14], [CX + 33, LINE + 36, 20, CX + 8, LINE - 14]],
    poles: [[CX - 62, LINE + 44], [CX - 14, LINE + 47], [CX + 34, LINE + 45], [CX + 82, LINE + 43]],
    lamps: (() => { const out = []; for (let x = 36; x <= CX - 80; x += 24) for (const z of [-13, 13]) out.push([x + (z > 0 ? 12 : 0), LINE + z]); return out; })(),
    near: (p) => Math.hypot(p.x - CX, p.z - LINE) < 220,
    corridor: (p) => Math.abs(p.z - LINE) < 9 && Math.abs(p.x - CX) < 90,
    approach: (p) => Math.abs(p.z - LINE) < 4.5 && ((p.x < stage.x0 && p.x > stage.x0 - 48) || (p.x > stage.x1 && p.x < stage.x1 + 48)),
    over(px, pz, m = 0.15) { for (let i = 0; i < cars.length; i++) { const c = cars[i]; if (Math.abs(px - c.x) < c.W / 2 + m && Math.abs(pz - c.z) < c.L / 2 + m) return i; } return -1; },
  };
})();

export const VEHICLES = SPECS.map((s) => s.id);

export function vehicleHull(i) {
  return SPECS[i].boxes.map(([x, y, z, hx, hy, hz]) => { const pts = []; for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) pts.push(x + a * hx, y + b * hy, z + c * hz); return new Float32Array(pts); });
}

export function wheelLayout(s) {
  const out = [], zs = s.id === 'semi' ? [[2.3, s.tw, 0], [-1.8, 0.56, 1], [-3.0, 0.56, 1]] : s.axles.map((z, k) => [z, s.tw, k]);
  const wm = s.id === 'ct' ? 0.905 + s.tw / 2 - 0.018 : s.wmax;
  for (const [z, tw, rear] of zs) for (const side of [1, -1]) out.push({ x: side * (s.id === 'semi' && rear ? 0.98 : wm + 0.018 - tw / 2), z, tw, side, phys: (rear ? 2 : 0) + (side > 0 ? 0 : 1) });
  return out;
}

export function vehicleTuning(base, i) {
  const s = SPECS[i], P = s.phys, T = JSON.parse(JSON.stringify(base)), m = P.mass / base.car.mass, L = wheelLayout(s);
  const zf = s.axles[0], zr = s.rearAxle ?? s.axles[1], tf = Math.abs(L[0].x) * 2, tr = Math.abs(L[L.length - 1].x) * 2;
  Object.assign(T.car, { mass: P.mass, com: P.com, inertia: { pitch: P.I[0], yaw: P.I[1], roll: P.I[2] }, wheelbase: zf - zr, axle_z: [zf, zr], track_front: tf, track_rear: tr, length: s.L, width: s.W, height: s.H });
  Object.assign(T.wheels, { radius_front: s.R, radius_rear: s.R, width_front: s.tw, width_rear: s.tw, inertia_each: base.wheels.inertia_each * m * (s.R / 0.355) ** 2, max_steer_deg: P.steer });
  const S = T.suspension;
  for (const k of ['spring_front', 'spring_rear', 'damper_bump', 'damper_rebound', 'antiroll_front', 'antiroll_rear', 'bump_stop_k']) S[k] *= m;
  if (P.rest) S.rest_length = P.rest; if (P.travel) S.travel = P.travel;
  Object.assign(T.powertrain, { max_power_kw: P.kw, max_wheel_force: P.F, limiter_mph: P.mph, regen_force: base.powertrain.regen_force * m, brake_force: base.powertrain.brake_force * m });
  T.aero.cd_a = P.cd; T.aero.lift_a = 0; T.aero.angular_drag = base.aero.angular_drag.map((v) => v * m);
  return T;
}

export function vehicleInfo(i) { const s = SPECS[i]; return { id: s.id, name: s.name, cam: s.phys.cam, seat: s.phys.seat, door: [s.wmax + 0.75, 0, s.phys.seat[2] + 0.2], r: Math.hypot(s.W / 2, s.L / 2) + 0.3, h: s.H }; }

export function lineupBoxes() {
  const out = [], S = LINEUP.stage;
  out.push([(S.x0 + S.x1) / 2, S.y / 2, (S.z0 + S.z1) / 2, (S.x1 - S.x0) / 2, S.y / 2, (S.z1 - S.z0) / 2]);
  for (const [x, z, h] of LINEUP.towers) out.push([x, h / 2, z, 0.3, h / 2, 0.3]);
  for (const [x, z] of LINEUP.poles) out.push([x, 5.5, z, 0.17, 5.5, 0.17]);
  return out;
}

function mono(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

function stations(table, step) {
  const zs = table.map((r) => r[0]), ch = [1, 2, 3, 4, 5].map((k) => mono(zs, table.map((r) => r[k])));
  const z0 = zs[0], z1 = zs[zs.length - 1], n = Math.max(8, Math.ceil((z1 - z0) / step)), out = [];
  for (let i = 0; i <= n; i++) { const z = z0 + (z1 - z0) * i / n; out.push({ z, yb: ch[0](z), ybelt: ch[1](z), yt: ch[2](z), w: ch[3](z), wt: ch[4](z) }); }
  return out;
}

function halfRing(s, box) {
  const { yb, ybelt, yt, w, wt } = s, h = Math.max(0.001, ybelt - yb), g = Math.max(0.001, yt - ybelt), ws = box ? w : 0.96 * w;
  const lo = box ? [[0, yb], [0.9 * w, yb], [w, yb + 0.07 * h], [w, yb + 0.5 * h], [w, yb + 0.92 * h], [ws, ybelt]] : [[0, yb], [0.86 * w, yb], [0.965 * w, yb + 0.1 * h], [w, yb + 0.48 * h], [0.99 * w, yb + 0.82 * h], [ws, ybelt]];
  const up = box ? [[lerp(ws, wt, 0.4), ybelt + 0.35 * g], [wt, ybelt + 0.8 * g], [wt * 0.96, ybelt + 0.97 * g], [wt * 0.55, yt], [0, yt]] : [[lerp(ws, wt, 0.38), ybelt + 0.3 * g], [lerp(ws, wt, 0.88), ybelt + 0.72 * g], [wt * 0.8, ybelt + 0.93 * g], [wt * 0.42, ybelt + 0.995 * g], [0, yt]];
  return lo.concat(up);
}

function hwAt(s, y, box) {
  if (y < s.yb || y > s.yt) return -1;
  const r = halfRing(s, box);
  for (let i = 1; i < r.length - 1; i++) { const a = r[i], b = r[i + 1]; if (y >= a[1] && y <= b[1]) return lerp(a[0], b[0], (y - a[1]) / Math.max(1e-6, b[1] - a[1])); }
  return 0;
}

function loft(S, box, isGlass) {
  const half = 11, R = 2 * half - 2, pos = [], idxB = [], idxG = [];
  const hi = (r) => (r <= half - 1 ? r : R - r);
  for (const s of S) { const h = halfRing(s, box); for (let r = 0; r < R; r++) { const p = h[hi(r)]; pos.push(r <= half - 1 ? p[0] : -p[0], p[1], s.z); } }
  const V = (i, r) => i * R + r;
  for (let i = 0; i < S.length - 1; i++) {
    const zc = (S[i].z + S[i + 1].z) / 2;
    for (let r = 0; r < R; r++) {
      const r1 = (r + 1) % R, a = V(i, r), b = V(i + 1, r), c = V(i + 1, r1), d = V(i, r1);
      const yc = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1] + pos[d * 3 + 1]) / 4;
      (isGlass(zc, yc, Math.min(hi(r), hi(r1)), S[i]) ? idxG : idxB).push(a, c, b, a, d, c);
    }
  }
  for (const [i, sgn] of [[0, -1], [S.length - 1, 1]]) {
    let cy = 0; for (let r = 0; r < R; r++) cy += pos[V(i, r) * 3 + 1]; cy /= R;
    const ci = pos.length / 3; pos.push(0, cy, S[i].z);
    for (let r = 0; r < R; r++) { const r1 = (r + 1) % R; if (sgn > 0) idxB.push(ci, V(i, r), V(i, r1)); else idxB.push(ci, V(i, r1), V(i, r)); }
  }
  const P = new THREE.Float32BufferAttribute(pos, 3);
  const full = new THREE.BufferGeometry(); full.setAttribute('position', P); full.setIndex(idxB.concat(idxG)); full.computeVertexNormals();
  const N = full.getAttribute('normal');
  const out = (idx) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', P.clone()); g.setAttribute('normal', N.clone()); g.setIndex(idx); return g.toNonIndexed(); };
  return { body: out(idxB), glass: idxG.length ? out(idxG) : null };
}

function edgeZ(S, y, ax, rear, box) {
  const n = S.length, zEnd = S[rear ? 0 : n - 1].z;
  for (let k = 0; k < n - 1; k++) {
    const i = rear ? k : n - 1 - k, j = rear ? k + 1 : n - 2 - k, a = hwAt(S[i], y, box), b = hwAt(S[j], y, box);
    if (Math.abs(S[j].z - zEnd) > 1.1) return null;
    if (a >= ax) return S[i].z;
    if (b >= ax) return lerp(S[i].z, S[j].z, clamp01((ax - Math.max(0, a)) / Math.max(1e-4, b - Math.max(0, a))));
  }
  return null;
}

function lightStrip(S, box, y, h, ax0, ax1, rear) {
  const pts = [], sg = rear ? -1 : 1, nx = Math.max(6, Math.ceil((ax1 - ax0) / 0.03));
  const addSide = (side) => { const row = []; for (let k = 0; k <= nx; k++) { const ax = ax0 + (ax1 - ax0) * k / nx, z = edgeZ(S, y, ax, rear, box); if (z === null) break; row.push(new THREE.Vector3(side * ax, y, z + sg * 0.006)); } return row; };
  if (ax0 <= 0.001) { const r = addSide(-1).reverse(), l = addSide(1); pts.push(...r, ...l.slice(1)); return [ribbon(pts, h, rear)]; }
  return [ribbon(addSide(1), h, rear), ribbon(addSide(-1), h, rear)];
}

function ribbon(pts, h, rear) {
  const pos = [], idx = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], t = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
    let n = new THREE.Vector3(t.z, 0, -t.x); if (n.z * (rear ? -1 : 1) < 0 && Math.abs(n.z) > 0.3) n.negate(); if (Math.abs(n.z) <= 0.3 && n.x * p.x < 0) n.negate();
    const q = p.clone().addScaledVector(n, 0.004);
    pos.push(q.x, q.y - h / 2, q.z, q.x, q.y + h / 2, q.z);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g.toNonIndexed();
}

function rimAtlas() {
  const C = 256, c = document.createElement('canvas'); c.width = C * 3; c.height = C * 2; const g = c.getContext('2d');
  const cell = (k, draw) => { g.save(); g.translate((k % 3) * C + C / 2, Math.floor(k / 3) * C + C / 2); draw(); g.restore(); };
  const disc = (r, col) => { g.fillStyle = col; g.beginPath(); g.arc(0, 0, r, 0, 2 * PI); g.fill(); };
  const spokes = (n, r0, r1, wa, wb, col, rot = 0) => { g.fillStyle = col; for (let i = 0; i < n; i++) { const a = rot + i * 2 * PI / n; g.beginPath(); g.moveTo(Math.cos(a - wa) * r0, Math.sin(a - wa) * r0); g.lineTo(Math.cos(a - wb) * r1, Math.sin(a - wb) * r1); g.lineTo(Math.cos(a + wb) * r1, Math.sin(a + wb) * r1); g.lineTo(Math.cos(a + wa) * r0, Math.sin(a + wa) * r0); g.closePath(); g.fill(); } };
  cell(0, () => { disc(126, '#202226'); disc(118, '#0b0c0e'); spokes(10, 22, 116, 0.12, 0.07, '#4a4f57'); disc(30, '#2c3036'); disc(10, '#8a9099'); });
  cell(1, () => { disc(126, '#1a1b1e'); disc(118, '#08090a'); spokes(5, 20, 118, 0.42, 0.2, '#25282d', 0.3); spokes(5, 60, 118, 0.08, 0.05, '#3b3f46', 0.65); disc(26, '#1e2024'); disc(8, '#7d838c'); });
  cell(2, () => { disc(126, '#17191c'); for (let i = 0; i < 24; i++) { g.rotate(2 * PI / 24); g.fillStyle = i % 2 ? '#2a2d32' : '#0d0e10'; g.beginPath(); g.moveTo(10, 0); g.lineTo(122, -22); g.lineTo(122, 8); g.closePath(); g.fill(); } disc(18, '#5b626b'); });
  cell(3, () => { const gr = g.createRadialGradient(-30, -40, 10, 0, 0, 126); gr.addColorStop(0, '#e9e4da'); gr.addColorStop(1, '#8f8a80'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 126, 0, 2 * PI); g.fill(); g.strokeStyle = '#2a2826'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 96, 0, 2 * PI); g.stroke(); disc(20, '#3a3835'); });
  cell(4, () => { disc(126, '#2b2d30'); const gr = g.createRadialGradient(-20, -30, 8, 0, 0, 112); gr.addColorStop(0, '#f4f6f8'); gr.addColorStop(0.7, '#a9adb3'); gr.addColorStop(1, '#6f747b'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 110, 0, 2 * PI); g.fill(); g.fillStyle = '#4a4e55'; for (let i = 0; i < 10; i++) { const a = i * 2 * PI / 10; g.beginPath(); g.arc(Math.cos(a) * 44, Math.sin(a) * 44, 6, 0, 2 * PI); g.fill(); } disc(26, '#d9dde2'); disc(12, '#5e636a'); });
  cell(5, () => disc(126, '#111'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function softRect() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = Math.abs((x + 0.5) / N * 2 - 1), v = Math.abs((y + 0.5) / N * 2 - 1), d = Math.pow(Math.pow(u, 6) + Math.pow(v, 6), 1 / 6);
    const a = 1 - clamp01((d - 0.62) / 0.38), i = (y * N + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255 * a * a; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

function prep(g, uv) {
  if (g.index) g = g.toNonIndexed();
  if (!uv && g.getAttribute('uv')) g.deleteAttribute('uv');
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  return g;
}

function wheelParts(s, add, place) {
  const zs = s.id === 'semi' ? [2.3] : s.axles;
  for (const z of zs) for (const side of [1, -1]) add('arch', place(new THREE.CircleGeometry(s.R + 0.07, 24, 0, PI).rotateY(side * PI / 2).translate(side * (s.wmax + 0.004), s.R, z)));
}

function wheelGeos(s) {
  const R = s.R, rimR = R * (s.id === 'semi' ? 0.62 : 0.74), k = R / 0.36;
  const prof = [[0.001, -0.15], [rimR * 0.97, -0.15], [rimR * 0.97, -0.4], [rimR, -0.43], [R * 0.9, -0.5], [R * 0.975, -0.47], [R, -0.37], [R, 0.37], [R * 0.975, 0.47], [R * 0.9, 0.5], [rimR, 0.43], [rimR * 0.97, 0.4], [rimR * 0.97, 0.15], [0.001, 0.15]];
  const tire = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32).rotateZ(PI / 2); tire.deleteAttribute('uv');
  const col = s.rim % 3, row = Math.floor(s.rim / 3), rings = [[0, -0.045], [0.25, -0.04], [0.34, -0.022], [0.9, -0.006], [0.97, 0], [1, -0.014]], seg = 32, pos = [], uv = [], idx = [];
  pos.push(0, 0, rings[0][1] * k); uv.push((col + 0.5) / 3, (1 - row) * 0.5 + 0.25);
  for (let r = 1; r < rings.length; r++) for (let i = 0; i < seg; i++) { const a = i / seg * 2 * PI, x = Math.cos(a) * rings[r][0], y = Math.sin(a) * rings[r][0]; pos.push(x * rimR, y * rimR, rings[r][1] * k); uv.push((col + 0.5 + x * 0.5) / 3, (1 - row) * 0.5 + (0.5 + y * 0.5) * 0.5); }
  for (let i = 0; i < seg; i++) idx.push(0, 1 + i, 1 + (i + 1) % seg);
  for (let r = 1; r < rings.length - 1; r++) for (let i = 0; i < seg; i++) { const a = 1 + (r - 1) * seg + i, b = 1 + (r - 1) * seg + (i + 1) % seg, c = a + seg, d = b + seg; idx.push(a, c, d, a, d, b); }
  const rim = new THREE.BufferGeometry(); rim.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rim.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rim.setIndex(idx); rim.computeVertexNormals();
  return { tire, rim };
}

function stAt(S, z) {
  let i = 0; while (i < S.length - 2 && S[i + 1].z < z) i++;
  const a = S[i], b = S[i + 1], t = clamp01((z - a.z) / Math.max(1e-6, b.z - a.z)), o = { z };
  for (const f of ['yb', 'ybelt', 'yt', 'w', 'wt']) o[f] = lerp(a[f], b[f], t);
  return o;
}

function sidePt(S, box, z, y, side) {
  const st = stAt(S, z), r = halfRing(st, box);
  for (let i = 0; i < r.length - 1; i++) { const a = r[i], b = r[i + 1]; if ((y - a[1]) * (y - b[1]) <= 0 && a[1] !== b[1] && a[0] > 0.05) { const t = (y - a[1]) / (b[1] - a[1]), nx = b[1] - a[1], ny = a[0] - b[0], l = Math.hypot(nx, ny) || 1; return { p: new THREE.Vector3(side * lerp(a[0], b[0], t), y, z), n: new THREE.Vector3(side * nx / l, ny / l, 0) }; } }
  return null;
}

function topPt(S, box, z, x) {
  const st = stAt(S, z), r = halfRing(st, box), ax = Math.abs(x);
  for (let i = 5; i < r.length - 1; i++) { const a = r[i], b = r[i + 1]; if (ax <= a[0] && ax >= b[0] && a[0] !== b[0]) { const t = (a[0] - ax) / (a[0] - b[0]), nx = b[1] - a[1], ny = a[0] - b[0], l = Math.hypot(nx, ny) || 1; return { p: new THREE.Vector3(x, lerp(a[1], b[1], t), z), n: new THREE.Vector3(Math.sign(x || 1) * nx / l, ny / l, 0) }; } }
  return null;
}

function seamLine(P, w = 0.011) {
  const pts = P.filter(Boolean); if (pts.length < 2) return null;
  const pos = [], idx = [], t = new THREE.Vector3(), b = new THREE.Vector3();
  pts.forEach(({ p, n }, i) => {
    t.subVectors(pts[Math.min(pts.length - 1, i + 1)].p, pts[Math.max(0, i - 1)].p).normalize(); b.crossVectors(n, t).normalize().multiplyScalar(w / 2);
    const q = p.clone().addScaledVector(n, 0.004); pos.push(q.x - b.x, q.y - b.y, q.z - b.z, q.x + b.x, q.y + b.y, q.z + b.z);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g.toNonIndexed();
}

const SEAMS = {
  m3: { cuts: [0.98, -0.12, -1.0], handles: [0.2, -0.82], hood: [0.56, 1.14, 2.06], trunk: [0.6, -1.62, -2.2] },
  my: { cuts: [0.93, -0.2, -1.1], handles: [0.12, -0.95], hood: [0.6, 1.2, 2.1] },
  cab: { cuts: [0.82, -0.78], hood: [0.58, 1.55, 1.98] },
};

function addSeams(s, S, add, place) {
  const D = SEAMS[s.id]; if (!D) return;
  const box = !!s.box, archTop = (z) => { let y = 0; for (const a of s.axles) { const d = z - a, ra = s.R + 0.09; if (Math.abs(d) < ra) y = Math.max(y, s.R + Math.sqrt(ra * ra - d * d)); } return y; };
  const line = (P) => { const g = seamLine(P); if (g) add('seam', place(g)); };
  for (const side of [1, -1]) {
    let lo = Infinity, hi = -Infinity;
    for (const z of D.cuts) {
      const st = stAt(S, z), y0 = Math.max(st.yb + 0.16 * (st.ybelt - st.yb), archTop(z) + 0.02), y1 = st.ybelt - 0.012, P = [];
      for (let k = 0; k <= 10; k++) P.push(sidePt(S, box, z, lerp(y0, y1, k / 10), side));
      line(P); lo = Math.min(lo, z); hi = Math.max(hi, z);
    }
    { const P = []; for (let k = 0; k <= 16; k++) { const z = lerp(lo, hi, k / 16), st = stAt(S, z); P.push(sidePt(S, box, z, st.yb + 0.16 * (st.ybelt - st.yb), side)); } line(P); }
    for (const z of D.handles || []) { const st = stAt(S, z), q = sidePt(S, box, z, st.ybelt - 0.075, side); if (q) add('trim', place(new THREE.BoxGeometry(0.012, 0.026, 0.15).translate(q.p.x + side * 0.002, q.p.y, z))); }
  }
  if (D.hood) {
    const [x, z0, z1] = D.hood;
    for (const sx of [x, -x]) { const P = []; for (let k = 0; k <= 12; k++) P.push(topPt(S, box, lerp(z0, z1, k / 12), sx)); line(P); }
    { const P = []; for (let k = 0; k <= 12; k++) P.push(topPt(S, box, z1, lerp(-x, x, k / 12))); line(P); }
  }
  if (D.trunk) {
    const [x, z0, z1] = D.trunk;
    for (const sx of [x, -x]) { const P = []; for (let k = 0; k <= 8; k++) P.push(topPt(S, box, lerp(z0, z1, k / 8), sx)); line(P); }
  }
}

const _wm = new THREE.Matrix4(), _wr = new THREE.Matrix4(), _wq = new THREE.Quaternion(), _we = new THREE.Euler(0, 0, 0, 'YXZ'), _wp = new THREE.Vector3(), _ws = new THREE.Vector3();
export class VehicleView {
  constructor(kit, parent, M) {
    this.kit = kit; this.root = new THREE.Group(); parent.add(this.root);
    for (const [key, { mat, geo }] of kit.body) { const m = new THREE.Mesh(geo, mat), lit = !mat.isMeshBasicMaterial && !mat.isShaderMaterial; m.castShadow = lit; m.receiveShadow = lit; m.name = kit.id + '_' + key; this.root.add(m); }
    const n = kit.wheels.length;
    this.tires = new THREE.InstancedMesh(kit.wheel.tire, M.tire, n); this.rims = new THREE.InstancedMesh(kit.wheel.rim, M.rim, n);
    this.tires.castShadow = true; this.tires.frustumCulled = false; this.rims.frustumCulled = false; this.root.add(this.tires, this.rims);
    this.shadow = new THREE.Mesh(kit.shadowGeo, M.shadow); this.shadow.renderOrder = 1; this.root.add(this.shadow);
  }

  pose(p, q, len, spin, steer, y0) {
    this.root.position.set(p[0], p[1], p[2]); this.root.quaternion.set(q[0], q[1], q[2], q[3]);
    this.kit.wheels.forEach((w, i) => {
      const k = w.phys, a = k < 2 ? steer[k] : 0, yc = y0[k] - len[k];
      _wq.setFromEuler(_we.set(spin[k], a, 0, 'YXZ'));
      _wm.compose(_wp.set(w.x, yc, w.z), _wq, _ws.set(w.tw, 1, 1)); this.tires.setMatrixAt(i, _wm);
      _wm.compose(_wp.set(w.x, yc, w.z), _wq, _ws.set(1, 1, 1)); _wr.makeRotationY(w.side * PI / 2).setPosition(w.side * (w.tw * 0.43 + 0.004), 0, 0); _wm.multiply(_wr); this.rims.setMatrixAt(i, _wm);
    });
    this.tires.instanceMatrix.needsUpdate = true; this.rims.instanceMatrix.needsUpdate = true;
    const upY = 1 - 2 * (q[0] * q[0] + q[2] * q[2]);
    this.shadow.visible = upY > 0.8 && p[1] < LINEUP.y0 + 0.6;
  }
}

function buildLoftCar(s, add, place, step) {
  const S = stations(s.st, step);
  const isGlass = s.id === 'semi'
    ? (z, y, h) => h >= 7 && z > 1.95 && z < 2.9
    : (z, y, h) => h >= 5 && z > s.glass[0] && z < s.glass[1];
  const { body, glass } = loft(S, !!s.box, isGlass);
  add('paint', place(body)); if (glass) add('glass', place(glass));
  for (const [mat, y, h, a0, a1, rear] of s.lights) for (const g of lightStrip(S, !!s.box, y, h, a0, a1, !!rear)) add(mat, place(g));
  if (s.intake) { const [y, h, a1] = s.intake; for (const g of lightStrip(S, !!s.box, y, h, 0, a1, false)) add('trim', place(g)); }
  if (s.mirror) for (const side of [1, -1]) {
    const st = S.reduce((b, q) => (Math.abs(q.z - s.mirror) < Math.abs(b.z - s.mirror) ? q : b), S[0]);
    add('paint', place(new THREE.BoxGeometry(0.17, 0.1, 0.09).translate(side * (st.w + 0.07), st.ybelt + 0.07, s.mirror)));
    add('trim', place(new THREE.BoxGeometry(0.1, 0.03, 0.05).translate(side * (st.w + 0.0), st.ybelt + 0.03, s.mirror + 0.02)));
  }
  if (s.id === 'semi') {
    const T = (g) => add('trim', place(g));
    T(new THREE.BoxGeometry(2.36, 0.24, 0.2).translate(0, 0.66, 3.36));
    for (const x of [-0.44, 0.44]) T(new THREE.BoxGeometry(0.22, 0.32, 2.3).translate(x, 0.98, -2.3));
    T(new THREE.BoxGeometry(1.7, 0.06, 2.05).translate(0, 1.17, -2.3));
    T(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 24).translate(0, 1.24, -2.35));
    T(new THREE.BoxGeometry(2.3, 0.16, 0.14).translate(0, 0.7, -3.43));
    for (const side of [1, -1]) {
      T(new THREE.BoxGeometry(0.62, 0.05, 2.35).translate(side * 0.98, 1.12, -2.4));
      T(new THREE.BoxGeometry(0.56, 0.6, 0.02).translate(side * 0.98, 0.52, -3.42));
      T(new THREE.BoxGeometry(0.36, 0.06, 0.07).translate(side * 1.46, 2.72, 2.58));
      T(new THREE.BoxGeometry(0.1, 0.3, 0.14).translate(side * 1.66, 2.72, 2.58));
      add('red', place(new THREE.BoxGeometry(0.2, 0.08, 0.02).translate(side * 0.9, 0.82, -3.51)));
    }
    for (const side of [1, -1]) {
      const pts = [[1.45, 2.12], [2.68, 2.12], [1.84, 3.12], [1.45, 3.12]], X = side * 1.299, pos = [];
      for (const k of side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) pos.push(X, pts[k][1], pts[k][0]);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); add('glass', place(g));
    }
    for (let k = 0; k < 5; k++) add('amber', place(new THREE.BoxGeometry(0.12, 0.05, 0.05).translate((k - 2) * 0.2, 3.47, 1.86)));
  }
  if (s.id === 'semi') {
    const L = (P) => { const g = seamLine(P); if (g) add('seam', place(g)); };
    for (const side of [1, -1]) {
      const at = (z, y) => sidePt(S, true, z, y, side), Z0 = 1.38, Z1 = 2.76, Y0 = 0.98, Y1 = 3.22, P = [];
      for (let k = 0; k <= 8; k++) P.push(at(Z0, lerp(Y0, Y1, k / 8)));
      for (let k = 1; k <= 8; k++) P.push(at(lerp(Z0, Z1, k / 8), Y1));
      L(P);
      { const Q = []; for (let k = 0; k <= 8; k++) Q.push(at(Z1, lerp(Y1, Y0, k / 8))); L(Q); }
      { const Q = []; for (let k = 0; k <= 8; k++) Q.push(at(lerp(Z0, Z1, k / 8), Y0)); L(Q); }
      { const Q = []; for (let k = 0; k <= 12; k++) Q.push(at(lerp(-1.2, Z0 - 0.08, k / 12), 1.05)); L(Q); }
      { const Q = []; for (let k = 0; k <= 10; k++) Q.push(at(Z0 - 0.08, lerp(1.05, 3.48, k / 10))); L(Q); }
      for (const [y, d] of [[0.64, 0.05], [0.84, 0.035]]) add('trim', place(new THREE.BoxGeometry(d * 2, 0.04, 0.82).translate(side * (1.27 + d), y, 2.08)));
      add('trim', place(new THREE.BoxGeometry(0.02, 0.04, 0.22).translate(side * 1.302, 1.9, 2.55)));
    }
  }
  addSeams(s, S, add, place);
  wheelParts(s, add, place);
  return S;
}

function buildCybertruck(s, add, place) {
  const topY = (z) => { const P = [[-2.84, 1.32], [-1.5, 1.62], [-0.2, 1.79], [1.25, 1.24], [2.84, 0.95]]; for (let i = 0; i < P.length - 1; i++) if (z <= P[i + 1][0]) return lerp(P[i][1], P[i + 1][1], (z - P[i][0]) / (P[i + 1][0] - P[i][0])); return 0.95; };
  const topW = (z) => (z >= 1.25 ? 0.95 : z >= -0.2 ? lerp(0.76, 0.95, (z + 0.2) / 1.45) : z >= -1.5 ? lerp(0.8, 0.76, (z + 1.5) / 1.3) : lerp(0.92, 0.8, (z + 2.84) / 1.34));
  const W0 = 1.0, FL = 0.42, BELT = 1.02, Z = [];
  for (let z = -2.84; z <= 2.841; z += 0.2) Z.push(+z.toFixed(3)); if (Z[Z.length - 1] < 2.84) Z.push(2.84);
  const ring = (z) => { const yt = topY(z), wt = topW(z), yb = Math.min(BELT, yt - 0.05); return [[-W0, FL, z], [W0, FL, z], [W0, yb, z], [wt, yt, z], [-wt, yt, z], [-W0, yb, z]]; };
  const B = { steel: [], glass: [], ton: [] };
  const tri = (arr, a, b, c, out) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]; const m = [(a[0] + b[0] + c[0]) / 3 - out[0], (a[1] + b[1] + c[1]) / 3 - out[1], (a[2] + b[2] + c[2]) / 3 - out[2]]; if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) arr.push(...a, ...c, ...b); else arr.push(...a, ...b, ...c); };
  const quad = (arr, a, b, c, d, out) => { tri(arr, a, b, c, out); tri(arr, a, c, d, out); };
  for (let i = 0; i < Z.length - 1; i++) {
    const A = ring(Z[i]), C = ring(Z[i + 1]), zc = (Z[i] + Z[i + 1]) / 2, ctr = [0, 1.0, zc], inCab = zc < 1.05 && zc > -1.45;
    quad(B.steel, A[0], C[0], C[1], A[1], ctr); quad(B.steel, A[1], C[1], C[2], A[2], ctr); quad(B.steel, A[5], A[0], C[0], C[5], ctr);
    quad(zc > -0.2 && zc < 1.25 ? B.glass : zc < -1.5 ? B.ton : B.steel, A[3], A[4], C[4], C[3], ctr);
    quad(inCab ? B.glass : B.steel, A[2], C[2], C[3], A[3], ctr); quad(inCab ? B.glass : B.steel, A[4], C[4], C[5], A[5], ctr);
  }
  for (const [z, sg] of [[2.84, 1], [-2.84, -1]]) { const r = ring(z), o = [0, 1.0, z - sg]; quad(B.steel, r[1], r[0], r[5], r[2], o); quad(B.steel, r[2], r[5], r[4], r[3], o); }
  const geo = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
  add('steel', place(geo(B.steel))); add('glass', place(geo(B.glass))); add('trim', place(geo(B.ton)));
  add('white', place(new THREE.BoxGeometry(1.86, 0.035, 0.03).translate(0, 0.99, 2.856)));
  add('red', place(new THREE.BoxGeometry(1.7, 0.04, 0.03).translate(0, 1.06, -2.856)));
  add('trim', place(new THREE.BoxGeometry(1.96, 0.36, 0.16).translate(0, 0.6, 2.86)));
  { const sg = (P) => { const g = seamLine(P.map((p) => ({ p: new THREE.Vector3(...p), n: new THREE.Vector3(p[3], p[4], 0) }))); if (g) add('seam', place(g)); };
    for (const sd of [1, -1]) for (const [z, y0] of [[1.02, 0.5], [-0.12, 0.5], [-1.22, 0.56]]) { const P = []; for (let k = 0; k <= 4; k++) P.push([sd * W0, lerp(y0, BELT - 0.02, k / 4), z, sd, 0]); sg(P); }
    for (const sd of [1, -1]) { const P = []; for (let k = 0; k <= 10; k++) { const z = lerp(1.3, 2.62, k / 10); P.push([sd * 0.86, topY(z), z, 0, 1]); } sg(P); }
    { const P = []; for (let k = 0; k <= 10; k++) P.push([lerp(-0.86, 0.86, k / 10), topY(2.62), 2.62, 0, 1]); sg(P); }
    for (const sd of [1, -1]) { const P = []; for (let k = 0; k <= 8; k++) { const z = lerp(-1.52, -2.8, k / 8); P.push([sd * 0.86, topY(z), z, 0, 1]); } sg(P); } }
  for (const sd of [1, -1]) {
    add('trim', place(new THREE.BoxGeometry(0.07, 0.14, 3.2).translate(sd * (W0 + 0.01), 0.47, 0)));
    for (const z of [1.9, -1.9]) {
      const sh = new THREE.Shape(); sh.moveTo(-0.66, 0.3); sh.lineTo(-0.5, 1.0); sh.lineTo(0.5, 1.0); sh.lineTo(0.66, 0.3); sh.closePath();
      const hole = new THREE.Path(); hole.moveTo(-0.56, 0.3); hole.lineTo(-0.43, 0.9); hole.lineTo(0.43, 0.9); hole.lineTo(0.56, 0.3); hole.closePath(); sh.holes.push(hole);
      add('trim', place(new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false }).rotateY(sd * PI / 2).translate(sd * (W0 - 0.005), 0, z)));
    }
  }
  wheelParts({ ...s, wmax: 0.905 + s.tw / 2 - 0.018 }, add, place);
}

export function buildLineup(scene, Q) {
  const HI = Q.lights === 'high', step = Q.low ? 0.11 : 0.07;
  const paints = new Map();
  const M = {
    glass: new THREE.MeshStandardMaterial({ color: 0x262c35, roughness: 0.1, metalness: 0.85, envMapIntensity: 1.2 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.82, metalness: 0 }),
    seam: new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: 'varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vD; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, 0.8 * smoothstep(17.0, 6.0, vD)); }' }),
    trim: new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.5, metalness: 0.3, envMapIntensity: 0.6 }),
    arch: new THREE.MeshBasicMaterial({ color: 0x020202 }),
    rim: new THREE.MeshStandardMaterial({ map: rimAtlas(), roughness: 0.32, metalness: 0.75, envMapIntensity: 0.95 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb4b9c0, metalness: 0.9, roughness: 0.34, envMapIntensity: 1.0 }),
    white: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.2, 3.5), side: THREE.DoubleSide }),
    red: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.07, 0.05), side: THREE.DoubleSide }),
    amber: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 1.15, 0.12), side: THREE.DoubleSide }),
  };
  const paint = ([hex, metal, rough]) => HI ? new THREE.MeshPhysicalMaterial({ color: hex, metalness: metal, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1 }) : new THREE.MeshStandardMaterial({ color: hex, metalness: metal, roughness: rough, envMapIntensity: 1.05 });
  const root = new THREE.Group(); scene.add(root);
  M.shadow = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: softRect(), transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const kits = SPECS.map((s) => {
    const B = new Map(), place = (g) => g;
    if (s.paint) paints.set(s.id, paint(s.paint));
    const add = (key, g, uv) => { const k = key === 'paint' ? 'paint_' + s.id : key; if (!B.has(k)) B.set(k, { mat: key === 'paint' ? paints.get(s.id) : M[key], geos: [] }); B.get(k).geos.push(prep(g, !!uv)); };
    if (s.id === 'ct') buildCybertruck(s, add, place); else buildLoftCar(s, add, place, step);
    const body = new Map(); for (const [k, { mat, geos }] of B) body.set(k, { mat, geo: mergeGeometries(geos, false) });
    return { id: s.id, spec: s, body, wheels: wheelLayout(s), wheel: wheelGeos(s), shadowGeo: new THREE.PlaneGeometry(s.wmax * 2 + 0.55, s.L + 0.45).rotateX(-PI / 2).translate(0, 0.004, 0) };
  });
  const views = kits.map((k, i) => { const v = new VehicleView(k, root, M), c = LINEUP.cars[i]; v.pose([c.x, LINEUP.y0, c.z], [0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0], [k.spec.R, k.spec.R, k.spec.R, k.spec.R]); return v; });

  const S = LINEUP.stage, sx = S.x1 - S.x0, sz = S.z1 - S.z0, cxS = (S.x0 + S.x1) / 2, czS = (S.z0 + S.z1) / 2;
  const stageM = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.34, metalness: 0.4, envMapIntensity: 0.55 });
  const stage = new THREE.Mesh(new THREE.BoxGeometry(sx, S.y, sz).translate(cxS, S.y / 2, czS), stageM); stage.receiveShadow = true; root.add(stage);
  const ledM = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uHead: { value: -1e3 }, uHeadOn: { value: 0 }, uFlash: { value: 0 }, uChase: { value: 0 } },
    vertexShader: 'attribute float aS; varying float vS; void main(){ vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uHead, uHeadOn, uFlash, uChase; varying float vS;
void main(){ float px = fract(vS / 0.08); float pix = smoothstep(0.0, 0.25, px) * smoothstep(1.0, 0.75, px);
  float ch = uChase * pow(0.5 + 0.5 * sin(vS * 0.9 - uT * 9.0), 8.0);
  float d = vS - uHead; float head = uHeadOn * exp(-d * d * 0.35) * 1.6;
  vec3 red = vec3(1.0, 0.08, 0.07) * 2.3 * (0.55 + 0.45 * pix) * (1.0 + ch * 2.0);
  vec3 wht = vec3(1.0, 0.92, 0.88) * 8.0 * (head + uFlash) * (0.6 + 0.4 * pix);
  gl_FragColor = vec4(red + wht, 1.0); }` });
  const leds = [];
  const strip = (x0, x1, z, y0, y1, flat) => {
    const n = Math.max(1, Math.ceil((x1 - x0) / 0.5)), pos = [], as = [], idx = [];
    for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n); if (flat) pos.push(x, 0.006, z - 0.03, x, 0.006, z + 0.03); else pos.push(x, y0, z, x, y1, z); as.push(x, x); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(as, 1)); g.setIndex(idx); leds.push(g.toNonIndexed());
  };
  strip(S.x0, S.x1, S.z0 - 0.003, 0.025, 0.075); strip(S.x0, S.x1, S.z1 + 0.003, 0.025, 0.075);
  for (const z of [S.z0 - 0.003, S.z1 + 0.003]) { strip(S.x0 - 24, S.x0 - 0.4, z, 0, 0, true); strip(S.x1 + 0.4, S.x1 + 24, z, 0, 0, true); }
  { const lm = new THREE.Mesh(mergeGeometries(leds, false), ledM); root.add(lm); }

  const poleM = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.5, metalness: 0.7 }), woodM = new THREE.MeshStandardMaterial({ color: 0x2a2219, roughness: 0.9 }), wireM = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.6, metalness: 0.3 });
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5.1, 5.4) }), hazes = [];
  for (const [x, z, h, ax, az] of LINEUP.towers) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, h, 12), poleM); pole.position.set(x, h / 2, z); root.add(pole);
    const head = new THREE.Group(); head.position.set(x, h + 0.6, z); head.lookAt(ax, 1, az); root.add(head);
    head.add(new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.7, 0.3), poleM));
    const gs = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) gs.push(new THREE.CircleGeometry(0.24, 18).translate(-1.1 + i * 0.733, -0.38 + j * 0.76, 0.16));
    head.add(new THREE.Mesh(mergeGeometries(gs), lampM));
    const to = new THREE.Vector3(ax, 0.5, az), from = head.position.clone(), len = from.distanceTo(to) * 0.95;
    const hm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { uI: { value: 0.012 }, uC: { value: new THREE.Color(0xdfe8ff) } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uI; uniform vec3 uC; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uC * uI * e * pow(vUv.y, 2.2), 1.0); }' });
    const cg = new THREE.CylinderGeometry(0.5, len * Math.tan(0.24) * 0.85, len, 24, 1, true).translate(0, -len / 2, 0), cone = new THREE.Mesh(cg, hm);
    cone.position.copy(from); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize()); cone.renderOrder = 4; cone.frustumCulled = false; root.add(cone); hazes.push(hm);
  }
  { const P = LINEUP.poles, arms = [-1.0, 0, 1.0], wires = [];
    for (const [x, z] of P) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 11, 10), woodM); p.position.set(x, 5.5, z); root.add(p);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.12), woodM); arm.position.set(x, 10.4, z); root.add(arm);
    }
    const span = (a, b) => { for (const o of arms) { const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(lerp(a[0], b[0], t) + o, 10.55 - 1.3 * 4 * t * (1 - t), lerp(a[1], b[1], t))); } wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.022, 4)); } };
    for (let i = 0; i < P.length - 1; i++) span(P[i], P[i + 1]);
    span([P[0][0] - 60, P[0][1] - 2], P[0]); span(P[P.length - 1], [P[P.length - 1][0] + 60, P[P.length - 1][1] - 3]);
    root.add(new THREE.Mesh(mergeGeometries(wires), wireM)); }
  const props = [];
  { const Lm = LINEUP.lamps, n = Lm.length, m4 = new THREE.Matrix4(), sodium = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.4, 1.3) });
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 9, 8).translate(0, 4.5, 0), poleM, n), arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 1.7).translate(0, 8.95, 0.75), poleM, n), heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.12, 0.32).translate(0, 8.86, 1.45), sodium, n);
    const pc = document.createElement('canvas'); pc.width = pc.height = 128; const g = pc.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,175,100,0.3)'); gr.addColorStop(0.35, 'rgba(255,150,70,0.13)'); gr.addColorStop(0.7, 'rgba(255,130,50,0.04)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const poolM = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); poolM.map.colorSpace = THREE.SRGBColorSpace;
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13).rotateX(-PI / 2), poolM, n);
    const hidePool = new THREE.Matrix4().makeScale(0, 0, 0);
    Lm.forEach(([x, z], i) => {
      const yaw = z > LINEUP.line ? PI : 0; m4.makeRotationY(yaw).setPosition(x, 0, z); posts.setMatrixAt(i, m4); arms.setMatrixAt(i, m4); heads.setMatrixAt(i, m4);
      const pm = new THREE.Matrix4().makeTranslation(x, 0.012, z + (z > LINEUP.line ? -1.45 : 1.45)); pools.setMatrixAt(i, pm);
      props.push({ inst: [posts, arms, heads], i, shapes: [['cyl', 4.5, 0.12, 0, 4.5, 0], ['box', 0.25, 0.08, 1.0, 0, 8.9, 1.1]], mass: 120, p: new THREE.Vector3(x, 0, z), q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
        onMove: (pp, upv) => { pools.setMatrixAt(i, upv.y > 0.97 ? pm : hidePool); pools.instanceMatrix.needsUpdate = true; } });
    });
    for (const im of [posts, arms, heads, pools]) { im.computeBoundingSphere(); im.boundingSphere.radius += 30; root.add(im); } pools.renderOrder = 1; }

  const rigM = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.5, metalness: 0.6 }), rigs = [];
  for (const end of [-1, 1]) {
    const x = end < 0 ? S.x0 - 1.7 : S.x1 + 1.7, z = S.z1 - 1.4, g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.36, 2.4), rigM); base.position.y = 0.18; base.castShadow = true; g.add(base);
    const lens = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.2, 0.22) }), dirs = [];
    for (let k = 0; k < 3; k++) {
      const d = new THREE.Vector3(end * 0.55, 1, (k - 1) * 0.35).normalize(), tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.7, 14), rigM);
      const p = new THREE.Vector3(0, 0.62, (k - 1) * 0.75); tube.position.copy(p); tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); g.add(tube);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(0.11, 14), lens); cap.position.copy(p).addScaledVector(d, 0.352); cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); g.add(cap);
      dirs.push({ p: p.clone().addScaledVector(d, 0.4), d });
    }
    rigs.push({ end, lens, dirs, fire: -1, g });
    props.push({ g, shapes: [['box', 0.5, 0.18, 1.2, 0, 0.18, 0], ['box', 0.35, 0.3, 1.05, 0, 0.66, 0]], mass: 120, p: g.position.clone(), q: g.quaternion.clone() });
  }

  const st = { was: false, head: 0, headX: -1e3, flash: 0, chase: 0, dir: 1 };
  const c = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3();
  const lit = [M.glass, M.tire, M.trim, M.rim, M.steel, stageM, ...paints.values()];
  const L = {
    root, ledM, props, kits, views, M,
    spawnView(i, parent) { return new VehicleView(kits[i], parent || scene, M); },
    hull: (i) => vehicleHull(i),
    wheelY: (i) => { const R = SPECS[i].R; return [R + 1, R + 1, R + 1, R + 1]; },
    makeEnv(renderer) {
      const es = new THREE.Scene(); es.background = new THREE.Color(0x000000);
      const panel = (w, h, pos, col, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...(look || [0, 0, 0])); es.add(m); };
      panel(16, 3.2, [0, 9, 1], new THREE.Color(1.6, 1.62, 1.7));
      panel(6, 1.2, [0, 8.6, -4], new THREE.Color(0.9, 0.92, 1.0));
      for (const x of [-9, 9]) panel(2.2, 1.6, [x, 2.6, -11], new THREE.Color(4.0, 4.1, 4.4));
      panel(3, 2, [2, 3.2, 13], new THREE.Color(3.0, 3.3, 3.4));
      panel(60, 0.14, [0, -0.5, -12], new THREE.Color(2.2, 0.05, 0.04));
      panel(60, 0.14, [0, -0.5, 12], new THREE.Color(1.6, 0.04, 0.03));
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.018, 0.018, 0.02) })); fl.position.y = -1.2; es.add(fl);
      const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(es, 0.02).texture; pm.dispose();
      for (const m of lit) m.envMap = env;
      M.glass.envMapIntensity = 1.2; M.steel.envMapIntensity = 1.0; M.rim.envMapIntensity = 0.8; stageM.envMapIntensity = 0.5;
      for (const m of paints.values()) m.envMapIntensity = 0.9;
      return env;
    },
    reset() { st.was = false; st.head = 0; st.flash = 0; st.chase = 0; for (const r of rigs) r.fire = -1; },
    update(dt, te, P, smoke, spot) {
      q.set(P.q[0], P.q[1], P.q[2], P.q[3]); up.set(0, 1, 0).applyQuaternion(q); c.set(P.p[0], P.p[1], P.p[2]).addScaledVector(up, 0.55);
      const air = P.contact[0] + P.contact[1] + P.contact[2] + P.contact[3] === 0;
      const inX = c.x > S.x0 - 0.5 && c.x < S.x1 + 0.5, inZ = c.z > S.z0 - 2.5 && c.z < S.z1 + 2.5;
      const over = air && inX && inZ && c.y > 2.0;
      if (over) { st.head = Math.min(1, st.head + dt * 6); st.headX = c.x; st.was = true; st.dir = Math.sign(P.vx) || 1; }
      else st.head = Math.max(0, st.head - dt * 2.5);
      if (st.was && !over) {
        if (air && inZ && !inX && (c.x < S.x0 ? -1 : 1) === st.dir) { st.flash = 1; st.chase = 1; const r = rigs.find((g) => g.end === st.dir); if (r) r.fire = 0; }
        st.was = false;
      }
      st.flash = Math.max(0, st.flash - dt * 1.6); st.chase = Math.max(0, st.chase - dt * 0.35);
      const U = ledM.uniforms; U.uT.value = te; U.uHead.value = st.headX; U.uHeadOn.value = st.head; U.uFlash.value = st.flash * st.flash; U.uChase.value = Math.min(1, st.chase * 2);
      for (const r of rigs) {
        const on = r.fire >= 0 && r.fire < 0.9;
        r.lens.color.setRGB(on ? 14 : 0.2, on ? 14 : 0.2, on ? 13 : 0.22);
        if (r.fire >= 0) {
          if (smoke && r.fire < 0.55) {
            const n = Math.round(dt * (smoke.N > 1000 ? 150 : 55));
            for (let k = 0; k < n; k++) { const o = r.dirs[k % 3], rnd = () => smoke.rnd(), wp = o.p.clone().applyMatrix4(r.g.matrixWorld), wd = o.d.clone().transformDirection(r.g.matrixWorld); const v = wd.multiplyScalar(9 + 7 * rnd()).add(new THREE.Vector3((rnd() - 0.5) * 2.5, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2.5)); smoke.emit(wp, v, { life: 4 + 3 * rnd(), s0: 0.6 + 0.5 * rnd(), grow: 3.2 + 2.4 * rnd(), k: 1.3, a: 0.2, buoy: 0.35 }); }
          }
          r.fire += dt; if (r.fire > 1.2) r.fire = -1;
        }
      }
      if (spot) spot.intensity = LINEUP.light.I * (1 + 1.6 * st.flash);
      for (const h of hazes) h.uniforms.uI.value = 0.012 * (1 + 1.2 * st.flash);
    },
  };
  return L;
}
