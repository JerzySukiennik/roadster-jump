import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const doc = await io.read(process.argv[2]);
const scene = doc.getRoot().listScenes()[0];
const count = (n) => { let t = 0; n.traverse((c) => { const m = c.getMesh(); if (m) for (const p of m.listPrimitives()) { const i = p.getIndices(); t += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; } }); return t; };
for (const r of scene.listChildren()) { console.log('ROOT', r.getName()); for (const c of r.listChildren()) console.log('  ', c.getName().padEnd(22), c.getMesh() ? 'mesh' : '    ', String(Math.round(count(c))).padStart(7), c.getTranslation().map(v => v.toFixed(2)).join(','), c.listChildren().length ? '[' + c.listChildren().map(x => x.getName()).slice(0, 6).join(' ') + ']' : ''); }
