// Roadster Jump tricks: tracks ceiling hang time on the ramp, takeoff, air time, body-axis rotation (kickflips and heelflips on roll, front and back flips on pitch, spins on yaw, with how much of it came after the apex), gullwing doors opened in flight, which Teslas of the lineup the car cleared, distance and touchdown, then names the jump (doubles and triples, late flips, bigspins and varials, gullwing), scores it (rotation, air, distance, ceiling, lineup, style, landing quality, assist-off bonus, combo), reports crashes, and scores manuals (rolling on the front or rear pair only) and the combo chain between tricks.
import { LINEUP } from './lineup.js';
const DEG = 180 / Math.PI;
export const COMBO_GAP = 3.5;

export class Tricks {
  constructor(onEvent) {
    this.on = onEvent;
    this.state = 'ground'; this.ceil = 0; this.ceilBest = 0; this.ceilRun = 0; this.t = 0;
    this.combo = 0; this.lastTrick = -99; this.manualT = 0; this.manualKind = null; this.sinceLand = 99;
    this.over = (x, z) => { const k = LINEUP.over(x, z); return k >= 0 ? { i: k, top: LINEUP.cars[k].top } : null; };
    this.lineupSize = () => LINEUP.cars.length;
    this.reset();
  }

  reset() {
    this.state = 'ground'; this.air = 0; this.roll = 0; this.pitch = 0; this.yaw = 0; this.lateRoll = 0; this.latePitch = 0; this.from = null; this.maxH = 0; this.touch = 0; this.settle = 0; this.vLand = 0;
    this.fromCeil = false; this.assistUsed = false; this.cleared = new Set(); this.doorAir = 0;
  }

  breakCombo() { this.combo = 0; this.lastTrick = -99; }

  chain() {
    this.combo = this.t - this.lastTrick < COMBO_GAP ? this.combo + 1 : 1;
    this.lastTrick = this.t;
    return Math.min(3, 1 + 0.25 * (this.combo - 1));
  }

  update(dt, s) {
    this.t += dt; this.sinceLand += dt;
    const onRamp = s.onRamp && s.contacts >= 2, was = this.ceil;
    if (onRamp && s.up.y < -0.7) { this.ceil += dt; this.ceilRun = Math.max(this.ceilRun, this.ceil); }
    else if (s.contacts >= 2 && !s.onRamp) { this.ceil = 0; if (this.state === 'ground') this.ceilRun = 0; }
    else if (onRamp) this.ceil = 0;
    if (was > 1.5 && this.ceil === 0 && s.contacts >= 2) this.on('hang', { t: was });
    if (this.combo && this.t - this.lastTrick > COMBO_GAP && this.manualT === 0 && this.state === 'ground') { this.combo = 0; this.on('comboEnd', {}); }
    if (this.state === 'ground') {
      this.manual(dt, s);
      if (s.contacts === 0) {
        this.endManual();
        this.state = 'pending'; this.air = 0; this.roll = this.pitch = this.yaw = 0; this.lateRoll = this.latePitch = 0; this.maxH = s.pos.y; this.doorAir = 0;
        this.from = { x: s.pos.x, y: s.pos.y, z: s.pos.z }; this.fromCeil = s.lastRampUpY < -0.5; this.fromRamp = s.lastOnRamp; this.ceilAtTakeoff = this.ceilRun; this.ceil = 0; this.assistUsed = s.assist;
      }
      return;
    }
    if (this.state === 'pending' || this.state === 'air') {
      if (s.contacts === 0) {
        this.air += dt;
        this.roll += s.ang.z * dt; this.pitch += s.ang.x * dt; this.yaw += s.ang.y * dt;
        if (s.pos.y < this.maxH - 0.05 && s.vel.y < 0) { this.lateRoll += Math.abs(s.ang.z) * dt; this.latePitch += Math.abs(s.ang.x) * dt; }
        this.maxH = Math.max(this.maxH, s.pos.y); this.hNow = s.pos.y;
        if (s.door > 0.5) this.doorAir += dt;
        const cx = s.pos.x + s.up.x * 0.55, cy = s.pos.y + s.up.y * 0.55, cz = s.pos.z + s.up.z * 0.55, o = this.over(cx, cz);
        if (o && cy > o.top + 0.35) this.cleared.add(o.i);
        if (s.assist) this.assistUsed = true;
        if (this.state === 'pending' && this.air > 0.35 && (this.maxH - Math.min(this.from.y, s.pos.y) > 1.2 || this.fromCeil)) { this.state = 'air'; this.on('takeoff', { fromCeil: this.fromCeil }); }
        this.vLand = s.vel.y;
        return;
      }
      if (this.state === 'pending') { if (s.contacts >= 2) this.reset(); return; }
      this.state = 'touch'; this.settle = 0; this.touchV = Math.min(this.vLand, s.vel.y); this.touchUp = s.up.y; this.touchAt = { x: s.pos.x, z: s.pos.z };
      this.on('touch', { v: -this.touchV });
      return;
    }
    if (this.state === 'touch') {
      this.settle += dt;
      if (s.contacts === 0 && this.settle < 0.25) { this.state = 'air'; return; }
      if (this.settle < 0.55) return;
      const ok = s.up.y > 0.65 && s.contacts >= 3;
      const dist = Math.hypot(this.touchAt.x - this.from.x, this.touchAt.z - this.from.z);
      const res = this.score(ok, dist, s);
      this.on(ok ? 'land' : 'crash', res);
      this.reset();
      this.sinceLand = 0;
    }
  }

