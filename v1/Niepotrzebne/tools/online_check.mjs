import {createRequire} from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal']});
const p = await b.newPage({viewport: {width: 640, height: 360}});
await p.goto('http://127.0.0.1:8840/?q=low');
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
const r = await p.evaluate(async (mode) => {
  const { Online } = await import('/src/online.js');
  const o = new Online(); o.best = {};
  const ok = await o.connect();
  const top = await o.top('score', 5);
  let sub = null;
  if (mode === 'write') { o.best = {}; try { sub = await o.submit('TestBot', { score: 1, dist: 0.1, spin: 1 }); } catch (e) { sub = String(e); } }
  const top2 = await o.top('score', 5);
  return { ok, uid: o.uid, top, sub, top2, err: o.err ? String(o.err.message || o.err) : null };
}, process.argv[2] || 'read');
console.log(JSON.stringify(r, null, 1));
await b.close();
