'use strict';
// LIVE13 (Ethan, 2026-11-12), on the cord that "somehow deletes itself" at the sleeve and at the top: "thats not how they work"; "the cord, goes all the way around the inner part of the sleve, under
// the wearers armpid"; "it should go under the eppaulet flush with the outside edge"; "for cords overall, make them a little bit thicker"; on the turn toward the chest, "kind of going to the left,
// which is not realistic"; on the point at the armpit, "There's still a bit of coat and shirt below the cord"; then, choosing a straight cord: "it should go down further until the entire rectangle of
// the cord is out there. it should be obvious that it bends around the seam". A cord is a loop round the arm, and it never ends on cloth:
//   width     core.CORD_WIDTH, 0.625 in;
//   top       the cord's sleeve-side edge passes through the epaulet's outer lower corner (the line of its outside end edge), the line goes on up under the epaulet, to be cut by the outline or hidden
//             by the epaulet, so no end of it is in sight; the epaulet is drawn over it (or, on the Honor Guard uniform, it is drawn over the epaulet, cut at that end edge);
//   line      one straight segment from the top T to the end E: nothing bends, nothing tapers, nothing is cut away at the end (layer.clipPlus is a window through the outline there);
//   end       E lies below the apex of the gap between arm and body (or the inner end of a short sleeve's hem), at the least depth at which the braid's end piece, the small rectangle that ends it,
//             and the 0.3 in below it lie wholly in the open (outside every garment fill), the cord still passing over the armpit; where the gap never takes the end piece (the men's long sleeve
//             shirt's slit) the line goes through the apex in the seam's direction and ends at the men's coat's depth.
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
const { silhouette } = require('../scripts/lib-svg-ink.cjs');
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
const SLIT = new Set(['garment-blues-class-b-shirt-male-long']);      // the sheets whose gap never takes the end piece
const ALL = CORDS.REGULATION.concat(CORDS.supplementIds());
const colourFor = id => CORDS.needsColour(id) ? CORDS.chosenColours()[0].name : null;
const compose = (sheet, cord, extra, who) => P.composeUniform(Object.assign(HARNESS.makeBuild(Object.assign({ uniform: sheet[1], gender: sheet[2], membership: 'cadet', rank: 'C/Maj', cord, name: { first: 'Pat', last: 'Doe', show: true }, opt: Object.assign({ headgear: 'none' }, sheet[3]) }, who || {})), { cordColour: colourFor(cord) }, extra || {}), store);
const runOf = scene => scene.layers.find(l => l.cordLook && !l.cordLook.pendant && !l.cordLook.tip);
const pendantOf = scene => scene.layers.find(l => l.cordLook && l.cordLook.pendant);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const unit = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
const sleeveNormal = t => [t[1], -t[0]];          // toward the sleeve: the sheet's right, for a cord running down
const inside = (poly, p) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if((a.y > p[1]) !== (b.y > p[1]) && p[0] < (b.x - a.x) * (p[1] - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
const insideA = (poly, p) => inside(poly.map(q => ({ x: q[0], y: q[1] })), p);
const FLUSH = 0.02;
const area = p => { let a = 0; for(let i = 0; i < p.length; i++){ const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; };
const rings = id => silhouette(read(id)).sort((a, b) => area(b) - area(a));
const outerRing = id => rings(id)[0];
// cloth: inside the outline and not in a hole (the sheet's own silhouette, independent of the engine's GAP table)
const clothOf = id => { const r = rings(id); return p => insideA(r[0], p) && !r.slice(1).some(h => insideA(h, p)); };
// The end piece of a cord layer and the CORD_END_CLEAR below it, as sample points: from the piece's top edge to 0.3 in below its lower edge, the width of the piece.
function endPiecePoints(cp){
  const w = cp.width, h = cp.heading, n = sleeveNormal(h), capLen = CB.LOOK.cap.length / CB.LOOK.width * w, capW = CB.LOOK.cap.width / CB.LOOK.width * w, pts = [];
  for(let s = -capLen; s <= 0.3 + 1e-9; s += 0.02) for(let k = -5; k <= 5; k++) pts.push([cp.end[0] + h[0] * s + n[0] * (k / 5 * capW / 2), cp.end[1] + h[1] * s + n[1] * (k / 5 * capW / 2)]);
  return pts;
}

test('the cord is 0.625 in across; the turn, the point and the window\'s cut-aways of the earlier passes are gone', () => {
  assert.equal(core.CORD_WIDTH, 0.625);
  for(const gone of ['CORD_TURN', 'CORD_SWEEP', 'CORD_TAIL', 'CORD_END_EXTEND', 'CORD_BEYOND', 'wrapCord', 'cordTipCut']) assert.equal(core[gone], undefined, `core.${gone} is gone`);
  assert.equal(core.CORD_END_MAX, 2.5);
  assert.equal(core.CORD_END_CLEAR, 0.3);
  // the end piece's size is cord-braid.js's own (a braid width's share of its length and width)
  assert.ok(Math.abs(core.CORD_CAP.length - CB.LOOK.cap.length / CB.LOOK.width) < 0.001 && Math.abs(core.CORD_CAP.width - CB.LOOK.cap.width / CB.LOOK.width) < 0.001, 'CORD_CAP is the braid\'s end piece');
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'core.js'), 'utf8') + fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  for(const gone of ['sweep', 'BODY_SIDE', 'cordHidden', 'cordTipCut', 'CORD_BEYOND']) assert.ok(!src.includes(gone), `${gone} is gone from the engine`);
});

test('core.straightCord on a wedge: one straight segment, flush at the top, the end piece wholly in the open at the least depth, the apex under the cord', () => {
  const w = 0.625, edge = [4, 2], apex = [3.7, 9], seamDir = [-0.05, 1];
  // a gap opening below the apex, 0.2 in wider each side per inch of depth
  const gap = [[3.7, 9], [4.9, 15], [2.5, 15]];
  const r = core.straightCord({ width: w, edge, apex, seamDir, gap, slitDepth: 1.4 });
  assert.equal(r.mode, 'found');
  assert.equal(r.pieces.length, 1, 'one straight segment');
  assert.deepEqual(r.points, [r.start, r.end]);
  // top: the sleeve-side edge of the braid is on the corner
  const n = sleeveNormal(r.heading);
  assert.ok(Math.hypot(r.top[0] + n[0] * w / 2 - edge[0], r.top[1] + n[1] * w / 2 - edge[1]) < 1e-9, 'the sleeve-side edge is on the corner');
  assert.ok(Math.abs(Math.hypot(r.start[0] - r.top[0], r.start[1] - r.top[1]) - core.CORD_UP) < 1e-9 && dot(unit(r.start, r.top), r.heading) > 0.999999, 'the line goes on up past the top, straight');
  assert.ok(Math.abs(dot(unit(r.top, r.end), r.heading) - 1) < 1e-9, 'T to E is the heading');
  // end: below the apex, the end piece and the 0.3 below it in the gap, the apex within half a width of the centre line
  assert.ok(r.end[1] > apex[1] && r.depth <= core.CORD_END_MAX && Math.abs(r.depth - (r.end[1] - apex[1])) < 1e-9, `depth ${r.depth}`);
  assert.ok(Math.abs(dot([apex[0] - r.top[0], apex[1] - r.top[1]], n)) <= w / 2 + 1e-9, 'the apex is under the cord');
  for(const p of endPiecePoints({ width: w, heading: r.heading, end: r.end })) assert.ok(insideA(gap, p), `the end piece's ${p.map(v => v.toFixed(2))} is in the gap`);
  // the least depth: 0.05 in less and no end fits
  const less = core.straightCord({ width: w, edge, apex, seamDir, gap, slitDepth: 1.4, maxDepth: r.depth - 0.05 });
  assert.equal(less.mode, 'slit', 'nothing shallower fits');
  // a slit: no end fits, so the line goes through the apex in the seam's direction and ends at slitDepth below it
  const slit = core.straightCord({ width: w, edge, apex, seamDir, gap: [[3.7, 9], [3.75, 15], [3.65, 15]], slitDepth: 1.4 });
  assert.equal(slit.mode, 'slit');
  assert.ok(Math.abs(slit.depth - 1.4) < 1e-9 && Math.abs(dot([apex[0] - slit.top[0], apex[1] - slit.top[1]], sleeveNormal(slit.heading))) < 1e-9, 'through the apex, 1.4 in below it');
  assert.equal(slit.angle, 0);
});

test('the GAP table is the open gap at the armpit on each sheet (regenerate with scripts/measure-armpit.cjs)', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  const body = /\/\/ GAP begin\n([\s\S]*?)\/\/ GAP end/.exec(src);
  assert.ok(body, 'the table is marked in the engine');
  assert.deepEqual(new Function(body[1] + '; return GAP;')(), MEASURE_ARMPIT.computeGap());
});

