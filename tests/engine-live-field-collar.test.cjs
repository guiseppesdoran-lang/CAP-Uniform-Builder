'use strict';
// ABU and Corporate Field Uniform collar grade (CAPR 39-1 5.1.1.1.1, 5.2.1.1.1), COLLAR5.
// Ethan, on the cadet Lt Col cloth drawn as a square turned 45 degrees on the leaf: "the edge on the bottom right needs to be parallel with the seam
// below it. and it should apply for all. that seam should also be parallel with the ground." The leaf's lower seam (collar_slots[side].bottom_edge) is
// horizontal on both sheets, and EVERY collar grade piece sits with its bottom edge parallel to it: the cadet officers' cloth (six grades), the senior
// officers' cloth (all grades) and the cadet NCO metal chevrons. D8: the earlier tests (LIVE-FIELD B7, COLLAR3, COLLAR4) had the cadet row along the front
// or the outer edge and the bars on the outer edge; they now assert the seam, with the positions the text gives: cadet officers and the cadet NCO chevron
// 1 in from the front of the collar and centred (5.1.1.1.1.3-4, 5.2.1.1.1.4), officers 1 in from the bottom, centred (5.1.1.1.1.1, 5.2.1.1.1.1).

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
const load = p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8')));
const store = core.createSpecStore(manifest, load);
// The same store with `edit(json)` applied to the ABU sheet's spec.
const edited = edit => core.createSpecStore(manifest, async p => {
  const j = await load(p);
  if(/garment-abu-coat\.spec\.json$/.test(p)) edit(j);
  return j;
});

const SHEETS = { abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' };
const CADET_OFFICERS = ['C/2d Lt', 'C/1st Lt', 'C/Capt', 'C/Maj', 'C/Lt Col', 'C/Col'];
const CADET_NCOS = ['C/Amn', 'C/SSgt', 'C/MSgt', 'C/CMSgt'];
const SENIOR_OFFICERS = ['2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col', 'Brig Gen', 'Maj Gen'];
const STEM_RANKS = ['Maj', 'Lt Col'];   // the stem lies parallel to the ground pointing away from the neck: a quarter turn from the seam's frame (5.1.1.1.1.1)
const GENERALS = ['Brig Gen', 'Maj Gen'];
const CLOTH_BORDER = 0.125;

function build(uniform, gender, membership, rank){
  return {
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'none' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  };
}
const layer = (scene, side) => scene.layers.find(l => l.key === 'grade:' + side);
const measures = scene => scene.layers.filter(l => l.type === 'measure');
const deg = r => r * 180 / Math.PI;

// The sheet's lower seam of a leaf as an edge {a, b} (inches) and its angle in (-90, 90].
function seamOf(spec, side){
  const be = spec.raw.collar_slots[side].bottom_edge, pair = be.points || [be.p1, be.p2];
  const a = { x: pair[0][0] / 100, y: pair[0][1] / 100 }, b = { x: pair[1][0] / 100, y: pair[1][1] / 100 };
  let d = deg(Math.atan2(b.y - a.y, b.x - a.x)); if(d > 90) d -= 180; if(d <= -90) d += 180;
  return { a, b, angle: Math.abs(d) < 1e-9 ? 0 : d };
}
// The leading (front) edge as the sheet states it.
function frontOf(spec, side){
  const le = spec.raw.collar_slots[side].leading_edge, pair = le.points || (le.p1 && le.p2 ? [le.p1, le.p2] : le);
  return { a: { x: pair[0][0] / 100, y: pair[0][1] / 100 }, b: { x: pair[1][0] / 100, y: pair[1][1] / 100 } };
}
const polyOf = (spec, side) => core.landmark(spec, side === 'right' ? 'collar_right' : 'collar_left').points;
// A layer's four corners (the box turned by its rotate about its centre) and its centre.
function cornersOf(l){
  const c = { x: l.x + l.w / 2, y: l.y + l.h / 2 }, a = l.rotate * Math.PI / 180;
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => ({ x: c.x + i * l.w / 2 * Math.cos(a) - j * l.h / 2 * Math.sin(a), y: c.y + i * l.w / 2 * Math.sin(a) + j * l.h / 2 * Math.cos(a) }));
}
const centreOf = l => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });
const inside = (q, poly) => { let r = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const pi = poly[i], pj = poly[j]; if((pi.y > q.y) !== (pj.y > q.y) && q.x < (pj.x - pi.x) * (q.y - pi.y) / (pj.y - pi.y) + pi.x) r = !r; } return r; };
// Signed distance from a point to the line through the edge (absolute value), in inches.
function lineDist(q, e){ const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y; return Math.abs((q.x - e.a.x) * dy - (q.y - e.a.y) * dx) / Math.hypot(dx, dy); }
// The turn of a layer relative to the seam, in (-180, 180].
const relTurn = (l, seam) => { let d = l.rotate - seam.angle; while(d > 180) d -= 360; while(d <= -180) d += 360; return d; };

