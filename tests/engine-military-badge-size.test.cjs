'use strict';
// U.S. military badges on the dress uniforms are drawn at their real size (CAPR 39-1 4.1.5.2.2 places the badge; no regulation
// prints its size). data/military-badge-sizes.js (scripts/build-military-badge-sizes.cjs) carries, for each badge/variant, the traced
// SVG the catalog record names and that SVG's size: Vanguard's regulation-size listing where there is one (size_source measured), the
// badge's aspect otherwise (estimated). Doran, on the Navy Surface Warfare Officer badge above the EMT badge: "That badge is too small"
// (it was drawn about 1.1 in wide, in a fixed 2.75 x 0.75 in box). Since LIVE13 E118 ("nothing should be photos") there is no raster:
// a badge with no traced SVG is not drawn, and the scene says so.

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
const rows = new Map(manifest.assets.map(r => [r.id, r]));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const r3 = n => Math.round(n * 1000) / 1000;

const sandbox = { window: null };
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root, 'military', 'military-data.js'), 'utf8'), sandbox);
const BADGES = sandbox.CAPUBMilitaryData.badges;
// Every metal record: [badge id, variant, record]; a representation without variants is its own default record.
const metalRecords = () => {
  const out = [];
  for(const b of BADGES){
    const m = b.representations && b.representations.metal;
    if(!m) continue;
    const variants = m.variants && Object.keys(m.variants).length ? m.variants : { [m.defaultVariant || 'default']: m };
    for(const [variant, rec] of Object.entries(variants)) if(rec && rec.asset) out.push([b.id, variant, rec]);
  }
  return out;
};

const mil = (id, variant) => {
  const b = BADGES.find(x => x.id === id);
  const m = b.representations.metal;
  const asset = (m.variants && m.variants[variant] ? m.variants[variant] : m).asset;
  return { id, variant, href: `${asset}?v=test`, title: b.officialName, family: 'QUALIFICATION' };
};
function build(uniform, gender, rank, badges, military){
  return {
    uniform, gender, grade: G.gradeInfo('senior', rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: badges.map(id => ({ id })), command: null, militaryBadges: military, patches: [], cord: null
  };
}
const badgeLayers = scene => scene.layers.filter(l => l.role === 'badge');

test('the table has an entry for every military badge/variant with a metal asset, naming the SVG the catalog names (no fallback box)', () => {
  const missing = [];
  const records = metalRecords();
  for(const [id, variant, rec] of records){
    const e = SIZES[`${id}/${variant}`];
    if(!e){ missing.push(`${id}/${variant}`); continue; }
    assert.ok(e.w > 0 && e.h > 0, `${id}/${variant} has a size`);
    assert.ok(['measured', 'estimated'].includes(e.source), `${id}/${variant} says where its size comes from`);
    assert.equal(e.asset, rec.asset, `${id}/${variant} names the catalog's asset`);
    assert.match(e.asset, /^images\/military-badges\/[^/]+\/[^/]+\/[^/]+\.svg$/, `${id}/${variant} is an SVG`);
    assert.ok(e.artId, `${id}/${variant} names its art`);
  }
  assert.ok(records.length >= 280, `${records.length} badge/variants`);
  assert.deepEqual(missing, [], 'badge/variants without a traced SVG (not drawn): ' + missing.join(', '));
  assert.equal(SIZES.FALLBACK, undefined, 'there is no fixed box to fall back to');
  assert.equal(Object.keys(SIZES).length, records.length, 'no entry for a badge the catalog does not offer');
});

test('every entry names an SVG that exists, listed in the manifest under its artId at the table\'s size, with a viewBox of that size', () => {
  for(const [key, e] of Object.entries(SIZES)){
    const file = path.join(root, e.asset);
    assert.ok(fs.existsSync(file), `${key}: ${e.asset} exists`);
    const row = rows.get(e.artId);
    assert.ok(row && row.category === 'military-badges', `${key}: manifest row ${e.artId}`);
    assert.equal('images/' + row.path, e.asset, `${key}: the row's path`);
    assert.equal(e.w, r3(row.w_in), `${key} width`); assert.equal(e.h, r3(row.h_in), `${key} height`);
    assert.equal(e.source, row.size_source || 'estimated', `${key} size source`);
    const svg = fs.readFileSync(file, 'utf8');
    const vb = /viewBox="([^"]+)"/.exec(svg)[1].trim().split(/[\s,]+/).map(Number);
    near(vb[2], e.w * 100, 0.06, `${key} viewBox width (0.01 in per unit)`); near(vb[3], e.h * 100, 0.06, `${key} viewBox height`);
    assert.doesNotMatch(svg, /<(image|text|filter|linearGradient|radialGradient)\b/, `${key}: vector art only`);
  }
});

