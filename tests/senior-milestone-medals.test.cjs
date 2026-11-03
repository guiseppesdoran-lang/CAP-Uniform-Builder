'use strict';
// CAPR 39-1 11.1.4: "Officers and NCOs may choose to wear some or all their authorized medals on the Mess Dress and Corporate Semiformal
// uniforms". Ethan's ruling, on Doran's point: "yes milestones as he suggested". A senior member who was a cadet may wear every cadet
// milestone medal earned (the Mitchell, Earhart, Eaker and Spaatz; the Wright Brothers has no medal) at once on those two uniforms; the
// ribbon rack keeps the highest cadet award only (CAPR 39-3 Attachment 2, 14j-14m speak of ribbons). A cadet is unchanged.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));

const { context } = loadPageScripts();
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context));
const MILESTONES = ['mitchell_award', 'earhart_award', 'eaker_award', 'spaatz_award'];

// The build the page hands the engine for a member who picked these awards on this uniform.
const buildFor = (membership, uniform, ids, rank) => run(`
  State.membership = ${JSON.stringify(membership)}; State.uniform = ${JSON.stringify(uniform)}; State.gender = 'male'; State.rank = ${JSON.stringify(rank)};
  State.badges = []; State.garment = {}; State.hideRibbons = false; State.cadetHighestOnly = false;
  normalizeRibbonSelections();
  for(const id of Object.keys(State.ribbonSelections)) clearRibbonSelection(id);
  for(const id of ${JSON.stringify(ids)}) setRibbonSelectionFromDropdown(id, 'earned', { deferRender: true });
  rebuildRibbonsFromGallery();
  return CAPUBUniformView.buildFromState();`);
const layers = async (build, role) => (await P.composeUniform(build, store)).layers.filter(l => l.role === role);

for(const uniform of ['mess_dress', 'semi_formal']){
  test(`${uniform}: a senior with the Mitchell, Earhart, Eaker and Spaatz wears four miniature medals and no ribbon rack (11.1.4)`, async () => {
    const build = buildFor('senior', uniform, MILESTONES, 'Maj');
    assert.deepEqual(build.medals.map(m => m.medal), MILESTONES.map(id => `medal-${id.replace(/_/g, '-')}-miniature`).reverse());
    assert.deepEqual(build.ribbons, []);
    assert.equal((await layers(build, 'mini-medal')).length, 4, 'four medal bodies in the rack');
    assert.equal((await layers(build, 'mini-drape')).length, 4, 'each hangs from its own ribbon');
  });
}

test('a ribbon uniform: the same senior wears one cadet ribbon, the Spaatz, the highest (CAPR 39-3 Attachment 2)', async () => {
  const build = buildFor('senior', 'blues_a', MILESTONES, 'Maj');
  assert.deepEqual(build.medals, []);
  assert.deepEqual(build.ribbons.map(r => r.asset), ['ribbon-spaatz-award']);
  assert.equal((await layers(build, 'mini-medal')).length, 0);
  assert.equal((await layers(build, 'ribbon')).length, 1, 'one ribbon on the rack');
});

test('the Wright Brothers has no medal: the engine hangs no miniature for it, and it is not the ribbon when a higher milestone is picked', async () => {
  const build = buildFor('senior', 'mess_dress', ['wright_brothers_award', 'mitchell_award'], 'Maj');
  assert.deepEqual((await layers(build, 'mini-medal')).map(l => l.id), ['medal-mitchell-award-miniature']);
  const blues = buildFor('senior', 'blues_a', ['wright_brothers_award', 'mitchell_award'], 'Maj');
  assert.deepEqual(blues.ribbons.map(r => r.asset), ['ribbon-mitchell-award']);
});

test('the Cadet Officer School star on the Mitchell stays on its medal, and moves to the highest ribbon on the rack (39-3 14j)', () => {
  const star = uniform => run(`
    State.membership = 'senior'; State.uniform = ${JSON.stringify(uniform)}; State.gender = 'male'; State.rank = 'Maj'; State.badges = [];
    normalizeRibbonSelections();
    for(const id of Object.keys(State.ribbonSelections)) clearRibbonSelection(id);
    setRibbonSelectionFromDropdown('mitchell_award', 'earned_cos_star', { deferRender: true });
    setRibbonSelectionFromDropdown('eaker_award', 'earned', { deferRender: true });
    rebuildRibbonsFromGallery();
    const b = CAPUBUniformView.buildFromState();
    return { medals: b.medals.map(m => [m.key, m.devices.length]), ribbons: b.ribbons.map(r => [r.asset, r.devices.length]) };`);
  const mess = star('mess_dress');
  assert.equal(mess.medals.length, 2);
  assert.ok(mess.medals.some(([key, n]) => /mitchell/.test(key) && n === 1), 'the Mitchell medal keeps its star');
  const blues = star('blues_a');
  assert.deepEqual(blues.ribbons.map(r => r[0]), ['ribbon-eaker-award']);
  assert.equal(blues.ribbons[0][1], 1, 'the star is on the one ribbon');
});

test('picking a milestone keeps the other milestones; any other cadet award still replaces the rest', () => {
  const picked = run(`
    State.membership = 'senior'; normalizeRibbonSelections();
    for(const id of Object.keys(State.ribbonSelections)) clearRibbonSelection(id);
    for(const id of ['mitchell_award', 'earhart_award']) setRibbonSelectionFromDropdown(id, 'earned', { deferRender: true });
    const both = ['mitchell_award', 'earhart_award'].every(id => State.ribbonSelections[id].checked);
    setRibbonSelectionFromDropdown('curry_achievement', 'earned', { deferRender: true });
    const afterAchievement = ['mitchell_award', 'earhart_award', 'curry_achievement'].map(id => !!State.ribbonSelections[id].checked);
    setRibbonSelectionFromDropdown('spaatz_award', 'earned', { deferRender: true });
    const afterMilestone = ['curry_achievement', 'spaatz_award'].map(id => !!State.ribbonSelections[id].checked);
    return { both, afterAchievement, afterMilestone };`);
  assert.equal(picked.both, true);
  assert.deepEqual(picked.afterAchievement, [false, false, true]);
  assert.deepEqual(picked.afterMilestone, [false, true]);
});

test('a cadet is unchanged: the rack is every ribbon picked, and the cadet group keeps its plain heading', () => {
  const build = buildFor('cadet', 'blues_a', MILESTONES, 'C/Col');
  assert.deepEqual(build.ribbons.map(r => r.asset), MILESTONES.map(id => 'ribbon-' + id.replace(/_/g, '-')).reverse());
  const labels = run(`return { senior: groupRibbonIds(['spaatz_award'], 'senior')[0], cadet: groupRibbonIds(['spaatz_award'], 'cadet')[0] };`);
  assert.equal(labels.cadet.label, 'Cadet program awards');
  assert.equal(labels.senior.label, 'Cadet awards');
  assert.match(labels.senior.note, /every cadet milestone award earned may be worn as a miniature medal/i);
});