test('every sheet and every cord (the seven of the regulation and the supplements\'): one straight line, flush at the top and carried up under the epaulet, the end piece wholly in the open', async () => {
  const armpits = MEASURE_ARMPIT.compute();
  let checked = 0;
  for(const sheet of SHEETS) for(const id of ALL){
    const tag = `${sheet[0]} ${id}`, scene = await compose(sheet, id), cl = runOf(scene);
    assert.ok(cl && cl.cordPath, `${tag}: drawn`);
    const cp = cl.cordPath, w = cp.width, h = cp.heading;
    assert.equal(w, id === 'aide_de_camp' ? (await store.load(`${sheet[0]}-cord-aide-de-camp`)).raw.dimensions.braid_thickness_in : core.CORD_WIDTH, `${tag}: the braid's width`);
    // one straight segment: the path has two points and one piece, and the heading is the line's own direction
    assert.equal(cp.points.length, 2, `${tag}: one segment`);
    assert.equal(cp.pieces.length, 1, `${tag}: one piece`);
    assert.ok(dot(unit(cp.start, cp.end), h) > 0.999999 && dot(unit(cp.top, cp.end), h) > 0.999999, `${tag}: the line runs along its heading`);
    // top: the sleeve-side edge of the braid is on the epaulet's outer lower corner
    const n = sleeveNormal(h), edgeOnCord = [cp.top[0] + n[0] * w / 2, cp.top[1] + n[1] * w / 2];
    assert.ok(Math.hypot(edgeOnCord[0] - cp.edge[0], edgeOnCord[1] - cp.edge[1]) <= FLUSH, `${tag}: the cord's sleeve-side edge is ${Math.hypot(edgeOnCord[0] - cp.edge[0], edgeOnCord[1] - cp.edge[1]).toFixed(3)} in from the epaulet's corner`);
    assert.ok(cp.start[1] < cp.top[1] - 1.5, `${tag}: the line starts ${(cp.top[1] - cp.start[1]).toFixed(2)} in above the top`);
    // the start is never in sight: under the epaulet it is cut away by the layer's clip; with no epaulet it is outside the outline
    if(Array.isArray(cl.clip)) assert.ok(!inside(cl.clip, cp.start), `${tag}: the line's start is cut away`);
    else assert.ok(!insideA(outerRing(sheet[0]), cp.start), `${tag}: the line's start is outside the outline`);
    // end: below the apex, within the limit, leaning at most 4 degrees from the seam's own direction
    const ap = armpits[sheet[0]];
    assert.deepEqual(cp.apex, ap, `${tag}: the apex of the gap`);
    assert.ok(cp.end[1] > ap[1] && cp.depth <= core.CORD_END_MAX + 1e-9 && Math.abs(cp.depth - (cp.end[1] - ap[1])) < 1e-9, `${tag}: E lies ${cp.depth.toFixed(3)} in below the apex`);
    assert.ok(cp.angle <= 4, `${tag}: the line leans ${cp.angle.toFixed(2)} degrees from the seam's direction`);
    // the cord passes over the armpit: the apex within half the cord's width of the centre line
    const off = Math.abs(dot([ap[0] - cp.top[0], ap[1] - cp.top[1]], n));
    assert.ok(off <= w / 2 + 1e-6, `${tag}: the apex is ${off.toFixed(3)} in from the centre line, half the width is ${(w / 2).toFixed(3)}`);
    if(SLIT.has(sheet[0])){
      assert.equal(cp.mode, 'slit', `${tag}: the slit`);
      assert.ok(off < 1e-6 && cp.angle === 0, `${tag}: the line goes through the apex in the seam's direction`);
    }else{
      assert.equal(cp.mode, 'found', `${tag}: an end was found in the open`);
      // the end piece's four corners and the 0.3 in below it lie outside every garment fill: read from the sheet's own silhouette
      const cloth = clothOf(sheet[0]), onCloth = endPiecePoints(cp).filter(p => cloth(p));
      assert.equal(onCloth.length, 0, `${tag}: ${onCloth.length} points of the end piece and the 0.3 in below it lie on cloth, the first at ${onCloth[0] && onCloth[0].map(v => v.toFixed(3))}`);
    }
    // no window cut-away: the cord is drawn whole, over the gap too, through the window round the armpit
    assert.ok(!('clipOut' in cl), `${tag}: nothing of the cord is cut away`);
    assert.ok(Array.isArray(cl.clipPlus) && cl.clipPlus.length === 4 && cl.clipPlus.every(q => Math.abs(q.x - ap[0]) <= 1.5 + 1e-9), `${tag}: the window`);
    assert.ok(endPiecePoints(cp).every(p => inside(cl.clipPlus, p)), `${tag}: the end piece lies in the window`);
    checked++;
  }
  assert.equal(checked, SHEETS.length * ALL.length);
});

