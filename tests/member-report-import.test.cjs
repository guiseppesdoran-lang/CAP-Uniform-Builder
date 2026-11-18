'use strict';
// The member report importer, end to end on a report in the shape of the eServices "Printer Friendly View - Member
// Details" page (tests/fixtures/eservices-member-details-cadet.txt, the Awards/Decorations rows from C/Col Doran's
// screenshot): the text is parsed, applied to the setup the way the Import button does, and the devices the engine
// draws are read back from the selections it leaves.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const RA = require('../data/ribbon-awards.js');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'eservices-member-details-cadet.txt'), 'utf8');
const short = d => d.replace(/^device-/, '');

// Parse a report and apply it. The gallery and render calls need a real page, so they are stubbed out; what is
// asserted is the parsed list and the selections the import leaves in State.
// `before` runs in the page first, to stand for the setup a previous member left (a rank, a uniform).
function runImport(text, before=''){
  const { context, referenceErrors } = loadPageScripts();
  assert.deepEqual(referenceErrors, []);
  if(before) vm.runInContext(before, context);
  const out = vm.runInContext(`(function(text){
    for(const n of ['buildRibbonGallery','rebuildRibbonsFromGallery','buildBadgeGallery','rebuildBadgesFromGallery','fullRender','refreshUI',
      'populateRankSetup','updateSetupGates','highlightActiveUniformButton','applyMemberTypeToUniformOptions','syncCadetFirstSergeantControl',
      'renderCACShoulderCord','syncShoulderCordControl','clearUnauthorizedPatchesForCurrentUniform']) globalThis[n] = function(){};
    // The setup's name fields, recorded so the test can read what the import wrote into them.
    const realDocument = globalThis.document, fields = globalThis.__nameFields = {};
    globalThis.document = new Proxy({}, { get: (_t, key) => key === 'getElementById'
      ? id => /^capubV2(FirstName|LastName|ShowText)$/.test(id) ? (fields[id] = fields[id] || {}) : realDocument.getElementById(id)
      : realDocument[key] });
    const parsed = parseCapMemberReport(text);
    applyCapMemberReportImport(parsed);
    const selected = {};
    for(const [id, s] of Object.entries(State.ribbonSelections)) if(s.checked) selected[id] = { awardValue: s.awardValue, awardLabel: s.awardLabel };
    globalThis.document = realDocument;
    return JSON.stringify({ parsed, selected, badges: State.badges, badgeChoices: State.badgeChoices, commandInsignia: State.commandInsignia, membership: State.membership, rank: State.rank, uniform: State.uniform, adultCadet: State.adultCadet, text: State.text, fields });
  })`, context)(text);
  const data = JSON.parse(out);
  const devices = id => RA.resolve(id, { ...data.selected[id], membership: data.membership }).map(r => ({ devices: r.devices.map(short), centered: r.centered }));
  const ribbon = id => data.parsed.ribbons.find(r => r.id === id);
  return { ...data, devices, ribbon };
}

test('the Doran report imports without throwing and reads the profile', () => {
  const r = runImport(FIXTURE);
  assert.equal(r.parsed.membership, 'cadet');
  assert.equal(r.parsed.gender, 'male');
  assert.equal(r.parsed.rank, 'C/Col');
  assert.equal(r.membership, 'cadet');
  assert.equal(r.rank, 'C/Col');
});

test('four Achievement Award lines are the 4th award: three bronze clasps; two Community Service Ribbons are 120 hours, one clasp', () => {
  const r = runImport(FIXTURE);
  assert.ok(r.ribbon('cap_achievment_award'));
  assert.deepEqual(r.devices('cap_achievment_award'), [{ devices: ['clasp-bronze', 'clasp-bronze', 'clasp-bronze'], centered: false }]);
  assert.match(r.selected.cap_achievment_award.awardLabel, /4th Award/);
  assert.deepEqual(r.devices('community_service_ribbon'), [{ devices: ['clasp-bronze'], centered: false }]);
  assert.match(r.selected.community_service_ribbon.awardLabel, /120 Hours/);
});

test("Commander's Commendation Award (Region) is the commander commendation ribbon with the region bronze star", () => {
  const r = runImport(FIXTURE);
  assert.equal(r.ribbon('commander_commendation_award').value, 'region_bronze_star');
  assert.deepEqual(r.devices('commander_commendation_award'), [{ devices: ['star-bronze'], centered: false }]);
  // A curly apostrophe (a PDF export) and National level.
  const curly = runImport(FIXTURE.replace("Commander's Commendation Award (Region)", 'Commander’s Commendation Award (National)'));
  assert.equal(curly.ribbon('commander_commendation_award').value, 'national_silver_star');
  assert.deepEqual(curly.devices('commander_commendation_award'), [{ devices: ['star-silver'], centered: false }]);
});

// ICL 21-03, para 2: one Crisis Service Ribbon for each service period, the later periods the bronze triangle clasp. The level is only what the report's rows carry.
test('Crisis Service Award is the Crisis Service Ribbon: a row is the first period, each further row of another date is a bronze clasp', () => {
  const r = runImport(FIXTURE);
  assert.equal(r.ribbon('crisis_ribbon').value, 'earned');
  assert.deepEqual(r.devices('crisis_ribbon'), [{ devices: [], centered: false }]);
  const twice = runImport(FIXTURE.replace('Crisis Service Award 15 Dec 2023', 'Crisis Service Award 15 Dec 2023\nCrisis Service Award 15 Dec 2024'));
  assert.equal(twice.ribbon('crisis_ribbon').value, 'bronze_clasp_1');
  assert.deepEqual(twice.devices('crisis_ribbon'), [{ devices: ['clasp-bronze'], centered: false }]);
  const thrice = runImport(FIXTURE.replace('Crisis Service Award 15 Dec 2023', 'Crisis Service Award 15 Dec 2023\nCrisis Service Award 15 Dec 2024\nCrisis Service Award 15 Dec 2025'));
  assert.equal(thrice.ribbon('crisis_ribbon').value, 'bronze_clasp_2');
  assert.deepEqual(thrice.devices('crisis_ribbon'), [{ devices: ['clasp-bronze', 'clasp-bronze'], centered: false }]);
  // No row, no ribbon.
  const none = runImport(FIXTURE.replace('Crisis Service Award 15 Dec 2023\n', ''));
  assert.equal(none.ribbon('crisis_ribbon'), undefined);
});

// CAPR 39-3 9h and Attachment 2: the Certificate of Recognition for Lifesaving carries the Lifesaving Award ribbon, so the
// row is not skipped; a save other than a blood or organ transport adds a silver star, which the row does not say.
test('Certificate of Recognition for Lifesaving imports the Lifesaving Award ribbon, with a note about the star (CAPR 39-3 9h)', () => {
  const r = runImport(FIXTURE);
  assert.equal(r.ribbon('lifesaving_award').value, 'earned');
  assert.ok(r.selected.lifesaving_award, 'the ribbon is selected on the rack');
  assert.deepEqual(r.devices('lifesaving_award'), [{ devices: [], centered: false }]);
  assert.ok(r.parsed.notes.some(n => /Lifesaving/.test(n) && /silver star/.test(n)), 'the import names the certificate and the star left to the member');
  const two = runImport(FIXTURE.replace('Crisis Service Award 15 Dec 2023', 'Certificate of Recognition for Lifesaving 15 Dec 2023\nCrisis Service Award 15 Dec 2023'));
  assert.equal(two.ribbon('lifesaving_award').value, 'bronze_clasp_1');
  assert.deepEqual(two.devices('lifesaving_award'), [{ devices: ['clasp-bronze'], centered: false }]);
  // No lifesaving row, no ribbon.
  const none = runImport(FIXTURE.replace('Certificate of Recognition for Lifesaving 12 Mar 2024\n', ''));
  assert.equal(none.ribbon('lifesaving_award'), undefined);
});

test('the Cadet Advisory Council Ribbon row imports the basic ribbon (the row names no level)', () => {
  const r = runImport(FIXTURE);
  assert.ok(r.ribbon('cadet_advisory_council_ribbon'));
  assert.ok(r.selected.cadet_advisory_council_ribbon);
  assert.deepEqual(r.devices('cadet_advisory_council_ribbon'), [{ devices: [], centered: false }]);
  assert.ok(!r.parsed.notes.some(n => /^CAC text found, but/.test(n)), 'no stale "not imported" note');
  const none = runImport(FIXTURE.replace('Cadet Advisory Council Ribbon 20 Mar 2024\n', ''));
  assert.equal(none.ribbon('cadet_advisory_council_ribbon'), undefined);
});

test('the achievements, the Mitchell COS star, encampments and NCSA activities still import', () => {
  const r = runImport(FIXTURE);
  for(const id of ['curry_achievement', 'hap_arnold_achievement', 'mary_feik_achievement', 'rickenbacker_achievement', 'lindbergh_achievement',
    'doolittle_achievement', 'goddard_achievement', 'armstrong_achievement', 'wright_brothers_award', 'mitchell_award', 'earhart_award']){
    assert.ok(r.ribbon(id), `${id} imports`);
  }
  assert.equal(r.ribbon('spaatz_award'), undefined, 'a Spaatz Award Presentation in Local Activities is not the award');
  assert.deepEqual(r.devices('mitchell_award'), [{ devices: ['star-silver'], centered: false }], 'COS graduate star on the Mitchell');
  assert.deepEqual(r.devices('encampment_ribbon'), [{ devices: ['clasp-bronze', 'clasp-bronze'], centered: false }], 'three encampments');
  assert.deepEqual(r.devices('cadet_special_activity_ribbon'), [{ devices: ['star-bronze', 'star-bronze'], centered: false }], 'COS, PJOC and a cyber NCSA: three activities');
  assert.ok(r.ribbon('red_service_ribbon'), 'joined 24 Sep 2019: the red service ribbon');
});

test('Achievement Award rows without a date still count one each', () => {
  const dateless = FIXTURE.replace(/Achievement Award (01 Feb 2022|05 Jun 2022)/g, 'Achievement Award');
  assert.equal(runImport(dateless).ribbon('cap_achievment_award').reason, '4 Achievement Award record(s)');
});

test('the full import result list', t => {
  const r = runImport(FIXTURE);
  const list = Object.entries(r.selected).map(([id, s]) => `${id}: ${s.awardLabel} [${r.devices(id).map(p => (p.centered ? '@' : '') + p.devices.join('+')).join(' | ')}]`);
  t.diagnostic(list.join('\n'));
  assert.ok(list.length >= 20);
});

// Every value the importer can hand the ribbon picker must land on a real option of that ribbon, with the award
// count and modifiers it stands for. A value that matched no option used to fall back to the basic ribbon and drop
// its devices (LIVE12 E42: four Commander's Commendation Awards showed as a bare ribbon).
function importValueResolutions(entries){
  const { context, referenceErrors } = loadPageScripts();
  assert.deepEqual(referenceErrors, []);
  return JSON.parse(vm.runInContext(`(function(entries){
    return JSON.stringify(entries.map(e => {
      const value = (0, eval)(e.expr);
      const option = findImportedRibbonOption(e.id, value);
      const values = getRibbonAwardOptions(e.id).filter(o => o && o.value).map(o => o.value);
      return { ...e, value, optionValue: option && option.value, optionLabel: option && option.label, real: !!option && values.includes(option.value) };
    }));
  })`, context)(entries));
}

function assertResolvesToCount(row, count, modifiers=[]){
  const where = `${row.id} ${row.expr} -> ${row.value} -> ${row.optionValue} "${row.optionLabel}"`;
  assert.ok(row.real, `${where}: not an option of the ribbon`);
  assert.equal(RA.readCount(row.id, row.optionValue, row.optionLabel), count, `${where}: award count`);
  const devices = RA.resolve(row.id, { awardValue: row.optionValue, awardLabel: row.optionLabel, membership: 'cadet' }).flatMap(p => p.devices.map(short));
  for(const [device, present] of modifiers) assert.equal(devices.includes(device), present, `${where}: ${device} ${present ? 'missing' : 'unexpected'} (${devices.join('+')})`);
  return devices;
}

test('every count-based value the importer returns resolves to a real option with that award count (E42)', () => {
  const entries = [];
  for(let n = 1; n <= 9; n++){
    for(const level of ['wing', 'region', 'national', 'national_region']){
      if(level === 'national_region' && n < 2) continue;
      entries.push({ id: 'commander_commendation_award', expr: `chooseCommandersCommendationValue('${level}', ${n})`, n, level });
    }
    for(const id of ['cap_achievment_award', 'exceptional_service_award', 'meritorious_service_award'])
      entries.push({ id, expr: `chooseSpecialRibbonValueByAwardCount('${id}', ${n})`, n });
    entries.push({ id: 'lifesaving_award', expr: `chooseLifesavingValue(${n})`, n });
    entries.push({ id: 'encampment_ribbon', expr: `chooseEncampmentValue(${n})`, n });
    entries.push({ id: 'community_service_ribbon', expr: `chooseCommunityServiceValue(${n})`, n });
    entries.push({ id: 'search_find_ribbon', expr: `'find_${n}'`, n });
  }
  for(const row of importValueResolutions(entries)){
    const mods = row.id === 'commander_commendation_award'
      ? [['star-bronze', /region/.test(row.level)], ['star-silver', /national/.test(row.level)]]
      : [];
    const devices = assertResolvesToCount(row, row.n, mods);
    if(row.id === 'commander_commendation_award' && row.n === 4 && row.level === 'wing'){
      assert.deepEqual(devices, ['clasp-bronze', 'clasp-bronze', 'clasp-bronze'], 'four wing awards: three bronze clasps');
    }
    if(row.id === 'commander_commendation_award' && row.n === 7 && row.level === 'wing'){
      assert.deepEqual(devices, ['clasp-silver', 'clasp-bronze'], 'seven awards: a silver clasp for five, one bronze');
    }
  }
});

test('the level-named values the importer returns land on their own option, not the basic ribbon (E42)', () => {
  const rows = importValueResolutions([
    ...[2, 5, 10, 15, 20, 25].map(y => ({ id: 'red_service_ribbon', expr: `chooseRedServiceValueFromYears(${y})`, want: new RegExp(`^${y} Years$`) })),
    ...[['UNIT', /^Squadron\/CC$/], ['GROUP', /^Group\/CC$/], ['WING', /^Wing\/CC$/], ['REGION', /^Region\/CC$/], ['NATIONAL', /^National\/CC$/]]
      .map(([e, want]) => ({ id: 'cap_command_service_ribbon', expr: `getCommandServiceRibbonValueForCommanderEchelon('${e}')`, want: want.source })),
    { id: 'mitchell_award', expr: `'earned_cos_star'`, want: '^Earned \\+ COS graduate$' }
  ]);
  for(const row of rows){
    assert.ok(row.real, `${row.id} ${row.value}: not an option`);
    assert.match(row.optionLabel, new RegExp(row.want.source || row.want), `${row.id} ${row.value} -> "${row.optionLabel}"`);
  }
});

test("four Commander's Commendation Award rows are the 4th award, three bronze clasps, however the row is printed (E42)", () => {
  const without = FIXTURE.replace("Commander's Commendation Award (Region) 04 Oct 2024\n", '');
  const four = rows => without.replace('Achievement Award 01 Feb 2022', rows.join('\n') + '\nAchievement Award 01 Feb 2022');
  const dates = ['04 Oct 2021', '04 Oct 2022', '04 Oct 2023', '04 Oct 2024'];
  for(const label of ["Commander's Commendation Award (Wing)", "Commander's Commendation Award", 'Commander’s Commendation Award',
    'Commanders Commendation Award', "Commanders' Commendation Award (Wing)", 'Commander`s Commendation Award - Wing', "COMMANDER'S COMMENDATION AWARD (WING)"]){
    const r = runImport(four(dates.map(d => `${label} ${d}`)));
    assert.equal(r.ribbon('commander_commendation_award')?.value, 'wing_bronze_clasp_3', label);
    assert.match(r.selected.commander_commendation_award.awardLabel, /^4th Award$/, label);
    assert.deepEqual(r.devices('commander_commendation_award'), [{ devices: ['clasp-bronze', 'clasp-bronze', 'clasp-bronze'], centered: false }], label);
  }
  // Mixed levels: all four rows are awards of the one ribbon; the region award adds its bronze star.
  const mixed = runImport(four(["Commander's Commendation Award (Wing) 04 Oct 2021", "Commander's Commendation Award (Wing) 04 Oct 2022",
    "Commander's Commendation Award (Region) 04 Oct 2023", "Commander's Commendation Award (Wing) 04 Oct 2024"]));
  assert.equal(mixed.selected.commander_commendation_award.awardLabel, '4th Award (Region Cmdr)');
  assert.deepEqual(mixed.devices('commander_commendation_award'), [{ devices: ['star-bronze', 'clasp-bronze', 'clasp-bronze', 'clasp-bronze'], centered: false }]);
  const both = runImport(four(["Commander's Commendation Award (National) 04 Oct 2023", "Commander's Commendation Award (Region) 04 Oct 2024"]));
  assert.equal(both.selected.commander_commendation_award.awardLabel, '2nd Award (Region+Natl)');
  assert.deepEqual(both.devices('commander_commendation_award'), [{ devices: ['star-silver', 'star-bronze', 'clasp-bronze'], centered: false }]);
});

// CAPR 39-3 21g: the silver V marks a Presidentially declared disaster; one V, the clasps for later awards beside it.
test('a Disaster Relief Ribbon row that says V carries the V, in any wording, with the clasps for the other rows (E45)', () => {
  const withRows = rows => FIXTURE.replace('Community Service Ribbon 10 Jan 2022', rows.join('\n') + '\nCommunity Service Ribbon 10 Jan 2022');
  const plain = runImport(withRows(['Disaster Relief Ribbon 10 Jan 2023', 'Disaster Relief Ribbon 10 Jan 2024']));
  assert.equal(plain.selected.disaster_relief_ribbon.awardLabel, '2nd Award');
  assert.deepEqual(plain.devices('disaster_relief_ribbon'), [{ devices: ['clasp-bronze'], centered: false }]);
  for(const v of ['Disaster Relief Ribbon with V', 'Disaster Relief Ribbon w/V', 'Disaster Relief Ribbon V Device', 'Disaster Relief Ribbon V-Device',
    'Disaster Relief Ribbon (V)', 'Disaster Relief Ribbon with Silver V', 'Disaster Relief Ribbon - Presidential Declaration']){
    const one = runImport(withRows([`${v} 10 Jan 2023`]));
    assert.equal(one.selected.disaster_relief_ribbon.awardLabel, 'Basic w/V-Device', v);
    assert.deepEqual(one.devices('disaster_relief_ribbon'), [{ devices: ['v'], centered: false }], v);
    const three = runImport(withRows(['Disaster Relief Ribbon 10 Jan 2022', `${v} 10 Jan 2023`, 'Disaster Relief Ribbon 10 Jan 2024']));
    assert.equal(three.selected.disaster_relief_ribbon.awardLabel, '3rd with V-Device', v);
    assert.deepEqual(three.devices('disaster_relief_ribbon'), [{ devices: ['v', 'clasp-bronze', 'clasp-bronze'], centered: false }], v);
  }
  // "Presidential" in another row is not this ribbon's V.
  const elsewhere = runImport(withRows(['Disaster Relief Ribbon 10 Jan 2023']).replace('NCSA Cyber Defense 12 Jul 2023', 'NCSA Cyber Defense 12 Jul 2023\nPresidential Classroom 14 Jul 2023'));
  assert.deepEqual(elsewhere.devices('disaster_relief_ribbon'), [{ devices: [], centered: false }]);
});

test('every Disaster Relief value the importer returns resolves to a real option, with the V when the row says V (E45)', () => {
  const entries = [];
  for(let n = 1; n <= 9; n++) for(const v of [false, true]) entries.push({ id: 'disaster_relief_ribbon', expr: `chooseDisasterReliefValue(${n}, ${v})`, n, v });
  for(const row of importValueResolutions(entries)) assertResolvesToCount(row, row.n, [['v', row.v]]);
});

// CAPR 39-3 21j: the CAC ribbon shows the highest level served, wing bronze star, region silver, national gold. A level is served when its term is
// past: a position held now gives the shoulder cord and never the star (the owner, 2026-11-12).
test('a past Wing, Region or National CAC duty position imports the CAC ribbon with its star; the same position held now gives the cord and no star; "Wing" elsewhere does not (E45)', () => {
  const past = row => FIXTURE.replace('Cadet Flight Sergeant GLR-IL-049 UNIT No 01 Jan 2021 31 Dec 2021', 'Cadet Flight Sergeant GLR-IL-049 UNIT No 01 Jan 2021 31 Dec 2021\n' + row + ' 31 May 2024');
  const now = row => FIXTURE.replace('Cadet Deputy Commander for Operations GLR-IL-049 UNIT No 01 Jan 2026', 'Cadet Deputy Commander for Operations GLR-IL-049 UNIT No 01 Jan 2026\n' + row);
  const cases = [
    ['Cadet Advisory Council Primary Representative GLR-IL-001 WING No 01 Jun 2023', 'cac_wing', ['star-bronze'], 'wing'],
    ['Cadet WCAC Representative GLR-IL-001 WING No 01 Jun 2023', 'cac_wing', ['star-bronze'], 'wing'],
    ['Wing CAC Chair GLR-IL-001 WING No 01 Jun 2023', 'cac_wing', ['star-bronze'], 'wing'],
    ['Region CAC Primary Representative GLR-001 REGION No 01 Jun 2023', 'cac_region', ['star-silver'], 'region'],
    ['Cadet NCAC Representative NHQ-000 NATIONAL No 01 Jun 2023', 'cac_national', ['star-gold'], 'national']
  ];
  for(const [row, value, devices, level] of cases){
    const r = runImport(past(row));
    assert.equal(r.selected.cadet_advisory_council_ribbon?.awardValue, value, row);
    assert.deepEqual(r.devices('cadet_advisory_council_ribbon'), [{ devices, centered: false }], row);
    assert.equal(r.parsed.shoulderCord, null, `${row}: a past term gives no cord`);
    // The same row with no End Date is a position held now: the cord, and the ribbon the fixture's own row names, the basic one.
    const held = runImport(now(row.replace(' 01 Jun 2023', ' 04 Jun 2025')));
    assert.equal(held.parsed.shoulderCord, level, row);
    assert.equal(held.selected.cadet_advisory_council_ribbon?.awardValue, 'cac_group', `${row}: held now, no star`);
    assert.deepEqual(held.devices('cadet_advisory_council_ribbon'), [{ devices: [], centered: false }], row);
  }
  // The fixture's "Illinois Wing Encampment" rows and a CAC ribbon row with no level: the basic ribbon.
  assert.equal(runImport(FIXTURE).selected.cadet_advisory_council_ribbon.awardValue, 'cac_group');
  // The importer's own reading (before the duty-row rules in js/patches.js) reads the past table only, and "Wing" outside a CAC row not at all.
  const { context } = loadPageScripts();
  assert.equal(vm.runInContext('importedCacLevelFromDutyPositions', context)(FIXTURE.replace(/\n/g, ' ')), null);
  assert.equal(vm.runInContext('importedCacLevelFromDutyPositions', context)(past(cases[1][0]).replace(/\n/g, ' ')), 'wing');
  assert.equal(vm.runInContext('importedCacLevelFromDutyPositions', context)(now(cases[4][0]).replace(/\n/g, ' ')), null, 'a position held now is not read');
});

test('every CAC level value resolves to its own option, not Group (E45)', () => {
  const rows = importValueResolutions(['group', 'wing_bronze_star', 'region_silver_star', 'national_gold_star']
    .map(v => ({ id: 'cadet_advisory_council_ribbon', expr: `'${v}'` })));
  assert.deepEqual(rows.map(r => r.optionValue), ['cac_group', 'cac_wing', 'cac_region', 'cac_national']);
});

// CAPR 39-3 20d: a bronze star for each cadet special activity after the first, five bronze become one silver.
test('the fixture NCSAs (PJOC 2022, Cyber Defense 2023) and COS put two bronze stars on the special activity ribbon, however the table prints (E46)', () => {
  const stars2 = [{ devices: ['star-bronze', 'star-bronze'], centered: false }];
  const r = runImport(FIXTURE);
  assert.equal(r.ribbon('cadet_special_activity_ribbon').value, 'bronze_star_2');
  assert.deepEqual(r.devices('cadet_special_activity_ribbon'), stars2);
  // Without COS, the two NCSAs alone: one bronze star.
  const noCos = runImport(FIXTURE.replace('Cadet Officers School (COS) 15 Jun 2024\n', ''));
  assert.deepEqual(noCos.devices('cadet_special_activity_ribbon'), [{ devices: ['star-bronze'], centered: false }]);
  // The PDF path joins each page's text with spaces: one line.
  assert.deepEqual(runImport(FIXTURE.replace(/\n/g, ' ')).devices('cadet_special_activity_ribbon'), stars2, 'PDF text on one line');
  // A row that names an activity of the list without the word NCSA is a credit; one the list does not have, and the record does not call an NCSA, is none.
  const bare = FIXTURE.replace('NCSA Pararescue Orientation Course (PJOC)', 'Pararescue Orientation Course').replace('NCSA Cyber Defense', 'Civic Leadership Academy');
  assert.deepEqual(runImport(bare).devices('cadet_special_activity_ribbon'), stars2, 'activity names without NCSA');
  const unlisted = FIXTURE.replace('NCSA Pararescue Orientation Course (PJOC)', 'Pararescue Orientation Course').replace('NCSA Cyber Defense', 'Cyber Defense Training Academy');
  assert.deepEqual(runImport(unlisted).devices('cadet_special_activity_ribbon'), [{ devices: ['star-bronze'], centered: false }], 'a row of no list earns none');
  // A report with no Encampments table: the Cadet Training table still ends at the next heading.
  const noEncampments = FIXTURE.replace(/Encampments\n(?:.*Encampment.*\n)+/, '');
  assert.deepEqual(runImport(noEncampments).devices('cadet_special_activity_ribbon'), stars2, 'no Encampments section');
  // A heading run into the first row, and a staff row for the same activity and year: still one credit each.
  const staff = FIXTURE.replace('Activity Date Completed\n', 'Activity Date Completed ').replace('NCSA Cyber Defense 12 Jul 2023', 'NCSA Cyber Defense 12 Jul 2023\nNCSA Cyber Defense Staff 20 Jul 2023');
  assert.deepEqual(runImport(staff).devices('cadet_special_activity_ribbon'), stars2, 'staff row collapses');
});

