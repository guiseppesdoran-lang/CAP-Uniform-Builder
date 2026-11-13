'use strict';
// The renderer draws a cord sheet once per distinct cord path and look (js/engine/render-svg.js, baseKey: the key of the variant symbol). A cord layer may also be drawn through a window beyond the garment's
// outline (clipPlus), and that window changes what is visible, so it is part of the key. It was written inside the false arm of the cordLook test, so a braided cord (cordLook set) never counted it: two
// cords of one path and look but different windows shared one symbol, and the first one drawn was reused for the second.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.self = global.self || global;
require('../js/engine/render-svg.js');
const RS = global.self.CAPUBEngine.renderSvg;

// baseKey is a closure of buildSvg: take its source and run it with the renderer's own hashText.
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine', 'render-svg.js'), 'utf8');
const start = src.indexOf('    function baseKey(layer){'), end = src.indexOf('      return layer.id;\n    }', start);
assert.ok(start > 0 && end > start, 'baseKey is found in the renderer');
const baseKey = new Function('hashText', src.slice(start, end) + '      return layer.id;\n    }\n; return baseKey;')(RS.hashText);

const run = extra => Object.assign({ id: 'garment-blues-class-a-coat-cord-wing', cordPath: { d: 'M1,1L2,5', width: 0.5 } }, extra);
const win = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

test('two braided cords that differ only in the window they are drawn through get different keys', () => {
  const look = { id: 'wing', colour: null };
  const a = baseKey(run({ cordLook: look, clipPlus: win(0, 0, 2, 2) })), b = baseKey(run({ cordLook: look, clipPlus: win(0, 0, 2, 3) }));
  assert.notEqual(a, b, 'the window is in the key');
  assert.equal(a, baseKey(run({ cordLook: look, clipPlus: win(0, 0, 2, 2) })), 'the same window gives the same key');
  assert.notEqual(a, baseKey(run({ cordLook: look })), 'a cord with no window is not the cord with one');
});

test('a cord without a window keeps the key it had, and the look and the width are still in it', () => {
  const look = { id: 'wing', colour: null };
  const plain = baseKey(run({ cordLook: look }));
  assert.match(plain, /^garment-blues-class-a-coat-cord-wing--cord-/);
  assert.notEqual(plain, baseKey(run({ cordLook: { id: 'group', colour: null } })), 'another cord');
  assert.notEqual(plain, baseKey(run({ cordLook: look, cordPath: { d: 'M1,1L2,5', width: 0.6 } })), 'another width');
  assert.notEqual(plain, baseKey(run({ cordLook: look, cordPath: { d: 'M1,1L2,6', width: 0.5 } })), 'another path');
  // a sheet's cord path with no look (the plain cord overlays) counts its window too, as before
  assert.notEqual(baseKey(run({ clipPlus: win(0, 0, 1, 1) })), baseKey(run({})), 'no look: the window counts');
});
