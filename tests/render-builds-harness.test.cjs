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

test('the harness starts the flight jacket where the page does (off), and the matrix keeps a flight build with it on (LIVE8-7; CAPR 39-1 8.2.7, 8.3.7)', async () => {
  const fs = require('node:fs');
  const page = /const GARMENT_DEFAULTS = (\{[\s\S]*?\n  \});/.exec(fs.readFileSync(require('node:path').join(__dirname, '..', 'js', 'uniform-view.js'), 'utf8'));
  const pageDefault = Function(`return ${page[1]}`)().jacket;
  assert.equal(pageDefault, false, 'the page starts without the jacket');
  assert.equal(H.makeBuild({ uniform: 'flight_suit', gender: 'male' }).opt.jacket, pageDefault, 'the harness default is the page default');
  assert.equal(H.makeBuild({ uniform: 'flight_suit', gender: 'male', opt: { jacket: true } }).opt.jacket, true);
  const { builds } = H.matrix();
  const jacketed = builds.filter(b => b.build.opt && b.build.opt.jacket === true).map(b => b.name);
  assert.deepEqual(jacketed.sort(), ['corporate_flight_suit-male-senior-Capt-jacket', 'flight_suit-male-senior-Capt-jacket']);
  const plain = builds.find(b => b.name === 'flight_suit-male-senior-Capt');
  assert.ok(plain && !(plain.build.opt && plain.build.opt.jacket), 'the plain flight build states no jacket, so it shows the suit alone');
});

test('the standard matrix has the Class B and aviator shirts long with the tie by default and short with it off, and a cadet NCO on each aviator sheet (LIVE8-7)', () => {
  const { builds } = H.matrix();
  const by = n => builds.find(b => b.name === n);
  for(const u of ['blues_b', 'aviator']) for(const g of ['male', 'female']){
    const long = by(`${u}-${g}-long-tie-default-senior-Capt`), short = by(`${u}-${g}-short-tie-off-senior-Capt`);
    assert.ok(long && long.build.opt.sleeve === 'long' && long.build.opt.tie === undefined, `${u} ${g}: long, tie left at its default (on)`);
    assert.ok(short && short.build.opt.sleeve === 'short' && short.build.opt.tie === false, `${u} ${g}: short, tie off`);
  }
  for(const g of ['male', 'female']) for(const sleeve of ['short', 'long']){
    const b = by(`aviator-${g}-${sleeve}-cadet-NCO-C-MSgt`);
    assert.ok(b && b.build.membership === 'cadet' && b.build.rank === 'C/MSgt' && b.build.opt.sleeve === sleeve, `aviator ${g} ${sleeve}: cadet NCO`);
  }
});

test('the critique build set is valid JSON the harness can turn into engine builds', () => {
  const { execFileSync } = require('node:child_process');
  const list = JSON.parse(execFileSync(process.execPath, [require('node:path').join(__dirname, '..', 'scripts', 'critique-builds.cjs')], { encoding: 'utf8' }));
  assert.ok(list.length > 30);
  const names = new Set(list.map(b => b.name));
  assert.equal(names.size, list.length, 'names are unique');
  for(const b of list) assert.ok(H.makeBuild(b.build).uniform, b.name);
  for(const n of ['ocp-male-senior-LtCol-patches-overlay', 'flight_suit-male-cadet-CSSgt-two-badges-es-style1-scarf', 'corporate_flight_suit-male-senior-MajGen', 'flight_suit-male-cadet-CCapt-command-pin']) assert.ok(names.has(n), n);
});

test('the harness puts military ribbons before the CAP ribbons, keeping their given order, as js/render-core.js sortRibbons does', () => {
  const order = H.sortByPrecedence([['curry_achievement'], ['military:b'], ['mitchell_award'], ['military:a']]).map(e => e[0]);
  assert.deepEqual(order.slice(0, 2), ['military:b', 'military:a']);
  assert.ok(order.indexOf('mitchell_award') < order.indexOf('curry_achievement'));
});
