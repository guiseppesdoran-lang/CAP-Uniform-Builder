'use strict';
// CORD (owner, 2026-11-11: "i like how their cords look much better in this doc. can you update all cords to look like that") and SUP (the wing and region supplements' cords).
// Every shoulder cord, the seven of the regulation and the 58 of the supplements, is the one braid: the engine lays the cord's look (js/engine/cords.js: which cord, the member's colour
// for a cord the unit commander picks) on the layer of the garment's cord sheet that carries the geometry, along the path it fits to the armhole seam, wholly under the epaulet; the
// renderer draws that look with CordBraid (js/engine/cord-braid.js). The regulation cords keep their per-garment sheets as carriers, a supplement cord rides the honor guard cord's, the path
// does not change, an aiguillette is the Aide de Camp pendant in the cord's colour, and one switch lays the cord over the epaulet (the Honor Guard uniform) where it is off by default.
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
const CORDS = require('../js/engine/cords.js');
const CB = require('../js/engine/cord-braid.js');
const LIST = require('../data/cords.js');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

const CUTS = [
  ['garment-blues-class-a-coat', 'blues_a', 'male', {}], ['garment-blues-class-a-coat-female', 'blues_a', 'female', {}],
  ['garment-blues-class-b-shirt-male', 'blues_b', 'male', { sleeve: 'short' }], ['garment-blues-class-b-shirt-male-long', 'blues_b', 'male', { sleeve: 'long' }],
  ['garment-blues-class-b-blouse-female', 'blues_b', 'female', { sleeve: 'short' }], ['garment-blues-class-b-blouse-female-long', 'blues_b', 'female', { sleeve: 'long' }]
];
const ALL = CORDS.REGULATION.concat(CORDS.supplementIds());
const hb = (uniform, gender, opt, cord, extra) => Object.assign(HARNESS.makeBuild({ uniform, gender, membership: 'cadet', rank: 'C/Maj', cord, name: { first: 'Pat', last: 'Doe', show: true }, opt: Object.assign({ headgear: 'none' }, opt) }), extra || {});
const colourFor = id => CORDS.needsColour(id) ? CORDS.chosenColours()[0].name : null;
const compose = (cut, cord, extra) => P.composeUniform(hb(cut[1], cut[2], cut[3], cord, Object.assign({ cordColour: colourFor(cord) }, extra)), store);
const runOf = scene => scene.layers.find(l => l.cordLook && !l.cordLook.pendant && !l.cordLook.tip);
const pendantOf = scene => scene.layers.find(l => l.cordLook && l.cordLook.pendant);
const tipOf = scene => scene.layers.find(l => l.cordLook && l.cordLook.tip);

test('every cord of the list is drawn on every cut that takes one, on the carrier sheet, along the very path the honor guard cord takes, wholly under the epaulet', async () => {
  let n = 0;
  for(const cut of CUTS){
    const base = await compose(cut, 'honor_guard'), ref = runOf(base);
    assert.ok(ref && ref.cordPath, `${cut[0]}: the honor guard cord is drawn`);
    assert.equal(ref.id, `${cut[0]}-cord-honor-guard`);
    assert.ok(Array.isArray(ref.clip) && ref.clip.length === 4, `${cut[0]}: cut to the garment side of the epaulet's lower edge`);
    for(const id of ALL){
      const scene = await compose(cut, id), cl = runOf(scene);
      const tag = `${cut[0]} ${id}`;
      assert.ok(cl && cl.cordPath, `${tag}: drawn`);
      assert.equal(cl.id, `${cut[0]}-cord-${CORDS.carrierOf(id)}`, `${tag}: on its carrier sheet`);
      assert.deepEqual(cl.cordLook, { id, colour: colourFor(id) }, `${tag}: the look the renderer draws`);
      assert.equal(cl.cordPath.d, ref.cordPath.d, `${tag}: the path is the one it always was`);
      // every cord is as wide as the engine's cord, but the Aide de Camp cord's run, which is drawn as wide as the aiguillette's braids beside it
      const sheetThick = id === 'aide_de_camp' ? (await store.load(`${cut[0]}-cord-aide-de-camp`)).raw.dimensions.braid_thickness_in : core.CORD_WIDTH;
      assert.equal(cl.cordPath.width, sheetThick, `${tag}: the braid's width`);
      assert.deepEqual(cl.clip, ref.clip, `${tag}: wholly under the epaulet`);
      assert.equal(cl.z, ref.z, `${tag}: the cord's layer`);
      assert.equal(cl.clipSil, cut[0]);
      assert.equal(cl.clipOuter, true);
      assert.ok(!scene.notes.some(t => /cord/i.test(t)), `${tag}: no note: ${scene.notes.join(' | ')}`);
      n++;
    }
  }
  assert.equal(n, CUTS.length * 65);
});

