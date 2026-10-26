'use strict';
// The polo (Corporate Working Uniform, CAPR 39-1 5.3) sheets for the engine tests. When the art tree's polo sheets have been synced
// (images/garments/garment-polo-*), the tests run on them; until then they run on synthetic sheets that carry the same landmark
// contract (seal_slot, name_slot, badge_slot, print_seal_slot, pen_pocket_slot, pocket on the men's), so the engine's rules are
// tested either way. `real` says which. The synthetic sheets are not drawings: only specs, never rendered.
const fs = require('node:fs');
const path = require('node:path');
const core = require('../../js/engine/core.js');

const root = path.join(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const SHEETS = ['garment-polo-male', 'garment-polo-male-long', 'garment-polo-female', 'garment-polo-female-long'];
const real = SHEETS.every(id => manifest.assets.some(a => a.id === id)) &&
  SHEETS.every(id => ['-tactical', '-seal-print'].every(s => manifest.assets.some(a => a.id === id + s)));

function build(){
  if(real) return { manifest, store: core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8')))) };
  const extra = {};
  const m = JSON.parse(JSON.stringify(manifest));
  const add = (id, w, h, landmarks, anchors) => {
    extra[id] = { asset_id: id, size_in: { w, h }, landmarks, anchors };
    m.assets.push({ id, path: 'garments/' + id + '.svg', category: 'garments', w_in: w, h_in: h, size_source: 'estimated', anchors, landmarks: Object.keys(landmarks), has_spec: true, issues: [] });
  };
  const anchors = { top_center: [1373, 0], bottom_center: [1373, 2848], center: [1373, 1424], left_edge: [0, 1424], right_edge: [2746, 1424], hat_attach: [1373, 40] };
  for(const sex of ['male', 'female']) for(const long of ['', '-long']){
    const id = `garment-polo-${sex}${long}`;
    const lm = { seal_slot: { x: 700, y: 900, w_in: 2.5, h_in: 2.5 }, name_slot: { x: 1700, y: 1300, w_in: 3.0, h_in: 0.5 }, badge_slot: { x: 1850, y: 1100 },
      print_seal_slot: { x: 1700, y: 900, w_in: 2.5, h_in: 2.5 }, pen_pocket_slot: { x: 2500, y: 900, w_in: 1, h_in: 4 } };
    if(sex === 'male') lm.pocket = { x: 1650, y: 1200, w: 450, h: 500 };
    add(id, 27.46, 28.48, lm, anchors);
    add(id + '-tactical', 27.46, 28.48, {}, anchors);
    add(id + '-seal-print', 27.46, 28.48, {}, anchors);
  }
  const cap = { garment_attach_center: [500, 450], top_center: [500, 0] };
  extra['hat-baseball-cap-blue'] = { asset_id: 'hat-baseball-cap-blue', size_in: { w: 10, h: 5 }, anchors: cap, landmarks: {} };
  if(!m.assets.some(a => a.id === 'hat-baseball-cap-blue')) m.assets.push({ id: 'hat-baseball-cap-blue', path: 'accessories/hat-baseball-cap-blue.svg', category: 'accessories', w_in: 10, h_in: 5, anchors: cap, landmarks: [], has_spec: true, issues: [] });
  return { manifest: m, store: core.createSpecStore(m, p => {
    const id = path.basename(p).replace('.spec.json', '');
    return Promise.resolve(extra[id] || JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8')));
  }) };
}

// A rectangle landmark in inches from a spec, {x, y, w, h} (hundredths) or {x, y, w_in, h_in}.
function slot(spec, name){
  const r = core.landmarkBounds(spec, name);
  if(r) return r;
  const raw = spec.raw.landmarks && spec.raw.landmarks[name];
  return raw && raw.w_in ? { x: raw.x / 100, y: raw.y / 100, w: raw.w_in, h: raw.h_in } : null;
}
function point(spec, name){
  const a = core.anchor(spec, name) || core.anchor(spec, name + '_center');
  if(a) return a;
  const raw = spec.raw.landmarks && spec.raw.landmarks[name];
  if(raw && !('w' in raw) && !('w_in' in raw)) return { x: raw.x / 100, y: raw.y / 100 };
  const r = slot(spec, name);
  return r ? core.rectCenter(r) : null;
}

module.exports = { ...build(), real, SHEETS, slot, point };
