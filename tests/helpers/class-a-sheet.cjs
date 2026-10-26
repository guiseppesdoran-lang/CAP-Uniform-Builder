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

module.exports = { strap, specOf, anchorIn, rectIn, COAT };
