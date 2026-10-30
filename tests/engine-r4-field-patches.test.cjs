'use strict';
// FIX-R-OTHER-r4 items 6 and 7: which patch goes on the ABU and CFU sleeves, and one size for one patch.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const NAME = { first: 'Pat', last: 'Doran', show: true };
const hb = (uniform, gender, membership, rank, o) => HARNESS.makeBuild(Object.assign({ uniform, gender, membership, rank, name: NAME, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } }, o || {}));
const ARCHER = { id: 'archer_ocp_patch', kind: 'general', img: 'patches/ocp/archer_ocp_patch.webp', slot: 'L_SHOULDER', label: 'ARCHER' };
const WING = { id: 'nywg_patch', kind: 'general', slot: 'L_SHOULDER', label: 'New York Wing' };
const UNIT = { id: 'TN-330_ocp_patch', kind: 'unit', img: 'patches/ocp/TN-330_ocp_patch.webp', label: 'TN-330 Sequoyah Cadet Squadron' };
const flat = (scene, id) => scene.layers.find(l => l.role === 'patch' && l.key.startsWith(`patch:${id}:`) && !/:edge$/.test(l.key));

test('the page and the harness mark the wing, region and national patches with their echelon', () => {
  const r = HARNESS.patchesFrom([WING, { id: 'ner_patch', kind: 'general', label: 'NER' }, ARCHER]);
  assert.deepEqual(r.patches.map(p => p.echelon), ['wing', 'region', null]);
  const ui = fs.readFileSync(path.join(root, 'js/uniform-view.js'), 'utf8');
  assert.match(ui, /echelon: meta\.echelon \|\| null/, 'buildPatches passes the echelon');
});

test('ABU and CFU: a special activity patch such as ARCHER never lands on the left sleeve; the left sleeve takes the wing, region or national patch only (5.1.1.1.2.2, 5.2.1.1.2.2, 5.2.1.1.2.3)', async () => {
  for(const gender of ['male', 'female']){
    for(const uniform of ['abu', 'corporate_field']){
      const only = await compose(hb(uniform, gender, 'senior', 'SMSgt', { patchRefs: [UNIT, ARCHER] }));
      const archer = flat(only, 'archer_ocp_patch');
      const label = `${uniform} ${gender}`;
      if(uniform === 'abu'){
        assert.ok(!archer, `${label}: ARCHER is not drawn on the ABU sleeve`);
        assert.ok(!only.layers.some(l => /archer_ocp_patch/.test(l.key)), `${label}: nor edge-on`);
        assert.ok(only.notes.some(n => /ARCHER is not worn on the ABU sleeve.*5\.1\.1\.1\.2\.2/.test(n)), `${label}: the note cites 5.1.1.1.2.2`);
      }else{
        assert.ok(archer && /R_SHOULDER/.test(archer.key), `${label}: ARCHER is on the right sleeve (${archer && archer.key})`);
        const zr = core.landmarkBounds(await store.load('garment-cfu-coat'), 'activity_patch_zone_right');
        assert.ok(archer.x + archer.w / 2 > zr.x && archer.x + archer.w / 2 < zr.x + zr.w, `${label}: centred on the right sleeve zone`);
        assert.ok(!only.layers.some(l => /archer_ocp_patch:L_SHOULDER/.test(l.key)), `${label}: nothing on the left sleeve`);
      }
      // With a wing patch too: the wing is on the left, ARCHER as above.
      const both = await compose(hb(uniform, gender, 'senior', 'SMSgt', { patchRefs: [UNIT, WING, ARCHER] }));
      const wing = flat(both, 'nywg_patch');
      assert.ok(wing && /L_SHOULDER/.test(wing.key), `${label}: the wing patch is on the left sleeve`);
      assert.ok(!both.layers.some(l => /archer_ocp_patch:L_SHOULDER/.test(l.key)), `${label}: ARCHER not on the left sleeve beside the wing patch`);
    }
  }
});