test('the slit sheet takes the men\'s coat\'s depth, and that depth is the coat\'s own, found from its sheet', async () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  const SLIT_DEPTH = Number(/const CORD_SLIT_DEPTH = ([\d.]+);/.exec(src)[1]);
  const coat = runOf(await compose(SHEETS[0], 'wing')).cordPath, slit = runOf(await compose(SHEETS[3], 'wing')).cordPath;
  assert.equal(coat.mode, 'found');
  assert.ok(Math.abs(coat.depth - SLIT_DEPTH) <= 0.011, `the coat's depth is ${coat.depth.toFixed(3)}, CORD_SLIT_DEPTH ${SLIT_DEPTH}`);
  assert.ok(Math.abs(slit.depth - SLIT_DEPTH) < 1e-6, `the slit sheet's end lies ${slit.depth.toFixed(3)} in below the apex`);
});

test('the cord is one straight line from T to E: it leaves the drawn seam by no more than the sheets\' bows (the women\'s coat 0.9 in), and its direction is within 4 degrees of the seam\'s', async () => {
  const segDist = (q, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy); };
  for(const sheet of SHEETS){
    const cp = runOf(await compose(sheet, 'wing')).cordPath;
    let dev = 0;
    for(const q of cp.seam) if(q[1] >= cp.top[1] && q[1] <= cp.apex[1]) dev = Math.max(dev, segDist(q, cp.top, cp.end));
    assert.ok(dev <= 1.0, `${sheet[0]}: the seam is ${dev.toFixed(3)} in from the line`);
    assert.ok(cp.angle <= 4, `${sheet[0]}: ${cp.angle.toFixed(2)} degrees`);
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
    if(extra.cordOnTop){
      assert.ok(tuck > 59, `${tag}: over the epaulet, not cut at its lower edge`);
      const over = Math.max(...scene.layers.filter(l => /^epaulet(-shade:[a-z]+|-tip)?:left$/.test(l.key || '')).map(l => l.z)); assert.ok(cl.z > over, `${tag}: above the epaulet and its shading (${over})`);
    }else{
      assert.ok(Math.abs(tuck - TUCK) < 1e-9, `${tag}: under it, cut ${TUCK} in above its lower edge`);
      const over = scene.layers.find(l => l.key === 'epaulet:left' && l.role === 'epaulet');
      assert.ok(over && over.z > cl.z, `${tag}: the epaulet is drawn over the cord`);
    }
    // the sleeve side of the cord is not cut: a point of the cord's sleeve-side edge a little below the corner is kept
    const n = sleeveNormal(cp.heading), p = [cp.top[0] + n[0] * cp.width / 2 + cp.heading[0] * 0.3, cp.top[1] + n[1] * cp.width / 2 + cp.heading[1] * 0.3];
    assert.ok(inside(cl.clip, p), `${tag}: the edge of the cord below the epaulet is not cut`);
  }
});

