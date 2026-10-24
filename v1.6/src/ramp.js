// Roadster Jump ramp: the Film14 curl profile (flat run-in, quarter pipe R1, curl R2 into a 15 m upside-down ceiling, lip at x = -15, deck width 4.2, profile in the XY plane, cars climb along +X), its Rapier collision built from convex deck segments, and a locator that maps any point to arc length and height above the deck.
export const RAMP = (() => {
  const R1 = 12.5, VERT = 0, R2 = 12.5, CEIL = 15, W = 4.2, PAD = 11, TH = 0.36;
  const S1 = R1 * Math.PI / 2, S2 = S1 + VERT, S3 = S2 + R2 * Math.PI / 2, S4 = S3 + CEIL;
  return { R1, VERT, R2, CEIL, W, PAD, TH, S1, S2, S3, S4, S_TOP: S3 + CEIL * 0.42, S_LIP: S4, H: R1 + VERT + R2, C2: [R1 - R2, R1 + VERT], LIP_X: R1 - R2 - CEIL };
})();

export function rampAt(s) {
  const { R1, R2, S1, S2, S3, C2 } = RAMP;
  if (s <= 0) return { x: s, y: 0, a: 0 };
  if (s <= S1) { const al = s / R1; return { x: R1 * Math.sin(al), y: R1 * (1 - Math.cos(al)), a: al }; }
  if (s <= S2) return { x: R1, y: R1 + (s - S1), a: Math.PI / 2 };
  if (s <= S3) { const ph = (s - S2) / R2; return { x: C2[0] + R2 * Math.cos(ph), y: C2[1] + R2 * Math.sin(ph), a: Math.PI / 2 + ph }; }
  return { x: C2[0] - (s - S3), y: C2[1] + R2, a: Math.PI };
}

const TABLE = (() => {
  const ds = 0.05, n = Math.ceil(RAMP.S4 / ds) + 1, xs = new Float32Array(n), ys = new Float32Array(n), ss = new Float32Array(n);
  for (let i = 0; i < n; i++) { const s = Math.min(RAMP.S4, i * ds), p = rampAt(s); xs[i] = p.x; ys[i] = p.y; ss[i] = s; }
  return { xs, ys, ss, n };
})();

export function rampLocate(x, y, z) {
  const { xs, ys, ss, n } = TABLE;
  let best = -1, bd = 1e9;
  for (let i = 0; i < n; i += 8) { const d = (xs[i] - x) ** 2 + (ys[i] - y) ** 2; if (d < bd) { bd = d; best = i; } }
  const lo = Math.max(0, best - 8), hi = Math.min(n - 1, best + 8);
  for (let i = lo; i <= hi; i++) { const d = (xs[i] - x) ** 2 + (ys[i] - y) ** 2; if (d < bd) { bd = d; best = i; } }
  let s = ss[best];
  if (x < 0 && y < 3) { s = Math.max(-RAMP.PAD - 30, x); }
  const p = rampAt(s), nx = -Math.sin(p.a), ny = Math.cos(p.a);
  const h = (x - p.x) * nx + (y - p.y) * ny;
  return { s, h, lat: z, nx, ny, a: p.a, onDeck: Math.abs(z) <= RAMP.W / 2 + 0.2 && s >= 0 && h > -RAMP.TH - 0.4 && h < 3 };
}

export function buildRampColliders(R, world, collisionGroups) {
  const { W, TH, S4 } = RAMP, step = 0.45, n = Math.ceil(S4 / step), out = [];
  for (let i = 0; i < n; i++) {
    const s0 = i * step, s1 = Math.min(S4, (i + 1) * step), pts = [];
    for (const s of [s0, s1]) {
      const p = rampAt(s), nx = -Math.sin(p.a), ny = Math.cos(p.a);
      for (const d of [0, -TH]) for (const z of [-W / 2, W / 2]) pts.push(p.x + nx * d, p.y + ny * d, z);
    }
    const desc = R.ColliderDesc.convexHull(new Float32Array(pts));
    if (!desc) continue;
    desc.setFriction(0.9).setRestitution(0.05).setCollisionGroups(collisionGroups);
    const col = world.createCollider(desc);
    col.userData = { kind: 'ramp', s0, s1 };
    out.push(col);
  }
  return out;
}
