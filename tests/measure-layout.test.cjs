'use strict';
// The measurement overlay (js/engine/measure-layout.js): on every uniform the labels stay inside
// the drawing, clear of the artwork and of each other, and no dimension line runs across a piece.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const RA = require('../data/ribbon-awards.js');
const ML = require('../js/engine/measure-layout.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function ribbons(ids){
  return ids.flatMap(id => RA.resolve(id, {}).map((r, i) => ({ key: `ribbon:${id}${i ? '#' + i : ''}`, title: id, asset: 'ribbon-' + id.replace(/_/g, '-'), devices: r.devices, centered: r.centered })));
}
function build(uniform, membership, rank, extra){
  return Object.assign({
    uniform, gender: 'male', grade: G.gradeInfo(membership, rank, {}),
    opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const rack = ribbons(['mitchell_award', 'wright_brothers_award', 'encampment_ribbon', 'red_service_ribbon']);
const badges = ids => ids.map(id => ({ id }));

async function laidOut(b){
  const scene = await P.composeUniform(b, store());
  const B = scene.bounds;
  const vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8];
  const px = ML.previewPx(vb);
  const area = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  return { scene, px, area, drawings: ML.layout(scene, { px, area }) };
}

function overlap(a, b){
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const CASES = [
  ['Class A, captain', build('blues_a', 'senior', 'Capt', { ribbons: rack, badges: badges(['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8']) })],
  ['Class A, master sergeant', build('blues_a', 'senior', 'MSgt', { ribbons: rack, badges: badges(['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8', 'stem_badges']) })],
  ['Class A, women, cadet', build('blues_a', 'cadet', 'C/SSgt', { gender: 'female', ribbons: rack, badges: badges(['emergency_services_badge', 'model_rocketry_badge', 'CAPPilot1_FA9D33EA587D8']), cord: 'wing' })],
  ['Class B, technical sergeant', build('blues_b', 'senior', 'TSgt', { ribbons: rack, badges: badges(['emergency_services_badge', 'model_rocketry_badge', 'CAPPilot1_FA9D33EA587D8']) })],
  ['Class B long sleeve', build('blues_b', 'senior', 'MSgt', { opt: { headgear: 'auto', sleeve: 'long' }, ribbons: rack })],
  ['OCP', build('ocp', 'senior', 'Maj', { badges: badges(['CAPPilot1_FA9D33EA587D8']) })],
  ['Corporate Field Uniform with ES patch', build('corporate_field', 'senior', 'Capt', { opt: { headgear: 'auto', esPatch: 'style-1' }, badges: badges(['CAPPilot1_FA9D33EA587D8']) })],
  ['Blazer, women', build('aviator_blazer', 'senior', 'Lt Col', { gender: 'female', badges: badges(['christian_chaplin']) })],
  ['Class A, cadet officer', build('blues_a', 'cadet', 'C/Col', { ribbons: rack, badges: badges(['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8']), cord: 'group' })],
  ['mess dress', build('mess_dress', 'senior', 'MSgt', { medals: rack.map(r => ({ key: r.key.replace('ribbon:', 'mini:'), title: r.title, ribbonAsset: r.asset, medal: 'medal-' + r.asset.slice(7) + '-miniature', devices: r.devices })), badges: badges(['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8']) })]
];

for(const [name, b] of CASES){
  test(`measurement labels sit clear on the ${name}`, async () => {
    const { scene, px, area, drawings } = await laidOut(b);
    assert.ok(drawings.length > 0, 'something is measured');
    const solids = ML.obstaclesOf(scene);
    const tol = (2 * px) ** 2;
    drawings.forEach((d, i) => {
      const L = d.label;
      assert.ok(overlap(L, area) > L.w * L.h - tol, `${L.text} label inside the drawing`);
      for(const s of solids) assert.ok(overlap(L, s) <= 4 * tol, `${L.text} label clear of a piece at ${s.x.toFixed(2)},${s.y.toFixed(2)}`);
      drawings.slice(i + 1).forEach(e => assert.equal(overlap(L, e.label), 0, `${L.text} and ${e.label.text} labels apart`));
    });
  });
}

test('the lapel insignia seam is measured halfway, below the seam, with its tick on the midpoint', async () => {
  const { scene, drawings } = await laidOut(CASES[0][1]);
  const seams = scene.layers.filter(l => l.type === 'measure' && l.label === 'halfway' && l.opts && l.opts.offsetOnly && l.opts.side.y > 0);
  assert.equal(seams.length, 2);
  for(const m of seams){
    const d = drawings.find(x => x.key === m.key);
    assert.ok(d.dim[0].y > m.from.y && d.dim[1].y > m.to.y, 'the dimension line is below the seam');
    assert.equal(d.ticks.length, 1);
  }
});

test('sleeve chevrons are measured halfway between the shoulder seam and the elbow', async () => {
  const { scene } = await laidOut(CASES[1][1]);
  const m = scene.layers.find(l => l.type === 'measure' && l.label === 'halfway' && l.opts && l.opts.side && l.opts.side.x < 0);
  assert.ok(m, 'a halfway measure on the sleeve');
  const mid = m.opts.mid;
  const t = ((mid.x - m.from.x) * (m.to.x - m.from.x) + (mid.y - m.from.y) * (m.to.y - m.from.y)) / ((m.to.x - m.from.x) ** 2 + (m.to.y - m.from.y) ** 2);
  assert.ok(Math.abs(t - 0.5) < 0.05, `the chevron is halfway (${t.toFixed(3)})`);
});

test('the men\'s pocket badges are measured to their top edge, with no centre mark', async () => {
  const { scene, drawings } = await laidOut(CASES[0][1]);
  const m = scene.layers.find(l => l.type === 'measure' && l.label === '1½ in');
  const badge = scene.layers.filter(l => l.role === 'badge').find(l => Math.abs(l.x + l.w / 2 - m.to.x) < 0.01 && Math.abs(l.y - m.to.y) < 0.01);
  assert.ok(badge, 'the measure ends on a badge top');
  assert.equal(drawings.find(d => d.key === m.key).centres.length, 0);
});
