// Roadster Jump arena (from Film14): night tarmac, the white C-curl ramp with addressable red edge LEDs, a steel gantry with a moving-head rig, LED bar, red grandstand, floodlight towers, a parked semi, painted X lines and an event-driven light show.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RAMP, rampAt} from './ramp.js';
import {LINEUP} from './lineup.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const clamp01 = x => Math.min(1, Math.max(0, x));
const sm = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const seg = (x, a, b) => sm((x - a) / (b - a));
const hash = n => { const s = Math.sin(n * 91.7 + 13.1) * 43758.5453; return s - Math.floor(s); };
const lerp = (a, b, t) => a + (b - a) * t;
const pulse = (t, a, k) => t < a ? 0 : Math.min(1, (t - a) / 0.15) ** 2 * Math.exp(-(t - a) * k);
const EV0 = {RUN1: 8.4, TOP1: 13.0, HOLD1: 13.85, DOWN1: 18.3, RUN2: 18.55, LIP: 22.64, LAND: 25.48, carS: null};

function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function noiseFill(g, w, h, base, amp, cell, seed) {
  const im = g.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, n = (hash(x * 1.31 + y * 917.3 + seed) - 0.5) * amp + (hash(Math.floor(x / cell) * 7.1 + Math.floor(y / cell) * 131.3 + seed) - 0.5) * amp * 0.6;
    im.data[i] = base[0] + n; im.data[i + 1] = base[1] + n; im.data[i + 2] = base[2] + n; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
}
function blobs(g, w, h, n, seed, rgb, a0, a1, r0, r1) {
  for (let k = 0; k < n; k++) { const x = hash(k * 3.7 + seed) * w, y = hash(k * 9.1 + seed) * h, r = r0 + hash(k * 2.3 + seed) * (r1 - r0), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a0 + (a1 - a0) * hash(k * 5.9 + seed)})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
}
function quadStrip(list, A, B, front, attr) {
  const pos = [], uv = [], ex = [], idx = [];
  list.forEach(p => { pos.push(...A(p), ...B(p)); uv.push(0, p.s / 12.8, 1, p.s / 12.8); if (attr) ex.push(attr(p), attr(p)); });
  for (let i = 0; i < list.length - 1; i++) { const a = i * 2; if (front) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (attr) g.setAttribute('aS', new THREE.Float32BufferAttribute(ex, 1));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
const HAZE_V = 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
const HAZE_F = 'uniform float uI, uK; uniform vec3 uC; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float a = uI * e * pow(vUv.y, uK); gl_FragColor = vec4(uC * a, 1.0); }';
const hazeMat = (col, k) => new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: {uI: {value: 0}, uK: {value: k}, uC: {value: new THREE.Color(col)}}, vertexShader: HAZE_V, fragmentShader: HAZE_F});
const coneGeo = (len, r0, r1) => { const g = new THREE.CylinderGeometry(r0, r1, len, 24, 1, true); g.translate(0, -len / 2, 0); return g; };
const DOWN = V(0, -1, 0);
const lampGrid = (r, seg, nx, ny, x0, dx, y0, dy, z) => { const gs = []; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) gs.push(new THREE.CircleGeometry(r, seg).translate(x0 + i * dx, y0 + j * dy, z)); return mergeGeometries(gs); };