test('every cadet special activity value resolves to a real option with that activity count (E46)', () => {
  const entries = [];
  for(let n = 1; n <= 12; n++) entries.push({ id: 'cadet_special_activity_ribbon', expr: `chooseCadetSpecialActivityValue(${n})`, n });
  for(const row of importValueResolutions(entries)){
    const devices = assertResolvesToCount(row, row.n);
    if(row.n === 7) assert.deepEqual(devices, ['star-silver', 'star-bronze'], 'seven activities: silver star and one bronze');
  }
});

test('the import fills the first and last name from the General Information row, title case, and shows it (E43, E53)', () => {
  const r = runImport(FIXTURE);
  assert.equal(r.parsed.firstName, 'Guiseppe');
  assert.equal(r.parsed.lastName, 'Mitchell');
  assert.equal(r.text.firstName, 'Guiseppe');
  assert.equal(r.text.lastName, 'Mitchell');
  assert.equal(r.text.show, true);
  assert.equal(r.fields.capubV2FirstName.value, 'Guiseppe', 'the First name field shows the imported name');
  assert.equal(r.fields.capubV2LastName.value, 'Mitchell', 'the Last name field shows the imported name');
  assert.equal(r.fields.capubV2ShowText.checked, true);
  // A middle name stays off; compound and hyphenated last names stay whole.
  const middle = runImport(FIXTURE.replace('MITCHELL, GUISEPPE', "O'NEIL-MCDONALD JR, MARY K"));
  assert.deepEqual([middle.text.firstName, middle.text.lastName], ['Mary', "O'Neil-McDonald Jr"]);
  // On one line, as the PDF path joins it.
  const pdf = runImport(FIXTURE.replace(/\n/g, ' '));
  assert.deepEqual([pdf.text.firstName, pdf.text.lastName], ['Guiseppe', 'Mitchell']);
  // Without the General Information row, the report heading: grade removed, last word the last name.
  const heading = runImport(FIXTURE.replace('123456 MITCHELL, GUISEPPE ', '').replace('C/Col Guiseppe Mitchell', 'C/Lt Col Guiseppe Mitchell'));
  assert.deepEqual([heading.text.firstName, heading.text.lastName], ['Guiseppe', 'Mitchell']);
});

// CAPR 39-3 14j as data/ribbon-awards.js carries it: the Cadet Officer School star is worn on the Mitchell ribbon; only a
// senior member who no longer wears the Mitchell moves it to the highest cadet program ribbon.
test('a cadet with COS and the Eaker Award: the COS star is on the Mitchell, the Eaker is plain (E44 fact check)', () => {
  const eaker = FIXTURE.replace('Achievement 11 - Amelia Earhart 04 Jun 2025', 'Achievement 11 - Amelia Earhart 04 Jun 2025\nAchievement 15 - Ira C. Eaker 01 Sep 2025');
  const r = runImport(eaker);
  assert.equal(r.ribbon('mitchell_award').value, 'earned_cos_star');
  assert.equal(r.selected.mitchell_award.awardValue, 'earned_cos_star');
  assert.equal(r.selected.mitchell_award.awardLabel, 'Earned + COS graduate');
  assert.deepEqual(r.devices('mitchell_award'), [{ devices: ['star-silver'], centered: false }]);
  assert.ok(r.selected.eaker_award, 'the Eaker imports');
  assert.deepEqual(r.devices('eaker_award'), [{ devices: [], centered: false }], 'no COS star on a cadet Eaker');
});

// The Specialty Tracks table: the first row used to be read with the headings run into it ("SPECIALTY TRACKS SPECIALTY
// TRACK LEVEL COMPLETED CADET PROGRAMS"), which matched no specialty, so the first rated specialty was dropped.
test('every rated specialty in the Specialty Tracks table is read, the first row included, and offered in the picker (E47)', () => {
  const table = 'Specialty Tracks\nSpecialty Track Level Completed\nCADET PROGRAMS TECHNICIAN 12 Jan 2025\nCOMMUNICATIONS TECHNICIAN 05 May 2024\n';
  const withTable = (t, rows=table) => t.replace('Professional Development\nCourse Date Completed\n', 'Professional Development\nCourse Date Completed\n' + rows);
  const senior = withTable(FIXTURE.replace('MALE CADET C/Col', 'MALE SENIOR 2d Lt'));
  const r = runImport(senior);
  assert.ok(r.parsed.authorizedBadges.includes('cadet_programs_technician_badge'), 'the CP rating is report-authorized (offered in the picker)');
  assert.ok(r.parsed.authorizedBadges.includes('communications_technician_badge'));
  assert.ok(r.parsed.badges.includes('cadet_programs_technician_badge') && r.parsed.badges.includes('communications_technician_badge'), 'both worn by default');
  // The same on one line, with "Rating Date" headings, "Officer" after the specialty and "Rating" after the level.
  const oneLine = runImport(withTable(FIXTURE.replace('MALE CADET C/Col', 'MALE SENIOR 2d Lt'),
    'Specialty Tracks Specialty Track Rating Date Cadet Programs Officer Senior Rating 12 Jan 2025 Aerospace Education Master 05 May 2024 Communications Technician 01 Feb 2023 ').replace(/\n/g, ' '));
  for(const id of ['cadet_programs_senior_badge', 'aerospace_education_master_badge', 'communications_technician_badge'])
    assert.ok(oneLine.parsed.authorizedBadges.includes(id), `${id} offered`);
  assert.ok(oneLine.parsed.badges.includes('aerospace_education_master_badge') && oneLine.parsed.badges.includes('cadet_programs_senior_badge'), 'the two highest ratings worn by default');
  // A cadet: the CP specialty badge is not authorized for cadets in this builder, and the import says so.
  const cadet = runImport(withTable(FIXTURE));
  assert.ok(!cadet.parsed.authorizedBadges.includes('cadet_programs_technician_badge'));
  assert.ok(cadet.parsed.badges.includes('communications_technician_badge'));
  assert.ok(cadet.parsed.notes.some(n => /CADET PROGRAMS TECHNICIAN is in the Specialty Tracks table, but the builder does not authorize that badge for cadet members/.test(n)));
});

// One report with the cases Ducky raised (LIVE12, Discord 2026-10-27): four wing Commander's Commendation Awards, a
// Disaster Relief Ribbon with V, a current Wing CAC representative (the cord), two NCSAs and COS, the Eaker, a CP rating.
test('the LIVE12 fixture imports every case Ducky raised', () => {
  const r = runImport(fs.readFileSync(path.join(__dirname, 'fixtures', 'eservices-member-details-cadet-live12.txt'), 'utf8'));
  assert.deepEqual([r.text.firstName, r.text.lastName, r.text.show], ['Guiseppe', 'Mitchell', true]);
  assert.deepEqual(r.devices('commander_commendation_award'), [{ devices: ['clasp-bronze', 'clasp-bronze', 'clasp-bronze'], centered: false }]);
  assert.deepEqual(r.devices('disaster_relief_ribbon'), [{ devices: ['v'], centered: false }]);
  // A current Wing CAC representative wears the wing cord; the ribbon's star is for a term served, and this report lists none (the owner, 2026-11-12).
  assert.equal(r.parsed.shoulderCord, 'wing');
  assert.deepEqual(r.devices('cadet_advisory_council_ribbon'), [{ devices: [], centered: false }]);
  assert.deepEqual(r.devices('cadet_special_activity_ribbon'), [{ devices: ['star-bronze', 'star-bronze'], centered: false }]);
  assert.deepEqual(r.devices('mitchell_award'), [{ devices: ['star-silver'], centered: false }]);
  assert.deepEqual(r.devices('eaker_award'), [{ devices: [], centered: false }]);
  assert.ok(r.parsed.badges.includes('communications_technician_badge'));
  assert.ok(r.parsed.notes.some(n => /^CADET PROGRAMS TECHNICIAN is in the Specialty Tracks table/.test(n)));
});

test('the activities of the list count without the word NCSA, and the ones Figure A8-2 names that the list does not have earn none (E46)', () => {
  const rows = FIXTURE.replace('NCSA Pararescue Orientation Course (PJOC) 10 Jul 2022\nNCSA Cyber Defense 12 Jul 2023',
    'Air Force Space Command Familiarization Course 10 Jul 2022\nSpecialized Undergraduate Pilot Training Familiarization Course 12 Jul 2023\nEngineering Academy 14 Jul 2024');
  assert.deepEqual(runImport(rows).devices('cadet_special_activity_ribbon'), [{ devices: ['star-bronze'], centered: false }], 'COS and the pilot training: two credits');
  const told = runImport(rows).parsed.unreadRows;
  assert.deepEqual(told, ['Air Force Space Command Familiarization Course 10 Jul 2022', 'Engineering Academy 14 Jul 2024']);
});

// LIVE13 E62: the grade in the General Information row is any CAP grade (js/state.js RANKS), read whole: "C/1st Lt"
// used to come back as "C/1st", "C/Lt Col" as "C/Lt", "Maj Gen" as "Maj", and a flight officer's grade was not read
// at all, so the import left the Rank select empty or wrong. Spacing may be missing, as a PDF can print it.
test('every cadet and senior grade in the General Information row is the setup rank, however it is spaced (E62)', () => {
  const asGrade = (type, grade) => FIXTURE.replace('MALE CADET C/Col', `MALE ${type} ${grade}`);
  const { context } = loadPageScripts();
  const RANKS = JSON.parse(vm.runInContext('JSON.stringify(RANKS)', context));
  const cases = [
    ...RANKS.cadet.map(g => ['CADET', g, g, 'cadet']),
    ...RANKS.senior.map(g => ['SENIOR', g, g, 'senior']),
    ['CADET', 'C/1stLt', 'C/1st Lt', 'cadet'], ['CADET', 'C/LtCol', 'C/Lt Col', 'cadet'], ['CADET', 'C/2nd Lt', 'C/2d Lt', 'cadet'],
    ['SENIOR', 'MajGen', 'Maj Gen', 'senior'], ['SENIOR', '2nd Lt', '2d Lt', 'senior'], ['SENIOR MEMBER', 'Lt Col', 'Lt Col', 'senior'],
    ['LIFE', 'Col', 'Col', 'senior']
  ];
  const parse = vm.runInContext('(t => JSON.stringify(getCurrentProfileFromMemberReport(t)))', context);
  for(const [type, grade, rank, membership] of cases){
    const p = JSON.parse(parse(asGrade(type, grade)));
    assert.equal(p.rank, rank, `${type} ${grade}`);
    assert.equal(p.membership, membership, `${type} ${grade}`);
  }
  for(const [type, grade, rank, membership] of [['CADET', 'C/1st Lt', 'C/1st Lt', 'cadet'], ['SENIOR', 'Maj Gen', 'Maj Gen', 'senior'], ['SENIOR', 'TFO', 'TFO', 'senior']]){
    const r = runImport(asGrade(type, grade).replace(/\n/g, ' '));
    assert.deepEqual([r.membership, r.rank], [membership, rank], `${grade} on one line, applied to the setup`);
  }
});

test('the join date is read for a 1st Lt or 2d Lt and when the Date of Rank is blank: the Red Service Ribbon follows (E62)', () => {
  const cadet = runImport(FIXTURE).ribbon('red_service_ribbon');
  assert.ok(cadet);
  for(const grade of ['MALE SENIOR 1st Lt', 'MALE SENIOR 2d Lt', 'FEMALE SENIOR SM']){
    assert.equal(runImport(FIXTURE.replace('MALE CADET C/Col', grade)).ribbon('red_service_ribbon')?.value, cadet.value, grade);
  }
  // SM with no Date of Rank: Joined and Expires only.
  assert.equal(runImport(FIXTURE.replace('MALE CADET C/Col 18 Dec 2025', 'MALE SENIOR SM')).ribbon('red_service_ribbon')?.value, cadet.value, 'SM, no date of rank');
});

test('the import leaves the setup as the Member type and Rank selects would: no stale rank, adult cadet or uniform (E62)', () => {
  // A cadet report with no readable grade, imported over a senior captain: the captain's rank is not kept.
  const noGrade = FIXTURE.replace('MALE CADET C/Col', 'MALE CADET').replace('C/Col Guiseppe Mitchell', 'Guiseppe Mitchell');
  const r = runImport(noGrade, "State.membership = 'senior'; State.rank = 'Capt';");
  assert.equal(r.membership, 'cadet');
  assert.equal(r.rank, null);
  // A senior report over an adult cadet: the adult-cadet option goes (CAPR 39-1 1.2.5.2 is for cadets).
  const senior = runImport(FIXTURE.replace('MALE CADET C/Col', 'MALE SENIOR Capt'), "State.membership = 'cadet'; State.adultCadet = true;");
  assert.equal(senior.adultCadet, false);
  // A cadet report over a senior's mess dress: the uniform falls back to one a cadet may wear.
  const { context } = loadPageScripts();
  assert.equal(vm.runInContext("isUniformAllowedFor('mess_dress', 'cadet')", context), false);
  const cadet = runImport(FIXTURE, "State.membership = 'senior'; State.uniform = 'mess_dress';");
  assert.notEqual(cadet.uniform, 'mess_dress');
  assert.equal(vm.runInContext(`isUniformAllowedFor(${JSON.stringify(cadet.uniform)}, 'cadet')`, context), true);
});

const SENIOR = fs.readFileSync(path.join(__dirname, 'fixtures', 'eservices-member-details-senior-live13.txt'), 'utf8');
const cadetWith = (after, rows) => FIXTURE.replace(after, after + '\n' + rows.join('\n'));

// LIVE13 E62: the ribbons of CAPR 39-3 the catalog offers that a report names, which the importer did not read.
test('a senior report: the decorations and activity ribbons it lists, each row one award, the aircrew propeller read (E62)', () => {
  const r = runImport(SENIOR);
  assert.deepEqual([r.membership, r.rank], ['senior', '1st Lt']);
  assert.ok(r.ribbon('red_service_ribbon'), 'joined 15 Jan 2016');
  for(const id of ['meritorious_service_award', 'unit_citation_award', 'national_commander_unit_citation_award', 'cap_achievment_award',
    'cap_counterdrug_ribbon', 'homeland_security_ribbon', 'search_find_ribbon', 'cap_cadet_orientation_pilot_ribbon', 'cap_senior_recruiter_ribbon']){
    assert.deepEqual(r.devices(id), [{ devices: [], centered: false }], `${id}: one award`);
  }
  // The Yeager award's full name ends "Achievement Award": it is not a second CAP Achievement Award.
  assert.equal(r.ribbon('cap_achievment_award').reason, '1 Achievement Award record(s)');
  assert.ok(r.selected.cap_bridgadier_general_charles_yaeger_ribbon);
  // Two aircrew Air SAR rows: the 20-sortie ribbon with the propeller.
  assert.equal(r.selected.air_search_and_rescue_ribbon.awardLabel, '20 Sorties (Aircrew)');
  assert.deepEqual(r.devices('air_search_and_rescue_ribbon'), [{ devices: ['propeller-bronze', 'clasp-bronze'], centered: true }]);
});

test('the professional development awards come from their names or the Level rows, never from a member named Wilson or Davis (E62)', () => {
  const r = runImport(SENIOR);
  assert.ok(r.selected.cap_membership_ribbon, 'Level I');
  assert.ok(r.selected.cap_leadership_ribbon, 'Level II');
  for(const id of ['cap_grover_loening_aerospace_ribbon', 'cap_paul_e_garber_ribbon', 'cap_gill_robb_wilson_ribbon'])
    assert.equal(r.ribbon(id), undefined, `${id}: Level III and above not completed (the member is named Wilson; the ceremony is a Local Activity)`);
  assert.ok(r.parsed.notes.some(n => /^Leadership Award: a senior or master specialty rating earns a star/.test(n)), 'the senior AE rating star is left to the member');
  // Level V completed: every level's award; a "Level 2" in a ground team title is not a level row.
  const five = runImport(SENIOR.replace('Level II 01 Jun 2018', 'Level II 01 Jun 2018\nLevel III 01 Jun 2019\nLevel IV 01 Jun 2020\nLevel V 01 Jun 2021'));
  for(const id of ['cap_grover_loening_aerospace_ribbon', 'cap_paul_e_garber_ribbon', 'cap_gill_robb_wilson_ribbon']) assert.ok(five.selected[id], id);
  const gtm = runImport(SENIOR.replace('Level I 01 Jun 2016\n', '').replace('Level II 01 Jun 2018\n', '').replace('Squadron Leadership School 01 Mar 2018', 'Ground Team Member Level 2 01 Mar 2018'));
  assert.equal(gtm.ribbon('cap_leadership_ribbon'), undefined);
  assert.equal(gtm.ribbon('cap_membership_ribbon'), undefined);
  // The award names themselves, as a Decorations row prints them.
  const named = runImport(SENIOR.replace('Level I 01 Jun 2016\n', '').replace('Level II 01 Jun 2018\n', '')
    .replace('Achievement Award 01 Feb 2020', 'Membership Award 01 Jun 2016\nLeadership Award 01 Jun 2018\nGrover Loening Aerospace Award 01 Jun 2019\nPaul E. Garber Award 01 Jun 2020\nGill Robb Wilson Award 01 Jun 2021'));
  for(const id of ['cap_membership_ribbon', 'cap_leadership_ribbon', 'cap_grover_loening_aerospace_ribbon', 'cap_paul_e_garber_ribbon', 'cap_gill_robb_wilson_ribbon']) assert.ok(named.selected[id], id);
  for(const last of ['DAVIS', 'YEAGER', 'GARBER']){
    const other = runImport(SENIOR.replace('WILSON, DAVID', `${last}, DAVID`).replace('David Wilson', `David ${last}`).replace(/Brig Gen Charles E\. Yeager.*\n/, '').replace('Level II 01 Jun 2018\n', ''));
    assert.equal(other.ribbon('cap_leadership_ribbon'), undefined, last);
    assert.equal(other.ribbon('cap_bridgadier_general_charles_yaeger_ribbon'), undefined, last);
    assert.equal(other.ribbon('cap_paul_e_garber_ribbon'), undefined, last);
  }
});

test('a cadet report: Medals of Valor, DSA, the cadet-of-the-year awards, IACE, competitions, the special activity ribbon row (E62)', () => {
  const r = runImport(cadetWith('Decorations', ['Silver Medal of Valor 01 Jan 2023', 'Silver Medal of Valor 01 Jan 2024', 'Bronze Medal of Valor 01 Jan 2022',
    'Bronze Medal of Valor 01 Jan 2023', 'Distinguished Service Award 01 Jan 2024', 'AFA Award to Unit Cadet of the Year 01 Jan 2023',
    'AFSA Award to Unit Cadet NCO of the Year 01 Jan 2022', 'VFW Outstanding Cadet Officer of the Year Award 01 Jan 2024', 'VFW Outstanding Cadet NCO of the Year Award 01 Jan 2022'])
    .replace('Activity/Service Ribbon', 'Activity/Service Ribbon\nNational Cadet Competition Ribbon 01 May 2024\nNational Color Guard Competition Ribbon 01 May 2023\nSearch "Find" Ribbon 01 Jan 2023\nSearch "Find" Ribbon 01 Jan 2024')
    .replace('NCSA Cyber Defense 12 Jul 2023', 'NCSA Cyber Defense 12 Jul 2023\nInternational Air Cadet Exchange (IACE) 20 Jul 2024'));
  assert.deepEqual(r.devices('silver_medal_of_valor'), [{ devices: ['clasp-bronze'], centered: false }], 'two awards: one ribbon with one bronze clasp, as the Bronze Medal of Valor (CAPR 39-3 6b)');
  assert.deepEqual(r.devices('bronze_medal_of_valor'), [{ devices: ['clasp-bronze'], centered: false }]);
  for(const id of ['distinguished_service_award', 'afa_award', 'afsa_award', 'vfw_officer_award', 'vfw_nco_award', 'iace_ribbon',
    'national_cadet_competition_ribbon', 'national_color_guard_competition_ribbon']){
    assert.ok(r.selected[id], `${id} selected`);
    assert.deepEqual(r.devices(id), [{ devices: [], centered: false }], id);
  }
  assert.ok(r.parsed.notes.some(n => /^National Cadet Competition Ribbon: the report does not say whether the team won its region/.test(n)));
  assert.deepEqual(r.devices('search_find_ribbon'), [{ devices: ['clasp-bronze'], centered: false }], 'two finds');
  assert.deepEqual(r.devices('cadet_special_activity_ribbon'), [{ devices: ['star-bronze', 'star-bronze'], centered: false }], 'IACE is not an NCSA credit');
  // The ribbon's own row when the Cadet Training table lists no activity.
  const rowOnly = runImport(FIXTURE.replace(/Cadet Officers School \(COS\).*\nNCSA.*\nNCSA.*\n/, '').replace('Activity/Service Ribbon', 'Activity/Service Ribbon\nCadet Special Activities Ribbon 01 Jul 2022'));
  assert.ok(rowOnly.selected.cadet_special_activity_ribbon);
});

test('every value the importer returns for the newly read ribbons resolves to a real option with that award count (E62)', () => {
  const entries = [];
  const counted = ['distinguished_service_award', 'unit_citation_award', 'national_commander_unit_citation_award',
    'air_force_aerial_achievement_medal', 'air_search_and_rescue_ribbon', 'cap_counterdrug_ribbon', 'homeland_security_ribbon', 'cap_cadet_orientation_pilot_ribbon', 'iace_ribbon'];
  for(let n = 1; n <= 7; n++){
    for(const id of counted) entries.push({ id, expr: `importedCountedAwardValue(${n})`, n, prop: false });
    if(n <= 3) for(const id of ['silver_medal_of_valor', 'bronze_medal_of_valor']) entries.push({ id, expr: `importedCountedAwardValue(${n})`, n, prop: false });
    for(const id of ['air_search_and_rescue_ribbon', 'search_find_ribbon']) entries.push({ id, expr: `importedCountedAwardValue(${n}, true)`, n, prop: true });
  }
  for(const row of importValueResolutions(entries)) assertResolvesToCount(row, row.n, [['propeller-bronze', row.prop]]);
  // Both Medals of Valor: one ribbon, a bronze clasp for each award after the first (39-3 6b), never a ribbon for each award.
  for(let n = 1; n <= 3; n++){
    for(const id of ['silver_medal_of_valor', 'bronze_medal_of_valor']){
      const [row] = importValueResolutions([{ id, expr: `importedCountedAwardValue(${n})` }]);
      assert.deepEqual(RA.resolve(id, { awardValue: row.optionValue, awardLabel: row.optionLabel }).map(p => p.devices), [Array(n - 1).fill('device-clasp-bronze')], `${n} ${id}`);
    }
  }
  // A fourth Medal of Valor row: the picker offers three awards, so the third is imported and the import says so.
  const four = runImport(cadetWith('Decorations', [1, 2, 3, 4].map(y => `Bronze Medal of Valor 01 Jan 202${y}`)));
  assert.equal(four.selected.bronze_medal_of_valor.awardLabel, '3rd Award');
  assert.ok(four.parsed.notes.some(n => /^4 Bronze Medal of Valor records found; the ribbon picker offers at most 3/.test(n)));
  // The Silver Medal of Valor the same: the third award is two bronze clasps on the one ribbon, a fourth row is the picker's limit.
  const silver = runImport(cadetWith('Decorations', [1, 2, 3, 4].map(y => `Silver Medal of Valor 01 Jan 202${y}`)));
  assert.equal(silver.selected.silver_medal_of_valor.awardLabel, '3rd Award');
  assert.deepEqual(silver.devices('silver_medal_of_valor'), [{ devices: ['clasp-bronze', 'clasp-bronze'], centered: false }]);
  assert.ok(silver.parsed.notes.some(n => /^4 Silver Medal of Valor records found; the ribbon picker offers at most 3/.test(n)));
});

// The Silver Medal of Valor was once drawn as a separate ribbon for each award ("silver_valor_2", "silver_valor_3"). A report parsed or a setup saved
// then still names those values; each is the same number of awards on the one ribbon, a bronze clasp for each later award (CAPR 39-3 6b), as the Bronze.
test('an import value of the old separate-ribbon Silver Medal of Valor lands on the option with that many awards, one ribbon with clasps (CAPR 39-3 6b)', () => {
  const rows = importValueResolutions([1, 2, 3].map(n => ({ id: 'silver_medal_of_valor', expr: `'silver_valor_${n}'`, n })));
  for(const row of rows){
    assert.ok(row.real, `silver_valor_${row.n} lands on a real option`);
    assert.equal(RA.readCount('silver_medal_of_valor', row.optionValue, row.optionLabel), row.n, `silver_valor_${row.n}: ${row.optionLabel}`);
    assert.deepEqual(RA.resolve('silver_medal_of_valor', { awardValue: row.optionValue, awardLabel: row.optionLabel }).map(p => p.devices), [Array(row.n - 1).fill('device-clasp-bronze')]);
  }
  assert.deepEqual(rows.map(row => row.optionLabel), ['Basic Award', '2nd Award', '3rd Award']);
});

