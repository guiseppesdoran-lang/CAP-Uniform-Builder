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

// The centre of the edge-on strip on one shoulder: the overlay sheet's rank-slot centre, or, on a sheet
// with no edge-on art, the centre of the strip the engine draws.
async function stripCenter(scene, garment, side){
  const ov = scene.layers.find(l => l.role === 'garment-layer' && new RegExp(`^${garment}-epaulet-sleeve-(officer|cadet-officer)$`).test(l.id));
  if(ov){
    const s = await store.load(ov.id);
    return { at: core.anchor(s, `rank_slot_${side}_center`), via: 'overlay' };
  }
  const drawn = scene.layers.find(l => l.key === `epaulet:${side}`);
  return drawn ? { at: drawn.origin, via: 'drawn' } : { at: null };
}

for(const [label, uniform, gender, opt, garment] of CUTS){
  test(`${label}: edge-on strip on the epaulet landmark, top view just above the shoulder, grade on both (R7)`, async () => {
    const spec = await sheet(garment);
    for(const [m, r] of SLEEVE_MEMBERS){
      const scene = await P.composeUniform(build(uniform, m, r, gender, opt), store);
      const tag = `${label} ${r}`;
      assert.deepEqual(scene.notes.filter(n => /^No artwork for/.test(n)), [], tag);
      const g = G.gradeInfo(m, r, {});
      for(const side of SIDES){
        const poly = pts(spec.landmarks[`epaulet_${side}`]);

        // The edge-on strip: its centre is inside the epaulet landmark and within half the strap's
        // depth of the shoulder line.
        const strip = await stripCenter(scene, garment, side);
        assert.ok(strip.at, `${tag} ${side}: an edge-on epaulet strip is drawn`);
        assert.ok(inside(poly, strip.at), `${tag} ${side}: the strip centre (${strip.at.x.toFixed(2)}, ${strip.at.y.toFixed(2)}) is on the epaulet landmark`);
        const drop = strip.at.y - topY(poly, strip.at.x);
        assert.ok(drop >= 0 && drop <= 0.5, `${tag} ${side}: the strip is on the shoulder line (${drop.toFixed(2)} in below it)`);

        // The top-down view: just above the shoulder, never over the garment.
        const top = scene.layers.find(l => l.key === `epaulet-top:${side}`);
        assert.ok(top, `${tag} ${side}: the top view is drawn`);
        const box = corners(seated(top));
        const cx = box.reduce((a, c) => a + c.x, 0) / 4;
        const gap = topY(poly, cx) - bottomY(box, cx);
        // The view is level (DORAN5-ENG-3): its lower edge clears the highest point of the shoulder under it, so at its centre it
        // stands up to a slope's rise higher (1.4 in) than the 0.4 in a view turned onto the strap did.
        assert.ok(gap >= 0 && gap <= 1.4, `${tag} ${side}: the top view is ${gap.toFixed(2)} in above the shoulder at its centre`);
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
        const edgeGrade = scene.layers.find(l => l.role === 'grade' && l.key === `grade:edge-${side}`);
        if(!/^FO$|^TFO$|^SFO$/.test(r)){
          assert.ok(edgeGrade, `${tag} ${side}: the grade is on the edge-on strip`);
          assert.ok(inside(poly, edgeGrade.origin), `${tag} ${side}: the grade sits on the epaulet landmark`);
          assert.ok(Math.max(edgeGrade.w, edgeGrade.h) > 0.2, `${tag} ${side}: the edge-on grade is big enough to see`);
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
