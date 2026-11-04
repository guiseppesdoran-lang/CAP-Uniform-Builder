'use strict';
// Every unit gets its own patch from the art tree, driven by the patch specs (data/unit-patch-art.js, scripts/sync-patches.cjs): js/catalog.js builds
// the charter table, the patch catalog entries and each unit's higher headquarters patch from the rows, so a new unit emblem needs no code. The rows
// are fixtures here (a squadron, a group, their wings and regions, the CAP command patch), loaded in place of the real data file; the patches that are
// present today (New York Wing, Northeast Region, TN-185) are read from the real one.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const sync = require('../scripts/sync-patches.cjs');

const row = (charter, label, echelon, asset) => ({ charter, patchId: 'unit_' + charter.toLowerCase().replace(/-/g, '_'), label, echelon, w: 3, h: 3.2, asset, img: `patches/${asset}/${asset}.svg` });
const FIXTURE_ROWS = [
  row('MAR-DC-026', 'Arlington Composite Squadron', 'squadron', 'patch-mar-dc-026'),
  row('MAR-DC-001', 'National Capital Wing', 'wing', 'patch-mar-dc-001'),
  row('MAR-MAR-001', 'Mid-Atlantic Region', 'region', 'patch-mid-atlantic-region'),
  row('NHQ-NHQ-000', 'Civil Air Patrol National Headquarters', 'national', 'patch-cap-command-patch'),
  row('SWR-TX-030', 'Group III', 'group', 'patch-swr-tx-030-group'),
  row('SWR-TX-001', 'Texas Wing', 'wing', 'patch-texas-wing'),
  row('SWR-SWR-001', 'Southwest Region', 'region', 'patch-southwest-region')
];
const load = rows => {
  const { context, referenceErrors } = loadPageScripts({ 'data/unit-patch-art.js': sync.unitText(rows) });
  assert.deepEqual(referenceErrors, []);
  return src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
};
const j = JSON.stringify;
const ev = load(FIXTURE_ROWS);
const real = load(require('../data/unit-patch-art.js'));
const ALL = ['abu', 'ocp', 'corporate_field', 'flight_suit', 'corporate_flight_suit'];

test('the charter table is built from the rows, the hand entry stays as the fallback, and a row wins over it', () => {
  const t = ev('UNIT_PATCH_IMAGE_BY_CHARTER');
  for(const r of FIXTURE_ROWS) assert.equal(t[r.charter], r.patchId, r.charter);
  assert.equal(t['SER-TN-185'], 'tn185_ocp_patch', 'the hand entry is kept');
  assert.equal(t['TN-185'], 'tn185_ocp_patch');
  const withRow = load([row('SER-TN-185', 'Music City Composite Squadron', 'squadron', 'patch-music-city-composite-squadron')]);
  assert.equal(withRow(`UNIT_PATCH_IMAGE_BY_CHARTER['SER-TN-185']`), 'unit_ser_tn_185', 'a row wins over the hand entry');
  assert.equal(withRow(`UNIT_PATCH_IMAGE_BY_CHARTER['TN-185']`), 'unit_ser_tn_185', 'and so does the short form');
});

test('the patch catalog gets an entry per row: the spec\'s label, its picture, kind unit; the wing, region and national patches carry an echelon, a group\'s and a squadron\'s do not', () => {
  for(const r of FIXTURE_ROWS){
    const meta = ev(`PATCH_META[${j(r.patchId)}]`);
    assert.equal(meta.label, r.label);
    assert.equal(meta.kind, 'unit');
    assert.equal(meta.unitEchelon, r.echelon);
    assert.equal(meta.img, r.img);
    assert.equal(meta.asset, r.asset);
    if(['wing', 'region', 'national'].includes(r.echelon)) assert.equal(meta.echelon, r.echelon, r.charter);
    else assert.ok(!('echelon' in meta), `${r.charter}: an organizational patch is not a headquarters patch`);
    assert.equal(ev(`getUnitPatchIdForCharter(${j(r.charter)})`), r.patchId);
    assert.deepEqual(ev(`getUnitPatchCharters(${j(r.patchId)})`), [r.charter]);
  }
});