// CAPR 39-1 11.1.4 (a senior may wear some or all earned medals on the mess dress and the corporate semi-formal; Ethan: "yes milestones as
// he suggested") and js/catalog.js SENIOR_HIGHEST_CADET_AWARD_RIBBONS: a senior member keeps every cadet milestone award earned, and the
// achievements below them stay out. The rack still shows one ribbon (js/uniform-view.js buildRibbons, tests/senior-milestone-medals.test.cjs).
test('a senior who was a cadet: every cadet milestone earned, the Mitchell with its own COS star, the achievements left out (E62)', () => {
  const r = runImport(SENIOR);
  const cadetAwards = ['curry_achievement', 'hap_arnold_achievement', 'mary_feik_achievement', 'wright_brothers_award', 'rickenbacker_achievement', 'lindbergh_achievement',
    'doolittle_achievement', 'goddard_achievement', 'armstrong_achievement', 'mitchell_award', 'earhart_award'];
  assert.deepEqual(r.parsed.ribbons.filter(x => cadetAwards.includes(x.id)).map(x => `${x.id}=${x.value}`), ['wright_brothers_award=earned', 'mitchell_award=earned_cos_star', 'earhart_award=earned']);
  assert.deepEqual(Object.keys(r.selected).filter(id => cadetAwards.includes(id)).sort(), ['earhart_award', 'mitchell_award', 'wright_brothers_award']);
  assert.equal(r.selected.mitchell_award.awardValue, 'earned_cos_star');
  // Up to the Mitchell only: the Wright Brothers and the Mitchell, which keeps its own COS star.
  const mitchell = runImport(SENIOR.replace(/Achievement 11 - Amelia Earhart.*\n/, ''));
  assert.deepEqual(mitchell.parsed.ribbons.filter(x => cadetAwards.includes(x.id)).map(x => `${x.id}=${x.value}`), ['wright_brothers_award=earned', 'mitchell_award=earned_cos_star']);
  // No milestone: the highest achievement alone.
  const ach = runImport(SENIOR.replace(/Achievement (?:[4-9]|1[01]) - .*\n/g, '').replace('Cadet Officers School (COS) 20 Jun 2014\n', ''));
  assert.deepEqual(ach.parsed.ribbons.filter(x => cadetAwards.includes(x.id)).map(x => x.id), ['mary_feik_achievement']);
});

test('the achievement rows are read by the name they print, so a numbering that counts the milestones does not shift them (E62)', () => {
  const cadet = SENIOR.replace('MALE SENIOR 1st Lt 01 Mar 2024', 'MALE CADET C/MSgt 01 Mar 2024').replace('1st Lt David Wilson', 'C/MSgt David Wilson');
  // Up to "Achievement 5 - Rickenbacker" (the fifth row, Achievement 4): Curry to Rickenbacker and the Wright Brothers, not Lindbergh.
  const r = runImport(cadet.replace(/Achievement (?:[6-9]|1[01]) - .*\n/g, ''));
  for(const id of ['curry_achievement', 'hap_arnold_achievement', 'mary_feik_achievement', 'wright_brothers_award', 'rickenbacker_achievement']) assert.ok(r.selected[id], id);
  assert.equal(r.ribbon('lindbergh_achievement'), undefined);
  // Names without numbers, honor credit on the row that names it.
  const bare = FIXTURE.replace(/Achievement \d+ - (\w[\w ]*?) (\d\d \w\w\w \d{4})/g, '$1 Achievement $2')
    .replace('Doolittle Achievement 20 Jun 2022', 'Doolittle Achievement 20 Jun 2022 Honor Credit');
  const b = runImport(bare);
  for(const id of ['curry_achievement', 'armstrong_achievement', 'wright_brothers_award', 'mitchell_award', 'earhart_award']) assert.ok(b.selected[id], id);
  assert.equal(b.selected.doolittle_achievement.awardValue, 'honor_credit');
  assert.equal(b.selected.lindbergh_achievement.awardValue, 'earned');
});

// LIVE13 E62: the badges the report names. A qualification is read on its own row: the 300-character window used to
// take in the "Cadet Training" heading or a neighbouring TRAINING status and drop a qualified GTL or GTM3.
test('a senior report: the qualification rows are read row by row, a slash spelling of a specialty, the current commander (E62)', () => {
  const r = runImport(SENIOR);
  assert.ok(r.parsed.authorizedBadges.includes('master_ground_team_badge'), 'GTL QUALIFIED, the row before the Cadet Training heading');
  assert.ok(!r.parsed.authorizedBadges.includes('basic_incident_commander_badge'), 'IC3 in training is no badge');
  assert.ok(r.parsed.notes.some(n => /^Incident Commander training was found with no qualification, so no Incident Commander badge was imported \(CAPR 39-1, 10\.4\.6\)\.$/.test(n)));
  assert.ok(r.parsed.authorizedBadges.includes('stan_eval_tech_badge'), 'STANDARDIZATION/EVALUATION TECHNICIAN');
  // A current duty table headed "Duty Positions": the Commander row is the current commander's.
  assert.ok(r.parsed.badges.includes('squadron_commander_badge'));
  assert.ok(r.parsed.notes.some(n => /^Current commander duty found/.test(n)));
  assert.ok(r.ribbon('cap_command_service_ribbon'));
  // The same on one line, as the PDF path joins it.
  const pdf = runImport(SENIOR.replace(/\n/g, ' '));
  assert.ok(pdf.parsed.authorizedBadges.includes('master_ground_team_badge'));
  assert.ok(!pdf.parsed.authorizedBadges.includes('basic_incident_commander_badge'));
  // A GTM3 qualified row and a GTM3 trainee row, the qualified one after the trainee.
  const both = runImport(FIXTURE.replace('Cadet Training\n', 'Ground Team Member Level 3 (GTM3) TRAINING 01 Jan 2024\nUrban DF Team (UDF) TRAINING 01 Jan 2024\nGTM3 QUALIFIED 01 Jan 2027\nCadet Training\n'));
  assert.ok(both.parsed.authorizedBadges.includes('ground_team_basic_badge'));
  const trainee = runImport(FIXTURE.replace('Cadet Training\n', 'GTM3 TRAINING 01 Jan 2027\nCadet Training\n'));
  assert.ok(!trainee.parsed.authorizedBadges.includes('ground_team_basic_badge'));
});

test('the aviation, EMT, STEM, Cyber, NRA and Volunteer University badges named in a report; a sUAS or glider pilot is not a CAP pilot (E62)', () => {
  const cadet = runImport(cadetWith('Decorations', ['sUAS Pilot Badge 01 Jan 2024', 'Pre-Solo Badge 01 Jan 2023', 'Solo Badge 01 Jun 2023', 'Air Crew Badge 01 Jan 2025',
    'EMT-Basic 01 Jan 2025', 'Cadet STEM Badge 01 Jan 2024', 'Cadet Cyber Badge 01 Jan 2024', 'NRA Marksmanship Qualification 01 Jan 2024']));
  for(const id of ['uas_pilot_basic_badge', 'pre_solo_badge', 'solo_badge', 'AirCrew1_DB3F0FCC3650F', 'emt_basic_badge', 'stem_badges', 'cyber_badges', 'nra_marksman_badge'])
    assert.ok(cadet.parsed.authorizedBadges.includes(id), id);
  assert.ok(!cadet.parsed.authorizedBadges.includes('CAPPilot1_FA9D33EA587D8'), 'sUAS Pilot Badge is not the CAP Pilot Badge');
  const senior = runImport(SENIOR.replace('Achievement Award 01 Feb 2020', 'Achievement Award 01 Feb 2020\nGlider Pilot Rating 01 Mar 2021\nBalloon Pilot Badge 01 Mar 2022\nEMT-Paramedic 01 Jan 2020\nVolunteer University Instructor 01 Jan 2024'));
  for(const id of ['GliderPilot1_7BFB287379918', 'BalloonPilot1_442D89C94185B', 'emt_paramedic', 'volunteer_university_instructor_badge'])
    assert.ok(senior.parsed.authorizedBadges.includes(id), id);
  assert.ok(!senior.parsed.authorizedBadges.includes('CAPPilot1_FA9D33EA587D8'));
  assert.ok(!senior.parsed.authorizedBadges.includes('emt_basic_badge'), 'the highest EMT certification only');
  assert.ok(runImport(SENIOR.replace('Achievement Award 01 Feb 2020', 'Achievement Award 01 Feb 2020\nCAP Pilot Badge 01 Mar 2021')).parsed.authorizedBadges.includes('CAPPilot1_FA9D33EA587D8'));
});

test('a past First Sergeant tour is not the current one: the diamond follows the current duty table only (E62)', () => {
  const msgt = FIXTURE.replace('MALE CADET C/Col', 'MALE CADET C/MSgt').replace('C/Col Guiseppe Mitchell', 'C/MSgt Guiseppe Mitchell');
  const past = runImport(msgt.replace('Cadet Flight Sergeant GLR-IL-049 UNIT No 01 Jan 2021 31 Dec 2021', 'Cadet First Sergeant GLR-IL-049 UNIT No 01 Jan 2023 31 Dec 2023'));
  assert.equal(past.parsed.cadetFirstSergeant, false);
  const current = runImport(msgt.replace('Cadet Deputy Commander for Operations GLR-IL-049 UNIT No 01 Jan 2026', 'Cadet First Sergeant GLR-IL-049 UNIT No 01 Jan 2026'));
  assert.equal(current.parsed.cadetFirstSergeant, true);
});

// Member feedback: a report that lists the Squadron Commander only under past duty positions was imported as the
// current squadron commander. Two faults: the graduated status the parser found was cleared again when the import
// was applied (so a past tour wore the pin over the nameplate, as a current commander does), and a past table under
// another heading ("Previous Duty Positions") was read as part of the current one (CAPR 39-1 10.2.5).
const PAST_COMMANDER = fs.readFileSync(path.join(__dirname, 'fixtures', 'eservices-member-details-senior-past-commander.txt'), 'utf8');

test('a Squadron Commander listed only under past duty positions is a graduated commander, never the current one (10.2.5)', () => {
  const r = runImport(PAST_COMMANDER);
  assert.ok(r.parsed.badges.includes('squadron_commander_badge'), 'a tour of a year or more earns the pin');
  assert.equal(r.parsed.commandStatus, 'graduated');
  assert.equal(r.commandInsignia.graduatedCommander, true, 'graduated: the pin goes under the nameplate, not over it');
  assert.match(r.parsed.notes.join(' '), /graduated commander/);
  assert.doesNotMatch(r.parsed.notes.join(' '), /Current commander duty found/);
  // Printed in a current table, the same row is the current commander.
  const current = runImport(PAST_COMMANDER.replace('Aerospace Education Officer GLR-IL-049 UNIT No 01 Jan 2023', 'Squadron Commander GLR-IL-049 UNIT No 01 Jan 2023'));
  assert.equal(current.parsed.commandStatus, 'current');
  assert.equal(current.commandInsignia.graduatedCommander, false);
});

test('a past commander tour under any heading, or with an end date, is not a current duty; a short tour wears no pin', () => {
  for(const heading of ['Previous Duty Positions', 'Prior Duty Positions', 'Former Duty Positions', 'Historical Duty Positions', 'Past Duty Assignments', 'Duty Positions History']){
    const r = runImport(PAST_COMMANDER.replace('Past Duty Positions', heading));
    assert.equal(r.parsed.commandStatus, 'graduated', heading);
    assert.equal(r.commandInsignia.graduatedCommander, true, heading);
  }
  // Only a past table, none current (the member holds no duty now).
  const none = runImport(PAST_COMMANDER.replace(/Duty Positions\nDuty Position Unit Echelon Asst Start Date End Date\nAerospace[^\n]*\n/, ''));
  assert.equal(none.parsed.commandStatus, 'graduated');
  // A row with an end date in the current table is an ended assignment.
  const ended = runImport(PAST_COMMANDER.replace('Aerospace Education Officer GLR-IL-049 UNIT No 01 Jan 2023', 'Squadron Commander GLR-IL-049 UNIT No 01 Jan 2019 31 Dec 2022'));
  assert.equal(ended.parsed.commandStatus, 'graduated');
  assert.equal(ended.commandInsignia.graduatedCommander, true);
  // Under a year: no pin at all, and no command status.
  const shortTour = runImport(PAST_COMMANDER.replace('01 Jan 2019 31 Dec 2022\nDeputy', '01 Jan 2022 31 Dec 2022\nDeputy'));
  assert.ok(!shortTour.parsed.badges.includes('squadron_commander_badge'));
  assert.equal(shortTour.parsed.commandStatus, undefined);
  assert.equal(shortTour.commandInsignia.graduatedCommander, false);
});

test('a previous member\'s current-commander status does not carry into a report with no commander duty', () => {
  const r = runImport(SENIOR.replace('Commander GLR-IL-049 UNIT No 01 Jan 2025\n', ''), "State.commandInsignia = { graduatedCommander: true };");
  assert.equal(r.commandInsignia.graduatedCommander, false);
  assert.ok(!r.parsed.badges.includes('squadron_commander_badge'));
});

test('a past Cadet Advisory Council term sets no shoulder cord; a current one does (current duty only)', () => {
  const head = 'SMITH, JANE FEMALE CADET C/Capt Cadet Duty Positions Duty Position Unit Echelon Asst Start Date End Date ';
  const past = head + 'Cadet Past Duty Positions Duty Position Unit Echelon Asst Start Date End Date RCAC Chair PCR-CA-001 REGION No 01 Jan 2021 31 Dec 2022 Professional Development';
  const current = head + 'RCAC Chair PCR-CA-001 REGION No 01 Jan 2024 Cadet Past Duty Positions Duty Position Unit Echelon Asst Start Date End Date Professional Development';
  const { context } = loadPageScripts();
  const cord = t => vm.runInContext('(t) => parseCapMemberReport(t).shoulderCord', context)(t);
  assert.equal(cord(past), null);
  assert.equal(cord(current), 'region');
});

// ---- The aviation badges (the owner's report: solo, aircrew and observer wings were not found) -------------------------------------
// The wording of the aviation rows of a real eServices report is not in the fixtures. The names are CAPR 39-1 Figure A7-1's (PILOT,
// SENIOR PILOT, COMMAND PILOT, MASTER OBSERVER, MASTER AIR CREW, GLIDER PILOT, BALLOON PILOT, SOLO BADGE, PRE-SOLO BADGE, the sUAS
// pilots and technicians) and the word a member uses for them, "wings"; the importer reads each under Badge, Rating and Wings, with
// the level before or after the name, so these rows are the shape it is built to read, not a copy of a report.
const AVIATION_IDS = {
  pilot: ['CAPPilot1_FA9D33EA587D8', 'CAPSeniorPilot1_D9725AE959752', 'CAPMasterPilot1_621A0E2ED15DA'],
  observer: ['observer_badge', 'SeniorObserver1_0E35802A29801', 'MasterObserver1_1B88D5071FD5C'],
  aircrew: ['AirCrew1_DB3F0FCC3650F', 'SeniorAirCrew1_B289BAE6E515C', 'MasterAirCrew1_72AC4CAE7A310'],
  suasPilot: ['uas_pilot_basic_badge', 'uas_pilot_senior_badge', 'uas_pilot_master_badge'],
  suasTech: ['uas_technician_basic_badge', 'uas_technician_senior_badge', 'uas_technician_master_badge']
};
const ALL_AVIATION = Object.values(AVIATION_IDS).flat().concat(['GliderPilot1_7BFB287379918', 'BalloonPilot1_442D89C94185B', 'solo_badge', 'pre_solo_badge']);
let aviationParser = null;
// parseCapMemberReport on a text, in one page for every call: the badge ids worn and offered, and the notes.
function parseAviation(text){
  if(!aviationParser){
    const { context } = loadPageScripts();
    aviationParser = t => JSON.parse(vm.runInContext('(t) => JSON.stringify((() => { const p = parseCapMemberReport(t); return { badges: p.badges, authorized: p.authorizedBadges, notes: p.notes }; })())', context)(t));
  }
  return aviationParser(text);
}
// The senior fixture holds a Mission Scanner qualification, which brings the Air Crew badge (the owner, 2026-11-12); the tests of the badges a report
// NAMES are on the fixture without it, so that the badge a row names is the only aviation badge there is.
const SENIOR_NO_AIRCREW = SENIOR.replace('Mission Scanner (MS) QUALIFIED 01 Jan 2027\n', '');
const seniorWith = (after, rows) => SENIOR_NO_AIRCREW.replace(after, after + '\n' + rows.join('\n'));
const aviationIn = ids => ids.filter(id => ALL_AVIATION.includes(id));

test('every CAP aviation badge is read from a row that names it, as a Badge, a Rating or Wings, at its level (Figure A7-1)', () => {
  const rows = [
    ['Pilot', AVIATION_IDS.pilot[0]], ['Senior Pilot', AVIATION_IDS.pilot[1]], ['Command Pilot', AVIATION_IDS.pilot[2]], ['Master Pilot', AVIATION_IDS.pilot[2]],
    ['Observer', AVIATION_IDS.observer[0]], ['Senior Observer', AVIATION_IDS.observer[1]], ['Master Observer', AVIATION_IDS.observer[2]],
    ['Air Crew', AVIATION_IDS.aircrew[0]], ['Aircrew', AVIATION_IDS.aircrew[0]], ['Senior Air Crew', AVIATION_IDS.aircrew[1]], ['Master Aircrew', AVIATION_IDS.aircrew[2]],
    ['Glider Pilot', 'GliderPilot1_7BFB287379918'], ['Balloon Pilot', 'BalloonPilot1_442D89C94185B'], ['Solo', 'solo_badge'], ['Pre-Solo', 'pre_solo_badge'],
    ['sUAS Pilot', AVIATION_IDS.suasPilot[0]], ['Senior sUAS Pilot', AVIATION_IDS.suasPilot[1]], ['Command sUAS Pilot', AVIATION_IDS.suasPilot[2]],
    ['sUAS Technician', AVIATION_IDS.suasTech[0]], ['Senior sUAS Technician', AVIATION_IDS.suasTech[1]], ['Master sUAS Technician', AVIATION_IDS.suasTech[2]]
  ];
  const missed = [];
  for(const [name, id] of rows){
    for(const word of ['Badge', 'Rating', 'Wings']){
      // "Pilot Rating" alone may be an FAA rating, so the CAP pilot's rating row says CAP (or a level).
      const row = word === 'Rating' && name === 'Pilot' ? `CAP ${name} ${word}` : `${name} ${word}`;
      for(const [heading, text] of [['Decorations', seniorWith('Decorations', [`${row} 01 Jun 2023`])],
        ['Emergency Services Qualifications', seniorWith('Qualification Status Expiration', [`${row} 01 Jun 2023`])],
        ['the last row before Local Activities', SENIOR_NO_AIRCREW.replace('Local Activities', `${row.toUpperCase()} 01 Jun 2023 Local Activities`)],
        ['one line, as a PDF is read', seniorWith('Decorations', [`${row} 01 Jun 2023`]).replace(/\n/g, ' ')]]){
        const got = parseAviation(text).authorized;
        if(!got.includes(id)) missed.push(`${row} (${heading}): wanted ${id}, got ${aviationIn(got).join(', ') || 'no aviation badge'}`);
        // The row names one badge: no other aviation badge comes with it (the senior fixture itself names none).
        const extra = aviationIn(got).filter(g => g !== id);
        if(extra.length) missed.push(`${row} (${heading}): also read ${extra.join(', ')}`);
      }
    }
  }
  assert.deepEqual(missed, []);
});

test('the level may follow the name, and a table of ratings prints the name, the level and a date', () => {
  const read = row => aviationIn(parseAviation(seniorWith('Decorations', [row])).authorized);
  assert.deepEqual(read('OBSERVER SENIOR 10 Jan 2019'), [AVIATION_IDS.observer[1]]);
  assert.deepEqual(read('Observer Wings - Master 10 Jan 2019'), [AVIATION_IDS.observer[2]]);
  assert.deepEqual(read('Air Crew (Senior) Badge 10 Jan 2019'), [AVIATION_IDS.aircrew[1]]);
  assert.deepEqual(read('Air Crew Wings (Master) 10 Jan 2019'), [AVIATION_IDS.aircrew[2]]);
  assert.deepEqual(read('SENIOR PILOT 10 Jan 2019'), [AVIATION_IDS.pilot[1]]);
  assert.deepEqual(read('SOLO 10 Jan 2019'), ['solo_badge']);
  assert.deepEqual(read('Cadet Solo Wings 10 Jan 2019'), ['solo_badge']);
  assert.deepEqual(read('Solo Pilot Wings 10 Jan 2019'), ['solo_badge'], 'a solo pilot\'s wings are the Solo badge, not the CAP Pilot badge');
  assert.deepEqual(read('Glider Wings 10 Jan 2019'), ['GliderPilot1_7BFB287379918']);
});

test('the highest level of a kind is the one offered, not each level named', () => {
  const read = rows => aviationIn(parseAviation(seniorWith('Decorations', rows)).authorized);
  assert.deepEqual(read(['Observer Badge 01 Jan 2018', 'Senior Observer Badge 01 Jan 2020', 'Master Observer Badge 01 Jan 2022']), [AVIATION_IDS.observer[2]]);
  assert.deepEqual(read(['Air Crew Badge 01 Jan 2018', 'CAP Senior Air Crew Rating 01 Jan 2020']), [AVIATION_IDS.aircrew[1]]);
  assert.deepEqual(read(['CAP Pilot Rating 01 Jan 2018', 'Command Pilot Wings 01 Jan 2022']), [AVIATION_IDS.pilot[2]]);
  assert.deepEqual(read(['sUAS Pilot Badge 01 Jan 2023', 'Senior sUAS Technician Badge 01 Jan 2024']), [AVIATION_IDS.suasPilot[0], AVIATION_IDS.suasTech[1]]);
});

test('a row that is not the rating is not read: another pilot, an FAA rating, an exam, a course, an award, a ceremony, the Local Activities (a Mission Pilot qualification is none, and a Mission Observer or Scanner brings a basic badge by its own rule)', () => {
  const no = [
    'Cadet Orientation Pilot Ribbon 01 Jun 2023', 'Air Search and Rescue Ribbon (Aircrew) 10 Oct 2020', 'Search Find Ribbon Aircrew 12 Dec 2021',
    'Lt Col T. Keith Riddle Aircrew Member of the Year Award 01 Jan 2024', 'Instructor Pilot Rating 01 Jan 2020', 'Check Pilot Badge 01 Jan 2020',
    'Mission Pilot Rating 01 Jan 2020', 'Orientation Pilot Wings 01 Jan 2020', 'Private Pilot Rating 01 Jan 2020', 'Pilot Rating 01 Jan 2020',
    'Observer Rating Exam 01 Jan 2020', 'Technician Rating Exam: Aircrew 01 Jan 2020', 'Aircrew Training Course 01 Jan 2020', 'Observer Training 01 Jan 2020',
    'Pilot Wings Ceremony 01 Jan 2020', 'Solo Flight 01 Jan 2020', 'Glider 01 Jan 2020', 'Illinois Wing Encampment 20 Jul 2020',
    'sUAS Pre-Solo Badge 01 Jan 2024'
  ];
  for(const row of no) assert.deepEqual(aviationIn(parseAviation(seniorWith('Decorations', [row])).authorized), [], row);
  // A row in Local Activities, the last section, never earns a badge.
  assert.deepEqual(aviationIn(parseAviation(SENIOR_NO_AIRCREW.replace(/Gill Robb Wilson Award Ceremony \d{2} \w{3} \d{4}/, 'Observer Wings 07 May 2025')).authorized), []);
  // A sUAS or glider pilot is not the CAP pilot, and a sUAS "Pre-Solo" is not the CAP Pre-Solo badge.
  assert.deepEqual(aviationIn(parseAviation(seniorWith('Decorations', ['sUAS Pilot Wings 01 Jan 2024', 'Glider Pilot Badge 01 Jan 2024'])).authorized).sort(), [AVIATION_IDS.suasPilot[0], 'GliderPilot1_7BFB287379918'].sort());
});

test('solo, aircrew and observer wings in one cadet report: all three are offered, one is worn, and the import says so', () => {
  const rows = ['Solo Wings 01 Jun 2023', 'Air Crew Wings 01 Jan 2025', 'Observer Wings 01 Jan 2025'];
  const r = runImport(cadetWith('Decorations', rows));
  for(const id of ['solo_badge', AVIATION_IDS.aircrew[0], AVIATION_IDS.observer[0]]) assert.ok(r.parsed.authorizedBadges.includes(id), `${id} is offered under Authorized by member report`);
  assert.equal(aviationIn(r.parsed.badges).length, 1, 'one CAP aviation badge is worn (CAPR 39-1, 4.1.5.2.2.4.1)');
  assert.equal(aviationIn(r.badges).length, 1, 'and it is the one the setup holds');
  const note = r.parsed.notes.find(n => /^The report names these aviation badges/.test(n));
  assert.ok(note, 'the import names the badges it found and why one is worn');
  for(const name of ['Solo Badge', 'Air Crew Badge', 'Observer Badge']) assert.ok(note.includes(name), name);
  assert.match(note, /\(CAPR 39-1, 4\.1\.5\.2\.2\.4\.1\)/);
  // A single aviation badge needs no such note.
  assert.ok(!runImport(cadetWith('Decorations', ['Solo Wings 01 Jun 2023'])).parsed.notes.some(n => /^The report names these aviation badges/.test(n)));
});

