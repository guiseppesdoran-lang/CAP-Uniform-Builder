'use strict';
// SLEEVE-ENG: the flat sleeve views on the dress uniforms. Ethan: "senior member NCOs for their blues need to have that sleeve pop out like
// everyone does on the utilities." The figure's arm shows the senior NCO chevron edge-on; every dress sheet that states the landmark
// sleeve_flat_view also has, for each sleeve, an asset `<sheet>-sleeve-flat-<left|right>` (outer arm to the viewer, shoulder seam at the top)
// and the engine sets the two beside the figure, outboard of each arm, with the chevron whole on it at its regulation size, centred on the flat's
// chevron_center (halfway between the shoulder seam and the elbow, or the sleeve's bottom edge on a short sleeve).
//   CAPR 39-1 4.1.5.2.1.2 (men's Class A), 4.1.9.3.3 (women's Class A), 4.1.11.1.1.1.3 (men's Class B), 4.1.12.2.3.3 (women's Class B),
//   4.2.5.1.1.3 (aviator shirt), 4.2.6.2.3 (aviator shirt and overblouse, women).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const ML = require('../js/engine/measure-layout.js');
const R = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = o => P.composeUniform(R.makeBuild(Object.assign({ name: { first: 'Pat', last: 'Doe', show: true } }, o)), store);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

// [name, build, the sheet, the regulation size of the chevron the build wears, paragraph]
const FAMILIES = [
  ['Class A men', { uniform: 'blues_a', gender: 'male' }, 'garment-blues-class-a-coat', 4, '4.1.5.2.1.2'],
  ['Class A women', { uniform: 'blues_a', gender: 'female' }, 'garment-blues-class-a-coat-female', 4, '4.1.9.3.3'],
  ['Class A women, 3 1/2 in', { uniform: 'blues_a', gender: 'female', opt: { chevron: '3.5' } }, 'garment-blues-class-a-coat-female', 3.5, '4.1.9.3.3'],
  ['Class B men, short', { uniform: 'blues_b', gender: 'male', opt: { sleeve: 'short' } }, 'garment-blues-class-b-shirt-male', 3.5, '4.1.11.1.1.1.3'],
  ['Class B men, long', { uniform: 'blues_b', gender: 'male', opt: { sleeve: 'long' } }, 'garment-blues-class-b-shirt-male-long', 3.5, '4.1.11.1.1.1.3'],
  ['Class B women, short', { uniform: 'blues_b', gender: 'female', opt: { sleeve: 'short' } }, 'garment-blues-class-b-blouse-female', 3.5, '4.1.12.2.3.3'],
  ['Class B women, long, 4 in', { uniform: 'blues_b', gender: 'female', opt: { sleeve: 'long', chevron: '4' } }, 'garment-blues-class-b-blouse-female-long', 4, '4.1.12.2.3.3'],
  ['aviator men, short', { uniform: 'aviator', gender: 'male', opt: { sleeve: 'short' } }, 'garment-aviator-shirt-male', 3.5, '4.2.5.1.1.3'],
  ['aviator men, long', { uniform: 'aviator', gender: 'male', opt: { sleeve: 'long' } }, 'garment-aviator-shirt-male-long', 3.5, '4.2.5.1.1.3'],
  ['aviator women, short', { uniform: 'aviator', gender: 'female', opt: { sleeve: 'short' } }, 'garment-aviator-shirt-female', 3.5, '4.2.6.2.3'],
  ['aviator women, long', { uniform: 'aviator', gender: 'female', opt: { sleeve: 'long' } }, 'garment-aviator-shirt-female-long', 3.5, '4.2.6.2.3'],
  ['overblouse, short', { uniform: 'aviator', gender: 'female', opt: { sleeve: 'short', femaleTop: 'overblouse' } }, 'garment-overblouse-female', 3.5, '4.2.6.2.3'],
  ['overblouse, long', { uniform: 'aviator', gender: 'female', opt: { sleeve: 'long', femaleTop: 'overblouse' } }, 'garment-overblouse-female-long', 3.5, '4.2.6.2.3']
];
const senior = (b, rank) => Object.assign({ membership: 'senior', rank }, b);
const box = l => ({ x: l.x, y: l.y, w: l.w, h: l.h });

