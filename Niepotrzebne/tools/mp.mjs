// Multiplayer check over the local BroadcastChannel transport (?mp=local): two pages in one browser join the shared arena, A parks its Roadster beside the ramp, B sees it with a name tag, then B drives into it at 12 m/s and must bounce off the kinematic hull; A then walks on foot and B sees the figure. node mp.mjs outDir [q]
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/mp', q = 'low'] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const ctx = await b.newContext({viewport: {width: 1100, height: 620}}), ctx2 = process.env.MP === 'rtdb' ? await b.newContext({viewport: {width: 1100, height: 620}}) : ctx;
const pages = [await ctx.newPage(), await ctx2.newPage()];
for (const [i, p] of pages.entries()) { p.on('pageerror', (e) => console.log('err' + i, e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('console' + i, m.text().slice(0, 160)); }); }
await Promise.all(pages.map((p) => p.goto((process.env.URL || 'http://127.0.0.1:8840/') + `?q=${q}&mp=${process.env.MP || "local"}&fixscale`)));
await Promise.all(pages.map((p) => p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000})));
const [A, B] = pages;
await A.evaluate(() => { const R = window.__rj; R.S.name = 'Jurek A'; R.manual(true); R.play(); R.board(); R.car.teleport([-3.2, 0.05, 9], Math.PI / 2, 0); });
await B.evaluate(() => { const R = window.__rj; R.S.name = 'Kolega B'; R.manual(true); R.play(); R.board(); R.cam('chase'); });
const netInfo = async () => Promise.all(pages.map((p) => p.evaluate(() => { const N = window.__rj.net; return { on: N.on, room: N.room, uid: N.uid, peers: N.peers.size, err: N.err ? String(N.err.message || N.err).slice(0, 120) : null }; })));
const both = async (n) => { for (let i = 0; i < n; i++) { await A.evaluate(() => window.__rj.frame(1 / 60, true)); await B.evaluate(() => window.__rj.frame(1 / 60, true)); } };
await both(90);
for (let k = 0; k < 20 && (await netInfo()).some((x) => !x.peers); k++) { await both(20); await new Promise((r) => setTimeout(r, 300)); }
console.log('net', JSON.stringify(await netInfo()));
await A.evaluate(() => window.__rj.input({ throttle: 0.25 })); await both(60); await A.evaluate(() => window.__rj.input({})); await both(150); await A.evaluate(() => window.__rj.input(null)); await both(30);
const seen = async () => B.evaluate(() => { const R = window.__rj, e = [...R.remotes.list.values()][0]; return e ? { n: R.remotes.size, name: e.name, hasView: !!e.rv, pos: e.rv ? e.rv.root.position.toArray().map((v) => +v.toFixed(2)) : null, online: R.net.count } : { n: R.remotes.size }; });
console.log('B sees', JSON.stringify(await seen()), 'A car', JSON.stringify(await A.evaluate(() => [window.__rj.car.pos.x, window.__rj.car.pos.z].map((v) => +v.toFixed(2)))));
await B.evaluate(() => window.__rj.shot([-12, 2.2, 15], [0, 0.8, 8], 45)); await both(3);
await B.screenshot({path: `${out}/b_sees_a.jpg`, quality: 80, type: 'jpeg'});
await B.evaluate(() => window.__rj.shot(null));
const ax = await A.evaluate(() => window.__rj.car.pos.x);
await B.evaluate((ax) => { const R = window.__rj; R.car.teleport([ax - 16, 0.05, 9], Math.PI / 2, 12); R.input({ throttle: 0.3 }); }, ax);
const track = [];
for (let i = 0; i < 12; i++) { await both(8); track.push(await B.evaluate(() => { const e = [...window.__rj.remotes.list.values()][0], t = e.rb.translation(); return [+window.__rj.car.pos.x.toFixed(2), +window.__rj.car.speed.toFixed(1), +t.x.toFixed(2), +t.z.toFixed(2)]; })); if (i === 6) await B.screenshot({path: `${out}/crash.jpg`, quality: 80, type: 'jpeg'}); }
console.log('B track (x, speed) vs A at', ax.toFixed(2), JSON.stringify(track));
console.log('A after hit', await A.evaluate(() => [window.__rj.car.pos.x.toFixed(2), window.__rj.car.speed.toFixed(2)].join(' ')));
await B.evaluate(() => window.__rj.input({ brake: 1 })); await both(60); await B.evaluate(() => window.__rj.input(null));
console.log('A car speed', await A.evaluate(() => window.__rj.car.speed.toFixed(2)));
await A.evaluate(() => { const R = window.__rj; R.car.teleport([R.car.pos.x, 0.05, R.car.pos.z], Math.PI / 2, 0); }); await both(60);
await A.keyboard.press('KeyE'); await both(150);
console.log('A state', JSON.stringify(await A.evaluate(() => ({ inCar: window.__rj.state().inCar, walker: window.__rj.walker.active }))));
await A.evaluate(() => { window.__rj.input(null); }); await A.keyboard.down('KeyW'); await both(45);
console.log('B sees walker', await B.evaluate(() => { const e = [...window.__rj.remotes.list.values()][0]; return e && e.fig ? e.fig.g.position.toArray().map((v) => +v.toFixed(2)).join(',') + ' visible ' + e.fig.g.visible : 'none'; }));
await B.evaluate(() => { const e = [...window.__rj.remotes.list.values()][0]; if (!e.fig) return; const p = e.fig.g.position; window.__rj.shot([p.x - 1.5, p.y + 2.6, p.z - 4.5], [p.x, p.y + 0.9, p.z], 42); }); await both(3);
await B.screenshot({path: `${out}/b_sees_walker.jpg`, quality: 80, type: 'jpeg'});
await A.keyboard.up('KeyW');
await b.close();