test('the aide cord\'s run is laid like every cord, in its own braid\'s width; its hanging pendant is not a run and is not, and the run\'s strands hang from where the cord comes out', async () => {
  for(const sheet of SHEETS){
    const scene = await compose(sheet, 'aide_de_camp', null, { membership: 'senior', rank: 'Capt' }), run = runOf(scene), pend = pendantOf(scene);
    assert.ok(run && run.cordPath.heading && run.cordPath.width < core.CORD_WIDTH && run.cordPath.points.length === 2, `${sheet[0]}: the run is one straight line, in the aiguillette's own width`);
    assert.ok(run.cordPath.depth > 0 && run.cordPath.depth <= core.CORD_END_MAX, `${sheet[0]}: and ends below the apex`);
    assert.ok(pend && !pend.cordPath.heading && !('clipPlus' in pend) && !('clipOut' in pend), `${sheet[0]}: the pendant hangs straight down from its attachment and is as it was`);
  }
  // a cord with a strand hangs it from the point the cord comes out from under the epaulet at, not from the far end of the carried-up path
  const cut = SHEETS[3], layer = runOf(await compose(cut, 'ga-cadet-of-the-year')), cp = layer.cordPath;
  const svg = read(`${cut[0]}-cord-${CORDS.carrierOf('ga-cadet-of-the-year')}`), t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/), [tx, ty, s] = [Number(t[1]), Number(t[2]), Number(t[3])];
  const b = RS.cordBraid(layer, tx, ty, s, 'e-'), nums = d => (String(d).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
  const ys = [...b.extras.matchAll(/\sd="([^"]+)"/g)].flatMap(m => { const v = nums(m[1].replace(/[A-Za-z]/g, ' ')); const o = []; for(let i = 1; i < v.length; i += 2) o.push((ty + s * v[i]) / 100); return o; });
  assert.ok(Math.min(...ys) >= cp.top[1] - 0.05, `the strands start at ${Math.min(...ys).toFixed(2)}, the cord comes out at ${cp.top[1].toFixed(2)}`);
});

