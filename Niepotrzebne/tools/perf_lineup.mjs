// Lineup performance probe: uncapped rAF in headless Chrome (Metal) at 1440x900 @2x, fps at the ramp start (any build, e.g. /v1.3/ for the before number) and, when the build has the lineup, behind the car at the lineup start and during a jet ollie over it. node perf_lineup.mjs [path] [query]
import {createRequire} from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [path = '/', qy = ''] = process.argv.slice(2);
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit']});
const p = await b.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 2});
p.on('pageerror', (e) => console.log('err', e.message));
await p.goto('http://127.0.0.1:8840' + path + qy);
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; window.__rjTest = true; R.play(); R.board();
  window.__fr = []; let last = performance.now(); const tick = (t) => { window.__fr.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
const phase = async (name, fn, sec) => {
  await p.evaluate(fn); await p.evaluate(() => { window.__fr = []; });
  await new Promise((r) => setTimeout(r, sec * 1000));
  const r = await p.evaluate(() => { const f = window.__fr.slice(2).sort((a, b) => a - b), avg = f.reduce((a, b) => a + b, 0) / f.length; const P = window.__rj.perf; return { fps: +(1000 / avg).toFixed(1), p95: +f[Math.floor(f.length * 0.95)].toFixed(1), max: +f[f.length - 1].toFixed(1), scale: document.getElementById('view').width, cpu: +P.cpu.toFixed(2), phys: +P.phys.toFixed(2), smoke: +P.smoke.toFixed(2), rend: +P.rend.toFixed(2), parts: window.__rj.smokeCount ? window.__rj.smokeCount() : null }; });
  console.log(name, JSON.stringify(r));
};
await new Promise((r) => setTimeout(r, 3000));
await phase('ramp start', () => window.__rj.input({}), 5);
if (await p.evaluate(() => !!window.__rj.lineupStart)) {
  await phase('lineup start', () => { window.__rj.lineupStart(); window.__rj.input({}); }, 5);
  await phase('lineup start again', () => { window.__rj.input({}); }, 3);
  await phase('lineup run', () => window.__rj.input({throttle: 0.6}), 2.2);
  await phase('ollie', () => window.__rj.input({lift: true}), 0.8);
  await phase('air', () => window.__rj.input({roll: 1}), 1.2);
  await phase('land', () => window.__rj.input({lift: true}), 2.5);
}
await b.close();
