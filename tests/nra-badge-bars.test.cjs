'use strict';
// The NRA Distinguished Expert (owner, 2026-11-18): the member turns on a bar for each group it was earned in (rifle, pistol, shotgun); the badge is one drawing for each combination,
// the bars hung in that order, none on by default; the switches show only at that level; a setup saved without bars loads with none.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument } = require('./helpers/mini-dom.cjs');

const ROOT = path.join(__dirname, '..');
const doc = createDocument();
global.document = doc;
const VisualPicker = require('../js/visual-picker.js');
const Lists = require('../js/pick-lists.js');
const sandbox = { window: {} }; sandbox.self = sandbox.window;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/badge-catalog.js'), 'utf8'), sandbox);
const Cat = sandbox.window.CAPUBBadgeCatalog || sandbox.CAPUBBadgeCatalog;
const NRA = 'nra_marksman_badge', DE = 'distinguished-expert';
const INDEX = fs.readFileSync(path.join(ROOT, 'data/asset-index.js'), 'utf8');

test('the Distinguished Expert is one drawing for each combination of bars, hung rifle, pistol, shotgun, and the order the member turned them on does not matter', () => {
  const art = keys => Cat.art(NRA, 'dress', DE, keys);
  const base = 'enamel-nra-distinguished-expert';
  assert.equal(art(undefined), `${base}-nobar`);
  assert.equal(art([]), `${base}-nobar`);
  assert.equal(art(['rifle']), `${base}-r`);
  assert.equal(art(['shotgun', 'pistol']), `${base}-ps`);
  assert.equal(art(['shotgun', 'rifle']), `${base}-rs`);
  assert.equal(art(['pistol', 'rifle']), `${base}-rp`);
  assert.equal(art(['shotgun', 'pistol', 'rifle']), `${base}-rps`);
  assert.equal(art(['rifle', 'rifle', 'nonsense']), `${base}-r`);
  for(const letters of ['nobar', 'r', 'p', 's', 'rp', 'rs', 'ps', 'rps']) assert.ok(INDEX.includes(`"${base}-${letters}"`), `${letters} is in the asset index`);
});

test('no other level draws a bar, and the old drawing with shotgun and pistol is not drawn by any level', () => {
  for(const [key, , drawing] of Cat.levels(NRA)){
    assert.notEqual(drawing, 'enamel-nra-distinguished-expert');
    if(key !== DE) assert.equal(Cat.art(NRA, 'dress', key, ['rifle', 'pistol']), drawing);
  }
  assert.equal(Cat.bars(NRA, 'expert'), null);
  assert.deepEqual([...Cat.bars(NRA, DE).map(b => b[0])], ['rifle', 'pistol', 'shotgun']);
  assert.equal(Cat.bars('cadet_stem_badge', 'master') === null, true);
});

function deps(State){
  const d = {
    State, VisualPicker, asset: p => 'images/' + p, artPath: id => id, name: id => id === NRA ? 'NRA Marksmanship Badge' : id,
    isCommand: () => false, levels: id => Cat.levels(id), level: (id, l) => Cat.level(id, l)[0],
    levelArt: (id, l) => Cat.art(id, 'dress', l, (State.badgeSelections[id] || {}).bars), hasBars: id => !!(Cat.BADGES[id] && Cat.BADGES[id].bars),
    bars: (id, l) => Cat.bars(id, l), barArt: (id, k) => Cat.barArt(id, [k]),
    canCommand: () => true, chooseOnlyCommand: () => {}, rebuild: () => { State.badges = Object.keys(State.badgeSelections).filter(id => State.badgeSelections[id].checked); },
    badgeRows: () => [], say: () => {}
  };
  return d;
}
function make(){
  const State = { badgeSelections: {}, badges: [], commandInsignia: {} };
  const d = deps(State);
  const host = doc.createElement('div'); doc.body.append(host);
  const entry = Lists.badgeList(host, [{ key: 'Cadet', ids: [NRA] }], d);
  const cell = () => host.querySelectorAll('.vpCell').find(c => c.dataset.value === NRA);
  const bars = () => host.querySelectorAll('.ribbonToggle');
  return { State, d, host, entry, cell, bars, tapTile: () => cell().querySelector('button').click() };
}

test('the three switches show under the tile only at the Distinguished Expert level, none on at first, and the tile shows the badge with the bars that are on', () => {
  const p = make();
  p.tapTile();
  assert.equal(p.bars().length, 0, 'not at the first level');
  Lists.setBadgeLevel(NRA, DE, p.d); p.entry.setOptions();
  assert.deepEqual(p.bars().map(b => b.dataset.value), ['rifle', 'pistol', 'shotgun']);
  assert.deepEqual(p.bars().map(b => b.getAttribute('aria-pressed')), ['false', 'false', 'false']);
  p.bars()[1].click();
  assert.deepEqual(p.State.badgeSelections[NRA].bars, ['pistol']);
  assert.deepEqual(p.bars().map(b => b.getAttribute('aria-pressed')), ['false', 'true', 'false']);
  p.bars()[0].click(); p.bars()[2].click();
  assert.deepEqual(new Set(p.State.badgeSelections[NRA].bars), new Set(['rifle', 'pistol', 'shotgun']));
  assert.equal(p.d.levelArt(NRA, DE), 'enamel-nra-distinguished-expert-rps');
  p.bars()[1].click();
  assert.equal(p.d.levelArt(NRA, DE), 'enamel-nra-distinguished-expert-rs');
});

test('the bars are remembered when the level changes and comes back', () => {
  const p = make();
  p.tapTile();
  Lists.setBadgeLevel(NRA, DE, p.d); p.entry.setOptions();
  p.bars()[0].click();
  Lists.setBadgeLevel(NRA, 'expert', p.d); p.entry.setOptions();
  assert.equal(p.bars().length, 0);
  Lists.setBadgeLevel(NRA, DE, p.d); p.entry.setOptions();
  assert.deepEqual(p.bars().map(b => b.getAttribute('aria-pressed')), ['true', 'false', 'false']);
});

test('a saved setup keeps the bars; one saved without them loads with none', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/wiring.js'), 'utf8');
  assert.match(src, /barsOn\(id, source\[id\]\.bars\)/);
  assert.deepEqual([...Cat.barsOn(NRA, ['shotgun', 'rifle', 'x'])], ['rifle', 'shotgun']);
  assert.deepEqual([...Cat.barsOn(NRA, undefined)], []);
});

test('the engine is given the bars of the selection, and the page paths and previews are given them too', () => {
  for(const [file, text] of [['js/engine/profiles.js', 'sel.level, sel.bars'], ['js/uniform-view.js', 'bars: State.badgeSelections'], ['js/catalog.js', "State.badgeSelections?.[id]?.bars"], ['js/patches.js', "State.badgeSelections?.[id]?.bars"]])
    assert.ok(fs.readFileSync(path.join(ROOT, file), 'utf8').includes(text), file);
});
