'use strict';
// A U.S. military badge whose traced SVG has been synced (LIVE13 E104; data/military-badge-sizes.js `svg`, the asset in
// images/MANIFEST.json under its art id) is drawn as that asset at the spec's inches, its centre on the centre the PNG's ink box
// had, so nothing on the uniform moves when a badge's SVG arrives; a badge without one is still the PNG, cropped to its ink box.
// The picker and the preview reach the SVG through the catalog record (military/military-core.js applyBadgeArt).

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
// The same manifest without the synced badges: how the uniform drew before the SVGs (the PNG path).
const pngStore = core.createSpecStore({ assets: manifest.assets.filter(a => a.category !== 'military-badges') }, loader);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

function catalog(){
  const sandbox = { window: null };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'military', 'military-data.js'), 'utf8'), sandbox);
  return sandbox.CAPUBMilitaryData;
}
const BADGES = catalog().badges;
const mil = (id, variant, href) => {
  const b = BADGES.find(x => x.id === id);
  return { id, variant, href: href || `${b.representations.metal.variants[variant].asset}?v=test`, title: b.officialName, family: String(b.family || '').toUpperCase() };
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
  test(`${id}/${variant}: the SVG asset ${e.artId}, at ${e.w} x ${e.h} in, centred where the PNG was, on both Class A cuts`, { skip: !e.svg && 'not synced' }, async () => {
    for(const gender of ['male', 'female']){
      for(const uniform of ['blues_a', 'blues_b']){
        const b = build(uniform, gender, 'Capt', [mil(id, variant)]);
        const svg = badge(await P.composeUniform(b, store), id);
        const png = badge(await P.composeUniform(b, pngStore), id);
        const tag = `${uniform} ${gender}`;
        assert.ok(svg && png, tag + ' drawn both ways');
        assert.equal(svg.type, 'asset', tag + ' an asset');
        assert.equal(svg.id, e.artId, tag + ' the synced art');
        near(svg.w, e.w, 0.001, tag + ' width'); near(svg.h, e.h, 0.001, tag + ' height');
        assert.equal(png.type, 'raster', tag + ' the PNG without the asset');
        assert.ok(Array.isArray(png.crop), tag + ' the PNG cropped to its ink box');
        near(centre(svg).x, centre(png).x, 0.0005, tag + ' same centre x');
        near(centre(svg).y, centre(png).y, 0.0005, tag + ' same centre y');
        assert.equal(svg.sizeSource, e.source); assert.equal(svg.artId, e.artId);
        assert.equal(svg.z, png.z, tag + ' same layer order');
      }
    }
  });
}

test('the badge is found by its SVG path too (the catalog record points at the SVG once synced), with or without a variant', async () => {
  const e = SIZES['air_force_pilot_badge/command_pilot'];
  if(!e.svg) return;
  const m = mil('air_force_pilot_badge', 'command_pilot', `${e.svg}?v=test`);
  let l = badge(await P.composeUniform(build('blues_a', 'male', 'Maj', [m]), store), 'air_force_pilot_badge');
  assert.equal(l.type, 'asset'); assert.equal(l.id, e.artId); near(l.w, 3, 0.001, 'width');
  delete m.variant;
  l = badge(await P.composeUniform(build('blues_a', 'male', 'Maj', [m]), store), 'air_force_pilot_badge');
  assert.equal(l.type, 'asset'); assert.equal(l.id, e.artId);
  // Without the asset in the manifest the PNG beside it is drawn, never the SVG as a raster.
  l = badge(await P.composeUniform(build('blues_a', 'male', 'Maj', [m]), pngStore), 'air_force_pilot_badge');
  assert.equal(l.type, 'raster'); assert.match(l.href, /command_pilot\.png\?v=test$/); assert.ok(Array.isArray(l.crop));
});