for(const uniform of ['abu', 'corporate_field']){
  for(const gender of ['male', 'female']){
    test(`${uniform} ${gender}: the leaf's lower seam is horizontal on both leaves, stated by the sheet as bottom_edge and as a landmark (COLLAR5)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      for(const side of ['right', 'left']){
        const seam = seamOf(spec, side), be = spec.raw.collar_slots[side].bottom_edge;
        assert.equal(seam.a.y, seam.b.y, `${side}: the seam's two points share a height`);
        assert.ok(Math.abs(seam.b.x - seam.a.x) > 2, `${side}: the seam is ${Math.abs(seam.b.x - seam.a.x).toFixed(2)} in long`);
        assert.equal(be.angle_deg, 0, `${side}: bottom_edge.angle_deg`);
        // the landmark agrees, and the leaf polygon's two lowest vertices are the seam's ends
        const lm = core.landmark(spec, 'collar_bottom_edge_' + side).points;
        assert.ok(Math.hypot(lm[0].x - seam.a.x, lm[0].y - seam.a.y) < 0.02 && Math.hypot(lm[1].x - seam.b.x, lm[1].y - seam.b.y) < 0.02, `${side}: landmark collar_bottom_edge`);
        const poly = polyOf(spec, side), low = poly.slice().sort((p, q) => q.y - p.y).slice(0, 2);
        assert.ok(Math.abs(low[0].y - low[1].y) < 1e-9 && Math.abs(low[0].y - seam.a.y) < 0.005, `${side}: the leaf's two lowest vertices are the seam's ends and level`);
        for(const p of [seam.a, seam.b]) assert.ok(poly.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 0.02), `${side}: a seam end is a vertex of the leaf`);
      }
    });

    test(`${uniform} ${gender}: every cadet officer, cadet NCO and senior officer piece sits with its bottom edge parallel to the seam, both leaves (COLLAR5)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      const cases = [...CADET_OFFICERS.map(r => ['cadet', r]), ...CADET_NCOS.map(r => ['cadet', r]), ...SENIOR_OFFICERS.map(r => ['senior', r])];
      for(const [membership, rank] of cases){
        const scene = await P.composeUniform(build(uniform, gender, membership, rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), seam = seamOf(spec, side);
          assert.ok(l, `${rank} ${side}`);
          const stem = membership === 'senior' && STEM_RANKS.includes(rank);
          // the art stands on the seam: turned by the seam's own angle (0), the Major's and Lieutenant Colonel's stem a quarter turn from it, away from the neck (right leaf 90, left -90)
          const want = stem ? (side === 'right' ? 90 : -90) : 0;
          assert.ok(Math.abs(relTurn(l, seam) - want) < 0.01, `${rank} ${side}: turned ${l.rotate} deg, the seam is ${seam.angle}, wanted ${want} from it`);
          // whatever the turn, the piece's edges are parallel or square to the seam: its bottom edge runs along the seam's direction
          const cs = cornersOf(l), e = cs.slice().sort((p, q) => q.y - p.y).slice(0, 2);
          assert.ok(Math.abs(e[0].y - e[1].y) < 0.005, `${rank} ${side}: the piece's bottom edge is level (${e[0].y.toFixed(3)} / ${e[1].y.toFixed(3)})`);
        }
        const r = layer(scene, 'right'), lf = layer(scene, 'left');
        assert.ok(Math.abs(r.rotate + lf.rotate) < 0.01, `${rank}: the two leaves are mirror images (${r.rotate} / ${lf.rotate})`);
      }
    });

    test(`${uniform} ${gender}: cadet officers and cadet NCOs: near corner 1 in from the front of the collar, centred on the leaf, the 1 in measure drawn (5.1.1.1.1.3-4, 5.2.1.1.1.4)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      for(const [membership, rank] of [...CADET_OFFICERS.map(r => ['cadet', r]), ...CADET_NCOS.map(r => ['cadet', r])]){
        const scene = await P.composeUniform(build(uniform, gender, membership, rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), front = frontOf(spec, side), poly = polyOf(spec, side);
          const d = Math.min(...cornersOf(l).map(q => lineDist(q, front)));
          assert.ok(Math.abs(d - 1) < 0.02, `${rank} ${side}: near corner ${d.toFixed(3)} in from the front edge`);
          // centred on the leaf: the centre is the middle of the chord the line through it, parallel to the front edge, cuts across the leaf
          const t = { x: front.b.x - front.a.x, y: front.b.y - front.a.y }, tl = Math.hypot(t.x, t.y); t.x /= tl; t.y /= tl;
          const c = centreOf(l), ts = [];
          for(let i = 0; i < poly.length; i++){
            const p = poly[i], q = poly[(i + 1) % poly.length], ex = q.x - p.x, ey = q.y - p.y, den = t.x * ey - t.y * ex;
            if(Math.abs(den) < 1e-9) continue;
            const s = ((p.x - c.x) * ey - (p.y - c.y) * ex) / den, u = ((p.x - c.x) * t.y - (p.y - c.y) * t.x) / den;
            if(u >= 0 && u <= 1) ts.push(s);
          }
          assert.ok(Math.abs(Math.min(...ts) + Math.max(...ts)) < 0.03, `${rank} ${side}: centred on the leaf along the front edge (chord ${Math.min(...ts).toFixed(2)} .. ${Math.max(...ts).toFixed(2)} about the centre)`);
          // the 1 in measure runs from the front edge's line to that corner
          const ms = measures(scene).filter(x => Math.abs(Math.hypot(x.to.x - x.from.x, x.to.y - x.from.y) - 1) < 0.01);
          assert.ok(ms.some(x => cornersOf(l).some(q => Math.hypot(q.x - x.to.x, q.y - x.to.y) < 0.02) && lineDist(x.from, front) < 0.02), `${rank} ${side}: the 1 in measure from the front edge to the near corner`);
        }
      }
    });

    test(`${uniform} ${gender}: officers: centred 1 in above the seam on the leaf's centre line; generals' stars begin 1 in above it, perpendicular to it (5.1.1.1.1.1, 5.2.1.1.1.1)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      for(const rank of SENIOR_OFFICERS){
        const scene = await P.composeUniform(build(uniform, gender, 'senior', rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), seam = seamOf(spec, side), poly = polyOf(spec, side), c = centreOf(l);
          // the height of the piece's centre above the seam: 1 in, and for the generals the cloth's half height less the 1/8 in border more (the lowest star's silver begins 1 in up)
          const want = GENERALS.includes(rank) ? 1 + (await store.load(l.id)).h / 2 - CLOTH_BORDER : 1;
          assert.ok(Math.abs(lineDist(c, seam) - want) < 0.015, `${rank} ${side}: centre ${lineDist(c, seam).toFixed(3)} in above the seam, wanted ${want.toFixed(3)}`);
          assert.ok(c.y < seam.a.y, `${rank} ${side}: above the seam`);
          // centred on the leaf: the middle of the chord the seam's parallel 1 in above it cuts across the leaf (the generals' stars stand higher, on the same centre line)
          const yl = seam.a.y - 1, xs = []; for(let i = 0; i < poly.length; i++){ const p = poly[i], q = poly[(i + 1) % poly.length]; if((p.y - yl) * (q.y - yl) < 0) xs.push(p.x + (q.x - p.x) * (yl - p.y) / (q.y - p.y)); }
          assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - c.x) < 0.03, `${rank} ${side}: centred on the leaf`);
          // the 1 in is drawn from the seam to the centre (the generals: to the line 1 in up their own perpendicular)
          const ms = measures(scene);
          assert.ok(ms.some(x => Math.abs(Math.hypot(x.to.x - x.from.x, x.to.y - x.from.y) - 1) < 0.01 && lineDist(x.from, seam) < 0.01 && Math.abs(x.to.x - c.x) < 0.02), `${rank} ${side}: the 1 in measure`);
        }
      }
      // the Colonel's beak forward (the eagle mirrored on the wearer's right leaf only), the Major's and Lieutenant Colonel's stem away from the neck, the generals upright to the seam
      assert.equal(layer(await P.composeUniform(build(uniform, gender, 'senior', 'Col'), store), 'right').flipX, true);
      assert.ok(!layer(await P.composeUniform(build(uniform, gender, 'senior', 'Col'), store), 'left').flipX);
    });

    test(`${uniform} ${gender}: every piece lies wholly inside its collar leaf, both leaves, every grade (5.1.1.1.1, 5.2.1.1.1)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      const cases = [...CADET_OFFICERS.map(r => ['cadet', r]), ...CADET_NCOS.map(r => ['cadet', r]), ...SENIOR_OFFICERS.map(r => ['senior', r])];
      for(const [membership, rank] of cases){
        const scene = await P.composeUniform(build(uniform, gender, membership, rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), poly = polyOf(spec, side);
          for(const q of cornersOf(l)) assert.ok(inside(q, poly), `${rank} ${side}: corner ${q.x.toFixed(2)},${q.y.toFixed(2)} is off the leaf`);
        }
      }
    });

    test(`${uniform} ${gender}: Cadet Colonels and Cadet Captains wear the miniature cloth-bordered form; the other cadet officers wear regular size (5.1.1.1.1.3, 5.2.1.1.1.4)`, async () => {
      for(const [rank, form] of [['C/2d Lt', 'regular'], ['C/1st Lt', 'regular'], ['C/Capt', 'miniature'], ['C/Maj', 'regular'], ['C/Lt Col', 'regular'], ['C/Col', 'miniature']]){
        const scene = await P.composeUniform(build(uniform, gender, 'cadet', rank), store);
        for(const side of ['right', 'left']) assert.match(layer(scene, side).id, new RegExp(`cloth-bordered-${form}$`), `${rank} ${side}`);
      }
    });
  }
}

test('the seam angle is read from the sheet: a seam stated 10 degrees off turns every piece on that leaf by 10 degrees, the leaf without one keeps its own (COLLAR5, generic)', async () => {
  // The wearer's right leaf of the ABU sheet is given a sloping bottom_edge (0.01 in): the pieces on it follow; the other leaf is untouched.
  const st = edited(j => { j.collar_slots.right.bottom_edge = { points: [[1467, 1237], [1737, 1237 + Math.round(270 * Math.tan(10 * Math.PI / 180))]] }; });
  const spec = await st.load('garment-abu-coat');
  const want = deg(Math.atan2(Math.round(270 * Math.tan(10 * Math.PI / 180)), 270));
  for(const [membership, rank] of [['cadet', 'C/Lt Col'], ['cadet', 'C/SSgt'], ['senior', 'Capt'], ['senior', 'Col'], ['senior', 'Brig Gen']]){
    const scene = await P.composeUniform(build('abu', 'male', membership, rank), st);
    assert.ok(Math.abs(layer(scene, 'right').rotate - want) < 0.01, `${rank} right: ${layer(scene, 'right').rotate} vs ${want}`);
    assert.equal(layer(scene, 'left').rotate, 0, `${rank} left`);
  }
  assert.ok(Math.abs(seamOf(spec, 'right').angle - want) < 0.01);
  // a sheet with no bottom_edge at all falls back to the leaf polygon's own bottom edge (the edge whose outward normal points most nearly down): level here
  const bare = edited(j => { delete j.collar_slots.right.bottom_edge; delete j.collar_slots.left.bottom_edge; });
  const sc = await P.composeUniform(build('abu', 'male', 'cadet', 'C/Lt Col'), bare);
  assert.equal(layer(sc, 'right').rotate, 0);
  assert.equal(layer(sc, 'left').rotate, 0);
});

test('a leading_edge stated by the sheet is the edge the cadet grade is 1 in from; the other leaf, with none, falls back to its longest edge (same code, both leaves)', async () => {
  // The sheet states a vertical edge for the wearer's right leaf: the near corner of the (unturned) chevron is 1 in from it, and the left leaf keeps the longest edge, the neck-opening edge.
  const edge = [[1709, 807], [1709, 1110]];
  const st = edited(j => { j.collar_slots.right.leading_edge = edge; });
  const spec = await st.load('garment-abu-coat');
  const scene = await P.composeUniform(build('abu', 'male', 'cadet', 'C/SSgt'), st);
  const r = layer(scene, 'right'), l = layer(scene, 'left');
  const stated = { a: { x: 17.09, y: 8.07 }, b: { x: 17.09, y: 11.1 } };
  assert.ok(Math.abs(Math.min(...cornersOf(r).map(q => lineDist(q, stated))) - 1) < 0.02, 'stated edge: near corner 1 in from it');
  assert.equal(r.rotate, 0);
  // the left leaf: the polygon's longest edge
  const pts = polyOf(spec, 'left'); let best = null, len = 0;
  for(let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length], d = Math.hypot(q.x - p.x, q.y - p.y); if(d > len){ len = d; best = { a: p, b: q }; } }
  assert.ok(Math.abs(Math.min(...cornersOf(l).map(q => lineDist(q, best))) - 1) < 0.02, 'the leaf without one: 1 in from its longest edge');
  // the pair may also be given as {p1, p2}
  const st2 = edited(j => { j.collar_slots.right.leading_edge = { p1: edge[0], p2: edge[1] }; });
  const again = layer(await P.composeUniform(build('abu', 'male', 'cadet', 'C/SSgt'), st2), 'right');
  assert.ok(Math.abs(again.x - r.x) < 1e-9 && Math.abs(again.y - r.y) < 1e-9);
});

test('the longest edge of the collar polygon is the front edge of the leaf on both sheets, both leaves (the fallback when the sheet states no leading_edge)', async () => {
  for(const u of ['abu', 'corporate_field']){
    const spec = await store.load(SHEETS[u]);
    for(const side of ['right', 'left']){
      const pts = polyOf(spec, side); let best = null, len = 0;
      for(let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length], d = Math.hypot(q.x - p.x, q.y - p.y); if(d > len){ len = d; best = { a: p, b: q }; } }
      const f = spec.raw.collar_slots[side].front_edge, a = { x: f.p1[0] / 100, y: f.p1[1] / 100 }, b = { x: f.p2[0] / 100, y: f.p2[1] / 100 };
      const ang = Math.abs(Math.asin(Math.min(1, Math.abs((b.x - a.x) * (best.b.y - best.a.y) - (b.y - a.y) * (best.b.x - best.a.x)) / (Math.hypot(b.x - a.x, b.y - a.y) * len))));
      assert.ok(deg(ang) < 1, `${u} ${side}: ${deg(ang).toFixed(2)} deg from the slot's front edge`);
    }
  }
});

