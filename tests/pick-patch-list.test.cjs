'use strict';
// The owner (2026-11-12): "patches should be visual as well". The patches of the chooser window are picture tiles (js/pick-lists.js patchList on the picture picker's toggle mode): the
// patch's own picture, its name and where it is worn under it; a tap turns it on or off and the tile shows it; a patch with more than one place on the uniform has the choice of
// them under its tile while it is on, a tile for each place with the uniform drawn with the patch there. A patch the uniform does not take is not listed. No checkbox, no drop-down and
// no word list is in the list. The page's own patch data and functions
// are used (the page's scripts loaded as index.html lists them); only the picker's DOM is the test's.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument } = require('./helpers/mini-dom.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const doc = createDocument();
global.document = doc;
const VisualPicker = require('../js/visual-picker.js');
const Lists = require('../js/pick-lists.js');

const { context } = loadPageScripts();
const ev = src => vm.runInContext(src, context);
const State = ev('State'), PATCH_META = ev('PATCH_META'), patchList = ev('patchList');

const SAID = [];   // what the window's status line was told, in order
let ROWS = [];     // what the drawing did with each patch chosen (js/badge-rules.js capubPatchSummary), as a test says it
const deps = () => ({
  State, VisualPicker, asset: p => 'images/' + p,
  patchIds: () => context.capubVisiblePatchIdsForGallery(),
  patchMeta: id => PATCH_META[id] || {},
  patchWords: id => context.patchTileWords(id),
  setPlace: (id, slot) => context.setPatchPlacement(id, slot),
  keepOneTab: id => context.capubKeepOneRangerTab(id),
  normalizePatches: () => context.normalizePatchSelections(),
  patchRows: () => ROWS,
  say: text => { SAID.push(text); },
  rebuildPatches: () => { context.State.patches = []; context.normalizePatchSelections(); for(const id of patchList) if(State.patchSelections[id] && State.patchSelections[id].checked && context.isPatchAuthorizedForUniform(id)) State.patches.push(id); }
});
const setup = (uniform, membership) => { ev(`State.uniform = ${JSON.stringify(uniform)}; State.membership = ${JSON.stringify(membership || 'senior')}; State.patches = []; State.patchSelections = {}; State.patchPlacements = {}`); };
const make = (ids) => {
  const host = doc.createElement('div'); doc.body.append(host);
  const d = deps();
  const entry = Lists.patchList(host, ids, d);
  const cell = id => host.querySelectorAll('.vpCell').find(c => c.dataset.value === id);
  return { host, entry, d, cell, button: id => cell(id).querySelector('.vpOption') };
};