test('only a cord that names an aiguillette hangs one: the Aide de Camp pendant in the cord\'s own colour, with its tip, beside the cord\'s run', async () => {
  const WITH = ALL.filter(id => CORDS.hasAiguillette(id));
  assert.deepEqual(WITH.slice().sort(), ['aide_de_camp', 'fl-honor-society-high-distinction', 'fl-leadership-academy-instructor']);
  for(const cut of CUTS) for(const id of ALL){
    const scene = await compose(cut, id), aide = scene.layers.filter(l => l.id === `${cut[0]}-cord-aide-de-camp`);
    const tag = `${cut[0]} ${id}`;
    if(!WITH.includes(id)){ assert.equal(aide.length, 0, `${tag}: no aiguillette`); continue; }
    const pend = pendantOf(scene), tip = tipOf(scene), run = runOf(scene), thick = (await store.load(`${cut[0]}-cord-aide-de-camp`)).raw.dimensions.braid_thickness_in;
    assert.ok(pend && pend.cordPath.pendant && tip && /:tip$/.test(tip.key) && run, `${tag}: a run, a pendant braid and a tip`);
    assert.deepEqual(pend.cordLook, { pendant: true, id, colour: null }, `${tag}: the pendant is drawn in the cord's aiguillette colour`);
    assert.deepEqual(tip.cordLook, { tip: true, id, colour: null }, `${tag}: and the tip in its metal`);
    assert.equal(pend.cordPath.width, thick, `${tag}: the pendant's braid is the sheet's braid thickness`);
    assert.equal(run.id, `${cut[0]}-cord-${CORDS.carrierOf(id)}`);
    assert.equal(new Set(scene.layers.map(l => l.key)).size, scene.layers.length, `${tag}: every layer has its own key`);
    assert.ok(pend.z < 8 && tip.z < 8 && run.z < 8, `${tag}: under the epaulet layer`);
    assert.ok(Array.isArray(pend.clip), `${tag}: the pendant comes out from under the epaulet too`);
    assert.equal(aide.filter(l => l.cordPath && !l.cordPath.pendant).length, id === 'aide_de_camp' ? 1 : 0, `${tag}: the aide sheet carries the run only for the aide cord`);
    if(id !== 'aide_de_camp') assert.equal(run.cordPath.width, core.CORD_WIDTH, `${tag}: the Florida cord's own run is as wide as every other cord`);
  }
});

test('a cord whose colour the unit commander picks is drawn in the member\'s colour; with none, or a colour of a regulation cord, it is not drawn and a note says why', async () => {
  const cut = CUTS[2];
  for(const id of ['de-unit-award', 'nc-unit-award']){
    for(const bad of [null, '', 'green', 'silver', 'teal', 'constructor']){
      const scene = await compose(cut, id, { cordColour: bad });
      assert.equal(scene.layers.filter(l => l.cordLook).length, 0, `${id} with ${JSON.stringify(bad)}: nothing drawn`);
      assert.ok(scene.notes.some(t => /unit commander chooses the colour/.test(t)), `${id} ${bad}: a note`);
    }
    for(const c of CORDS.chosenColours()){
      const scene = await compose(cut, id, { cordColour: c.name });
      assert.deepEqual(runOf(scene).cordLook, { id, colour: c.name });
    }
  }
  // another cord ignores a colour it was not asked for
  assert.deepEqual(runOf(await compose(cut, 'ner-rcls', { cordColour: 'orange' })).cordLook, { id: 'ner-rcls', colour: null });
  assert.deepEqual(runOf(await compose(cut, 'wing', { cordColour: 'orange' })).cordLook, { id: 'wing', colour: null });
});

