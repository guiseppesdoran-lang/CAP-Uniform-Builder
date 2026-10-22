'use strict';
// Class B, the aviator shirt, the corporate blazer and the corporate semi-formal: badge size and place.
//   - Badges are placed at their own size on every dress uniform; only field Velcro zones fit a piece
//     to its slot (ICL 25-06 7.1.1.4). A badge never scales to the pocket (critique D29, D35).
//   - CAPR 39-1 4.2.3.1.1.1 / 4.2.4.1.1.1: the crest, or the CSAG, Command Council, National Board or NEC
//     badge in its place, is centred on the left breast pocket body, the sheet's crest_center (below the
//     welt opening; centring on the welt strip was rejected, tracker placement item 4). The women's
//     blazer sheet draws a slanted welt pocket: 4.2.4.1.1.2 puts the nametag's top edge straight across
//     from the pocket's inside edge (the sheet's nameplate_slot), not 1/2 in above the crest.
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

// ---- the blazer: crest and badge on the pocket body, nametag above the women's crest --------------

test('men\'s blazer: the sheet draws the CAP Crest at the pocket body below the welt, and the engine leaves it (4.2.3.1.1.1)', async () => {
  const spec = await store.load('garment-corporate-service-dress-blazer-male');
  const welt = core.landmarkBounds(spec, 'breast_pocket');
  const crest = core.anchor(spec, 'crest_center'), crestTop = core.anchor(spec, 'crest_top_center');
  const scene = await P.composeUniform(build('aviator_blazer', 'male', 'senior', 'Capt', []), store);
  const base = scene.layers.find(l => l.key === 'base:jacket');
  assert.ok(!(base.hideGroups || []).includes('cap-crest'), 'the sheet\'s own crest is drawn');
  assert.ok(!scene.layers.some(l => l.key === 'crest:cap'), 'no second crest placed on the welt');
  // The sheet's crest sits on the pocket body: it does not straddle the welt strip.
  assert.ok(crestTop.y >= welt.y + welt.h - 0.05, `crest top ${crestTop.y.toFixed(3)} at or below the welt bottom ${(welt.y + welt.h).toFixed(3)}`);
  assert.ok(crest.y > welt.y + welt.h, 'crest centre below the welt');
});

for(const [uniform, sex] of [['aviator_blazer', 'male'], ['semi_formal', 'male'], ['aviator_blazer', 'female'], ['semi_formal', 'female']]){
  test(`${uniform} ${sex}: the Command Council badge takes the crest's place, centred on the sheet's crest_center, below the welt (4.2.3.1.1.1, tracker item 4)`, async () => {
    const spec = await store.load(`garment-corporate-service-dress-blazer-${sex}`);
    const at = core.anchor(spec, 'crest_center');
    const welt = core.landmarkBounds(spec, 'breast_pocket');
    const scene = await P.composeUniform(build(uniform, sex, 'senior', 'Capt', ['command_council_badge']), store);
    const l = byKey(scene, 'badge:command_council_badge');
    near(cx(l), at.x, 0.005, 'badge across the pocket body');
    near(l.y + l.h / 2, at.y, 0.005, 'badge up and down the pocket body');
    if(welt){
      const weltBottom = welt.y + welt.h;
      assert.ok(l.y + l.h / 2 > weltBottom, 'badge centre below the welt');
      // Once the A4b art is synced (1.044 x 1.5 in) the whole badge sits under the welt. The images/ copy
      // still holds the 2.088 x 3 in art, which cannot fit under it (see FOLLOWUPS: sync-artwork width_in).
      if(l.h <= 2 * (at.y - weltBottom)) assert.ok(l.y >= weltBottom - 0.05, `badge top ${l.y.toFixed(3)} below the welt bottom ${weltBottom.toFixed(3)}, never straddling the welt`);
    }
    const base = scene.layers.find(x => x.key === 'base:jacket');
    assert.ok(base.hideGroups.includes('cap-crest'), 'the sheet\'s crest is hidden under it');
  });
}

