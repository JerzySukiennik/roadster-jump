// Roadster Jump smoke: live tyre smoke, landing bursts, cold-gas vapour and ground billows as instanced camera-facing sprites with the Film14 "cauliflower" atlas (lit puffs with self-shadow from a density grid and forward scattering from the arena lights), emitted from the car pose so replays smoke the same way.
import * as THREE from 'three';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const hash = (n) => { const s = Math.sin(n * 91.7 + 13.1) * 43758.5453; return s - Math.floor(s); };
const lerp = (a, b, t) => a + (b - a) * t;

function atlas() {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N);
  const vn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const h2 = (a, b) => hash(a * 157.1 + b * 311.7 + s); return lerp(lerp(h2(xi, yi), h2(xi + 1, yi), u), lerp(h2(xi, yi + 1), h2(xi + 1, yi + 1), u), v); };
  const M = 256, Lx = -0.45, Ly = 0.75, Lz = 0.5, Ll = Math.hypot(Lx, Ly, Lz);
  for (let q4 = 0; q4 < 4; q4++) {
    const ox = (q4 % 2) * M, oy = Math.floor(q4 / 2) * M, blobs = [];
    for (let k = 0; k < 16; k++) { const a = hash(q4 * 97 + k * 3.1) * Math.PI * 2, d = 0.5 * Math.sqrt(hash(q4 * 31 + k * 7.7)); const r = 0.16 + 0.26 * hash(q4 * 13 + k * 1.9) * (1 - d * 0.8); blobs.push([Math.cos(a) * d, Math.sin(a) * d * 0.85, r]); }
    const Hh = new Float32Array(M * M);
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      const px = (x - M / 2) / (M / 2), py = -(y - M / 2) / (M / 2); let h = 0;
      for (const [bx, by, br] of blobs) { const d2 = (px - bx) ** 2 + (py - by) ** 2; if (d2 < br * br) h = Math.max(h, Math.sqrt(br * br - d2)); }
      let f = 0, am = 0.5, fr = 4; for (let o = 0; o < 4; o++) { f += am * vn(x / M * fr, y / M * fr, q4 * 17 + o * 5); am *= 0.5; fr *= 2.2; }
      Hh[y * M + x] = h > 0 ? h + 0.05 * (f - 0.5) : 0;
    }
    for (let y = 1; y < M - 1; y++) for (let x = 1; x < M - 1; x++) {
      const h = Hh[y * M + x], i = ((oy + y) * N + ox + x) * 4;
      if (h <= 0) { im.data[i + 3] = 0; continue; }
      const dx = (Hh[y * M + x + 1] - Hh[y * M + x - 1]) * M / 4, dy = -(Hh[(y + 1) * M + x] - Hh[(y - 1) * M + x]) * M / 4;
      const nl = Math.hypot(dx, dy, 1), lam = Math.max(0, (-dx * Lx - dy * Ly + Lz) / nl / Ll);
      let f = 0, am = 0.5, fr = 6; for (let o = 0; o < 3; o++) { f += am * vn(x / M * fr, y / M * fr, q4 * 7 + o * 9 + 3); am *= 0.5; fr *= 2.3; }
      const shade = clamp01(0.28 + 0.72 * lam + 0.12 * (f - 0.5));
      const al = clamp01(h / 0.07) * clamp01(0.55 + (f - 0.45) * 1.8) * 0.95;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = 255 * shade; im.data[i + 3] = 255 * al;
    }
  }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

