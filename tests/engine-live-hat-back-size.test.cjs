'use strict';
// LIVE (Ethan: 'why is the back of the hats so fucking small'): the back view of the cap worn, which carries the name tape, is
// drawn at the same size as the front view (scale 1), 1/2 in clear of it on the picture's right, its crown level with the front's crown
// (LIVE13 E81; it stood on the front's bill before). Its
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

// The sheet's drawing of a cap view: its group's markup, read from the SVG (the crown outline path, the box rect).
const groupSvg = (sheet, group) => {
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', sheet + '.svg'), 'utf8');
  const i = svg.indexOf(`id="${sheet}__${group}"`);
  return i < 0 ? '' : svg.slice(i, svg.indexOf('</g>', i));
};
const GROUPS = { auto: ['hat-patrol-front', 'hat-patrol-back'], tactical: ['hat-ball-front', 'hat-ball-back'], boonie: ['hat-boonie-front', 'hat-boonie-back'] };

for(const [uniform, membership, rank, headgear] of CASES){
  for(const named of [true, false]){
    test(`${uniform} ${rank} ${headgear}, ${named ? 'with' : 'without'} a name: the back view is drawn only when the cap's back carries a name tape and the member shows a name; then at the front's size, 1/2 in beside it, its crown level with the front's (LIVE13 E81)`, async () => {
      const spec = await store.load(SHEET[uniform]);
      const b = hb(uniform, membership, rank, headgear);
      if(!named) b.name = Object.assign({}, b.name, { show: false });
      const scene = await compose(b);
      const front = scene.layers.find(l => l.role === 'hat'), back = scene.layers.find(l => l.role === 'hat-view');
      assert.ok(front, 'a front view');
      const [frontLm, backLm, tapeLm] = RECT[headgear];
      const tape = core.landmarkBounds(spec, tapeLm);
      const texts = scene.layers.filter(l => /^text:(patrol|baseball|boonie)_/.test(l.key || ''));
      if(!tape || !named){
        // CAPR 39-1: the ABU cap (5.1.1.6), the Blue Field Cap (6.2.9) and the boonie hat (5.2.1.2.3) carry nothing on the back; with no name
        // shown there is nothing on any back (Ethan: "no need to show the back when no name is required").
        assert.equal(back, undefined, 'no back view');
        assert.equal(texts.length, 0, 'no name text on a cap');
        return;
      }
      assert.ok(back, 'a back view');
      const at = (layer, name) => { const r = core.landmarkBounds(spec, name), k = layer.w / spec.w; return { x: r.x * k + layer.x, y: r.y * k + layer.y, w: r.w * k, h: r.h * k }; };
      const f = at(front, frontLm), bk = at(back, backLm);
      assert.ok(Math.abs(back.w - front.w) < 1e-9 && Math.abs(back.h - front.h) < 1e-9, 'the back view is at the front view\'s scale');
      const lm = core.landmarkBounds(spec, backLm);
      assert.ok(Math.abs(bk.h - lm.h) < 1e-9 && Math.abs(bk.w - lm.w) < 1e-9, `back box ${bk.w}x${bk.h} is the landmark ${lm.w}x${lm.h}`);
      const box = scene.layers.find(l => l.key === 'hat-view-bounds:' + back.onlyGroups[0]);
      assert.ok(Math.abs((box.h) - (lm.h + 0.2)) < 1e-6, 'the back view box (with its 0.1 in margin) has the landmark height');
      assert.ok(Math.abs(bk.x - (f.x + f.w + 0.5)) < 1e-6, `the gap between the views is 1/2 in (${(bk.x - f.x - f.w).toFixed(3)})`);
      // The sheet draws the back as the front's crown: the back's outline path is in the front's group, and both boxes start at the group's y 0.
      const [gf, gb] = GROUPS[headgear].map(g => groupSvg(SHEET[uniform], g));
      const crown = /<path d="([^"]+)"/.exec(gb)[1];
      assert.ok(gf.includes(`d="${crown}"`), 'the back outline is the front\'s crown');
      for(const g of [gf, gb]) assert.match(g, /<rect x="[-\d.]+" y="0"/);
      const frontCrownBottom = f.y + lm.h;
      assert.ok(Math.abs(frontCrownBottom - (bk.y + bk.h)) < 0.02, `crown bottoms level: front ${frontCrownBottom.toFixed(3)}, back ${(bk.y + bk.h).toFixed(3)}`);
      assert.ok(Math.abs(f.y - bk.y) < 0.02, 'crown tops level');
      assert.equal(texts.length, 1, 'one name on the cap back');
      const t = texts[0], r = back.w / spec.w;
      assert.equal(t.key, 'text:' + tapeLm);
      assert.equal(t.text, 'HILLARD');
      assert.ok(Math.abs(t.x - (tape.x * r + tape.w * r / 2 + back.x)) < 0.05 && Math.abs(t.y - (tape.y * r + tape.h * r / 2 + back.y)) < 0.1, 'the name lies on the tape');
      const bt = at(back, tapeLm);
      assert.ok(t.w <= bt.w && t.h <= bt.h + 1e-9, 'the name fits the tape');
    });
  }
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
