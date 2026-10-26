'use strict';
// LIVE9-1 (Ethan, on the Class B shoulder: "see the issue here?"). The sheets of the Class B shirt and blouse, the aviator shirts and the overblouse draw
// the strap at full width with its topstitching, point and button; the slide-on epaulet sleeve covers the strap (CAPR 39-1 4.1.6.1.1, 4.1.6.1.4, 4.2.5.1.1.1,
// 4.2.6.2.1, Figs 4.8, 4.16, A5-1, A5-6). LIVE7-2's 0.5 in edge-on strip lay on the strap's upper edge and left the strap showing under and past it. The engine now
// draws the sleeve as the strap landmark's polygon from its outer end, cut square to the strap axis short of the point and button (SLEEVE_CUT_FROM_TIP,
// 0.8 in from the tip: 0.5 in to the button's centre, its 0.23 in radius and 0.07 in), in the sleeve art's cloth colour with the two flat shading bands, and the
// grade face-on on its centre. The view from above beside the figure is unchanged. What the sheets state, what the engine reads, and the rules:
//   - the sleeve polygon is the strap's outer part (the sheet's own epaulet_sleeve_poly_<side> where the aviator overlays state it, else the strap landmark cut);
//   - its cut end is at least 0.6 in from the strap's tip, the button's centre lies outside it and the whole button disc is clear of it, the tip is not covered;
//   - every corner of the grade's box lies inside the sleeve at least SLEEVE_MARGIN (0.1 in) from its outline, the grade at regulation size unless that would not fit, then reduced uniformly.

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
const svgOf = id => fs.readFileSync(path.join(ROOT, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');

const CASES = [];
for(const gender of ['male', 'female']){
  for(const sleeve of ['short', 'long']){
    CASES.push({ name: `Class B ${gender} ${sleeve}`, uniform: 'blues_b', gender, sleeve });
    CASES.push({ name: `aviator shirt ${gender} ${sleeve}`, uniform: 'aviator', gender, sleeve });
  }
}
const OVERBLOUSE = [
  { name: 'overblouse', uniform: 'aviator', gender: 'female', sleeve: 'short', opt: { femaleTop: 'overblouse' } },
  { name: 'overblouse long', uniform: 'aviator', gender: 'female', sleeve: 'long', opt: { femaleTop: 'overblouse' } }
];
const MEMBERS = [['senior', '2d Lt', 'gray'], ['senior', 'Capt', 'gray'], ['senior', 'Col', 'gray'], ['senior', 'Brig Gen', 'gray'], ['cadet', 'C/2d Lt', 'blue'], ['cadet', 'C/Lt Col', 'blue'], ['cadet', 'C/Col', 'blue']];

const compose = (c, membership, rank) => P.composeUniform(HARNESS.makeBuild({
  uniform: c.uniform, gender: c.gender, membership, rank, opt: Object.assign({ sleeve: c.sleeve, headgear: 'none' }, c.opt || {})
}), store);

// ---- small geometry ----
const inside = (poly, p) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
const segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
const outlineDist = (poly, p) => Math.min(...poly.map((a, i) => segDist(p, a, poly[(i + 1) % poly.length])));
const corners = l => { const o = l.origin || { x: l.x, y: l.y }; return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, o, l.rotate || 0)); };

// The strap's button as the sheet draws it: the first circle after the strap's own group in the sheet's svg, through the art group's translate and scale.
function buttonOf(garment, side){
  const svg = svgOf(garment);
  const t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/);
  assert.ok(t, garment + ': the art group states its translate and scale');
  const at = svg.indexOf(`__epaulet-${side}"`);
  assert.ok(at > 0, `${garment}: epaulet-${side} group`);
  const m = svg.slice(at).match(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/);
  assert.ok(m, `${garment}: a button circle after epaulet-${side}`);
  const [tx, ty, k] = [Number(t[1]), Number(t[2]), Number(t[3])];
  return { x: (tx + k * Number(m[1])) / 100, y: (ty + k * Number(m[2])) / 100, r: k * Number(m[3]) / 100 };
}

