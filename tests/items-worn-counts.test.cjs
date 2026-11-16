'use strict';
// The counts on the Items cards, in the top bar and in the Extra check follow what the drawing puts on the uniform, not what is selected
// (audit 4 November 2026: four patches picked on the ABU and two drawn, the card said "4 selected"; military badges drawn, Badges "0 of 4"
// and Items 0). js/badge-rules.js reads the patches and the awards a drawing wears off its layers (the engine lists the badges as
// scene.badgesWorn), counts from those, and says which patches the drawing left off and why.

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
const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };

test('capubPatchesWorn and capubRibbonsWorn read the layers: each patch once (its edge-on copy too), each award once (extra ribbons and the mini body are the same award)', () => {
  const scene = { layers: [
    { role: 'patch', key: 'patch:ner_patch:L_SHOULDER:0' }, { role: 'patch', key: 'patch:ner_patch:L_SHOULDER:edge' }, { role: 'patch', key: 'patch:comms_patch:CHEST_RIGHT:0' },
    { role: 'ribbon', key: 'ribbon:search_find_ribbon' }, { role: 'ribbon', key: 'ribbon:search_find_ribbon#1' }, { role: 'device', key: 'ribbon:search_find_ribbon:device:0' },
    { role: 'mini-drape', key: 'mini:air_medal' }, { role: 'mini-medal', key: 'mini:air_medal:medal' }, { role: 'ribbon', key: 'ribbon:army_x#3' }
  ] };
  context.__s = scene;
  assert.deepEqual(ev('capubPatchesWorn(__s)'), ['ner_patch', 'comms_patch']);
  assert.deepEqual(ev('capubRibbonsWorn(__s)'), ['search_find_ribbon', 'air_medal', 'army_x']);
});

test('four patches on the ABU, a pocket for one: the drawing wears two', async () => {
  const base = R.matrix().builds.find(x => x.name === 'abu-male-senior-Capt').build;
  const spec = { uniform: 'abu', membership: 'senior', rank: 'Capt', gender: 'male', patchRefs: [{ id: 'ner_patch' }, { id: 'comms_patch', slot: 'CHEST_RIGHT' }, { id: 'check_pilot_patch', slot: 'CHEST_RIGHT' }, { id: 'nesa_patch', slot: 'CHEST_RIGHT' }] };
  const scene = await P.composeUniform(R.makeBuild(spec), store);
  assert.equal(base.uniform, 'abu');
  context.__s = scene;
  assert.deepEqual(ev('capubPatchesWorn(__s)').sort(), ['comms_patch', 'ner_patch']);
});

test('ribbons in the engine\'s scene: the rack draws its awards, the OCP draws none', async () => {
  const sel = [['search_find_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];
  const a = await P.composeUniform(R.makeBuild({ uniform: 'blues_a', ribbonSel: sel }), store);
  context.__a = a;
  assert.equal(ev('capubRibbonsWorn(__a)').length, 3);
  const o = await P.composeUniform(R.makeBuild({ uniform: 'ocp', ribbonSel: sel }), store);
  context.__o = o;
  assert.deepEqual(ev('capubRibbonsWorn(__o)'), [], 'the OCP draws no ribbons');
});

const setState = src => ev(`State.membership = 'senior'; State.rank = 'Capt'; State.gender = 'male'; State.garment = {}; State.badgeSelections = {}; State.unitPatchCharter = ''; ${src}`);

test('the page counts the badges the drawing wears, U.S. military badges among them', () => {
  setState(`State.uniform = 'blues_a'; State.badges = ['CAPPilot1_FA9D33EA587D8']; State.militaryBadges = { army_air_assault_badge: { selected: true }, army_space_badge: { selected: true } }`);
  context.__scene = { uniform: 'blues_a', badgesWorn: ['CAPPilot1_FA9D33EA587D8', 'army_air_assault_badge'], notes: [], layers: [] };
  assert.equal(ev('countMilitaryBadgesWorn(__scene)'), 1, 'one of the two military badges is drawn');
  assert.equal(ev('countBadgesShown(__scene)'), 2, 'the CAP badge and the military badge drawn');
  assert.equal(ev('countMilitaryBadgesSelected()'), 2, 'the picker footer counts what is selected');
  ev(`State.militaryBadges = {}`);
});

test('the page counts the ribbons the drawing wears, none where the uniform draws none, and every selection before the first drawing', () => {
  setState(`State.uniform = 'ocp'; State.ribbons = [{ id: 'a' }, { id: 'b' }]`);
  context.__scene = { uniform: 'ocp', badgesWorn: [], notes: [], layers: [] };
  assert.equal(ev('countRibbonsShown(__scene)'), 0);
  context.__scene = { uniform: 'blues_a', notes: [], layers: [{ role: 'ribbon', key: 'ribbon:a' }] };
  assert.equal(ev('countRibbonsShown(__scene)'), 2, 'the last drawing is another uniform\'s: the selections are counted');
});

test('the patches the drawing leaves off are listed, each with the drawing\'s own reason', () => {
  setState(`State.uniform = 'abu'; State.patches = ['ner_patch', 'comms_patch', 'check_pilot_patch', 'nesa_patch']`);
  context.__scene = {
    uniform: 'abu', layers: [{ role: 'patch', key: 'patch:ner_patch:L_SHOULDER:0' }, { role: 'patch', key: 'patch:comms_patch:CHEST_RIGHT:0' }],
    notes: ['National Check Pilot Patch is not shown: the ABU breast pocket takes one patch, and the Communications Patch is on it (CAPR 39-1, 5.1.1.1.2.3)', 'Some selected patches have no place left on this uniform and are not shown']
  };
  const plan = ev('capubPatchPlan(__scene)');
  assert.equal(plan.chosen.length, 4);
  assert.deepEqual(plan.shown.map(c => c.id), ['ner_patch', 'comms_patch']);
  assert.deepEqual(plan.hidden.map(c => c.id), ['check_pilot_patch', 'nesa_patch']);
  assert.match(plan.hidden[0].line, /^National Check Pilot Patch is not shown: the ABU breast pocket takes one patch/);
  assert.match(plan.hidden[1].line, /^.+ is not shown: no place is left for it on this uniform$/, 'a patch with no note of its own gets the plain reason');
  assert.equal(ev('countPatchesShown(__scene)'), 2);
});

test('the Items count and the Extra tiles use the drawn counts, and the Ribbons card stays on a uniform that wears none', () => {
  const ui = fs.readFileSync(path.join(root, 'js', 'workspace-ui.js'), 'utf8');
  assert.match(ui, /items\.textContent = String\(shown\.ribbons \+ shown\.badges \+ shown\.patches\)/);
  assert.match(ui, /document\.addEventListener\('capub:rendered',\(\)=>\{ updateItemCards\(\); updateTopBar\(\); \}\)/, 'recounted after each drawing');
  const place = fs.readFileSync(path.join(root, 'js', 'placement.js'), 'utf8');
  assert.match(place, /by\('groupRibbons'\)\.classList\.remove\('hidden'\)/);
  assert.doesNotMatch(place, /by\('groupRibbons'\)\.classList\.toggle\('hidden'/);
});
