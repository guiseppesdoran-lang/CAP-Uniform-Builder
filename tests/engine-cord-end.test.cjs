'use strict';
// LIVE13 (Ethan, 2026-11-12), on the cord that "somehow deletes itself" at the sleeve and at the top: "thats not how they work"; "the cord, goes all the way around the inner part of the sleve, under
// the wearers armpid"; "it should go under the eppaulet flush with the outside edge"; "for cords overall, make them a little bit thicker". A cord is a loop round the arm, and it never ends on cloth:
//   width     core.CORD_WIDTH, 0.625 in;
//   top       the cord's sleeve-side edge passes through the epaulet's outer lower corner (the line of its outside end edge), the run goes on up under the epaulet, to be cut by the outline or
//             hidden by the epaulet, so no end of it is in sight; the epaulet is drawn over it (or, on the Honor Guard uniform, it is drawn over the epaulet, cut at that end edge);
//   armpit    at the level of the armpit (the apex of the gap between arm and body) the cord lies wholly on the sleeve side, its body-side edge through the apex;
//   turn      from there the centre line is a circular arc, radius CORD_TURN braid widths, turning toward the body through CORD_SWEEP degrees, then goes on straight a little: all of it behind the
//             body, where the engine does not draw the cord (layer.clipOut: the region on the body side of the body's side edge, from the armpit down), and over the gap, where it is drawn
//             (layer.clipPlus: the window through the outline's cut). No end cap is on cloth anywhere.
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

test('the cord is 0.625 in across, and every size of its wrap is a share of that: the turn is a circle of one braid width (centre line) through 90 degrees', () => {
  assert.equal(core.CORD_WIDTH, 0.625);
  assert.equal(core.CORD_TURN, 1);
  assert.equal(core.CORD_SWEEP, 90);
  assert.equal(core.CORD_END_EXTEND, undefined, 'the straight extension of the first pass is gone');
});

test('core.wrapCord on a straight run: flush at the top, wholly on the sleeve side at the apex, a quarter circle toward the body, then straight on', () => {
  const w = 0.625, edge = [1.0, 2.0], apex = [0.4, 9.0];
  const r = core.wrapCord([[0.5, 1], [0.5, 5], [0.5, 10]], { width: w, edge, apex });
  // top: the centre line is half a width to the body side of the corner (the cord runs straight down here), its sleeve-side edge on the corner
  assert.ok(Math.abs(r.top[0] - (edge[0] - w / 2)) < 1e-9 && Math.abs(r.offsets.top - (edge[0] - w / 2 - 0.5)) < 1e-9, `top ${r.top}`);
  // lower end: level with the apex, the body-side edge through it
  assert.ok(Math.abs(r.bottom[1] - apex[1]) < 1e-9 && Math.abs(r.bottom[0] - (apex[0] + w / 2)) < 1e-9, `bottom ${r.bottom}`);
  // the offset goes linearly with the length between the two
  const mid = r.points[Math.round((r.topIndex + r.bottomIndex) / 2)];
  assert.ok(Math.abs(mid[0] - (r.top[0] + r.bottom[0]) / 2) < 0.01, `mid ${mid}`);
  // the turn: centre one radius toward the body of the lower end, every point of the arc a radius from it, the last heading square to the first
  const R = core.CORD_TURN * w, K = r.arc.centre;
  assert.ok(Math.abs(K[0] - (r.bottom[0] - R)) < 0.01 && Math.abs(K[1] - r.bottom[1]) < 0.01, `centre ${K}`);
  const arcPts = r.points.filter(p => p[1] > r.bottom[1] + 1e-9 && Math.hypot(p[0] - K[0], p[1] - K[1]) < R + 1e-6 && Math.abs(Math.hypot(p[0] - K[0], p[1] - K[1]) - R) < 1e-6);
  assert.ok(arcPts.length >= 28, `${arcPts.length} points on the arc`);
  assert.ok(Math.abs(r.arc.heading[0] + 1) < 0.01 && Math.abs(r.arc.heading[1]) < 0.01, `heading ${r.arc.heading}`);
  assert.ok(Math.abs(r.arc.to[0] - K[0]) < 0.01 && Math.abs(r.arc.to[1] - (K[1] + R)) < 0.01, `arc end ${r.arc.to}`);
  assert.ok(Math.abs(Math.hypot(r.end[0] - r.arc.to[0], r.end[1] - r.arc.to[1]) - core.CORD_TAIL) < 1e-9, `end ${r.end}`);
  // the path goes on up above the top, straight
  assert.ok(Math.abs(r.start[1] - (1 - core.CORD_UP)) < 1e-9 && Math.abs(r.start[0] - r.top[0]) < 0.01, `start ${r.start}`);
  // smooth: no turn of more than 5 degrees between neighbouring pieces
  for(let i = 1; i < r.pieces.length; i++){
    const a = unit(r.pieces[i - 1].a, r.pieces[i - 1].b), b = unit(r.pieces[i].a, r.pieces[i].b);
    assert.ok(Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180 / Math.PI <= 5, `a kink at piece ${i}`);
  }
});

