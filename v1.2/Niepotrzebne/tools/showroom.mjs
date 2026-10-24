// Title screen + showroom check in real time: loader, showroom idle, hover the gullwing door, rear and front, exploded view (hover and click), Play fly-in, pause menu tabs and the live keyboard. node showroom.mjs outDir [query]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const out = process.argv[2], qy = process.argv[3] || '';
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1280, height: 720}});
const logs = []; p.on('pageerror', (e) => logs.push('err ' + e.message + ' ' + (e.stack || '').slice(0, 300))); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 200)); });
const shot = (n) => p.screenshot({path: `${out}/${n}.jpg`, type: 'jpeg', quality: 85});
await p.goto('http://127.0.0.1:8840/' + qy);
await p.waitForTimeout(1800); await shot('a0_loader');
await p.waitForFunction(() => window.__rj && window.__rj.showroom && window.__rj.showroom.active, null, {timeout: 180000}).catch(() => {});
await p.waitForFunction(() => document.getElementById('loader').classList.contains('hidden'), null, {timeout: 60000}).catch(() => {});
await p.waitForTimeout(1500); await shot('a1_title');
const screenOf = (name) => p.evaluate(async (name) => { const THREE = await import('three'); const R = window.__rj, o = R.view.n[name], v = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); if (name === 'Roof_Targa') v.y += 0.05; v.project(R.showroom.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, name);
await p.evaluate(() => { const S = window.__rj.showroom; S.yaw = 2.5; S.vyaw = 0; S.idle = -999; });
await p.waitForTimeout(400);
for (const [name, file, dy] of [['Door_L', 'a2_door', 0], ['Bumper_R', 'a3_rear', 0], ['Bumper_F', 'a4_front', 0], ['Steer_FL', 'a5_wheel', 0], ['Roof_Targa', 'a6_targa', 0]]) {
  const [x, y] = await screenOf(name); await p.mouse.move(x, y + dy, {steps: 6}); await p.waitForTimeout(1400); await shot(file);
  console.log(name, Math.round(x), Math.round(y), JSON.stringify(await p.evaluate(() => { const S = window.__rj.showroom; return {hover: S.hover && S.hover.key, st: Object.fromEntries(Object.entries(S.st).map(([k, v]) => [k, +v.toFixed(2)]))}; })));
}
await p.mouse.move(40, 360); await p.waitForTimeout(900);
await p.click('#showMode button[data-v="explode"]'); await p.waitForTimeout(300);
{ const [x, y] = await screenOf('Door_L'); await p.mouse.move(x, y, {steps: 6}); await p.waitForTimeout(1300); await shot('a7_explode_hover'); await p.mouse.click(x, y); await p.waitForTimeout(1300); await shot('a8_explode_all'); }
await p.evaluate(() => { window.__rj.showroom.idle = 0; });
await p.click('#showMode button[data-v="play"]'); await p.waitForTimeout(600);
await p.click('#tsKeys'); await p.waitForTimeout(500); await p.keyboard.down('KeyF'); await p.waitForTimeout(150); await shot('a9_keys'); await p.keyboard.up('KeyF');
await p.click('#mcClose'); await p.waitForTimeout(400);
await p.waitForFunction(() => !document.getElementById('play').disabled, null, {timeout: 120000});
await p.evaluate(() => { window.__rjTest = true; });
await p.click('#play'); await p.waitForTimeout(700); await shot('b0_fly'); await p.waitForTimeout(1600); await shot('b1_game');
await p.keyboard.press('Escape'); await p.waitForTimeout(600); await shot('b2_menu');
await p.click('#tabs button[data-tab="boards"]'); await p.waitForTimeout(2500); await shot('b3_boards');
console.log(logs.slice(0, 30).join('\n'));
await b.close();
