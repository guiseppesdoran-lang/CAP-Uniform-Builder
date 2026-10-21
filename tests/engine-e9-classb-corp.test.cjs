'use strict';
// Class B, the aviator shirt, the corporate blazer and the corporate semi-formal: badge size and place.
//   - Badges are placed at their own size on every dress uniform; only field Velcro zones fit a piece
//     to its slot (ICL 25-06 7.1.1.4). A badge never scales to the pocket (critique D29, D35).
//   - CAPR 39-1 4.2.3.1.1.1 / 4.2.4.1.1.1: the crest, or the CSAG, Command Council, National Board or NEC
//     badge in its place, is centred on the left breast pocket (the women's blazer has none: same
//     relative position). 4.2.4.1.1.2: the women's nametag 1/2 in above it.
//   - 4.2.1.4 / 4.2.2.4 with ICL 25-02: semi-formal miniature medals end 1/2 in above the crest or the
//     service badge worn in its place.
//   - 4.2.6.2.7.2-3: women's aviator shirt, two badges across the nametag, the command pin 1/2 in above
//     them; a third ordinary badge takes the men's layout the paragraph allows.
//   - 4.1.12.2.5.2: women's Class B, rocketry or marksmanship worn with other badges: wearer's left,
//     1 1/2 in below the ribbons.

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

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

const ribbons = RA.resolve('cap_achievment_award', {}).map(r => ({ key: 'ribbon:cap_achievment_award', title: 'x', asset: 'ribbon-cap-achievment-award', devices: r.devices, centered: r.centered }));
function ribbonOf(id){
  return RA.resolve(id, {}).map(r => ({ key: 'ribbon:' + id, title: id, asset: 'ribbon-' + id.replace(/_/g, '-'), devices: r.devices, centered: r.centered }));
}
const medals = ['cap_achievment_award', 'unit_citation_award', 'cap_leadership_ribbon', 'cap_membership_ribbon'].flatMap(id => ribbonOf(id)).map(r => ({ key: r.key.replace('ribbon:', 'mini:'), title: r.title, ribbonAsset: r.asset, medal: 'medal-' + r.asset.slice(7) + '-miniature', devices: r.devices }));

function build(uniform, gender, membership, rank, badges, extra){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: badges.map(id => ({ id })), command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} vs ${b.toFixed(3)}`);
const badgeLayers = scene => scene.layers.filter(l => l.role === 'badge');
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const cx = l => l.x + l.w / 2;
const CMD = { id: 'squadron_commander_badge', title: 'Squadron Commander Badge', graduated: false };
const PILOT = 'CAPPilot1_FA9D33EA587D8';

// ---- badges keep their size --------------------------------------------------------------------

for(const [uniform, sex, membership, rank, sleeve] of [
  ['blues_b', 'male', 'senior', 'Capt', 'short'], ['blues_b', 'female', 'senior', 'Capt', 'short'],
  ['blues_a', 'male', 'senior', 'Capt'], ['blues_a', 'female', 'senior', 'Capt'],
  ['aviator', 'male', 'senior', 'Capt', 'short'], ['aviator', 'female', 'senior', 'Capt', 'short'],
  ['aviator_blazer', 'male', 'senior', 'Capt'], ['aviator_blazer', 'female', 'senior', 'Capt'],
  ['semi_formal', 'male', 'senior', 'Capt'], ['semi_formal', 'female', 'senior', 'Capt'],
  ['mess_dress', 'male', 'senior', 'Capt'], ['mess_dress', 'female', 'senior', 'Capt']
]){
  test(`${uniform} ${sex}: every badge is drawn at its artwork's own size, never fitted to a pocket or slot (D29, D35)`, async () => {
    const b = build(uniform, sex, membership, rank, [PILOT, 'command_council_badge', 'emergency_services_badge', 'national_staff_badge'], { command: CMD, opt: { headgear: 'auto', sleeve } });
    const scene = await P.composeUniform(b, store);
    const layers = badgeLayers(scene);
    assert.ok(layers.length >= 1, 'a badge is drawn');
    for(const l of layers){
      if(!l.id) continue;
      const spec = await store.load(l.id);
      near(l.w, spec.w, 0.002, `${l.key} width`);
      near(l.h, spec.h, 0.002, `${l.key} height`);
      assert.ok(!l.scale || l.scale === 1, `${l.key} not scaled`);
    }
  });
}

