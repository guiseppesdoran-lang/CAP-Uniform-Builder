'use strict';
// A long list of tiles on a page that is on screen is made in pieces (js/visual-picker.js): the first screenful at once, the rest in later tasks, below what is there. Whatever needs
// every tile makes the rest first. Where the page has not turned it on (these tests, a hidden tab) the list is made whole at once. The DOM is the stand-in of tests/helpers/mini-dom.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDocument } = require('./helpers/mini-dom.cjs');

const doc = createDocument();
global.document = doc;
const VisualPicker = require('../js/visual-picker.js');

const options = n => Array.from({ length: n }, (_, i) => ({ value: 'v' + i, label: 'Tile ' + i, group: i < n / 2 ? 'First' : 'Second', search: 'w' + i }));
const make = (n, extra) => {
  const host = doc.createElement('div');
  doc.body.append(host);
  const p = VisualPicker.render(host, Object.assign({ name: 'long', mode: 'toggle', options: options(n), values: ['v5'] }, extra));
  return { p, tiles: () => p.el.querySelectorAll('.vpOption'), cells: () => p.el.querySelectorAll('.vpCell') };
};

test('without the page turning it on, the list is made whole at once', () => {
  const { tiles } = make(120);
  assert.equal(tiles().length, 120);
});

test('turned on, the first screenful comes at once and the rest in later tasks, in order, with the state painted on each', () => {
  const frames = [], timers = [];
  global.requestAnimationFrame = fn => frames.push(fn);
  global.setTimeout = fn => timers.push(fn);
  doc.visibilityState = 'visible';
  VisualPicker.deferTaps = true;
  let built = 0;
  try{
    const { p, tiles, cells } = make(120, { onBuilt: () => { built++; } });
    assert.equal(tiles().length, 30, 'the first screenful');
    assert.equal(p.filter(''), 120, 'no search: nothing is hidden and the list is not made whole for it');
    assert.equal(tiles().length, 30);
    const run = () => { const f = frames.splice(0), t = timers.splice(0); f.forEach(fn => fn()); t.forEach(fn => fn()); };
    const f = frames.splice(0);
    assert.equal(f.length, 1, 'one frame callback waits');
    f.forEach(fn => fn());
    assert.equal(tiles().length, 30, 'the frame comes first, then the task that adds more');
    timers.splice(0).forEach(fn => fn());
    assert.equal(tiles().length, 70);
    assert.ok(built >= 1);
    for(let i = 0; i < 5; i++) run();
    assert.equal(tiles().length, 120);
    assert.deepEqual(tiles().map(t => t.dataset.value), options(120).map(o => o.value), 'every tile, in the order of the options');
    assert.equal(tiles()[5].getAttribute('aria-pressed'), 'true', 'a tile on is on');
    assert.equal(tiles()[100].getAttribute('aria-pressed'), 'false');
    assert.equal(p.el.querySelectorAll('.vpSection').length, 2, 'the two groups');
  }finally{
    VisualPicker.deferTaps = false;
    delete doc.visibilityState;
    delete global.requestAnimationFrame;
    global.setTimeout = require('node:timers').setTimeout;
  }
});

test('a search, or a new set of options, makes the rest first', () => {
  const frames = [], timers = [];
  global.requestAnimationFrame = fn => frames.push(fn);
  global.setTimeout = fn => timers.push(fn);
  doc.visibilityState = 'visible';
  VisualPicker.deferTaps = true;
  try{
    const a = make(120);
    assert.equal(a.tiles().length, 30);
    assert.equal(a.p.filter('w100'), 1, 'the search reads every tile');
    assert.equal(a.tiles().length, 120);
    const b = make(120);
    assert.equal(b.tiles().length, 30);
    b.p.setOptions(options(120));
    assert.equal(b.tiles().length, 120, 'the rest is made, and the same tiles set again are patched where they stand');
    assert.equal(b.cells().length, 120);
  }finally{
    VisualPicker.deferTaps = false;
    delete doc.visibilityState;
    delete global.requestAnimationFrame;
    global.setTimeout = require('node:timers').setTimeout;
  }
});
