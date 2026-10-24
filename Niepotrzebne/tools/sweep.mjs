import {createRequire} from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 640, height: 360}});
p.on('pageerror', e => console.log('err', e.message));
await p.goto('http://127.0.0.1:8840/?q=low');
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { window.__rj.manual(true); window.__rj.play(); window.__rj.board(); window.__rj.fan(true); });
for (const [thr, boost, start] of JSON.parse(process.argv[2] || '[[0.5,false,-10.5],[0.7,false,-10.5],[1,false,-10.5],[1,true,-10.5]]')) {
  const r = await p.evaluate(([thr, boost, start]) => {
    const R = window.__rj; R.reset(); R.car.teleport([start, 0.05, 0], Math.PI / 2, 0); R.sim(0.5);
    R.input({throttle: thr, boost}); let lip = null, st;
    for (let i = 0; i < 1200; i++) { st = R.sim(1 / 60); if (st.contacts === 0 && st.pos[1] > 20 && st.pos[0] < -14) { lip = st; break; } if (st.pos[1] < 3 && st.s > 10 && i > 200) break; }
    if (!lip) return {thr, boost, fail: st};
    R.input({lift: false}); let res = null;
    for (let i = 0; i < 900; i++) { st = R.sim(1 / 60); if (st.result && st.t > lip.t) { res = st.result; break; } if (st.pos[1] < 1.6 && !R.ev.landX) { R.ev.landX = st.pos[0]; R.input({lift: true}); } }
    const out = {thr, boost, lipSpeed: lip.speed, landX: R.ev.landX, dist: res && +res.dist.toFixed(1), q: res && res.quality, names: res && res.names};
    R.ev.landX = 0; return out;
  }, [thr, boost, start]);
  console.log(JSON.stringify(r));
}
await b.close();