test('stacking: the SVG badge sits 1/2 in above the badge below, measured from its own box, and over the EMT badge', async () => {
  const e = SIZES['navy_surface_warfare_insignia/officer'];
  if(!e.svg) return;
  const scene = await P.composeUniform(build('blues_a', 'male', 'Capt', [mil('navy_surface_warfare_insignia', 'officer')], ['emt_basic_badge']), store);
  const swo = badge(scene, 'navy_surface_warfare_insignia'), emt = badge(scene, 'emt_basic_badge');
  assert.equal(swo.type, 'asset');
  near(swo.y + swo.h, emt.y - 0.5, 0.002, 'SWO 1/2 in above the EMT badge');
  near(centre(swo).x, centre(emt).x, 0.002, 'centred over it');
  const two = await P.composeUniform(build('blues_a', 'male', 'Maj', [mil('navy_surface_warfare_insignia', 'officer'), mil('air_force_pilot_badge', 'command_pilot')]), store);
  const ls = two.layers.filter(l => l.role === 'badge').sort((a, b) => b.y - a.y);
  assert.equal(ls.length, 2);
  near(ls[1].y + ls[1].h, ls[0].y - 0.5, 0.002, 'the upper badge sits 1/2 in above the lower');
});

test('a badge without a synced SVG is still the PNG, cropped to its ink box at its real size', async () => {
  const key = Object.keys(SIZES).find(k => !SIZES[k].svg);
  if(!key) return; // every badge has its SVG
  const [id, variant] = key.split('/');
  const l = badge(await P.composeUniform(build('blues_a', 'male', 'Capt', [mil(id, variant)]), store), id);
  assert.equal(l.type, 'raster');
  assert.ok(Array.isArray(l.crop));
  near(l.w / l.h, SIZES[key].w / SIZES[key].h, 0.02, 'proportions');
});

test('applyBadgeArt points the catalog records at the SVG (the picker reads record.asset), keeps the PNG as rasterAsset, and is idempotent', () => {
  const data = catalog();
  const pilot = data.badges.find(b => b.id === 'air_force_pilot_badge').representations.metal;
  const before = pilot.variants.pilot.asset;
  const n = MIL.applyBadgeArt(data, SIZES);
  const expected = Object.values(SIZES).filter(e => e.svg).length;
  assert.equal(n, expected, 'one record per synced badge/variant');
  if(SIZES['air_force_pilot_badge/pilot'].svg){
    assert.equal(pilot.variants.pilot.asset, SIZES['air_force_pilot_badge/pilot'].svg);
    assert.equal(pilot.variants.pilot.rasterAsset, before);
    assert.equal(pilot.asset, SIZES['air_force_pilot_badge/pilot'].svg, 'the representation follows its default variant');
    assert.equal(pilot.rasterAsset, before);
    // resolveBadgeRepresentation, which the preview uses, hands out the SVG for that variant.
    const rep = MIL.resolveBadgeRepresentation(data.badges.find(b => b.id === 'air_force_pilot_badge'), { service: 'AIR_FORCE', uniformFamily: 'SERVICE_DRESS', preferred: 'metal', variant: 'pilot' });
    assert.equal(rep.asset, SIZES['air_force_pilot_badge/pilot'].svg);
  }
  assert.equal(MIL.applyBadgeArt(data, SIZES), 0, 'nothing to change the second time');
  for(const b of data.badges){
    const m = b.representations && b.representations.metal;
    if(!m) continue;
    for(const [variant, rec] of Object.entries(m.variants || {})){
      const e = SIZES[`${b.id}/${variant}`];
      if(e && e.svg) assert.equal(rec.asset, e.svg, `${b.id}/${variant} on its SVG`);
      else if(rec.asset) assert.match(rec.asset, /\.png$/, `${b.id}/${variant} still on its PNG`);
    }
  }
});

test('the size table calls applyBadgeArt when it loads after military-core.js, and military-core.js when it loads after the table', () => {
  const src = fs.readFileSync(path.join(root, 'data', 'military-badge-sizes.js'), 'utf8');
  assert.match(src, /root\.CAPUBMilitary\.applyBadgeArt\(root\.CAPUBMilitaryData, sizes\)/);
  const coreSrc = fs.readFileSync(path.join(root, 'military', 'military-core.js'), 'utf8');
  assert.match(coreSrc, /api\.applyBadgeArt\(root\.CAPUBMilitaryData, root\.CAPUBMilitaryBadgeSizes\)/);
  // In the page the catalog, then the table, load before the picker builds (index.html script order).
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const at = name => html.indexOf(`<script src="${name}`);
  assert.ok(at('military/military-core.js') < at('data/military-badge-sizes.js'), 'military-core.js before the table');
  assert.ok(at('military/military-data.js') < at('data/military-badge-sizes.js'), 'the catalog before the table');
  assert.ok(at('data/military-badge-sizes.js') < at('js/wiring.js'), 'the table before the picker');
});