test('the renderer lays the braid along the whole line, its end piece on the line\'s last point, through the window round the armpit and not cut by the sheet\'s own silhouette there', async () => {
  for(const sheet of SHEETS) for(const id of ['wing', 'honor_guard', 'ner-rcls']){
    const cid = `${sheet[0]}-cord-${CORDS.carrierOf(id)}`, svg = read(cid);
    const t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/), [tx, ty, s] = [Number(t[1]), Number(t[2]), Number(t[3])];
    const cl = runOf(await compose(sheet, id)), cp = cl.cordPath, tag = `${sheet[0]} ${id}`;
    const b = RS.cordBraid(cl, tx, ty, s, 'e-');
    assert.ok(b && b.run.length > 500, `${tag}: a braid`);
    const nums = d => (String(d).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    const pts = [...b.run.matchAll(/\sd="([^"]+)"/g)].flatMap(m => { const v = nums(m[1].replace(/[A-Za-z]/g, ' ')); const o = []; for(let i = 0; i + 1 < v.length; i += 2) o.push([(tx + s * v[i]) / 100, (ty + s * v[i + 1]) / 100]); return o; });
    const h = cp.heading, lowest = Math.max(...pts.map(q => dot([q[0] - cp.end[0], q[1] - cp.end[1]], h)));
    // (the cap's path is drawn inside its outline's half stroke, the cap's corner radius)
    assert.ok(lowest <= 0.01 && lowest >= -0.03, `${tag}: the braid's last edge is ${lowest.toFixed(3)} in from the end of the line`);
    const highest = Math.min(...pts.map(q => q[1]));
    assert.ok(highest <= cp.start[1] + 0.1, `${tag}: the braid runs up to the line's start (${highest.toFixed(2)} against ${cp.start[1].toFixed(2)})`);
  }
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'render-svg.js'), 'utf8');
  assert.match(src, /silhouetteClip\(layer\.clipSil, !!layer\.clipOuter, layer\.clipPlus\)/, 'the renderer draws the cord through the outline and the window');
  assert.match(src, /cp\.appendChild\(el\('polygon', \{ points: extra \}\)\)/, 'the window is a polygon of the same clip path as the outline');
  assert.ok(src.includes('removeAttribute(\'clip-path\')') && /cordClip/.test(src), 'the sheet\'s own cut to its silhouette, which has the gap as a hole, is taken off a cord');
  assert.ok(src.includes('for(const poly of layer.clipOut)'), 'a layer\'s cut-away regions are each cut by their own clip, so regions that overlap are cut once');
});
