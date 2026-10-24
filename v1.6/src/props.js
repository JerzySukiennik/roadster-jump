// Roadster Jump props: everything loose on the map (rig cases, floor moving heads, barrier segments, marker and street poles, work lights, the parked Film14 semi, the lineup's smoke cannons and road lamps) as Rapier bodies that stand fixed until a car comes close, a cold-gas jet hits them or another flying prop reaches them, then turn dynamic so they can be knocked over and blown around; synced to their meshes or instance matrices every frame and put back with R.
import * as THREE from 'three';
import { GROUP, groups } from './sim/car.js';

const vol = (s) => (s[0] === 'box' ? 8 * s[1] * s[2] * s[3] : 2 * Math.PI * s[2] * s[2] * s[1]);

export class Props {
  constructor(R, world) {
    this.R = R; this.world = world; this.list = [];
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._u = new THREE.Vector3(); this._d = new THREE.Vector3();
  }

  add(spec) {
    const R = this.R, home = { p: spec.p.clone(), q: spec.q.clone() };
    const bd = R.RigidBodyDesc.fixed().setTranslation(home.p.x, home.p.y, home.p.z).setRotation({ x: home.q.x, y: home.q.y, z: home.q.z, w: home.q.w }).setCanSleep(true).setLinearDamping(0.05).setAngularDamping(0.25);
    const body = this.world.createRigidBody(bd), total = spec.shapes.reduce((a, s) => a + vol(s), 0);
    let r = 0, y0 = 1e9, y1 = -1e9;
    for (const s of spec.shapes) { const box = s[0] === 'box', ox = box ? s[4] : s[3], oy = box ? s[5] : s[4], oz = box ? s[6] : s[5], hy = s[box ? 2 : 1]; r = Math.max(r, Math.hypot(ox, oz) + (box ? Math.hypot(s[1], s[3]) : s[2])); y0 = Math.min(y0, oy - hy); y1 = Math.max(y1, oy + hy); }
    for (const s of spec.shapes) {
      const d = s[0] === 'box' ? R.ColliderDesc.cuboid(s[1], s[2], s[3]).setTranslation(s[4], s[5], s[6]) : R.ColliderDesc.cylinder(s[1], s[2]).setTranslation(s[3], s[4], s[5]);
      d.setDensity(spec.mass / total).setFriction(0.65).setRestitution(0.12).setCollisionGroups(groups(GROUP.PROP, GROUP.STATIC | GROUP.CAR | GROUP.PROP | GROUP.RAMP | GROUP.WALKER));
      this.world.createCollider(d, body).userData = { kind: 'prop' };
    }
    const p = { ...spec, body, home, dirty: false, moved: false, live: false, r, y0, y1 };
    this.list.push(p);
    return p;
  }

  addGroup(g, shapes, mass) { g.updateMatrixWorld(true); return this.add({ g, shapes, mass, p: g.position.clone(), q: g.quaternion.clone() }); }

  wake(p) {
    if (p.live) return;
    p.live = true; p.moved = true;
    p.body.setBodyType(this.R.RigidBodyType.Dynamic, true); p.body.wakeUp();
  }

  touch(movers) {
    for (const p of this.list) {
      const t = p.body.translation();
      if (!p.live) {
        for (const m of movers) {
          const dx = t.x - m.x, dz = t.z - m.z, rr = p.r + m.r;
          if (dx * dx + dz * dz < rr * rr && m.y - 0.6 < t.y + p.y1 && m.y + m.h > t.y + p.y0) { this.wake(p); break; }
        }
      } else if (!p.body.isSleeping()) {
        const v = p.body.linvel(); if (v.x * v.x + v.y * v.y + v.z * v.z < 1) continue;
        for (const o of this.list) {
          if (o.live) continue;
          const u = o.body.translation(), dx = t.x - u.x, dz = t.z - u.z, rr = p.r + o.r + 0.6;
          if (dx * dx + dz * dz < rr * rr) this.wake(o);
        }
      }
    }
  }

  sync() {
    for (const p of this.list) {
      const b = p.body;
      if ((!p.live || b.isSleeping()) && !p.dirty) continue;
      p.dirty = false; p.moved = true;
      const t = b.translation(), r = b.rotation();
      if (p.g) { p.g.position.set(t.x, t.y, t.z); p.g.quaternion.set(r.x, r.y, r.z, r.w); }
      else if (p.inst) {
        this._m.compose(this._p.set(t.x, t.y, t.z), this._q.set(r.x, r.y, r.z, r.w), this._s);
        for (const im of p.inst) { im.setMatrixAt(p.i, this._m); im.instanceMatrix.needsUpdate = true; }
      }
      if (p.onMove) p.onMove(p, this._u.set(0, 1, 0).applyQuaternion(this._q.set(r.x, r.y, r.z, r.w)));
    }
  }

  reset() {
    for (const p of this.list) {
      if (!p.moved) continue;
      const b = p.body;
      if (p.live) { b.setBodyType(this.R.RigidBodyType.Fixed, false); p.live = false; }
      b.setTranslation({ x: p.home.p.x, y: p.home.p.y, z: p.home.p.z }, false); b.setRotation({ x: p.home.q.x, y: p.home.q.y, z: p.home.q.z, w: p.home.q.w }, false);
      p.dirty = true;
    }
    this.sync();
    for (const p of this.list) p.moved = false;
  }

  blast(jets, dt) {
    if (!jets.length) return;
    for (const p of this.list) {
      const t = p.body.translation();
      for (const j of jets) {
        const dx = t.x - j.o.x, dy = t.y - j.o.y, dz = t.z - j.o.z, along = dx * j.d.x + dy * j.d.y + dz * j.d.z;
        if (along < 0 || along > 9) continue;
        const rx = dx - j.d.x * along, ry = dy - j.d.y * along, rz = dz - j.d.z * along, rad = Math.sqrt(rx * rx + ry * ry + rz * rz), reach = 1.4 + along * 0.3;
        if (rad > reach) continue;
        const k = j.k * (1 - along / 9) * (1 - rad / reach) * 5200 * dt;
        this.wake(p);
        p.body.applyImpulse({ x: j.d.x * k + rx * k * 0.3, y: j.d.y * k * 0.4 + Math.abs(k) * 0.15, z: j.d.z * k + rz * k * 0.3 }, true);
      }
    }
  }
}
