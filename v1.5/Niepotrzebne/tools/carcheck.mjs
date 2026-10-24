import {createRequire} from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 900, height: 600}});
p.on('pageerror', e => console.log('err', e.message));
for (const [f, out, v] of process.argv.slice(2).map(a => a.split('|'))) {
  await p.goto(`http://127.0.0.1:8840/Niepotrzebne/tools/carcheck.html?f=${encodeURIComponent(f)}&v=${v || '0,0.4,-6'}`);
  await p.waitForFunction(() => window.done, null, {timeout: 60000});
  await p.screenshot({path: out});
  if (process.env.NAMES) console.log((await p.evaluate(() => window.names)).join(' '));
}
await b.close();
