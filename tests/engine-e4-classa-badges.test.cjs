'use strict';
// Men's and women's Class A (and the cadet semi-formal coat): where the badges under and over the
// nameplate sit, and where the lapel insignia rest on the gorge seam. Every distance is measured on the
// composed scene in inches and compared with the garment's own landmarks, not with typed-in numbers.
//   CAPR 39-1 4.1.5.2.2.4.2 (men): the first badge on the wearer's left 1 1/2 in below the top of the
//     welt pocket, centred; the second on the wearer's right 1 1/2 in below the nametag; a third 1/2 in
//     above the nametag.
//   CAPR 39-1 4.1.9.4.4.2 (women): the badges over the nametag, 1/2 in above it and 1/2 in apart, the
//     pair centred over the plate.
//   CAPR 39-1 4.1.5.2.1.4, 4.1.5.2.2.1.1-.2 (Figure 4.6): lapel insignia and cadet NCO chevrons halfway
//     up the seam, resting on but not over it, parallel with the ground.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const RA = require('../data/ribbon-awards.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

const COAT = { male: 'garment-blues-class-a-coat', female: 'garment-blues-class-a-coat-female' };
const ribbons = RA.resolve('cap_achievment_award', {}).map(r => ({ key: 'ribbon:cap_achievment_award', title: 'x', asset: 'ribbon-cap-achievment-award', devices: r.devices, centered: r.centered }));

function build(uniform, gender, membership, rank, badges, extra){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons, medals: [], badges: badges.map(id => ({ id })), command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const badgeLayers = scene => scene.layers.filter(l => l.role === 'badge');
const byKey = (scene, id) => scene.layers.find(l => l.key === 'badge:' + id);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} vs ${b.toFixed(3)}`);

async function landmarks(sex){
  const spec = await store.load(COAT[sex]);
  return { spec, plate: core.landmarkBounds(spec, 'nameplate'), weltTop: core.anchor(spec, 'welt_top_center') };
}

for(const [membership, rank, badges] of [
  ['senior', 'Capt', ['emergency_services_badge', 'communications_technician_badge']],
  ['cadet', 'C/Maj', ['model_rocketry_badge', 'stem_badges', 'cyber_badges']]
]){
  test(`men's Class A ${membership}: pocket badges 1 1/2 in below the welt top and the nameplate, level with each other, the third 1/2 in above the plate (4.1.5.2.2.4.2)`, async () => {
    const { plate, weltTop } = await landmarks('male');
    const scene = await P.composeUniform(build('blues_a', 'male', membership, rank, badges), store);
    const [left, right, third] = membership === 'cadet'
      ? [byKey(scene, 'model_rocketry_badge'), byKey(scene, 'stem_badges'), byKey(scene, 'cyber_badges')]
      : [byKey(scene, 'emergency_services_badge'), byKey(scene, 'communications_technician_badge'), null];
    // The wearer's left pocket is the viewer's right.
    assert.ok(left.x + left.w / 2 > weltTop.x - 1.5, 'first badge on the wearer\'s left');
    near(left.y, weltTop.y + 1.5, 0.005, 'wearer\'s left badge top below the welt top');
    near(left.x + left.w / 2, weltTop.x, 0.005, 'wearer\'s left badge centred on the welt');
    assert.ok(right.x + right.w / 2 < weltTop.x - 1.5, 'second badge on the wearer\'s right');
    near(right.y, plate.y + plate.h + 1.5, 0.005, 'wearer\'s right badge top below the nameplate');
    near(right.x + right.w / 2, plate.x + plate.w / 2, 0.005, 'wearer\'s right badge centred under the nameplate');
    near(left.y, right.y, 0.005, 'the two pocket badges are level');
    if(third){
      // Only the rocketry cadet has a third badge: it goes over the plate.
      near(third.y + third.h, plate.y - 0.5, 0.005, 'third badge bottom above the nameplate');
    }else{
      const over = scene.layers.filter(l => l.role === 'badge' && l.y + l.h <= plate.y + 0.01);
      assert.equal(over.length, 0, 'two badges: none over the plate');
    }
  });
}

test('men\'s Class A: with three ordinary badges the third sits 1/2 in above the nameplate, centred on it', async () => {
  const { plate } = await landmarks('male');
  const scene = await P.composeUniform(build('blues_a', 'male', 'senior', 'Capt', ['emergency_services_badge', 'communications_technician_badge', 'historian_senior_badge']), store);
  const above = badgeLayers(scene).filter(l => l.y + l.h <= plate.y + 0.01);
  assert.equal(above.length, 1);
  near(above[0].y + above[0].h, plate.y - 0.5, 0.005, 'bottom 1/2 in above the nameplate top');
  near(above[0].x + above[0].w / 2, plate.x + plate.w / 2, 0.005, 'centred on the nameplate');
});

for(const [membership, rank] of [['senior', 'Capt'], ['cadet', 'C/Maj']]){
  test(`women's Class A ${membership}: the pair over the nameplate 1/2 in above it and 1/2 in apart, centred (4.1.9.4.4.2)`, async () => {
    const { plate } = await landmarks('female');
    const scene = await P.composeUniform(build('blues_a', 'female', membership, rank, membership === 'cadet' ? ['stem_badges', 'cyber_badges'] : ['emergency_services_badge', 'communications_technician_badge']), store);
    const pair = badgeLayers(scene).sort((a, b) => a.x - b.x);
    assert.equal(pair.length, 2);
    for(const l of pair) near(l.y + l.h, plate.y - 0.5, 0.005, 'badge bottom above the nameplate');
    near(pair[1].x - (pair[0].x + pair[0].w), 0.5, 0.005, 'gap between the badges');
    near((pair[0].x + pair[1].x + pair[1].w) / 2, plate.x + plate.w / 2, 0.005, 'pair centred over the nameplate');
  });
}