test('a badge the membership may not wear is named, not dropped silently; a cadet may wear the observer and the three aircrew badges', () => {
  const cadet = parseAviation(cadetWith('Decorations', ['Master Observer Wings 01 Jun 2023', 'Senior Observer Badge 01 Jun 2022', 'Master Air Crew Badge 01 Jun 2023', 'Glider Pilot Wings 01 Jun 2023']));
  assert.ok(cadet.authorized.includes(AVIATION_IDS.aircrew[2]), 'the master aircrew badge is a cadet badge');
  assert.ok(cadet.authorized.includes(AVIATION_IDS.observer[2]) === false, 'the master observer badge is not');
  assert.ok(cadet.notes.some(n => /^Master Observer Badge is in the report, but the builder does not authorize that badge for cadet members, so it is not offered\.$/.test(n)));
  assert.ok(cadet.notes.some(n => /^Glider Pilot Badge is in the report, but the builder does not authorize that badge for cadet members/.test(n)));
});

// The owner, 2026-11-12: "it didnt give me any air crew wings". A held aircrew qualification brings the basic badge of its family when the report names
// none of that family; the senior and master levels need years and hours the report does not show.
const qualifies = (rows, text = SENIOR_NO_AIRCREW) => parseAviation(text.replace('Qualification Status Expiration', 'Qualification Status Expiration\n' + rows.join('\n')));
const noteOf = (r, re) => r.notes.find(n => re.test(n));
test('a held Mission Observer brings the Observer badge, a held Mission Scanner or Airborne Photographer without it the Air Crew badge, and the panel says which came from which', () => {
  const observer = qualifies(['Mission Observer (MO) QUALIFIED 01 Jan 2027']);
  assert.deepEqual(aviationIn(observer.authorized), [AVIATION_IDS.observer[0]]);
  assert.ok(aviationIn(observer.badges).includes(AVIATION_IDS.observer[0]), 'and it is the one worn');
  assert.ok(observer.notes.includes('Observer Badge: taken from the Mission Observer qualification, since the report names no observer badge. Change it in the badge list.'), observer.notes.join(' | '));
  // The fixture's own Mission Scanner (the senior fixture of the other tests): the Air Crew badge.
  const scanner = parseAviation(SENIOR);
  assert.deepEqual(aviationIn(scanner.authorized), [AVIATION_IDS.aircrew[0]]);
  assert.ok(scanner.notes.includes('Air Crew Badge: taken from the Mission Scanner qualification, since the report names no air crew badge. Change it in the badge list.'), scanner.notes.join(' | '));
  // A scanner and a photographer: one badge, from both.
  const both = qualifies(['Mission Scanner (MS) QUALIFIED 01 Jan 2027', 'Airborne Photographer (AP) QUALIFIED 01 Jan 2027']);
  assert.deepEqual(aviationIn(both.authorized), [AVIATION_IDS.aircrew[0]]);
  assert.ok(both.notes.includes('Air Crew Badge: taken from the Mission Scanner and Airborne Photographer qualifications, since the report names no air crew badge. Change it in the badge list.'), both.notes.join(' | '));
  assert.deepEqual(aviationIn(qualifies(['Airborne Photographer (AP) QUALIFIED 01 Jan 2027']).authorized), [AVIATION_IDS.aircrew[0]], 'a photographer alone');
  // An observer who is also a scanner and a photographer is worn as the observer: only the Observer badge comes.
  const all = qualifies(['Mission Observer (MO) QUALIFIED 01 Jan 2027', 'Mission Scanner (MS) QUALIFIED 01 Jan 2027', 'Airborne Photographer (AP) QUALIFIED 01 Jan 2027']);
  assert.deepEqual(aviationIn(all.authorized), [AVIATION_IDS.observer[0]]);
  assert.equal(all.notes.filter(n => /taken from the/.test(n)).length, 1, 'one line, for the one badge');
});

test('a qualification brings its badge only where the report names no badge of its family, and never a trainee\'s, never a Mission Pilot\'s', () => {
  // The report names the observer badge at a higher level: the basic one is not added, and no line says so.
  const named = qualifies(['Mission Observer (MO) QUALIFIED 01 Jan 2027', 'Senior Observer Wings 01 Jun 2023']);
  assert.deepEqual(aviationIn(named.authorized), [AVIATION_IDS.observer[1]]);
  assert.ok(!named.notes.some(n => /taken from the/.test(n)));
  // An aircrew badge named: a Mission Scanner adds nothing.
  assert.deepEqual(aviationIn(qualifies(['Mission Scanner (MS) QUALIFIED 01 Jan 2027', 'Master Air Crew Badge 01 Jun 2023']).authorized), [AVIATION_IDS.aircrew[2]]);
  // A pilot badge named and a Mission Observer: both are offered, the pilot is worn, and the line says the Observer badge is not.
  const pilot = qualifies(['Mission Observer (MO) QUALIFIED 01 Jan 2027', 'Senior Pilot Wings 01 Jun 2023']);
  assert.deepEqual(aviationIn(pilot.authorized).sort(), [AVIATION_IDS.observer[0], AVIATION_IDS.pilot[1]].sort());
  assert.deepEqual(aviationIn(pilot.badges), [AVIATION_IDS.pilot[1]]);
  assert.ok(noteOf(pilot, /^Observer Badge: taken from the Mission Observer qualification, since the report names no observer badge, and listed under Authorized by member report; another aviation badge is worn, as only one is at a time \(CAPR 39-1, 4\.1\.5\.2\.2\.4\.1\)\.$/), pilot.notes.join(' | '));
  // An observer badge named and a Mission Scanner: the scanner's badge is another family's, and is offered under the observer's.
  const mixed = qualifies(['Mission Scanner (MS) QUALIFIED 01 Jan 2027', 'Observer Wings 01 Jun 2023']);
  assert.deepEqual(aviationIn(mixed.authorized).sort(), [AVIATION_IDS.aircrew[0], AVIATION_IDS.observer[0]].sort());
  // In training, not qualified, or never held: nothing.
  for(const status of ['TRAINING', 'Training', 'NOT QUALIFIED', 'DENIED', 'FAILED', 'PENDING']){
    const r = qualifies([`Mission Observer (MO) ${status} 01 Jan 2027`, `Mission Scanner (MS) ${status} 01 Jan 2027`]);
    assert.deepEqual(aviationIn(r.authorized), [], status);
    assert.ok(!r.notes.some(n => /taken from the|Mission Pilot qualification/.test(n)), status);
  }
  // A Mission Pilot brings no badge (pilot wings are the pilot rating's, and the report names none): it is told, as before, and told no more when a pilot badge is named.
  const missionPilot = qualifies(['Mission Pilot (MP) QUALIFIED 01 Jan 2027']);
  assert.deepEqual(aviationIn(missionPilot.authorized), []);
  assert.ok(missionPilot.notes.includes('Mission Pilot qualification found, but the report names no pilot badge or rating, and a badge is worn only when it has been awarded (CAPR 39-1, 10.3.1): none was imported. If you hold one, choose it in the badge list.'));
  const ratedPilot = qualifies(['Mission Pilot (MP) QUALIFIED 01 Jan 2027', 'CAP Pilot Rating 01 Jun 2023']);
  assert.deepEqual(aviationIn(ratedPilot.authorized), [AVIATION_IDS.pilot[0]]);
  assert.ok(!ratedPilot.notes.some(n => /Mission Pilot qualification/.test(n)));
});

test('the qualification\'s badge is a badge the membership may wear, and is worn: a cadet and a senior member both get it, on the list the report authorizes', () => {
  const { context } = loadPageScripts();
  for(const id of [AVIATION_IDS.observer[0], AVIATION_IDS.aircrew[0]]) for(const membership of ['cadet', 'senior']) assert.equal(vm.runInContext('isBadgeEligibleForMembership', context)(id, membership), true, `${id} for ${membership}`);
  // A cadet with a Mission Observer and a Mission Scanner (the member search print): the Observer badge, in the setup and on the list.
  const r = runImport(PERSONNEL);
  assert.ok(r.parsed.authorizedBadges.includes(AVIATION_IDS.observer[0]));
  assert.ok(!r.parsed.authorizedBadges.includes(AVIATION_IDS.aircrew[0]), 'the observer is worn as the observer');
  assert.ok(r.badges.includes(AVIATION_IDS.observer[0]), 'the setup holds it');
  assert.ok(r.parsed.notes.includes('Observer Badge: taken from the Mission Observer qualification, since the report names no observer badge. Change it in the badge list.'));
});

test('the aviation badges the import wears: the setup keeps one, the picker offers the rest, nothing else changes in the fixtures', () => {
  // The three fixtures name no aviation badge and hold no aircrew qualification: the import adds none (the senior fixture's Mission Scanner brings the Air Crew badge, tested above).
  for(const text of [FIXTURE, SENIOR_NO_AIRCREW, fs.readFileSync(path.join(__dirname, 'fixtures', 'eservices-member-details-cadet-live12.txt'), 'utf8')]){
    assert.deepEqual(aviationIn(parseAviation(text).authorized), []);
  }
  // A senior with a pilot, an observer and an aircrew badge: all offered, the pilot worn.
  const s = runImport(seniorWith('Decorations', ['Senior Pilot Wings 01 Jan 2020', 'Master Observer Wings 01 Jan 2021', 'Senior Air Crew Wings 01 Jan 2019']));
  assert.deepEqual(aviationIn(s.parsed.authorizedBadges), [AVIATION_IDS.pilot[1], AVIATION_IDS.aircrew[1], AVIATION_IDS.observer[2]]);
  assert.deepEqual(aviationIn(s.badges), [AVIATION_IDS.pilot[1]]);
});

// ---- Failure handling and the PDF reader (I2) ---------------------------------------------------------------------------------------
// A file in, the page as the Import button runs it. `files` are objects with the parts of a File the importer reads.
function fileLike(name, type, body, size){
  const text = typeof body === 'string' ? body : '';
  return { name, type, size: size === undefined ? text.length : size, text: async () => text, arrayBuffer: async () => new TextEncoder().encode(text).buffer };
}
const STUBS = `for(const n of ['buildRibbonGallery','rebuildRibbonsFromGallery','buildBadgeGallery','rebuildBadgesFromGallery','fullRender','refreshUI',
  'populateRankSetup','updateSetupGates','highlightActiveUniformButton','applyMemberTypeToUniformOptions','syncCadetFirstSergeantControl',
  'renderCACShoulderCord','syncShoulderCordControl','clearUnauthorizedPatchesForCurrentUniform']) globalThis[n] = function(){};`;
async function importFile(file, { before = '', pdf = null } = {}){
  const { context, referenceErrors } = loadPageScripts();
  assert.deepEqual(referenceErrors, []);
  vm.runInContext(STUBS, context);
  if(before) vm.runInContext(before, context);
  if(pdf) context.pdfjsLib = pdf;
  const result = await vm.runInContext('(file) => importMemberReportFile(file)', context)(file);
  const state = JSON.parse(vm.runInContext(`JSON.stringify({ membership: State.membership, rank: State.rank, gender: State.gender, ribbons: Object.entries(State.ribbonSelections).filter(([, s]) => s.checked).map(([id]) => id), badges: State.badges, patches: State.patches, text: State.text })`, context));
  return { result, state, context };
}
const BUILD_BEFORE = `normalizeRibbonSelections(); State.membership = 'senior'; State.rank = 'Maj'; State.gender = 'female'; State.ribbonSelections.cap_membership_ribbon.checked = true; State.badges = ['solo_badge'];`;
const KEPT = { membership: 'senior', rank: 'Maj', gender: 'female', ribbons: ['cap_membership_ribbon'], badges: ['solo_badge'] };
const assertKept = state => { for(const [k, v] of Object.entries(KEPT)) assert.deepEqual(state[k], v, `${k} is the build the member had`); };

