'use strict';
// LIVE-FIELD B7 (Ethan): on the ABU and the Corporate Field Uniform the collar grade's axis is parallel to the collar's LEADING edge, centred
// on the leaf, 1 in from it (CAPR 39-1 5.1.1.1.1.3-4, 5.2.1.1.1.4-6: 'one inch from the front of the collar and centered', 'parallel to the
// front of the collar'). The leading edge is the sheet's collar_slots[side].leading_edge when it states one, else the longest edge of the
// collar_left / collar_right polygon; one code for both leaves, so the two are mirror images.
// COLLAR3 (Ethan, 'needs to be parallel to the bottom line'; 'blatantly wrong' to the read that took the edge between the leaf's two lowest vertices,
// 2.8 degrees off horizontal): the cadet officer row and the officers' Lieutenant and Captain bars lie parallel to the OUTER edge of the leaf, the long
// diagonal from the collar point (the leaf's top vertex) out to the shoulder end (its neighbour farther from the centre line), 45 degrees on these sheets,
// the row's long axis along it, 1 in from the front (leading) edge and centred, the bars centred 1 in from the bottom as the text says (5.1.1.1.1.1,
// 5.1.1.1.1.3, 5.2.1.1.1); the cadet NCO chevron keeps 'parallel to the front of the collar' (5.1.1.1.1.4).

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
// The same store with a `leading_edge` stated on the wearer's right leaf of the ABU sheet (0.01 in), the other leaf left without one.
const withEdge = edge => core.createSpecStore(manifest, async p => {
  const j = await load(p);
  if(/garment-abu-coat\.spec\.json$/.test(p)) j.collar_slots.right.leading_edge = edge;
  return j;
});

const SHEETS = { abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' };
function build(uniform, gender, membership, rank){
  return {
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'none' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  };
}
const layer = (scene, side) => scene.layers.find(l => l.key === 'grade:' + side);
const deg = r => r * 180 / Math.PI;

// The leading edge as the engine should read it: the sheet's own pair of points when stated, else the polygon's longest edge.
function expectedEdge(spec, side){
  const le = spec.raw.collar_slots[side].leading_edge;
  const pts = core.landmark(spec, side === 'right' ? 'collar_right' : 'collar_left').points;
  if(le){ const pair = le.points || (le.p1 && le.p2 ? [le.p1, le.p2] : le), a = pair[0], b = pair[1]; return { a: { x: a[0] / 100, y: a[1] / 100 }, b: { x: b[0] / 100, y: b[1] / 100 } }; }
  let best = null, len = 0;
  for(let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length], l = Math.hypot(q.x - p.x, q.y - p.y); if(l > len){ len = l; best = { a: p, b: q }; } }
  return best;
}
// Angle in degrees between a line through the origin along `v` and the edge, 0-90.
function between(v, edge){
  const e = { x: edge.b.x - edge.a.x, y: edge.b.y - edge.a.y }, el = Math.hypot(e.x, e.y), vl = Math.hypot(v.x, v.y);
  return deg(Math.asin(Math.min(1, Math.abs(v.x * e.y - v.y * e.x) / (el * vl))));
}
// Distance from the edge's line to the box's centre.
function across(l, edge){
  const e = { x: edge.b.x - edge.a.x, y: edge.b.y - edge.a.y }, el = Math.hypot(e.x, e.y);
  const c = { x: l.x + l.w / 2, y: l.y + l.h / 2 };
  return Math.abs((c.x - edge.a.x) * e.y - (c.y - edge.a.y) * e.x) / el;
}
// The outer edge of the leaf as an edge {a, b}: from the polygon's top vertex (the collar point) to its neighbour farther from the sheet's centre line.
function outerEdge(spec, side){
  const pts = core.landmark(spec, side === 'right' ? 'collar_right' : 'collar_left').points, cx = spec.w / 2;
  let top = 0; pts.forEach((p, i) => { if(p.y < pts[top].y) top = i; });
  const n = pts.length, p = pts[(top + n - 1) % n], q = pts[(top + 1) % n];
  return { a: pts[top], b: Math.abs(p.x - cx) >= Math.abs(q.x - cx) ? p : q };
}
const edgeDeg = e => { let d = deg(Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x)); if(d > 90) d -= 180; if(d <= -90) d += 180; return d; };
// Distance from a leaf's piece's long axis (the art's longer side) to the edge, in degrees.
const longAxis = l => l.w >= l.h ? widthAxisOf(l) : upAxisOf(l);
function widthAxisOf(l){ return { x: Math.cos(l.rotate * Math.PI / 180), y: Math.sin(l.rotate * Math.PI / 180) }; }
function upAxisOf(l){ return { x: Math.sin(l.rotate * Math.PI / 180), y: -Math.cos(l.rotate * Math.PI / 180) }; }
function nearestToEdge(l, edge){
  const e = { x: edge.b.x - edge.a.x, y: edge.b.y - edge.a.y }, el = Math.hypot(e.x, e.y);
  const c = { x: l.x + l.w / 2, y: l.y + l.h / 2 }, a = l.rotate * Math.PI / 180;
  const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => ({ x: c.x + i * l.w / 2 * Math.cos(a) - j * l.h / 2 * Math.sin(a), y: c.y + i * l.w / 2 * Math.sin(a) + j * l.h / 2 * Math.cos(a) }));
  return Math.min(...corners.map(q => Math.abs((q.x - edge.a.x) * e.y - (q.y - edge.a.y) * e.x) / el));
}
const upAxis = l => ({ x: Math.sin(l.rotate * Math.PI / 180), y: -Math.cos(l.rotate * Math.PI / 180) });
const widthAxis = l => ({ x: Math.cos(l.rotate * Math.PI / 180), y: Math.sin(l.rotate * Math.PI / 180) });

