// Multiplayer social check over ?mp=local: A kickflips over the lineup while B waits at the curl; B must get the trick in its feed and A's tag must pop the score, then B opens the Online tab, sees A at The Lineup and flies there with the Fly button. node mpsocial.mjs outDir [q]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/mpsocial', q = 'low'] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const ctx = await b.newContext({viewport: {width: 1100, height: 620}});
const pages = [await ctx.newPage(), await ctx.newPage()];
for (const [i, p] of pages.entries()) { p.on('pageerror', (e) => console.log('err' + i, e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('console' + i, m.text().slice(0, 160)); }); }
await Promise.all(pages.map((p) => p.goto((process.env.URL || 'http://127.0.0.1:8840/') + `?q=${q}&mp=local&fixscale`)));
await Promise.all(pages.map((p) => p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000})));
const [A, B] = pages;
await A.evaluate(() => { const R = window.__rj; R.S.name = 'Jurek A'; R.manual(true); R.play(); R.board(); R.lineupStart(); R.cam('level'); });
await B.evaluate(() => { const R = window.__rj; R.S.name = 'Kolega B'; R.manual(true); R.play(); R.board(); R.cam('chase'); });
const both = async (n) => { for (let i = 0; i < n; i++) { await A.evaluate(() => window.__rj.frame(1 / 60, true)); await B.evaluate(() => window.__rj.frame(1 / 60, true)); } };
await both(60);
for (let k = 0; k < 20 && !(await B.evaluate(() => window.__rj.remotes.size)); k++) { await both(10); await new Promise((r) => setTimeout(r, 200)); }
console.log('feed after join', await B.evaluate(() => document.getElementById('feed').innerText.replace(/\n/g, ' | ')));
const CX = await A.evaluate(() => window.__rj.LINEUP.cx);
let ph = 'run', tHop = 0, land = -1;
for (let f = 0; f < 60 * 14; f++) {
  const st = await A.evaluate(() => { window.__rj.frame(1 / 60, true); return window.__rj.state(); });
  if (f % 3 === 0) await B.evaluate(() => window.__rj.frame(1 / 20, true));
  if (ph === 'run') { await A.evaluate((t) => window.__rj.input({throttle: t}), Math.max(0, Math.min(1, (15 - st.speed) * 0.5))); if (CX - st.pos[0] < st.speed * 1.6) { ph = 'hop'; tHop = st.t; await A.evaluate(() => window.__rj.input({lift: true})); } }
  else if (ph === 'hop' && st.t - tHop > 0.75) { ph = 'roll'; await A.evaluate(() => window.__rj.input({roll: 1})); }
  else if (ph === 'roll' && st.t - tHop > 1.9) { ph = 'fall'; await A.evaluate(() => window.__rj.input({})); }
  else if (ph === 'fall' && st.contacts === 0 && st.pos[1] < 3) { ph = 'land'; await A.evaluate(() => window.__rj.input({lift: true})); }
  if (st.result && land < 0) { land = f; console.log('A result', JSON.stringify({ ok: st.result.ok, total: st.result.total, names: st.result.names })); }
  if (land >= 0 && f - land > 30) break;
}
await A.evaluate(() => window.__rj.input({brake: 1})); await both(90); await A.evaluate(() => window.__rj.input(null));
await new Promise((r) => setTimeout(r, 400)); await both(5);
console.log('B feed', await B.evaluate(() => document.getElementById('feed').innerText.replace(/\n/g, ' | ')));
console.log('B tag', await B.evaluate(() => { const e = [...window.__rj.remotes.list.values()][0]; return e ? `${e.tag.className} ${e.tag.innerText.replace(/\n/g, ' ')}` : 'none'; }));
await B.screenshot({path: `${out}/b_feed.jpg`, quality: 80, type: 'jpeg'});
await B.keyboard.press('Escape'); await both(3);
await B.click('#tabs button[data-tab="online"]'); await new Promise((r) => setTimeout(r, 1300));
console.log('B online tab', await B.evaluate(() => document.querySelector('.tab[data-tab="online"]').innerText.replace(/\n/g, ' | ')));
await B.screenshot({path: `${out}/b_online.jpg`, quality: 80, type: 'jpeg'});
await B.click('.pl-fly'); await both(2);
let n = 0; while (n++ < 600 && await B.evaluate(() => !!window.__rj.traveling())) { await B.evaluate(() => window.__rj.frame(1 / 30, true)); if (n === 60) await B.screenshot({path: `${out}/b_flying.jpg`, quality: 80, type: 'jpeg'}); }
await both(20);
const pa = await A.evaluate(() => [window.__rj.car.pos.x, window.__rj.car.pos.z]), pb = await B.evaluate(() => [window.__rj.car.pos.x, window.__rj.car.pos.z, window.__rj.zone()]);
console.log('after fly A', pa.map((v) => v.toFixed(1)).join(','), 'B', pb.map((v) => typeof v === 'number' ? v.toFixed(1) : v).join(','), 'dist', Math.hypot(pa[0] - pb[0], pa[1] - pb[1]).toFixed(1));
await B.screenshot({path: `${out}/b_arrived.jpg`, quality: 80, type: 'jpeg'});
await b.close();
