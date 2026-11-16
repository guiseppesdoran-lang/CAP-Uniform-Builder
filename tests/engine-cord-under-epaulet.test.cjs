'use strict';
// B4 and B7 (Ethan, 2026-11-10), as the second pass of 2026-11-12 left them.
//  B4: "put them down like an extra 10 pixels": the cord was drawn CORD_DROP lower. The cord is now laid from the epaulet's corner and the armpit (tests/engine-cord-end.test.cjs), so the drop no
//      longer moves it; CORD_DROP is what the Aide de Camp pendant's attachment still takes.
//  B7: "cord must be totally under the eppaulet": the epaulet (the edge-on strip of a sleeve, the plain strap, the Class A board or officer's strap) is drawn over the cord, and the cord comes out
//      from beneath its lower edge, flush with its outside end edge: the cord layer is cut to the garment side of a line a little above that edge and, above the edge, to the neck side of the line of the
//      end edge, so no part of the cord shows above it, on it or beside its outer end.

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
const CORD_TUCK = Number(/const CORD_TUCK = ([\d.]+);/.exec(src)[1]);
const KINDS = ['group', 'wing', 'region', 'national', 'color-guard', 'honor-guard', 'aide-de-camp'];
const hb = (uniform, gender, membership, rank, cord, opt) => HARNESS.makeBuild({ uniform, gender, membership, rank, cord, name: { first: 'Pat', last: 'Doe', show: true }, opt: Object.assign({ rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting', headgear: 'none' }, opt || {}) });
const inside = (poly, p) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };

const GARMENTS = [
  ['garment-blues-class-a-coat', 'blues_a', 'male', {}], ['garment-blues-class-a-coat-female', 'blues_a', 'female', {}],
  ['garment-blues-class-b-shirt-male', 'blues_b', 'male', { sleeve: 'short' }], ['garment-blues-class-b-shirt-male-long', 'blues_b', 'male', { sleeve: 'long' }],
  ['garment-blues-class-b-blouse-female', 'blues_b', 'female', { sleeve: 'short' }], ['garment-blues-class-b-blouse-female-long', 'blues_b', 'female', { sleeve: 'long' }]
];

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
      assert.ok(cl && Array.isArray(cl.clip) && cl.clip.length === (cl.cordPath.pendant ? 4 : 6), `${tag}: the cord is cut to the garment side of the strap's lower edge (and, above it, to the neck side of the end edge)`);
      // the cut line is the strap's lower edge (half the band's thickness below its centre line), CORD_TUCK above it (the aide pendant: a few thousandths), under the strap's thickness
      const lowAt = { x: band.o.x - band.up.x * band.T / 2, y: band.o.y - band.up.y * band.T / 2 };
      const across = p => (p.x - lowAt.x) * band.up.x + (p.y - lowAt.y) * band.up.y;   // > 0 above the strap's lower edge
      const tuck = cl.cordPath.pendant ? 0.012 : CORD_TUCK;
      for(const c of [cl.clip[0], cl.clip[1]]) assert.ok(Math.abs(across(c) - tuck) < 0.04, `${tag}: the cut line is ${across(c).toFixed(4)} in above the strap's lower edge`);
      assert.ok(tuck < band.T, `${tag}: the tuck is under the strap's thickness (${band.T})`);
      // the epaulet over the cord: the sleeve strip, or the plain strap overlay
      const over = scene.layers.find(l => (l.key === 'epaulet:left' && l.role === 'epaulet') || (/-epaulet-plain$/.test(l.id || '') && l.role === 'garment-layer'));
      assert.ok(over && over.z > cl.z, `${tag}: the epaulet (z ${over && over.z}) is drawn over the cord (z ${cl.z})`);
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
        assert.ok(Array.isArray(cl.clip) && cl.clip.length === (cl.cordPath.pendant ? 4 : 6), `${tag}: cut under the epaulet's lower edge`);
        assert.ok(strip && strip.z > cl.z, `${tag}: the epaulet is over the cord`);
      }else{
        assert.ok(!cl.clip, `${tag}: no epaulet, no cut but the silhouette's`);
        assert.equal(cl.clipSil, gid);
      }
    }
  }
});