for(const uniform of ['abu', 'corporate_field']){
  for(const gender of ['male', 'female']){
    test(`${uniform} ${gender}: cadet NCO chevrons lie along the leading edge of each leaf, near outline 1 in from it, mirrored (5.1.1.1.1.4, 5.2.1.1.1.6)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      for(const rank of ['C/Amn', 'C/SSgt', 'C/MSgt', 'C/CMSgt']){
        const scene = await P.composeUniform(build(uniform, gender, 'cadet', rank), store);
        const w = (await store.load(G.cadetNcoChevron(G.gradeInfo('cadet', rank, {}), 'metal'))).w;
        for(const side of ['right', 'left']){
          const l = layer(scene, side), edge = expectedEdge(spec, side);
          assert.ok(l, `${rank} ${side}`);
          assert.ok(between(upAxis(l), edge) < 0.5, `${rank} ${side}: axis ${between(upAxis(l), edge).toFixed(2)} deg off the leading edge`);
          assert.ok(Math.abs(across(l, edge) - w / 2 - 1) < 0.02, `${rank} ${side}: near outline ${(across(l, edge) - w / 2).toFixed(3)} in from the edge`);
        }
        const r = layer(scene, 'right'), lft = layer(scene, 'left');
        assert.ok(Math.abs(Math.abs(r.rotate) - Math.abs(lft.rotate)) < 2.5 && r.rotate * lft.rotate < 0, `${rank}: mirrored turns ${r.rotate} / ${lft.rotate}`);
      }
    });

    test(`${uniform} ${gender}: the cadet officer row's long axis lies along the OUTER edge (the leaf's long diagonal, not horizontal, not the front edge), near outline 1 in from the leading edge, mirrored (5.1.1.1.1.3, 5.2.1.1.1.4)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      for(const rank of ['C/2d Lt', 'C/1st Lt', 'C/Capt', 'C/Maj', 'C/Lt Col', 'C/Col']){
        const scene = await P.composeUniform(build(uniform, gender, 'cadet', rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), front = expectedEdge(spec, side), outer = outerEdge(spec, side);
          assert.ok(l, `${rank} ${side}`);
          assert.ok(between(longAxis(l), outer) < 0.1, `${rank} ${side}: row ${between(longAxis(l), outer).toFixed(2)} deg off the outer edge`);
          // The three things it must not be: horizontal (the rejected second read), the front edge (the rejected first read), and in any case a diagonal.
          const turn = Math.abs(edgeDeg(outer));
          assert.ok(turn > 30 && turn < 60, `${rank} ${side}: the outer edge is ${turn.toFixed(1)} deg from horizontal`);
          assert.ok(between(longAxis(l), front) > 15, `${rank} ${side}: row ${between(longAxis(l), front).toFixed(1)} deg off the front edge, so not along it`);
          assert.ok(Math.abs(longAxis(l).y) > 0.5, `${rank} ${side}: row is not horizontal`);
          assert.ok(Math.abs(nearestToEdge(l, front) - 1) < 0.02, `${rank} ${side}: near outline ${nearestToEdge(l, front).toFixed(3)} in from the leading edge`);
        }
        const r = layer(scene, 'right'), lft = layer(scene, 'left');
        assert.ok(Math.abs(r.rotate + lft.rotate) < 0.01, `${rank}: mirrored turns ${r.rotate} / ${lft.rotate}`);
      }
    });

    test(`${uniform} ${gender}: Cadet Colonels and Cadet Captains wear the miniature cloth-bordered form, which lies wholly on the leaf; the other cadet officers wear regular size (5.1.1.1.1.3, 5.2.1.1.1.4)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      for(const [rank, form] of [['C/2d Lt', 'regular'], ['C/1st Lt', 'regular'], ['C/Capt', 'miniature'], ['C/Maj', 'regular'], ['C/Lt Col', 'regular'], ['C/Col', 'miniature']]){
        const scene = await P.composeUniform(build(uniform, gender, 'cadet', rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), poly = core.landmark(spec, side === 'right' ? 'collar_right' : 'collar_left').points;
          assert.ok(l, `${rank} ${side}`);
          assert.match(l.id, new RegExp(`cloth-bordered-${form}$`), `${rank} ${side}: ${l.id}`);
          const c = { x: l.x + l.w / 2, y: l.y + l.h / 2 }, a = l.rotate * Math.PI / 180;
          const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => ({ x: c.x + i * l.w / 2 * Math.cos(a) - j * l.h / 2 * Math.sin(a), y: c.y + i * l.w / 2 * Math.sin(a) + j * l.h / 2 * Math.cos(a) }));
          const inside = q => { let r = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const pi = poly[i], pj = poly[j]; if((pi.y > q.y) !== (pj.y > q.y) && q.x < (pj.x - pi.x) * (q.y - pi.y) / (pj.y - pi.y) + pi.x) r = !r; } return r; };
          if(form === 'miniature') assert.ok(corners.every(inside), `${rank} ${side}: the miniature row lies wholly on the leaf`);
        }
      }
    });

    test(`${uniform} ${gender}: the Lieutenant and Captain bars lie parallel to the outer edge, mirrored; Major, Lt Col, Col keep the regulation's own turn (5.1.1.1.1.1, 5.2.1.1.1.1)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      for(const rank of ['2d Lt', '1st Lt', 'Capt']){
        const scene = await P.composeUniform(build(uniform, gender, 'senior', rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), outer = outerEdge(spec, side);
          // The bars' long end is the art's tall axis.
          assert.ok(between(upAxis(l), outer) < 0.1, `${rank} ${side}: bars ${between(upAxis(l), outer).toFixed(2)} deg off the outer edge`);
          assert.ok(Math.abs(edgeDeg(outer)) > 30 && Math.abs(edgeDeg(outer)) < 60, `${rank} ${side}: outer edge ${edgeDeg(outer).toFixed(1)} deg`);
        }
        assert.ok(Math.abs(layer(scene, 'right').rotate + layer(scene, 'left').rotate) < 0.01, `${rank}: mirrored`);
      }
      const rot = async (rank, side) => layer(await P.composeUniform(build(uniform, gender, 'senior', rank), store), side).rotate;
      assert.equal(await rot('Maj', 'right'), 90); assert.equal(await rot('Maj', 'left'), -90);
      assert.equal(await rot('Lt Col', 'right'), 90);
    });
  }
}

