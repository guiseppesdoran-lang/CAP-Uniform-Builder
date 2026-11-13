'use strict';
// The Tennessee Wing emblem (SER-TN-001) the owner supplied on 2026-11-12, with its ground made clear, is registered the way the Texas Wing's is: a row of
// data/unit-patch-art.js made by scripts/sync-patches.cjs from the art tree's spec, a patch catalog entry, the charter table, the picture under
// images/patches. A member whose unit is in Tennessee Wing is offered it where a Texas member is offered theirs; the two Tennessee squadron patches
// (TN-185, TN-330) keep working. These read the real data and the real picture.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const { pngFacts, verdict } = require('./helpers/patch-ground.cjs');

const ROWS = require('../data/unit-patch-art.js');
const INDEX = require('../data/asset-index.js');
const PATCHES = path.join(__dirname, '..', 'images', 'patches');
const ASSET = 'patch-tennessee-wing', FILE = path.join(PATCHES, ASSET, ASSET + '.png');
const spec = JSON.parse(fs.readFileSync(path.join(PATCHES, ASSET, ASSET + '.spec.json'), 'utf8'));
const texas = JSON.parse(fs.readFileSync(path.join(PATCHES, 'patch-texas-wing', 'patch-texas-wing.spec.json'), 'utf8'));
const j = JSON.stringify;

const real = (() => {
  const { context, referenceErrors } = loadPageScripts({});
  assert.deepEqual(referenceErrors, []);
  return src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
})();
const placed = (uniform, charter, membership = 'senior') => real(`(function(){ State.uniform = ${j(uniform)}; State.membership = ${j(membership)}; State.gender = 'male'; State.rank = ${membership === 'cadet' ? "'C/Capt'" : "'Capt'"};
  State.patches = []; State.unitPatchCharter = ${j(charter)};
  const p = CAPUBUniformView.buildFromState().patches.map(p => [p.id, p.kind, p.slot, p.size && p.size.w, p.size && p.size.h]); State.unitPatchCharter = ''; return p; })()`);

test('the picture is the owner\'s emblem with its ground made clear: 8-bit RGBA, no ground and no marks at its edge, the white inside the scroll kept', () => {
  const buf = fs.readFileSync(FILE);
  assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a PNG');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  assert.deepEqual([buf[24], buf[25]], [8, 6], '8-bit RGBA');
  assert.deepEqual(spec.artwork.px, [w, h]);
  assert.equal(spec.artwork.bytes, buf.length);
  const facts = pngFacts(FILE);
  assert.equal(verdict(facts), 'emblem', `edge ${facts.edgeShare.toFixed(3)} not clear, ${facts.edgeRuns} runs on one edge, ${facts.partialShare.toFixed(3)} partly clear`);
  assert.ok(facts.nonClearShare > 0.5 && facts.nonClearShare < 0.95, `the emblem fills ${facts.nonClearShare.toFixed(2)} of its box`);
  assert.ok(facts.lightOpaqueShare > 0.1, `the white of the scroll, the ring round the disc and the triangle stays (${facts.lightOpaqueShare.toFixed(2)} of the picture is opaque near-white)`);
  assert.equal(spec.artwork.ground, 'transparent');
  assert.ok(spec.artwork.ground_removed.px > 100000, 'the ground was found by a flood from the edge');
});

