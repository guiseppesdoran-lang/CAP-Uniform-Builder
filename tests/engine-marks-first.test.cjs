'use strict';
// The NRA marksmanship badge is the first badge of the specialty, STEM and Cyber group (the owner's ruling on CAPR 39-1 4.1.5.2.2.4.2, 2026-11-13: "the nra badge will always be the first
// badge, and with the exception of the rocketry badge, nothing goes under it"). It takes the wearer's left, where it is drawn (on the welt pocket of the Class A coat, on the top edge of
// the left pocket flap of the Class B and the aviator shirt); the others take the place on the wearer's right and the place over the nametag, in the order they had; only the model
// rocketry badge goes under it, on the left pocket, and the marksmanship badge is drawn over it where they touch. The limit of four counts it. A badge left with no place is not drawn
// and its reason (the rule and the paragraph) is the one the Badges list says when it is tapped. The same on the men's Class A, the cadet semi-formal, the men's Class B and the men's
// aviator shirt (4.1.5.2.2.4.2, 4.1.11.1.1.2.3.2, 4.2.5.1.3.2); the women's paragraphs give the badge other places and are left as they were. Without a marksmanship badge nothing changes.
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
require('../js/engine/profiles-polo.js');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const MARKS = 'nra_marksman_badge', STEM = 'stem_badges', ROCKET = 'model_rocketry_badge', ES = 'emergency_services_badge', COMMS = 'communications_technician_badge', IT = 'information_technology_technician_badge';