test('a leading_edge stated by the sheet is used in place of the polygon search; the other leaf, with none, falls back to its longest edge (same code, both leaves)', async () => {
  // The sheet states a vertical edge for the wearer's right leaf: the chevron stands upright there and the left leaf keeps the longest edge.
  const edge = [[1709, 807], [1709, 1110]];
  const st = withEdge(edge);
  const spec = await st.load('garment-abu-coat');
  const scene = await P.composeUniform(build('abu', 'male', 'cadet', 'C/SSgt'), st);
  const r = layer(scene, 'right'), l = layer(scene, 'left');
  assert.ok(between(upAxis(r), expectedEdge(spec, 'right')) < 0.5 && Math.abs(Math.sin(r.rotate * Math.PI / 180)) < 0.01, `stated edge: ${r.rotate}`);
  assert.ok(between(upAxis(l), expectedEdge(spec, 'left')) < 0.5, 'the leaf without one: its longest edge');
  assert.ok(Math.abs(l.rotate) > 100, `the left leaf is not upright (${l.rotate})`);
  // The pair may also be given as {p1, p2}.
  const st2 = withEdge({ p1: edge[0], p2: edge[1] });
  const again = layer(await P.composeUniform(build('abu', 'male', 'cadet', 'C/SSgt'), st2), 'right');
  assert.ok(Math.abs(again.rotate - r.rotate) < 1e-9);
});