test('the level of a unit is the row\'s echelon where there is one, else read from the charter number', () => {
  assert.equal(ev(`getUnitEchelon('SWR-TX-030')`), 'group');
  assert.equal(ev(`getUnitEchelon('MAR-DC-026')`), 'squadron');
  assert.equal(ev(`getUnitEchelon('SER-TN-185')`), 'squadron');
  assert.equal(ev(`getUnitEchelon('MAR-MAR-001')`), 'region');
});

test('a unit\'s higher headquarters patch is derived from its charter: squadron or group to its wing, wing to its region, region and national staff to the CAP command patch', () => {
  const hhq = code => ev(`getUnitHhqPatchId(${j(code)})`);
  assert.equal(hhq('MAR-DC-026'), 'unit_mar_dc_001', 'a squadron: its wing');
  assert.equal(hhq('SWR-TX-030'), 'unit_swr_tx_001', 'a group: its wing');
  assert.equal(hhq('MAR-DC-001'), 'unit_mar_mar_001', 'a wing: its region');
  assert.equal(hhq('MAR-DC-000'), 'unit_mar_mar_001', 'a wing headquarters squadron is a wing');
  assert.equal(hhq('SWR-TX-001'), 'unit_swr_swr_001');
  assert.equal(hhq('MAR-MAR-001'), 'unit_nhq_nhq_000', 'a region: the CAP command patch');
  assert.equal(hhq('NHQ-NHQ-000'), 'unit_nhq_nhq_000', 'National Headquarters: the CAP command patch');
  assert.equal(hhq('NHQ-NHQ-103'), 'unit_nhq_nhq_000', 'an overseas squadron belongs to National Headquarters');
  assert.equal(hhq('SER-TN-185'), null, 'its wing has no patch in the rows');
  assert.equal(hhq(''), null);
  assert.equal(load(FIXTURE_ROWS.filter(r => r.echelon !== 'national'))(`getUnitHhqPatchId('MAR-MAR-001')`), null, 'no command patch in the rows');
  assert.equal(load(FIXTURE_ROWS.filter(r => r.charter !== 'MAR-DC-001'))(`getUnitHhqPatchId('MAR-DC-026')`), null, 'no wing patch in the rows');
});

test('a wing\'s or region\'s headquarters squadron (-000) wears the headquarters\' emblem', () => {
  assert.equal(ev(`getUnitPatchIdForCharter('MAR-DC-000')`), 'unit_mar_dc_001');
  assert.equal(ev(`unitCharterHasArtwork('MAR-DC-000')`), true);
  assert.equal(ev(`getUnitPatchIdForCharter('MAR-DC-033')`), null, 'a squadron does not borrow its wing\'s emblem');
  assert.equal(ev(`unitCharterHasArtwork('MAR-DC-033')`), false);
});

test('echelon authorization per uniform: wing, region and national patches on every field uniform and both flight suits; group and squadron patches on the ABU, OCP and Corporate Field Uniform only', () => {
  for(const r of FIXTURE_ROWS){
    const high = ['wing', 'region', 'national'].includes(r.echelon);
    for(const u of ALL){
      const ok = ev(`isPatchAuthorizedForUniform(${j(r.patchId)}, ${j(u)}, 'senior')`);
      const expected = high || ['abu', 'ocp', 'corporate_field'].includes(u);
      assert.equal(ok, expected, `${r.charter} on ${u}`);
      if(!expected) assert.match(ev(`getPatchAuthorizationReason(${j(r.patchId)}, ${j(u)}, 'senior')`), /not a group or squadron patch \(CAPR 39-1, 8\.[23]\.4\.5\)/, `${r.charter} on ${u}`);
    }
    assert.equal(ev(`isPatchAuthorizedForUniform(${j(r.patchId)}, 'ocp', 'cadet')`), true, `${r.charter}: cadets wear it as seniors do`);
  }
});

