// iPhone XR check in WebKit (Safari engine): landscape 896x414, touch, mobile UA; boots the low tier, screenshots start screen, on-foot HUD with touch controls, driving and the menu, and taps the touch buttons.
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {webkit, devices} = require('playwright-core');
const out = process.argv[2]; fs.mkdirSync(out, {recursive: true});
const b = await webkit.launch({headless: true});
const dev = devices['iPhone XR landscape'] || {viewport: {width: 896, height: 414}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'};
const ctx = await b.newContext({...dev});
const p = await ctx.newPage();
const logs = []; p.on('pageerror', e => logs.push('err ' + e.message)); p.on('console', m => { if (m.type() === 'error') logs.push('console ' + m.text().slice(0, 200)); });
const t0 = Date.now();
await p.goto('http://127.0.0.1:8840/');
try { await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 240000}); } catch (e) { console.log('BOOT FAIL', logs.join('\n')); await p.screenshot({path: `${out}/fail.png`}); process.exit(1); }
console.log('boot ms', Date.now() - t0, JSON.stringify(await p.evaluate(() => ({Q: window.__rj.Q, gl: (() => { const g = document.getElementById('view').getContext('webgl2'); return g ? g.getParameter(g.VERSION) : 'none'; })(), touch: document.body.classList.contains('touchdev')}))));
await p.waitForFunction(() => document.getElementById('loader').classList.contains('hidden'), null, {timeout: 60000}).catch(() => {});
await p.waitForTimeout(1200); await p.screenshot({path: `${out}/m0_start.png`});
{ const [x, y] = await p.evaluate(async () => { const THREE = await import('three'); const R = window.__rj, v = new THREE.Box3().setFromObject(R.view.n.Door_L).getCenter(new THREE.Vector3()); v.project(R.showroom.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }); await p.touchscreen.tap(x, y); await p.waitForTimeout(1300); await p.screenshot({path: `${out}/m0b_tap_door.png`}); console.log('tap door', JSON.stringify(await p.evaluate(() => ({ hover: window.__rj.showroom.hover && window.__rj.showroom.hover.key, door: +window.__rj.showroom.st.doorL.toFixed(2) })))); }
await p.waitForFunction(() => !document.getElementById('play').disabled, null, {timeout: 120000});
await p.tap('#play'); await p.waitForTimeout(1800);
await p.waitForTimeout(2500);
await p.screenshot({path: `${out}/m1_foot.png`});
await p.evaluate(() => { const R = window.__rj; R.board(); R.fan(true); });
await p.tap('.ts[data-t="KeyC"]'); await p.waitForTimeout(300);
console.log('cam after tap', await p.evaluate(() => window.__rj.S.cam));
await p.tap('.ts[data-t="KeyC"]'); await p.tap('.ts[data-t="KeyC"]');
await p.evaluate(() => window.__rj.input({throttle: 0.5}));
await p.waitForTimeout(3500);
await p.screenshot({path: `${out}/m2_drive.png`});
const fps = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
console.log('fps (webkit headless, not a phone)', fps.toFixed(1), JSON.stringify(await p.evaluate(() => window.__rj.state())));
await p.tap('.ts[data-t="Escape"]'); await p.waitForTimeout(500);
await p.screenshot({path: `${out}/m3_menu.png`});
console.log(logs.slice(0, 20).join('\n'));
await b.close();
