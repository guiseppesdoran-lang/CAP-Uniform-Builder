'use strict';
// Doran: "when I'm in the badge selection menu I'm not seeing the sUAS technician badges". The three sUAS technician badges are
// cadet-authorized (data/badge-catalog.js CADET_AUTHORIZED) and senior-authorized, and drawn in dress, field and cloth forms, but the
// cadet chooser's own list (js/catalog.js getBadgeCategoriesForCurrentMembership) did not name them, so a cadet never saw them. On the
// blazers (semi-formal, aviator + blazer) the regulation takes only the chaplain and service badges (4.2.3.1.1.1), so they are not offered
// there for anyone (data/uniform-rules.js BADGE_WEAR).

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const IDS = ['uas_technician_basic_badge', 'uas_technician_senior_badge', 'uas_technician_master_badge'];

test('the chooser lists the three sUAS technician badges, under aviation, for a cadet and a senior member', () => {
  for(const m of ['cadet', 'senior']){
    ev(`State.membership = ${JSON.stringify(m)}`);
    const cats = ev('getBadgeCategoriesForCurrentMembership()');
    const aviation = cats.find(c => /^Aviation/.test(c.key));
    for(const id of IDS){
      assert.ok(aviation.ids.includes(id), `${m}: ${id} under ${aviation.key}`);
      assert.equal(ev(`CAPUBBadgeCatalog.eligibleFor(${JSON.stringify(id)}, ${JSON.stringify(m)})`), true, `${m}: ${id} eligible`);
    }
  }
});

test('a cadet\'s chooser lists every badge a cadet is authorized to wear (no authorized badge is left out of the list)', () => {
  ev(`State.membership = 'cadet'`);
  const listed = new Set(ev('getBadgeCategoriesForCurrentMembership().flatMap(c => c.ids)'));
  const left = ev('badgeList.filter(id => CAPUBBadgeCatalog.eligibleFor(id, "cadet"))').filter(id => !listed.has(id));
  assert.deepEqual(left, []);
});

test('worn on every dress and field uniform whose paragraph names the aviation family, not on the semi-formal blazer', () => {
  const worn = u => IDS.map(id => ev(`isBadgeWornOnCurrentUniform(${JSON.stringify(id)}, ${JSON.stringify(u)})`));
  for(const u of ['blues_a', 'blues_b', 'mess_dress', 'aviator', 'corporate_field', 'abu', 'ocp', 'flight_suit', 'corporate_flight_suit']){
    for(const w of worn(u)) assert.notEqual(w, false, u);
  }
  for(const w of worn('semi_formal')) assert.equal(w, false, 'semi_formal');
  // The aviator blazer is drawn with the aviator shirt beside it, which wears them (4.2.5.1.3): offered, on the shirt.
  for(const w of worn('aviator_blazer')) assert.equal(w, true, 'aviator_blazer with its shirt');
});
