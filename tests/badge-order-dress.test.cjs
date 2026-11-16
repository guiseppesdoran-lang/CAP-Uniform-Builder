'use strict';
// Two badges of equal standing on the dress uniforms (Class A, Class B, the cadet semi-formal, the aviator shirt, the mess dress; both cuts): the member's
// order (build.badgeOrder) puts either one higher, and where CAPR 39-1 fixes the order (the chaplain badge highest, the aviation badge above the occupational
// one, 4.1.5.2.2.4.1 and its twins for each uniform and cut) the choice changes nothing and no swap is reported. The order function and the field uniforms are
// in tests/badge-order.test.cjs. Every number is read off the composed scene, in inches.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const B = require('../data/badge-catalog.js');
const HARNESS = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

const IC = 'basic_incident_commander_badge', GT = 'ground_team_basic_badge', EMT = 'emt_basic_badge', NURSE = 'nurse_officer', LEGAL = 'legal_officer', MED = 'medical_officer';
const PILOT = 'CAPPilot1_FA9D33EA587D8', CHAPLAIN = 'christian_chaplin';
const ORDER = (...ids) => ({ occupational: ids });

function build(uniform, gender, badgeIds, order, extra){
  return Object.assign(HARNESS.makeBuild(Object.assign({ uniform, gender, membership: 'senior', rank: 'Capt', badgeIds }, extra || {})), order === undefined ? {} : { badgeOrder: order });
}
const compose = b => P.composeUniform(b, store);
const layer = (scene, id) => scene.layers.find(l => l.key === 'badge:' + id);
const orderOf = scene => scene.badgeOrders.map(e => e.badges.map(b => b.id));
// The badges the scene draws, highest first.
const drawn = scene => scene.layers.filter(l => l.role === 'badge').sort((a, b) => a.y - b.y).map(l => l.key.replace(/^badge:/, ''));

// Two scenes' layers, compared as text so a failure names the case and does not print the whole sheet.
const same = (a, b, message) => assert.ok(JSON.stringify(a) === JSON.stringify(b), message);

const DRESS = ['blues_a', 'blues_b', 'aviator', 'semi_formal_usaf', 'mess_dress'];
const FIELD = ['ocp', 'abu', 'corporate_field'];

// ---- the drawing: dress uniforms, both cuts -------------------------------------------------------------------------------------------

for(const uniform of DRESS) for(const gender of ['male', 'female']){
  test(`${uniform} ${gender}: with no choice the two occupational badges are drawn as before; the choice puts either one higher, 1/2 in apart and centred on each other`, async () => {
    const plain = await compose(build(uniform, gender, [NURSE, GT]));
    const empty = await compose(build(uniform, gender, [NURSE, GT], {}));
    same(empty.layers, plain.layers, 'an empty choice draws what no choice draws');
    assert.deepEqual(drawn(plain), [GT, NURSE], 'the Ground Team badge is higher by the catalog\'s order, as it was');
    for(const listed of [[NURSE, GT], [GT, NURSE]]){
      const nurseUp = await compose(build(uniform, gender, listed, ORDER(NURSE, GT)));
      const gtUp = await compose(build(uniform, gender, listed, ORDER(GT, NURSE)));
      assert.deepEqual(drawn(nurseUp), [NURSE, GT], `${listed}: the nurse badge is worn higher when the member says so`);
      assert.deepEqual(drawn(gtUp), [GT, NURSE]);
      for(const scene of [plain, nurseUp, gtUp]){
        const [hi, lo] = drawn(scene).map(id => layer(scene, id));
        assert.ok(Math.abs((lo.y - (hi.y + hi.h)) - 0.5) < 0.02, `${(lo.y - hi.y - hi.h).toFixed(3)} in between the two`);
        assert.ok(Math.abs((hi.x + hi.w / 2) - (lo.x + lo.w / 2)) < 0.01, 'centred on each other');
      }
      assert.deepEqual(nurseUp.notes, plain.notes, 'the same notes: nothing new is said about the stack');
    }
  });

  test(`${uniform} ${gender}: the drawing reports the stack with the badges as drawn and the paragraph; the page offers the swap from that report`, async () => {
    const scene = await compose(build(uniform, gender, [GT, NURSE], ORDER(NURSE, GT)));
    assert.equal(scene.badgeOrders.length, 1);
    const e = scene.badgeOrders[0];
    assert.equal(e.group, 'occupational');
    assert.deepEqual(e.badges.map(b => b.id), [NURSE, GT], 'highest first, as drawn');
    assert.equal(e.swap, true);
    assert.equal(e.why, '');
    assert.match(e.ref, /^4\.\d+(\.\d+)+$/, 'the paragraph of the stack');
    assert.equal(e.ref, P.helpers.oneAviationBadgeParagraph(build(uniform, gender, [])), 'the stack paragraph of this uniform and cut');
    assert.match(e.place, /left pocket|medals/);
  });
}

