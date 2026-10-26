'use strict';
// Epaulets on the Class B shirt and blouse, the aviator shirt and the overblouse (CAPR 39-1 4.1.11.1.1.1,
// 4.1.12.2.3, 4.2.5.1.1.1, 4.2.6.2.3; DAFI 36-2903 4.5.1.1.1): the edge-on strip sits on the garment's
// epaulet landmark, the top-down view floats just above the shoulder, and the grade shows on both.
// Cadet officers wear blue sleeves with the miniature metal grade, officers gray sleeves, NCOs and
// airmen no sleeve (cadet NCOs the collar chevron).

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

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function build(uniform, membership, rank, gender, opt){
  return {
    uniform, gender, grade: G.gradeInfo(membership, rank, {}),
    opt: Object.assign({ headgear: 'auto', sleeve: 'short', femaleTop: 'shirt' }, opt || {}), name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  };
}

// Every garment cut the epaulet rule covers: [label, uniform, gender, opt, garment id].
const CUTS = [
  ['Class B shirt, short sleeve', 'blues_b', 'male', { sleeve: 'short' }, 'garment-blues-class-b-shirt-male'],
  ['Class B shirt, long sleeve', 'blues_b', 'male', { sleeve: 'long' }, 'garment-blues-class-b-shirt-male-long'],
  ['Class B blouse, short sleeve', 'blues_b', 'female', { sleeve: 'short' }, 'garment-blues-class-b-blouse-female'],
  ['Class B blouse, long sleeve', 'blues_b', 'female', { sleeve: 'long' }, 'garment-blues-class-b-blouse-female-long'],
  ['aviator shirt, short sleeve', 'aviator', 'male', { sleeve: 'short' }, 'garment-aviator-shirt-male'],
  ['aviator shirt, long sleeve', 'aviator', 'male', { sleeve: 'long' }, 'garment-aviator-shirt-male-long'],
  ['women\'s aviator shirt, short sleeve', 'aviator', 'female', { sleeve: 'short' }, 'garment-aviator-shirt-female'],
  ['women\'s aviator shirt, long sleeve', 'aviator', 'female', { sleeve: 'long' }, 'garment-aviator-shirt-female-long'],
  ['overblouse, short sleeve', 'aviator', 'female', { sleeve: 'short', femaleTop: 'overblouse' }, 'garment-overblouse-female'],
  ['overblouse, long sleeve', 'aviator', 'female', { sleeve: 'long', femaleTop: 'overblouse' }, 'garment-overblouse-female-long']
];
// Grades that wear an epaulet sleeve: cadet officers (blue), officers (gray), generals, flight officers,
// and a senior member with no grade on the officer track (gray, blank).
const SLEEVE_MEMBERS = [['cadet', 'C/2d Lt'], ['cadet', 'C/Maj'], ['cadet', 'C/Col'], ['senior', 'Capt'], ['senior', 'Maj'], ['senior', 'Col'], ['senior', '2d Lt'], ['senior', 'FO'], ['senior', 'Brig Gen'], ['senior', 'SM']];
const NO_SLEEVE_MEMBERS = [['cadet', 'C/AB'], ['cadet', 'C/SSgt'], ['senior', 'SMSgt']];

const SIDES = ['right', 'left'];
const pts = lm => lm.points;

function inside(poly, p){
  let c = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
const topY = (poly, x) => P.helpers.polygonTopY(poly, x);

// The four corners of a placed (possibly rotated) layer, in scene inches.
function corners(l){
  const o = l.origin, r = (l.rotate || 0) * Math.PI / 180;
  return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([px, py]) => {
    const dx = px - o.x, dy = py - o.y;
    return { x: o.x + dx * Math.cos(r) - dy * Math.sin(r), y: o.y + dx * Math.sin(r) + dy * Math.cos(r) };
  });
}
// The view where the engine seated it on the shoulder, before the cap slid it outward along its strap to clear the cap
// (clearViewsOfHat): R7's closeness rule is about the seat, the slide is tested in tests/engine-live-hat-views.test.cjs.
const seated = l => l.slid ? Object.assign({}, l, { x: l.x - l.slideDir.x * l.slid, y: l.y - l.slideDir.y * l.slid, origin: { x: l.origin.x - l.slideDir.x * l.slid, y: l.origin.y - l.slideDir.y * l.slid } }) : l;
// Lowest point (largest y) of a convex polygon at x, or null.
function bottomY(poly, x){
  let best = null;
  for(let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if(a.x === b.x || x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x)) continue;
    const y = a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
    if(best == null || y > best) best = y;
  }
  return best;
}

