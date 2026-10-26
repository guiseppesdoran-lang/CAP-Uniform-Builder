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
const has = id => manifest.assets.some(a => a.id === id);
// `real`: the four base sheets are synced. `realOverlays`: their tactical and screen-print overlays are too. `realCap`: the baseball cap.
const real = SHEETS.every(has);
const realOverlays = real && SHEETS.every(id => has(id + '-tactical') && has(id + '-seal-print'));
const realCap = has('hat-baseball-cap-blue') && has('hat-baseball-cap-blue-back');

// Whatever is not synced yet is replaced by a synthetic spec with the same contract, so the engine's rules are tested either way.
function build(){
  const extra = {};
  const m = JSON.parse(JSON.stringify(manifest));
  const add = (id, w, h, landmarks, anchors, category) => {
    if(has(id)) return;
    extra[id] = { asset_id: id, size_in: { w, h }, landmarks, anchors };
    m.assets.push({ id, path: (category || 'garments') + '/' + id + '.svg', category: category || 'garments', w_in: w, h_in: h, size_source: 'estimated', anchors, landmarks: Object.keys(landmarks), has_spec: true, issues: [] });
  };
  const anchors = { top_center: [1373, 0], bottom_center: [1373, 2848], center: [1373, 1424], left_edge: [0, 1424], right_edge: [2746, 1424], hat_attach: [1373, 40] };
  for(const sex of ['male', 'female']) for(const long of ['', '-long']){
    const id = `garment-polo-${sex}${long}`;
    // {x, y} of a slot stated with w_in / h_in is its centre (hundredths of an inch).
    const lm = { seal_slot: { x: 800, y: 1000, w_in: 2.93, h_in: 2.93 }, name_slot: { x: 1900, y: 1100, w_in: 4.2, h_in: 0.4 }, badge_slot: { x: 1900, y: 970, w_in: 1.2, h_in: 1.14, gap_to_name_in: 0.5 },
      print_seal_slot: { x: 1900, y: 1000, w_in: 2.93, h_in: 2.93 }, hat_view: { front: { x: 600, y: -645, w: 800, h: 680 }, back: { x: 1450, y: -455, w: 800, h: 490 } } };
    if(sex === 'male') lm.pocket = { x: 1650, y: 1200, w: 450, h: 500 };
    add(id, 27.46, 28.48, lm, anchors);
    const base = manifest.assets.find(a => a.id === id);
    add(id + '-tactical', base ? base.w_in : 27.46, base ? base.h_in : 28.48, {}, anchors);
    add(id + '-seal-print', base ? base.w_in : 27.46, base ? base.h_in : 28.48, {}, anchors);
  }
  add('hat-baseball-cap-blue', 8, 6.8, {}, { top_center: [400, 0], garment_attach_center: [400, 640] }, 'accessories');
  add('hat-baseball-cap-blue-back', 8, 4.9, {}, { top_center: [400, 0] }, 'accessories');
  return { manifest: m, store: core.createSpecStore(m, p => {
    const id = path.basename(p).replace('.spec.json', '');
    return Promise.resolve(extra[id] || JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8')));
  }) };
}

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

module.exports = { ...build(), real, realOverlays, realCap, SHEETS, slot, point };
