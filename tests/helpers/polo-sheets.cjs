'use strict';
// The synced polo sheets (CAPR 39-1 5.3, images/garments/garment-polo-*) and the way their slot landmarks are read for the engine tests:
// {x, y, w, h} is a rectangle from its top-left corner (hundredths of an inch); {x, y, w_in, h_in} is a slot whose {x, y} is its CENTRE.
const fs = require('node:fs');
const path = require('node:path');
const core = require('../../js/engine/core.js');

const root = path.join(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const SHEETS = ['garment-polo-male', 'garment-polo-male-long', 'garment-polo-female', 'garment-polo-female-long'];
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

// A rectangle landmark in inches from a spec: {x, y, w, h} (top-left, hundredths), or {x, y, w_in, h_in} ({x, y} = the centre).
function slot(spec, name){
  const r = core.landmarkBounds(spec, name);
  if(r) return r;
  const raw = spec.raw.landmarks && spec.raw.landmarks[name];
  return raw && raw.w_in ? { x: raw.x / 100 - raw.w_in / 2, y: raw.y / 100 - raw.h_in / 2, w: raw.w_in, h: raw.h_in } : null;
}
function point(spec, name){
  const r = slot(spec, name);
  if(r) return core.rectCenter(r);
  const raw = spec.raw.landmarks && spec.raw.landmarks[name];
  if(raw && Number.isFinite(raw.x) && !('w' in raw)) return { x: raw.x / 100, y: raw.y / 100 };
  return core.anchor(spec, name);
}

module.exports = { manifest, store, SHEETS, slot, point };
