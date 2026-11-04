'use strict';
// The lists under the Badges and Patches cards of the Items step: every badge or patch chosen, by name, with the place the drawing put it in
// words, and each one the drawing leaves off with the reason and the paragraph (js/badge-rules.js capubBadgeSummary, capubPatchSummary). The
// scene is handed in, as the engine writes it; tests/engine-badge-places.test.cjs pins the engine's side.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const root = path.join(__dirname, '..');
const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const summary = (scene, setup) => {
  context.__scene = scene;
  ev(`State.membership = 'senior'; State.rank = 'Capt'; State.gender = 'male'; State.garment = {}; State.militaryBadges = {}; State.badgeSelections = {}; ${setup}`);
  return ev('capubBadgeSummary(__scene)');
};
const layer = (id, place) => ({ role: 'badge', key: 'badge:' + id, place });

test('each chosen badge is listed by name with the place the drawing gave it', () => {
  const rows = summary({ uniform: 'blues_a', notes: [], conflicts: [], layers: [layer('ground_team_basic_badge', 'above the ribbons'), layer('communications_technician_badge', 'left pocket')] },
    `State.uniform = 'blues_a'; State.badges = ['ground_team_basic_badge', 'communications_technician_badge']`);
  assert.deepEqual(rows.map(r => [r.name, r.shown, r.place]), [['Ground Team Badge', true, 'above the ribbons'], ['Communications Technician Badge', true, 'left pocket']]);
});

test('a badge the drawing leaves off says why: the position\'s own reason, the drawing\'s note for it, else no place is left (with the uniform\'s paragraph)', () => {
  const rows = summary({ uniform: 'blues_a', notes: ['Legal Officer Badge cannot be shown on this uniform'], layers: [layer('ground_team_basic_badge', 'above the ribbons')],
    conflicts: [{ position: 'aviation', candidates: [{ id: 'observer_badge' }], shown: [], why: 'Only one CAP aviation badge is worn (CAPR 39-1, 4.1.5.2.2.4.1)', slots: [] }] },
    `State.uniform = 'blues_a'; State.badges = ['ground_team_basic_badge', 'observer_badge', 'legal_officer', 'information_technology_technician_badge']`);
  const by = n => rows.find(r => r.name === n);
  assert.equal(by('Ground Team Badge').shown, true);
  assert.equal(by('Observer Badge').shown, false);
  assert.equal(by('Observer Badge').why, 'Only one CAP aviation badge is worn (CAPR 39-1, 4.1.5.2.2.4.1)');
  assert.equal(by('Legal Officer Badge').why, 'It cannot be shown on this uniform');
  assert.equal(by('Information Technology Technician Badge').why, 'No place is left for it on this uniform, which wears 4 (CAPR 39-1, 4.1.5.2.2.4)');
});

test('a badge the uniform does not wear is named with the paragraph; military badges where the uniform does not draw them yet', () => {
  const rows = summary({ uniform: 'polo', notes: [], conflicts: [], layers: [] },
    `State.uniform = 'polo'; State.badges = ['communications_technician_badge']; State.militaryBadges = { army_air_assault_badge: { selected: true } }`);
  assert.equal(rows.length, 2);
  assert.match(rows[0].why, /^This uniform does not wear it \(CAPR 39-1, /);
  assert.equal(rows[1].why, 'U.S. military badges are not drawn on this uniform yet');
});

test('the command pin is listed like any badge, placed over or under the name tag', () => {
  const rows = summary({ uniform: 'blues_a', notes: [], conflicts: [], layers: [{ role: 'badge', key: 'badge:squadron_commander_badge:UN:0', place: 'below the name tag' }] },
    `State.uniform = 'blues_a'; State.badges = ['squadron_commander_badge']; State.commandInsignia = { graduatedCommander: true }`);
  assert.deepEqual(rows.map(r => [r.name, r.shown, r.place]), [['Squadron Commander Badge', true, 'below the name tag']]);
});

test('before the first drawing of the uniform the names are listed without places', () => {
  const rows = summary(null, `State.uniform = 'blues_a'; State.badges = ['ground_team_basic_badge']`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pending, true);
});

test('patches: the place of each patch worn comes from the uniform\'s own places; each patch left off carries the drawing\'s reason', () => {
  context.__scene = { uniform: 'abu', notes: ['National Check Pilot Patch is not shown: the ABU breast pocket takes one patch, and the Communications Patch is on it (CAPR 39-1, 5.1.1.1.2.3)'],
    layers: [{ role: 'patch', key: 'patch:ner_patch:L_SHOULDER:0' }, { role: 'patch', key: 'patch:comms_patch:CHEST_RIGHT:0' }], conflicts: [] };
  ev(`State.membership = 'senior'; State.rank = 'Capt'; State.gender = 'male'; State.uniform = 'abu'; State.unitPatchCharter = ''; State.patchPlacements = {}; State.patches = ['ner_patch', 'comms_patch', 'check_pilot_patch']`);
  const rows = ev('capubPatchSummary(__scene)');
  assert.deepEqual(rows.map(r => [r.name, r.shown, r.place]), [
    ['Northeast Region Patch', true, 'Left sleeve, ½ in below the shoulder seam'],
    ['Communications Patch', true, 'Right breast pocket'],
    ['National Check Pilot Patch', false, '']]);
  assert.equal(rows[2].why, 'The ABU breast pocket takes one patch, and the Communications Patch is on it (CAPR 39-1, 5.1.1.1.2.3)');
  ev(`State.patches = []; delete window.CAPUBUniformView`);
});

test('the cards carry the lists, and the old patch note that repeated the lines is gone', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<div id="badgeSummary" class="itemSummary hidden">\s*<h4[^>]*>Where your badges are worn<\/h4>/);
  assert.match(html, /<div id="patchSummary" class="itemSummary hidden">\s*<h4[^>]*>Where your patches are worn<\/h4>/);
  assert.doesNotMatch(html, /patchesNotShownNote/);
  // The badge list sits under the card's rule line, above the chooser the card adds.
  assert.ok(html.indexOf('id="badgeSummary"') > html.indexOf('data-rule="badges"') && html.indexOf('id="badgeSummary"') < html.indexOf('id="badgesPlannedNote"'));
});
