'use strict';
// LIVE13 E67 (Ethan: "when someone is selecting on a uniform, it should only show the badges applicable. like for ABU's, the ES
// specialty track badges shouldn't apply for example"). data/uniform-rules.js BADGE_WEAR states, per uniform, the Attachment 4 badge
// families its paragraphs name and whether only genuine field artwork is worn (Ethan's LIVE-FIELD B6); the Badges picker lists only
// those (js/badge-rules.js isBadgeWornOnCurrentUniform). Each uniform's offered and hidden sets are checked here against the catalog;
// tests/uniform-badges-browser.cjs selects an ES badge on the Class B, switches to the ABU and back in headless Chrome.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const rules = require('../data/uniform-rules.js');
const catalog = require('../data/badge-catalog.js');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const ALL = Object.keys(catalog.BADGES);
const fam = f => ALL.filter(id => catalog.family(id) === f);
const field = ids => ids.filter(id => catalog.hasField(id));
const offered = (u, opts) => ALL.filter(id => rules.isBadgeWornOn(u, Object.assign({ id }, catalog.get(id)), opts)).sort();
const sorted = ids => [...new Set(ids)].sort();

const EVERY = ['chaplain', 'aviation', 'occupational', 'specialty', 'service', 'national-staff', 'command', 'rocketry', 'marksmanship', 'cadet-specialty'];
const LEFT_BREAST = ['chaplain', 'aviation', 'occupational', 'command'];
const CREST_SERVICE = ['senior_advisory_group_badge', 'command_council_badge', 'national_executive_committee_badge', 'cap_national_command_board_badge'];

// Per uniform: the families offered, whether only field art, the paragraphs (the ref must name each), and the expected offered ids.
const TABLE = {
  blues_a: { families: EVERY, refs: ['4.1.5.2.2.4', '4.1.9.4.4'], ids: ALL },
  blues_b: { families: EVERY, refs: ['4.1.11.1.1.2.3', '4.1.12.2.5'], ids: ALL },
  semi_formal_usaf: { families: EVERY, refs: ['4.1.3.2.2', '4.1.4.2'], ids: ALL },
  aviator: { families: EVERY, refs: ['4.2.5.1.3', '4.2.6.2.7'], ids: ALL },
  mess_dress: { families: ['chaplain', 'aviation', 'occupational', 'specialty', 'service', 'national-staff', 'command'], refs: ['4.1.1.1.3', '4.1.2.1.2.4'],
    ids: ALL.filter(id => !['rocketry', 'marksmanship', 'cadet-specialty'].includes(catalog.family(id))) },
  semi_formal: { families: ['chaplain', 'service'], refs: ['4.2.1', '4.2.3.1.1.1', '4.2.3.1.1.3'], ids: [...fam('chaplain'), ...CREST_SERVICE] },
  aviator_blazer: { families: ['chaplain', 'service'], refs: ['4.2.3.1.1.1', '4.2.3.1.1.3', '4.2.4.1.1.3'], ids: [...fam('chaplain'), ...CREST_SERVICE], opts: { underlayer: 'turtleneck' } },
  abu: { families: LEFT_BREAST, fieldArt: true, refs: ['5.1.1.1.2.4', '5.1.1.1.2.5'], ids: field(LEFT_BREAST.flatMap(fam)) },
  corporate_field: { families: LEFT_BREAST, fieldArt: true, refs: ['5.2.1.1.2.6', '5.2.1.1.2.9'], ids: field(LEFT_BREAST.flatMap(fam)) },
  ocp: { families: LEFT_BREAST, fieldArt: true, refs: ['7.1.1.3.1', '7.1.1.3.1.5', '7.1.1.3.1.7'], ids: field(LEFT_BREAST.flatMap(fam)) },
  flight_suit: { families: LEFT_BREAST, refs: ['8.2.4.1'], ids: LEFT_BREAST.flatMap(fam) },
  corporate_flight_suit: { families: LEFT_BREAST, refs: ['8.3.4.1'], ids: LEFT_BREAST.flatMap(fam) },
  polo: { families: ['service', 'aviation', 'occupational', 'chaplain', 'specialty'], fieldArt: true, refs: ['5.3.2.1.1'],
    ids: field(['service', 'aviation', 'occupational', 'chaplain', 'specialty'].flatMap(fam)) }
};

