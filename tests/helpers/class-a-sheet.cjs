'use strict';
// What the Class A coat sheets state, read from the shipped specs (images/**), so a test checks the engine against the art and not against a
// copy of the art's numbers: the wearer's-left strap axis (the garment_fit the shoulder cord assets carry for each coat, neck end then
// arm end, sheet inches) and the coat's width, for mirroring it onto the wearer's right.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const specOf = id => {
  const a = manifest.assets.find(x => x.id === id);
  return JSON.parse(fs.readFileSync(path.join(root, 'images', a.path.replace(/\.svg$/, '.spec.json')), 'utf8'));
};
const COAT = { male: 'garment-blues-class-a-coat', female: 'garment-blues-class-a-coat-female' };
const FIT = { male: 'class_a_coat', female: 'class_a_coat_female' };

// { w, axis: [[neck x, y], [arm x, y]] } for the wearer's left strap; `mirror(side)` gives { neck, arm } for either side.
function strap(sex){
  const fit = specOf('cord-wing').garment_fit[FIT[sex]], w = specOf(COAT[sex]).size_in.w;
  const axis = fit.strap_axis.map(([x, y]) => [x / 100, y / 100]);
  const mirror = side => {
    const [n, a] = axis;
    return side === 'left' ? { neck: { x: n[0], y: n[1] }, arm: { x: a[0], y: a[1] } } : { neck: { x: w - n[0], y: n[1] }, arm: { x: w - a[0], y: a[1] } };
  };
  return { w, axis, mirror };
}

// A landmark rectangle or an anchor of a sheet, in inches.
const anchorIn = (id, name) => { const p = specOf(id).anchors[name]; return p && { x: p[0] / 100, y: p[1] / 100 }; };
const rectIn = (id, name) => { const r = specOf(id).landmarks[name]; return r && { x: r.x / 100, y: r.y / 100, w: r.w / 100, h: r.h / 100 }; };

// The shoulder seam of a Class A coat sheet on each side, measured from the sheet's own silhouette (scripts/measure-garment-outline.cjs, the sheet's clip path cut
// 6 in from its top): the run of the outline between the collar seam (`neck`, where the shoulder line leaves the neck and collar) and the shoulder point (`outer`,
// the last vertex before the sleeve drops away steeply), every segment of it within 25 degrees of level; the sleeve's drop is a run of segments steeper than 40.
// Sheet inches; `side` is the wearer's side ('left' is the sheet's right half). Ethan, 2 November 2026: "the shoulder boards on class a's should always match the
// shoulder seam".
const OUTLINE = require('../../scripts/measure-garment-outline.cjs');
let rings = null;
function seam(coatId, side){
  rings = rings || OUTLINE.compute();
  const pts = rings[coatId].slice(1);
  const mid = (Math.min(...pts.map(p => p[0])) + Math.max(...pts.map(p => p[0]))) / 2;
  const half = pts.filter(p => side === 'left' ? p[0] > mid : p[0] < mid).sort((a, b) => side === 'left' ? b[0] - a[0] : a[0] - b[0]);
  const slope = (a, b) => Math.atan2(Math.abs(b[1] - a[1]), Math.abs(b[0] - a[0])) * 180 / Math.PI;
  const iS = half.findIndex((p, i) => i < half.length - 1 && slope(p, half[i + 1]) < 25);
  let iN = iS;
  while(iN < half.length - 1 && slope(half[iN], half[iN + 1]) < 25) iN++;
  return { neck: { x: half[iN][0], y: half[iN][1] }, outer: { x: half[iS][0], y: half[iS][1] } };
}

module.exports = { strap, seam, specOf, anchorIn, rectIn, COAT };
