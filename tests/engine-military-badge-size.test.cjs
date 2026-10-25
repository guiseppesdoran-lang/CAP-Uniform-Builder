'use strict';
// U.S. military badges on the dress uniforms are drawn at their real size (CAPR 39-1 4.1.5.2.2 places the badge; no regulation
// prints its size). data/military-badge-sizes.js (scripts/build-military-badge-sizes.cjs) carries each badge/variant's size from
// its in-house SVG badge: Vanguard's regulation-size listing where there is one (size_source measured), the badge's aspect
// otherwise (estimated; art commit afe8b075), and the badge's box in the page's PNG. Doran, on the Navy Surface Warfare
// Officer badge above the EMT badge: "That badge is too small" (it was drawn about 1.1 in wide, in a fixed 2.75 x 0.75 in box).

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
const sizesBuilder = require('../scripts/build-military-badge-sizes.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

const sandbox = { window: null };
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root, 'military', 'military-data.js'), 'utf8'), sandbox);
const BADGES = sandbox.CAPUBMilitaryData.badges;

const mil = (id, variant) => {
  const b = BADGES.find(x => x.id === id);
  const asset = b.representations.metal.variants[variant].asset;
  return { id, variant, href: `${asset}?v=test`, title: b.officialName, family: 'QUALIFICATION' };
};
function build(uniform, gender, rank, badges, military){
  return {
    uniform, gender, grade: G.gradeInfo('senior', rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: badges.map(id => ({ id })), command: null, militaryBadges: military, patches: [], cord: null
  };
}
const badgeLayers = scene => scene.layers.filter(l => l.role === 'badge');

test('the table has an entry for every military badge/variant with a metal asset (nothing falls back to the old box)', () => {
  const missing = [];
  let n = 0;
  for(const b of BADGES){
    const m = b.representations && b.representations.metal;
    if(!m) continue;
    for(const [variant, rec] of Object.entries(m.variants || {})){
      if(!rec.asset) continue;
      n++;
      const e = SIZES[`${b.id}/${variant}`];
      if(!e) missing.push(`${b.id}/${variant}`);
      else{
        assert.ok(e.w > 0 && e.h > 0, `${b.id}/${variant} has a size`);
        assert.ok(['measured', 'estimated'].includes(e.source), `${b.id}/${variant} says where its size comes from`);
        assert.equal(e.asset, rec.asset, `${b.id}/${variant} names the page's PNG`);
      }
    }
  }
  assert.ok(n >= 280, `${n} badge/variants`);
  // The fallback is the old 2.75 x 0.75 in box; a badge that needs it is listed here so the gap is on record.
  assert.deepEqual(missing, [], 'badge/variants drawn in the fallback box: ' + missing.join(', '));
  assert.deepEqual({ w: SIZES.FALLBACK.w, h: SIZES.FALLBACK.h }, { w: 2.75, h: 0.75 });
});

test('every entry is a box inside its PNG, the PNG is the size the table says, and the box has the badge\'s proportions', () => {
  for(const [key, e] of Object.entries(SIZES)){
    const png = fs.readFileSync(path.join(root, e.asset));
    assert.equal(png.readUInt32BE(16), e.img[0], `${key} width`);
    assert.equal(png.readUInt32BE(20), e.img[1], `${key} height`);
    const [x0, y0, x1, y1] = e.ink;
    assert.ok(x0 >= 0 && y0 >= 0 && x1 <= e.img[0] + 1 && y1 <= e.img[1] + 1 && x1 > x0 && y1 > y0, `${key} box inside the image`);
    near((x1 - x0) / (y1 - y0), e.w / e.h, 0.03 * e.w / e.h, `${key} box aspect vs size aspect`);
  }
});

test('data/military-badge-sizes.js is what scripts/build-military-badge-sizes.cjs writes from the art tree', { skip: !fs.existsSync(path.join(sizesBuilder.ART, 'military')) && 'artwork tree not present' }, () => {
  assert.equal(fs.readFileSync(sizesBuilder.OUT, 'utf8'), sizesBuilder.build().text, 'run node scripts/build-military-badge-sizes.cjs');
});

test('Class A: the Navy Surface Warfare Officer badge is 2.75 in wide (Vanguard regulation size), 0.5 in above the EMT badge', async () => {
  for(const gender of ['male', 'female']){
    const scene = await P.composeUniform(build('blues_a', gender, 'Capt', ['emt_basic_badge'], [mil('navy_surface_warfare_insignia', 'officer')]), store);
    const swo = badgeLayers(scene).find(l => l.key === 'badge:navy_surface_warfare_insignia');
    const emt = badgeLayers(scene).find(l => l.key === 'badge:emt_basic_badge');
    assert.ok(swo && emt, gender + ' both badges drawn');
    assert.equal(swo.type, 'raster');
    near(swo.w, 2.75, 0.001, gender + ' SWO width');
    near(swo.h, 0.9675, 0.002, gender + ' SWO height (2.75 x 0.9675 in)');
    assert.equal(swo.sizeSource, 'measured');
    assert.equal(swo.artId, 'navy-surface-warfare-officer');
    assert.ok(Array.isArray(swo.crop) && swo.crop.every(v => v >= 0 && v <= 1), 'drawn cropped to the badge');
    // The stacking gap is measured from the badge's own height, not a fixed box.
    near(swo.y + swo.h, emt.y - 0.5, 0.002, gender + ' SWO sits 1/2 in above the EMT badge');
    near(swo.x + swo.w / 2, emt.x + emt.w / 2, 0.002, gender + ' centred over the EMT badge');
  }
});

test('the badge\'s real width is honoured: Air Force command pilot 3 in, pararescue 1.53 in, Army recruiter 1.5 in', async () => {
  const cases = [
    [mil('air_force_pilot_badge', 'command_pilot'), 3],
    [mil('air_force_pararescue_badge', 'default'), 1.531],
    [mil('army_recruiter_identification_badge', 'basic'), 1.5]
  ];
  for(const [m, w] of cases){
    const scene = await P.composeUniform(build('blues_a', 'male', 'Maj', [], [m]), store);
    const l = badgeLayers(scene).find(x => x.key === 'badge:' + m.id);
    assert.ok(l, m.id + ' drawn');
    near(l.w, w, 0.002, m.id + ' width');
    const e = SIZES[`${m.id}/${m.variant}`];
    near(l.h / l.w, e.h / e.w, 0.01, m.id + ' proportions');
  }
});

test('a military badge found by its PNG path alone (no variant given) takes the same size', async () => {
  const m = mil('navy_surface_warfare_insignia', 'officer');
  delete m.variant;
  const scene = await P.composeUniform(build('blues_a', 'male', 'Capt', [], [m]), store);
  near(badgeLayers(scene)[0].w, 2.75, 0.001, 'width from the asset path');
});

test('a military badge the table does not know keeps the fixed 2.75 x 0.75 in box, the whole image contained', async () => {
  const scene = await P.composeUniform(build('blues_a', 'male', 'Capt', [], [{ id: 'not_in_the_table', href: 'images/military-badges/navy/not_in_the_table/default.png', title: 'Unknown', family: 'QUALIFICATION' }]), store);
  const l = badgeLayers(scene)[0];
  assert.equal(l.w, 2.75);
  assert.equal(l.h, 0.75);
  assert.equal(l.crop, undefined);
});

test('stacking two military badges uses their real heights (0.5 in between)', async () => {
  const scene = await P.composeUniform(build('blues_a', 'male', 'Maj', [], [mil('army_recruiter_identification_badge', 'basic'), mil('air_force_pilot_badge', 'command_pilot')]), store);
  const ls = badgeLayers(scene).sort((a, b) => b.y - a.y); // lowest first
  assert.equal(ls.length, 2);
  near(ls[1].y + ls[1].h, ls[0].y - 0.5, 0.002, 'the upper badge sits 1/2 in above the lower');
});

test('index.html loads the size table before the dress engine', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const at = name => html.indexOf(`<script src="${name}`);
  assert.ok(at('data/military-badge-sizes.js') > 0, 'the table is loaded');
  assert.ok(at('data/military-badge-sizes.js') < at('js/engine/profiles-dress.js'), 'before profiles-dress.js');
});
