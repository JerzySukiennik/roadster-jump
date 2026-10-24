import {createRequire} from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal']});
const p = await b.newPage({viewport: {width: 640, height: 360}});
await p.goto('http://127.0.0.1:8840/?fixscale');
await p.waitForFunction(() => window.__rj && window.__rj.ready, null, {timeout: 180000});
const r = await p.evaluate(() => {
  const R = window.__rj, out = {trans: R.view.transmissive, mats: []};
  for (const [k, m] of Object.entries(R.view.mats)) out.mats.push([k, m.type, m.transmission, m.clearcoat, m.sheen, m.iridescence, m.transparent, m.map ? 'map' : '', m.normalMap ? 'nrm' : ''].join(' '));
  let tris = 0, meshes = 0; R.view.root.traverse((o) => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  out.carMeshes = meshes; out.carTris = tris;
  return out;
});
console.log(JSON.stringify(r, null, 0).replace(/","/g, '"\n"'));
await b.close();
