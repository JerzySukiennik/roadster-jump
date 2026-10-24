// Roadster Jump asset optimizer: strips avatar morph targets and clips the game never uses, converts car PNGs to WebP and meshopt-compresses buffers losslessly (no quantization, node transforms untouched).
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {prune, dedup, textureCompress} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
const SRC = '..', OUT = '../../assets';
async function run(src, dst, {strip = false, webp = false, maxTex = 0} = {}) {
  const doc = await io.read(`${SRC}/${src}`);
  const root = doc.getRoot();
  if (strip) {
    for (const m of root.listMeshes()) { for (const p of m.listPrimitives()) for (const t of p.listTargets()) { p.removeTarget(t); t.dispose(); } m.setWeights([]); }
    for (const a of root.listAnimations()) a.dispose();
  }
  if (webp || maxTex) await doc.transform(textureCompress({encoder: sharp, targetFormat: webp ? 'webp' : undefined, quality: 92, resize: maxTex ? [maxTex, maxTex] : undefined}));
  await doc.transform(dedup(), prune({keepLeaves: true, keepAttributes: true}));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  await io.write(`${OUT}/${dst}`, doc);
  console.log(dst, (fs.statSync(`${SRC}/${src}`).size / 1e6).toFixed(1), '->', (fs.statSync(`${OUT}/${dst}`).size / 1e6).toFixed(1), 'MB');
}
await run('roadster.glb', 'car/roadster.glb', {webp: true});
await run('roadster_lod1.glb', 'car/roadster_lod1.glb', {webp: true, maxTex: 1024});
await run('character_nude_v2.glb', 'driver/character.glb', {strip: true});
await run('character_nude_v2_mobile.glb', 'driver/character_mobile.glb', {strip: true});
for (const g of ['rtfkt-nike-af1-tee', 'sweatpants-hm', 'crocs-green']) { await run(`${g}.glb`, `driver/garments/${g}.glb`); fs.copyFileSync(`${SRC}/${g}.item.json`, `${OUT}/driver/garments/${g}.item.json`); }
