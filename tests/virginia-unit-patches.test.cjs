'use strict';
// Six Virginia unit emblems the owner sent on 2026-11-18 (the wing and five squadrons) are registered the way every unit emblem is: a row of
// data/unit-patch-art.js made by scripts/sync-patches.cjs from the art tree's spec, a patch catalog entry, the charter table, the picture under
// images/patches. A squadron wears its own emblem on the OCP right sleeve and gets the Virginia Wing's as its higher headquarters patch on the left.
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
  { charter: 'MAR-VA-001', asset: 'patch-virginia-wing', label: 'Virginia Wing', echelon: 'wing', w: 3.25 },
  { charter: 'MAR-VA-007', asset: 'patch-william-p-knight-composite-squadron', label: 'William P. Knight Composite Squadron', echelon: 'squadron', w: 3 },
  { charter: 'MAR-VA-017', asset: 'patch-lynchburg-composite-squadron', label: 'Lynchburg Composite Squadron', echelon: 'squadron', w: 3 },
  { charter: 'MAR-VA-025', asset: 'patch-langley-composite-squadron', label: 'Langley Composite Squadron', echelon: 'squadron', w: 3 },
  { charter: 'MAR-VA-102', asset: 'patch-prince-william-composite-squadron', label: 'Prince William Composite Squadron', echelon: 'squadron', w: 3 },
  { charter: 'MAR-VA-999', asset: 'patch-virginia-legislative-squadron', label: 'Virginia State Legislative Squadron', echelon: 'squadron', w: 3 }
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

test('each charter is a Virginia unit of the builder\'s list (region MAR), the one that list names as the emblem does', () => {
  const listed = { 'MAR-VA-001': 'VIRGINIA WING HQ', 'MAR-VA-007': 'WILLIAM P KNIGHT COMPOSITE SQUADRON', 'MAR-VA-017': 'LYNCHBURG COMPOSITE SQDN', 'MAR-VA-025': 'LANGLEY COMPOSITE SQDN',
    'MAR-VA-102': 'PRINCE WILLIAM COMPOSITE SQDN', 'MAR-VA-999': 'VIRGINIA STATE LEGISLATIVE SQUADRON' };
  for(const e of EMBLEMS) assert.deepEqual(UNITS.filter(x => x.code === e.charter).map(x => x.name), [listed[e.charter]], e.charter);
});

test('each picture is the owner\'s emblem as given: 8-bit RGBA at the pixel size its spec records, clear at its corners, a clear edge ring apart from where the emblem itself reaches the edge, and the spec is dated with no local path', () => {
  for(const e of EMBLEMS){
    const file = path.join(PATCHES, e.asset, e.asset + '.png'), spec = specOf(e.asset), buf = fs.readFileSync(file);
    assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], e.asset + ' is a PNG');
    assert.deepEqual([buf[24], buf[25]], [8, 6], e.asset + ': 8-bit RGBA');
    assert.deepEqual(spec.artwork.px, [buf.readUInt32BE(16), buf.readUInt32BE(20)], e.asset + ': the spec gives the picture\'s size');
    assert.equal(spec.artwork.bytes, buf.length);
    assert.equal(spec.artwork.ground, 'transparent');
    const f = pngFacts(file);
    assert.ok(f.edgeShare < 0.1, `${e.asset}: edge ring not clear ${f.edgeShare.toFixed(3)}`);
    assert.ok(f.partialShare < 0.03, `${e.asset}: the edge is a few pixels wide (${f.partialShare.toFixed(3)} partly clear)`);
    assert.deepEqual([spec.asset_id, spec.label, spec.charter, spec.kind, spec.echelon, spec.file], [e.asset, e.label, e.charter, 'unit', e.echelon, e.asset + '.png']);
    assert.equal(spec.data_source, 'official-digital-artwork-as-given');
    assert.equal(spec.width_in, e.w);
    assert.ok(Math.abs(spec.height_in / spec.width_in - spec.artwork.px[1] / spec.artwork.px[0]) < 0.001, e.asset + ': height follows the picture\'s own aspect');
    assert.match(spec.provenance, /sent by the owner, 2026-11-18/);
    assert.match(spec.provenance, /Charter: /);
    assert.match(spec.artwork.source_sha256, /^[0-9a-f]{64}$/);
    assert.doesNotMatch(JSON.stringify(spec), /\/Users\/|\/private\/|\/tmp\/|\.scratch|file:\/\//, 'no local path');
    assert.deepEqual(fs.readdirSync(path.join(PATCHES, e.asset)).sort(), [e.asset + '.png', e.asset + '.spec.json']);
  }
});

test('the Langley picture is small and ships at its own size, not enlarged', () => {
  const spec = specOf('patch-langley-composite-squadron');
  assert.ok(spec.artwork.px[0] < 300 && spec.artwork.px[1] < 300, 'at most its own 261 x 287 px source');
  assert.deepEqual(spec.artwork.source_px, [261, 287]);
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

test('a member of each squadron wears its emblem on the OCP right sleeve and the Virginia Wing\'s on the left as the higher headquarters; the wing\'s own members wear the region\'s or none', () => {
  for(const e of EMBLEMS.filter(x => x.echelon === 'squadron')){
    const id = patchIdOf(e.charter), spec = specOf(e.asset);
    assert.equal(real(`getUnitHhqPatchId(${j(e.charter)})`), 'unit_mar_va_001', e.charter);
    const ocp = placed('ocp', e.charter);
    assert.deepEqual(ocp.map(p => p.slice(0, 3)), [[id, 'unit', 'R_SHOULDER'], ['unit_mar_va_001', 'hhq', 'L_SHOULDER']], e.charter);
    assert.deepEqual(ocp[0].slice(3), [spec.width_in, spec.height_in]);
    assert.deepEqual(placed('abu', e.charter).map(p => p.slice(0, 3)), [[id, 'unit', 'CHEST_RIGHT']], `${e.charter}: right pocket of the ABU`);
    assert.deepEqual(placed('flight_suit', e.charter), [], `${e.charter}: the flight suit takes no squadron patch`);
    assert.deepEqual(placed('ocp', e.charter, 'cadet').map(p => p.slice(0, 3)), ocp.map(p => p.slice(0, 3)), `${e.charter}: cadets as seniors`);
  }
  assert.equal(real(`getUnitPatchIdForCharter('MAR-VA-002')`), null, 'a Virginia squadron without an emblem still has none');
  const wing = placed('ocp', 'MAR-VA-001').map(p => p[0]);
  assert.ok(wing.includes('unit_mar_va_001'), 'the wing headquarters wears the wing patch');
});
