'use strict';
// LIVE-CORDS (Ethan, post-sync: "the cords don't line up"): the shoulder cord is a sheet overlay registered to its garment, drawn
// along the wearer's left armhole seam and under the epaulet (CAPR 39-1 9.3). The engine places it at the garment's origin from the
// sheet's own box and keeps no literal point for it, so what has to hold is the art and the registration:
//   - every segment of the cord's path starts where the one before it ends (one continuous subpath), and the body, the outline and the
//     dashed twist are three strokes of the very same path, so the three layers cannot slip against each other;
//   - the path is the landmark 'cord' and its two ends are the anchors cord_start / cord_end, to 0.02 in;
//   - the overlay has the garment's own box, and the engine puts it on the garment at 0,0 at that size, so a rescale of the garment
//     without its cords (or the other way round) fails here;
//   - the cord's start meets the epaulet strap: the strip the engine draws on the coat (blues_a), the sheet's epaulet landmark on the
//     Class B shirts and blouses, within CORD_MEETS_STRAP in, 0.02 (the cord is 0.4 in wide and starts at the shoulder tip, past the
//     strap's outer end, so the cap of the cord touches the strap's outer corner).

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
const { silhouette } = require('../scripts/lib-svg-ink.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const read = id => fs.readFileSync(path.join(root, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');
const spec = id => JSON.parse(fs.readFileSync(path.join(root, 'images', manifest.assets.find(a => a.id === id).path.replace(/\.svg$/, '.spec.json')), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const NAME = { first: 'Pat', last: 'Doe', show: true };
const hb = (uniform, gender, membership, rank, opt, cord) => Object.assign(HARNESS.makeBuild({ uniform, gender, membership, rank, name: NAME, opt: Object.assign({ rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' }, opt || {}) }), { cord });

const CORD_MEETS_STRAP = 0.02;
// The sheets whose cord starts past the strap by more than that. The bound is the measured gap (a little over), so it cannot grow unseen. Since the art
// round that redrew the Class B straps (84f10ebe) and regenerated their cords to the finished seam (d735a305) the cap meets the strap to 0.000 (men's short),
// 0.005 (men's long) and 0.014 in (women's short): the three entries the old straps needed (0.10, 0.13, 0.04) are gone. The women's long blouse's cord is
// regenerated to the new seam and its cap corner lies 0.028 in off the strap's outer top corner (the strap the sheet draws, its plain overlay and its
// epaulet_left landmark are the same polygon, so the gap is the art's: LIVE8-5, art follow-up in .scratch/FOLLOWUPS.md: move the cord's start 0.03 in toward the strap).
const KNOWN_STRAP_GAP = { 'garment-blues-class-b-blouse-female-long': 0.03 };
const TOL = 0.02;
const KINDS = ['group', 'wing', 'region', 'national', 'color-guard', 'honor-guard', 'aide-de-camp'];
// [garment id, uniform, gender, opt]
const GARMENTS = [
  ['garment-blues-class-b-shirt-male', 'blues_b', 'male', { sleeve: 'short' }], ['garment-blues-class-b-shirt-male-long', 'blues_b', 'male', { sleeve: 'long' }],
  ['garment-blues-class-b-blouse-female', 'blues_b', 'female', { sleeve: 'short' }], ['garment-blues-class-b-blouse-female-long', 'blues_b', 'female', { sleeve: 'long' }],
  ['garment-blues-class-a-coat', 'blues_a', 'male', {}], ['garment-blues-class-a-coat-female', 'blues_a', 'female', {}]
];

// The cord path in sheet inches: art units through the art group's translate and scale (both in 0.01 in), per stroke.
function cordStrokes(id){
  const svg = read(id);
  const t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/);
  assert.ok(t, id + ': the art group states its translate and scale');
  const [tx, ty, s] = [Number(t[1]), Number(t[2]), Number(t[3])];
  // The cord group only: the aide-de-camp overlays also carry aiguillette groups after it.
  let g = svg.slice(svg.indexOf('__cord"'));
  const next = g.indexOf('<g ', 1); if(next > 0) g = g.slice(0, next);
  const ds = [...g.matchAll(/<path[^>]* d="([^"]+)"/g)].map(m => m[1]);
  return ds.map(d => ({ d, cmds: d.match(/[ML][-\d.]+,[-\d.]+/g), pts: (d.match(/[ML][-\d.]+,[-\d.]+/g) || []).map(c => c.slice(1).split(',').map(Number)).map(([x, y]) => [(tx + s * x) / 100, (ty + s * y) / 100]) }));
}

const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const insidePoly = (p, r) => { let c = false; for(let i = 0, j = r.length - 1; i < r.length; j = i++){ const a = r[i], b = r[j]; if((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const polyDist = (p, r) => insidePoly(p, r) ? 0 : Math.min(...r.map((a, i) => segDist(p, a, r[(i + 1) % r.length])));
const area = p => { let a = 0; for(let i = 0; i < p.length; i++){ const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; };
const silhouetteOf = id => silhouette(read(id)).sort((a, b) => area(b) - area(a))[0];
// The two corners of the cord's butt cap where it starts to show: the sheet clips the cord to the garment (the first vertex of a Class B
// cord lies on the shoulder tip, outside the shirt), so the visible start is where the path first enters the silhouette, moved half the
// stroke width each way across the first segment.
function startCap(pts, width, sil){
  let [a, b] = pts;
  if(!insidePoly(a, sil)){ let lo = 0, hi = 1; for(let i = 0; i < 40; i++){ const m = (lo + hi) / 2; insidePoly([a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m], sil) ? hi = m : lo = m; } a = [a[0] + (b[0] - a[0]) * hi, a[1] + (b[1] - a[1]) * hi]; }
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const nx = -dy / len * width / 2, ny = dx / len * width / 2;
  return [[a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny], a];
}

test('every cord overlay is one continuous path drawn three times, and it is the sheet\'s cord landmark and anchors (0.02 in)', () => {
  let checked = 0;
  for(const [gid] of GARMENTS) for(const k of KINDS){
    const id = `${gid}-cord-${k}`;
    const strokes = cordStrokes(id), sp = spec(id);
    assert.equal(strokes.length, 3, `${id}: outline, body and dashed twist`);
    for(const s of strokes){
      assert.equal(s.d, strokes[0].d, `${id}: the three strokes share one path`);
      assert.ok(/^M/.test(s.d) && !/M.*M/.test(s.d), `${id}: one subpath, so each segment starts where the one before it ends`);
      assert.ok(s.pts.length >= 4, `${id}: ${s.pts.length} points`);
    }
    const pts = strokes[0].pts, lm = sp.landmarks.cord.map(([x, y]) => [x / 100, y / 100]);
    assert.equal(lm.length, pts.length, `${id}: landmark and path have the same vertices`);
    pts.forEach((p, i) => assert.ok(Math.hypot(p[0] - lm[i][0], p[1] - lm[i][1]) <= TOL, `${id}: vertex ${i} is ${Math.hypot(p[0] - lm[i][0], p[1] - lm[i][1]).toFixed(3)} in from the landmark`));
    const cs = sp.anchors.cord_start.map(v => v / 100), ce = sp.anchors.cord_end.map(v => v / 100);
    assert.ok(Math.hypot(cs[0] - pts[0][0], cs[1] - pts[0][1]) <= TOL, `${id}: cord_start is the path's first point`);
    assert.ok(Math.hypot(ce[0] - pts[pts.length - 1][0], ce[1] - pts[pts.length - 1][1]) <= TOL, `${id}: cord_end is the path's last point`);
    checked++;
  }
  assert.equal(checked, GARMENTS.length * KINDS.length);
});

test('every cord overlay has its garment\'s box, and the engine lays it on the garment at the origin at that size', async () => {
  for(const [gid, uniform, gender, opt] of GARMENTS){
    const gs = spec(gid);
    for(const k of KINDS){
      const cs = spec(`${gid}-cord-${k}`);
      assert.ok(Math.abs(cs.size_in.w - gs.size_in.w) <= 0.01 && Math.abs(cs.size_in.h - gs.size_in.h) <= 0.01, `${gid}-cord-${k}: box ${JSON.stringify(cs.size_in)} against the garment's ${JSON.stringify(gs.size_in)}`);
    }
    const scene = await P.composeUniform(hb(uniform, gender, 'cadet', 'C/Maj', opt, 'wing'), store);
    const g = scene.layers.find(l => l.role === 'garment'), c = scene.layers.find(l => l.id === `${gid}-cord-wing`);
    assert.ok(c, `${gid}: the wing cord is drawn`);
    assert.ok(Math.abs(c.x - g.x) < 1e-6 && Math.abs(c.y - g.y) < 1e-6 && Math.abs(c.w - g.w) < 1e-6 && Math.abs(c.h - g.h) < 1e-6, `${gid}: cord layer ${JSON.stringify([c.x, c.y, c.w, c.h])} against the garment ${JSON.stringify([g.x, g.y, g.w, g.h])}`);
    assert.ok(c.z < scene.layers.filter(l => /^epaulet/.test(l.role) && l.role !== 'epaulet-top').reduce((m, l) => Math.min(m, l.z), Infinity) || !scene.layers.some(l => l.role === 'epaulet'), `${gid}: the cord is under the epaulet (9.3)`);
  }
});

test('the cord\'s start meets the epaulet strap: the engine\'s strip on the Class A coat, the sheet\'s strap on the Class B shirts and blouses', async () => {
  for(const [gid, uniform, gender, opt] of GARMENTS){
    const cid = `${gid}-cord-wing`;
    const pts = cordStrokes(cid)[0].pts;
    const cap = startCap(pts, 0.4, silhouetteOf(gid));
    let strap;
    if(uniform === 'blues_a'){
      const scene = await P.composeUniform(hb(uniform, gender, 'cadet', 'C/Maj', opt, 'wing'), store);
      const l = scene.layers.find(x => x.key === 'epaulet:left');
      assert.ok(l, `${gid}: the strip on the wearer's left shoulder`);
      const o = l.origin || { x: l.x, y: l.y };
      strap = [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => { const q = core.rotatePoint({ x, y }, o, l.rotate || 0); return [q.x, q.y]; });
    } else {
      // The strap as the sheet draws it (its own epaulet-left-strap path, the one the member sees under the cord; the plain epaulet overlay's left body and the
      // epaulet_left landmark are the same polygon, which the next assertion pins).
      const svg = read(gid);
      const t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/);
      const body = svg.match(new RegExp(`id="${gid}__epaulet-left-strap" d="([^"]+)"`));
      assert.ok(t && body, `${gid}: art transform and the drawn left strap`);
      strap = body[1].match(/[ML][-\d.]+,[-\d.]+/g).map(c => c.slice(1).split(',').map(Number)).map(([x, y]) => [(Number(t[1]) + Number(t[3]) * x) / 100, (Number(t[2]) + Number(t[3]) * y) / 100]);
    }
    if(uniform !== 'blues_a'){
      const lm = spec(gid).landmarks.epaulet_left.map(([x, y]) => [x / 100, y / 100]);
      assert.ok(strap.every(p => polyDist(p, lm) <= 0.03) && lm.every(p => polyDist(p, strap) <= 0.03), `${gid}: the drawn strap is the epaulet_left landmark`);
    }
    const gap = Math.min(...cap.map(p => polyDist(p, strap)));
    assert.ok(gap <= (KNOWN_STRAP_GAP[gid] || CORD_MEETS_STRAP), `${gid}: the cord's start cap is ${gap.toFixed(3)} in from the strap`);
  }
});

test('LIVE9-1: a cadet officer\'s slide-on sleeve covers the Class B strap from its outer end, so the cord\'s start still comes out from under the sleeve: the cap meets the sleeve polygon, which is drawn over the cord (9.3, 9.4.1)', async () => {
  for(const [gid, uniform, gender, opt] of GARMENTS.filter(x => x[1] === 'blues_b')){
    const scene = await P.composeUniform(hb(uniform, gender, 'cadet', 'C/Maj', opt, 'wing'), store);
    const sl = scene.layers.find(x => x.key === 'epaulet:left'), cordLayer = scene.layers.find(l => l.id === `${gid}-cord-wing`);
    assert.ok(sl && sl.type === 'polygon' && cordLayer, `${gid}: the sleeve polygon on the wearer's left shoulder and the cord`);
    assert.ok(sl.z > cordLayer.z, `${gid}: the sleeve is drawn over the cord`);
    const cap = startCap(cordStrokes(`${gid}-cord-wing`)[0].pts, 0.4, silhouetteOf(gid));
    const poly = sl.points.map(q => [q.x, q.y]);
    const gap = Math.min(...cap.map(p => polyDist(p, poly)));
    assert.ok(gap <= (KNOWN_STRAP_GAP[gid] || CORD_MEETS_STRAP), `${gid}: the cord's start cap is ${gap.toFixed(3)} in from the sleeve`);
  }
});

// Ethan, live: 'cord is still off a bit' on the Class A coat with a shoulder board. The cord must come out from under the board at its
// outer (arm) end: its top end lies under the strip (inside it, to 0.02 in), within the strip's outer end (none of it past that end), its
// path leaves the strip across the strip's lower edge, and it is drawn under the strip (9.3, 9.4.1: the cord is worn under the epaulet).
test('Class A: every cord kind starts under the shoulder board\'s strip at its arm end and leaves from its lower edge, under it in z (9.3, 9.4.1)', async () => {
  // The coat sheets' strap axis on the wearer's left (neck end, arm end): what the sheets state, not a copy of the engine's.
  const SHEET = require('./helpers/class-a-sheet.cjs');
  const AXIS = { male: SHEET.strap('male').axis, female: SHEET.strap('female').axis };
  let checked = 0;
  for(const [gid, uniform, gender, opt] of GARMENTS.filter(g => g[1] === 'blues_a')) for(const k of KINDS){
    const cord = k.replace(/-/g, '_');
    for(const rank of ['C/Maj', 'C/Col']){
      const scene = await P.composeUniform(hb(uniform, gender, 'cadet', rank, opt, cord), store);
      const strip = scene.layers.find(x => x.key === 'epaulet:left'), cl = scene.layers.find(x => x.id === `${gid}-cord-${k}`);
      const tag = `${gid} ${k} ${rank}`;
      assert.ok(strip && cl, `${tag}: strip and cord are drawn`);
      assert.ok(cl.z < strip.z, `${tag}: the cord (z ${cl.z}) is under the strip (z ${strip.z})`);
      const o = strip.origin, R = strip.rotate || 0;
      const poly = [[strip.x, strip.y], [strip.x + strip.w, strip.y], [strip.x + strip.w, strip.y + strip.h], [strip.x, strip.y + strip.h]].map(([x, y]) => { const q = core.rotatePoint({ x, y }, o, R); return [q.x, q.y]; });
      const pts = cordStrokes(`${gid}-cord-${k}`)[0].pts;
      const [p0, p1] = pts, dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy), nx = -dy / len * 0.18, ny = dx / len * 0.18;
      for(const c of [[p0[0] + nx, p0[1] + ny], [p0[0] - nx, p0[1] - ny], p0]) assert.ok(polyDist(c, poly) <= CORD_MEETS_STRAP, `${tag}: the cord's top end is ${polyDist(c, poly).toFixed(3)} in outside the strip`);
      // None of the cord's top end lies past the strip's outer end: measured along the strap axis from that end, toward the neck.
      const [nk, am] = AXIS[gender], al = Math.hypot(nk[0] - am[0], nk[1] - am[1]), u = [(nk[0] - am[0]) / al, (nk[1] - am[1]) / al];
      for(const c of [[p0[0] + nx, p0[1] + ny], [p0[0] - nx, p0[1] - ny]]){
        const along = (c[0] - am[0]) * u[0] + (c[1] - am[1]) * u[1];
        assert.ok(along >= -CORD_MEETS_STRAP, `${tag}: the cord's top end is ${(-along).toFixed(3)} in past the strip's outer end`);
      }
      // The path leaves the strip: its second vertex is outside it (below the lower edge), so the cord comes out from under the strip.
      assert.ok(polyDist(p1, poly) > 0.5, `${tag}: the cord leaves the strip`);
      checked++;
    }
  }
  assert.equal(checked, 2 * KINDS.length * 2);
});

test('the cadet semi-formal wears no shoulder cord (9.3, 9.4.1 name the Service Dress and the Blue Service only), so none is drawn under its boards', async () => {
  for(const k of ['group', 'national', 'aide_de_camp']){
    const scene = await P.composeUniform(hb('semi_formal_usaf', 'male', 'cadet', 'C/Capt', {}, k), store);
    assert.ok(!scene.layers.some(l => /-cord-|^cord-/.test(l.id || '')), `${k}: no cord on the semi-formal`);
  }
});

// ---- LIVE6-1: the cord is one smooth run from the top of the shoulder to the armpit, on every garment that offers one ----
// Ethan, live: "shoulder cords dont line up", then "cords are still fucked up. they arent going to the top of the shoulder nor the bottom
// of the thing". The sheets draw the run as a polyline along the armhole seam that bends 9 to 18 degrees at its vertices and stops short
// of the armpit (0.4 to 0.7 in on the Class A coat and the long shirt) and of the shoulder's outline. The engine fits the run to the sheet
// (core.fitCord): top end on the shoulder outline, bottom end on the armpit, only the straight run stretched, corners rounded. CAPR 39-1
// 9.3 ("worn on the left shoulder ... under the epaulet"). What the sheet states is read from the sheet here, not from the engine.
const MEASURE_ARMPIT = require('../scripts/measure-armpit.cjs');
const FIT_GARMENTS = [
  ['garment-blues-class-a-coat', 'blues_a', 'male', {}], ['garment-blues-class-a-coat-female', 'blues_a', 'female', {}],
  ['garment-blues-class-b-shirt-male', 'blues_b', 'male', { sleeve: 'short' }], ['garment-blues-class-b-shirt-male-long', 'blues_b', 'male', { sleeve: 'long' }],
  ['garment-blues-class-b-blouse-female', 'blues_b', 'female', { sleeve: 'short' }], ['garment-blues-class-b-blouse-female-long', 'blues_b', 'female', { sleeve: 'long' }]
];
const outerRing = id => silhouette(read(id)).sort((a, b) => area(b) - area(a))[0];
const ringDist = (p, ring) => Math.min(...ring.map((a, i) => segDist(p, a, ring[(i + 1) % ring.length])));
const ang = v => Math.atan2(v[0], v[1]) * 180 / Math.PI;
const angDiff = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// The notch of the garment's silhouette, measured here from the outline alone (not from the engine's table or scripts/measure-armpit.cjs):
// where the sleeve is apart from the body the silhouette has a hole between arm and torso on the sheet's right and the notch is the apex of
// that hole (its topmost vertex); where a short sleeve lies against the body there is no hole, and the notch is the inner end of the sleeve's
// hem, the left end of the longest near-horizontal edge on the right half of the outline.
function notchOf(id){
  const rings = silhouette(read(id)).sort((a, b) => area(b) - area(a)), outer = rings[0];
  const cx = (Math.min(...outer.map(p => p[0])) + Math.max(...outer.map(p => p[0]))) / 2;
  const hole = rings.slice(1).find(h => h.reduce((s, p) => s + p[0], 0) / h.length > cx);
  if(hole) return hole.reduce((a, b) => (b[1] < a[1] ? b : a));
  // The hem: the longest chain of consecutive near-horizontal edges (rising or falling less than 0.35 in per in) on the right half of the
  // outline above its lowest third, which is the garment's own hem; the chain's end nearest the body is the notch.
  const ys = outer.map(p => p[1]), lowY = Math.min(...ys) + 0.66 * (Math.max(...ys) - Math.min(...ys));
  let best = null, bl = 0, chain = [];
  const flush = () => { if(chain.length){ const x0 = Math.min(...chain.map(p => p[0])), x1 = Math.max(...chain.map(p => p[0])); if(x1 - x0 > bl){ bl = x1 - x0; best = chain.reduce((u, v) => (v[0] < u[0] ? v : u)); } } chain = []; };
  for(let k = 0; k < 2 * outer.length; k++){
    const a = outer[k % outer.length], c = outer[(k + 1) % outer.length], dx = Math.abs(c[0] - a[0]), dy = Math.abs(c[1] - a[1]);
    if(a[0] > cx && c[0] > cx && a[1] < lowY && dx > 0.01 && dy <= 0.35 * dx){ if(!chain.length || chain[chain.length - 1] !== a) chain.push(a); chain.push(c); }
    else flush();
  }
  flush();
  return best;
}
const inRing = (p, ring) => { let c = false; for(let i = 0, j = ring.length - 1; i < ring.length; j = i++){ const a = ring[i], b = ring[j]; if((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const inSil = (p, rings) => rings.reduce((n, r) => n + (inRing(p, r) ? 1 : 0), 0) % 2 === 1;

test('the engine\'s ARMPIT table is the armpit of the current cord sheets (regenerate with scripts/measure-armpit.cjs)', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  const body = /\/\/ ARMPIT begin\n([\s\S]*?)\/\/ ARMPIT end/.exec(src);
  assert.ok(body, 'the table is marked in the engine');
  assert.deepEqual(new Function(body[1] + '; return ARMPIT;')(), MEASURE_ARMPIT.compute());
});

test('every cord kind on every garment and both sexes: one smooth run from the top of the shoulder to the armpit (9.3)', async () => {
  const armpits = MEASURE_ARMPIT.compute();
  let checked = 0;
  for(const [gid, uniform, gender, opt] of FIT_GARMENTS) for(const k of KINDS){
    const scene = await P.composeUniform(hb(uniform, gender, 'cadet', 'C/Maj', opt, k.replace(/-/g, '_')), store);
    const cl = scene.layers.find(l => l.id === `${gid}-cord-${k}`);
    const tag = `${gid} ${k}`;
    assert.ok(cl && cl.cordPath, `${tag}: the cord is drawn with its fitted path`);
    const { pieces, top, bottom, stretch } = cl.cordPath;
    // Continuity: each piece starts where the one before ends, along the same tangent.
    assert.ok(pieces.length >= 3, `${tag}: ${pieces.length} pieces`);
    for(let i = 1; i < pieces.length; i++){
      const a = pieces[i - 1], b = pieces[i];
      assert.ok(Math.hypot(a.b[0] - b.a[0], a.b[1] - b.a[1]) <= 0.02, `${tag}: piece ${i} starts ${Math.hypot(a.b[0] - b.a[0], a.b[1] - b.a[1]).toFixed(3)} in from where piece ${i - 1} ends`);
      const ta = a.type === 'Q' ? [a.b[0] - a.c[0], a.b[1] - a.c[1]] : [a.b[0] - a.a[0], a.b[1] - a.a[1]];
      const tb = b.type === 'Q' ? [b.c[0] - b.a[0], b.c[1] - b.a[1]] : [b.b[0] - b.a[0], b.b[1] - b.a[1]];
      assert.ok(angDiff(ang(ta), ang(tb)) <= 5, `${tag}: the tangent turns ${angDiff(ang(ta), ang(tb)).toFixed(1)} degrees where piece ${i - 1} meets piece ${i}`);
    }
    // The pieces run from the top end to the end of the run under the arm (0.6 in past the armpit, straight on: LIVE9-2, was 0.3).
    const under = cl.cordPath.under;
    assert.ok(Math.hypot(pieces[0].a[0] - top[0], pieces[0].a[1] - top[1]) < 1e-6 && Math.hypot(pieces[pieces.length - 1].b[0] - under[0], pieces[pieces.length - 1].b[1] - under[1]) < 1e-6, `${tag}: the pieces run from top to the end under the arm`);
    assert.ok(Math.abs(Math.hypot(under[0] - bottom[0], under[1] - bottom[1]) - 0.6) < 1e-6, `${tag}: the run goes on 0.6 in past the armpit`);
    assert.ok(Math.min(...pieces.map(pc => segDist(bottom, pc.a, pc.b))) < 0.01, `${tag}: the run passes through the armpit`);
    // The top end is on the shoulder's outline as the sheet draws it; the bottom end is the armpit as the sheet draws it.
    const ring = outerRing(gid);
    assert.ok(ringDist(top, ring) <= 0.1, `${tag}: the run's top end is ${ringDist(top, ring).toFixed(3)} in from the shoulder outline`);
    const ap = armpits[gid], notch = notchOf(gid);
    assert.ok(Math.hypot(bottom[0] - ap[0], bottom[1] - ap[1]) <= 0.1, `${tag}: the run's bottom end is ${Math.hypot(bottom[0] - ap[0], bottom[1] - ap[1]).toFixed(3)} in from the armpit`);
    // The armpit is the notch of the silhouette, measured independently of the table: 0.05 in.
    assert.ok(Math.hypot(bottom[0] - notch[0], bottom[1] - notch[1]) <= 0.05, `${tag}: the run's armpit end is ${Math.hypot(bottom[0] - notch[0], bottom[1] - notch[1]).toFixed(3)} in from the silhouette's notch`);
    // The last 0.6 in is behind the sleeve (LIVE9-2, Ethan: "cords need to go slightly more down"; it was 0.3 in with a 0.15 in tongue): the braid's band past the
    // armpit is hidden by the silhouette (the gap or the hem is not cloth) and by the tongue, which keeps the braid's full width 0.35 in past the notch and then
    // narrows to a point over a further 0.25 in. What shows is at most that tongue (the old limit of a third of the band was the 0.15 in tongue's), and where
    // there is cloth under the arm the braid does go on past the notch: the share of the tongue's own area that shows is printed in the failure message.
    const vis = cl.cordPath.visible, tg = [(under[0] - bottom[0]) / 0.6, (under[1] - bottom[1]) / 0.6], nm = [-tg[1], tg[0]], sil = silhouette(read(gid));
    assert.ok(vis && vis.length >= 5, `${tag}: the run carries the polygon of what stays visible`);
    let shown = 0, total = 0, tongue = 0;
    for(let i = 0; i < 24; i++) for(let j = -8; j <= 8; j++){
      const sd = (i + 0.5) / 24 * 0.6, w = j / 8 * 0.3, q = [bottom[0] + tg[0] * sd + nm[0] * w, bottom[1] + tg[1] * sd + nm[1] * w];
      if(Math.abs(w) <= 0.2){ total++; if(inRing(q, vis) && inSil(q, sil)) shown++; if(Math.abs(w) <= 0.25 * Math.min(1, Math.max(0, (0.6 - sd) / 0.25))) tongue++; }
      // The tongue is the braid's full width (0.25 in each side of the run's line) for 0.35 in, then narrows to a point over 0.25 in: past that width nothing shows.
      const half = 0.25 * Math.min(1, Math.max(0, (0.6 - sd) / 0.25));
      if(Math.abs(w) > half + 1e-9) assert.ok(!inRing(q, vis), `${tag}: braid at ${sd.toFixed(2)} in under, ${w.toFixed(2)} in aside is not hidden`);
    }
    assert.ok(shown <= tongue, `${tag}: ${(100 * shown / total).toFixed(0)} percent of the braid under the arm shows, more than the tongue's ${(100 * tongue / total).toFixed(0)}`);
    assert.ok(tongue / total > 0.6 && tongue / total < 0.85, `${tag}: the tongue is ${(100 * tongue / total).toFixed(0)} percent of the band (0.35 in full width, 0.25 in taper of 0.6 in)`);
    assert.ok(shown / tongue > 0.25, `${tag}: only ${(100 * shown / tongue).toFixed(0)} percent of the tongue shows: the braid does not go on past the notch`);
    // Only the straight run is stretched: the length changes by no more than 15 percent (the sheets draw no loop or tip to keep).
    assert.ok(stretch.to / stretch.from > 0.85 && stretch.to / stretch.from < 1.15, `${tag}: length ${stretch.from.toFixed(2)} to ${stretch.to.toFixed(2)} in`);
    assert.equal(cl.clipSil, gid, `${tag}: cut to the sheet's silhouette`);
    if(uniform === 'blues_a'){
      // Under the shoulder board's strip at the shoulder seam: the strip covers the run's top end (it is drawn over the cord).
      const strip = scene.layers.find(x => x.key === 'epaulet:left'), o = strip.origin, R = strip.rotate || 0;
      const poly = [[strip.x, strip.y], [strip.x + strip.w, strip.y], [strip.x + strip.w, strip.y + strip.h], [strip.x, strip.y + strip.h]].map(([x, y]) => { const q = core.rotatePoint({ x, y }, o, R); return [q.x, q.y]; });
      assert.ok(polyDist(top, poly) <= 0.1, `${tag}: the run's top end is ${polyDist(top, poly).toFixed(3)} in from the strip`);
      assert.ok(cl.z < strip.z, `${tag}: under the strip`);
    }
    checked++;
  }
  assert.equal(checked, FIT_GARMENTS.length * KINDS.length);
});

test('the fitted path is the sheet\'s braid: the renderer maps it back to the sheet\'s drawing units, and a path of the sheet\'s own points comes out as the sheet\'s own path', () => {
  global.self = global.self || global;
  require('../js/engine/render-svg.js');
  const RS = global.self.CAPUBEngine.renderSvg;
  for(const [gid] of FIT_GARMENTS){
    const id = `${gid}-cord-wing`, svg = read(id);
    const t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/);
    const own = /<path id="[^"]*__cord-path" d="([^"]+)"/.exec(svg)[1];
    const inches = cordStrokes(id)[0].pts;
    const d = 'M' + inches.map(p => `${p[0]},${p[1]}`).join('L');
    const back = RS.cordPathToArt(d, Number(t[1]), Number(t[2]), Number(t[3])).match(/-?[\d.]+/g).map(Number), ref = own.match(/-?[\d.]+/g).map(Number);
    assert.equal(back.length, ref.length);
    back.forEach((v, i) => assert.ok(Math.abs(v - ref[i]) < 0.002, `${id}: coordinate ${i} ${v} against ${ref[i]}`));
  }
});