test('only a PDF or a text file is a report file', () => {
  const { context } = loadPageScripts();
  const kind = (name, type) => vm.runInContext('(a, b) => memberReportFileKind({ name: a, type: b })', context)(name, type);
  assert.equal(kind('member.PDF', ''), 'pdf');
  assert.equal(kind('download', 'application/pdf'), 'pdf');
  assert.equal(kind('report.txt', ''), 'text');
  assert.equal(kind('report', 'text/plain'), 'text');
  for(const [n, t] of [['report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['shot.png', 'image/png'], ['report.html', 'text/html'], ['report', ''], ['data.json', 'application/json']])
    assert.equal(kind(n, t), null, n);
});

test('a file that is not a PDF or text, too large, empty, or not a member report ends in one plain sentence and leaves the build as it was', async () => {
  const cases = [
    [fileLike('report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'PK'), /^That file is not a PDF or a text file\./, 'type'],
    [fileLike('shot.png', 'image/png', ''), /^That file is not a PDF or a text file\./, 'type'],
    [fileLike('huge.txt', 'text/plain', 'x', 3 * 1024 * 1024), /^That file is too large to be a member report \(the limit is 2 MB\)\.$/, 'size'],
    [fileLike('huge.pdf', 'application/pdf', 'x', 13 * 1024 * 1024), /^That file is too large to be a member report \(the limit is 12 MB\)\.$/, 'size'],
    [fileLike('empty.txt', 'text/plain', ''), /^That file is empty\.$/, 'empty'],
    [fileLike('blank.txt', 'text/plain', ' \n\t ​﻿'), /^That file is empty\.$/, 'empty'],
    [fileLike('notes.txt', 'text/plain', 'Lorem ipsum dolor sit amet. Shopping list: eggs, milk, bread, 12 Jan 2024.'), /^That does not look like a CAP member report/, 'notReport'],
    [fileLike('resume.txt', 'text/plain', 'Jane Doe, Senior Engineer. Experience: Acme 01 Jan 2015 to 01 Jan 2020. Education: State University. Awards: Employee of the Year.'), /^That does not look like a CAP member report/, 'notReport']
  ];
  for(const [file, message, code] of cases){
    const { result, state } = await importFile(file, { before: BUILD_BEFORE });
    assert.equal(result.ok, false, file.name);
    assert.equal(result.code, code, file.name);
    assert.equal(result.lines.length, 1, `${file.name}: one sentence`);
    assert.match(result.lines[0], message, file.name);
    assertKept(state);
  }
});

test('a report with its sections but nothing readable in it changes nothing, and says so', async () => {
  const { result, state } = await importFile(fileLike('empty-report.txt', 'text/plain', 'Printer Friendly View - Member Details\nGeneral Information\nCAPID Name Gender Type Rank Date of Rank Joined Expires Status Unit\nDuty Positions\nProfessional Development\nSpecialty Tracks\nCadet Training\nActivity Date Completed\nLocal Activities\nActivity Date\n'), { before: BUILD_BEFORE });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'nothing');
  assert.match(result.lines[0], /^The sections of a report are in the file, but nothing in them could be read, so nothing was changed\.$/);
  assertKept(state);
});

test('a real report file is imported through the same path, as a text file or as the text of a PDF', async () => {
  const { result, state } = await importFile(fileLike('member.txt', 'text/plain', FIXTURE), { before: BUILD_BEFORE });
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'text');
  assert.equal(state.membership, 'cadet');
  assert.equal(state.rank, 'C/Col');
  assert.ok(result.lines[0] === 'Imported the report.');
  assert.ok(!state.ribbons.includes('cap_membership_ribbon'), 'the earlier build is replaced by the report');
});

// pdf.js is stood in for by an object with its calls: what is asserted is how the importer opens a file and what it does with the pages.
function fakePdf({ pages = [['Printer Friendly View - Member Details', 'General Information']], opens = null, calls = {} } = {}){
  return {
    GlobalWorkerOptions: {},
    getDocument(options){
      calls.options = options;
      return { promise: opens ? Promise.reject(opens) : Promise.resolve({
        numPages: pages.length,
        getPage: async n => ({ getTextContent: async () => ({ items: pages[n - 1].map(str => ({ str })) }) }),
        destroy: async () => { calls.destroyed = true; }
      }) };
    }
  };
}

test('pdf.js opens a member\'s PDF with script evaluation off, no forms, fonts or streaming, and the document is released afterwards', async () => {
  const calls = {};
  const { context } = await importFile(fileLike('m.pdf', 'application/pdf', '%PDF-1.4'), { pdf: fakePdf({ pages: [['Printer Friendly View - Member Details', 'C/Col Guiseppe Mitchell'], ['General Information']], calls }) });
  const text = await vm.runInContext('(f) => extractMemberReportText(f)', context)(fileLike('m.pdf', 'application/pdf', '%PDF-1.4'));
  assert.equal(text, 'Printer Friendly View - Member Details C/Col Guiseppe Mitchell\nGeneral Information');
  assert.equal(calls.options.isEvalSupported, false, 'a hostile PDF cannot compile code in the page');
  assert.equal(calls.options.enableXfa, false);
  assert.equal(calls.options.disableFontFace, true);
  assert.equal(calls.options.disableAutoFetch, true);
  assert.equal(calls.options.disableStream, true);
  assert.equal(calls.options.disableRange, true);
  assert.equal(Object.prototype.toString.call(calls.options.data), '[object Uint8Array]');
  assert.ok(calls.options.maxImageSize > 0);
  assert.equal(calls.destroyed, true);
});

test('a PDF with no text, too many pages, a password or a broken structure ends in one plain sentence and leaves the build', async () => {
  const cases = [
    [fakePdf({ pages: [[], []] }), /^That PDF has no text to read: it is a scan or a picture\./, 'empty'],
    [fakePdf({ pages: Array.from({ length: 61 }, () => ['x']) }), /^That PDF has more than 60 pages, too many for a member report\.$/, 'size'],
    [fakePdf({ opens: { name: 'PasswordException', message: 'No password given' } }), /^That PDF is locked with a password/, 'pdf'],
    [fakePdf({ opens: { name: 'InvalidPDFException', message: 'Invalid PDF structure.' } }), /^That PDF could not be opened\. Save the member report as a PDF again/, 'pdf']
  ];
  for(const [pdf, message, code] of cases){
    const { result, state } = await importFile(fileLike('m.pdf', 'application/pdf', '%PDF-1.4'), { pdf, before: BUILD_BEFORE });
    assert.equal(result.ok, false);
    assert.equal(result.code, code);
    assert.match(result.lines[0], message);
    assert.ok(!/Invalid PDF structure|Exception/.test(result.lines[0]), 'no library wording');
    assertKept(state);
  }
});

// ---- Reports as a PDF or a copy delivers them (I2) -----------------------------------------------------------------------------------
// The fixtures, each changed the way a PDF, a browser print or another notation would change it. What the importer reads from the changed
// text is what it reads from the fixture: the same grade, name, ribbons with their clasps and stars, badges, patches and cord.
let signatureParser = null;
function signature(text){
  if(!signatureParser){
    const { context } = loadPageScripts();
    signatureParser = t => JSON.parse(vm.runInContext('(t) => JSON.stringify((() => { const p = parseCapMemberReport(t); return { membership: p.membership, gender: p.gender, rank: p.rank, name: [p.firstName, p.lastName], ribbons: (p.ribbons || []).map(r => r.id + "=" + r.value).sort(), badges: [...p.badges].sort(), authorized: [...p.authorizedBadges].sort(), patches: [...(p.patches || [])].sort(), cord: p.shoulderCord || null, firstSergeant: p.cadetFirstSergeant, charter: p.unitPatchCharter || null, command: p.commandStatus || null }; })())', context)(t));
  }
  return signatureParser(text);
}
const FIXTURE_FILES = ['eservices-member-details-cadet.txt', 'eservices-member-details-cadet-live12.txt', 'eservices-member-details-senior-live13.txt', 'eservices-member-details-senior-past-commander.txt', 'eservices-member-details-cadet-personnel.txt'];
const fixtureText = name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const redate = fn => t => t.replace(/\b(\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})\b/g, (m, d, mo, y) => fn(d, MONTHS.indexOf(mo), y));
const two = n => String(n + 1).padStart(2, '0');
const withFurniture = t => t.split('\n').flatMap((l, i) => i % 9 === 8 ? [l, 'https://www.capnhq.gov/CAP.eServices.Web/Member/Details 2/3', '11/10/26, 4:02 PM', 'Printer Friendly View - Member Details', 'Page 2 of 3'] : [l]).join('\n');
const REPORT_VARIANTS = {
  'one line, as the text of a PDF is joined': t => t.replace(/\n/g, ' '),
  'a page per paragraph': t => { const L = t.split('\n'), a = Math.floor(L.length / 3); return [L.slice(0, a), L.slice(a, 2 * a), L.slice(2 * a)].map(p => p.join(' ')).join('\n'); },
  'a browser\'s print header and footer between rows': withFurniture,
  'the same on one line': t => withFurniture(t).replace(/\n/g, ' '),
  'double spaces, tabs and non-breaking spaces': t => t.replace(/ /g, '  ').replace(/\n/g, ' \t\n').replace(/Cadet Training/, 'Cadet Training'),
  'zero-width characters and soft hyphens inside the words': t => t.replace(/(\w)(\w)/g, '$1​$2').replace(/Award/g, 'A­ward'),
  'Windows line ends and a byte order mark': t => '﻿' + t.replace(/\n/g, '\r\n'),
  'rows wrapped inside their names': t => t.replace(/(Commander's|Certificate of Recognition|Community Service|Cadet Advisory|Achievement Award|Crisis Service|Air Search and|Brig Gen Charles E\.) /g, '$1\n'),
  'no Awards heading': t => t.replace(/\nAwards\n/, '\n'),
  'no Decorations heading': t => t.replace(/\nDecorations\n/, '\n'),
  'dates as 2025-12-18': redate((d, m, y) => `${y}-${two(m)}-${d}`),
  'dates as 12/18/2025': redate((d, m, y) => `${two(m)}/${d}/${y}`),
  'dates as Dec 18, 2025': redate((d, m, y) => `${MONTHS[m]} ${Number(d)}, ${y}`),
  'dates as 18-Dec-2025': redate((d, m, y) => `${d}-${MONTHS[m]}-${y}`),
  'dates as 18 December 2025': redate((d, m, y) => `${d} ${FULL_MONTHS[m]} ${y}`),
  'every dated row printed twice': t => { let on = false; return t.split('\n').flatMap(l => { if(/^(Decorations|Activity\/Service Ribbon)$/.test(l)) on = true; else if(/^(Local Activities|Awards|Promotions)$/.test(l)) on = false; return on && /\d{4}$/.test(l) ? [l, l] : [l]; }).join('\n'); },
  'qualifications as Qualified and Training': t => t.replace(/QUALIFIED/g, 'Qualified').replace(/TRAINING/g, 'Training'),
  'a Transfer History and a Committees table before Local Activities': t => t.replace('Local Activities', 'Transfer History\nUnit Date\nGLR-IL-001 01 Jan 2019\nCurrent Committees\nCommittee Date\nCadet Advisory Council 01 Jan 2020\nLocal Activities'),
  'the headings in capitals': t => t.replace(/^(Duty Positions|Professional Development|Specialty Tracks|Cadet Training|Encampments|Decorations|Awards)$/gm, h => h.toUpperCase())
};
test('the fixtures read the same however a PDF, a browser print or another notation delivers them', () => {
  const different = [];
  for(const file of FIXTURE_FILES){
    const text = fixtureText(file), base = signature(text);
    for(const [what, change] of Object.entries(REPORT_VARIANTS)){
      const got = signature(change(text));
      for(const key of Object.keys(base)) if(JSON.stringify(base[key]) !== JSON.stringify(got[key])) different.push(`${file} / ${what}: ${key} ${JSON.stringify(base[key])} -> ${JSON.stringify(got[key])}`.slice(0, 260));
    }
  }
  assert.deepEqual(different, []);
});

test('the cleaning is done once: cleaning the clean text changes nothing, and the rows of a report are not lost', () => {
  const { context } = loadPageScripts();
  const clean = t => vm.runInContext('(t) => normalizeMemberReportText(t)', context)(t);
  for(const file of FIXTURE_FILES){
    const once = clean(withFurniture(fixtureText(file)));
    assert.equal(clean(once), once, file);
    assert.ok(!/https?:|Page 2 of 3|4:02 PM/.test(once), `${file}: the print furniture is gone`);
    assert.equal((once.match(/Printer Friendly View - Member Details/g) || []).length, 1, `${file}: the title once`);
  }
  assert.equal(clean('Achievement Award 01 Feb 2022 Achievement Award 01 Feb 2022 Achievement Award 05 Jun 2022'), 'Achievement Award 01 Feb 2022 Achievement Award 05 Jun 2022');
  assert.equal(clean('1/2 and 2025-13-45 and 15/20/2024'), '1/2 and 2025-13-45 and 15/20/2024', 'a number that is no date is left as it is');
  assert.equal(clean('Joined 12/18/2025 and 18/12/2025'), 'Joined 18 Dec 2025 and 18 Dec 2025', 'month first, or day first when the first number is above 12');
});

test('two awards of the same name on different days are two awards, only a row printed twice is one', () => {
  const cadet = runImport(cadetWith('Decorations', ['Achievement Award 01 Feb 2022', 'Achievement Award 05 Jun 2022']));
  assert.match(cadet.selected.cap_achievment_award.awardLabel, /4th Award/, 'the fixture has four, dated apart');
  const doubled = runImport(FIXTURE.replace('Achievement Award 01 Feb 2022\n', 'Achievement Award 01 Feb 2022\nAchievement Award 01 Feb 2022\n'));
  assert.match(doubled.selected.cap_achievment_award.awardLabel, /4th Award/, 'a repeated row is not a fifth');
});

test('Local Activities hold nothing the import uses: not a patch, not a badge, not a unit', () => {
  const local = FIXTURE.replace('Spaatz Award Presentation 01 May 2025', 'Model Rocketry Day 01 May 2025\nCadet Officer School reunion 02 May 2025\nNational Blue Beret briefing 03 May 2025\nSER-TN-185 visit 04 May 2025');
  const base = signature(FIXTURE), got = signature(local);
  assert.deepEqual(got, base);
  assert.ok(!got.badges.includes('model_rocketry_badge') && !got.patches.includes('nbb_patch'));
});

// ---- What the import tells the member (I2) ----------------------------------------------------------------------------------------------
const linesText = lines => lines.flatMap(l => typeof l === 'string' ? [l] : l.heading ? [`# ${l.heading}`] : l.fold ? [`> ${l.fold}`, ...l.items.map(i => `- ${i}`)] : [`- ${l.item}`]);
const foldOf = lines => { const f = lines.find(l => l && typeof l === 'object' && 'fold' in l); return f ? f.items : null; };
const groupOf = (lines, heading) => { const i = lines.findIndex(l => l && l.heading === heading); if(i < 0) return null; const out = []; for(let j = i + 1; j < lines.length && lines[j] && typeof lines[j] === 'object' && 'item' in lines[j]; j++) out.push(lines[j].item); return out; };

test('the panel says what was read and what is on the build, then what was held off the uniform, with the reason', async () => {
  const { result } = await importFile(fileLike('member.txt', 'text/plain', FIXTURE));
  assert.equal(result.lines[0], 'Imported the report.');
  assert.equal(result.lines[1], 'Read: cadet, male, C/Col, Guiseppe Mitchell.');
  assert.match(result.lines[2], /^On the build: 20 ribbons, 0 badges, 0 patches\.$/);
  const held = groupOf(result.lines, 'Held off the uniform');
  assert.ok(held, 'the patches the report matched are not on the Blues');
  assert.match(held[0], /^Pararescue Orientation Course Patch and Cadet Officer School Patch: not worn on Blues.*Patches are worn on the field and flight uniforms; add them under Patches there\.$/);
});

test('a report that holds nothing back, with nothing unread, has no held off or not understood group', async () => {
  const { result } = await importFile(fileLike('member.txt', 'text/plain', FIXTURE.replace(/NCSA Pararescue Orientation Course \(PJOC\) 10 Jul 2022\n/, '').replace('Cadet Officers School (COS) 15 Jun 2024\n', '')));
  assert.equal(groupOf(result.lines, 'Held off the uniform'), null);
  assert.equal(groupOf(result.lines, 'Not understood'), null);
});

test('a row of the awards tables that no ribbon matches is listed, in the report\'s words; the rows that are read are not', async () => {
  const text = cadetWith('Decorations', ['Distinguished Flying Cross Plus 01 Jan 2024', 'Wing Commander Coin of Merit 05 Feb 2024']);
  const { result } = await importFile(fileLike('member.txt', 'text/plain', text));
  const unread = groupOf(result.lines, 'Not understood');
  assert.deepEqual(unread, ['Distinguished Flying Cross Plus 01 Jan 2024: no ribbon or badge matches this row.', 'Wing Commander Coin of Merit 05 Feb 2024: no ribbon or badge matches this row.']);
  // The same on the line a PDF makes, and a row printed twice is listed once.
  const oneLine = await importFile(fileLike('member.pdf.txt', 'text/plain', text.replace(/\n/g, ' ')));
  assert.deepEqual(groupOf(oneLine.result.lines, 'Not understood'), unread);
  const twice = await importFile(fileLike('member.txt', 'text/plain', cadetWith('Decorations', ['Distinguished Flying Cross Plus 01 Jan 2024', 'Distinguished Flying Cross Plus 01 Jan 2024'])));
  assert.deepEqual(groupOf(twice.result.lines, 'Not understood'), ['Distinguished Flying Cross Plus 01 Jan 2024: no ribbon or badge matches this row.']);
  // None of the fixtures lists a row it does not read.
  for(const file of FIXTURE_FILES){
    const r = await importFile(fileLike(file, 'text/plain', fixtureText(file)));
    assert.equal(groupOf(r.result.lines, 'Not understood'), null, file);
  }
});

test('a report without its grade row says what it could not read and what the build has instead', async () => {
  const noRow = FIXTURE.replace(/123456 MITCHELL, GUISEPPE MALE CADET C\/Col 18 Dec 2025 24 Sep 2019 30 Sep 2027 ACTIVE GLR-IL-049\n/, '').replace('C/Col Guiseppe Mitchell', 'Guiseppe Mitchell');
  const fresh = (await importFile(fileLike('member.txt', 'text/plain', noRow.replace('Guiseppe Mitchell\n', '')))).result;
  const unread = groupOf(fresh.lines, 'Not understood');
  assert.ok(unread.includes('The grade was not found, so none is chosen.'), unread.join(' | '));
  assert.ok(unread.includes('The gender was not found, so no cut is chosen.'));
  assert.ok(unread.includes('The name was not found, so the uniform has no name.'));
  assert.ok(unread.includes('The join date was not found, so the Red Service Ribbon is not added.'));
  assert.ok(!unread.some(line => /grade row/.test(line)), 'the panel never says "grade row"');
  // Over a build with a name, a grade and a cut: they are kept, and the panel names them.
  const kept = (await importFile(fileLike('member.txt', 'text/plain', noRow.replace('Guiseppe Mitchell\n', '')), { before: BUILD_BEFORE + " State.membership = 'cadet'; State.rank = 'C/Maj'; State.text = { firstName: 'Ann', lastName: 'Lee', show: true };" }));
  const keptLines = groupOf(kept.result.lines, 'Not understood');
  assert.ok(keptLines.includes('The grade was not found, so the grade on the build (C/Maj) was kept.'), keptLines.join(' | '));
  assert.ok(keptLines.includes("The gender was not found, so the women's cut on the build was kept."));
  assert.ok(keptLines.includes('The name was not found, so the name on the uniform was kept.'));
  assert.equal(kept.state.rank, 'C/Maj');
  assert.ok(kept.result.lines[1] === 'Read: cadet.' || /^Read: /.test(kept.result.lines[1]));
  assert.ok(!/C\/Maj|Ann|Lee/.test(kept.result.lines[1]), 'what was kept is not shown as read: ' + kept.result.lines[1]);
});

test('a grade written "C/ Col" is read, and a row that does not parse still gives the join date and the Red Service Ribbon', async () => {
  const spaced = runImport(FIXTURE.replace(/C\/Col/g, 'C/ Col'));
  assert.equal(spaced.parsed.rank, 'C/Col');
  assert.equal(spaced.rank, 'C/Col');
  assert.deepEqual([spaced.text.firstName, spaced.text.lastName], ['Guiseppe', 'Mitchell']);
  const lt = runImport(FIXTURE.replace(/C\/Col/g, 'C/ Lt Col'));
  assert.equal(lt.parsed.rank, 'C/Lt Col');
  const base = signature(FIXTURE).ribbons;
  for(const [what, row] of [['no gender word', '123456 MITCHELL, GUISEPPE CADET C/Col 18 Dec 2025 24 Sep 2019 30 Sep 2027 ACTIVE GLR-IL-049'],
    ['UNKNOWN gender', '123456 MITCHELL, GUISEPPE UNKNOWN CADET C/Col 18 Dec 2025 24 Sep 2019 30 Sep 2027 ACTIVE GLR-IL-049'],
    ['no type word', '123456 MITCHELL, GUISEPPE MALE C/Col 18 Dec 2025 24 Sep 2019 30 Sep 2027 ACTIVE GLR-IL-049'],
    ['a grade nobody knows', '123456 MITCHELL, GUISEPPE MALE CADET C/Colonel 18 Dec 2025 24 Sep 2019 30 Sep 2027 ACTIVE GLR-IL-049'],
    ['no grade', '123456 MITCHELL, GUISEPPE MALE CADET 18 Dec 2025 24 Sep 2019 30 Sep 2027 ACTIVE GLR-IL-049']]){
    const got = signature(FIXTURE.replace('123456 MITCHELL, GUISEPPE MALE CADET C/Col 18 Dec 2025 24 Sep 2019 30 Sep 2027 ACTIVE GLR-IL-049', row)).ribbons;
    assert.deepEqual(got.filter(r => /^red_service_ribbon/.test(r)), base.filter(r => /^red_service_ribbon/.test(r)), what);
  }
  // No join date at all: no Red Service Ribbon, and the panel says why.
  const none = await importFile(fileLike('member.txt', 'text/plain', FIXTURE.replace('18 Dec 2025 24 Sep 2019 30 Sep 2027', '').replace(/C\/Col 18/, 'C/Col 18')));
  assert.ok(none.result.lines.some(l => l && l.item === 'The join date was not found, so the Red Service Ribbon is not added.'));
});

test('a gender, grade or member type the report does not give is told, whatever the member had before', async () => {
  const noGender = FIXTURE.replace('GUISEPPE MALE CADET', 'GUISEPPE CADET');
  const { result, state } = await importFile(fileLike('member.txt', 'text/plain', noGender), { before: BUILD_BEFORE });
  assert.ok(groupOf(result.lines, 'Not understood').includes("The gender was not found, so the women's cut on the build was kept."));
  assert.equal(state.gender, 'female', 'the cut the member had');
});

test('what the member had is replaced, and the panel says Undo brings it back; a first import says nothing of the kind', async () => {
  const first = await importFile(fileLike('member.txt', 'text/plain', FIXTURE));
  assert.ok(!first.result.lines.some(l => /earlier ribbons/.test(l)));
  const again = await importFile(fileLike('member.txt', 'text/plain', FIXTURE), { before: BUILD_BEFORE });
  assert.ok(again.result.lines.includes('Your earlier ribbons, badges and patches were replaced by the report. Undo brings them back.'));
});

test('a row printed twice, and the badges beyond four, are told in the panel', async () => {
  const twice = await importFile(fileLike('member.txt', 'text/plain', FIXTURE.replace('Achievement Award 01 Feb 2022\n', 'Achievement Award 01 Feb 2022\nAchievement Award 01 Feb 2022\n')));
  assert.ok(foldOf(twice.result.lines).includes('1 row listed twice in the report was counted once.'), 'a row counted once changes nothing for the member: it is in the fold');
  assert.ok(!(groupOf(twice.result.lines, 'Notes') || []).some(n => /listed twice/.test(n)));
  const tracks = SENIOR.replace('STANDARDIZATION/EVALUATION TECHNICIAN 01 Jun 2022', 'STANDARDIZATION/EVALUATION TECHNICIAN 01 Jun 2022\nOPERATIONS MASTER 01 Jun 2023\nPERSONNEL MASTER 01 Jun 2023\nFINANCE MASTER 01 Jun 2023\nLOGISTICS MASTER 01 Jun 2023');
  const many = await importFile(fileLike('member.txt', 'text/plain', tracks));
  const held = groupOf(many.result.lines, 'Held off the uniform');
  assert.ok(held && held.some(line => /: only four badges are worn at a time \(CAPR 39-1, 4\.1\.5\.2\.2\.4\); the others are listed under Authorized by member report in the badge list\.$/.test(line)), JSON.stringify(held));
});

test('a ribbon the membership is not offered is named with the reason, not dropped', async () => {
  const { context } = await importFile(fileLike('member.txt', 'text/plain', FIXTURE));
  const lines = JSON.parse(vm.runInContext(`(() => { State.membership = 'cadet'; return JSON.stringify(memberReportHeldOffLines({ patches: [], badges: [], authorizedBadges: [], ribbons: [{ id: 'cap_senior_recruiter_ribbon' }] })); })()`, context));
  assert.deepEqual(lines, ['Senior Recruiter Ribbon: not offered to cadet members.']);
});

test('the panel is built as text: a file name or a row with markup in it is shown as written, never run', () => {
  const { context } = loadPageScripts();
  const made = [];
  const node = () => { const n = { style: {}, children: [], appendChild(c){ this.children.push(c); }, set innerHTML(v){ made.push(`innerHTML set: ${v}`); }, textContent: '' }; return n; };
  const panel = node();
  context.document = { createElement: () => node(), querySelectorAll: () => [], getElementById: id => id === 'memberReportImportStatus' ? panel : null };
  vm.runInContext(`setMemberReportImportStatus(['Imported <img src=x onerror=alert(1)>.txt.', { heading: '<b>Held</b>' }, { item: '<script>alert(1)</script> & more' }], 'ok')`, context);
  assert.deepEqual(made, [], 'no markup was set');
  assert.deepEqual(panel.children.map(c => c.textContent), ['Imported <img src=x onerror=alert(1)>.txt.', '<b>Held</b>', '– <script>alert(1)</script> & more']);
  assert.equal(panel.style.color, 'var(--ok)');
});

// ---- Command pins by command (CAPR 39-1, 10.2.5) (I2) -----------------------------------------------------------------------------------
test('a current commander of a group wears the group pin, a current commander of a unit the squadron pin, one pin only', () => {
  const unit = runImport(SENIOR);
  assert.deepEqual(unit.parsed.badges.filter(id => /_commander_badge$/.test(id)), ['squadron_commander_badge']);
  const group = runImport(SENIOR.replace('Commander GLR-IL-049 UNIT No 01 Jan 2025', 'Commander GLR-IL-001 GROUP No 01 Jan 2025'));
  assert.deepEqual(group.parsed.badges.filter(id => /_commander_badge$/.test(id)), ['group_commander_badge']);
  assert.deepEqual(group.badges.filter(id => /_commander_badge$/.test(id)), ['group_commander_badge'], 'the setup holds the group pin');
  assert.equal(group.commandInsignia.graduatedCommander, false);
  assert.ok(group.parsed.notes.some(n => /^Current commander duty found: the Group Commander command insignia pin is worn over the name tag \(CAPR 39-1, 10\.2\.5\)\.$/.test(n)));
  assert.ok(group.ribbon('cap_command_service_ribbon'), 'the ribbon is still the Command Service Ribbon');
  // Both at once: one pin, the group's.
  const both = runImport(SENIOR.replace('Commander GLR-IL-049 UNIT No 01 Jan 2025', 'Commander GLR-IL-049 UNIT No 01 Jan 2025\nCommander GLR-IL-001 GROUP No 01 Jan 2025'));
  assert.deepEqual(both.parsed.badges.filter(id => /_commander_badge$/.test(id)), ['group_commander_badge']);
  // A previous member's pin does not stay.
  const after = runImport(SENIOR.replace('Commander GLR-IL-049 UNIT No 01 Jan 2025\n', ''), "State.badges = ['group_commander_badge']; State.commandInsignia = { graduatedCommander: true };");
  assert.deepEqual(after.badges.filter(id => /_commander_badge$/.test(id)), []);
  assert.equal(after.commandInsignia.graduatedCommander, false);
});

test('a graduated group commander keeps the squadron pin: the regulation does not say which pin a graduated commander wears', () => {
  const past = runImport(SENIOR.replace('Commander GLR-IL-049 UNIT No 01 Jan 2025\n', '').replace('Deputy Commander for Cadets GLR-IL-049 UNIT No 01 Jan 2019 31 Dec 2022', 'Commander GLR-IL-001 GROUP No 01 Jan 2019 31 Dec 2022'));
  assert.deepEqual(past.parsed.badges.filter(id => /_commander_badge$/.test(id)), ['squadron_commander_badge']);
  assert.equal(past.commandInsignia.graduatedCommander, true);
});

// ---- Privacy and safety (I2) ------------------------------------------------------------------------------------------------------------
test('the importer makes no network request, stores nothing, and writes no markup', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'member-report-import.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for(const sink of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /postMessage/, /FormData/,
    /\.innerHTML\b/, /insertAdjacentHTML/, /outerHTML/, /document\.write/, /\beval\s*\(/, /new Function/])
    assert.doesNotMatch(src, sink, String(sink));
  // The one script it adds is the vendored PDF reader, from the site's own folder.
  assert.deepEqual([...src.matchAll(/const PDFJS_URL = '([^']+)'/g)].map(m => m[1]), ['vendor/pdfjs/pdf.min.js']);
  assert.equal([...src.matchAll(/\.src = /g)].length, 1);
});

test('the report is not kept: after an import the setup holds the derived build, not the CAPID, the rows or the file', async () => {
  const text = FIXTURE.replace('Decorations\n', 'Decorations\nDistinguished Flying Cross Plus 01 Jan 2024\n');
  const { context } = await importFile(fileLike('private-member-file.txt', 'text/plain', text), { before: BUILD_BEFORE });
  const held = vm.runInContext('JSON.stringify(State)', context);
  for(const secret of ['123456', 'MITCHELL, GUISEPPE', 'Distinguished Flying Cross', 'Spaatz Award Presentation', 'private-member-file', 'Date Completed', 'Printer Friendly View', '24 Sep 2019', '30 Sep 2027'])
    assert.ok(!held.includes(secret), `the setup holds "${secret}"`);
  assert.ok(vm.runInContext('Array.isArray(State.reportAuthorizedBadgeIds) && State.reportAuthorizedBadgeIds.every(id => badgeList.includes(id))', context), 'only badge ids');
  assert.ok(held.includes('Guiseppe') && held.includes('Mitchell'), 'the name the member put on the uniform is the one thing taken');
});

test('a name read from the report is letters, apostrophes, periods and hyphens only, whatever the report holds', () => {
  const evil = FIXTURE.replace('C/Col Guiseppe Mitchell', 'C/Col <img src=x onerror=alert(1)> Guiseppe "Mitchell"').replace('123456 MITCHELL, GUISEPPE MALE', '<b>123456</b> <i>MITCHELL</i>, <u>GUISEPPE</u> MALE');
  const r = runImport(evil);
  const name = `${r.text.firstName}${r.text.lastName}`;
  assert.match(name, /^[\p{L}'’.\- ]*$/u, JSON.stringify(r.text));
});

test('a stale choice of which badge a position shows does not outlive the badges it chose among', () => {
  const r = runImport(FIXTURE, "State.badgeChoices = { blues_a: { aviation: 'solo_badge' } };");
  assert.deepEqual(r.badgeChoices, {});
});

// ---- Awards counted once, and the cadet awards a senior does not wear (I2) --------------------------------------------------------------
test('an award earned once is one row however many of its names the row prints: no "2 records found" for one Falcon Award or Crossfield Award', () => {
  const cadet = runImport(cadetWith('Decorations', ['Frank Borman Falcon Award 01 Jan 2024']));
  assert.equal(cadet.ribbon('frank_borman_falcon_award').value, 'earned');
  assert.ok(!cadet.parsed.notes.some(n => /records found; the ribbon picker offers at most/.test(n)), cadet.parsed.notes.join(' | '));
  const senior = runImport(seniorWith('Decorations', ['A. Scott Crossfield Award 01 Jan 2024']));
  assert.ok(senior.ribbon('cap_a_scott_crossfield_ribbon'));
  assert.ok(!senior.parsed.notes.some(n => /records found; the ribbon picker offers at most/.test(n)));
});

test('the cadet award ribbons a senior member does not wear are counted in a note, not dropped silently (a milestone outranks the achievements)', () => {
  const r = runImport(SENIOR);
  assert.ok(r.parsed.notes.some(n => /^8 cadet award ribbons are left off: a senior member wears one cadet award ribbon, the highest, and may wear every milestone medal earned as a miniature \(CAPR 39-1, 11\.1\.4\)\.$/.test(n)), r.parsed.notes.join(' | '));
  assert.ok(!runImport(FIXTURE).parsed.notes.some(n => /cadet award ribbons? (?:is|are) left off/.test(n)), 'a cadet loses nothing');
  const falcon = runImport(seniorWith('Decorations', ['Frank Borman Falcon Award 01 Jan 2024']));
  assert.ok(falcon.parsed.notes.some(n => /^9 cadet award ribbons are left off/.test(n)), 'the Falcon Award is counted with them');
});

// ---- The words of the panel (I2) -----------------------------------------------------------------------------------------------------------
test('what the panel says in the fixtures is plain: no developer word, no id, no abbreviation the member would not know, every paragraph in brackets', async () => {
  const DEVELOPER = /\b(?:queued|auto-?selected|mapp(?:ed|ing)|image ID|configured|detected|table only|Level NONE|builder has no badge for that|ES specialty|MRO|MSA|UDF|GTM\d|CDI|IC\d|final check)\b|_[a-z]/;
  const seen = new Set();
  for(const file of FIXTURE_FILES){
    const { result } = await importFile(fileLike(file, 'text/plain', fixtureText(file)));
    for(const line of linesText(result.lines).slice(1)) seen.add(line);
  }
  const bad = [...seen].filter(l => DEVELOPER.test(l.replace(/GLR-IL-\d+/g, '')));
  assert.deepEqual(bad.map(l => l.slice(0, 120)), []);
  // A paragraph is in brackets at the end of its sentence, never named in the sentence ("CAPR 39-1" only inside them).
  for(const line of seen) for(const m of line.matchAll(/CAPR 39-[13]/g)) assert.ok(line.slice(Math.max(0, m.index - 1), m.index) === '(', `CAPR outside brackets: ${line.slice(0, 100)}`);
});

test('the notes the dated patches write are said in the member\'s words, and anything else is shown as it is', () => {
  const { context } = loadPageScripts();
  const plain = lines => JSON.parse(vm.runInContext('(l) => JSON.stringify(memberReportPlainNoteLines(l))', context)(lines));
  assert.deepEqual(plain([
    'CAC ribbon imported as Group CAC / Basic Ribbon: Cadet Advisory Council Ribbon listed in the report (no level shown; basic ribbon).',
    'CAC ribbon imported as Wing CAC / Bronze Star: Highest qualifying CAC level found in duty assignments: Wing.',
    'Wing CAC shoulder cord - red imported from Current Duty Positions as a current primary representative.',
    'CAC text found, but CAC ribbon was not imported because no completed CAC term of at least 365 days was found in Past Duty Positions. Current CAC primary representative duty only controls the shoulder cord.',
    'CAC text found, but no qualifying CAC Chair, Vice Chair, Representative, or Primary Rep duty assignment was found for automatic CAC ribbon level import.',
    'Member report charter GLR-IL-049 found, but no unit patch image is mapped yet.',
    'Unit patch auto-selected from member report charter GLR-IL-049.',
    'A line nothing rewrites.'
  ]), [
    'Cadet Advisory Council Ribbon: the basic ribbon, since no past council position shows a level.',
    'Cadet Advisory Council Ribbon: Wing level, from your past duty positions.',
    "Wing Cadet Advisory Council shoulder cord: the report shows a position on the council held now, which gives the cord and not the ribbon's star (CAPR 39-3, 21j).",
    "Cadet Advisory Council Ribbon: none chosen, since no past duty position as chair, vice chair or representative of a council was found. A position held now gives the shoulder cord, not the ribbon's star (CAPR 39-3, 21j).",
    'No unit patch is offered for GLR-IL-049 yet.',
    'The unit patch for GLR-IL-049 is chosen.',
    'A line nothing rewrites.'
  ]);
});

test('a name with accents, a hyphen, an apostrophe or a particle is read whole (CAPR 39-1 Attachment 6: a name may carry diacritical accents)', () => {
  const read = (row, heading) => { const r = runImport(FIXTURE.replace('MITCHELL, GUISEPPE', row).replace('C/Col Guiseppe Mitchell', heading)); return [r.text.firstName, r.text.lastName]; };
  assert.deepEqual(read('PEÑA, JOSÉ', 'C/Col José Peña'), ['José', 'Peña']);
  assert.deepEqual(read('MÜLLER, ÉLODIE', 'C/Col Élodie Müller'), ['Élodie', 'Müller']);
  assert.deepEqual(read('LEWIS-MILES, ANNE MARIE', 'C/Col Anne Lewis-Miles'), ['Anne', 'Lewis-Miles']);
  assert.deepEqual(read("O'BRIEN, SEAN", "C/Col Sean O'Brien"), ['Sean', "O'Brien"]);
  assert.deepEqual(read('DE LA CRUZ, MARIA', 'C/Col Maria De La Cruz'), ['Maria', 'De La Cruz']);
  // Without the General Information row, from the heading.
  const heading = runImport(FIXTURE.replace(/123456 MITCHELL, GUISEPPE MALE CADET C\/Col 18 Dec 2025 24 Sep 2019 30 Sep 2027 ACTIVE GLR-IL-049\n/, '').replace('C/Col Guiseppe Mitchell', 'C/Col José Peña'));
  assert.deepEqual([heading.text.firstName, heading.text.lastName], ['José', 'Peña']);
});

// ---- Reading the lines of a PDF (I2) -----------------------------------------------------------------------------------------------------
test('a PDF drawn row by row is read as drawn, one drawn column by column is read by line, and a wrapped cell keeps its words together', async () => {
  const at = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y], height: 10 });
  const rows = [['Achievement Award', '01 Feb 2022'], ['Achievement Award', '05 Jun 2022'], ['Crisis Service Award', '15 Dec 2023']];
  const head = [at('Printer Friendly View - Member Details', 40, 780), at('General Information', 40, 760), at('Decorations', 40, 740)];
  const read = async items => {
    const { context } = await importFile(fileLike('m.pdf', 'application/pdf', '%PDF-1.4'), { pdf: fakePdf({ pages: [[]] }) });
    context.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items }) }), destroy: async () => {} }) }) };
    return vm.runInContext('(f) => extractMemberReportText(f)', context)(fileLike('m.pdf', 'application/pdf', '%PDF-1.4'));
  };
  const byRow = await read([...head, ...rows.flatMap(([n, d], i) => [at(n, 40, 720 - 14 * i), at(d, 400, 720 - 14 * i)])]);
  assert.equal(byRow, 'Printer Friendly View - Member Details General Information Decorations Achievement Award 01 Feb 2022 Achievement Award 05 Jun 2022 Crisis Service Award 15 Dec 2023');
  const byColumn = await read([...head, ...rows.map(([n], i) => at(n, 40, 720 - 14 * i)), ...rows.map(([, d], i) => at(d, 400, 720 - 14 * i))]);
  assert.equal(byColumn, byRow, 'the columns are put back into rows');
  // A cell wrapped onto a second line: the cell's own words stay together in the order drawn.
  const wrapped = await read([...head, at('Commander’s', 40, 720), at('Commendation Award', 40, 708), at('01 Feb 2022', 400, 720)]);
  assert.ok(wrapped.includes('Commander’s Commendation Award'), wrapped);
  // The same text through the whole import: the rows count as the report says.
  const sections = ['Duty Positions', 'Professional Development', 'Specialty Tracks'].map((t, i) => at(t, 40, 750 - i));
  const { result } = await importFile(fileLike('m.pdf', 'application/pdf', '%PDF-1.4'), { pdf: { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [head[0], head[1], ...sections, head[2], ...rows.map(([n], i) => at(n, 40, 720 - 14 * i)), ...rows.map(([, d], i) => at(d, 400, 720 - 14 * i))] }) }), destroy: async () => {} }) }) } });
  assert.equal(result.ok, true);
});