test('a pocket badge is smaller than the pocket it sits on (men\'s Class B, Command Council and Emergency Services)', async () => {
  const scene = await P.composeUniform(build('blues_b', 'male', 'senior', 'Capt', ['command_council_badge', 'emergency_services_badge']), store);
  const spec = await store.load('garment-blues-class-b-shirt-male');
  const pocket = core.landmarkBounds(spec, 'pocket_left');
  for(const l of badgeLayers(scene)){
    assert.ok(l.w < pocket.w / 2 && l.h < pocket.h, `${l.key} ${l.w.toFixed(2)} x ${l.h.toFixed(2)} in on a ${pocket.w.toFixed(2)} x ${pocket.h.toFixed(2)} in pocket`);
  }
});

// ---- men's Class B pockets ---------------------------------------------------------------------

test('men\'s Class B: the first badge centred on the wearer\'s left pocket, the second on the right (4.1.11.1.1.2.4)', async () => {
  const spec = await store.load('garment-blues-class-b-shirt-male');
  const left = core.landmarkBounds(spec, 'pocket_left'), right = core.landmarkBounds(spec, 'pocket_right');
  const flapY = left.y + 2.02, span = [flapY, left.y + left.h];
  const scene = await P.composeUniform(build('blues_b', 'male', 'senior', 'Capt', ['command_council_badge', 'emergency_services_badge']), store);
  const cc = byKey(scene, 'badge:command_council_badge'), es = byKey(scene, 'badge:emergency_services_badge');
  // The service badge goes to the wearer's left pocket (landmark pocket_left, the viewer's right).
  near(cx(cc), left.x + left.w / 2, 0.005, 'service badge across the pocket');
  near(cc.y + cc.h / 2, (span[0] + span[1]) / 2, 0.005, 'service badge halfway between flap and pocket bottom');
  near(cx(es), right.x + right.w / 2, 0.005, 'second badge across the pocket');
  near(es.y + es.h / 2, (span[0] + span[1]) / 2, 0.005, 'second badge halfway between flap and pocket bottom');
});

// ---- women's Class B: rocketry and marksmanship 1 1/2 in below the ribbons -----------------------

for(const marks of ['model_rocketry_badge', 'nra_marksman_badge']){
  test(`women's Class B cadet with other badges: ${marks} on the wearer's left, 1 1/2 in below the ribbons (4.1.12.2.5.2)`, async () => {
    const b = build('blues_b', 'female', 'cadet', 'C/Maj', ['stem_badges', marks], { ribbons });
    const scene = await P.composeUniform(b, store);
    const rack = scene.layers.filter(l => l.role === 'ribbon');
    assert.ok(rack.length, 'ribbons drawn');
    const bottom = Math.max(...rack.map(l => l.y + l.h));
    const spot = byKey(scene, 'badge:' + marks), other = byKey(scene, 'badge:stem_badges');
    near(spot.y, bottom + 1.5, 0.005, 'top of the badge 1 1/2 in below the ribbons');
    const mid = (await store.load('garment-blues-class-b-blouse-female')).w / 2;
    assert.ok(cx(spot) > mid, 'on the wearer\'s left (the viewer\'s right)');
    near(cx(spot), (Math.min(...rack.map(l => l.x)) + Math.max(...rack.map(l => l.x + l.w))) / 2, 0.01, 'centred under the ribbon rack');
    const tagSheet = scene.layers.find(l => /^layer:.*nametag/.test(l.key));
    const tag = core.landmarkBounds(await store.load(tagSheet.id), 'nametag') || core.landmarkBounds(await store.load(tagSheet.id), 'nameplate');
    near(other.y + other.h, tagSheet.y + tag.y - 0.5, 0.005, 'the other badge 1/2 in above the nametag');
  });
}

