#!/usr/bin/env node
'use strict';
// The upper outline (neck, collars, shoulders and the top of the sleeves) of every garment sheet that draws the epaulet
// sleeves or shoulder boards seen from above, as a closed polygon in sheet inches, for the engine's GARMENT_TOP table in
// js/engine/profiles-dress.js. The sheets state the strap (epaulet_<side>) and the collar leaves as landmarks but not the
// silhouette: it is only the sheet's clip path. A view from above rests on the shoulder line, but the collar rises past that
// line at the neck end and a landmark's edge sits a little inside the drawn edge, so the engine seats each view against this
// outline (seatViewsAboveOutline). The outline is the sheet's outer clip path cut at TOP_CUT inches from the sheet's top.
//   node scripts/measure-garment-outline.cjs            prints the GARMENT_TOP table
// tests/engine-live-epaulet-views.test.cjs compares the table in the engine with this output, so an art sync that redraws a
// garment fails the test until the table is regenerated.
const fs = require('node:fs');
const path = require('node:path');
const { silhouette } = require('./lib-svg-ink.cjs');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const r = n => Math.round(n * 1000) / 1000;
const TOP_CUT = 6;
const TOL = 0.01;
const IDS = [
  'garment-aviator-shirt-female', 'garment-aviator-shirt-female-long', 'garment-aviator-shirt-male', 'garment-aviator-shirt-male-long',
  'garment-blues-class-a-coat', 'garment-blues-class-a-coat-female',
  'garment-blues-class-b-blouse-female', 'garment-blues-class-b-blouse-female-long', 'garment-blues-class-b-shirt-male', 'garment-blues-class-b-shirt-male-long',
  'garment-overblouse-female', 'garment-overblouse-female-long',
  'garment-semiformal-class-a-coat-female', 'garment-semiformal-class-a-coat-male'
];

const area = p => { let a = 0; for(let i = 0; i < p.length; i++){ const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; };
// Sutherland-Hodgman against the half plane y <= cut.
function clipAbove(poly, cut){
  const out = [];
  for(let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ain = a[1] <= cut, bin = b[1] <= cut;
    if(ain) out.push(a);
    if(ain !== bin){ const t = (cut - a[1]) / (b[1] - a[1]); out.push([a[0] + t * (b[0] - a[0]), cut]); }
  }
  return out;
}
// Douglas-Peucker on a closed ring: split at the two farthest vertices so neither end is dropped.
function chain(pts){
  if(pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let far = -1, dmax = 0;
  for(let i = 1; i < pts.length - 1; i++){
    const d = Math.abs(dy * (pts[i][0] - a[0]) - dx * (pts[i][1] - a[1])) / len;
    if(d > dmax){ dmax = d; far = i; }
  }
  if(dmax <= TOL) return [a, b];
  return chain(pts.slice(0, far + 1)).slice(0, -1).concat(chain(pts.slice(far)));
}
function simplify(ring){
  let i0 = 0, j0 = 1, best = -1;
  for(let i = 0; i < ring.length; i++) for(let j = i + 1; j < ring.length; j += Math.max(1, Math.floor(ring.length / 60))){
    const d = Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]);
    if(d > best){ best = d; i0 = i; j0 = j; }
  }
  const rot = ring.slice(i0).concat(ring.slice(0, i0));
  const k = rot.findIndex(p => p === ring[j0]);
  return chain(rot.slice(0, k + 1)).slice(0, -1).concat(chain(rot.slice(k).concat([rot[0]])).slice(0, -1));
}

function compute(){
  const out = {};
  for(const id of IDS){
    const a = manifest.assets.find(x => x.id === id);
    const svg = fs.readFileSync(path.join(ROOT, 'images', a.path), 'utf8');
    const subs = silhouette(svg);
    if(!subs) throw new Error('no silhouette in ' + id);
    const main = subs.slice().sort((p, q) => area(q) - area(p))[0];
    out[id] = simplify(clipAbove(main, TOP_CUT)).map(([x, y]) => [r(x), r(y)]);
  }
  return out;
}

module.exports = { compute, IDS, TOP_CUT };

if(require.main === module){
  const t = compute();
  console.log('  const GARMENT_TOP = {');
  const keys = Object.keys(t);
  keys.forEach((k, i) => console.log(`    '${k}': ${JSON.stringify(t[k])}${i < keys.length - 1 ? ',' : ''}`));
  console.log('  };');
}
