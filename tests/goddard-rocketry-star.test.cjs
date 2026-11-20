'use strict';
// The Goddard's silver star for the Model Rocketry Badge (CAPR 39-3, 14h) is a switch again (the owner, 2026-11-19, of the Goddard with only the honor credit switch: "wheres the
// rocketry"). It is a fact about the member, the Goddard selection's own `rocketryCredit` as `honorCredit` is for the honor credit: the switch under a chosen Goddard sets it, choosing
// the Model Rocketry Badge turns it on once, taking the badge off does not turn it off, a value that names the star (a setup saved before the switch, the report import) is the fact;
// the star is worn (the value, the picture) only while the Mitchell is earned, and the switch is shown only then.

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
const reset = () => ev(`State.membership = 'cadet'; State.uniform = 'blues_a'; State.rank = 'C/Capt'; State.ribbonSelections = {}; State.badgeSelections = {}; State.badges = []; State.ribbons = []; State.gradeRibbons = null; State.rocketryBadgeWas = undefined; normalizeRibbonSelections(); normalizeBadgeSelections(); syncGoddardRocketryStar();`);
const set = (id, value) => ev(`setRibbonSelectionFromDropdown(${JSON.stringify(id)}, ${JSON.stringify(value)}, { deferRender: true })`);
const sel = () => evj(`State.ribbonSelections.goddard_achievement`);
const stars = () => RA.resolve('goddard_achievement', { awardValue: sel().awardValue, awardLabel: sel().awardLabel }).flatMap(p => p.devices).length;
const badge = on => ev(`State.badgeSelections.model_rocketry_badge = { checked: ${on} }; State.badges = ${on} ? ['model_rocketry_badge'] : []; syncGoddardRocketryStar();`);
const fact = (key, on) => ev(`setGoddardFact(${JSON.stringify(key)}, ${on})`);
const toggles = () => evj(`getRibbonControls('goddard_achievement').toggles`).map(t => [t.key, t.on]);

test('all eight combinations of honor credit, the rocketry star and the Mitchell draw exactly the stars they say', () => {
  for(const honor of [false, true]) for(const rocket of [false, true]) for(const mitchell of [false, true]){
    reset();
    set('goddard_achievement', 'earned');
    if(mitchell) set('mitchell_award', 'earned');
    fact('honor', honor);
    fact('rocketry', rocket);
    assert.equal(stars(), (honor ? 1 : 0) + (rocket && mitchell ? 1 : 0), `honor ${honor}, rocketry ${rocket}, Mitchell ${mitchell}`);
    assert.equal(sel().rocketryCredit, rocket, 'the fact is kept whether or not the Mitchell is earned');
    assert.equal(sel().honorCredit, honor);
    assert.deepEqual(toggles().map(t => t[0]), mitchell ? ['honor', 'rocketry'] : ['honor'], 'the rocketry switch is shown only while the Mitchell is earned');
    assert.deepEqual(toggles().find(t => t[0] === 'honor'), ['honor', honor]);
    if(mitchell) assert.deepEqual(toggles().find(t => t[0] === 'rocketry'), ['rocketry', rocket]);
  }
});

test('without the Mitchell the star is not drawn and the fact comes back when the Mitchell is chosen', () => {
  reset();
  set('goddard_achievement', 'earned');
  fact('rocketry', true);
  assert.equal(stars(), 0);
  set('mitchell_award', 'earned');
  assert.equal(stars(), 1, 'the Mitchell chosen: the star is back');
  set('mitchell_award', '');
  assert.equal(stars(), 0);
  assert.equal(sel().rocketryCredit, true);
});

test('choosing the Model Rocketry Badge turns the switch on once; taking the badge off does not turn it off, and the member may turn it off or on by hand', () => {
  reset();
  set('goddard_achievement', 'earned');
  set('mitchell_award', 'earned');
  assert.equal(sel().rocketryCredit, false);
  badge(true);
  assert.equal(sel().rocketryCredit, true, 'the badge chosen: on');
  assert.equal(stars(), 1);
  badge(false);
  assert.equal(sel().rocketryCredit, true, 'the badge taken off: still on');
  fact('rocketry', false);
  assert.equal(stars(), 0, 'turned off by hand');
  ev('syncGoddardRocketryStar()');
  assert.equal(sel().rocketryCredit, false, 'a later look at the same badge turns nothing on again');
  badge(true);
  assert.equal(sel().rocketryCredit, true, 'chosen again: on once more');
  fact('rocketry', false);
  ev('syncGoddardRocketryStar(); syncGoddardRocketryStar();');
  assert.equal(sel().rocketryCredit, false, 'and a badge that stays chosen does not undo the member\'s switch');
});

test('a setup loaded with the badge already chosen turns nothing on; a value that names the star is the fact', () => {
  reset();
  set('mitchell_award', 'earned');
  ev(`State.badgeSelections.model_rocketry_badge = { checked: true }; State.badges = ['model_rocketry_badge']; State.rocketryBadgeWas = undefined; State.ribbonSelections.goddard_achievement = { checked: true, devices: {}, awardValue: 'earned', awardLabel: '', honorCredit: false, rocketryCredit: false }; syncGoddardRocketryStar();`);
  assert.equal(sel().rocketryCredit, false, 'the badge was there when the setup came in');
  for(const [value, honor] of [['rocketry_star', false], ['honor_credit_and_rocketry', true], ['earned_both_devices', true]]){
    ev(`State.ribbonSelections.goddard_achievement = { checked: true, devices: {}, awardValue: ${JSON.stringify(value)}, awardLabel: '' }; syncGoddardRocketryStar();`);
    assert.equal(sel().rocketryCredit, true, `${value}: the switch on`);
    assert.equal(sel().honorCredit, honor, `${value}: honor credit`);
    assert.equal(stars(), honor ? 2 : 1, value);
  }
  // the old value names stay readable and are what is stored
  reset();
  set('mitchell_award', 'earned');
  set('goddard_achievement', 'rocketry_star');
  assert.equal(sel().awardValue, 'rocketry_star');
  fact('honor', true);
  assert.equal(sel().awardValue, 'honor_credit_and_rocketry');
});

test('the setup keeps the rocketry fact beside the honor credit', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  assert.match(read('js/wiring.js'), /honorCredit: !!sel\.honorCredit,\s*rocketryCredit: !!sel\.rocketryCredit/);
  assert.match(read('js/wiring.js'), /State\.rocketryBadgeWas = undefined/);
});
