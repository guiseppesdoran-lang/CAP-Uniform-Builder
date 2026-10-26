'use strict';
// DORAN5-ENG-3. Doran: "the top one should be horizontal in the image". Every top-down view of an epaulet sleeve or shoulder board
// (Class B shirt and blouse, aviator shirts, overblouse, Class A coat and cadet semi-formal, mess dress) is drawn LEVEL: its long
// axis horizontal, its collar end toward the figure's centre, the wearer's right view a quarter turn clockwise from the art and the
// left a quarter turn counter-clockwise, above the shoulder and clear of the garment's outline and of the other view. The edge-on
// strap on the shoulder keeps its turn along the strap. CAPR 39-1 4.1.6.1.4, 4.1.11.1.1, 4.2.5.1; Figures 4.8, A5-1, A5-3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const NAME = { first: 'Pat', last: 'Doe', show: true };
const hb = (uniform, gender, membership, rank, opt) => HARNESS.makeBuild({ uniform, gender, membership, rank, name: NAME, opt: Object.assign({ rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting', headgear: 'none' }, opt || {}) });
const corners = l => {
  const o = l.origin || { x: l.x, y: l.y };
  return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, o, l.rotate || 0));
};
const box = l => { const c = corners(l); const xs = c.map(p => p.x), ys = c.map(p => p.y); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
const turn360 = d => ((d % 360) + 360) % 360;

const CUTS = [
  ['Class B shirt', 'blues_b', 'male', { sleeve: 'short' }], ['Class B shirt, long', 'blues_b', 'male', { sleeve: 'long' }],
  ['Class B blouse', 'blues_b', 'female', { sleeve: 'short' }], ['Class B blouse, long', 'blues_b', 'female', { sleeve: 'long' }],
  ['aviator shirt', 'aviator', 'male', { sleeve: 'short' }], ['aviator shirt, long', 'aviator', 'male', { sleeve: 'long' }],
  ['women\'s aviator shirt', 'aviator', 'female', { sleeve: 'short', femaleTop: 'shirt' }], ['women\'s aviator shirt, long', 'aviator', 'female', { sleeve: 'long', femaleTop: 'shirt' }],
  ['overblouse', 'aviator', 'female', { sleeve: 'short', femaleTop: 'overblouse' }], ['overblouse, long', 'aviator', 'female', { sleeve: 'long', femaleTop: 'overblouse' }],
  ['Class A coat', 'blues_a', 'male', {}], ['Class A coat', 'blues_a', 'female', {}],
  ['cadet semi-formal', 'semi_formal_usaf', 'male', {}], ['cadet semi-formal', 'semi_formal_usaf', 'female', {}],
  ['mess dress', 'mess_dress', 'male', {}], ['mess dress', 'mess_dress', 'female', {}]
];
const GRADES = [['cadet', 'C/Maj'], ['cadet', 'C/Col'], ['senior', 'Capt'], ['senior', 'Col'], ['senior', 'Maj Gen']];

test('every top-down view is level, collar end toward the centre, the two views clear of each other and of the figure (DORAN5-ENG-3)', async () => {
  let checked = 0;
  for(const [label, uniform, gender, opt] of CUTS) for(const [m, r] of GRADES){
    const scene = await P.composeUniform(hb(uniform, gender, m, r, opt), store);
    const R = scene.layers.find(l => l.key === 'epaulet-top:right'), L = scene.layers.find(l => l.key === 'epaulet-top:left');
    if(!R && !L) continue; // grades with no top view on this uniform (a general on the cadet coat, ...)
    const tag = `${label} ${r}`;
    assert.ok(R && L, `${tag}: both views`);
    for(const [side, v] of [['right', R], ['left', L]]){
      const rot = turn360(v.rotate || 0);
      if(/shoulder-boards$/.test(v.id)){
        // The mess dress sheets draw both boards lying along the shoulders in one overlay: the overlay is turned about the board
        // so the board's own axis (the sheet's rank_slot frame) lies along the horizontal, outer end away from the centre line.
        const frame = (await store.load(v.id)).landmarks[`rank_slot_${side}_frame`].deg;
        assert.ok(Math.abs(turn360(frame + rot - (side === 'right' ? 0 : 180) + 180) - 180) < 0.05, `${tag} ${side}: the board lies level (sheet frame ${frame}, turned ${v.rotate})`);
        continue;
      }
      assert.ok([0, 90, 180, 270].some(q => Math.abs(rot - q) < 0.01 || Math.abs(rot - q - 360) < 0.01), `${tag} ${side}: a right-angle turn, not turned onto the strap (rotate ${v.rotate})`);
      const b = box(v);
      assert.ok(b.x1 - b.x0 > b.y1 - b.y0, `${tag} ${side}: long axis horizontal (${(b.x1 - b.x0).toFixed(2)} x ${(b.y1 - b.y0).toFixed(2)})`);
      // The sleeve art stands collar end up: the right view a quarter turn clockwise (collar end to the right, toward the centre
      // line), the left a quarter turn counter-clockwise.
      if(/^rank-epaulet-sleeve-/.test(v.id)) assert.ok(Math.abs(rot - (side === 'right' ? 90 : 270)) < 0.01, `${tag} ${side}: collar end toward the centre (rotate ${v.rotate})`);
    }
    if(/shoulder-boards$/.test(R.id)){ // the overlay's box is the whole sheet: the views are compared by their grades' places
      checked++;
      continue;
    }
    const br = box(R), bl = box(L);
    assert.ok(br.x1 < bl.x0, `${tag}: the two views do not touch (${br.x1.toFixed(2)} vs ${bl.x0.toFixed(2)})`);
    assert.ok(br.x1 < scene.layers.find(l => l.role === 'garment').w / 2 && bl.x0 > scene.layers.find(l => l.role === 'garment').w / 2, `${tag}: each over its own shoulder`);
    // Left and right at the same height (the pair is mirrored; the women's aviator sheet states its two straps 0.15 in apart).
    assert.ok(Math.abs(br.y1 - bl.y1) < 0.3, `${tag}: the two views at one height (${br.y1.toFixed(2)} vs ${bl.y1.toFixed(2)})`);
    checked++;
  }
  assert.ok(checked >= 60, `${checked} builds checked`);
});

test('the edge-on strap on the shoulder keeps its turn along the strap (DORAN5-ENG-3 changes only the view from above)', async () => {
  const scene = await P.composeUniform(hb('blues_b', 'male', 'senior', 'Capt', { sleeve: 'short' }), store);
  const edge = scene.layers.find(l => l.key === 'grade:edge-right');
  assert.ok(edge, 'the edge-on grade is drawn');
  const turn = turn360(edge.rotate || 0) % 90;
  assert.ok(turn > 5 && turn < 85, `turned along the sloping strap (rotate ${edge.rotate})`);
});
