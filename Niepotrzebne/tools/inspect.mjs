import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
let rows = [];
for (const m of root.listMeshes()) {
  let verts = 0, targets = 0, bytes = 0, attrs = new Set();
  for (const p of m.listPrimitives()) { const pos = p.getAttribute('POSITION'); verts += pos.getCount(); targets += p.listTargets().length; for (const s of p.listSemantics()) { attrs.add(s); bytes += p.getAttribute(s).getArray().byteLength; } for (const t of p.listTargets()) for (const s of t.listSemantics()) bytes += t.getAttribute(s).getArray().byteLength; }
  rows.push([m.getName(), verts, targets, (bytes / 1e6).toFixed(2), [...attrs].join(',')]);
}
rows.sort((a, b) => b[3] - a[3]); for (const r of rows.slice(0, 25)) console.log(r.join(' | '));
console.log('textures', root.listTextures().map(t => `${t.getName()} ${t.getMimeType()} ${t.getSize()} ${(t.getImage().byteLength/1e6).toFixed(2)}MB`).join('\n'));
console.log('anims', root.listAnimations().map(a => a.getName()).join(','));
