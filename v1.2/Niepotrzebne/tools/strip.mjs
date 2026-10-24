// Flight film strip: scripted run (throttle, boost, roll input in the air) rendered frame by frame with physics stepping, a frame saved every K frames from the ramp to after the landing, tiled into a sheet. node strip.mjs out.jpg cam thr boost roll
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/strip.jpg', cam = 'chase', thr = '0.5', boost = '0', roll = '1', q = 'high'] = process.argv.slice(2);
const dir = out.replace(/\.jpg$/, '_f'); fs.mkdirSync(dir, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 800, height: 450}});
p.on('pageerror', e => console.log('err', e.message));
await p.goto(`http://127.0.0.1:8840/?q=${q}`);
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(([cam]) => { const R = window.__rj; R.manual(true); R.play(); R.board(); R.fan(true); R.cam(cam); R.car.teleport([-10.5, 0.05, 0], Math.PI / 2, 0); R.sim(0.6); }, [cam]);
await p.evaluate(([thr, boost]) => window.__rj.input({throttle: +thr, boost: boost === '1'}), [thr, boost]);
const files = []; let k = 0, phase = 'ramp', tLand = null;
for (let f = 0; f < 60 * 14; f++) {
  const st = await p.evaluate(() => { window.__rj.frame(1 / 60, true); return window.__rj.state(); });
  if (phase === 'ramp' && st.contacts === 0 && st.pos[1] > 20) { phase = 'air'; if (roll !== '0') await p.evaluate(([r]) => window.__rj.input({roll: +r}), [roll]); }
  if (phase === 'air' && st.pos[1] < 9 && st.contacts === 0) { phase = 'land'; await p.evaluate(() => window.__rj.input({lift: true})); }
  if (phase !== 'ramp' || st.s > 20) {
    if (k++ % 9 === 0) { const fn = `${dir}/f${String(files.length).padStart(3, '0')}.jpg`; await p.screenshot({path: fn, quality: 70, type: 'jpeg'}); files.push(fn); }
  }
  if (st.result && tLand === null) tLand = f;
  if (tLand !== null && f - tLand > 50) break;
}
console.log(JSON.stringify(await p.evaluate(() => window.__rj.state().result)));
await b.close();
const sel = files.filter((_, i) => i % Math.ceil(files.length / 16) === 0).slice(0, 16);
const args = []; for (const f of sel) args.push('-i', f);
const n = sel.length, cols = 4, rows = Math.ceil(n / cols);
let fc = ''; for (let i = 0; i < n; i++) fc += `[${i}:v]scale=400:-1[v${i}];`;
for (let i = 0; i < n; i++) fc += `[v${i}]`;
const lay = []; for (let i = 0; i < n; i++) lay.push(`${i % cols ? Array.from({length: i % cols}, () => 'w0').join('+') : '0'}_${Math.floor(i / cols) ? Array.from({length: Math.floor(i / cols)}, () => 'h0').join('+') : '0'}`);
fc += `xstack=inputs=${n}:layout=${lay.join('|')}:fill=black`;
execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', fc, '-frames:v', '1', out]);
console.log('frames', files.length, '->', out);
