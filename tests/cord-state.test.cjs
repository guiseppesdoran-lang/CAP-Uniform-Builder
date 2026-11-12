'use strict';
// The member's cord in the page's state (js/state.js, js/wiring.js, js/uniform-view.js): State.shoulderCord holds the seven cords of the regulation by the keys saved builds and
// shared links have always held, or a supplement cord by its id; State.shoulderCordColour holds the colour of a cord whose colour the unit commander picks. Both are saved with the
// setup and come back through the profile loader (a file someone sent is untrusted: only cords of the list and colours of its own choice get through), and the page hands the engine
// the cord (a supplement cord only while the member's unit puts it in force) with the colour.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const { context, referenceErrors } = loadPageScripts();
const ev = code => vm.runInContext(code, context);
const apply = profile => { try{ ev(`CAPUB_V2.applyProfile(${JSON.stringify(profile)})`); }catch(_){ /* the DOM-driven refresh throws under the stub; State was set before it */ } };
const saved = (state = '') => JSON.parse(ev(`(function(){ State.membership = 'cadet'; State.gender = 'male'; State.rank = 'C/Capt'; State.uniform = 'blues_b'; ${state}; return JSON.stringify(CAPUB_V2.collectProfile()); })()`));
const held = () => JSON.parse(ev('JSON.stringify({ cord: State.shoulderCord, colour: State.shoulderCordColour })'));

test('the page loads with the cord list and its helper, and the state starts with no cord and no colour', () => {
  assert.deepEqual(referenceErrors.filter(e => /cord/i.test(e)), []);
  assert.equal(ev('typeof CAPUBEngine.cords.isKnown'), 'function');
  assert.equal(ev('CAP_CORDS.supplement.length'), 58);
  assert.equal(ev('State.shoulderCord'), null);
  assert.equal(ev('State.shoulderCordColour'), null);
});

test('the cord and its colour are saved with the setup', () => {
  const p = saved("State.shoulderCord = 'de-unit-award'; State.shoulderCordColour = 'orange'");
  assert.equal(p.shoulderCord, 'de-unit-award');
  assert.equal(p.shoulderCordColour, 'orange');
  const none = saved("State.shoulderCord = null; State.shoulderCordColour = null");
  assert.equal(none.shoulderCord, '');
  assert.equal(none.shoulderCordColour, '');
});

test('a saved setup loads its cord: the seven of the regulation by their keys as before, a supplement cord by its id, a chosen cord with its colour', () => {
  for(const cord of ['group', 'wing', 'region', 'national', 'color_guard', 'honor_guard', 'aide_de_camp', 'ner-rcls', 'ga-cadet-of-the-year', 'fl-leadership-academy-instructor']){
    const p = saved(); p.shoulderCord = cord;
    delete p.shoulderCordColour;   // a setup saved before the colour existed
    apply(p);
    assert.deepEqual(held(), { cord, colour: null }, cord);
  }
  const p = saved(); p.shoulderCord = 'nc-unit-award'; p.shoulderCordColour = 'purple';
  apply(p);
  assert.deepEqual(held(), { cord: 'nc-unit-award', colour: 'purple' });
});

test('a setup from a file someone sent gets through only cords of the list and, for a cord that takes one, a colour of its own choice', () => {
  for(const bad of ['banana', 'color-guard', 'cord-group', 'GROUP', '<script>', 5, {}, ['group'], 'constructor']){
    const p = saved(); p.shoulderCord = bad;
    apply(p);
    assert.deepEqual(held(), { cord: null, colour: null }, JSON.stringify(bad));
  }
  for(const colour of ['green', 'silver', 'teal', '<script>', 5, {}, null]){
    const p = saved(); p.shoulderCord = 'de-unit-award'; p.shoulderCordColour = colour;
    apply(p);
    assert.deepEqual(held(), { cord: 'de-unit-award', colour: null }, `colour ${JSON.stringify(colour)} is not a choice`);
  }
  // a colour with a cord that does not take one is dropped, and a colour with no cord
  let p = saved(); p.shoulderCord = 'wing'; p.shoulderCordColour = 'orange';
  apply(p);
  assert.deepEqual(held(), { cord: 'wing', colour: null });
  p = saved(); p.shoulderCord = ''; p.shoulderCordColour = 'orange';
  apply(p);
  assert.deepEqual(held(), { cord: null, colour: null });
});

const build = state => JSON.parse(ev(`(function(){
  State.membership = 'cadet'; State.gender = 'male'; State.rank = 'C/Capt'; State.uniform = 'blues_b'; State.shoulderCord = null; State.shoulderCordColour = null; ${state};
  const b = CAPUBUniformView.buildFromState();
  return JSON.stringify({ cord: b.cord, cordColour: b.cordColour });
})()`));

test('the page hands the engine the cord and, for a chosen cord, the colour; a regulation cord goes as it always did', () => {
  assert.deepEqual(build("State.shoulderCord = 'wing'"), { cord: 'wing', cordColour: null });
  assert.deepEqual(build("State.shoulderCord = 'wing'; State.shoulderCordColour = 'orange'"), { cord: 'wing', cordColour: null }, 'a colour the cord does not take is not handed on');
  assert.deepEqual(build("State.shoulderCord = 'aide_de_camp'; State.membership = 'senior'; State.rank = 'Capt'"), { cord: 'aide_de_camp', cordColour: null });
  assert.deepEqual(build(''), { cord: null, cordColour: null });
  assert.deepEqual(build("State.shoulderCord = 'wing'; State.uniform = 'ocp'"), { cord: null, cordColour: null }, 'not on a uniform that takes no cord');
  assert.deepEqual(build("State.shoulderCord = 'wing'; State.membership = 'senior'; State.rank = 'Capt'"), { cord: null, cordColour: null }, 'a senior member wears only the aide cord');
});

test('a supplement cord is drawn only while the supplements in force for the member\'s unit offer it', () => {
  const none = build("State.shoulderCord = 'ner-rcls'; delete window.Supplements");
  assert.deepEqual(none, { cord: null, cordColour: null }, 'no supplement in force');
  const offered = id => `window.Supplements = { cords: state => [{ id: '${id}', supplement: 'x', group: 'x', label: 'x', note: 'x', earned: false }] }`;
  assert.deepEqual(build(`State.shoulderCord = 'ner-rcls'; ${offered('ner-rcls')}`), { cord: 'ner-rcls', cordColour: null });
  assert.deepEqual(build(`State.shoulderCord = 'ner-rcls'; ${offered('ner-ncols')}`), { cord: null, cordColour: null }, 'another supplement\'s cord');
  assert.deepEqual(build(`State.shoulderCord = 'de-unit-award'; State.shoulderCordColour = 'orange'; ${offered('de-unit-award')}`), { cord: 'de-unit-award', cordColour: 'orange' });
  assert.deepEqual(build(`State.shoulderCord = 'wing'; ${offered('ner-rcls')}`), { cord: 'wing', cordColour: null }, 'a regulation cord needs no supplement');
  ev('delete window.Supplements');
});