const build = (uniform, gender, ids, cadet = true) => ({
  uniform, gender, grade: cadet ? G.gradeInfo('cadet', 'C/Col', {}) : G.gradeInfo('senior', 'Capt', {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
  ribbons: [], medals: [], badges: ids.map(id => ({ id, title: id })), command: null, militaryBadges: [], patches: [], cord: null, membership: cadet ? 'cadet' : 'senior'
});
const idx = (scene, id) => scene.layers.findIndex(l => l.role === 'badge' && new RegExp(`^badge:${id}(:|$)`).test(l.key));
const box = (scene, id) => core.layerBounds(scene.layers[idx(scene, id)]);
const drawn = (scene, id) => idx(scene, id) >= 0;
const cx = (scene, id) => { const b = box(scene, id); return b.x + b.w / 2; };
const compose = (uniform, gender, ids, cadet) => P.composeUniform(build(uniform, gender, ids, cadet), store);
// The side a badge sits on: the wearer's left is the right of the picture, so the left pocket's column is the larger x.
const sideOf = (scene, id, leftX) => Math.abs(cx(scene, id) - leftX) < 1 ? 'left' : 'not-left';

// ---- the men's Class A coat (4.1.5.2.2.4.2) ---------------------------------------------------------------------------------------
test('men\'s Class A: marksmanship and STEM: the marksmanship badge is on the left, the STEM badge in the second place on the right, 1 1/2 in below the nametag; nothing is under the marksmanship badge', async () => {
  const scene = await compose('blues_a', 'male', [MARKS, STEM]);
  const spec = await store.load('garment-blues-class-a-coat');
  const welt = spec.landmarks.welt_pocket, plate = spec.landmarks.nameplate;
  assert.ok(drawn(scene, MARKS) && drawn(scene, STEM));
  assert.equal(sideOf(scene, MARKS, welt.x + welt.w / 2), 'left', 'the marksmanship badge holds the wearer\'s left, on the welt pocket');
  assert.equal(sideOf(scene, STEM, welt.x + welt.w / 2), 'not-left', 'the STEM badge is not on the left');
  assert.equal(scene.layers[idx(scene, MARKS)].place, 'on the welt pocket', 'said in words, as the Badges list reads it');
  assert.ok(Math.abs(box(scene, STEM).y - (plate.y + plate.h + 1.5)) < 0.05, 'the STEM badge is 1 1/2 in below the nametag, the second place');
  assert.ok(Math.abs(cx(scene, STEM) - (plate.x + plate.w / 2)) < 0.3, 'on the wearer\'s right, in the nametag\'s column');
  const left = scene.layers.filter(l => l.role === 'badge' && Math.abs(core.layerBounds(l).x + core.layerBounds(l).w / 2 - (welt.x + welt.w / 2)) < 1);
  assert.equal(left.length, 1, 'the marksmanship badge is alone on the left');
  assert.deepEqual(scene.conflicts.filter(c => c.position === 'pocket').map(c => c.candidates.map(x => x.id)), [], 'the marksmanship badge is not one the member chooses a place for: it is the first');
});

test('men\'s Class A: marksmanship, STEM and one specialty badge: the STEM badge on the right, the specialty badge over the nametag, the third place; all three drawn', async () => {
  const scene = await compose('blues_a', 'male', [MARKS, STEM, ES]);
  const spec = await store.load('garment-blues-class-a-coat'), welt = spec.landmarks.welt_pocket, plate = spec.landmarks.nameplate;
  for(const id of [MARKS, STEM, ES]) assert.ok(drawn(scene, id), id);
  assert.equal(sideOf(scene, MARKS, welt.x + welt.w / 2), 'left');
  assert.ok(Math.abs(box(scene, STEM).y - (plate.y + plate.h + 1.5)) < 0.05, 'the second place: on the right below the nametag');
  assert.ok(Math.abs(box(scene, ES).y + box(scene, ES).h - (plate.y - 0.5)) < 0.05, 'the third place: 1/2 in above the nametag');
});

test('men\'s Class A: marksmanship, STEM and two specialty badges: three are drawn (the limit of four counts the marksmanship badge, and the left is its), the fourth is left off with the rule and its paragraph, and the Badges list says so when it is tapped', async () => {
  const scene = await compose('blues_a', 'male', [MARKS, STEM, ES, COMMS]);
  assert.ok(drawn(scene, MARKS) && drawn(scene, STEM) && drawn(scene, ES));
  assert.ok(!drawn(scene, COMMS), 'the badge with no place is not drawn');
  const conflict = scene.conflicts.find(c => c.position === 'pocket');
  assert.deepEqual(conflict.candidates.map(x => x.id), [STEM, ES, COMMS]);
  assert.deepEqual(conflict.shown, [STEM, ES]);
  const WHY = 'With the marksmanship badge worn, the others take the right and over the name tag, and only the model rocketry badge goes under it (CAPR 39-1, 4.1.5.2.2.4.2)';
  assert.equal(conflict.why, WHY, 'the rule and its paragraph, nothing else');
  assert.doesNotMatch(conflict.why, /ruling|member|owner/i);
  // The page's list: the badge is chosen and left off, with that reason (its tile is dim and a tap says it, js/pick-lists.js).
  const { context } = loadPageScripts();
  context.__scene = scene;
  vm.runInContext(`State.membership = 'cadet'; State.rank = 'C/Col'; State.gender = 'male'; State.uniform = 'blues_a'; State.garment = {}; State.militaryBadges = {}; State.badgeSelections = {}; State.badges = ${JSON.stringify([MARKS, STEM, ES, COMMS])}`, context);
  const rows = JSON.parse(vm.runInContext('JSON.stringify(capubBadgeSummary(__scene))', context));
  const row = rows.find(r => r.id === COMMS);
  assert.equal(row.shown, false);
  assert.equal(row.why, WHY);
  assert.ok(rows.filter(r => r.id !== COMMS).every(r => r.shown), 'the other three are drawn');
});

test('men\'s Class A: marksmanship and model rocketry: the rocketry badge stays on the left pocket under the marksmanship badge, which is drawn over it', async () => {
  const scene = await compose('blues_a', 'male', [MARKS, ROCKET]);
  assert.ok(drawn(scene, MARKS) && drawn(scene, ROCKET));
  assert.ok(Math.abs(cx(scene, MARKS) - cx(scene, ROCKET)) < 0.05, 'both on the left, one column');
  assert.ok(box(scene, ROCKET).y > box(scene, MARKS).y, 'the rocketry badge is under the marksmanship badge');
  assert.ok(idx(scene, MARKS) > idx(scene, ROCKET), 'the marksmanship badge is drawn after, so it lies over the rocketry badge where they touch');
});

test('men\'s Class A: marksmanship, rocketry and STEM: the rocketry badge under the marksmanship badge on the left, the STEM badge on the right', async () => {
  const scene = await compose('blues_a', 'male', [MARKS, ROCKET, STEM]);
  const spec = await store.load('garment-blues-class-a-coat'), welt = spec.landmarks.welt_pocket, plate = spec.landmarks.nameplate;
  for(const id of [MARKS, ROCKET, STEM]) assert.ok(drawn(scene, id), id);
  assert.equal(sideOf(scene, MARKS, welt.x + welt.w / 2), 'left');
  assert.equal(sideOf(scene, ROCKET, welt.x + welt.w / 2), 'left');
  assert.ok(box(scene, ROCKET).y > box(scene, MARKS).y && idx(scene, MARKS) > idx(scene, ROCKET));
  assert.equal(sideOf(scene, STEM, welt.x + welt.w / 2), 'not-left');
  assert.ok(Math.abs(box(scene, STEM).y - (plate.y + plate.h + 1.5)) < 0.05);
});

test('men\'s Class A: the STEM badge alone, or with specialty badges and no marksmanship badge, is as it was: the first on the left 1 1/2 in below the top of the welt pocket, the second on the right, the third over the nametag', async () => {
  const spec = await store.load('garment-blues-class-a-coat'), welt = spec.landmarks.welt_pocket;
  const alone = await compose('blues_a', 'male', [STEM]);
  assert.equal(sideOf(alone, STEM, welt.x + welt.w / 2), 'left');
  assert.ok(Math.abs(box(alone, STEM).y - (welt.y + 1.5)) < 0.05);
  const three = await compose('blues_a', 'male', [STEM, ES, COMMS]);
  assert.equal(sideOf(three, STEM, welt.x + welt.w / 2), 'left');
  assert.equal(sideOf(three, ES, welt.x + welt.w / 2), 'not-left');
  assert.ok(drawn(three, COMMS));
});

test('men\'s Class A, a senior member: no marksmanship badge is worn (cadets only), and the specialty badges take the first place on the left, the second on the right, the third over the nametag as they did', async () => {
  const scene = await compose('blues_a', 'male', [ES, COMMS, IT], false);
  const spec = await store.load('garment-blues-class-a-coat'), welt = spec.landmarks.welt_pocket, plate = spec.landmarks.nameplate;
  for(const id of [ES, COMMS, IT]) assert.ok(drawn(scene, id), id);
  assert.equal(sideOf(scene, ES, welt.x + welt.w / 2), 'left');
  assert.ok(Math.abs(box(scene, ES).y - (welt.y + 1.5)) < 0.05);
  assert.ok(Math.abs(box(scene, COMMS).y - (plate.y + plate.h + 1.5)) < 0.05);
  assert.ok(Math.abs(box(scene, IT).y + box(scene, IT).h - (plate.y - 0.5)) < 0.05);
});

// ---- the other men's layouts with the same words: the cadet semi-formal (worn as the Class A), the Class B (4.1.11.1.1.2.3.2) and the aviator shirt (4.2.5.1.3.2) --------------------
for(const [uniform, paragraph] of [['semi_formal_usaf', '4.1.5.2.2.4.2'], ['blues_b', '4.1.11.1.1.2.3.2'], ['aviator', '4.2.5.1.3.2']]){
  test(`${uniform}, men: the marksmanship badge is first on the left, the STEM badge second on the right, a specialty badge third over the nametag, the rocketry badge under it, one left off with the rule`, async () => {
    const three = await compose(uniform, 'male', [MARKS, STEM, ES]);
    for(const id of [MARKS, STEM, ES]) assert.ok(drawn(three, id), `${uniform}: ${id}`);
    assert.ok(cx(three, MARKS) > cx(three, STEM) + 3, 'the marksmanship badge is on the wearer\'s left (the right of the picture), the STEM badge on the right');
    assert.ok(box(three, ES).y < box(three, STEM).y, 'the specialty badge is over the nametag, above the STEM badge');
    const four = await compose(uniform, 'male', [MARKS, STEM, ES, COMMS]);
    assert.ok(!drawn(four, COMMS) && drawn(four, MARKS) && drawn(four, STEM) && drawn(four, ES), `${uniform}: the fourth is not drawn`);
    assert.match(four.conflicts.find(c => c.position === 'pocket').why, new RegExp(`only the model rocketry badge goes under it \\(CAPR 39-1, ${paragraph.replace(/\./g, '\\.')}\\)$`));
    const rocket = await compose(uniform, 'male', [MARKS, ROCKET, STEM]);
    for(const id of [MARKS, ROCKET, STEM]) assert.ok(drawn(rocket, id), `${uniform}: ${id}`);
    assert.ok(Math.abs(cx(rocket, MARKS) - cx(rocket, ROCKET)) < 0.05 && box(rocket, ROCKET).y > box(rocket, MARKS).y, 'rocketry under the marksmanship badge on the left');
    assert.ok(idx(rocket, MARKS) > idx(rocket, ROCKET), 'the marksmanship badge lies over');
    const stemAlone = await compose(uniform, 'male', [STEM]);
    assert.ok(cx(stemAlone, STEM) > 12, 'the STEM badge alone is the first badge, on the left pocket, as before');
  });
}

// ---- left as they were ------------------------------------------------------------------------------------------------------------------------------------
test('the women\'s uniforms keep the places their paragraphs give: the marksmanship badge is not made the first badge there (CAPR 39-1, 4.1.9.4.4.2, 4.1.12.2.5.2, 4.2.6.2.7.2)', async () => {
  const scene = await compose('blues_a', 'female', [MARKS, STEM, ES]);
  for(const id of [MARKS, STEM, ES]) assert.ok(drawn(scene, id), id);
  // The specialty badges are side by side over the nametag, and the marksmanship badge is on the left, 1 1/2 in below the ribbons, as the paragraph says when other badges are over the nametag.
  assert.ok(box(scene, STEM).y < 10 && box(scene, ES).y < 10, 'two over the nametag');
  assert.ok(cx(scene, MARKS) > 12 && box(scene, MARKS).y > 10, 'the marksmanship badge on the wearer\'s left, below');
});
