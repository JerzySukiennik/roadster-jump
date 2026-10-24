// Roadster Jump radar: a small heading-up map in the HUD corner with the curl ramp, the landing X, the lamp road, the lineup stage and its five cars, you as the arrow in the middle and every online player as a named dot; a site or player out of range sits on the rim with its distance, so the other site and your friends are always one glance away. Drawn on a 2D canvas a dozen times a second, only while it is visible.
import { RAMP } from './ramp.js';
import { LINEUP } from './lineup.js';

const RANGE = 120;

export class Radar {
  constructor(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.acc = 1; this.size = 0;
  }

  fit() {
    const r = this.c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), s = Math.round(r.width * dpr);
    if (s && s !== this.size) { this.size = s; this.c.width = this.c.height = s; this.dpr = dpr; }
    return !!s;
  }

  draw(dt, me, players) {
    this.acc += dt; if (this.acc < 1 / 14) return; this.acc = 0;
    if (!this.fit()) return;
    const g = this.g, S = this.size, C = S / 2, R = C - 2 * this.dpr, k = R / RANGE, d = this.dpr;
    const co = Math.cos(me.yaw), si = Math.sin(me.yaw);
    const P = (x, z) => { const dx = x - me.x, dz = z - me.z; return [C - (dx * co - dz * si) * k, C - (dx * si + dz * co) * k]; };
    g.clearRect(0, 0, S, S);
    g.save(); g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(10, 12, 16, 0.55)'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(255, 255, 255, 0.06)'; g.lineWidth = d;
    for (const rr of [RANGE / 3, RANGE * 2 / 3]) { g.beginPath(); g.arc(C, C, rr * k, 0, Math.PI * 2); g.stroke(); }
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255, 255, 255, 0.16)'; g.lineWidth = 9 * k + d; g.beginPath(); g.moveTo(...P(-60, 0)); g.lineTo(...P(LINEUP.cx + 60, 0)); g.stroke();
    g.strokeStyle = 'rgba(255, 255, 255, 0.75)'; g.lineWidth = RAMP.W * k + 1.5 * d; g.beginPath(); g.moveTo(...P(RAMP.LIP_X, 0)); g.lineTo(...P(RAMP.R1, 0)); g.stroke();
    g.strokeStyle = 'rgba(255, 255, 255, 0.55)'; g.lineWidth = 1.3 * d; const X = P(-55, 2), xs = 3 * d;
    g.beginPath(); g.moveTo(X[0] - xs, X[1] - xs); g.lineTo(X[0] + xs, X[1] + xs); g.moveTo(X[0] + xs, X[1] - xs); g.lineTo(X[0] - xs, X[1] + xs); g.stroke();
    const st = LINEUP.stage; g.fillStyle = 'rgba(255, 255, 255, 0.12)'; g.beginPath(); for (const [x, z] of [[st.x0, st.z0], [st.x1, st.z0], [st.x1, st.z1], [st.x0, st.z1]]) g.lineTo(...P(x, z)); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (const c of LINEUP.cars) { g.beginPath(); for (const [x, z] of [[c.x - c.W / 2, c.z - c.L / 2], [c.x + c.W / 2, c.z - c.L / 2], [c.x + c.W / 2, c.z + c.L / 2], [c.x - c.W / 2, c.z + c.L / 2]]) g.lineTo(...P(x, z)); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(255, 255, 255, 0.05)'; g.beginPath(); g.moveTo(C, C); g.arc(C, C, R, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); g.closePath(); g.fill();
    g.restore();
    const rim = (x, z, label, strong) => {
      const p = P(x, z), dx = p[0] - C, dy = p[1] - C, l = Math.hypot(dx, dy);
      if (l <= R - 5 * d) return p;
      const ux = dx / l, uy = dy / l, ex = C + ux * (R - 5 * d), ey = C + uy * (R - 5 * d);
      g.fillStyle = strong ? 'rgba(244, 246, 250, 0.95)' : 'rgba(244, 246, 250, 0.6)';
      g.beginPath(); g.moveTo(ex + ux * 4 * d, ey + uy * 4 * d); g.lineTo(ex - uy * 3 * d - ux * 2 * d, ey + ux * 3 * d - uy * 2 * d); g.lineTo(ex + uy * 3 * d - ux * 2 * d, ey - ux * 3 * d - uy * 2 * d); g.closePath(); g.fill();
      if (label) { const m = Math.hypot(x - me.x, z - me.z); g.font = `600 ${9 * d}px -apple-system, BlinkMacSystemFont, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${label} ${m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km'}`, C + ux * (R - 18 * d), C + uy * (R - 18 * d)); }
      return null;
    };
    rim(0, 0, Math.hypot(me.x, me.z) > RANGE ? 'Curl' : '', false);
    rim(LINEUP.cx, LINEUP.line, Math.hypot(me.x - LINEUP.cx, me.z - LINEUP.line) > RANGE ? 'Lineup' : '', false);
    for (const p of players) {
      const q = rim(p.x, p.z, p.name.split(' ')[0], true); if (!q) continue;
      g.fillStyle = '#f4f6fa'; g.beginPath(); g.arc(q[0], q[1], 3.2 * d, 0, Math.PI * 2); g.fill();
      g.font = `600 ${9 * d}px -apple-system, BlinkMacSystemFont, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(244, 246, 250, 0.85)'; g.fillText(p.name.slice(0, 10), q[0] + 6 * d, q[1]);
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(C, C - 7 * d); g.lineTo(C + 5 * d, C + 5 * d); g.lineTo(C, C + 2.5 * d); g.lineTo(C - 5 * d, C + 5 * d); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255, 255, 255, 0.16)'; g.lineWidth = d; g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.stroke();
  }
}