test('the sheets state the leading edge twice, as collar_slots[side].leading_edge.points and as the landmark collar_leading_edge_<side>, and the two agree (0.02 in); the engine reads the slot', async () => {
  for(const sheet of Object.values(SHEETS)){
    const spec = await store.load(sheet);
    for(const side of ['right', 'left']){
      const le = spec.raw.collar_slots[side].leading_edge;
      assert.ok(le && le.points && le.points.length === 2, `${sheet} ${side}: leading_edge.points`);
      const lm = core.landmark(spec, 'collar_leading_edge_' + side).points;
      le.points.forEach((p, i) => assert.ok(Math.hypot(p[0] / 100 - lm[i].x, p[1] / 100 - lm[i].y) <= 0.02, `${sheet} ${side}: point ${i}`));
    }
  }
});

test('H.boxExtentAcross and H.nearCornerToEdge: a box unturned against a slanting edge reaches |u.x| w/2 + |u.y| h/2 toward it; the near corner is 1 in from the edge when placed so (COLLAR5)', () => {
  const E = P.helpers.boxExtentAcross, N = P.helpers.nearCornerToEdge;
  // a vertical edge (collar point above the roll end): the box's width is its extent across it
  const vertical = { collarPoint: { x: 10, y: 0 }, rollEnd: { x: 10, y: 5 }, inward: { x: 1, y: 0 } };
  assert.ok(Math.abs(E(vertical, 2, 1, 0) - 2) < 1e-9 && Math.abs(E(vertical, 2, 1, 90) - 1) < 1e-9);
  // a 45 degree edge: both half-sides count
  const diag = { collarPoint: { x: 0, y: 0 }, rollEnd: { x: 4, y: 4 }, inward: { x: 1, y: -1 } };
  assert.ok(Math.abs(E(diag, 2, 1, 0) - 2 * (Math.SQRT1_2 * 1 + Math.SQRT1_2 * 0.5)) < 1e-9);
  // the near corner of a 2 x 1 box centred 1 + extent/2 from a vertical edge lies 1 in from it, its foot on the edge's line level with the corner
  const at = { x: 10 + 1 + E(vertical, 2, 1, 0) / 2, y: 2 }, m = N(vertical, at, 2, 1, 0);
  assert.ok(Math.abs(m.near.x - 11) < 1e-9 && Math.abs(m.foot.x - 10) < 1e-9 && Math.abs(m.foot.y - m.near.y) < 1e-9);
});