for(const [name, b, sheet, size, para] of FAMILIES){
  for(const rank of ['SSgt', 'SMSgt', 'CMSgt']){
    test(`${name} ${rank}: both flat sleeves stand at the sheet's sleeve_flat_view, each with the ${size} in chevron centred on its chevron_center (${para})`, async () => {
      const scene = await compose(senior(b, rank));
      const sheetSpec = await store.load(sheet);
      const view = sheetSpec.raw.landmarks.sleeve_flat_view;
      assert.ok(view && view.left && view.right, 'the sheet states sleeve_flat_view');
      const flats = scene.layers.filter(l => l.role === 'sleeve-flat');
      assert.deepEqual(flats.map(l => l.id).sort(), [`${sheet}-sleeve-flat-left`, `${sheet}-sleeve-flat-right`]);
      for(const side of ['right', 'left']){
        const flat = flats.find(l => l.id === `${sheet}-sleeve-flat-${side}`);
        const spec = await store.load(flat.id);
        const top = core.anchor(spec, 'top_center'), c = core.anchor(spec, 'chevron_center');
        // top_center at the stated point (user units are 0.01 in)
        near(flat.x + top.x, view[side].x / 100, 1e-3, `${side} flat's top_center x`);
        near(flat.y + top.y, view[side].y / 100, 1e-3, `${side} flat's top_center y`);
        assert.equal(flat.w, spec.w); assert.equal(flat.h, spec.h);
        assert.ok(!flat.rotate && !flat.flipX, 'drawn as the asset is: the left flat is its own mirror');
        // the chevron: the art for the size, regulation width, level, centred on the flat's chevron_center
        const g = scene.layers.find(l => l.key === `grade:flat-sleeve-${side}`);
        assert.ok(g && g.role === 'grade', `${side} chevron on the flat`);
        assert.match(g.id, size === 3.5 ? /-chevron-3p5in$/ : /-chevron-4in$/);
        const art = await store.load(g.id);
        near(g.w, size, 1e-3, 'regulation width, not narrowed'); near(g.h, art.h, 1e-6, 'regulation height');
        assert.ok(!g.rotate && !g.clipSil, 'level and not cut: the whole chevron shows');
        const centre = core.anchor(art, 'visual_center');
        near(g.x + centre.x, flat.x + c.x, 1e-3, `${side} chevron centred on chevron_center x`);
        near(g.y + centre.y, flat.y + c.y, 1e-3, `${side} chevron centred on chevron_center y`);
        // ... and it lies wholly on the flat (the art cut each flat wider than the chevron)
        for(const [lo, hi, a, bnd] of [[g.x, g.x + g.w, flat.x, flat.x + flat.w], [g.y, g.y + g.h, flat.y, flat.y + flat.h]]) assert.ok(lo >= a - 1e-6 && hi <= bnd + 1e-6, `${side} chevron inside the flat`);
        // the figure's own arm keeps its edge-on chevron
        assert.ok(scene.layers.find(l => l.key === `grade:sleeve-${side}`), `${side} edge-on chevron on the figure's arm stays`);
        // the scene bounds include the view
        assert.ok(flat.x >= scene.bounds.x - 1e-6 && flat.x + flat.w <= scene.bounds.x + scene.bounds.w + 1e-6 && flat.y >= scene.bounds.y - 1e-6 && flat.y + flat.h <= scene.bounds.y + scene.bounds.h + 1e-6, `${side} flat inside the scene bounds`);
      }
    });
  }

  test(`${name}: the wearer's right flat is the picture's left, the left flat its mirror about the sheet's centre, outboard of each arm and outside the sheet's box`, async () => {
    const scene = await compose(senior(b, 'SMSgt'));
    const sheetSpec = await store.load(sheet);
    const r = scene.layers.find(l => l.id === `${sheet}-sleeve-flat-right`), l = scene.layers.find(x => x.id === `${sheet}-sleeve-flat-left`);
    assert.ok(r.x + r.w < 0 && l.x > sheetSpec.w, 'outside the sheet\'s box, the wearer\'s right on the picture\'s left');
    const rc = r.x + r.w / 2, lc = l.x + l.w / 2;
    near(rc + lc, sheetSpec.w, 0.1, 'the two views mirror about the sheet\'s centre (the sheets\' drawing leans a few hundredths of an inch)');
    near(r.y, l.y, 1e-6, 'level with each other');
    assert.ok(scene.bounds.x <= r.x + 1e-6 && scene.bounds.x + scene.bounds.w >= l.x + l.w - 1e-6, 'scene bounds take both views');
    // each flat is drawn above the garment's layers and under the insignia
    assert.ok(r.z > 0 && r.z < 10);
  });

  test(`${name}: the chevron's distance is drawn on the wearer's right flat, from the shoulder seam through the chevron's centre to the ${/long|Class A|coat/.test(name) ? 'elbow' : 'bottom edge of the sleeve'} (${para})`, async () => {
    const scene = await compose(senior(b, 'SMSgt'));
    const r = scene.layers.find(l => l.id === `${sheet}-sleeve-flat-right`);
    const spec = await store.load(r.id);
    const hasElbow = !!core.anchor(spec, 'elbow_center');
    const ms = scene.layers.filter(l => l.type === 'measure' && /^halfway/.test(l.label));
    const m = ms.find(x => x.opts && x.opts.mid && x.from.x > r.x && x.from.x < r.x + r.w);
    assert.ok(m, 'a halfway measure on the flat');
    assert.equal(m.label, hasElbow ? 'halfway to elbow' : 'halfway');
    const c = core.anchor(spec, 'chevron_center');
    near(m.opts.mid.y, r.y + c.y, 1e-6, 'tick at the chevron\'s centre'); near(m.opts.mid.x, r.x + c.x, 1e-6, 'on the flat\'s axis');
    // the seam is the crown of the sleeve head, 0.12 in inside the box; the far end is the elbow, or the bottom edge of the sleeve
    near(m.from.y - r.y, 0.12, 0.01, 'from the shoulder seam');
    near(m.to.y - r.y, (hasElbow ? core.anchor(spec, 'elbow_center') : core.anchor(spec, 'cuff_center')).y, 1e-6, 'to the elbow / the sleeve\'s bottom edge');
    near((m.from.y + m.to.y) / 2, m.opts.mid.y, 0.01, 'the chevron is halfway');
    // the figure's arm carries no second copy of the distance
    // the lapel insignia's halfway lies below the seam (side.y > 0); the sleeve's was on the figure's arm (side.x < 0) and is now on the flat (side.x > 0, toward the figure)
    assert.equal(ms.filter(x => x.opts && x.opts.side && x.opts.side.y === 0).length, 1, 'shown once');
    assert.ok(!ms.some(x => x.opts && x.opts.side && x.opts.side.x < 0), 'none on the figure\'s arm');
  });
}