// ---- the blazer: crest and badge on the pocket, nametag above the women's crest -------------------

test('men\'s blazer: the CAP Crest is centred on the left breast pocket (4.2.3.1.1.1)', async () => {
  const spec = await store.load('garment-corporate-service-dress-blazer-male');
  const pocket = core.landmarkBounds(spec, 'breast_pocket');
  const scene = await P.composeUniform(build('aviator_blazer', 'male', 'senior', 'Capt', []), store);
  const crest = byKey(scene, 'crest:cap');
  assert.ok(crest, 'crest placed by the engine');
  near(cx(crest), pocket.x + pocket.w / 2, 0.005, 'crest across the pocket');
  near(crest.y + crest.h / 2, pocket.y + pocket.h / 2, 0.005, 'crest up and down the pocket');
  const base = scene.layers.find(l => l.key === 'base:jacket');
  assert.ok((base.hideGroups || []).includes('cap-crest'), 'the sheet\'s own crest is hidden');
});

for(const [uniform, sex] of [['aviator_blazer', 'male'], ['semi_formal', 'male']]){
  test(`${uniform} ${sex}: the Command Council badge takes the crest's place, centred on the pocket (4.2.3.1.1.1)`, async () => {
    const spec = await store.load('garment-corporate-service-dress-blazer-male');
    const pocket = core.landmarkBounds(spec, 'breast_pocket');
    const scene = await P.composeUniform(build(uniform, sex, 'senior', 'Capt', ['command_council_badge']), store);
    const l = byKey(scene, 'badge:command_council_badge');
    near(cx(l), pocket.x + pocket.w / 2, 0.005, 'badge across the pocket');
    near(l.y + l.h / 2, pocket.y + pocket.h / 2, 0.005, 'badge up and down the pocket');
    assert.ok(!scene.layers.some(x => x.key === 'crest:cap'), 'no crest under it');
  });
}

test('women\'s blazer: crest at the sheet\'s relative position, the nametag 1/2 in above it; the service badge takes both roles (4.2.4.1.1.1-2)', async () => {
  const spec = await store.load('garment-corporate-service-dress-blazer-female');
  const at = core.anchor(spec, 'crest_center');
  for(const badges of [[], ['command_council_badge']]){
    const scene = await P.composeUniform(build('aviator_blazer', 'female', 'senior', 'Capt', badges), store);
    const crest = byKey(scene, badges.length ? 'badge:command_council_badge' : 'crest:cap');
    near(cx(crest), at.x, 0.005, 'crest across');
    near(crest.y + crest.h / 2, at.y, 0.005, 'crest at the sheet\'s centre');
    const plate = scene.layers.find(l => l.role === 'nametag' && l.key === 'nametag' && l.y < crest.y);
    near(plate.y + plate.h, crest.y - 0.5, 0.005, 'nametag bottom 1/2 in above the crest or badge');
    near(cx(plate), cx(crest), 0.005, 'nametag centred over it');
  }
});

// ---- semi-formal: medals 1/2 in above the crest or service badge ----------------------------------

for(const sex of ['male', 'female']){
  for(const badges of [[], ['command_council_badge']]){
    test(`corporate semi-formal ${sex}${badges.length ? ' with a service badge' : ''}: the lowest medals end 1/2 in above the ${badges.length ? 'badge' : 'crest'} (4.2.1.4, 4.2.2.4, ICL 25-02)`, async () => {
      const scene = await P.composeUniform(build('semi_formal', sex, 'senior', 'Capt', badges, { medals }), store);
      const crest = byKey(scene, badges.length ? 'badge:command_council_badge' : 'crest:cap');
      const minis = scene.layers.filter(l => l.role === 'mini-drape' || l.role === 'mini-medal');
      assert.ok(minis.length, 'medals drawn');
      const bottom = Math.max(...minis.map(l => l.y + l.h));
      near(bottom, crest.y - 0.5, 0.01, 'lowest medal bottom 1/2 in above the crest');
    });
  }
}

