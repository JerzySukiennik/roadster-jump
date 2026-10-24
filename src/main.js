// Roadster Jump: drive the Roadster v2 around the Film14 night arena, climb the giant curl ramp on suction to the upside-down ceiling, launch off the lip and kickflip on cold-gas thrusters, or press L and the camera flies out to the Tesla lineup 440 m away to jet-ollie and kickflip over it (and back). Boot, 120 Hz physics loop with render interpolation, getting in and out as Jurek, the site flight, tricks and scoring, replays, light show, audio, HUD, touch and the test hooks.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { TUNING } from './tuning.js';
import { RAMP, rampLocate } from './ramp.js';
import { Physics } from './physics.js';
import { CarSim } from './sim/car.js';
import { CarView, CarPose, loadCarAssets } from './carView.js';
import { buildArena } from './arena.js';
import { Post } from './post.js';
import { Smoke } from './smoke.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { Touch } from './touch.js';
import { GameAudio } from './audio.js';
import { Tricks, COMBO_GAP } from './tricks.js';
import { Recorder, Replay } from './replay.js';
import { Online } from './online.js';
import { UI } from './ui.js';
import { Driver } from './avatar/driver.js';
import { Walker, PARKED } from './avatar/walker.js';
import { Moves } from './avatar/moves.js';
import { Showroom } from './showroom.js';
import { Goals } from './goals.js';
import { LINEUP, buildLineup, vehicleHull, vehicleTuning, vehicleInfo } from './lineup.js';
import { GhostCam } from './ghostcam.js';
import { PhotoMode } from './photo.js';
import { Clips } from './clip.js';
import { Radar } from './radar.js';
import { Props } from './props.js';
import { Marks, Sparks } from './fx.js';
import { Net } from './net.js';
import { Remotes, packCar, packWalker } from './remote.js';

const qs = new URLSearchParams(location.search);
const TOUCH = qs.has('touch') || matchMedia('(pointer: coarse)').matches || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } };
const S = Object.assign({ assist: true, cam: 'chase', quality: 'auto', musicVol: 0.6, sfxVol: 0.9, sens: 1, name: '', music: true, goals: true, mp: true, shake: true }, load('rj.settings'));
const QUAL = qs.get('q') || (S.quality === 'auto' ? (TOUCH ? 'low' : 'auto') : S.quality);
const LOW = QUAL === 'low', HIGHQ = QUAL === 'high';
const Q = { simple: qs.get('simple') !== '0', low: LOW, lights: qs.get('lights') || (LOW ? 'low' : HIGHQ ? 'high' : 'mid'), shadow: LOW ? 1024 : 2048, msaa: qs.has('msaa') ? +qs.get('msaa') : LOW ? 0 : HIGHQ ? 4 : 2, dpr: qs.has('dpr') ? +qs.get('dpr') : Math.min(window.devicePixelRatio || 1, HIGHQ ? 1.5 : 1.25) };
const START = { p: [-3.2, 0.05, 0], yaw: Math.PI / 2 };
const H = 1 / TUNING.physics_hz;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
document.body.classList.toggle('touchdev', TOUCH);

