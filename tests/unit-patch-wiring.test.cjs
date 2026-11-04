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
  assert.equal(line, 'MAR-DC-026 - Arlington Composite Squadron  ✓ artwork available');
  assert.doesNotMatch(all.find(o => o.code === 'MAR-DC-033').text, /artwork/);
  assert.doesNotMatch(line, /unit_|patch-|\.svg|_/, 'no id or file name');
  // A search narrows it, and the flight suits list wings and above only.
  assert.deepEqual(ev(`getUnitPatchOptions('mar-dc-026')`).map(o => o.code), ['MAR-DC-026']);
  // The eServices string stays searchable: SQDN finds Squadron units, and so does Squadron.
  assert.ok(ev(`getUnitPatchOptions('andrews composite sqdn')`).some(o => o.code === 'MAR-DC-033'), 'the raw string finds the unit');
  assert.ok(ev(`getUnitPatchOptions('andrews composite squadron')`).some(o => o.code === 'MAR-DC-033'), 'so does the name as read');
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
  assert.match(ocp, /^Arlington Composite Squadron is shown as the unit patch\. The National Capital Wing patch, its higher headquarters, goes on the left sleeve under the AUX identifier \(CAPR 39-1, 7\.1\.1\.4\.2\.1\); a patch you pick in lieu of it takes its place \(7\.1\.1\.4\.2\.2\)\.$/);
  assert.doesNotMatch(ocp, /unit_|patch-|\.svg|HHQ|MAR-DC|\brender/i, 'no id, file name, charter string or the word render');
  assert.equal(run('abu', 'MAR-DC-026'), 'Arlington Composite Squadron is shown as the unit patch.', 'the ABU takes no automatic left sleeve patch');
  assert.match(run('ocp', 'MAR-DC-026', ['pjoc_ocp_patch']), /is not placed: the patch you picked in lieu of it is on the left sleeve \(CAPR 39-1, 7\.1\.1\.4\.2\.2\)\.$/);
  assert.match(run('ocp', 'MAR-DC-033'), /^Andrews Composite Squadron is selected\. Its patch picture is not available yet, so no patch is shown\.$/, 'a charter without art keeps the plain note');
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
  assert.equal(real(`PATCH_META.unit_ner_ny_001.img`), 'patches/patch-new-york-wing-brand-tools/patch-new-york-wing-brand-tools.png', 'the official artwork wins the charter over the older geometric patch');
  assert.equal(real(`PATCH_META.unit_ner_ner_001.img`), 'patches/patch-northeast-region/patch-northeast-region.svg');
  assert.equal(real(`PATCH_META.nywg_patch.img`), 'patches/patch-new-york-wing/patch-new-york-wing.svg', 'the general patch list keeps the geometric wing patch');
  assert.equal(real(`getUnitPatchIdForCharter('SER-TN-185')`), 'tn185_ocp_patch');
  assert.equal(real(`getUnitPatchIdForCharter('TN-185')`), 'tn185_ocp_patch');
  assert.equal(real(`getUnitPatchIdForCharter('SER-TN-330')`), 'tn330_ocp_patch');
  assert.equal(real(`PATCH_META.tn185_ocp_patch.img`), 'patches/patch-music-city-composite-squadron/patch-music-city-composite-squadron.svg');
  const p = real(`(function(){ State.uniform = 'ocp'; State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.patches = [];
    State.unitPatchCharter = 'NER-NY-001'; const a = CAPUBUniformView.buildFromState().patches.map(p => [p.id, p.kind, p.slot, p.asset]);
    State.unitPatchCharter = 'SER-TN-185'; const b = CAPUBUniformView.buildFromState().patches.map(p => [p.id, p.kind, p.slot, p.asset]);
    State.unitPatchCharter = ''; return { a, b }; })()`);
  assert.deepEqual(p.a, [['unit_ner_ny_001', 'unit', 'R_SHOULDER', null], ['unit_ner_ner_001', 'hhq', 'L_SHOULDER', 'patch-northeast-region']]);
  assert.deepEqual(p.b, [['tn185_ocp_patch', 'unit', 'R_SHOULDER', 'patch-music-city-composite-squadron']]);
});

// Official digital artwork as given: a PNG at the size its spec gives, and the activity patches of the art tree.
const png = (charter, label, echelon, asset, w, h) => Object.assign(row(charter, label, echelon, asset), { kind: 'unit', w, h, img: `patches/${asset}/${asset}.png` });
const ACTIVITY = { charter: null, patchId: 'ncsa_mots_patch', label: 'Medical Orientation & Training School', echelon: 'activity', kind: 'activity', w: 3, h: 3.05, asset: 'patch-ncsa-mots', img: 'patches/patch-ncsa-mots/patch-ncsa-mots.png' };
const ACTIVITY2 = Object.assign({}, ACTIVITY, { patchId: 'ncsa_national_geospatial_academy_patch', label: 'National Geospatial Academy', h: 3.384, asset: 'patch-ncsa-national-geospatial-academy', img: 'patches/patch-ncsa-national-geospatial-academy/patch-ncsa-national-geospatial-academy.png' });
const RASTER_ROWS = [png('MAR-DC-026', 'Arlington Composite Squadron', 'squadron', 'patch-mar-dc-026', 3, 2.968), png('MAR-DC-001', 'National Capital Wing', 'wing', 'patch-national-capital-wing', 3.25, 4.317), ACTIVITY, ACTIVITY2];
const evp = load(RASTER_ROWS);

