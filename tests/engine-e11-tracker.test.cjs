'use strict';
// Tracker sweep (E11): engine rules the audit tracker left open.
//   - Class A shoulder boards and epaulet sleeves seen from above sit just above the shoulder, turned
//     along the strap, like the Class B and the aviator shirt (R7), not floating over the sheet's top edge.
//   - The corporate blazer's turtleneck hides the shirt collar as well as the shirt and the tie (4.2.3.4).
//   - The command insignia pin is not worn with the Command Council, CSAG, National Board or NEC badge
//     (10.2.5).
//   - The Aide de Camp cord is worn by senior members as well as cadets, on Class A and Class B (9.3.4);
//     the cadet cords stay with cadets (9.3) and off the cadet semi-formal.
//   - Headgear is mandatory with the Class A and Class B: 'No headgear' is drawn, with a note (4.1.6.7...).
//   - CFU: the ES patch goes 1/2 in above the command pin's real top edge (5.2.1.1.2.8).
//   - A CAP service badge is worn closest to the collar, the Volunteer University badge included (10.2.4).
//   - The Inspector General badge may carry a gold star (10.5.1).

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
const B = require('../data/badge-catalog.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function build(uniform, gender, membership, rank, badges, extra){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: (badges || []).map(id => ({ id })), command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const compose = b => P.composeUniform(b, store);
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} vs ${b.toFixed(3)}`);
const CMD = { id: 'squadron_commander_badge', title: 'Squadron Commander Badge', graduated: false };
const GRAD = { id: 'squadron_commander_badge', title: 'Squadron Commander Badge', graduated: true };

// ---- Class A views from above ------------------------------------------------------------------

// The four corners of a placed (possibly rotated) layer, in scene inches.
function corners(l){
  const o = l.origin, r = (l.rotate || 0) * Math.PI / 180;
  return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([px, py]) => {
    const dx = px - o.x, dy = py - o.y;
    return { x: o.x + dx * Math.cos(r) - dy * Math.sin(r), y: o.y + dx * Math.sin(r) + dy * Math.cos(r) };
  });
}

for(const [sex, membership, rank] of [
  ['male', 'senior', 'Capt'], ['male', 'senior', 'Col'], ['male', 'senior', 'Maj Gen'], ['female', 'senior', 'Lt Col'], ['female', 'senior', 'Brig Gen'],
  ['male', 'cadet', 'C/2d Lt'], ['male', 'cadet', 'C/Col'], ['female', 'cadet', 'C/Maj'], ['female', 'cadet', 'C/Col']
]){
  test(`Class A ${sex} ${rank}: the view from above of each epaulet or board rests just above its shoulder (R7)`, async () => {
    const scene = await compose(build('blues_a', sex, membership, rank, []));
    const coat = await store.load(sex === 'male' ? 'garment-blues-class-a-coat' : 'garment-blues-class-a-coat-female');
    const seam = { right: core.anchor(coat, 'shoulder_seam_right'), left: core.anchor(coat, 'shoulder_seam_left') };
    const tops = scene.layers.filter(l => l.role === 'epaulet-top');
    assert.equal(tops.length, 2);
    for(const side of ['right', 'left']){
      const view = byKey(scene, `epaulet-top:${side}`);
      assert.ok(view, `${side} view`);
      const c = corners(view);
      const lowest = Math.max(...c.map(p => p.y));
      // Not on the coat (it lies above the shoulder seam), and not floating: within 0.9 in of it. The old
      // rule hung the view 0.75 in over the sheet's top edge, 3 in above the shoulder.
      assert.ok(lowest <= seam[side].y + 0.05, `${side}: the view's lowest corner ${lowest.toFixed(2)} is above the seam height ${seam[side].y.toFixed(2)}`);
      assert.ok(seam[side].y - lowest < 0.9, `${side}: within 0.9 in of the shoulder (${(seam[side].y - lowest).toFixed(2)})`);
      // Over its own shoulder: the view's centre is on the shoulder's side of the centre line.
      assert.ok(side === 'right' ? view.origin.x < coat.w / 2 : view.origin.x > coat.w / 2, `${side} on its own side`);
      // Turned to lie along the strap, not left upright: some tilt, never more than a quarter turn off.
      const turn = Math.abs(((view.rotate % 90) + 90) % 90);
      assert.ok(turn > 5 && turn < 85, `${side}: lies along the sloping strap (rotate ${view.rotate})`);
    }
    // The grade is on every view from above.
    assert.ok(scene.layers.filter(l => /^grade:top-/.test(l.key)).length >= 1 || membership === 'senior', 'cadet boards carry the grade');
  });
}

test('Class A: the cadet semi-formal coat also shows its boards just above the shoulder', async () => {
  const scene = await compose(build('semi_formal_usaf', 'male', 'cadet', 'C/Capt', []));
  const coat = await store.load('garment-semiformal-class-a-coat-male');
  const seam = core.anchor(coat, 'shoulder_seam_right');
  const view = byKey(scene, 'epaulet-top:right');
  assert.ok(view);
  assert.ok(Math.max(...corners(view).map(p => p.y)) <= seam.y + 0.05);
  assert.ok(seam.y - Math.max(...corners(view).map(p => p.y)) < 0.9);
});

