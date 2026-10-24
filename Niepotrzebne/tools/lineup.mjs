// Lineup check: beauty shots of the five Teslas from fixed cameras, then a scripted jet ollie kickflip over the lineup (throttle from the lineup start, hold Space before the stage, roll in the air, assist lands it) with the result and a frame strip. node lineup.mjs outDir [q] [mode: shots|jump|both]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/lineup', q = 'high', mode = 'both'] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1280, height: 720}});
p.on('pageerror', (e) => console.log('err', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text().slice(0, 200)); });
await p.goto((process.env.URL || 'http://127.0.0.1:8840/') + `?q=${q}&fixscale`);
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; R.manual(true); R.play(); R.board(); R.lineupStart(); R.sim(0.3); });
await p.waitForTimeout(1500);
const frame = async (fn, n = 3) => { for (let i = 0; i < n; i++) await p.evaluate(() => window.__rj.frame(1 / 60, false)); await p.screenshot({path: `${out}/${fn}.jpg`, quality: 85, type: 'jpeg'}); };
if (mode !== 'jump') {
  const shots = JSON.parse(process.env.SHOTS || 'null') || [
    ['front', [420, 1.4, -24], [420, 1.6, 0], 42],
    ['three', [-9, 1.0, 6.5], [-27, 1.2, 18], 40],
    ['left', [-46, 1.1, 8], [-28, 1.1, 18], 40],
    ['close_my', [-21.5, 1.2, 10.5], [-22.3, 0.8, 17.5], 38],
    ['close_cab', [-33, 1.0, 11.0], [-34, 0.7, 17.6], 36],
    ['close_semi', [-25, 2.6, 9.5], [-27, 2.0, 18], 46],
    ['top', [-27, 22, 9], [-27, 0, 18.5], 50],
    ['rear', [-27, 1.6, 34], [-27, 1.4, 19], 40],
  ];
  for (const [n, pos, at, fov] of shots) { await p.evaluate(([pos, at, fov]) => window.__rj.shot(pos, at, fov), [pos, at, fov]); await frame(n); }
  await p.evaluate(() => window.__rj.shot(null));
}
if (mode !== 'shots') {
  const V = +(process.env.V || 14), LEAD = +(process.env.LEAD || 1.5), HOLD = +(process.env.HOLD || 0.7), ROLL = +(process.env.ROLL || 1), RT = +(process.env.RT || 1.15), CAM = process.env.CAM || 'level', DIR = +(process.env.DIR || 1);
  await p.evaluate(([cam, dir]) => { const R = window.__rj; R.lineupStart(); if (dir < 0) R.car.teleport([R.LINEUP.cx + 53, 0.05, R.LINEUP.line], -Math.PI / 2, 0); R.cam(cam); }, [CAM, DIR]);
  const CX = await p.evaluate(() => window.__rj.LINEUP.cx);
  const log = []; let ph = 'run', tHop = 0, k = 0, files = 0, tEnd = null;
  for (let f = 0; f < 60 * 18; f++) {
    const st = await p.evaluate(() => { window.__rj.frame(1 / 60, true); return window.__rj.state(); });
    if (ph === 'run') { const thr = Math.max(0, Math.min(1, (V - st.speed) * 0.5)); await p.evaluate(([t, b]) => window.__rj.input({throttle: t, brake: b}), [thr, st.speed > V + 1.5 ? 0.4 : 0]); }
    const dMid = DIR * (CX - st.pos[0]);
    if (ph === 'run' && dMid < st.speed * LEAD) { ph = 'hop'; tHop = st.t; await p.evaluate(() => window.__rj.input({lift: true})); log.push(['hop', st.t, st.speed, st.pos, (await p.evaluate(() => document.querySelector('#prompt, .prompt') ? document.querySelector('#prompt, .prompt').textContent : ''))]); }
    if (ph === 'hop' && st.t - tHop > HOLD) { ph = 'roll'; await p.evaluate((r) => window.__rj.input({roll: r}), ROLL); log.push(['roll', st.t, st.pos, st.mode]); }
    if (ph === 'roll' && st.t - tHop > HOLD + RT) { ph = 'fall'; await p.evaluate(() => window.__rj.input({})); log.push(['release', st.t, st.pos, st.up]); }
    if (ph === 'fall' && st.contacts === 0 && st.pos[1] < 3.0) { ph = 'land'; await p.evaluate(() => window.__rj.input({lift: true})); }
    if (ph !== 'run' && k++ % 6 === 0) { await p.screenshot({path: `${out}/j${String(files++).padStart(3, '0')}.jpg`, quality: 70, type: 'jpeg'}); }
    if (ph !== 'run' && f % 10 === 0) log.push(['s', st.t, st.pos, st.up, st.contacts, st.mode, st.trick, [...await p.evaluate(() => [...window.__rj.tricks.cleared])]]);
    if (st.result && tEnd === null) tEnd = f;
    if (tEnd !== null && f - tEnd > 40) break;
  }
  const res = await p.evaluate(() => ({ st: window.__rj.state(), cleared: [...window.__rj.tricks.cleared || []], goals: [...window.__rj.goals.done] }));
  for (const l of log) console.log(JSON.stringify(l));
  console.log('RESULT', JSON.stringify(res.st.result));
  console.log('goals', JSON.stringify(res.goals));
  if (process.env.REPLAY) {
    await p.evaluate(() => window.__rj.startReplay());
    for (let f = 0; f < 60 * 12; f++) { await p.evaluate(() => window.__rj.frame(1 / 60, false)); if (f % 15 === 0) await p.screenshot({path: `${out}/r${String(f / 15).padStart(3, '0')}.jpg`, quality: 70, type: 'jpeg'}); }
  }
}
await b.close();
