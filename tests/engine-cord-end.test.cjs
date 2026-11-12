'use strict';
// LIVE13 (Ethan, 2026-11-12), on the cord that "somehow deletes itself" at the sleeve and at the top: "thats not how they work"; "the cord, goes all the way around the inner part of the sleve, under
// the wearers armpid"; "it should go under the eppaulet flush with the outside edge"; "for cords overall, make them a little bit thicker"; then, on the cord turning in toward the chest: "you have
// them kind of going to the left, which is not realistic". A cord is a loop round the arm, and it never ends on cloth:
//   width     core.CORD_WIDTH, 0.625 in;
//   top       the cord's sleeve-side edge passes through the epaulet's outer lower corner (the line of its outside end edge), the run goes on up under the epaulet, to be cut by the outline or
//             hidden by the epaulet, so no end of it is in sight; the epaulet is drawn over it (or, on the Honor Guard uniform, it is drawn over the epaulet, cut at that end edge);
//   armpit    the centre line runs straight down to the apex of the gap between arm and body (or the inner end of a short sleeve's hem); over the last cord width before it the two edges close in on
//             the apex (core.cordTipCut, layer.clipOut), so the cord ends in the point of the armpit and nothing of it is below the apex, over the gap or on the body; no turn, no end cap in sight.
// What the sheets state is read from the sheets (scripts/measure-armpit.cjs), not from the engine's tables.
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
const MEASURE_ARMPIT = require('../scripts/measure-armpit.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const read = id => fs.readFileSync(path.join(root, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

global.self = global.self || global;
global.CordBraid = CB;
require('../js/engine/render-svg.js');
const RS = global.self.CAPUBEngine.renderSvg;
global.self.CAPUBEngine.cords = CORDS;
global.self.CAPUBEngine.core = core;

const SHEETS = [
  ['garment-blues-class-a-coat', 'blues_a', 'male', {}], ['garment-blues-class-a-coat-female', 'blues_a', 'female', {}],
  ['garment-blues-class-b-shirt-male', 'blues_b', 'male', { sleeve: 'short' }], ['garment-blues-class-b-shirt-male-long', 'blues_b', 'male', { sleeve: 'long' }],
  ['garment-blues-class-b-blouse-female', 'blues_b', 'female', { sleeve: 'short' }], ['garment-blues-class-b-blouse-female-long', 'blues_b', 'female', { sleeve: 'long' }]
];
const ALL = CORDS.REGULATION.concat(CORDS.supplementIds());
const colourFor = id => CORDS.needsColour(id) ? CORDS.chosenColours()[0].name : null;
const compose = (sheet, cord, extra, who) => P.composeUniform(Object.assign(HARNESS.makeBuild(Object.assign({ uniform: sheet[1], gender: sheet[2], membership: 'cadet', rank: 'C/Maj', cord, name: { first: 'Pat', last: 'Doe', show: true }, opt: Object.assign({ headgear: 'none' }, sheet[3]) }, who || {})), { cordColour: colourFor(cord) }, extra || {}), store);
const runOf = scene => scene.layers.find(l => l.cordLook && !l.cordLook.pendant && !l.cordLook.tip);
const pendantOf = scene => scene.layers.find(l => l.cordLook && l.cordLook.pendant);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const unit = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
const sleeveNormal = t => [t[1], -t[0]];          // toward the sleeve: the sheet's right, for a cord running down
const inside = (poly, p) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if((a.y > p[1]) !== (b.y > p[1]) && p[0] < (b.x - a.x) * (p[1] - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
const FLUSH = 0.02;
const area = p => { let a = 0; for(let i = 0; i < p.length; i++){ const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; };
const { silhouette } = require('../scripts/lib-svg-ink.cjs');
const outerRing = id => silhouette(read(id)).sort((a, b) => area(b) - area(a))[0];

test('the cord is 0.625 in across; the turn toward the body of the second pass is gone: no arc, no radius, no tail', () => {
  assert.equal(core.CORD_WIDTH, 0.625);
  for(const gone of ['CORD_TURN', 'CORD_SWEEP', 'CORD_TAIL', 'CORD_END_EXTEND']) assert.equal(core[gone], undefined, `core.${gone} is gone`);
  assert.equal(core.CORD_BEYOND, 0.4);
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'core.js'), 'utf8') + fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  for(const gone of ['sweep', 'BODY_SIDE', 'cordHidden', 'cordWindow', 'clipPlus']) assert.ok(!src.includes(gone), `${gone} is gone from the engine`);
});

test('core.wrapCord on a straight run: flush at the top, the centre line on the apex, straight on past it, one smooth line', () => {
  const w = 0.625, edge = [1.0, 2.0], apex = [0.4, 9.0];
  const r = core.wrapCord([[0.5, 1], [0.5, 5], [0.5, 10]], { width: w, edge, apex });
  // top: the centre line is half a width to the body side of the corner (the cord runs straight down here), its sleeve-side edge on the corner
  assert.ok(Math.abs(r.top[0] - (edge[0] - w / 2)) < 1e-9 && Math.abs(r.offsets.top - (edge[0] - w / 2 - 0.5)) < 1e-9, `top ${r.top}`);
  // armpit: the centre line ends on the apex itself, and the offset there is what puts it there
  assert.ok(Math.hypot(r.bottom[0] - apex[0], r.bottom[1] - apex[1]) < 0.01, `bottom ${r.bottom}`);
  assert.ok(Math.abs(r.offsets.bottom - (apex[0] - 0.5)) < 0.01, `offset ${r.offsets.bottom}`);
  // the offset goes linearly with the length between the two
  const mid = r.points[Math.round((r.topIndex + r.bottomIndex) / 2)];
  assert.ok(Math.abs(mid[0] - (r.top[0] + r.bottom[0]) / 2) < 0.01, `mid ${mid}`);
  // past the apex the path goes on straight in its own direction CORD_BEYOND, and no more
  const tail = r.points.slice(r.bottomIndex);
  assert.ok(Math.abs(Math.hypot(r.end[0] - r.bottom[0], r.end[1] - r.bottom[1]) - core.CORD_BEYOND) < 1e-9, `end ${r.end}`);
  for(const q of tail) assert.ok(Math.abs((q[0] - r.bottom[0]) * r.heading[1] - (q[1] - r.bottom[1]) * r.heading[0]) < 1e-9, 'straight on past the apex');
  assert.ok(Math.abs(r.heading[0]) < 0.05 && r.heading[1] > 0.99, `heading ${r.heading}: down, not turned toward the body`);
  // the path goes on up above the top, straight
  assert.ok(Math.abs(r.start[1] - (1 - core.CORD_UP)) < 1e-9 && Math.abs(r.start[0] - r.top[0]) < 0.01, `start ${r.start}`);
  assert.ok(!('arc' in r), 'no arc');
  for(let i = 1; i < r.pieces.length; i++){
    const a = unit(r.pieces[i - 1].a, r.pieces[i - 1].b), b = unit(r.pieces[i].a, r.pieces[i].b);
    assert.ok(Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180 / Math.PI <= 5, `a kink at piece ${i}`);
  }
});

test('core.cordTipCut: the two edges close in on the apex over the last cord width, nothing is left beyond it', () => {
  const w = 0.625, at = [5, 10], h = [0, 1], cut = core.cordTipCut(at, h, w);
  // the cord's frame here: down is along the heading, the sleeve side to its right (x)
  const cutAt = (x, y) => inside(cut, [x, y]);
  assert.ok(!cutAt(5, 10 - w), 'the centre of the braid a width before the apex is kept');
  assert.ok(!cutAt(5, 10 - 0.01), 'and just before the apex');
  assert.ok(cutAt(5, 10 + 0.01), 'nothing beyond the apex');
  assert.ok(cutAt(5 + 3, 10 + 0.5) && cutAt(5 - 3, 10 + 0.5), 'on neither side');
  // half a width before the apex the braid is half as wide as it is: a quarter of a width each side of the centre line
  assert.ok(!cutAt(5 + w / 4 - 0.02, 10 - w / 2) && cutAt(5 + w / 4 + 0.02, 10 - w / 2), 'the right edge closes in');
  assert.ok(!cutAt(5 - w / 4 + 0.02, 10 - w / 2) && cutAt(5 - w / 4 - 0.02, 10 - w / 2), 'and the left edge');
  assert.ok(!cutAt(5 + w / 2 - 0.02, 10 - w - 0.02) && !cutAt(5 - w / 2 + 0.02, 10 - w - 0.02), 'the full width before the closing begins');
  assert.equal(cut.length, 7, 'one polygon');
});

test('every sheet and every cord (the seven of the regulation and the supplements\'): the width, the top flush with the epaulet\'s end edge and carried on up, the centre line on the apex, no turn', async () => {
  const armpits = MEASURE_ARMPIT.compute();
  let checked = 0;
  for(const sheet of SHEETS) for(const id of ALL){
    const tag = `${sheet[0]} ${id}`, scene = await compose(sheet, id), cl = runOf(scene);
    assert.ok(cl && cl.cordPath, `${tag}: drawn`);
    const cp = cl.cordPath, w = cp.width, pts = cp.points;
    assert.equal(w, id === 'aide_de_camp' ? (await store.load(`${sheet[0]}-cord-aide-de-camp`)).raw.dimensions.braid_thickness_in : core.CORD_WIDTH, `${tag}: the braid's width`);
    // top: the sleeve-side edge of the braid at `top` is on the epaulet's outer lower corner
    const tIdx = cp.topIndex, tTan = unit(pts[Math.max(0, tIdx - 2)], pts[Math.min(pts.length - 1, tIdx + 2)]), tN = sleeveNormal(tTan);
    const edgeOnCord = [cp.top[0] + tN[0] * w / 2, cp.top[1] + tN[1] * w / 2];
    assert.ok(Math.hypot(edgeOnCord[0] - cp.edge[0], edgeOnCord[1] - cp.edge[1]) <= FLUSH, `${tag}: the cord's sleeve-side edge is ${Math.hypot(edgeOnCord[0] - cp.edge[0], edgeOnCord[1] - cp.edge[1]).toFixed(3)} in from the epaulet's corner`);
    // and the run goes on up under the epaulet: CORD_UP further, past where it is cut
    assert.ok(cp.start[1] < cp.top[1] - 1.5, `${tag}: the path starts ${(cp.top[1] - cp.start[1]).toFixed(2)} in above the top`);
    // the start is never in sight: under the epaulet it is cut away by the layer's clip; with no epaulet it is outside the outline
    if(Array.isArray(cl.clip)) assert.ok(!inside(cl.clip, cp.start), `${tag}: the path's start is cut away`);
    else assert.ok(!inside(outerRing(sheet[0]).map(q => ({ x: q[0], y: q[1] })), cp.start), `${tag}: the path's start is outside the outline`);
    // the armpit: the apex is the sheet's own, and the centre line ends on it
    const ap = armpits[sheet[0]];
    assert.deepEqual(cp.apex, ap, `${tag}: the apex of the gap`);
    assert.ok(Math.hypot(cp.bottom[0] - ap[0], cp.bottom[1] - ap[1]) < 0.01 && Math.hypot(pts[cp.bottomIndex][0] - ap[0], pts[cp.bottomIndex][1] - ap[1]) < 0.01, `${tag}: the centre line ends ${Math.hypot(cp.bottom[0] - ap[0], cp.bottom[1] - ap[1]).toFixed(4)} in from the apex`);
    // no turn: the path goes on straight in the direction it has at the apex, CORD_BEYOND, and that heading is down the cord
    assert.ok(!('arc' in cp), `${tag}: no arc`);
    const tail = pts.slice(cp.bottomIndex), head = unit(pts[cp.bottomIndex - 2], pts[cp.bottomIndex]);
    for(const q of tail) assert.ok(Math.abs((q[0] - ap[0]) * cp.heading[1] - (q[1] - ap[1]) * cp.heading[0]) <= 0.02, `${tag}: the path goes straight on past the apex`);
    assert.ok(dot(head, cp.heading) > 0.9999 && cp.heading[1] > 0.95, `${tag}: heading ${cp.heading.map(v => v.toFixed(3))}: down, not toward the body`);
    assert.ok(Math.abs(Math.hypot(cp.end[0] - cp.bottom[0], cp.end[1] - cp.bottom[1]) - core.CORD_BEYOND) < 1e-6, `${tag}: and no further than CORD_BEYOND`);
    assert.ok(Math.max(...pts.map(q => q[1])) <= ap[1] + core.CORD_BEYOND + 0.001, `${tag}: no point of the path lies more than CORD_BEYOND below the apex`);
    for(let i = 1; i < cp.pieces.length; i++){
      const a = unit(cp.pieces[i - 1].a, cp.pieces[i - 1].b), b = unit(cp.pieces[i].a, cp.pieces[i].b);
      assert.ok(Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180 / Math.PI <= 5, `${tag}: a kink at piece ${i}`);
    }
    // the cut at the armpit is core.cordTipCut on the apex, one polygon, and the end cap lies wholly in it
    assert.ok(Array.isArray(cl.clipOut) && cl.clipOut.length === 1, `${tag}: one region cut away`);
    assert.deepEqual(cl.clipOut[0], core.cordTipCut(cp.bottom, cp.heading, w), `${tag}: it is the armpit's cut`);
    const h = cp.heading, n = [-h[1], h[0]], capLen = CB.LOOK.cap.length / CB.LOOK.width * w, capHalf = CB.LOOK.cap.width / CB.LOOK.width * w / 2;
    for(const [a, b] of [[0, -1], [0, 1], [-capLen, -1], [-capLen, 1]]){
      const q = [cp.end[0] + h[0] * a + n[0] * capHalf * b, cp.end[1] + h[1] * a + n[1] * capHalf * b];
      assert.ok(inside(cl.clipOut[0], q), `${tag}: a corner of the end cap lies in the cut-away part`);
    }
    checked++;
  }
  assert.equal(checked, SHEETS.length * ALL.length);
});

// The braid as drawn near the armpit, from the layer: the points of the braid's band (the path and half the width each side) that are not cut away, within 3 in of the apex.
function visibleBand(cl, ap){
  const cp = cl.cordPath, w = cp.width, out = [];
  for(let i = 1; i < cp.points.length; i++){
    const a = cp.points[i - 1], b = cp.points[i], tg = unit(a, b), nn = sleeveNormal(tg);
    if(b[1] < ap[1] - 3) continue;
    for(let k = -10; k <= 10; k++){
      const u = (k / 10) * (w / 2), p = [b[0] + nn[0] * u, b[1] + nn[1] * u];
      if(cl.clipOut.some(poly => inside(poly, p))) continue;
      if(Array.isArray(cl.clip) && !inside(cl.clip, p)) continue;
      out.push(p);
    }
  }
  return out;
}

test('on every sheet, nothing of the cord is drawn below the apex, over the gap between arm and body, or in the empty space under a short sleeve', async () => {
  const armpits = MEASURE_ARMPIT.compute();
  for(const sheet of SHEETS) for(const id of ['wing', 'honor_guard', 'ner-rcls', 'aide_de_camp']){
    const tag = `${sheet[0]} ${id}`, scene = await compose(sheet, id), cl = runOf(scene), ap = armpits[sheet[0]];
    const rings = silhouette(read(sheet[0])).sort((a, b) => area(b) - area(a)), outer = rings[0].map(q => ({ x: q[0], y: q[1] })), holes = rings.slice(1).map(r => r.map(q => ({ x: q[0], y: q[1] })));
    const ringDist = p => Math.min(...rings.map(r => r.reduce((m, a, i) => { const b = r[(i + 1) % r.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.min(m, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)); }, Infinity)));
    const band = visibleBand(cl, ap);
    assert.ok(band.length > 200, `${tag}: ${band.length} points of the braid are drawn`);
    // below the apex: none (the braid's point is the apex)
    const lowest = Math.max(...band.map(p => p[1]));
    assert.ok(lowest <= ap[1] + 0.005, `${tag}: the braid is drawn ${(lowest - ap[1]).toFixed(3)} in below the apex`);
    // over the gap or the empty space: every point drawn is on cloth (inside the outline, not in a hole), the point of the braid within 0.03 in of an edge
    const off = band.filter(p => (!inside(outer, p) || holes.some(h => inside(h, p))) && ringDist(p) > 0.03);
    assert.equal(off.length, 0, `${tag}: ${off.length} points of the braid are drawn over the gap or the empty space, the first at ${off[0] && off[0].map(v => v.toFixed(3))}`);
  }
});

test('the top: cut flush at the epaulet\'s end edge, a few hundredths under the epaulet at its lower edge, over the epaulet on the Honor Guard uniform; the epaulet is drawn over the cord', async () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  const TUCK = Number(/const CORD_TUCK = ([\d.]+);/.exec(src)[1]);
  for(const sheet of SHEETS) for(const rank of ['C/Maj', 'C/Col']) for(const extra of [{}, { cordOnTop: true }]){
    const scene = await compose(sheet, 'wing', extra, { rank }), cl = runOf(scene), cp = cl.cordPath, tag = `${sheet[0]} ${rank} ${JSON.stringify(extra)}`;
    assert.ok(Array.isArray(cl.clip) && cl.clip.length === 6, `${tag}: the cut`);
    // the cut's corner is the epaulet's corner the cord is laid on
    assert.ok(Math.hypot(cl.clip[5].x - cp.edge[0], cl.clip[5].y - cp.edge[1]) < 1e-9, `${tag}: it is cut at the line of the end edge through that corner`);
    const tuck = Math.hypot(cl.clip[0].x - cl.clip[5].x, cl.clip[0].y - cl.clip[5].y);
    if(extra.cordOnTop){ assert.ok(tuck > 59, `${tag}: over the epaulet, not cut at its lower edge`); const over = Math.max(...scene.layers.filter(l => /^epaulet(-shade:[a-z]+|-tip)?:left$/.test(l.key || '')).map(l => l.z)); assert.ok(cl.z > over, `${tag}: above the epaulet and its shading (${over})`); }
    else{
      assert.ok(Math.abs(tuck - TUCK) < 1e-9, `${tag}: under it, cut ${TUCK} in above its lower edge`);
      const over = scene.layers.find(l => l.key === 'epaulet:left' && l.role === 'epaulet');
      assert.ok(over && over.z > cl.z, `${tag}: the epaulet is drawn over the cord`);
    }
    // the sleeve side of the cord is not cut: a point of the cord's sleeve-side edge a little below the corner is kept; the cut removes what lies past the end edge above the lower edge
    const tTan = unit(cp.points[Math.max(0, cp.topIndex - 2)], cp.points[cp.topIndex + 2]), tN = sleeveNormal(tTan), p = [cp.top[0] + tN[0] * cp.width / 2 + tTan[0] * 0.3, cp.top[1] + tN[1] * cp.width / 2 + tTan[1] * 0.3];
    assert.ok(inside(cl.clip, p), `${tag}: the edge of the cord below the epaulet is not cut`);
  }
});

test('the aide cord\'s run is laid like every cord, in its own braid\'s width; its hanging pendant is not a run and is not, and the run\'s strands hang from where the cord comes out', async () => {
  for(const sheet of SHEETS){
    const scene = await compose(sheet, 'aide_de_camp', null, { membership: 'senior', rank: 'Capt' }), run = runOf(scene), pend = pendantOf(scene);
    assert.ok(run && run.cordPath.heading && run.cordPath.width < core.CORD_WIDTH && Array.isArray(run.clipOut) && run.clipOut.length === 1, `${sheet[0]}: the run is laid like every cord, ending in the point of the armpit, in the aiguillette's own width`);
    assert.deepEqual(run.clipOut[0], core.cordTipCut(run.cordPath.bottom, run.cordPath.heading, run.cordPath.width), `${sheet[0]}: its edges close in over its own width`);
    assert.ok(pend && !pend.cordPath.heading && !('clipOut' in pend), `${sheet[0]}: the pendant hangs straight down from its attachment and is as it was`);
  }
  // a cord with a strand hangs it from the point the cord comes out from under the epaulet at, not from the far end of the carried-up path
  const cut = SHEETS[3], layer = runOf(await compose(cut, 'ga-cadet-of-the-year')), cp = layer.cordPath;
  const svg = read(`${cut[0]}-cord-${CORDS.carrierOf('ga-cadet-of-the-year')}`), t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/), [tx, ty, s] = [Number(t[1]), Number(t[2]), Number(t[3])];
  const b = RS.cordBraid(layer, tx, ty, s, 'e-'), nums = d => (String(d).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
  const ys = [...b.extras.matchAll(/\sd="([^"]+)"/g)].flatMap(m => { const v = nums(m[1].replace(/[A-Za-z]/g, ' ')); const o = []; for(let i = 1; i < v.length; i += 2) o.push((ty + s * v[i]) / 100); return o; });
  assert.ok(Math.min(...ys) >= cp.top[1] - 0.05, `the strands start at ${Math.min(...ys).toFixed(2)}, the cord comes out at ${cp.top[1].toFixed(2)}`);
});

test('the renderer lays the braid along the whole path, the end cap on the path\'s last point (cut away), and cuts each away-region once', async () => {
  for(const sheet of SHEETS) for(const id of ['wing', 'honor_guard', 'ner-rcls']){
    const cid = `${sheet[0]}-cord-${CORDS.carrierOf(id)}`, svg = read(cid);
    const t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/), [tx, ty, s] = [Number(t[1]), Number(t[2]), Number(t[3])];
    const cl = runOf(await compose(sheet, id)), cp = cl.cordPath, tag = `${sheet[0]} ${id}`;
    const b = RS.cordBraid(cl, tx, ty, s, 'e-');
    assert.ok(b && b.run.length > 500, `${tag}: a braid`);
    const nums = d => (String(d).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    const pts = [...b.run.matchAll(/\sd="([^"]+)"/g)].flatMap(m => { const v = nums(m[1].replace(/[A-Za-z]/g, ' ')); const o = []; for(let i = 0; i + 1 < v.length; i += 2) o.push([(tx + s * v[i]) / 100, (ty + s * v[i + 1]) / 100]); return o; });
    const h = cp.heading, lowest = Math.max(...pts.filter(q => Math.hypot(q[0] - cp.end[0], q[1] - cp.end[1]) < 0.9).map(q => dot([q[0] - cp.end[0], q[1] - cp.end[1]], h)));
    // (the cap's path is drawn inside its outline's half stroke, the cap's corner radius)
    assert.ok(lowest <= 0.01 && lowest >= -0.03, `${tag}: the braid's last edge is ${lowest.toFixed(3)} in from the end of the path`);
    const highest = Math.min(...pts.map(q => q[1]));
    assert.ok(highest <= cp.start[1] + 0.1, `${tag}: the braid runs up to the path's start (${highest.toFixed(2)} against ${cp.start[1].toFixed(2)})`);
  }
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'render-svg.js'), 'utf8');
  assert.ok(src.includes('for(const poly of layer.clipOut)'), 'the renderer cuts away each region by its own clip, so regions that overlap are cut once, not twice (even-odd would give them back)');
  assert.ok(!src.includes('clipPlus') && !src.includes('cordClip'), 'no window through the outline: nothing of the cord is drawn over the gap');
});
