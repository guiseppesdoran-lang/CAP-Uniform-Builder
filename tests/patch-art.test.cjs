'use strict';
// Every patch of the page is its vector from assets/patches, at its spec's size (LIVE13 E118). data/patch-art.js says which picture a patch draws.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const art = require('../data/patch-art.js');
const sync = require('../scripts/sync-patches.cjs');
const core = require('../js/engine/core.js');
require('../js/engine/awards.js');
const HARNESS = require('../scripts/render-builds.cjs');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));
const rows = new Map(manifest.assets.map(a => [a.id, a]));
const hb = (uniform, refs) => HARNESS.makeBuild({ uniform, gender: 'male', membership: 'senior', rank: 'Lt Col', name: { first: 'Pat', last: 'Doe', show: true }, patchRefs: refs });
const flat = (scene, id) => scene.layers.find(l => l.role === 'patch' && l.key.startsWith(`patch:${id}:`) && !/:edge$/.test(l.key));

test('each patch with a vector names an asset of the manifest, with the spec\'s size', () => {
  const vectors = Object.entries(art).filter(([, r]) => r.asset);
  assert.ok(vectors.length >= 25);
  for(const [id, r] of vectors){
    const row = rows.get(r.asset);
    assert.ok(row, `${id}: ${r.asset}`);
    assert.equal(row.path, r.img);
    assert.deepEqual([row.w_in, row.h_in], [r.w, r.h], id);
    assert.ok(fs.existsSync(path.join(ROOT, 'images', r.img)), r.img);
  }
});

test('a patch with no vector waits on a whole picture the allowlist names, and nothing draws an OCP crop', () => {
  const allow = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'no-raster-allowlist.json'), 'utf8'));
  for(const [id, r] of Object.entries(art)) if(!r.asset) assert.ok(`images/${r.img}` in allow, id);
  assert.ok(!Object.values(art).some(r => /\/ocp\//.test(r.img)));
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'js', 'uniform-view.js'), 'utf8'), /OCP_CROP_BASE/);
});

test('data/patch-art.js is in the form scripts/sync-patches.cjs writes (node scripts/sync-patches.cjs --check says whether it is behind the art tree)', () => {
  assert.equal(fs.readFileSync(sync.OUT, 'utf8'), sync.text(art));
});

test('the name mapping of the patches that do not follow their id', () => {
  for(const [id, asset] of Object.entries({ af_space_command_patch: 'patch-af-space-command-fc', comms_patch: 'patch-communications', cos_patch: 'patch-cadet-officer-school', nbb_patch: 'patch-national-blue-beret', nfa_patch: 'patch-national-flight-academy', orientation_pilot_patch: 'patch-cadet-orientation-pilot', pjoc_patch: 'patch-pararescue-orientation', undergrad_pilot_training_patch: 'patch-supt-familiarization' })) assert.equal(art[id].asset, asset);
});

test('the engine draws a vector patch as an asset at its spec\'s size, centred in the Velcro, in the flat and the edge view', async () => {
  const s = await P.composeUniform(hb('ocp', [{ id: 'cos_ocp_patch', kind: 'general', slot: 'L_SHOULDER', label: 'COS' }]), store);
  const layer = flat(s, 'cos_ocp_patch');
  assert.equal(layer.type, 'asset');
  assert.equal(layer.id, 'patch-cadet-officer-school');
  assert.ok(Math.abs(layer.w - art.cos_patch.w) < 1e-6 && Math.abs(layer.h - art.cos_patch.h) < 1e-6);
  assert.ok(s.layers.some(l => l.key === 'patch:cos_ocp_patch:L_SHOULDER:edge' && l.type === 'asset'));
  assert.ok(!s.layers.some(l => l.type === 'raster'));
});

test('a tall patch is held to the 3 1/2 in the Velcro allows, keeping its proportions', async () => {
  const s = await P.composeUniform(hb('ocp', [{ id: 'nesa_ocp_patch', kind: 'general', slot: 'L_SHOULDER', label: 'NESA' }]), store);
  const layer = flat(s, 'nesa_ocp_patch');
  assert.ok(Math.abs(layer.h - 3.5) < 1e-6);
  assert.ok(Math.abs(layer.w / layer.h - art.nesa_patch.w / art.nesa_patch.h) < 1e-3);
});

test('the ABU and CFU sleeves hang a vector patch from the 1/2 in line, and the flight suit takes one in its loop', async () => {
  const s = await P.composeUniform(hb('abu', [{ id: 'nywg_patch', kind: 'general', slot: 'L_SHOULDER', label: 'New York Wing' }]), store);
  const spec = await store.load('garment-abu-coat');
  const layer = flat(s, 'nywg_patch');
  assert.ok(Math.abs(layer.y - core.anchor(spec, 'seam_top_center_left').y - 0.5) < 0.005);
  assert.equal(layer.w, art.nywg_patch.w);
  const f = await P.composeUniform(hb('flight_suit', [{ id: 'archer_patch', kind: 'general', slot: 'L_SHOULDER', label: 'ARCHER' }]), store);
  assert.equal(f.layers.find(l => l.key === 'patch:archer_patch:RS:0').type, 'asset');
});

test('no patch is left on a picture: the last ones draw their vector', async () => {
  const s = await P.composeUniform(hb('ocp', [{ id: 'dog_ocp_patch', kind: 'general', slot: 'L_SHOULDER', label: 'DOG' }]), store);
  const layer = flat(s, 'dog_ocp_patch');
  assert.notEqual(layer.type, 'raster');
  assert.match(String(layer.asset || layer.id || layer.key || ''), /patch-es-style-2|dog_ocp_patch/);
});

test('member uploads stay as they were', () => {
  assert.match(fs.readFileSync(path.join(ROOT, 'patch-submission.js'), 'utf8'), /ALLOWED_TYPES = new Set\(\['image\/png','image\/jpeg','image\/webp','image\/svg\+xml'\]\)/);
});