// A Colonel's ribbons in precedence order (the audit's full rack of tests/engine-badge-top-row.test.cjs), one award each.
const RACK = ['air_medal', 'air_force_aerial_achievement_medal', 'Air_Force_Organizational_Excellence_Award', 'distinguished_service_award', 'exceptional_service_award', 'meritorious_service_award', 'commander_commendation_award', 'cap_achievment_award', 'lifesaving_award', 'air_search_and_rescue_ribbon', 'search_find_ribbon', 'disaster_relief_ribbon', 'cap_counterdrug_ribbon', 'homeland_security_ribbon', 'cap_cadet_orientation_pilot_ribbon', 'cap_gill_robb_wilson_ribbon', 'cap_command_service_ribbon', 'cap_leadership_ribbon', 'red_service_ribbon', 'cap_senior_recruiter_ribbon', 'iace_ribbon', 'unit_citation_award', 'national_commander_unit_citation_award', 'bronze_medal_of_valor', 'encampment_ribbon', 'community_service_ribbon', 'cap_membership_ribbon', 'cap_paul_e_garber_ribbon'];
const rack = n => ({ rank: 'Col', ribbonSel: RACK.slice(0, n).map(id => [id]) });

test('the stack sits 1/2 in above the highest row of ribbons in either order (4.1.5.2.2.4.1, 4.1.9.4.4.1), and the same rule lowers it when the rack is too tall', async () => {
  const tops = {};
  for(const [uniform, gender] of [['blues_a', 'male'], ['blues_a', 'female'], ['blues_b', 'male'], ['aviator', 'female']]){
    for(const order of [undefined, ORDER(NURSE, GT), ORDER(GT, NURSE)]){
      const scene = await compose(build(uniform, gender, [GT, NURSE], order, rack(13)));
      const rows = scene.layers.filter(l => l.role === 'ribbon');
      assert.ok(rows.length, `${uniform} ${gender}: ribbons drawn`);
      const top = Math.min(...rows.map(l => l.y)), low = drawn(scene).map(id => layer(scene, id)).pop();
      assert.ok(Math.abs(top - (low.y + low.h) - 0.5) < 0.02, `${uniform} ${gender} ${JSON.stringify(order)}: the lower badge is 1/2 in above the ribbons (${(top - low.y - low.h).toFixed(3)})`);
      // Standing on the ribbons the stack is as tall in either order: it reaches as high as it did.
      const heights = drawn(scene).map(id => layer(scene, id));
      const reach = Math.min(...heights.map(l => l.y));
      tops[`${uniform} ${gender}`] = tops[`${uniform} ${gender}`] || reach;
      assert.ok(Math.abs(reach - tops[`${uniform} ${gender}`]) < 0.011, `${uniform} ${gender} ${JSON.stringify(order)}: the stack reaches as high as in the default order`);
    }
  }
  // A rack tall enough to push the stack down the sheet's seam: the scene says so, whichever order, and neither order gets better, so the swap is offered.
  const a = await compose(build('blues_a', 'female', [GT, NURSE], undefined, rack(28)));
  const b = await compose(build('blues_a', 'female', [GT, NURSE], ORDER(NURSE, GT), rack(28)));
  assert.ok(a.notes.some(t => /too tall for the badge to sit 1\/2 in above/.test(t)), 'the tall rack is noted');
  assert.deepEqual(b.notes, a.notes, 'the same note in the other order');
  assert.deepEqual(drawn(b), [NURSE, GT]);
  assert.ok(b.badgeOrders[0].swap);
  for(const scene of [a, b]) for(const id of [GT, NURSE]) assert.ok(layer(scene, id).y > 0, 'on the sheet');
});

