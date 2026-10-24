// High-speed ramp entry check: for each entry speed the car is launched along the run-in with suction on and full throttle; reports whether it stays on the deck up the curl, along the ceiling and off the lip, the speed lost at the transition and any hull hit. node speed.mjs [speeds]
import {createRequire} from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const speeds = JSON.parse(process.argv[2] || '[20,30,40,55,70,90,112]');
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal']});
const p = await b.newPage({viewport: {width: 480, height: 270}});
p.on('pageerror', (e) => console.log('err', e.message));
await p.goto((process.env.URL || 'http://127.0.0.1:8840/') + '?q=low');
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
await p.evaluate(() => { const R = window.__rj; R.manual(true); R.play(); R.board(); });
for (const v of speeds) {
  const r = await p.evaluate((v) => {
    const R = window.__rj; R.reset(); R.fan(true); R.car.fan = true; R.car.fanSpool = 1;
    R.car.teleport([-60, 0.05, 0.2], Math.PI / 2, v); R.input({ throttle: 1 });
    let st = R.state(), maxS = -99, ceil = false, lip = null, vIn = null, vMinRamp = 1e9, offDeck = null, maxUpDev = 0, jolt = 0, prevV = v;
    for (let i = 0; i < 1200; i++) {
      st = R.sim(1 / 120);
      const sp = st.speed; jolt = Math.max(jolt, Math.abs(sp - prevV) * 120); prevV = sp;
      if (st.onRamp) { maxS = Math.max(maxS, st.s); vMinRamp = Math.min(vMinRamp, sp); if (vIn === null) vIn = sp; if (st.up[1] < -0.9) ceil = true; }
      if (st.contacts === 0 && st.pos[1] > 20 && st.pos[0] < -14) { lip = { speed: st.speed, x: st.pos[0], up: st.up[1] }; break; }
      if (!st.onRamp && maxS > 2 && st.pos[1] < 2 && st.contacts > 0 && !lip) { offDeck = { s: maxS, pos: st.pos, up: st.up }; break; }
      if (st.pos[1] < 15 && st.pos[1] > 2 && st.contacts === 0 && maxS > 5 && !lip) { offDeck = { fell: true, s: maxS, pos: st.pos, up: st.up }; break; }
    }
    return { v, vIn: vIn && +vIn.toFixed(1), vMinRamp: +vMinRamp.toFixed(1), maxS: +maxS.toFixed(1), ceil, lip, offDeck, maxDecel_g: +(jolt / 9.81).toFixed(1) };
  }, v);
  console.log(JSON.stringify(r));
}
await b.close();