test('one patch is one size on every uniform: the size its spec states, on the OCP Velcro, the CFU sleeve and the pockets (R1, D2)', async () => {
  const ocp = await compose(hb('ocp', 'male', 'senior', 'Lt Col', { patchRefs: [UNIT, ARCHER] }));
  const ocpArcher = flat(ocp, 'archer_ocp_patch');
  assert.ok(ocpArcher && Math.abs(ocpArcher.h - 3.5) < 0.005, `OCP ARCHER ${ocpArcher && ocpArcher.h}`);
  for(const gender of ['male', 'female']){
    const cfu = await compose(hb('corporate_field', gender, 'senior', 'Capt', { patchRefs: [UNIT, WING, ARCHER] }));
    const archer = flat(cfu, 'archer_ocp_patch');
    assert.ok(archer, `${gender} CFU: ARCHER drawn`);
    assert.ok(Math.abs(archer.w - ocpArcher.w) < 0.005 && Math.abs(archer.h - ocpArcher.h) < 0.005, `${gender} CFU: ARCHER is ${archer.w} x ${archer.h}, the same as the OCP's ${ocpArcher.w} x ${ocpArcher.h}`);
    const unit = flat(cfu, 'TN-330_ocp_patch');
    assert.ok(unit && Math.abs(unit.h - 3.5) < 0.005, `${gender} CFU: the unit patch is held to 3 1/2 in`);
    const wing = flat(cfu, 'nywg_patch');
    assert.ok(wing && Math.abs(wing.w - 3.25) < 0.005 && Math.abs(wing.h - 3.095) < 0.005, `${gender} CFU: the wing patch at its spec's size`);
    const abu = await compose(hb('abu', gender, 'senior', 'Capt', { patchRefs: [UNIT, WING] }));
    assert.ok(Math.abs(flat(abu, 'nywg_patch').w - wing.w) < 0.005, `${gender} ABU: the wing patch is the same size`);
    // Hung from the 1/2 in line, as before: the top edge is 1/2 in below the shoulder seam (the unchanged rule).
    const spec = await store.load('garment-abu-coat');
    const seam = core.anchor(spec, 'seam_top_center_left');
    assert.ok(Math.abs(flat(abu, 'nywg_patch').y - seam.y - 0.5) < 0.005, `${gender} ABU: 1/2 in below the seam`);
  }
});

// ---- FIX-R-OTHER-r4 item 11: the critique set covers the flight suits' ES patch, chaplain badge, command pin and cadet C/Capt ----------------

test('critique set: flight suits carry the cadet C/Capt on both suits and cuts, the ES patch on the right breast pocket in each style (LIVE9-4), the Christian chaplain badge and the command pin with two badges (D14, D15, D17; 8.2.4.1, 8.2.4.3, 8.3.4.3)', async () => {
  const { execFileSync } = require('node:child_process');
  const critique = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts', 'critique-builds.cjs')], { encoding: 'utf8' }));
  const names = new Set(critique.map(x => x.name));
  assert.equal(names.size, critique.length, 'critique build names are unique');
  for(const u of ['flight_suit', 'corporate_flight_suit']) for(const g of ['male', 'female']){
    for(const n of [`${u}-${g}-cadet-CCapt`, `${u}-${g}-cadet-CCapt-two-badges-command-pin`, `${u}-${g}-senior-Capt-es-style1`, `${u}-${g}-senior-Capt-es-style2`, `${u}-${g}-senior-Capt-chaplain`]) assert.ok(names.has(n), n);
  }
  const sheet = { flight_suit: 'garment-fdu-flight-suit', corporate_flight_suit: 'garment-cfdu-flight-suit' };
  for(const u of ['flight_suit', 'corporate_flight_suit']) for(const g of ['male', 'female']) for(const [style, id] of [['style1', 'patch-es-style-1'], ['style2', 'patch-es-style-2']]){
    const x = critique.find(c => c.name === `${u}-${g}-senior-Capt-es-${style}`);
    const scene = await compose(HARNESS.makeBuild(x.build));
    const es = scene.layers.find(l => l.id === id && l.figure !== 2);
    assert.ok(es, `${u} ${g} ${style}: ES patch drawn`);
    const spec = await store.load(sheet[u]);
    const pocket = core.landmark(spec, 'chest_pocket_right').points;
    const garment = scene.layers.find(l => l.role === 'garment' && l.figure !== 2);
    const k = garment.w / spec.w, c = { x: es.x + es.w / 2 - garment.x, y: es.y + es.h / 2 - garment.y };
    let hit = false;
    for(let i = 0, j = pocket.length - 1; i < pocket.length; j = i++){ const a = pocket[i], b = pocket[j]; if((a.y * k > c.y) !== (b.y * k > c.y) && c.x < (b.x - a.x) * k * (c.y - a.y * k) / ((b.y - a.y) * k) + a.x * k) hit = !hit; }
    assert.ok(hit, `${u} ${g} ${style}: the patch's centre is on the right breast pocket (LIVE9-4)`);
  }
  const chap = await compose(HARNESS.makeBuild(critique.find(c => c.name === 'flight_suit-male-senior-Capt-chaplain').build));
  assert.ok(chap.layers.some(l => l.key === 'badge:christian_chaplin'), 'the chaplain badge is on the tag');
});
