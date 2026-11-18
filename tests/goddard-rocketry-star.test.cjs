'use strict';
// The Goddard's silver star for the Model Rocketry Badge (CAPR 39-3, 14h) is not a choice: the page wears it while the badge is chosen and the Mitchell is earned, and takes it away when
// either stops being true (the owner, 2026-11-18, of the Goddard's four choices drawn with the same two stars: "this is just blatantly untrue"). No credit is stored for it, so
// choosing "Earned" does not jump back to the star, and a setup saved when the star was a stored credit follows the badge and the Mitchell too.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const RA = require('../data/ribbon-awards.js');
const { context } = loadPageScripts();
const ev = src => vm.runInContext(src, context);
const evj = src => JSON.parse(JSON.stringify(vm.runInContext(src, context)));
ev('rebuildRibbonsFromGallery = function(){}; renderRack = function(){}; renderAllBadges = function(){};');
const reset = () => ev(`State.membership = 'cadet'; State.uniform = 'blues_a'; State.rank = 'C/Capt'; State.ribbonSelections = {}; State.badgeSelections = {}; State.badges = []; State.ribbons = []; State.gradeRibbons = null; normalizeRibbonSelections(); normalizeBadgeSelections();`);
const set = (id, value) => ev(`setRibbonSelectionFromDropdown(${JSON.stringify(id)}, ${JSON.stringify(value)}, { deferRender: true })`);
const sel = id => evj(`State.ribbonSelections[${JSON.stringify(id)}]`);
const wears = () => /rocketry/.test(sel('goddard_achievement').awardValue);
const devices = () => RA.resolve('goddard_achievement', { awardValue: sel('goddard_achievement').awardValue, awardLabel: sel('goddard_achievement').awardLabel }).flatMap(p => p.devices);
const badge = on => ev(`State.badgeSelections.model_rocketry_badge = { checked: ${on} }; State.badges = ${on} ? ['model_rocketry_badge'] : []; syncGoddardRocketryStar();`);

test('the star is worn while the Model Rocketry Badge is chosen and the Mitchell is earned, and goes when either stops being true', () => {
  reset();
  set('goddard_achievement', 'earned');
  badge(true);
  assert.equal(wears(), false, 'the badge alone is not enough');
  set('mitchell_award', 'earned');
  assert.equal(wears(), true, 'the Mitchell earned as well: the star');
  assert.deepEqual(devices(), ['device-star-silver']);
  assert.equal(ev('goddardWearsRocketryStar()'), true);
  badge(false);
  assert.equal(wears(), false, 'the badge off: the star goes');
  assert.deepEqual(devices(), []);
  assert.equal(ev('goddardWearsRocketryStar()'), false);
  badge(true);
  assert.equal(wears(), true, 'the badge back: the star is back');
  set('mitchell_award', '');
  assert.equal(wears(), false, 'the Mitchell off: the star goes');
  assert.equal(ev('State.ribbonSelections.goddard_achievement.rocketryCredit'), undefined, 'no credit is stored');
});

test('choosing "Earned" does not jump back to the star, and honor credit and the star are independent', () => {
  reset();
  set('goddard_achievement', 'earned');
  set('mitchell_award', 'earned');
  badge(false);
  set('goddard_achievement', 'rocketry_star');
  assert.equal(sel('goddard_achievement').awardValue, 'earned', 'the old value for the star asks for nothing the page does not know');
  badge(true);
  assert.equal(sel('goddard_achievement').awardValue, 'rocketry_star');
  set('goddard_achievement', 'earned');
  assert.equal(sel('goddard_achievement').awardValue, 'rocketry_star', 'the page wears the star again at once: it is true');
  set('goddard_achievement', 'honor_credit');
  assert.equal(sel('goddard_achievement').awardValue, 'honor_credit_and_rocketry');
  assert.deepEqual(devices(), ['device-star-silver', 'device-star-silver']);
  badge(false);
  assert.equal(sel('goddard_achievement').awardValue, 'honor_credit', 'the badge off: the honor credit alone');
  assert.deepEqual(devices(), ['device-star-silver']);
});

test('a setup saved when the star was a stored credit follows the badge and the Mitchell, and keeps its honor credit', () => {
  reset();
  set('mitchell_award', 'earned');
  badge(false);
  ev(`State.ribbonSelections.goddard_achievement = { checked: true, devices: {}, awardValue: 'rocketry_star', awardLabel: '', rocketryCredit: true, honorCredit: false }; syncGoddardRocketryStar();`);
  assert.equal(sel('goddard_achievement').awardValue, 'earned', 'a saved credit with the badge off: no star');
  ev(`State.ribbonSelections.goddard_achievement = { checked: true, devices: {}, awardValue: 'honor_credit_and_rocketry', awardLabel: '', honorCredit: true }; syncGoddardRocketryStar();`);
  assert.equal(sel('goddard_achievement').awardValue, 'honor_credit', 'the honor credit of that setup is kept');
  set('goddard_achievement', 'honor_credit_and_rocketry');
  assert.equal(sel('goddard_achievement').rocketryCredit, undefined, 'picking the old combined value stores no credit');
});

test('the setup keeps no rocketry credit: the saved shape of a ribbon holds the honor credit only', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  assert.doesNotMatch(read('js/wiring.js'), /rocketryCredit/);
  assert.match(read('js/wiring.js'), /honorCredit: !!sel\.honorCredit/);
  assert.doesNotMatch(read('data/ribbon-awards.js'), /sel\.rocketryCredit/);
  assert.doesNotMatch(read('js/galleries.js').replace(/delete sel\.rocketryCredit;[^\n]*/, ''), /\.rocketryCredit|rocketryCredit\s*:/, 'galleries.js reads and writes no stored credit (it only drops the field of an old setup)');
});