test('the longest edge of the collar polygon is the front edge of the leaf on both sheets, both leaves (the fallback when the sheet states no leading_edge)', async () => {
  for(const u of ['abu', 'corporate_field']){
    const spec = await store.load(SHEETS[u]);
    for(const side of ['right', 'left']){
      const e = expectedEdge(spec, side), f = spec.raw.collar_slots[side].front_edge;
      const a = { x: f.p1[0] / 100, y: f.p1[1] / 100 }, b = { x: f.p2[0] / 100, y: f.p2[1] / 100 };
      assert.ok(between({ x: b.x - a.x, y: b.y - a.y }, e) < 1, `${u} ${side}: ${between({ x: b.x - a.x, y: b.y - a.y }, e).toFixed(2)} deg from the slot's front edge`);
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

test('H.collarOuterEdge: the top vertex to its neighbour farther from the centre line, the same edge mirrored, null for a degenerate leaf (COLLAR3)', () => {
  const E = P.helpers.collarOuterEdge, A = P.helpers.collarOuterAngle;
  // The ABU right leaf's polygon (sheet inches): its lowest vertex (14.67, 12.43) is also its farthest-out vertex, so only the top vertex names the edge.
  const right = [[17.09, 8.07], [15.25, 9.92], [14.67, 12.43], [17.37, 12.30], [18.545, 11.10]].map(([x, y]) => ({ x, y }));
  const left = right.map(p => ({ x: 39.3 - p.x, y: p.y }));
  const er = E(right, 19.65), el = E(left, 19.65);
  assert.deepEqual([er.collarPoint, er.rollEnd], [right[0], right[1]]);
  assert.deepEqual([el.collarPoint, el.rollEnd], [left[0], left[1]]);
  assert.ok(Math.abs(A(right, 19.65) + 45.2) < 0.2 && Math.abs(A(left, 19.65) - 45.2) < 0.2, `${A(right, 19.65)} / ${A(left, 19.65)}`);
  assert.equal(E([{ x: 0, y: 0 }, { x: 0.2, y: 0 }], 5), null);
});
