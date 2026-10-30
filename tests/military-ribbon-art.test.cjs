'use strict';
// The U.S. military ribbons are the measured SVGs of assets/ribbons/military (LIVE13 E118), and the miniature medals their ribbon SVG plus a body SVG.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const awards = require('../js/engine/awards.js');
const C = require('../js/engine/compose.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const layout = require('../military/military-device-layout.js');
const MIL = require('../military/military-core.js');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));
const rows = new Map(manifest.assets.map(a => [a.id, a]));

function catalog(){
  const sandbox = {}; sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'military', 'military-data.js'), 'utf8'), sandbox);
  return JSON.parse(JSON.stringify(sandbox.CAPUBMilitaryData));
}
const DATA = catalog();
const offered = MIL.canonicalizeAwards(DATA.awards.filter(a => a.type === 'RIBBON' && !MIL.isCapAward(a))).filter(a => a?.images?.ribbon);
const dressBuild = (uniform, extra) => Object.assign({ uniform, gender: 'male', membership: 'senior', grade: G.gradeInfo('senior', 'Capt', { track: 'officer' }),
  opt: { sleeve: 'short', femaleTop: 'shirt', underlayer: 'shirt', skirt: 'a-line', headgear: 'auto', rackColumns: 3, rackArrangement: 'standard', noGradeTrack: 'officer', plateGrade: true, miniStyle: 'mounting' },
  name: { first: 'Pat', last: 'Doe', show: true }, ribbons: [], medals: [], badges: [], badgeChoices: {}, command: null, militaryBadges: [], patches: [], cord: null }, extra);

test('every offered award draws an SVG of the manifest, 1 3/8 x 3/8 in', () => {
  assert.equal(offered.length, 175);
  for(const a of offered){
    assert.match(a.images.ribbon, /^images\/ribbons\/.+\.svg$/, a.id);
    const row = rows.get(a.images.ribbonAsset);
    assert.ok(row, `${a.id}: ${a.images.ribbonAsset} in the manifest`);
    assert.equal(`images/${row.path}`, a.images.ribbon, a.id);
    assert.ok(fs.existsSync(path.join(ROOT, 'images', row.path)), row.path);
    assert.deepEqual([row.w_in, row.h_in], [1.375, 0.375], a.id);
  }
});

test('a saved setup keeps loading: an old id finds the same award, and only the Coast Guard Cross has no art', () => {
  const byId = new Map();
  for(const a of offered) for(const id of [a.id, ...(a.sourceIds || [])]) byId.set(id, a);
  for(const [old, now] of [['air_force_good_condcut', 'air_force_good_conduct'], ['air_force_distinguishd_service', 'air_force_distinguished_service'], ['bronze_star_miltiary', 'bronze_star_medal']]) assert.equal(byId.get(old).id, now);
  assert.deepEqual(DATA.awards.filter(a => a.type === 'RIBBON' && !a.images?.ribbon).map(a => a.id), ['coast_guard_cross']);
});

test('a rack of 12 military ribbons with devices is drawn as a CAP rack: the same places, all assets, no picture', async () => {
  const ids = offered.slice(0, 12).map(a => a.images.ribbonAsset);
  const devs = [[], ['mil-device-olc-bronze'], ['mil-device-olc-bronze', 'mil-device-olc-bronze'], ['device-star-bronze'], ['mil-device-olc-silver', 'mil-device-olc-bronze'], [], ['mil-device-letter-n'], [], ['mil-device-olc-bronze', 'mil-device-olc-bronze', 'mil-device-olc-bronze'], [], ['device-star-bronze', 'device-star-bronze'], []];
  const military = ids.map((asset, i) => ({ key: `ribbon:military:r${i}#${i}`, title: `r${i}`, asset, devices: devs[i], centered: false, military: true }));
  const cap = ids.map((_, i) => ({ key: `ribbon:r${i}`, title: `r${i}`, asset: 'ribbon-red-service-ribbon', devices: devs[i], centered: false }));
  const a = await P.composeUniform(dressBuild('blues_a', { ribbons: military }), store), b = await P.composeUniform(dressBuild('blues_a', { ribbons: cap }), store);
  const of = (s, role) => s.layers.filter(l => l.role === role);
  assert.equal(of(a, 'ribbon').length, 12);
  assert.equal(of(a, 'device').length, devs.flat().length);
  assert.ok(of(a, 'ribbon').every(l => l.type === 'asset'), 'every ribbon an asset');
  assert.deepEqual(of(a, 'ribbon').map(l => [l.x, l.y, l.w, l.h]), of(b, 'ribbon').map(l => [l.x, l.y, l.w, l.h]));
  assert.deepEqual(of(a, 'device').map(l => [l.id, l.x, l.y, l.w, l.h]), of(b, 'device').map(l => [l.id, l.x, l.y, l.w, l.h]));
});

test('a ribbon with no art says so instead of drawing a picture', async () => {
  const s = await P.composeUniform(dressBuild('blues_a', { ribbons: [{ key: 'ribbon:military:none#0', title: 'None', asset: null, devices: [], centered: false, military: true }] }), store);
  assert.ok(s.notes.includes('No ribbon artwork for None'));
  assert.ok(!s.layers.some(l => l.type === 'raster'));
});

