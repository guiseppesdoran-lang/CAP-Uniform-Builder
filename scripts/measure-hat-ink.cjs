#!/usr/bin/env node
'use strict';
// The drawn ink of every cap (hat-*) as a convex hull in inches from the sheet's top-left, for the engine's HAT_INK table
// in js/engine/profiles.js. A cap sheet's box is not the cap: the flight cap's sloped crown and the service cap's brim leave
// large empty corners (Fig A5-9), and the shoulder views from above (epaulet sleeves, shoulder boards) are slid clear of the
// cap by its ink, not its box (clearViewsOfHat). The hull is the smallest convex shape that holds the ink, so a view that
// clears it clears the cap.
//   node scripts/measure-hat-ink.cjs            prints the HAT_INK table
// tests/engine-live-hat-views.test.cjs compares the table in the engine with this output, so an art sync that redraws a cap
// fails the test until the table is regenerated.
const fs = require('node:fs');
const path = require('node:path');
const { polys } = require('./lib-svg-ink.cjs');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const r = n => Math.round(n * 1000) / 1000;
// A vertex within TOL inches of the chord of its neighbours goes; the hull grows by at most TOL at a curve (it is never
// smaller than the ink by more than TOL, which the 0.1 in clearance covers).
const TOL = 0.01;
function hull(P){
  const pts = [].concat(...P).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for(const p of pts){ while(lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for(const p of pts.slice().reverse()){ while(upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
// Douglas-Peucker on a closed ring (split at the two points farthest apart so the ends are never dropped).
function simplifyChain(pts){
  if(pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let far = -1, dmax = 0;
  for(let i = 1; i < pts.length - 1; i++){
    const d = Math.abs(dy * (pts[i][0] - a[0]) - dx * (pts[i][1] - a[1])) / len;
    if(d > dmax){ dmax = d; far = i; }
  }
  if(dmax <= TOL) return [a, b];
  return simplifyChain(pts.slice(0, far + 1)).slice(0, -1).concat(simplifyChain(pts.slice(far)));
}
function simplifyRing(ring){
  let i0 = 0, j0 = 1, best = -1;
  for(let i = 0; i < ring.length; i++) for(let j = i + 1; j < ring.length; j++){
    const d = Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]);
    if(d > best){ best = d; i0 = i; j0 = j; }
  }
  const rot = ring.slice(i0).concat(ring.slice(0, i0));
  const k = rot.findIndex(p => p === ring[j0]);
  const A = simplifyChain(rot.slice(0, k + 1)), B = simplifyChain(rot.slice(k).concat([rot[0]]));
  return A.slice(0, -1).concat(B.slice(0, -1));
}

function compute(){
  const out = {};
  for(const a of manifest.assets.filter(x => /^hat-/.test(x.id)).sort((x, y) => x.id < y.id ? -1 : 1)){
    const svg = fs.readFileSync(path.join(ROOT, 'images', a.path), 'utf8');
    out[a.id] = simplifyRing(hull(polys(svg).map(p => p.map(([x, y]) => [x / 100, y / 100])))).map(([x, y]) => [r(x), r(y)]);
  }
  return out;
}

module.exports = { compute };

if(require.main === module){
  const t = compute();
  console.log('  const HAT_INK = {');
  const keys = Object.keys(t);
  keys.forEach((k, i) => console.log(`    '${k}': ${JSON.stringify(t[k])}${i < keys.length - 1 ? ',' : ''}`));
  console.log('  };');
}
