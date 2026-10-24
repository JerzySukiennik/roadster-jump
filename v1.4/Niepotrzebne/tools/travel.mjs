// Site flight check: on foot at the curl press L (through the real keyboard path), save camera frames along the flight to the lineup, check Jurek ends up driving there, then L back from the car and save that flight too. node travel.mjs outDir [q]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/travel', q = 'high'] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1280, height: 720}});
p.on('pageerror', (e) => console.log('err', e.message));
await p.goto((process.env.URL || 'http://127.0.0.1:8840/') + `?q=${q}&fixscale`);
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; R.manual(true); R.play(); for (let i = 0; i < 30; i++) R.frame(1 / 60, true); });
await p.waitForTimeout(1500);
const st = () => p.evaluate(() => { const R = window.__rj; return { zone: R.zone(), tr: R.traveling(), inCar: R.state().inCar, pos: R.state().pos, cam: [R.view.root.parent ? 0 : 0], camPos: (() => { const c = R.phys && window.__rjCam; return c; })() }; });
const fly = async (tag) => {
  await p.keyboard.press('KeyL');
  let n = 0;
  for (let f = 0; f < 60 * 9; f++) {
    await p.evaluate(() => window.__rj.frame(1 / 60, true));
    const s = await st();
    if (f % 20 === 0) await p.screenshot({path: `${out}/${tag}${String(n++).padStart(2, '0')}.jpg`, quality: 72, type: 'jpeg'});
    if (f % 60 === 0) console.log(tag, f, JSON.stringify(s));
    if (!s.tr && f > 30) { console.log(tag, 'arrived', f, JSON.stringify(s)); break; }
  }
  for (let f = 0; f < 60; f++) await p.evaluate(() => window.__rj.frame(1 / 60, true));
  await p.screenshot({path: `${out}/${tag}_end.jpg`, quality: 80, type: 'jpeg'});
};
console.log('start', JSON.stringify(await st()));
await fly('a');
await p.evaluate(() => window.__rj.input({throttle: 0.5}));
for (let f = 0; f < 60 * 1.5; f++) await p.evaluate(() => window.__rj.frame(1 / 60, true));
await p.evaluate(() => window.__rj.input(null));
for (let f = 0; f < 60 * 2.5; f++) await p.evaluate(() => window.__rj.frame(1 / 60, true));
console.log('drove', JSON.stringify(await st()));
await fly('b');
console.log('back', JSON.stringify(await st()));
await b.close();
