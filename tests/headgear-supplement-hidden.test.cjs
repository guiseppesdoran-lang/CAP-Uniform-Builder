'use strict';
// A supplement of the member's unit may not allow a choice the builder offers: Minnesota Wing's allows no blue berets (Supplements.hiddenOptions gives { headgear:
// ['beret'] }). The headgear list then does not offer the National Blue Beret at all (hidden, not greyed); a build that had it chosen falls back to the default and the
// figure is not drawn in it; the pictures are drawn again when the unit changes (the page fires capub:supplements-changed). A unit of any other wing is offered it still.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument } = require('./helpers/mini-dom.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const Supplements = require('../js/supplements.js');

const MINNESOTA = 'NCR-MN-001', MARYLAND = 'MAR-MD-014', OTHER_NCR = 'NCR-WI-001';
const FIELD = ['abu', 'ocp', 'corporate_field'];

// The garment options panel in a sandbox with the small DOM, the picker and the real Supplements.
function panel(state){
  const doc = createDocument();
  const host = doc.createElement('div'); host.id = 'garmentOptions'; doc.body.append(host);
  const section = doc.createElement('section'); section.id = 'garmentOptionsPanel'; doc.body.append(section);
  let renders = 0;
  const sandbox = { State: Object.assign({ uniform: 'ocp', gender: 'male', membership: 'senior', rank: 'Capt', garment: {}, badges: [], unitPatchCharter: '' }, state), CAPUBEngine: { grades: G }, Supplements, document: doc, console, fullRender(){ renders++; } };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  vm.runInNewContext(read('js/garment-options.js'), sandbox);
  sandbox.CAPUBGarmentOptions.render(true);
  return { sandbox, doc, host, O: sandbox.CAPUBGarmentOptions, renders: () => renders };
}
const headgearValues = host => {
  const group = host.querySelectorAll('.vp').find(v => v.dataset.name === 'garmentOpt-headgear');
  return group.querySelectorAll('[role="radio"]').map(r => r.dataset.value);
};
const choices = (O, c) => O.OPTIONS.find(o => o.key === 'headgear').choices(c).map(x => x[0]);

test('the supplement says it: Minnesota Wing allows no blue beret, other wings say nothing about it', () => {
  assert.deepEqual(Supplements.hiddenOptions({ unitPatchCharter: MINNESOTA }), { headgear: ['beret'] });
  assert.deepEqual(Supplements.hiddenOptions({ unitPatchCharter: MARYLAND }), {});
  assert.deepEqual(Supplements.hiddenOptions({ unitPatchCharter: OTHER_NCR }), {});
  assert.deepEqual(Supplements.hiddenOptions({ unitPatchCharter: '' }), {});
});

test('a Minnesota unit is not offered the beret on the ABU, the OCP and the corporate field uniform; a unit of any other wing still is', () => {
  for(const unit of [MINNESOTA, MINNESOTA.toLowerCase()]){
    for(const u of FIELD){
      const { O } = panel({ uniform: u, unitPatchCharter: unit });
      assert.ok(!choices(O, { u, female: false, g: G.gradeInfo('senior', 'Capt', {}) }).includes('beret'), `${u} ${unit}: not in the list`);
    }
  }
  for(const unit of [MARYLAND, OTHER_NCR, '']){
    for(const u of FIELD){
      const { O } = panel({ uniform: u, unitPatchCharter: unit });
      assert.ok(choices(O, { u, female: false, g: G.gradeInfo('senior', 'Capt', {}) }).includes('beret'), `${u} ${unit || 'no unit'}: offered`);
    }
  }
  // The rest of the list is the same: only the beret goes.
  const mn = panel({ uniform: 'corporate_field', unitPatchCharter: MINNESOTA }).host, md = panel({ uniform: 'corporate_field', unitPatchCharter: MARYLAND }).host;
  assert.deepEqual(headgearValues(mn), ['auto', 'tactical', 'boonie', 'none']);
  assert.deepEqual(headgearValues(md), ['auto', 'tactical', 'boonie', 'beret', 'none']);
});

test('the picker has no beret tile for Minnesota, hidden and not greyed, and one for another wing', () => {
  const mn = panel({ unitPatchCharter: MINNESOTA }).host;
  assert.deepEqual(headgearValues(mn), ['auto', 'tactical', 'none']);
  assert.ok(!mn.querySelectorAll('.vpLabel').some(l => /Blue Beret/.test(l.textContent)), 'no tile and no label of it');
  assert.ok(!mn.querySelectorAll('[aria-disabled="true"]').length, 'nothing greyed');
  assert.deepEqual(headgearValues(panel({ unitPatchCharter: MARYLAND }).host), ['auto', 'tactical', 'beret', 'none']);
  // The other uniforms' lists are untouched by the wing.
  assert.deepEqual(headgearValues(panel({ uniform: 'blues_a', unitPatchCharter: MINNESOTA }).host), ['auto', 'service', 'none']);
});

