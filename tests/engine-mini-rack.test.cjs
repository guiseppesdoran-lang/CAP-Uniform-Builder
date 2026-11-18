'use strict';
// The miniature medal rack (CAPR 39-1 11.2.8): four or fewer in a row lie edge to edge, more than four overlap each by the same amount, never above half, each over
// the one toward the wearer's left, so the medal nearest the lapel is whole and on top; the bodies of one row hang level; no device lies under a neighbouring medal.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const C = require('../js/engine/compose.js');
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

const CUTS = [['mess_dress', 'male'], ['mess_dress', 'female'], ['semi_formal', 'male'], ['semi_formal', 'female']];
const D = C.MINI_DRAPE;

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

test('no device of a miniature drape lies under a neighbouring medal of its row or of a row above, on any cut, count or style', async () => {
  const hit = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
  let devices = 0;
  for(const [uniform, sex] of CUTS) for(const style of ['mounting', 'holding']) for(let n = 1; n <= 12; n++){
    const scene = await compose(uniform, sex, n, style);
    const rack = scene.layers.filter(l => ['mini-drape', 'mini-medal'].includes(l.role));
    for(const d of scene.layers.filter(l => l.role === 'device' && /^mini:/.test(l.key))){
      devices++;
      const own = d.key.split(':device')[0];
      const over = rack.filter(l => l.key !== own && !l.key.startsWith(own + ':') && l.z > d.z && hit(d, l));
      assert.deepEqual(over.map(l => l.key), [], `${uniform} ${sex} ${style} ${n}: ${d.key} is in view`);
    }
  }
  assert.ok(devices > 50);
});