test('a cord the list does not know is not drawn, and says so; senior members wear only the Aide de Camp cord', async () => {
  const cut = CUTS[0];
  for(const bad of ['banana', 'cord-group', 'color-guard', 'NER-RCLS']){
    const scene = await compose(cut, bad);
    assert.equal(scene.layers.filter(l => l.cordLook).length, 0, bad);
    assert.ok(scene.notes.some(t => /shoulder cord cannot be shown/.test(t)), bad);
  }
  const senior = (cord, rank) => P.composeUniform(HARNESS.makeBuild({ uniform: 'blues_a', gender: 'male', membership: 'senior', rank: rank || 'Capt', cord, name: { first: 'Pat', last: 'Doe', show: true } }), store);
  assert.equal((await senior('ner-rcls')).layers.filter(l => l.cordLook).length, 0, 'a supplement cord is a cadet cord');
  assert.equal((await senior('wing')).layers.filter(l => l.cordLook).length, 0);
  const aide = await senior('aide_de_camp');
  assert.ok(runOf(aide) && pendantOf(aide), 'the aide cord is worn by senior members too');
});

test('the cord lies under the epaulet unless the cord layer\'s switch says on top: off by default, on puts it over the epaulet layer with nothing cut from it', async () => {
  for(const cut of CUTS){
    const off = runOf(await compose(cut, 'honor_guard')), on = runOf(await compose(cut, 'honor_guard', { cordOnTop: true }));
    assert.ok(off.z < 8 && Array.isArray(off.clip), `${cut[0]}: under by default`);
    assert.ok(on.z > 8 && !('clip' in on), `${cut[0]}: on top when asked (z ${on.z})`);
    assert.equal(on.cordPath.d, off.cordPath.d, `${cut[0]}: the same path either way`);
    assert.deepEqual(on.cordLook, off.cordLook);
  }
});