export function buildArena(scene, Q = {}) {
  const A = {lights: [], update: null};
  const HIGH = Q.lights !== 'low', SHADOW = Q.shadow || 1024;
  const TIER = {high: ['key', 'land', 'ceil', 'pad', 'flood0', 'flood1', 'flood2', 'rig0', 'rig1'], mid: ['key', 'land', 'ceil', 'pad', 'flood1'], low: ['key', 'land', 'ceil']}, MID = Q.lights === 'mid', real = k => (TIER[Q.lights] || TIER.mid).includes(k);
  const fake = I => Object.assign(new THREE.Object3D(), {intensity: I, target: new THREE.Object3D(), isFake: true});
  const R = RAMP, W2 = R.W / 2, TH = R.TH;
  scene.background = new THREE.Color(0x010102);
  scene.fog = new THREE.FogExp2(0x040509, 0.0042);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ vec3 d = normalize(vP); float y = max(d.y, 0.0); vec3 c = mix(vec3(0.012, 0.014, 0.02), vec3(0.0015, 0.0015, 0.003), pow(y, 0.3)); gl_FragColor = vec4(c, 1.0); }'}));
  sky.renderOrder = -10; scene.add(sky); A.sky = sky;

  const asph = canvasTex(1024, 1024, (g, w, h) => { noiseFill(g, w, h, [54, 55, 58], 20, 3, 1);
    blobs(g, w, h, 70, 11, '30,30,33', 0.04, 0.1, 30, 150); blobs(g, w, h, 30, 23, '96,96,98', 0.02, 0.05, 40, 120);
    g.strokeStyle = 'rgba(20,20,22,0.18)'; g.lineWidth = 1.5; for (let k = 0; k < 18; k++) { g.beginPath(); let x = hash(k * 5.3) * w, y = hash(k * 1.7) * h; g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (hash(k * 31 + s) - 0.5) * 90; y += (hash(k * 17 + s) - 0.3) * 90; g.lineTo(x, y); } g.stroke(); } });
  asph.repeat.set(176, 176);
  const rough = canvasTex(512, 512, (g, w, h) => { noiseFill(g, w, h, [240, 240, 240], 14, 24, 7); blobs(g, w, h, 40, 5, '222,222,222', 0.3, 0.5, 20, 90); }, false);
  rough.repeat.set(46, 46);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-PI / 2), HIGH ? new THREE.MeshPhysicalMaterial({map: asph, roughnessMap: rough, roughness: 1.0, metalness: 0.0, color: 0xffffff, envMapIntensity: 0.3, specularIntensity: 0.35}) : new THREE.MeshStandardMaterial({map: asph, roughnessMap: rough, roughness: 0.92, metalness: 0.0, color: 0xffffff, envMapIntensity: 0.3}));
  ground.receiveShadow = true; scene.add(ground);
  const lineTex = canvasTex(64, 1024, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); for (let k = 0; k < 200; k++) { g.fillStyle = `rgba(40,40,40,${0.2 + 0.45 * hash(k)})`; g.fillRect(hash(k * 3.3) * w, hash(k * 7.7) * h, 2 + 7 * hash(k * 1.1), 2 + 16 * hash(k * 2.2)); } });
  const paintM = new THREE.MeshStandardMaterial({map: lineTex, color: 0xb9babc, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, envMapIntensity: 0.4});
  { const pos = [], uv = [], idx = []; let n = 0;
    const quad = (ax, az, bx, bz, wd) => { const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), px = -dz / L * wd / 2, pz = dx / L * wd / 2;
      pos.push(ax + px, 0.004, az + pz, ax - px, 0.004, az - pz, bx + px, 0.004, bz + pz, bx - px, 0.004, bz - pz); uv.push(0, 0, 1, 0, 0, L / 6, 1, L / 6);
      idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); n += 4; };
    const XC = {x: -55, z: 2}, dA = V(XC.x + R.PAD, 0, XC.z).normalize(), aB = PI / 3;
    quad(-R.PAD - 0.2, 0, XC.x + dA.x * 70, XC.z + dA.z * 70, 0.16);
    quad(XC.x - Math.cos(aB) * 26, XC.z - Math.sin(aB) * 26, XC.x + Math.cos(aB) * 44, XC.z + Math.sin(aB) * 44, 0.16);
    const arc = (cx, cz, r, a0, a1, wd, dash) => { const n2 = Math.ceil(Math.abs(a1 - a0) * r / 1.5); for (let i = 0; i < n2; i++) { if (dash && i % 3 !== 0) continue; const u0 = a0 + (a1 - a0) * i / n2, u1 = a0 + (a1 - a0) * (i + (dash ? 1.4 : 1.02)) / n2; quad(cx + r * Math.cos(u0), cz + r * Math.sin(u0), cx + r * Math.cos(u1), cz + r * Math.sin(u1), wd); } };
    arc(30, 52, 44, PI * 1.02, PI * 1.5, 0.16, false); arc(30, 52, 38, PI * 1.03, PI * 1.48, 0.14, true); arc(30, 52, 50, PI * 1.05, PI * 1.45, 0.14, true);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, paintM); m.receiveShadow = true; scene.add(m);
    A.cross = V(XC.x, 0, XC.z); }
  { const pos = [], uv = [], idx = []; let n = 0;
    const strip = (x, z0, z1, w) => { pos.push(x - w / 2, 0.004, z0, x + w / 2, 0.004, z0, x - w / 2, 0.004, z1, x + w / 2, 0.004, z1); uv.push(0, 0, 1, 0, 0, (z1 - z0) / 6, 1, (z1 - z0) / 6); idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); n += 4; };
    const numM = d => { const t = canvasTex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 92px Helvetica, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${d}`, w / 2, h / 2 + 4); for (let k = 0; k < 120; k++) { g.clearRect(hash(k * 3.3 + d) * w, hash(k * 7.7 + d) * h, 1 + 3 * hash(k), 1 + 6 * hash(k * 2.2)); } }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return new THREE.MeshStandardMaterial({map: t, color: 0xb9babc, roughness: 0.6, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, envMapIntensity: 0.4}); };
    const basis = new THREE.Matrix4().makeBasis(V(0, 0, -1), V(-1, 0, 0), V(0, 1, 0)), qn = new THREE.Quaternion().setFromRotationMatrix(basis);
    for (const d of [25, 50, 75, 100, 150, 200, 250]) {
      const x = R.LIP_X - d;
      for (let z = -12; z < 12; z += 3) strip(x, z, z + 1.6, 0.14);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), numM(d)); m.position.set(x - 1.4, 0.006, -14.5); m.quaternion.copy(qn); m.receiveShadow = true; scene.add(m);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, paintM); m.receiveShadow = true; scene.add(m);
    const nL = 42, lm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.07, 0.28), new THREE.MeshBasicMaterial({color: new THREE.Color(2.0, 2.0, 2.2)}), nL), m4 = new THREE.Matrix4();
    for (let i = 0; i < nL; i++) { const k = i >> 1, x = -40 - k * 12.5, z = (i & 1 ? 1 : -1) * 16; m4.makeTranslation(x, 0.035, z); lm.setMatrixAt(i, m4); }
    scene.add(lm); }

  const deckTex = canvasTex(512, 2048, (g, w, h) => { noiseFill(g, w, h, [160, 161, 158], 16, 5, 3);
    blobs(g, w, h, 110, 41, '112,112,108', 0.08, 0.22, 20, 150); blobs(g, w, h, 60, 77, '214,214,208', 0.08, 0.2, 30, 140);
    for (let k = 0; k < 1600; k++) { g.fillStyle = `rgba(70,70,68,${0.2 + 0.4 * hash(k * 1.7)})`; const r = 0.6 + 1.6 * hash(k * 2.9); g.beginPath(); g.arc(hash(k * 4.4) * w, hash(k * 8.3) * h, r, 0, 2 * PI); g.fill(); }
    blobs(g, w, h, 40, 93, '95,95,92', 0.1, 0.2, 60, 220); blobs(g, w, h, 30, 117, '200,200,196', 0.06, 0.14, 80, 240);
    g.fillStyle = 'rgba(78,78,76,0.3)'; for (let j = 0; j < 4; j++) g.fillRect(0, j * h / 4, w, 2);
    g.fillStyle = '#f2f2ef'; g.fillRect(w / 2 - 7, 0, 15, h);
    for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(120,120,118,${0.2 + 0.4 * hash(k * 6.1)})`; g.fillRect(w / 2 - 7 + hash(k * 2.2) * 15, hash(k * 9.9) * h, 2 + 4 * hash(k), 2 + 8 * hash(k * 3)); }
    const eg = g.createLinearGradient(0, 0, w, 0); eg.addColorStop(0, 'rgba(60,60,60,0.35)'); eg.addColorStop(0.03, 'rgba(60,60,60,0)'); eg.addColorStop(0.97, 'rgba(60,60,60,0)'); eg.addColorStop(1, 'rgba(60,60,60,0.35)'); g.fillStyle = eg; g.fillRect(0, 0, w, h);
  });
  const deckM = new THREE.MeshStandardMaterial({map: deckTex, roughness: 0.8, metalness: 0, envMapIntensity: 0.45, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4});
  const backM = new THREE.MeshStandardMaterial({color: 0x1b1c1f, roughness: 0.65, metalness: 0.5});
  const sideM = new THREE.MeshStandardMaterial({color: 0x9b9c99, roughness: 0.75, metalness: 0});
  const NS = Math.ceil((R.S4 + R.PAD) / 0.1), prof = [];
  for (let i = 0; i <= NS; i++) { const s = -R.PAD + (R.S4 + R.PAD) * i / NS, r = rampAt(s); prof.push({s, x: r.x, y: r.y, nx: -Math.sin(r.a), ny: Math.cos(r.a)}); }
  const curve = prof.filter(p => p.s >= -0.05);
  const at = (p, d, z) => [p.x + p.nx * d, p.y + p.ny * d, z];
  { const top = new THREE.Mesh(quadStrip(prof, p => at(p, 0, -W2), p => at(p, 0, W2), true), deckM); top.receiveShadow = true; top.castShadow = true; scene.add(top); A.deck = top;
    const back = new THREE.Mesh(quadStrip(curve, p => at(p, -TH, -W2), p => at(p, -TH, W2), false), backM); back.castShadow = true; back.receiveShadow = true; scene.add(back);
    for (const z of [-W2, W2]) { const sd = new THREE.Mesh(quadStrip(curve, p => at(p, 0, z), p => at(p, -TH, z), z > 0), sideM); sd.castShadow = true; sd.receiveShadow = true; scene.add(sd); }
    const L = curve[curve.length - 1], g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...at(L, 0, -W2), ...at(L, 0, W2), ...at(L, -TH, -W2), ...at(L, -TH, W2)], 3)); g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals();
    const cap = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color: 0x2a2b2e, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide})); scene.add(cap); }

  const ledM = new THREE.ShaderMaterial({side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -12, uniforms: {uT: {value: 0}, uBase: {value: 0.3}, uWipe: {value: -10}, uWipeOn: {value: 0}, uHead: {value: -100}, uHeadOn: {value: 0}, uDir: {value: 1}, uFlash: {value: 0}, uChase: {value: 0}, uGain: {value: 1}},
    vertexShader: 'attribute float aS; varying float vS; void main(){ vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uBase, uWipe, uWipeOn, uHead, uHeadOn, uDir, uFlash, uChase, uGain; varying float vS;
void main(){
  float px = fract(vS / 0.1); float pix = smoothstep(0.0, 0.2, px) * smoothstep(1.0, 0.8, px);
  float lit = mix(uBase, 1.0, step(vS, uWipe));
  float wh = uWipeOn * (exp(-abs(vS - uWipe) * 0.5) * 1.3 + step(vS, uWipe) * exp((vS - uWipe) * 0.12) * 0.35);
  float d = (vS - uHead) * uDir;
  float head = uHeadOn * (exp(-d * d * 0.9) * 1.4 + step(d, 0.0) * exp(d * 0.35) * 0.55);
  float ch = uChase * pow(0.5 + 0.5 * sin(vS * 0.55 - uT * 7.0), 10.0);
  vec3 red = vec3(1.0, 0.1, 0.11) * 7.5 * lit * (1.0 + ch * 1.4);
  vec3 wht = vec3(1.0, 0.9, 0.86) * 9.0 * (head + wh + uFlash);
  gl_FragColor = vec4((red + wht) * (0.85 + 0.15 * pix) * uGain, 1.0);
}`});
  { const parts = [];
    for (const z of [-W2, W2]) { const sz = Math.sign(z);
      parts.push(quadStrip(curve, p => at(p, 0.025, z - sz * 0.062), p => at(p, 0.025, z - sz * 0.027), true, p => p.s));
      parts.push(quadStrip(curve, p => at(p, -0.015, z + sz * 0.006), p => at(p, -0.1, z + sz * 0.006), true, p => p.s)); }
    for (const g of parts) { const m = new THREE.Mesh(g, ledM); m.frustumCulled = false; scene.add(m); } }
  A.led = ledM;

  const beams = [], beam = (a, b, t = 0.1) => beams.push([a, b, t]);
  const TX0 = R.R1 + TH + 0.8, TX1 = TX0 + 2.6, TZ = W2 - 0.35;
  const XB0 = R.LIP_X - 0.8, YB0 = R.H + TH + 1.05, YB1 = YB0 + 1.5, ZB = 0.85, YT = YB1;
  for (const x of [TX0, TX1]) for (const z of [-TZ, TZ]) beam(V(x, 0, z), V(x, YT, z), 0.24);
  { const nb = Math.round(YT / 2.3), dy = YT / nb;
    for (let k = 0; k <= nb; k++) { const y = Math.max(0.15, k * dy); beam(V(TX0, y, -TZ), V(TX0, y, TZ), 0.11); beam(V(TX1, y, -TZ), V(TX1, y, TZ), 0.11); beam(V(TX0, y, -TZ), V(TX1, y, -TZ), 0.11); beam(V(TX0, y, TZ), V(TX1, y, TZ), 0.11); }
    for (let k = 0; k < nb; k++) { const y0 = k * dy, y1 = y0 + dy, f = k % 2 ? 1 : -1;
      for (const x of [TX0, TX1]) { beam(V(x, y0, -TZ * f), V(x, y1, TZ * f), 0.08); beam(V(x, y0, TZ * f), V(x, y1, -TZ * f), 0.07); }
      for (const z of [-TZ, TZ]) { beam(V(TX0, y0, z), V(TX1, y1, z), 0.08); beam(V(TX1, y0, z), V(TX0, y1, z), 0.07); } } }
  for (const y of [YB0, YB1]) for (const z of [-ZB, ZB]) beam(V(XB0, y, z), V(TX1, y, z), 0.18);
  { const n = Math.round((TX1 - XB0) / 1.5), dx = (TX1 - XB0) / n;
    for (let k = 0; k <= n; k++) { const x = XB0 + k * dx; for (const z of [-ZB, ZB]) beam(V(x, YB0, z), V(x, YB1, z), 0.08); for (const y of [YB0, YB1]) beam(V(x, y, -ZB), V(x, y, ZB), 0.08); }
    for (let k = 0; k < n; k++) { const x0 = XB0 + k * dx, x1 = x0 + dx, f = k % 2;
      for (const z of [-ZB, ZB]) beam(V(f ? x0 : x1, YB0, z), V(f ? x1 : x0, YB1, z), 0.07);
      beam(V(x0, YB1, f ? -ZB : ZB), V(x1, YB1, f ? ZB : -ZB), 0.06); beam(V(x0, YB0, f ? ZB : -ZB), V(x1, YB0, f ? -ZB : ZB), 0.06); } }
  for (let x = XB0 + 0.6; x < R.C2[0] + 0.5; x += 2.25) for (const sz of [-1, 1]) beam(V(x, YB0, sz * ZB), V(x, R.H + TH, sz * (W2 - 0.3)), 0.07);
  const backAtY = y => { if (y <= R.R1) { const al = Math.acos(clamp01((R.R1 - y) / (R.R1 + TH))); return V((R.R1 + TH) * Math.sin(al), y, 0); } if (y <= R.C2[1]) return V(R.R1 + TH, y, 0); const ph = Math.asin(clamp01((y - R.C2[1]) / (R.R2 + TH))); return V(R.C2[0] + (R.R2 + TH) * Math.cos(ph), y, 0); };
  { let prev = null;
    for (let y = 1.4; y < R.H - 0.6; y += 2.3) { const b = backAtY(y);
      for (const sz of [-1, 1]) { beam(V(b.x, y, sz * (W2 - 0.3)), V(TX0, y, sz * TZ), 0.1); if (prev && y > R.R1 + 1) beam(V(prev.x, prev.y, sz * (W2 - 0.3)), V(TX0, y, sz * TZ), 0.06); }
      if (y < R.R1 - 0.5) for (const sz of [-1, 1]) { beam(V(b.x + 0.05, 0, sz * (W2 - 0.3)), V(b.x + 0.05, y, sz * (W2 - 0.3)), 0.12); if (prev) beam(V(prev.x + 0.05, 0.2, sz * (W2 - 0.3)), V(b.x + 0.05, y, sz * (W2 - 0.3)), 0.06); }
      prev = V(b.x, y, 0); } }
  { const ribs = curve.filter((p, i) => p.s > 0.5 && i % 12 === 0);
    ribs.forEach((p, i) => { const b = V(...at(p, -TH - 0.09, 0)); beam(V(b.x, b.y, -W2 + 0.05), V(b.x, b.y, W2 - 0.05), 0.15);
      if (i) { const q = ribs[i - 1], c = V(...at(q, -TH - 0.09, 0)); for (const z of [-W2 + 0.45, W2 - 0.45]) beam(V(c.x, c.y, z), V(b.x, b.y, z), 0.12); } }); }
  const steel = new THREE.MeshStandardMaterial({color: 0x8e9298, roughness: 0.42, metalness: 0.6, envMapIntensity: 0.9});
  { const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), steel, beams.length), m4 = new THREE.Matrix4(), up = V(0, 1, 0);
    beams.forEach(([a, b, t], i) => { const d = b.clone().sub(a), L = d.length(); m4.compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(up, d.normalize()), V(t, L, t)); inst.setMatrixAt(i, m4); });
    inst.castShadow = true; inst.receiveShadow = true; scene.add(inst); A.truss = inst; }
  const markM = new THREE.MeshBasicMaterial({color: new THREE.Color(8, 0.2, 0.15)});
  { const pts = [V(TX0, YT + 0.2, -TZ), V(TX0, YT + 0.2, TZ), V(TX1, YT + 0.2, -TZ), V(TX1, YT + 0.2, TZ), V(XB0, YB1 + 0.2, -ZB), V(XB0, YB1 + 0.2, ZB)];
    const mk = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), markM, pts.length), m4 = new THREE.Matrix4(); pts.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); mk.setMatrixAt(i, m4); }); scene.add(mk); }

  const redLedM = new THREE.MeshBasicMaterial({color: new THREE.Color(2.4, 0.08, 0.06)});
  const uZ = W2 + 2.3, uX0 = -0.8, uX1 = TX1 + 1.8;
  for (const sz of [-1, 1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(uX1 - uX0, 0.06, 0.09), redLedM); s.position.set((uX0 + uX1) / 2, 0.03, sz * uZ); scene.add(s); }
  { const s = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 2 * uZ), redLedM); s.position.set(uX1, 0.03, 0); scene.add(s); }
  const caseM = new THREE.MeshStandardMaterial({color: 0x45474b, roughness: 0.55, metalness: 0.4});
  for (const sz of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 0.6), caseM); c.position.set(0.2, 0.275, sz * (uZ - 0.5)); c.castShadow = true; c.receiveShadow = true; scene.add(c);
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.05, 0.06), redLedM); s.position.set(0.2, 0.56, sz * (uZ - 0.22)); scene.add(s); }

  const fxM = new THREE.MeshStandardMaterial({color: 0x17181b, roughness: 0.5, metalness: 0.6});
  const fixtures = [];
  function fixture(pos, len, half, col, kind, i) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.42), fxM); base.position.copy(pos).add(V(0, kind === 'ground' ? 0.11 : 0, 0)); scene.add(base);
    const g = new THREE.Group(); g.position.copy(pos).add(V(0, kind === 'ground' ? 0.42 : 0.3, 0)); scene.add(g);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.46, 14).translate(0, -0.1, 0), fxM); g.add(body);
    const lensM = new THREE.MeshBasicMaterial({color: 0x000000}), lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16).rotateX(PI / 2), lensM); lens.position.y = -0.335; g.add(lens);
    const hm = hazeMat(col, 0.9), cone = new THREE.Mesh(coneGeo(len, 0.13, len * Math.tan(half)), hm); cone.position.y = -0.34; cone.renderOrder = 4; cone.frustumCulled = false; g.add(cone);
    const f = {g, lensM, hm, pos: g.position.clone(), kind, i, col: new THREE.Color(col)}; fixtures.push(f); return f;
  }
  const rigTop = [-3, 1.5, 6, 10.5, 15].map((x, i) => fixture(V(x, YB1 + 0.12, 0), 80, 0.03, 0xf4f6ff, 'top', i));
  const rigGround = [0, 1, 2, 3, 4, 5].map(i => fixture(V(-1 + 3.8 * i, 0, uZ + 1.1), 60, 0.028, 0xeef2ff, 'ground', i));

  const batM = new THREE.ShaderMaterial({side: THREE.DoubleSide, uniforms: {uT: {value: 0}, uLvl: {value: 0}, uHeadY: {value: -10}, uHeadOn: {value: 0}, uStrobe: {value: 0}, uBase: {value: 0.06}, uChase: {value: 0}},
    vertexShader: 'varying float vY; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uT, uLvl, uHeadY, uHeadOn, uStrobe, uBase, uChase; varying float vY;
void main(){ float seg = smoothstep(0.0, 0.1, fract(vY / 0.6)) * smoothstep(1.0, 0.9, fract(vY / 0.6));
  float lit = max(uBase, step(vY, uLvl)); float hd = uHeadOn * exp(-abs(vY - uHeadY) * 1.6);
  float ch = uChase * pow(0.5 + 0.5 * sin(vY * 0.5 - uT * 5.0), 8.0);
  vec3 c = vec3(1.0, 0.05, 0.035) * 2.2 * (lit + ch * 1.5) + vec3(1.0, 0.95, 0.92) * 5.0 * (hd + uStrobe);
  gl_FragColor = vec4(c * (0.35 + 0.65 * seg), 1.0); }`});
  for (const x of [TX0, TX1]) for (const sz of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, YT - 1.2, 0.06), batM); b.position.set(x, 0.6 + (YT - 1.2) / 2, sz * (TZ + 0.16)); scene.add(b); }
  A.batten = batM;

  const BAR = {a: V(-46, 0, -12.5), b: V(2, 0, -17), h: 1.05}, barL = BAR.a.distanceTo(BAR.b), barG = new THREE.Group();
  barG.position.copy(BAR.a).lerp(BAR.b, 0.5); barG.rotation.y = Math.atan2(-(BAR.b.z - BAR.a.z), BAR.b.x - BAR.a.x); scene.add(barG); barG.updateMatrixWorld(true);
  const barW = (lx, y, lz) => barG.localToWorld(V(lx, y, lz));
  const riserM = new THREE.MeshStandardMaterial({color: 0x202124, roughness: 0.8, metalness: 0.2});
  { const r = new THREE.Mesh(new THREE.BoxGeometry(barL, BAR.h, 2.2), riserM); r.position.set(0, BAR.h / 2, -1.1); r.castShadow = true; r.receiveShadow = true; barG.add(r); }
  const barM = new THREE.ShaderMaterial({uniforms: {uFill: {value: 0}, uHead: {value: 0}, uFlash: {value: 0}, uBase: {value: 0.03}, uT: {value: 0}},
    vertexShader: 'attribute float aU; varying float vU; void main(){ vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uFill, uHead, uFlash, uBase, uT; varying float vU;
void main(){ float lit = max(uBase, step(vU, uFill)); float hd = uHead * exp(-abs(vU - uFill) * 60.0);
  vec3 c = vec3(1.0, 0.07, 0.04) * 6.0 * lit + vec3(1.0, 0.9, 0.85) * 8.0 * (hd + uFlash * lit);
  gl_FragColor = vec4(c, 1.0); }`});
  { const g = new THREE.PlaneGeometry(barL, 0.11, 240, 1), u = []; const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) u.push((barL / 2 - p.getX(i)) / barL);
    g.setAttribute('aU', new THREE.Float32BufferAttribute(u, 1)); const m = new THREE.Mesh(g, barM); m.position.set(0, BAR.h - 0.2, 0.005); barG.add(m);
    const m2 = new THREE.Mesh(g.clone(), barM); m2.rotation.x = -PI / 2; m2.position.set(0, BAR.h + 0.004, -0.08); barG.add(m2); }
  A.bar = barM;
  const nDot = 48, dotM = new THREE.MeshBasicMaterial({color: 0xffffff}), dots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.08, 0.04), dotM, nDot);
  { const m4 = new THREE.Matrix4(); for (let i = 0; i < nDot; i++) { m4.makeTranslation(barL / 2 - 0.5 - i * (barL - 1) / (nDot - 1), BAR.h - 0.42, 0.02); dots.setMatrixAt(i, m4); dots.setColorAt(i, new THREE.Color(0, 0, 0)); } barG.add(dots); }
  const blinders = [-10, 6].map(lx => { const g = new THREE.Group(); g.position.copy(barW(lx, BAR.h, -0.6)); g.lookAt(-38, 2, 6); scene.add(g);
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.3), fxM); box.position.y = 0.4; g.add(box);
    const lm = new THREE.MeshBasicMaterial({color: 0x000000}); g.add(new THREE.Mesh(lampGrid(0.14, 14, 8, 2, -1.33, 0.38, 0.24, 0.32, 0.16), lm));
    return lm; });

  const GS = {x0: -50, x1: -6, z0: -22, rows: 6, dz: 1.8, dy: 1.05};
  const tierM = new THREE.MeshStandardMaterial({color: 0x26272a, roughness: 0.85, metalness: 0.1});
  for (let r = 0; r < GS.rows; r++) { const h = GS.dy * (r + 1), t = new THREE.Mesh(new THREE.BoxGeometry(GS.x1 - GS.x0, h, GS.dz), tierM); t.position.set((GS.x0 + GS.x1) / 2, h / 2, GS.z0 - GS.dz / 2 - r * GS.dz); t.receiveShadow = true; scene.add(t); }
  { const b = new THREE.Mesh(new THREE.BoxGeometry(GS.x1 - GS.x0, 3.2, 0.3), tierM); b.position.set((GS.x0 + GS.x1) / 2, GS.dy * GS.rows + 1.6, GS.z0 - GS.rows * GS.dz - 0.15); scene.add(b); }
  const standM = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: {uLvl: {value: 0.07}, uChase: {value: 0}, uPh: {value: 0}, uFull: {value: 0}, uFlash: {value: 0}, uT: {value: 0}},
    vertexShader: 'attribute vec3 aR; varying vec3 vR; void main(){ vR = aR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uLvl, uChase, uPh, uFull, uFlash, uT; varying vec3 vR;
void main(){ float xn = vR.x, row = vR.y, v = vR.z;
  float w = pow(0.5 + 0.5 * cos(6.2832 * (xn * 1.5 - uPh * 0.9 - row * 0.05)), 6.0);
  float lv = mix(uLvl, 0.14 + 0.86 * w, uChase); lv = max(lv, uFull * (0.85 + 0.15 * sin(uT * 2.2 + xn * 9.0 + row))); lv = max(lv, uFlash * 0.9);
  float bay = smoothstep(0.42, 0.18, abs(fract(xn * 16.0 + row * 0.5) - 0.5));
  float strip = smoothstep(0.07, 0.02, v) * (0.35 + 0.65 * bay);
  float wash = exp(-v * 2.6) * 0.3 * bay;
  gl_FragColor = vec4(vec3(1.0, 0.035, 0.025) * lv * (strip * 3.4 + wash), 1.0); }`});
  { const pos = [], ar = [], idx = []; let n = 0;
    for (let r = 0; r < GS.rows; r++) { const y0 = GS.dy * r + 0.02, y1 = GS.dy * (r + 1), z = GS.z0 - r * GS.dz + 0.02;
      pos.push(GS.x0, y0, z, GS.x1, y0, z, GS.x0, y1, z, GS.x1, y1, z); ar.push(0, r, 0, 1, r, 0, 0, r, y1 - y0, 1, r, y1 - y0); idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); n += 4; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aR', new THREE.Float32BufferAttribute(ar, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, standM); m.renderOrder = 3; scene.add(m); }

  const poleM = new THREE.MeshStandardMaterial({color: 0x2b2d31, roughness: 0.5, metalness: 0.7});
  const towers = [];
  function tower(base, aim, hgt, lamps, noPole) {
    if (!noPole) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, hgt, 12), poleM); pole.position.set(base.x, hgt / 2, base.z); pole.castShadow = true; scene.add(pole); }
    const head = new THREE.Group(); head.position.set(base.x, hgt + 0.6, base.z); head.lookAt(aim); scene.add(head);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.7, 0.3), poleM); head.add(panel);
    const lm = new THREE.MeshBasicMaterial({color: 0x000000}); head.add(new THREE.Mesh(lampGrid(0.24, 18, lamps, 2, -1.1, 2.2 / (lamps - 1), -0.38, 0.76, 0.16), lm));
    const t = {head, lm, pos: head.position.clone().add(aim.clone().sub(head.position).normalize().multiplyScalar(0.5)), aim: aim.clone()}; towers.push(t); return t;
  }
  const spot = (pos, tgt, I, ang, pen, col, shadow, key = 'x') => {
    const isReal = real(key), s = isReal ? new THREE.SpotLight(col, I, 0, ang, pen, 2) : fake(I); s.position.copy(pos); s.target.position.copy(tgt); scene.add(s, s.target);
    if (shadow && isReal && (HIGH || key === 'key')) { s.castShadow = true; s.shadow.mapSize.set(SHADOW, SHADOW); s.shadow.bias = -0.00015; s.shadow.normalBias = 0.035; s.shadow.camera.near = 8; s.shadow.camera.far = 140; s.shadow.radius = 2; }
    const L = {type: 'spot', obj: s, pos: pos.clone(), dir: tgt.clone().sub(pos).normalize(), cos0: Math.cos(ang), cos1: Math.cos(ang * (1 - pen)), col: new THREE.Color(col), I};
    A.lights.push(L); s.userData.L = L; return s;
  };
  const haze = (from, to, ang, col, k) => { const len = from.distanceTo(to) * 0.95, m = hazeMat(col, k), c = new THREE.Mesh(coneGeo(len, 0.5, len * Math.tan(ang) * 0.85), m); c.position.copy(from); c.quaternion.setFromUnitVectors(DOWN, to.clone().sub(from).normalize()); c.renderOrder = 4; c.frustumCulled = false; scene.add(c); return m; };
  const TA = tower(V(-56, 0, -8), V(8, 12, 0), 21, 4);
  A.rampKey = spot(TA.pos, V(7, 11, 0), 6500, 0.3, 0.45, 0xf1f4ff, true, 'key');
  TA.lm.color.setRGB(5, 5, 4.8); TA.haze = haze(TA.pos, V(4, 10, 0), 0.25, 0xdfe8ff, 2.5); TA.haze.uniforms.uI.value = 0.008;
  const floods = [
    {t: tower(V(-74, 0, -22), V(-60, 0, 5), 20, 4), tgt: V(-60, 0, 5), I: 3800, ang: 0.55, col: 0xf1f4fa},
    {t: tower(V(-4, 0, -27), V(-32, 0, 0), 20, 4), tgt: V(-32, 0, 0), I: 3200, ang: 0.55, col: 0xf1f4fa},
    {t: tower(V(-70, 0, 34), V(-56, 0, 3), 20, 4), tgt: V(-56, 0, 3), I: 4000, ang: 0.5, col: 0xf3f5fa},
    {t: tower(V(-52, 0, -24), V(-64, 0, 9), 18, 4, true), tgt: V(-64, 0, 9), I: 6200, ang: 0.3, col: 0xf3f6ff, shadow: true}];
  floods.forEach((f, k) => { f.L = spot(f.t.pos, f.tgt, f.I, f.ang, 0.85, f.col, !!f.shadow, k === 3 ? 'land' : 'flood' + k); f.L.intensity = 0; f.hm = haze(f.t.pos, f.tgt, f.ang, 0xd8e2ff, 2.2); });
  A.landKey = floods[3].L;
  A.ceilLight = spot(V(-17, 1.6, 9), V(2, 23, 0), 3200, 0.34, 0.6, 0xf0f4ff, false, 'ceil');
  A.padSpot = spot(V(-10, 17, 5), V(-3.4, 0, 0), 2000, 0.2, 0.6, 0xffffff, false, 'pad');
  A.parkSpot = spot(V(-29, 17, 21), V(-27, 0, 16), 2000, 0.19, 0.6, 0xffffff, false, 'park');
  const rigSpots = [-1, 1].map(sz => { const p = V(XB0 + 0.2, YB0 - 0.35, sz * (ZB + 0.25)); const f = fixture(p.clone().add(V(0, -0.3, 0)), 40, 0.07, 0xf2f5ff, 'spot', sz); const s = spot(p, V(-38, 0, 3), 0, 0.12, 0.5, 0xf2f5ff, false, 'rig' + (sz > 0 ? 1 : 0)); f.light = s; return f; });
  const red = (pos, I, dist) => { const p = HIGH && !MID ? new THREE.PointLight(0xff2418, I, dist, 2) : fake(I); p.position.copy(pos); scene.add(p); const L = {type: 'point', obj: p, pos: pos.clone(), col: new THREE.Color(0xff2418), I, dist}; A.lights.push(L); return p; };
  const barRed = [red(barW(-12, 1.2, 0.8), 0, 18), red(barW(10, 1.2, 0.8), 0, 18)];
  const standRed = red(V(-28, 4, GS.z0 + 2), 0, 30);
  scene.add(new THREE.HemisphereLight(0x1a2233, 0x070707, 0.28));

  { const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({color: 0xe8e9ea, roughness: 0.35, metalness: 0.1}), dark = new THREE.MeshStandardMaterial({color: 0x0c0d0f, roughness: 0.2, metalness: 0.5});
    const sh = new THREE.Shape(); [[0, 0.5], [0.12, 1.35], [0.85, 2.45], [2.1, 3.8], [6.6, 3.9], [6.8, 3.65], [6.8, 1.0], [6.6, 0.5]].forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); sh.closePath();
    const cab = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, {depth: 2.5, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2}).translate(0, 0, -1.25), white); cab.castShadow = true; cab.receiveShadow = true; g.add(cab);
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.36), dark); ws.position.set(1.45, 3.1, 0); ws.rotation.set(0, -PI / 2, 0); ws.rotateX(-0.82); g.add(ws);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(6, 0.35, 2.5), dark); bed.position.set(9.6, 1.05, 0); g.add(bed);
    for (const x of [1.4, 5.2, 6.5, 10.6, 11.9]) for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.36, 18).rotateX(PI / 2), dark); w.position.set(x, 0.52, sz * 1.12); g.add(w); }
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 2.2), new THREE.MeshBasicMaterial({color: new THREE.Color(3, 3, 3.2)})); hl.position.set(0.1, 1.42, 0); g.add(hl);
    g.position.set(-56, 0, -12); g.rotation.y = 2.6; scene.add(g); A.truck = g; }
  { const jb = new THREE.Mesh(new THREE.BoxGeometry(40, 0.8, 0.5), new THREE.MeshStandardMaterial({color: 0x3a3b3e, roughness: 0.9})); jb.position.set(-44, 0.4, 27); jb.receiveShadow = true; scene.add(jb);
    const st = new THREE.Mesh(new THREE.BoxGeometry(40, 0.07, 0.06), redLedM); st.position.set(-44, 0.62, 26.73); scene.add(st);
    for (const x of [-64.5, -23.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), poleM); p.position.set(x, 0.8, 27); scene.add(p); const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), redLedM); b.position.set(x, 1.65, 27); scene.add(b); } }
  { const lampM = new THREE.MeshBasicMaterial({color: new THREE.Color(6, 3.6, 1.6)}), workM = new THREE.MeshBasicMaterial({color: new THREE.Color(3, 3, 3.2)});
    for (let i = 0; i < 7; i++) { const x = -86 + i * 15, z = 94 + 3 * hash(i * 3.1);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 9, 8), poleM); p.position.set(x, 4.5, z); scene.add(p);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.6), poleM); arm.position.set(x, 9, z - 0.7); scene.add(arm);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), lampM); l.position.set(x, 8.92, z - 1.4); scene.add(l); }
    for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.position.set(-64 + i * 9, 0, 30 + 2 * hash(i * 5.3)); scene.add(g);
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), poleM); pl.position.y = 0.7; g.add(pl); const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), redLedM); b.position.y = 1.45; g.add(b); }
    for (let i = 0; i < 5; i++) { const g = new THREE.Group(); g.position.set(-70 + i * 14 + 5 * hash(i * 7.7), 0, 36 + 4 * hash(i * 2.9)); scene.add(g);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), poleM); st.position.y = 1.1; g.add(st);
      const hd = new THREE.Group(); hd.position.set(0, 2.2, 0); g.add(hd); hd.lookAt(-30, 1, 0); hd.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.14), fxM)); const fc = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.36), workM); fc.position.z = 0.075; hd.add(fc); } }
  { const n = 90, pos = [], col = [];
    for (let i = 0; i < n; i++) { const a = hash(i * 2.1) * 2 * PI, r = 170 + 260 * hash(i * 5.7), warm = hash(i * 9.3);
      if (Math.hypot(-20 + Math.cos(a) * r - LINEUP.cx, Math.sin(a) * r - LINEUP.line) < 110) continue;
      pos.push(-20 + Math.cos(a) * r, 0.6 + 7 * Math.pow(hash(i * 3.9), 3), Math.sin(a) * r);
      const k = 1.2 + 3 * hash(i * 7.7); if (warm > 0.8) col.push(k, 0.12 * k, 0.08 * k); else if (warm > 0.45) col.push(k, 0.62 * k, 0.32 * k); else col.push(k, k, 0.95 * k); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false}))); }

  const _c = new THREE.Color(), _d = V(), _q = new THREE.Quaternion();
  const dirFrom = (tilt, pan) => V(Math.sin(tilt) * Math.cos(pan), Math.cos(tilt), Math.sin(tilt) * Math.sin(pan));
  const strike = (t, k) => t <= 0 ? 0 : t < 0.34 ? (hash(Math.floor(t * 36) * 7.3 + k * 1.9) > 0.42 ? 0.25 + 0.75 * t / 0.34 : 0.04) : 1;
  A.update = (te, camPos, evIn) => {
    const ev = Object.assign({}, EV0, evIn || {}), {RUN1, TOP1, HOLD1, DOWN1, RUN2, LIP, LAND} = ev, carS = ev.carS ?? null;
    if (camPos) sky.position.copy(camPos);
    const run1 = false, run2 = te >= RUN2 - 0.2 && te < LAND + 1.5, hang = 0;
    const up = te < HOLD1 || te >= RUN2 - 0.1 ? 1 : -1, carY = carS === null ? -10 : rampAt(carS).y;
    const flashLip = pulse(te, LIP, 2.4), flashLand = pulse(te, LAND, 2.8), flashRun2 = pulse(te, RUN2, 3.5);
    const strobeLip = te >= LIP && te < LIP + 0.9 ? (0.6 + 0.4 * Math.cos((te - LIP) * 2 * PI * 2.5)) * Math.min(1, (te - LIP) / 0.15) * (1 - seg(te, LIP + 0.65, LIP + 0.9)) : 0;

    const U = ledM.uniforms;
    U.uT.value = te;
    U.uBase.value = te < RUN2 ? 0.3 + 0.05 * Math.sin(te * 1.6) : 1;
    const wp = (te - RUN2) / 1.2; U.uWipe.value = wp < 0 ? -10 : wp > 1.15 ? 1e4 : wp * (R.S4 + 2); U.uWipeOn.value = wp > 0 && wp < 1.15 ? 1 : 0;
    U.uHead.value = carS === null ? -100 : carS; U.uHeadOn.value = carS !== null && te > RUN2 - 0.3 ? 1 : 0; U.uDir.value = up;
    U.uFlash.value = 0.9 * flashLip + 0.55 * flashLand + 0.35 * flashRun2 + 0.45 * hang * (0.5 + 0.5 * Math.sin(te * 2 * PI * 2.2));
    U.uChase.value = seg(te, LAND + 0.6, LAND + 2.4);

    floods.forEach((f, k) => { const lv = strike(te - (RUN2 + 0.15 + 0.32 * k), k); f.L.intensity = f.I * lv; f.t.lm.color.setRGB(5 * lv + 0.03, 5 * lv + 0.03, 4.8 * lv + 0.03); f.hm.uniforms.uI.value = 0.011 * lv; });

    const B = batM.uniforms; B.uT.value = te;
    B.uLvl.value = run1 || run2 ? Math.max(0, carY) : te >= LAND + 1.5 ? YT : 0;
    B.uHeadY.value = carY; B.uHeadOn.value = (run1 || run2) && carS !== null ? 1 : 0;
    B.uStrobe.value = hang * (0.5 + 0.5 * Math.sin(te * 2 * PI * 2.6)) * 0.8 + strobeLip + 0.6 * flashRun2;
    B.uBase.value = te < RUN1 ? 0.05 : 0.12; B.uChase.value = seg(te, LAND + 1.5, LAND + 3.5);

    const idleSway = (i, k) => 0.35 * Math.sin(te * 0.45 + i * 1.3) * k;
    rigTop.forEach(f => { const i = f.i, s = i - 2; let tilt = 0, pan = 0, I = 0, w = 1;
      if (hang > 0) { tilt = (0.15 + 0.55 * hang) * Math.sin(te * 2.6 + i * 0.9); pan = PI / 2 + s * 0.35 + 0.5 * Math.sin(te * 1.7 + i); I = hang * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(te * 2 * PI * 2 + i * 1.3))); }
      if (te >= RUN2 - 0.2 && te < LAND + 1.2) { const u = seg(te, RUN2, LIP), v = seg(te, LIP, LAND), k = seg(te, LIP, LIP + 0.35), j = seg(te, RUN2 - 0.2, RUN2 + 0.2);
        const t0 = 0.45 - 0.25 * u + 0.12 * Math.sin(te * 3 + i), i0 = Math.max(I, 0.35 + 0.65 * u, flashRun2), t1 = 0.3 + 0.75 * v + 0.1 * Math.sin(te * 4 + i), i1 = Math.max(strobeLip, 0.75);
        const tl = lerp(t0, t1, k), pl = lerp(PI + s * 0.12, PI + s * 0.18, k), il = lerp(i0, i1, k);
        tilt = lerp(tilt, tl, j); pan = lerp(pan, pl, j); I = lerp(I, il, j); }
      if (te >= LAND + 1.2) { tilt = 0.45 + idleSway(i, 1.4); pan = PI + s * 0.3 + 0.4 * Math.sin(te * 0.3 + i); I = 0.45; w = (Math.floor(te * 0.5 + i * 0.5) % 2); }
      f.g.quaternion.setFromUnitVectors(DOWN, dirFrom(tilt, pan));
      _c.setRGB(1, 0.06 + 0.9 * w, 0.05 + 0.88 * w); f.hm.uniforms.uC.value.copy(_c); f.hm.uniforms.uI.value = 0.11 * I; f.lensM.color.copy(_c).multiplyScalar(18 * I); });
    rigGround.forEach(f => { const i = f.i; let I = 0, tilt = 0.5, pan = PI + (i - 2.5) * 0.12;
      I = Math.max(flashRun2, strobeLip * 1.0, pulse(te, LIP + 0.9, 1.2), 0.3 * seg(te, LAND + 1, LAND + 3));
      tilt = lerp(0.35 + 0.25 * Math.sin(te * 1.3 + i * 0.8), 0.25 + 0.6 * seg(te, LIP, LAND), seg(te, LIP, LIP + 0.35) * (1 - seg(te, LAND, LAND + 0.4)));
      const d = dirFrom(tilt, pan); f.g.quaternion.setFromUnitVectors(DOWN, d); f.hm.uniforms.uC.value.setRGB(1, 0.95, 0.92); f.hm.uniforms.uI.value = 0.09 * I; f.lensM.color.setRGB(16 * I + 1.6, 16 * I + 1.7, 16 * I + 1.9); });
    rigSpots.forEach((f, k) => { let I = 0, tgt;
      if (hang > 0) { I = hang; tgt = V(-52 + 12 * Math.sin(te * 1.8 + k * 2), 0, 3 + 9 * Math.cos(te * 1.4 + k)); }
      else if (te >= RUN2 && te < LAND + 2) { const b = seg(te, LIP, LIP + 0.4); I = lerp(0.6 + 0.4 * flashRun2 + 0.2 * seg(te, LIP - 0.3, LIP), Math.max(0.8, strobeLip), b); tgt = V(-6 - 4 * k, 0, (k ? 1 : -1) * 2).lerp(V(-57, 0, 0).lerp(V(-30, 8, 0), 1 - seg(te, LIP, LAND)), b); }
      else if (te >= LAND + 2) { I = 0.18 * seg(te, LAND + 2, LAND + 3.5); tgt = V(-64.9 + 1.2 * k, 0, 11.2 - 1.6 * k); }
      else tgt = V(-30, 0, 0);
      const d = tgt.clone().sub(f.pos).normalize(); f.g.quaternion.setFromUnitVectors(DOWN, d); f.light.target.position.copy(tgt); f.light.intensity = 9000 * I;
      f.light.userData.L.dir.copy(d); f.hm.uniforms.uI.value = 0.07 * I; f.lensM.color.setRGB(18 * I, 18 * I, 17 * I); });

    let fill = 0, head = 0;
    if (te >= RUN2) { fill = te < LIP ? sm((te - RUN2) / (LIP - RUN2)) : 1; head = fill < 1 ? 1 : 0; }
    const Bm = barM.uniforms; Bm.uFill.value = fill; Bm.uHead.value = head; Bm.uFlash.value = 0.6 * flashLip + 0.5 * flashLand; Bm.uBase.value = te < RUN2 ? 0.025 : 0.06; Bm.uT.value = te;
    for (let i = 0; i < nDot; i++) { const on = i / (nDot - 1) <= fill ? 1 : 0, tw = 0.75 + 0.25 * Math.sin(te * 6 + i * 1.7); dots.setColorAt(i, _c.setRGB(6 * on * tw, 6 * on * tw, 6 * on * tw)); }
    dots.instanceColor.needsUpdate = true;
    const bl = Math.max(seg(te, LIP + 0.2, LIP + 0.5) * (1 - seg(te, LAND + 2.5, LAND + 4.5)) * 0.9 + 0.12 * seg(te, LAND + 4.5, LAND + 5.5), flashLand, strobeLip);
    blinders.forEach(lm => lm.color.setRGB(22 * bl, 22 * bl, 21 * bl));
    barRed.forEach(p => { p.intensity = 70 * (0.08 + 0.92 * fill) * (te < RUN2 ? 0.2 : 1); });

    const S = standM.uniforms, chase = te >= RUN2 && te < LAND + 1 && run2 ? 1 : 0;
    S.uLvl.value = te < RUN2 ? 0.07 : 0.3; S.uChase.value = chase; S.uPh.value = te - (te >= RUN2 - 0.2 ? RUN2 : RUN1); S.uFull.value = seg(te, LAND + 0.6, LAND + 1.4); S.uFlash.value = te < LAND + 1 ? flashLip : 0; S.uT.value = te;
    standRed.intensity = 200 * Math.max(te < RUN2 ? 0.07 : chase ? 0.35 : 0.3, 0.85 * S.uFull.value, 0.9 * S.uFlash.value);
    markM.color.setRGB(Math.sin(te * 2 * PI * 0.7) > 0 ? 9 : 0.4, 0.15, 0.1);
    A.ceilLight.intensity = 3200 * (te < RUN2 ? 0.75 : 1);
  };
  A.update(0, V(), null);
  return A;
}
