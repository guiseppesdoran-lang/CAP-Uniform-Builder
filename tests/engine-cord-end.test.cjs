'use strict';
// LIVE13 (Ethan, 2026-11-12, on a sliver of cloth showing under the square lower end of a shoulder cord's braid): "the cord, goes all the way around the inner part of the sleve,
// under the wearers armpid. literally all you need to do is extend the cord a little bit so you dont see any blue under it. fix this FAST for all of the cords."
// The braid stopped at the armpit (the seam's end, moved down CORD_DROP with the whole cord) and ended in a flat cap; where the gap between arm and body is narrow its top is hidden by
// the gap's outline and the visible gap starts below the cap, so cloth showed between the two. Every shoulder cord's run is now continued straight on past the armpit, in the direction it
// has there, by core.CORD_END_EXTEND (half the braid's width), and the braid is drawn to that end, whole links, the cap, opaque; the last stretch is drawn over the gap between arm and
// body as well (layer.clipPlus), and everywhere else the braid is cut by the garment's outline as it was.
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
const compose = (sheet, cord, extra) => P.composeUniform(Object.assign(HARNESS.makeBuild({ uniform: sheet[1], gender: sheet[2], membership: 'cadet', rank: 'C/Maj', cord, name: { first: 'Pat', last: 'Doe', show: true }, opt: Object.assign({ headgear: 'none' }, sheet[3]) }), { cordColour: colourFor(cord) }, extra || {}), store);
const runOf = scene => scene.layers.find(l => l.cordLook && !l.cordLook.pendant && !l.cordLook.tip);
const pendantOf = scene => scene.layers.find(l => l.cordLook && l.cordLook.pendant);

const HALF = core.CORD_WIDTH / 2;
const MIN_PAST = 0.1;          // the armpit lies at least this far inside the braid's length, from its end edge
// The women's Class A coat draws its armhole seam 0.31 in off the apex of the gap (the seam ends in the sleeve's cloth, scripts/measure-armpit.cjs SEAM_END), so the apex lies just beside
// the braid's left edge, 0.05 in outside its width, on that sheet: an art matter (the seam line should end on the gap), pinned so it cannot grow.
const KNOWN_ARMPIT_OFFSET = { 'garment-blues-class-a-coat-female': 0.31 };

const dirOf = pc => { const u = [pc.b[0] - pc.a[0], pc.b[1] - pc.a[1]], l = Math.hypot(u[0], u[1]); return [u[0] / l, u[1] / l]; };

test('core.fitCord runs the run on straight past its last point by CORD_END_EXTEND, in the direction the run has there, and leaves the run and its corners as they were', () => {
  assert.equal(core.CORD_END_EXTEND, 0.25);
  assert.equal(core.CORD_END_EXTEND, core.CORD_WIDTH / 2, 'half the braid\'s width');
  // a straight run
  const straight = core.fitCord([[0, 0], [0, 2]], null, null, { exact: true });
  assert.deepEqual(straight.runEnd, [0, 2]);
  assert.deepEqual(straight.end, [0, 2.25]);
  assert.equal(straight.d, 'M0,0L0,2.25');
  assert.equal(straight.reach, 0.25);
  // a bent run: the extension takes the last segment's direction, the corner is rounded as before, `points` and `stretch` are the run itself
  const run = [[0, 0], [0, 1], [0.5, 2]];
  const bent = core.fitCord(run, null, null, { exact: true });
  const u = [0.5 / Math.hypot(0.5, 1), 1 / Math.hypot(0.5, 1)];
  assert.ok(Math.hypot(bent.end[0] - (0.5 + 0.25 * u[0]), bent.end[1] - (2 + 0.25 * u[1])) < 1e-9, 'continued along the last segment');
  assert.deepEqual(bent.runEnd, [0.5, 2]);
  assert.deepEqual(bent.bottom, [0.5, 2]);
  assert.deepEqual(bent.points, run);
  assert.ok(Math.abs(bent.stretch.to - (1 + Math.hypot(0.5, 1))) < 1e-9, 'the run\'s own length');
  const pc = bent.pieces;
  assert.deepEqual(pc.map(p => p.type), ['L', 'Q', 'L']);
  assert.ok(Math.hypot(pc[0].b[0] - 0, pc[0].b[1] - (1 - 0.25)) < 1e-9 && Math.hypot(pc[1].b[0] - (0 + 0.25 * u[0]), pc[1].b[1] - (1 + 0.25 * u[1])) < 1e-9, 'the corner is rounded 0.25 in each way, as it always was');
  assert.ok(Math.hypot(pc[2].a[0] - pc[1].b[0], pc[2].a[1] - pc[1].b[1]) < 1e-9);
  assert.ok(Math.hypot(pc[2].b[0] - bent.end[0], pc[2].b[1] - bent.end[1]) < 1e-9);
});