// ---- what the renderer makes of the layer --------------------------------------------------------------------------------------------------------------------------------------
global.self = global.self || global;
global.CordBraid = CB;
require('../js/engine/render-svg.js');
const RS = global.self.CAPUBEngine.renderSvg;
global.self.CAPUBEngine.cords = CORDS;
global.self.CAPUBEngine.core = core;
const nums = d => (String(d).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
const ART = { tx: 1342.968, ty: 10, s: 100 };   // the cord sheets' art group: translate(tx ty) scale(s), 0.01 in units: art units are inches
const braidOf = layer => RS.cordBraid(layer, ART.tx, ART.ty, ART.s, 'test-');
const coordsOf = markup => [...markup.matchAll(/\sd="([^"]+)"/g)].flatMap(m => { const v = nums(m[1].replace(/[A-Za-z]/g, ' ')); const o = []; for(let i = 0; i + 1 < v.length; i += 2) o.push([v[i], v[i + 1]]); return o; });

test('the renderer draws every cord with CordBraid: the cord\'s colours are in the markup, the braid lies along the fitted path, and only a cord with a strand has extras', async () => {
  const cut = CUTS[2];
  for(const id of ALL){
    const scene = await compose(cut, id), cl = runOf(scene), entry = CORDS.entry(id), cord = CORDS.resolve(id, colourFor(id));
    const b = braidOf(cl);
    assert.ok(b && b.run.length > 500, `${id}: a braid`);
    for(const c of cord.colours) assert.ok(b.run.includes(c.main), `${id}: ${c.main} is in the braid`);
    if(entry.style === 'interwoven' || entry.style === 'edge-centre') assert.equal(cord.colours.length, 2, id);
    assert.equal(b.extras.length > 0, !!(entry.strand || entry.knot), `${id}: extras only where the list says`);
    assert.ok(/id="test-braid"/.test(b.run), `${id}: ids carry the prefix the renderer gives`);
    // the braid is laid along the fitted path: every point of it within half the braid's width (and the bow of a lobe's edge) of the path's own points, which are in sheet inches
    const sheet = core.samplePath(cl.cordPath.pieces, 0.02).map(p => [p[0] - ART.tx / 100, p[1] - ART.ty / 100]);
    const half = cl.cordPath.width / 2 + 0.1;
    for(const q of coordsOf(b.run)){
      const dist = Math.min(...sheet.map(p => Math.hypot(p[0] - q[0], p[1] - q[1])));
      assert.ok(dist <= half, `${id}: a point of the braid is ${dist.toFixed(3)} in from the path`);
    }
  }
});

test('the renderer hands CordBraid the fitted path in the sheet\'s drawing units, whatever the art group\'s scale, and the width in inches', async () => {
  const cl = runOf(await compose(CUTS[3], 'wing'));
  const seen = [];
  const real = global.CordBraid;
  global.CordBraid = Object.assign({}, real, { draw: (points, cord, opts) => { seen.push({ points, opts }); return real.draw(points, cord, opts); } });
  try{
    RS.cordBraid(cl, 0, 0, 100, 'a-');
    RS.cordBraid(cl, 50, 20, 25, 'b-');
  }finally{ global.CordBraid = real; }
  const inches = core.samplePath(cl.cordPath.pieces, 0.02);
  assert.equal(seen[0].points.length, inches.length);
  seen[0].points.forEach((p, i) => { assert.ok(Math.hypot(p[0] - inches[i][0], p[1] - inches[i][1]) < 1e-9, 'scale 100: art units are inches'); });
  seen[1].points.forEach((p, i) => {
    assert.ok(Math.abs(p[0] * 25 + 50 - inches[i][0] * 100) < 1e-6 && Math.abs(p[1] * 25 + 20 - inches[i][1] * 100) < 1e-6, 'translate and scale carry the point back to sheet inches');
  });
  assert.equal(seen[0].opts.unit, 1);
  assert.equal(seen[1].opts.unit, 4, 'art units to the inch');
  assert.equal(seen[0].opts.width, core.CORD_WIDTH);
  assert.equal(seen[0].opts.cap, true, 'the cord\'s own run is closed with its cap');
});

test('the aiguillette\'s braid is a plain cord in the aiguillette\'s colour with no end cap, the cord\'s own run a capped braid; the cord\'s other extras hang from the shoulder end', async () => {
  const cut = CUTS[3];
  const scene = await compose(cut, 'fl-leadership-academy-instructor');
  const run = braidOf(runOf(scene)), pend = braidOf(pendantOf(scene));
  const gold = LIST.palette.gold, black = LIST.palette.black;
  assert.ok(run.run.includes(black.main) && run.run.includes(gold.main), 'the run is black and gold');
  assert.ok(pend.run.includes(gold.main) && !pend.run.includes(black.main), 'the pendant is gold only');
  assert.equal(pend.extras, '', 'no strand on the pendant');
  const capped = CB.draw([[0, 0], [0, 3]], CORDS.resolve('wing'), { unit: 1, width: 0.5, idPrefix: 'a-', cap: true }).run;
  const bare = CB.draw([[0, 0], [0, 3]], CORDS.resolve('wing'), { unit: 1, width: 0.5, idPrefix: 'a-', cap: false }).run;
  assert.notEqual(capped, bare, 'the cap is part of the drawing');
  const plain = core.samplePath(runOf(scene).cordPath.pieces, 0.02).map(p => [p[0] - ART.tx / 100, p[1] - ART.ty / 100]);
  assert.equal(run.run, CB.draw(plain, CORDS.resolve('fl-leadership-academy-instructor'), { unit: 1, width: 0.5, idPrefix: 'test-', cap: true }).run, 'the run is the capped braid');
  assert.notEqual(run.run, CB.draw(plain, CORDS.resolve('fl-leadership-academy-instructor'), { unit: 1, width: 0.5, idPrefix: 'test-', cap: false }).run);
  // the knotted cord: two strands, hung from the shoulder end
  const knotLayer = runOf(await compose(cut, 'ga-cadet-of-the-year'));
  const knot = braidOf(knotLayer);
  assert.ok(/id="test-strand0"/.test(knot.extras) && /id="test-strand1"/.test(knot.extras), 'two strands');
  const top = knotLayer.cordPath.top;
  const xs = coordsOf(knot.extras).map(q => q[0] + ART.tx / 100), ys = coordsOf(knot.extras).map(q => q[1] + ART.ty / 100);
  assert.ok(Math.min(...ys) >= top[1] - 0.01, 'the strands start at the shoulder end');
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - top[0]) < 0.05, 'and hang straight down from it');
});