test('places: a squadron\'s patch is on the right pocket of the ABU and the CFU and the right sleeve of the OCP; a wing\'s or national patch is on the left sleeve of the ABU and the CFU; a region\'s is the left sleeve or the right pocket', () => {
  const places = (id, u) => ev(`getPatchPlaces(${j(id)}, ${j(u)}).map(p => p.slot)`);
  assert.deepEqual(places('unit_mar_dc_026', 'abu'), ['CHEST_RIGHT']);
  assert.deepEqual(places('unit_mar_dc_026', 'corporate_field'), ['CHEST_RIGHT']);
  assert.deepEqual(places('unit_mar_dc_026', 'ocp'), ['R_SHOULDER']);
  assert.deepEqual(places('unit_mar_dc_001', 'abu'), ['L_SHOULDER']);
  assert.deepEqual(places('unit_mar_dc_001', 'ocp'), ['R_SHOULDER'], 'the wing\'s own patch is a wing headquarters member\'s unit patch');
  assert.deepEqual(places('unit_mar_mar_001', 'abu'), ['L_SHOULDER', 'CHEST_RIGHT']);
  assert.deepEqual(places('unit_nhq_nhq_000', 'corporate_field'), ['L_SHOULDER']);
  assert.deepEqual(places('unit_mar_dc_001', 'flight_suit'), ['R_SHOULDER']);
});

test('the Unit patch list marks a charter whose artwork exists with "artwork available", lists those first, and says it in words', () => {
  ev(`State.uniform = 'ocp'; State.membership = 'senior'`);
  const all = ev('getUnitPatchOptions()');
  assert.ok(all.length > 1000);
  const marked = all.filter(o => o.hasArtwork).map(o => o.code);
  for(const code of ['MAR-DC-026', 'MAR-DC-001', 'MAR-DC-000', 'MAR-MAR-001', 'SWR-TX-030', 'SER-TN-185', 'SER-TN-330']) assert.ok(marked.includes(code), code);
  assert.ok(!marked.includes('MAR-DC-033'));
  assert.deepEqual(all.slice(0, marked.length).map(o => o.code).sort(), marked.slice().sort(), 'the charters with artwork come first');
  const line = all.find(o => o.code === 'MAR-DC-026').text;
  assert.equal(line, 'MAR-DC-026 - ARLINGTON COMPOSITE SQUADRON  ✓ artwork available');
  assert.doesNotMatch(all.find(o => o.code === 'MAR-DC-033').text, /artwork/);
  assert.doesNotMatch(line, /unit_|patch-|\.svg|_/, 'no id or file name');
  // A search narrows it, and the flight suits list wings and above only.
  assert.deepEqual(ev(`getUnitPatchOptions('mar-dc-026')`).map(o => o.code), ['MAR-DC-026']);
  ev(`State.uniform = 'flight_suit'`);
  assert.ok(ev('getUnitPatchOptions()').every(o => !/^(MAR-DC-026|SWR-TX-030)$/.test(o.code)));
  ev(`State.uniform = 'ocp'`);
});

test('the status names the unit patch, and with art and a higher headquarters patch on the OCP says where the higher headquarters patch goes', () => {
  const run = (uniform, charter, patches = []) => ev(`(function(){
    State.uniform = ${j(uniform)}; State.membership = 'senior'; State.patches = ${j(patches)}; State.unitPatchCharter = ${j(charter)};
    const el = { textContent: '', appendChild(){} }, realDocument = globalThis.document;
    globalThis.document = new Proxy({}, { get: (_t, key) => key === 'getElementById' ? id => id === 'unitPatchStatus' ? el : realDocument.getElementById(id) : realDocument[key] });
    renderUnitPatchStatus(); globalThis.document = realDocument; return el.textContent; })()`);
  const ocp = run('ocp', 'MAR-DC-026');
  assert.match(ocp, /^MAR-DC-026 - ARLINGTON COMPOSITE SQUADRON will render as the unit patch\. The National Capital Wing patch, its higher headquarters, goes on the left sleeve under the AUX identifier \(CAPR 39-1, 7\.1\.1\.4\.2\.1\); a patch you pick in lieu of it takes its place \(7\.1\.1\.4\.2\.2\)\.$/);
  assert.doesNotMatch(ocp, /unit_|patch-|\.svg|HHQ/);
  assert.equal(run('abu', 'MAR-DC-026'), 'MAR-DC-026 - ARLINGTON COMPOSITE SQUADRON will render as the unit patch.', 'the ABU takes no automatic left sleeve patch');
  assert.match(run('ocp', 'MAR-DC-026', ['pjoc_ocp_patch']), /is not placed: the patch you picked in lieu of it is on the left sleeve \(CAPR 39-1, 7\.1\.1\.4\.2\.2\)\.$/);
  assert.match(run('ocp', 'MAR-DC-033'), /^MAR-DC-033 - ANDREWS COMPOSITE SQDN selected\. No image asset is available for this charter yet\.$/, 'a charter without art keeps the plain note');
  ev(`State.patches = []; State.unitPatchCharter = ''`);
});