test('every sheet and every cord (the seven of the regulation and the supplements\'): the run ends at the armpit and the braid runs on 0.25 in past it, straight; the armpit lies inside the braid, at least 0.1 in from its end edge', async () => {
  const armpits = MEASURE_ARMPIT.compute();
  let checked = 0;
  for(const sheet of SHEETS) for(const id of ALL){
    const tag = `${sheet[0]} ${id}`, scene = await compose(sheet, id), cl = runOf(scene);
    assert.ok(cl && cl.cordPath, `${tag}: drawn`);
    const cp = cl.cordPath, last = cp.pieces[cp.pieces.length - 1];
    assert.equal(cp.reach, core.CORD_END_EXTEND, `${tag}: the stretch`);
    assert.equal(last.type, 'L', `${tag}: the last piece is straight`);
    const d = dirOf(last), run = [cp.runEnd[0] - last.a[0], cp.runEnd[1] - last.a[1]], rl = Math.hypot(run[0], run[1]);
    assert.ok(rl > 0.01, `${tag}: the run's last piece is ${rl.toFixed(3)} in`);
    assert.ok(Math.abs(run[0] * d[1] - run[1] * d[0]) < 1e-6 && run[0] * d[0] + run[1] * d[1] > 0, `${tag}: the stretch goes on in the run's own direction`);
    assert.ok(Math.abs(Math.hypot(cp.end[0] - cp.runEnd[0], cp.end[1] - cp.runEnd[1]) - 0.25) < 1e-9, `${tag}: the braid's end is 0.25 in past the run's end`);
    assert.ok(Math.hypot(cp.end[0] - last.b[0], cp.end[1] - last.b[1]) < 1e-9 && Math.hypot(cp.bottom[0] - cp.runEnd[0], cp.bottom[1] - cp.runEnd[1]) < 1e-9, `${tag}: the path ends at the braid's end, the run at its bottom`);
    // the sheet's own armpit point (the top of the gap between arm and body, or the inner end of a short sleeve's hem) against the end edge, along the run and across it
    const ap = armpits[sheet[0]], rel = [cp.end[0] - ap[0], cp.end[1] - ap[1]];
    const past = rel[0] * d[0] + rel[1] * d[1], across = Math.abs(rel[0] * -d[1] + rel[1] * d[0]);
    assert.ok(past >= MIN_PAST, `${tag}: the armpit is ${past.toFixed(3)} in inside the braid's end edge (at least ${MIN_PAST})`);
    assert.ok(past >= 0.25 - 0.01, `${tag}: and the braid ends ${past.toFixed(3)} in past it, at least the stretch (the cord is drawn CORD_DROP lower than the armpit as well)`);
    const known = KNOWN_ARMPIT_OFFSET[sheet[0]];
    if(known) assert.ok(across > HALF && across <= known, `${tag}: the armpit lies ${across.toFixed(3)} in off the braid's centre line (a known art offset, at most ${known})`);
    else assert.ok(across <= HALF, `${tag}: the armpit lies ${across.toFixed(3)} in off the braid's centre line, half its width is ${HALF}`);
    checked++;
  }
  assert.equal(checked, SHEETS.length * (7 + CORDS.supplementIds().length));
});

