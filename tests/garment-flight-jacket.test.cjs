'use strict';
// LIVE7-4 (Ethan, flight suits: "make the jacket an optional addon like the covers on Class A's"). The "Flight jacket" option is offered on the two
// flight suits only (8.2.7, 8.3.7), off until the member asks, saved in State.garment and handed to the build as opt.jacket; the engine
// (profiles.js companion, profiles-field.js) shows or hides the jacket from it.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const { context } = loadPageScripts();
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context));

test('the Flight jacket control is offered on the flight suits only, as an unchecked add-on', () => {
  const rows = run(`
    const out = {};
    for(const u of ['blues_a', 'blues_b', 'aviator', 'aviator_blazer', 'semi_formal', 'mess_dress', 'ocp', 'abu', 'corporate_field', 'polo', 'flight_suit', 'corporate_flight_suit']){
      State.uniform = u; State.gender = 'male'; State.membership = 'senior'; State.rank = 'Capt'; State.garment = {};
      const c = { u, female: false, g: CAPUBEngine.grades.gradeInfo('senior', 'Capt', {}), chestBadges: 0, o: {} };
      const o = CAPUBGarmentOptions.OPTIONS.find(x => x.key === 'jacket');
      out[u] = { offered: o.when(c), type: o.type, label: o.label, defaultValue: o.defaultValue };
    }
    return out;`);
  for(const [u, r] of Object.entries(rows)){
    assert.equal(r.offered, u === 'flight_suit' || u === 'corporate_flight_suit', u);
    assert.equal(r.type, 'check');
    assert.equal(r.label, 'Flight jacket');
    assert.equal(r.defaultValue, false, 'off by default');
  }
});

test('a saved setup keeps only a boolean jacket value', () => {
  const r = run(`return { saved: CAPUBGarmentOptions.sanitize({ jacket: true, scarf: true }), bad: CAPUBGarmentOptions.sanitize({ jacket: 'yes' }) };`);
  assert.deepEqual(r.saved, { jacket: true, scarf: true });
  assert.deepEqual(r.bad, {});
});

test('the value reaches the build as opt.jacket: false by default, true once chosen, for both flight suits', () => {
  for(const u of ['flight_suit', 'corporate_flight_suit']){
    const get = garment => run(`State.uniform = '${u}'; State.gender = 'male'; State.membership = 'senior'; State.rank = 'Capt'; State.badges = [];
      State.garment = ${JSON.stringify(garment)}; return { v: CAPUBUniformView.buildFromState().opt.jacket };`).v;
    assert.equal(get({}), false, u + ' default');
    assert.equal(get({ jacket: true }), true, u + ' chosen');
    assert.equal(get({ jacket: false }), false, u);
  }
});
