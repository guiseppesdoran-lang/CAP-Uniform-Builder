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
    return JSON.stringify({ parsed, selected, membership: State.membership, rank: State.rank, uniform: State.uniform, adultCadet: State.adultCadet, text: State.text, fields });
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

test('Crisis Service Award is the Crisis Service Ribbon, awarded once, no device', () => {
  const r = runImport(FIXTURE);
  assert.equal(r.ribbon('crisis_ribbon').value, 'earned');
  assert.deepEqual(r.devices('crisis_ribbon'), [{ devices: [], centered: false }]);
  const twice = runImport(FIXTURE.replace('Crisis Service Award 15 Dec 2023', 'Crisis Service Award 15 Dec 2023\nCrisis Service Award 15 Dec 2024'));
  assert.deepEqual(twice.devices('crisis_ribbon'), [{ devices: [], centered: false }]);
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

// CAPR 39-3 21j: the CAC ribbon shows the highest level served, wing bronze star, region silver, national gold.
test('a Wing, Region or National CAC duty position imports the CAC ribbon with its star; "Wing" elsewhere does not (E45)', () => {
  const duty = row => FIXTURE.replace('Cadet Deputy Commander for Operations GLR-IL-049 UNIT No 01 Jan 2026',
    'Cadet Deputy Commander for Operations GLR-IL-049 UNIT No 01 Jan 2026\n' + row);
  const cases = [
    ['Cadet Advisory Council Primary Representative GLR-IL-001 WING No 01 Jun 2025', 'cac_wing', ['star-bronze']],
    ['Cadet WCAC Representative GLR-IL-001 WING No 01 Jun 2025', 'cac_wing', ['star-bronze']],
    ['Wing CAC Chair GLR-IL-001 WING No 01 Jun 2025', 'cac_wing', ['star-bronze']],
    ['Region CAC Primary Representative GLR-001 REGION No 01 Jun 2025', 'cac_region', ['star-silver']],
    ['Cadet NCAC Representative NHQ-000 NATIONAL No 01 Jun 2025', 'cac_national', ['star-gold']]
  ];
  for(const [row, value, devices] of cases){
    const r = runImport(duty(row));
    assert.equal(r.selected.cadet_advisory_council_ribbon?.awardValue, value, row);
    assert.deepEqual(r.devices('cadet_advisory_council_ribbon'), [{ devices, centered: false }], row);
  }
  // The fixture's "Illinois Wing Encampment" rows and a CAC ribbon row with no level: the basic ribbon.
  assert.equal(runImport(FIXTURE).selected.cadet_advisory_council_ribbon.awardValue, 'cac_group');
  // The importer's own reading (before the duty-row rules in js/patches.js) also ignores "Wing" outside a CAC row.
  const { context } = loadPageScripts();
  assert.equal(vm.runInContext('importedCacLevelFromDutyPositions', context)(FIXTURE.replace(/\n/g, ' ')), null);
  assert.equal(vm.runInContext('importedCacLevelFromDutyPositions', context)(duty(cases[1][0]).replace(/\n/g, ' ')), 'wing');
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
  // Rows that name the activity without the word NCSA.
  const bare = FIXTURE.replace('NCSA Pararescue Orientation Course (PJOC)', 'Pararescue Orientation Course').replace('NCSA Cyber Defense', 'Cyber Defense Training Academy');
  assert.deepEqual(runImport(bare).devices('cadet_special_activity_ribbon'), stars2, 'activity names without NCSA');
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
// Disaster Relief Ribbon with V, a current Wing CAC representative, two NCSAs and COS, the Eaker, a CP rating.
test('the LIVE12 fixture imports every case Ducky raised', () => {
  const r = runImport(fs.readFileSync(path.join(__dirname, 'fixtures', 'eservices-member-details-cadet-live12.txt'), 'utf8'));
  assert.deepEqual([r.text.firstName, r.text.lastName, r.text.show], ['Guiseppe', 'Mitchell', true]);
  assert.deepEqual(r.devices('commander_commendation_award'), [{ devices: ['clasp-bronze', 'clasp-bronze', 'clasp-bronze'], centered: false }]);
  assert.deepEqual(r.devices('disaster_relief_ribbon'), [{ devices: ['v'], centered: false }]);
  assert.deepEqual(r.devices('cadet_advisory_council_ribbon'), [{ devices: ['star-bronze'], centered: false }]);
  assert.deepEqual(r.devices('cadet_special_activity_ribbon'), [{ devices: ['star-bronze', 'star-bronze'], centered: false }]);
  assert.deepEqual(r.devices('mitchell_award'), [{ devices: ['star-silver'], centered: false }]);
  assert.deepEqual(r.devices('eaker_award'), [{ devices: [], centered: false }]);
  assert.ok(r.parsed.badges.includes('communications_technician_badge'));
  assert.ok(r.parsed.notes.some(n => /^CADET PROGRAMS TECHNICIAN is in the Specialty Tracks table/.test(n)));
});

test('the activities CAPR 39-1 Figure A8-2 names count without the word NCSA (E46)', () => {
  const rows = FIXTURE.replace('NCSA Pararescue Orientation Course (PJOC) 10 Jul 2022\nNCSA Cyber Defense 12 Jul 2023',
    'Air Force Space Command Familiarization Course 10 Jul 2022\nSpecialized Undergraduate Pilot Training Familiarization Course 12 Jul 2023\nEngineering Academy 14 Jul 2024');
  assert.deepEqual(runImport(rows).devices('cadet_special_activity_ribbon'), [{ devices: ['star-bronze', 'star-bronze', 'star-bronze'], centered: false }], 'COS and three activities');
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
  assert.ok(r.parsed.notes.some(n => /^Leadership Award imported without stars/.test(n)), 'the senior AE rating star is left to the member');
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
  assert.deepEqual(r.devices('silver_medal_of_valor'), [{ devices: [], centered: false }, { devices: [], centered: false }], 'two awards, two ribbons');
  assert.deepEqual(r.devices('bronze_medal_of_valor'), [{ devices: ['clasp-bronze'], centered: false }]);
  for(const id of ['distinguished_service_award', 'afa_award', 'afsa_award', 'vfw_officer_award', 'vfw_nco_award', 'iace_ribbon',
    'national_cadet_competition_ribbon', 'national_color_guard_competition_ribbon']){
    assert.ok(r.selected[id], `${id} selected`);
    assert.deepEqual(r.devices(id), [{ devices: [], centered: false }], id);
  }
  assert.ok(r.parsed.notes.some(n => /^National Cadet Competition Ribbon imported as the basic ribbon/.test(n)));
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
    if(n <= 3) entries.push({ id: 'bronze_medal_of_valor', expr: `importedCountedAwardValue(${n})`, n, prop: false });
    for(const id of ['air_search_and_rescue_ribbon', 'search_find_ribbon']) entries.push({ id, expr: `importedCountedAwardValue(${n}, true)`, n, prop: true });
  }
  for(const row of importValueResolutions(entries)) assertResolvesToCount(row, row.n, [['propeller-bronze', row.prop]]);
  for(let n = 1; n <= 3; n++){
    const [row] = importValueResolutions([{ id: 'silver_medal_of_valor', expr: `importedCountedAwardValue(${n})` }]);
    assert.ok(row.real);
    assert.equal(RA.resolve('silver_medal_of_valor', { awardValue: row.optionValue, awardLabel: row.optionLabel }).length, n, `${n} Silver Medals of Valor`);
  }
  // A fourth Medal of Valor row: the picker offers three awards, so the third is imported and the import says so.
  const four = runImport(cadetWith('Decorations', [1, 2, 3, 4].map(y => `Bronze Medal of Valor 01 Jan 202${y}`)));
  assert.equal(four.selected.bronze_medal_of_valor.awardLabel, '3rd Award');
  assert.ok(four.parsed.notes.some(n => /^4 Bronze Medal of Valor records found; the ribbon picker offers at most 3/.test(n)));
});

// CAPR 39-1 and js/catalog.js SENIOR_HIGHEST_CADET_AWARD_RIBBONS: a senior member wears only the highest cadet award;
// the COS star moves from the Mitchell to it (CAPR 39-3 14j as data/ribbon-awards.js carries it).
test('a senior who was a cadet: only the highest cadet award, the Earhart, with the COS star moved from the Mitchell (E62)', () => {
  const r = runImport(SENIOR);
  const cadetAwards = ['curry_achievement', 'hap_arnold_achievement', 'mary_feik_achievement', 'wright_brothers_award', 'rickenbacker_achievement', 'lindbergh_achievement',
    'doolittle_achievement', 'goddard_achievement', 'armstrong_achievement', 'mitchell_award', 'earhart_award'];
  assert.deepEqual(r.parsed.ribbons.filter(x => cadetAwards.includes(x.id)).map(x => `${x.id}=${x.value}`), ['earhart_award=earned_cos_star']);
  assert.deepEqual(Object.keys(r.selected).filter(id => cadetAwards.includes(id)), ['earhart_award']);
  assert.equal(r.selected.earhart_award.awardLabel, 'Earned + COS star moved from the Mitchell');
  assert.deepEqual(r.devices('earhart_award'), [{ devices: ['star-silver'], centered: false }]);
  // Up to the Mitchell only: the Mitchell keeps its own COS star.
  const mitchell = runImport(SENIOR.replace(/Achievement 11 - Amelia Earhart.*\n/, ''));
  assert.deepEqual(mitchell.parsed.ribbons.filter(x => cadetAwards.includes(x.id)).map(x => `${x.id}=${x.value}`), ['mitchell_award=earned_cos_star']);
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
  assert.ok(r.parsed.notes.some(n => /^Incident Commander qualification found in training only/.test(n)));
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
