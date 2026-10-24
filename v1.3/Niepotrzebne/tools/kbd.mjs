// Real keyboard path check: clicks Play, E to get in (walk + door + sit), F suction, W drive up the ramp, Space hop, C camera cycle, P replay, Esc menu.
import {createRequire} from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1280, height: 720}});
const logs = []; p.on('pageerror', e => logs.push('err ' + e.message)); p.on('console', m => { if (m.type() === 'error') logs.push('console ' + m.text().slice(0, 200)); });
await p.goto('http://127.0.0.1:8840/');
await p.waitForFunction(() => window.__rj && window.__rj.ready && !document.getElementById('play').disabled, null, {timeout: 180000});
await p.click('#play');
const st = () => p.evaluate(() => window.__rj.state());
const wait = (ms) => p.waitForTimeout(ms);
await wait(1500);
await p.keyboard.press('KeyE'); await wait(4500);
let s = await st(); console.log('after E', s.inCar, s.pos);
await p.keyboard.press('KeyF'); await wait(800);
await p.keyboard.down('KeyW'); await wait(2500); s = await st(); console.log('W 2.5s', JSON.stringify({speed: s.speed, pos: s.pos, s: s.s, fan: s.fan, onRamp: s.onRamp}));
await p.keyboard.up('KeyW'); await p.keyboard.down('KeyS'); await wait(4000); await p.keyboard.up('KeyS'); await wait(1500);
s = await st(); console.log('after S', JSON.stringify({speed: s.speed, pos: s.pos, up: s.up}));
await p.keyboard.press('Space'); await wait(300); s = await st(); console.log('hop', JSON.stringify({mode: s.mode, pos: s.pos, contacts: s.contacts}));
await wait(1500);
for (const k of ['KeyC', 'KeyC', 'KeyC']) { await p.keyboard.press(k); await wait(200); console.log('cam', await p.evaluate(() => window.__rj.S.cam)); }
await p.keyboard.press('KeyP'); await wait(1500); console.log('replay', await p.evaluate(() => window.__rj.replay.active)); await p.keyboard.press('KeyP'); await wait(300);
await p.keyboard.press('Escape'); await wait(400); console.log('menu', await p.evaluate(() => !document.getElementById('menu').classList.contains('hidden')));
await p.screenshot({path: '../shots/kbd_menu.jpg', type: 'jpeg', quality: 80});
console.log(logs.slice(0, 20).join('\n'));
await b.close();
