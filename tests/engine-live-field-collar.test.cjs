'use strict';
// LIVE-FIELD B7 (Ethan): on the ABU and the Corporate Field Uniform the collar grade's axis is parallel to the collar's LEADING edge, centred
// on the leaf, 1 in from it (CAPR 39-1 5.1.1.1.1.3-4, 5.2.1.1.1.4-6: 'one inch from the front of the collar and centered', 'parallel to the
// front of the collar'). The leading edge is the sheet's collar_slots[side].leading_edge when it states one, else the longest edge of the
// collar_left / collar_right polygon; one code for both leaves, so the two are mirror images.

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
  if(le){ const a = le.p1 || le[0], b = le.p2 || le[1]; return { a: { x: a[0] / 100, y: a[1] / 100 }, b: { x: b[0] / 100, y: b[1] / 100 } }; }
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

    test(`${uniform} ${gender}: the cadet officer row lies along the leading edge, near outline 1 in from it (5.1.1.1.1.3, 5.2.1.1.1.4)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      for(const rank of ['C/2d Lt', 'C/Capt', 'C/Maj', 'C/Col']){
        const scene = await P.composeUniform(build(uniform, gender, 'cadet', rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), edge = expectedEdge(spec, side);
          assert.ok(between(widthAxis(l), edge) < 0.5, `${rank} ${side}: row ${between(widthAxis(l), edge).toFixed(2)} deg off the leading edge`);
          assert.ok(Math.abs(across(l, edge) - l.h / 2 - 1) < 0.02, `${rank} ${side}: near outline ${(across(l, edge) - l.h / 2).toFixed(3)} in from the edge`);
        }
      }
    });

    test(`${uniform} ${gender}: the Flight Officer, Lieutenant and Captain bars lie along the leading edge, mirrored; Major, Lt Col, Col keep the regulation's own turn (5.1.1.1.1.1, 5.2.1.1.1.1)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      for(const rank of ['2d Lt', '1st Lt', 'Capt']){
        const scene = await P.composeUniform(build(uniform, gender, 'senior', rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), edge = expectedEdge(spec, side);
          assert.ok(between(upAxis(l), edge) < 0.5, `${rank} ${side}: bars ${between(upAxis(l), edge).toFixed(2)} deg off the leading edge`);
        }
        assert.ok(Math.abs(layer(scene, 'right').rotate + layer(scene, 'left').rotate) < 2.5, `${rank}: mirrored`);
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
