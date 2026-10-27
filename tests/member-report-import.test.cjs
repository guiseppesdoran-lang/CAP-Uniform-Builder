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
function runImport(text){
  const { context, referenceErrors } = loadPageScripts();
  assert.deepEqual(referenceErrors, []);
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
    return JSON.stringify({ parsed, selected, membership: State.membership, rank: State.rank, text: State.text, fields });
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