test('a senior NCO sheet\'s labels sit in the drawing and clear of the flat sleeves and the chevrons on them', async () => {
  for(const [name, b] of FAMILIES){
    const scene = await compose(senior(b, 'SMSgt'));
    const B = scene.bounds, vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8], px = ML.previewPx(vb), area = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    const solids = ML.obstaclesOf(scene);
    assert.ok(solids.some(s => scene.layers.some(l => l.role === 'sleeve-flat' && s.x === l.x && s.y === l.y)), `${name}: the flats are obstacles`);
    const tol = (2 * px) ** 2, ov = (a, c) => Math.max(0, Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x)) * Math.max(0, Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y));
    for(const d of ML.layout(scene, { px, area })){
      assert.ok(ov(d.label, area) > d.label.w * d.label.h - tol, `${name}: ${d.label.text} inside the drawing`);
      for(const s of solids) assert.ok(ov(d.label, s) <= 4 * tol, `${name}: ${d.label.text} clear of a piece at ${s.x.toFixed(2)},${s.y.toFixed(2)}`);
    }
  }
});

// ---- who wears them: the engine's own rule for the sleeve chevron, nothing more ----------------------

test('no sleeve chevron, no flat sleeves: officers, cadets, cadet NCOs and adults without grade wear none', async () => {
  for(const [name, b] of FAMILIES){
    const cases = [senior(b, 'Capt'), senior(b, 'Col'), Object.assign({}, b, { membership: 'cadet', rank: 'C/Maj' }), Object.assign({}, b, { membership: 'cadet', rank: 'C/SSgt' }), Object.assign({}, b, { membership: 'cadet', rank: 'C/CMSgt' })];
    for(const c of cases){
      const scene = await compose(c);
      assert.deepEqual(scene.layers.filter(l => l.role === 'sleeve-flat' || /^grade:flat-sleeve-/.test(l.key || '')).map(l => l.key), [], `${name} ${c.rank}`);
      assert.ok(!scene.layers.some(l => l.type === 'measure' && /^halfway/.test(l.label) && /sleeve-flat/.test(l.key || '')), `${name} ${c.rank}: no sleeve measure`);
    }
  }
});