const online = new Online();
const ui = new UI(S, online);
let booted = false;
const bootFail = (e) => {
  if (booted) return; booted = true; console.error('boot failed', e);
  const t = document.getElementById('loadText'), l = document.getElementById('loader');
  if (t) { t.textContent = 'Something did not load. Tap to try again'; t.classList.add('fail'); }
  if (l) { l.style.cursor = 'pointer'; l.addEventListener('click', () => location.reload(), { once: true }); }
};
addEventListener('error', (e) => { if (!window.__rj) bootFail(e.error || e.message); });
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = qs.get('shadows') !== '0'; renderer.shadowMap.type = LOW ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 1600);
camera.position.set(-14, 2, -6); camera.lookAt(0, 4, 0);
const post = new Post(renderer, Q);
let scale = qs.has('dpr') || HIGHQ ? 1 : 0.8;
let clipSize = null, clipFmt = 'wide', clipLastT = 0;
function resize() {
  const w = innerWidth, h = innerHeight, cs = canvas.style;
  if (clipSize) {
    const [cw, ch] = clipSize, k = Math.min(w / cw, h / ch);
    renderer.setPixelRatio(1); renderer.setSize(cw, ch, false);
    cs.width = `${cw * k}px`; cs.height = `${ch * k}px`; cs.left = `${(w - cw * k) / 2}px`; cs.top = `${(h - ch * k) / 2}px`;
    post.resize(cw, ch); camera.aspect = cw / ch; camera.updateProjectionMatrix(); return;
  }
  cs.width = cs.height = cs.left = cs.top = '';
  renderer.setPixelRatio(Q.dpr * scale); renderer.setSize(w, h, false);
  const b = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.resize(b.x, b.y); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

ui.loading(0.02, 'Loading physics');
const driver = new Driver({});
let avatarOk = true, avatarFrac = 0;
const avatarLoad = driver.load(LOW, 0, (e) => { if (e.total) avatarFrac = e.loaded / e.total; }).then(() => driver.preloadMotion()).catch((e) => { avatarOk = false; console.warn('avatar failed', e); });
await RAPIER.init();
const phys = new Physics(RAPIER, TUNING);
const rampHandles = new Set(phys.rampCols.map((c) => c.handle));
ui.loading(0.08, 'Building the arena');
const A = buildArena(scene, Q);
const lineup = buildLineup(scene, Q);
lineup.makeEnv(renderer);
const props = new Props(RAPIER, phys.world);
for (const p of A.props) props.addGroup(p.g, p.shapes, p.mass);
for (const p of lineup.props) props.add(p);
const siteSpot = [A.padSpot, A.ceilLight].find((l) => !l.isFake), FOG = scene.fog.density;
const siteHome = { pos: siteSpot.position.clone(), tgt: siteSpot.target.position.clone(), angle: siteSpot.angle, pen: siteSpot.penumbra, I: siteSpot.intensity };
const siteAway = { pos: new THREE.Vector3(...LINEUP.light.pos), tgt: new THREE.Vector3(...LINEUP.light.tgt), angle: LINEUP.light.angle, pen: LINEUP.light.pen, I: LINEUP.light.I };
let lightsAt = 'ramp';
function placeLights(z) {
  if (z === lightsAt) return;
  lightsAt = z; const o = z === 'lineup' ? siteAway : siteHome, L = siteSpot.userData.L;
  siteSpot.position.copy(o.pos); siteSpot.target.position.copy(o.tgt); siteSpot.target.updateMatrixWorld(); siteSpot.angle = o.angle; siteSpot.penumbra = o.pen; siteSpot.intensity = o.I;
  L.pos.copy(o.pos); L.dir.copy(o.tgt).sub(o.pos).normalize(); L.cos0 = Math.cos(o.angle); L.cos1 = Math.cos(o.angle * (1 - o.pen)); L.I = o.I;
}
ui.loading(0.12, 'Loading the Roadster');
await loadCarAssets(LOW || qs.get('car') === 'lod1' ? 'assets/car/roadster_lod1.glb' : 'assets/car/roadster.glb', (e) => { if (e.total) ui.loading(0.12 + 0.8 * e.loaded / e.total, `Loading the Roadster · ${(e.loaded / 1e6).toFixed(1)} / ${(e.total / 1e6).toFixed(1)} MB`); });
const view = new CarView(scene, TUNING, Q);
const roadster = new CarSim(RAPIER, phys.world, TUNING, { position: START.p, yaw: START.yaw });
let car = roadster, active = null;
car.flight.assist = S.assist;
const carObj = { sim: roadster, view, curr: { pos: new THREE.Vector3(), quat: new THREE.Quaternion() } };
const fleet = lineup.views.map((v, i) => {
  const c = LINEUP.cars[i], info = vehicleInfo(i), home = { p: [c.x, LINEUP.y0 + 0.04, c.z], yaw: Math.PI };
  const sim = new CarSim(RAPIER, phys.world, vehicleTuning(TUNING, i), { position: home.p, yaw: home.yaw, jets: false, hull: vehicleHull(i), canSleep: true });
  return { i, info, sim, view: v, home, prev: new CarPose(), curr: new CarPose(), draw: new CarPose(), rest: 0, asleep: false, y0: sim.wheels.map((w) => w.local.y) };
});
const rPose = { prev: new CarPose(), curr: new CarPose(), draw: new CarPose() };
const net = new Net(online, { local: qs.get('mp') === 'local' });
const remotes = new Remotes({ scene, R: RAPIER, world: phys.world, lineup, smoke: null, tuning: TUNING, url: 'assets/car/roadster_lod1.glb', tags: document.getElementById('tags') });
net.onState = (u, n, st, t) => remotes.update(u, n, st, t);
net.onLeave = (u, n) => { remotes.remove(u); ui.feed(n || 'A player', 'left the arena', '', true); };
net.onJoin = (u, n) => ui.feed(n, 'joined the arena', '', true);
remotes.onTrick = (e, E) => ui.feed(e.name, E.text || 'Landed a jump', E.pts.toLocaleString('en-US'));
const myEvt = { seq: 0, t: -1e9, text: '', pts: 0 };
const evtText = (s) => String(s).replace(/[|,]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 48);
remotes.onTpl = (g) => { try { renderer.compile(g, camera); } catch (e) { /* compile on first draw */ } };
let stepClock = performance.now();
const mpName = () => S.name || `Guest ${(online.uid || net.uid || '000').slice(-3).toUpperCase()}`;
function mpJoin() { if (!S.mp || qs.get('mp') === 'off' || net.on || (navigator.webdriver && !qs.has('mp'))) return; net.join(mpName()).then((ok) => { if (ok) ui.toast(`Online · ${net.peers.size ? net.peers.size + 1 + ' players' : 'shared arena'}`, 1.8); }); }
function mpLeave() { net.leave(); for (const u of [...remotes.list.keys()]) remotes.remove(u); }
function packMe() {
  let st = `v1|${active ? active.i + 1 : 0}|${packCar(roadster, door.t, roadster.contacts === 0)}`;
  if (active) st += `|A:${packCar(active.sim, 0, active.sim.contacts === 0)}`;
  if (!inCar && walker.active) st += `|W:${packWalker(walker)}`;
  if (performance.now() - myEvt.t < 5000) { const ev = `|E:${myEvt.seq},${myEvt.pts},${myEvt.text}`; if (st.length + ev.length <= 400) st += ev; }
  return st;
}
const vidOf = (sim) => { const f = fleet.find((q) => q.sim === sim); return f ? f.i + 1 : 0; };
const smoke = new Smoke(scene, Q);
remotes.smoke = smoke;
const marks = new Marks(scene, LOW ? 2500 : 6000), sparks = new Sparks(scene, LOW ? 300 : 800);
const _pt = { x: 0, y: 0, z: 0 };
function tyreMarks(sim, vid) {
  const W = sim.tu.wheels;
  sim.wheels.forEach((w, i) => { const key = vid * 8 + i; if (w.contact && w.slip > 0.32 && sim.speed > 1.5) marks.add(key, w.point, w.normal, w.front ? W.width_front : W.width_rear, Math.min(1, 0.25 + (w.slip - 0.32) * 0.7)); else marks.lift(key); });
}
function impacts() {
  phys.events.drainContactForceEvents((e) => {
    const mag = e.totalForceMagnitude(); if (mag < 9000) return;
    const c1 = phys.world.getCollider(e.collider1()), c2 = phys.world.getCollider(e.collider2()); if (!c1 || !c2) return;
    const mine = (c1.userData && c1.userData.car === car) || (c2.userData && c2.userData.car === car), sim = (c1.userData && c1.userData.car) || (c2.userData && c2.userData.car); if (!sim) return;
    let px = 0, py = 0, pz = 0, k = 0;
    phys.world.contactPair(c1, c2, (m) => { const n = m.numSolverContacts(); for (let i = 0; i < n; i++) { const q = m.solverContactPoint(i); px += q.x; py += q.y; pz += q.z; k++; } });
    if (k && sim.speed > 2.5) sparks.burst(px / k, py / k, pz / k, sim.vel.x, sim.vel.y, sim.vel.z, Math.min(60, Math.round(mag / 9000)), 4 + Math.min(8, sim.speed * 0.35));
    if (mine && S.shake) rig.shake(Math.min(0.85, mag / 3.2e5));
  });
}
let boostWas = false;
const input = new Input(canvas); input.isTouch = TOUCH; window.__rjInput = input;
const touch = TOUCH ? new Touch(input) : null;
const audio = new GameAudio(); audio.musicOn = S.music; audio.musicVol = S.musicVol; audio.sfxVol = S.sfxVol;
const rig = new CameraRig(camera, TUNING, (o, d, l) => phys.castFrom(o, d, l)); rig.sens = S.sens; rig.mode = S.cam;
const rec = new Recorder(), replay = new Replay(rec), ghost = new GhostCam();
const walker = new Walker(RAPIER, phys.world);
const groundHeight = (x, z, from) => phys.castDown(x, z, from);
const G = { driver, walker, scene, groundHeight, doorPulse: (c, open) => setDoor(open) };
const moves = new Moves(G);

ui.loading(0.94, 'Lighting');
for (let i = 0; i < 150; i++) { roadster.preStep(H, PARKED); for (const f of fleet) f.sim.preStep(H, PARKED); phys.step(); roadster.postStep(H); for (const f of fleet) f.sim.postStep(H); }
for (const f of fleet) { f.curr.fromSim(f.sim, 0, f.i + 1); f.prev.fromSim(f.sim, 0, f.i + 1); f.draw.fromSim(f.sim, 0, f.i + 1); f.asleep = true; f.sim.body.sleep(); }

const ev = { RUN1: 1e9, TOP1: 1e9, HOLD1: 1e9, DOWN1: 1e9, RUN2: 1e9, LIP: 1e9, LAND: 1e9, carS: null };
{
  const cube = new THREE.WebGLCubeRenderTarget(LOW ? 128 : 256, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(0.5, 1500, cube);
  cc.position.set(-6, 2.2, 3); view.root.visible = false;
  A.update(30, cc.position, { ...ev, RUN2: 0, LIP: 4, LAND: 7 }); cc.update(renderer, scene);
  scene.environment = new THREE.PMREMGenerator(renderer).fromCubemap(cube.texture).texture;
  view.root.visible = true;
  A.update(0, camera.position, ev);
}
if (qs.has('hide')) { const H = qs.get('hide').split(','); scene.traverse((o) => { const m = o.material; const haze = m && m.uniforms && m.uniforms.uK; const ground = o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 1400;
  if ((H.includes('haze') && haze) || (H.includes('ground') && ground) || (H.includes('sky') && o === A.sky) || (H.includes('truss') && o === A.truss) || (H.includes('deck') && o === A.deck)) o.visible = false; });
  if (H.includes('car')) view.root.visible = false; if (H.includes('carlights')) { for (const l of view.heads) l.visible = false; view.jetLight.visible = false; } if (H.includes('carmesh')) view.gltf.traverse((o) => { if (o.isMesh) o.visible = false; }); if (H.includes('avatar') && driver.root) driver.root.scale.setScalar(0.0001); }
const dynLights = [
  { type: 'point', obj: view.jetLight, pos: new THREE.Vector3(), col: new THREE.Color(0xb8e4ff), dist: 22 },
  { type: 'spot', obj: view.heads[0], wpos: new THREE.Vector3(), wdir: new THREE.Vector3(), col: new THREE.Color(0xe8f0ff), cos0: Math.cos(0.62), cos1: Math.cos(0.62 * 0.05) },
];
const smokeLights = A.lights.filter((L) => L.obj && !L.obj.isFake).concat(dynLights);

const prevP = new CarPose(), currP = new CarPose(), drawP = new CarPose();
const door = { t: 0, target: 0, close: 0 };
let inCar = false, started = false, paused = false, simT = 0, acc = 0, stepN = 0, frameT = 0;
let mv = { x: 0, z: 0, run: false, jump: false };
const ramp = { on: false, s: null, lastUpY: 1, lastOn: false, run: false, offT: 0 };
const events = { land: 0 };
const session = { jumps: 0, total: 0 };
let stopT = 0, lastHint = '', fly = null, viewShift = 1, frozen = false, zone = 'ramp', camOverride = null, travel = null, photo = null;
const showroom = new Showroom({ view, camera, audio, touch: TOUCH });
const SHOW_TGT = new THREE.Vector3(START.p[0], 0.62, START.p[2]);
const goals = new Goals(S.goals, (text, all) => ui.toast(all ? 'All film stunts done' : `Stunt done · ${text}`, 2.2));

const SITES = { ramp: { name: 'The Curl', sub: 'Suction up the wall, hang from the ceiling, launch off the lip' }, lineup: { name: 'The Lineup', sub: 'Five Teslas. Hold Space to ollie, arrows to kickflip' } };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const siteOf = (p) => (LINEUP.near({ x: p[0], z: p[2] }) ? 'lineup' : 'ramp');
function playerSpot(w) {
  const to = siteOf(w.p), home = to === 'lineup' ? LINEUP.start : START, ax = to === 'lineup' ? LINEUP.cx : 0, az = to === 'lineup' ? LINEUP.line : 0;
  if (w.p[1] > 1.6 || Math.hypot(w.p[0] - ax, w.p[2] - az) < 32) return { to, dst: home };
  let hx = w.v[0], hz = w.v[2];
  if (Math.hypot(hx, hz) < 1 && w.q) { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(...w.q)); hx = f.x; hz = f.z; }
  const l = Math.hypot(hx, hz) || 1; hx /= l; hz /= l;
  return { to, dst: { p: [w.p[0] - hz * 7 - hx * 4, 0.05, w.p[2] + hx * 7 - hz * 4], yaw: Math.atan2(hx, hz) } };
}
function flyTo(u) {
  const e = remotes.list.get(u), w = e && remotes.where(e);
  if (!w) { ui.toast('That player just left', 1.6); return; }
  const { to, dst } = playerSpot(w);
  startTravel({ to, dst, name: e.name });
}
function startTravel(target) {
  if (travel || fly || replay.active || moves.busy || !started || paused) return;
  const to = target ? target.to : zone === 'lineup' ? 'ramp' : 'lineup', dst = target ? target.dst : to === 'lineup' ? LINEUP.start : START;
  const from = inCar || !walker.active ? new THREE.Vector3(car.pos.x, car.pos.y + 0.8, car.pos.z) : new THREE.Vector3(walker.pos.x, walker.pos.y + 1.2, walker.pos.z);
  const H = new THREE.Vector3(Math.sin(dst.yaw), 0, Math.cos(dst.yaw)), B = new THREE.Vector3(dst.p[0], 0.8, dst.p[2]);
  const P0 = camera.position.clone(), away = P0.clone().sub(from).setY(0), ab = B.clone().sub(from).setY(0).normalize();
  if (away.lengthSq() < 0.25) away.copy(ab).negate(); away.normalize();
  const E = B.clone().addScaledVector(H, -7).add(new THREE.Vector3(0, 1.6, 0)), dist = from.distanceTo(B), alt = Math.min(90, 30 + dist * 0.06);
  const lat = new THREE.Vector3(-ab.z, 0, ab.x); if (lat.dot(P0.clone().sub(from)) < 0 || Math.abs(P0.z - from.z) < 0.5 && P0.z < 0) lat.negate();
  const P1 = P0.clone().addScaledVector(away, 8).addScaledVector(lat, 26).add(new THREE.Vector3(0, alt * 1.25, 0));
  const P2 = E.clone().addScaledVector(H, -Math.min(110, dist * 0.22)).addScaledVector(lat, 30).add(new THREE.Vector3(0, alt, 0));
  travel = { t: 0, dur: 4.6 + Math.min(1.6, dist / 300), to, dst, A: from, B, P: [P0, P1, P2, E], fov0: camera.fov, done: false, title: false, name: target ? target.name : null };
  rig.cut(); ui.toast(target ? `Flying to ${target.name}` : to === 'lineup' ? 'Flying out to the lineup' : 'Flying back to the curl', 1.6);
}
function arriveTravel(tv) {
  tv.done = true;
  if (!inCar) { walker.leave(); inCar = true; moves.cur = null; if (driver.root) { if (active) driver.root.visible = false; else driver.attach(view.seatRoot, false); } }
  door.target = 0; door.t = 0; door.close = 0;
  car.teleport(tv.dst.p, tv.dst.yaw, 0); car.fan = false;
  tricks.reset(); tricks.ceil = 0; tricks.ceilRun = 0;
  ev.RUN2 = ev.LIP = ev.LAND = 1e9; ramp.run = false; ramp.on = false; last.result = null;
  smoke.clear(); lineup.reset(); syncPoses(); acc = 0; zone = tv.to;
  rig.mode = S.cam; rig.cut(); applyCabin();
}
const _tv = { p: new THREE.Vector3(), d: new THREE.Vector3(), l: new THREE.Vector3(), a: new THREE.Vector3(), q: new THREE.Quaternion(), rp: new THREE.Vector3(), rq: new THREE.Quaternion() };
function travelCamera(dt) {
  const tv = travel, T = _tv;
  if (!paused) tv.t += dt;
  const u = clamp(tv.t / tv.dur, 0, 1), s = u * u * u * (u * (u * 6 - 15) + 10), [P0, P1, P2, P3] = tv.P, k1 = 1 - s;
  if (!tv.done && u >= 0.5) arriveTravel(tv);
  if (!tv.title && u >= 0.62) { tv.title = true; const st = SITES[tv.to]; if (tv.name) ui.place(tv.name, `At ${st.name}`); else ui.place(st.name, st.sub); }
  T.rp.copy(camera.position); T.rq.copy(camera.quaternion); const rigFov = camera.fov;
  T.p.set(0, 0, 0).addScaledVector(P0, k1 * k1 * k1).addScaledVector(P1, 3 * k1 * k1 * s).addScaledVector(P2, 3 * k1 * s * s).addScaledVector(P3, s * s * s);
  T.d.set(0, 0, 0).addScaledVector(P1.clone().sub(P0), 3 * k1 * k1).addScaledVector(P2.clone().sub(P1), 6 * k1 * s).addScaledVector(P3.clone().sub(P2), 3 * s * s);
  const w1 = smooth(0.14, 0.42, u);
  T.l.copy(tv.A).lerp(tv.B, w1);
  camera.position.copy(T.p); camera.up.set(0, 1, 0); camera.lookAt(T.l);
  const k = smooth(0.78, 1, u);
  if (k > 0) { camera.position.lerp(T.rp, k); camera.quaternion.slerp(T.rq, k); }
  const f1 = tv.fov0 + (46 - tv.fov0) * w1; camera.fov = f1 + (rigFov - f1) * k;
  if (u >= 1) { travel = null; rig.cut(); }
}

function setDoor(open) { door.target = open ? 1 : 0; audio.play(open ? 'door_open' : 'door_close', { gain: 0.6 }); }
const poseBuf = new Float32Array(CarPose.SIZE);
function syncPoses() {
  currP.fromSim(car, car === roadster ? door.t : 0, vidOf(car)); currP.write(poseBuf, 0); prevP.read(poseBuf, 0);
  rPose.curr.fromSim(roadster, door.t); rPose.prev.fromSim(roadster, door.t);
  for (const f of fleet) { f.curr.fromSim(f.sim, 0, f.i + 1); f.prev.fromSim(f.sim, 0, f.i + 1); }
  carObj.curr.pos.set(roadster.pos.x, roadster.pos.y, roadster.pos.z); carObj.curr.quat.set(roadster.q.x, roadster.q.y, roadster.q.z, roadster.q.w);
}
syncPoses();

const tricks = new Tricks((kind, d) => {
  if (kind === 'takeoff') { rec.mark('takeoff', simT, { fromCeil: d.fromCeil, lineup: !d.fromCeil && LINEUP.corridor(car.pos), dir: Math.sign(car.vel.x) || 1 }); if (d.fromCeil) { ev.LIP = simT; goals.hit('launch'); } }
  else if (kind === 'touch') { events.land = Math.max(events.land, clamp(d.v / 14, 0.1, 1)); if (S.shake) rig.shake(clamp((d.v - 3) / 14, 0, 0.7)); }
  else if (kind === 'land' || kind === 'crash') {
    rec.mark(kind, simT, { pos: { x: car.pos.x, z: car.pos.z } }); ev.LAND = simT; ramp.run = false;
    let nb = false;
    if (d.ok) {
      session.jumps++; session.total += d.total;
      if (d.total > 0) { myEvt.seq = (myEvt.seq + 1) % 1000; myEvt.t = performance.now(); myEvt.pts = Math.round(d.total); myEvt.text = evtText(d.names.slice(0, 3).join(' + ') || 'Jump'); }
      nb = online.improves('score', d.total);
      online.submit(S.name, { score: d.total, dist: Math.round(d.dist * 10) / 10, spin: d.rotDeg }).then(async (changed) => {
        if (!changed.includes('score') || !S.name) return;
        const rows = await online.top('score', 50), i = rows ? rows.findIndex((r) => r.uid === online.uid) : -1;
        if (i >= 0) ui.rank(`#${i + 1} on the Best jump leaderboard`);
      });
      if (d.names.some((n) => /flip \d/.test(n) && /Kick|Heel/.test(n))) goals.hit('kick');
      if (d.bull !== null) goals.hit('bull');
      if (d.lineup >= LINEUP.cars.length && d.roll >= 360) goals.hit('lineup');
    }
    ui.result(d, nb);
    last.result = d;
    if (door.target > 0.5 && inCar) door.close = 0.7;
  } else if (kind === 'hang') ui.toast(`Ceiling hang ${d.t.toFixed(1)} s`, 2);
  else if (kind === 'manual') {
    session.total += d.total;
    ui.result({ ok: true, names: [d.kind], quality: `${d.t.toFixed(1)} s on two wheels`, total: d.total, parts: [[d.kind, `${d.t.toFixed(1)} s`, Math.round(d.t * 180)]], mults: d.mult > 1 ? [[`Combo ×${d.combo}`, d.mult]] : [] }, false);
  }
});
const last = { result: null };
const fleetHome = (f) => Math.hypot(f.sim.pos.x - f.home.p[0], f.sim.pos.z - f.home.p[2]) < 2.5 && f.sim.up.y > 0.9;
tricks.over = (x, z) => {
  for (const f of fleet) {
    if (f.sim === car) continue;
    const c = LINEUP.cars[f.i], s2 = f.sim, yaw = s2.yaw(), co = Math.cos(yaw), si = Math.sin(yaw), dx = x - s2.pos.x, dz = z - s2.pos.z;
    const lx = dx * co - dz * si, lz = dx * si + dz * co;
    if (Math.abs(lx) < c.W / 2 + 0.15 && Math.abs(lz) < c.L / 2 + 0.15) return { i: f.i, top: s2.pos.y + c.top - LINEUP.y0 };
  }
  return null;
};
tricks.lineupSize = () => fleet.filter((f) => f.sim !== car && fleetHome(f)).length;

function laneAssist(inp) {
  if (!S.assist || !ramp.on || car.contacts < 2) return inp;
  if (car.gear === 'R' && car.fwdSpeed < -6.5 && !inp.throttle) inp = { ...inp, brake: 0, throttle: clamp((-car.fwdSpeed - 6.5) / 2.5, 0, 1) };
  if (Math.abs(inp.steer) > 0.05) return inp;
  const v = car.fwdSpeed, lz = car.left.z;
  if (Math.abs(lz) < 0.5 || Math.abs(v) < 0.5) return inp;
  const tgt = clamp(-0.22 * car.pos.z * Math.sign(v), -0.12, 0.12);
  const delta = -(car.fwd.z - tgt) / lz;
  return { ...inp, steer: clamp(2.2 * delta * Math.sign(v), -0.5, 0.5) };
}

function step(h) {
  const air = car.contacts < 2;
  let inp = inCar && !moves.busy && !travel ? input.controls(h, air) : PARKED;
  if (inCar) inp = laneAssist(inp);
  car.flight.assist = S.assist;
  if (car !== roadster) roadster.preStep(h, PARKED);
  car.preStep(h, inp);
  for (const f of fleet) {
    if (f.sim === car) continue;
    if (f.asleep) { if (f.sim.body.isSleeping()) continue; f.asleep = false; f.rest = 0; }
    f.sim.preStep(h, PARKED);
  }
  if (remotes.size) remotes.kinematic(stepClock, h);
  if (walker.active && !moves.busy) { walker.step(h, travel ? { x: 0, z: 0, run: false, jump: false } : mv, rig.footYaw); mv.jump = false; }
  phys.step();
  rampFollow();
  car.postStep(h);
  if (car !== roadster) roadster.postStep(h);
  for (const f of fleet) {
    if (f.sim === car || f.asleep) continue;
    f.sim.postStep(h);
    const s2 = f.sim; f.rest = s2.speed < 0.06 && s2.angW.len() < 0.06 && s2.contacts >= 3 ? f.rest + h : 0;
    if (f.rest > 1.2) { f.asleep = true; s2.body.sleep(); }
  }
  props.blast(jetList(), h);
  _mv.length = 0; _mv.push(mover(roadster, 2.7, 1.6)); for (const f of fleet) if (!f.asleep || f.sim === car) _mv.push(mover(f.sim, f.info.r, f.info.h)); if (remotes.size) remotes.movers(_mv, () => _mvPool[_mvI++ % _mvPool.length]); props.touch(_mv);
  impacts();
  tyreMarks(car, vidOf(car)); for (const f of fleet) if (f.sim !== car && !f.asleep) tyreMarks(f.sim, f.i + 1);
  const bst = car === roadster && car.thrusters.rear.some((n) => n.valve > 0.5); if (bst && !boostWas && inCar) rig.kick = 6; boostWas = bst;
  currP.write(poseBuf, 0); prevP.read(poseBuf, 0);
  currP.fromSim(car, car === roadster ? door.t : 0, vidOf(car));
  rPose.curr.write(poseBuf, 0); rPose.prev.read(poseBuf, 0); rPose.curr.fromSim(roadster, door.t);
  for (const f of fleet) { if (f.sim === car || f.asleep) continue; f.curr.write(poseBuf, 0); f.prev.read(poseBuf, 0); f.curr.fromSim(f.sim, 0, f.i + 1); }
  carObj.curr.pos.set(roadster.pos.x, roadster.pos.y, roadster.pos.z); carObj.curr.quat.set(roadster.q.x, roadster.q.y, roadster.q.z, roadster.q.w);
  let on = false; for (const w of car.wheels) if (w.contact && w.hitCollider && rampHandles.has(w.hitCollider.handle)) on = true;
  ramp.on = on;
  if (car.contacts >= 1) { ramp.lastOn = on; if (on) ramp.lastUpY = car.up.y; }
  const loc = on || car.contacts < 2 ? rampLocate(car.pos.x, car.pos.y, car.pos.z) : null;
  ramp.s = on && loc ? loc.s : null;
  if (on && loc.s > 0.5 && car.fwdSpeed > 4 && !ramp.run) { ramp.run = true; ev.RUN2 = simT; ev.LIP = 1e9; ev.LAND = 1e9; rec.mark('ramp', simT); }
  if (!on && car.contacts >= 2) { ramp.offT += h; if (ramp.offT > 1.5 && tricks.state === 'ground') ramp.run = false; } else ramp.offT = 0;
  if (on && car.up.y < -0.9 && car.contacts >= 3) goals.hit('ceil');
  if (tricks.ceil >= 5) goals.hit('hang');
  zone = LINEUP.near(inCar || !walker.active ? car.pos : walker.pos) ? 'lineup' : 'ramp';
  tricks.update(h, { contacts: car.contacts, onRamp: on, up: car.up, pos: car.pos, vel: car.vel, ang: car.angLocal, assist: S.assist, lastRampUpY: ramp.lastUpY, lastOnRamp: ramp.lastOn, door: inCar ? door.t : 0, speed: car.speed, wheels: car.wheels });
  if (++stepN % 2 === 0) rec.push(simT, currP);
  simT += h;
  if (car.pos.y < -30 || Math.abs(car.pos.x) > 1100 || Math.abs(car.pos.z) > 1100) reset();
}

const _mv = [], _mvPool = Array.from({ length: 12 }, () => ({ x: 0, y: 0, z: 0, r: 0, h: 0 }));
let _mvI = 0;
function mover(sim, r, h) { const m = _mvPool[_mvI++ % _mvPool.length]; m.x = sim.pos.x; m.y = sim.pos.y; m.z = sim.pos.z; m.r = r; m.h = h; return m; }
const _jets = Array.from({ length: 10 }, () => ({ o: new THREE.Vector3(), d: new THREE.Vector3(), k: 0 })), _jl = [], _jq = new THREE.Quaternion();
function jetList() {
  _jl.length = 0;
  _jq.set(car.q.x, car.q.y, car.q.z, car.q.w);
  car.thrusters.all.forEach((n, i) => {
    if (n.valve < 0.15) return;
    const j = _jets[i]; j.o.set(n.pos.x, n.pos.y, n.pos.z).applyQuaternion(_jq).add(car.pos); j.d.set(-n.dir.x, -n.dir.y, -n.dir.z).applyQuaternion(_jq); j.k = n.valve * n.thrustMax / 9000; _jl.push(j);
  });
  return _jl;
}

const CURV = (s) => (s > 0 && s < RAMP.S1 ? 1 / RAMP.R1 : s > RAMP.S2 && s < RAMP.S3 ? 1 / RAMP.R2 : 0);
const _rf = { q: new THREE.Quaternion(), up: new THREE.Vector3(), n: new THREE.Vector3(), t: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Vector3() };
function rampFollow() {
  const b = car.body, p = b.translation(), loc = rampLocate(p.x, p.y, p.z), F = _rf;
  const r = b.rotation(); F.q.set(r.x, r.y, r.z, r.w); F.up.set(0, 1, 0).applyQuaternion(F.q);
  F.n.set(loc.nx, loc.ny, 0); const align = F.up.dot(F.n);
  const band = loc.s > 0.15 && loc.s < RAMP.S4 - 0.35 && Math.abs(p.z) < RAMP.W / 2 - 0.15 && loc.h > -0.7 && loc.h < (car.ghost ? 1.2 : 0.6) && align > 0.55;
  car.ghostRamp(band);
  if (!band) return;
  const HMIN = -0.08, lv = b.linvel(), v = F.v.set(lv.x, lv.y, lv.z);
  F.t.set(Math.cos(loc.a), Math.sin(loc.a), 0);
  if (loc.h < HMIN) b.setTranslation({ x: p.x + F.n.x * (HMIN - loc.h), y: p.y + F.n.y * (HMIN - loc.h), z: p.z }, true);
  const vn = v.dot(F.n), vt = v.dot(F.t);
  if (loc.h < HMIN + 0.02 && vn < 0) { const vt2 = (vt < 0 ? -1 : 1) * Math.sqrt(vt * vt + vn * vn); b.setLinvel({ x: F.t.x * vt2, y: F.t.y * vt2, z: v.z }, true); }
  if (Math.abs(vt) > 12 || loc.h < HMIN + 0.01) {
    const err = Math.atan2(F.c.crossVectors(F.up, F.n).z, align), av = b.angvel();
    b.setAngvel({ x: av.x, y: av.y, z: CURV(loc.s) * vt + err * 18 }, true);
  }
}

function sendHome(f) { f.sim.teleport(f.home.p, f.home.yaw, 0); f.asleep = false; f.rest = 0; f.sim.body.wakeUp(); }
function reset() {
  if (travel) return;
  if (inCar && active) {
    for (const f of fleet) sendHome(f);
    const S0 = LINEUP.stage; if (roadster.pos.x > S0.x0 - 3 && roadster.pos.x < S0.x1 + 3 && roadster.pos.z > S0.z0 - 3 && roadster.pos.z < S0.z1 + 3) roadster.teleport(LINEUP.start.p, LINEUP.start.yaw, 0);
    props.reset(); lineup.reset(); tricks.reset(); smoke.clear(); rig.cut(); if (replay.active) stopReplay(); last.result = null; syncPoses(); ui.toast(`${active.info.name} back in the lineup`, 1.4); return; }
  const sp = zone === 'lineup' ? LINEUP.start : START;
  roadster.teleport(sp.p, sp.yaw, 0); for (const f of fleet) if (f.sim !== car || !inCar) sendHome(f);
  if (!inCar) setActive(null);
  lineup.reset(); props.reset();
  tricks.reset(); tricks.ceil = 0; tricks.ceilRun = 0;
  ev.RUN2 = ev.LIP = ev.LAND = 1e9; ramp.run = false; ramp.on = false;
  smoke.clear(); sparks.clear(); rig.cut(); if (replay.active) stopReplay();
  last.result = null;
  syncPoses();
  if (!inCar) { moves.cur = null; spawnFoot(); }
  ui.toast('Reset', 1);
}

function spawnFoot(near) {
  const L = !near && zone === 'lineup' ? LINEUP.start.foot : null;
  const p = near || (L ? new THREE.Vector3(L[0], L[1], L[2]) : new THREE.Vector3(-5.2, 0, -2.6));
  walker.enter(p.x, p.y + 0.02, p.z, near ? walker.yaw : 0.9);
  if (driver.root && driver.root.parent !== scene) driver.attach(scene, true);
  rig.mode = 'foot'; rig.footYaw = near ? rig.footYaw : 0.9; rig.cut();
}

function setActive(f) {
  const sim = f ? f.sim : roadster;
  if (car === sim) return;
  car = sim; active = f;
  if (f) { f.asleep = false; f.rest = 0; sim.body.wakeUp(); }
  tricks.reset(); ramp.on = false; ramp.run = false; rig.scale = f ? f.info.cam : 1; rig.cut();
  syncPoses();
}
function boardFleet(f) {
  setActive(f); walker.leave(); inCar = true; moves.cur = null;
  if (driver.root) driver.root.visible = false;
  rig.mode = S.cam; rig.cut(); applyCabin();
  audio.play('door_close', { gain: 0.5 });
  ui.toast(`${f.info.name} · E to get out`, 2);
}
function doorPoint(f) { const d = f.info.door, q = new THREE.Quaternion(f.sim.q.x, f.sim.q.y, f.sim.q.z, f.sim.q.w); return new THREE.Vector3(d[0], 0, d[2]).applyQuaternion(q).add(new THREE.Vector3(f.sim.pos.x, f.sim.pos.y, f.sim.pos.z)); }
function nearestRide() {
  let best = null, bd = 1e9;
  const wp = new THREE.Vector3(walker.pos.x, walker.pos.y, walker.pos.z);
  const dr = Math.hypot(roadster.pos.x - wp.x, roadster.pos.z - wp.z); if (dr < 3.4) { best = null; bd = dr - 0.6; }
  for (const f of fleet) { const p = doorPoint(f), d = Math.hypot(p.x - wp.x, p.z - wp.z); if (d < 2.6 && d < bd) { best = f; bd = d; } }
  return bd < 1e8 ? { f: best, d: bd } : null;
}
function board() {
  setActive(null);
  walker.leave(); inCar = true;
  if (driver.root) driver.attach(view.seatRoot, false);
  rig.mode = S.cam; rig.cut(); applyCabin();
  door.close = 1.1;
  if (started) goals.hit('in');
  if (started && !car.fan) ui.toast(TOUCH ? 'Tap F for suction, then drive up the ramp' : 'F for suction, then drive up the ramp', 3);
}

function tryEnter() {
  if (inCar || moves.busy || !walker.active) return;
  const n = nearestRide();
  if (n && n.f) { const s2 = n.f.sim; if (s2.up.y < 0.6 || s2.speed > 2) { ui.toast(s2.up.y < 0.6 ? 'It is on its roof' : 'Wait for it to stop', 1.4); return; } boardFleet(n.f); return; }
  const d = Math.hypot(roadster.pos.x - walker.pos.x, roadster.pos.z - walker.pos.z);
  if (d > 3.4 || roadster.up.y < 0.6 || roadster.speed > 2) { ui.toast(d > 3.4 ? 'Walk up to a car' : 'Wait for the car to stop', 1.4); return; }
  setActive(null);
  if (!avatarOk || !driver.anim || !moves.enter(carObj, board)) { setDoor(true); board(); }
}

function tryExit() {
  if (!inCar || moves.busy) return;
  if (car.speed > 1.5 || car.up.y < 0.85 || car.contacts < 3 || ramp.on) { ui.toast(ramp.on ? 'Get off the ramp first' : 'Stop the car to get out', 1.4); return; }
  if (!avatarOk) { ui.toast('Jurek stays in the car', 1.4); return; }
  if (active) {
    const p = doorPoint(active), gy = groundHeight(p.x, p.z, car.pos.y + 2.5); p.y = gy === null ? car.pos.y : gy;
    const yaw = Math.atan2(car.left.x, car.left.z);
    inCar = false; walker.enter(p.x, p.y + 0.02, p.z, yaw);
    if (driver.root) { driver.root.visible = true; driver.attach(scene, true); }
    rig.mode = 'foot'; rig.footYaw = car.yaw() + 0.9; rig.footPitch = 0.2; rig.cut(); applyCabin();
    audio.play('door_open', { gain: 0.5 });
    return;
  }
  const p = new THREE.Vector3(1.45, 0, -0.15).applyQuaternion(carObj.curr.quat).add(carObj.curr.pos);
  const gy = groundHeight(p.x, p.z, car.pos.y + 2.5); p.y = gy === null ? car.pos.y : gy;
  const yaw = Math.atan2(car.left.x, car.left.z);
  inCar = false; car.fan = false;
  walker.enter(p.x, p.y + 0.02, p.z, yaw);
  rig.mode = 'foot'; rig.footYaw = car.yaw() + 0.9; rig.footPitch = 0.2; rig.cut(); applyCabin();
  if (!moves.exit(carObj, p, yaw, () => { door.close = 1.6; })) { setDoor(true); driver.attach(scene, true); door.close = 2.1; }
}

function applyCabin() {
  const fpp = inCar && rig.mode === 'fpp' && !replay.active && !active;
  view.setCabin(fpp); if (driver.ready) driver.setHeadVisible(!fpp);
}

function startReplay() {
  if (rec.count < 30) return;
  const ok = replay.start('tv'); ui.hideResult();
  if (!ok) ui.toast('No jump yet, showing the last seconds', 1.8);
  if (!TOUCH && document.pointerLockElement) document.exitPointerLock();
  smoke.clear(); lineup.reset(); applyCabin();
  if (driver.root && driver.root.parent !== view.seatRoot && !walker.active) driver.attach(view.seatRoot, false);
}
const clips = new Clips({ canvas, audio, touch: TOUCH, toast: (t) => ui.toast(t, 1.6) });
const rpRec = document.getElementById('rpRec'), rpTag = document.getElementById('rpTag');
function startClip() {
  if (!replay.active || clips.recording || photo) return;
  if (!clips.supported) { ui.toast('This browser cannot record video', 2); return; }
  const big = !TOUCH && !LOW;
  clipSize = clipFmt === 'tall' ? (big ? [1080, 1920] : [720, 1280]) : (big ? [1920, 1080] : [1280, 720]);
  ghost.active = false; replay.mode = 'tv'; replay.paused = false; replay.t = replay.J.t0; replay.shot = null; replay.focusInit = false;
  smoke.clear(); sparks.clear(); lineup.reset(); rig.cut(); resize();
  document.body.classList.add('recording'); ui.el.replay.classList.add('rec'); rpRec.textContent = 'Stop'; rpTag.textContent = 'Rec';
  clips.start(clipSize[0], clipSize[1]); clipLastT = replay.t;
}
function endClip(keep) {
  if (!clips.recording) return null;
  const r = clips.stop(keep);
  clipSize = null; resize(); document.body.classList.remove('recording'); ui.el.replay.classList.remove('rec'); rpRec.textContent = 'Save clip'; rpTag.textContent = 'Replay';
  return r;
}
for (const b of document.querySelectorAll('#rpFmt button')) b.addEventListener('click', (e) => { e.stopPropagation(); clipFmt = b.dataset.v; for (const o of document.querySelectorAll('#rpFmt button')) o.classList.toggle('on', o === b); });
rpRec.addEventListener('click', (e) => { e.stopPropagation(); if (clips.recording) endClip(true); else startClip(); });
function stopReplay() { endClip(false); replay.stop(); ghost.active = false; smoke.clear(); lineup.reset(); rig.cut(); applyCabin(); }
function capturePhoto(rect) {
  return new Promise((res) => {
    const w = innerWidth, h = innerHeight, base = Math.max(2, window.devicePixelRatio || 1), need = rect ? 2160 / Math.max(rect.w, rect.h) : base;
    const cap = Math.min(Math.sqrt((TOUCH ? 4.2e6 : 8.3e6) / (w * h)), renderer.capabilities.maxTextureSize / Math.max(w, h)), pr = Math.max(1, Math.min(cap, Math.max(base, need)));
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    const b = renderer.getDrawingBufferSize(new THREE.Vector2()); post.resize(b.x, b.y);
    ghost.apply(camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    post.render(scene, camera, frameT);
    if (rect) {
      const k = b.x / w, cw = Math.round(rect.w * k), ch = Math.round(rect.h * k), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      cv.getContext('2d').drawImage(canvas, Math.round(rect.x * k), Math.round(rect.y * k), cw, ch, 0, 0, cw, ch);
      cv.toBlob((blob) => res(blob), 'image/png');
    } else canvas.toBlob((blob) => res(blob), 'image/png');
    resize();
  });
}
const photoMode = new PhotoMode({ post, ghost, touch: TOUCH, capture: capturePhoto, toast: (t) => ui.toast(t, 1.6) });
function openPhoto() {
  if (!started || paused || travel || fly || photo || showroom.active || clips.recording) return;
  photo = { rp: replay.active ? replay.paused : null, ghost: ghost.active };
  if (replay.active) replay.paused = true;
  if (!ghost.active) ghost.start(camera);
  const tp = new THREE.Vector3(...drawP.p); if (replay.active) tp.set(replay.pose.p[0], replay.pose.p[1], replay.pose.p[2]);
  photoMode.open(camera.position.distanceTo(tp)); ui.hideResult();
  ui.showHud(false); document.body.classList.add('photo-on');
  audio.setVolumes(S.musicVol, 0);
  if (document.pointerLockElement) document.exitPointerLock();
}
function closePhoto() {
  if (!photo) return;
  photoMode.close(); document.body.classList.remove('photo-on'); ui.showHud(true);
  if (replay.active) { replay.paused = photo.rp; ghost.active = photo.ghost; } else ghost.active = false;
  photo = null; rig.cut(); audio.setVolumes(S.musicVol, S.sfxVol);
  if (!TOUCH) input.requestLock();
}
photoMode.onExit = closePhoto;
function ghostMove() {
  const k = (c) => input.down.has(c), t = (c) => input.touch.has(c), St = input.stick;
  if (TOUCH) return { x: St.on ? St.x : 0, z: St.on ? St.y : 0, y: (t('KeyW') ? 1 : 0) - (t('KeyS') ? 1 : 0), fast: t('ShiftLeft') };
  return { x: (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0), z: (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), y: (k('KeyE') ? 1 : 0) - (k('KeyQ') ? 1 : 0), fast: k('ShiftLeft') || k('ShiftRight') };
}

function toggleMenu(on) {
  if (!started) return;
  if (on && clips.recording) endClip(true);
  paused = on; frozen = false; ui.menu(on, { sub: session.jumps ? `${session.jumps} jump${session.jumps > 1 ? 's' : ''} this session · ${session.total.toLocaleString('en-US')} pts` : 'No jumps yet this session' }); touch && touch.show(!on);
  if (!on && !TOUCH) input.requestLock();
}
ui.onResume = () => { if (started) toggleMenu(false); else ui.menu(false); };
ui.onOpenMenu = (tab) => ui.menu(true, { tab, title: 'Roadster Jump', sub: 'Settings, leaderboards and controls', resume: 'Close' });
ui.onReset = () => { toggleMenu(false); reset(); };
ui.onReplay = () => { toggleMenu(false); startReplay(); };
ui.onGoals = (v) => goals.setVisible(v);
ui.onFlyTo = (u) => { toggleMenu(false); flyTo(u); };
ui.players = () => {
  if (!net.on) return { on: false, mp: S.mp };
  const me = inCar || !walker.active ? car.pos : walker.pos, out = [];
  for (const e of remotes.list.values()) { const w = remotes.where(e); if (!w) continue; out.push({ u: e.u, name: e.name, site: SITES[siteOf(w.p)].name, ride: w.foot ? 'On foot' : w.vid > 0 ? LINEUP.cars[w.vid - 1].name : 'Roadster', d: Math.hypot(w.p[0] - me.x, w.p[2] - me.z) }); }
  out.sort((a, b) => a.d - b.d);
  return { on: true, room: net.room, me: mpName(), site: SITES[zone].name, list: out };
};
ui.onMp = (v) => { if (v) mpJoin(); else mpLeave(); ui.toast(v ? 'Multiplayer on' : 'Multiplayer off · playing solo', 1.6); };
ui.onRename = (n) => net.rename(n || mpName());
ui.onShowMode = (m) => showroom.setMode(m);
ui.onAssist = (v) => { ui.toast(v ? 'Flight assist on' : 'Flight assist off · ×1.5 points', 1.6); };
ui.onCam = (v) => { if (inCar) { rig.mode = v; rig.cut(); applyCabin(); } };
ui.onVolume = () => audio.setVolumes(S.musicVol, S.sfxVol);
ui.onSens = () => { rig.sens = S.sens; };
input.onLockChange = (locked) => { if (!locked && started && !paused && !photo && !replay.active && !TOUCH && !window.__rjTest) toggleMenu(true); };
canvas.addEventListener('click', () => { if (started && !paused && !photo && !replay.active && !TOUCH) input.requestLock(); });

function actions(dt) {
  const I = input;
  if (photo) { if (I.hit('KeyO') || I.hit('Escape')) closePhoto(); else if (I.hit('KeyH')) photoMode.toggleBar(); return; }
  if (started && !paused && I.hit('KeyO')) { openPhoto(); return; }
  if (I.hit('Escape')) { if (!started) { if (ui.menuOpen) ui.menu(false); } else if (TOUCH || !input.locked) toggleMenu(!paused); }
  if (!started) return;
  if (paused) return;
  if (replay.active) {
    if (I.hit('KeyP') || I.hit('Escape')) { stopReplay(); if (!TOUCH) input.requestLock(); }
    if (I.hit('KeyK')) { if (clips.recording) endClip(true); else startClip(); }
    if (I.hit('KeyC') && !clips.recording) { replay.mode = replay.mode === 'tv' ? 'free' : 'tv'; replay.shot = null; if (replay.mode === 'free') ghost.start(camera); else ghost.active = false; }
    if (replay.mode === 'free' && I.hit('Space')) replay.paused = !replay.paused;
    return;
  }
  if (travel) return;
  if (I.hit('KeyL')) { startTravel(); return; }
  if (I.hit('KeyE')) { if (inCar && !active && car.contacts < 2 && !moves.busy) { setDoor(door.target < 0.5); door.close = 0; } else if (inCar) tryExit(); else tryEnter(); }
  if (I.hit('KeyF') && inCar) { if (active) ui.toast(`The ${active.info.name} has no suction fan`, 1.4); else { car.fan = !car.fan; ui.toast(car.fan ? 'Suction on' : 'Suction off', 1.2); if (car.fan) goals.hit('fan'); } }
  if (I.hit('KeyG')) { S.goals = !S.goals; ui.save(); ui.syncGoals(); goals.setVisible(S.goals); }
  if (I.hit('KeyC') && inCar) { const order = ['chase', 'level', 'fpp']; S.cam = order[(order.indexOf(S.cam) + 1) % 3]; ui.save(); rig.mode = S.cam; rig.cut(); applyCabin(); }
  if (I.hit('KeyR')) reset();
  if (I.hit('KeyP')) startReplay();
  if (I.hit('KeyM')) { S.music = !S.music; audio.setMusic(S.music); ui.save(); ui.toast(S.music ? 'Music on' : 'Music off', 1); }
  if (I.hit('KeyT')) { S.assist = !S.assist; ui.save(); ui.syncAssist(); ui.onAssist(S.assist); }
}

function promptText() {
  if (replay.active) return '';
  if (!inCar && walker.active && !moves.busy) {
    const n = nearestRide();
    if (!n) return '';
    if (n.f) return n.f.sim.up.y > 0.6 ? `<b>E</b>Drive the ${n.f.info.name}` : '';
    return roadster.up.y > 0.6 ? '<b>E</b>Get in' : '';
  }
  if (inCar && !moves.busy) {
    const loc = rampLocate(car.pos.x, car.pos.y, car.pos.z);
    if (!active && !car.fan && car.fwdSpeed > 1 && car.pos.x > -14 && car.pos.x < 2 && Math.abs(car.pos.z) < 3 && car.up.y > 0.9 && loc.s < 3) return '<b>F</b>Suction is off. Turn it on to stick to the wall';
    if (!active && car.contacts >= 3 && LINEUP.approach(car.pos)) {
      const dir = car.pos.x < LINEUP.stage.x0 ? 1 : -1, vx = car.vel.x * dir, d = ((LINEUP.stage.x0 + LINEUP.stage.x1) / 2 - car.pos.x) * dir, lead = vx * 1.6;
      if (vx > 5) return d > lead + 5 ? '<b>Space</b>Get ready to ollie over the lineup' : d > lead - 5 ? '<b>Space</b>Now. Hold to ollie · ← → kickflip' : '<b>S</b>Too late to clear it. Brake';
    }
    if (!active && car.contacts === 0 && tricks.state === 'air' && tricks.air > 0.6 && tricks.air < 2.4 && door.target < 0.5 && session.jumps < 3) return '<b>E</b>Open the gullwing doors for style';
    if (!active && tricks.state === 'ground' && tricks.sinceLand < 1.6 && car.contacts >= 3 && car.speed > 4 && session.jumps < 3) return '<b>↓</b>Hold to ride a manual on the rear wheels';
    if (stopT > 2 && car.up.y > 0.85 && !ramp.on) return '<b>E</b>Get out';
  }
  return '';
}

const fpsBuf = []; let fpsT = 0, scaleT = 0, lastNow = performance.now();
const perf = { cpu: 0, phys: 0, smoke: 0, rend: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  if (window.__rjManual || (paused && frozen)) { lastNow = now; return; }
  const dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now; frameT += dt;
  const c0 = performance.now(); render(dt); frozen = paused; const cpu = performance.now() - c0; perf.cpu = perf.cpu * 0.95 + cpu * 0.05;
  fpsBuf.push(dt); if (fpsBuf.length > 90) fpsBuf.shift();
  scaleT += dt;
  if (scaleT > 2 && fpsBuf.length >= 60 && started && !qs.has('fixscale')) {
    scaleT = 0; const avg = fpsBuf.reduce((a, b) => a + b, 0) / fpsBuf.length;
    const target = LOW ? 1 / 40 : 1 / 52;
    if (avg > target * 1.12 && scale > 0.55) { scale = Math.max(0.55, scale - 0.08); resize(); }
    else if (avg < target * 0.8 && scale < 1) { scale = Math.min(1, scale + 0.05); resize(); }
  }
}

function render(dt, stepPhys = true) {
  actions(dt);
  const [mx, my, wh] = input.consumeMouse();
  input.dragOk = (ghost.active || !!photo) && !TOUCH;
  if (ghost.active) { ghost.look(mx, my, S.sens); ghost.wheel(wh); }
  else if (!showroom.active) rig.mouse(mx, my);
  if (showroom.active && wh) showroom.onWheel(wh);
  if (wh && rig.mode === 'foot' && !showroom.active) rig.footDist = clamp(rig.footDist * (1 + wh * 0.1), 2, 8);
  if (stepPhys && started && !paused && !photo && !replay.active) {
    const m = input.move(); m.jump = m.jump || mv.jump; mv = m;
    acc += dt; let n = 0; const p0 = performance.now();
    while (acc >= H && n < 10) { stepClock = p0 - (acc - H) * 1000; step(H); acc -= H; n++; }
    perf.phys = perf.phys * 0.95 + (performance.now() - p0) * 0.05;
    if (n === 10) acc = 0;
  }
  input.endFrame();
  if (door.close > 0) { door.close -= dt; if (door.close <= 0) setDoor(false); }
  door.t += Math.sign(door.target - door.t) * Math.min(Math.abs(door.target - door.t), dt / 0.9);
  stopT = inCar && car.speed < 0.5 ? stopT + dt : 0;
  let P;
  const scrub = replay.active && replay.mode === 'free' ? ((input.is('ArrowRight') ? 1 : 0) - (input.is('ArrowLeft') ? 1 : 0)) * dt * 2.5 : 0;
  if (showroom.active) P = showroom.update(dt, poseBuf);
  else if (replay.active) {
    P = replay.step(paused || photo ? 0 : dt, photo ? 0 : scrub);
    if (clips.recording) { if (replay.t < clipLastT - 0.05 || replay.progress() >= 0.998) endClip(true); else clipLastT = replay.t; }
  }
  else { drawP.lerp(prevP, currP, acc / H); if (car === roadster) drawP.door = door.t; P = drawP; }
  let RP = P;
  const pv = showroom.active ? 0 : Math.round(P.vid || 0);
  if (!showroom.active) {
    const k = acc / H;
    if (pv !== 0) { rPose.draw.lerp(rPose.prev, rPose.curr, k); rPose.draw.door = door.t; RP = rPose.draw; }
    for (const f of fleet) { let fp = f.draw; if (pv === f.i + 1) fp = P; else if (!f.asleep) f.draw.lerp(f.prev, f.curr, k); f.view.pose(fp.p, fp.q, fp.len, fp.spin, fp.steer, f.y0); }
  }
  { const lp = rampLocate(RP.p[0], RP.p[1], RP.p[2]); view.onRamp = lp.onDeck && lp.s > 1.5 && lp.h < 2.5; }
  props.sync();
  view.apply(RP, dt);
  if (showroom.active) showroom.afterApply();
  view.root.updateMatrixWorld(true);
  if (driver.ready && showroom.active && !fly) driver.root.visible = false;
  else if (driver.ready) {
    if (replay.active) { if ((!walker.active || inCar) && pv === 0) { driver.root.visible = true; if (driver.root.parent !== view.seatRoot) driver.attach(view.seatRoot, false); driver.pose(view.driverView, dt, {}); } else driver.root.visible = false; }
    else {
      driver.root.visible = true;
      if (moves.busy) moves.render(dt);
      else if (walker.active) { walker.interpolate(acc / H); if (driver.root.parent !== scene) driver.attach(scene, true); driver.walkPose(walker, dt, { ground: (x, z) => { const g = groundHeight(x, z, walker.pos.y + 1); return g === null ? walker.pos.y : g; }, camYaw: rig.footYaw }); }
      else if (active) driver.root.visible = false;
      else { if (driver.root.parent !== view.seatRoot) driver.attach(view.seatRoot, false); driver.pose(view.driverView, dt, {}); }
    }
  }
  if (showroom.active && !fly) { showroom.camPose(SHOW_TGT, camera.position); camera.up.set(0, 1, 0); camera.lookAt(SHOW_TGT); if (camera.fov !== 34) { camera.fov = 34; } }
  else if (replay.active) { if (ghost.active) { ghost.update(dt, ghostMove()); ghost.apply(camera); } else replay.camera(camera, dt, P); }
  else if (!inCar && (walker.active || moves.busy)) rig.foot(dt, moves.busy ? moves.w.pose : walker.pose);
  else {
    const pos = new THREE.Vector3(P.p[0], P.p[1], P.p[2]), quat = new THREE.Quaternion(P.q[0], P.q[1], P.q[2], P.q[3]);
    rig.car(dt, { pos, quat, vel: new THREE.Vector3(P.vx, P.vy, P.vz), contacts: P.contact[0] + P.contact[1] + P.contact[2] + P.contact[3], fwdSpeed: car.fwdSpeed, eye: active ? new THREE.Vector3(...active.info.seat).applyQuaternion(quat).add(pos) : view.eye(new THREE.Vector3()) });
  }
  if (S.shake && !replay.active && !photo && !travel && !showroom.active && started) rig.applyShake(dt);
  if (travel) travelCamera(dt);
  if (photo) { ghost.update(dt, ghostMove()); ghost.apply(camera); }
  if (camOverride) { const o = camOverride; camera.position.set(...o.pos); camera.up.set(0, 1, 0); camera.lookAt(...o.at); if (camera.fov !== o.fov) camera.fov = o.fov; }
  if (fly) {
    fly.t += dt; const u = Math.min(1, fly.t / fly.dur), e = u * u * u * (u * (u * 6 - 15) + 10);
    camera.position.lerpVectors(fly.pos, camera.position, e); camera.quaternion.slerpQuaternions(fly.quat, camera.quaternion, e); camera.fov = fly.fov + (camera.fov - fly.fov) * e;
    viewShift = 1 - e;
    if (u >= 1) { fly = null; showroom.finish(); viewShift = 0; }
  }
  const sx = (TOUCH ? 0.12 : 0.17) * viewShift;
  if (sx > 0.001) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * sx, 0, innerWidth, innerHeight); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  camera.near = rig.mode === 'fpp' && inCar && !replay.active && !showroom.active ? 0.03 : 0.08; camera.updateProjectionMatrix();
  if (showroom.active && !fly) { const lab = showroom.label(); ui.tip(!!lab && !ui.menuOpen, showroom.pointer.x, showroom.pointer.y, lab && lab[0], lab && lab[1]); }
  view.updateJets(camera, RP);
  if (started && net.on) { if (!replay.active && !photo) net.send(packMe(), roadster.speed > 0.2 || car.speed > 0.2 || (walker.active && walker.speed > 0.1) || door.t > 0.01 && door.t < 0.99); remotes.render(dt * (photo ? 0 : 1), performance.now(), camera, innerWidth, innerHeight, qs.get('smoke') !== '0' && !photo); }
  dynLights[0].pos.copy(view.jetLight.getWorldPosition(new THREE.Vector3()));
  view.heads[0].getWorldPosition(dynLights[1].wpos); dynLights[1].wdir.copy(view.heads[0].target.getWorldPosition(new THREE.Vector3())).sub(dynLights[1].wpos).normalize();
  if (!paused && !photo) sparks.update(dt * (replay.active ? replay.speed() : 1));
  marks.flush();
  if (!paused && !photo && qs.get('smoke') !== '0') { const s0 = performance.now(); smoke.fromCar(dt * (replay.active ? replay.speed() : 1), P, view, events); events.land = 0; smoke.update(dt * (replay.active ? replay.speed() : 1), camera, smokeLights); perf.smoke = perf.smoke * 0.95 + (performance.now() - s0) * 0.05; }
  const te = replay.active ? replay.t : simT;
  const loc = rampLocate(P.p[0], P.p[1], P.p[2]);
  ev.carS = (replay.active ? loc.onDeck && (P.contact[0] + P.contact[1] + P.contact[2] + P.contact[3]) > 0 : ramp.on) ? loc.s : null;
  A.update(te, camera.position, ev);
  placeLights(travel ? (travel.t / travel.dur > 0.3 ? travel.to : travel.to === 'lineup' ? 'ramp' : 'lineup') : Math.hypot(camera.position.x - LINEUP.cx, camera.position.z - LINEUP.line) < 250 ? 'lineup' : 'ramp');
  scene.fog.density = FOG * (travel ? 1 - 0.72 * Math.sin(Math.PI * clamp(travel.t / travel.dur, 0, 1)) : 1);
  lineup.update(paused || photo ? 0 : dt * (replay.active ? replay.speed() : 1), te, P, qs.get('smoke') !== '0' ? smoke : null, lightsAt === 'lineup' ? siteSpot : null);
  if (audio.ctx || !showroom.active) audio.update(dt, P, { cam: camera, rate: replay.active ? replay.speed() : 1, inside: inCar && rig.mode === 'fpp' && !replay.active, load: inCar && !replay.active ? car.load : 0 });
  if (inCar && rig.mode === 'fpp') view.screen.draw(P.speed / 0.44704, P.fan, S.assist);
  const pr = started && !travel ? promptText() : '';
  if (pr !== lastHint) { lastHint = pr; touch && touch.setEnter(/Get in/.test(pr) ? 'Get in' : /Drive the/.test(pr) ? 'Drive' : /Get out/.test(pr) ? 'Get out' : /gullwing/.test(pr) ? 'Doors' : null); }
  if (touch) { touch.setFan(car.fan); touch.setGo(zone === 'lineup' ? 'Ramp' : 'Lineup'); }
  radarHud(dt);
  if (started) ui.hud({ dt, mph: P.speed / 0.44704, gear: !inCar ? 'P' : car.gear === 'R' ? 'R' : car.parkedT > 1.2 ? 'P' : 'D', spool: car.fanSpool, hang: !replay.active && ramp.on && car.up.y < -0.7 ? tricks.ceil : 0, fan: car.fan, assist: S.assist, cam: inCar ? rig.mode : 'foot', go: zone === 'lineup' ? 'Ramp' : 'Lineup', valves: P.valve, live: replay.active ? null : tricks.live(), combo: comboHud(), power: powerHud(), att: attHud(), prompt: TOUCH ? (/Suction/.test(pr) ? 'Suction is off. Tap F to stick to the wall' : /Now\./.test(pr) ? 'Now. Hold Jets to ollie' : /ollie/.test(pr) ? 'Get ready to ollie over the lineup' : /Too late/.test(pr) ? 'Too late to clear it. Brake' : /manual/.test(pr) ? 'Pull the stick down to ride a manual' : '') : pr, online: net.count, session: session.jumps ? `${session.jumps} jump${session.jumps > 1 ? 's' : ''} · ${session.total.toLocaleString('en-US')} pts` : '', replay: replay.active ? { p: replay.progress(), mode: replay.mode } : null, touch: TOUCH, fps: qs.has('debug') ? `${Math.round(fpsBuf.length / Math.max(0.001, fpsBuf.reduce((a, b) => a + b, 0)))} fps · ${scale.toFixed(2)}x` : '' });
  const r0 = performance.now();
  if (window.__rjNoDraw) { perf.rend = 0; return; }
  if (qs.get('post') === '0') { renderer.setRenderTarget(null); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.render(scene, camera); } else post.render(scene, camera, frameT);
  perf.rend = perf.rend * 0.95 + (performance.now() - r0) * 0.05;
}

canvas.addEventListener('pointerdown', (e) => {
  if (!showroom.active || showroom.ending || ui.menuOpen) return;
  showroom.onDown(e.clientX, e.clientY); try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture unsupported */ }
  if (!audio.ctx) audio.unlock(TOUCH).then(() => { audio.setVolumes(S.musicVol, S.sfxVol); if (showroom.mode === 'play') document.getElementById('showHint').textContent = TOUCH ? 'Tap a part. Drag to turn it.' : 'Hover the car. Drag to turn it.'; });
});
canvas.addEventListener('pointermove', (e) => { if (showroom.active) showroom.onMove(e.clientX, e.clientY); });
canvas.addEventListener('pointerup', () => { if (showroom.active) showroom.onUp(); });
canvas.addEventListener('pointerleave', (e) => { if (showroom.active && e.pointerType === 'mouse') showroom.onLeave(); });