test('when the other order would not stay on the garment the stack is reported with no swap and the reason, with the paragraph', async () => {
  // The two badges of a stack need not be the same width: a strip of the garment (a shoulder board, here) that the wider badge would reach only
  // in one order. The stack's own order is kept, and says why.
  const items = [{ id: GT, art: 'narrow', title: 'Ground Team Badge' }, { id: NURSE, art: 'wide', title: 'Nurse Officer Badge' }];   // bottom first
  const sizes = { narrow: { w: 1, h: 1 }, wide: { w: 3, h: 1 } };
  const ctx = { spec: async art => sizes[art], badgeOrders: [] };
  const strip = [{ x: 8.6, y: 8.6 }, { x: 8.9, y: 8.6 }, { x: 8.9, y: 9.4 }, { x: 8.6, y: 9.4 }];
  const limit = { limits: { ring: null, strips: [strip], minBottom: null }, cite: '4.1.9.4.4.1' };
  const b = { uniform: 'blues_a', gender: 'female' };
  await P.helpers.olpOrderReport(ctx, b, items, 'over the left pocket', { x: 10, bottom: 10, gap: 0.5, limit });
  const e = ctx.badgeOrders[0];
  assert.equal(e.swap, false);
  assert.match(e.why, /^Swapped, the two badges would reach the shoulder board, so they stay in this order \(CAPR 39-1, 4\.1\.9\.4\.4\.1\)$/);
  assert.deepEqual(e.badges.map(x => x.id), [NURSE, GT], 'still reported, highest first');
  // The same stack with room to swap, or with nothing limiting it, is offered.
  for(const stack of [{ x: 10, bottom: 10, gap: 0.5, limit: null }, null, { x: 20, bottom: 10, gap: 0.5, limit }]){
    const c2 = { spec: ctx.spec, badgeOrders: [] };
    await P.helpers.olpOrderReport(c2, b, items, 'over the left pocket', stack);
    assert.equal(c2.badgeOrders[0].swap, true, JSON.stringify(stack && stack.x));
    assert.equal(c2.badgeOrders[0].why, '');
  }
  // The strip is reached in the stack's own order and not the other: nothing to refuse.
  const c3 = { spec: ctx.spec, badgeOrders: [] };
  await P.helpers.olpOrderReport(c3, b, [...items].reverse(), 'over the left pocket', { x: 10, bottom: 10, gap: 0.5, limit });
  assert.equal(c3.badgeOrders[0].swap, true, 'the order that touches the strip is the one now drawn; the other fits');
});

// ---- where the regulation fixes the order, nothing is offered -------------------------------------------------------------------------

for(const uniform of DRESS) for(const gender of ['male', 'female']){
  test(`${uniform} ${gender}: the chaplain badge is highest and the aviation badge is above the occupational badge, whatever the member's order says; no swap is reported for them`, async () => {
    const order = ORDER(NURSE, GT);
    const aviation = await compose(build(uniform, gender, [GT, PILOT], order));
    assert.deepEqual(drawn(aviation), [PILOT, GT], 'aviation above occupational');
    assert.deepEqual(aviation.badgeOrders, [], 'one occupational badge: nothing to swap');
    const chaplain = await compose(build(uniform, gender, [GT, CHAPLAIN], order));
    assert.deepEqual(drawn(chaplain), [CHAPLAIN, GT], 'the chaplain badge is highest');
    assert.deepEqual(chaplain.badgeOrders, []);
    // Both occupational badges and an aviation badge: two places, so the aviation badge and the first of the two in the member's order.
    const three = await compose(build(uniform, gender, [GT, NURSE, PILOT], order));
    assert.equal(drawn(three)[0], PILOT, 'the aviation badge stays on top');
    assert.deepEqual(drawn(three), [PILOT, NURSE], 'the member\'s order picks the occupational badge that fits beside it');
    assert.deepEqual(three.badgeOrders, [], 'a stack of one aviation and one occupational badge has no pair to swap');
  });
}