test('the device plan is the recipes of assets/ribbons/military-variants.json: every one of the 344, base asset and device for device', { skip: !fs.existsSync(path.join(ROOT, '..', 'UniformBuilder', 'artwork-samples', 'assets', 'ribbons', 'military-variants.json')) }, () => {
  const recipes = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'UniformBuilder', 'artwork-samples', 'assets', 'ribbons', 'military-variants.json'), 'utf8'));
  assert.equal(recipes.variants.length, 344);
  for(const v of recipes.variants){
    const plan = layout.ribbonDevicePlan(v.devices.map(d => d.catalog_id));
    assert.equal(plan.length, v.devices.length, v.key);
    v.devices.forEach((d, i) => {
      assert.equal(plan[i].id, d.asset_id, v.key);
      assert.ok(Math.abs(plan[i].x - d.center_in[0]) < 0.0015 && Math.abs(plan[i].y - d.center_in[1]) < 0.0015, `${v.key} device ${i}`);
      assert.equal(plan[i].scale, d.scale_to_match_raster, v.key);
    });
  }
});

test('the engine draws a device plan where it says, at its scale', async () => {
  const ctx = C.createContext({}, store);
  await C.drawRack(ctx, [{ key: 'ribbon:x#0', title: 'x', asset: offered[0].images.ribbonAsset, devicePlan: layout.ribbonDevicePlan(['BRONZE_OLC', 'BRONZE_OLC']) }], { centerX: 0, bottomY: 0 }, { perRow: 1 });
  const [ribbon, ...devices] = ctx.layers;
  assert.equal(devices.length, 2);
  const spec = await store.load('mil-device-olc-bronze');
  devices.forEach((d, i) => {
    assert.ok(Math.abs(d.x + d.w / 2 - (ribbon.x + 1.375 * [0.36, 0.64][i])) < 1e-6);
    assert.ok(Math.abs(d.w - spec.w * 0.924) < 1e-6);
  });
});

test('a military miniature is its ribbon SVG; with no body art the drape hangs alone in its place and a note says the medal is pending', async () => {
  const medals = [
    { key: 'mini:military:a#0', title: 'Air Medal', ribbonAsset: 'ribbon-air-medal', medal: null, pendingMedal: true, devices: ['mil-device-olc-bronze'], centered: false },
    { key: 'mini:cap', title: 'CAP', ribbonAsset: 'ribbon-cap-achievment-award', medal: 'medal-cap-achievment-award-miniature', devices: [], centered: false }
  ];
  const s = await P.composeUniform(dressBuild('mess_dress', { medals }), store);
  assert.ok(!s.layers.some(l => l.type === 'raster'), 'no picture');
  const a = s.layers.filter(l => /^mini:military:a#0/.test(l.key || ''));
  assert.deepEqual(a.map(l => l.role).sort(), ['device', 'mini-drape']);
  assert.ok(s.notes.includes('Medal art pending for Air Medal: only the ribbon is shown'), s.notes.join(' | '));
  const drape = a.find(l => l.role === 'mini-drape'), cap = s.layers.find(l => l.key === 'mini:cap');
  assert.equal(drape.y, cap.y, 'the row keeps its line');
});

test('a ribbon-only military award has no miniature: no drape and the note the CAP ones get', async () => {
  const s = await P.composeUniform(dressBuild('mess_dress', { medals: [{ key: 'mini:military:b#0', title: 'Recognition', ribbonAsset: 'ribbon-air-medal', medal: null, pendingMedal: false, devices: [], centered: false }] }), store);
  assert.ok(!s.layers.some(l => /^mini:military/.test(l.key || '')));
  assert.ok(s.notes.some(n => /Recognition: ribbon-only award, not worn as a miniature medal/.test(n)));
});

test('the catalog names no ribbon, medal or embroidered picture, and keeps what the medals are', () => {
  const text = JSON.stringify({ awards: DATA.awards, variants: DATA.deviceVariants });
  assert.doesNotMatch(text, /images\/military-(ribbons|ribbon-variants|mini-medals|full-size-medals)\/[^"]*\.[a-z]+/);
  assert.ok(DATA.badges.every(b => !b.representations?.embroidered), 'no embroidered record');
  const reps = offered.map(a => MIL.getAwardRepresentation(a, 'MINIATURE_MEDAL').status);
  assert.equal(reps.filter(s => s === 'NOT_APPLICABLE').length, 74, 'the ribbon-only awards');
  assert.equal(reps.filter(s => s === 'MISSING_ASSET').length, 101, 'the medals, all waiting on body art');
  assert.ok(DATA.awards.some(a => /^images\/military-mini-medals\/air-force\/air_medal$/.test(a.representations?.miniatureMedal?.artReference || '')), 'the name the medal sync matches on');
});

test('a military badge has one form: metal, and nothing draws one on a utility uniform', async () => {
  const pilot = DATA.badges.find(b => b.id === 'air_force_pilot_badge');
  assert.equal(MIL.resolveBadgeRepresentation(pilot, { service: 'AIR_FORCE' }).representation, 'metal');
  assert.equal(MIL.resolveBadgeRepresentation(pilot, { service: 'AIR_FORCE', preferred: 'AUTO' }).representation, 'metal');
  const militaryBadges = [{ id: 'air_force_pilot_badge', variant: 'pilot', title: 'Pilot', href: 'images/military-badges/x.png', family: 'AVIATION' }];
  for(const uniform of ['ocp', 'abu', 'corporate_field', 'cfdu', 'flight_suit']){
    const s = await P.composeUniform(dressBuild(uniform, { militaryBadges }), store).catch(() => null);
    if(s) assert.ok(!s.layers.some(l => l.key === 'badge:air_force_pilot_badge' || String(l.href || '').includes('military-badges')), uniform);
  }
});

test('the full-size medals are drawn on no uniform: the engine and the page read only the miniature', () => {
  for(const file of ['js/uniform-view.js', 'js/catalog.js', 'js/engine/compose.js', 'js/engine/profiles-dress.js']) assert.doesNotMatch(fs.readFileSync(path.join(ROOT, file), 'utf8'), /FULL_SIZE_MEDAL|fullSizeMedal/, file);
});
