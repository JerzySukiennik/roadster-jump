// Roadster Jump car view: the Roadster v2 GLB from Roadster 88 (gullwing doors, flap and nozzle-mount clips, 10 gimballed cold-gas nozzles, interior anchors) driven by a packed car pose that comes from the live sim or from a replay: wheels, steering, suspension, yoke, nozzle aim, deploy clips, lights, brake glow and the vapour-jet billboards (Film14 flipbook shader).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { carHull } from './sim/car.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const NOZZLES = ['RL1', 'RL2', 'RR2', 'RR1', 'FL', 'FR', 'SL1', 'SL2', 'SR1', 'SR2'];
const WHEELS = ['FL', 'FR', 'RL', 'RR'];
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export class CarPose {
  constructor() {
    this.p = new Float32Array(3); this.q = new Float32Array([0, 0, 0, 1]);
    this.spin = new Float32Array(4); this.len = new Float32Array(4); this.slip = new Float32Array(4); this.contact = new Float32Array(4);
    this.steer = new Float32Array(2); this.dir = new Float32Array(30); this.valve = new Float32Array(10); this.ground = new Float32Array(10);
    this.steerAngle = 0; this.extend = 0; this.flap = 0; this.side = 0; this.brake = 0; this.door = 0; this.fan = 0; this.speed = 0; this.vx = 0; this.vy = 0; this.vz = 0;
  }
  static get SIZE() { return 7 + 4 * 4 + 2 + 30 + 10 + 10 + 11; }
  write(a, o) {
    a.set(this.p, o); a.set(this.q, o + 3); a.set(this.spin, o + 7); a.set(this.len, o + 11); a.set(this.slip, o + 15); a.set(this.contact, o + 19);
    a.set(this.steer, o + 23); a.set(this.dir, o + 25); a.set(this.valve, o + 55); a.set(this.ground, o + 65);
    const e = o + 75; a[e] = this.steerAngle; a[e + 1] = this.extend; a[e + 2] = this.flap; a[e + 3] = this.side; a[e + 4] = this.brake; a[e + 5] = this.door; a[e + 6] = this.fan; a[e + 7] = this.speed; a[e + 8] = this.vx; a[e + 9] = this.vy; a[e + 10] = this.vz;
  }
  read(a, o) {
    this.p.set(a.subarray(o, o + 3)); this.q.set(a.subarray(o + 3, o + 7)); this.spin.set(a.subarray(o + 7, o + 11)); this.len.set(a.subarray(o + 11, o + 15)); this.slip.set(a.subarray(o + 15, o + 19)); this.contact.set(a.subarray(o + 19, o + 23));
    this.steer.set(a.subarray(o + 23, o + 25)); this.dir.set(a.subarray(o + 25, o + 55)); this.valve.set(a.subarray(o + 55, o + 65)); this.ground.set(a.subarray(o + 65, o + 75));
    const e = o + 75; this.steerAngle = a[e]; this.extend = a[e + 1]; this.flap = a[e + 2]; this.side = a[e + 3]; this.brake = a[e + 4]; this.door = a[e + 5]; this.fan = a[e + 6]; this.speed = a[e + 7]; this.vx = a[e + 8]; this.vy = a[e + 9]; this.vz = a[e + 10];
    return this;
  }
  lerp(a, b, t) {
    for (let i = 0; i < 3; i++) this.p[i] = a.p[i] + (b.p[i] - a.p[i]) * t;
    let d = 0; for (let i = 0; i < 4; i++) d += a.q[i] * b.q[i];
    const s = d < 0 ? -1 : 1; let l = 0;
    for (let i = 0; i < 4; i++) { this.q[i] = a.q[i] + (s * b.q[i] - a.q[i]) * t; l += this.q[i] * this.q[i]; }
    l = Math.sqrt(l) || 1; for (let i = 0; i < 4; i++) this.q[i] /= l;
    const k = t < 0.5 ? a : b;
    for (const f of ['spin', 'len', 'slip', 'contact', 'steer', 'dir', 'valve', 'ground']) this[f].set(k[f]);
    for (let i = 0; i < 4; i++) this.spin[i] = a.spin[i] + (b.spin[i] - a.spin[i]) * t;
    for (const f of ['steerAngle', 'extend', 'flap', 'side', 'brake', 'door', 'fan', 'speed', 'vx', 'vy', 'vz']) this[f] = a[f] + (b[f] - a[f]) * t;
    return this;
  }
  fromSim(sim, door) {
    this.p[0] = sim.pos.x; this.p[1] = sim.pos.y; this.p[2] = sim.pos.z;
    this.q[0] = sim.q.x; this.q[1] = sim.q.y; this.q[2] = sim.q.z; this.q[3] = sim.q.w;
    sim.wheels.forEach((w, i) => { this.spin[i] = w.spin; this.len[i] = w.length; this.slip[i] = w.contact ? w.slipVel : 0; this.contact[i] = w.contact ? 1 : 0; });
    this.steer[0] = sim.wheels[0].steer; this.steer[1] = sim.wheels[1].steer;
    sim.thrusters.all.forEach((n, i) => { this.dir[i * 3] = n.dir.x; this.dir[i * 3 + 1] = n.dir.y; this.dir[i * 3 + 2] = n.dir.z; this.valve[i] = n.valve; this.ground[i] = n.groundDist; });
    const th = sim.thrusters;
    this.steerAngle = sim.steerAngle; this.extend = th.extend; this.flap = th.flap; this.side = th.sideDeploy; this.brake = sim.brakeOn && sim.speed > 0.3 ? 1 : 0;
    this.door = door; this.fan = sim.fanSpool; this.speed = sim.speed; this.vx = sim.vel.x; this.vy = sim.vel.y; this.vz = sim.vel.z;
    return this;
  }
}

