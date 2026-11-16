'use strict';
// The order of badges of equal standing (the member who wears the nurse badge higher, since a collar or lapel is less likely to cut it off). CAPR 39-1
// fixes the chaplain badge highest, the CAP aviation badge above the occupational ones and a military aviation badge below the CAP aviation badge
// (4.1.5.2.2.4.1 and its twins for each uniform and cut, 5.1.1.1.2.4, 5.2.1.1.2.6, 7.1.1.3.1.5.1), and states no order between two CAP occupational
// badges (7.1.1.3.1.5.2 makes them one group): those are the badges the member may swap. The drawing starts from the order of data/badge-catalog.js
// OCCUPATIONAL_PRECEDENCE; the member's order (build.badgeOrder) replaces it. Here: the order function, and the field uniforms (OCP, ABU, corporate field);
// the dress uniforms are in tests/badge-order-dress.test.cjs, the saved setup in tests/badge-order-state.test.cjs, the card in tests/badge-order-card.test.cjs.
// Every number is read off the composed scene, in inches.
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

// ---- the order function ----------------------------------------------------------------------------------------------------------

test('only CAP occupational badges are of equal standing: the chaplain, aviation, specialty, service and military places are fixed by the regulation', () => {
  for(const id of [GT, IC, EMT, NURSE, LEGAL, MED, 'senior_ground_team_badge', 'emt_paramedic']) assert.equal(B.equalGroup(id), 'occupational', id);
  for(const id of [PILOT, 'observer_badge', CHAPLAIN, 'emergency_services_badge', 'command_council_badge', 'national_staff_badge', 'model_rocketry_badge', 'squadron_commander_badge', 'not_a_badge', undefined, null])
    assert.equal(B.equalGroup(id), null, String(id));
  assert.deepEqual(Object.keys(B.EQUAL_STANDING), ['occupational']);
});

test('arrangeEqual: with no choice the list comes back as it was, a copy, whatever the choice says about badges that are not there', () => {
  const list = [{ id: GT }, { id: NURSE }, { id: PILOT }];
  for(const saved of [undefined, null, {}, { occupational: [] }, { occupational: [NURSE] }, { occupational: ['gone_badge', NURSE] }, 'text', [NURSE, GT], { occupational: 'text' }]){
    const out = B.arrangeEqual(list, saved);
    assert.deepEqual(out.map(x => x.id), [GT, NURSE, PILOT], JSON.stringify(saved));
    assert.notEqual(out, list, 'a new list');
  }
  assert.deepEqual(B.arrangeEqual(undefined, ORDER(GT, NURSE)), []);
});

test('arrangeEqual: the badges of equal standing take the member\'s order in the places they hold, and nothing else moves', () => {
  const ids = (list, saved) => B.arrangeEqual(list, saved).map(x => x.id || x);
  assert.deepEqual(ids([GT, NURSE], ORDER(NURSE, GT)), [NURSE, GT]);
  assert.deepEqual(ids([NURSE, GT], ORDER(NURSE, GT)), [NURSE, GT]);
  // The chaplain badge and the aviation badge keep their places between and around them.
  assert.deepEqual(ids([CHAPLAIN, GT, PILOT, NURSE], ORDER(NURSE, GT)), [CHAPLAIN, NURSE, PILOT, GT]);
  // A badge the member has no order for keeps its place; the two that are named trade theirs.
  assert.deepEqual(ids([IC, GT, NURSE], ORDER(NURSE, GT)), [IC, NURSE, GT]);
  assert.deepEqual(ids([IC, GT, NURSE], ORDER(NURSE, IC)), [NURSE, GT, IC]);
  assert.deepEqual(ids([IC, GT, EMT, NURSE], ORDER(NURSE, EMT, GT, IC)), [NURSE, EMT, GT, IC]);
  // Items may be objects or bare ids; the input is not changed.
  const input = [{ id: GT, title: 'Ground Team Badge' }, { id: NURSE, title: 'Nurse Officer Badge' }];
  const out = B.arrangeEqual(input, ORDER(NURSE, GT));
  assert.equal(out[0], input[1]);
  assert.deepEqual(input.map(x => x.id), [GT, NURSE]);
});

