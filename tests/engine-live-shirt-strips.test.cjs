'use strict';
// LIVE7-2 (Ethan, on the aviator and Class B shirts: "those on the shirt need to be adjusted to be partially offscreen as they are on top not on
// the front"). The slide-on epaulet sleeve lies on top of the shoulder, so every shirt draws it from the front the way the Class A boards are
// drawn: an edge-on strip on the strap axis (the sleeve art squeezed across to BOARD_STRIP_THICK, 0.5 in), the grade foreshortened along it, the
// view from above beside the figure unchanged. The axis, length and outer end come from the sheet's epaulet_<side> landmark.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images/MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));
const rad = d => d * Math.PI / 180;

const STRIP = 0.5, COVER = 0.82, FROM_END = 0.625;
const CASES = [];
for(const gender of ['male', 'female']){
  for(const sleeve of ['short', 'long']){
    CASES.push({ name: `Class B ${gender} ${sleeve}`, uniform: 'blues_b', gender, sleeve });
    CASES.push({ name: `aviator shirt ${gender} ${sleeve}`, uniform: 'aviator', gender, sleeve });
  }
}
CASES.push({ name: 'overblouse', uniform: 'aviator', gender: 'female', sleeve: 'short', opt: { femaleTop: 'overblouse' } });
CASES.push({ name: 'overblouse long', uniform: 'aviator', gender: 'female', sleeve: 'long', opt: { femaleTop: 'overblouse' } });
const MEMBERS = [['senior', 'Maj', 'gray'], ['cadet', 'C/Maj', 'blue']];

const compose = (c, membership, rank) => P.composeUniform(HARNESS.makeBuild({
  uniform: c.uniform, gender: c.gender, membership, rank, opt: Object.assign({ sleeve: c.sleeve, headgear: 'none' }, c.opt || {}) // no cap: the views are slid clear of a cap (R6), which moves them off the rank slot's seat
}), store);

for(const c of CASES){
  for(const [membership, rank] of MEMBERS){
    test(`${c.name}, ${rank}: the epaulet sleeve is an edge-on strip on the strap axis, the grade on it 5/8 in from the outer end and level with the top view's rank slot (LIVE7-2, R7)`, async () => {
      const scene = await compose(c, membership, rank);
      const sheet = await store.load(scene.garment);
      assert.ok(!scene.layers.some(l => /-epaulet-sleeve-(officer|cadet-officer)$/.test(l.id || '')), 'the sheet\'s own strip overlay is unused');
      for(const side of ['right', 'left']){
        const strip = scene.layers.find(l => l.key === `epaulet:${side}`);
        assert.ok(strip, `${side}: strip`);
        const fr = P.helpers.frameFromPolygon({ base: { w: sheet.w } }, side, sheet.landmarks[`epaulet_${side}`].points);
        // The art is drawn with its collar end up; `rotate` stands it on the strap (frame.deg), squeezed across to the strip's thickness.
        assert.ok(Math.abs(strip.rotate - fr.deg) < 0.01, `${side}: turned onto the strap axis (${strip.rotate} vs ${fr.deg})`);
        assert.ok(Math.abs(strip.w - STRIP) < 0.005, `${side}: ${strip.w.toFixed(3)} in thick, the Class A strip's ${STRIP}`);
        assert.ok(strip.h <= fr.length * COVER + 0.005, `${side}: its length (${strip.h.toFixed(2)}) is within the outer ${COVER * 100}% of the strap (${fr.length.toFixed(2)})`);
        const centre = { x: strip.x + strip.w / 2, y: strip.y + strip.h / 2 };
        // The strip's centre, on the strap's axis: the offset across the strap is within the strap's width, and the outer end is flush with the strap's outer end.
        const origin = strip.origin || centre;
        const c2 = core.rotatePoint(centre, origin, strip.rotate || 0);
        const dx = c2.x - fr.outer.x, dy = c2.y - fr.outer.y;
        const along = dx * fr.axis.x + dy * fr.axis.y, across = dx * fr.normal.x + dy * fr.normal.y;
        assert.ok(Math.abs(along - strip.h / 2) < 0.08, `${side}: outer end flush with the strap's (${along.toFixed(3)} vs ${(strip.h / 2).toFixed(3)})`);
        assert.ok(Math.abs(across) <= fr.width / 2 + 0.05, `${side}: on the strap (${across.toFixed(3)} across, strap ${fr.width.toFixed(2)} wide)`);

        // The grade: foreshortened across the strap, 5/8 in from the outer end along it.
        const grade = scene.layers.find(l => l.key === `grade:edge-${side}`);
        const view = scene.layers.find(l => l.key === `epaulet-top:${side}`);
        assert.ok(grade && view, `${side}: grade and top view`);
        const gc = { x: grade.x + grade.w / 2, y: grade.y + grade.h / 2 };
        const gOrigin = grade.origin || gc;
        const g2 = core.rotatePoint(gc, gOrigin, grade.rotate || 0);
        const gAlong = (g2.x - fr.outer.x) * fr.axis.x + (g2.y - fr.outer.y) * fr.axis.y;
        assert.ok(gAlong > FROM_END, `${side}: the grade's centre is ${gAlong.toFixed(3)} in from the outer end, its outer edge at least 5/8 in (DAFI 36-2903 4.5.1.1.1)`);
        // The rank slot of the view from above (the sleeve's insignia point) lies the same distance from the strap's outer end (R7).
        const topSpec = await store.load(view.id);
        const ins = core.anchor(topSpec, 'insignia_center');
        const vc = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
        const vOrigin = view.origin || vc;
        const insPt = core.rotatePoint({ x: vc.x + (ins.x - topSpec.w / 2), y: vc.y + (ins.y - topSpec.h / 2) }, vOrigin, view.rotate || 0);
        // (the view from above is drawn level, so its distance is read along the level axis, the way epauletViews seats it)
        const slotAlong = Math.abs(insPt.x - fr.outer.x);
        assert.ok(Math.abs(slotAlong - gAlong) < 0.05, `${side}: the top view's rank slot is ${slotAlong.toFixed(3)} in from the outer end, the edge grade ${gAlong.toFixed(3)}`);
      }
    });
  }
}

test('the shirt beside the blazer draws the same strip', async () => {
  const scene = await P.composeUniform(HARNESS.makeBuild({ uniform: 'aviator_blazer', gender: 'male', membership: 'senior', rank: 'Maj' }), store);
  assert.equal(scene.layers.filter(l => l.role === 'epaulet').length, 2);
  assert.ok(scene.layers.filter(l => l.role === 'epaulet').every(l => Math.abs(l.w - STRIP) < 0.005));
});

test('NCOs and members with no grade keep the plain strap: no sleeve, no strip', async () => {
  for(const uniform of ['blues_b', 'aviator']){
    const scene = await P.composeUniform(HARNESS.makeBuild({ uniform, gender: 'male', membership: 'senior', rank: 'MSgt' }), store);
    assert.equal(scene.layers.filter(l => l.role === 'epaulet').length, 0, uniform);
  }
});
