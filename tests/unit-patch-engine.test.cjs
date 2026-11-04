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
const patch = (charter, kind, slot) => {
  const r = byCharter(charter), raster = /\.png$/.test(r.img);
  // As js/uniform-view.js buildPatches hands it over: an SVG as an asset, official artwork as a picture with its spec's size.
  return { id: r.patchId, title: r.label, asset: raster ? null : r.asset, href: raster ? '/images/' + r.img : null, aspect: r.w / r.h, size: raster ? { w: r.w, h: r.h } : null, slot, kind, echelon: ['wing', 'region', 'national'].includes(r.echelon) ? r.echelon : null };
};
const build = (uniform, patches) => HARNESS.makeBuild({ uniform, gender: 'male', membership: 'senior', rank: 'Lt Col', name: { first: 'Pat', last: 'Doe', show: true }, patches });
const flat = (scene, id) => scene.layers.filter(l => l.role === 'patch' && l.key.startsWith(`patch:${id}:`) && !/:edge$/.test(l.key));

test('the OCP draws the unit patch on the right sleeve and the higher headquarters patch on the left, each its own vector', async () => {
  const s = await P.composeUniform(build('ocp', [patch('NER-NY-001', 'unit', 'R_SHOULDER'), patch('NER-NER-001', 'hhq', 'L_SHOULDER')]), store);
  const [wing] = flat(s, 'unit_ner_ny_001'), [region] = flat(s, 'unit_ner_ner_001');
  assert.equal(wing.type, 'raster', 'the official New York Wing artwork is a picture');
  assert.match(wing.href, /patch-new-york-wing-brand-tools\.png$/);
  assert.equal(region.type, 'asset');
  assert.equal(region.id, 'patch-northeast-region');
  const ny = byCharter('NER-NY-001');
  assert.ok(Math.abs(wing.w - ny.w) < 1e-6 && Math.abs(wing.h - ny.h) < 1e-6, `drawn at the spec's ${ny.w} x ${ny.h} in, not stretched to the Velcro: ${wing.w} x ${wing.h}`);
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

test('a picture patch is drawn at its spec\'s size on every uniform, shrunk only to 3 1/2 in; the edge view on the OCP and the hung sleeve keep it', async () => {
  const ncw = rows.find(r => r.charter === 'MAR-DC-001');
  assert.ok(/\.png$/.test(ncw.img) && ncw.h > 3.5, 'the National Capital Wing artwork is taller than the Velcro');
  const p = patch('MAR-DC-001', 'unit', 'L_SHOULDER');
  const abu = await P.composeUniform(build('abu', [p]), store);
  const l = flat(abu, p.id)[0];
  assert.equal(l.type, 'raster');
  assert.ok(Math.abs(l.h - 3.5) < 1e-6 && Math.abs(l.w / l.h - ncw.w / ncw.h) < 1e-3, `${l.w} x ${l.h}`);
  const squadron = patch('MAR-DC-026', 'unit', 'R_SHOULDER');
  const sq = byCharter('MAR-DC-026');
  const ocp = await P.composeUniform(build('ocp', [squadron]), store);
  const flatLayer = flat(ocp, squadron.id)[0];
  assert.ok(Math.abs(flatLayer.w - sq.w) < 1e-6 && Math.abs(flatLayer.h - sq.h) < 1e-6);
  assert.ok(ocp.layers.some(x => x.key === `patch:${squadron.id}:R_SHOULDER:edge` && x.type === 'raster'), 'edge view');
  const flight = await P.composeUniform(build('flight_suit', [patch('NER-NY-001', 'unit', 'R_SHOULDER')]), store);
  const f = flight.layers.find(x => x.role === 'patch');
  assert.equal(f.type, 'raster');
  assert.ok(f.w <= 3.5 + 1e-9 && f.h <= 3.5 + 1e-9);
});
