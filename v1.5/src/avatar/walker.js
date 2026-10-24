// Roadster Jump on foot (from Roadster 88): Jurek's avatar as a Rapier kinematic character controller: camera-relative walk, run and jump, slopes and steps (he can walk up the foot of the ramp), landing thumps, and the nearest-car check for getting in.
import { GROUP, groups } from '../sim/car.js';

const WALK = 1.35, RUN = 5.8, JUMP = 4.6, G = 9.81, RADIUS = 0.3, HALF = 0.58;
export const PARKED = { throttle: 0, brake: 1, steer: 0, boost: false, lift: false, pitch: 0, roll: 0, park: true };

export class Walker {
  constructor(R, world) {
    this.R = R; this.world = world;
    this.active = false;
    this.pos = { x: 0, y: 0, z: 0 }; this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0; this.speed = 0; this.phase = 0; this.grounded = true; this.air = 0; this.tumble = 0; this.lock = 0;
    this.dead = false; this.swim = false;
    this.prev = { x: 0, y: 0, z: 0 }; this.curr = { x: 0, y: 0, z: 0 }; this.pose = { x: 0, y: 0, z: 0 };
    this.body = null; this.collider = null;
    this.ctl = world.createCharacterController(0.03);
    this.ctl.setUp({ x: 0, y: 1, z: 0 });
    this.ctl.setMaxSlopeClimbAngle(52 * Math.PI / 180);
    this.ctl.setMinSlopeSlideAngle(60 * Math.PI / 180);
    this.ctl.enableAutostep(0.45, 0.2, false);
    this.ctl.enableSnapToGround(0.45);
    this.onLand = null;
  }

  build(x, y, z) {
    const R = this.R;
    if (!this.body) {
      this.body = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + HALF + RADIUS, z));
      this.collider = this.world.createCollider(R.ColliderDesc.capsule(HALF, RADIUS).setCollisionGroups(groups(GROUP.WALKER, GROUP.STATIC | GROUP.CAR | GROUP.RAMP | GROUP.PROP)).setFriction(0.6), this.body);
      this.collider.userData = { kind: 'walker' };
    }
    this.body.setEnabled(true);
    this.body.setTranslation({ x, y: y + HALF + RADIUS, z }, true);
    this.body.setNextKinematicTranslation({ x, y: y + HALF + RADIUS, z });
  }

  enter(x, y, z, yaw) {
    this.build(x, y, z);
    this.active = true; this.yaw = yaw; this.speed = 0; this.phase = 0; this.tumble = 0; this.lock = 0;
    this.vel.x = this.vel.y = this.vel.z = 0;
    for (const k of ['prev', 'curr', 'pose', 'pos']) Object.assign(this[k], { x, y, z });
  }

  leave() { this.active = false; if (this.body) this.body.setEnabled(false); }

  step(dt, mv, camYaw) {
    if (!this.active) return;
    const free = this.lock <= 0;
    this.lock = Math.max(0, this.lock - dt);
    let mx = free ? mv.x : 0, mz = free ? mv.z : 0;
    const ml = Math.hypot(mx, mz);
    const target = (mv.run ? RUN : WALK) * Math.min(1, ml);
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const wx = fx * mz - fz * mx, wz = fz * mz + fx * mx, wl = Math.hypot(wx, wz);
    const want = wl > 1e-3 ? target : 0;
    const dirX = wl > 1e-3 ? wx / wl : 0, dirZ = wl > 1e-3 ? wz / wl : 0;
    const k = Math.min(1, dt * (this.grounded ? 10 : 2.5));
    this.vel.x += (dirX * want - this.vel.x) * k;
    this.vel.z += (dirZ * want - this.vel.z) * k;
    if (wl > 1e-3 && free) {
      let d = Math.atan2(dirX, dirZ) - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * (mv.run ? 9 : 7));
    }
    if (this.grounded && mv.jump && free) { this.vel.y = JUMP; this.grounded = false; }
    this.vel.y -= G * (this.vel.y < 0 ? 1.45 : 1) * dt;
    const fallV = this.vel.y;
    const t = this.body.translation();
    const desired = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    this.ctl.computeColliderMovement(this.collider, desired, undefined, groups(GROUP.WALKER, GROUP.STATIC | GROUP.CAR | GROUP.RAMP | GROUP.PROP));
    const m = this.ctl.computedMovement();
    const nx = t.x + m.x, ny = t.y + m.y, nz = t.z + m.z;
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    const was = this.grounded;
    this.grounded = this.ctl.computedGrounded();
    if (this.grounded && this.vel.y < 0) this.vel.y = 0;
    if (!was && this.grounded && this.air > 0.4 && this.onLand) this.onLand(Math.min(1, 0.25 + Math.max(0, -fallV - 6) * 0.06), { x: nx, y: ny, z: nz });
    this.air = this.grounded ? 0 : this.air + dt;
    if (desired.y > 0 && m.y < desired.y * 0.5) this.vel.y = Math.min(this.vel.y, 0);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    Object.assign(this.prev, this.curr);
    Object.assign(this.curr, { x: nx, y: ny - HALF - RADIUS, z: nz });
    Object.assign(this.pos, this.curr);
  }

  interpolate(alpha) {
    const p = this.prev, c = this.curr;
    this.pose.x = p.x + (c.x - p.x) * alpha; this.pose.y = p.y + (c.y - p.y) * alpha; this.pose.z = p.z + (c.z - p.z) * alpha;
  }
}
