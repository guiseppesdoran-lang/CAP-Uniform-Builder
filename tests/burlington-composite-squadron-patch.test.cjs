'use strict';
// The Burlington Composite Squadron emblem (MAR-NC-022, the unit the builder's list names Burlington Composite Sqdn) the owner supplied on 2026-11-12, with its
// feathered edge made a clean outline, is registered the way every squadron emblem is: a row of data/unit-patch-art.js made by scripts/sync-patches.cjs from
// the art tree's spec, a patch catalog entry, the charter table, the picture under images/patches. The unit gets this patch; the other Burlington unit
// (NCR-IA-005, a flight) does not. These read the real data and the real picture.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const { pngFacts, verdict } = require('./helpers/patch-ground.cjs');

const ROWS = require('../data/unit-patch-art.js');
const INDEX = require('../data/asset-index.js');
const UNITS = (() => { const w = {}; new vm.Script(fs.readFileSync(path.join(__dirname, '..', 'data', 'unit-options.js'), 'utf8')).runInNewContext({ window: w }); return JSON.parse(JSON.stringify(w.CAP_UNIT_OPTIONS)); })();
const PATCHES = path.join(__dirname, '..', 'images', 'patches');
const ASSET = 'patch-burlington-composite-squadron', FILE = path.join(PATCHES, ASSET, ASSET + '.png');
const specOf = id => JSON.parse(fs.readFileSync(path.join(PATCHES, id, id + '.spec.json'), 'utf8'));
const spec = specOf(ASSET), sibling = specOf('patch-pcr-ca-345');
const j = JSON.stringify;

const real = (() => {
  const { context, referenceErrors } = loadPageScripts({});
  assert.deepEqual(referenceErrors, []);
  return src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
})();
const placed = (uniform, charter, membership = 'senior') => real(`(function(){ State.uniform = ${j(uniform)}; State.membership = ${j(membership)}; State.gender = 'male'; State.rank = ${membership === 'cadet' ? "'C/Capt'" : "'Capt'"};
  State.patches = []; State.unitPatchCharter = ${j(charter)};
  const p = CAPUBUniformView.buildFromState().patches.map(p => [p.id, p.kind, p.slot, p.size && p.size.w, p.size && p.size.h]); State.unitPatchCharter = ''; return p; })()`);

test('the unit is the one the list names Burlington Composite Squadron, found by the name and not by a guess: exactly one, MAR-NC-022, and the other Burlington unit is a flight', () => {
  const named = UNITS.filter(u => /^BURLINGTON COMPOSITE S/.test(u.name));
  assert.deepEqual(named.map(u => u.code), ['MAR-NC-022']);
  assert.deepEqual(UNITS.filter(u => /BURLINGTON/.test(u.name) && u.code !== 'MAR-NC-022').map(u => [u.code, u.name]), [['NCR-IA-005', 'BURLINGTON FLIGHT']]);
});

test('the picture is the owner\'s emblem with its feathered edge made a clean outline: 8-bit RGBA, no ground and no marks at its edge, the white of the triangle and of the stripe kept', () => {
  const buf = fs.readFileSync(FILE);
  assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a PNG');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  assert.deepEqual([buf[24], buf[25]], [8, 6], '8-bit RGBA');
  assert.deepEqual(spec.artwork.px, [w, h]);
  assert.equal(spec.artwork.bytes, buf.length);
  const facts = pngFacts(FILE);
  assert.equal(verdict(facts), 'emblem', `edge ${facts.edgeShare.toFixed(3)} not clear, ${facts.edgeRuns} runs on one edge, ${facts.partialShare.toFixed(3)} partly clear`);
  assert.ok(facts.partialShare < 0.03, `the edge is a few pixels wide, not the 12 px feather the file came with (${facts.partialShare.toFixed(3)} of the picture is partly clear)`);
  assert.ok(facts.lightOpaqueShare > 0.02, `the white stripe and the white triangle stay (${facts.lightOpaqueShare.toFixed(3)} of the picture is opaque near-white)`);
  assert.equal(spec.artwork.ground, 'transparent');
});

