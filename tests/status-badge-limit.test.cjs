'use strict';
// The Check panel's badge limit counts the badges worn, as drawn (LIVE13 E77b; Ethan: "the check thing says the uniform is wrong despite it
// being right when you select all of your badges but you only have 4 on"). js/wiring.js validateBuild takes js/badge-rules.js
// countBadgesWornForLimit (the engine's scene.badgesWorn, 4ca927b2), the "not worn on this uniform" notice is information rather than a
// warning, and the panel re-validates on every drawing. tests/badge-limit-worn.test.cjs covers the count itself.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const R = require('../scripts/render-builds.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const root = path.join(__dirname, '..');
const wiring = fs.readFileSync(path.join(root, 'js', 'wiring.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const SIX = ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge', 'communications_technician_badge', 'historian_senior_badge', 'finance_senior_badge', 'safety_senior_badge'];

test('the limit line counts the badges worn, the not-worn notice is ok, and the panel follows each drawing', () => {
  assert.match(wiring, /const limit = CAPUBUniformRules\.badgeLimit\(State\.uniform, \{badges: countBadgesWornForLimit\(\), patches: patchTotal\}\);/);
  assert.match(wiring, /addNotice\('ok',`\$\{notWornLine\} Not shown here: \$\{names\}\./);
  assert.match(wiring, /document\.addEventListener\('capub:rendered', \(\) => updateStatusPanel\(\)\);/);
});

test('six badges selected on the men\'s Class B with four drawn: no badge-limit warning and no warning at all from the badges', async () => {
  const base = R.matrix().builds.find(x => x.name === 'blues_b-male-senior-Capt').build;
  const scene = await P.composeUniform(R.makeBuild(Object.assign(JSON.parse(JSON.stringify(base)), { badgeIds: SIX })), store);
  assert.equal(scene.badgesWorn.length, 4);
  const { context } = loadPageScripts();
  context.CAPUBUniformView = { scene };
  const notices = JSON.parse(JSON.stringify(vm.runInContext(`(() => {
    State.membership = 'senior'; State.rank = 'Capt'; State.gender = 'male'; State.garment = {}; State.uniform = 'blues_b';
    State.badges = ${JSON.stringify(SIX)}; State.patches = []; State.unitPatchCharter = '';
    return CAPUB_V2.validateBuild();
  })()`, context)));
  assert.ok(!notices.some(n => /This uniform allows \d+/.test(n.msg)), 'no badge-limit notice: ' + JSON.stringify(notices));
  // With the drawing of five badges worn the limit still warns.
  context.CAPUBUniformView = { scene: Object.assign({}, scene, { badgesWorn: SIX.slice(0, 5) }) };
  const over = JSON.parse(JSON.stringify(vm.runInContext('CAPUB_V2.validateBuild()', context)));
  assert.ok(over.some(n => n.type === 'err' && /This uniform allows 4 counted badges and 5 are selected/.test(n.msg)), JSON.stringify(over));
});

test('a badge the uniform does not wear is an ok notice, not counted as a warning', () => {
  const { context } = loadPageScripts();
  context.CAPUBUniformView = { scene: null };
  const notices = JSON.parse(JSON.stringify(vm.runInContext(`(() => {
    State.membership = 'senior'; State.rank = 'Capt'; State.gender = 'male'; State.garment = {}; State.uniform = 'abu';
    State.badges = ['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8', 'finance_senior_badge']; State.patches = []; State.unitPatchCharter = '';
    return CAPUB_V2.validateBuild();
  })()`, context)));
  const line = notices.find(n => /Not shown here:/.test(n.msg));
  assert.ok(line, 'the not-worn notice is there: ' + JSON.stringify(notices));
  assert.equal(line.type, 'ok');
});
