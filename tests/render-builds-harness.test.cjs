'use strict';
// The render harness (scripts/render-builds.cjs) draws what the page draws: ribbons sorted by CAPR 39-3
// precedence, and a general officer in the standard matrix.

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../scripts/render-builds.cjs');

test('the harness sorts a ribbon selection by precedence, as uniform-view.js does before it draws', () => {
  const sel = [['mitchell_award', 'earned_cos_star'], ['wright_brothers_award'], ['curry_achievement'], ['cap_achievment_award', 'capub_total_7'], ['search_find_ribbon']];
  const order = H.sortByPrecedence(sel).map(e => e[0]);
  assert.deepEqual(order, H.sortByPrecedence([...sel].reverse()).map(e => e[0]), 'the result does not depend on the order given');
  assert.ok(order.indexOf('cap_achievment_award') < order.indexOf('wright_brothers_award'), 'the Achievement Award ranks above the Wright Brothers Award');
  assert.ok(order.indexOf('mitchell_award') < order.indexOf('curry_achievement'));
  assert.equal(order[order.length - 1], 'search_find_ribbon');
  const built = H.ribbonsFrom(sel, 'cadet');
  assert.equal(built[0].id, order[0]);
  const asListed = H.ribbonsFrom(sel, 'cadet', 'as-listed');
  assert.equal(asListed[0].id, 'mitchell_award', 'ribbonOrder as-listed keeps the order given');
});

test('the standard matrix has a Maj Gen on every uniform a general officer wears', () => {
  const { builds } = H.matrix();
  const names = new Set(builds.map(b => b.name));
  for(const n of ['mess_dress-male-senior-MajGen', 'mess_dress-female-senior-MajGen', 'blues_a-male-senior-MajGen', 'blues_b-male-senior-MajGen', 'blues_b-female-senior-MajGen', 'semi_formal-male-senior-MajGen', 'semi_formal-female-senior-MajGen', 'flight_suit-female-senior-MajGen', 'corporate_flight_suit-male-senior-MajGen']){
    assert.ok(names.has(n), `${n} is in the matrix`);
  }
});
