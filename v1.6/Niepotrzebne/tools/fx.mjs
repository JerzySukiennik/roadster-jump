// FX check: donuts on the tarmac lay tyre marks, a 25 m/s crash into the jersey barrier throws sparks and shakes the camera. node fx.mjs outDir [q]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/fx', q = 'high'] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1280, height: 720}});
p.on('pageerror', (e) => console.log('err', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
await p.goto((process.env.URL || 'http://127.0.0.1:8840/') + `?q=${q}&fixscale&mp=off`);
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; R.manual(true); R.play(); R.board(); R.cam('chase'); R.car.teleport([414, 0.05, -12], 0, 4); R.input({ throttle: 1, steer: 1 }); });
await p.waitForTimeout(1200);
const F = (n = 1) => p.evaluate((n) => { for (let i = 0; i < n; i++) window.__rj.frame(1 / 60, true); const R = window.__rj; return { marks: R.marks.i, sparks: R.sparks.alive, shake: +R.rig.shakeA.toFixed(3), speed: +R.car.speed.toFixed(1) }; }, n);
for (let k = 0; k < 6; k++) console.log('donut', JSON.stringify(await F(40)));
await p.evaluate(() => { const R = window.__rj; R.input({}); R.shot([420, 9, -24], [416, 0, -10], 50); }); await F(3);
await p.screenshot({path: `${out}/marks.jpg`, quality: 80, type: 'jpeg'});
await p.evaluate(() => { const R = window.__rj; R.shot(null); R.car.teleport([-40, 0.05, 8], 0, 25); R.input({ throttle: 0.5 }); });
let best = null;
for (let k = 0; k < 40; k++) { const s = await F(2); if (!best || s.sparks > best.sparks) { best = s; await p.screenshot({path: `${out}/sparks.jpg`, quality: 80, type: 'jpeg'}); } }
console.log('crash best', JSON.stringify(best));
await b.close();
