// Real-time performance probe: uncapped rAF in headless Chrome (Metal), plays a scripted climb and jump with the normal game loop and reports fps per phase and the draw-call budget. node perf.mjs [query] [w] [h]
import {createRequire} from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [qy = '', W = '1440', H = '900'] = process.argv.slice(2);
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit']});
const p = await b.newPage({viewport: {width: +W, height: +H}, deviceScaleFactor: +(process.env.DPR || 2)});
p.on('pageerror', e => console.log('err', e.message));
await p.goto('http://127.0.0.1:8840/' + qy);
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; window.__rjTest = true; R.play(); R.board(); R.fan(true);
  window.__fr = []; let last = performance.now(); const tick = (t) => { window.__fr.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
const phase = async (name, inp, sec) => {
  await p.evaluate((o) => { window.__fr = []; window.__rj.input(o); }, inp);
  await new Promise(r => setTimeout(r, sec * 1000));
  const r = await p.evaluate(() => { const f = window.__fr.slice(2); f.sort((a, b) => a - b); const avg = f.reduce((a, b) => a + b, 0) / f.length; const R = window.__rj; const info = R.view.root.parent ? document.getElementById('view') : null; return {n: f.length, fps: +(1000 / avg).toFixed(1), p95: +f[Math.floor(f.length * 0.95)].toFixed(1), st: R.state(), scale: R.Q.dpr}; });
  console.log(name, JSON.stringify({fps: r.fps, p95ms: r.p95, frames: r.n, pos: r.st.pos, s: r.st.s, contacts: r.st.contacts}));
};
await phase('idle', {}, 4);
await phase('climb', {throttle: 0.55}, 6);
await phase('ceiling', {}, 3);
await phase('reverse', {brake: 1}, 7);
await phase('run', {throttle: 0.5}, 5);
await phase('air', {roll: 1}, 2.5);
await phase('land', {lift: true}, 3);
const info = await p.evaluate(() => { const c = document.getElementById('view'); return {buf: [c.width, c.height]}; });
console.log('canvas', JSON.stringify(info));
await b.close();
