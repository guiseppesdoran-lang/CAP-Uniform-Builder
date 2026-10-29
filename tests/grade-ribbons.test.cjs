'use strict';
// LIVE13 E66 (Ethan: "if someone selects a grade, it goes along with the ribbons required to get it. like for C/Lt Col, if selected,
// it selects all ach ribbons except spaatz and the encampment ribbon"). js/state.js CADET_GRADE_RIBBON_STEPS maps each cadet grade
// to the achievements and milestones that earn it (CAPR 60-1), js/setup.js capubApplyGradeRibbons adds and takes them off.
// tests/grade-ribbons-browser.cjs drives the Rank select in headless Chrome and checks the drawn rack.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const { context } = loadPageScripts();
// Values cross the vm boundary as JSON, so the arrays compare with this realm's.
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };

const PHASE_I = ['curry_achievement', 'hap_arnold_achievement', 'mary_feik_achievement'];
const NCO = ['rickenbacker_achievement', 'lindbergh_achievement', 'doolittle_achievement', 'goddard_achievement'];
const MITCHELL = ['armstrong_achievement', 'mitchell_award', 'encampment_ribbon'];
// Every cadet grade, with the ribbons it implies in the order they are earned.
const EXPECTED = {
  'C/AB': [],
  'C/Amn': PHASE_I.slice(0, 1),
  'C/A1C': PHASE_I.slice(0, 2),
  'C/SrA': PHASE_I,
  'C/SSgt': [...PHASE_I, 'wright_brothers_award'],
  'C/TSgt': [...PHASE_I, 'wright_brothers_award', ...NCO.slice(0, 1)],
  'C/MSgt': [...PHASE_I, 'wright_brothers_award', ...NCO.slice(0, 2)],
  'C/SMSgt': [...PHASE_I, 'wright_brothers_award', ...NCO.slice(0, 3)],
  'C/CMSgt': [...PHASE_I, 'wright_brothers_award', ...NCO],
  'C/2d Lt': [...PHASE_I, 'wright_brothers_award', ...NCO, ...MITCHELL],
  'C/1st Lt': [...PHASE_I, 'wright_brothers_award', ...NCO, ...MITCHELL],
  'C/Capt': [...PHASE_I, 'wright_brothers_award', ...NCO, ...MITCHELL, 'earhart_award'],
  'C/Maj': [...PHASE_I, 'wright_brothers_award', ...NCO, ...MITCHELL, 'earhart_award'],
  'C/Lt Col': [...PHASE_I, 'wright_brothers_award', ...NCO, ...MITCHELL, 'earhart_award', 'eaker_award'],
  'C/Col': [...PHASE_I, 'wright_brothers_award', ...NCO, ...MITCHELL, 'earhart_award', 'eaker_award', 'spaatz_award']
};

for(const [rank, ids] of Object.entries(EXPECTED)){
  test(`${rank} implies ${ids.length ? ids.length + ' ribbons' : 'no ribbon'} (CAPR 60-1)`, () => {
    assert.deepEqual(ev(`capubGradeImpliedRibbons(${JSON.stringify(rank)})`), ids);
  });
}

test('the table covers every cadet grade of the Rank select, and nothing else', () => {
  assert.deepEqual(ev('CADET_GRADE_RIBBON_STEPS.map(s => s[0])'), ev('RANKS.cadet'));
  assert.deepEqual(Object.keys(EXPECTED), ev('RANKS.cadet'));
});

test('C/Lt Col: every achievement ribbon except the Spaatz, and the Encampment Ribbon (Ethan\'s example)', () => {
  const ids = ev("capubGradeImpliedRibbons('C/Lt Col')");
  const achievements = ev('[...CADET_ACHIEVEMENT_RIBBONS]');
  assert.deepEqual(achievements.filter(id => !ids.includes(id)), ['spaatz_award']);
  assert.ok(ids.includes('encampment_ribbon'));
  assert.equal(ids.length, achievements.length - 1 + 1);
});

