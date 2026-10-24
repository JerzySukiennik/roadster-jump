// Roadster Jump headless check (Chrome headless, real GPU via ANGLE/Metal): boots the game, boards the car, turns suction on and drives a scripted input sequence through the sim hooks: climb the curl to the upside-down ceiling, hang there, reverse down, full-power run, leave the lip, kickflip and land. Asserts each phase and saves screenshots. node test.mjs [outDir] [url]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const out = process.argv[2] || decodeURIComponent(new URL('../shots/test', import.meta.url).pathname);
const url = process.argv[3] || 'http://127.0.0.1:8840/';
fs.mkdirSync(out, {recursive: true});
const W = +(process.env.W || 1280), Hh = +(process.env.H || 720);
const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});
const page = await browser.newPage({viewport: {width: W, height: Hh}});
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').slice(0, 600)}`));
const t0 = Date.now();
await page.goto(url, {waitUntil: 'load'});
try { await page.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000}); }
catch (e) { console.log('BOOT FAILED'); console.log(logs.join('\n')); await page.screenshot({path: `${out}/boot_fail.png`}); await browser.close(); process.exit(1); }
console.log('boot ms', Date.now() - t0);
const ev = (f, a) => page.evaluate(f, a);
const st = () => ev(() => window.__rj.state());
let lastRes = null, phase = 'start';
const sim = async (x) => { const r = await ev((y) => window.__rj.sim(y), x); const k = JSON.stringify(r.result); if (r.result && k !== lastRes) { lastRes = k; console.log('  event in', phase, 't', r.t, k.slice(0, 220)); } if (r.trick !== sim.tr) { sim.tr = r.trick; console.log('  trick', phase, r.t, r.trick, r.pos.join(','), 'up', r.up.join(',')); } return r; };
const input = (o) => ev((x) => window.__rj.input(x), o);
const shot = async (name, n = 20) => { await ev((k) => { for (let i = 0; i < k; i++) window.__rj.frame(1 / 60, false); }, n); await page.screenshot({path: `${out}/${name}.jpg`, quality: 85}); };
const checks = [];
const check = (name, ok, info) => { checks.push({name, ok, info}); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(info)); };

await ev(() => { window.__rj.manual(true); window.__rj.play(); });
await shot('00_foot', 40);
await ev(() => { window.__rj.board(); window.__rj.fan(true); window.__rj.cam('chase'); });
await sim(1.0);
await shot('01_start', 30);
let s = await st();
check('car parked at the foot of the ramp', s.contacts === 4 && Math.abs(s.pos[0] + 3.2) < 0.4, s);

phase = 'climb';
await input({throttle: 0.55});
let maxS = -99, ceilT = 0, ceilFirst = null, stuck = 0;
for (let i = 0; i < 160; i++) {
  s = await sim(0.05);
  maxS = Math.max(maxS, s.s);
  if (s.onRamp && s.up[1] < -0.9 && s.contacts >= 3) { ceilT += 0.05; if (!ceilFirst) ceilFirst = s; }
  if (s.s > 33 && s.up[1] < -0.9) break;
  if (s.pos[1] < 0.5 && s.s > 5) stuck++;
}
await input({});
s = await sim(0.6);
check('climbed the curl to the upside-down ceiling on suction', !!ceilFirst && s.up[1] < -0.9 && s.contacts >= 3 && s.pos[1] > 23, {ceilFirst, now: s, maxS});
await ev(() => window.__rj.cam('level'));
await shot('02_ceiling_level', 40);
await ev(() => window.__rj.cam('chase'));
await shot('03_ceiling_chase', 40);
s = await sim(4.0);
check('hangs upside down on the ceiling for 4 s', s.up[1] < -0.9 && s.contacts >= 3 && s.pos[1] > 23, s);

phase = 'reverse';
await input({brake: 1});
for (let i = 0; i < 300; i++) { s = await sim(0.05); if (s.pos[0] < -6 && s.pos[1] < 0.6) break; }
await input({throttle: 1});
for (let i = 0; i < 60; i++) { s = await sim(0.05); if (s.speed < 0.3) break; }
await input({});
s = await sim(0.3);
check('reversed back down to the run-in', s.pos[1] < 0.6 && s.pos[0] < -8 && s.up[1] > 0.95, s);
await shot('04_back_down', 30);

phase = 'run';
await input({throttle: 1, boost: true});
let lip = null, airTop = null;
for (let i = 0; i < 400; i++) {
  s = await sim(0.025);
  if (s.contacts === 0 && s.pos[1] > 20 && s.pos[0] < -14) { lip = s; break; }
}
check('full run leaves the ceiling lip', !!lip, lip || s);
await shot('05_lip', 12);
phase = 'air';
await input({roll: 1});
for (let i = 0; i < 30; i++) { s = await sim(0.05); if (!airTop) airTop = s; }
await shot('06_kickflip', 12);
await input({lift: true});
let res = null;
for (let i = 0; i < 200; i++) { s = await sim(0.05); if (s.result) { res = s.result; break; } }
await input({});
s = await sim(1.0);
await shot('07_landed', 40);
check('landed after the jump', !!res && res.ok, res || s);
console.log('result', JSON.stringify(res));
await ev(() => window.__rj.startReplay());
await shot('08_replay_tv', 60);
await ev(() => { window.__rj.replay.mode = 'free'; });
await shot('09_replay_free', 40);
await ev(() => window.__rj.stopReplay());
const perf = await ev(() => { const r = window.__rj.view.root; const gl = document.getElementById('view').getContext('webgl2'); const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); return {gpu: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'}; });
console.log('perf', JSON.stringify(perf));
console.log(logs.slice(0, 40).join('\n'));
fs.writeFileSync(`${out}/checks.json`, JSON.stringify({checks, logs}, null, 1));
await browser.close();
process.exit(checks.every((c) => c.ok) ? 0 : 2);
