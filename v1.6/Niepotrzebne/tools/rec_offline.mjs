// Deterministic sound check: the game renders its own mix into an OfflineAudioContext on the simulation clock (walk-in with the gullwing door, suction climb, ceiling launch, kickflip, jets braking, landing, then the slow-motion TV replay), saved as wav and mp3 with the event marks. node rec_offline.mjs outDir [throttle]
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const out = process.argv[2], thr = +(process.argv[3] || 0.62); fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 640, height: 360}});
p.on('pageerror', e => console.log('err', e.message));
await p.goto('http://127.0.0.1:8840/?q=low');
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
if (process.env.MUTE) await p.evaluate((m) => { window.__MUTE = m.split(','); }, process.env.MUTE);
const r = await p.evaluate(async (thr) => {
  const R = window.__rj; window.__rjTest = true; if (window.__MUTE) R.audio.mute = new Set(window.__MUTE); document.getElementById('start').classList.add('hidden');
  let phase = 'foot', landT = 0;
  const script = { dur: 36, step: (t, s, R) => {
    if (phase === 'foot' && t > 0.8) { phase = 'enter'; R.ui; window.__rjInput.tap('KeyE'); return 'E get in'; }
    if (phase === 'enter' && t > 5.2) { phase = 'fan'; window.__rjInput.tap('KeyF'); return 'F suction'; }
    if (phase === 'fan' && t > 6.2) { phase = 'ramp'; R.input({throttle: thr}); return 'throttle'; }
    if (phase === 'ramp' && s.contacts === 0 && s.pos[1] > 20) { phase = 'air'; R.input({roll: 1}); return 'lip ' + s.speed; }
    if (phase === 'air' && s.pos[1] < 9 && s.contacts === 0) { phase = 'lift'; R.input({lift: true}); return 'lift'; }
    if (phase === 'lift' && s.result) { phase = 'landed'; landT = t; R.input({}); return 'landed ' + s.result.names.join('+') + ' ' + s.result.quality; }
    if (phase === 'landed' && t > landT + 2.5) { phase = 'replay'; R.startReplay(); return 'replay'; }
    return null;
  } };
  const res = await R.offlineAudio(script);
  return res;
}, thr);
fs.writeFileSync(`${out}/mix.wav`, Buffer.from(r.url.split(',')[1], 'base64'));
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${out}/mix.wav`, '-b:a', '192k', `${out}/mix.mp3`]);
console.log(JSON.stringify(r.marks));
await b.close();