for(const c of [...CASES, ...OVERBLOUSE]){
  for(const [membership, rank, cloth] of MEMBERS){
    test(`${c.name}, ${rank}: the slide-on sleeve covers the strap from its outer end, short of the point and the button, with the grade on its centre (LIVE9-1)`, async () => {
      const scene = await compose(c, membership, rank);
      const sheet = await store.load(scene.garment);
      assert.ok(!scene.layers.some(l => /-epaulet-sleeve-(officer|cadet-officer)$/.test(l.id || '')), 'the sheet\'s own strip overlay is unused');
      for(const side of ['right', 'left']){
        const tag = `${c.name} ${rank} ${side}`;
        const sl = scene.layers.find(l => l.key === `epaulet:${side}`);
        assert.ok(sl && sl.type === 'polygon', `${tag}: sleeve polygon`);
        assert.equal(sl.fill, cloth === 'gray' ? '#5f5c5c' : '#142347', `${tag}: the sleeve art's cloth`);
        const strap = sheet.landmarks[`epaulet_${side}`].points;
        const fr = P.helpers.frameFromPolygon({ base: { w: sheet.w } }, side, strap);
        const along = p => (p.x - fr.center.x) * fr.axis.x + (p.y - fr.center.y) * fr.axis.y;

        // The sleeve is the strap's outer part: every vertex lies on the strap (the aviator sheets' strap has a seam kink, 0.1 in past the landmark's rectangle).
        for(const q of sl.points) assert.ok(inside(strap, q) || outlineDist(strap, q) <= 0.1, `${tag}: sleeve vertex (${q.x.toFixed(2)}, ${q.y.toFixed(2)}) is on the strap`);
        // Its outer end is the strap's outer end: the strap's two outermost vertices (smallest distance along the axis, the corners of its seam end) are sleeve vertices.
        for(const corner of [...strap].sort((a, b) => along(a) - along(b)).slice(0, 2)) assert.ok(Math.min(...sl.points.map(q => Math.hypot(q.x - corner.x, q.y - corner.y))) < 0.02, `${tag}: the strap's outer corner (${corner.x.toFixed(2)}, ${corner.y.toFixed(2)}) is the sleeve's`);

        // Cut square to the axis, at least 0.6 in short of the tip; the tip is not covered.
        const tip = strap.reduce((best, q) => along(q) > along(best) ? q : best, strap[0]);
        const cutAt = Math.max(...sl.points.map(along));
        assert.ok(along(tip) - cutAt >= 0.6, `${tag}: the sleeve ends ${(along(tip) - cutAt).toFixed(3)} in short of the tip (at least 0.6)`);
        assert.ok(!inside(sl.points, tip), `${tag}: the tip is not covered`);
        const cutEdge = sl.points.filter(q => along(q) > cutAt - 0.01);
        assert.ok(cutEdge.length >= 2, `${tag}: the end is a cut edge`);
        // The button's centre is outside the sleeve and the whole disc is clear of it.
        const b = buttonOf(scene.garment, side);
        assert.ok(!inside(sl.points, b), `${tag}: the button's centre is outside the sleeve`);
        assert.ok(outlineDist(sl.points, b) >= b.r, `${tag}: the button (r ${b.r.toFixed(2)}) is clear of the sleeve by ${(outlineDist(sl.points, b) - b.r).toFixed(3)} in`);

        // The grade: inside the sleeve with the margin, centred on it, at regulation size or uniformly reduced.
        const grade = scene.layers.find(l => l.key === `grade:sleeve-${side}`);
        assert.ok(grade, `${tag}: grade`);
        const cs = corners(grade);
        for(const q of cs) assert.ok(inside(sl.points, q), `${tag}: the grade lies inside the sleeve`);
        const room = Math.min(...cs.map(q => outlineDist(sl.points, q)));
        assert.ok(room >= 0.1 - 1e-6, `${tag}: the grade is ${room.toFixed(3)} in from the sleeve's edge`);
        const gc = core.rotatePoint({ x: grade.x + grade.w / 2, y: grade.y + grade.h / 2 }, grade.origin, grade.rotate || 0);
        const cen = P.helpers.polygonCentroid(sl.points);
        assert.ok(Math.hypot(gc.x - cen.x, gc.y - cen.y) < 0.2, `${tag}: the grade is on the sleeve's centre (${Math.hypot(gc.x - cen.x, gc.y - cen.y).toFixed(3)} in off)`);
        const gs = await store.load(grade.id);
        const k = Math.max(grade.w / gs.w, grade.h / gs.h);
        assert.ok(k <= 1.0001, `${tag}: never enlarged (${k.toFixed(3)})`);
        assert.ok(Math.abs(grade.w / gs.w - grade.h / gs.h) < 0.001, `${tag}: scaled uniformly, not squeezed`);
      }
    });
  }
}

test('the grade is regulation size where it fits and uniformly reduced where a corner of its box would come within 0.1 in of the sleeve\'s outline (the captain\'s 1.0 in bars on the 0.9 in aviator strap)', async () => {
  const wide = await compose({ uniform: 'blues_b', gender: 'male', sleeve: 'short' }, 'cadet', 'C/2d Lt');   // the 0.38 in miniature diamond
  const g1 = wide.layers.find(l => l.key === 'grade:sleeve-right'), s1 = await store.load(g1.id);
  assert.ok(Math.abs(g1.w / s1.w - 1) < 1e-6, 'a grade that fits is drawn at regulation size');
  const bars = await compose({ uniform: 'aviator', gender: 'male', sleeve: 'short' }, 'senior', 'Capt');
  const g2 = bars.layers.find(l => l.key === 'grade:sleeve-right'), s2 = await store.load(g2.id);
  assert.ok(g2.w / s2.w < 1, `the bars (${s2.h} in across) do not fit 0.9 in less 0.2 in and are reduced (${(g2.w / s2.w).toFixed(2)})`);
});

test('the shirt beside the blazer draws the same sleeve', async () => {
  const scene = await P.composeUniform(HARNESS.makeBuild({ uniform: 'aviator_blazer', gender: 'male', membership: 'senior', rank: 'Maj' }), store);
  const sleeves = scene.layers.filter(l => l.role === 'epaulet');
  assert.equal(sleeves.length, 2);
  assert.ok(sleeves.every(l => l.type === 'polygon' && l.figure === 2));
  assert.equal(scene.layers.filter(l => /^grade:sleeve-/.test(l.key || '')).length, 2);
});

test('NCOs and members with no grade keep the plain strap: no sleeve', async () => {
  for(const uniform of ['blues_b', 'aviator']){
    const scene = await P.composeUniform(HARNESS.makeBuild({ uniform, gender: 'male', membership: 'senior', rank: 'MSgt' }), store);
    assert.equal(scene.layers.filter(l => l.role === 'epaulet').length, 0, uniform);
  }
});
