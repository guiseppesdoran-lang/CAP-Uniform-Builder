'use strict';
// The member report and the supplements (js/supplements-import.js): the report's unit selects the supplements; a school or activity row shows a graduate cord was earned and
// a current "Cadet Commander" duty row the cadet commander cords of Maryland, Maine and North Carolina; earned cords are marked and listed first; the import chooses a cord by
// itself only when exactly one is earned, the Cadet Advisory Council cord has not been chosen and the cord is not one worn only at an activity; a cord no row of a report can
// show is offered and never marked. Reports here are the synthetic ones of tests/fixtures; no member's own data is in a test.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const CADET = fs.readFileSync(path.join(__dirname, 'fixtures', 'eservices-member-details-cadet-live12.txt'), 'utf8');
const SENIOR = fs.readFileSync(path.join(__dirname, 'fixtures', 'eservices-member-details-senior-live13.txt'), 'utf8');
const j = JSON.stringify;
const COUNCIL = 'Cadet WCAC Representative GLR-IL-001 WING No 01 Jun 2025\n';
const DEPUTY = 'Cadet Deputy Commander for Operations GLR-IL-049 UNIT No 01 Jan 2026';
const TRAINING = 'Cadet Training\nActivity Date Completed\n';
const UNITS = { ner: 'NER-NY-109', ne: 'NER-ME-001', nh: 'NER-NH-010', md: 'MAR-MD-003', nc: 'MAR-NC-001', mn: 'NCR-MN-001', fl: 'SER-FL-001', mo: 'NCR-MO-001', va: 'MAR-VA-001', none: 'GLR-IL-049' };

// A report of a cadet in `unit`. `council: false` takes out the Cadet Advisory Council row, whose cord the import already chooses; `duty` is the cadet's one current duty row
// and `training` rows for the school and activity table.
function report(unit, { council = true, duty = null, training = [], past = null } = {}) {
  let t = CADET.replace(/GLR-IL-049/g, unit);
  if (!council) t = t.replace(COUNCIL, '');
  if (duty) t = t.replace(DEPUTY.replace('GLR-IL-049', unit), duty);
  if (training.length) t = t.replace(TRAINING, TRAINING + training.join('\n') + '\n');
  if (past) t = t.replace('Cadet Flight Sergeant ' + unit + ' UNIT No 01 Jan 2021 31 Dec 2021', past);
  return t;
}

// The page, the report parsed and applied the way the Import button does (the galleries and the render need a real page, so they are stood in for).
function run(text, { before = '', senior = false } = {}) {
  const { context, referenceErrors } = loadPageScripts();
  assert.deepEqual(referenceErrors, []);
  if (before) vm.runInContext(before, context);
  const out = vm.runInContext(`(function(text){
    for(const n of ['buildRibbonGallery','rebuildRibbonsFromGallery','buildBadgeGallery','rebuildBadgesFromGallery','fullRender','refreshUI','populateRankSetup','updateSetupGates','highlightActiveUniformButton',
      'applyMemberTypeToUniformOptions','syncCadetFirstSergeantControl','renderCACShoulderCord','syncShoulderCordControl','clearUnauthorizedPatchesForCurrentUniform','buildPatchGallery','renderPatches']) globalThis[n] = function(){};
    const realDocument = globalThis.document, fields = {};
    globalThis.document = new Proxy({}, { get: (_t, key) => key === 'getElementById'
      ? id => /^capubV2(FirstName|LastName|ShowText)$/.test(id) ? (fields[id] = fields[id] || {}) : realDocument.getElementById(id) : realDocument[key] });
    const parsed = parseCapMemberReport(text);
    applyCapMemberReportImport(parsed);
    globalThis.document = realDocument;
    return JSON.stringify({ parsed: { unit: parsed.unitPatchCharter || null, earned: parsed.supplementCordsEarned, notes: parsed.notes, cord: parsed.shoulderCord || null, membership: parsed.membership },
      state: { unit: State.unitPatchCharter, cord: State.shoulderCord, earned: State.supplementCordsEarned, membership: State.membership },
      cords: Supplements.cords(State).map(c => [c.id, c.earned]) });
  })`, context)(text);
  const data = JSON.parse(out);
  data.context = context;
  data.earnedOf = () => data.cords.filter(([, e]) => e).map(([id]) => id);
  return data;
}
const earned = (text, opts) => run(text, opts).parsed.earned;

