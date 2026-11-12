'use strict';
// The cadet officer shoulder board's shape (the owner, 2026-11-12, on the live Class A coat: "why does it curve up at the end? it should be rounded like it is in real life. having it flat is killing me a little bit").
// The board seen edge-on is the board seen from above squeezed across the strap, so it has the top view's outline, the corners rounded as the real board's are (boardPlan: the commercial board's photograph,
// the outer end's corners 0.32 in, the corners where the point begins and the tip 0.115 in on the 2.3 in wide board), and it shows as thick as the figures that draw it worn draw it (1.05 in). The point
// narrows to the middle of the strip from both edges: it was sheared up so its tip lay on the upper edge, which turned the lower edge up 34 degrees where the point begins.

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
const hb = (uniform, gender, rank, opt) => HARNESS.makeBuild({ uniform, gender, membership: 'cadet', rank, name: { first: 'Pat', last: 'Doe', show: true }, opt: opt || {} });
const H = P.helpers;
const L = 4.55, W = 2.3, PEAK = 0.74;

// The angle the outline turns through at each vertex, in degrees (the largest).
function maxTurn(poly){
  let worst = 0;
  for(let i = 0; i < poly.length; i++){
    const a = poly[(i + poly.length - 1) % poly.length], b = poly[i], c = poly[(i + 1) % poly.length];
    const d1 = { x: b.x - a.x, y: b.y - a.y }, d2 = { x: c.x - b.x, y: c.y - b.y };
    if(Math.hypot(d1.x, d1.y) < 1e-9 || Math.hypot(d2.x, d2.y) < 1e-9) continue;
    const t = Math.abs(Math.atan2(d1.x * d2.y - d1.y * d2.x, d1.x * d2.x + d1.y * d2.y)) * 180 / Math.PI;
    worst = Math.max(worst, t);
  }
  return worst;
}
const isConvex = poly => {
  let sign = 0;
  for(let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length], c = poly[(i + 2) % poly.length];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if(Math.abs(cr) < 1e-12) continue;
    if(sign && Math.sign(cr) !== sign) return false;
    sign = Math.sign(cr);
  }
  return true;
};
const area = poly => { let a = 0; for(let i = 0; i < poly.length; i++){ const q = poly[(i + 1) % poly.length]; a += poly[i].x * q.y - q.x * poly[i].y; } return Math.abs(a) / 2; };

test('the board seen from above: the sheets\' straight sides and 0.74 in point, every corner rounded, convex, and no more than the corners cut away', () => {
  const plan = H.boardPlan(L, W, PEAK);
  assert.ok(isConvex(plan), 'convex');
  assert.ok(plan.every(p => p.x >= -1e-9 && p.x <= L + 1e-9 && p.y >= -1e-9 && p.y <= W + 1e-9), 'inside the board\'s 4.55 x 2.3 in box');
  // the sharp outline of the sheets: a 3.81 in body and a 0.74 in point, 2.3 in wide
  const sharp = [{ x: 0, y: 0 }, { x: L - PEAK, y: 0 }, { x: L, y: W / 2 }, { x: L - PEAK, y: W }, { x: 0, y: W }];
  const cut = area(sharp) - area(plan);
  assert.ok(cut > 0.03 && cut < 0.25, `the five corners cut away ${cut.toFixed(3)} sq in`);
  // the outer end: the end edge is straight between the rounded corners (0.32 in in from each) and the sides run to 0.32 in from the end
  assert.ok(plan.some(p => Math.abs(p.x) < 1e-9 && Math.abs(p.y - 0.32) < 1e-6) && plan.some(p => Math.abs(p.x) < 1e-9 && Math.abs(p.y - (W - 0.32)) < 1e-6), 'the end edge starts 0.32 in in from its corners');
  assert.ok(plan.some(p => Math.abs(p.y) < 1e-9 && Math.abs(p.x - 0.32) < 1e-6), 'the upper side starts 0.32 in from the outer end');
  // the tip is rounded: the board's far end is a little short of the sharp point, on the centre line
  const far = Math.max(...plan.map(p => p.x));
  assert.ok(far < L - 0.01 && far > L - 0.06, `the tip stands ${(L - far).toFixed(3)} in short of the sharp point (the point is 114 degrees across)`);
  assert.ok(maxTurn(plan) < 25, `no sharp vertex (${maxTurn(plan).toFixed(1)} degrees at the sharpest)`);
});

