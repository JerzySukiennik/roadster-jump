// Gzowo Labs hero frames: a film-like jump (half throttle, kickflip roll, soft landing), then the replay through the TV director and a free orbit cam, frames saved without HUD at 4:3. node hero.mjs outDir [url]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const out = process.argv[2], base = process.argv[3] || 'http://127.0.0.1:8840/';
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1200, height: 900}, deviceScaleFactor: 1.5});
p.on('pageerror', e => console.log('err', e.message));
await p.goto(base + '?q=high&fixscale&dpr=1.5');
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 240000});
await p.evaluate(() => { const R = window.__rj; R.manual(true); R.play(); R.board(); R.fan(true); R.cam('chase'); R.car.teleport([-10.5, 0.05, 0], Math.PI / 2, 0); R.sim(0.6); R.input({throttle: 0.5}); });
let phase = 'ramp';
for (let f = 0; f < 60 * 16; f++) {
  const st = await p.evaluate(() => { window.__rj.frame(1 / 60, true); return window.__rj.state(); });
  if (phase === 'ramp' && st.contacts === 0 && st.pos[1] > 20) { phase = 'air'; await p.evaluate(() => window.__rj.input({roll: 1})); }
  if (phase === 'air' && st.pos[1] < 9 && st.contacts === 0) { phase = 'land'; await p.evaluate(() => window.__rj.input({lift: true})); }
  if (st.result) { console.log(JSON.stringify(st.result.names), st.result.quality); break; }
}
await p.evaluate(() => { for (let i = 0; i < 60; i++) window.__rj.frame(1 / 60, true); document.getElementById('hud').style.display = 'none'; });
for (const [mode, orbit] of [['tv', null], ['free', {yaw: 2.3, pitch: 0.05, dist: 11}], ['free', {yaw: -0.9, pitch: 0.18, dist: 9}]]) {
  await p.evaluate(([mode, orbit]) => { const R = window.__rj; R.startReplay(); R.replay.mode = mode; if (orbit) Object.assign(R.replay.orbit, orbit); const J = R.replay.J; R.replay.t = J.take - 1.6; }, [mode, orbit]);
  let n = 0;
  for (let f = 0; f < 60 * 9; f++) {
    const info = await p.evaluate(() => { window.__rj.frame(1 / 60, false); const R = window.__rj, J = R.replay.J; return {t: R.replay.t, take: J.take, land: J.land}; });
    if (info.t > info.land + 0.8) break;
    if (info.t > info.take - 1.4 && f % 7 === 0) { await p.screenshot({path: `${out}/${mode}${orbit ? Math.round(orbit.yaw * 10) : ''}_${String(n++).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 92}); }
  }
  await p.evaluate(() => window.__rj.stopReplay());
}
await b.close();
console.log('done', fs.readdirSync(out).length);
