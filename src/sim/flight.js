// Roadster Jump flight computer (adapted from Roadster 88): maps player intent to cold-gas thrust: ground boost and retro, hop, ballistic air with rate control for flips and spins, lift, and the optional flight assist (stops the spin when the keys are released, rolls the wheels down before touchdown, turns lift into a soft-landing glide) through the control allocator.
import { V3, Quat, clamp, DEG, MPH } from './math.js';
import { Allocator } from './allocator.js';

export class FlightComputer {
  constructor(tuning, thrusters) {
    this.tu = tuning; this.T = tuning.thrusters; this.F = tuning.flight;
    this.th = thrusters;
    this.alloc = new Allocator(thrusters);
    this.mode = 'ground';
    this.assist = true;
    this.hopT = 0; this.hopReady = 0; this.groundedT = 0; this.airT = 0; this.prevLift = false;
    this.leveling = 0; this.timeToImpact = 99;
    this.wantF = new V3(); this.wantT = new V3();
    this._q = new Quat(); this._q2 = new Quat(); this._e = new V3(); this._v = new V3(); this._fw = new V3(); this._fwd = new V3(); this._lf = new V3();
  }

  update(dt, inp, s) {
    const T = this.T, F = this.F, th = this.th;
    const g = this.tu.gravity, m = s.mass;
    const grounded = s.contacts >= 2;
    if (grounded) { this.groundedT += dt; this.airT = 0; } else { this.airT += dt; this.groundedT = 0; }
    const liftEdge = inp.lift && !this.prevLift;
    this.prevLift = inp.lift;

    if (this.mode === 'ground') {
      if (liftEdge && grounded) { this.mode = 'hop'; this.hopT = 0; this.hopReady = 0; }
      else if (!grounded && this.airT > 0.12) this.mode = 'air';
    } else if (this.mode === 'hop') {
      this.hopT += dt;
      th.requestFront(); th.requestSide();
      if (th.deploy >= 0.5 || th.maxFront() <= 0) this.hopReady += dt;
      if (this.hopReady >= T.hop_tap_max_s && (!inp.lift || !grounded)) this.mode = grounded ? 'ground' : 'air';
    } else if (this.mode === 'air') {
      if (grounded && this.groundedT > 0.05) this.mode = 'ground';
    }

    const q = s.q, v = s.vel;
    const fwdW = this._fwd.set(0, 0, 1).applyQuat(q);
    const hv = Math.hypot(v.x, v.z);
    const fh = hv > 3 ? this._lf.set(v.x / hv, 0, v.z / hv) : Math.hypot(fwdW.x, fwdW.z) > 1e-3 ? this._lf.set(fwdW.x, 0, fwdW.z).normalize() : this._lf.set(1, 0, 0);
    const mph = s.speed / MPH;
    const gov = clamp((F.air_speed_governor_mph[1] - mph) / (F.air_speed_governor_mph[1] - F.air_speed_governor_mph[0]), 0, 1);
    const rearMax = th.maxRear(), frontMax = th.maxFront(), sideMax = th.maxSide();
    const fw = this._fw.set(0, 0, 0);
    const w = s.angLocal, I = s.inertia;
    this.wantT.set(0, 0, 0);
    this.leveling = 0;
    this.timeToImpact = v.y < -0.5 ? s.clearance / -v.y : 99;

    if (this.mode === 'ground') {
      const boost = inp.boost && !inp.brake, retro = inp.boost && inp.brake;
      this.alloc.clear();
      if (retro) th.requestFront();
      for (const n of th.rear) { n.cmdPitch = 0; n.cmdSide = 0; n.cmdValve = boost ? gov : 0; }
      for (const n of th.front) { n.cmdPitch = 0; n.cmdSide = 0; n.cmdValve = retro && s.fwdSpeed > 0.5 ? 1 : 0; }
      for (const n of th.side) { n.cmdPitch = 0; n.cmdSide = 0; n.cmdValve = 0; }
      return;
    }

    if (this.mode === 'hop') {
      fw.set(0, 1, 0).applyQuat(q).scale(rearMax + frontMax);
      if (inp.boost) fw.addScaled(fh, rearMax * gov);
      this.wantT.x = -I.pitch * F.rate_gain * w.x * 0.6;
      this.wantT.z = -I.roll * F.rate_gain * w.z * 0.6;
    } else {
      if (inp.boost) fw.addScaled(fh, rearMax * gov);
      const rot = { x: inp.pitch, y: inp.steer, z: inp.roll };
      const R = F.rate_deg_s, kr = F.rate_gain;
      const ax = [['x', 'pitch', R.pitch], ['y', 'yaw', R.yaw], ['z', 'roll', R.roll]];
      for (const [k, ik, rate] of ax) {
        const cmd = rot[k];
        if (Math.abs(cmd) > 0.05) this.wantT[k] = I[ik] * kr * (cmd * rate * DEG - w[k]);
        else if (this.assist) this.wantT[k] = -I[ik] * kr * w[k];
      }
      const upY = this._v.set(0, 1, 0).applyQuat(q).y;
      const near = this.timeToImpact < F.level_time_s || (s.clearance < 3.5 && v.y < 1);
      if (this.assist && (near || inp.lift) && Math.abs(inp.pitch) < 0.05 && Math.abs(inp.roll) < 0.05) {
        const yaw = Math.atan2(fwdW.x, fwdW.z);
        const lvl = Math.abs(fwdW.y) > 0.95 ? this._q2.setFromEulerYXZ(0, Math.atan2(v.x, v.z), 0) : this._q2.setFromEulerYXZ(0, yaw, 0);
        this._q.copy(q).conjugate().multiply(lvl);
        const e = this._q.toAxisAngleVec(this._e);
        this.wantT.x = I.pitch * (F.level_kp * e.x - F.level_kd * w.x);
        this.wantT.z = I.roll * (F.level_kp * e.z - F.level_kd * w.z);
        if (Math.abs(inp.steer) < 0.05) this.wantT.y = -I.yaw * kr * w.y;
        this.leveling = 1;
      }
      if (inp.lift) {
        if (this.assist) {
          const L = F.land_rate;
          const vzCmd = -Math.min(L[2], L[0] + L[1] * s.clearance);
          const az = clamp(3.4 * (vzCmd - v.y), -g * 0.95, 30);
          fw.y += m * (g + az) / Math.max(0.35, upY);
          if (upY < 0.2) fw.y = 0;
          const lat = this._v.set(v.x, 0, v.z);
          if (s.clearance < 6 && lat.len() > 0.5) fw.addScaled(lat, -m * 0.25);
        } else fw.copy(this._v.set(0, 1, 0).applyQuat(q)).scale(sideMax + rearMax + frontMax);
      }
    }

    const any = fw.lenSq() > 1 || Math.abs(this.wantT.x) + Math.abs(this.wantT.y) + Math.abs(this.wantT.z) > 1;
    if (any) {
      th.requestSide(); th.requestFront();
      this.wantF.copy(fw).applyQuatInv(q);
      this.alloc.solve(this.wantF, this.wantT, s.com);
    } else this.alloc.clear();
  }
}