function powerHud() {
  if (!inCar || replay.active) return 0;
  const T = car.tu.powertrain, d = Math.abs(car.motorForce) / T.max_wheel_force, r = car.regenForce / Math.max(1, T.regen_force);
  return clamp(r > 0.02 ? -r : d, -1, 1);
}
function attHud() {
  if (!inCar || replay.active || car.contacts > 0) return null;
  const u = car.up, l = car.left, f = car.fwd;
  return { roll: Math.atan2(l.y, u.y) * 180 / Math.PI, pitch: Math.asin(clamp(f.y, -1, 1)) * 180 / Math.PI };
}
const radar = new Radar(document.getElementById('radar')), _cf = new THREE.Vector3(), _rp = [];
function radarHud(dt) {
  if (TOUCH || !started || photo || replay.active || travel || paused) return;
  camera.getWorldDirection(_cf); const me = inCar || !walker.active ? car.pos : walker.pos;
  _rp.length = 0; for (const e of remotes.list.values()) { const w = remotes.where(e); if (w) _rp.push({ x: w.p[0], z: w.p[2], name: e.name }); }
  radar.draw(dt, { x: me.x, z: me.z, yaw: Math.atan2(_cf.x, _cf.z) }, _rp);
}
function comboHud() {
  if (replay.active || !tricks.combo || tricks.state !== 'ground' || tricks.manualT > 0.4) return null;
  const left = clamp(1 - (tricks.t - tricks.lastTrick) / COMBO_GAP, 0, 1);
  return left > 0 ? { n: tricks.combo, mult: Math.min(3, 1 + 0.25 * tricks.combo), left } : null;
}
const within = (p, ms) => Promise.race([p, new Promise((res) => setTimeout(res, ms))]);
async function precompile() {
  const was = view.jetLight.visible;
  const rt = qs.get('post') === '0' ? null : post.RT, wide = new THREE.PerspectiveCamera(150, 1, 0.1, 1600); wide.position.set(car.pos.x - 4, 2.5, car.pos.z - 4); wide.lookAt(car.pos.x, 0.8, car.pos.z);
  for (const on of [true, false]) {
    view.jetLight.visible = on; renderer.setRenderTarget(rt);
    try { if (renderer.compileAsync) await within(renderer.compileAsync(scene, camera), 6000); else renderer.compile(scene, camera); } catch (e) { /* compile on first frame */ }
    const hidden = []; scene.traverse((o) => { if (!o.visible && !o.isLight) { hidden.push(o); o.visible = true; } });
    renderer.setRenderTarget(rt); renderer.render(scene, wide);
    for (const o of hidden) o.visible = false;
  }
  renderer.setRenderTarget(null); view.jetLight.visible = was;
}
await precompile();
ui.loading(1, 'Ready');
showroom.start(); ui.showTitle(); ui.playProgress(0.05, 'Loading Jurek');
document.getElementById('showHint').textContent = TOUCH ? 'Tap a part. Drag to turn it.' : 'Hover the car. Drag to turn it. Click for sound.';
requestAnimationFrame(frame);
ui.loaderDone();
const progT = setInterval(() => ui.playProgress(0.05 + avatarFrac * 0.85, `Loading Jurek ${Math.round(5 + avatarFrac * 85)}%`), 120);
await within(avatarLoad.then(() => true), 45000).then((done) => { if (!done) { avatarOk = false; console.warn('avatar timed out'); } });
clearInterval(progT);
if (avatarOk) spawnFoot(); else { inCar = true; rig.mode = S.cam; }
applyCabin();
ui.playProgress(0.95, 'Preparing');
await precompile();
function play(o = {}) {
  if (started) return;
  started = true; ui.hideStart(); ui.showHud(true); touch && touch.show(true);
  audio.unlock(TOUCH).then(() => audio.setVolumes(S.musicVol, S.sfxVol));
  if (!TOUCH && !o.instant) input.requestLock();
  mpJoin();
  showroom.end(); rig.cut(); rig.fov = camera.fov;
  if (o.instant) { showroom.finish(); viewShift = 0; } else fly = { t: 0, dur: 1.6, pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov };
  ui.toast(inCar ? 'F suction · Shift boost · Space jets' : (TOUCH ? 'Walk to the Roadster and tap Get in' : 'Walk to the Roadster · E to get in'), 3.2);
}
ui.ready(play);

