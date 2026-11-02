'use strict';
// A U.S. military badge is drawn from its traced SVG (LIVE13 E104; E118, "nothing should be photos"): data/military-badge-sizes.js
// names, for each badge/variant, the asset the catalog record names (the manifest row under its art id), and js/engine/profiles-dress.js
// putBadge places it at the spec's inches, its centre on the centre of the box the anchor puts at the badge's place. The picker and the
// preview read the catalog record's asset, which is the SVG itself (scripts/sync-military-badges.cjs rewrites military/military-data.js);
// nothing swaps paths at load, and nothing falls back to a photo: a badge whose art is missing is a note in the scene.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const SIZES = require('../data/military-badge-sizes.js');
const MIL = require('../military/military-core.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const loader = p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8')));
const store = core.createSpecStore(manifest, loader);
// The same manifest without the military badges: a badge whose art has not arrived.
const noBadgeStore = core.createSpecStore({ assets: manifest.assets.filter(a => a.category !== 'military-badges') }, loader);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

function catalog(){
  const sandbox = { window: null };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'military', 'military-data.js'), 'utf8'), sandbox);
  return sandbox.CAPUBMilitaryData;
}
const BADGES = catalog().badges;
const record = (id, variant) => { const m = BADGES.find(x => x.id === id).representations.metal; return m.variants && m.variants[variant] ? m.variants[variant] : m; };
const mil = (id, variant, href) => {
  const b = BADGES.find(x => x.id === id);
  return { id, variant, href: href || `${record(id, variant).asset}?v=test`, title: b.officialName, family: String(b.family || '').toUpperCase() };
};
function build(uniform, gender, rank, military, badges){
  return {
    uniform, gender, grade: G.gradeInfo('senior', rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: (badges || []).map(id => ({ id })), command: null, militaryBadges: military, patches: [], cord: null
  };
}
const badge = (scene, id) => scene.layers.find(l => l.role === 'badge' && l.key === 'badge:' + id);
const centre = l => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });

const SVG_CASES = [['air_force_pilot_badge', 'pilot'], ['air_force_pilot_badge', 'command_pilot'], ['navy_surface_warfare_insignia', 'officer']];
for(const [id, variant] of SVG_CASES){
  const e = SIZES[`${id}/${variant}`];
  test(`${id}/${variant}: the asset ${e.artId}, at ${e.w} x ${e.h} in, on both Class A cuts, male and female, and nothing in the scene is a raster`, async () => {
    for(const gender of ['male', 'female']){
      for(const uniform of ['blues_a', 'blues_b']){
        const scene = await P.composeUniform(build(uniform, gender, 'Capt', [mil(id, variant)]), store);
        const l = badge(scene, id);
        const tag = `${uniform} ${gender}`;
        assert.ok(l, tag + ' drawn');
        assert.equal(l.type, 'asset', tag + ' an asset');
        assert.equal(l.id, e.artId, tag + ' the synced art');
        near(l.w, e.w, 0.001, tag + ' width'); near(l.h, e.h, 0.001, tag + ' height');
        assert.equal(l.sizeSource, e.source); assert.equal(l.artId, e.artId); assert.equal(l.military, true, tag + ' marked military');
        assert.ok(!scene.layers.some(x => x.type === 'raster'), tag + ' no raster layer');
        assert.ok(!scene.layers.some(x => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(x.href || ''))), tag + ' no picture file named');
      }
    }
  });
}

test('the badge is found by its SVG path too (the catalog record names the SVG), with or without a variant', async () => {
  const e = SIZES['air_force_pilot_badge/command_pilot'];
  const m = mil('air_force_pilot_badge', 'command_pilot', `${e.asset}?v=test`);
  let l = badge(await P.composeUniform(build('blues_a', 'male', 'Maj', [m]), store), 'air_force_pilot_badge');
  assert.equal(l.type, 'asset'); assert.equal(l.id, e.artId); near(l.w, 3, 0.001, 'width');
  delete m.variant;
  l = badge(await P.composeUniform(build('blues_a', 'male', 'Maj', [m]), store), 'air_force_pilot_badge');
  assert.equal(l.type, 'asset'); assert.equal(l.id, e.artId); near(l.w, 3, 0.001, 'width from the path alone');
});

