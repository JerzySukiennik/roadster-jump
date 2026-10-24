// Mobile garment variants: same meshes with textures resized to 1024 (the desktop files keep 2048).
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {textureCompress} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
fs.mkdirSync('../../assets/driver/garments_mobile', {recursive: true});
for (const g of ['rtfkt-nike-af1-tee', 'sweatpants-hm', 'crocs-green']) {
  const doc = await io.read(`../${g}.glb`);
  await doc.transform(textureCompress({encoder: sharp, resize: [1024, 1024], quality: 88}));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  await io.write(`../../assets/driver/garments_mobile/${g}.glb`, doc);
  fs.copyFileSync(`../${g}.item.json`, `../../assets/driver/garments_mobile/${g}.item.json`);
  console.log(g, (fs.statSync(`../../assets/driver/garments_mobile/${g}.glb`).size / 1e6).toFixed(1), 'MB');
}
