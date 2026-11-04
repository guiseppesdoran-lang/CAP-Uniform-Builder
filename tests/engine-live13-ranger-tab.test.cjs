'use strict';
// LIVE13 E84 (Ethan: "add the ranger tabs as patches similar to the NCSAs"), as corrected by his ruling of 2026-10-29, which beats the regulation's
// text: "the ranger tabs arent authorized on ABUs!!! only on OCPs unfortunately in lieu of an hhq patch"; "they are only authorized unfortunately on
// the OCPs". (CAPR 39-1 5.1.2.3.7 and 5.2.1.1.2.7 put the tab on the BDU and CFU above the CAP tape.) So the ten tabs of Figure A8-2 are an OCP patch
// group, one at a time, worn in lieu of the HHQ patch in its place on the left sleeve under AUX (7.1.1.4.2, 7.1.1.4.2.1); the HHQ patch is then not
// drawn, the chest badges keep measuring from the CAP tape, and nothing is measured for the place (it has no stated position). Not offered on the
// ABU or the CFU, and a tab handed to them is not drawn.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const R = require('../scripts/render-builds.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(4)} vs ${b.toFixed(4)}`);
const SHEET = { ocp: 'garment-ocp-coat-abu-cut', abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' };
const TAB = id => ({ id, title: id, href: '', aspect: 6.13, slot: 'CAP_TAPE', kind: 'general' });
const EXPERT = 'patch-ranger-tab-expert-ranger-black', MEDIC = 'patch-ranger-tab-medic-red';
const GRADES = ['ranger-3rd-class', 'ranger-2nd-class', 'ranger', 'advanced-ranger', 'expert-ranger-black', 'expert-ranger-red', 'medic-gray', 'medic-red', 'senior-medic', 'instructor'];

const base = name => JSON.parse(JSON.stringify(R.matrix().builds.find(x => x.name === name).build));
const compose = b => P.composeUniform(R.makeBuild(b), store);

const WING = { id: 'nywg_patch', title: 'New York Wing Patch', href: 'images/patches/nywg_patch.webp', aspect: 1, slot: 'L_SHOULDER', kind: 'general', echelon: 'wing' };

test('OCP: the Ranger tab takes the HHQ patch\'s place under AUX, centred; the HHQ patch is not drawn; the badges measure from the CAP tape; the note', async () => {
  const b = base('ocp-male-cadet-C-Maj');
  b.rank = 'C/Col';
  b.badgeIds = ['AirCrew1_DB3F0FCC3650F'];
  b.patches = [WING, TAB(EXPERT)];
  const scene = await compose(b);
  const sheet = await store.load(SHEET.ocp);
  const velcro = core.landmarkBounds(sheet, 'sleeve_flap_velcro_left'), aux = core.landmarkBounds(sheet, 'patch_aux_left');
  const slot = { x: velcro.x, y: aux.y + aux.h, w: velcro.w, h: velcro.y + velcro.h - aux.y - aux.h };
  const tab = scene.layers.find(l => l.key === `patch:${EXPERT}:L_SHOULDER:0`);
  assert.ok(tab, 'tab drawn flat on the sleeve');
  // 2.7 x 0.44 in (art aa950a56, measured on the HMRS 2021 uniform poster): inside the 4 in Velcro below AUX.
  near(tab.w, 2.7, 1e-6, 'drawn at its sheet size'); near(tab.h, 0.44, 1e-6, 'height');
  assert.ok(tab.x >= slot.x && tab.x + tab.w <= slot.x + slot.w && tab.y >= slot.y && tab.y + tab.h <= slot.y + slot.h, 'inside the Velcro below AUX');
  const hhqc = core.anchor(sheet, 'hhq_patch_left_center');
  if(hhqc){ near(tab.x + tab.w / 2, hhqc.x, 1e-6, 'on the sheet\'s HHQ centre'); near(tab.y + tab.h / 2, hhqc.y, 1e-6, 'on the sheet\'s HHQ centre'); }
  near(tab.x + tab.w / 2, slot.x + slot.w / 2, 1e-3, 'centred across the HHQ place'); near(tab.y + tab.h / 2, slot.y + slot.h / 2, 1e-3, 'centred down it');
  assert.ok(!tab.clip, 'not clipped');
  assert.ok(scene.layers.some(l => l.key === `patch:${EXPERT}:L_SHOULDER:edge`), 'seen edge-on on the coat too');
  assert.ok(!scene.layers.some(l => /nywg_patch/.test(l.key || '')), 'the HHQ patch is not drawn');
  // Not on the CAP tape; the badge 1/2 in from the tape as before E84.
  const T = core.anchor(sheet, 'cap_tape_top_center');
  assert.ok(!scene.layers.some(l => l.role === 'patch' && Math.abs(l.y + l.h - T.y) < 1e-6 && Math.abs(l.x + l.w / 2 - T.x) < 1e-6), 'nothing on the tape');
  const ms = scene.layers.filter(l => l.type === 'measure');
  assert.ok(ms.some(m => m.label === '½ in' && Math.abs(m.from.y - T.y) < 1e-6 && /from the tape/.test(m.opts.callout.caption)), 'the 1/2 in from the tape');
  assert.ok(!ms.some(m => /touching/.test(m.label) || /from the tab/.test((m.opts && m.opts.callout && m.opts.callout.caption) || '')));
  assert.ok(scene.notes.some(n => /in lieu of the higher headquarters patch.*CAPR 39-1, 7\.1\.1\.4\.2/.test(n) && /New York Wing Patch is not shown/.test(n)), scene.notes.join(' | '));
});

for(const [uniform, name] of [['abu', 'abu-male-cadet-C-Maj'], ['corporate_field', 'corporate_field-male-senior-Capt']]){
  test(`${uniform}: a Ranger tab is not drawn (OCP only, Ethan's ruling) and a note says so`, async () => {
    const b = base(name);
    b.patches = [TAB(EXPERT)];
    const scene = await compose(b);
    assert.ok(!scene.layers.some(l => (l.key || '').includes('patch-ranger-tab')));
    assert.ok(scene.notes.some(n => /worn on the OCP only/.test(n)), scene.notes.join(' | '));
  });
}

test('one tab only: with two selected the first is drawn and a note says so', async () => {
  const b = base('ocp-male-cadet-C-Maj');
  b.patches = [TAB(EXPERT), TAB(MEDIC)];
  const scene = await compose(b);
  assert.ok(scene.layers.some(l => (l.key || '').startsWith('patch:' + EXPERT)));
  assert.ok(!scene.layers.some(l => (l.key || '').includes(MEDIC)));
  assert.ok(scene.notes.some(n => /Only one CAP Ranger tab is worn/.test(n)));
});

test('the patch picker: the ten tabs are a group "Hawk Mountain Ranger tabs", offered on the OCP only, one at a time, dropped from an ABU or CFU selection; the shopping list prices them by order form', () => {
  const { context } = loadPageScripts();
  const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
  for(const g of GRADES){
    const id = 'patch-ranger-tab-' + g;
    const meta = ev(`PATCH_META[${JSON.stringify(id)}]`);
    assert.ok(meta, id);
    assert.equal(meta.group, 'Hawk Mountain Ranger tabs'); assert.equal(meta.kind, 'ranger-tab'); assert.equal(meta.oneOnly, true);
    assert.ok(fs.existsSync(path.join(root, 'images', meta.img)), meta.img);
    assert.ok(ev(`patchList.includes(${JSON.stringify(id)})`));
    assert.equal(meta.slotHint, 'L_SHOULDER');
    assert.equal(ev(`isPatchAuthorizedForUniform(${JSON.stringify(id)}, 'ocp', 'cadet')`), true, `${id} on the OCP`);
    for(const u of ['abu', 'corporate_field', 'blues_a', 'blues_b', 'flight_suit', 'cfdu']) assert.equal(ev(`isPatchAuthorizedForUniform(${JSON.stringify(id)}, ${JSON.stringify(u)}, 'cadet')`), false, `${id} not on ${u}`);
  }
  ev(`State.patchSelections = { ${JSON.stringify(EXPERT)}: { checked: true }, ${JSON.stringify(MEDIC)}: { checked: true }, nesa_patch: { checked: true } }; State.patches = [${JSON.stringify(EXPERT)}, 'nesa_patch', ${JSON.stringify(MEDIC)}]; capubKeepOneRangerTab(${JSON.stringify(MEDIC)})`);
  assert.deepEqual(ev('State.patches'), ['nesa_patch', MEDIC]);
  assert.equal(ev(`State.patchSelections[${JSON.stringify(EXPERT)}].checked`), false);
  assert.equal(ev('State.patchSelections.nesa_patch.checked'), true, 'other patches untouched');
  // A tab selected on the OCP is dropped when the member is on the ABU or the CFU.
  for(const u of ['abu', 'corporate_field']){
    ev(`State.uniform = ${JSON.stringify(u)}; State.patchSelections = { ${JSON.stringify(EXPERT)}: { checked: true } }; State.patches = [${JSON.stringify(EXPERT)}]; clearUnauthorizedPatchesForCurrentUniform()`);
    assert.deepEqual(ev('State.patches'), [], u);
    assert.equal(ev(`State.patchSelections[${JSON.stringify(EXPERT)}].checked`), false, u);
  }
  const PC = require('../purchase-catalog.js');
  const item = (PC.patchItem || (PC.default && PC.default.patchItem));
  if(item) assert.equal(item(EXPERT).item, 'ranger_tab');
});