test('a badge whose art is not in the manifest is not drawn: the scene says so, and no photo takes its place', async () => {
  const m = mil('air_force_pilot_badge', 'command_pilot');
  const scene = await P.composeUniform(build('blues_a', 'male', 'Maj', [m]), noBadgeStore);
  assert.equal(badge(scene, 'air_force_pilot_badge'), undefined, 'not drawn');
  assert.ok(!scene.layers.some(l => l.type === 'raster'), 'no raster layer');
  assert.ok(scene.notes.includes(`No artwork for ${m.title}`), scene.notes.join(' | '));
  // The badge below it still takes its place from the ribbons, as if the missing badge were not selected.
  const two = await P.composeUniform(build('blues_a', 'male', 'Maj', [m, mil('navy_surface_warfare_insignia', 'officer')]), noBadgeStore);
  assert.equal(two.layers.filter(l => l.role === 'badge').length, 0);
  assert.equal(two.notes.filter(n => /^No artwork for/.test(n)).length, 2);
});

test('stacking: the SVG badge sits 1/2 in above the badge below, measured from its own box, and over the EMT badge', async () => {
  const scene = await P.composeUniform(build('blues_a', 'male', 'Capt', [mil('navy_surface_warfare_insignia', 'officer')], ['emt_basic_badge']), store);
  const swo = badge(scene, 'navy_surface_warfare_insignia'), emt = badge(scene, 'emt_basic_badge');
  assert.equal(swo.type, 'asset');
  near(swo.y + swo.h, emt.y - 0.5, 0.002, 'SWO 1/2 in above the EMT badge');
  near(centre(swo).x, centre(emt).x, 0.002, 'centred over it');
  const two = await P.composeUniform(build('blues_a', 'male', 'Maj', [mil('navy_surface_warfare_insignia', 'officer'), mil('air_force_pilot_badge', 'command_pilot')]), store);
  const ls = two.layers.filter(l => l.role === 'badge').sort((a, b) => b.y - a.y);
  assert.equal(ls.length, 2);
  near(ls[1].y + ls[1].h, ls[0].y - 0.5, 0.002, 'the upper badge sits 1/2 in above the lower');
  near(centre(ls[0]).x, centre(ls[1]).x, 0.0005, 'one centre line');
});

test('the catalog names the traced SVG for every metal badge/variant, the preview resolves to it, and nothing rewrites records at load', () => {
  const data = catalog();
  for(const b of data.badges){
    const m = b.representations && b.representations.metal;
    if(!m) continue;
    const variants = m.variants && Object.keys(m.variants).length ? m.variants : null;
    for(const [variant, rec] of variants ? Object.entries(variants) : [[m.defaultVariant || 'default', m]]){
      if(!rec.asset) continue;
      assert.match(rec.asset, /^images\/military-badges\/[^/]+\/[^/]+\/[^/]+\.svg$/, `${b.id}/${variant} names an SVG`);
      assert.ok(fs.existsSync(path.join(root, rec.asset)), `${b.id}/${variant}: ${rec.asset} exists`);
      assert.equal(SIZES[`${b.id}/${variant}`] && SIZES[`${b.id}/${variant}`].asset, rec.asset, `${b.id}/${variant} in the size table`);
      assert.ok(!('rasterAsset' in rec), `${b.id}/${variant}: no raster kept beside it`);
    }
    if(variants && m.asset) assert.equal(m.asset, variants[m.defaultVariant || 'default'].asset, `${b.id}: the representation's asset is its default variant's`);
  }
  // The preview (js/uniform-view.js) resolves a badge through military-core.js and gets the SVG straight from the record.
  const pilot = data.badges.find(b => b.id === 'air_force_pilot_badge');
  const rep = MIL.resolveBadgeRepresentation(pilot, { service: 'AIR_FORCE', uniformFamily: 'SERVICE_DRESS', preferred: 'metal', variant: 'pilot' });
  assert.equal(rep.asset, SIZES['air_force_pilot_badge/pilot'].asset);
  // applyBadgeArt, which swapped PNG paths for SVGs at load, is gone with the PNGs.
  assert.equal(MIL.applyBadgeArt, undefined);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'military', 'military-core.js'), 'utf8'), /applyBadgeArt|rasterAsset/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'data', 'military-badge-sizes.js'), 'utf8'), /applyBadgeArt|rasterAsset|FALLBACK|\.png/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8'), /ctx\.raster|rasterAsset|\.png/);
});

test('index.html: the catalog and the table load before the picker (which reads the record\'s asset) and the dress engine', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const at = name => html.indexOf(`<script src="${name}`);
  assert.ok(at('military/military-data.js') > 0 && at('military/military-data.js') < at('js/wiring.js'), 'the catalog before the picker');
  assert.ok(at('data/military-badge-sizes.js') < at('js/wiring.js'), 'the table before the picker');
  assert.ok(at('data/military-badge-sizes.js') < at('js/engine/profiles-dress.js'), 'the table before the dress engine');
});
