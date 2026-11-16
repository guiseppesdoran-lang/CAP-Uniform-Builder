'use strict';
// The owner (2026-11-12): "for the non auto 4 rack it should have the lapel be above". A four-wide rack the member chose is drawn in full with the coat's lapel over the ribbons that
// reach it (CAPR 39-1, 11.1.8): in the drawing (tests/item-pickers.test.cjs checks every coat), in the layout tiles, and in the pictures of the Photos menu, whose Ribbon rack and Left
// chest parts keep the coat's own lapel above the ribbons.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const core = require('../js/engine/core.js');
const awards = require('../js/engine/awards.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const parts = require('../js/engine/parts.js');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

const ribbons = n => Array.from({ length: n }, (_, i) => ({ key: 'ribbon:r' + i, id: 'r' + i, title: 'r' + i, asset: 'ribbon-armstrong-achievement', devices: [], centered: false }));
const buildOf = (uniform, membership, rank, gender, n, opt) => ({
  uniform, gender, membership, grade: G.gradeInfo(membership, rank, {}), opt: Object.assign({ headgear: 'none' }, opt), name: { first: '', last: '', show: false },
  ribbons: ribbons(n), medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
});
const lapelFg = scene => scene.layers.find(l => l.key === 'layer:foreground' && (l.onlyGroups || []).includes('lapel-left'));
const aboveRibbons = scene => { const fg = lapelFg(scene); return !!fg && scene.layers.filter(l => l.role === 'ribbon' || l.role === 'device').every(l => fg.z > l.z); };

test('the Photos menu\'s Ribbon rack and Left chest parts of a chosen four-wide rack keep the coat\'s lapel above the ribbons, as the figure has it', async () => {
  for(const gender of ['male', 'female']){
    for(const opt of [{ rackColumns: 4, rackAlign: 'outboard' }, { rackColumns: 4 }]){
      const scene = await P.composeUniform(buildOf('blues_a', 'senior', 'Capt', gender, 28, Object.assign({ rackArrangement: 'standard' }, opt)), store);
      assert.ok(aboveRibbons(scene), `${gender}: the figure`);
      const planned = parts.plan(scene, null, null);
      const kinds = planned.parts.map(p => p.kind);
      assert.ok(kinds.includes('rack'), `${gender}: a Ribbon rack part`);
      for(const part of planned.parts.filter(p => p.kind === 'rack' || p.kind === 'chest-left')){
        const picture = parts.sceneFor(scene, planned, part);
        assert.ok(picture.layers.some(l => l.role === 'ribbon'), `${gender} ${part.kind}: the ribbons`);
        assert.ok(aboveRibbons(picture), `${gender} ${part.kind}: the lapel is above the ribbons in the part's picture`);
      }
    }
  }
});

test('the layout tiles are drawn from the same layers (js/option-pictures.js rackScene keeps the coat, the lapel foreground and the ribbons), not from a diagram', () => {
  const op = read('js/option-pictures.js');
  const code = op.slice(op.indexOf('async function rackScene'), op.indexOf('const rackSignature'));
  assert.match(code, /scene\.layers\.filter\(l => \(!l\.figure \|\| l\.figure === 1\) && l\.type !== 'clear' && l\.type !== 'measure'\)/, 'every layer of the figure but the measures: the coat and its lapel included');
  assert.doesNotMatch(op, /rackMarkup|fill-opacity="0\.14"/, 'no diagram of rectangles over a lapel polygon');
});
