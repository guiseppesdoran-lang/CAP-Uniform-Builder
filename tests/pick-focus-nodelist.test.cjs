'use strict';
// A member on a tile or field under a picker tile (a level of a badge, the count of a ribbon) keeps the focus when the list is made again. In a browser querySelectorAll gives a
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

test('a badge level picked with the focus on its tile: the list is made again, nothing throws, the same level tile has the focus', () => {
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
  const levels = () => all(cell().querySelector('.vpRow'), '.vpOption');
  levels()[2].focus();
  assert.doesNotThrow(() => levels()[2].click());
  assert.equal(State.badgeSelections[STEM].level, 'master');
  assert.ok(doc.activeElement === levels()[2], 'the member is still on that tile');
});

test('a ribbon award option picked with the focus on it: the list is made again, nothing throws, the same option has the focus', () => {
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
  const tiles = () => all(cell().querySelector('.vpRow'), '.vpOption');
  const last = tiles()[tiles().length - 1];
  const value = last.dataset.value;
  last.focus();
  assert.doesNotThrow(() => tiles()[tiles().length - 1].click());
  assert.equal(State.ribbonSelections[id].awardValue, value);
  assert.ok(doc.activeElement === tiles()[tiles().length - 1] && doc.activeElement.dataset.value === value, 'the member is still on that option');
});
