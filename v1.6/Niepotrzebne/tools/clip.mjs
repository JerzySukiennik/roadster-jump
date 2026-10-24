// Replay clip check: hops over the lineup, opens the replay, records the TV cut as a 16:9 and a 9:16 clip in real time and checks each file (type, size, duration, tracks) plus a decoded frame from the middle. node clip.mjs outDir [q]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/clip', q = 'high'] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage({viewport: {width: 1280, height: 720}});
p.on('pageerror', (e) => console.log('err', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
await p.goto((process.env.URL || 'http://127.0.0.1:8840/') + `?q=${q}&fixscale&mp=off`);
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; R.manual(true); R.play(); R.board(); R.lineupStart(); R.cam('level'); R.sim(0.3); });
await p.waitForTimeout(1000);
const CX = await p.evaluate(() => window.__rj.LINEUP.cx);
let ph = 'run', tHop = 0, land = -1;
for (let f = 0; f < 60 * 14; f++) {
  const st = await p.evaluate(() => { window.__rj.frame(1 / 60, true); return window.__rj.state(); });
  if (ph === 'run') { await p.evaluate((t) => window.__rj.input({throttle: t}), Math.max(0, Math.min(1, (15 - st.speed) * 0.5))); if (CX - st.pos[0] < st.speed * 1.6) { ph = 'hop'; tHop = st.t; await p.evaluate(() => window.__rj.input({lift: true})); } }
  else if (ph === 'hop' && st.t - tHop > 0.75) { ph = 'roll'; await p.evaluate(() => window.__rj.input({roll: 1})); }
  else if (ph === 'roll' && st.t - tHop > 1.9) { ph = 'fall'; await p.evaluate(() => window.__rj.input({})); }
  else if (ph === 'fall' && st.contacts === 0 && st.pos[1] < 3) { ph = 'land'; await p.evaluate(() => window.__rj.input({lift: true})); }
  if (st.result && land < 0) land = f;
  if (land >= 0 && f - land > 150) break;
}
console.log('jump', ph, land);
await p.evaluate(() => { const R = window.__rj; R.input(null); R.startReplay(); R.manual(false); });
for (const fmt of ['wide', 'tall']) {
  await p.evaluate((fmt) => { document.querySelector(`#rpFmt button[data-v="${fmt}"]`).click(); window.__rj.stopReplay(); window.__rj.startReplay(); }, fmt);
  await p.waitForTimeout(400);
  await p.keyboard.press('KeyK');
  await p.waitForTimeout(1500);
  const tracks = await p.evaluate(() => { const c = window.__rj.clips; return c.recording ? c.stream.getTracks().map((t) => t.kind) : null; });
  await p.screenshot({path: `${out}/rec_${fmt}.jpg`, quality: 75, type: 'jpeg'});
  await p.waitForFunction(() => document.getElementById('clip').classList.contains('on'), null, {timeout: 60000});
  await p.waitForTimeout(600);
  await p.screenshot({path: `${out}/card_${fmt}.jpg`, quality: 80, type: 'jpeg'});
  const info = await p.evaluate(async () => {
    const r = window.__rj.clips.last, v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(r.blob);
    await new Promise((res) => { v.onloadedmetadata = res; v.onerror = res; });
    if (!isFinite(v.duration)) { v.currentTime = 1e6; await new Promise((res) => { v.ontimeupdate = () => { v.ontimeupdate = null; res(); }; }); }
    const dur = v.duration; v.currentTime = Math.min(dur * 0.5, 6); await new Promise((res) => { v.onseeked = res; setTimeout(res, 3000); });
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
    return { type: r.type, mb: +(r.blob.size / 1048576).toFixed(2), rec: +r.dur.toFixed(2), dur: +dur.toFixed(2), vw: v.videoWidth, vh: v.videoHeight, img: c.toDataURL('image/jpeg', 0.8) };
  });
  fs.writeFileSync(`${out}/frame_${fmt}.jpg`, Buffer.from(info.img.split(',')[1], 'base64')); delete info.img;
  console.log(fmt, JSON.stringify(tracks), JSON.stringify(info));
  await p.evaluate(() => document.getElementById('clipDrop').click());
  await p.waitForTimeout(500);
}
await b.close();
