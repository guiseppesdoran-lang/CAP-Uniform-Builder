#!/usr/bin/env node
'use strict';
// The armpit of the wearer's left arm (the right of the sheet as the viewer sees it) on every garment sheet that offers a shoulder cord,
// in sheet inches, read from the sheet's own silhouette (its clipSil path), for ARMPIT in js/engine/profiles-dress.js.
// The sheets state the shoulder seam (shoulder_seam_left) but no armpit. Where the arm hangs apart from the body (the Class A coats, the long
// sleeves) the silhouette has a hole between arm and body and the armpit is that hole's highest point; where a short sleeve lies against the
// body (the Class B short shirt and blouse) it is the inner end of the sleeve's hem, the first reflex (concave) vertex of the outline below
// the sleeve's outer corner.
//   node scripts/measure-armpit.cjs            prints the ARMPIT table
// It also prints BODY_SIDE (LIVE10-MASTER-4): from the armpit, the silhouette's edge on the body's side of the gap (the left edge of the hole between arm and
// body, or on a short sleeve the body's side edge below the sleeve's hem), about 1.6 in of its vertices, which the shoulder cord's braid follows under the arm.
// tests/engine-live-cord-joins.test.cjs compares the tables in the engine with this output, so an art sync that redraws a sheet fails
// the test until the tables are regenerated. Retire the tables when the art states an armpit anchor and a body edge of its own (FOLLOWUPS).
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

// The body's side edge from the armpit: of the two ways round the ring from the armpit vertex, the one whose vertex 1 in of arc away lies farther toward the
// body's centre line (smaller x, the garment's right side being the wearer's left arm); its vertices until 1.6 in of arc are passed, armpit first.
const SIDE_ARC = 1.6;
function bodySideOf(subs, armpit){
  const rings = subs.slice().sort((p, q) => area(q) - area(p)), outer = rings[0];
  const cx = (Math.min(...outer.map(p => p[0])) + Math.max(...outer.map(p => p[0]))) / 2;
  const hole = rings.slice(1).find(h => h.reduce((s, p) => s + p[0], 0) / h.length > cx);
  const ring = hole || outer, n = ring.length;
  const at = ring.findIndex(p => p[0] === armpit[0] && p[1] === armpit[1]);
  if(at < 0) return null;
  const walk = step => {
    const pts = [ring[at]]; let arc = 0;
    for(let k = 1; k < n && arc < SIDE_ARC; k++){
      const a = pts[pts.length - 1], b = ring[(at + step * k + 2 * n) % n];
      arc += Math.hypot(b[0] - a[0], b[1] - a[1]); pts.push(b);
    }
    return pts;
  };
  const xAt = (pts, d) => { let arc = 0; for(let i = 1; i < pts.length; i++){ const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if(arc + l >= d){ const t = (d - arc) / l; return pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t; } arc += l; } return pts[pts.length - 1][0]; };
  const a = walk(1), b = walk(-1);
  return (xAt(a, 1) <= xAt(b, 1) ? a : b).map(p => [r(p[0]), r(p[1])]);
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

function computeSide(){
  const out = {};
  for(const id of IDS){
    const a = manifest.assets.find(x => x.id === id);
    const subs = silhouette(fs.readFileSync(path.join(ROOT, 'images', a.path), 'utf8'));
    const p = armpitOf(subs), side = p && bodySideOf(subs, p);
    if(!side) throw new Error('no body side edge found on ' + id);
    out[id] = side;
  }
  return out;
}

module.exports = { compute, computeSide, IDS, armpitOf, bodySideOf };
if(require.main === module){
  const t = compute();
  console.log('  const ARMPIT = {\n' + Object.keys(t).map(k => `    '${k}': [${t[k][0]}, ${t[k][1]}]`).join(',\n') + '\n  };');
  const b = computeSide();
  console.log('\n  const BODY_SIDE = {\n' + Object.keys(b).map(k => `    '${k}': [${b[k].map(q => `[${q[0]}, ${q[1]}]`).join(', ')}]`).join(',\n') + '\n  };');
}