const patches = (uniform, charter, general = []) => ev(`(function(){
  State.uniform = ${j(uniform)}; State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.unitPatchCharter = ${j(charter)};
  State.patches = ${j(general)};
  return CAPUBUniformView.buildFromState().patches.map(p => ({ id: p.id, kind: p.kind, slot: p.slot, asset: p.asset, echelon: p.echelon })); })()`);

test('on the OCP the unit patch goes on the right sleeve and its higher headquarters patch on the left under AUX, automatically', () => {
  const p = patches('ocp', 'MAR-DC-026');
  assert.deepEqual(p.map(x => [x.id, x.kind, x.slot, x.asset]), [
    ['unit_mar_dc_026', 'unit', 'R_SHOULDER', 'patch-mar-dc-026'],
    ['unit_mar_dc_001', 'hhq', 'L_SHOULDER', 'patch-mar-dc-001']
  ]);
  assert.deepEqual(patches('ocp', 'MAR-DC-001').map(x => [x.id, x.kind, x.slot]), [['unit_mar_dc_001', 'unit', 'R_SHOULDER'], ['unit_mar_mar_001', 'hhq', 'L_SHOULDER']]);
  assert.deepEqual(patches('ocp', 'MAR-MAR-001').map(x => [x.id, x.kind, x.slot]), [['unit_mar_mar_001', 'unit', 'R_SHOULDER'], ['unit_nhq_nhq_000', 'hhq', 'L_SHOULDER']]);
  assert.deepEqual(patches('ocp', 'NHQ-NHQ-000').map(x => [x.id, x.kind, x.slot]), [['unit_nhq_nhq_000', 'unit', 'R_SHOULDER'], ['unit_nhq_nhq_000', 'hhq', 'L_SHOULDER']], 'National Headquarters wears the command patch on both sleeves');
});

test('a patch the member picks in lieu of the higher headquarters patch takes the left sleeve (7.1.1.4.2.2), and the higher headquarters patch is not drawn', () => {
  for(const lieu of ['pjoc_ocp_patch', ev(`Object.keys(PATCH_META).find(id => PATCH_META[id].kind === 'ranger-tab')`)]){
    const p = patches('ocp', 'MAR-DC-026', [lieu]);
    assert.ok(!p.some(x => x.kind === 'hhq'), lieu);
    assert.deepEqual(p.map(x => [x.id, x.slot]), [['unit_mar_dc_026', 'R_SHOULDER'], [lieu, 'L_SHOULDER']]);
    assert.equal(ev(`getUnitHhqPlan().inLieu`), lieu);
    assert.equal(ev(`getUnitHhqPlan().worn`), false);
  }
  ev(`State.patches = []`);
  assert.equal(ev(`getUnitHhqPlan().worn`), true);
});

test('no automatic higher headquarters patch off the OCP, without the unit patch\'s artwork, without a higher headquarters patch, or with no unit chosen', () => {
  assert.deepEqual(patches('abu', 'MAR-DC-026').map(x => [x.id, x.kind, x.slot]), [['unit_mar_dc_026', 'unit', 'CHEST_RIGHT']]);
  assert.deepEqual(patches('corporate_field', 'MAR-DC-026').map(x => x.kind), ['unit']);
  assert.deepEqual(patches('ocp', 'MAR-DC-033'), [], 'a charter without art draws nothing');
  assert.deepEqual(patches('ocp', 'SER-TN-185').map(x => [x.id, x.kind, x.slot]), [['tn185_ocp_patch', 'unit', 'R_SHOULDER']], 'TN-185 as before: its wing has no patch');
  assert.deepEqual(patches('ocp', ''), []);
  assert.equal(ev('getUnitHhqPlan()'), null);
});

