'use strict';
// The engine places the unit emblems the page hands it (js/uniform-view.js buildPatches): a squadron's or group's patch on the right pocket of the ABU,
// a wing's, region's or national patch (it carries an echelon) on the left sleeve like any other such patch, and on the OCP the unit patch under the flag
// on the right sleeve with the higher headquarters patch under AUX on the left.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
require('../js/engine/awards.js');
const HARNESS = require('../scripts/render-builds.cjs');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));
const rows = require('../data/unit-patch-art.js');
const byCharter = c => rows.find(r => r.charter === c);
const patch = (charter, kind, slot) => { const r = byCharter(charter); return { id: r.patchId, title: r.label, asset: r.asset, href: null, aspect: 1, slot, kind, echelon: ['wing', 'region', 'national'].includes(r.echelon) ? r.echelon : null }; };
const build = (uniform, patches) => HARNESS.makeBuild({ uniform, gender: 'male', membership: 'senior', rank: 'Lt Col', name: { first: 'Pat', last: 'Doe', show: true }, patches });
const flat = (scene, id) => scene.layers.filter(l => l.role === 'patch' && l.key.startsWith(`patch:${id}:`) && !/:edge$/.test(l.key));

test('the OCP draws the unit patch on the right sleeve and the higher headquarters patch on the left, each its own vector', async () => {
  const s = await P.composeUniform(build('ocp', [patch('NER-NY-001', 'unit', 'R_SHOULDER'), patch('NER-NER-001', 'hhq', 'L_SHOULDER')]), store);
  const [wing] = flat(s, 'unit_ner_ny_001'), [region] = flat(s, 'unit_ner_ner_001');
  assert.equal(wing.type, 'asset');
  assert.equal(wing.id, 'patch-new-york-wing');
  assert.equal(region.id, 'patch-northeast-region');
  assert.ok(wing.x !== region.x, 'two sleeves');
  assert.ok(String(wing.key).includes('R_SHOULDER') && String(region.key).includes('L_SHOULDER'), `${wing.key} ${region.key}`);
  assert.ok(!(s.notes || []).some(n => /no place left/.test(n)));
});

test('the ABU hangs a wing\'s unit patch from the left sleeve, not the pocket; a squadron\'s stays on the right pocket', async () => {
  const wing = await P.composeUniform(build('abu', [patch('NER-NY-001', 'unit', 'L_SHOULDER')]), store);
  assert.equal(flat(wing, 'unit_ner_ny_001').length, 1);
  assert.ok(flat(wing, 'unit_ner_ny_001')[0].key.includes('L_SHOULDER'), flat(wing, 'unit_ner_ny_001')[0].key);
  assert.ok(!(wing.notes || []).some(n => /no place left|not worn on the ABU sleeve/.test(n)));
  const squadron = { id: 'tn185_ocp_patch', title: 'Music City', asset: 'patch-music-city-composite-squadron', href: null, aspect: 1, slot: 'CHEST_RIGHT', kind: 'unit', echelon: null };
  const s = await P.composeUniform(build('abu', [squadron]), store);
  const layers = flat(s, 'tn185_ocp_patch');
  assert.equal(layers.length, 1);
  assert.ok(/CHEST_RIGHT/.test(layers[0].key), layers[0].key);
});

test('the Corporate Field Uniform takes a region\'s unit patch on the left sleeve, and the flight suit a wing\'s on the right', async () => {
  const cfu = await P.composeUniform(build('corporate_field', [patch('NER-NER-001', 'unit', 'L_SHOULDER')]), store);
  assert.ok(flat(cfu, 'unit_ner_ner_001')[0].key.includes('L_SHOULDER'));
  const fs_ = await P.composeUniform(build('flight_suit', [patch('NER-NY-001', 'unit', 'R_SHOULDER')]), store);
  assert.equal(flat(fs_, 'unit_ner_ny_001').length, 1);
});