test('a saved build with the beret and a Minnesota unit falls back to the default: the choice is dropped, the figure is drawn again and wears no beret', async () => {
  const p = panel({ unitPatchCharter: MINNESOTA, garment: { headgear: 'beret', badgeLayout: 'pair' } });
  assert.equal(p.sandbox.State.garment.headgear, undefined, 'the beret is no longer chosen');
  assert.equal(p.sandbox.State.garment.badgeLayout, 'pair', 'the member\'s other choices stay');
  assert.equal(p.renders(), 1, 'drawn again');
  assert.deepEqual(headgearValues(p.host), ['auto', 'tactical', 'none']);
  const group = p.host.querySelectorAll('.vp').find(v => v.dataset.name === 'garmentOpt-headgear');
  assert.deepEqual(group.querySelectorAll('[role="radio"]').filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.dataset.value), ['auto'], 'the picker shows the default');
  // Another wing keeps the member's beret.
  const keeps = panel({ unitPatchCharter: MARYLAND, garment: { headgear: 'beret' } });
  assert.equal(keeps.sandbox.State.garment.headgear, 'beret');
  assert.equal(keeps.renders(), 0);
  // And the page's own build, from the saved state, hands the engine no beret, so the scene has no beret view.
  const { context } = loadPageScripts();
  const opt = JSON.parse(vm.runInContext(`(function(){
    State.uniform = 'ocp'; State.gender = 'male'; State.membership = 'senior'; State.rank = 'Capt'; State.badges = []; State.unitPatchCharter = ${JSON.stringify(MINNESOTA)};
    State.garment = { headgear: 'beret' };
    CAPUBGarmentOptions.render(true);
    return JSON.stringify({ garment: State.garment, headgear: CAPUBUniformView.buildFromState().opt.headgear });
  })()`, context));
  assert.equal(opt.garment.headgear, undefined);
  assert.equal(opt.headgear, 'auto', 'the build says the default cap');
  const manifest = JSON.parse(read('images/MANIFEST.json'));
  const store = core.createSpecStore(manifest, f => Promise.resolve(JSON.parse(read('images/' + f))));
  const build = headgear => ({ uniform: 'ocp', gender: 'male', membership: 'senior', grade: G.gradeInfo('senior', 'Capt', {}), opt: { headgear }, name: { first: '', last: '', state: '', show: false }, ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null });
  const wears = async headgear => (await P.composeUniform(build(headgear), store)).layers.some(l => (l.onlyGroups || []).includes('hat-beret-nbb-front'));
  assert.equal(await wears('beret'), true, 'the engine does draw the beret when asked for it');
  assert.equal(await wears(opt.headgear), false, 'and this build does not ask');
});

test('when the unit changes the list is drawn again: Minnesota takes the beret away, another wing brings it back, and a beret chosen falls back with the unit', () => {
  const p = panel({ unitPatchCharter: MARYLAND, garment: { headgear: 'beret' } });
  assert.deepEqual(headgearValues(p.host), ['auto', 'tactical', 'beret', 'none']);
  const fire = () => (p.doc.listeners['capub:supplements-changed'] || []).forEach(fn => fn({ type: 'capub:supplements-changed' }));
  p.sandbox.State.unitPatchCharter = MINNESOTA;
  fire();
  assert.deepEqual(headgearValues(p.host), ['auto', 'tactical', 'none'], 'the unit is Minnesota\'s: no beret');
  assert.equal(p.sandbox.State.garment.headgear, undefined, 'and the beret chosen is dropped');
  assert.equal(p.renders(), 1);
  p.sandbox.State.unitPatchCharter = OTHER_NCR;
  fire();
  assert.deepEqual(headgearValues(p.host), ['auto', 'tactical', 'beret', 'none'], 'another wing: offered again, not chosen');
  assert.equal(p.sandbox.State.garment.headgear, undefined);
  assert.equal(p.renders(), 1, 'nothing more to draw');
});

test('the pictures of the headgear are asked for again with the new list', () => {
  const asked = [];
  const doc = createDocument();
  const host = doc.createElement('div'); host.id = 'garmentOptions'; doc.body.append(host);
  const section = doc.createElement('section'); section.id = 'garmentOptionsPanel'; doc.body.append(section);
  const sandbox = { State: { uniform: 'ocp', gender: 'male', membership: 'senior', rank: 'Capt', garment: {}, badges: [], unitPatchCharter: MARYLAND }, CAPUBEngine: { grades: G }, Supplements, document: doc, console, fullRender(){},
    CAPUBOptionPictures: { pictures(key, values){ asked.push([key, values.join()]); return { now: Object.fromEntries(values.map(v => [v, null])), ready: Promise.resolve({}), settled: true }; } } };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  vm.runInNewContext(read('js/garment-options.js'), sandbox);
  sandbox.CAPUBGarmentOptions.render(true);
  sandbox.State.unitPatchCharter = MINNESOTA;
  doc.listeners['capub:supplements-changed'].forEach(fn => fn());
  const heads = asked.filter(a => a[0] === 'headgear').map(a => a[1]);
  assert.deepEqual(heads, ['auto,tactical,beret,none', 'auto,tactical,none']);
});