test('a senior grade, no grade and an unknown grade imply nothing: promotion is not tied to a ribbon', () => {
  for(const rank of ev('RANKS.senior')) assert.deepEqual(ev(`capubGradeImpliedRibbons(${JSON.stringify(rank)})`), [], rank);
  assert.deepEqual(ev('capubGradeImpliedRibbons(null)'), []);
  assert.deepEqual(ev("capubGradeImpliedRibbons('C/Bogus')"), []);
});

test('every implied ribbon is a cadet ribbon of the picker, in the precedence order the catalog and the importer use', () => {
  const all = ev('CADET_GRADE_RIBBON_IDS');
  for(const id of all){
    assert.ok(ev(`ribbonList.includes(${JSON.stringify(id)})`), `${id} in the ribbon list`);
    assert.ok(ev(`isRibbonEligibleForMembership(${JSON.stringify(id)}, 'cadet')`), `${id} for cadets`);
  }
  // The achievements in the order they are earned (js/catalog.js CADET_ACHIEVEMENT_RIBBONS lists them lowest first).
  assert.deepEqual(all.filter(id => id !== 'encampment_ribbon'), ev('[...CADET_ACHIEVEMENT_RIBBONS]'));
  // The importer reads the Wright Brothers Award after Achievement 3 and the Mitchell after Achievement 8.
  assert.match(read('js/member-report-import.js'), /\[\[\/Wright\\s\+Brothers\/i, 3\], \[\/\\bMitchell\\b\/i, 8\]/);
});

// The ribbon gallery's DOM and the drawing are not in the stub page; the rule's own work (State) is what is checked here.
ev('buildRibbonGallery = function(){}; renderRack = function(){}; renderAllBadges = function(){};');
function freshCadet(){
  ev(`State.membership = 'cadet'; State.rank = null; State.uniform = 'blues_a'; State.ribbonSelections = {}; State.ribbons = []; State.gradeRibbons = null;`);
}
const checked = () => ev("Object.keys(State.ribbonSelections).filter(id => State.ribbonSelections[id].checked)").sort();

test('choosing C/Lt Col adds its ribbons as earned and records them; dropping to C/SSgt takes off the ones above and keeps a hand-checked one', () => {
  freshCadet();
  // Checked by hand before any grade: the Mitchell Award, and a ribbon no grade implies.
  ev("setRibbonSelectionFromDropdown('mitchell_award', 'earned', { deferRender: true })");
  ev("setRibbonSelectionFromDropdown('community_service_ribbon', 'hours_60', { deferRender: true })");
  ev("State.rank = 'C/Lt Col'");
  const r = ev('capubApplyGradeRibbons({ announce: false })');
  assert.deepEqual(r.removed, []);
  assert.deepEqual(r.added, EXPECTED['C/Lt Col'].filter(id => id !== 'mitchell_award'), 'the hand-checked Mitchell is not added again');
  assert.deepEqual(checked(), [...EXPECTED['C/Lt Col'], 'community_service_ribbon'].sort());
  // Each is its select's first real choice: 'earned' for the achievements, the Basic Award (mcchord_19700) for the Encampment Ribbon.
  for(const id of r.added) assert.equal(ev(`State.ribbonSelections[${JSON.stringify(id)}].awardValue`), id === 'encampment_ribbon' ? 'mcchord_19700' : 'earned', id);
  assert.deepEqual(ev('State.gradeRibbons.ids'), r.added);
  assert.equal(ev('State.gradeRibbons.rank'), 'C/Lt Col');
  // The rack is built from them.
  const rack = ev('[...new Set(State.ribbons.map(x => x.id))]').sort();
  assert.deepEqual(rack, [...EXPECTED['C/Lt Col'], 'community_service_ribbon'].sort());

  // The member gives Lindbergh its honor credit by hand: it is his now.
  ev("setRibbonSelectionFromDropdown('lindbergh_achievement', 'honor_credit', { deferRender: true })");
  assert.ok(!ev("State.gradeRibbons.ids.includes('lindbergh_achievement')"));

  ev("State.rank = 'C/SSgt'");
  const down = ev('capubApplyGradeRibbons({ announce: false })');
  assert.deepEqual(down.added, []);
  const gone = EXPECTED['C/Lt Col'].filter(id => !EXPECTED['C/SSgt'].includes(id) && !['mitchell_award', 'lindbergh_achievement'].includes(id));
  assert.deepEqual(down.removed.slice().sort(), gone.slice().sort());
  assert.deepEqual(checked(), [...EXPECTED['C/SSgt'], 'mitchell_award', 'lindbergh_achievement', 'community_service_ribbon'].sort());
  assert.equal(ev("State.ribbonSelections.lindbergh_achievement.awardValue"), 'honor_credit');
  assert.deepEqual(ev('State.gradeRibbons.ids'), EXPECTED['C/SSgt']);
});

// LIVE14 E73 (Ethan: "when i selected c/lt col the achievement ribbons popped up as selected but not encampment").
test('every cadet grade selects each of its ribbons on a choice its award select has: the first real one, the basic award', () => {
  for(const rank of ev('RANKS.cadet')){
    freshCadet();
    ev(`State.rank = ${JSON.stringify(rank)}; capubApplyGradeRibbons({ announce: false })`);
    for(const id of EXPECTED[rank]){
      const sel = ev(`State.ribbonSelections[${JSON.stringify(id)}]`);
      const opts = ev(`getRibbonAwardOptions(${JSON.stringify(id)}).filter(o => o.value).map(o => ({ value: o.value, label: o.label }))`);
      assert.ok(sel.checked, `${rank} ${id} checked`);
      assert.ok(opts.some(o => o.value === sel.awardValue), `${rank} ${id}: '${sel.awardValue}' is one of the select's choices`);
      assert.equal(sel.awardValue, opts[0].value, `${rank} ${id}: the first real choice`);
      assert.equal(sel.awardLabel, opts[0].label, `${rank} ${id}: its label`);
      assert.match(sel.awardLabel, /^(Earned|Basic Award)$/, `${rank} ${id}: earned once`);
      assert.equal(ev(`CAPUBRibbonAwards.describe(${JSON.stringify(id)}, Object.assign({ membership: 'cadet' }, State.ribbonSelections[${JSON.stringify(id)}]))`), 'Basic ribbon, no devices', `${rank} ${id}: no devices`);
    }
    const rack = ev('[...new Set(State.ribbons.map(x => x.id))]').sort();
    assert.deepEqual(rack, EXPECTED[rank].slice().sort(), `${rank}: the rack`);
  }
  // The caller's value does not matter: the grade's pick is looked up.
  freshCadet();
  ev("setRibbonSelectionFromDropdown('encampment_ribbon', 'earned', { deferRender: true, byGrade: true })");
  assert.equal(ev('State.ribbonSelections.encampment_ribbon.awardValue'), 'mcchord_19700');
  assert.equal(ev('State.ribbonSelections.encampment_ribbon.awardLabel'), 'Basic Award');
});

test('an Encampment Ribbon saved as earned (before E73) loads on its Basic Award choice', () => {
  freshCadet();
  ev("State.ribbonSelections = { encampment_ribbon: { checked: true, devices: {}, awardValue: 'earned', awardLabel: 'Basic Award' } }; normalizeRibbonSelections();");
  assert.equal(ev('State.ribbonSelections.encampment_ribbon.awardValue'), 'mcchord_19700');
  assert.ok(ev('State.ribbonSelections.encampment_ribbon.checked'));
  // A ribbon whose select has an 'earned' choice keeps it.
  ev("State.ribbonSelections.curry_achievement = { checked: true, devices: {}, awardValue: 'earned', awardLabel: 'Earned' }; normalizeRibbonSelections();");
  assert.equal(ev('State.ribbonSelections.curry_achievement.awardValue'), 'earned');
});

test('a senior grade takes off what a cadet grade added and adds nothing', () => {
  freshCadet();
  ev("State.rank = 'C/Capt'; capubApplyGradeRibbons({ announce: false })");
  ev("State.membership = 'senior'; State.rank = 'Capt'");
  const r = ev('capubApplyGradeRibbons({ announce: false })');
  assert.deepEqual(r.added, []);
  assert.deepEqual(r.removed.slice().sort(), EXPECTED['C/Capt'].slice().sort());
  assert.deepEqual(checked(), []);
  assert.equal(ev('State.gradeRibbons'), null);
});

test('going up adds only the new steps; a ribbon unchecked by hand is not put back by the same grade, and the record keeps only what the grade added', () => {
  freshCadet();
  ev("State.rank = 'C/SrA'; capubApplyGradeRibbons({ announce: false })");
  ev("State.rank = 'C/MSgt'");
  const up = ev('capubApplyGradeRibbons({ announce: false })');
  assert.deepEqual(up.added, ['wright_brothers_award', 'rickenbacker_achievement', 'lindbergh_achievement']);
  assert.deepEqual(ev('State.gradeRibbons.ids'), EXPECTED['C/MSgt']);
  // Unchecked by hand: no longer the grade's.
  ev("setRibbonSelectionFromDropdown('curry_achievement', '', { deferRender: true })");
  assert.ok(!ev("State.gradeRibbons.ids.includes('curry_achievement')"));
});

test('the import\'s selections win: an import drops the grade\'s record, so a later grade change leaves what the report gave', () => {
  const setup = read('js/setup.js');
  assert.match(setup, /const wrapped = function\(\)\{\s*State\.gradeRibbons = null;\s*return original\.apply\(this, arguments\);/);
  assert.match(setup, /window\.applyCapMemberReportImport = wrapped;/);
  // The import sets State.rank itself, not through the Rank select, so it does not run the grade's rule.
  assert.doesNotMatch(read('js/member-report-import.js'), /capubApplyGradeRibbons|rankSetupSelect\.dispatchEvent/);
});

test('the Rank select and the Member type select run the rule; the toast names what was added', () => {
  const setup = read('js/setup.js');
  assert.match(setup, /rankSetupSelect\.addEventListener\('change', \(\)=>\{[\s\S]{0,260}capubApplyGradeRibbons\(\);/);
  assert.match(setup, /membershipTypeEl\.addEventListener\('change'[\s\S]*?capubApplyGradeRibbons\(\);[\s\S]*?\n\}\);/);
  assert.match(setup, /added the \$\{capubGradeRibbonNames\(added\)\}, earned on the way to this grade \(CAPR 60-1\)/);
  assert.match(setup, /A senior member\\'s grade adds no ribbons: promotion is not tied to one\./);
});

test('the record is saved with the setup and goes through the sanitizer: a cadet grade and the grade ribbons only', () => {
  const wiring = read('js/wiring.js');
  assert.match(read('js/state.js'), /gradeRibbons:null,/);
  assert.match(wiring, /gradeRibbons: State\.gradeRibbons \|\| null,/);
  assert.match(wiring, /State\.gradeRibbons = p\.gradeRibbons;/);
  assert.match(wiring, /out\.membership === 'cadet' && RANKS\.cadet\.includes\(gr\.rank\) && Array\.isArray\(gr\.ids\)/);
  assert.match(wiring, /CADET_GRADE_RIBBON_IDS\.includes\(id\)/);
});

test('in a real browser, C/Lt Col selects its ribbons and draws them, C/SSgt takes the higher ones off and keeps a hand-checked one (needs Chrome)', { timeout: 240000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'grade-ribbons-browser.cjs')], { encoding: 'utf8', timeout: 220000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
});