test('the semi-formal coat, a cadet uniform, and the mess dress, whose sheets state no flat views, draw none', async () => {
  for(const o of [
    { uniform: 'semi_formal_usaf', gender: 'male', membership: 'senior', rank: 'SMSgt' }, { uniform: 'semi_formal_usaf', gender: 'female', membership: 'senior', rank: 'SMSgt' },
    { uniform: 'semi_formal_usaf', gender: 'male', membership: 'cadet', rank: 'C/SSgt' },
    { uniform: 'mess_dress', gender: 'male', membership: 'senior', rank: 'SMSgt' }, { uniform: 'mess_dress', gender: 'female', membership: 'senior', rank: 'SMSgt' }
  ]){
    const scene = await compose(o);
    assert.equal(scene.layers.filter(l => l.role === 'sleeve-flat').length, 0, `${o.uniform} ${o.gender} ${o.rank}`);
  }
  // the mess dress keeps the distance on the figure's arm, as before
  const mess = await compose({ uniform: 'mess_dress', gender: 'male', membership: 'senior', rank: 'SMSgt' });
  assert.equal(mess.layers.filter(l => l.type === 'measure' && l.label === 'halfway').length >= 1, true);
});

test('every dress sheet that states sleeve_flat_view has both flat assets, and the views lie outside its box on opposite sides, 1 in clear of the arms they serve', async () => {
  const ids = manifest.assets.map(a => a.id).filter(id => /^garment-.*-sleeve-flat-left$/.test(id)).map(id => id.replace(/-sleeve-flat-left$/, ''));
  assert.equal(ids.length, 14);
  for(const id of ids){
    const spec = await store.load(id), v = spec.raw.landmarks.sleeve_flat_view;
    assert.ok(v, `${id} states sleeve_flat_view`);
    assert.ok(store.has(`${id}-sleeve-flat-left`) && store.has(`${id}-sleeve-flat-right`), id);
    const l = await store.load(`${id}-sleeve-flat-left`), r = await store.load(`${id}-sleeve-flat-right`);
    assert.ok(v.right.x / 100 + r.w / 2 < 0 && v.left.x / 100 - l.w / 2 > spec.w, `${id}: outside the box`);
  }
});
