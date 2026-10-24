// Feature cost probe: uncapped fps with the car parked at the ramp foot (chase cam) for several debug toggles. node perf2.mjs "q1" "q2" ...
import {createRequire} from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit']});
for (const qy of process.argv.slice(2)) {
  const p = await b.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 2});
  p.on('pageerror', e => console.log('err', e.message));
  await p.goto('http://127.0.0.1:8840/?fixscale&' + qy);
  await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
  await p.evaluate(() => { const R = window.__rj; window.__rjTest = true; R.play(); R.board(); R.fan(true); R.input({});
    window.__fr = []; let last = performance.now(); const tick = (t) => { window.__fr.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await new Promise(r => setTimeout(r, 2500));
  await p.evaluate(() => { window.__fr = []; });
  await new Promise(r => setTimeout(r, 4000));
  const r = await p.evaluate(() => { const f = window.__fr.slice(1); const avg = f.reduce((a, b) => a + b, 0) / f.length; const P = window.__rj.perf; const c = document.getElementById('view'); return {fps: +(1000 / avg).toFixed(1), cpu: +P.cpu.toFixed(2), phys: +P.phys.toFixed(2), smoke: +P.smoke.toFixed(2), rend: +P.rend.toFixed(2), buf: c.width + 'x' + c.height}; });
  console.log((qy || 'default').padEnd(28), JSON.stringify(r));
  await p.close();
}
await b.close();
