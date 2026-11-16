'use strict';
// LIVE13 E77 (Ethan: "the check thing says the uniform is wrong despite it being right when you select all of your badges but you only have 4 on").
// The badge limit (CAPR 39-1 4.1.5.2.2.4, 4.1.9.4.4, 4.1.11.1.1.2.3, 4.2.5.1.3: "The total number of badges worn will not exceed four") is about
// badges WORN. Since d5faf601 a badge the uniform does not wear stays selected and is not drawn, and the position picks (scene.conflicts) let a member
// select more badges than the uniform has places for: those are not drawn either. The engine lists the badges a drawing wears (scene.badgesWorn,
// js/engine/profiles.js) and js/badge-rules.js countBadgesWornForLimit counts the selected ones it wears, command insignia excluded, which is the
// count the limit check takes (js/wiring.js validateBuild, the admin worker's file: see the report for the one-line change).

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
const rules = require('../data/uniform-rules.js');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };

const SIX = ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge', 'communications_technician_badge', 'historian_senior_badge', 'finance_senior_badge', 'safety_senior_badge'];

test('six badges selected on the men\'s Class B, four positions: the drawing wears four, and four count against the limit, so no limit warning', async () => {
  const base = R.matrix().builds.find(x => x.name === 'blues_b-male-senior-Capt').build;
  const scene = await P.composeUniform(R.makeBuild(Object.assign(JSON.parse(JSON.stringify(base)), { badgeIds: SIX })), store);
  assert.equal(scene.uniform, 'blues_b');
  assert.equal(scene.badgesWorn.length, 4, 'the engine draws four: ' + scene.badgesWorn.join(', '));
  assert.equal(new Set(scene.layers.filter(l => l.role === 'badge').map(l => l.key)).size, 4);
  ev(`State.membership = 'senior'; State.rank = 'Capt'; State.gender = 'male'; State.garment = {}; State.uniform = 'blues_b'; State.badges = ${JSON.stringify(SIX)}`);
  context.__scene = scene;
  // The old count: every selected badge the uniform wears, six, over the four (the warning Ethan saw).
  const before = ev('countBadgesForLimit(State.badges.filter(id => isBadgeWornOnCurrentUniform(id)))');
  assert.equal(before, 6);
  assert.equal(rules.badgeLimit('blues_b', { badges: before }).over, true);
  // The count the limit check now takes: the four worn.
  const worn = ev('countBadgesWornForLimit(State.badges, __scene)');
  assert.equal(worn, 4);
  assert.equal(rules.badgeLimit('blues_b', { badges: worn }).over, false, 'no badge-limit warning');
  // The two left off are an informational count, not a warning.
  assert.equal(ev('countBadgesSelectedNotDrawn(State.badges, __scene)'), 2);
});

test('five badges actually worn (were a uniform ever to draw them) still go over the four and warn; command insignia never count', () => {
  ev(`State.membership = 'senior'; State.rank = 'Capt'; State.gender = 'male'; State.garment = {}; State.uniform = 'blues_b'; State.badges = ${JSON.stringify(SIX.concat('squadron_commander_badge'))}`);
  context.__scene = { uniform: 'blues_b', badgesWorn: SIX.slice(0, 5).concat('squadron_commander_badge'), layers: [] };
  const worn = ev('countBadgesWornForLimit(State.badges, __scene)');
  assert.equal(worn, 5);
  assert.equal(rules.badgeLimit('blues_b', { badges: worn }).over, true);
});

test('before the first drawing of this uniform (no scene, or the last scene is another uniform\'s) the selected badges the uniform wears are counted', () => {
  ev(`State.uniform = 'blues_b'; State.badges = ${JSON.stringify(SIX)}`);
  context.__scene = { uniform: 'blues_a', badgesWorn: SIX.slice(0, 2), layers: [] };
  assert.equal(ev('countBadgesWornForLimit(State.badges, __scene)'), 6);
  assert.equal(ev('countBadgesWornForLimit(State.badges, null)'), 6);
  assert.equal(ev('countBadgesSelectedNotDrawn(State.badges, null)'), 0);
  // A badge the uniform does not wear is never counted (the ABU wears only field-art badges, E67).
  ev("State.uniform = 'abu'; State.badges = ['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8']");
  assert.equal(ev('countBadgesWornForLimit(State.badges, null)'), 1);
});
