'use strict';
// The polo wears one CAP aviation badge, occupational badge, specialty track badge or duty title, embroidered 1/2 in over the name
// (CAPR 39-1, 5.3.2.1.1). A member's report: the specialty track badges (Safety Technician and the rest) were refused there with
// "This uniform does not wear it". Each of the 59 specialty track badges is worn on the polo, drawn from its embroidered twin, the
// member picks one of several, and the kinds the paragraph does not name stay refused.

const test = require('node:test');
const assert = require('node:assert/strict');

const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const polo = require('./helpers/polo-sheets.cjs');
const CAT = require('../data/badge-catalog.js');
const RULES = require('../data/uniform-rules.js');
const { store } = polo;

const SPECIALTY = Object.keys(CAT.BADGES).filter(id => CAT.family(id) === 'specialty');
const NURSE = 'nurse_officer';
const EMT = 'emt_paramedic';
const SAFETY = 'safety_technician_badge';

function build(badgeIds, extra){
  const o = extra || {};
  return Object.assign({
    uniform: 'polo', gender: o.gender || 'male', membership: 'senior', grade: G.gradeInfo('senior', 'Capt', {}),
    opt: Object.assign({ sleeve: 'short', headgear: 'auto' }, o.opt || {}),
    name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: badgeIds.map(id => ({ id, title: (CAT.get(id) || {}).name || id })), command: null, militaryBadges: [], patches: [], cord: null
  }, o.build || {});
}
const compose = b => P.composeUniform(b, store);
const badges = scene => scene.layers.filter(l => l.role === 'badge');

test('every specialty track badge is worn on the polo, over the name, from its embroidered twin without the cloth backing (5.3.2.1.1)', async () => {
  assert.equal(SPECIALTY.length, 59);
  for(const id of SPECIALTY){
    const scene = await compose(build([id]));
    const got = badges(scene);
    assert.equal(got.length, 1, `${id}: drawn`);
    assert.equal(got[0].id, CAT.get(id).embroidered, `${id}: its embroidered twin`);
    assert.equal(got[0].place, 'over the name on the left breast');
    assert.deepEqual(got[0].hideGroups, ['backing'], `${id}: embroidered into the shirt, no sewn-on backing`);
    assert.ok(!scene.notes.some(n => /cannot be shown|not worn/.test(n)), `${id}: ${scene.notes.join('|')}`);
    const half = scene.layers.find(l => l.type === 'measure');
    assert.ok(half && half.label === '½ in', `${id}: the half inch is measured`);
  }
});

test('the specialty track badge is worn on every cut and sleeve length of the polo', async () => {
  for(const gender of ['male', 'female']) for(const sleeve of ['short', 'long']){
    const scene = await compose(build([SAFETY], { gender, opt: { sleeve } }));
    assert.equal(badges(scene).length, 1, `${gender} ${sleeve}`);
  }
});

test('with several badges selected one is worn and the member picks which; the others say only one is worn (5.3.2.1.1)', async () => {
  const set = [NURSE, EMT, SAFETY, 'communications_senior_badge'];
  const scene = await compose(build(set));
  assert.equal(badges(scene).length, 1);
  assert.ok(scene.notes.some(n => /Only one badge or duty title is worn on the polo/.test(n) && /5\.3\.2\.1\.1/.test(n)));
  const c = scene.conflicts.find(x => x.position === 'polo');
  assert.ok(c && c.limit === 1 && c.candidates.length === 4, 'all four are candidates for the one place');
  for(const id of set){
    const chosen = await compose(build(set, { build: { badgeChoices: { polo: id } } }));
    assert.deepEqual(badges(chosen).map(l => l.key), ['badge:' + id], `the member's pick ${id} is the one drawn`);
  }
  // A specialty track badge is as good a pick as an occupational one: it can stand alone against it.
  const pick = await compose(build([NURSE, SAFETY], { build: { badgeChoices: { polo: SAFETY } } }));
  assert.equal(badges(pick)[0].id, CAT.get(SAFETY).embroidered);
});

test('the kinds the paragraph does not name stay refused: service, National Staff, cadet, marksmanship, rocketry (5.3.2.1.1)', async () => {
  for(const id of ['command_council_badge', 'national_staff_badge', 'stem_badges', 'cyber_badges', 'model_rocketry_badge', 'nra_marksman_badge']){
    const scene = await compose(build([id]));
    assert.equal(badges(scene).length, 0, `${id} is not drawn`);
    assert.ok(scene.notes.some(n => /not worn|cannot be shown|worn by cadets only/.test(n)), `${id} says why: ${scene.notes.join('|')}`);
  }
  // The National Staff Badge never takes the place by itself, nor while a worn badge is chosen.
  const both = await compose(build(['national_staff_badge', SAFETY]));
  assert.deepEqual(badges(both).map(l => l.key), ['badge:' + SAFETY]);
  const alone = await compose(build(['national_staff_badge']));
  assert.equal(badges(alone).length, 0);
});

test('the Badges window offers on the polo exactly the badges it can wear, one place (5.3.2.1.1)', () => {
  const offered = Object.keys(CAT.BADGES).filter(id => RULES.isBadgeWornOn('polo', Object.assign({ id }, CAT.get(id))));
  for(const id of SPECIALTY) assert.ok(offered.includes(id), id);
  for(const f of ['service', 'national-staff', 'command', 'rocketry', 'marksmanship', 'cadet-specialty']) for(const id of Object.keys(CAT.BADGES).filter(i => CAT.family(i) === f)) assert.ok(!offered.includes(id), id);
  assert.equal(RULES.badgeLimit('polo', { badges: 2 }).cap, 1);
  assert.equal(RULES.badgeLimit('polo', { badges: 2 }).over, true);
  // The field uniforms still read field art alone: no specialty track badge on the OCP, ABU or Corporate Field Uniform.
  for(const u of ['ocp', 'abu', 'corporate_field']) assert.ok(!RULES.isBadgeWornOn(u, Object.assign({ id: SAFETY }, CAT.get(SAFETY))), u);
});
