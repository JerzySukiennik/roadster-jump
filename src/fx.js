// Roadster Jump ground marks and sparks: rubber laid down by slipping tyres on any surface (a ring buffer of quads oriented on the contact normal, darker the harder the tyre slides, uploaded only where new marks land) and spark showers where a hull hits or scrapes (thin additive streaks with gravity, a bounce on the tarmac and a cooling colour), both fed from the sim so they work for every car.
import * as THREE from 'three';

export class Marks {
  constructor(scene, N) {
    this.N = N; this.i = 0; this.last = new Map();
    const pos = new Float32Array(N * 12), a = new Float32Array(N * 4), idx = new Uint32Array(N * 6);
    for (let k = 0; k < N; k++) { const v = k * 4, o = k * 6; idx[o] = v; idx[o + 1] = v + 2; idx[o + 2] = v + 1; idx[o + 3] = v + 1; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
    const g = new THREE.BufferGeometry();
    this.P = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage); this.A = new THREE.BufferAttribute(a, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.P); g.setAttribute('aA', this.A); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.012, 0.012, 0.013, vA); }' });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; scene.add(this.mesh);
    this._d = new THREE.Vector3(); this._s = new THREE.Vector3(); this._n = new THREE.Vector3(); this.dirty = [];
  }

  add(key, p, n, width, k) {
    const L = this.last.get(key);
    if (!L) { this.last.set(key, { x: p.x, y: p.y, z: p.z, a: k }); return; }
    const d = this._d.set(p.x - L.x, p.y - L.y, p.z - L.z), len = d.length();
    if (len < 0.14) return;
    if (len > 2) { L.x = p.x; L.y = p.y; L.z = p.z; L.a = k; return; }
    const nn = this._n.set(n.x, n.y, n.z), s = this._s.crossVectors(nn, d).normalize().multiplyScalar(width / 2), lift = 0.012;
    const i = this.i, o = i * 12, P = this.P.array, A = this.A.array;
    const put = (j, x, y, z) => { P[o + j * 3] = x + nn.x * lift; P[o + j * 3 + 1] = y + nn.y * lift; P[o + j * 3 + 2] = z + nn.z * lift; };
    put(0, L.x - s.x, L.y - s.y, L.z - s.z); put(1, L.x + s.x, L.y + s.y, L.z + s.z); put(2, p.x - s.x, p.y - s.y, p.z - s.z); put(3, p.x + s.x, p.y + s.y, p.z + s.z);
    const a0 = Math.min(0.62, L.a * 0.62), a1 = Math.min(0.62, k * 0.62); A[i * 4] = A[i * 4 + 1] = a0; A[i * 4 + 2] = A[i * 4 + 3] = a1;
    this.dirty.push(i); this.i = (i + 1) % this.N;
    L.x = p.x; L.y = p.y; L.z = p.z; L.a = k;
  }

  lift(key) { this.last.delete(key); }

  flush() {
    if (!this.dirty.length) return;
    const lo = Math.min(...this.dirty), hi = Math.max(...this.dirty);
    if (hi - lo < this.N / 2) { this.P.addUpdateRange(lo * 12, (hi - lo + 1) * 12); this.A.addUpdateRange(lo * 4, (hi - lo + 1) * 4); }
    this.P.needsUpdate = true; this.A.needsUpdate = true; this.dirty.length = 0;
  }

  clear() { this.A.array.fill(0); this.A.needsUpdate = true; this.last.clear(); }
}

export class Sparks {
  constructor(scene, N) {
    this.N = N; this.next = 0; this.alive = 0;
    this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3); this.t = new Float32Array(N).fill(-1); this.life = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(N * 6), 3).setUsage(THREE.DynamicDrawUsage); this.col = new THREE.BufferAttribute(new Float32Array(N * 6), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos); g.setAttribute('color', this.col); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 8; scene.add(this.mesh);
    this.seed = 1;
  }

  rnd() { const s = Math.sin(this.seed++ * 12.9898) * 43758.5453; return s - Math.floor(s); }

  burst(x, y, z, vx, vy, vz, n, spread) {
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (i + 1) % this.N;
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
      this.v[i * 3] = vx * (0.4 + 0.5 * this.rnd()) + (this.rnd() - 0.5) * spread; this.v[i * 3 + 1] = vy * 0.3 + this.rnd() * spread * 0.8; this.v[i * 3 + 2] = vz * (0.4 + 0.5 * this.rnd()) + (this.rnd() - 0.5) * spread;
      this.t[i] = 0; this.life[i] = 0.35 + 0.6 * this.rnd();
    }
  }

  update(dt) {
    const P = this.pos.array, C = this.col.array; let n = 0;
    for (let i = 0; i < this.N; i++) {
      if (this.t[i] < 0) continue;
      this.t[i] += dt; if (this.t[i] > this.life[i]) { this.t[i] = -1; continue; }
      const o = i * 3, v = this.v;
      v[o + 1] -= 9.81 * dt; v[o] *= 1 - dt * 0.8; v[o + 2] *= 1 - dt * 0.8;
      this.p[o] += v[o] * dt; this.p[o + 1] += v[o + 1] * dt; this.p[o + 2] += v[o + 2] * dt;
      if (this.p[o + 1] < 0.02 && v[o + 1] < 0) { this.p[o + 1] = 0.02; v[o + 1] *= -0.35; v[o] *= 0.6; v[o + 2] *= 0.6; }
      const k = 1 - this.t[i] / this.life[i], L = 0.032, w = n * 6;
      P[w] = this.p[o]; P[w + 1] = this.p[o + 1]; P[w + 2] = this.p[o + 2];
      P[w + 3] = this.p[o] - v[o] * L; P[w + 4] = this.p[o + 1] - v[o + 1] * L; P[w + 5] = this.p[o + 2] - v[o + 2] * L;
      const r = 12 * k, gg = 6 * k * k, b = 2 * k * k * k;
      C[w] = r; C[w + 1] = gg; C[w + 2] = b; C[w + 3] = r * 0.3; C[w + 4] = gg * 0.2; C[w + 5] = 0;
      n++;
    }
    this.alive = n;
    this.mesh.geometry.setDrawRange(0, n * 2);
    if (n) { this.pos.needsUpdate = true; this.col.needsUpdate = true; }
  }

  clear() { this.t.fill(-1); this.mesh.geometry.setDrawRange(0, 0); }
}
