'use strict';
// Things a member picks that never draw are named, with the reason (audit 4 November 2026, "silent no-ops"): the patches the drawing leaves
// off, the U.S. military badges on the uniforms that allow them and do not draw them yet (the ABU, 5.1.1.1.2.6; the OCP, 7.1.1.3.1; the flight suit;
// the Corporate Semi-Formal), and the award a uniform does not wear, named with the paragraph for that uniform (the mess dress is USAF-style:
// the old line blamed "Corporate-style uniforms" there).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const rules = require('../data/uniform-rules.js');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const root = path.join(__dirname, '..');
const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };

test('military badges are drawn on the dress uniforms and not (yet) on the ABU, OCP, flight suit and Corporate Semi-Formal', () => {
  for(const u of ['blues_a', 'blues_b', 'mess_dress', 'semi_formal_usaf', 'aviator']) assert.equal(rules.drawsMilitaryBadges(u), true, u);
  for(const u of ['abu', 'ocp', 'flight_suit', 'semi_formal']) assert.equal(rules.drawsMilitaryBadges(u), false, u);
  for(const u of ['aviator_blazer', 'corporate_field', 'corporate_flight_suit', 'polo']) assert.equal(rules.drawsMilitaryBadges(u), false, u + ' does not allow them at all');
});

test('the picker\'s military section says the badges are not drawn on those uniforms yet, and the footer does not count them', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'wiring.js'), 'utf8');
  assert.match(src, /!CAPUBUniformRules\.drawsMilitaryBadges\(State\.uniform\)/);
  assert.match(src, /U\.S\. military badges are not drawn on this uniform yet\. Your choices are kept for the uniforms that show them\./);
  ev(`State.membership = 'senior'; State.rank = 'Capt'; State.gender = 'male'; State.garment = {}; State.militaryBadges = { army_air_assault_badge: { selected: true } }; State.uniform = 'abu'`);
  assert.equal(ev('countMilitaryBadgesSelected()'), 0, 'not drawn on the ABU: not counted');
  ev(`State.uniform = 'blues_a'`);
  assert.equal(ev('countMilitaryBadgesSelected()'), 1);
  ev(`State.militaryBadges = {}`);
});

test('the Check lists each patch the drawing left off and each unworn award with its own reason', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'wiring.js'), 'utf8');
  assert.match(src, /for\(const c of capubPatchPlan\(\)\.hidden\) addNotice\('ok',c\.line/);
  assert.match(src, /is not worn on the Mess Dress \(ICL 18-02, 4b\)/);
  assert.match(src, /is not worn on the CAP Corporate uniforms \(CAPR 39-1, 11\.2\.3\)/);
  assert.doesNotMatch(src, /are not worn on Corporate-style uniforms \(CAPR 39-1, 11\.1\.6 and 11\.2\.3\)/, 'the single line that blamed Corporate-style uniforms on the mess dress is gone');
});

test('validateBuild: an award a uniform does not wear is named with the paragraph for that uniform; hidden patches and undrawn military badges are information', () => {
  ev(`State.membership = 'senior'; State.rank = 'Capt'; State.gender = 'male'; State.garment = {}; State.badges = []; State.militaryBadges = {}; State.unitPatchCharter = '';
      State.ribbonSelections = { Air_Force_Organizational_Excellence_Award: { checked: true } }; State.uniform = 'mess_dress'`);
  let notices = ev('CAPUB_V2.validateBuild()');
  const afoea = notices.find(n => /Organizational Excellence/.test(n.msg));
  assert.ok(afoea, 'the AFOEA is named');
  assert.equal(afoea.type, 'warn');
  assert.match(afoea.msg, /is not worn on the Mess Dress \(ICL 18-02, 4b\), so it is not shown\./);
  assert.doesNotMatch(afoea.msg, /Corporate/);
  ev(`State.uniform = 'semi_formal'`);
  notices = ev('CAPUB_V2.validateBuild()');
  assert.match(notices.find(n => /Organizational Excellence/.test(n.msg)).msg, /not worn on the CAP Corporate uniforms \(CAPR 39-1, 11\.2\.3\)/);
  ev(`State.ribbonSelections = {}; State.uniform = 'abu'; State.militaryBadges = { army_air_assault_badge: { selected: true } }; State.patches = ['ner_patch', 'comms_patch', 'check_pilot_patch']`);
  context.__scene = { uniform: 'abu', notes: ['Check Pilot Patch is not shown: the ABU breast pocket takes one patch, and the Communications Patch is on it (CAPR 39-1, 5.1.1.1.2.3)'],
    layers: [{ role: 'patch', key: 'patch:ner_patch:L_SHOULDER:0' }, { role: 'patch', key: 'patch:comms_patch:CHEST_RIGHT:0' }] };
  ev('window.CAPUBUniformView = { scene: __scene }');
  notices = ev('CAPUB_V2.validateBuild()');
  const hidden = notices.find(n => /^Check Pilot Patch is not shown/.test(n.msg));
  assert.ok(hidden && hidden.type === 'ok', 'the dropped patch is named, as information');
  assert.ok(notices.some(n => /1 U\.S\. military badge is chosen but not drawn on this uniform yet/.test(n.msg)));
  assert.ok(!notices.some(n => /No automatic validation issues/.test(n.msg)), 'no "no issues" line beside them');
  ev(`State.patches = []; State.militaryBadges = {}; delete window.CAPUBUniformView`);
});