test('data/military-badge-sizes.js is what scripts/build-military-badge-sizes.cjs writes from the catalog and the manifest', () => {
  const r = sizesBuilder.build();
  assert.equal(fs.readFileSync(sizesBuilder.OUT, 'utf8'), r.text, 'run node scripts/build-military-badge-sizes.cjs');
  assert.deepEqual(r.missing, [], 'badge/variants with no traced SVG');
});

test('Class A: the Navy Surface Warfare Officer badge is 2.75 in wide (Vanguard regulation size), 0.5 in above the EMT badge', async () => {
  const e = SIZES['navy_surface_warfare_insignia/officer'];
  // Vanguard prints 2-3/4 W x 1 H; the height follows the traced reference's aspect, so it is read from the table, not a literal.
  assert.ok(e.h > 0.9 && e.h < 1.0, `about 1 in tall: ${e.h}`);
  for(const gender of ['male', 'female']){
    const scene = await P.composeUniform(build('blues_a', gender, 'Capt', ['emt_basic_badge'], [mil('navy_surface_warfare_insignia', 'officer')]), store);
    const swo = badgeLayers(scene).find(l => l.key === 'badge:navy_surface_warfare_insignia');
    const emt = badgeLayers(scene).find(l => l.key === 'badge:emt_basic_badge');
    assert.ok(swo && emt, gender + ' both badges drawn');
    assert.equal(swo.type, 'asset');
    assert.equal(swo.id, 'navy-surface-warfare-officer');
    near(swo.w, 2.75, 0.001, gender + ' SWO width');
    near(swo.h, e.h, 0.001, gender + ' SWO height (the SVG\'s own)');
    assert.equal(swo.sizeSource, 'measured');
    assert.equal(swo.artId, 'navy-surface-warfare-officer');
    assert.equal(swo.military, true, 'marked as a military badge for the shopping list');
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
    assert.equal(l.type, 'asset', m.id + ' is the traced art');
    near(l.w, w, 0.002, m.id + ' width');
    const e = SIZES[`${m.id}/${m.variant}`];
    near(l.h / l.w, e.h / e.w, 0.01, m.id + ' proportions');
  }
});

test('a military badge found by its SVG path alone (no variant given) takes the same size', async () => {
  const m = mil('navy_surface_warfare_insignia', 'officer');
  delete m.variant;
  const scene = await P.composeUniform(build('blues_a', 'male', 'Capt', [], [m]), store);
  const l = badgeLayers(scene)[0];
  assert.equal(l.type, 'asset'); assert.equal(l.id, 'navy-surface-warfare-officer');
  near(l.w, 2.75, 0.001, 'width from the asset path');
});

test('a military badge the table does not know is not drawn: no picture of any kind, and the scene names it', async () => {
  const unknown = { id: 'not_in_the_table', href: 'images/military-badges/navy/not_in_the_table/default.svg', title: 'Unknown badge', family: 'QUALIFICATION' };
  const scene = await P.composeUniform(build('blues_a', 'male', 'Capt', [], [unknown]), store);
  assert.deepEqual(badgeLayers(scene), []);
  assert.ok(!scene.layers.some(l => l.type === 'raster'), 'nothing is a raster');
  assert.ok(scene.notes.includes('Unknown badge cannot be shown on this uniform'), scene.notes.join(' | '));
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