test('every uniform of the rules table has a badge row, and nothing else does', () => {
  assert.deepEqual(Object.keys(rules.BADGE_WEAR).sort(), Object.keys(rules.RULES).sort());
  assert.deepEqual(Object.keys(TABLE).sort(), Object.keys(rules.RULES).sort());
});

for(const [u, want] of Object.entries(TABLE)){
  test(`${u}: offers ${sorted(want.ids).length} of the catalog's ${ALL.length} badges (CAPR 39-1, ${want.refs.join(', ')})`, () => {
    const wear = rules.badgeWear(u, want.opts);
    assert.deepEqual(sorted(wear.families), sorted(want.families), 'families');
    assert.equal(wear.fieldArt, !!want.fieldArt, 'field art only');
    for(const ref of want.refs) assert.ok(wear.ref.split(/[,;]\s*|\s+/).includes(ref), `ref names ${ref}: ${wear.ref}`);
    const got = offered(u, want.opts);
    assert.deepEqual(got, sorted(want.ids));
    // Hidden is the rest of the catalog: no badge both offered and hidden, none lost.
    const hidden = ALL.filter(id => !got.includes(id));
    assert.equal(got.length + hidden.length, ALL.length);
  });
}

test('the ABU, CFU and OCP hide every specialty track badge, the three ES badges among them, and keep the field set (B6)', () => {
  for(const u of ['abu', 'corporate_field', 'ocp']){
    const got = offered(u);
    for(const id of [...fam('specialty'), ...fam('service'), ...fam('national-staff'), ...fam('cadet-specialty'), 'model_rocketry_badge', 'nra_marksman_badge']){
      assert.ok(!got.includes(id), `${u} hides ${id}`);
    }
    for(const id of ['emergency_services_badge', 'senior_emergency_services_badge', 'master_emergency_services_badge']) assert.ok(!got.includes(id), `${u}: ${id}`);
    // The 37 original field forms: the aviation set, ground team, IC, medical, nurse, legal, EMT, chaplain, the two commander pins.
    assert.equal(got.length, 37, u);
    for(const id of ['CAPPilot1_FA9D33EA587D8', 'observer_badge', 'master_ground_team_badge', 'incident_commander_1_badge', 'christian_chaplin', 'squadron_commander_badge']){
      assert.ok(got.includes(id), `${u} offers ${id}`);
    }
  }
});

test('the Class B offers the ES badges; the flight suits do not (8.2.4.1, 8.3.4.1: the tag takes no specialty track badge)', () => {
  assert.ok(offered('blues_b').includes('emergency_services_badge'));
  for(const u of ['flight_suit', 'corporate_flight_suit']){
    assert.ok(!offered(u).includes('emergency_services_badge'), u);
    assert.ok(offered(u).includes('master_ground_team_badge'), u);
  }
});

test('the polo offers only badges with embroidered (field) art of its families: no command pin, no specialty track badge (5.3.2.1.1, POLO-ENG-4)', () => {
  const got = offered('polo');
  assert.ok(!got.includes('squadron_commander_badge'));
  assert.ok(!got.includes('emergency_services_badge'));
  assert.ok(got.includes('CAPPilot1_FA9D33EA587D8'));
  assert.ok(got.every(id => catalog.hasField(id)));
});

