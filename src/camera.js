// Roadster Jump camera rig: chase cam that rolls with the car over the curl (the ramp stays "down"), chase cam with a level horizon (the car hangs upside down on the ceiling), cockpit view from Eye_Driver (or the seat of the Tesla being driven), a per-vehicle chase distance, the on-foot orbit cam, mouse orbit with auto-recentre, speed FOV and collision against the ramp and props.
import * as THREE from 'three';

const Y = new THREE.Vector3(0, 1, 0);
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const _ax = new THREE.Vector3();
function turnToward(v, target, t, fallback) {
  const d = Math.max(-1, Math.min(1, v.dot(target))), ang = Math.acos(d);
  if (ang < 1e-5) return v.copy(target);
  _ax.crossVectors(v, target);
  if (_ax.lengthSq() < 1e-10) _ax.copy(fallback).addScaledVector(v, -fallback.dot(v));
  if (_ax.lengthSq() < 1e-10) _ax.set(1, 0, 0).addScaledVector(v, -v.x);
  return v.applyAxisAngle(_ax.normalize(), ang * t).normalize();
}

export class CameraRig {
  constructor(camera, tuning, castFrom) {
    this.cam = camera; this.tu = tuning; this.cast = castFrom;
    this.mode = 'chase';
    this.offset = new THREE.Vector3(0, 2, -6); this.up = new THREE.Vector3(0, 1, 0); this.head = new THREE.Vector3(1, 0, 0);
    this.orbitYaw = 0; this.orbitPitch = 0; this.idle = 9; this.init = false; this.fov = tuning.camera.fov;
    this.footYaw = 0; this.footPitch = 0.25; this.footDist = 3.4; this.lookYaw = 0; this.lookPitch = 0;
    this.right = new THREE.Vector3(1, 0, 0);
    this.sens = 1; this.scale = 1; this.shakeA = 0; this.shakeT = 0; this.kick = 0;
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._c = new THREE.Vector3(); this._d = new THREE.Vector3(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
  }

  cut() { this.init = false; }

  mouse(dx, dy) {
    const k = 0.0025 * this.sens;
    if (this.mode === 'foot') { this.footYaw -= dx * k; this.footPitch = Math.max(-0.5, Math.min(1.2, this.footPitch + dy * k)); return; }
    if (this.mode === 'fpp') { this.lookYaw = Math.max(-2.2, Math.min(2.2, this.lookYaw - dx * k)); this.lookPitch = Math.max(-1, Math.min(1, this.lookPitch - dy * k)); if (dx || dy) this.idle = 0; return; }
    if (dx || dy) { this.orbitYaw -= dx * k; this.orbitPitch = Math.max(-0.6, Math.min(1.1, this.orbitPitch + dy * k)); this.idle = 0; }
  }

  basis(pos, target, upRef) {
    const f = this._a.subVectors(target, pos).normalize();
    let r = this._b.crossVectors(f, upRef);
    if (r.lengthSq() < 0.04) r.copy(this.right).addScaledVector(f, -this.right.dot(f));
    r.normalize(); this.right.copy(r);
    const u = this._c.crossVectors(r, f).normalize();
    this._m.makeBasis(r, u, f.clone().negate());
    this.cam.position.copy(pos); this.cam.quaternion.setFromRotationMatrix(this._m);
  }

  car(dt, s) {
    const C = this.tu.camera;
    const q = s.quat, p = s.pos, carUp = this._d.set(0, 1, 0).applyQuaternion(q).clone(), carFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    this.idle += dt;
    if (this.idle > C.recentre_after_s) { this.orbitYaw *= 1 - damp(2.5, dt); this.orbitPitch *= 1 - damp(2.5, dt); }
    if (this.mode === 'fpp') return this.fpp(dt, s);
    const air = s.contacts < 2;
    this.airT = air ? (this.airT || 0) + dt : 0;
    const early = air && this.airT < 0.7;
    const sp = s.vel.length();
    const wantUp = air ? Y : carUp;
    let h = carFwd;
    if (air && sp > 3) h = s.vel.clone().normalize();
    else if (s.fwdSpeed < -2) h = carFwd;
    if (!this.init) { this.up.copy(wantUp); this.head.copy(h); }
    turnToward(this.up, wantUp, damp(early ? 0.9 : air ? 2.2 : 7, dt), carFwd);
    turnToward(this.head, h, damp(early ? 1.6 : air ? 3 : 9, dt), this.up);
    const up = this.up;
    const hh = this._b.copy(this.head).addScaledVector(up, -this.head.dot(up));
    if (hh.lengthSq() < 1e-3) hh.copy(carFwd).addScaledVector(up, -carFwd.dot(up));
    hh.normalize();
    const dist = C.chase_distance * (1 + 0.15 * Math.min(1, sp / 40)) * this.scale, hgt = C.chase_height * this.scale;
    const back = hh.clone().negate().applyAxisAngle(up, this.orbitYaw);
    const side = new THREE.Vector3().crossVectors(up, back).normalize();
    back.applyAxisAngle(side, -this.orbitPitch * 0.8);
    const want = back.multiplyScalar(dist).addScaledVector(up, hgt + this.orbitPitch * 1.5);
    if (!this.init) this.offset.copy(want);
    this.offset.lerp(want, damp(early ? 1.8 : air ? 4 : 6, dt));
    const target = p.clone().addScaledVector(carUp, 0.85 * this.scale);
    let pos = target.clone().add(this.offset);
    const d = pos.clone().sub(target), L = d.length();
    if (this.cast && L > 0.1) { const t = this.cast(target, d.multiplyScalar(1 / L), L); if (t !== null) pos = target.clone().addScaledVector(d, Math.max(0.6, t - 0.35)); }
    if (pos.y < 0.25 && p.y < 3) pos.y = 0.25;
    this.init = true;
    const fw = Math.min(1, sp / 0.44704 / C.fov_full_at_mph);
    this.setFov(C.fov + (C.fov_max - C.fov) * fw * fw + this.kick, dt); this.kick *= Math.exp(-dt * 2.5);
    this.basis(pos, target, this.mode === 'level' ? Y : this.up);
  }

  fpp(dt, s) {
    const eye = s.eye, q = s.quat;
    if (this.idle > 2.5) { this.lookYaw *= 1 - damp(2, dt); this.lookPitch *= 1 - damp(2, dt); }
    this.cam.position.copy(eye);
    this._q.setFromEuler(new THREE.Euler(this.lookPitch - 0.08, this.lookYaw + Math.PI, 0, 'YXZ'));
    this.cam.quaternion.copy(q).multiply(this._q);
    this.setFov(68, dt);
    this.init = true;
  }

  foot(dt, w) {
    const target = new THREE.Vector3(w.x, w.y + 1.45, w.z);
    const dir = new THREE.Vector3(Math.sin(this.footYaw) * Math.cos(this.footPitch), -Math.sin(this.footPitch), Math.cos(this.footYaw) * Math.cos(this.footPitch));
    let pos = target.clone().addScaledVector(dir, -this.footDist);
    if (this.cast) { const t = this.cast(target, dir.clone().negate(), this.footDist); if (t !== null) pos = target.clone().addScaledVector(dir, -Math.max(0.4, t - 0.25)); }
    if (pos.y < 0.2) pos.y = 0.2;
    this.setFov(60, dt);
    this.basis(pos, target, Y);
    this.init = true;
  }

  shake(a) { this.shakeA = Math.min(1, Math.max(this.shakeA, a)); }

  applyShake(dt) {
    if (this.shakeA < 0.002) return;
    this.shakeT += dt; const a = this.shakeA, t = this.shakeT, n = (f, p) => Math.sin(t * f + p) * 0.6 + Math.sin(t * f * 2.31 + p * 1.7) * 0.4;
    this.cam.rotateX(n(31, 0.3) * a * 0.03); this.cam.rotateY(n(27, 1.9) * a * 0.026); this.cam.rotateZ(n(23, 4.1) * a * 0.022);
    this.cam.position.y += n(37, 2.7) * a * 0.045;
    this.shakeA *= Math.exp(-dt * 5.5);
  }

  setFov(f, dt) { this.fov += (f - this.fov) * damp(4, dt); if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); } }

  get yaw() { const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cam.quaternion); return Math.atan2(f.x, f.z); }
}
