'use strict';
// LIVE13 E129 and E130 (Doran, on the Class B short-sleeve shirt, two screenshots: "It's cutting the wings off and it's missing the tie clip").
//  - The tie clasp: CAPR 39-1 4.1.3.2.4, 4.1.11.1.1.3, 4.2.5.1.4: "The tie tack or clasp will be centered between the bottom edge of the knot and the bottom tip of the tie."
//  - A badge is never cut by the collar: the first badge is 1/2 in above the highest row of ribbons, the second 1/2 in above the first (4.1.11.1.1.2.3.1); it keeps that
//    place and is drawn whole over the collar leaf where the two meet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
const C = require('../js/engine/compose.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const RIBBONS = (() => {
  const src = fs.readFileSync(path.join(root, 'js', 'catalog.js'), 'utf8');
  const list = Function('return ' + /const ribbonList = (\[[\s\S]*?\n\]);/.exec(src)[1])();
  const have = new Set(manifest.assets.map(a => a.id));
  return list.filter(id => have.has('ribbon-' + String(id).replace(/_/g, '-')) && !/^rotc|military/.test(id)).slice(0, 22);
})();
const mk = (uniform, gender, o) => HARNESS.makeBuild(Object.assign({ uniform, gender, membership: 'senior', rank: 'Capt', name: { first: 'Pat', last: 'Doran', show: true }, opt: {} }, o));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} vs ${b.toFixed(3)}`);

// The engine's knot depths are read from each sheet's tie path: the knot's bottom edge is the path's narrowest point after its widest.
test('TIE_KNOT_DEPTH is the knot\'s bottom edge on each sheet\'s tie path (apex to the narrowest point after the widest)', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  const table = new Function(/\/\/ TIE_KNOT_DEPTH begin\n([\s\S]*?)\/\/ TIE_KNOT_DEPTH end/.exec(src)[1] + '; return TIE_KNOT_DEPTH;')();
  for(const [id, depth] of Object.entries(table)){
    const svg = fs.readFileSync(path.join(root, 'images', 'garments', id + '.svg'), 'utf8');
    const pts = [...new RegExp(`id="${id}__tie-body" d="([^"]+)"`).exec(svg)[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
    let wide = 1;
    for(let i = 1; i < 4; i++) if(Math.abs(pts[i][0]) > Math.abs(pts[wide][0])) wide = i;
    const narrow = pts[wide + 1];
    near(narrow[1] - pts[0][1], depth, 0.002, `${id}: knot depth`);
  }
});

const SITES = [
  ['blues_b', 'male', { sleeve: 'short', tie: true }], ['blues_b', 'male', { sleeve: 'long' }], ['aviator', 'male', { sleeve: 'long' }], ['aviator', 'male', { sleeve: 'short', tie: true }],
];
for(const [uniform, gender, opt] of SITES){
  test(`${uniform} ${gender} ${JSON.stringify(opt)}: the tie clasp is centred on the tie between the knot's bottom edge and the tip (4.1.11.1.1.3)`, async () => {
    const scene = await P.composeUniform(mk(uniform, gender, { opt }), store);
    const clasp = scene.layers.find(l => l.key === 'tie:clasp');
    assert.ok(clasp && clasp.id === 'tie-clasp-silver', 'the clasp is drawn');
    const spec = await store.load(clasp.id);
    near(clasp.w, spec.w, 1e-6, 'the clasp\'s own width, 2.0 in'); near(clasp.h, spec.h, 1e-6, 'its own height, 0.3 in');
    const garment = scene.layers.find(l => l.role === 'garment'), gs = await store.load(garment.id);
    const lm = gs.raw.landmarks.tie;
    const c = { x: clasp.x + clasp.w / 2, y: clasp.y + clasp.h / 2 };
    let knotY, tipY, axisX;
    { const depth = { 'garment-blues-class-b-shirt-male': 1.643, 'garment-blues-class-b-shirt-male-long': 1.643, 'garment-aviator-shirt-male': 1.288, 'garment-aviator-shirt-male-long': 1.288 }[garment.id]; knotY = lm.knot.y / 100 + depth; tipY = lm.knot.y / 100 + lm.length_in; axisX = lm.knot.x / 100; }
    near(c.y, (knotY + tipY) / 2, 0.01, 'halfway between the knot\'s bottom edge and the tie\'s tip');
    near(c.x, axisX, 0.02, 'on the tie\'s axis');
    assert.ok(knotY < c.y && c.y < tipY && tipY - knotY > 10, `knot ${knotY.toFixed(2)}, clasp ${c.y.toFixed(2)}, tip ${tipY.toFixed(2)}`);
  });
}

