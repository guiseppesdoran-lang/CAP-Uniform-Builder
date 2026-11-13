'use strict';
// The cadet officer shoulder board worn (the owner, 2026-11-12, on the live Class A coat: "why does it curve up at the end? it should be rounded like it is in real life. having it flat is killing me a little bit";
// then, on the side by side: "the shoulder boards dont look right. research more about what the shoulder boards look like irl, and then implement.").
// The board is the board seen from above, worn as photographs of the real one show it: a thin slab lying over the ridge of the shoulder (boardWorn), so what shows from the front is the front half of its top
// face under a straight far edge on the coat's outline, and under that the face of its front edge, the two together 0.08 to 0.11 of the board's length thick; its outline is the top view's, the corners rounded as
// the real board's are (boardPlan: the commercial board's photograph, the outer end's corners 0.32 in, the corners where the point begins and the tip 0.115 in on the 2.3 in wide board); the point narrows to the
// board's centre line from both edges and ends near the far edge; the grade stands on the centre line and is not cut by the far edge, so the back form crosses it.

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

// The board worn, in numbers: measured on photographs of the real board worn (straight on from the front at the shoulders' height: the top face 0.080 of the length, its front face 0.026, together 0.106; a second
// front view 0.095; two portraits from higher up 0.19 and 0.27, not used), so a drawing of the board from the front shows it between 0.08 and 0.11 of its length thick.
test('the board worn is a thin slab: its visible thickness is 0.08 to 0.11 of its length, its centre line a third of the way down its top face, the grade squeezed less than the surface', () => {
  const w = H.boardWorn(L, W);
  assert.ok(Math.abs(w.top - 0.080 * L) < 1e-9 && Math.abs(w.face - 0.026 * L) < 1e-9 && Math.abs(w.total - (w.top + w.face)) < 1e-12);
  assert.ok(w.total / L >= 0.08 && w.total / L <= 0.11, `the board shows ${(w.total / L).toFixed(3)} of its length thick`);
  assert.ok(Math.abs(w.ridge / w.top - 0.30) < 1e-9, 'the centre line lies 0.30 of the top face below the far edge');
  assert.ok(Math.abs(w.k * (W / 2) - (w.top - w.ridge)) < 1e-9, 'the surface is squeezed across so its front half is what shows of the top face');
  assert.ok(Math.abs(w.stand / w.k - 1.3) < 1e-9, 'the grade stands up off the board: squeezed 1.3 times less than the surface');
  assert.ok(w.k < 0.3 && w.k > 0.15, `the surface squeeze ${w.k.toFixed(3)}`);
});

// The outline of a layer's clip in the strip's frame: u along the strap from the outer end (the art's x runs outer end to button end: the left sheets are mirrored), v down from the board's centre line (the piece's origin is on it).
async function frameOf(layer){
  const o = layer.origin, r = (layer.rotate || 0) * Math.PI / 180, ax = { x: Math.cos(r), y: Math.sin(r) }, dn = { x: -Math.sin(r), y: Math.cos(r) };
  const spec = await store.load(layer.id), outer = core.anchor(spec, 'board_outer_end'), button = core.anchor(spec, 'button_end_center'), toward = Math.sign(button.x - outer.x) || 1;
  return poly => poly.map(p => ({ x: toward * ((p.x - o.x) * ax.x + (p.y - o.y) * ax.y), y: (p.x - o.x) * dn.x + (p.y - o.y) * dn.y }));
}
// the edge of the outline at station u: the smallest or the largest v of the polygon's edges that cross it
const edgeAtU = (U, u, lower) => { let best = lower ? -Infinity : Infinity; for(let i = 0; i < U.length; i++){ const a = U[i], b = U[(i + 1) % U.length]; if((a.x - u) * (b.x - u) <= 0 && a.x !== b.x){ const v = a.y + (b.y - a.y) * (u - a.x) / (b.x - a.x); best = lower ? Math.max(best, v) : Math.min(best, v); } } return best; };

