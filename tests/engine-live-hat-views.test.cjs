'use strict';
// LIVE-ENGINE 1 (Ethan, reviewing the live site: "the hat overlaps with the shoulder boards"): the shoulder views from above
// (epaulet sleeves, shoulder boards; R7) and the cap (R6) never touch. The cap lies on the collar and is wider than the neck
// opening (the flight cap of CAPR 39-1 Fig A5-9 is 11.6 to 12.2 in wide), so its lower corners reach the views; both views
// slide outward along their strap, together (R7 symmetry), until they are 0.1 in clear of the cap's ink and of its device.
//
// The task asked for the cap SHEET's box to be cleared. The box is not the cap: the sloped flight crown and the service
// cap's brim leave empty corners, and clearing the women's flight cap box (12.2 x 5.0 in) would send each view 2.6 in past
// the shoulder, the service caps' boxes 1.2 in further than the cap needs (D8). The cap's drawn ink, as the convex hull
// scripts/measure-hat-ink.cjs measures, is what a viewer sees, so that is what the views clear.

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
const INK = require('../scripts/measure-hat-ink.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const NAME = { first: 'Pat', last: 'Doe', show: true };
const hb = (uniform, gender, membership, rank, opt) => HARNESS.makeBuild({ uniform, gender, membership, rank, name: NAME, opt: Object.assign({ rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' }, opt || {}) });

function corners(l){
  const o = l.origin || { x: l.x, y: l.y };
  return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, o, l.rotate || 0));
}
function overlap(a, b){
  for(const poly of [a, b]){
    for(let i = 0; i < poly.length; i++){
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const nx = p.y - q.y, ny = q.x - p.x;
      const proj = pts => { const v = pts.map(r => r.x * nx + r.y * ny); return [Math.min(...v), Math.max(...v)]; };
      const A = proj(a), B = proj(b);
      if(A[1] <= B[0] || B[1] <= A[0]) return false;
    }
  }
  return true;
}
function gap(a, b){
  if(overlap(a, b)) return 0;
  let d = Infinity;
  for(const [A, B] of [[a, b], [b, a]]) for(const p of A) for(let i = 0; i < B.length; i++){
    const u = B[i], v = B[(i + 1) % B.length], dx = v.x - u.x, dy = v.y - u.y;
    const t = Math.max(0, Math.min(1, ((p.x - u.x) * dx + (p.y - u.y) * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(p.x - u.x - t * dx, p.y - u.y - t * dy));
  }
  return d;
}
const HULL = INK.compute();
const inkOf = async hat => {
  const s = await store.load(hat.id);
  const k = hat.w / s.w;
  return HULL[hat.id].map(([x, y]) => ({ x: hat.x + x * k, y: hat.y + y * k }));
};

const UNIFORMS = ['blues_a', 'blues_b', 'aviator', 'aviator_blazer', 'semi_formal_usaf', 'semi_formal', 'mess_dress', 'flight_suit', 'corporate_flight_suit', 'ocp', 'abu', 'corporate_field'];
const RANKS = [['cadet', 'C/Maj'], ['senior', 'Capt'], ['senior', 'Col'], ['senior', 'Maj Gen'], ['senior', 'SMSgt']];
const EXTRA = { aviator: [{}, { sleeve: 'long' }, { femaleTop: 'overblouse' }, { femaleTop: 'overblouse', sleeve: 'long' }] };

test('every uniform x cut x rank x headgear: no cap ink or cap device within 0.1 in of an epaulet or board view from above (R6, R7)', async () => {
  let hats = 0, views = 0, slid = 0, builds = 0;
  for(const uniform of UNIFORMS) for(const gender of ['male', 'female']) for(const [m, r] of RANKS) for(const headgear of ['auto', 'service']) for(const extra of EXTRA[uniform] || [{}]){
    const scene = await compose(hb(uniform, gender, m, r, Object.assign({ headgear }, extra)));
    builds++;
    const label = `${uniform} ${gender} ${r} ${headgear} ${JSON.stringify(extra)}`;
    const tops = scene.layers.filter(l => l.role === 'epaulet-top');
    const caps = scene.layers.filter(l => l.role === 'hat' || l.role === 'hat-device');
    views += tops.length;
    for(const hat of caps.filter(l => l.role === 'hat' && HULL[l.id])){
      hats++;
      const ink = await inkOf(hat);
      for(const t of tops) assert.ok(gap(corners(t), ink) >= 0.1 - 1e-6, `${label}: ${t.key} within ${gap(corners(t), ink).toFixed(3)} in of ${hat.id}`);
    }
    for(const dev of caps.filter(l => l.role === 'hat-device')) for(const t of tops) assert.ok(gap(corners(t), corners(dev)) >= 0.1 - 1e-6, `${label}: ${t.key} within ${gap(corners(t), corners(dev)).toFixed(3)} in of ${dev.id}`);
    // Both views move together (R7): the same slide, mirrored about the figure's centre line.
    const R = tops.find(l => l.key === 'epaulet-top:right'), L = tops.find(l => l.key === 'epaulet-top:left');
    if(R && L && (R.slid || L.slid)){
      slid++;
      assert.equal(R.slid, L.slid, `${label}: both views slid the same distance`);
      assert.ok(R.slid <= 3, `${label}: slide ${R.slid} in is within the limit`);
    }
  }
  // The standard matrix draws caps only with the Class A and Class B; the other uniforms draw no view from above and a cap together.
  assert.ok(hats >= 40 && views >= 150 && slid >= 12, `${builds} builds, ${hats} caps, ${views} views, ${slid} slid`);
});

test('the three builds Ethan named: the views clear the cap by 0.1 in and stay beside their shoulders (blues A female C/Maj, blues B male Capt, blues A male Maj Gen service)', async () => {
  for(const [uniform, gender, m, r, headgear] of [['blues_a', 'female', 'cadet', 'C/Maj', 'auto'], ['blues_b', 'male', 'senior', 'Capt', 'auto'], ['blues_a', 'male', 'senior', 'Maj Gen', 'service']]){
    const scene = await compose(hb(uniform, gender, m, r, { headgear }));
    const hat = scene.layers.find(l => l.role === 'hat');
    const ink = await inkOf(hat);
    const garment = scene.layers.find(l => l.role === 'garment');
    for(const side of ['right', 'left']){
      const t = scene.layers.find(l => l.key === `epaulet-top:${side}`);
      assert.ok(gap(corners(t), ink) >= 0.1 - 1e-6, `${uniform} ${gender} ${r} ${side}`);
      // Never more than half a view past the garment's side edge: beside the shoulder, not floating off it.
      const xs = corners(t).map(p => p.x);
      assert.ok(Math.min(...xs) > garment.x - t.w / 2 && Math.max(...xs) < garment.x + garment.w + t.w / 2, `${uniform} ${gender} ${r} ${side}: x ${Math.min(...xs).toFixed(2)}..${Math.max(...xs).toFixed(2)}`);
    }
  }
});

test('the engine\'s HAT_INK table is the convex hull of the drawn ink of the current cap SVGs (regenerate with scripts/measure-hat-ink.cjs after an art sync)', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles.js'), 'utf8');
  const body = /\/\/ HAT_INK begin\n([\s\S]*?)\/\/ HAT_INK end/.exec(src);
  assert.ok(body, 'the table is in profiles.js');
  const table = new Function(body[1] + '; return HAT_INK;')();
  assert.deepEqual(table, HULL);
  assert.ok(Object.keys(table).length >= 17);
});
