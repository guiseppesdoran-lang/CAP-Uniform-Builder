'use strict';
// LIVE-DRESS B4 (Ethan, live site: the miniature medals are 'spaced way too far apart'; Doran's photo of the real jacket, thread L1837): the
// rows lie one medal body and a short band of ribbon apart, so the upper row's pendants hang over the ribbons of the row below; the devices on
// a miniature's ribbon are the miniature (half) size (CAPR 39-1 11.3: miniatures are about 1/2 the size of regular medals; 11.4.2); the lowest
// row keeps its 1/2 in above the crest or its midpoint (4.2.1.4, 4.2.2.4, 4.1.1.1.2.2).

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
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const TWELVE = [['distinguished_service_award'], ['exceptional_service_award'], ['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'], ['air_search_and_rescue_ribbon'], ['cap_gill_robb_wilson_ribbon'], ['cap_command_service_ribbon'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];
const NO_DEVICES = ['distinguished_service_award', 'exceptional_service_award', 'meritorious_service_award', 'commander_commendation_award', 'cap_gill_robb_wilson_ribbon', 'cap_command_service_ribbon', 'cap_leadership_ribbon', 'cap_membership_ribbon'].map(id => [id]);
const build = (uniform, sex, sel) => HARNESS.makeBuild({ uniform, gender: sex, membership: 'senior', rank: 'Col', ribbonSel: sel, medalSel: true, opt: { rackColumns: 4, rackArrangement: 'lapel', miniStyle: 'mounting' } });
const rowsOf = drapes => [...new Set(drapes.map(d => d.y.toFixed(3)))].map(Number).sort((a, b) => a - b);

for(const [uniform, sex] of [['mess_dress', 'male'], ['mess_dress', 'female'], ['semi_formal', 'male']]){
  test(`${uniform} ${sex}: the miniature rows overlap like the worn jacket, the upper pendants hanging over the ribbons below (11.2.8, photo L1837)`, async () => {
    for(const sel of [TWELVE, NO_DEVICES]){
      const scene = await P.composeUniform(build(uniform, sex, sel), store);
      const drapes = scene.layers.filter(l => l.role === 'mini-drape');
      const bodies = scene.layers.filter(l => l.role === 'mini-medal');
      const ys = rowsOf(drapes);
      assert.ok(ys.length >= 2, 'more than one row');
      const hang = Math.max(...await Promise.all(bodies.map(async l => { const s = await store.load(l.id); return s.h - (core.anchor(s, 'ribbon_attach') || { y: 0 }).y; })));
      for(let i = 1; i < ys.length; i++){
        const pitch = ys[i] - ys[i - 1];
        assert.ok(pitch < C.MINI_DRAPE.h - 0.05, `${uniform} ${sex}: row pitch ${pitch.toFixed(2)} in is under one drape length (${C.MINI_DRAPE.h} in), not the old 1.65 in`);
        assert.ok(pitch >= hang - 0.001, `the rows are never closer than one medal body (${hang.toFixed(2)} in)`);
        // an upper medal body reaches down over the ribbon of the row below it
        const up = bodies.filter(b => Math.abs(drapes.find(d => b.key.startsWith(d.key))?.y - ys[i - 1]) < 1e-3);
        for(const b of up) assert.ok(b.y + b.h > ys[i] + 0.3, `${uniform} ${sex}: the pendant (${(b.y + b.h).toFixed(2)}) hangs over the ribbon below (starts ${ys[i].toFixed(2)})`);
      }
    }
  });
}

test('miniature medals: the devices on a miniature ribbon are half the size of the ribbon devices (11.3, 11.4.2), on the drape', async () => {
  const scene = await P.composeUniform(build('mess_dress', 'male', TWELVE), store);
  const devs = scene.layers.filter(l => l.role === 'device' && /^mini:/.test(l.key));
  assert.ok(devs.length >= 3, `devices on the miniatures (${devs.length})`);
  const regular = await P.composeUniform(HARNESS.makeBuild({ uniform: 'blues_a', gender: 'male', membership: 'senior', rank: 'Col', ribbonSel: TWELVE, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } }), store);
  for(const d of devs){
    const twin = regular.layers.find(l => l.role === 'device' && l.id === d.id);
    assert.ok(twin, `${d.id} is also on the ribbon rack`);
    assert.ok(Math.abs(d.w - twin.w * 0.5) < 0.002 && Math.abs(d.h - twin.h * 0.5) < 0.002, `${d.id}: ${d.w.toFixed(3)} x ${d.h.toFixed(3)} is half of ${twin.w.toFixed(3)} x ${twin.h.toFixed(3)}`);
    assert.equal(d.rotate, 90, 'turned vertical on the drape (11.4.2)');
  }
});

test('semi-formal and mess dress: the lowest row keeps its line (1/2 in above the crest, the midpoint) with the closer rows', async () => {
  const sc = await P.composeUniform(build('mess_dress', 'male', TWELVE), store);
  const spec = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', 'garment-mess-dress-male.spec.json'), 'utf8'));
  const cy = spec.anchors.miniature_medals_center[1] / 100;
  const minis = sc.layers.filter(l => l.role === 'mini-drape' || l.role === 'mini-medal');
  const mid = (Math.min(...minis.map(l => l.y)) + Math.max(...minis.map(l => l.y + l.h))) / 2;
  assert.ok(Math.abs(mid - cy) < 0.15, `the group is centred on the sheet's midpoint (${mid.toFixed(2)} vs ${cy})`);
});