test('its spec is the official emblem as given: Tennessee Wing, SER-TN-001, a wing, 3.25 in wide with the height of its own aspect, dated, with no path of this machine', () => {
  assert.deepEqual([spec.asset_id, spec.label, spec.charter, spec.kind, spec.echelon, spec.file], [ASSET, 'Tennessee Wing', 'SER-TN-001', 'unit', 'wing', ASSET + '.png']);
  assert.equal(spec.data_source, 'official-digital-artwork-as-given');
  assert.equal(spec.width_in, 3.25);
  assert.ok(Math.abs(spec.height_in / spec.width_in - spec.artwork.px[1] / spec.artwork.px[0]) < 0.001, 'height follows the artwork\'s own aspect');
  for(const k of ['size_source', 'size_basis', 'citation', 'unit', 'dimensions', 'generator']) assert.deepEqual(spec[k], texas[k], `${k} is the Texas Wing's`);
  assert.deepEqual(Object.keys(spec.anchors), Object.keys(texas.anchors));
  assert.deepEqual([spec.anchors.top_center, spec.anchors.left_edge[0], spec.anchors.right_edge[0], spec.anchors.center[0]], [[spec.width_in * 50, 0], 0, spec.width_in * 100, spec.width_in * 50], 'the anchors follow the width');
  assert.ok(Math.abs(spec.anchors.bottom_center[1] - spec.height_in * 100) < 0.1 && Math.abs(spec.anchors.center[1] * 2 - spec.anchors.bottom_center[1]) < 0.01, 'and the height');
  assert.match(spec.provenance, /supplied by Ethan Hillard on 2026-11-12/);
  assert.match(spec.provenance, /SER-TN-001/);
  assert.match(spec.provenance, /Charter: /);
  assert.match(spec.artwork.source_sha256, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(spec), /\/Users\/|\/private\/|\/tmp\/|\.scratch|file:\/\//, 'no local path');
  assert.deepEqual(fs.readdirSync(path.join(PATCHES, ASSET)).sort(), [ASSET + '.png', ASSET + '.spec.json']);
});

test('it is registered as the Texas Wing is: a row in the unit emblem data at the spec\'s size, an entry in the asset index, a catalog entry of a wing headquarters patch', () => {
  const rows = ROWS.filter(r => r.charter === 'SER-TN-001'), tx = ROWS.find(r => r.charter === 'SWR-TX-001');
  assert.equal(rows.length, 1, 'one emblem for the charter');
  assert.deepEqual([rows[0].patchId, rows[0].label, rows[0].echelon, rows[0].kind, rows[0].asset, rows[0].img], ['unit_ser_tn_001', 'Tennessee Wing', 'wing', 'unit', ASSET, `patches/${ASSET}/${ASSET}.png`]);
  assert.deepEqual([rows[0].w, rows[0].h], [spec.width_in, spec.height_in], 'the row carries the spec\'s size');
  assert.deepEqual(Object.keys(rows[0]), Object.keys(tx), 'the same kind of row');
  assert.equal(INDEX[ASSET], `patches/${ASSET}/${ASSET}.png`);
  const meta = real(`PATCH_META['unit_ser_tn_001']`), txMeta = real(`PATCH_META['unit_swr_tx_001']`);
  assert.deepEqual([meta.label, meta.kind, meta.unitEchelon, meta.echelon, meta.charter, meta.img, meta.asset, meta.sizeIn], ['Tennessee Wing', 'unit', 'wing', 'wing', 'SER-TN-001', rows[0].img, null, { w: rows[0].w, h: rows[0].h }]);
  assert.deepEqual([meta.slotHint, meta.authorizedUniforms], [txMeta.slotHint, txMeta.authorizedUniforms], 'authorized where the Texas Wing\'s is');
  assert.equal(real(`getUnitPatchIdForCharter('SER-TN-001')`), 'unit_ser_tn_001');
  assert.deepEqual(real(`getUnitPatchCharters('unit_ser_tn_001')`), ['SER-TN-001']);
  assert.equal(real(`getUnitEchelon('SER-TN-001')`), 'wing');
});

test('a member in Tennessee Wing is offered it where a Texas member is offered the Texas Wing\'s: the Unit patch list marks the wing and its headquarters squadron, and each worn place is the Texas Wing\'s', () => {
  real(`State.uniform = 'ocp'; State.membership = 'senior'`);
  const marked = real('getUnitPatchOptions()').filter(o => o.hasArtwork).map(o => o.code);
  for(const code of ['SER-TN-001', 'SER-TN-000', 'SWR-TX-001', 'SWR-TX-000']) assert.ok(marked.includes(code), code);
  assert.equal(real(`getUnitPatchIdForCharter('SER-TN-000')`), 'unit_ser_tn_001', 'the wing\'s headquarters squadron wears the wing\'s emblem');
  assert.match(real(`getUnitPatchOptions('ser-tn-001')`).find(o => o.code === 'SER-TN-001').text, /^SER-TN-001 - Tennessee Wing.* ✓ artwork available$/);
  for(const u of ['abu', 'ocp', 'corporate_field', 'flight_suit', 'corporate_flight_suit']){
    assert.equal(real(`isPatchAuthorizedForUniform('unit_ser_tn_001', ${j(u)}, 'senior')`), real(`isPatchAuthorizedForUniform('unit_swr_tx_001', ${j(u)}, 'senior')`), u);
    assert.deepEqual(real(`getPatchPlaces('unit_ser_tn_001', ${j(u)}).map(p => p.slot)`), real(`getPatchPlaces('unit_swr_tx_001', ${j(u)}).map(p => p.slot)`), `${u}: the same places`);
  }
  const w = spec.width_in, h = spec.height_in;
  assert.deepEqual(placed('ocp', 'SER-TN-001'), [['unit_ser_tn_001', 'unit', 'R_SHOULDER', w, h]], 'the wing\'s own patch is a member\'s unit patch on the OCP right sleeve');
  assert.deepEqual(placed('abu', 'SER-TN-001'), [['unit_ser_tn_001', 'unit', 'L_SHOULDER', w, h]]);
  assert.deepEqual(placed('flight_suit', 'SER-TN-000'), [['unit_ser_tn_001', 'unit', 'R_SHOULDER', w, h]]);
  assert.deepEqual(placed('ocp', 'SER-TN-001', 'cadet'), placed('ocp', 'SER-TN-001'), 'cadets wear it as seniors do');
});

test('a squadron in Tennessee Wing has the wing\'s patch as its higher headquarters patch on the OCP left sleeve, and its own two squadron patches (TN-185, TN-330) keep working', () => {
  for(const code of ['SER-TN-185', 'SER-TN-330']) assert.equal(real(`getUnitHhqPatchId(${j(code)})`), 'unit_ser_tn_001', code);
  assert.equal(real(`getUnitPatchIdForCharter('SER-TN-185')`), 'tn185_ocp_patch');
  assert.equal(real(`getUnitPatchIdForCharter('SER-TN-330')`), 'tn330_ocp_patch');
  for(const [code, id] of [['SER-TN-185', 'tn185_ocp_patch'], ['SER-TN-330', 'tn330_ocp_patch']]){
    const ocp = placed('ocp', code);
    assert.deepEqual(ocp.map(p => p.slice(0, 3)), [[id, 'unit', 'R_SHOULDER'], ['unit_ser_tn_001', 'hhq', 'L_SHOULDER']], code);
    assert.deepEqual(placed('abu', code).map(p => p.slice(0, 3)), [[id, 'unit', 'CHEST_RIGHT']], `${code}: the squadron's patch is on the right pocket of the ABU`);
    assert.deepEqual(placed('flight_suit', code), [], `${code}: the flight suit takes no squadron patch`);
    assert.ok(real(`PATCH_META[${j(id)}].img`), `${id} has its picture`);
  }
});