test('equalStacks names the groups with two or more badges, highest first as given', () => {
  assert.deepEqual(B.equalStacks([GT, NURSE]), [{ group: 'occupational', label: 'Occupational badges', ids: [GT, NURSE] }]);
  assert.deepEqual(B.equalStacks([{ id: PILOT }, { id: GT }, { id: NURSE }]).map(s => s.ids), [[GT, NURSE]]);
  assert.deepEqual(B.equalStacks([PILOT, GT]), []);
  assert.deepEqual(B.equalStacks([CHAPLAIN, PILOT]), []);
  assert.deepEqual(B.equalStacks(undefined), []);
});

test('moveEqual: one place up or down among the badges as drawn, never past an end, the saved order becomes the drawn one', () => {
  const shown = [GT, NURSE, EMT];
  assert.deepEqual(B.moveEqual({}, 'occupational', shown, NURSE, -1), ORDER(NURSE, GT, EMT));
  assert.deepEqual(B.moveEqual({}, 'occupational', shown, NURSE, 1), ORDER(GT, EMT, NURSE));
  assert.deepEqual(B.moveEqual({}, 'occupational', [GT, NURSE], GT, 1), ORDER(NURSE, GT), 'a swap is the upper badge moving down');
  assert.deepEqual(B.moveEqual({}, 'occupational', [GT, NURSE], NURSE, -1), ORDER(NURSE, GT), 'or the lower badge moving up');
  assert.deepEqual(B.moveEqual({}, 'occupational', shown, GT, -1), {}, 'the highest does not move up');
  assert.deepEqual(B.moveEqual({}, 'occupational', shown, EMT, 1), {}, 'the lowest does not move down');
  assert.deepEqual(B.moveEqual(ORDER(NURSE, GT), 'occupational', [NURSE, GT], GT, -1), ORDER(GT, NURSE), 'back again');
  assert.deepEqual(B.moveEqual({}, 'occupational', shown, PILOT, -1), {}, 'a badge that is not in the stack does not move it');
  assert.deepEqual(B.moveEqual({}, 'occupational', [PILOT, GT], GT, -1), {}, 'nor does one that is not of equal standing');
  const saved = ORDER(NURSE, GT);
  B.moveEqual(saved, 'occupational', [NURSE, GT], GT, -1);
  assert.deepEqual(saved, ORDER(NURSE, GT), 'the old choice is not changed');
});

test('pruneEqual: a choice keeps only badges still held; fewer than two left and the group is dropped, so a badge taken off leaves nothing behind', () => {
  assert.deepEqual(B.pruneEqual(ORDER(NURSE, GT), [GT, NURSE, PILOT]), ORDER(NURSE, GT));
  assert.deepEqual(B.pruneEqual(ORDER(NURSE, GT), [GT, PILOT]), {}, 'the nurse badge is taken off');
  assert.deepEqual(B.pruneEqual(ORDER(NURSE, GT), []), {});
  assert.deepEqual(B.pruneEqual(ORDER(NURSE, GT, EMT), [EMT, NURSE]), ORDER(NURSE, EMT), 'of three, the two left keep the order');
  assert.deepEqual(B.pruneEqual(ORDER(NURSE, GT), [GT, NURSE]), ORDER(NURSE, GT), 'put back, it is not forgotten while it is held');
  // Anything that is not a list of occupational badge ids is dropped, and a bad value never throws.
  for(const bad of [undefined, null, 'text', 7, [], [NURSE, GT], { other: [NURSE, GT] }, { occupational: 'text' }, { occupational: [7, {}, null] }, { occupational: [PILOT, CHAPLAIN] }, { occupational: [NURSE, NURSE] }])
    assert.deepEqual(B.pruneEqual(bad, [NURSE, GT, PILOT, CHAPLAIN]), {}, JSON.stringify(bad));
  assert.deepEqual(B.pruneEqual({ occupational: [NURSE, NURSE, GT], other: [GT] }, [NURSE, GT]), ORDER(NURSE, GT), 'a repeated badge counts once');
  assert.notEqual(B.pruneEqual(ORDER(NURSE, GT), [NURSE, GT]).occupational, ORDER(NURSE, GT).occupational);
});

// ---- field uniforms ----------------------------------------------------------------------------------------------------------------------

