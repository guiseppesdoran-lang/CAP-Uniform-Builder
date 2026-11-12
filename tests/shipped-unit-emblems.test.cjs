'use strict';
// The unit emblems shipped for Arlington Composite Squadron (MAR-DC-026), which replaces the emblem it had, and for Hawaii Wing and its squadrons
// (PCR-HI-001, -030, -060, -066, -073, -075): official digital artwork as given, each tied to its unit by charter number. These read the real data
// (data/unit-patch-art.js) and the real pictures under images/patches, not fixtures.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROWS = require('../data/unit-patch-art.js');
const PATCHES = path.join(__dirname, '..', 'images', 'patches');

// charter, patch id, label, echelon, asset, width in inches
const SHIPPED = [
  ['MAR-DC-026', 'unit_mar_dc_026', 'Arlington Composite Squadron', 'squadron', 'patch-mar-dc-026', 3],
  ['PCR-HI-001', 'unit_pcr_hi_001', 'Hawaii Wing', 'wing', 'patch-hawaii-wing', 3.25],
  ['PCR-HI-030', 'unit_pcr_hi_030', 'Maryknoll Cadet Squadron', 'squadron', 'patch-pcr-hi-030', 3],
  ['PCR-HI-060', 'unit_pcr_hi_060', 'Kona Composite Squadron', 'squadron', 'patch-pcr-hi-060', 3],
  ['PCR-HI-066', 'unit_pcr_hi_066', 'Hickam Composite Squadron', 'squadron', 'patch-pcr-hi-066', 3],
  ['PCR-HI-073', 'unit_pcr_hi_073', 'Kauai Composite Squadron', 'squadron', 'patch-pcr-hi-073', 3],
  ['PCR-HI-075', 'unit_pcr_hi_075', 'West Oahu Composite Squadron', 'squadron', 'patch-pcr-hi-075', 3]
];
const specOf = asset => JSON.parse(fs.readFileSync(path.join(PATCHES, asset, asset + '.spec.json'), 'utf8'));

// The top row of a PNG (colour type 6, 8 bits): row 0 has no row above it, so every filter reduces to what the pixel to its left gives.
function topRow(file){
  const buf = fs.readFileSync(file);
  assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a PNG');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), depth = buf[24], ctype = buf[25];
  let pos = 8; const idat = [];
  while(pos < buf.length){ const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8); if(type === 'IDAT') idat.push(buf.subarray(pos + 8, pos + 8 + len)); pos += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)).subarray(0, 1 + w * 4), filter = raw[0], row = Buffer.from(raw.subarray(1));
  if(ctype === 6 && depth === 8) for(let x = 4; x < row.length; x++){ const a = row[x - 4]; row[x] = (row[x] + (filter === 1 || filter === 4 ? a : filter === 3 ? a >> 1 : 0)) & 255; }
  return { w, h, depth, ctype, row };
}

test('each emblem has its row: the unit\'s charter, name and level, a PNG at the size its spec gives', () => {
  for(const [charter, patchId, label, echelon, asset, width] of SHIPPED){
    const r = ROWS.filter(x => x.charter === charter);
    assert.equal(r.length, 1, `${charter}: one emblem`);
    const spec = specOf(asset);
    assert.deepEqual([r[0].patchId, r[0].label, r[0].echelon, r[0].kind, r[0].asset, r[0].img], [patchId, label, echelon, 'unit', asset, `patches/${asset}/${asset}.png`], charter);
    assert.deepEqual([r[0].w, r[0].h], [spec.width_in, spec.height_in], `${charter}: the row carries the spec's size`);
    assert.equal(spec.width_in, width, `${charter}: ${echelon === 'wing' ? 'a wing patch is 3.25 in wide' : 'a squadron patch is 3 in wide'}`);
    assert.deepEqual([spec.charter, spec.label, spec.kind, spec.echelon, spec.file], [charter, label, 'unit', echelon, asset + '.png']);
  }
});

