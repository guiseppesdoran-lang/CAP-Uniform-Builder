'use strict';
// The white parade gloves of the Honor Guard Uniform (CAPR 39-1 9.6.7.7), drawn. One overlay per sheet (`<sheet id>-honor-guard-gloves`), on the sheet's own origin like the belt, the flag sling and
// the ascot: a gloved hand at each cuff on the two coats and the two long sleeve sheets (group gloves-worn), the folded pair on the two short sleeve sheets (group gloves-under-belt for a guard,
// gloves-under-sling for a flag bearer). They lie over the belt or the sling and under the ascot. Three of the overlays are taller than their sheet because the fingers hang past its lower edge, and the
// drawing makes room below for them for this uniform only; every other drawing is as it was.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const HARNESS = require('../scripts/render-builds.cjs');
const PT = require('../js/placement-templates.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const loader = p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8')));
const store = core.createSpecStore(manifest, loader);
// The same art without the six overlays: what the drawing was before they were drawn.
const without = Object.assign({}, manifest, { assets: manifest.assets.filter(a => !/-honor-guard-gloves$/.test(a.id)) });
const storeWithout = core.createSpecStore(without, loader);
const compose = (b, s) => P.composeUniform(b, s || store);
const svgOf = id => fs.readFileSync(path.join(root, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');

// The sheets, what each draws, and how much taller than its sheet the overlay is (the spec's dimensions.extra_height_in).
const CUTS = [
  { sheet: 'garment-blues-class-a-coat', uniform: 'blues_a', gender: 'male', opt: {}, form: 'worn', extra: 0.25, name: "men's coat" },
  { sheet: 'garment-blues-class-a-coat-female', uniform: 'blues_a', gender: 'female', opt: {}, form: 'worn', extra: 1.85, name: "women's coat" },
  { sheet: 'garment-blues-class-b-shirt-male', uniform: 'blues_b', gender: 'male', opt: { sleeve: 'short' }, form: 'folded', extra: 0, name: "men's shirt, short" },
  { sheet: 'garment-blues-class-b-shirt-male-long', uniform: 'blues_b', gender: 'male', opt: { sleeve: 'long' }, form: 'worn', extra: 1.5, name: "men's shirt, long" },
  { sheet: 'garment-blues-class-b-blouse-female', uniform: 'blues_b', gender: 'female', opt: { sleeve: 'short' }, form: 'folded', extra: 0, name: "women's blouse, short" },
  { sheet: 'garment-blues-class-b-blouse-female-long', uniform: 'blues_b', gender: 'female', opt: { sleeve: 'long' }, form: 'worn', extra: 0, name: "women's blouse, long" }
];
const glovesId = cut => `${cut.sheet}-honor-guard-gloves`;
const build = (cut, o) => HARNESS.makeBuild(Object.assign({
  uniform: cut.uniform, gender: cut.gender, membership: 'cadet', rank: 'C/Maj', name: { first: 'Pat', last: 'Doe', show: true },
  opt: Object.assign({ headgear: 'auto' }, cut.opt)
}, o || {}));
const guard = (cut, role) => build(cut, { ceremonial: { role, chinstrap: 'down' }, cord: 'honor_guard', cordOnTop: true });
const glovesOf = scene => scene.layers.filter(l => l.role === 'honor-guard-gloves');
const round = n => Math.round(n * 10000) / 10000;
// A scene as text, for comparing two drawings (a measurement's key counts the layers before it, so it is left out). The assertion says only that they differ: the text is long.
const text = layers => JSON.stringify(layers.map(l => (l.role === 'measure' ? Object.assign({}, l, { key: null }) : l)));
const bottom = scene => round(scene.bounds.y + scene.bounds.h);

test('the six overlays are in the manifest, each the size of its sheet, or taller by what the spec says, on the sheet\'s own width and origin', async () => {
  for(const cut of CUTS){
    const id = glovesId(cut);
    assert.ok(store.has(id), `${cut.name}: in the manifest`);
    const [g, sheet] = [await store.load(id), await store.load(cut.sheet)];
    assert.ok(Math.abs(g.w - sheet.w) < 1e-3, `${cut.name}: the sheet's width, ${g.w} against ${sheet.w}`);
    assert.ok(Math.abs(g.h - sheet.h - cut.extra) < 1e-3, `${cut.name}: ${g.h} against the sheet's ${sheet.h} and ${cut.extra} in more`);
    const lm = g.raw.landmarks.sheet_box;
    assert.deepEqual([lm.x, lm.y], [0, 0], `${cut.name}: the sheet's box lies at the overlay's origin`);
    assert.ok(Math.abs(lm.w_in - sheet.w) < 1e-3 && Math.abs(lm.h_in - sheet.h) < 1e-3, `${cut.name}: and is the sheet's size`);
    assert.equal(g.raw.dimensions.extra_height_in, cut.extra, `${cut.name}: what the spec says of the extra height`);
    assert.doesNotMatch(svgOf(id), /<image|data:image/, `${cut.name}: vector art, no raster`);
  }
});

test('the groups of each overlay: the worn hands are shown in the file; the folded pair under the belt is shown and the pair under the sling hidden', () => {
  for(const cut of CUTS){
    const id = glovesId(cut), svg = svgOf(id);
    if(cut.form === 'worn'){
      assert.match(svg, new RegExp(`<g id="${id}__gloves-worn"[^>]*mask=`), `${cut.name}: the group, with the mask that takes back what the sleeve and body cover`);
      assert.doesNotMatch(svg, new RegExp(`<g id="${id}__gloves-worn"[^>]*display="none"`), `${cut.name}: shown`);
      assert.doesNotMatch(svg, /gloves-under-/, `${cut.name}: no folded pair`);
    }else{
      assert.match(svg, new RegExp(`<g id="${id}__gloves-under-belt">`), `${cut.name}: the pair under the belt is shown`);
      assert.match(svg, new RegExp(`<g id="${id}__gloves-under-sling" display="none">`), `${cut.name}: the pair under the sling is hidden`);
      assert.doesNotMatch(svg, /gloves-worn/, `${cut.name}: no worn hands`);
    }
  }
});

for(const cut of CUTS) for(const role of ['guard', 'flag']){
  test(`${cut.name}, ${role === 'flag' ? 'flag bearer' : 'guard'}: one overlay of gloves on the sheet's box, over the ${role === 'flag' ? 'sling' : 'belt'} and under the ascot, ${cut.form === 'worn' ? 'the worn hands' : role === 'flag' ? 'the pair under the sling' : 'the pair under the belt'}`, async () => {
    const scene = await compose(guard(cut, role));
    const gloves = glovesOf(scene);
    assert.equal(gloves.length, 1, 'one');
    const l = gloves[0], spec = await store.load(glovesId(cut));
    assert.equal(l.id, glovesId(cut));
    assert.equal(l.key, 'honor-guard:honor-guard-gloves');
    assert.equal(l.title, 'The white parade gloves');
    assert.deepEqual([l.x, l.y, l.w, l.h, l.rotate], [0, 0, spec.w, spec.h, 0], 'at the sheet\'s origin, at its own size: nothing stretched');
    const at = id => scene.layers.findIndex(x => x.id === id);
    const strap = role === 'flag' ? `${cut.sheet}-honor-guard-flag-sling` : `${cut.sheet}-honor-guard-belt`;
    const ascot = `${cut.sheet}-honor-guard-ascot`;
    assert.ok(at(strap) >= 0 && at(ascot) >= 0, 'the strap and the ascot are drawn');
    assert.ok(at(strap) < scene.layers.indexOf(l) && scene.layers.indexOf(l) < at(ascot), 'drawn after the belt or sling, before the ascot');
    const z = id => scene.layers[at(id)].z;
    assert.ok(z(strap) < l.z && l.z < z(ascot), `over the ${role === 'flag' ? 'sling' : 'belt'} (${z(strap)}), under the ascot (${z(ascot)}): ${l.z}`);
    assert.equal(scene.layers.filter(x => x.id === `${cut.sheet}-honor-guard-belt` || x.id === `${cut.sheet}-honor-guard-flag-sling`).length, 1, 'still the belt or the sling, never both');
    if(cut.form === 'folded' && role === 'flag'){
      assert.deepEqual(l.showGroups, ['gloves-under-sling'], 'the pair under the sling\'s band');
      assert.deepEqual(l.hideGroups, ['gloves-under-belt'], 'and the belt\'s pair left off: the two overlap');
    }else{
      assert.equal(l.showGroups, undefined, 'the file\'s own groups: shown');
      assert.equal(l.hideGroups, undefined);
    }
    assert.ok(!scene.notes.some(n => /glove/i.test(n)), 'nothing said of them');
  });
}

test('the women\'s long blouse draws the hands in the slacks state, the only state Honor Guard draws it in: the sheet hides the skirt and shows the slacks', async () => {
  const cut = CUTS.find(c => c.sheet === 'garment-blues-class-b-blouse-female-long');
  for(const role of ['guard', 'flag']){
    const scene = await compose(guard(cut, role));
    const sheet = scene.layers.find(l => l.role === 'garment');
    assert.deepEqual([...sheet.hideGroups].filter(g => /^lower-skirt/.test(g)).sort(), ['lower-skirt', 'lower-skirt-clip'], `${role}: no skirt`);
    assert.deepEqual([...sheet.showGroups].filter(g => /^lower-slacks/.test(g)).sort(), ['lower-slacks', 'lower-slacks-outline'], `${role}: slacks`);
    assert.equal(glovesOf(scene).length, 1);
    assert.equal(glovesOf(scene)[0].showGroups, undefined, 'the overlay\'s mask is the slacks\' own: nothing to set on it');
  }
});

test('the gloves are drawn for the Honor Guard Uniform only: every other build of the six sheets, a cadet\'s and a senior member\'s, draws exactly as before', async () => {
  for(const cut of CUTS) for(const membership of ['cadet', 'senior']){
    const b = build(cut, membership === 'senior' ? { membership, rank: 'Capt' } : {});
    const [a, z] = [await compose(b), await compose(b, storeWithout)];
    assert.equal(glovesOf(a).length, 0, `${cut.name}, ${membership}: no gloves`);
    assert.equal(a.layers.some(l => /gloves/.test(l.id)), false);
    assert.ok(text(a.layers) === text(z.layers) && JSON.stringify(a.bounds) === JSON.stringify(z.bounds), `${cut.name}, ${membership}: the scene is the one without the overlays`);
  }
  // A senior member is not offered the uniform, and the cadet semi-formal shares the coat's drawing and is not it either: asked for Honor Guard they draw nothing of it.
  for(const [name, o] of [['a senior member', { membership: 'senior', rank: 'Capt' }], ['the semi-formal', { uniform: 'semi_formal_usaf' }]]){
    const scene = await compose(build(CUTS[0], Object.assign({ ceremonial: { role: 'flag', chinstrap: 'down' } }, o)));
    assert.equal(scene.layers.some(l => /honor-guard/.test(l.id)), false, `${name}: no honor guard piece at all`);
    assert.equal(glovesOf(scene).length, 0);
  }
});

test('the canvas makes room below for the three overlays taller than their sheet, for the Honor Guard Uniform only: the same left, top and width, a lower bottom by the spec\'s extra height', async () => {
  for(const cut of CUTS) for(const role of ['guard', 'flag']){
    const b = guard(cut, role);
    const [a, z] = [await compose(b), await compose(b, storeWithout)];
    const [x0, x1] = [a.bounds, z.bounds];
    assert.deepEqual([round(x0.x), round(x0.y), round(x0.w)], [round(x1.x), round(x1.y), round(x1.w)], `${cut.name}, ${role}: nothing moves at the left, the top or the width`);
    assert.ok(Math.abs(bottom(a) - bottom(z) - cut.extra) < 1e-3, `${cut.name}, ${role}: ${bottom(z)} grows to ${bottom(a)}, by ${cut.extra}`);
    const spec = await store.load(glovesId(cut));
    assert.ok(bottom(a) + 1e-6 >= spec.h, 'the overlay is inside the canvas');
    for(const side of ['right', 'left']){
      const tip = core.anchor(spec, `glove_${side}_fingertip`);
      if(!tip) continue;
      assert.ok(tip.y <= bottom(a) + 1e-6, `${cut.name}, ${role}: the ${side} fingertip (${tip.y}) is inside the canvas (${bottom(a)})`);
      if(cut.extra > 0) assert.ok(bottom(a) - tip.y < 0.25, `${cut.name}, ${role}: and the lowest ink of the sheet, a hair above the canvas's bottom`);
    }
    // Everything that was in the scene is where it was.
    const keep = l => !/-honor-guard-gloves$/.test(l.id);
    assert.ok(text(a.layers.filter(keep)) === text(z.layers), `${cut.name}, ${role}: every other layer as it was`);
  }
  // The numbers the owner reads: how much taller.
  const grown = [];
  for(const cut of CUTS){ const b = guard(cut, 'guard'); grown.push(round(bottom(await compose(b)) - bottom(await compose(b, storeWithout)))); }
  assert.deepEqual(grown, [0.25, 1.85, 0, 1.5, 0, 0]);
});

test('the placement template (the paper and the jig) is a stencil for what is pinned and draws no garment art: the gloves are not in it, and it plans as it did', async () => {
  const cut = CUTS[0], meta = { uniform: 'blues_a', rank: 'C/Maj', name: 'Pat Doe', uniformLabel: 'Test garment' };
  const b = guard(cut, 'guard');
  const [a, z] = [await compose(b), await compose(b, storeWithout)];
  const [pa, pz] = [await PT.plan(a, id => store.load(id), meta), await PT.plan(z, id => storeWithout.load(id), meta)];
  assert.ok(JSON.stringify(pa) === JSON.stringify(pz), 'the same plan');
  assert.doesNotMatch(JSON.stringify(pa), /glove/i);
});