test('the patches are picture tiles: each with its own picture and its name and nothing under the name; no checkbox, no radio button, no input at all', () => {
  setup('abu');
  const p = make();
  const cells = p.host.querySelectorAll('.vpCell');
  assert.ok(cells.length > 20, 'the general patches the ABU takes');
  assert.equal(p.host.querySelectorAll('input').length, 0, 'no input of any kind');
  assert.ok(cells.every(c => c.querySelector('.vpOption').getAttribute('role') === null), 'the tiles are switches (aria-pressed), not radio buttons; the only radio buttons are a patch\'s places, under it');
  assert.ok(cells.every(c => c.querySelector('.vpLabel').textContent.length > 2), 'a name under each');
  assert.ok(cells.every(c => c.querySelector('.vpCaption') === null), 'no line under the name');
  assert.ok(cells.every(c => c.querySelector('img') && /^images\/patches\//.test(c.querySelector('img').getAttribute('src'))), 'the patch\'s own picture');
  assert.ok(cells.every(c => c.querySelector('img').getAttribute('loading') === 'lazy'), 'pictures load as they come into view');
  assert.ok(cells.every(c => { const b = c.querySelector('.vpOption'); return b.nodeName === 'BUTTON' && b.getAttribute('aria-pressed') === 'false'; }), 'buttons with aria-pressed, all off to begin with');
});

test('no patch the uniform does not take is listed: a cadet-only patch is not offered to a senior member, and is to a cadet', () => {
  setup('abu', 'senior');
  assert.equal(ev(`isPatchAuthorizedForUniform('model_rocketry_patch')`), false);
  let p = make();
  assert.equal(p.cell('model_rocketry_patch'), undefined, 'not listed for a senior member');
  setup('abu', 'cadet');
  assert.equal(ev(`isPatchAuthorizedForUniform('model_rocketry_patch')`), true);
  p = make();
  assert.ok(p.cell('model_rocketry_patch'), 'listed for a cadet');
  setup('ocp', 'senior');
  p = make();
  assert.ok(p.host.querySelectorAll('.vpCell').every(c => ev(`isPatchAuthorizedForUniform(${JSON.stringify(c.dataset.value)})`)), 'every tile listed is one the OCP takes');
});

test('a tap turns a patch on and off: the selection, the patches the drawing is made from and the tile follow', () => {
  setup('abu');
  const p = make();
  const id = 'nywg_patch';
  p.button(id).click();
  assert.equal(State.patchSelections[id].checked, true);
  assert.deepEqual([...State.patches], [id], 'the build has the patch');
  assert.equal(p.button(id).getAttribute('aria-pressed'), 'true');
  assert.ok(p.button(id).classList.contains('isPicked'), 'the tile shows it with its own border and fill');
  p.button(id).click();
  assert.equal(State.patchSelections[id].checked, false);
  assert.deepEqual([...State.patches], [], 'off again');
  assert.equal(p.button(id).getAttribute('aria-pressed'), 'false');
});

test('a patch with more than one place on the uniform has the choice of them under its tile while it is on, a tile for each; the pick is kept per uniform and the window\'s status line says where the patch is worn now', () => {
  setup('corporate_field');
  const p = make();
  const id = 'nesa_patch';
  const controls = () => p.cell(id).querySelector('.vpControls');
  assert.ok(controls() === null, 'no choice while the patch is off (its pictures are made for a patch that is on)');
  assert.ok(p.cell(id).querySelector('.vpCaption') === null, 'the tile says nothing of where it is worn');
  p.button(id).click();
  assert.ok(controls() && !controls().hidden, 'the choice is there');
  assert.equal(controls().querySelectorAll('input').length + controls().querySelectorAll('select').length, 0, 'tiles, not an input or a list');
  const choice = () => controls().querySelectorAll('[role="radio"]');
  assert.deepEqual(choice().map(b => [b.dataset.value, b.querySelector('.vpLabel').textContent, b.getAttribute('aria-checked')]), [
    ['R_SHOULDER', 'Right sleeve, ½ in below the shoulder seam', 'true'],
    ['CHEST_RIGHT', 'Right breast pocket', 'false'],
    ['CHEST_LEFT', 'Left breast pocket', 'false']
  ], 'each place in words, the drawn one picked');
  ROWS = [{ id, name: ev(`patchTileWords('nesa_patch').title`), shown: true, place: 'Left breast pocket' }];
  SAID.length = 0;
  choice()[2].focus();
  choice()[2].click();
  assert.equal(ev(`getPatchSlot('nesa_patch')`), 'CHEST_LEFT', 'the slot the drawing is made at');
  assert.deepEqual(choice().map(b => b.getAttribute('aria-checked')), ['false', 'false', 'true']);
  assert.equal(SAID[SAID.length - 1], `${ev(`patchTileWords('nesa_patch').title`)}: Left breast pocket.`, 'the status line says where it is worn now');
  ROWS = [];
  assert.ok(p.cell(id).querySelector('.vpCaption') === null);
  assert.ok(p.cell('nywg_patch').querySelector('.vpControls') === null, 'a patch with one place has no choice');
});

const PLACE_PICTURES = { R_SHOULDER: 'blob:right-sleeve', CHEST_RIGHT: 'blob:right-pocket', CHEST_LEFT: 'blob:left-pocket' };
test('each place of a patch is the uniform as the engine draws it with the patch there; a place the engine draws no patch at is not offered, and the pictures that come late fill the row', async () => {
  setup('corporate_field');
  const ask = [];
  const make2 = (known, late) => {
    setup('corporate_field');
    const host = doc.createElement('div'); doc.body.append(host);
    const d = deps();
    d.patchPlacePictures = (id, slots) => { ask.push([id, slots]); return late ? { now: {}, ready: late.then(() => known), settled: false } : { now: known, ready: Promise.resolve(known), settled: true }; };
    const entry = Lists.patchList(host, null, d);
    const cell = id => host.querySelectorAll('.vpCell').find(c => c.dataset.value === id);
    return { host, entry, cell };
  };
  const id = 'nesa_patch';
  let p = make2(PLACE_PICTURES);
  assert.deepEqual(ask, [], 'no picture is asked for while the patch is off');
  p.cell(id).querySelector('.vpOption').click();
  assert.equal(JSON.stringify(ask), JSON.stringify([[id, ['R_SHOULDER', 'CHEST_RIGHT', 'CHEST_LEFT']]]), 'one request for its places');
  const tiles = () => p.cell(id).querySelector('.vpControls').querySelectorAll('[role="radio"]');
  assert.deepEqual(tiles().map(t => t.querySelector('img').getAttribute('src')), ['blob:right-sleeve', 'blob:right-pocket', 'blob:left-pocket']);
  assert.deepEqual(tiles().map(t => t.dataset.value), ['R_SHOULDER', 'CHEST_RIGHT', 'CHEST_LEFT']);
  // The left pocket is not drawn on this uniform: not offered.
  p = make2({ R_SHOULDER: 'blob:right-sleeve', CHEST_RIGHT: 'blob:right-pocket', CHEST_LEFT: false });
  p.cell(id).querySelector('.vpOption').click();
  assert.deepEqual(tiles().map(t => t.dataset.value), ['R_SHOULDER', 'CHEST_RIGHT']);
  // With one place left there is no choice.
  p = make2({ R_SHOULDER: 'blob:right-sleeve', CHEST_RIGHT: false, CHEST_LEFT: false });
  p.cell(id).querySelector('.vpOption').click();
  assert.ok(p.cell(id).querySelector('.vpPlaceChoice').hidden === true, 'one place is no choice');
  // The pictures arrive after the row is built.
  let release;
  const late = new Promise(res => { release = res; });
  p = make2(PLACE_PICTURES, late);
  p.cell(id).querySelector('.vpOption').click();
  assert.ok(p.cell(id).querySelector('.vpPlaceChoice').hidden === true, 'hidden until the pictures are made');
  release();
  await late; await Promise.resolve(); await Promise.resolve();
  assert.equal(p.cell(id).querySelector('.vpPlaceChoice').hidden, false);
  assert.equal(tiles().length, 3);
  // A tile turned off hides its row (it is kept, with the pictures it has, for the next time it is turned on).
  p.cell(id).querySelector('.vpOption').click();
  assert.ok(p.cell(id).querySelector('.vpControls') === null || p.cell(id).querySelector('.vpControls').hidden === true);
});

// The owner (2026-11-13): "remove these lower letters". A patch tile is the picture and the name; where the patch is worn, or why the drawing leaves it off, is said once in the window's status
// line when the member turns it on, and a patch that is chosen and left off carries the not-worn mark.
test('a tap says in the window\'s status line where the patch is worn or why the drawing leaves it off, and a patch it leaves off carries the not-worn mark, never a dim picture; the tile carries no line', () => {
  setup('abu');
  ROWS = []; SAID.length = 0;
  const p = make();
  const comms = 'comms_patch', pilot = 'check_pilot_patch';
  const title = id => ev(`patchTileWords(${JSON.stringify(id)}).title`);
  p.button(comms).click();
  assert.deepEqual(SAID, [''], 'the drawing has not been made yet');
  ROWS = [{ id: comms, name: title(comms), shown: true, place: 'Right breast pocket' }];
  SAID.length = 0;
  p.entry.rendered();
  assert.deepEqual(SAID, [`${title(comms)}: Right breast pocket.`]);
  p.button(pilot).click();
  const WHY = 'The ABU breast pocket takes one patch, and the Communications Patch is on it (CAPR 39-1, 5.1.1.1.2.3)';
  ROWS = [{ id: comms, name: title(comms), shown: true, place: 'Right breast pocket' }, { id: pilot, name: title(pilot), shown: false, place: '', why: WHY }];
  SAID.length = 0;
  p.entry.rendered();
  assert.deepEqual(SAID, [`${title(pilot)} is not shown. ${WHY}`], 'why, with the paragraph');
  assert.ok(p.button(pilot).classList.contains('isNotWorn'), 'chosen and left off: the not-worn mark');
  assert.ok(!p.button(comms).classList.contains('isNotWorn'));
  assert.ok(p.host.querySelectorAll('.vpOption').every(b => !b.classList.contains('isMuted')), 'no tile is ever dimmed');
  assert.equal(p.cell(pilot).querySelector('.vpLabel').textContent, title(pilot), 'its name stays');
  assert.ok(p.host.querySelectorAll('.vpCell').every(c => c.querySelector('.vpCaption') === null));
  assert.doesNotMatch(p.host.textContent, /not shown|Worn:|breast pocket takes/i);
  p.button(pilot).click();
  assert.equal(SAID[SAID.length - 1], '', 'turned off: nothing is said');
  ROWS = [];
});

test('the Hawk Mountain Ranger tabs are listed last on the OCP under their own heading with its note, and picking one turns the others off', () => {
  setup('ocp');
  const p = make();
  const heads = p.host.querySelectorAll('.vpGroupHead');
  assert.deepEqual(heads.map(h => h.textContent), ['Hawk Mountain Ranger tabs']);
  assert.match(p.host.querySelector('.vpGroupNote').textContent, /^Hawk Mountain Ranger School graduates: one tab/);
  const tabs = ev('patchList.filter(id => PATCH_META[id] && PATCH_META[id].kind === "ranger-tab")');
  assert.ok(tabs.length >= 10);
  const cells = p.host.querySelectorAll('.vpCell');
  assert.deepEqual(cells.slice(-tabs.length).map(c => c.dataset.value).sort(), [...tabs].sort(), 'the tabs come last');
  p.button(tabs[0]).click();
  assert.equal(p.button(tabs[0]).getAttribute('aria-pressed'), 'true');
  p.button(tabs[3]).click();
  assert.equal(p.button(tabs[3]).getAttribute('aria-pressed'), 'true');
  assert.equal(p.button(tabs[0]).getAttribute('aria-pressed'), 'false', 'the tab before is off');
  assert.deepEqual([...State.patches].filter(id => tabs.includes(id)), [tabs[3]], 'one tab in the build');
});

test('the window\'s search reads the picker: a name, the place or a heading finds a tile; a heading with none left goes', () => {
  setup('ocp');
  const p = make();
  const all = p.host.querySelectorAll('.vpCell').length;
  assert.equal(p.entry.picker.filter('ranger'), ev('patchList.filter(id => PATCH_META[id] && PATCH_META[id].kind === "ranger-tab")').length, 'the heading finds its tabs');
  assert.equal(p.host.querySelectorAll('.vpSection').filter(s => !s.hidden).length, 1, 'the other section is hidden');
  assert.equal(p.entry.picker.filter(''), all);
});

test('refresh puts every tile as the state says (a patch the rules took off, a selection made elsewhere)', () => {
  setup('abu');
  const p = make();
  State.patchSelections.nywg_patch = { checked: true };
  p.entry.refresh();
  assert.equal(p.button('nywg_patch').getAttribute('aria-pressed'), 'true');
  State.patchSelections.nywg_patch.checked = false;
  p.entry.refresh();
  assert.equal(p.button('nywg_patch').getAttribute('aria-pressed'), 'false');
});

test('the window builds its patch list with the picker, and the sidebar draws none: no checkbox is left in the page\'s patch code', () => {
  const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  assert.match(src('js/wiring.js'), /window\.CAPUB_MODAL_PICKERS = \[CAPUBPickLists\.patchList\(grid\)\]/);
  assert.doesNotMatch(src('js/patches.js') + src('js/galleries.js') + src('js/catalog.js') + src('js/wiring.js'), /ptChk|patchTileHtml|capubPatchTile|capubSyncGalleryChecks/, 'no checkbox tile or its wiring');
  assert.match(src('js/galleries.js'), /function buildPatchGallery\(\)\{\s*const wrap = by\('patchGallery'\);\s*if\(wrap\) wrap\.innerHTML = '';\s*\}/);
});
