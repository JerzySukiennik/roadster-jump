// Roadster Jump ghost camera: a free-flying camera fully detached from the car for the replay's free view and photo mode. Mouse (or drag) looks, WASD or the left stick flies, Q/E (Brake/Go on touch) go down and up, Shift (Boost) flies fast, the wheel sets the cruise speed and roll and FOV come from photo mode; velocity eases in and out like a drone and it never dips under the tarmac.
import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const Y = new THREE.Vector3(0, 1, 0);

export class GhostCam {
  constructor() {
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.roll = 0; this.fov = 50; this.speed = 8; this.active = false;
    this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._q = new THREE.Quaternion(); this._f = new THREE.Vector3(); this._r = new THREE.Vector3(); this._w = new THREE.Vector3();
  }

  start(cam) {
    this.pos.copy(cam.position); this.vel.set(0, 0, 0);
    this._e.setFromQuaternion(cam.quaternion, 'YXZ'); this.yaw = this._e.y; this.pitch = clamp(this._e.x, -1.5, 1.5); this.roll = 0;
    this.fov = cam.fov; this.active = true;
  }

  look(dx, dy, sens = 1) { const k = 0.0022 * sens; this.yaw -= dx * k; this.pitch = clamp(this.pitch - dy * k, -1.52, 1.52); }

  wheel(d) { if (d) this.speed = clamp(this.speed * (d > 0 ? 0.8 : 1.25), 0.6, 140); }

  update(dt, mv) {
    this._q.setFromEuler(this._e.set(this.pitch, this.yaw, 0, 'YXZ'));
    const f = this._f.set(0, 0, -1).applyQuaternion(this._q), r = this._r.set(1, 0, 0).applyQuaternion(this._q);
    const want = this._w.set(0, 0, 0).addScaledVector(f, mv.z).addScaledVector(r, mv.x).addScaledVector(Y, mv.y);
    if (want.lengthSq() > 1) want.normalize();
    want.multiplyScalar(this.speed * (mv.fast ? 3.5 : 1));
    this.vel.lerp(want, 1 - Math.exp(-dt * (want.lengthSq() > 0 ? 4 : 6)));
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y < 0.12) { this.pos.y = 0.12; if (this.vel.y < 0) this.vel.y = 0; }
  }

  apply(cam) {
    cam.position.copy(this.pos); cam.up.set(0, 1, 0);
    cam.quaternion.setFromEuler(this._e.set(this.pitch, this.yaw, this.roll, 'YXZ'));
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}