// ---- Importing again, and entries that are no longer current (I2) ---------------------------------------------------------------------
test('importing the same report twice leaves the same build, and a second report replaces the first', async () => {
  const { context } = await importFile(fileLike('a.txt', 'text/plain', fixtureText('eservices-member-details-cadet-live12.txt')));
  const held = () => vm.runInContext(`JSON.stringify({ m: State.membership, r: State.rank, g: State.gender, t: State.text, b: State.badges, p: State.patches, c: State.shoulderCord, rb: Object.entries(State.ribbonSelections).filter(([, s]) => s.checked).map(([id, s]) => id + '=' + s.awardValue).sort() })`, context);
  const once = held();
  const second = await vm.runInContext('(f) => importMemberReportFile(f)', context)(fileLike('a.txt', 'text/plain', fixtureText('eservices-member-details-cadet-live12.txt')));
  assert.equal(held(), once);
  assert.ok(second.lines.includes('Your earlier ribbons, badges and patches were replaced by the report. Undo brings them back.'));
  await vm.runInContext('(f) => importMemberReportFile(f)', context)(fileLike('b.txt', 'text/plain', SENIOR));
  const senior = JSON.parse(held());
  assert.deepEqual([senior.m, senior.r, senior.t.lastName, senior.c], ['senior', '1st Lt', 'Wilson', null], 'nothing of the cadet stays: not the grade, the name, the cord or the cadet ribbons');
  assert.ok(!senior.rb.some(r => /^(?:curry_achievement|cadet_advisory_council_ribbon|cap_achievment_award=bronze_clasp_3)/.test(r)));
});

test('a qualification whose date has passed or whose status is Expired still earns its badge: the Ground Team, Incident Commander and EMT badges are for current or previous holders (CAPR 39-1, 10.4.5 to 10.4.7)', () => {
  const read = status => parseAviation(SENIOR.replace('Ground Team Leader (GTL) QUALIFIED 01 Jan 2027', `Ground Team Leader (GTL) ${status} 01 Jan 2020`)).authorized;
  for(const status of ['QUALIFIED', 'EXPIRED', 'Expired', 'LAPSED']) assert.ok(read(status).includes('master_ground_team_badge'), status);
  assert.ok(!read('TRAINING').includes('master_ground_team_badge'), 'a trainee has no badge');
});

test('the rows not understood are counted past twelve, a Cadet Training row is counted and not listed, and a long file name wraps', async () => {
  const many = cadetWith('Decorations', Array.from({ length: 16 }, (_, i) => `Mystery Award Number ${i} ${String(i + 1).padStart(2, '0')} Jan 2024`));
  const { result } = await importFile(fileLike('member.txt', 'text/plain', many));
  const unread = groupOf(result.lines, 'Not understood');
  assert.equal(unread.filter(l => /no ribbon or badge matches this row\.$/.test(l)).length, 12);
  assert.equal(unread[unread.length - 1], '4 more rows were not understood.');
  // A Cadet Training row is read by the table it is in: an activity of the list, or one the record calls an NCSA, is a credit; a region school is none and is not
  // listed; a row of no list is none and is listed.
  const rows = 'Cadet Training\nActivity Date Completed\nNCSA Cadet Competition Team 05 May 2024\nCadet Competition Team 05 May 2024\nRegion Cadet Leadership School 06 May 2024\n';
  const training = await importFile(fileLike('member.txt', 'text/plain', FIXTURE.replace('Cadet Training\nActivity Date Completed\n', rows)));
  assert.deepEqual(groupOf(training.result.lines, 'Not understood'), ['Cadet Competition Team 05 May 2024: no ribbon or badge matches this row.']);
  assert.deepEqual(runImport(FIXTURE.replace('Cadet Training\nActivity Date Completed\n', rows)).devices('cadet_special_activity_ribbon'), [{ devices: ['star-bronze', 'star-bronze', 'star-bronze'], centered: false }], 'COS, PJOC, a cyber NCSA and the competition team the record calls an NCSA: four activities, the row of no list and the school none');
  // A long unbroken file name wraps inside the panel.
  const { context } = loadPageScripts();
  const panel = { style: {}, children: [], appendChild(c){ this.children.push(c); }, textContent: '' };
  context.document = { createElement: () => ({ style: {}, textContent: '' }), querySelectorAll: () => [], getElementById: id => id === 'memberReportImportStatus' ? panel : null };
  vm.runInContext(`setMemberReportImportStatus(['Imported ${'Member_Details_'.repeat(8)}.txt.'], 'ok')`, context);
  assert.equal(panel.style.overflowWrap, 'anywhere');
});

test('the panel follows the build: changed, undone (and the picker drops the report\'s badges), done again', async () => {
  const { context } = await importFile(fileLike('member.txt', 'text/plain', FIXTURE));
  const rows = [];
  const panel = { style: {}, children: rows, appendChild(c){ rows.push(c); c.parentNode = panel; }, insertBefore(c){ rows.unshift(c); c.parentNode = panel; }, removeChild(c){ rows.splice(rows.indexOf(c), 1); c.parentNode = null; }, get firstChild(){ return rows[0] || null; }, textContent: '' };
  context.document = { createElement: () => ({ style: {}, textContent: '', parentNode: null }), querySelectorAll: () => [], getElementById: id => id === 'memberReportImportStatus' ? panel : null, addEventListener(){} };
  const run = code => vm.runInContext(code, context);
  run(`globalThis.buildBadgeGallery = () => { globalThis.__gallery = (globalThis.__gallery || 0) + 1; }; State.reportAuthorizedBadgeIds = ['solo_badge'];
    const pre = JSON.stringify(['senior', 'Maj', 'female', [], [], []]);
    memberReportShown = { pre, post: memberReportBuildSignature(), authorized: ['solo_badge'], row: null, state: 'current' }; markMemberReportPanelStale();`);
  assert.equal(rows.length, 0, 'an unchanged build leaves the panel as it is');
  run(`State.ribbonSelections.cap_membership_ribbon.checked = true; markMemberReportPanelStale(); markMemberReportPanelStale();`);
  assert.deepEqual(rows.map(r => r.textContent), ['The build has changed since this import, so the lines below may no longer match it.']);
  assert.deepEqual(JSON.parse(run('JSON.stringify(State.reportAuthorizedBadgeIds)')), ['solo_badge'], 'a tick by hand keeps the list');
  // Undo: the build is the one the import replaced.
  run(`State.membership = 'senior'; State.rank = 'Maj'; State.gender = 'female'; for(const sel of Object.values(State.ribbonSelections)) sel.checked = false; State.badges = []; State.patches = []; markMemberReportPanelStale();`);
  assert.deepEqual(rows.map(r => r.textContent), ['This import has been undone; the lines below describe the report that was imported.']);
  assert.equal(run('State.reportAuthorizedBadgeIds'), null, 'the picker no longer lists the undone report\'s badges');
  assert.ok(run('__gallery') >= 1, 'and is rebuilt');
  // Redo: the build is the import's again.
  run(`memberReportShown.post = memberReportBuildSignature(); memberReportShown.state = 'undone'; memberReportShown.pre = 'x'; markMemberReportPanelStale();`);
  assert.equal(rows.length, 0);
  assert.deepEqual(JSON.parse(run('JSON.stringify(State.reportAuthorizedBadgeIds)')), ['solo_badge'], 'the list returns');
});

// ---- The independent tester's second round (I2): rows that are not the thing, counts, dates -------------------------------------------------
const SENIOR_GTL = 'Ground Team Leader (GTL) QUALIFIED 01 Jan 2027';
test('a course, class, workshop or academy row is not the badge it names', () => {
  const read = (base, row) => parseAviation(base.replace('Decorations\n', `Decorations\n${row}\n`)).authorized;
  for(const row of ['EMT Basic Course 01 Jan 2024', 'EMT-Intermediate Refresher Course 01 Jan 2024', 'Paramedic Class 01 Jan 2024', 'Volunteer University Instructor Workshop 01 Jan 2024'])
    assert.ok(!read(SENIOR, row).some(id => /^emt_|volunteer/.test(id)), row);
  for(const row of ['Model Rocketry Academy 01 Jan 2024', 'NRA Marksmanship Course 01 Jan 2024', 'Cyber Badge Class 01 Jan 2024', 'Cadet STEM Badge Workshop 01 Jan 2024', 'Cadet STEM Badge TRAINING 01 Jan 2024'])
    assert.ok(!read(FIXTURE, row).some(id => /rocketry|nra_|cyber|stem/.test(id)), row);
  // The same rows without the word are the badges.
  assert.ok(read(SENIOR, 'EMT-Basic 01 Jan 2024').includes('emt_basic_badge'));
  for(const [row, id] of [['Model Rocketry 01 Jan 2024', 'model_rocketry_badge'], ['NRA Marksmanship Qualification 01 Jan 2024', 'nra_marksman_badge'], ['Cadet Cyber Badge 01 Jan 2024', 'cyber_badges'], ['Cadet STEM Badge 01 Jan 2024', 'stem_badges']])
    assert.ok(read(FIXTURE, row).includes(id), row);
  // And the Goddard rocketry star follows the badge, not a rocketry course.
  const star = runImport(FIXTURE.replace('Cadet Training\n', 'Cadet Training\nModel Rocketry Academy 01 Jan 2023\n'));
  assert.notEqual(star.selected.goddard_achievement.awardValue, 'rocketry_star');
});

test('a qualification whose status says the member never held it earns nothing and the report says so; Expired still earns', () => {
  for(const status of ['NOT QUALIFIED', 'UNQUALIFIED', 'DENIED', 'FAILED', 'PENDING', 'IN PROGRESS', 'Not Qualified']){
    const r = parseAviation(SENIOR.replace(SENIOR_GTL, `Ground Team Leader (GTL) ${status} 01 Jan 2027`));
    assert.ok(!r.authorized.includes('master_ground_team_badge'), status);
    assert.ok(r.notes.some(n => n === `A Ground Team qualification is listed as ${status.toLowerCase()}, so no badge was imported (CAPR 39-1, 10.4.5).`), `${status}: ${r.notes.join(' | ')}`);
  }
  const ic = parseAviation(SENIOR.replace('Incident Commander 3 (IC3) TRAINING 01 Jan 2027', 'Incident Commander 3 (IC3) NOT QUALIFIED 01 Jan 2027'));
  assert.ok(!ic.authorized.includes('basic_incident_commander_badge'));
  assert.ok(ic.notes.some(n => /^An Incident Commander qualification is listed as not qualified, so no badge was imported \(CAPR 39-1, 10\.4\.6\)\.$/.test(n)));
  assert.ok(parseAviation(SENIOR.replace(SENIOR_GTL, 'Ground Team Leader (GTL) EXPIRED 01 Jan 2020')).authorized.includes('master_ground_team_badge'));
});

test('a Cadet First Sergeant row that has ended is a past tour, in whichever table it is printed', () => {
  const diamond = text => signature(text).firstSergeant;
  const base = FIXTURE.replace('MALE CADET C/Col', 'MALE CADET C/MSgt').replace('C/Col Guiseppe Mitchell', 'C/MSgt Guiseppe Mitchell');
  const row = end => base.replace('Cadet Deputy Commander for Operations GLR-IL-049 UNIT No 01 Jan 2026', `Cadet First Sergeant GLR-IL-049 UNIT No 01 Jan 2026${end}`);
  assert.equal(diamond(row('')), true);
  assert.equal(diamond(row(' 31 Dec 2099')), true, 'an End Date still to come is a tour in progress');
  assert.equal(diamond(row(' 31 Mar 2026')), false);
});

test('a repeated Recruiter, Counterdrug, Homeland Security or Air Search and Rescue row is counted as before and the report says it does not know what the repeat stands for', () => {
  const note = (name, n) => `The report lists the ${name} ${n} times and does not say what a repeated row stands for: check its device under Ribbons.`;
  const rows = (name, n) => Array.from({ length: n }, (_, i) => `${name} ${String(i + 1).padStart(2, '0')} Jan 202${i}`);
  const senior = runImport(seniorWith('Decorations', rows('Senior Recruiter Ribbon', 3).concat(rows('Counterdrug Ribbon', 3))));
  assert.ok(senior.parsed.notes.includes(note('Senior Recruiter Ribbon', 3)), senior.parsed.notes.join(' | '));
  assert.ok(senior.parsed.notes.includes(note('Counterdrug Ribbon', 4)), 'the fixture has one and three are added');
  assert.match(senior.selected.cap_counterdrug_ribbon.awardLabel, /40 Sorties/, 'counted as before: ten sorties a row');
  assert.match(senior.selected.cap_senior_recruiter_ribbon.awardLabel, /7 members/, 'the recruiter ribbon is the basic ribbon as before');
  const cadet = runImport(cadetWith('Decorations', rows('Cadet Recruiter Ribbon', 3)));
  assert.ok(cadet.parsed.notes.includes(note('Cadet Recruiter Ribbon', 3)));
  // One row is one award and needs no note.
  assert.ok(!runImport(cadetWith('Decorations', rows('Cadet Recruiter Ribbon', 1))).parsed.notes.some(n => /does not say what a repeated row stands for/.test(n)));
});

test('the Red Service Ribbon goes on past 35 years, to the 65 years the picker offers', () => {
  const years = n => { const d = new Date(); d.setFullYear(d.getFullYear() - n); d.setDate(d.getDate() - 2); return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  for(const [n, label] of [[36, '35 Years'], [41, '40 Years'], [45, '45 Years'], [57, '55 Years'], [66, '65 Years']]){
    const r = runImport(FIXTURE.replace('24 Sep 2019', years(n)));
    assert.equal(r.selected.red_service_ribbon.awardLabel, label, `${n} years`);
  }
});

test('a ligature and a two-digit year are read: "Certificate" with the fi joined, 12/18/25, 18-Dec-25, 18 Dec 25', () => {
  assert.ok(runImport(FIXTURE.replace('Certificate of Recognition', 'Certiﬁcate of Recognition')).ribbon('lifesaving_award'));
  const base = signature(FIXTURE);
  for(const [what, change] of Object.entries({
    '12/18/25': redate((d, m, y) => `${two(m)}/${d}/${y.slice(2)}`),
    '18-Dec-25': redate((d, m, y) => `${d}-${MONTHS[m]}-${y.slice(2)}`),
    '18 Dec 25': redate((d, m, y) => `${d} ${MONTHS[m]} ${y.slice(2)}`)
  })) assert.deepEqual(signature(change(FIXTURE)), base, what);
  const { context } = loadPageScripts();
  const clean = t => vm.runInContext('(t) => normalizeMemberReportText(t)', context)(t);
  assert.equal(clean('Activity/Service Ribbon'), 'Activity/Service Ribbon');
  assert.equal(clean('Date Rank 01 Jan 20 Jul 2021'), 'Date Rank 01 Jan 20 Jul 2021', 'a day after a month is not a year');
});

test('a table heading with nothing under it is not an unread row', async () => {
  const empty = FIXTURE.replace(/Decorations\n[\s\S]*\nLocal Activities/, 'Decorations\nActivity/Service Ribbon\nLocal Activities');
  const { result } = await importFile(fileLike('m.txt', 'text/plain', empty));
  assert.equal(groupOf(result.lines, 'Not understood'), null);
  const twice = FIXTURE.replace('Local Activities', 'Decorations\nLocal Activities');
  assert.equal(groupOf((await importFile(fileLike('m.txt', 'text/plain', twice))).result.lines, 'Not understood'), null);
});

// ---- The independent tester's second round, the panel and the checks (I2) ---------------------------------------------------------------------
test('a memo or a newsletter that names a few of the report\'s headings is not a report; the General Information row with a CAPID, or four headings in order, is', async () => {
  const memo = 'Cadet Training weekend plan\nEncampments run 05 Jun 2027, 12 Jun 2027 and 19 Jun 2027\nPlease bring boots. Local Activities will follow.';
  const newsletter = 'Squadron Newsletter\nGeneral Information about dues\nDecorations for the banquet 01 Jun 2027\nLocal Activities this month: 05 Jun 2027';
  for(const text of [memo, newsletter]){
    const { result, state } = await importFile(fileLike('x.txt', 'text/plain', text), { before: BUILD_BEFORE });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'notReport');
    assert.match(result.lines[0], /^That does not look like a CAP member report: it has neither the General Information row nor the sections of a report in order\./);
    assertKept(state);
  }
  for(const file of FIXTURE_FILES) assert.equal((await importFile(fileLike(file, 'text/plain', fixtureText(file)))).result.ok, true, file);
  // The row alone with its CAPID is a report; four headings in their order are a report without the row.
  assert.equal((await importFile(fileLike('x.txt', 'text/plain', 'General Information\n654321 WILSON, DAVID MALE SENIOR 1st Lt 01 Mar 2024 15 Jan 2016 31 Jan 2027 ACTIVE GLR-IL-049'))).result.ok, true);
  const headings = 'Duty Positions\nProfessional Development\nSpecialty Tracks\nCadet Training\nDecorations\nDecoration Row One 01 Jan 2024\n';
  assert.equal((await importFile(fileLike('x.txt', 'text/plain', headings))).result.code, 'nothing', 'four headings in order pass the check; nothing in them is readable');
  assert.equal((await importFile(fileLike('x.txt', 'text/plain', 'Decorations\nProfessional Development\nSpecialty Tracks\nDuty Positions\n'))).result.code, 'notReport', 'the same headings out of order are not');
});

test('a heading lost from the report does not silently drop the rows under it', async () => {
  const noAchievements = FIXTURE.replace('Cadet Achievements\n', '');
  const base = signature(FIXTURE).ribbons, got = signature(noAchievements).ribbons;
  assert.deepEqual(got, base, 'the Achievement rows are read without their heading');
  assert.ok(runImport(noAchievements).parsed.notes.includes('The Cadet Achievements heading was not found; its Achievement rows were read without it.'));
  const lines = async text => groupOf((await importFile(fileLike('m.txt', 'text/plain', text))).result.lines, 'Not understood') || [];
  assert.ok((await lines(FIXTURE.replace('Encampments\n', ''))).includes('Rows that look like encampments were found with no Encampments heading, so they were not counted.'));
  assert.ok((await lines(fixtureText('eservices-member-details-cadet-live12.txt').replace('Specialty Tracks\n', ''))).includes('Rows that look like specialty track ratings were found with no Specialty Tracks heading, so no badge was imported from them.'));
  assert.ok((await lines(FIXTURE.replace('Cadet Training\n', ''))).includes('Rows that look like cadet activities were found with no Cadet Training heading, so they were not counted.'));
  assert.equal((await lines(FIXTURE)).some(l => /heading/.test(l)), false, 'a report with its headings says nothing of the kind');
});

test('the Command Service Ribbon note names the level, never the picker\'s placeholder', () => {
  const r = runImport(SENIOR.replace('Commander GLR-IL-049 UNIT No 01 Jan 2025', 'Wing Commander GLR-IL-001 WING No 01 Jan 2024'));
  const note = r.parsed.notes.find(n => /^Command Service Ribbon:/.test(n));
  assert.equal(note, 'Command Service Ribbon: Wing level, silver star, from commander duty of 365 days or more.');
  assert.ok(!r.parsed.notes.some(n => /- Select -/.test(n)));
});

test('on a field uniform the held off lines do not tell the member to go to a field uniform, and name the ribbons it does not wear', async () => {
  const text = fixtureText('eservices-member-details-cadet-live12.txt');
  const ocp = (await importFile(fileLike('m.txt', 'text/plain', text), { before: "State.uniform = 'ocp';" })).result;
  const held = groupOf(ocp.lines, 'Held off the uniform') || [];
  assert.ok(held.some(l => /: not worn on Ocp\.$/.test(l)), held.join(' | '));
  assert.ok(!held.some(l => /add (?:them|it) under Patches there/.test(l)), 'already on a field uniform');
  assert.ok(held.some(l => /^Ribbons: not worn on Ocp; the \d+ are kept for the uniforms that wear them/.test(l)), held.join(' | '));
  const blues = (await importFile(fileLike('m.txt', 'text/plain', text), { before: "State.uniform = 'blues_a';" })).result;
  const bluesHeld = groupOf(blues.lines, 'Held off the uniform') || [];
  assert.ok(bluesHeld.some(l => /add them under Patches there\.$/.test(l)));
  assert.ok(!bluesHeld.some(l => /^Ribbons:/.test(l)), 'the Blues wear the ribbons');
});

test('a file chosen after this one is read is the one imported: a slower file does not overwrite it', async () => {
  const { context } = await importFile(fileLike('a.txt', 'text/plain', SENIOR));
  const before = vm.runInContext('JSON.stringify([State.membership, State.rank, State.text])', context);
  const late = await vm.runInContext('(f) => importMemberReportFile(f, { isCurrent: () => false })', context)(fileLike('b.txt', 'text/plain', FIXTURE));
  assert.equal(late.superseded, true);
  assert.equal(vm.runInContext('JSON.stringify([State.membership, State.rank, State.text])', context), before);
});

test('a name over 40 letters is cut on the uniform and the report says so; a ribbon beyond what the picker offers is held at the most, and says so', () => {
  const long = 'A'.repeat(45);
  const r = runImport(FIXTURE.replace('MITCHELL, GUISEPPE', `MITCHELL, ${long}`).replace('C/Col Guiseppe Mitchell', `C/Col ${long} Mitchell`));
  assert.equal(r.text.firstName.length, 40);
  assert.ok(r.parsed.notes.includes('The name is longer than 40 letters, so the uniform shows the first 40 of each part.'));
  const many = runImport(FIXTURE.replace('Decorations\n', 'Decorations\n' + 'Disaster Relief Ribbon 01 Jan 2020\n'.repeat(1)).replace('Local Activities', Array.from({ length: 120 }, (_, i) => `Disaster Relief Ribbon ${String(1 + i % 28).padStart(2, '0')} ${MONTHS[i % 12]} ${2000 + (i % 24)}`).join('\n') + '\nLocal Activities'));
  assert.ok(many.parsed.notes.some(n => /^Disaster Relief Ribbon: the picker offers at most 84 awards, so 84 are used\.$/.test(n)), many.parsed.notes.join(' | '));
  assert.ok(many.selected.disaster_relief_ribbon);
});

test('Clear import notes says the build is as it was (the privacy line is the import card\'s hint now)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'member-report-import.js'), 'utf8');
  assert.match(src, /'The import notes are cleared and your build is as it was\.'/);
  assert.doesNotMatch(src, /No report imported yet/);
});

// ---- The print of the member search today (the owner's own report) --------------------------------------------------------------------
// The print has no "General Information" heading and no row of CAPID, name and gender: it opens with "Personnel Information For: <grade> <name>
// <CAPID>" and a table headed "General Info", lists the member's qualifications under "Achievements", and prints Cadet Training as Type, Location,
// Date Completed. tests/fixtures/eservices-member-details-cadet-personnel.txt is a report in that shape: its rows are written here, with a made-up
// member, unit and dates, and the print header and footer of every page in between.
const PERSONNEL_FILE = 'eservices-member-details-cadet-personnel.txt';
const PERSONNEL = fixtureText(PERSONNEL_FILE);

test('the name is read from the "Personnel Information For" heading of the member search print, a middle name left out', () => {
  const r = runImport(PERSONNEL);
  assert.deepEqual([r.text.firstName, r.text.lastName, r.text.show], ['Alex', 'Rivera', true]);
  assert.equal(r.parsed.firstName, 'Alex');
  assert.equal(r.parsed.lastName, 'Rivera');
  // The same text as a PDF delivers it: one line, the print header and footer of each page left in.
  assert.deepEqual(signature(PERSONNEL.replace(/\n/g, ' ')).name, ['Alex', 'Rivera']);
});