test('no tie, no clasp: the short sleeves without the tie, the women\'s tab, the Class A coat (its closed front hides the tie below the lapels) and opt.tieClasp false draw none', async () => {
  for(const [uniform, gender, opt] of [['blues_b', 'male', { sleeve: 'short' }], ['blues_b', 'female', { sleeve: 'long' }], ['aviator', 'female', { sleeve: 'long' }], ['blues_a', 'female', {}], ['blues_a', 'male', {}], ['blues_b', 'male', { sleeve: 'long', tieClasp: false }]]){
    const scene = await P.composeUniform(mk(uniform, gender, { opt }), store);
    assert.ok(!scene.layers.some(l => l.key === 'tie:clasp'), `${uniform} ${gender} ${JSON.stringify(opt)}`);
  }
});

test('the Class B shirt and blouse, short and long: with up to 22 ribbons and two badges no badge is cut by the collar, whatever the rack (the first badge 1/2 in over the ribbons, the second 1/2 in over it)', async () => {
  let reached = 0;
  for(const gender of ['male', 'female']) for(const sleeve of ['short', 'long']) for(const tie of [false, true]) for(const n of [0, 4, 12, 22]){
    const scene = await P.composeUniform(mk('blues_b', gender, { opt: { sleeve, tie }, ribbonSel: RIBBONS.slice(0, n).map(i => [i]), badgeIds: ['observer_badge', 'emt_basic_badge'] }), store);
    const fg = scene.layers.filter(l => l.role === 'garment-foreground');
    const sp = await store.load(scene.layers.find(l => l.role === 'garment').id);
    const closed = scene.layers.some(l => (l.hideGroups || []).includes('collar')) ;
    const names = closed ? ['collar_closed_right', 'collar_closed_left'] : ['collar_right', 'collar_left'];
    const polys = names.map(nm => sp.landmarks[nm].points);
    for(const l of scene.layers.filter(x => x.role === 'badge')){
      const tag = `${gender} ${sleeve} tie ${tie} ${n} ribbons ${l.key}`;
      assert.ok(!l.clipOut, `${tag}: not cut`);
      if(polys.some(poly => C.rectHitsPolygon(l, poly))){ reached++; assert.ok(fg.every(f => l.z > f.z), `${tag}: drawn whole above the collar`); assert.ok(scene.notes.some(t => /collar leaf reaches/.test(t)), `${tag}: said so`); }
    }
    // The regulation's distances still hold: the first badge's silver 1/2 in above the highest ribbon row.
    const rib = scene.layers.filter(l => l.role === 'ribbon'), badges = scene.layers.filter(l => l.role === 'badge').sort((a, b) => b.y - a.y);
    if(rib.length && badges.length >= 1){
      const top = Math.min(...rib.map(l => l.y)), spec = await store.load(badges[0].id), a = core.anchor(spec, 'art_bottom_center');
      const bottom = a ? badges[0].y + a.y * (badges[0].h / spec.h) : badges[0].y + badges[0].h;
      near(top - bottom, 0.5, 0.06, `${gender} ${sleeve} ${n}: the first badge 1/2 in above the ribbons`);
    }
  }
  assert.ok(reached >= 1, 'the racks include cases where a badge reaches the leaf, so the test bites');
});