test('the report tie-in is loaded after the patch code and the report importer that it wraps', () => {
  const tags = [...fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').matchAll(/<script src="([^"?]+)[^"]*" defer><\/script>/g)].map(m => m[1]);
  assert.ok(tags.indexOf('js/supplements-import.js') > tags.indexOf('js/patches.js') && tags.indexOf('js/supplements-import.js') > tags.indexOf('js/member-report-import.js'));
  const { context } = loadPageScripts();
  assert.equal(vm.runInContext('typeof CAPUBSupplementsImport.earnedCords', context), 'function');
});

test('the units the tests use are units of the list', () => {
  const { context } = loadPageScripts();
  for(const code of Object.values(UNITS)) assert.ok(vm.runInContext(`CAP_UNIT_OPTIONS.some(u => u.code === ${j(code)})`, context), code);
});
const supplementNotes = r => r.parsed.notes.filter(n => /^(Supplements|Shoulder cords)/.test(n));

test('the report\'s unit selects the supplements: the Unit column of the General Information row, in any letter case', () => {
  const r = run(report(UNITS.ner, { council: false }));
  assert.equal(r.parsed.unit, UNITS.ner);
  assert.equal(r.state.unit, UNITS.ner);
  assert.deepEqual(r.cords.map(c => c[0]), ['ner-rcls', 'ner-ncols']);
  const spoken = code => vm.runInContext(`getUnitPatchSpokenName(${j(code)})`, r.context);
  assert.ok(supplementNotes(r).includes(`Supplements: ${spoken(UNITS.ner)} brings in Northeast Region Supplement 1.`));
  // In lower case, and a Maine unit brings the wing's supplement with the region's.
  const lower = run(report(UNITS.ne, { council: false }).replace(UNITS.ne, UNITS.ne.toLowerCase()));
  assert.equal(lower.state.unit, UNITS.ne);
  assert.match(supplementNotes(lower)[0], /brings in Northeast Region Supplement 1 and Maine Wing Supplement 1\.$/);
  assert.equal(lower.cords.length, 10);
  // A unit with no supplement, a unit that is not in the list, a senior member: nothing is loaded, nothing is marked.
  const none = run(report(UNITS.none, { council: false }));
  assert.deepEqual(none.cords, []);
  assert.deepEqual(none.parsed.earned, []);
  assert.deepEqual(supplementNotes(none), []);
  const unknown = run(report('XXX-YY-123', { council: false }));
  assert.equal(unknown.state.unit, '');
  assert.deepEqual(unknown.cords, []);
  const senior = run(SENIOR);
  assert.deepEqual(senior.parsed.earned, []);
  assert.deepEqual(senior.cords, []);
});

test('a school row shows a graduate cord was earned: it is marked, listed first, and chosen when it is the only one and no council cord is', () => {
  const rows = ['Region Cadet Leadership School 15 Jun 2024'];
  const r = run(report(UNITS.ner, { council: false, training: rows }));
  assert.deepEqual(r.parsed.earned, ['ner-rcls']);
  assert.deepEqual(r.state.earned, ['ner-rcls']);
  assert.deepEqual(r.cords, [['ner-rcls', true], ['ner-ncols', false]]);
  assert.equal(r.state.cord, 'ner-rcls');
  assert.ok(supplementNotes(r).includes('Shoulder cords: the report shows Region Cadet Leadership School (Northeast Region). Marked as found in your report in the cord list.'));
  assert.ok(supplementNotes(r).includes('Shoulder cords: the Region Cadet Leadership School cord (Northeast Region) is chosen, the only supplement cord the report shows.'));
  // The other: an accredited Noncommissioned Officer Leadership School, in whichever words the report has it.
  for(const row of ['Noncommissioned Officer Leadership School 02 Mar 2023', 'Non-Commissioned Officer Leadership School (NCOLS) 02 Mar 2023', 'NCOLS 02 Mar 2023']){
    const n = run(report(UNITS.ner, { council: false, training: [row] }));
    assert.deepEqual(n.cords, [['ner-ncols', true], ['ner-rcls', false]], row);
    assert.equal(n.state.cord, 'ner-ncols', row);
  }
  // A report that names the school only in a duty row, or a school that is not completed (no date), shows nothing.
  assert.deepEqual(earned(report(UNITS.ner, { council: false, training: ['Region Cadet Leadership School'] })), []);
  assert.deepEqual(earned(report(UNITS.ner, { council: false })), []);
  // A senior member's report earns no cadet cord.
  assert.deepEqual(earned(SENIOR.replace(/GLR-IL-049/g, UNITS.ner).replace('Mission Scanner (MS)', 'Region Cadet Leadership School 15 Jun 2024\nMission Scanner (MS)')), []);
});

test('the import chooses a cord by itself only when exactly one is earned and the council cord has not been chosen', () => {
  const row = 'Region Cadet Leadership School 15 Jun 2024';
  // The Cadet Advisory Council row already gave the member its wing cord: the supplement cord is marked and not chosen.
  const withCouncil = run(report(UNITS.ner, { training: [row] }));
  assert.equal(withCouncil.parsed.cord, 'wing');
  assert.equal(withCouncil.state.cord, 'wing');
  assert.deepEqual(withCouncil.cords[0], ['ner-rcls', true]);
  assert.ok(supplementNotes(withCouncil).some(n => /^Shoulder cords: the Cadet Advisory Council cord from the report is chosen, so the Region Cadet Leadership School cord is marked and not chosen\.$/.test(n)));
  // Two earned: both marked, listed first, none chosen, and the notes say so.
  const two = run(report(UNITS.ner, { council: false, training: [row, 'NCOLS 02 Mar 2023'] }));
  assert.deepEqual(two.earnedOf().sort(), ['ner-ncols', 'ner-rcls']);
  assert.deepEqual(two.cords.map(c => c[1]), [true, true]);
  assert.equal(two.state.cord, null);
  assert.ok(supplementNotes(two).includes('Shoulder cords: more than one supplement cord is shown, so none is chosen for you. Choose one under Shoulder cord.'));
  // None earned: nothing is chosen.
  assert.equal(run(report(UNITS.ner, { council: false })).state.cord, null);
});

test('the New Hampshire cord needs the New Hampshire school; a school of another wing earns the Northeast cord alone', () => {
  const generic = run(report(UNITS.nh, { council: false, training: ['Noncommissioned Officer Leadership School 02 Mar 2023'] }));
  assert.deepEqual(generic.earnedOf(), ['ner-ncols']);
  assert.equal(generic.state.cord, 'ner-ncols');
  const own = run(report(UNITS.nh, { council: false, training: ['New Hampshire Wing NCOLS 02 Mar 2023'] }));
  assert.deepEqual(own.earnedOf().sort(), ['ner-ncols', 'nh-ncols']);
  assert.equal(own.state.cord, null, 'two are earned');
});

test('a current "Cadet Commander" duty row earns the cadet commander cord of Maryland, Maine or North Carolina', () => {
  for(const [unit, wing, id, group] of [[UNITS.md, 'MD', 'md-cadet-commander', 'Maryland Wing'], [UNITS.ne, 'ME', 'me-cadet-commander', 'Maine Wing'], [UNITS.nc, 'NC', 'nc-cadet-commander', 'North Carolina Wing']]){
    const r = run(report(unit, { council: false, duty: `Cadet Commander ${unit} UNIT No 01 Jan 2026` }));
    assert.deepEqual(r.parsed.earned, [id], wing);
    assert.deepEqual(r.cords[0], [id, true], wing);
    assert.equal(r.state.cord, id, `${wing}: the only cord earned is chosen`);
    assert.ok(supplementNotes(r).some(n => n.includes(group) && /chosen/.test(n)), wing);
  }
  // An End Date still to come is a current duty, as the commander rows are read.
  assert.deepEqual(earned(report(UNITS.md, { council: false, duty: `Cadet Commander ${UNITS.md} UNIT No 01 Jan 2026 31 Dec 2099` })), ['md-cadet-commander']);
  // Not the commander: an assistant (Asst Yes), a flight, encampment or acting commander, another title, a duty that has ended, a past duty.
  const md = UNITS.md;
  for(const duty of [`Cadet Commander ${md} UNIT Yes 01 Jan 2026`, `Cadet Flight Commander ${md} UNIT No 01 Jan 2026`, `Encampment Cadet Commander ${md} UNIT No 01 Jan 2026`,
    `Acting Cadet Commander ${md} UNIT No 01 Jan 2026`, `Cadet Deputy Commander ${md} UNIT No 01 Jan 2026`, `Flight Commander ${md} UNIT No 01 Jan 2026`,
    `Cadet Commander ${md} UNIT No 04 Feb 2024 20 Nov 2024`]){
    assert.deepEqual(earned(report(md, { council: false, duty })), [], duty);
  }
  assert.deepEqual(earned(report(md, { council: false, past: `Cadet Commander ${md} UNIT No 04 Feb 2024 25 Nov 2025` })), [], 'a past duty');
  // A commander of a unit of another wing does not earn this wing's cord.
  assert.deepEqual(earned(report(UNITS.ne, { council: false, duty: `Cadet Commander ${UNITS.md} UNIT No 01 Jan 2026` })), []);
  // And a unit with no cadet commander cord earns none.
  assert.deepEqual(earned(report(UNITS.ner, { council: false, duty: `Cadet Commander ${UNITS.ner} UNIT No 01 Jan 2026` })), []);
});

test('a cord no row of a report can show is offered and never marked: the awards of the month, the quarter and the year, grade point averages, competitions', () => {
  const r = run(report(UNITS.ne, { council: false, duty: `Cadet Commander ${UNITS.ne} UNIT No 01 Jan 2026`, training: ['Squadron Cadet of the Month 01 Jan 2026', 'Cadet Honor Society 01 Feb 2026'] }));
  assert.deepEqual(r.earnedOf(), ['me-cadet-commander']);
  assert.equal(r.cords.length, 10);
  assert.ok(r.cords.slice(1).every(c => c[1] === false), 'the others are offered, not marked');
  assert.ok(supplementNotes(r).includes('Shoulder cords: the other cords of these supplements depend on awards, offices or grades that a report does not list, so they are offered without a mark.'));
  // The data says which cords a report can show.
  const how = vm.runInContext('CAPUBSupplementData.SUPPLEMENTS.flatMap(e => e.items.filter(i => i.kind === "cord").map(i => i.earned.source))', r.context);
  assert.equal(how.filter(s => s === 'none').length, 48);
});

test('a Florida cadet earns the Leadership Academy cord only by all three academies', () => {
  const academies = ['Florida Wing NCO Leadership Academy 10 Jun 2023', 'Florida Wing SNCO Leadership Academy 10 Jun 2024', 'Florida Wing CCC Leadership Academy 10 Jun 2025'];
  assert.deepEqual(earned(report(UNITS.fl, { council: false, training: academies })), ['fl-leadership-academy']);
  assert.deepEqual(earned(report(UNITS.fl, { council: false, training: academies.slice(0, 2) })), []);
  assert.deepEqual(earned(report(UNITS.fl, { council: false, training: [academies[0], academies[0], academies[1]] })), []);
  assert.deepEqual(earned(report(UNITS.mo, { council: false, training: ['Missouri Wing Pathfinders Technical School 05 Jul 2024'] })), ['mo-pathfinders']);
  assert.deepEqual(earned(report(UNITS.mo, { council: false, training: ['Medical Orientation Training School 05 Jul 2024'] })), ['mo-medical-orientation']);
  assert.deepEqual(earned(report(UNITS.va, { council: false, training: ['Virginia Wing Honor Guard College 05 Jul 2024'] })), ['va-honor-guard-college']);
});

test('the import never chooses a cord worn only at an activity: it is marked, and the note says why it is not chosen', () => {
  const text = report(UNITS.mn, { council: false, training: ['Encampment Executive Staff 10 Jul 2025'] });
  // The data holds no way to read an encampment cord from a report; here one is given, the way a later reading would, to see the rule hold.
  const before = `(function(){ const item = CAPUBSupplementData.WINGS.MN.items.find(i => i.id === 'mn-encampment-executive-staff'); item.earned = { source: 'activity', rowAllOf: [['Encampment\\\\s+Executive\\\\s+Staff']] }; })()`;
  const r = run(text, { before });
  assert.deepEqual(r.parsed.earned, ['mn-encampment-executive-staff']);
  assert.deepEqual(r.cords[0], ['mn-encampment-executive-staff', true]);
  assert.equal(r.state.cord, null);
  assert.ok(supplementNotes(r).includes('Shoulder cords: the Encampment Executive Staff cord is worn only at its activity, so it is marked and not chosen.'));
  // Without the rule a cord limited to an activity would be chosen: the same row on a cord that is not limited is.
  const free = run(text, { before: before.replace('item.earned =', 'item.limitedToActivity = false; item.earned =') });
  assert.equal(free.state.cord, 'mn-encampment-executive-staff');
});

test('the marks last as long as the report\'s own list: Undo and "Clear import notes" take them away', () => {
  const r = run(report(UNITS.ner, { council: false, training: ['Region Cadet Leadership School 15 Jun 2024'] }));
  assert.deepEqual(r.earnedOf(), ['ner-rcls']);
  const after = state => JSON.parse(vm.runInContext(`(function(){ ${state}; return JSON.stringify(Supplements.cords(State).filter(c => c.earned).map(c => c.id)); })()`, r.context));
  assert.deepEqual(after('State.reportAuthorizedBadgeIds = null'), []);
  assert.deepEqual(after('State.reportAuthorizedBadgeIds = []'), ['ner-rcls']);
});

test('a new import replaces the marks of the one before it, and a report with no unit leaves none', () => {
  const r = run(report(UNITS.ner, { council: false, training: ['Region Cadet Leadership School 15 Jun 2024'] }));
  const again = vm.runInContext(`(function(text){ const parsed = parseCapMemberReport(text); applyCapMemberReportImport(parsed); return JSON.stringify([State.supplementCordsEarned, State.unitPatchCharter, State.shoulderCord]); })`, r.context)(report('XXX-YY-123', { council: false }));
  assert.deepEqual(JSON.parse(again), [[], '', null]);
});

test('the import\'s notes say what it did, in plain words: no cord id, no abbreviation to decode', () => {
  const r = run(report(UNITS.md, { council: false, duty: `Cadet Commander ${UNITS.md} UNIT No 01 Jan 2026` }));
  const notes = supplementNotes(r);
  assert.equal(notes.length, 4);
  for(const n of notes){
    assert.doesNotMatch(n, /\b[a-z]{2,3}(?:-[a-z]+)+\b/, n);
    assert.doesNotMatch(n, /\b(?:RCLS|NCOLS|MAR|NER|CAC)\b/, n);
  }
});
