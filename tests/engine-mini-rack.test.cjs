'use strict';
// The miniature medal rack (CAPR 39-1 11.2.8): (owner, 2026-11-18) nothing of it lies under the lapel, "the medal nearest the lapel will be fully
// exposed"; four or fewer in a row lie edge to edge, more than four overlap each by the same amount, never above half, each over the one toward the
// wearer's left, so the medal nearest the lapel is whole and on top; the bodies of one row hang level. The rack is arranged the way 11.2.7 arranges the
// full-size rack to keep the lapel clear (js/engine/awards.js layoutMiniMedals): the rows the lapel reaches hold fewer medals and lie against the
// outboard edge of the bottom row. Where no such arrangement keeps the rack under the shoulder line (counts listed in STUCK) the lapel lies over it, and says so.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const C = require('../js/engine/compose.js');
const A = require('../js/engine/awards.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const manifestText = JSON.stringify(manifest);
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

const POOL = [['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_7'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon'], ['search_find_ribbon'], ['encampment_ribbon'], ['unit_citation_award'], ['distinguished_service_award'], ['crisis_ribbon'], ['exceptional_service_award'], ['disaster_relief_ribbon'], ['national_commanders_citation'], ['lifesaving_award']];
const medals = n => HARNESS.ribbonsFrom(POOL, 'senior').filter(r => manifestText.includes(`medal-${r.asset.replace(/^ribbon-/, '')}-miniature`)).slice(0, n)
  .map(r => ({ key: r.key.replace(/^ribbon:/, 'mini:'), title: r.title, ribbonAsset: r.asset, medal: `medal-${r.asset.replace(/^ribbon-/, '')}-miniature`, devices: r.devices, centered: r.centered }));
const compose = (uniform, gender, n, style) => P.composeUniform(HARNESS.makeBuild({ uniform, gender, membership: 'senior', rank: 'Col', medals: medals(n), opt: { rackColumns: 4, rackArrangement: 'lapel', miniStyle: style } }), store);

// The wearer's left lapel: the blazers' drawn lapel path (the sheet's `lapel-left`), the mess dress's shawl collar landmark, in inches.
const blazerLapel = sex => {
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', `garment-corporate-service-dress-blazer-${sex}.svg`), 'utf8');
  const f = /__art"[^>]*transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)"/.exec(svg), d = new RegExp(`${sex}__lapel-left" d="([^"]+)"`).exec(svg);
  return [...d[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: (Number(f[1]) + Number(m[1]) * Number(f[3])) / 100, y: (Number(f[2]) + Number(m[2]) * Number(f[3])) / 100 }));
};
const messShawl = sex => JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', `garment-mess-dress-${sex}.spec.json`), 'utf8')).landmarks.shawl_left.map(q => ({ x: q[0] / 100, y: q[1] / 100 }));
const CUTS = [['mess_dress', 'male', messShawl('male')], ['mess_dress', 'female', messShawl('female')], ['semi_formal', 'male', blazerLapel('male')], ['semi_formal', 'female', blazerLapel('female')]];
// The counts no arrangement of rows keeps clear of the lapel and under the shoulder line (the fewer-column racks that would clear it lie 3 in or more above the line).
const STUCK = { 'semi_formal male': [10, 11, 12], 'semi_formal female': [12] };
const isRack = l => ['mini-drape', 'mini-medal'].includes(l.role) || (l.role === 'device' && /^mini:/.test(l.key));
const D = C.MINI_DRAPE;

test('for every count from 1 to 12, in both mounting styles, nothing of the miniature rack lies under the lapel on the Mess Dress and the Semi-Formal, men\'s and women\'s (11.2.8), except the counts listed as stuck, where the lapel lies over it and says so', async () => {
  let stuck = 0;
  for(const [uniform, sex, lapel] of CUTS) for(const style of ['mounting', 'holding']) for(let n = 1; n <= 12; n++){
    const scene = await compose(uniform, sex, n, style);
    assert.equal(scene.layers.filter(l => l.role === 'mini-drape').length, n, `${uniform} ${sex} ${style} ${n}: the medals are drawn`);
    const hits = scene.layers.filter(l => isRack(l) && C.rectHitsPolygon(core.layerBounds(l), lapel));
    const tag = `${uniform} ${sex} ${style} ${n}`;
    if((STUCK[`${uniform} ${sex}`] || []).includes(n)){
      stuck++;
      assert.ok(hits.length > 0, `${tag}: listed as stuck, but nothing is under the lapel: take it off the list`);
      assert.ok(scene.notes.some(t => /lapel lies over part of the miniature medals/.test(t)), `${tag}: the lapel over the rack is noted`);
      assert.ok(!scene.notes.some(t => /past the sleeve limit or the shoulder line/.test(t)), `${tag}: and the rack is not forced past the shoulder line`);
    }else assert.deepEqual(hits.map(l => l.key), [], `${tag}: no layer of the rack under the lapel`);
  }
  assert.equal(stuck, 8, 'the stuck counts: three on the men\'s blazer and one on the women\'s, in two styles');
});

test('a row of five or more overlaps equally, never above half a drape, each medal over the one toward the wearer\'s left; the medal nearest the lapel is whole and on top; four or fewer do not overlap; bodies of a row hang level', async () => {
  let longRows = 0;
  for(const [uniform, sex] of CUTS) for(const style of ['mounting', 'holding']) for(let n = 1; n <= 12; n++){
    const scene = await compose(uniform, sex, n, style);
    const rows = new Map();
    for(const d of scene.layers.filter(l => l.role === 'mini-drape')){
      const body = scene.layers.find(l => l.role === 'mini-medal' && l.key === d.key + ':medal');
      const k = d.y.toFixed(3);
      rows.set(k, [...(rows.get(k) || []), { d, body }]);
    }
    for(const row of rows.values()){
      row.sort((a, b) => a.d.x - b.d.x);
      const tag = `${uniform} ${sex} ${style} ${n}: a row of ${row.length}`;
      const steps = row.slice(1).map((m, i) => m.d.x - row[i].d.x);
      if(row.length <= 4) assert.ok(steps.every(s => s >= D.w - 1e-6), `${tag} does not overlap (steps ${steps.map(s => s.toFixed(3))})`);
      else{
        longRows++;
        assert.ok(steps.every(s => Math.abs(s - steps[0]) < 1e-6), `${tag}: equal overlaps (steps ${steps.map(s => s.toFixed(4))})`);
        assert.ok(steps[0] >= D.w / 2 - 1e-6, `${tag}: no overlap above half a drape (step ${steps[0].toFixed(3)} of ${D.w})`);
        assert.ok(row.every((m, i) => i === 0 || m.d.z < row[i - 1].d.z), `${tag}: each drape under the one toward the lapel`);
        assert.ok(row.every((m, i) => !m.body || i === 0 || m.body.z < row[i - 1].body.z), `${tag}: each medal under the one toward the lapel`);
      }
      // the medal nearest the lapel (the viewer's left of the row) is whole: nothing of its row lies over it
      const first = row[0];
      for(const m of row.slice(1)) assert.ok(m.d.z < first.d.z && (!m.body || !first.body || m.body.z < first.body.z), `${tag}: the medal nearest the lapel is on top`);
      // bodies of one row hang from one line: the same top, by the anchors the specs give
      const tops = row.filter(m => m.body).map(m => m.body.y);
      assert.ok(tops.every(y => Math.abs(y - tops[0]) < 1e-6), `${tag}: bodies hang level`);
    }
  }
  assert.ok(longRows > 0, 'rows of more than four are exercised');
});

test('layoutMiniMedals keeps the bottom row, shortens the rows the lapel reaches and lies them against the bottom row\'s outboard edge, centring a top row over the row below when that is clear', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
  const geo = { style: 'mounting', medalW: 0.6875, medalH: 2, drapeH: 1.54, slotW: 3.4, centerX: 10, bottomY: 0, rowPitch: 1 };
  const plain = A.layoutMiniMedals(items, geo);
  assert.deepEqual(plain.rows.map(r => r.length), [2, 4, 4], 'regular rows, the short one on top');
  // a wall to the viewer's left that moves inward higher up: it leaves the bottom row alone and reaches 0.5 in further in for every row above
  const blocked = (item, x, y) => x < 8.5 + (-y - 2) * 0.5;
  const arranged = A.layoutMiniMedals(items, Object.assign({ blocked, outboardSign: 1 }, geo));
  const counts = arranged.rows.map(r => r.length).reverse();
  assert.ok(counts[0] <= 4 && counts.every((c, i) => i === 0 || c <= counts[i - 1]), `no row holds more than the row below (${counts})`);
  assert.deepEqual(counts, [4, 3, 2, 1], 'the rows above the bottom one shorten as the wall comes in');
  assert.equal(counts.reduce((a, c) => a + c, 0), 10, 'every medal is placed');
  assert.ok(arranged.placements.every(p => !blocked(p.item, p.x, p.y)), 'nothing lies against the wall');
  assert.equal(arranged.lapelDeclined, undefined, 'the bottom row was clear and kept');
  const bottomEdge = Math.max(...arranged.placements.filter(p => p.row === arranged.rows.length - 1).map(p => p.x + 0.6875));
  for(const p of arranged.placements) assert.ok(p.x + 0.6875 <= bottomEdge + 1e-9, 'no row lies past the bottom row\'s outboard edge');
});