test('each emblem is official artwork as given: a PNG with a transparent ground, at most 1200 px on its long side, its aspect the spec\'s, and its folder holds the picture and its spec only', () => {
  for(const [charter, , , , asset] of SHIPPED){
    const file = path.join(PATCHES, asset, asset + '.png'), spec = specOf(asset), top = topRow(file);
    assert.equal(spec.data_source, 'official-digital-artwork-as-given', charter);
    assert.deepEqual([top.depth, top.ctype], [8, 6], `${charter}: 8-bit RGBA`);
    assert.deepEqual([top.w, top.h], spec.artwork.px, `${charter}: the spec states the picture's pixels`);
    assert.ok(Math.max(top.w, top.h) <= 1200, `${charter}: ${top.w} x ${top.h}`);
    assert.ok(Math.abs(spec.height_in / spec.width_in - top.h / top.w) < 0.001, `${charter}: height follows the artwork's own aspect`);
    assert.equal(top.row[3], 0, `${charter}: the top left corner is transparent`);
    assert.equal(top.row[top.row.length - 1], 0, `${charter}: the top right corner is transparent`);
    assert.equal(spec.artwork.bytes, fs.statSync(file).size, `${charter}: the spec states the file's size`);
    assert.deepEqual(fs.readdirSync(path.join(PATCHES, asset)).sort(), [asset + '.png', asset + '.spec.json'], `${charter}: no other picture beside it (no old SVG, no old picture)`);
  }
});

