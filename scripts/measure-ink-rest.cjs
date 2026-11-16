#!/usr/bin/env node
'use strict';
// The lowest ink of the pieces the engine rests on the gorge seam (cadet NCO metal chevrons, the CAP collar insignia,
// the lapel US and CAP letters of the Class A coats): the lower convex hull of each piece's drawn ink, in inches.
// A piece's box is not its ink (the chevron's rounded shield bottom and stripe ends stop short of the box corners), and a
// piece 'resting on but not over the seam' (CAPR 39-1 4.1.5.2.1.4, 4.1.9.3.5, 4.1.5.2.2.1, 4.1.9.4.1) touches it with ink.
//   node scripts/measure-ink-rest.cjs            prints the INK_REST table for js/engine/profiles-dress.js
// tests/engine-fix-r-other-4.test.cjs compares the table in the engine with this output, so an art sync that redraws a
// piece fails the test until the table is regenerated. Retire the table when the art states rest anchors of its own
// (FOLLOWUPS: art rest_hull anchors).
const fs = require('node:fs');
const path = require('node:path');
const { polys, lowerHull } = require('./lib-svg-ink.cjs');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const r = n => Math.round(n * 1000) / 1000;
// Douglas-Peucker on the hull chain: a vertex within TOL inches of the chord of its neighbours goes. The ink the table
// stands for is therefore up to TOL (0.0025 in) smaller than drawn at a curve, well under the 0.02 in the tests allow.
const TOL = 0.0025;
function simplify(pts){
  if(pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let far = -1, dmax = 0;
  for(let i = 1; i < pts.length - 1; i++){
    const d = Math.abs(dy * (pts[i][0] - a[0]) - dx * (pts[i][1] - a[1])) / len;
    if(d > dmax){ dmax = d; far = i; }
  }
  if(dmax <= TOL) return [a, b];
  const left = simplify(pts.slice(0, far + 1)), right = simplify(pts.slice(far));
  return left.slice(0, -1).concat(right);
}
const hullIn = P => simplify(lowerHull(P).map(([x, y]) => [x / 100, y / 100])).map(([x, y]) => [r(x), r(y)]);

// Chevrons and the collar insignia: hull in inches from the asset box's top-left.
function placedIds(){
  return manifest.assets.map(a => a.id).filter(id => /^rank-cadet-nco-.*-metal$/.test(id) || id === 'collar-insignia-cap-metal').sort();
}
// The lapel letter overlays: hull in sheet inches, per side. The circle overlays (NCO) rest by their circle.
const OVERLAYS = ['garment-blues-class-a-coat-lapel-us', 'garment-blues-class-a-coat-female-lapel-us', 'garment-blues-class-a-coat-lapel-cap', 'garment-blues-class-a-coat-female-lapel-cap'];

function compute(){
  const out = {};
  for(const id of placedIds()){
    const a = manifest.assets.find(x => x.id === id);
    const svg = fs.readFileSync(path.join(ROOT, 'images', a.path), 'utf8');
    out[id] = hullIn(polys(svg));
  }
  for(const id of OVERLAYS){
    const a = manifest.assets.find(x => x.id === id);
    if(!a) continue;
    const svg = fs.readFileSync(path.join(ROOT, 'images', a.path), 'utf8');
    for(const side of ['right', 'left']){
      // The side's group wraps nested <g>s: take the text from its start to the next side's start (or the end).
      const start = svg.indexOf(`<g id="${id}__lapel-${/cap/.test(id) ? 'cap' : 'us'}-${side}">`);
      const other = svg.indexOf(`<g id="${id}__lapel-${/cap/.test(id) ? 'cap' : 'us'}-${side === 'right' ? 'left' : 'right'}">`);
      const end = other > start ? other : svg.length;
      // Keep the root <svg> and its art group's transform in front of the slice, so the nested transforms apply.
      const head = svg.slice(0, svg.indexOf('<g id="' + id + '__lapel-'));
      const wrapped = head + svg.slice(start, end) + '</g></svg>';
      out[id + '#' + side] = hullIn(polys(wrapped));
    }
  }
  return out;
}

module.exports = { compute, placedIds, OVERLAYS };

if(require.main === module){
  const t = compute();
  console.log('  const INK_REST = {');
  const keys = Object.keys(t);
  keys.forEach((k, i) => console.log(`    '${k}': ${JSON.stringify(t[k])}${i < keys.length - 1 ? ',' : ''}`));
  console.log('  };');
}