test('a unit row on a PNG is a picture at its spec\'s size, not an engine asset; the page hands the engine href, aspect and size', () => {
  const meta = evp(`PATCH_META.unit_mar_dc_026`);
  assert.equal(meta.img, 'patches/patch-mar-dc-026/patch-mar-dc-026.png');
  assert.equal(meta.asset, null);
  assert.deepEqual(meta.sizeIn, { w: 3, h: 2.968 });
  assert.deepEqual([meta.w, meta.h], [3, 2.968]);
  const p = evp(`(function(){ State.uniform = 'ocp'; State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.patches = []; State.unitPatchCharter = 'MAR-DC-026';
    return CAPUBUniformView.buildFromState().patches.map(p => ({ id: p.id, kind: p.kind, slot: p.slot, asset: p.asset, href: p.href, aspect: p.aspect, size: p.size })); })()`);
  assert.equal(p.length, 2);
  assert.deepEqual([p[0].id, p[0].asset, p[0].size], ['unit_mar_dc_026', null, { w: 3, h: 2.968 }]);
  assert.match(p[0].href, /patches\/patch-mar-dc-026\/patch-mar-dc-026\.png/);
  assert.ok(Math.abs(p[0].aspect - 3 / 2.968) < 1e-9);
  assert.deepEqual([p[1].id, p[1].kind, p[1].slot, p[1].size], ['unit_mar_dc_001', 'hhq', 'L_SHOULDER', { w: 3.25, h: 4.317 }]);
  evp(`State.unitPatchCharter = ''`);
});

test('an activity patch is a catalog entry of the NCSA kind: in the patch list, authorized and placed as NESA is, with the Worn picker where it has several places', () => {
  for(const id of ['ncsa_mots_patch', 'ncsa_national_geospatial_academy_patch']){
    const meta = evp(`PATCH_META[${j(id)}]`);
    assert.equal(meta.kind, 'activity');
    assert.ok(!('echelon' in meta));
    assert.equal(meta.asset, null);
    assert.ok(evp(`patchList.includes(${j(id)})`), `${id} is in the patch list`);
    assert.ok(evp(`NCSA_PATCH_IDS.has(${j(id)})`));
    assert.deepEqual(meta.authorizedUniforms, evp('PATCH_META.nesa_patch.authorizedUniforms'));
    for(const u of ALL){
      assert.equal(evp(`isPatchAuthorizedForUniform(${j(id)}, ${j(u)}, 'cadet')`), evp(`isPatchAuthorizedForUniform('nesa_patch', ${j(u)}, 'cadet')`), `${id} on ${u}`);
      assert.deepEqual(evp(`getPatchPlaces(${j(id)}, ${j(u)}).map(p => p.slot)`), evp(`getPatchPlaces('nesa_patch', ${j(u)}).map(p => p.slot)`), `${id} places on ${u}`);
    }
    evp(`State.uniform = 'corporate_field'; State.membership = 'cadet'`);
    const tile = evp(`patchTileHtml(${j(id)})`);
    assert.match(tile, /<select class="ptPlace"/, 'the Worn picker');
    assert.match(tile, /patches\/patch-ncsa-[a-z-]+\.png|\.png/);
    assert.doesNotMatch(tile.replace(/<img[^>]*>/, ''), /ncsa_|patch-ncsa|\.png/, 'no id or file name in the text');
  }
  assert.equal(evp(`getUnitPatchIdForCharter('NCSA')`), null, 'an activity patch has no charter');
});

test('an activity patch is drawn where the member puts it, on the picture at its spec\'s size', () => {
  const placed = evp(`(function(){ State.uniform = 'corporate_field'; State.membership = 'cadet'; State.gender = 'male'; State.rank = 'C/Capt'; State.unitPatchCharter = '';
    State.patches = ['ncsa_mots_patch']; return CAPUBUniformView.buildFromState().patches.map(p => ({ id: p.id, kind: p.kind, slot: p.slot, asset: p.asset, size: p.size })); })()`);
  assert.deepEqual(placed, [{ id: 'ncsa_mots_patch', kind: 'general', slot: 'R_SHOULDER', asset: null, size: { w: 3, h: 3.05 } }]);
  evp(`State.patches = []`);
});