export class Smoke {
  constructor(scene, Q) {
    this.N = Q.low ? 700 : 2400;
    const N = this.N;
    this.P = Array.from({ length: N }, () => ({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, life: 1, s0: 1, grow: 1, k: 1.6, a: 0.2, buoy: 0.2, seed: 0, kind: 0, rot: 0 }));
    this.next = 0;
    const geo = new THREE.InstancedBufferGeometry(); const pq = new THREE.PlaneGeometry(1, 1);
    geo.index = pq.index; geo.setAttribute('position', pq.attributes.position); geo.setAttribute('uv', pq.attributes.uv);
    this.A = { pos: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3), col: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3), misc: new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4) };
    for (const k in this.A) this.A[k].setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', this.A.pos); geo.setAttribute('aCol', this.A.col); geo.setAttribute('aMisc', this.A.misc); geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTex: { value: atlas() } },
      vertexShader: `attribute vec3 aPos, aCol; attribute vec4 aMisc; varying vec2 vUv; varying vec3 vCol; varying float vA, vWY, vS, vVar, vD;
void main(){ vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(aMisc.z), s = sin(aMisc.z); vec2 p = position.xy; p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  vec3 wp = aPos + (right * p.x + up * p.y) * aMisc.x; vUv = uv; vCol = aCol; vA = aMisc.y; vWY = wp.y; vS = aMisc.x; vVar = aMisc.w; vD = -(viewMatrix * vec4(aPos, 1.0)).z;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
      fragmentShader: `uniform sampler2D uTex; varying vec2 vUv; varying vec3 vCol; varying float vA, vWY, vS, vVar, vD;