test('the nameplate comes from the coat\'s landmark: the cadet semi-formal coat keeps the same right-pocket badge column', async () => {
  const { plate, weltTop } = await landmarks('male');
  const scene = await P.composeUniform(build('semi_formal_usaf', 'male', 'cadet', 'C/Capt', ['emergency_services_badge', 'stem_badges']), store);
  const right = badgeLayers(scene).find(l => l.x + l.w / 2 < weltTop.x - 1.5);
  near(right.x + right.w / 2, plate.x + plate.w / 2, 0.005, 'badge column of the full coat\'s nameplate');
  near(right.y, weltTop.y + 1.5, 0.005, 'level with the left pocket badge, 1 1/2 in below the welt top');
});

// ---- lapel insignia on the gorge seam ------------------------------------------------------------

const INK = require('./helpers/ink-rest.cjs');
const seamY = (spec, side, x) => {
  const p1 = core.anchor(spec, `gorge_seam_${side}_p1`), p2 = core.anchor(spec, `gorge_seam_${side}_p2`);
  return p1.y + (p2.y - p1.y) * (x - p1.x) / (p2.x - p1.x);
};

// The insignia sheets carry both lapels; their landmark rects, moved by the layer's offset, are the
// insignia's boxes in the scene.
// The letters overlays are drawn once per side (each lapel's letters rest on their own seam, FIX-R-OTHER-r2 #1): the right
// layer is the sheet's key, the left one carries ':left'. The circle overlays are one layer.
const sideLayer = (scene, id, side) => scene.layers.find(l => l.id === id && (side === 'left' ? l.key.endsWith(':left') || !scene.layers.some(m => m.id === id && m.key.endsWith(':left')) : !l.key.endsWith(':left')));
async function insigniaBoxes(scene, id){
  assert.ok(scene.layers.some(l => l.id === id), id + ' drawn');
  const spec = await store.load(id);
  return ['right', 'left'].map(side => {
    const layer = sideLayer(scene, id, side);
    const r = core.landmarkBounds(spec, 'lapel_us_' + side) || core.landmarkBounds(spec, 'lapel_cap_' + side);
    return { side, x: r.x + layer.x, y: r.y + layer.y, w: r.w, h: r.h };
  });
}

for(const sex of ['male', 'female']){
  for(const [label, membership, rank, sheet, round] of [
    ['senior officer', 'senior', 'Capt', 'lapel-us', false],
    ['cadet officer', 'cadet', 'C/Maj', 'lapel-cap', false],
    ['senior NCO', 'senior', 'SMSgt', 'lapel-us-nco', true]
  ]){
    test(`${sex} Class A ${label}: the lapel insignia rests on the gorge seam, centred on it (4.1.5.2.2.1)`, async () => {
      const coat = await landmarks(sex);
      const id = `${COAT[sex]}-${sheet}`;
      const scene = await P.composeUniform(build('blues_a', sex, membership, rank, []), store);
      for(const box of await insigniaBoxes(scene, id)){
        const mid = core.anchor(coat.spec, `gorge_seam_${box.side}_mid`);
        near(box.x + box.w / 2, mid.x, 0.03, `${box.side} insignia centred on the seam midpoint`);
        const bottom = box.y + box.h;
        if(round){
          // A circle rests tangent to the seam: its centre is r / cos(slope) above the seam.
          const p1 = core.anchor(coat.spec, `gorge_seam_${box.side}_p1`), p2 = core.anchor(coat.spec, `gorge_seam_${box.side}_p2`);
          const slope = (p2.y - p1.y) / (p2.x - p1.x);
          near(box.y + box.h / 2, seamY(coat.spec, box.side, mid.x) - box.h / 2 * Math.sqrt(1 + slope * slope), 0.005, `${box.side} circle tangent to the seam`);
        }else{
          // FIX-R-OTHER-r2 #1 (D8): the box's bottom edge on the seam's high point left the letters 0.04 to 0.1 in above
          // the seam; the ink rests on it: the lowest point of the drawn letters touches the seam line, none is over it.
          const layer = sideLayer(scene, id, box.side);
          const gap = INK.overlayInkGap(coat.spec, box.side, layer, sheet === 'lapel-cap' ? INK.DRAWN_SEAM_DROP : 0);
          near(gap, 0, 0.006, `${box.side} lowest ink of the letters on the seam`);
          assert.ok(gap >= -0.0015, `${box.side} insignia not over the seam (${gap.toFixed(4)})`);
          void bottom;
        }
      }
    });
  }

  test(`${sex} Class A cadet NCO: the metal chevrons rest on the gorge seam, parallel with the ground (4.1.5.2.1.4)`, async () => {
    const coat = await landmarks(sex);
    const scene = await P.composeUniform(build('blues_a', sex, 'cadet', 'C/SSgt', []), store);
    for(const side of ['right', 'left']){
      const l = scene.layers.find(x => x.key === 'grade:' + side);
      assert.ok(l, side + ' chevron');
      assert.equal(l.rotate || 0, 0, 'parallel with the ground');
      const mid = core.anchor(coat.spec, `gorge_seam_${side}_mid`);
      near(l.x + l.w / 2, mid.x, 0.005, `${side} chevron centred on the seam midpoint`);
      // FIX-R-OTHER-r2 #1 (D8): the chevron's ink, not its box, rests on the seam (the shield bottom and stripe ends stop short of the box).
      const gap = INK.placedInkGap(coat.spec, side, l);
      near(gap, 0, 0.006, `${side} chevron's lowest ink on the seam`);
      assert.ok(gap >= -0.0015, `${side} chevron not over the seam (${gap.toFixed(4)})`);
    }
  });
}
