#!/usr/bin/env node
'use strict';
// The outer edge of each arm of the ABU and CFU coat figures, from the sheet's own silhouette (clipSil), one point per inch
// of height from just below the shoulder to the cuff: [x, y] in sheet inches. The front figure's sleeves are the arms
// hanging at the sides; a chevron or sleeve patch worn on the outer arm is seen edge-on there, narrowed and turned along
// the edge (CAPR 39-1 5.1.1.1.1.2, 5.1.1.1.2.2, 5.2.1.1.1.3, 5.2.1.1.2.2-3). The OCP sheet states such a frame itself
// (dimensions.edge_view); these two do not, so js/engine/profiles-field.js carries this table until they do (FOLLOWUPS).
//   node scripts/measure-arm-edge.cjs      prints the ARM_EDGE table; a test compares the engine's table with this output.
const fs = require('node:fs');
const path = require('node:path');
const { silhouette, scanline } = require('./lib-svg-ink.cjs');
const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const r = n => Math.round(n * 100) / 100;
const ry = n => Math.round(n * 1000) / 1000;

function compute(){
  const out = {};
  for(const id of ['garment-abu-coat', 'garment-cfu-coat']){
    const a = manifest.assets.find(x => x.id === id);
    const svg = fs.readFileSync(path.join(ROOT, 'images', a.path), 'utf8');
    const W = +/width="([\d.]+)in"/.exec(svg)[1];
    const fig = silhouette(svg)[0];
    // The shoulder: the highest point of the figure's outline left of the neck; the arm's seam is 1 in below it (the
    // shoulder tip, where the outline turns down the arm), and the table runs from there to the cuff.
    let top = 1e9, bottom = -1e9;
    for(const [x, y] of fig) if(x < 14){ top = Math.min(top, y); bottom = Math.max(bottom, y); }
    const y0 = Math.round((top + 1) * 1000) / 1000, y1 = Math.floor(bottom);
    const right = [], left = [];
    for(let y = y0; y <= y1; y += 1){
      const xs = scanline([fig], y);
      right.push([r(xs.filter(x => x < W / 2 - 4)[0]), ry(y)]);
      const L = xs.filter(x => x > W / 2 + 4);
      left.push([r(L[L.length - 1]), ry(y)]);
    }
    out[id] = { right, left };
  }
  return out;
}

module.exports = { compute };
if(require.main === module){
  const t = compute();
  console.log('  const ARM_EDGE = {');
  const ids = Object.keys(t);
  ids.forEach((id, i) => {
    console.log(`    '${id}': {`);
    console.log(`      right: ${JSON.stringify(t[id].right)},`);
    console.log(`      left: ${JSON.stringify(t[id].left)}`);
    console.log(`    }${i < ids.length - 1 ? ',' : ''}`);
  });
  console.log('  };');
}
