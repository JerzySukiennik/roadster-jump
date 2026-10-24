// Feature check: double kickflip with gullwing doors over the lineup, a manual after the landing, the ghost free-fly in the replay and photo mode with depth of field and a saved PNG. node features.mjs outDir [q]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/features', q = 'high'] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1280, height: 720}, acceptDownloads: true});
p.on('pageerror', (e) => console.log('err', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
await p.goto((process.env.URL || 'http://127.0.0.1:8840/') + `?q=${q}&fixscale`);
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; R.manual(true); R.play(); R.board(); R.lineupStart(); R.cam('level'); R.sim(0.3); });
await p.waitForTimeout(1200);
const F = (n = 1) => p.evaluate((n) => { for (let i = 0; i < n; i++) window.__rj.frame(1 / 60, true); return window.__rj.state(); }, n);
const results = [];
await p.exposeFunction('__note', (k, d) => results.push([k, d]));
await p.evaluate(() => { const R = window.__rj, f = R.tricks.on; R.tricks.on = (k, d) => { if (k === 'land' || k === 'crash' || k === 'manual') window.__note(k, { names: d.names || [d.kind], total: d.total, mults: d.mults }); f(k, d); }; });
const CX = await p.evaluate(() => window.__rj.LINEUP.cx);
let st, ph = 'run', tHop = 0;
for (let f = 0; f < 60 * 16; f++) {
  st = await F();
  if (ph === 'run') { const thr = Math.max(0, Math.min(1, (15 - st.speed) * 0.5)); await p.evaluate((t) => window.__rj.input({throttle: t}), thr); if (CX - st.pos[0] < st.speed * 1.6) { ph = 'hop'; tHop = st.t; await p.evaluate(() => window.__rj.input({lift: true})); } }
  else if (ph === 'hop' && st.t - tHop > 0.75) { ph = 'roll'; await p.evaluate(() => window.__rj.input({roll: 1})); await p.keyboard.press('KeyE'); }
  else if (ph === 'roll' && st.t - tHop > 0.75 + 2.2) { ph = 'fall'; await p.evaluate(() => window.__rj.input({})); }
  else if (ph === 'fall' && st.contacts === 0 && st.pos[1] < 3) { ph = 'land'; await p.evaluate(() => window.__rj.input({lift: true})); }
  else if (ph === 'land' && st.contacts >= 3) { ph = 'roll2'; await p.evaluate(() => window.__rj.input({throttle: 0.6})); }
  else if (ph === 'roll2' && results.length) { ph = 'manual'; tHop = st.t; await p.evaluate(() => window.__rj.input({throttle: 0.5, pitch: -1})); }
  else if (ph === 'manual' && st.t - tHop > 0.5 && f % 20 === 0) { const w = await p.evaluate(() => window.__rj.car.wheels.map((w) => w.contact ? 1 : 0).join('')); if (f % 60 === 0) console.log('manual wheels', w, st.speed.toFixed(1), st.up.map((v) => v.toFixed(2)).join(',')); if (st.t - tHop > 2.6) { ph = 'end'; await p.evaluate(() => window.__rj.input({throttle: 0.3})); } }
  else if (ph === 'end' && st.t - tHop > 4.5) break;
  if (ph === 'roll' && st.t - tHop > 1.6 && st.t - tHop < 1.62) await p.screenshot({path: `${out}/doors.jpg`, quality: 80, type: 'jpeg'});
}
for (const r of results) console.log('event', JSON.stringify(r).slice(0, 300));
await p.evaluate(() => { window.__rj.input(null); window.__rj.startReplay(); });
for (let i = 0; i < 90; i++) await F();
await p.keyboard.press('KeyC');
await F(2);
const c0 = await p.evaluate(() => { const g = window.__rj.ghost; return [g.active, g.pos.x, g.pos.y, g.pos.z]; });
await p.keyboard.down('KeyW'); await p.keyboard.down('KeyE');
for (let i = 0; i < 60; i++) await F();
await p.keyboard.up('KeyW'); await p.keyboard.up('KeyE');
const c1 = await p.evaluate(() => { const g = window.__rj.ghost; return [g.active, g.pos.x, g.pos.y, g.pos.z]; });
console.log('ghost', JSON.stringify(c0), '->', JSON.stringify(c1));
await p.screenshot({path: `${out}/ghost.jpg`, quality: 80, type: 'jpeg'});
await p.keyboard.press('KeyO'); await F(3);
await p.evaluate(() => { const R = window.__rj, s = document.getElementById('phBlur'); s.value = 70; s.dispatchEvent(new Event('input')); const fv = document.getElementById('phLook').querySelector('[data-v="film"]'); fv.click(); });
await F(3);
await p.screenshot({path: `${out}/photo.jpg`, quality: 85, type: 'jpeg'});
const blob = await p.evaluate(async () => { const bl = await window.__rj.capturePhoto(); return bl ? bl.size : 0; });
console.log('photo png bytes', blob, 'photo active', await p.evaluate(() => window.__rj.photoMode.active));
await p.keyboard.press('KeyO'); await F(2);
console.log('after exit', await p.evaluate(() => ({ photo: window.__rj.photoMode.active, ghost: window.__rj.ghost.active, dof: window.__rj.post.dof.on })));
await b.close();
