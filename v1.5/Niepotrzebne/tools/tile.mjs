// Tile images into a labelled contact sheet: node tile.mjs out.jpg cols width img...
import {execFileSync} from 'node:child_process';
const [out, cols, w, ...files] = process.argv.slice(2);
const n = files.length, C = +cols, args = [];
for (const f of files) args.push('-i', f);
let fc = ''; files.forEach((f, i) => { fc += `[${i}:v]scale=${w}:-1[v${i}];`; });
for (let i = 0; i < n; i++) fc += `[v${i}]`;
const lay = []; for (let i = 0; i < n; i++) { const c = i % C, r = Math.floor(i / C); lay.push(`${c ? Array(c).fill('w0').join('+') : '0'}_${r ? Array(r).fill('h0').join('+') : '0'}`); }
fc += `xstack=inputs=${n}:layout=${lay.join('|')}:fill=black`;
execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', fc, '-frames:v', '1', out]);