// ---- women's aviator shirt: command pin and the third badge --------------------------------------

async function femaleAviator(badges, extra){
  const scene = await P.composeUniform(build('aviator', 'female', 'senior', 'Capt', badges, Object.assign({ ribbons, opt: { headgear: 'auto', sleeve: 'short', femaleTop: 'shirt' } }, extra)), store);
  const tag = scene.layers.find(l => l.key === 'nametag');
  return { scene, tag };
}

test('women\'s aviator: two badges across the nametag 1/2 in above it, the command pin 1/2 in above them (4.2.6.2.7.2-3)', async () => {
  const { scene, tag } = await femaleAviator(['command_council_badge', 'emergency_services_badge'], { command: CMD });
  const pair = ['badge:command_council_badge', 'badge:emergency_services_badge'].map(k => byKey(scene, k)).sort((a, b) => a.x - b.x);
  const pin = byKey(scene, 'badge:squadron_commander_badge:ON:0');
  const top = Math.min(...pair.map(l => l.y));
  near(pin.y + pin.h, top - 0.5, 0.005, 'pin bottom 1/2 in above the badges');
  near(cx(pin), tag.x + tag.w / 2, 0.005, 'pin centred over the nametag');
  for(const l of pair) near(l.y + l.h, tag.y - 0.5, 0.005, 'badge bottom 1/2 in above the nametag');
  near(pair[1].x - (pair[0].x + pair[0].w), 0.5, 0.005, 'badges 1/2 in apart');
  // The service badge is closest to the lapel (the viewer's right of the pair).
  assert.equal(pair[1].key, 'badge:command_council_badge');
});

test('women\'s aviator: a single badge with the pin: the pin 1/2 in above the badge, the badge 1/2 in above the nametag', async () => {
  const { scene, tag } = await femaleAviator(['emergency_services_badge'], { command: CMD });
  const badge = byKey(scene, 'badge:emergency_services_badge'), pin = byKey(scene, 'badge:squadron_commander_badge:ON:0');
  near(badge.y + badge.h, tag.y - 0.5, 0.005, 'badge 1/2 in above the nametag');
  near(pin.y + pin.h, badge.y - 0.5, 0.005, 'pin 1/2 in above the badge');
});

test('women\'s aviator: no badge, the pin 1/2 in above the nametag', async () => {
  const { scene, tag } = await femaleAviator([], { command: CMD });
  const pin = byKey(scene, 'badge:squadron_commander_badge:ON:0');
  near(pin.y + pin.h, tag.y - 0.5, 0.005, 'pin 1/2 in above the nametag');
});

test('women\'s aviator: with two ordinary badges the two-across layout stays', async () => {
  const { scene, tag } = await femaleAviator(['command_council_badge', 'communications_technician_badge']);
  for(const k of ['badge:command_council_badge', 'badge:communications_technician_badge']){
    const l = byKey(scene, k);
    near(l.y + l.h, tag.y - 0.5, 0.005, k + ' above the nametag');
  }
});

test('women\'s aviator: model rocketry with other badges over the nametag goes on the left pocket; marksmanship on the flap top (4.2.6.2.7.2)', async () => {
  const spec = await store.load('garment-aviator-shirt-female');
  const lp = core.anchor(spec, 'badge_left_pocket_center');
  const scene = await P.composeUniform(build('aviator', 'female', 'cadet', 'C/Maj', ['stem_badges', 'model_rocketry_badge'], { opt: { headgear: 'auto', sleeve: 'short', femaleTop: 'shirt' } }), store);
  const r = byKey(scene, 'badge:model_rocketry_badge');
  near(cx(r), lp.x, 0.005, 'rocketry across the left pocket');
  near(r.y + r.h / 2, lp.y, 0.005, 'rocketry centred on the pocket');
});