test('a heading name is the first word and the last word, with or without the grade, and a suffix stays with the last name', () => {
  const read = heading => { const { context } = loadPageScripts(); return JSON.parse(vm.runInContext('(h) => JSON.stringify(extractMemberNameFromReport(h))', context)(`Printer Friendly View - Member Details Personnel Information For: ${heading} 123456 LSCode: General Info Organization GLR-IL-049`)); };
  assert.deepEqual(read('C/Capt Alex Quinn Rivera'), { firstName: 'Alex', lastName: 'Rivera' });
  assert.deepEqual(read('Alex Rivera'), { firstName: 'Alex', lastName: 'Rivera' }, 'no grade');
  assert.deepEqual(read('C/Lt Col Alex Rivera'), { firstName: 'Alex', lastName: 'Rivera' }, 'a grade of two words');
  assert.deepEqual(read('Maj Gen Alex Quinn Rivera'), { firstName: 'Alex', lastName: 'Rivera' }, 'a senior grade');
  assert.deepEqual(read('C/CMSgt José Peña'), { firstName: 'José', lastName: 'Peña' }, 'accents');
  assert.deepEqual(read("C/Capt Sean O'Brien-Lewis"), { firstName: 'Sean', lastName: "O'Brien-Lewis" });
  assert.deepEqual(read('C/Capt Alex Rivera Jr'), { firstName: 'Alex', lastName: 'Rivera Jr' });
  assert.deepEqual(read('Capt Alex Rivera III'), { firstName: 'Alex', lastName: 'Rivera III' });
  assert.deepEqual(read('C/Capt RIVERA, ALEX QUINN'), { firstName: 'Alex', lastName: 'Rivera' }, 'a comma says which part is the last name');
  assert.equal(read('C/Capt Alex'), null, 'one word is no name');
  assert.equal(read(''), null);
});

test('the General Information row still wins over a heading, and a report with no name at all still says so', async () => {
  const both = PERSONNEL.replace('Personnel Information For:   C/Capt Alex Quinn Rivera 123456   LSCode: General Info', 'Personnel Information For:   C/Capt Alex Quinn Rivera 123456   LSCode: General Information CAPID Name Gender Type Rank 123456 PEÑA, JOSÉ MALE CADET C/Capt 14 Mar 2024 02 Sep 2021 30 Sep 2027 ACTIVE GLR-IL-049 General Info');
  assert.deepEqual(signature(both).name, ['José', 'Peña']);
  const none = PERSONNEL.replace('C/Capt Alex Quinn Rivera 123456', '');
  assert.deepEqual(signature(none).name, [null, null], 'no heading name');
  const { result } = await importFile(fileLike('m.txt', 'text/plain', none));
  assert.ok(groupOf(result.lines, 'Not understood').includes('The name was not found, so the uniform has no name.'));
});

// ---- National Cadet Special Activities: the Cadet Training table is followed, not a list of names -------------------------------------------
let trainingReader = null;
function trainingRows(text){
  if(!trainingReader){
    const { context } = loadPageScripts();
    trainingReader = t => JSON.parse(vm.runInContext('(t) => JSON.stringify(memberReportCadetTrainingRows(normalizeMemberReportText(t)))', context)(t));
  }
  return trainingReader(text);
}
const withTraining = (text, rows) => text.replace('Encampments Location', rows.join('\n') + '\nEncampments Location');

test('a row of the Cadet Training table is a credit for its activity and year when the list has the activity and it is not a kind that earns none: six in the member search print', () => {
  const rows = trainingRows(PERSONNEL);
  assert.deepEqual(rows.map(r => [r.title.split(/\s+/)[0], r.year, r.credit]), [
    ['RCLS', '2022', false], ['Civil', '2022', true], ['HMRS', '2022', true], ['RCLS', '2023', false], ['COS', '2023', true], ['Model', '2023', true],
    ['RCLS', '2023', false], ['NBB', '2024', true], ['RCLS', '2024', false], ['NFA', '2025', true], ['RCLS', '2025', false]
  ]);
  assert.deepEqual([...new Set(rows.filter(r => !r.credit).map(r => r.why))], ['a region or wing school: no credit']);
  // Each credit is for the activity the list gives the row, whatever place or name the row uses.
  assert.deepEqual(rows.filter(r => r.credit).map(r => [r.activity, r.year]), [['CIVIL AIR PATROL NATIONAL CYBER ACADEMY', '2022'], ['HMRS', '2022'], ['COS', '2023'], ['MODEL AIRCRAFT & REMOTE CONTROL FLIGHT ACADEMY', '2023'], ['NATIONAL BLUE BERET', '2024'], ['NATIONAL FLIGHT ACADEMY', '2025']]);
  const r = runImport(PERSONNEL);
  assert.equal(r.ribbon('cadet_special_activity_ribbon').value, 'silver_star_1', 'six activities: five additional ones are one silver star');
  assert.deepEqual(r.devices('cadet_special_activity_ribbon'), [{ devices: ['star-silver'], centered: false }]);
  // The ribbons table of the same report lists five ribbons (the sixth is not yet awarded): the table's six are the count.
  assert.equal((PERSONNEL.match(/Cadet Special Activity Ribbon/g) || []).length, 5);
});

test('an activity and a year is one credit however many of its rows; the same activity in another year, or another activity in the year, is another', () => {
  const read = rows => runImport(withTraining(PERSONNEL, rows)).ribbon('cadet_special_activity_ribbon').value;
  const NFA = 'NFA – TX Wing Flight Academy (Glider)', CYBER = 'Civil Air Patrol National Cyber Academy – VA', AVIATION = 'Aviation and Aeronautics Business Academy';
  assert.equal(read([`${NFA} Staff   Tulsa, OK   05 Jul 2025`]), 'silver_star_1', 'a staff row beside the student row of the year: still six');
  assert.equal(read([`${CYBER}   Fort Pickett, VA   08 Jul 2022`, `${CYBER} Cadre   Fort Pickett, VA   09 Jul 2022`]), 'silver_star_1', 'three rows of one activity in one year: still six');
  assert.equal(read([`${CYBER}   Fort Pickett, VA   01 Jul 2024`]), 'silver_star_1_bronze_star_1', 'the same activity a year later: a seventh');
  assert.equal(read([`${AVIATION}   Dayton, OH   01 Jul 2024`]), 'silver_star_1_bronze_star_1', 'a new activity in a year of its own: a seventh');
  assert.equal(read([`${AVIATION}   Dayton, OH   02 Jul 2025`]), 'silver_star_1_bronze_star_1', 'a new activity in the year of another: a seventh');
  assert.equal(read([`${AVIATION}   Dayton, OH   02 Jul 2025`, `${AVIATION} Staff   Dayton, OH   03 Jul 2025`]), 'silver_star_1_bronze_star_1', 'and its staff row the same year: one');
  // Two places of one academy in a year are one credit, as the places of the flight academy have always been.
  assert.equal(read([`${CYBER}   Fort Pickett, VA   08 Jul 2024`, 'Civil Air Patrol National Cyber Academy – TX   Waco, TX   09 Jul 2024']), 'silver_star_1_bronze_star_1', 'two places of one academy in a year: one');
  assert.equal(read(['NFA – NY Wing Powered Flight Academy   Rome, NY   09 Jul 2025']), 'silver_star_1', 'two flight academies in the year of the first: still six');
});

test('what the table lists that earns no credit: region and wing schools, Required Staff Training, an encampment, an orientation flight, the exchange with its own ribbon', () => {
  const none = [
    'RCLS   GLR   04 Jan 2026', 'RCLS Cadet Cadre   Virtual, GLR   04 Jan 2026', 'Region Cadet Leadership School   GLR   04 Jan 2026', 'NCOLS   Albany, NY   04 Jan 2026',
    'Non-Commissioned Officer Leadership School   Albany, NY   04 Jan 2026', 'Wing NCOLS   Albany, NY   04 Jan 2026', 'Required Staff Training   Online   04 Jan 2026', 'RST Online Modules   LMS   04 Jan 2026',
    'IL Encampment   Fort McCoy, WI   04 Jan 2026', 'Orientation Flight   Airport   04 Jan 2026', 'International Air Cadet Exchange   Abroad   04 Jan 2026', 'IACE   Abroad   04 Jan 2026',
    // The schools the supplements name (data/supplements.js): the wing and region activities their cords are earned at.
    'Pathfinders Technical School   Jefferson City, MO   04 Jan 2026', 'Medical Orientation Training School   Jefferson City, MO   04 Jan 2026', 'Honor Guard College   Richmond, VA   04 Jan 2026',
    'NCO Leadership Academy   Orlando, FL   04 Jan 2026', 'SNCO Leadership Academy   Orlando, FL   04 Jan 2026', 'CCC Leadership Academy   Orlando, FL   04 Jan 2026'
  ];
  for(const row of none){
    assert.equal(runImport(withTraining(PERSONNEL, [row])).ribbon('cadet_special_activity_ribbon').value, 'silver_star_1', `${row}: still six`);
    assert.equal(trainingRows(withTraining(PERSONNEL, [row])).filter(r => r.credit).length, 6, row);
    assert.ok(!runImport(withTraining(PERSONNEL, [row])).parsed.unreadRows.some(w => w.includes(row.split(/\s{2,}/)[0])), `${row}: a kind that earns none is not told as unread`);
  }
  // Every cord of the supplements that is earned at an activity names a school this list leaves out.
  const { SUPPLEMENTS } = require('../data/supplements.js');
  const cords = SUPPLEMENTS.flatMap(sp => sp.items).filter(it => it.kind === 'cord' && it.earned && it.earned.source === 'activity').map(it => it.id).sort();
  assert.deepEqual(cords, ['fl-leadership-academy', 'mo-medical-orientation', 'mo-pathfinders', 'ner-ncols', 'ner-rcls', 'nh-ncols', 'va-honor-guard-college'],
    'a supplement cord earned at an activity is a school the importer must not count as a special activity: add it to IMPORTED_TRAINING_NO_CREDIT');
});

test('the table reads the same on the line a PDF makes, with its column headings repeated by a page break, and the old print (Activity, Date Completed) is read as before', async () => {
  assert.equal(runImport(PERSONNEL.replace(/\n/g, ' ')).ribbon('cadet_special_activity_ribbon').value, 'silver_star_1');
  const broken = PERSONNEL.replace('Model Aircraft & Remote Control Flight Academy   Lewis', 'Type   Location   Date Completed Model Aircraft & Remote Control Flight Academy   Lewis');
  assert.deepEqual(trainingRows(broken).filter(r => r.credit).map(r => r.title.split(/\s+/)[0]), ['Civil', 'HMRS', 'COS', 'Model', 'NBB', 'NFA']);
  assert.equal(runImport(FIXTURE).ribbon('cadet_special_activity_ribbon').value, 'bronze_star_2', 'COS, PJOC and the cyber NCSA of the old print');
  // Neither of the two rows is listed as not understood any more, and nothing else is in the table's way.
  const { result } = await importFile(fileLike('member.txt', 'text/plain', PERSONNEL));
  assert.ok(!(groupOf(result.lines, 'Not understood') || []).some(l => /Model Aircraft|NFA/.test(l)), JSON.stringify(groupOf(result.lines, 'Not understood')));
});

// ---- The council ribbon's star is for a term served; the cord is for the position held now -----------------------------------------------
const PERSONNEL_RCAC_CHAIR = 'Cadet RCAC Chair   MAR-001   REGION   No   16 Oct 2024   17 Oct 2025\n';
const PERSONNEL_WCAC_CHAIR = 'Cadet WCAC Chair   IL-001   WING   No   09 Oct 2023   11 Oct 2024\n';
const PERSONNEL_GCAC_CHAIR = 'Cadet GCAC Chair   IL-049   GROUP   No   09 Oct 2023   11 Oct 2024\n';
const PERSONNEL_CURRENT_NCAC = 'Cadet NCAC Alternate   NHQ-000   NATIONAL   No   29 Oct 2025\nCadet NCAC Representative   MAR-001   REGION   No   12 Nov 2025\n';
const cacOf = r => ({ ribbon: r.selected.cadet_advisory_council_ribbon && r.selected.cadet_advisory_council_ribbon.awardValue, cord: r.parsed.shoulderCord });
for(const row of [PERSONNEL_RCAC_CHAIR, PERSONNEL_WCAC_CHAIR, PERSONNEL_GCAC_CHAIR, PERSONNEL_CURRENT_NCAC]) assert.ok(PERSONNEL.includes(row), `the fixture holds ${row}`);

test('a member on the National council now and a regional chair before: the ribbon is the region level (silver star), the cord the national one, never the gold star', () => {
  assert.deepEqual(cacOf(runImport(PERSONNEL)), { ribbon: 'cac_region', cord: 'national' });
  assert.deepEqual(runImport(PERSONNEL).devices('cadet_advisory_council_ribbon'), [{ devices: ['star-silver'], centered: false }]);
  // The star is the highest council among the past positions: each one taken away in turn.
  const without = (...rows) => rows.reduce((t, row) => t.replace(row, ''), PERSONNEL);
  assert.equal(cacOf(runImport(without(PERSONNEL_RCAC_CHAIR))).ribbon, 'cac_wing');
  assert.equal(cacOf(runImport(without(PERSONNEL_RCAC_CHAIR, PERSONNEL_WCAC_CHAIR))).ribbon, 'cac_group');
  // A past position at the National council is the gold star.
  assert.equal(cacOf(runImport(PERSONNEL.replace(PERSONNEL_WCAC_CHAIR, 'Cadet NCAC Chair   NHQ-000   NATIONAL   No   09 Oct 2023   11 Oct 2024\n'))).ribbon, 'cac_national');
  // An assistant, an alternate or a recorder is not a primary member: the past RCAC Alternate and assistants of the fixture do not count.
  assert.equal(cacOf(runImport(without(PERSONNEL_RCAC_CHAIR).replace(PERSONNEL_WCAC_CHAIR, 'Cadet RCAC Alternate   MAR-001   REGION   No   09 Oct 2023   11 Oct 2024\n'))).ribbon, 'cac_group');
});

test('with no past position the ribbon is the basic one if the awards table lists it and none if it does not; the cord of the position held now is chosen either way', async () => {
  const noPast = PERSONNEL.replace(PERSONNEL_RCAC_CHAIR, '').replace(PERSONNEL_WCAC_CHAIR, '').replace(PERSONNEL_GCAC_CHAIR, '');
  assert.deepEqual(cacOf(runImport(noPast)), { ribbon: 'cac_group', cord: 'national' }, 'the table row names the ribbon and no level');
  const noRow = noPast.replace('Cadet Advisory Council Ribbon   Cadet   4/9/2023 12:00:00 AM\n', '');
  assert.deepEqual(cacOf(runImport(noRow)), { ribbon: undefined, cord: 'national' }, 'no ribbon comes from a position held now');
  // The panel says so, with the paragraph in brackets and no abbreviation the member would not know.
  const { result } = await importFile(fileLike('m.txt', 'text/plain', noRow));
  const notes = linesText(result.lines).filter(l => /Cadet Advisory Council/.test(l));
  assert.ok(notes.includes("- Cadet Advisory Council Ribbon: none chosen, since no past duty position as chair, vice chair or representative of a council was found. A position held now gives the shoulder cord, not the ribbon's star (CAPR 39-3, 21j)."), notes.join(' | '));
  // A member with no council row at all is told nothing of the kind.
  const none = noRow.replace(PERSONNEL_CURRENT_NCAC, '').replace(/Cadet [GR]CAC Assistant .*\n/g, '');
  assert.deepEqual(cacOf(runImport(none)), { ribbon: undefined, cord: null });
  assert.ok(!linesText((await importFile(fileLike('m.txt', 'text/plain', none))).result.lines).some(l => /Cadet Advisory Council/.test(l)));
});

test('a row of the current table whose End Date has passed is a term served, one with an End Date still to come is a position held now', () => {
  const held = PERSONNEL_CURRENT_NCAC.replace('12 Nov 2025\n', '12 Nov 2025   30 Sep 2099\n');
  const noPast = PERSONNEL.replace(PERSONNEL_RCAC_CHAIR, '').replace(PERSONNEL_WCAC_CHAIR, '').replace(PERSONNEL_GCAC_CHAIR, '');
  assert.equal(cacOf(runImport(noPast.replace(PERSONNEL_CURRENT_NCAC, held))).ribbon, 'cac_group', 'an End Date in 2099: held now, no star');
  const ended = PERSONNEL_CURRENT_NCAC.replace('12 Nov 2025\n', '09 Oct 2023   11 Oct 2024\n');
  assert.equal(cacOf(runImport(noPast.replace(PERSONNEL_CURRENT_NCAC, ended))).ribbon, 'cac_national', 'an End Date in 2024: a term served, the gold star');
});

test('a page break inside the Cadet Training table, as a PDF prints it (the time stamp with its colon set apart, the end of the address), leaves no mark on a row', () => {
  const header = '03/05/25, 9 : 41   AM Printer Friendly View - Member Details Page 4 of 9 https://www.capnhq.gov/CAP.MemberSearch.Web/Reports/MemberDetails ? CAPID=123456\n';
  const broken = PERSONNEL.replace('COS   Scott AFB IL', header + 'COS   Scott AFB IL').replace('NFA – TX Wing', header + 'NFA – TX Wing');
  const rows = trainingRows(broken);
  assert.deepEqual(rows.filter(r => r.credit).map(r => r.title.split(/\s+/)[0]), ['Civil', 'HMRS', 'COS', 'Model', 'NBB', 'NFA']);
  assert.ok(rows.every(r => !/CAPID|AM\b|\d : \d/.test(r.title)), JSON.stringify(rows.map(r => r.title)));
  assert.equal(runImport(broken).ribbon('cadet_special_activity_ribbon').value, 'silver_star_1');
});

// ---- The panel says less: what stays in sight and what goes into the closed fold ---------------------------------------------------------
// "most of the info is useless" (the owner, 2026-11-12, of his own report: sixteen notes, perhaps four he needed). A note stays in sight when the import made
// a choice the member may want to change or must check; every other note is in the closed fold "More about this import", in the words it always had.
const NOTE_KINDS = [
  // [the kind, where it goes, a sample of it as the panel words it]
  [/^Cadet Advisory Council Ribbon: .+ level, from your past duty positions\.$/, 'sight', 'Cadet Advisory Council Ribbon: Region level, from your past duty positions.'],
  [/^Cadet Advisory Council Ribbon: the basic ribbon/, 'sight', 'Cadet Advisory Council Ribbon: the basic ribbon, since no past council position shows a level.'],
  [/^Cadet Advisory Council Ribbon: none chosen/, 'sight', "Cadet Advisory Council Ribbon: none chosen, since no past duty position as chair, vice chair or representative of a council was found. A position held now gives the shoulder cord, not the ribbon's star (CAPR 39-3, 21j)."],
  [/^Command Service Ribbon: /, 'sight', 'Command Service Ribbon: Wing level, silver star, from commander duty of 365 days or more.'],
  [/^The report lists the .+ \d+ times and does not say what a repeated row stands for/, 'sight', 'The report lists the Air Search and Rescue Ribbon 3 times and does not say what a repeated row stands for: check its device under Ribbons.'],
  [/^National Cadet Competition Ribbon: .+ add it under Ribbons if it applies\.$/, 'sight', 'National Cadet Competition Ribbon: the report does not say whether the team won its region (bronze star) or the national sweepstakes (silver star), so no star is added; add it under Ribbons if it applies.'],
  [/^The Certificate of Recognition for Lifesaving is the Lifesaving Award ribbon/, 'sight', 'The Certificate of Recognition for Lifesaving is the Lifesaving Award ribbon. The report does not say whether the save was a blood or organ transport, so the silver star for a save of another kind is not added; add it under Ribbons if it applies (CAPR 39-3, 9h).'],
  [/^Leadership Award: a senior or master specialty rating earns a star/, 'sight', 'Leadership Award: a senior or master specialty rating earns a star (bronze for senior, silver for master), which is not added; add it under Ribbons if it applies.'],
  [/^Garber and Gill Robb Wilson Awards: /, 'sight', 'Garber and Gill Robb Wilson Awards: the report does not show Squadron Officer School, Air Command and Staff College or Air War College, so no star is added; add it under Ribbons if it applies.'],
  [/^.+: taken from the .+ qualifications?, since the report names no /, 'sight', 'Observer Badge: taken from the Mission Observer qualification, since the report names no observer badge. Change it in the badge list.'],
  [/^The report names these aviation badges: /, 'sight', 'The report names these aviation badges: Solo Badge and Observer Badge. One CAP aviation badge is worn at a time (CAPR 39-1, 4.1.5.2.2.4.1); the others are listed under Authorized by member report in the badge list.'],
  [/^The report shows a National Staff appointment/, 'sight', 'The report shows a National Staff appointment, so the National Staff Badge may be worn. It is not chosen for you: choose it in the badge list (CAPR 39-1, 10.2.3).'],
  [/^(?:Current commander duty found|Past commander duty of a year or more found): the .+ command insignia pin/, 'sight', 'Current commander duty found: the Group Commander command insignia pin is worn over the name tag (CAPR 39-1, 10.2.5).'],
  [/^Shoulder cords: (?:more than one|the .+ cord from the report is chosen|the .+ cord is worn only at|the .+ cord \(.+\) is chosen)/, 'sight', 'Shoulder cords: the Cadet Advisory Council cord from the report is chosen, so the Region Cadet Leadership School cord is marked and not chosen.'],
  [/^The .+ patch, which a supplement requires on this uniform, is chosen\./, 'sight', 'The Wing patch, which a supplement requires on this uniform, is chosen. You can take it off under Supplements.'],
  [/^The name is longer than 40 letters/, 'sight', 'The name is longer than 40 letters, so the uniform shows the first 40 of each part.'],
  [/^The Cadet Achievements heading was not found/, 'sight', 'The Cadet Achievements heading was not found; its Achievement rows were read without it.'],
  // The fold.
  [/^\d+ rows? listed twice in the report/, 'more', '1 row listed twice in the report was counted once.'],
  [/^Current First Sergeant duty found/, 'more', 'Current First Sergeant duty found, so the Cadet First Sergeant diamond is chosen for the Class B shirt (CAPR 39-1, 10.10.4).'],
  [/records found; the ribbon picker offers at most|: the picker offers at most \d+ awards/, 'more', 'Disaster Relief Ribbon: the picker offers at most 84 awards, so 84 are used.'],
  [/^A Cadet Recruiter Ribbon row was not used/, 'more', 'A Cadet Recruiter Ribbon row was not used: a senior member wears the Senior Recruiter Ribbon only.'],
  [/^(?:Current|Past) Commander duty found, but the command insignia pin/, 'more', 'Current Commander duty found, but the command insignia pin is worn in the grade of lieutenant colonel and below, so it was not chosen (CAPR 39-1, 10.2.5).'],
  [/is rated NONE|is in Specialty Tracks, but the builder has no badge|is in the Specialty Tracks table, but the builder does not authorize/, 'more', 'CADET PROGRAMS TECHNICIAN is in the Specialty Tracks table, but the builder does not authorize that badge for cadet members, so it is not offered.'],
  [/^A Communications specialty rating was found/, 'more', 'A Communications specialty rating was found: the Communications patch is worn on the field and flight uniforms only.'],
  [/training or an exam was found, but the (?:Communications )?badge comes from a rating in Specialty Tracks|^Character Development Instructor duty|^An Emergency Services exam was found/, 'more', 'Historian training or an exam was found, but the badge comes from a rating in Specialty Tracks (CAPR 39-1, 10.5), so none was imported.'],
  [/^Mission Radio Operator or Mission Staff Assistant training|^Urban Direction Finding training/, 'more', 'Urban Direction Finding training was found; there is no badge for it, so none was imported.'],
  [/^A past National Staff appointment was found, but it ran less than one year/, 'more', 'A past National Staff appointment was found, but it ran less than one year, so the badge is not worn permanently (CAPR 39-1, 10.2.3).'],
  [/^Incident Commander training was found with no qualification|^Ground Team Member Level 3 was found as training|^An? (?:Ground Team|Incident Commander) qualification is listed as/, 'more', 'Incident Commander training was found with no qualification, so no Incident Commander badge was imported (CAPR 39-1, 10.4.6).'],
  [/is in the report, but the builder does not authorize that badge for|qualification brings it, but the builder does not authorize|^Mission Pilot qualification found/, 'more', 'Mission Pilot qualification found, but the report names no pilot badge or rating, and a badge is worn only when it has been awarded (CAPR 39-1, 10.3.1): none was imported. If you hold one, choose it in the badge list.'],
  [/cadet award ribbons? (?:is|are) left off/, 'more', '8 cadet award ribbons are left off: a senior member wears one cadet award ribbon, the highest, and may wear every milestone medal earned as a miniature (CAPR 39-1, 11.1.4).'],
  [/shoulder cord: the report shows a position on the council held now/, 'more', "National Cadet Advisory Council shoulder cord: the report shows a position on the council held now, which gives the cord and not the ribbon's star (CAPR 39-3, 21j)."],
  [/^No unit patch is offered for |^The unit patch for .+ is chosen/, 'more', 'No unit patch is offered for GLR-IL-049 yet.'],
  [/^Supplements: |^Shoulder cords: the report shows |^Shoulder cords: the other cords of these supplements/, 'more', 'Supplements: Finger Lakes Group brings in Northeast Region Supplement 1.'],
  [/^No patch is offered yet for /, 'more', 'No patch is offered yet for Civil Air Patrol National Cyber Academy, HMRS and Model Aircraft & Remote Control Flight Academy.']
];
const notesOf = lines => [...(groupOf(lines, 'Notes') || []), ...(foldOf(lines) || [])];

