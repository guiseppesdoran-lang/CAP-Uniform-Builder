'use strict';
// LIVE-ENGINE 3: the field uniforms offer the cap to wear (patrol cap, tactical cap, the CFU's boonie hat, none) in the garment
// panel and the engine draws that one cap only (tests/engine-fix-r-other-3.test.cjs checks the layers).

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
const G = require('../js/engine/grades.js');

function options(uniform, rank){
  const State = { uniform, gender: 'male', membership: 'senior', rank, garment: {} };
  const sandbox = { State, CAPUBEngine: { grades: G }, document: { addEventListener(){}, getElementById(){ return null; } }, window: {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'garment-options.js'), 'utf8'), sandbox);
  const O = sandbox.CAPUBGarmentOptions;
  const c = { u: uniform, female: false, g: G.gradeInfo('senior', rank, {}) };
  const opt = O.OPTIONS.find(o => o.key === 'headgear');
  return { O, shown: opt.when(c), choices: JSON.parse(JSON.stringify(opt.choices(c).map(x => x[0]))) };
}

test('the garment panel offers the cap on each field uniform: patrol and tactical, the boonie hat on the CFU only, the National Blue Beret (9.2.3, ICL 25-02; LIVE13 E83), or none', () => {
  assert.deepEqual(options('ocp', 'Capt').choices, ['auto', 'tactical', 'beret', 'none']);
  assert.deepEqual(options('abu', 'Capt').choices, ['auto', 'tactical', 'beret', 'none']);
  assert.deepEqual(options('corporate_field', 'Capt').choices, ['auto', 'tactical', 'boonie', 'beret', 'none']);
  for(const u of ['ocp', 'abu', 'corporate_field']) assert.equal(options(u, 'Capt').shown, true, u);
  // The other uniforms keep their own lists.
  assert.deepEqual(options('blues_a', 'Capt').choices, ['auto', 'service', 'none']);
  assert.deepEqual(options('flight_suit', 'Capt').choices, ['auto', 'none']);
});

test('a saved setup may carry the new cap values; anything else is dropped', () => {
  const { O } = options('abu', 'Capt');
  const clean = raw => JSON.parse(JSON.stringify(O.sanitize(raw)));
  assert.deepEqual(clean({ headgear: 'tactical' }), { headgear: 'tactical' });
  assert.deepEqual(clean({ headgear: 'boonie' }), { headgear: 'boonie' });
  assert.deepEqual(clean({ headgear: 'beret' }), { headgear: 'beret' });
  assert.deepEqual(clean({ headgear: 'beanie' }), {});
});