test('every sheet and every cord (the seven of the regulation and the supplements\'): the width, the top flush with the epaulet\'s end edge and carried on up, the armpit on the body-side edge, the turn', async () => {
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
    // the armpit: the apex is the sheet's own; at its level the braid's body-side edge passes through it
    const ap = armpits[sheet[0]];
    assert.deepEqual(cp.apex, ap, `${tag}: the apex of the gap`);
    const bTan = unit(pts[cp.bottomIndex - 2], pts[cp.bottomIndex]), bN = sleeveNormal(bTan), rel = [ap[0] - cp.bottom[0], ap[1] - cp.bottom[1]];
    assert.ok(Math.abs(dot(rel, bN) + w / 2) <= 0.005 && Math.abs(dot(rel, bTan)) <= 0.02, `${tag}: the body-side edge passes ${(dot(rel, bN) + w / 2).toFixed(3)} in from the apex, ${dot(rel, bTan).toFixed(3)} in off its level`);
    // the turn: a circle of one braid width, centre toward the body, 90 degrees from the run's direction, then a short straight
    const R = core.CORD_TURN * w, K = cp.arc.centre;
    assert.ok(Math.abs(Math.hypot(cp.bottom[0] - K[0], cp.bottom[1] - K[1]) - R) < 1e-6 && dot([K[0] - cp.bottom[0], K[1] - cp.bottom[1]], bN) < 0, `${tag}: the turn's centre is a braid width toward the body`);
    assert.ok(Math.abs(dot(cp.arc.heading, bTan)) < 1e-6 && cp.arc.sweep === 90, `${tag}: the turn goes through 90 degrees`);
    assert.ok(Math.abs(Math.hypot(cp.end[0] - cp.arc.to[0], cp.end[1] - cp.arc.to[1]) - core.CORD_TAIL) < 1e-6, `${tag}: and the path goes on ${core.CORD_TAIL} in straight`);
    for(let i = 1; i < cp.pieces.length; i++){
      const a = unit(cp.pieces[i - 1].a, cp.pieces[i - 1].b), b = unit(cp.pieces[i].a, cp.pieces[i].b);
      assert.ok(Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180 / Math.PI <= 5, `${tag}: a kink at piece ${i}`);
    }
    checked++;
  }
  assert.equal(checked, SHEETS.length * ALL.length);
});