test('its spec is the official emblem as given: Burlington Composite Squadron, MAR-NC-022, a squadron, 3 in wide like the squadron emblems with the height of its own aspect, dated, with no path of this machine', () => {
  assert.deepEqual([spec.asset_id, spec.label, spec.charter, spec.kind, spec.echelon, spec.file], [ASSET, 'Burlington Composite Squadron', 'MAR-NC-022', 'unit', 'squadron', ASSET + '.png']);
  assert.equal(spec.data_source, 'official-digital-artwork-as-given');
  assert.equal(spec.width_in, 3);
  assert.ok(Math.abs(spec.height_in / spec.width_in - spec.artwork.px[1] / spec.artwork.px[0]) < 0.001, 'height follows the artwork\'s own aspect');
  for(const k of ['size_source', 'size_basis', 'citation', 'unit', 'dimensions', 'generator']) assert.deepEqual(spec[k], sibling[k], `${k} is the other squadron emblems'`);
  assert.deepEqual(Object.keys(spec.anchors), Object.keys(sibling.anchors));
  assert.deepEqual([spec.anchors.top_center, spec.anchors.left_edge[0], spec.anchors.right_edge[0]], [[150, 0], 0, 300], 'the anchors follow the width');
  assert.ok(Math.abs(spec.anchors.bottom_center[1] - spec.height_in * 100) < 0.1, 'and the height');
  assert.match(spec.provenance, /supplied by Ethan Hillard on 2026-11-12/);
  assert.match(spec.provenance, /MAR-NC-022/);
  assert.match(spec.provenance, /Charter: /);
  assert.match(spec.artwork.source_sha256, /^[0-9a-f]{64}$/);
  assert.match(spec.reference, /^assets\/refs\/unit-emblems-supplied-2026-11-12\/burlington-composite-squadron\.webp$/);
  assert.doesNotMatch(JSON.stringify(spec), /\/Users\/|\/private\/|\/tmp\/|\.scratch|\.claude|file:\/\//, 'no local path');
  assert.deepEqual(fs.readdirSync(path.join(PATCHES, ASSET)).sort(), [ASSET + '.png', ASSET + '.spec.json']);
});

test('it is registered as every squadron emblem is: a row in the unit emblem data at the spec\'s size, an entry in the asset index, a catalog entry of an organizational patch', () => {
  const rows = ROWS.filter(r => r.charter === 'MAR-NC-022'), sib = ROWS.find(r => r.charter === 'PCR-CA-345');
  assert.equal(rows.length, 1, 'one emblem for the charter');
  assert.deepEqual([rows[0].patchId, rows[0].label, rows[0].echelon, rows[0].kind, rows[0].asset, rows[0].img], ['unit_mar_nc_022', 'Burlington Composite Squadron', 'squadron', 'unit', ASSET, `patches/${ASSET}/${ASSET}.png`]);
  assert.deepEqual([rows[0].w, rows[0].h], [spec.width_in, spec.height_in], 'the row carries the spec\'s size');
  assert.deepEqual(Object.keys(rows[0]), Object.keys(sib), 'the same kind of row');
  assert.equal(INDEX[ASSET], `patches/${ASSET}/${ASSET}.png`);
  const meta = real(`PATCH_META['unit_mar_nc_022']`), sibMeta = real(`PATCH_META['unit_pcr_ca_345']`);
  assert.deepEqual([meta.label, meta.kind, meta.unitEchelon, meta.charter, meta.img, meta.asset, meta.sizeIn], ['Burlington Composite Squadron', 'unit', 'squadron', 'MAR-NC-022', rows[0].img, null, { w: rows[0].w, h: rows[0].h }]);
  assert.ok(!('echelon' in meta), 'a squadron\'s patch is not a headquarters patch');
  assert.deepEqual([meta.slotHint, meta.authorizedUniforms], [sibMeta.slotHint, sibMeta.authorizedUniforms], 'authorized where another squadron\'s emblem is');
  assert.equal(real(`getUnitEchelon('MAR-NC-022')`), 'squadron');
  assert.deepEqual(real(`getUnitPatchCharters('unit_mar_nc_022')`), ['MAR-NC-022']);
});

test('the unit gets this patch: the Unit patch list marks MAR-NC-022 with artwork, it is worn on the OCP right sleeve and the ABU and CFU right pocket, not on the flight suits; the Burlington flight has none', () => {
  assert.equal(real(`getUnitPatchIdForCharter('MAR-NC-022')`), 'unit_mar_nc_022');
  assert.equal(real(`getUnitPatchIdForCharter('mar-nc-022')`), 'unit_mar_nc_022');
  assert.equal(real(`unitCharterHasArtwork('MAR-NC-022')`), true);
  assert.equal(real(`getUnitPatchIdForCharter('NCR-IA-005')`), null, 'the flight of the same name is another unit');
  real(`State.uniform = 'ocp'; State.membership = 'senior'`);
  assert.deepEqual(real(`getUnitPatchOptions('mar-nc-022')`), [{ code: 'MAR-NC-022', hasArtwork: true, text: 'MAR-NC-022 - Burlington Composite Squadron  ✓ artwork available' }]);
  assert.equal(real(`getUnitPatchOptions('ncr-ia-005')`)[0].hasArtwork, false);
  for(const u of ['abu', 'ocp', 'corporate_field', 'flight_suit', 'corporate_flight_suit']){
    assert.equal(real(`isPatchAuthorizedForUniform('unit_mar_nc_022', ${j(u)}, 'senior')`), real(`isPatchAuthorizedForUniform('unit_pcr_ca_345', ${j(u)}, 'senior')`), u);
    assert.deepEqual(real(`getPatchPlaces('unit_mar_nc_022', ${j(u)}).map(p => p.slot)`), real(`getPatchPlaces('unit_pcr_ca_345', ${j(u)}).map(p => p.slot)`), `${u}: the same places`);
  }
  const w = spec.width_in, h = spec.height_in;
  assert.deepEqual(placed('ocp', 'MAR-NC-022'), [['unit_mar_nc_022', 'unit', 'R_SHOULDER', w, h]]);
  assert.deepEqual(placed('abu', 'MAR-NC-022'), [['unit_mar_nc_022', 'unit', 'CHEST_RIGHT', w, h]]);
  assert.deepEqual(placed('corporate_field', 'MAR-NC-022'), [['unit_mar_nc_022', 'unit', 'CHEST_RIGHT', w, h]]);
  assert.deepEqual(placed('flight_suit', 'MAR-NC-022'), [], 'the flight suit takes no squadron patch');
  assert.deepEqual(placed('ocp', 'MAR-NC-022', 'cadet'), placed('ocp', 'MAR-NC-022'), 'cadets wear it as seniors do');
  assert.deepEqual(placed('ocp', 'NCR-IA-005'), [], 'no patch for the other Burlington unit');
});
