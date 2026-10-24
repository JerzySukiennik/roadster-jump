// Photo mode frames check: opens photo mode at the lineup, cycles the frames with the grid on, screenshots each and saves cropped captures to check their size and aspect. node photo.mjs outDir
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [out = '/tmp/photo'] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1280, height: 720}});
p.on('pageerror', (e) => console.log('err', e.message));
await p.goto((process.env.URL || 'http://127.0.0.1:8840/') + '?q=high&fixscale&mp=off');
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; R.manual(true); R.play(); R.board(); R.lineupStart(); R.sim(0.5); R.frame(1 / 60, false); R.openPhoto(); });
for (const a of ['free', '16:9', '4:5', '1:1', '9:16']) {
  await p.evaluate((a) => { const P = window.__rj.photoMode; P.setAspect(a); P.setGrid(true); }, a);
  await p.waitForTimeout(700);
  await p.evaluate(() => window.__rj.frame(1 / 60, false));
  await p.screenshot({path: `${out}/ui_${a.replace(':', 'x')}.jpg`, quality: 80, type: 'jpeg'});
  const info = await p.evaluate(async () => { const P = window.__rj.photoMode, bl = await window.__rj.capturePhoto(P.rect()); const bm = await createImageBitmap(bl); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0); return { w: bm.width, h: bm.height, size: bl.size, url: c.toDataURL('image/jpeg', 0.8) }; });
  fs.writeFileSync(`${out}/cap_${a.replace(':', 'x')}.jpg`, Buffer.from(info.url.split(',')[1], 'base64'));
  console.log(a, info.w, info.h, (info.w / info.h).toFixed(3), Math.round(info.size / 1024) + 'KB');
}
await p.evaluate(() => window.__rj.photoMode.toggleBar());
await p.waitForTimeout(500);
await p.screenshot({path: `${out}/ui_bare.jpg`, quality: 80, type: 'jpeg'});
await b.close();
