'use strict';
// A garment sheet can carry a group hidden in the file (display="none") for a state of the uniform that only some members wear: the four Class B sheets carry the
// honor guard collar (group collar-honor-guard, CAPR 39-1 9.6) that way, so every drawing that does not ask for it is the sheet as it was. The engine hides groups
// by setting display="none" (hideGroups) and, for this, shows one by taking the attribute off (showGroups). The shown and the hidden sheet are separate symbols in the drawing,
// and the collar redrawn over the badges (onlyGroups) shows the group too.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const SHEETS = ['garment-blues-class-b-shirt-male', 'garment-blues-class-b-shirt-male-long', 'garment-blues-class-b-blouse-female', 'garment-blues-class-b-blouse-female-long'];
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const svgOf = id => fs.readFileSync(path.join(root, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');

test('a placed layer carries the groups it shows, and a layer that names none carries no such field', async () => {
  const spec = await store.load(SHEETS[0]);
  const shown = core.placeAsset(spec, { at: { x: 1, y: 1 }, showGroups: ['collar-honor-guard'] });
  assert.deepEqual(shown.showGroups, ['collar-honor-guard']);
  assert.ok(!('showGroups' in core.placeAsset(spec, { at: { x: 1, y: 1 } })), 'the plain layer is as it was');
});

for(const id of SHEETS){
  test(`${id}: the honor guard collar group is hidden in the file, so the sheet draws as it did until a drawing shows it`, async () => {
    const svg = svgOf(id);
    assert.match(svg, new RegExp(`<g id="${id}__collar-honor-guard" display="none">`), 'the group carries display="none"');
    const spec = await store.load(id);
    const lm = spec.landmarks.collar_honor_guard;
    assert.equal(lm.group, 'collar-honor-guard');
    assert.ok(Array.isArray(lm.hides) && lm.hides.length >= 3, 'the spec lists what the state hides');
    // the collar it replaces is a group the sheet draws: the everyday open collar (short sheets) or the closed collar (long sheets); the tie or tab is hidden too
    assert.ok(lm.hides.some(name => new RegExp(`id="${id}__${name}"`).test(svg) && /^collar/.test(name)), 'the collar group it replaces is in the sheet');
    assert.ok(lm.hides.includes('tie') && lm.hides.includes('tie-tab'), 'the tie and the tab are hidden with it');
    assert.ok(spec.landmarks.collar_honor_guard_right.points.length === 6 && spec.landmarks.collar_honor_guard_left.points.length === 6, 'the leaves are stated');
  });
}

test('the renderer shows a hidden group by taking its display off, in a symbol of its own, and in the collar redrawn over the badges', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'render-svg.js'), 'utf8');
  // the symbol key: a shown sheet is not the hidden one
  assert.match(src, /layer\.showGroups && layer\.showGroups\.length \? '--show-' \+ layer\.showGroups\.join\('-'\)/);
  // the plain symbol branch
  assert.match(src, /layer\.showGroups\.forEach\(g => \{ const n = byId\(g\); if\(n\) n\.removeAttribute\('display'\); \}\)/);
  // the branch that draws the named groups only
  assert.match(src, /layer\.showGroups && layer\.showGroups\.includes\(g\)\) n\.removeAttribute\('display'\)/);
});
