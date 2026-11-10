'use strict';
// B4 and B7 (Ethan, 2026-11-10).
//  B4: "i think ive said this atleat 20 times, the cords still arent right. put them down like an extra 10 pixels so it looks like it should. nothing else has to change except it needs to
//      go down." Every shoulder cord is drawn CORD_DROP lower, the braid as it was: its path is the seam's moved down, its width, its colour and its layer are what they were. CORD_DROP is
//      10 px of the owner's own picture of the Class A coat (img 04): the braid is 45.2 px across for its 0.5 in, so 10 px is 0.11 in.
//  B7: "cord must be totally under the eppaulet": the epaulet (the edge-on strip of a sleeve, the plain strap, the Class A board or officer's strap) is drawn over the cord, and the cord comes out
//      from beneath its lower edge: the cord layer is cut to the garment side of that edge, so no part of the cord shows above it, on it or beside its outer end.

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
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
const CORD_DROP = Number(/const CORD_DROP = ([\d.]+);/.exec(src)[1]);
const KINDS = ['group', 'wing', 'region', 'national', 'color-guard', 'honor-guard', 'aide-de-camp'];
const hb = (uniform, gender, membership, rank, cord, opt) => HARNESS.makeBuild({ uniform, gender, membership, rank, cord, name: { first: 'Pat', last: 'Doe', show: true }, opt: Object.assign({ rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting', headgear: 'none' }, opt || {}) });
const inside = (poly, p) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };

test('B4: the drop is 10 px of the owner\'s picture of the cord (45.2 px for the braid\'s 0.5 in): 0.11 in', () => {
  assert.ok(Math.abs(CORD_DROP - 10 / (45.2 / 0.5)) < 0.005, `CORD_DROP ${CORD_DROP}`);
});

const GARMENTS = [
  ['garment-blues-class-a-coat', 'blues_a', 'male', {}], ['garment-blues-class-a-coat-female', 'blues_a', 'female', {}],
  ['garment-blues-class-b-shirt-male', 'blues_b', 'male', { sleeve: 'short' }], ['garment-blues-class-b-shirt-male-long', 'blues_b', 'male', { sleeve: 'long' }],
  ['garment-blues-class-b-blouse-female', 'blues_b', 'female', { sleeve: 'short' }], ['garment-blues-class-b-blouse-female-long', 'blues_b', 'female', { sleeve: 'long' }]
];

test('B4: every shoulder cord of every kind, on every coat, shirt and blouse, is the cord of before moved down: its bottom end is the armpit moved down, its braid the drawn seam moved down', async () => {
  const ARMPIT = require('../scripts/measure-armpit.cjs').compute();
  let n = 0;
  for(const [gid, uniform, gender, opt] of GARMENTS) for(const k of KINDS){
    if(k === 'aide-de-camp') continue;   // the aide cord hangs straight down from its attachment (tests/engine-live-aiguillette.test.cjs)
    const scene = await P.composeUniform(hb(uniform, gender, 'cadet', 'C/Maj', k.replace(/-/g, '_'), opt), store);
    const cl = scene.layers.find(l => l.id === `${gid}-cord-${k}`);
    assert.ok(cl && cl.cordPath, `${gid} ${k}: drawn`);
    const ap = ARMPIT[gid];
    if(!cl.cordPath.exact) assert.ok(Math.abs(cl.cordPath.bottom[0] - ap[0]) < 1e-6 && Math.abs(cl.cordPath.bottom[1] - (ap[1] + CORD_DROP)) < 1e-6, `${gid} ${k}: the bottom end is the armpit ${CORD_DROP} in lower`);
    else{
      const seam = cl.cordPath.seam, last = seam[seam.length - 1];
      assert.ok(Math.abs(cl.cordPath.bottom[0] - last[0]) < 1e-6 && Math.abs(cl.cordPath.bottom[1] - (last[1] + CORD_DROP)) < 1e-6, `${gid} ${k}: the bottom end is the seam's end ${CORD_DROP} in lower`);
    }
    assert.equal(cl.cordPath.width, core.CORD_WIDTH, `${gid} ${k}: the braid is as wide as before`);
    assert.equal(cl.z, 7.5, `${gid} ${k}: the cord keeps its layer`);
    n++;
  }
  assert.equal(n, GARMENTS.length * (KINDS.length - 1));
});

// The strap band the shirts and blouses draw (epaulet_axis: the centre line from the outer end p1 to the collar end p2, edge_thickness_in across), the lower edge of it.
function bandOf(spec, side){
  const ax = spec.raw.landmarks.epaulet_axis, a = ax[side], o = { x: a.p1[0] / 100, y: a.p1[1] / 100 }, nk = { x: a.p2[0] / 100, y: a.p2[1] / 100 };
  const L = Math.hypot(nk.x - o.x, nk.y - o.y), axis = { x: (nk.x - o.x) / L, y: (nk.y - o.y) / L };
  let up = { x: axis.y, y: -axis.x }; if(up.y > 0) up = { x: -up.x, y: -up.y };
  const T = a.edge_thickness_in != null ? a.edge_thickness_in : ax.edge_thickness_in;
  return { o, axis, up, T, L };
}

test('B7: on the Class B shirt and blouse the cord comes out from under the strap\'s lower edge: with a sleeve, with the plain strap, and with the aide cord; the epaulet is drawn over it and no visible cord lies on the strap', async () => {
  let n = 0;
  for(const [gid, uniform, gender, opt] of GARMENTS.filter(g => g[1] === 'blues_b')){
    const spec = await store.load(gid), band = bandOf(spec, 'left'), poly = spec.landmarks.epaulet_left.points;
    for(const [membership, rank, cord] of [['cadet', 'C/Maj', 'wing'], ['cadet', 'C/SSgt', 'group'], ['cadet', 'C/AB', 'region'], ['senior', 'Capt', 'aide_de_camp'], ['senior', 'MSgt', 'aide_de_camp']]){
      const tag = `${gid} ${rank} ${cord}`;
      const scene = await P.composeUniform(hb(uniform, gender, membership, rank, cord, opt), store);
      const cl = scene.layers.find(l => /-cord-/.test(l.id || '') && l.cordPath);
      assert.ok(cl && Array.isArray(cl.clip) && cl.clip.length === 4, `${tag}: the cord is cut to the garment side of the strap's lower edge`);
      // the cut line is the strap's lower edge (half the band's thickness below its centre line), a few thousandths above it
      const lowAt = { x: band.o.x - band.up.x * band.T / 2, y: band.o.y - band.up.y * band.T / 2 };
      const across = p => (p.x - lowAt.x) * band.up.x + (p.y - lowAt.y) * band.up.y;   // > 0 above the strap's lower edge
      for(const c of [cl.clip[0], cl.clip[1]]) assert.ok(Math.abs(across(c) - 0.012) < 0.004, `${tag}: the cut line is ${across(c).toFixed(4)} in above the strap's lower edge`);
      // the epaulet over the cord: the sleeve strip, or the plain strap overlay
      const over = scene.layers.find(l => (l.key === 'epaulet:left' && l.role === 'epaulet') || (/-epaulet-plain$/.test(l.id || '') && l.role === 'garment-layer'));
      assert.ok(over && over.z > cl.z, `${tag}: the epaulet (z ${over && over.z}) is drawn over the cord (z ${cl.z})`);
      // the visible cord: sample the braid's body (the path and its width) on the garment side of the cut: none of it lies on the strap polygon (shrunk a hair)
      const pts = cl.cordPath.points, half = core.CORD_WIDTH / 2;
      let visibleOnStrap = 0, visible = 0;
      for(let i = 0; i + 1 < pts.length; i++){
        const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
        for(let t = 0; t <= 1; t += 0.05) for(let w = -1; w <= 1; w += 0.25){
          const p = { x: a[0] + (b[0] - a[0]) * t + nx * half * w, y: a[1] + (b[1] - a[1]) * t + ny * half * w };
          if(across(p) > 0.012) continue;   // under the cut: not drawn
          visible++;
          // the strap polygon without its outermost 0.015 in (the cut leaves 0.012 of tuck under it)
          const shrunk = [0.015, 0.03].every(d => inside(poly, { x: p.x + band.up.x * d, y: p.y + band.up.y * d }) && inside(poly, { x: p.x - band.up.x * d, y: p.y - band.up.y * d }));
          if(shrunk) visibleOnStrap++;
        }
      }
      assert.ok(visible > 50, `${tag}: some of the cord shows`);
      assert.equal(visibleOnStrap, 0, `${tag}: ${visibleOnStrap} sampled points of the visible cord lie on the strap`);
      n++;
    }
  }
  assert.equal(n, 20);
});

test('B7: on the Class A coats the cord comes out from under a board or an officer\'s strap, and with no epaulet (cadet NCOs) it is cut by the shoulder outline only', async () => {
  for(const [gid, uniform, gender] of GARMENTS.filter(g => g[1] === 'blues_a')){
    for(const [membership, rank, cord, epaulet] of [['cadet', 'C/Maj', 'wing', true], ['cadet', 'C/Col', 'group', true], ['senior', 'Capt', 'aide_de_camp', true], ['senior', 'Maj Gen', 'aide_de_camp', true], ['cadet', 'C/SSgt', 'wing', false], ['senior', 'MSgt', 'aide_de_camp', false]]){
      const tag = `${gid} ${rank} ${cord}`;
      const scene = await P.composeUniform(hb(uniform, gender, membership, rank, cord, {}), store);
      const cl = scene.layers.find(l => /-cord-/.test(l.id || '') && l.cordPath);
      assert.ok(cl, `${tag}: the cord is drawn`);
      const strip = scene.layers.find(l => l.key === 'epaulet:left' && l.role === 'epaulet');
      if(epaulet){
        assert.ok(Array.isArray(cl.clip) && cl.clip.length === 4, `${tag}: cut under the epaulet's lower edge`);
        assert.ok(strip && strip.z > cl.z, `${tag}: the epaulet is over the cord`);
      }else{
        assert.ok(!cl.clip, `${tag}: no epaulet, no cut but the silhouette's`);
        assert.equal(cl.clipSil, gid);
      }
    }
  }
});