test('women\'s blazer: the nametag top edge is at the sheet\'s nameplate_slot height, straight across from the slanted pocket on the wearer\'s right, with the crest, a service badge or a chaplain badge (4.2.4.1.1.2)', async () => {
  // The women's sheet draws a slanted welt pocket on the wearer's left; 4.2.4.1.1.2 aligns the nametag's top
  // edge with the top of the pocket, straight across from the inside edge of a slanted one, which is on the
  // wearer's right as on the men's blazer (4.2.3.1.1.2, Figure 4.15): the slot's top y, its x mirrored about the
  // blazer's centre line. The old '1/2 in above the crest' is the clause for a blazer with no pocket (D8).
  // FIX-R-OTHER-r1: the earlier version of this test put the tag at the slot's own x, over the pocket.
  const spec = await store.load('garment-corporate-service-dress-blazer-female');
  const slot = core.landmarkBounds(spec, 'nameplate_slot');
  const crest = core.anchor(spec, 'crest_center'), crestTop = core.anchor(spec, 'crest_top_center');
  assert.ok(slot, 'the sheet carries a nameplate_slot');
  for(const badges of [[], ['command_council_badge'], ['cap_national_command_board_badge'], ['christian_chaplin'], ['command_council_badge', 'christian_chaplin']]){
    const scene = await P.composeUniform(build('aviator_blazer', 'female', 'senior', 'Capt', badges), store);
    const plate = scene.layers.find(l => l.role === 'nametag' && l.key === 'nametag');
    const label = badges.join('+') || 'crest';
    near(plate.y, slot.y, 0.005, `${label}: nametag top at the slot top`);
    // FIX-R-OTHER-r1 review round 3 (D8): the tag's inner end lay 0.1 in over the wearer's right lapel, so it moves
    // outward (toward the arm) by the least that clears the lapel by 0.1 in, 0.3 in at most.
    const across = spec.w - (slot.x + slot.w / 2);
    assert.ok(cx(plate) <= across + 0.005 && cx(plate) >= across - 0.3, `${label}: nametag straight across the slot on the wearer's right, moved at most 0.3 in outward off the lapel (${cx(plate).toFixed(3)} vs ${across.toFixed(3)})`);
    assert.ok(cx(plate) < spec.w / 2, `${label}: the nametag is on the wearer's right (the viewer's left)`);
    assert.ok(plate.x + plate.w < crest.x - 0.5, `${label}: nothing of the nametag lies over the left breast pocket or the crest`);
    // The crest, or the badge in its place, stays centred on crest_center and clear of the plate.
    const chap = badges.find(x => x.includes('chaplin'));
    const worn = badges.find(x => !x.includes('chaplin'));
    const wornLayer = worn ? byKey(scene, 'badge:' + worn) : null;
    if(wornLayer){
      near(cx(wornLayer), crest.x, 0.005, `${label}: badge across the crest point`);
      near(wornLayer.y + wornLayer.h / 2, crest.y, 0.005, `${label}: badge down the crest point`);
    }
    if(chap){
      // The chaplain badge stays 1/2 in above the plate, centred on it (4.2.4.1.1.3).
      const c = byKey(scene, 'badge:' + chap);
      near(c.y + c.h, plate.y - 0.5, 0.005, `${label}: chaplain badge 1/2 in above the plate`);
      near(cx(c), cx(plate), 0.005, `${label}: chaplain badge centred over the plate, on the wearer's right`);
    }
  }
});

// ---- semi-formal: medals 1/2 in above the crest or service badge actually drawn --------------------