test('BODY_SIDE is the body\'s side edge below the armpit on each sheet (regenerate with scripts/measure-armpit.cjs), and is the region the cord is not drawn on: its end cap and all the turn that lies over the body are hidden', async () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  const body = /\/\/ BODY_SIDE begin\n([\s\S]*?)\/\/ BODY_SIDE end/.exec(src);
  assert.ok(body, 'the table is marked in the engine');
  const table = new Function(body[1] + '; return BODY_SIDE;')();
  assert.deepEqual(table, MEASURE_ARMPIT.computeSide());
  const armpits = MEASURE_ARMPIT.compute();
  for(const sheet of SHEETS){
    const side = table[sheet[0]], ap = armpits[sheet[0]];
    assert.deepEqual(side[0], ap, `${sheet[0]}: the edge starts at the armpit`);
    const len = side.reduce((s, p, i) => s + (i ? Math.hypot(p[0] - side[i - 1][0], p[1] - side[i - 1][1]) : 0), 0);
    assert.ok(len >= 1.5, `${sheet[0]}: ${len.toFixed(2)} in of it`);
    for(const id of ['wing', 'honor_guard', 'ner-rcls']){
      const cl = runOf(await compose(sheet, id)), cp = cl.cordPath, tag = `${sheet[0]} ${id}`, w = cp.width;
      assert.ok(Array.isArray(cl.clipOut) && cl.clipOut.length === 1, `${tag}: the region the cord is not drawn on`);
      const hidden = cl.clipOut[0];
      assert.deepEqual(hidden.slice(1, 1 + side.length).map(p => [p.x, p.y]), side, `${tag}: it follows the body's side edge`);
      assert.ok(Math.abs(hidden[0].y - ap[1]) < 1e-9 && hidden[0].x < ap[0] - 5, `${tag}: and runs out to the body from the armpit`);
      // the end cap (the braid's flat end: 0.79 of its width across, 0.272 of a width along) lies wholly in it
      const h = cp.arc.heading, n = [-h[1], h[0]], capLen = CB.LOOK.cap.length / CB.LOOK.width * w, capHalf = CB.LOOK.cap.width / CB.LOOK.width * w / 2;
      for(const [a, b] of [[0, -1], [0, 1], [-capLen, -1], [-capLen, 1]]){
        const q = [cp.end[0] + h[0] * a + n[0] * capHalf * b, cp.end[1] + h[1] * a + n[1] * capHalf * b];
        assert.ok(inside(hidden, q), `${tag}: a corner of the end cap lies on the body side and is not drawn`);
      }
      // the arc from 20 degrees to its end that lies on the body side of the edge is hidden; the outer edge of the braid meets the edge about 1.4 widths below the armpit
      const outerMeet = (() => {
        // the braid's outer edge: the arc at one and a half widths from its centre, then the tail's outer side
        const K = cp.arc.centre, R = cp.arc.radius, tau = unit(cp.points[cp.bottomIndex - 2], cp.points[cp.bottomIndex]), nS = sleeveNormal(tau), edgeAt = (th, tail) => {
          const c = [K[0] + R * (nS[0] * Math.cos(th) + tau[0] * Math.sin(th)), K[1] + R * (nS[1] * Math.cos(th) + tau[1] * Math.sin(th))], o = [nS[0] * Math.cos(th) + tau[0] * Math.sin(th), nS[1] * Math.cos(th) + tau[1] * Math.sin(th)];
          return [c[0] + cp.arc.heading[0] * tail + o[0] * w / 2, c[1] + cp.arc.heading[1] * tail + o[1] * w / 2];
        };
        for(let th = 0; th <= Math.PI / 2 + 1e-9; th += Math.PI / 720){ const p = edgeAt(th, 0); if(inside(hidden, p)) return p; }
        for(let t = 0; t <= core.CORD_TAIL; t += 0.01){ const p = edgeAt(Math.PI / 2, t); if(inside(hidden, p)) return p; }
        return null;
      })();
      assert.ok(outerMeet, `${tag}: the braid's outer edge reaches the body's side edge`);
      assert.ok(outerMeet[1] - ap[1] >= 0.9 * w && outerMeet[1] - ap[1] <= 2.4 * w, `${tag}: it does so ${((outerMeet[1] - ap[1]) / w).toFixed(2)} widths below the armpit (about 1.4 where the body's edge runs straight down; later where the gap widens)`);
      // below the armpit every point of the centre line that is not hidden lies in the window, where the cord is drawn over the gap
      for(const p of cp.points) if(p[1] > ap[1] && !inside(hidden, p)) assert.ok(inside(cl.clipPlus, p), `${tag}: ${p.map(v => v.toFixed(2))} is drawn and lies in the window`);
    }
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

test('the aide cord\'s run is wrapped like every cord, in its own braid\'s width; its hanging pendant is not a run and is not wrapped, and the run\'s strands hang from where the cord comes out', async () => {
  for(const sheet of SHEETS){
    const scene = await compose(sheet, 'aide_de_camp', null, { membership: 'senior', rank: 'Capt' }), run = runOf(scene), pend = pendantOf(scene);
    assert.ok(run && run.cordPath.arc && run.cordPath.width < core.CORD_WIDTH && Array.isArray(run.clipOut), `${sheet[0]}: the run is wrapped, in the aiguillette's own width`);
    assert.ok(pend && !pend.cordPath.arc && !('clipOut' in pend), `${sheet[0]}: the pendant hangs straight down from its attachment and is as it was`);
  }
  // a cord with a strand hangs it from the point the cord comes out from under the epaulet at, not from the far end of the carried-up path
  const cut = SHEETS[3], layer = runOf(await compose(cut, 'ga-cadet-of-the-year')), cp = layer.cordPath;
  const svg = read(`${cut[0]}-cord-${CORDS.carrierOf('ga-cadet-of-the-year')}`), t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/), [tx, ty, s] = [Number(t[1]), Number(t[2]), Number(t[3])];
  const b = RS.cordBraid(layer, tx, ty, s, 'e-'), nums = d => (String(d).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
  const ys = [...b.extras.matchAll(/\sd="([^"]+)"/g)].flatMap(m => { const v = nums(m[1].replace(/[A-Za-z]/g, ' ')); const o = []; for(let i = 1; i < v.length; i += 2) o.push((ty + s * v[i]) / 100); return o; });
  assert.ok(Math.min(...ys) >= cp.top[1] - 0.05, `the strands start at ${Math.min(...ys).toFixed(2)}, the cord comes out at ${cp.top[1].toFixed(2)}`);
});

test('the renderer lays the braid along the whole path, the end cap on the path\'s last point, and takes the sheet\'s own cut to its silhouette off a cord (the engine cuts it, the gap below the armpit a window)', async () => {
  for(const sheet of SHEETS) for(const id of ['wing', 'honor_guard', 'ner-rcls']){
    const cid = `${sheet[0]}-cord-${CORDS.carrierOf(id)}`, svg = read(cid);
    const t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/), [tx, ty, s] = [Number(t[1]), Number(t[2]), Number(t[3])];
    const cl = runOf(await compose(sheet, id)), cp = cl.cordPath, tag = `${sheet[0]} ${id}`;
    const b = RS.cordBraid(cl, tx, ty, s, 'e-');
    assert.ok(b && b.run.length > 500, `${tag}: a braid`);
    const nums = d => (String(d).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    const pts = [...b.run.matchAll(/\sd="([^"]+)"/g)].flatMap(m => { const v = nums(m[1].replace(/[A-Za-z]/g, ' ')); const o = []; for(let i = 0; i + 1 < v.length; i += 2) o.push([(tx + s * v[i]) / 100, (ty + s * v[i + 1]) / 100]); return o; });
    const h = cp.arc.heading, lowest = Math.max(...pts.filter(q => Math.hypot(q[0] - cp.end[0], q[1] - cp.end[1]) < 0.9).map(q => dot([q[0] - cp.end[0], q[1] - cp.end[1]], h)));
    // (the cap's path is drawn inside its outline's half stroke, the cap's corner radius)
    assert.ok(lowest <= 0.01 && lowest >= -0.03, `${tag}: the braid's last edge is ${lowest.toFixed(3)} in from the end of the path`);
    const highest = Math.min(...pts.map(q => q[1]));
    assert.ok(highest <= cp.start[1] + 0.1, `${tag}: the braid runs up to the path's start (${highest.toFixed(2)} against ${cp.start[1].toFixed(2)})`);
  }
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'render-svg.js'), 'utf8');
  assert.match(src, /silhouetteClip\(layer\.clipSil, !!layer\.clipOuter, layer\.clipPlus\)/, 'the renderer draws the cord through the outline and the window');
  assert.match(src, /cp\.appendChild\(el\('polygon', \{ points: extra \}\)\)/, 'the window is a polygon of the same clip path as the outline');
  assert.ok(src.includes('removeAttribute(\'clip-path\')') && /cordClip/.test(src), 'the sheet\'s own cut is taken off');
});