test('a gold aiguillette ends in the list\'s gold metal, a silver one in the sheet\'s own silver (the renderer keys the tip\'s variant by it)', () => {
  const sheetTip = { main: '#c9ccd2', dark: '#2e3036' };
  assert.deepEqual(CORDS.tipMetal('aide_de_camp'), LIST.metals.silver);
  assert.deepEqual(CORDS.tipMetal('aide_de_camp'), sheetTip, 'the silver the sheets draw their tips in');
  assert.deepEqual(CORDS.tipMetal('fl-leadership-academy-instructor'), LIST.metals.gold);
  assert.deepEqual(CORDS.tipMetal('fl-honor-society-high-distinction'), LIST.metals.gold);
  for(const id of ['wing', 'ner-rcls', 'ga-cadet-of-the-year', 'banana']) assert.equal(CORDS.tipMetal(id), null, `${id} has no aiguillette tip`);
  const sheets = CUTS.map(c => fs.readFileSync(path.join(root, 'images', manifest.assets.find(a => a.id === `${c[0]}-cord-aide-de-camp`).path), 'utf8'));
  for(const svg of sheets){
    const tip = /<g id="[^"]*__aiguillette-tip-long">([\s\S]*?)<\/g>/.exec(svg)[1];
    assert.ok(tip.includes(`fill="${sheetTip.main}"`) && tip.includes(`stroke="${sheetTip.dark}"`), 'the sheet draws the tip in those two values, which the renderer swaps');
  }
});

test('the strands, knots and tips of the supplement cords hang clear of a full ribbon rack on every cut (CAPR 39-1: nothing of the cord on the ribbons)', async () => {
  const RACK = [['mitchell_award', 'earned_cos_star'], ['armstrong_achievement'], ['rickenbacker_achievement'], ['wright_brothers_award'], ['curry_achievement'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'],
    ['red_service_ribbon'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['encampment_ribbon'], ['cadet_advisory_council_ribbon', 'group']];
  const withExtras = ALL.filter(id => { const e = CORDS.entry(id); return e.strand || e.knot; });
  assert.ok(withExtras.length >= 5, `${withExtras.length} cords with a strand or a knot`);
  for(const cut of CUTS){
    for(const id of withExtras){
      const b = HARNESS.makeBuild({ uniform: cut[1], gender: cut[2], membership: 'cadet', rank: 'C/Maj', opt: cut[3], ribbonSel: RACK, cord: id });
      const scene = await P.composeUniform(b, store), cl = runOf(scene);
      const rib = scene.layers.filter(l => /^ribbon:/.test(l.key || ''));
      assert.ok(rib.length >= 10, `${cut[0]}: ${rib.length} ribbons`);
      const W = cl.cordPath.width, E = CB.LOOK.extras, x0 = cl.cordPath.top[0], y0 = cl.cordPath.top[1];
      const box = { x0: x0 - (E.strandGap + E.knotWidth / 2) * W, x1: x0 + (E.strandGap + E.knotWidth / 2) * W, y0, y1: y0 + E.drop * W };
      for(const r of rib){
        const bx = core.layerBounds(r), rx = bx.x - cl.x, ry = bx.y - cl.y;
        assert.ok(!(box.x1 > rx && box.x0 < rx + bx.w && box.y1 > ry && box.y0 < ry + bx.h), `${cut[0]} ${id}: the strands hang over ribbon ${r.key}`);
      }
    }
  }
});