test('two badges that are not both occupational are never offered a swap: aviation with chaplain, specialty badges, the service badge', async () => {
  for(const ids of [[PILOT, CHAPLAIN], ['emergency_services_badge', 'communications_technician_badge'], ['command_council_badge', 'emergency_services_badge'], [PILOT, 'observer_badge']]){
    for(const uniform of ['blues_a', 'blues_b', 'ocp']){
      const scene = await compose(build(uniform, 'male', ids, ORDER(NURSE, GT)));
      assert.deepEqual(scene.badgeOrders, [], `${uniform} ${ids}`);
    }
  }
});

test('more occupational badges than the two places over the pocket: the member still picks which two, and the two kept follow his order', async () => {
  const none = await compose(build('blues_a', 'male', [GT, EMT, LEGAL]));
  assert.deepEqual(drawn(none), [GT, EMT]);
  assert.ok(none.conflicts.some(c => c.position === 'over-pocket'), 'the chooser is still there');
  const swapped = await compose(build('blues_a', 'male', [GT, EMT, LEGAL], ORDER(EMT, GT)));
  assert.deepEqual(drawn(swapped), [EMT, GT]);
  assert.deepEqual(orderOf(swapped), [[EMT, GT]]);
  assert.ok(swapped.conflicts.some(c => c.position === 'over-pocket'));
  const picked = await compose(build('blues_a', 'male', [GT, EMT, LEGAL], ORDER(EMT, GT), { badgeChoices: { 'over-pocket': { first: LEGAL, second: GT } } }));
  assert.deepEqual(new Set(drawn(picked)), new Set([LEGAL, GT]), 'a pick in the chooser is honoured');
});

test('a choice about badges the build does not hold changes nothing', async () => {
  const plain = await compose(build('blues_a', 'male', [GT, IC]));
  const stale = await compose(build('blues_a', 'male', [GT, IC], ORDER(NURSE, LEGAL)));
  same(stale.layers, plain.layers, 'a choice about badges that are not held draws nothing different');
  const one = await compose(build('blues_a', 'male', [NURSE], ORDER(NURSE, GT)));
  assert.deepEqual(one.badgeOrders, []);
});

test('the corporate blazers, the flight suits and the polo wear no stack of occupational badges: no swap is reported there', async () => {
  for(const uniform of ['semi_formal', 'flight_suit', 'corporate_flight_suit', 'polo']){
    for(const gender of ['male', 'female']){
      const scene = await compose(build(uniform, gender, [GT, NURSE], ORDER(NURSE, GT)));
      assert.deepEqual(scene.badgeOrders, [], `${uniform} ${gender}`);
    }
  }
  const blazer = await compose(build('aviator_blazer', 'male', [GT, NURSE], ORDER(NURSE, GT)));
  assert.equal(blazer.badgeOrders.length, 1, 'the shirt beside the blazer wears the stack, so it is the one reported');
  assert.deepEqual(drawn(blazer), [NURSE, GT], 'and drawn in the member\'s order');
  const plain = await compose(build('aviator_blazer', 'male', [GT, NURSE]));
  assert.deepEqual(drawn(plain), [GT, NURSE]);
});

// ---- the choice never touches the other things on the uniform -----------------------------------------------------------------------

test('a choice about two occupational badges leaves every other layer of the scene where it was', async () => {
  for(const [uniform, gender] of [['blues_a', 'female'], ['blues_b', 'male'], ['mess_dress', 'female'], ['ocp', 'male']]){
    const plain = await compose(build(uniform, gender, [GT, NURSE, 'emergency_services_badge'], undefined, { ribbonSel: HARNESS.MEMBERS[3].ribbons.slice(0, 5) }));
    const mine = await compose(build(uniform, gender, [GT, NURSE, 'emergency_services_badge'], ORDER(NURSE, GT), { ribbonSel: HARNESS.MEMBERS[3].ribbons.slice(0, 5) }));
    const rest = scene => scene.layers.filter(l => !GT_NURSE.test(l.key || '') && l.role !== 'measure');
    same(rest(mine), rest(plain), `${uniform} ${gender}: every layer but the two badges and the dimension lines between them is where it was`);
  }
});
const GT_NURSE = new RegExp(`^badge:(${GT}|${NURSE})$`);
