// Fleet check: Jurek drives the Semi and the Cybertruck off the stage (chase frames), rams the Cybertruck into the parked Model Y, gets out on foot, R sends the cars home, and the Roadster's lineup jump still counts all five. node fleet.mjs outDir [q]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/fleet', q = 'high'] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1280, height: 720}});
p.on('pageerror', (e) => console.log('err', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
await p.goto((process.env.URL || 'http://127.0.0.1:8840/') + `?q=${q}&fixscale`);
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; R.manual(true); R.play(); R.lineupStart(); });
await p.waitForTimeout(1200);
const F = (n = 1) => p.evaluate((n) => { for (let i = 0; i < n; i++) window.__rj.frame(1 / 60, true); const v = window.__rj.vehicle(); return { pos: [v.pos.x, v.pos.y, v.pos.z].map((x) => +x.toFixed(2)), speed: +v.speed.toFixed(2), up: +v.up.y.toFixed(2), contacts: v.contacts, inCar: window.__rj.state().inCar }; }, n);
for (const [i, name, steer] of [[2, 'semi', 0.0], [3, 'ct', 0.25]]) {
  await p.evaluate((i) => { const R = window.__rj; R.drive(i); R.cam('chase'); R.input({ throttle: 0.0 }); }, i);
  console.log(name, 'start', JSON.stringify(await F(30)));
  await p.evaluate((st) => window.__rj.input({ brake: 1 }), steer);
  for (let k = 0; k < 4; k++) { const s = await F(30); if (k === 3) console.log(name, 'reverse', JSON.stringify(s)); }
  await p.evaluate((st) => window.__rj.input({ throttle: 1, steer: st }), steer);
  for (let k = 0; k < 6; k++) { const s = await F(30); await p.screenshot({path: `${out}/${name}${k}.jpg`, quality: 75, type: 'jpeg'}); if (k === 5) console.log(name, 'drive', JSON.stringify(s)); }
}
const hit = await p.evaluate(() => { const R = window.__rj, my = R.fleet[1].sim; return [my.pos.x, my.pos.z]; });
await p.evaluate(([x, z]) => { const R = window.__rj, v = R.vehicle(); v.teleport([x - 25, 0.1, z - 6], Math.PI / 2 - 0.25, 14); R.input({ throttle: 0.8 }); }, hit);
for (let k = 0; k < 8; k++) { await F(15); if (k % 2 === 1) await p.screenshot({path: `${out}/ram${k}.jpg`, quality: 75, type: 'jpeg'}); }
console.log('model y moved', await p.evaluate(([x, z]) => { const my = window.__rj.fleet[1].sim; return Math.hypot(my.pos.x - x, my.pos.z - z).toFixed(2); }, hit));
await p.evaluate(() => window.__rj.input({ brake: 1 })); await F(120);
await p.evaluate(() => window.__rj.input(null)); await F(60);
await p.keyboard.press('KeyE'); const ex = await F(30);
console.log('after E', JSON.stringify(ex));
await p.screenshot({path: `${out}/foot.jpg`, quality: 75, type: 'jpeg'});
console.log('before R', await p.evaluate(() => { const R = window.__rj, v = R.vehicle(), f = R.fleet.find((q) => q.sim === v); return JSON.stringify({ act: f ? f.info.name : 'roadster', pos: [v.pos.x, v.pos.z].map((x) => x.toFixed(1)), home: f && f.home.p }); }));
await p.keyboard.press('KeyR'); await F(1);
console.log('after R 1f', await p.evaluate(() => { const v = window.__rj.vehicle(); return [v.pos.x, v.pos.y, v.pos.z].map((x) => x.toFixed(2)).join(','); }));
await F(30);
console.log('homes', await p.evaluate(() => window.__rj.fleet.map((f) => Math.hypot(f.sim.pos.x - f.home.p[0], f.sim.pos.z - f.home.p[2]).toFixed(2)).join(' ')));
await b.close();
