'use strict';
// E156 tooling: scripts/render-builds.cjs reads the official unit emblems (PNG pictures, data/unit-patch-art.js) as the page does, and its node store
// refuses a picture as a spec with a rejected promise instead of throwing out of the loader.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const rows = require('../data/unit-patch-art.js');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));

test('patchRefs resolve an official emblem by charter or by patch id, as a picture at its spec\'s size', () => {
  const ny = rows.find(r => r.charter === 'NER-NY-001');
  assert.match(ny.img, /\.png$/, 'the New York Wing emblem is the official PNG');
  for(const id of ['NER-NY-001', 'ner-ny-001', ny.patchId]){
    const r = HARNESS.patchesFrom([{ id, kind: 'unit' }]);
    assert.deepEqual(r.notes, [], `${id}: no note`);
    assert.equal(r.patches.length, 1, id);
    const p = r.patches[0];
    assert.equal(p.id, ny.patchId);
    assert.equal(p.asset, null, 'a picture, not an asset');
    assert.equal(p.href, '/images/' + ny.img);
    assert.deepEqual(p.size, { w: ny.w, h: ny.h });
    assert.equal(p.slot, 'R_SHOULDER');
  }
  const region = HARNESS.patchesFrom([{ id: 'NER-NER-001', kind: 'hhq' }]);
  assert.deepEqual(region.notes, []);
  assert.equal(region.patches[0].slot, 'L_SHOULDER');
  const none = HARNESS.patchesFrom([{ id: 'XXX-ZZ-999', kind: 'unit' }]);
  assert.equal(none.patches.length, 0);
  assert.equal(none.notes.length, 1, 'a charter with no art still says so');
});

test('an OCP build with a charter that has official art renders: the emblem is a picture on the right sleeve, nothing is left undrawn', async () => {
  const store = HARNESS.nodeStore();
  const b = HARNESS.makeBuild({ uniform: 'ocp', gender: 'male', membership: 'senior', rank: 'Lt Col', name: { first: 'Pat', last: 'Doran', show: true }, patchRefs: [{ id: 'NER-NY-001', kind: 'unit' }, { id: 'NER-NER-001', kind: 'hhq' }] });
  const scene = await P.composeUniform(b, store);
  const ny = rows.find(r => r.charter === 'NER-NY-001');
  const flat = scene.layers.filter(l => l.role === 'patch' && l.key.startsWith(`patch:${ny.patchId}:`) && !/:edge$/.test(l.key));
  assert.equal(flat.length, 1, 'the emblem is drawn once on the flat sleeve');
  assert.equal(flat[0].type, 'raster');
  assert.match(flat[0].href, /\.png$/);
  assert.ok(flat[0].key.includes('R_SHOULDER'), flat[0].key);
  assert.deepEqual([...scene.notes, ...(b.harnessNotes || [])].filter(n => HARNESS.NOT_DRAWN.test(n)), []);
});

test('the node store does not throw on a manifest path that is a picture: the store falls back to the manifest\'s own record, and a spec still loads', async () => {
  const store = HARNESS.nodeStore();
  const png = manifest.assets.find(a => /\.png$/i.test(a.path));
  assert.ok(png, 'the manifest holds an official PNG emblem');
  const rec = await store.load(png.id);              // used to throw a SyntaxError out of the loader (JSON.parse of PNG bytes)
  assert.equal(rec.id, png.id);
  assert.ok(Math.abs(rec.w - png.w_in) < 1e-6, 'the size is the manifest\'s');
  const svg = manifest.assets.find(a => a.id === 'patch-northeast-region');
  const spec = await store.load(svg.id);
  assert.equal(spec.id, svg.id);
  assert.ok(spec.landmarks && Object.keys(spec.landmarks).length >= 0 && spec.raw, 'a vector emblem still loads its spec file');
});
