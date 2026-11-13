'use strict';
// The owner (2026-11-12): "patches should be visual as well". The patches of the chooser window are picture tiles (js/pick-lists.js patchList on the picture picker's toggle mode): the
// patch's own picture, its name and where it is worn under it; a tap turns it on or off and the tile shows it; a patch with more than one place on the uniform has the choice of
// them under its tile while it is on. A patch the uniform does not take is not listed. No checkbox and no radio button is in the list. The page's own patch data and functions
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

const deps = () => ({
  State, VisualPicker, asset: p => 'images/' + p,
  patchIds: () => context.capubVisiblePatchIdsForGallery(),
  patchMeta: id => PATCH_META[id] || {},
  patchWords: id => context.patchTileWords(id),
  setPlace: (id, slot) => context.setPatchPlacement(id, slot),
  keepOneTab: id => context.capubKeepOneRangerTab(id),
  normalizePatches: () => context.normalizePatchSelections(),
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

test('the patches are picture tiles: each with its own picture, its name and where it is worn; no checkbox, no radio button, no input at all', () => {
  setup('abu');
  const p = make();
  const cells = p.host.querySelectorAll('.vpCell');
  assert.ok(cells.length > 20, 'the general patches the ABU takes');
  assert.equal(p.host.querySelectorAll('input').length, 0, 'no input of any kind');
  assert.ok(cells.every(c => c.querySelector('.vpOption').getAttribute('role') === null), 'the tiles are switches (aria-pressed), not radio buttons; the only radio buttons are a patch\'s places, under it');
  assert.ok(cells.every(c => c.querySelector('.vpLabel').textContent.length > 2), 'a name under each');
  assert.ok(cells.every(c => /^Worn: [A-Z]/.test(c.querySelector('.vpCaption').textContent)), 'where it is worn, in words, under each');
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

test('a patch with more than one place on the uniform has the choice of them under its tile while it is on; the pick is kept per uniform and the line under the picture follows it', () => {
  setup('corporate_field');
  const p = make();
  const id = 'nesa_patch';
  const controls = () => p.cell(id).querySelector('.vpControls');
  assert.ok(controls(), 'the choice is there');
  assert.equal(controls().hidden, true, 'shown only while the patch is on');
  assert.equal(p.cell(id).querySelector('.vpCaption').textContent, 'Worn: Right sleeve, ½ in below the shoulder seam');
  p.button(id).click();
  assert.equal(controls().hidden, false);
  assert.equal(controls().querySelectorAll('input').length + controls().querySelectorAll('select').length, 0, 'buttons, not an input or a list');
  const choice = controls().querySelectorAll('[role="radio"]');
  assert.deepEqual(choice.map(b => [b.dataset.value, b.querySelector('.vpLabel').textContent, b.getAttribute('aria-checked')]), [
    ['R_SHOULDER', 'Right sleeve, ½ in below the shoulder seam', 'true'],
    ['CHEST_RIGHT', 'Right breast pocket', 'false'],
    ['CHEST_LEFT', 'Left breast pocket', 'false']
  ], 'each place in words, the drawn one picked');
  choice[2].click();
  assert.equal(ev(`getPatchSlot('nesa_patch')`), 'CHEST_LEFT', 'the slot the drawing is made at');
  assert.deepEqual(controls().querySelectorAll('[role="radio"]').map(b => b.getAttribute('aria-checked')), ['false', 'false', 'true']);
  assert.equal(p.cell(id).querySelector('.vpCaption').textContent, 'Worn: Left breast pocket');
  assert.equal(p.cell('nywg_patch').querySelector('.vpControls'), null, 'a patch with one place has no choice');
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
