#!/usr/bin/env node
'use strict';
// The outer edge of each sleeve of the dress sheets that carry a senior NCO sleeve chevron (Class A coat, Class B shirt and blouse, aviator shirt and overblouse, mess dress), from the sheet's
// own silhouette (clipSil), at the chevron's height: three points per side, one inch above, at and one inch below the sheet's chevron_halfway anchor, [x, y] in sheet inches. The chevron is worn on the
// outer arm (CAPR 39-1 4.1.5.2.1.2, 4.1.9.3.3, 4.1.11.1.1.1.3, 4.1.12.2.3.3, 4.1.1.1.1.4, 4.1.2.1.1.4, 4.2.5.1.1.3, 4.2.6.2.3) and seen from the front it hangs on the arm's outer edge, edge-on and
// narrowed, as the ABU and CFU figure's arm shows it (scripts/measure-arm-edge.cjs; js/engine/profiles-field.js armEdgeOf). js/engine/profiles-dress.js carries this table until the sheets state an
// outer-edge frame of their own.
//   node scripts/measure-sleeve-edge.cjs      prints the SLEEVE_EDGE table; a test compares the engine's table with this output.
const fs = require('node:fs');
const path = require('node:path');
const { silhouette, scanline } = require('./lib-svg-ink.cjs');
const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const r = n => Math.round(n * 100) / 100;
const ry = n => Math.round(n * 1000) / 1000;

// The dress sheets the engine puts a senior NCO sleeve chevron on (the semi-formal coats share the Class A coat's anchors but wear no senior NCO chevron).
const SHEETS = [
  'garment-blues-class-a-coat', 'garment-blues-class-a-coat-female',
  'garment-blues-class-b-shirt-male', 'garment-blues-class-b-shirt-male-long', 'garment-blues-class-b-blouse-female', 'garment-blues-class-b-blouse-female-long',
  'garment-aviator-shirt-male', 'garment-aviator-shirt-male-long', 'garment-aviator-shirt-female', 'garment-aviator-shirt-female-long',
  'garment-overblouse-female', 'garment-overblouse-female-long',
  'garment-mess-dress-male', 'garment-mess-dress-female'
];

function compute(){
  const out = {};
  for(const id of SHEETS){
    const a = manifest.assets.find(x => x.id === id);
    const svg = fs.readFileSync(path.join(ROOT, 'images', a.path), 'utf8');
    const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', a.path.replace(/\.svg$/, '.spec.json')), 'utf8'));
    const sil = silhouette(svg);
    const row = {};
    for(const side of ['right', 'left']){
      const c = spec.anchors['chevron_halfway_' + side];
      const cy = c[1] / 100;
      row[side] = [-1, 0, 1].map(k => {
        const xs = scanline(sil, cy + k);
        return [r(side === 'right' ? xs[0] : xs[xs.length - 1]), ry(cy + k)];
      });
    }
    out[id] = row;
  }
  return out;
}

module.exports = { compute, SHEETS };
if(require.main === module){
  const t = compute();
  console.log('  const SLEEVE_EDGE = {');
  const ids = Object.keys(t);
  ids.forEach((id, i) => {
    console.log(`    '${id}': { right: ${JSON.stringify(t[id].right)}, left: ${JSON.stringify(t[id].left)} }${i < ids.length - 1 ? ',' : ''}`);
  });
  console.log('  };');
}
