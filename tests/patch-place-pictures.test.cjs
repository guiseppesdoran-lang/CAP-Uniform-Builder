'use strict';
// The owner (2026-11-12, "mostly everything should be visual"): where a patch is worn is chosen by picture. Each place the uniform has for the patch is the uniform as the engine draws it
// with the patch at that place, in a window round the patch (js/option-pictures.js, the recipe patchPlace, asked for by "patchPlace:<patch>"), so the part of the garment the patch is on
// shows with the patch on it. The recipe is run against the real engine and the page's own state.

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
const ID = 'nesa_patch', SLOTS = ['R_SHOULDER', 'CHEST_RIGHT', 'CHEST_LEFT'];
const member = (uniform, patches) => run(`
  State.membership = 'senior'; State.uniform = ${JSON.stringify(uniform)}; State.gender = 'male'; State.rank = 'Capt'; State.garment = {}; State.badges = [];
  State.patches = ${JSON.stringify(patches)}; State.patchSelections = {}; for(const id of State.patches) State.patchSelections[id] = { checked: true }; State.patchPlacements = {}; return State.patches.length;`);
const patchLayers = (layers, id) => layers.filter(l => l.role === 'patch' && String(l.key).startsWith(`patch:${id}:`));
const near = (a, b) => Math.abs(a - b) < 0.002;

test('each place of a patch is the uniform as the engine draws it with the patch there, in a window centred on the patch, on the garment', async () => {
  member('corporate_field', [ID]);
  const build = env.build();
  const made = await OP.RECIPES.patchPlace.make(env, build, SLOTS, ID);
  const spots = [];
  for(const slot of SLOTS){
    assert.ok(made[slot] && made[slot].scene, `${slot}: a picture`);
    const scene = made[slot].scene;
    // What the engine draws for the same member with the patch at that place.
    const full = await P.composeUniform(Object.assign({}, build, { patches: [Object.assign({}, build.patches[0], { slot })], ribbons: [], badges: [] }), store);
    const there = patchLayers(full.layers, ID).sort((a, b) => b.w * b.h - a.w * a.h)[0];
    const drawn = patchLayers(scene.layers, ID).sort((a, b) => b.w * b.h - a.w * a.h)[0];
    assert.ok(there && drawn, `${slot}: the patch is in the picture`);
    for(const k of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(drawn[k] - there[k]) < 1e-6, `${slot}: the patch where the engine puts it (${k})`);
    const b = core.layerBounds(there), f = scene.bounds;
    assert.ok(near(f.x + f.w / 2, b.x + b.w / 2) && near(f.y + f.h / 2, b.y + b.h / 2), `${slot}: centred on the patch`);
    assert.ok(f.w >= 4 && f.w > 2 * b.w && near(f.h, f.w * 0.75), `${slot}: a window that shows the part of the garment it is on`);
    assert.ok(scene.layers.some(l => l.role === 'garment'), `${slot}: on the garment`);
    assert.equal(made[slot].pad, 0);
    spots.push([Math.round(b.x * 10), Math.round(b.y * 10)].join());
  }
  assert.equal(new Set(spots).size, 3, 'three places, three different positions of the patch on the garment');
});

test('the picture holds the patch alone: no ribbons, badges, name or other patches are in it', async () => {
  member('corporate_field', [ID, 'nywg_patch']);
  run(`State.ribbons = []; return 1`);
  const build = env.build();
  assert.ok(build.patches.length >= 2, 'the member wears two patches');
  const made = await OP.RECIPES.patchPlace.make(env, build, ['R_SHOULDER'], ID);
  const layers = made.R_SHOULDER.scene.layers;
  assert.deepEqual([...new Set(layers.filter(l => l.role === 'patch').map(l => String(l.key).split(':')[1]))], [ID], 'only the patch the choice is for');
  assert.ok(!layers.some(l => l.role === 'ribbon' || l.role === 'badge'), 'no ribbon or badge');
});

test('a patch the member does not wear has no picture (false), and the same recipe is asked for each patch by name', async () => {
  member('corporate_field', [ID]);
  const none = await OP.RECIPES.patchPlace.make(env, env.build(), SLOTS, 'no_such_patch');
  assert.deepEqual(SLOTS.map(s => none[s]), [false, false, false]);
  const made = OP.create(env).pictures(`patchPlace:${ID}`, SLOTS);
  const done = await made.ready;
  assert.deepEqual(SLOTS.map(s => !!(done[s] && done[s].scene)), [true, true, true], 'asked for as patchPlace:<patch>');
  const other = await OP.create(env).pictures('patchPlace:no_such_patch', SLOTS).ready;
  assert.deepEqual(SLOTS.map(s => other[s]), [false, false, false]);
  // The pictures are made again when the patch or the garment changes, and not for the place chosen.
  const key = (build, id) => OP.RECIPES.patchPlace.key(build, env, id);
  const a = key(env.build(), ID);
  member('corporate_field', [ID]);
  run(`State.patchPlacements = { corporate_field: { ${ID}: 'CHEST_LEFT' } }; return 1`);
  assert.equal(JSON.stringify(key(env.build(), ID)), JSON.stringify(a), 'the place chosen is not part of the key');
  member('corporate_flight_suit', [ID]);
  assert.notEqual(JSON.stringify(key(env.build(), ID)), JSON.stringify(a), 'another uniform is another picture');
});
