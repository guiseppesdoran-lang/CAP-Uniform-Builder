'use strict';
// Three California unit emblems the owner sent on 2026-11-18 (two squadrons and a group) are registered the way every unit emblem is: a row of
// data/unit-patch-art.js made by scripts/sync-patches.cjs from the art tree's spec, a patch catalog entry, the charter table, the picture under
// images/patches. A squadron or group wears its own emblem on the OCP right sleeve and gets the California Wing's as its higher headquarters patch on the left.
// These read the real data and the real pictures.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const { pngFacts } = require('./helpers/patch-ground.cjs');

const ROWS = require('../data/unit-patch-art.js');
const INDEX = require('../data/asset-index.js');
const UNITS = (() => { const w = {}; new vm.Script(fs.readFileSync(path.join(__dirname, '..', 'data', 'unit-options.js'), 'utf8')).runInNewContext({ window: w }); return JSON.parse(JSON.stringify(w.CAP_UNIT_OPTIONS)); })();
const PATCHES = path.join(__dirname, '..', 'images', 'patches');
const specOf = id => JSON.parse(fs.readFileSync(path.join(PATCHES, id, id + '.spec.json'), 'utf8'));
const j = JSON.stringify;

const EMBLEMS = [
  { charter: 'PCR-CA-295', asset: 'patch-fullerton-composite-squadron-56', label: 'Fullerton Composite Squadron 56', echelon: 'squadron', w: 3 },
  { charter: 'PCR-CA-384', asset: 'patch-saddleback-composite-squadron-68', label: 'Saddleback Composite Squadron 68', echelon: 'squadron', w: 3 },
  { charter: 'PCR-CA-006', asset: 'patch-south-coast-group-7', label: 'South Coast Group 7', echelon: 'group', w: 3 }
];
const patchIdOf = c => 'unit_' + c.toLowerCase().replace(/-/g, '_');

const real = (() => {
  const { context, referenceErrors } = loadPageScripts({});
  assert.deepEqual(referenceErrors, []);
  return src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
})();
const placed = (uniform, charter, membership = 'senior') => real(`(function(){ State.uniform = ${j(uniform)}; State.membership = ${j(membership)}; State.gender = 'male'; State.rank = ${membership === 'cadet' ? "'C/Capt'" : "'Capt'"};
  State.patches = []; State.unitPatchCharter = ${j(charter)};
  const p = CAPUBUniformView.buildFromState().patches.map(p => [p.id, p.kind, p.slot, p.size && p.size.w, p.size && p.size.h]); State.unitPatchCharter = ''; return p; })()`);

test('each charter is a California unit of the builder\'s list, named as the emblem reads it', () => {
  const listed = { 'PCR-CA-295': 'FULLERTON COMPOSITE SQDN 56', 'PCR-CA-384': 'SADDLEBACK COMPOSITE SQDN 68', 'PCR-CA-006': 'SOUTH COAST GROUP 7' };
  for(const e of EMBLEMS) assert.deepEqual(UNITS.filter(x => x.code === e.charter).map(x => x.name), [listed[e.charter]], e.charter);
});

test('each picture is the owner\'s emblem as given: 8-bit RGBA at the pixel size its spec records, a clear edge ring, a thin edge, and the spec is dated with no local path', () => {
  for(const e of EMBLEMS){
    const file = path.join(PATCHES, e.asset, e.asset + '.png'), spec = specOf(e.asset), buf = fs.readFileSync(file);
    assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], e.asset + ' is a PNG');
    assert.deepEqual([buf[24], buf[25]], [8, 6], e.asset + ': 8-bit RGBA');
    assert.deepEqual(spec.artwork.px, [buf.readUInt32BE(16), buf.readUInt32BE(20)], e.asset + ': the spec gives the picture\'s size');
    assert.equal(spec.artwork.bytes, buf.length);
    assert.equal(spec.artwork.ground, 'transparent');
    const f = pngFacts(file);
    assert.ok(f.edgeShare < 0.2, `${e.asset}: edge ring not clear ${f.edgeShare.toFixed(3)}`);
    assert.ok(f.partialShare < 0.03, `${e.asset}: the edge is a few pixels wide (${f.partialShare.toFixed(3)} partly clear)`);
    assert.deepEqual([spec.asset_id, spec.label, spec.charter, spec.kind, spec.echelon, spec.file], [e.asset, e.label, e.charter, 'unit', e.echelon, e.asset + '.png']);
    assert.equal(spec.data_source, 'official-digital-artwork-as-given');
    assert.equal(spec.width_in, e.w, 'a squadron and a group are 3 in wide, as the other group emblems are');
    assert.ok(Math.abs(spec.height_in / spec.width_in - spec.artwork.px[1] / spec.artwork.px[0]) < 0.001, e.asset + ': height follows the picture\'s own aspect');
    assert.match(spec.provenance, /sent by the owner, 2026-11-18/);
    assert.match(spec.provenance, /Charter: /);
    assert.match(spec.artwork.source_sha256, /^[0-9a-f]{64}$/);
    assert.doesNotMatch(JSON.stringify(spec), /\/Users\/|\/private\/|\/tmp\/|\.scratch|file:\/\//, 'no local path');
    assert.deepEqual(fs.readdirSync(path.join(PATCHES, e.asset)).sort(), [e.asset + '.png', e.asset + '.spec.json']);
  }
});