async function sheet(garment){ return store.load(garment); }

// Distance from a point to a polygon's outline.
function outlineDist(poly, p){
  let best = Infinity;
  for(let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}

for(const [label, uniform, gender, opt, garment] of CUTS){
  test(`${label}: sleeve on the strap, top view just above the shoulder, grade on both (R7, LIVE9-1)`, async () => {
    const spec = await sheet(garment);
    for(const [m, r] of SLEEVE_MEMBERS){
      const scene = await P.composeUniform(build(uniform, m, r, gender, opt), store);
      const tag = `${label} ${r}`;
      assert.deepEqual(scene.notes.filter(n => /^No artwork for/.test(n)), [], tag);
      const g = G.gradeInfo(m, r, {});
      for(const side of SIDES){
        const poly = pts(spec.landmarks[`epaulet_${side}`]);

        // The sleeve: the polygon of the strap's outer part, drawn on the epaulet landmark (every vertex on it or within 0.1 in of its outline: the
        // aviator sheets' strap has a seam kink the landmark's rectangle smooths over).
        const sl = scene.layers.find(l => l.key === `epaulet:${side}`);
        assert.ok(sl && sl.type === 'polygon', `${tag} ${side}: the sleeve polygon is drawn`);
        for(const q of sl.points) assert.ok(inside(poly, q) || outlineDist(poly, q) <= 0.1, `${tag} ${side}: the sleeve vertex (${q.x.toFixed(2)}, ${q.y.toFixed(2)}) lies on the strap`);

        // The top-down view: just above the shoulder, never over the garment.
        const top = scene.layers.find(l => l.key === `epaulet-top:${side}`);
        assert.ok(top, `${tag} ${side}: the top view is drawn`);
        const box = corners(seated(top));
        const cx = box.reduce((a, c) => a + c.x, 0) / 4;
        const gap = topY(poly, cx) - bottomY(box, cx);
        // The view is level (DORAN5-ENG-3): its lower edge clears the highest point of the shoulder under it, so at its centre it stands higher than the
        // sloped strap's top boundary there by the strap's fall from that highest point, plus TOP_VIEW_CLEAR (0.1 in). The straps now run the whole shoulder line
        // (art 84f10ebe, 8778580b: Class B men's 5.83 in at about 20.5 degrees, aviator men's 6.0 in) and a level view also clears the collar end and the collar leaf
        // rising past it, so the view's centre stands higher than the old 1.4 in; the bound is geometric, read from the strap landmark: half the top boundary's
        // rise from the strap's outer end to its neck end (`rise`, the view's centre is near the strap's middle), plus the clearance, plus 0.45 in for what the
        // two views share (the pair stays level and takes the larger lift, seatViewsAboveOutline) and for the view's centre lying outboard of the strap's middle
        // (its grade is slid to the strip's 5/8 in distance). Measured excess over half the rise plus the clearance: 0.40 in on the Class B men's short sheet (the
        // largest), 0.35 on the aviator men's, 0.16 to 0.34 on the others, none on the overblouse: the margin over the largest is 0.05 in.
        const strapXs = poly.map(p => p.x), strapTops = [];
        for(let i = 0; i <= 100; i++){ const t = topY(poly, Math.min(...strapXs) + (Math.max(...strapXs) - Math.min(...strapXs)) * i / 100); if(t != null) strapTops.push(t); }
        const rise = Math.max(...strapTops) - Math.min(...strapTops), bound = rise / 2 + 0.1 + 0.45;
        assert.ok(gap >= 0 && gap <= bound, `${tag} ${side}: the top view is ${gap.toFixed(2)} in above the shoulder at its centre (bound ${bound.toFixed(2)} in: half the strap's ${rise.toFixed(2)} in rise, the clearance and the shared lift)`);
        const xs = poly.map(p => p.x), lo = Math.max(Math.min(...box.map(c => c.x)), Math.min(...xs)), hi = Math.min(Math.max(...box.map(c => c.x)), Math.max(...xs));
        for(let i = 0; i <= 20; i++){
          const x = lo + (hi - lo) * i / 20;
          const t = topY(poly, x), b = bottomY(box, x);
          if(t == null || b == null) continue;
          assert.ok(t - b >= -0.005, `${tag} ${side}: the top view does not cover the shoulder at x=${x.toFixed(2)}`);
        }

        // Sleeve colour and the grade on both views.
        const cadet = g.category === 'cadet-officer';
        const sleeve = g.key ? `rank-epaulet-sleeve-${cadet ? 'blue-cadet' : 'gray'}-${g.key}` : 'rank-epaulet-sleeve-gray-blank';
        assert.equal(top.id, sleeve, `${tag}: ${cadet ? 'blue' : 'gray'} sleeve`);
        if(!g.key) continue;
        const edgeGrade = scene.layers.find(l => l.role === 'grade' && l.key === `grade:sleeve-${side}`);
        if(!/^FO$|^TFO$|^SFO$/.test(r)){
          assert.ok(edgeGrade, `${tag} ${side}: the grade is on the sleeve`);
          assert.ok(inside(sl.points, edgeGrade.origin), `${tag} ${side}: the grade sits on the sleeve`);
          assert.ok(Math.max(edgeGrade.w, edgeGrade.h) > 0.2, `${tag} ${side}: the grade on the sleeve is big enough to see`);
          assert.ok(cadet ? /metal-miniature$/.test(edgeGrade.id) : /-thread$/.test(edgeGrade.id), `${tag}: ${edgeGrade.id} is the grade for the sleeve`);
        }
      }
    }
  });

  test(`${label}: NCOs and airmen wear no epaulet sleeve (cadet NCOs the collar chevron)`, async () => {
    for(const [m, r] of NO_SLEEVE_MEMBERS){
      const scene = await P.composeUniform(build(uniform, m, r, gender, opt), store);
      assert.equal(scene.layers.filter(l => l.role === 'epaulet-top' || /-epaulet-sleeve-/.test(l.id || '') || /^epaulet:/.test(l.key || '')).length, 0, `${label} ${r}`);
      if(m === 'cadet' && r !== 'C/AB') assert.equal(scene.layers.filter(l => l.role === 'grade' && /rank-cadet-nco-/.test(l.id)).length, 2, `${label} ${r}: collar chevron on each side`);
    }
  });
}

test('the epaulet frame is read from the garment landmark (axis, width, neck end)', async () => {
  const C = require('../js/engine/compose.js');
  const ctx = C.createContext({}, store);
  await ctx.garment('garment-blues-class-b-shirt-male');
  const r = P.helpers.epauletFrame(ctx, 'right'), l = P.helpers.epauletFrame(ctx, 'left');
  assert.ok(r && l);
  // The strap runs up toward the neck: right strap to the viewer's right, left to the left.
  assert.ok(r.axis.x > 0.9 && r.axis.y < 0 && l.axis.x < -0.9 && l.axis.y < 0);
  assert.ok(Math.abs(r.deg + l.deg) < 0.01, 'mirrored turn');
  assert.ok(r.neck.x > r.outer.x && l.neck.x < l.outer.x);
  assert.ok(r.normal.y < 0, 'normal points up');
  const bare = C.createContext({}, store);
  await bare.garment('garment-mess-dress-male');
  assert.equal(P.helpers.epauletFrame(bare, 'right'), null, 'a garment with no epaulet landmark has no frame');
});