test('the edge-on board is the top view squeezed across the strap, cut to that outline: rounded corners, a point that narrows to the middle of the strip, no bend in the lower edge', async () => {
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const sex of ['male', 'female']) for(const rank of ['C/2d Lt', 'C/Col']){
    const scene = await P.composeUniform(hb(uniform, sex, rank), store);
    for(const side of ['right', 'left']){
      const tag = `${uniform} ${sex} ${rank} ${side}`, strip = scene.layers.find(l => l.key === 'epaulet:' + side);
      assert.ok(strip && Array.isArray(strip.clip) && strip.clip.length > 20, `${tag}: the strip is cut to the board's outline`);
      assert.ok(!strip.shear, `${tag}: no shear`);
      assert.equal(scene.layers.filter(l => (l.key || '').startsWith('epaulet-tip')).length, 0, `${tag}: one piece, no separate point`);
      assert.ok(Math.abs(strip.h - 2.5 * H.BOARD_STRIP_THICK / W) < 0.002, `${tag}: across the strap ${strip.h}`);
      // the outline in the strip's frame: u along the strap from the outer end, v down from the strip's centre line (the piece's origin is on it)
      const o = strip.origin, r = (strip.rotate || 0) * Math.PI / 180, ax = { x: Math.cos(r), y: Math.sin(r) }, dn = { x: -Math.sin(r), y: Math.cos(r) };
      const q = strip.clip.map(p => ({ x: (p.x - o.x) * ax.x + (p.y - o.y) * ax.y, y: (p.x - o.x) * dn.x + (p.y - o.y) * dn.y }));
      const spec = await store.load(strip.id), outer = core.anchor(spec, 'board_outer_end'), button = core.anchor(spec, 'button_end_center');
      // the art's x runs outer end to button end: turn the frame so u grows toward the button (the left sheets are mirrored)
      const toward = Math.sign((button.x - outer.x) * 1) || 1;
      const U = q.map(p => ({ x: toward * p.x, y: p.y }));
      const T = H.BOARD_STRIP_THICK;
      const lowerAt = u => { let best = -Infinity; for(let i = 0; i < U.length; i++){ const a = U[i], b = U[(i + 1) % U.length]; if((a.x - u) * (b.x - u) <= 0 && a.x !== b.x) best = Math.max(best, a.y + (b.y - a.y) * (u - a.x) / (b.x - a.x)); } return best; };
      assert.ok(Math.abs(lowerAt(2.0) - T / 2) < 0.03, `${tag}: the lower edge lies ${lowerAt(2.0).toFixed(3)} in below the strip's centre line, the strip is ${T} in across`);
      // no sharp turn in the lower edge (below the centre line; the upper edge of the women's cut follows the coat's own bend): the point's slant joins the straight edge by a curve
      let turn = 0, counted = 0;
      for(let i = 0; i < U.length; i++){
        const a = U[(i + U.length - 1) % U.length], b = U[i], c = U[(i + 1) % U.length];
        if(a.y < 0.02 || b.y < 0.02 || c.y < 0.02) continue;
        const d1 = { x: b.x - a.x, y: b.y - a.y }, d2 = { x: c.x - b.x, y: c.y - b.y };
        if(Math.hypot(d1.x, d1.y) < 1e-9 || Math.hypot(d2.x, d2.y) < 1e-9) continue;
        turn = Math.max(turn, Math.abs(Math.atan2(d1.x * d2.y - d1.y * d2.x, d1.x * d2.x + d1.y * d2.y)) * 180 / Math.PI); counted++;
      }
      assert.ok(counted > 10 && turn < 30, `${tag}: no bend in the lower edge (${turn.toFixed(1)} degrees at the sharpest of ${counted} vertices)`);
      // the point reaches the middle of the strip at its tip
      const tipV = U.filter(p => p.x > L - 0.12).map(p => p.y);
      assert.ok(tipV.length && Math.abs(tipV.reduce((a, b) => a + b, 0) / tipV.length) < 0.08, `${tag}: the point ends in the middle of the strip`);
      // the outer end's lower corner is rounded: the sharp corner (0, T) is outside the cut
      assert.ok(!U.some(p => p.x < 0.05 && p.y > T / 2 - 0.05), `${tag}: the outer end's lower corner is rounded off`);
    }
  }
});

