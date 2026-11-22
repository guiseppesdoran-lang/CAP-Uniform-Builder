'use strict';
// A member on a field under a picker tile (the level of a badge, the count of a ribbon) keeps the focus when the list is made again. In a browser querySelectorAll gives a
// NodeList, which has no find or map: keepingFocus in js/pick-lists.js used to call find on it and threw, so the focus fell to the body and the status line was not written. These tests
// run on a document whose lists are a browser's (mini-dom strictLists), so an array method called straight on one throws here as it does there.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createDocument, strictLists } = require('./helpers/mini-dom.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const doc = createDocument();
global.document = doc;
strictLists();
const VisualPicker = require('../js/visual-picker.js');
const Lists = require('../js/pick-lists.js');
const all = (node, sel) => Array.from(node.querySelectorAll(sel));

test('the test document gives lists like a browser: indexed, iterable, no array methods', () => {
  const host = doc.createElement('div');
  host.append(doc.createElement('p'), doc.createElement('p'));
  const list = host.querySelectorAll('p');
  assert.equal(list.length, 2);
  assert.ok(list[1] && list.item(0) === list[0] && [...list].length === 2);
  for(const name of ['find', 'map', 'filter', 'slice', 'some', 'every']) assert.equal(typeof list[name], 'undefined', name);
});

test('a badge level picked in its dropdown with the focus on it: the list is made again, nothing throws, the same dropdown has the focus', () => {
  const STEM = 'cadet_stem_badge';
  const State = { badgeSelections: {}, badges: [], commandInsignia: {}, rank: 'C/Capt' };
  const d = {
    State, VisualPicker, asset: p => 'images/' + p, artPath: id => `badges/${id}.svg`, name: id => id, isCommand: () => false,
    levels: id => [['basic', 'Basic'], ['senior', 'Senior'], ['master', 'Master']], level: (id, level) => level || 'basic', levelArt: (id, level) => `badges/${id}-${level}.svg`,
    canCommand: () => true, chooseOnlyCommand(){}, rebuild: () => { State.badges = Object.keys(State.badgeSelections).filter(id => State.badgeSelections[id].checked); }, badgeRows: () => [], say(){}
  };
  const host = doc.createElement('div'); doc.body.append(host);
  Lists.badgeList(host, [{ key: 'Cadet', ids: [STEM] }], d);
  const cell = () => all(host, '.vpCell').find(c => c.dataset.value === STEM);
  cell().querySelector('.vpOption').click();
  const select = () => all(cell(), 'select')[0];
  select().focus();
  select().value = 'master';
  assert.doesNotThrow(() => select().dispatchEvent({ type: 'change', target: select() }));
  assert.equal(State.badgeSelections[STEM].level, 'master');
  assert.ok(doc.activeElement === select() && select().value === 'master', 'the member is still on that dropdown, at that level');
});

test('a ribbon award picked in its dropdown, and a switch pressed, with the focus on it: the list is made again, nothing throws, the same field has the focus', () => {
  const { context } = loadPageScripts();
  const ev = src => vm.runInContext(src, context);
  const State = ev('State');
  ev('rebuildRibbonsFromGallery = function(){}; renderRack = function(){}; renderAllBadges = function(){};');
  ev(`State.uniform = 'blues_a'; State.membership = 'senior'; State.rank = 'Capt'; State.ribbonSelections = {}; State.militaryUIState = {}; State.gradeRibbons = null`);
  ev('normalizeRibbonSelections()');
  const deps = Object.assign(ev('CAPUBPickLists.pageDeps()'), { VisualPicker, asset: p => 'images/' + p, drawRibbon(){}, drawMini(){}, fallback(){} });
  const host = doc.createElement('div'); doc.body.append(host);
  Lists.ribbonLists(host, deps);
  const id = 'lifesaving_award';
  const cell = () => all(host, '.vpCell').find(c => c.dataset.value === id);
  cell().querySelector('.vpOption').click();
  const select = () => all(cell(), 'select')[0];
  const options = all(select(), 'option');
  const value = options[options.length - 1].value;
  select().focus();
  select().value = value;
  assert.doesNotThrow(() => select().dispatchEvent({ type: 'change', target: select() }));
  assert.equal(State.ribbonSelections[id].awardValue, value);
  assert.ok(doc.activeElement === select() && select().value === value, 'the member is still on the dropdown, at that line');
  // The star of the lifesaving ribbon is a switch: pressed with the focus on it, the same switch has the focus afterwards.
  const star = () => all(cell(), '.ribbonToggle')[0];
  select().value = options[1].value;
  select().dispatchEvent({ type: 'change', target: select() });
  star().focus();
  assert.doesNotThrow(() => star().click());
  assert.match(State.ribbonSelections[id].awardLabel, /with Star/);
  assert.ok(doc.activeElement === star() && star().getAttribute('aria-pressed') === 'true', 'the member is still on the switch, now pressed');
});
