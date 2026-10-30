'use strict';
// The traced U.S. military badge SVGs (LIVE13 E104, Ethan: "military badges need to be the custom artwork. same rigorous process
// as the cap badges") come into this tree through scripts/sync-military-badges.cjs: the art tree's assets/military/v3/out/<art id>/
// is matched to a page badge/variant by its spec's `reference` (the builder raster it was traced from), copied beside that PNG as
// images/military-badges/<service>/<badge dir>/<variant>.svg, listed in images/MANIFEST.json under the art id, and recorded in
// data/military-badge-sizes.js (`svg`). These checks keep the three in step and the mapping right.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sync = require('../scripts/sync-military-badges.cjs');
const sizesBuilder = require('../scripts/build-military-badge-sizes.cjs');
const SIZES = require('../data/military-badge-sizes.js');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const rows = new Map(manifest.assets.map(r => [r.id, r]));
const artPresent = fs.existsSync(sync.V3);

// The thirteen pilot assets of the v3 lane (assets/military/v3/gates/pilot.md) and the page badge/variant each one is, with the
// width the spec gives. Two are traces of a cloth photo (the Army parachutist and expert field medical badges) and fail the gate
// by definition; the sync maps them but leaves their PNGs in place unless --all is given.
const PILOT = [
  ['af-pilot-pilot', 'air_force_pilot_badge/pilot', 3],
  ['af-pilot-command-pilot', 'air_force_pilot_badge/command_pilot', 3],
  ['af-officer-aircrew-basic', 'air_force_officer_aircrew_badge/basic', 3],
  ['af-fire-protection-default', 'air_force_fire_protection_badge/default', null],
  ['af-religious-affairs-basic', 'air_force_religious_affairs_badge/basic', null],
  ['af-professional-military-education-default', 'air_force_professional_military_education_badge/default', null],
  ['af-parachutist-basic', 'air_force_parachutist_badge/basic', 2],
  ['af-space-basic', 'air_force_space_badge/basic', 3],
  ['army-combat-infantryman-first-award', 'army_combat_infantryman_badge/first_award', null],
  ['army-expert-field-medical-default', 'army_expert_field_medical_badge/default', null],
  ['army-parachutist-basic', 'army_parachutist_badge/basic', null],
  ['navy-surface-warfare-officer', 'navy_surface_warfare_insignia/officer', 2.75],
  ['navy-marine-corps-combat-aircrew-base', 'navy_marine_corps_combat_aircrew_insignia/base', 2]
];

