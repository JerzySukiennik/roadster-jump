// Records the game's real audio output in headless Chrome: Play click (audio unlock), walk-in with the gullwing door, suction climb, ceiling launch, kickflip, jets braking, landing, then the slow-motion TV replay. Writes webm and converts to wav/mp3. node rec_audio.mjs outDir
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const out = process.argv[2]; fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage({viewport: {width: 960, height: 540}});
p.on('pageerror', e => console.log('err', e.message));
await p.goto('http://127.0.0.1:8840/?q=low');
await p.waitForFunction(() => window.__rj && window.__rj.ready && !document.getElementById('play').disabled, null, {timeout: 180000});
await p.evaluate(() => { window.__rjTest = true; });
await p.click('#play');
await p.waitForFunction(() => window.__rj.audio.buf.size > 8 && window.__rj.audio.song, null, {timeout: 60000});
const save = async (name, sec) => { const d = await p.evaluate(() => window.__recP); fs.writeFileSync(`${out}/${name}.webm`, Buffer.from(d.split(',')[1], 'base64')); execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${out}/${name}.webm`, '-ar', '48000', `${out}/${name}.wav`]); execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${out}/${name}.wav`, '-b:a', '192k', `${out}/${name}.mp3`]); };
await p.evaluate(() => { window.__recP = window.__rj.recordAudio(24); });
const t0 = Date.now(), log = (m) => console.log(((Date.now() - t0) / 1000).toFixed(1), m);
await p.waitForTimeout(1200); await p.keyboard.press('KeyE'); log('E');
await p.waitForTimeout(4200); await p.keyboard.press('KeyF'); log('F');
await p.waitForTimeout(900); await p.evaluate(() => window.__rj.input({throttle: 0.62})); log('go');
let phase = 'ramp';
while (Date.now() - t0 < 23500) {
  const s = await p.evaluate(() => window.__rj.state());
  if (phase === 'ramp' && s.contacts === 0 && s.pos[1] > 20) { phase = 'air'; await p.evaluate(() => window.__rj.input({roll: 1})); log('lip ' + s.speed); }
  if (phase === 'air' && s.pos[1] < 9 && s.contacts === 0) { phase = 'land'; await p.evaluate(() => window.__rj.input({lift: true})); log('lift'); }
  if (phase === 'land' && s.result) { phase = 'done'; await p.evaluate(() => window.__rj.input({})); log('landed ' + JSON.stringify(s.result.names) + ' ' + s.result.quality); }
  await p.waitForTimeout(80);
}
await save('jump');
await p.evaluate(() => { window.__rj.startReplay(); window.__recP = window.__rj.recordAudio(14); });
await p.waitForTimeout(14500);
await save('replay');
await b.close();
for (const f of ['jump', 'replay']) {
  const r = execFileSync('ffmpeg', ['-nostats', '-i', `${out}/${f}.wav`, '-af', 'ebur128=peak=true', '-f', 'null', '-'], {stdio: ['ignore', 'pipe', 'pipe']}).toString();
  console.log(f, 'done');
}