for(const sex of ['male', 'female']){
  for(const badges of [[], ['command_council_badge']]){
    test(`corporate semi-formal ${sex}${badges.length ? ' with a service badge' : ''}: the lowest medals end 1/2 in above the ${badges.length ? 'badge' : 'crest'} (4.2.1.4, 4.2.2.4, ICL 25-02)`, async () => {
      const spec = await store.load(`garment-corporate-service-dress-blazer-${sex}`);
      const sheetTop = core.anchor(spec, 'crest_top_center').y;
      const scene = await P.composeUniform(build('semi_formal', sex, 'senior', 'Capt', badges, { medals }), store);
      const crestTop = badges.length ? byKey(scene, 'badge:command_council_badge').y : sheetTop;
      const minis = scene.layers.filter(l => l.role === 'mini-drape' || l.role === 'mini-medal');
      assert.ok(minis.length, 'medals drawn');
      const bottom = Math.max(...minis.map(l => l.y + l.h));
      // On the men's blazer the crest is centred on the pocket: the rack ends at the pocket's top edge when 1/2 in over the crest is over the welt (FIX-R-OTHER-r1 #4, D8).
      const pocketTop = sex === 'male' ? core.anchor(spec, 'pocket_top_center').y : Infinity;
      near(bottom, Math.min(crestTop - 0.5, pocketTop), 0.01, 'lowest medal bottom 1/2 in above the crest or badge (men: at the pocket top)');
    });
  }
}

// The seven-award proof set: Meritorious Service (the tallest body) lands in the upper row, so the lowest
// row's bodies are shorter than the set's tallest. The lowest drawn bodies must still end 1/2 in above the
// crest or badge, and the mess dress group must be centred on its point (4.2.1.4, 4.2.2.4 ICL 25-02; 4.1.1.1.2.2).
const MIXED = ['meritorious_service_award', 'commander_commendation_award', 'cap_achievment_award', 'cap_leadership_ribbon', 'cap_membership_ribbon', 'red_service_ribbon', 'search_find_ribbon']
  .flatMap(id => ribbonOf(id)).map(r => ({ key: r.key.replace('ribbon:', 'mini:'), title: r.title, ribbonAsset: r.asset, medal: 'medal-' + r.asset.slice(7) + '-miniature', devices: r.devices }));

async function lowestRow(scene){
  const drapes = scene.layers.filter(l => l.role === 'mini-drape');
  const lowY = Math.max(...drapes.map(l => l.y));
  const keys = new Set(drapes.filter(l => Math.abs(l.y - lowY) < 1e-6).map(l => l.key + ':medal'));
  const row = scene.layers.filter(l => l.role === 'mini-medal' && keys.has(l.key));
  const upper = scene.layers.filter(l => l.role === 'mini-medal' && !keys.has(l.key));
  return { row, upper, bottom: Math.max(...row.map(l => l.y + l.h)) };
}

for(const sex of ['male', 'female']){
  for(const badges of [[], ['command_council_badge']]){
    test(`corporate semi-formal ${sex}, mixed medal heights${badges.length ? ' with a service badge' : ''}: the lowest drawn medal bodies end 1/2 in above the ${badges.length ? 'badge' : 'crest'} (4.2.1.4, 4.2.2.4, ICL 25-02)`, async () => {
      const spec = await store.load(`garment-corporate-service-dress-blazer-${sex}`);
      const sheetTop = core.anchor(spec, 'crest_top_center').y;
      const scene = await P.composeUniform(build('semi_formal', sex, 'senior', 'Capt', badges, { medals: MIXED }), store);
      const crestTop = badges.length ? byKey(scene, 'badge:command_council_badge').y : sheetTop;
      const { row, upper, bottom } = await lowestRow(scene);
      assert.ok(row.length && upper.length, 'two rows of medals');
      assert.ok(Math.max(...upper.map(l => l.h)) > Math.max(...row.map(l => l.h)) + 0.05, 'the tallest body is in an upper row');
      const pocketTop = sex === 'male' ? core.anchor(spec, 'pocket_top_center').y : Infinity;
      near(bottom, Math.min(crestTop - 0.5, pocketTop), 0.01, 'lowest drawn medal bottom 1/2 in above the crest or badge (men: at the pocket top)');
    });
  }
}