void main(){ float k = floor(vVar * 3.999); vec2 o = vec2(mod(k, 2.0), floor(k / 2.0)) * 0.5; vec4 t = texture2D(uTex, o + vUv * 0.5);
  if (vVar > 1.0) { float r = length(vUv - 0.5) * 2.0; t = vec4(0.8, 0.8, 0.8, exp(-r * r * 3.5) * (1.0 - smoothstep(0.85, 1.0, r))); }
  float a = t.a * vA * smoothstep(0.0, 0.35 * vS, vWY + 0.2) * smoothstep(0.6, 3.5 + 0.45 * vS, vD); if (a < 0.002) discard;
  gl_FragColor = vec4(vCol * (0.3 + 1.15 * t.r), a); }` });
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; scene.add(this.mesh);
    this.acc = new Float32Array(16); this.seed = 1; this.grid = new Map(); this.order = [];
    this.wind = new THREE.Vector3(0.32, 0, 0.12);
    this._v = new THREE.Vector3(); this._l = new THREE.Vector3(); this._d = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._f = new THREE.Vector3();
  }

  rnd() { return hash(this.seed++ * 1.618); }

  emit(p, v, o) {
    const q = this.P[this.next]; this.next = (this.next + 1) % this.N;
    q.alive = true; q.p.copy(p); q.v.copy(v); q.t = 0; q.life = o.life; q.s0 = o.s0; q.grow = o.grow; q.k = o.k ?? 1.6; q.a = o.a ?? 0.2; q.buoy = o.buoy ?? 0.22; q.seed = this.rnd() * 1000; q.kind = o.kind ?? 0; q.rot = (hash(q.seed * 0.37) - 0.5) * 0.7;
  }

  clear() { for (const q of this.P) q.alive = false; this.geo.instanceCount = 0; }

  fromCar(dt, P, view, events) {
    const rnd = () => this.rnd();
    const q = this._q.set(P.q[0], P.q[1], P.q[2], P.q[3]), pos = this._p.set(P.p[0], P.p[1], P.p[2]);
    const fwd = this._f.set(0, 0, 1).applyQuaternion(q), vel = this._d.set(P.vx, P.vy, P.vz);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const W = [[0.8, 1.4], [-0.8, 1.4], [0.8, -1.4], [-0.8, -1.4]];
    for (let i = 0; i < 4; i++) {
      if (!P.contact[i]) continue;
      const slip = Math.max(0, P.slip[i] - 3.5);
      if (slip <= 0) { this.acc[i] = 0; continue; }
      this.acc[i] += Math.min(60, slip * 9) * dt * (this.N > 1000 ? 1 : 0.45);
      while (this.acc[i] >= 1) {
        this.acc[i] -= 1;
        const p0 = new THREE.Vector3(W[i][0] + (rnd() - 0.5) * 0.2, 0.15 + 0.15 * rnd(), W[i][1] - 0.1 * rnd()).applyQuaternion(q).add(pos);
        const v0 = vel.clone().multiplyScalar(0.3).addScaledVector(fwd, -(1.5 + 2 * rnd())).add(new THREE.Vector3((rnd() - 0.5) * 3, 0.6 + 1.2 * rnd(), (rnd() - 0.5) * 3)).addScaledVector(up, 0.5);
        this.emit(p0, v0, { life: 3.5 + 3 * rnd(), s0: 0.5 + 0.35 * rnd(), grow: 1.8 + 1.8 * rnd() });
      }
    }
    if (events.land > 0) {
      const n = Math.round(Math.min(1, events.land) * (this.N > 1000 ? 260 : 90));
      for (let k = 0; k < n; k++) {
        const w = W[k % 4], p0 = new THREE.Vector3(w[0], 0.2 + 0.3 * rnd(), w[1]).applyQuaternion(q).add(pos);
        const dir = p0.clone().sub(pos).setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 1.8);
        const v0 = dir.multiplyScalar(4 + 8 * rnd()).add(new THREE.Vector3(0, 0.8 + 2.8 * rnd(), 0)).add(vel.clone().setY(0).multiplyScalar(0.45));
        this.emit(p0, v0, { life: 5 + 3 * rnd(), s0: 0.7 + 0.6 * rnd(), grow: 2.6 + 2.2 * rnd(), k: 1.2, a: 0.22 });
      }
    }
    for (let i = 0; i < 10; i++) {
      const k = P.valve[i];
      if (k < 0.05) continue;
      this.acc[4 + i] = (this.acc[4 + i] || 0) + k * dt * (this.N > 1000 ? 70 : 28);
      if (this.acc[4 + i] < 1) continue;
      const rig = view.nozzleRig[i], p0 = rig.ex.getWorldPosition(new THREE.Vector3());
      const d = new THREE.Vector3(-P.dir[i * 3], -P.dir[i * 3 + 1], -P.dir[i * 3 + 2]).applyQuaternion(q).normalize();
      while (this.acc[4 + i] >= 1) {
        this.acc[4 + i] -= 1;
        const v0 = d.clone().multiplyScalar(7 + 5 * rnd()).add(vel.clone().multiplyScalar(0.25)).add(new THREE.Vector3((rnd() - 0.5) * 2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2));
        this.emit(p0.clone().addScaledVector(d, 0.6), v0, { life: 0.7 + 0.6 * rnd(), s0: 0.6, grow: 2.2 + 1.2 * rnd(), k: 3.4, a: 0.08, buoy: 0.1, kind: 1 });
        const g = P.ground[i];
        if (d.y < -0.5 && g < 9 && rnd() < (1 - g / 9) * 0.6) {
          const hit = p0.clone().addScaledVector(d, g); hit.y += 0.3;
          const out = hit.clone().sub(pos).setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 2.4);
          this.emit(hit, out.multiplyScalar(5 + 6 * rnd()).add(new THREE.Vector3(0, 0.6 + rnd(), 0)).add(vel.clone().setY(0).multiplyScalar(0.4)), { life: 3.5 + 2.5 * rnd(), s0: 0.9, grow: 3.0 + 2.2 * rnd(), k: 1.1, a: 0.15, buoy: 0.3 });
        }
      }
    }
  }

  update(dt, cam, lights) {
    const N = this.N, out = this.order; out.length = 0;
    const W = this.wind;
    for (let i = 0; i < N; i++) {
      const q = this.P[i]; if (!q.alive) continue;
      q.t += dt; if (q.t >= q.life) { q.alive = false; continue; }
      const e = Math.exp(-q.k * dt);
      q.v.multiplyScalar(e);
      const s = q.seed, A = (0.18 + 0.16 * q.t) * (q.kind ? 0.4 : 1);
      q.p.x += (q.v.x + W.x + A * 1.3 * Math.cos(1.3 * q.t + s) * 0.6) * dt;
      q.p.z += (q.v.z + W.z + A * 1.7 * Math.cos(1.7 * q.t + s * 2.3) * 0.6) * dt;
      q.p.y += (q.v.y + q.buoy) * dt;
      const size = q.s0 + q.grow * (1 - Math.exp(-q.t / 1.5)) + 0.22 * q.t * (q.kind ? 0.3 : 1);
      if (q.p.y < size * 0.32 && q.p.y < 1.2) q.p.y = Math.max(q.p.y, size * 0.32);
      const alpha = q.a * sm(q.t / (0.12 + 0.1 * q.kind)) * (1 - sm((q.t - q.life * 0.35) / (q.life * 0.65)));
      if (alpha < 0.004) continue;
      q.size = size; q.alpha = alpha;
      out.push(q);
    }
    const n = out.length, G = this.grid; G.clear();
    const key = (p) => (Math.floor(p.x / 1.4) + 500) * 1e6 + (Math.floor(p.y / 1.4) + 50) * 1e3 + (Math.floor(p.z / 1.4) + 500);
    for (const q of out) { const k = key(q.p); G.set(k, (G.get(k) || 0) + q.alpha * 3); }
    const fwd = this._f.set(0, 0, -1).applyQuaternion(cam.quaternion), cp = cam.position;
    for (const q of out) q.depth = this._d.copy(q.p).sub(cp).dot(fwd);
    out.sort((a, b) => b.depth - a.depth);
    const Ap = this.A.pos.array, Ac = this.A.col.array, Am = this.A.misc.array;
    for (let j = 0; j < n; j++) {
      const q = out[j], p = q.p;
      const dens = (G.get(key(p)) || 0) + 0.7 * (G.get(key(this._v.set(p.x, p.y + 1.4, p.z))) || 0), shade = Math.exp(-0.085 * dens);
      const vv = this._v.copy(cp).sub(p).normalize();
      let r = 0.012, g = 0.013, b = 0.018;
      for (const L of lights) {
        const I = L.obj ? L.obj.intensity : L.I; if (I <= 0) continue;
        const lp = L.wpos || L.pos, l = this._l.copy(p).sub(lp); const d2 = Math.max(1.0, l.lengthSq()), d = Math.sqrt(d2); l.multiplyScalar(1 / d);
        let e = I / d2;
        if (L.type === 'spot') { const ca = l.dot(L.wdir || L.dir); e *= sm((ca - L.cos0) / Math.max(1e-3, L.cos1 - L.cos0)); }
        else if (L.dist) { const f = clamp01(1 - Math.pow(d / L.dist, 4)); e *= f * f; }
        if (e < 1e-4) continue;
        const ph = (0.45 + 2.8 * Math.pow(Math.max(0, l.dot(vv)), 8)) * 0.085 * shade;
        r += L.col.r * e * ph; g += L.col.g * e * ph; b += L.col.b * e * ph;
      }
      if (q.kind) { r += 0.12; g += 0.26; b += 0.42; }
      Ap[j * 3] = p.x; Ap[j * 3 + 1] = p.y; Ap[j * 3 + 2] = p.z; Ac[j * 3] = r; Ac[j * 3 + 1] = g; Ac[j * 3 + 2] = b;
      Am[j * 4] = q.size; Am[j * 4 + 1] = q.alpha; Am[j * 4 + 2] = q.rot + q.t * 0.14 * (hash(q.seed) - 0.5); Am[j * 4 + 3] = q.kind ? 1.5 : hash(q.seed * 1.3);
    }
    this.geo.instanceCount = n;
    if (n) for (const k in this.A) this.A[k].needsUpdate = true;
    return n;
  }
}