  manual(dt, s) {
    const w = s.wheels, front = w && w[0].contact && w[1].contact && !w[2].contact && !w[3].contact, rear = w && w[2].contact && w[3].contact && !w[0].contact && !w[1].contact;
    const kind = s.speed > 3 && s.up.y > 0.3 ? (rear ? 'Manual' : front ? 'Nose manual' : null) : null;
    if (kind && (!this.manualKind || this.manualKind === kind)) { this.manualKind = kind; this.manualT += dt; if (this.manualT > 0.4) this.lastTrick = this.t; }
    else if (this.manualT > 0) this.endManual();
  }

  endManual() {
    const T = this.manualT, kind = this.manualKind;
    this.manualT = 0; this.manualKind = null;
    if (T < 0.8) return;
    const mult = this.chain();
    this.on('manual', { kind, t: T, mult, combo: this.combo, total: Math.round(T * 180 * mult) });
  }

  live() {
    if (this.manualT > 0.4) return { manual: this.manualKind, mt: this.manualT, combo: this.combo };
    if (this.state !== 'air' && this.state !== 'pending') return null;
    return { roll: Math.abs(this.roll) * DEG, pitch: Math.abs(this.pitch) * DEG, yaw: Math.abs(this.yaw) * DEG, air: this.air, heel: this.roll < 0, back: this.pitch < 0, h: Math.max(0, this.hNow || 0), combo: this.combo };
  }

  score(ok, dist) {
    const half = (a) => Math.round(Math.abs(a) * DEG / 180) * 180;
    const R = half(this.roll), Pt = half(this.pitch), Yw = half(this.yaw);
    const times = (n) => (n >= 1080 ? 'Triple ' : n >= 720 ? 'Double ' : '');
    const lateR = R >= 360 && this.lateRoll * DEG >= 270, lateP = Pt >= 360 && this.latePitch * DEG >= 270;
    const names = [];
    if (R >= 180) { const k = this.roll > 0 ? 'kickflip' : 'heelflip', t = times(R) + (lateR ? 'late ' : '') + k; names.push(`${t[0].toUpperCase()}${t.slice(1)} ${R}`); }
    if (Pt >= 360) { const k = this.pitch > 0 ? 'frontflip' : 'backflip', t = times(Pt) + (lateP ? 'late ' : '') + k; names.push(`${t[0].toUpperCase()}${t.slice(1)} ${Pt}`); }
    else if (Pt >= 180) names.push(`Half ${this.pitch > 0 ? 'frontflip' : 'backflip'}`);
    if (Yw >= 180) names.push(`Spin ${Yw}`);
    const big = R >= 360 && Yw >= 360, varial = Pt >= 360 && Yw >= 360, gull = this.doorAir > 0.3;
    if (big) names.push('Bigspin');
    if (varial) names.push('Varial');
    if (gull) names.push('Gullwing');
    if (this.fromCeil) names.unshift('Ceiling launch');
    const nl = this.cleared.size, all = nl >= this.lineupSize();
    if (nl) names.unshift(all ? 'Over the lineup' : `Over ${nl} Tesla${nl > 1 ? 's' : ''}`);
    const bull = ok ? Math.hypot(this.touchAt.x + 55, this.touchAt.z - 2) : 99;
    if (bull < 6) names.push('Bullseye');
    const rot = Math.abs(this.roll) + Math.abs(this.pitch) + Math.abs(this.yaw);
    const rotDeg = Math.round(rot * DEG);
    const v = -this.touchV;
    const quality = !ok ? 'Crash' : v < 4.5 && this.touchUp > 0.85 ? 'Perfect landing' : v < 9 ? 'Clean landing' : 'Hard landing';
    const qMul = !ok ? 0 : quality === 'Perfect landing' ? 1.5 : quality === 'Clean landing' ? 1.15 : 0.75;
    const pro = !this.assistUsed;
    const parts = [['Rotation', `${rotDeg}°`, rotDeg], ['Air time', `${this.air.toFixed(2)} s`, this.air * 120], ['Distance', `${dist.toFixed(1)} m`, dist * 12]];
    if (this.ceilAtTakeoff > 0.2) parts.push(['Ceiling hang', `${this.ceilAtTakeoff.toFixed(1)} s`, Math.min(this.ceilAtTakeoff, 20) * 40]);
    if (this.fromCeil) parts.push(['Ceiling launch', '', 250]);
    if (bull < 6) parts.push(['Bullseye', `${bull.toFixed(1)} m`, 300 + 1200 * (1 - bull / 6)]);
    if (nl) parts.push(['Lineup', `${nl} of ${this.lineupSize()}`, nl * 150 + (all ? 600 : 0)]);
    if (lateR || lateP) parts.push(['Late flip', '', 300]);
    if (big || varial) parts.push([big && varial ? 'Bigspin + varial' : big ? 'Bigspin' : 'Varial', '', big && varial ? 800 : 400]);
    if (gull) parts.push(['Gullwing', '', 300]);
    const base = parts.reduce((a, p) => a + p[2], 0);
    const mults = [];
    if (ok && qMul !== 1) mults.push([quality, qMul]);
    if (ok && pro) mults.push(['Assist off', 1.5]);
    let cm = 1;
    if (ok) { cm = this.chain(); if (cm > 1) mults.push([`Combo ×${this.combo}`, cm]); } else this.breakCombo();
    const total = Math.round(base * qMul * (pro ? 1.5 : 1) * cm);
    return { ok, names, quality, pro, rotDeg, roll: R, lineup: nl, air: this.air, dist, ceil: this.ceilAtTakeoff, maxH: this.maxH, total, landV: v, bull: bull < 6 ? bull : null, combo: this.combo, parts: parts.map((p) => [p[0], p[1], Math.round(p[2])]), mults };
  }
}
