#!/usr/bin/env node
'use strict';
// The armpit of the wearer's left arm (the right of the sheet as the viewer sees it) on every garment sheet that offers a shoulder cord,
// in sheet inches, read from the sheet's own silhouette (its clipSil path), for ARMPIT in js/engine/profiles-dress.js.
// The sheets state the shoulder seam (shoulder_seam_left) but no armpit. Where the arm hangs apart from the body (the Class A coats, the long
// sleeves) the silhouette has a hole between arm and body and the armpit is that hole's highest point; where a short sleeve lies against the
// body (the Class B short shirt and blouse) it is the inner end of the sleeve's hem, the first reflex (concave) vertex of the outline below
// the sleeve's outer corner.
//   node scripts/measure-armpit.cjs            prints the ARMPIT table
// tests/engine-live-cord-joins.test.cjs compares the table in the engine with this output, so an art sync that redraws a sheet fails
// the test until the table is regenerated. Retire the table when the art states an armpit anchor of its own (FOLLOWUPS).
const fs = require('node:fs');
const path = require('node:path');
const { silhouette } = require('./lib-svg-ink.cjs');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const r = n => Math.round(n * 1000) / 1000;
const IDS = [
  'garment-blues-class-a-coat', 'garment-blues-class-a-coat-female',
  'garment-blues-class-b-shirt-male', 'garment-blues-class-b-shirt-male-long',
  'garment-blues-class-b-blouse-female', 'garment-blues-class-b-blouse-female-long'
];
const area = p => { let a = 0; for(let i = 0; i < p.length; i++){ const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; };
const signed = p => { let a = 0; for(let i = 0; i < p.length; i++){ const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };

function armpitOf(subs){
  const rings = subs.slice().sort((p, q) => area(q) - area(p));
  const outer = rings[0], xs = outer.map(p => p[0]), cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  // An arm apart from the body: the hole on the sheet's right, its highest vertex.
  const hole = rings.slice(1).find(h => h.reduce((s, p) => s + p[0], 0) / h.length > cx);
  if(hole) return hole.reduce((a, b) => (b[1] < a[1] ? b : a));
  // A short sleeve against the body: from the outermost vertex on the right, the first reflex vertex further down.
  const n = outer.length, orient = Math.sign(signed(outer));
  let imax = 0;
  for(let i = 0; i < n; i++) if(outer[i][0] > outer[imax][0]) imax = i;
  const step = outer[(imax + 1) % n][1] > outer[imax][1] ? 1 : -1;
  for(let k = 1; k < n; k++){
    const i = (imax + step * k + n) % n, a = outer[(i - step + n) % n], b = outer[i], c = outer[(i + step + n) % n];
    const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
    const turn = u[0] * v[1] - u[1] * v[0];
    const angle = Math.abs(Math.atan2(turn, u[0] * v[0] + u[1] * v[1])) * 180 / Math.PI;
    // A corner of more than 25 degrees that turns the opposite way to the outline, at least an inch in from the sleeve's outer edge.
    if(Math.sign(turn) === -orient * step && angle > 25 && b[0] < outer[imax][0] - 1) return b;
  }
  return null;
}

function compute(){
  const out = {};
  for(const id of IDS){
    const a = manifest.assets.find(x => x.id === id);
    const svg = fs.readFileSync(path.join(ROOT, 'images', a.path), 'utf8');
    const subs = silhouette(svg);
    if(!subs) throw new Error('no silhouette in ' + id);
    const p = armpitOf(subs);
    if(!p) throw new Error('no armpit found on ' + id);
    out[id] = [r(p[0]), r(p[1])];
  }
  return out;
}

module.exports = { compute, IDS, armpitOf };
if(require.main === module){
  const t = compute();
  console.log('  const ARMPIT = {\n' + Object.keys(t).map(k => `    '${k}': [${t[k][0]}, ${t[k][1]}]`).join(',\n') + '\n  };');
}