for(const uniform of FIELD) for(const gender of ['male', 'female']){
  test(`${uniform} ${gender}: two occupational badges above the CAP tape follow the member's order, 1/2 in apart (7.1.1.3.1.2, 5.1.1.1.2.4, 5.2.1.1.2.6)`, async () => {
    const plain = await compose(build(uniform, gender, [GT, NURSE]));
    const sameOrder = await compose(build(uniform, gender, [GT, NURSE], ORDER(GT, NURSE)));
    same(sameOrder.layers, plain.layers, 'the order the badges were chosen in is the default');
    const swapped = await compose(build(uniform, gender, [GT, NURSE], ORDER(NURSE, GT)));
    assert.deepEqual(drawn(plain), [GT, NURSE]);
    assert.deepEqual(drawn(swapped), [NURSE, GT]);
    const [hi, lo] = drawn(swapped).map(id => layer(swapped, id));
    assert.ok(Math.abs((hi.x + hi.w / 2) - (lo.x + lo.w / 2)) < 0.01, 'centred on each other');
    assert.ok(lo.y > hi.y + hi.h, 'one above the other');
    const tape = swapped.layers.find(l => l.role === 'tape' || /tape/.test(l.key || ''));
    assert.ok(tape, 'the tape is drawn');
    assert.equal(swapped.badgeOrders.length, 1);
    assert.deepEqual(swapped.badgeOrders[0].badges.map(b => b.id), [NURSE, GT]);
    assert.equal(swapped.badgeOrders[0].place, 'above the CAP tape');
    assert.equal(swapped.badgeOrders[0].ref, uniform === 'ocp' ? '7.1.1.3.1.5.2' : uniform === 'abu' ? '5.1.1.1.2.4' : '5.2.1.1.2.6');
    // The aviation badge stays above the occupational ones (7.1.1.3.1.5.1, 5.1.1.1.2.4) and the chaplain badge highest (5.1.1.1.2.4, 5.2.1.1.2.6).
    const fixed = await compose(build(uniform, gender, [GT, PILOT], ORDER(NURSE, GT)));
    assert.deepEqual(drawn(fixed), [PILOT, GT]);
    assert.deepEqual(fixed.badgeOrders, []);
  });
}

test('OCP: three or four badges, the aviation badge first and the occupational badges in the member\'s order; the report lists the occupational ones only', async () => {
  const ids = [IC, GT, NURSE];
  const plain = await compose(build('ocp', 'male', [PILOT, ...ids]));
  const mine = await compose(build('ocp', 'male', [PILOT, ...ids], ORDER(NURSE, IC, GT)));
  const keyed = scene => scene.layers.filter(l => l.role === 'badge').map(l => [l.key.replace(/^badge:/, ''), +l.x.toFixed(2), +l.y.toFixed(2)]);
  // The default is the order chosen: aviation first, then the others as listed.
  assert.deepEqual(plain.badgeOrders[0].badges.map(b => b.id), [IC, GT, NURSE]);
  assert.deepEqual(mine.badgeOrders[0].badges.map(b => b.id), [NURSE, IC, GT]);
  // The aviation badge is still the highest of the four (7.1.1.3.1.5.1), and the occupational badges changed places among themselves.
  // (The four are two columns of two: the aviation badge is the first of the top row, the viewer's left, whoever the others are.)
  for(const scene of [plain, mine]) assert.equal(Math.min(...scene.layers.filter(l => l.role === 'badge').map(l => l.x)), layer(scene, PILOT).x, 'the aviation badge is first, on the viewer\'s left');
  assert.notDeepEqual(keyed(plain), keyed(mine), 'the occupational badges changed places');
  assert.equal(keyed(plain).length, 4);
  assert.equal(mine.badgeOrders[0].badges.length, 3);
  const four = await compose(build('ocp', 'male', [PILOT, ...ids], ORDER(NURSE, IC, GT), { opt: { badgeLayout: 'pair' } }));
  assert.deepEqual(four.badgeOrders[0].badges.map(b => b.id), [NURSE, IC, GT], 'the other layout of the same four reports the same order');
});

test('the ABU and the corporate field uniform wear two badges: the member\'s order also decides which two when more are chosen, as the order chosen did', async () => {
  for(const uniform of ['abu', 'corporate_field']){
    const plain = await compose(build(uniform, 'male', [GT, EMT, NURSE]));
    assert.deepEqual(drawn(plain), [GT, EMT]);
    const mine = await compose(build(uniform, 'male', [GT, EMT, NURSE], ORDER(NURSE, GT)));
    assert.deepEqual(drawn(mine), [NURSE, EMT], `${uniform}: the nurse badge takes the place the Ground Team badge held`);
  }
});

