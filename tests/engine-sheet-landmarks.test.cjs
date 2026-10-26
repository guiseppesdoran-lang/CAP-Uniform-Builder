'use strict';
// The engine reads the Class A coat's strap axis from the sheets' own specs and keeps no copy of it (the men's coat was redrawn at true scale
// in art e1b1ab14 and the literal measured on the old sheet put the boards, grades and cord joins 0.4 to 0.9 in off). Each test moves the number
// in the spec the engine loads and expects the scene to follow; a literal in the engine would not.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
// A store that loads the shipped specs, with `edit(path, json)` applied to the ones it names.
const storeWith = edit => core.createSpecStore(manifest, p => Promise.resolve(edit(p, JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8')))));
const same = (p, j) => j;
const hb = (uniform, gender, membership, rank, opt) => HARNESS.makeBuild({ uniform, gender, membership, rank, name: { first: 'Pat', last: 'Doe', show: true }, opt: Object.assign({ rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' }, opt || {}) });

test('Class A coats: the edge-on board and the strap frame follow the strap axis the cord assets state for the coat (garment_fit), men\'s and women\'s', async () => {
  for(const [sex, fit] of [['male', 'class_a_coat'], ['female', 'class_a_coat_female']]){
    const base = await P.composeUniform(hb('blues_a', sex, 'cadet', 'C/Maj'), storeWith(same));
    // Move the strap 1 in down the sheet (100 user units).
    const moved = await P.composeUniform(hb('blues_a', sex, 'cadet', 'C/Maj'), storeWith((p, j) => {
      if(/^cords\/cord-.*\.spec\.json$/.test(p)) j.garment_fit[fit].strap_axis = j.garment_fit[fit].strap_axis.map(([x, y]) => [x, y + 100]);
      return j;
    }));
    for(const side of ['right', 'left']){
      const a = base.layers.find(l => l.key === 'epaulet:' + side), b = moved.layers.find(l => l.key === 'epaulet:' + side);
      assert.ok(a && b, `${sex} ${side}: the edge-on board is drawn`);
      assert.ok(Math.abs((b.origin.y - a.origin.y) - 1) < 0.001, `${sex} ${side}: the board's outer end moved ${(b.origin.y - a.origin.y).toFixed(3)} in with the sheet's strap axis (1 in)`);
    }
  }
});

test('Class A coat without a stated strap axis: no board is invented from a literal, and the build says so', async () => {
  const scene = await P.composeUniform(hb('blues_a', 'male', 'cadet', 'C/Maj'), storeWith((p, j) => { if(/^cords\/cord-.*\.spec\.json$/.test(p)) delete j.garment_fit; return j; }));
  assert.ok(!scene.layers.some(l => l.key === 'epaulet:left' || l.key === 'epaulet:right'), 'no edge-on board without a strap axis');
  assert.ok(scene.notes.some(n => /^No artwork for the shoulder strap position/.test(n)), 'the note says the strap position is missing');
});

test('the engine keeps no literal copy of the Class A strap axis', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  assert.ok(!/\bstrapPair\b/.test(src), 'the strapPair table is gone');
  assert.ok(!/\[16\.5[27], ?[12]\.\d+\], ?\[20\.[02]\d?, ?\d\.\d+\]/.test(src), 'no strap axis literal');
});