test('the board worn: the top face under a far edge on the coat, the front edge\'s face under it, rounded outer corners, a point that ends near the far edge, no bend in the lower edge', async () => {
  const worn = H.boardWorn(L, W);
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const sex of ['male', 'female']) for(const rank of ['C/2d Lt', 'C/Col']){
    const scene = await P.composeUniform(hb(uniform, sex, rank), store);
    for(const side of ['right', 'left']){
      const tag = `${uniform} ${sex} ${rank} ${side}`, strip = scene.layers.find(l => l.key === 'epaulet:' + side), face = scene.layers.find(l => l.key === 'epaulet-face:' + side);
      assert.ok(strip && Array.isArray(strip.clip) && strip.clip.length > 20, `${tag}: the top face is cut to the board's outline`);
      assert.ok(face && Array.isArray(face.clip) && face.clip.length > 20, `${tag}: the front edge's face is drawn`);
      assert.ok(!strip.shear, `${tag}: no shear`);
      assert.equal(scene.layers.filter(l => (l.key || '').startsWith('epaulet-tip')).length, 0, `${tag}: no separate point`);
      assert.ok(Math.abs(strip.h - 2.5 * worn.k) < 0.002, `${tag}: the top face's sheet is squeezed across to ${strip.h}`);
      const frame = await frameOf(strip), U = frame(strip.clip), F = frame(face.clip);
      // far edge: on the coat's outline, the ridge's depth above the centre line; the top face ends at its front edge; the face under it is worn.face thick; together 0.08 to 0.11 of the length
      const far = edgeAtU(U, 2.0, false), front = edgeAtU(U, 2.0, true), bottom = edgeAtU(F, 2.0, true);
      assert.ok(Math.abs(far + worn.ridge) < 0.03, `${tag}: the far edge lies ${(-far).toFixed(3)} in above the centre line (the ridge's depth ${worn.ridge.toFixed(3)})`);
      assert.ok(Math.abs(front - (worn.top - worn.ridge)) < 0.03, `${tag}: the top face ends ${front.toFixed(3)} in below the centre line`);
      assert.ok(Math.abs(bottom - (worn.total - worn.ridge)) < 0.03, `${tag}: the front face ends ${bottom.toFixed(3)} in below the centre line`);
      const total = bottom - far;
      assert.ok(total / L >= 0.09 && total / L <= 0.115, `${tag}: the board shows ${total.toFixed(3)} in thick, ${(total / L).toFixed(3)} of its length`);
      assert.ok(Math.abs((bottom - front) - worn.face) < 0.03, `${tag}: the front face is ${(bottom - front).toFixed(3)} in thick`);
      // the face has the top face's reach along the strap
      const reach = pts => Math.max(...pts.map(p => p.x)), start = pts => Math.min(...pts.map(p => p.x));
      assert.ok(Math.abs(reach(F) - reach(U)) < 0.05 && Math.abs(start(F) - start(U)) < 0.03, `${tag}: the face runs as far as the top`);
      // no sharp turn along the lower edge of the face (the second half of its outline, the front chain offset down and reversed): the point's slant joins the straight edge by a curve
      let turn = 0;
      const lower = F.slice(F.length / 2);
      for(let i = 1; i < lower.length - 1; i++){
        const a = lower[i - 1], b = lower[i], c = lower[i + 1], d1 = { x: b.x - a.x, y: b.y - a.y }, d2 = { x: c.x - b.x, y: c.y - b.y };
        if(Math.hypot(d1.x, d1.y) < 1e-9 || Math.hypot(d2.x, d2.y) < 1e-9) continue;
        turn = Math.max(turn, Math.abs(Math.atan2(d1.x * d2.y - d1.y * d2.x, d1.x * d2.x + d1.y * d2.y)) * 180 / Math.PI);
      }
      assert.ok(lower.length > 10 && turn < 40, `${tag}: no bend in the face's lower edge (${turn.toFixed(1)} degrees at the sharpest of ${lower.length - 2} vertices)`);
      // the point reaches the board's centre line at its tip, near the far edge
      const tipV = U.filter(p => p.x > L - 0.12).map(p => p.y);
      assert.ok(tipV.length && Math.abs(tipV.reduce((a, b) => a + b, 0) / tipV.length) < 0.08, `${tag}: the point ends on the board's centre line`);
      assert.ok(Math.max(...F.filter(p => p.x > L - 0.3).map(p => p.y)) < worn.total - worn.ridge - 0.05, `${tag}: toward the tip the lower edge rises to the point`);
      // the outer end's corners are rounded: the face's lower edge at the end lies well above the sharp corner (0, bottom) and falls to its full depth only over the corner's 0.32 in, and the top face's far corner is cut by
      // the far edge, not drawn above it
      assert.ok(edgeAtU(F, 0.001, true) < worn.total - worn.ridge - 0.05, `${tag}: the outer end's lower corner is rounded off (the face's lower edge ${edgeAtU(F, 0.001, true).toFixed(3)} in down at the end)`);
      assert.ok(edgeAtU(F, 0.1, true) < bottom - 0.01, `${tag}: the lower edge is still rounding at 0.1 in from the end`);
      assert.ok(Math.min(...U.map(p => p.y)) > -worn.ridge - 0.02 || sex === 'female', `${tag}: nothing of the top face over the far edge`);
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

// The shoulder cord is cut flush with the line of the board's outside end edge, through the board's lower outer corner (the cord's top edge snaps to a vertex of the top face's outline within the cord's snap
// distance of that corner, cordTopEdge). The front edge's face hangs 0.12 in lower than the top face's rounded corner, so there is no vertex that near and the cord's cut is on the corner itself: flush with the board's
// end, its lower line the face's lower edge.
test('the cord is cut flush with the board\'s outer end and its top edge is the face\'s lower edge, with the board worn', async () => {
  const worn = H.boardWorn(L, W), snap = Number(/const CORD_CORNER_SNAP = ([\d.]+);/.exec(fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8'))[1]);
  assert.ok(worn.face > snap, `the face (${worn.face.toFixed(3)} in) hangs lower than the cord's snap distance (${snap}) from the top face's corner`);
  for(const sex of ['male', 'female']){
    const scene = await P.composeUniform(HARNESS.makeBuild({ uniform: 'blues_a', gender: sex, membership: 'cadet', rank: 'C/Col', cord: 'group', name: { first: 'Pat', last: 'Doe', show: true }, opt: { headgear: 'none' } }), store);
    const strip = scene.layers.find(l => l.key === 'epaulet:left'), cl = scene.layers.find(l => l.role === 'garment-layer' && /-cord-/.test(l.id));
    const frame = await frameOf(strip), U = frame(strip.clip), C = frame(cl.clip);
    const corner = { x: 0, y: worn.total - worn.ridge };
    assert.ok(Math.min(...U.map(p => Math.hypot(p.x - corner.x, p.y - corner.y))) > snap, `${sex}: no vertex of the top face is within the snap distance of the lower outer corner`);
    // the cord's cut: the line of the board's end (u = 0) and the line of the face's lower edge (v = corner.y)
    assert.ok(C.filter(p => Math.abs(p.x) < 0.01).length >= 2, `${sex}: the cord is cut on the line of the board's end`);
    assert.ok(Math.abs(Math.max(...C.filter(p => Math.abs(p.x) < 0.01).map(p => p.y)) - corner.y) < 0.01, `${sex}: the cord's cut runs down to the face's lower edge (${corner.y.toFixed(3)} in below the centre line)`);
  }
});

// ---- the grade on the board worn ---------------------------------------------------------------------------------------------------------------
// The forms of a grade (a disc or a diamond each: the second lieutenant's one disc, the first lieutenant's two, the captain's three, the major's one diamond, the lieutenant colonel's two, the colonel's three) stand on the
// board in a row across it, 0.75 in apart on the surface and 0.75 in wide. Each form is a piece of its own, squeezed across by `stand`, 1.3 times less than the surface (the photograph of the real board: the diamonds stand
// up off it), their places foreshortened as the surface is (the pitch by k), so they overlap and the ones behind the front one rise above it; the back form crosses the far edge, and what lies behind the ridge shows only
// what stands above it, a sliver (the photograph of a colonel's board: its third diamond is a sliver 0.2 of the top face above the far edge), BOARD_CROSS. The row is centred on the board's centre line; a row of three is
// wider than the top face and moves back, over the ridge, until its front form is BOARD_FRONT_MARGIN of the top face short of the front edge, as a row of two lies.
const GRADES = ['C/2d Lt', 'C/1st Lt', 'C/Capt', 'C/Maj', 'C/Lt Col', 'C/Col'], FORMS = { 'C/2d Lt': 1, 'C/1st Lt': 2, 'C/Capt': 3, 'C/Maj': 1, 'C/Lt Col': 2, 'C/Col': 3 };
const HONOR_GUARD = { cord: 'honor_guard', cordOnTop: true, ceremonial: { role: 'guard', chinstrap: 'up' } };

// Every form of the grade on each side, front form first, with how far its centre lies below the board's centre line (inches).
async function gradeForms(build){
  const scene = await P.composeUniform(build, store), out = [];
  for(const side of ['right', 'left']){
    const strip = scene.layers.find(l => l.key === 'epaulet:' + side), r = (strip.rotate || 0) * Math.PI / 180, dn = { x: -Math.sin(r), y: Math.cos(r) };
    const forms = scene.layers.filter(l => l.role === 'grade' && (l.key === 'grade:edge-' + side || l.key.startsWith(`grade:edge-${side}:`))).sort((a, b) => (a.key.length - b.key.length) || a.key.localeCompare(b.key))
      .map(layer => ({ layer, down: (layer.origin.x - strip.origin.x) * dn.x + (layer.origin.y - strip.origin.y) * dn.y }));
    out.push({ side, strip, forms, scene });
  }
  return out;
}

test('every grade on the board is a piece for each form, squeezed across by `stand`, set 0.75 in times the surface\'s squeeze apart, the row centred (or moved back) as the front form stays on the top face', async () => {
  const worn = H.boardWorn(L, W);
  assert.equal(H.BOARD_CROSS, 0.20);
  assert.ok(worn.k * 0.75 < worn.stand * 0.75, 'the forms overlap: their pitch is foreshortened more than their width');
  let n = 0;
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const sex of ['male', 'female']) for(const rank of GRADES){
    for(const [side_, build] of [['', hb(uniform, sex, rank)]].concat(uniform === 'blues_a' ? [[' (Honor Guard)', Object.assign(hb(uniform, sex, rank), HONOR_GUARD)]] : [])){
      for(const { side, strip, forms } of await gradeForms(build)){
        const tag = `${uniform} ${sex} ${rank}${side_} ${side}`, spec = await store.load(forms[0].layer.id), dim = spec.raw.dimensions;
        assert.equal(dim.count, FORMS[rank], `${tag}: the grade's form count`);
        assert.equal(forms.length, FORMS[rank], `${tag}: a piece for each form`);
        const row = H.boardRowAt(worn, dim.count, dim.centre_pitch_in, dim.element_w_in);
        forms.forEach(({ layer, down }, nth) => {
          assert.ok(Math.abs(layer.w - spec.w * worn.stand) < 0.005 && Math.abs(layer.h - spec.h) < 0.005, `${tag}: form ${nth} is ${layer.w.toFixed(3)} x ${layer.h.toFixed(3)} in, the sheet squeezed across by ${worn.stand.toFixed(3)}`);
          // the front form is first: its centre is (count - 1) / 2 pitches in front of the row's centre, each form behind it one pitch (foreshortened by k) further back
          const want = row + ((dim.count - 1) / 2 - nth) * dim.centre_pitch_in * worn.k;
          assert.ok(Math.abs(down - want) < 0.005, `${tag}: form ${nth} lies ${down.toFixed(3)} in below the board's centre line (${want.toFixed(3)})`);
          assert.ok(!nth || layer.z < forms[nth - 1].layer.z, `${tag}: form ${nth} is drawn under the one in front of it`);
          assert.equal(layer.key, nth ? `grade:edge-${side}:${nth}` : `grade:edge-${side}`, `${tag}: the layer's key`);
        });
        if(dim.count === 1) assert.ok(Math.abs(forms[0].down) < 0.005, `${tag}: one form lies on the board's centre line`);
        // each piece is cut to the near side of the line BOARD_CROSS of the top face above the far edge, and to its own form's column
        for(const { layer } of forms){
          assert.ok(Array.isArray(layer.clip) && layer.clip.length >= 3, `${tag}: cut to its form's column and the window`);
          const U = (await frameOf(strip))(layer.clip);
          assert.ok(Math.min(...U.map(p => p.y)) >= -worn.ridge - H.BOARD_CROSS * worn.top - 0.005, `${tag}: nothing above the line ${H.BOARD_CROSS} of the top face over the far edge`);
        }
        n++;
      }
    }
  }
  assert.equal(n, 48 + 24, 'two coats, both sexes, six grades and both sides, and the Honor Guard coat of each sex');
});

test('the grades of two or three forms cross the far edge: the back form breaks the outline, the one behind it shows a sliver; the front form lies whole on the top face; one form lies whole on the board', async () => {
  const worn = H.boardWorn(L, W), cut = -worn.ridge - H.BOARD_CROSS * worn.top, frontEdge = worn.top - worn.ridge;
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const sex of ['male', 'female']) for(const rank of GRADES){
    for(const { side, strip, forms } of await gradeForms(hb(uniform, sex, rank))){
      const tag = `${uniform} ${sex} ${rank} ${side}`, spec = await store.load(forms[0].layer.id), hw = spec.raw.dimensions.element_w_in * worn.stand / 2;
      const front = forms[0], back = forms[forms.length - 1];
      // the front form: whole (its far edge inside the window), its near edge short of the top face's front edge
      assert.ok(front.down - hw > cut, `${tag}: the front form is wholly in view`);
      if(forms.length === 1){
        assert.ok(front.down - hw > -worn.ridge - 0.02, `${tag}: one form lies whole on the board, ${(front.down - hw + worn.ridge).toFixed(3)} in below the far edge`);
        continue;
      }
      const margin = frontEdge - (front.down + hw);
      assert.ok(margin >= H.BOARD_FRONT_MARGIN * worn.top - 0.005 && margin < 0.09, `${tag}: the front form ends ${margin.toFixed(3)} in short of the top face's front edge (at least ${(H.BOARD_FRONT_MARGIN * worn.top).toFixed(3)})`);
      if(forms.length === 3) assert.ok(Math.abs(margin - H.BOARD_FRONT_MARGIN * worn.top) < 0.005, `${tag}: a row of three is moved back to ${margin.toFixed(3)} in short of the front edge`);
      // the back form's far edge lies beyond the far edge of the board; what the window leaves of it
      const crosses = -worn.ridge - (back.down - hw), seen = (back.down + hw) - cut;
      assert.ok(crosses > 0.05, `${tag}: the back form reaches ${crosses.toFixed(3)} in beyond the far edge`);
      assert.ok(seen > 0.02, `${tag}: the window leaves ${seen.toFixed(3)} in of the back form: it shows over the far edge`);
      assert.ok(Math.min(...(await frameOf(strip))(back.layer.clip).map(p => p.y)) <= cut + 0.005, `${tag}: the back form is cut by the window's line`);
      // the forms overlap: the next form's far edge reaches past the front one's near edge less its width
      assert.ok(forms[1].down + hw > front.down - hw, `${tag}: the forms overlap`);
    }
  }
});
