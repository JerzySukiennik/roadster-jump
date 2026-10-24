import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const doc = await io.read(process.argv[2]);
const names = doc.getRoot().listNodes().map(n => n.getName());
console.log(names.length, names.filter(n => /Nozzle|Exhaust|Door|Seat|Grip|Eye|Lamp|Steer|Wheel_|Mount|Flap|Screen|Cluster|COM|Cam/.test(n)).join(' '));
for (const a of doc.getRoot().listAnimations()) console.log(a.getName(), a.listChannels().map(c => c.getTargetNode().getName() + '.' + c.getTargetPath()).join(','));
