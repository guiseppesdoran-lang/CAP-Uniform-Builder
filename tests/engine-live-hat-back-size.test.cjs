'use strict';
// LIVE (Ethan: 'why is the back of the hats so fucking small'): the back view of the cap worn, which carries the name tape, is
// drawn at the same size as the front view (scale 1), 1/2 in clear of it on the picture's right, on the same baseline. Its
// box is the sheet's cap-back landmark at its own size. The member's last name lies on the back tape of the caps that carry one
// (CAPR 39-1 7.1.1.8 the OCP patrol cap, 6.2.11.1 the navy tactical cap); the ABU cap (5.1.1.6) and the boonie hat (6.2.10) have
// none in the regulation and none on the sheets, so no name text is drawn on those backs.

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
const compose = b => P.composeUniform(b, store);
const SHEET = { ocp: 'garment-ocp-coat-abu-cut', abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' };
const NAME = { first: 'Ethan', last: 'Hillard', show: true };
const hb = (uniform, membership, rank, headgear) => HARNESS.makeBuild({ uniform, gender: 'male', membership, rank, name: NAME, badgeIds: [], opt: { headgear } });
const RECT = { auto: ['patrol_cap_front', 'patrol_cap_back', 'patrol_cap_back_name_tape'], tactical: ['baseball_cap_front', 'baseball_cap_back', 'baseball_cap_back_name_tape'], boonie: ['boonie_hat_front', 'boonie_hat_back', 'boonie_hat_back_name_tape'] };

const CASES = [
  ['ocp', 'senior', 'Capt', 'auto'], ['ocp', 'senior', 'Capt', 'tactical'],
  ['abu', 'cadet', 'C/Maj', 'auto'], ['abu', 'cadet', 'C/Maj', 'tactical'],
  ['corporate_field', 'senior', 'Capt', 'auto'], ['corporate_field', 'senior', 'Capt', 'tactical'], ['corporate_field', 'senior', 'Capt', 'boonie']
];

for(const [uniform, membership, rank, headgear] of CASES){
  test(`${uniform} ${rank} ${headgear}: the cap back is drawn at the front's size, 1/2 in beside it, same baseline, name on its tape where the cap has one`, async () => {
    const spec = await store.load(SHEET[uniform]);
    const scene = await compose(hb(uniform, membership, rank, headgear));
    const front = scene.layers.find(l => l.role === 'hat'), back = scene.layers.find(l => l.role === 'hat-view');
    assert.ok(front && back, 'a front and a back view');
    const at = (layer, name) => { const r = core.landmarkBounds(spec, name), k = layer.w / spec.w; return { x: r.x * k + layer.x, y: r.y * k + layer.y, w: r.w * k, h: r.h * k }; };
    const [frontLm, backLm, tapeLm] = RECT[headgear];
    const f = at(front, frontLm), b = at(back, backLm);
    assert.ok(Math.abs(back.w - front.w) < 1e-9 && Math.abs(back.h - front.h) < 1e-9, 'the back view is at the front view\'s scale');
    // Box height and width are the sheet's cap-back landmark, in inches, unreduced.
    const lm = core.landmarkBounds(spec, backLm);
    assert.ok(Math.abs(b.h - lm.h) < 1e-9 && Math.abs(b.w - lm.w) < 1e-9, `back box ${b.w}x${b.h} is the landmark ${lm.w}x${lm.h}`);
    const box = scene.layers.find(l => l.key === 'hat-view-bounds:' + back.onlyGroups[0]);
    assert.ok(Math.abs((box.h) - (lm.h + 0.2)) < 1e-6, 'the back view box (with its 0.1 in margin) has the landmark height');
    assert.ok(Math.abs(b.x - (f.x + f.w + 0.5)) < 1e-6, `the gap between the views is 1/2 in (${(b.x - f.x - f.w).toFixed(3)})`);
    assert.ok(Math.abs((b.y + b.h) - (f.y + f.h)) < 1e-6, 'same baseline');
    const tape = core.landmarkBounds(spec, tapeLm);
    const texts = scene.layers.filter(l => /^text:(patrol|baseball|boonie)_/.test(l.key || ''));
    if(tape){
      assert.equal(texts.length, 1, 'one name on the cap back');
      const t = texts[0], r = back.w / spec.w;
      assert.equal(t.key, 'text:' + tapeLm);
      assert.equal(t.text, 'HILLARD');
      assert.ok(Math.abs(t.x - (tape.x * r + tape.w * r / 2 + back.x)) < 0.05 && Math.abs(t.y - (tape.y * r + tape.h * r / 2 + back.y)) < 0.1, 'the name lies on the tape');
      const bt = at(back, tapeLm);
      assert.ok(t.w <= bt.w && t.h <= bt.h + 1e-9, 'the name fits the tape');
    }else{
      assert.equal(texts.length, 0, `${headgear} cap back of ${uniform} has no name tape (5.1.1.6, 6.2.10): no name text`);
    }
  });
}

test('every cap back that carries a tape on the three field sheets: the member\'s name is drawn on it in all three coats', async () => {
  let n = 0;
  for(const [uniform, membership, rank, headgear] of CASES){
    const spec = await store.load(SHEET[uniform]);
    if(!core.landmarkBounds(spec, RECT[headgear][2])) continue;
    const scene = await compose(hb(uniform, membership, rank, headgear));
    assert.ok(scene.layers.some(l => l.key === 'text:' + RECT[headgear][2] && l.text === 'HILLARD'), `${uniform} ${headgear}`);
    n++;
  }
  assert.ok(n >= 4, 'OCP patrol and tactical, ABU tactical, CFU tactical at least');
});
