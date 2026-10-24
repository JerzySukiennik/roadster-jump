// HUD and UI tour: title screen, driving with boost, the ollie prompt, mid-kickflip, the result card, the combo meter, the replay pill, the menu tabs and the on-foot HUD, on a desktop viewport or a phone (touch=1). node hud.mjs outDir [q] [w h touch]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/hud', q = 'high', W = '1440', H = '900', touch = '0'] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const T = touch === '1';
const p = await b.newPage({viewport: {width: +W, height: +H}, hasTouch: T, isMobile: T, deviceScaleFactor: T ? 2 : 1});
p.on('pageerror', (e) => console.log('err', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
await p.goto((process.env.URL || 'http://127.0.0.1:8840/') + `?q=${q}&fixscale&mp=off${T ? '&touch' : ''}`);
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
const shot = async (n) => { await p.screenshot({path: `${out}/${n}.jpg`, quality: 82, type: 'jpeg'}); };
const F = (n = 1, s = true) => p.evaluate(([n, s]) => { let st; for (let i = 0; i < n; i++) { window.__rj.frame(1 / 60, s); } return window.__rj.state(); }, [n, s]);
await p.evaluate(() => window.__rj.manual(true));
await F(30, false); await p.waitForTimeout(1500); await F(2, false); await shot('01_title');
await p.evaluate(() => { const R = window.__rj; R.play(); R.board(); R.cam('chase'); R.sim(0.3); });
await p.waitForTimeout(800);
await p.evaluate(() => window.__rj.input({throttle: 1, boost: true})); await F(150); await shot('02_drive');
await p.evaluate(() => { const R = window.__rj; R.input(null); R.lineupStart(); R.cam('level'); R.sim(0.3); });
const CX = await p.evaluate(() => window.__rj.LINEUP.cx);
let ph = 'run', tHop = 0, land = -1, took = {};
for (let f = 0; f < 60 * 14; f++) {
  const st = await F();
  if (ph === 'run') { await p.evaluate((t) => window.__rj.input({throttle: t}), Math.max(0, Math.min(1, (15 - st.speed) * 0.5))); if (!took.prompt && CX - st.pos[0] < st.speed * 2.4) { took.prompt = 1; await shot('03_prompt'); } if (CX - st.pos[0] < st.speed * 1.6) { ph = 'hop'; tHop = st.t; await p.evaluate(() => window.__rj.input({lift: true})); } }
  else if (ph === 'hop' && st.t - tHop > 0.75) { ph = 'roll'; await p.evaluate(() => window.__rj.input({roll: 1})); }
  else if (ph === 'roll' && st.t - tHop > 1.9) { ph = 'fall'; await p.evaluate(() => window.__rj.input({})); }
  else if (ph === 'fall' && st.contacts === 0 && st.pos[1] < 3) { ph = 'land'; await p.evaluate(() => window.__rj.input({lift: true})); }
  if (ph === 'roll' && !took.air && st.t - tHop > 1.4) { took.air = 1; await shot('04_air'); }
  if (st.result && land < 0) land = f;
  if (land >= 0 && f - land === 40) { await p.evaluate(() => window.__rj.input(null)); await shot('05_result'); }
  if (land >= 0 && f - land === 100) { await shot('06_combo'); break; }
}
await p.evaluate(() => window.__rj.startReplay()); await F(200, false); await shot('07_replay');
await p.evaluate(() => window.__rj.stopReplay()); await F(5);
await p.keyboard.press('Escape'); await F(2); await p.waitForTimeout(600); await shot('08_menu_game');
for (const t of ['boards', 'online', 'keys']) { await p.click(`#tabs button[data-tab="${t}"]`); await p.waitForTimeout(900); await shot(`09_menu_${t}`); }
await p.keyboard.press('Escape'); await F(2); await p.waitForTimeout(400);
await p.keyboard.press('KeyE'); await F(160); await shot('10_foot');
await b.close();
