// Hitch finder: real-time loop, two jet ollie kickflips over the lineup in a row, logs every frame over 40 ms with the sim state, so one-off costs (shader compile, texture upload) show up only on the first jump. node hitch.mjs
import {createRequire} from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit']});
const p = await b.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 2});
p.on('pageerror', (e) => console.log('err', e.message));
p.on('console', (m) => { if (/warn|error/.test(m.type())) console.log('console', m.text().slice(0, 160)); });
await p.goto('http://127.0.0.1:8840/?fixscale');
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; window.__rjTest = true; R.play(); R.board(); window.__long = [];
  let last = performance.now(); const tick = (t) => { const d = t - last; last = t; if (d > 40) { const s = R.state(); window.__long.push([+d.toFixed(0), +s.t.toFixed(2), s.mode, s.trick, s.pos.map((v) => Math.round(v))]); } requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
await new Promise((r) => setTimeout(r, 3000));
for (let k = 0; k < 2; k++) {
  await p.evaluate(() => { const R = window.__rj; R.lineupStart(); R.input({throttle: 0.55}); window.__long.push(['jump']); });
  await p.waitForFunction(() => window.__rj.state().pos[0] > window.__rj.LINEUP.cx - 26, null, {timeout: 20000});
  await p.evaluate(() => window.__rj.input({lift: true}));
  await new Promise((r) => setTimeout(r, 750));
  await p.evaluate(() => window.__rj.input({roll: 1}));
  await new Promise((r) => setTimeout(r, 1150));
  await p.evaluate(() => window.__rj.input({lift: true}));
  await new Promise((r) => setTimeout(r, 3500));
  console.log('result', JSON.stringify((await p.evaluate(() => window.__rj.state().result)) || null).slice(0, 160));
}
console.log(JSON.stringify(await p.evaluate(() => window.__long)));
await b.close();