test('the Saddleback picture is very small and ships at its own size, not enlarged', () => {
  const spec = specOf('patch-saddleback-composite-squadron-68');
  assert.deepEqual(spec.artwork.source_px, [180, 208]);
  assert.ok(spec.artwork.px[0] <= 180 && spec.artwork.px[1] <= 208);
});

test('each emblem is registered as every unit emblem is: a row at the spec\'s size, an asset index entry, a patch catalog entry, the charter tables', () => {
  for(const e of EMBLEMS){
    const spec = specOf(e.asset), rows = ROWS.filter(r => r.charter === e.charter), id = patchIdOf(e.charter);
    assert.equal(rows.length, 1, e.charter);
    assert.deepEqual([rows[0].patchId, rows[0].label, rows[0].echelon, rows[0].kind, rows[0].asset, rows[0].img], [id, e.label, e.echelon, 'unit', e.asset, `patches/${e.asset}/${e.asset}.png`]);
    assert.deepEqual([rows[0].w, rows[0].h], [spec.width_in, spec.height_in]);
    assert.equal(INDEX[e.asset], `patches/${e.asset}/${e.asset}.png`);
    const meta = real(`PATCH_META[${j(id)}]`);
    assert.deepEqual([meta.label, meta.kind, meta.unitEchelon, meta.charter, meta.img, meta.sizeIn], [e.label, 'unit', e.echelon, e.charter, rows[0].img, { w: rows[0].w, h: rows[0].h }]);
    assert.equal(real(`getUnitEchelon(${j(e.charter)})`), e.echelon);
    assert.equal(real(`getUnitPatchIdForCharter(${j(e.charter)})`), id);
    assert.equal(real(`unitCharterHasArtwork(${j(e.charter)})`), true);
  }
});

test('a member of each unit wears its emblem on the OCP right sleeve and the California Wing\'s on the left as the higher headquarters (a group\'s too), and the same places on the ABU and the flight suit as any squadron emblem', () => {
  for(const e of EMBLEMS){
    const id = patchIdOf(e.charter), spec = specOf(e.asset);
    assert.equal(real(`getUnitHhqPatchId(${j(e.charter)})`), 'unit_pcr_ca_001', e.charter);
    const ocp = placed('ocp', e.charter);
    assert.deepEqual(ocp.map(p => p.slice(0, 3)), [[id, 'unit', 'R_SHOULDER'], ['unit_pcr_ca_001', 'hhq', 'L_SHOULDER']], e.charter);
    assert.deepEqual(ocp[0].slice(3), [spec.width_in, spec.height_in]);
    assert.deepEqual(placed('abu', e.charter).map(p => p.slice(0, 3)), [[id, 'unit', 'CHEST_RIGHT']], `${e.charter}: right pocket of the ABU`);
    assert.deepEqual(placed('flight_suit', e.charter), [], `${e.charter}: the flight suit takes no unit patch`);
    assert.deepEqual(placed('ocp', e.charter, 'cadet').map(p => p.slice(0, 3)), ocp.map(p => p.slice(0, 3)), `${e.charter}: cadets as seniors`);
  }
});