test('each emblem says where it came from: the page and file address for the ones fetched, the supplier for the three supplied; no path of this machine', () => {
  for(const [charter, , , , asset] of SHIPPED){
    const spec = specOf(asset), text = JSON.stringify(spec);
    assert.match(spec.provenance, /\b2026-11-1\d\b/, `${charter}: dated`);
    assert.match(spec.provenance, new RegExp(charter), `${charter}: the provenance names the charter`);
    assert.match(spec.provenance, /Charter: /, `${charter}: and says how the unit and charter were settled`);
    assert.match(spec.reference, /^assets\/refs\/(patches-official|unit-emblems-supplied)\//, charter);
    if(/^assets\/refs\/patches-official\//.test(spec.reference)) assert.match(spec.provenance, /page https:\/\/hiwg\.cap\.gov\/about\/heraldry-of-our-units; file address https:\/\/hiwg\.cap\.gov\/media\/cms\/[\w.-]+\.png/, `${charter}: page and file address`);
    else assert.match(spec.provenance, /digital artwork supplied by Ethan Hillard on 2026-11-11/, `${charter}: supplied`);
    assert.match(spec.artwork.source_sha256, /^[0-9a-f]{64}$/, `${charter}: the source file's hash`);
    assert.doesNotMatch(text, /\/Users\/|\/private\/|\/tmp\/|\.scratch|\.claude|file:\/\//, `${charter}: no local path`);
  }
});

test('the Arlington emblem stands under the id it had and is the supplied artwork: the white ground made transparent, nothing inside its outline changed', () => {
  const spec = specOf('patch-mar-dc-026');
  assert.equal(spec.label, 'Arlington Composite Squadron');
  assert.equal(spec.reference, 'assets/refs/unit-emblems-supplied/mar-dc-026-arlington-composite-squadron.webp');
  assert.ok(spec.artwork.white_ground_removed.px > 100000 && spec.artwork.white_ground_removed.edge_px > 1000, 'the ground was white and is now transparent');
  assert.match(spec.provenance, /It replaces the Brand Tools squadron emblem/);
  assert.notDeepEqual(spec.artwork.px, [187, 185], 'not the 187 x 185 px picture it had');
  assert.ok(!fs.existsSync(path.join(PATCHES, 'patch-mar-dc-026', 'patch-mar-dc-026.svg')));
});

const real = (() => {
  const { context, referenceErrors } = loadPageScripts({});
  assert.deepEqual(referenceErrors, []);
  return src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
})();
const placed = (uniform, charter, membership = 'senior') => real(`(function(){ State.uniform = ${JSON.stringify(uniform)}; State.membership = ${JSON.stringify(membership)}; State.gender = 'male'; State.rank = ${membership === 'cadet' ? "'C/Capt'" : "'Capt'"};
  State.patches = []; State.unitPatchCharter = ${JSON.stringify(charter)};
  const p = CAPUBUniformView.buildFromState().patches.map(p => [p.id, p.kind, p.slot, p.size.w, p.size.h]); State.unitPatchCharter = ''; return p; })()`);

test('a Hawaii squadron on the OCP wears its own emblem on the right sleeve and the Hawaii Wing patch on the left; the wing wears the Pacific Region patch there', () => {
  const sizeOf = charter => { const r = ROWS.find(x => x.charter === charter); return [r.w, r.h]; };
  for(const charter of ['PCR-HI-030', 'PCR-HI-060', 'PCR-HI-066', 'PCR-HI-073', 'PCR-HI-075']){
    assert.deepEqual(placed('ocp', charter), [
      [`unit_${charter.toLowerCase().replace(/-/g, '_')}`, 'unit', 'R_SHOULDER', ...sizeOf(charter)],
      ['unit_pcr_hi_001', 'hhq', 'L_SHOULDER', ...sizeOf('PCR-HI-001')]
    ], charter);
  }
  assert.deepEqual(placed('ocp', 'PCR-HI-001'), [['unit_pcr_hi_001', 'unit', 'R_SHOULDER', ...sizeOf('PCR-HI-001')], ['unit_pcr_pcr_001', 'hhq', 'L_SHOULDER', ...sizeOf('PCR-PCR-001')]]);
  assert.equal(real(`getUnitHhqPatchId('PCR-HI-073')`), 'unit_pcr_hi_001');
});

test('the wing\'s reserve squadron (PCR-HI-000) wears the wing\'s patch; Arlington keeps the National Capital Wing as its higher headquarters; the Unit patch list marks each emblem', () => {
  assert.equal(real(`getUnitPatchIdForCharter('PCR-HI-000')`), 'unit_pcr_hi_001');
  assert.equal(real(`getUnitPatchIdForCharter('pcr-hi-073')`), 'unit_pcr_hi_073');
  assert.equal(real(`getUnitHhqPatchId('MAR-DC-026')`), 'unit_mar_dc_001');
  assert.deepEqual(placed('ocp', 'MAR-DC-026').map(p => p.slice(0, 3)), [['unit_mar_dc_026', 'unit', 'R_SHOULDER'], ['unit_mar_dc_001', 'hhq', 'L_SHOULDER']]);
  assert.deepEqual(placed('abu', 'PCR-HI-073').map(p => p.slice(0, 3)), [['unit_pcr_hi_073', 'unit', 'CHEST_RIGHT']], 'a squadron\'s patch is on the right pocket of the ABU');
  assert.deepEqual(placed('flight_suit', 'PCR-HI-073'), [], 'the flight suit takes no squadron patch');
  assert.deepEqual(placed('flight_suit', 'PCR-HI-001').map(p => p.slice(0, 3)), [['unit_pcr_hi_001', 'unit', 'R_SHOULDER']], 'and takes the wing\'s');
  real(`State.uniform = 'ocp'; State.membership = 'senior'`);
  const all = real('getUnitPatchOptions()'), marked = all.filter(o => o.hasArtwork).map(o => o.code);
  for(const [charter] of SHIPPED) assert.ok(marked.includes(charter), charter);
  assert.ok(marked.includes('PCR-HI-000'), 'the reserve squadron shares the wing\'s');
  assert.match(all.find(o => o.code === 'PCR-HI-073').text, /^PCR-HI-073 - Kauai Composite S.* ✓ artwork available$/);
  // the squadrons that have no emblem yet (a "coming soon" picture on the wing's page) stay without one
  for(const code of ['PCR-HI-009', 'PCR-HI-043', 'PCR-HI-057', 'PCR-HI-077', 'PCR-HI-078']) assert.ok(!marked.includes(code), code);
});