test('the sync maps each pilot asset to its page badge/variant by the spec reference, at the spec\'s size', { skip: !artPresent && 'artwork tree not present' }, () => {
  const p = sync.plan({ all: true });
  const keysOf = new Map(); // art id -> the badge/variants drawn from it (a raster two badges share maps both to one asset)
  for(const s of p.sync) keysOf.set(s.id, [...(keysOf.get(s.id) || []), s]);
  const v3 = new Map(sync.v3Assets().assets.map(a => [a.id, a]));
  for(const [id, key, w] of PILOT){
    const a = v3.get(id);
    if(!a) continue; // a pilot asset redrawn under another id, or not yet in the lane
    const hits = keysOf.get(id) || [];
    const s = hits.find(x => x.key === key);
    assert.ok(s, `${id} -> ${key} (mapped to ${hits.map(x => x.key).join(', ') || 'nothing'})`);
    if(w != null) assert.equal(s.w, w, `${id} width`);
    assert.equal(s.w, a.w); assert.equal(s.h, a.h);
    assert.equal(s.rel, s.asset.replace(/^images\//, '').replace(/\.png$/, '.svg'), `${id} lands beside its PNG`);
    for(const h of hits) assert.equal(h.asset.split('/').pop(), s.asset.split('/').pop(), `${id}: ${h.key} shares the raster ${s.asset}`);
  }
  assert.equal(p.unmatched.length, 0, 'every v3 asset names a page badge: ' + p.unmatched.map(u => u.id).join(', '));
});

test('a gate-failed v3 asset is left out by default and listed with the spec\'s reason; --all takes it', { skip: !artPresent && 'artwork tree not present' }, () => {
  const strict = sync.plan(), all = sync.plan({ all: true });
  for(const e of strict.excluded){
    assert.ok(e.why, `${e.id}: a reason`);
    assert.ok(!strict.sync.some(s => s.id === e.id), `${e.id} not synced`);
    assert.ok(all.sync.some(s => s.id === e.id), `${e.id} taken with --all`);
    assert.ok(strict.onPng.some(x => x.key === e.key), `${e.key} is reported as staying on its PNG`);
  }
  for(const s of strict.sync) assert.equal(s.pass, true, `${s.id} passed its gate`);
  assert.equal(all.sync.length, strict.sync.length + strict.excluded.length);
});

test('every synced SVG is beside its PNG, has a manifest row under the art id with the SVG\'s own size, and the size table names it', () => {
  const svgRows = manifest.assets.filter(r => r.category === sync.CATEGORY);
  assert.ok(svgRows.length >= 11, `${svgRows.length} synced badges (the eleven gate-passing pilots at least)`);
  const ids = new Set();
  for(const r of svgRows){
    assert.ok(!ids.has(r.id), `${r.id} once`); ids.add(r.id);
    const file = path.join(root, 'images', r.path);
    assert.ok(fs.existsSync(file), `${r.id}: ${r.path} exists`);
    assert.ok(fs.existsSync(file.replace(/\.svg$/, '.png')), `${r.id}: the PNG it replaces is still beside it`);
    const svg = fs.readFileSync(file, 'utf8');
    const vb = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number);
    assert.ok(Math.abs(vb[2] - r.w_in * 100) < 0.01 && Math.abs(vb[3] - r.h_in * 100) < 0.01, `${r.id}: viewBox ${vb.join(' ')} is ${r.w_in} x ${r.h_in} in`);
    assert.ok(r.anchors && r.anchors.center && r.anchors.top_center && r.anchors.bottom_center, `${r.id}: anchors`);
    assert.equal(r.has_spec, false, `${r.id}: the row carries what the engine reads; no .spec.json is copied`);
    assert.ok(r.provenance && /military-badges\//.test(r.provenance.reference), `${r.id}: provenance names the raster it was traced from`);
    assert.equal(r.provenance.fidelity.pass, true, `${r.id}: passed the art tree's gates`);
    assert.doesNotMatch(svg, /<(text|image|filter|linearGradient|radialGradient)\b/, `${r.id}: no text, raster, filter or gradient`);
    // The table entry of the badge/variant whose PNG this SVG sits beside.
    const entry = Object.values(SIZES).find(e => e.svg === 'images/' + r.path);
    assert.ok(entry, `${r.id}: a size table entry draws it`);
    assert.equal(entry.artId, r.id);
    assert.equal(entry.w, Math.round(r.w_in * 1000) / 1000); assert.equal(entry.h, Math.round(r.h_in * 1000) / 1000);
    assert.equal(entry.asset.replace(/\.png$/, '.svg'), 'images/' + r.path);
  }
  for(const [key, e] of Object.entries(SIZES)){
    if(!e.svg) continue;
    assert.ok(rows.has(e.artId) && 'images/' + rows.get(e.artId).path === e.svg, `${key}: its svg is the manifest's ${e.artId}`);
  }
  assert.equal(manifest.count, manifest.assets.length, 'manifest count');
  assert.equal(manifest.by_category[sync.CATEGORY], svgRows.length, 'manifest by_category');
});

test('the sync is idempotent: an asset already synced from the same source has nothing to write, and the generated files are current', { skip: !artPresent && 'artwork tree not present' }, () => {
  // New or regenerated art in the lane is not a failure here (other workers add to it); a synced asset whose source is unchanged
  // must plan no write, or a second run would churn.
  const p = sync.plan({ all: true });
  for(const s of p.sync){
    if(!rows.has(s.id)) continue;
    if(fs.readFileSync(s.dest, 'utf8') !== s.svg) continue; // the art tree has a newer trace
    assert.equal(s.svgChange, 'same', `${s.id}: the SVG`);
    assert.equal(s.rowChange, 'same', `${s.id}: the manifest row`);
  }
  // The size table and the asset index derive from this tree alone and are what their builders write.
  assert.equal(fs.readFileSync(sizesBuilder.OUT, 'utf8'), sizesBuilder.build().text, 'run node scripts/build-military-badge-sizes.cjs');
  const idx = require('../scripts/build-asset-index.cjs');
  assert.equal(fs.readFileSync(idx.OUT, 'utf8'), idx.build(), 'run node scripts/build-asset-index.cjs');
});

test('data/military-badge-sizes.js says how many badge/variants draw a traced SVG, and no PNG-only entry carries svg', () => {
  const withSvg = Object.values(SIZES).filter(e => e.svg).length;
  assert.match(fs.readFileSync(path.join(root, 'data', 'military-badge-sizes.js'), 'utf8'), new RegExp(`${withSvg} draw a traced SVG`));
  for(const [key, e] of Object.entries(SIZES)) if(e.svg) assert.ok(fs.existsSync(path.join(root, e.svg)), `${key}: ${e.svg} exists`);
});