test('a wing, region or national unit patch goes to the left sleeve of the ABU and the CFU, a squadron\'s to the right pocket; the flight suit takes the wing\'s on its right sleeve and refuses a squadron\'s', () => {
  assert.deepEqual(patches('abu', 'MAR-DC-001').map(x => [x.id, x.kind, x.slot]), [['unit_mar_dc_001', 'unit', 'L_SHOULDER']]);
  assert.deepEqual(patches('corporate_field', 'NHQ-NHQ-000').map(x => x.slot), ['L_SHOULDER']);
  assert.deepEqual(patches('flight_suit', 'MAR-DC-001').map(x => [x.id, x.slot]), [['unit_mar_dc_001', 'R_SHOULDER']]);
  assert.deepEqual(patches('flight_suit', 'MAR-DC-026'), []);
  assert.deepEqual(patches('corporate_flight_suit', 'SWR-TX-030'), []);
});

test('the member report import maps the report\'s charter to the patch through the same table', () => {
  const imp = text => ev(`(function(){ const parsed = parseCapMemberReport(${j(text)}); State.unitPatchCharter = parsed.unitPatchCharter || ''; return { charter: parsed.unitPatchCharter, notes: parsed.notes, patch: getSelectedUnitPatchId() }; })()`);
  const report = charter => `Member Details\nName: Doe, Pat\nCAPID: 123456\nUnit: ${charter}\nMember Type: SENIOR\nGrade: Capt\n`;
  const a = imp(report('MAR-DC-026'));
  assert.equal(a.charter, 'MAR-DC-026');
  assert.equal(a.patch, 'unit_mar_dc_026');
  assert.ok(a.notes.includes('Unit patch auto-selected from member report charter MAR-DC-026.'));
  const b = imp(report('MAR-MAR-001'));
  assert.equal(b.charter, 'MAR-MAR-001', 'a region\'s charter has three letters in the middle');
  assert.equal(b.patch, 'unit_mar_mar_001');
  const c = imp(report('MAR-DC-033'));
  assert.equal(c.patch, null);
  assert.ok(c.notes.includes('Member report charter MAR-DC-033 found, but no unit patch image is mapped yet.'));
  const d = imp(report('SER-TN-185'));
  assert.equal(d.patch, 'tn185_ocp_patch');
  ev(`State.unitPatchCharter = ''`);
});

test('the patches present today: the New York Wing and Northeast Region emblems are rows, TN-185 behaves as before', () => {
  assert.equal(real(`getUnitPatchIdForCharter('NER-NY-001')`), 'unit_ner_ny_001');
  assert.equal(real(`getUnitPatchIdForCharter('NER-NER-001')`), 'unit_ner_ner_001');
  assert.equal(real(`getUnitHhqPatchId('NER-NY-001')`), 'unit_ner_ner_001');
  assert.equal(real(`getUnitHhqPatchId('NER-NY-390')`), 'unit_ner_ny_001');
  assert.equal(real(`PATCH_META.unit_ner_ny_001.img`), 'patches/patch-new-york-wing/patch-new-york-wing.svg');
  assert.equal(real(`getUnitPatchIdForCharter('SER-TN-185')`), 'tn185_ocp_patch');
  assert.equal(real(`getUnitPatchIdForCharter('TN-185')`), 'tn185_ocp_patch');
  assert.equal(real(`getUnitPatchIdForCharter('SER-TN-330')`), 'tn330_ocp_patch');
  assert.equal(real(`PATCH_META.tn185_ocp_patch.img`), 'patches/patch-music-city-composite-squadron/patch-music-city-composite-squadron.svg');
  const p = real(`(function(){ State.uniform = 'ocp'; State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.patches = [];
    State.unitPatchCharter = 'NER-NY-001'; const a = CAPUBUniformView.buildFromState().patches.map(p => [p.id, p.kind, p.slot, p.asset]);
    State.unitPatchCharter = 'SER-TN-185'; const b = CAPUBUniformView.buildFromState().patches.map(p => [p.id, p.kind, p.slot, p.asset]);
    State.unitPatchCharter = ''; return { a, b }; })()`);
  assert.deepEqual(p.a, [['unit_ner_ny_001', 'unit', 'R_SHOULDER', 'patch-new-york-wing'], ['unit_ner_ner_001', 'hhq', 'L_SHOULDER', 'patch-northeast-region']]);
  assert.deepEqual(p.b, [['tn185_ocp_patch', 'unit', 'R_SHOULDER', 'patch-music-city-composite-squadron']]);
});
