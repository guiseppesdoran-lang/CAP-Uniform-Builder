'use strict';
// The order of badges of equal standing is chosen by picture. Each order a stack may take is the member's own uniform as the engine draws it with that order for the group
// (js/option-pictures.js, the recipe badgeOrder, asked for by "badgeOrder:<group>" with the orders as values), in a window round the stack; the whole order picked is saved by the
// catalog's setEqual. The recipe is run against the real engine and the page's own state.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument } = require('./helpers/mini-dom.cjs');
global.document = createDocument();
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/awards.js');
require('../js/engine/grades.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const OP = require('../js/option-pictures.js');
const Catalog = require('../data/badge-catalog.js');
const BadgeOrder = require('../js/badge-order.js');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));
const { context } = loadPageScripts();
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context));
const env = {
  core, compose: b => P.composeUniform(b, store), spec: id => store.load(id), entry: id => store.entry(id), url: p => 'images/' + p, empty: () => '<svg id="empty"></svg>',
  draw: async scene => ({ scene }), build: () => run('return CAPUBUniformView.buildFromState();')
};
const GT = 'ground_team_basic_badge', NURSE = 'nurse_officer', EMT = 'emt_basic_badge';
const member = (uniform, badges) => run(`
  State.membership = 'senior'; State.uniform = ${JSON.stringify(uniform)}; State.gender = 'male'; State.rank = 'Capt'; State.garment = {};
  State.badges = ${JSON.stringify(badges)}; State.badgeSelections = {}; for(const id of State.badges) State.badgeSelections[id] = { checked: true }; State.badgeOrder = {}; return State.badges.length;`);
const badgeLayers = (layers, id) => layers.filter(l => l.role === 'badge' && String(l.key).split(':')[1] === id);
const near = (a, b) => Math.abs(a - b) < 0.002;
const topOf = (layers, id) => core.layerBounds(badgeLayers(layers, id)[0]).y;

test('each order of a pair is the uniform as the engine draws it with that order, in a window centred on the stack; the higher badge is the one drawn higher', async () => {
  member('blues_a', [GT, NURSE]);
  const build = env.build();
  const orders = BadgeOrder.orders([GT, NURSE]).map(o => o.join(','));
  const made = await OP.RECIPES.badgeOrder.make(env, build, orders, 'occupational');
  for(const v of orders){
    assert.ok(made[v] && made[v].scene, `${v}: a picture`);
    const [top, bottom] = v.split(',');
    const scene = made[v].scene;
    assert.ok(topOf(scene.layers, top) < topOf(scene.layers, bottom), `${v}: the first badge is drawn above the second`);
    const full = await P.composeUniform(Object.assign({}, build, { badgeOrder: { occupational: v.split(',') } }), store);
    for(const id of [GT, NURSE]) for(const k of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(badgeLayers(scene.layers, id)[0][k] - badgeLayers(full.layers, id)[0][k]) < 1e-6, `${v}: ${id} where the engine puts it (${k})`);
    const at = core.unionBounds([GT, NURSE].map(id => core.layerBounds(badgeLayers(scene.layers, id)[0]))), f = scene.bounds;
    assert.ok(near(f.x + f.w / 2, at.x + at.w / 2) && near(f.y + f.h / 2, at.y + at.h / 2), `${v}: centred on the stack`);
    assert.ok(f.w >= 3.6 && f.w >= 2 * at.w - 1e-6 && near(f.h, f.w * 0.75), `${v}: a window that shows the pocket the badges are over`);
    assert.ok(scene.layers.some(l => l.role === 'garment'), `${v}: on the garment`);
    assert.equal(made[v].pad, 0);
  }
  assert.notEqual(topOf(made[orders[0]].scene.layers, GT) < topOf(made[orders[0]].scene.layers, NURSE), topOf(made[orders[1]].scene.layers, GT) < topOf(made[orders[1]].scene.layers, NURSE), 'the two pictures are the two orders');
});

test('three badges above the CAP tape on the OCP: every one of the six orders is drawn, each in the order it names', async () => {
  member('ocp', [GT, NURSE, EMT]);
  const build = env.build();
  const scene = await P.composeUniform(build, store);
  const report = scene.badgeOrders.find(e => e.group === 'occupational');
  assert.equal(report.badges.length, 3, 'the engine reports a stack of three');
  const orders = BadgeOrder.orders(report.badges.map(b => b.id)).map(o => o.join(','));
  assert.equal(orders.length, 6);
  const made = await OP.RECIPES.badgeOrder.make(env, build, orders, 'occupational');
  for(const v of orders){
    assert.ok(made[v] && made[v].scene, `${v}: a picture`);
    const ids = v.split(',');
    const L = made[v].scene.layers;
    // The stack lies across the tape: the order named is the order in the drawing (highest first), reading the boxes the engine put the badges in.
    const spots = ids.map(id => { const b = core.layerBounds(badgeLayers(L, id)[0]); return [b.y, b.x]; });
    const sorted = [...spots].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    assert.deepEqual(spots.map(s => s.join()), sorted.map(s => s.join()), `${v}: drawn in that order`);
  }
});

test('an order the engine does not keep is not offered (false), a stack not worn has none, and the recipe is asked for by group', async () => {
  member('blues_a', [GT, NURSE]);
  const build = env.build();
  const missing = await OP.RECIPES.badgeOrder.make(env, build, [`${GT},${EMT}`], 'occupational');
  assert.deepEqual(Object.values(missing), [false], 'a badge that is not worn has no place in the picture');
  const asked = await OP.create(env).pictures('badgeOrder:occupational', [`${GT},${NURSE}`, `${NURSE},${GT}`]).ready;
  assert.deepEqual([`${GT},${NURSE}`, `${NURSE},${GT}`].map(v => !!(asked[v] && asked[v].scene)), [true, true]);
  // The key follows what the picture is made from: the badges worn and the uniform, not the order the member has now.
  const key = b => JSON.stringify(OP.RECIPES.badgeOrder.key(b, env, 'occupational'));
  const a = key(env.build());
  run(`State.badgeOrder = { occupational: ['${NURSE}', '${GT}'] }; return 1`);
  assert.equal(key(env.build()), a, 'the order chosen is not part of the key');
  member('blues_a', [GT, NURSE, EMT]);
  assert.notEqual(key(env.build()), a, 'another set of badges is another picture');
});

test('setEqual keeps the whole order picked for the group: only badges of that group, each once, another group and an order of fewer than two untouched', () => {
  assert.deepEqual(Catalog.setEqual({}, 'occupational', [EMT, GT, NURSE]), { occupational: [EMT, GT, NURSE] });
  assert.deepEqual(Catalog.setEqual({ occupational: [GT, NURSE] }, 'occupational', [NURSE, GT, NURSE]), { occupational: [NURSE, GT] }, 'each once');
  assert.deepEqual(Catalog.setEqual({ occupational: [GT, NURSE] }, 'occupational', [GT, 'CAPPilot1_FA9D33EA587D8', 'no_such_badge']), { occupational: [GT, NURSE] }, 'fewer than two of the group: what was saved stays');
  assert.deepEqual(Catalog.setEqual({ occupational: [GT, NURSE] }, 'no_such_group', [NURSE, GT]), { occupational: [GT, NURSE] }, 'a group of no equal standing is not saved');
  assert.deepEqual(Catalog.setEqual(null, 'occupational', 'not a list'), {});
  // The same result a run of single moves reaches.
  const moved = Catalog.moveEqual({}, 'occupational', [GT, NURSE, EMT], EMT, -1);
  assert.deepEqual(Catalog.setEqual({}, 'occupational', moved.occupational), moved);
});
