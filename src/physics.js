// Roadster Jump physics world: Rapier at a fixed step, the tarmac, the curl ramp deck and static colliders mirroring the fixed arena structures (gantry towers and bridge, grandstand tiers, LED bar riser, floodlight towers, the lineup stage, its towers and power poles); loose props live in props.js. Ground and camera ray helpers.
import { RAMP, buildRampColliders } from './ramp.js';
import { GROUP, groups } from './sim/car.js';
import { lineupBoxes } from './lineup.js';

export class Physics {
  constructor(R, tuning) {
    this.R = R;
    this.world = new R.World({ x: 0, y: -tuning.gravity, z: 0 });
    this.world.timestep = 1 / tuning.physics_hz;
    this.events = new R.EventQueue(true);
    this.ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    this.staticGroups = groups(GROUP.STATIC, GROUP.CAR | GROUP.WALKER | GROUP.PROP);
    const W = this.world, sg = this.staticGroups;
    const ground = W.createCollider(R.ColliderDesc.cuboid(1200, 1, 1200).setTranslation(0, -1, 0).setFriction(1.0).setCollisionGroups(sg));
    ground.userData = { kind: 'ground' };
    this.rampCols = buildRampColliders(R, W, groups(GROUP.RAMP, GROUP.CAR | GROUP.WALKER | GROUP.PROP));
    this.box = (cx, cy, cz, hx, hy, hz, yaw = 0, kind = 'prop') => {
      const d = R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz).setFriction(0.7).setCollisionGroups(sg);
      if (yaw) d.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
      const c = W.createCollider(d); c.userData = { kind }; return c;
    };
    this.pole = (x, z, h, r) => { const c = W.createCollider(R.ColliderDesc.cylinder(h / 2, r).setTranslation(x, h / 2, z).setFriction(0.6).setCollisionGroups(sg)); c.userData = { kind: 'prop' }; return c; };
    this.props();
  }

  props() {
    const { box, pole } = this, Rm = RAMP, W2 = Rm.W / 2, TH = Rm.TH;
    const TX0 = Rm.R1 + TH + 0.8, TX1 = TX0 + 2.6, TZ = W2 - 0.35, XB0 = Rm.LIP_X - 0.8, YB0 = Rm.H + TH + 1.05, YB1 = YB0 + 1.5, ZB = 0.85;
    box((Rm.R1 + TH + TX1 + 0.15) / 2, YB1 / 2, 0, (TX1 + 0.15 - Rm.R1 - TH) / 2, YB1 / 2, TZ + 0.15, 0, 'truss');
    box((XB0 + TX1) / 2, (YB0 + YB1) / 2, 0, (TX1 - XB0) / 2, (YB1 - YB0) / 2, ZB + 0.1, 0, 'truss');
    const GS = { x0: -50, x1: -6, z0: -22, rows: 6, dz: 1.8, dy: 1.05 };
    for (let r = 0; r < GS.rows; r++) { const h = GS.dy * (r + 1); box((GS.x0 + GS.x1) / 2, h / 2, GS.z0 - GS.dz / 2 - r * GS.dz, (GS.x1 - GS.x0) / 2, h / 2, GS.dz / 2); }
    box((GS.x0 + GS.x1) / 2, (GS.dy * GS.rows + 3.2) / 2, GS.z0 - GS.rows * GS.dz - 0.15, (GS.x1 - GS.x0) / 2, (GS.dy * GS.rows + 3.2) / 2, 0.15);
    { const a = { x: -46, z: -12.5 }, b = { x: 2, z: -17 }, L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(-(b.z - a.z), b.x - a.x), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const ox = Math.sin(yaw) * -1.1, oz = Math.cos(yaw) * -1.1;
      box(mx + ox, 0.525, mz + oz, L / 2, 0.525, 1.1, yaw); }
    for (const [x, z, h] of [[-56, -8, 21], [-74, -22, 20], [-4, -27, 20], [-70, 34, 20]]) pole(x, z, h, 0.34);
    for (const [x, y, z, hx, hy, hz] of lineupBoxes()) box(x, y, z, hx, hy, hz, 0, 'lineup');
  }

  step() { this.world.step(this.events); }

  castDown(x, z, from, maxLen = 400) {
    const r = this.ray; r.origin.x = x; r.origin.y = from; r.origin.z = z; r.dir.x = 0; r.dir.y = -1; r.dir.z = 0;
    const h = this.world.castRay(r, maxLen, true, undefined, groups(GROUP.WALKER, GROUP.STATIC | GROUP.RAMP));
    return h ? from - h.timeOfImpact : null;
  }

  castFrom(o, d, len) {
    const r = this.ray; r.origin.x = o.x; r.origin.y = o.y; r.origin.z = o.z; r.dir.x = d.x; r.dir.y = d.y; r.dir.z = d.z;
    const h = this.world.castRay(r, len, true, undefined, groups(GROUP.WALKER, GROUP.STATIC | GROUP.RAMP));
    return h ? h.timeOfImpact : null;
  }
}