test('the top view is cut to the same outline and keeps it when the cap makes it slide outward', async () => {
  let slid = 0;
  for(const sex of ['male', 'female']) for(const uniform of ['blues_a', 'semi_formal_usaf']){
    const scene = await P.composeUniform(hb(uniform, sex, 'C/Maj'), store);
    for(const side of ['right', 'left']){
      const tag = `${uniform} ${sex} ${side}`, view = scene.layers.find(l => l.key === 'epaulet-top:' + side);
      assert.ok(view && Array.isArray(view.clip) && view.clip.length > 20, `${tag}: the view from above is cut to the board's outline`);
      // the clip's box is the board's 4.55 x 2.3 in box (less the tip's rounding) centred on the piece, wherever the piece has been moved to
      const xs = view.clip.map(p => p.x), ys = view.clip.map(p => p.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - (W + 0.03)) < 0.02, `${tag}: the outline is ${(Math.max(...ys) - Math.min(...ys)).toFixed(3)} in across`);
      assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - (L - 0.02 + 0.03)) < 0.04, `${tag}: the outline is ${(Math.max(...xs) - Math.min(...xs)).toFixed(3)} in long`);
      const pc = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
      assert.ok(Math.abs(cy - pc.y) < 0.02 && Math.abs(Math.abs(cx - pc.x) - 0.05) < 0.07, `${tag}: the outline (${cx.toFixed(2)}, ${cy.toFixed(2)}) is on the piece (${pc.x.toFixed(2)}, ${pc.y.toFixed(2)})`);
      if(view.slid) slid++;
    }
  }
  assert.ok(slid > 0, 'at least one build slid its views clear of the cap, so the moved outline was checked');
});

// The shoulder cord is cut flush with the line of the board's outside end edge, through the board's lower outer corner (the cord's top edge snaps to a vertex of the strip's outline within the cord's snap
// distance of that corner, cordTopEdge): the rounded corner leaves no vertex that near, so the cord's edge is on the corner itself and the cord is still flush with the board's end.
test('the rounded outer corner leaves no outline vertex within the cord\'s snap distance of the lower outer corner: the cord stays flush with the board\'s end edge', async () => {
  const snap = Number(/const CORD_CORNER_SNAP = ([\d.]+);/.exec(fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8'))[1]);
  assert.ok(H.BOARD_CORNER_CLEAR > snap, `the board keeps ${H.BOARD_CORNER_CLEAR} in clear, the cord snaps within ${snap}`);
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const sex of ['male', 'female']){
    const scene = await P.composeUniform(hb(uniform, sex, 'C/Maj', { headgear: 'none' }), store);
    for(const side of ['right', 'left']){
      const strip = scene.layers.find(l => l.key === 'epaulet:' + side);
      // the lower outer corner: the strip's origin (its outer end, on its centre line) half the strip down the strip's own turn
      const r = (strip.rotate || 0) * Math.PI / 180, corner = { x: strip.origin.x - Math.sin(r) * H.BOARD_STRIP_THICK / 2, y: strip.origin.y + Math.cos(r) * H.BOARD_STRIP_THICK / 2 };
      const near = Math.min(...strip.clip.map(p => Math.hypot(p.x - corner.x, p.y - corner.y)));
      assert.ok(near > snap, `${uniform} ${sex} ${side}: the nearest outline vertex is ${near.toFixed(3)} in from the lower outer corner (the cord snaps within ${snap})`);
    }
  }
});
