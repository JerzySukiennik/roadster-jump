// Props check: drive the Roadster into the jersey barrier and the marker poles, then a jet hop next to the floor moving heads; reports which props moved and saves frames, then R puts everything back. node props.mjs outDir [q]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/props', q = 'high'] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1280, height: 720}});
p.on('pageerror', (e) => console.log('err', e.message));
await p.goto((process.env.URL || 'http://127.0.0.1:8840/') + `?q=${q}&fixscale&mp=off`);
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; R.manual(true); R.play(); R.board(); R.cam('chase'); });
await p.waitForTimeout(1200);
const F = (n = 1) => p.evaluate((n) => { for (let i = 0; i < n; i++) window.__rj.frame(1 / 60, true); return window.__rj.state(); }, n);
const moved = () => p.evaluate(() => window.__rj.props.list.map((q, i) => { const t = q.body.translation(); return [i, Math.hypot(t.x - q.home.p.x, t.y - q.home.p.y, t.z - q.home.p.z)]; }).filter((x) => x[1] > 0.05).map((x) => `${x[0]}:${x[1].toFixed(1)}`));
console.log('props', await p.evaluate(() => window.__rj.props.list.length));
await p.evaluate(() => { const R = window.__rj; R.car.teleport([-40, 0.05, 12], 0, 16); R.input({ throttle: 0.4 }); });
for (let i = 0; i < 6; i++) { await F(15); await p.screenshot({path: `${out}/hit${i}.jpg`, quality: 75, type: 'jpeg'}); }
await F(60);
console.log('after barrier', JSON.stringify(await moved()));
await p.evaluate(() => { const R = window.__rj; R.car.teleport([-60.5, 0.05, 33], Math.PI / 2, 2); R.input({ lift: true }); });
for (let i = 0; i < 4; i++) { await F(12); await p.screenshot({path: `${out}/jet${i}.jpg`, quality: 75, type: 'jpeg'}); }
await p.evaluate(() => window.__rj.input({ lift: false }));
await F(120);
console.log('after jets', JSON.stringify(await moved()));
await p.evaluate(() => window.__rj.reset()); await F(5);
console.log('after reset', JSON.stringify(await moved()));
await b.close();