test('the window the braid\'s last stretch is drawn through: from just above the armpit\'s level to the braid\'s end, the braid\'s width and a margin across, on every sheet; the braid is cut by the outline everywhere else; the renderer opens the outline\'s clip with it', async () => {
  const armpits = MEASURE_ARMPIT.compute();
  for(const sheet of SHEETS) for(const extra of [{}, { cordOnTop: true }]){
    const cl = runOf(await compose(sheet, 'honor_guard', extra)), cp = cl.cordPath, tag = `${sheet[0]} ${JSON.stringify(extra)}`;
    assert.equal(cl.clipSil, sheet[0], `${tag}: cut to the sheet's silhouette`);
    assert.equal(cl.clipOuter, true, `${tag}: to its outer outline`);
    assert.ok(Array.isArray(cl.clipPlus) && cl.clipPlus.length === 4, `${tag}: the window`);
    const w = cl.clipPlus, d = dirOf({ a: cp.runEnd, b: cp.end });
    const along = q => (q.x - cp.runEnd[0]) * d[0] + (q.y - cp.runEnd[1]) * d[1], across = q => (q.x - cp.runEnd[0]) * -d[1] + (q.y - cp.runEnd[1]) * d[0];
    const ap = armpits[sheet[0]], apAlong = (ap[0] - cp.runEnd[0]) * d[0] + (ap[1] - cp.runEnd[1]) * d[1];
    // it starts on the cloth just above the armpit's level, so its square top edge leaves no sliver against a level hem line (CORD_CLIP_LEAD)
    assert.ok(Math.min(...w.map(along)) <= apAlong - 0.05, `${tag}: it starts above the armpit's level (${Math.min(...w.map(along)).toFixed(3)} against ${apAlong.toFixed(3)})`);
    assert.ok(Math.min(...w.map(along)) >= apAlong - 0.1 - 1e-6, `${tag}: and not more than 0.1 in higher up the run`);
    assert.ok(Math.max(...w.map(along)) >= 0.25 + 0.02, `${tag}: it holds the braid's whole end, to ${Math.max(...w.map(along)).toFixed(3)} past the run's end`);
    assert.ok(Math.max(...w.map(along)) <= 0.25 + 0.05, `${tag}: and no more than a margin more`);
    assert.ok(Math.abs(Math.max(...w.map(across)) - (cp.width / 2 + 0.03)) < 1e-9 && Math.abs(Math.min(...w.map(across)) + (cp.width / 2 + 0.03)) < 1e-9, `${tag}: the braid's width and a margin across`);
  }
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'render-svg.js'), 'utf8');
  assert.match(src, /silhouetteClip\(layer\.clipSil, !!layer\.clipOuter, layer\.clipPlus\)/, 'the renderer draws the cord through the outline and the window');
  assert.match(src, /cp\.appendChild\(el\('polygon', \{ points: extra \}\)\)/, 'the window is a polygon of the same clip path as the outline');
  assert.ok(src.includes("byId('cordClip')") && src.includes('__cordWindow${suffix}') && src.includes("'clip-path': `url(#${wid})`"), 'and the braid is drawn again, cut to the window alone, beside the sheet\'s own cut to its silhouette (which has the gap as a hole)');
});

test('the renderer draws the braid to its new end: whole links and the flat cap end at the end of the path, 0.25 in past the armpit end of the run', async () => {
  for(const sheet of SHEETS) for(const id of ['wing', 'honor_guard', 'ner-rcls']){
    const cid = `${sheet[0]}-cord-${CORDS.carrierOf(id)}`, svg = read(cid);
    const t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/), [tx, ty, s] = [Number(t[1]), Number(t[2]), Number(t[3])];
    const cl = runOf(await compose(sheet, id)), cp = cl.cordPath, tag = `${sheet[0]} ${id}`;
    const b = RS.cordBraid(cl, tx, ty, s, 'e-');
    assert.ok(b && b.run.length > 500, `${tag}: a braid`);
    const nums = d => (String(d).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    const pts = [...b.run.matchAll(/\sd="([^"]+)"/g)].flatMap(m => { const v = nums(m[1].replace(/[A-Za-z]/g, ' ')); const o = []; for(let i = 0; i + 1 < v.length; i += 2) o.push([(tx + s * v[i]) / 100, (ty + s * v[i + 1]) / 100]); return o; });
    const d = dirOf({ a: cp.runEnd, b: cp.end });
    const lowest = Math.max(...pts.map(q => (q[0] - cp.end[0]) * d[0] + (q[1] - cp.end[1]) * d[1]));
    // (the cap's path is drawn inside its outline's half stroke, the cap's corner radius, 0.019 in)
    assert.ok(lowest <= 0.01 && lowest >= -0.025, `${tag}: the braid's lowest edge is ${lowest.toFixed(3)} in from the end of the path`);
    const lowestRun = Math.max(...pts.map(q => (q[0] - cp.runEnd[0]) * d[0] + (q[1] - cp.runEnd[1]) * d[1]));
    assert.ok(lowestRun > 0.25 - 0.025, `${tag}: the braid runs ${lowestRun.toFixed(3)} in past where the run ends`);
  }
});

test('the Aide de Camp cord\'s run is extended like every shoulder cord; its hanging pendant and the strands are not runs and are not', async () => {
  for(const sheet of SHEETS){
    const scene = await compose(sheet, 'aide_de_camp'), run = runOf(scene), pend = pendantOf(scene);
    assert.ok(run && run.cordPath.reach === 0.25 && Array.isArray(run.clipPlus), `${sheet[0]}: the run is extended`);
    const across = run.clipPlus.map(q => (q.x - run.cordPath.runEnd[0]) * -(run.cordPath.end[1] - run.cordPath.runEnd[1]) + (q.y - run.cordPath.runEnd[1]) * (run.cordPath.end[0] - run.cordPath.runEnd[0])).map(v => v / 0.25);
    assert.ok(Math.abs(Math.max(...across) - (run.cordPath.width / 2 + 0.03)) < 1e-9 && run.cordPath.width < core.CORD_WIDTH, `${sheet[0]}: the window is as wide as the aide's own braid`);
    assert.ok(pend && !('reach' in pend.cordPath) && !('clipPlus' in pend), `${sheet[0]}: the pendant hangs straight down from its attachment and is as it was`);
  }
});
