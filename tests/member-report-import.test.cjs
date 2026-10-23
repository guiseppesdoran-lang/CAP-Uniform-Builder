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
    const parsed = parseCapMemberReport(text);
    applyCapMemberReportImport(parsed);
    const selected = {};
    for(const [id, s] of Object.entries(State.ribbonSelections)) if(s.checked) selected[id] = { awardValue: s.awardValue, awardLabel: s.awardLabel };
    return JSON.stringify({ parsed, selected, membership: State.membership, rank: State.rank });
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