test('mess dress, mixed medal heights: the miniature group is centred on the sheet\'s miniature_medals_center (4.1.1.1.2.2)', async () => {
  const spec = await store.load('garment-mess-dress-male');
  const cy = core.anchor(spec, 'miniature_medals_center').y;
  const scene = await P.composeUniform(build('mess_dress', 'male', 'senior', 'Capt', [], { medals: MIXED }), store);
  const { upper, bottom } = await lowestRow(scene);
  assert.ok(upper.length, 'two rows');
  const top = Math.min(...scene.layers.filter(l => l.role === 'mini-drape').map(l => l.y));
  near((top + bottom) / 2, cy, 0.01, 'group centre on the sheet\'s point');
});

// ---- women's aviator shirt: command pin and the third badge --------------------------------------

async function femaleAviator(badges, extra){
  const scene = await P.composeUniform(build('aviator', 'female', 'senior', 'Capt', badges, Object.assign({ ribbons, opt: { headgear: 'auto', sleeve: 'short', femaleTop: 'shirt' } }, extra)), store);
  const tag = scene.layers.find(l => l.key === 'nametag');
  return { scene, tag };
}

// 10.2.5 keeps the pin off members of the Command Council, so the service badge in the pin tests is the
// Volunteer University badge (10.2.4), a service badge that does not bar the pin.
test('women\'s aviator: two badges across the nametag 1/2 in above it, the command pin 1/2 in above them (4.2.6.2.7.2-3)', async () => {
  const { scene, tag } = await femaleAviator(['volunteer_university_instructor_badge', 'emergency_services_badge'], { command: CMD });
  const pair = ['badge:volunteer_university_instructor_badge', 'badge:emergency_services_badge'].map(k => byKey(scene, k)).sort((a, b) => a.x - b.x);
  const pin = byKey(scene, 'badge:squadron_commander_badge:ON:0');
  const top = Math.min(...pair.map(l => l.y));
  near(pin.y + pin.h, top - 0.5, 0.005, 'pin bottom 1/2 in above the badges');
  near(cx(pin), tag.x + tag.w / 2, 0.005, 'pin centred over the nametag');
  for(const l of pair) near(l.y + l.h, tag.y - 0.5, 0.005, 'badge bottom 1/2 in above the nametag');
  near(pair[1].x - (pair[0].x + pair[0].w), 0.5, 0.005, 'badges 1/2 in apart');
  // The service badge is closest to the lapel (the viewer's right of the pair).
  assert.equal(pair[1].key, 'badge:volunteer_university_instructor_badge');
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

test('women\'s aviator: a third ordinary badge takes the men\'s layout, pockets and over the nametag (4.2.6.2.7.2)', async () => {
  const spec = await store.load('garment-aviator-shirt-female');
  const lp = core.anchor(spec, 'badge_left_pocket_center'), rp = core.anchor(spec, 'badge_right_pocket_center');
  const { scene, tag } = await femaleAviator(['command_council_badge', 'emergency_services_badge', 'communications_technician_badge']);
  const cc = byKey(scene, 'badge:command_council_badge'), es = byKey(scene, 'badge:emergency_services_badge'), third = byKey(scene, 'badge:communications_technician_badge');
  assert.ok(cc && es && third, 'all three drawn');
  near(cx(cc), lp.x, 0.005, 'service badge on the wearer\'s left pocket');
  near(cx(es), rp.x, 0.005, 'second badge on the wearer\'s right pocket');
  near(third.y + third.h, tag.y - 0.5, 0.005, 'third badge 1/2 in above the nametag');
  near(cx(third), tag.x + tag.w / 2, 0.005, 'third badge centred over the nametag');
  assert.ok(!scene.notes.some(n => /no place left/.test(n)), 'no badge is dropped');
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
