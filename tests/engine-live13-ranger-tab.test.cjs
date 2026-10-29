'use strict';
// LIVE13 E84 (Ethan: "add the ranger tabs as patches similar to the NCSAs"). CAPR 39-1 5.1.2.3.7, 5.2.1.1.2.7: "One CAP Ranger tab earned at the Hawk
// Mountain activity may be sewn centered immediately above and touching the "Civil Air Patrol" tape ... Aviation or Occupational badges worn above this
// will be placed so that the insignia is ½ inch above the Ranger Tape, rather than measuring from the "Civil Air Patrol" tape." 9.2.4: with the ABU
// during the activity only. The ten tabs (Figure A8-2) are a patch group of the ABU, CFU and OCP patch picker, one at a time; the engine sets the tab's
// seat_on_cap_tape anchor on the tape's top centre and measures the chest badges from the tab's top.

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

for(const [uniform, name] of [['abu', 'abu-male-cadet-C-Maj'], ['corporate_field', 'corporate_field-male-senior-Capt'], ['ocp', 'ocp-male-cadet-C-Maj']]){
  test(`${uniform}: the Ranger tab sits on the CAP tape's top centre, touching it; the aviation badge 1/2 in above the tab; measured; the activity-only note`, async () => {
    const b = base(name);
    b.badgeIds = ['AirCrew1_DB3F0FCC3650F'];
    b.patches = [TAB(EXPERT)];
    const scene = await compose(b);
    const sheet = await store.load(SHEET[uniform]);
    const T = core.anchor(sheet, 'cap_tape_top_center');
    const tab = scene.layers.find(l => l.key === 'patch:' + EXPERT);
    assert.ok(tab, 'tab drawn');
    near(tab.w, 5, 1e-6, 'tab width'); near(tab.h, 0.815, 1e-6, 'tab height');
    near(tab.x + tab.w / 2, T.x, 1e-6, 'centred on the tape'); near(tab.y + tab.h, T.y, 1e-6, 'its bottom on the tape\'s top (touching)');
    const badge = scene.layers.find(l => l.key === 'badge:AirCrew1_DB3F0FCC3650F');
    const spec = await store.load(badge.id);
    const art = core.anchor(spec, 'art_bottom_center');
    const silverBottom = badge.y + (art ? art.y * badge.h / spec.h : badge.h);
    near(tab.y - silverBottom, 0.5, 1e-3, 'the badge\'s insignia 1/2 in above the tab');
    const ms = scene.layers.filter(l => l.type === 'measure');
    assert.ok(ms.some(m => m.label === '½ in' && Math.abs(m.from.y - tab.y) < 1e-6 && m.opts.callout && /from the tab/.test(m.opts.callout.caption)), 'the 1/2 in from the tab');
    assert.ok(ms.some(m => m.label === 'centered, touching' && Math.abs(m.from.y - T.y) < 1e-6 && Math.abs(m.opts.mid.x - T.x) < 1e-6), 'centred and touching');
    assert.ok(scene.notes.some(n => /CAP Ranger tab is worn at the Hawk Mountain activity only/.test(n)), scene.notes.join(' | '));
    // Not also drawn as a sleeve or pocket patch.
    assert.equal(scene.layers.filter(l => (l.key || '').includes(EXPERT) && l.role === 'patch').length, 1);
  });
}

test('one tab only: with two selected the first is drawn and a note says so', async () => {
  const b = base('ocp-male-cadet-C-Maj');
  b.patches = [TAB(EXPERT), TAB(MEDIC)];
  const scene = await compose(b);
  assert.ok(scene.layers.some(l => l.key === 'patch:' + EXPERT));
  assert.ok(!scene.layers.some(l => (l.key || '').includes(MEDIC)));
  assert.ok(scene.notes.some(n => /Only one CAP Ranger tab is worn/.test(n)));
});

test('the patch picker: the ten tabs are a group "Hawk Mountain Ranger tabs", offered on the ABU, CFU and OCP only, one at a time; the shopping list prices them by order form', () => {
  const { context } = loadPageScripts();
  const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
  for(const g of GRADES){
    const id = 'patch-ranger-tab-' + g;
    const meta = ev(`PATCH_META[${JSON.stringify(id)}]`);
    assert.ok(meta, id);
    assert.equal(meta.group, 'Hawk Mountain Ranger tabs'); assert.equal(meta.kind, 'ranger-tab'); assert.equal(meta.oneOnly, true);
    assert.ok(fs.existsSync(path.join(root, 'images', meta.img)), meta.img);
    assert.ok(ev(`patchList.includes(${JSON.stringify(id)})`));
    for(const u of ['abu', 'ocp', 'corporate_field']) assert.equal(ev(`isPatchAuthorizedForUniform(${JSON.stringify(id)}, ${JSON.stringify(u)}, 'cadet')`), true, `${id} on ${u}`);
    for(const u of ['blues_a', 'blues_b', 'flight_suit', 'cfdu']) assert.equal(ev(`isPatchAuthorizedForUniform(${JSON.stringify(id)}, ${JSON.stringify(u)}, 'cadet')`), false, `${id} not on ${u}`);
  }
  ev(`State.patchSelections = { ${JSON.stringify(EXPERT)}: { checked: true }, ${JSON.stringify(MEDIC)}: { checked: true }, nesa_patch: { checked: true } }; State.patches = [${JSON.stringify(EXPERT)}, 'nesa_patch', ${JSON.stringify(MEDIC)}]; capubKeepOneRangerTab(${JSON.stringify(MEDIC)})`);
  assert.deepEqual(ev('State.patches'), ['nesa_patch', MEDIC]);
  assert.equal(ev(`State.patchSelections[${JSON.stringify(EXPERT)}].checked`), false);
  assert.equal(ev('State.patchSelections.nesa_patch.checked'), true, 'other patches untouched');
  const PC = require('../purchase-catalog.js');
  const item = (PC.patchItem || (PC.default && PC.default.patchItem));
  if(item) assert.equal(item(EXPERT).item, 'ranger_tab');
});