window.__rj = {
  ready: true, perf, showroom, goals, Q, car: roadster, phys, view, rec, replay, tricks, ui, S, ev, ramp, driver, walker, lineup, LINEUP, renderer, scene, fleet,
  vehicle: () => car,
  drive: (i) => { if (inCar) { inCar = false; walker.enter(car.pos.x + 3, 0.02, car.pos.z, 0); } if (i === null) { setActive(null); board(); } else boardFleet(fleet[i]); },
  lineupStart: () => { zone = 'lineup'; reset(); },
  rampStart: () => { zone = 'ramp'; reset(); },
  openPhoto, closePhoto, photoMode, post, ghost, capturePhoto, props, net, remotes, marks, sparks, rig, clips, startClip, endClip, replay,
  travel: () => { startTravel(); return !!travel; },
  traveling: () => (travel ? { t: travel.t, dur: travel.dur, to: travel.to } : null),
  zone: () => zone,
  shot: (pos, at, fov = 40) => { camOverride = pos ? { pos, at, fov } : null; },
  play: () => { window.__rjTest = true; play({ instant: true }); },
  board: () => { if (!inCar) { moves.cur = null; door.target = 0; board(); } },
  input: (o) => { input.override = o ? { throttle: 0, brake: 0, steer: 0, boost: false, lift: false, pitch: 0, roll: 0, ...o } : null; },
  fan: (on) => { car.fan = on; },
  assist: (on) => { S.assist = on; },
  cam: (m) => { S.cam = m; rig.mode = m; rig.cut(); applyCabin(); },
  reset,
  sim: (sec) => { const n = Math.round(sec / H); for (let i = 0; i < n; i++) step(H); return window.__rj.state(); },
  manual: (on) => { window.__rjManual = on; },
  frame: (sec = 1 / 60, stepPhys = false) => { render(sec, stepPhys); },
  startReplay, stopReplay,
  recordAudio: (sec) => new Promise((res) => { const st = audio.tap(); if (!st) return res(null); const rec = new MediaRecorder(st, { mimeType: 'audio/webm' }), chunks = []; rec.ondataavailable = (e) => chunks.push(e.data); rec.onstop = async () => { const b = new Blob(chunks, { type: 'audio/webm' }), r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }; rec.start(); setTimeout(() => rec.stop(), sec * 1000); }),
  audio,
  offlineAudio: async (script) => {
    const SR = 44100, DUR = script.dur, off = new OfflineAudioContext(2, Math.ceil(SR * DUR), SR);
    audio.ctx = null; audio.vt = 0; audio.loops = new Map(); audio.buf = new Map(); audio.songSrc = null;
    await audio.unlock(false, off); audio.setVolumes(S.musicVol, S.sfxVol);
    window.__rjManual = true; window.__rjNoDraw = !script.draw; window.__rjTest = true; play({ instant: true });
    const marks = [];
    for (let f = 0; f < DUR * 60; f++) {
      audio.vt = f / 60;
      const st = window.__rj.state();
      const cmd = script.step(f / 60, st, window.__rj); if (cmd) marks.push([+(f / 60).toFixed(2), cmd]);
      render(1 / 60, true);
    }
    const buf = await off.startRendering();
    const n = buf.length, data = new Int16Array(n * 2), L = buf.getChannelData(0), R = buf.getChannelData(1);
    for (let i = 0; i < n; i++) { data[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767; data[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
    const hdr = new DataView(new ArrayBuffer(44)), w = (o, str) => { for (let i = 0; i < str.length; i++) hdr.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); hdr.setUint32(4, 36 + data.byteLength, true); w(8, 'WAVE'); w(12, 'fmt '); hdr.setUint32(16, 16, true); hdr.setUint16(20, 1, true); hdr.setUint16(22, 2, true); hdr.setUint32(24, SR, true); hdr.setUint32(28, SR * 4, true); hdr.setUint16(32, 4, true); hdr.setUint16(34, 16, true); w(36, 'data'); hdr.setUint32(40, data.byteLength, true);
    const blob = new Blob([hdr.buffer, data.buffer], { type: 'audio/wav' });
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    return { url, marks };
  },
  state: () => {
    const loc = rampLocate(car.pos.x, car.pos.y, car.pos.z);
    return { t: +simT.toFixed(3), pos: [car.pos.x, car.pos.y, car.pos.z].map((v) => +v.toFixed(2)), up: [car.up.x, car.up.y, car.up.z].map((v) => +v.toFixed(2)), speed: +car.speed.toFixed(2), contacts: car.contacts, onRamp: ramp.on, s: +loc.s.toFixed(2), fan: +car.fanSpool.toFixed(2), suck: Math.round(car.fanSuck), mode: car.flight.mode, trick: tricks.state, inCar, result: last.result };
  },
};