test('each kind of note goes where the table says: the choices a member may want to change stay in sight, the rest are in the fold', () => {
  const { context } = loadPageScripts();
  const inSight = vm.runInContext('memberReportNoteInSight', context);
  for(const [kind, where, sample] of NOTE_KINDS){
    assert.match(sample, kind, `the sample is its kind: ${sample.slice(0, 60)}`);
    assert.equal(inSight(sample), where === 'sight', `${where}: ${sample.slice(0, 80)}`);
    // No kind catches another's note.
    for(const [other, otherWhere, otherSample] of NOTE_KINDS) if(other !== kind && otherSample !== sample) assert.ok(!(kind.test(otherSample) && otherWhere !== where), `${kind} also takes ${otherSample.slice(0, 60)}`);
  }
  assert.equal(inSight('A note no list has heard of.'), false, 'a note nothing names goes into the fold');
});

test('every note the import writes for the fixtures is of a kind in the table, so a new note cannot slip into the fold unnoticed', async () => {
  const kinds = NOTE_KINDS.map(k => k[0]);
  const extra = [
    cadetWith('Decorations', ['National Cadet Competition Ribbon 03 Jan 2024', 'Lifesaving Award 03 Jan 2024', 'Search and Rescue Ribbon 03 Jan 2024', 'Search and Rescue Ribbon 03 Jan 2024']),
    seniorWith('Decorations', ['Cadet Recruiter Ribbon 03 Jan 2024', 'Senior Pilot Wings 01 Jan 2020', 'Solo Wings 01 Jan 2019', 'Master Observer Wings 01 Jan 2021', 'Glider Pilot Badge 01 Jan 2020']),
    SENIOR.replace('Commander GLR-IL-049 UNIT No 02 Jan 2025', 'Commander GLR-IL-001 GROUP No 02 Jan 2025').replace('1st Lt', 'Col'),
    seniorWith('Qualification Status Expiration', ['Mission Pilot (MP) QUALIFIED 01 Jan 2027', 'Urban Direction Finding Team (UDF) QUALIFIED 01 Jan 2027', 'Mission Radio Operator (MRO) QUALIFIED 01 Jan 2027', 'Incident Commander 2 (IC2) TRAINING 01 Jan 2027']),
    FIXTURE.replace('Cadet Achievements\n', '')
  ];
  const seen = new Set();
  for(const text of [...FIXTURE_FILES.map(fixtureText), ...extra]){
    const { result } = await importFile(fileLike('m.txt', 'text/plain', text));
    for(const note of notesOf(result.lines)) seen.add(note);
  }
  assert.ok(seen.size > 25, `the texts write ${seen.size} different notes`);
  const unnamed = [...seen].filter(note => !kinds.some(kind => kind.test(note)));
  assert.deepEqual(unnamed, [], 'a note of no kind in the table: add its kind to the table and say where it goes');
});

test('the panel for the member search print: the counts, what was held off, four notes in sight, the rest closed under it; nothing said twice', async () => {
  const { result } = await importFile(fileLike('m.txt', 'text/plain', PERSONNEL));
  const text = linesText(result.lines);
  assert.deepEqual([...text.slice(0, 2)], ['Imported the report.', 'Read: cadet, male, C/Capt, Alex Rivera.']);
  assert.match(text[2], /^On the build: \d+ ribbons?, \d+ badges?, \d+ patch(?:es)?\.$/);
  assert.equal(groupOf(result.lines, 'Not understood'), null, 'the name, the six activities and the rest are understood');
  assert.deepEqual(groupOf(result.lines, 'Notes'), [
    'Observer Badge: taken from the Mission Observer qualification, since the report names no observer badge. Change it in the badge list.',
    'Cadet Advisory Council Ribbon: Region level, from your past duty positions.'
  ]);
  // The order: the heading lines, Held off, Not understood, Notes, the check line, then the fold, last.
  const order = result.lines.map(l => typeof l === 'string' ? 's' : l.heading ? 'h:' + l.heading : l.fold ? 'fold' : 'i');
  assert.equal(order[order.length - 1], 'fold');
  assert.equal(order[order.length - 2], 's', 'the check line is the last line before the fold');
  assert.ok(order.indexOf('h:Held off the uniform') < order.indexOf('h:Notes'));
  const fold = result.lines[result.lines.length - 1];
  assert.equal(fold.fold, 'More about this import');
  assert.ok(fold.items.length > 0);
  // Nothing is said twice: no line twice, the Communications patch only under Held off.
  const all = text.filter(l => !/^[#>]/.test(l));
  assert.equal(new Set(all).size, all.length, 'no line twice');
});

test('the Communications patch is said once: under Held off the uniform when the uniform does not wear it, in the fold when it does', async () => {
  const comms = PERSONNEL.replace('Technician Rating Exam: Communications', 'Technician Rating Exam: Communications').replace('Specialty Tracks', 'Specialty Tracks').replace('Cadet Training Type', 'Specialty Tracks Specialty Track Level Completed COMMUNICATIONS TECHNICIAN 05 May 2024 Cadet Training Type');
  const blues = (await importFile(fileLike('m.txt', 'text/plain', comms), { before: "State.uniform = 'blues_a';" })).result;
  assert.ok((groupOf(blues.lines, 'Held off the uniform') || []).some(l => /Communications Patch/.test(l)), JSON.stringify(groupOf(blues.lines, 'Held off the uniform')));
  assert.ok(!notesOf(blues.lines).some(n => /^A Communications specialty rating was found/.test(n)), 'not said again');
  const flight = (await importFile(fileLike('m.txt', 'text/plain', comms), { before: "State.uniform = 'flight_suit';" })).result;
  if(!(groupOf(flight.lines, 'Held off the uniform') || []).some(l => /Communications Patch/.test(l))){
    assert.ok((foldOf(flight.lines) || []).some(n => /^A Communications specialty rating was found/.test(n)), 'worn: said once, in the fold');
  }
});

test('the fold is a closed details element built from text: its summary and its rows are text nodes, nothing is set as markup', () => {
  const { context } = loadPageScripts();
  const made = [];
  const node = tag => ({ tag, style: {}, children: [], appendChild(c){ this.children.push(c); }, set innerHTML(v){ made.push(`innerHTML set: ${v}`); }, textContent: '' });
  const panel = node('div');
  context.document = { createElement: tag => node(tag), querySelectorAll: () => [], getElementById: id => id === 'memberReportImportStatus' ? panel : null };
  vm.runInContext(`setMemberReportImportStatus(['Imported.', { heading: 'Notes' }, { item: 'One' }, { fold: '<b>More about this import</b>', items: ['<script>alert(1)</script> & more', 'Two'] }, 'After the fold'], 'ok')`, context);
  assert.deepEqual(made, []);
  assert.deepEqual(panel.children.map(c => c.tag), ['div', 'div', 'div', 'details', 'div']);
  const details = panel.children[3];
  assert.deepEqual(details.children.map(c => [c.tag, c.textContent]), [['summary', '<b>More about this import</b>'], ['div', '– <script>alert(1)</script> & more'], ['div', '– Two']]);
  assert.ok(!('open' in details) && details.open !== true, 'closed');
});

// ---- Three misreads of the owner's own report: the page header's time stamp, an exam read as a rating, an activity no patch stands for -----------------
const PDF_HEADER = '03/05/25, 9 : 41   AM Printer Friendly View - Member Details Page 8 of 9 https://www.capnhq.gov/CAP.MemberSearch.Web/Reports/MemberDetails ? CAPID=123456\n';

test('the page header a PDF prints is taken out whole: the time stamp with its colon set apart, and the end of the address it leaves behind', () => {
  const { context } = loadPageScripts();
  const strip = t => vm.runInContext('(t) => stripMemberReportPageFurniture(t)', context)(t);
  assert.equal(strip('Fort Dix 14 Aug 2023 03/06/25, 2 : 17   PM Printer Friendly View - Member Details Page 5 of 11 https://www.capnhq.gov/CAP.MemberSearch.Web/Reports/MemberDetails ? CAPID=123456 Lake Placid 22 Aug 2025'),
    'Fort Dix 14 Aug 2023 Printer Friendly View - Member Details Lake Placid 22 Aug 2025', 'the title is kept once, the rest of the header goes');
  // The browser's own print, with no space round the colon, is read as before.
  assert.equal(strip('A 14 Aug 2023 11/10/26, 4:02 PM B'), 'A 14 Aug 2023 B');
  assert.equal(strip('A 14 Aug 2023 3/5/25, 9 : 41 : 07 PM B'), 'A 14 Aug 2023 B');
  // A date that is no time stamp, and a number that is no member number, stay.
  assert.equal(strip('Awarded 03/05/2025 for 9 : 41 reasons'), 'Awarded 03/05/2025 for 9 : 41 reasons');
});

test('a page break right under the Encampments heading adds no encampment: the time stamp it leaves is no date of the table', () => {
  const two = runImport(PERSONNEL).ribbon('encampment_ribbon').value;
  const broken = PERSONNEL.replace('Encampments Location   Date Completed\n', 'Encampments Location   Date Completed\n' + PDF_HEADER);
  assert.equal(runImport(broken).ribbon('encampment_ribbon').value, two, 'two encampments still');
  const { context } = loadPageScripts();
  assert.equal(vm.runInContext('(t) => extractEncampmentCountFromReport(normalizeMemberReportText(t))', context)(broken), 2);
  assert.equal(vm.runInContext('(t) => extractEncampmentCountFromReport(normalizeMemberReportText(t))', context)(broken.replace(/\n/g, ' ')), 2, 'on the line a PDF makes');
});

test('two awards of one name that began on one day and were approved on two are two awards; a row printed twice, with its approval, is one', () => {
  const count = rows => runImport(cadetWith('Decorations', rows)).parsed.ribbons.find(r => r.id === 'cap_achievment_award').reason;
  const base = ['Achievement Award   12 Jul 2024   to 20 Jul 2024   04 Oct 2024', 'Achievement Award   14 Aug 2025   to 22 Aug 2025   26 Sep 2025'];
  assert.match(count(base), /^6 Achievement Award/);   // the fixture's own four, and these two
  assert.match(count([...base, 'Achievement Award   14 Aug 2025   to 22 Aug 2025   03 Sep 2025']), /^7 Achievement Award/, 'the same days, approved on another day: another award');
  assert.match(count([...base, 'Achievement Award   14 Aug 2025   to 22 Aug 2025   26 Sep 2025']), /^6 Achievement Award/, 'the row again, as it was printed: one');
});

test('an exam is not a rating: no Communications patch comes from a Rating Exam row, and a Specialty Tracks rating still gives it', () => {
  const exams = PERSONNEL.replace('Technician Rating Exam: Communications   LMS   27 Sep 2023\n', 'Technician Rating Exam: Communications   LMS   27 Sep 2023\nSenior Rating Exam: Communications   LMS   11 Apr 2024\nTechnician Rating Exam: Finance   LMS   08 Aug 2024\n');
  assert.ok(exams.includes('Senior Rating Exam: Communications'));
  const r = runImport(exams);
  assert.ok(!(r.parsed.patches || []).includes('comms_patch'), 'no patch from an exam');
  assert.ok(!r.parsed.notes.some(n => /^A Communications specialty rating was found/.test(n)));
  const rated = runImport(exams.replace('Cadet Training Type', 'Specialty Tracks Specialty Track Level Completed COMMUNICATIONS TECHNICIAN 05 May 2024 Cadet Training Type'));
  assert.ok(rated.parsed.patches.includes('comms_patch'), 'a rating in the table gives it');
  // The words Communications and Technician near each other where no table is, as before, still give it outside an exam row.
  assert.ok(runImport(PERSONNEL.replace('Cadet Training Type', 'Communications Technician 05 May 2024 Cadet Training Type')).parsed.patches.includes('comms_patch'));
});

test('an activity the table credits that no patch stands for is said once, in the fold; the patches of the activities of the list are chosen from the same rows', async () => {
  const { result } = await importFile(fileLike('m.txt', 'text/plain', PERSONNEL));
  const fold = foldOf(result.lines);
  assert.ok(fold.includes('No patch is offered yet for Civil Air Patrol National Cyber Academy, HMRS and Model Aircraft & Remote Control Flight Academy.'), JSON.stringify(fold));
  assert.ok(!(groupOf(result.lines, 'Notes') || []).some(n => /No patch is offered yet/.test(n)), 'not in sight');
  // The patches of the activities that have one are chosen from the same rows: the flight academy, Cadet Officer School and National Blue Beret.
  const { context } = loadPageScripts();
  const detect = vm.runInContext('window.CAPUBDetectNcsaPatches', context);
  assert.deepEqual([...detect('NFAP Student Graduate Lancaster, TX')], []);
  assert.deepEqual([...detect('NESA Fort Pickett, VA')], ['nesa_patch']);
  assert.deepEqual([...detect('National Flight Academy Powered')], ['nfa_patch'], 'the plain academy has its patch');
  assert.deepEqual([...runImport(PERSONNEL).parsed.patches].sort(), ['cos_patch', 'nbb_patch', 'nfa_patch']);
  assert.deepEqual([...detect('NFA – TX Wing Flight Academy (Glider) Student Graduate Lancaster, TX')], ['nfa_patch'], 'a place of the academy, by the name the list prints');
  assert.deepEqual([...detect('AF Pararescue & Survival Orientation Course')].length, 1, 'the list\'s name of the pararescue course');
  assert.deepEqual([...detect('Mid-Atlantic Region (MAR) Honor Guard Academy')], ['honor_guard_academy_patch']);
  assert.deepEqual([...detect('AF Civil Engineering Academy')], ['civil_engineering_academy_patch']);
  assert.deepEqual([...detect('Aviation and Aeronautics Business Academy')], [], 'on the list, no patch of its own');
});

// ---- The list of National Cadet Special Activities is the table (National Headquarters' "Current and Past Special Activity Ribbon List") --------------------
// Every row below is made up: an activity name from the list, a place and a date that are no member's.
const NCSA_RULES = require('../member-report-rules.js');
const NCSA_LIST = NCSA_RULES.NCSA_ACTIVITY_LIST;
// Names the list prints for region and wing schools that the importer has always kept out as schools (IMPORTED_TRAINING_NO_CREDIT). The list and the
// rule disagree about these; the rule is kept until the owner rules.
const NCSA_KEPT_AS_SCHOOLS = ['Mid Atlantic Region Cadet Leadership School', 'TX Medical Orientation Training School'];
const ncsaRow = (name, date = '05 Jul 2024') => `${name}   Anytown, ZZ   ${date}`;

test('the table holds every activity of the list, each once, with the list\'s own spelling, the years it was held and whether it is current', () => {
  assert.equal(NCSA_LIST.length, 67);
  assert.equal(new Set(NCSA_LIST.map(e => e.name)).size, 67, 'no name twice');
  for(const e of NCSA_LIST){
    assert.ok(e.years.length > 0 && e.years.every(y => y >= 2014 && y <= 2025), e.name);
    assert.equal(e.current, e.years.includes(2025), `${e.name}: current is held in the newest year`);
  }
  const by = name => NCSA_LIST.find(e => e.name === name);
  assert.equal(by('Advanced Technology Academy').current, false, 'a past activity');
  assert.equal(by('CyberPatriot Finals').current, true);
  assert.deepEqual(by('Advanced Technology Academy').years, [2016, 2015, 2014]);
  // The list's slips are printed as they are and matched by their right spelling.
  assert.ok(by('NER Honor Acedemy') && by('Aircraft Manufacuring Academy') && by('NFA – Pacfic Coast Region Flight Academy (Glider)'));
  assert.ok(by('Aircraft Manufacuring Academy').others.includes('Aircraft Manufacturing Academy'));
});

test('every activity of the list, by the name the list prints, is a credit for its activity in the year of its row', () => {
  const read = trainingRows(withTraining(PERSONNEL, NCSA_LIST.map(e => ncsaRow(e.name))));
  for(const e of NCSA_LIST){
    const row = read.find(r => r.title === `${e.name} Anytown, ZZ`);
    assert.ok(row, e.name);
    if(NCSA_KEPT_AS_SCHOOLS.includes(e.name)){ assert.equal(row.credit, false, `${e.name}: a school the rule keeps out`); continue; }
    assert.equal(row.credit, true, e.name);
    assert.equal(row.activity, e.activity, e.name);
    assert.equal(row.year, '2024');
  }
});

test('the other names of the list\'s activities are the same credit: the place left off, a corrected spelling, an abbreviation, a past name', () => {
  const activityOf = title => { const row = trainingRows(withTraining(PERSONNEL, [ncsaRow(title)])).find(r => r.title.startsWith(title)); return row.credit ? row.activity : null; };
  assert.equal(activityOf('Space Force Operations Academy'), 'SPACE FORCE OPERATIONS ACADEMY', 'the place left off');
  assert.equal(activityOf('Aircraft Manufacturing Academy'), 'AIRCRAFT MANUFACTURING ACADEMY', 'the list\'s slip corrected');
  assert.equal(activityOf('NER Honor Academy'), 'NER HONOR ACADEMY');
  assert.equal(activityOf('Hawk Mountain Ranger School'), 'HMRS', 'without (Full Week)');
  assert.equal(activityOf('HMRS Dist. Graduate'), 'HMRS');
  assert.equal(activityOf('PJOC'), 'PJOC');
  assert.equal(activityOf('Pararescue Orientation Course'), 'PJOC', 'the past name');
  assert.equal(activityOf('Air Force Civil Engineering Academy'), 'AFCEA');
  assert.equal(activityOf('Cadet Officers School'), 'COS');
  assert.equal(activityOf('National Flight Academy'), 'NATIONAL FLIGHT ACADEMY');
  assert.equal(activityOf('NBB'), 'NATIONAL BLUE BERET');
  assert.equal(activityOf('Engineering Technology Academy'), 'ENGINEERING TECHNOLOGIES ACADEMY');
  assert.equal(activityOf('Specialized Undergraduate Pilot Training'), 'SUPT FAMILIARIZATION COURSE');
});

test('a past activity of the list is a credit, and a look-alike that is not on the list is none unless the record calls it a National Cadet Special Activity', () => {
  const credit = title => !!trainingRows(withTraining(PERSONNEL, [ncsaRow(title)])).find(r => r.title.startsWith(title)).credit;
  assert.equal(credit('Advanced Technology Academy', '05 Jul 2015'), true, 'past: last held in 2016');
  for(const lookAlike of ['Advanced Aviation Academy', 'Cadet Flight Academy', 'National Emergency Services Academy', 'NESA', 'Cyber Defense Training Academy', 'Space Command Familiarization Course', 'Engineering Academy', 'Cadet Competition Team', 'MKSABA', 'NFAP Student Graduate']){
    assert.equal(credit(lookAlike), false, `${lookAlike}: not on the list`);
    assert.equal(credit(`NCSA ${lookAlike}`), true, `NCSA ${lookAlike}: the record calls it one`);
    assert.equal(credit(`National Cadet Special Activity ${lookAlike}`), true, `${lookAlike}: called one in words`);
  }
  assert.equal(NCSA_RULES.ncsaActivityForTitle('Advanced Aviation Academy'), null);
  // A row of no list is told as not understood, so that nothing is lost without a word.
  const told = runImport(withTraining(PERSONNEL, [ncsaRow('Advanced Aviation Academy')])).parsed.unreadRows;
  assert.deepEqual(told, ['Advanced Aviation Academy   Anytown, ZZ 05 Jul 2024'.replace(/\s{3}/, ' ')]);
});

test('on the ribbon: the same activity in two years is two credits, twice in one year is one, an activity not on the list is none', () => {
  const activities = rows => runImport(withTraining(PERSONNEL, rows)).parsed.activities;
  const credits = rows => new Set(activities(rows).map(a => `${a.activity}:${a.year}`)).size;
  assert.equal(credits([]), 6, 'the member search print');
  assert.equal(credits([ncsaRow('StellarXplorers', '05 Jul 2024')]), 7, 'a new activity');
  assert.equal(credits([ncsaRow('StellarXplorers', '05 Jul 2023'), ncsaRow('StellarXplorers', '05 Jul 2024')]), 8, 'the same activity in two years');
  assert.equal(activities([ncsaRow('StellarXplorers', '05 Jul 2023'), ncsaRow('StellarXplorers Staff', '09 Jul 2023')]).length, 8, 'both rows of one year are read');
  assert.equal(credits([ncsaRow('StellarXplorers', '05 Jul 2023'), ncsaRow('StellarXplorers Staff', '09 Jul 2023')]), 7, 'twice in one year: one credit');
  assert.equal(credits([ncsaRow('Advanced Aviation Academy', '05 Jul 2024')]), 6, 'a look-alike is no credit');
  const ribbon = rows => runImport(withTraining(PERSONNEL, rows)).ribbon('cadet_special_activity_ribbon').value;
  assert.equal(ribbon([ncsaRow('StellarXplorers', '05 Jul 2023'), ncsaRow('StellarXplorers', '05 Jul 2024')]), 'silver_star_1_bronze_star_2', 'eight credits: a silver star and two bronze');
});

test('the patches the report brings are found by the same table', () => {
  const { context } = loadPageScripts();
  const detect = vm.runInContext('window.CAPUBDetectNcsaPatches', context);
  const cases = [
    ['AF Civil Engineering Academy', 'civil_engineering_academy_patch'], ['Cadet Officer School', 'cos_patch'], ['Civic Leadership Academy', 'cla_patch'],
    ['National Blue Beret', 'nbb_patch'], ['NFA – NY Wing Powered Flight Academy', 'nfa_patch'], ['MER Honor Guard Academy', 'honor_guard_academy_patch'],
    ['AF Specialized Undergraduate Pilot Training – TX', 'undergrad_pilot_training_patch']
  ];
  for(const [title, id] of cases) assert.deepEqual([...detect(ncsaRow(title))], [id], title);
  assert.equal([...detect(ncsaRow('AF Advanced Pararescue & Survival Orientation Course'))].length, 1);
  assert.deepEqual([...detect(ncsaRow('Advanced Technology Academy'))], [], 'on the list and no patch of its own');
  assert.deepEqual([...detect(ncsaRow('Advanced Aviation Academy'))], []);
});

// ---- The National Staff Badge is the member's pick: the import never turns it on --------------------------------------------------------------
const staffReport = block => SENIOR.replace('Cadet Training', `${block}\nCadet Training`);
const STAFF_CURRENT = "National Staff Appointments Appointment Date Assigned Staff Member, Commander's Action Group 01 Apr 2025\nCurrent Committees";
const STAFF_PAST_YEAR = 'Past National Staff Appointments Appointment Date Assigned End Date National Recruiting Specialist 16 Feb 2022 01 Apr 2024\nCurrent Committees';
const STAFF_PAST_SHORT = 'Past National Staff Appointments Appointment Date Assigned End Date Staff Member 01 Apr 2025 31 Mar 2026\nCurrent Committees';
const STAFF_NOTE = 'The report shows a National Staff appointment, so the National Staff Badge may be worn. It is not chosen for you: choose it in the badge list (CAPR 39-1, 10.2.3).';

test('a current appointment, a past one of a full year, and a short one: none turns the National Staff Badge on; the first two bring the note to pick it', () => {
  for(const [what, block, noted] of [['current', STAFF_CURRENT, true], ['past, a full year', STAFF_PAST_YEAR, true], ['past, too short', STAFF_PAST_SHORT, false]]){
    const r = runImport(staffReport(block), "State.membership = 'senior';");
    assert.ok(!r.badges.includes('national_staff_badge'), `${what}: not on`);
    assert.ok(!r.parsed.badges.includes('national_staff_badge'), `${what}: not in the parsed badges`);
    assert.ok(!r.parsed.authorizedBadges.includes('national_staff_badge'), `${what}: not authorized by the report either`);
    assert.equal(r.parsed.notes.includes(STAFF_NOTE), noted, `${what}: the note`);
    assert.equal(r.parsed.notes.some(n => /ran less than one year/.test(n)), what === 'past, too short');
  }
  // A report that names nothing of the kind, and one that prints the badge's own name, bring nothing on either.
  assert.ok(!runImport(SENIOR, "State.membership = 'senior';").badges.includes('national_staff_badge'));
  const named = runImport(staffReport('Awards National Staff Badge 01 Apr 2024'), "State.membership = 'senior';");
  assert.ok(!named.badges.includes('national_staff_badge'), 'a row that prints the badge\'s name: still the member\'s pick');
});

test('a National Staff Badge the member picked by hand is still on after an import, with or without an appointment in the report; another badge is not kept', () => {
  const before = "State.membership = 'senior'; State.badges = ['national_staff_badge', 'emt_basic_badge'];";
  for(const block of [STAFF_CURRENT, STAFF_PAST_SHORT, '']){
    const r = runImport(staffReport(block), before);
    assert.ok(r.badges.includes('national_staff_badge'), `kept: ${block.slice(0, 30)}`);
    assert.equal(r.badges.filter(id => id === 'national_staff_badge').length, 1, 'once');
    assert.ok(!r.badges.includes('emt_basic_badge'), 'the rest is the report\'s, as before');
  }
  const alone = runImport(staffReport(STAFF_CURRENT), "State.membership = 'senior';");
  assert.ok(!alone.badges.includes('national_staff_badge'), 'and not picked before: not on');
});