test('the aviator blazer with the shirt beside it offers the shirt\'s badges too (the engine draws them on it, 4.2.5.1.3); with a turtleneck only the blazer\'s', () => {
  assert.deepEqual(offered('aviator_blazer', { underlayer: 'shirt' }), sorted(ALL));
  assert.deepEqual(offered('aviator_blazer', { underlayer: 'shell' }), sorted([...fam('chaplain'), ...CREST_SERVICE]));
  assert.deepEqual(offered('semi_formal', { underlayer: 'shirt' }), sorted([...fam('chaplain'), ...CREST_SERVICE]), 'the semi-formal has no shirt beside it');
  assert.match(read('js/engine/profiles-dress.js'), /companion: b => b\.opt\.underlayer === 'turtleneck' \|\| b\.opt\.underlayer === 'shell' \? null/);
});

test('the offered set never holds a badge the engine refuses for want of art on a field uniform (badgeSet: no field art, not shown)', () => {
  for(const u of ['abu', 'corporate_field', 'ocp', 'polo']) for(const id of offered(u)) assert.ok(catalog.art(id, 'field'), `${u} ${id}`);
});

// ---- the page --------------------------------------------------------------------------------------------------------

const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };

test('on the page: a badge selected on the Class B stays selected on the ABU, is not offered there, and is counted in one line with the paragraph', () => {
  ev("State.membership = 'senior'; State.rank = 'Capt'; State.gender = 'male'; State.garment = {}; State.uniform = 'blues_b'; State.badges = ['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8']");
  assert.equal(ev("isBadgeWornOnCurrentUniform('emergency_services_badge')"), true);
  assert.equal(ev('capubBadgesNotWornLine()'), '');
  ev("State.uniform = 'abu'");
  assert.equal(ev("isBadgeWornOnCurrentUniform('emergency_services_badge')"), false);
  assert.equal(ev("isBadgeWornOnCurrentUniform('CAPPilot1_FA9D33EA587D8')"), true);
  assert.deepEqual(ev('getSelectedBadgesNotWornOnCurrentUniform()'), ['emergency_services_badge']);
  assert.equal(ev('capubBadgesNotWornLine()'), '1 selected badge is not worn on this uniform (CAPR 39-1, 5.1.1.1.2.4, 5.1.1.1.2.5; genuine field artwork only).');
  assert.deepEqual(ev('State.badges'), ['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8'], 'still selected');
  ev("State.badges.push('communications_technician_badge')");
  assert.match(ev('capubBadgesNotWornLine()'), /^2 selected badges are not worn on this uniform/);
  ev("State.uniform = 'blues_b'");
  assert.equal(ev('capubBadgesNotWornLine()'), '');
});

test('the picker and the sidebar gallery list only the badges the uniform wears; the badge limit counts only those', () => {
  const wiring = read('js/wiring.js');
  assert.match(wiring, /getEligibleBadgeIdsForMembership\(State\.membership\)\.filter\(id => isBadgeWornOnCurrentUniform\(id\)\)/);
  assert.match(wiring, /note\.textContent = notWornLine \+ ' They stay selected for the uniforms that wear them\.'/);
  // The limit counts the badges worn as drawn, which are only ever ones the uniform wears (LIVE13 E77b, js/badge-rules.js countBadgesWornForLimit).
  assert.match(wiring, /badges: countBadgesWornForLimit\(\)/);
  assert.match(read('js/badge-rules.js'), /const selected = \[\.\.\.new Set\(ids \|\| \[\]\)\]\.filter\(id => !isCommandInsigniaBadge\(id\) && isBadgeWornOnCurrentUniform\(id\)\);/);
  assert.match(wiring, /function capubSyncBadgesNotWornNote\(\)\{/);
  assert.match(read('js/galleries.js'), /getEligibleBadgeIdsForMembership\(State\.membership\)\.filter\(id => isBadgeWornOnCurrentUniform\(id\)\)/);
});

test('in a real browser, an ES badge chosen on the Class B is hidden and not drawn on the ABU, and back on the Class B (needs Chrome)', { timeout: 240000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'uniform-badges-browser.cjs')], { encoding: 'utf8', timeout: 220000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
});