const STATIC_ROOT = /^(Badge_|Diffuser|Housing_Nozzle|Sill_|Splitter)/;
function mergeByMaterial(meshes, parent, prefix, inv) {
  const groups = new Map();
  for (const m of meshes) { if (Array.isArray(m.material)) continue; const k = m.material.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = [];
    for (const m of list) {
      const g = m.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      geos.push(g.index ? g : g.setIndex([...Array(g.attributes.position.count).keys()]));
    }
    const merged = mergeGeometries(geos); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material); mesh.name = prefix + '_' + (list[0].material.name || 'mat'); mesh.receiveShadow = true;
    parent.add(mesh);
    for (const m of list) m.parent.remove(m);
  }
}
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const interior = root.getObjectByName('Interior');
  if (interior) { const ms = []; interior.traverse((o) => { if (o.isMesh) ms.push(o); }); mergeByMaterial(ms, interior, 'Interior', new THREE.Matrix4().copy(interior.matrixWorld).invert()); }
  const car = root.getObjectByName('Roadster') || root;
  const st = car.children.filter((o) => o.isMesh && STATIC_ROOT.test(o.name));
  mergeByMaterial(st, car, 'Static', new THREE.Matrix4().copy(car.matrixWorld).invert());
}

let TPL = null, JET = null;
export async function loadCarAssets(url, onProgress) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [g, jet] = await Promise.all([loader.loadAsync(url, onProgress), new THREE.TextureLoader().loadAsync('assets/fx/vapour_jet.webp')]);
  jet.colorSpace = THREE.SRGBColorSpace;
  TPL = g; JET = jet;
}

const jetMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTex: { value: JET }, uFrame: { value: 0 }, uA: { value: 0 }, uL: { value: 2.2 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D uTex; uniform float uFrame, uA, uL; varying vec2 vUv;
void main(){ float f = floor(mod(uFrame, 64.0)); vec2 cell = vec2(mod(f, 8.0), floor(f / 8.0)); vec2 uv = vec2((cell.x + vUv.x) / 8.0, 1.0 - (cell.y + 1.0 - vUv.y) / 8.0);
  vec4 t = texture2D(uTex, uv); float a = t.a * uA; if (a < 0.003) discard;
  vec3 c = t.rgb * vec3(0.78, 0.9, 1.15) * uL * (1.0 + 1.6 * pow(1.0 - vUv.x, 6.0));
  gl_FragColor = vec4(c, a); }` });

export class CarView {
  constructor(scene, tuning, Q = {}) {
    this.tu = tuning; this.scene = scene;
    const gltf = TPL.scene, n = {};
    gltf.traverse((o) => { if (o.name && !n[o.name]) n[o.name] = o; if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    const mats = {}; gltf.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) mats[m.name] = m; });
    if (Q.simple !== false) for (const m of Object.values(mats)) if (m.isMeshPhysicalMaterial && m.name !== 'Paint') { m.clearcoat = 0; m.needsUpdate = true; }
    if (Q.simple !== false) mergeStatic(gltf);
    this.transmissive = [];
    for (const m of Object.values(mats)) if (m.transmission > 0) { this.transmissive.push(m.name); const t = m.transmission; m.transmission = 0; m.thickness = 0; m.transparent = true; m.opacity = Math.max(0.35, 1 - t * 0.55); m.depthWrite = false; m.needsUpdate = true; }
    this.n = n; this.mats = mats; this.gltf = gltf;
    this.root = new THREE.Group(); this.root.name = 'RoadsterRoot'; this.root.add(gltf); scene.add(this.root);
    { const proxyM = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), h = carHull(tuning), pts = [];
      for (const arr of [h.body, h.cabin]) for (let i = 0; i < arr.length; i += 3) pts.push(new THREE.Vector3(arr[i], arr[i + 1] - 0.02, arr[i + 2]));
      const hull = new THREE.Mesh(new ConvexGeometry(pts), proxyM); hull.castShadow = true; hull.receiveShadow = false; hull.name = 'ShadowProxy'; gltf.add(hull);
      for (const id of ['FL', 'FR', 'RL', 'RR']) { const w = n['Wheel_' + id]; if (!w) continue; const r = id[0] === 'F' ? tuning.wheels.radius_front : tuning.wheels.radius_rear; const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.28, 14).rotateZ(Math.PI / 2), proxyM); c.castShadow = true; w.add(c); } }
    this.carNode = n.Roadster || gltf; this.driverView = { n, root: this.carNode }; this.seatRoot = this.carNode;
    if (n.Wing) n.Wing.visible = false;
    this.rest = new Map(); gltf.traverse((o) => this.rest.set(o, { p: o.position.clone(), q: o.quaternion.clone() }));
    this.screen = this.makeScreen();
    if (mats.Screen) { mats.Screen.emissiveMap = this.screen.tex; mats.Screen.emissive = new THREE.Color(1, 1, 1); mats.Screen.emissiveIntensity = 1.4; mats.Screen.needsUpdate = true; }
    if (mats.Cluster) { mats.Cluster.emissive = new THREE.Color(0.25, 0.45, 0.8); mats.Cluster.emissiveIntensity = 0.6; }
    this.base = { head: mats.LED_Head ? mats.LED_Head.emissiveIntensity : 1, tail: mats.LED_Tail ? mats.LED_Tail.emissiveIntensity : 1 };
    this.glass = mats.Glass_Tint; this.glassOpacity = this.glass ? this.glass.opacity : 1;
    gltf.updateMatrixWorld(true);
    const wp = (k) => n[k].getWorldPosition(new THREE.Vector3());
    this.heads = (Q.lights === 'high' ? [0, 1] : [0]).map((i) => {
      const s = new THREE.SpotLight(0xe8f0ff, 0, 70, 0.62, 0.95, 2);
      const one = Q.lights !== 'high';
      s.position.copy(one ? wp('Lamp_Head_L').add(wp('Lamp_Head_R')).multiplyScalar(0.5) : wp(i ? 'Lamp_Head_R' : 'Lamp_Head_L'));
      s.target.position.set(one ? 0 : i ? -0.5 : 0.5, -0.4, 14); gltf.add(s, s.target); return s;
    });
    this.tail = Q.lights === 'high' ? new THREE.PointLight(0xff1a10, 0, 9, 2) : null;
    if (this.tail) { this.tail.position.copy(wp('Lamp_Tail')).add(new THREE.Vector3(0, 0, -0.3)); gltf.add(this.tail); }
    this.jetLight = new THREE.PointLight(0xb8e4ff, 0, 22, 2); gltf.add(this.jetLight);
    this.wheelNodes = WHEELS.map((id, i) => {
      const front = i < 2, wheel = n['Wheel_' + id], steer = n['Steer_' + id], brake = n['Brake_' + id];
      const mover = front ? (steer || wheel) : wheel;
      return { wheel, steer, mover, brake: !front ? brake : null, rest: mover.position.clone(), brakeRest: brake && !front ? brake.position.clone() : null };
    });
    const rootInv = gltf.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.nozzleRig = NOZZLES.map((id) => {
      const nz = n['Nozzle_' + id], ex = n['Exhaust_Nozzle_' + id];
      const grp = /^S/.test(id) ? 'side' : /^F/.test(id) ? 'front' : 'rear';
      const exL = grp === 'side' ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, grp === 'front' ? 1 : -1);
      if (ex && ex.position.lengthSq() > 1e-8) exL.copy(ex.position).normalize();
      const r = this.rest.get(nz);
      const parentQ = rootInv.clone().multiply(nz.parent.getWorldQuaternion(new THREE.Quaternion()));
      return { id, grp, node: nz, ex, restQ: r.q.clone(), restAxis: exL.clone().applyQuaternion(r.q), parentInv: parentQ.clone().invert() };
    });
    this.clips = {};
    for (const clip of TPL.animations || []) {
      const tracks = [];
      for (const tr of clip.tracks) {
        const dot = tr.name.lastIndexOf('.'), node = n[tr.name.slice(0, dot)], prop = tr.name.slice(dot + 1);
        if (!node || (prop !== 'quaternion' && prop !== 'position') || tr.times.length <= 1) continue;
        tracks.push({ node, prop, interp: tr.createInterpolant() });
      }
      this.clips[clip.name] = { duration: clip.duration || 1, tracks, last: -1 };
    }
    this.jets = NOZZLES.map(() => {
      const g = new THREE.PlaneGeometry(4.0, 1.25); g.translate(2.0 - 0.048, 0, 0);
      const m = new THREE.Mesh(g, jetMat()); m.matrixAutoUpdate = false; m.frustumCulled = false; m.renderOrder = 7; m.visible = false; scene.add(m); return m;
    });
    this.pose = new CarPose();
    { const c = tuning.car, S = tuning.suspension, wb = c.wheelbase / 2, g = tuning.gravity, fl = c.mass * g * ((wb + c.com[2]) / c.wheelbase) / 2, rl = (c.mass * g - fl * 2) / 2; this.stat = [fl / S.spring_front, fl / S.spring_front, rl / S.spring_rear, rl / S.spring_rear]; }
    this.lightsOn = 1; this.cabin = false; this.onRamp = false; this.time = 0; this.doorR = 0; this.targa = 0;
    this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._c = new THREE.Vector3(); this._m = new THREE.Matrix4();
  }

  makeScreen() {
    const c = document.createElement('canvas'); c.width = 640; c.height = 400; const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false;
    const S = { c, g, tex, last: -1, draw: (mph, fan, assist) => {
      const k = `${Math.round(mph)}|${fan > 0.5}|${assist}`; if (k === S.last) return; S.last = k;
      const gr = g.createLinearGradient(0, 0, 640, 400); gr.addColorStop(0, '#0e1a2e'); gr.addColorStop(1, '#03060c'); g.fillStyle = gr; g.fillRect(0, 0, 640, 400);
      g.strokeStyle = '#3a7bd5'; g.lineWidth = 4; g.beginPath(); g.arc(170, 215, 110, Math.PI * 0.8, Math.PI * 0.8 + Math.PI * 1.4 * Math.min(1, mph / 160)); g.stroke();
      g.fillStyle = '#e8f0ff'; g.font = 'bold 86px Helvetica'; g.textAlign = 'center'; g.fillText(String(Math.round(mph)), 170, 245); g.font = '26px Helvetica'; g.fillStyle = '#8fa6c8'; g.fillText('mph', 170, 285);
      g.textAlign = 'left'; g.fillStyle = '#d8dde6'; g.font = '600 34px Helvetica'; g.fillText('ROADSTER', 340, 120); g.font = '24px Helvetica'; g.fillStyle = '#7d8aa0'; g.fillText('Jump mode', 340, 160);
      g.fillStyle = fan > 0.5 ? '#3a7bd5' : '#2a3140'; g.fillRect(340, 210, 230, 10); g.fillStyle = '#7d8aa0'; g.font = '20px Helvetica'; g.fillText(fan > 0.5 ? 'Suction on' : 'Suction off', 340, 248);
      g.fillStyle = assist ? '#2ecc71' : '#2a3140'; g.fillRect(340, 270, 150, 10); g.fillStyle = '#7d8aa0'; g.fillText(assist ? 'Flight assist' : 'Assist off', 340, 308);
      tex.needsUpdate = true;
    } };
    S.draw(0, 0, true);
    return S;
  }

  setClip(name, t) {
    const c = this.clips[name];
    if (!c || Math.abs(c.last - t) < 1e-4) return;
    c.last = t;
    const time = clamp01(t) * c.duration;
    for (const tr of c.tracks) {
      const v = tr.interp.evaluate(time);
      if (tr.prop === 'quaternion') tr.node.quaternion.set(v[0], v[1], v[2], v[3]); else tr.node.position.set(v[0], v[1], v[2]);
    }
  }

  setCabin(on) { this.cabin = on; if (this.glass) { this.glass.opacity = on ? 0.3 : this.glassOpacity; this.glass.needsUpdate = true; } }

  apply(P, dt) {
    this.time += dt;
    this.root.position.set(P.p[0], P.p[1], P.p[2]);
    this.root.quaternion.set(P.q[0], P.q[1], P.q[2], P.q[3]);
    const S = this.tu.suspension;
    this.wheelNodes.forEach((N, i) => {
      const drop = (S.rest_length - this.stat[i]) - P.len[i];
      N.mover.position.set(N.rest.x, N.rest.y + drop, N.rest.z);
      if (N.brakeRest) N.brake.position.set(N.brakeRest.x, N.brakeRest.y + drop, N.brakeRest.z);
      if (N.steer) N.steer.quaternion.copy(this.rest.get(N.steer).q).multiply(this._q.setFromAxisAngle(Y, P.steer[i] || 0));
      N.wheel.quaternion.copy(this.rest.get(N.wheel).q).multiply(this._q.setFromAxisAngle(X, P.spin[i] % (Math.PI * 2)));
    });
    const sw = this.n.SteeringWheel;
    if (sw) sw.quaternion.copy(this.rest.get(sw).q).multiply(this._q.setFromAxisAngle(Z, -P.steerAngle * 4.6));
    for (let i = 0; i < 10; i++) {
      const rig = this.nozzleRig[i];
      const t = this._v.set(-P.dir[i * 3], -P.dir[i * 3 + 1], -P.dir[i * 3 + 2]).applyQuaternion(rig.parentInv);
      rig.node.quaternion.copy(this._q.setFromUnitVectors(rig.restAxis, t)).multiply(rig.restQ);
    }
    this.setClip('front_nozzles_deploy', P.extend);
    this.setClip('side_nozzles_deploy', P.side);
    this.setClip('flap_open', P.flap);
    this.setClip('door_L_open', P.door); this.setClip('door_R_open', this.doorR || 0);
    this.setClip('targa_remove', this.targa || 0);
    const on = this.lightsOn, M = this.mats;
    if (M.LED_Head) M.LED_Head.emissiveIntensity = this.base.head * (0.05 + 0.95 * on);
    if (M.LED_Tail) M.LED_Tail.emissiveIntensity = this.base.tail * (0.15 + 0.85 * on) * (1 + 1.4 * P.brake);
    for (const s of this.heads) s.intensity = (this.heads.length === 1 ? 520 : 320) * on * (this.cabin ? 0.6 : 1) * (this.onRamp ? 0.3 : 1);
    if (this.tail) this.tail.intensity = (5 + 10 * P.brake) * on;
  }

  updateJets(cam, P) {
    this.gltf.updateMatrixWorld(true);
    const carQ = this.root.quaternion;
    let sum = 0; const c = this._c.set(0, 0, 0);
    for (let i = 0; i < 10; i++) {
      const m = this.jets[i], k = P.valve[i];
      m.visible = k > 0.02 && !(this.cabin && i < 4);
      if (!m.visible) continue;
      const rig = this.nozzleRig[i];
      const p = rig.ex.getWorldPosition(this._v);
      const axis = this._w.set(-P.dir[i * 3], -P.dir[i * 3 + 1], -P.dir[i * 3 + 2]).applyQuaternion(carQ).normalize();
      let len = 0.5 + 0.5 * k * (rig.grp === 'rear' ? 1.4 : 1);
      if (P.ground[i] < 6) len = Math.min(len, Math.max(0.25, P.ground[i] / 4.0 + 0.1));
      const toCam = cam.position.clone().sub(p), yv = axis.clone().cross(toCam).normalize(), zv = axis.clone().cross(yv).normalize();
      m.matrix.makeBasis(axis.clone().multiplyScalar(len), yv.multiplyScalar(0.7 + 0.3 * k), zv).setPosition(p); m.matrixWorld.copy(m.matrix);
      const u = m.material.uniforms; u.uA.value = Math.min(1, 0.35 + 0.6 * k); u.uFrame.value = this.time * (30 + 30 * k) + i * 7;
      sum += k; c.addScaledVector(p.clone().addScaledVector(axis, 1.6), k);
    }
    this.jetLight.intensity = 55 * Math.min(2.5, sum) * (this.cabin ? 0.25 : 1);
    this.jetLight.visible = this.jetLight.intensity > 0.5;
    if (sum > 0.02) this.jetLight.position.copy(this.gltf.worldToLocal(c.multiplyScalar(1 / sum)));
  }

  eye(out) { return this.n.Eye_Driver ? this.n.Eye_Driver.getWorldPosition(out) : out.set(0.38, 0.98, -0.3).applyMatrix4(this.root.matrixWorld); }
}
