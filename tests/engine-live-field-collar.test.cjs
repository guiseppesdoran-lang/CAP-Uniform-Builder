'use strict';
// ABU and Corporate Field Uniform collar grade (CAPR 39-1 5.1.1.1.1, 5.2.1.1.1), COLLAR6.
// Ethan, on the cadet Lt Col cloth drawn as a level rectangle pushed toward the leaf's outer side: "flip it 90 degrees, and center it, and apply that logic for everything else." Every collar grade
// piece is centred on its leaf (its centre the centroid of the collar_left / collar_right polygon, both axes) and stands in the frame of the leaf's lower seam (collar_slots[side].bottom_edge, level on
// both sheets): the cadet officers' cloth and the bars are turned a quarter turn from that frame so the cloth's long side stands vertical, the cadet NCO metal chevron stays upright, the Major's and
// Lieutenant Colonel's stem stays parallel to the ground away from the neck, the Colonel's beak forward, the generals' stars stacked perpendicular to the seam. D8: the COLLAR5 tests had the cadet pieces
// 1 in from the front edge and the officers 1 in above the seam, unturned; Ethan's ruling replaces those positions.
// COLLAR8 (Ethan, on the C/CMSgt chevrons standing small and upright on each leaf: "the long edge needs to be parallel to the collar, and the chief specifically needs to be bigger. for all enlisted
// things."): the cadet NCO metal chevron's long edge lies along the leaf's front (leading) edge, mirrored on the two leaves, and all enlisted collar chevrons are scaled by one common factor so the
// C/CMSgt one stands 2.5 in tall (less if it would not clear the leaf outline by 0.1 in). D8: the COLLAR6 tests had the chevrons upright.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const load = p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8')));
const store = core.createSpecStore(manifest, load);
// The same store with `edit(json)` applied to the ABU sheet's spec.
const edited = edit => core.createSpecStore(manifest, async p => {
  const j = await load(p);
  if(/garment-abu-coat\.spec\.json$/.test(p)) edit(j);
  return j;
});

const SHEETS = { abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' };
const CADET_OFFICERS = ['C/2d Lt', 'C/1st Lt', 'C/Capt', 'C/Maj', 'C/Lt Col', 'C/Col'];
const CADET_NCOS = ['C/Amn', 'C/SSgt', 'C/MSgt', 'C/CMSgt'];
const SENIOR_OFFICERS = ['2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col', 'Brig Gen', 'Maj Gen'];
const BARS = ['2d Lt', '1st Lt', 'Capt'];   // lie along the seam, stacked vertically (a quarter turn from the art, which is drawn with the bars standing)
const STEM_RANKS = ['Maj', 'Lt Col'];   // the stem lies parallel to the ground pointing away from the neck: a quarter turn from the seam's frame (5.1.1.1.1.1)
const GENERALS = ['Brig Gen', 'Maj Gen'];

function build(uniform, gender, membership, rank){
  return {
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'none' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  };
}
const layer = (scene, side) => scene.layers.find(l => l.key === 'grade:' + side);
const measures = scene => scene.layers.filter(l => l.type === 'measure');
const deg = r => r * 180 / Math.PI;

// The sheet's lower seam of a leaf as an edge {a, b} (inches) and its angle in (-90, 90].
function seamOf(spec, side){
  const be = spec.raw.collar_slots[side].bottom_edge, pair = be.points || [be.p1, be.p2];
  const a = { x: pair[0][0] / 100, y: pair[0][1] / 100 }, b = { x: pair[1][0] / 100, y: pair[1][1] / 100 };
  let d = deg(Math.atan2(b.y - a.y, b.x - a.x)); if(d > 90) d -= 180; if(d <= -90) d += 180;
  return { a, b, angle: Math.abs(d) < 1e-9 ? 0 : d };
}
const polyOf = (spec, side) => core.landmark(spec, side === 'right' ? 'collar_right' : 'collar_left').points;
// A layer's four corners (the box turned by its rotate about its centre) and its centre.
function cornersOf(l){
  const c = { x: l.x + l.w / 2, y: l.y + l.h / 2 }, a = l.rotate * Math.PI / 180;
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => ({ x: c.x + i * l.w / 2 * Math.cos(a) - j * l.h / 2 * Math.sin(a), y: c.y + i * l.w / 2 * Math.sin(a) + j * l.h / 2 * Math.cos(a) }));
}
const centroidOf = pts => { let a = 0, cx = 0, cy = 0; for(let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length], cr = p.x * q.y - q.x * p.y; a += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr; } return { x: cx / (3 * a), y: cy / (3 * a) }; };
const centreOf = l => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });
const inside = (q, poly) => { let r = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const pi = poly[i], pj = poly[j]; if((pi.y > q.y) !== (pj.y > q.y) && q.x < (pj.x - pi.x) * (q.y - pi.y) / (pj.y - pi.y) + pi.x) r = !r; } return r; };
// The turn of a layer relative to the seam, in (-180, 180].
const relTurn = (l, seam) => { let d = l.rotate - seam.angle; while(d > 180) d -= 360; while(d <= -180) d += 360; return d; };

for(const uniform of ['abu', 'corporate_field']){
  for(const gender of ['male', 'female']){
    test(`${uniform} ${gender}: the leaf's lower seam is horizontal on both leaves, stated by the sheet as bottom_edge and as a landmark (COLLAR5)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      for(const side of ['right', 'left']){
        const seam = seamOf(spec, side), be = spec.raw.collar_slots[side].bottom_edge;
        assert.equal(seam.a.y, seam.b.y, `${side}: the seam's two points share a height`);
        assert.ok(Math.abs(seam.b.x - seam.a.x) > 2, `${side}: the seam is ${Math.abs(seam.b.x - seam.a.x).toFixed(2)} in long`);
        assert.equal(be.angle_deg, 0, `${side}: bottom_edge.angle_deg`);
        // the landmark agrees, and the leaf polygon's two lowest vertices are the seam's ends
        const lm = core.landmark(spec, 'collar_bottom_edge_' + side).points;
        assert.ok(Math.hypot(lm[0].x - seam.a.x, lm[0].y - seam.a.y) < 0.02 && Math.hypot(lm[1].x - seam.b.x, lm[1].y - seam.b.y) < 0.02, `${side}: landmark collar_bottom_edge`);
        const poly = polyOf(spec, side), low = poly.slice().sort((p, q) => q.y - p.y).slice(0, 2);
        assert.ok(Math.abs(low[0].y - low[1].y) < 1e-9 && Math.abs(low[0].y - seam.a.y) < 0.005, `${side}: the leaf's two lowest vertices are the seam's ends and level`);
        for(const p of [seam.a, seam.b]) assert.ok(poly.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 0.02), `${side}: a seam end is a vertex of the leaf`);
      }
    });

    test(`${uniform} ${gender}: every piece is turned in the seam's frame: cloth rows and bars a quarter turn from it, stems away from the neck, both leaves mirrored (COLLAR6)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      const cases = [...CADET_OFFICERS.map(r => ['cadet', r]), ...CADET_NCOS.map(r => ['cadet', r]), ...SENIOR_OFFICERS.map(r => ['senior', r])];
      for(const [membership, rank] of cases){
        const scene = await P.composeUniform(build(uniform, gender, membership, rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), seam = seamOf(spec, side);
          assert.ok(l, `${rank} ${side}`);
          // cloth rows (the six cadet officers) and the bars: seam + 90, so the long side stands vertical (diamonds and discs stacked, bars lying along the seam); the stem: seam + 90 on the right
          // leaf, seam - 90 on the left; the chevrons, the Colonel and the generals: the seam's own angle
          if(membership === 'cadet' && CADET_NCOS.includes(rank)) continue;   // the chevrons follow the leaf's front edge (COLLAR8, below)
          let want = 0;
          if(membership === 'cadet' && CADET_OFFICERS.includes(rank)) want = 90;
          else if(membership === 'senior' && (BARS.includes(rank))) want = 90;
          else if(membership === 'senior' && STEM_RANKS.includes(rank)) want = side === 'right' ? 90 : -90;
          assert.ok(Math.abs(relTurn(l, seam) - want) < 0.01, `${rank} ${side}: turned ${l.rotate} deg, the seam is ${seam.angle}, wanted ${want} from it`);
        }
        if(membership === 'cadet' && CADET_NCOS.includes(rank)) continue;
        const r = layer(scene, 'right'), lf = layer(scene, 'left');
        // same appearance on both leaves: the cloth rows and bars are symmetric under the half turn, so the two leaves carry the same piece turned alike; the stems are mirror images
        if(membership === 'senior' && STEM_RANKS.includes(rank)) assert.ok(Math.abs(r.rotate + lf.rotate) < 0.01, `${rank}: the stems are mirror images (${r.rotate} / ${lf.rotate})`);
        else assert.ok(Math.abs(r.rotate - lf.rotate) < 0.01, `${rank}: the two leaves are turned alike (${r.rotate} / ${lf.rotate})`);
        assert.equal(r.id, lf.id, `${rank}: the same art on both leaves`);
      }
    });

    test(`${uniform} ${gender}: every piece is centred on the leaf: its centre is the centroid of the collar polygon, both axes, both leaves, every grade (COLLAR6)`, async () => {
      const cases = [...CADET_OFFICERS.map(r => ['cadet', r]), ...CADET_NCOS.map(r => ['cadet', r]), ...SENIOR_OFFICERS.map(r => ['senior', r])];
      const spec = await store.load(SHEETS[uniform]);
      for(const [membership, rank] of cases){
        const scene = await P.composeUniform(build(uniform, gender, membership, rank), store);
        for(const side of ['right', 'left']){
          const c = centreOf(layer(scene, side)), want = centroidOf(polyOf(spec, side));
          assert.ok(Math.hypot(c.x - want.x, c.y - want.y) < 0.02, `${rank} ${side}: centre (${c.x.toFixed(3)}, ${c.y.toFixed(3)}) vs the leaf's centroid (${want.x.toFixed(3)}, ${want.y.toFixed(3)})`);
        }
        // no 1 in measure is drawn on the collar any more: nothing sits 1 in from an edge
        assert.equal(measures(scene).filter(m => m.label === '1 in').length, 0, `${rank}: no 1 in measure`);
      }
    });

    test(`${uniform} ${gender}: Cadet Lt Col: two diamonds one above the other, each long axis horizontal; Cadet Col: three stacked; C/Maj: one diamond, long axis horizontal; the cloth is the art turned 90 degrees (COLLAR6)`, async () => {
      for(const rank of ['C/Lt Col', 'C/Col', 'C/Maj']){
        const scene = await P.composeUniform(build(uniform, gender, 'cadet', rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), spec = await store.load(l.id);
          // the art is drawn with the row of diamonds horizontal; a quarter turn stands the row vertical, so the cloth's drawn long side is vertical: w x h swap
          const cs = cornersOf(l), xs = cs.map(q => q.x), ys = cs.map(q => q.y);
          const ext = { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
          assert.ok(Math.abs(ext.w - spec.h) < 0.01 && Math.abs(ext.h - spec.w) < 0.01, `${rank} ${side}: on the leaf the cloth is ${ext.w.toFixed(2)} x ${ext.h.toFixed(2)} (the art is ${spec.w} x ${spec.h})`);
          if(rank !== 'C/Maj') assert.ok(ext.h > ext.w, `${rank} ${side}: the row of diamonds stands vertical`);
          assert.ok(Math.abs(l.rotate - 90) < 0.01, `${rank} ${side}: rotate ${l.rotate}`);
        }
      }
    });

    test(`${uniform} ${gender}: the Colonel's beak forward (the eagle mirrored on the wearer's right leaf only); the Major's and Lieutenant Colonel's stem points away from the neck; generals' stars stacked perpendicular to the seam (5.1.1.1.1.1, 5.2.1.1.1.1)`, async () => {
      assert.equal(layer(await P.composeUniform(build(uniform, gender, 'senior', 'Col'), store), 'right').flipX, true);
      assert.ok(!layer(await P.composeUniform(build(uniform, gender, 'senior', 'Col'), store), 'left').flipX);
      for(const rank of GENERALS){
        const scene = await P.composeUniform(build(uniform, gender, 'senior', rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), spec = await store.load(l.id);
          if(rank === 'Maj Gen'){ assert.match(l.id, /1in-vertical/); assert.ok(spec.h > spec.w, 'the two stars are a column in the art'); }
          assert.equal(l.rotate, 0, `${rank} ${side}: stars stand perpendicular to the level seam`);
        }
      }
    });

    test(`${uniform} ${gender}: every piece lies wholly inside its collar leaf, both leaves, every grade (5.1.1.1.1, 5.2.1.1.1)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      const cases = [...CADET_OFFICERS.map(r => ['cadet', r]), ...CADET_NCOS.map(r => ['cadet', r]), ...SENIOR_OFFICERS.map(r => ['senior', r])];
      for(const [membership, rank] of cases){
        const scene = await P.composeUniform(build(uniform, gender, membership, rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), poly = polyOf(spec, side);
          for(const q of cornersOf(l)) assert.ok(inside(q, poly), `${rank} ${side}: corner ${q.x.toFixed(2)},${q.y.toFixed(2)} is off the leaf`);
        }
      }
    });

    test(`${uniform} ${gender}: every cadet officer, C/2d Lt to C/Col, wears the regular cloth-bordered form; the miniature only where the regular would cross the leaf (5.1.1.1.1.3, 5.2.1.1.1.4)`, async () => {
      // Ethan, on the Spaatz and C/Capt drawn as miniatures: "why is the spaatz so small lol, and c/capt". D8: the COLLAR6 test had C/Capt and C/Col in the miniature form always.
      const spec = await store.load(SHEETS[uniform]);
      for(const rank of CADET_OFFICERS){
        const scene = await P.composeUniform(build(uniform, gender, 'cadet', rank), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side);
          assert.match(l.id, /cloth-bordered-regular$/, `${rank} ${side}`);
          for(const q of cornersOf(l)) assert.ok(inside(q, polyOf(spec, side)), `${rank} ${side}: the regular cloth lies inside the leaf`);
        }
      }
    });
  }
}

test('a leaf too small for the regular cloth falls back to the miniature cloth-bordered form (5.1.1.1.1.3); the full-size leaf does not', async () => {
  // Both leaves of the ABU sheet shrunk to 40 percent about their centroids: no regular cadet officer cloth, stood vertical, fits.
  const small = edited(j => {
    for(const n of ['collar_right', 'collar_left']){
      const pts = j.landmarks[n].map(([x, y]) => ({ x, y })), c = centroidOf(pts);
      j.landmarks[n] = pts.map(p => [c.x + (p.x - c.x) * 0.4, c.y + (p.y - c.y) * 0.4]);
    }
  });
  for(const rank of CADET_OFFICERS){
    const scene = await P.composeUniform(build('abu', 'male', 'cadet', rank), small);
    for(const side of ['right', 'left']) assert.match(layer(scene, side).id, /cloth-bordered-miniature$/, `${rank} ${side}`);
  }
});

// ---- COLLAR8: the enlisted chevrons along the leaf's front edge, at one common larger size -----------------------

const NCO_BUILDS = [...CADET_NCOS.map(r => [r, false]), ['C/MSgt', true], ['C/SMSgt', true], ['C/CMSgt', true]];   // the last three also as first sergeants
const buildNco = (u, gender, rank, fs) => Object.assign(build(u, gender, 'cadet', rank), { grade: G.gradeInfo('cadet', rank, { firstSergeant: fs }) });
const ncoLabel = (rank, fs) => rank + (fs ? ' (first sergeant)' : '');
// The sheet's stated leading edge of a leaf { top, bottom } (the tip end first) and the SVG turn that lays a piece's upward axis along it.
function leadingOf(spec, side){
  const pts = spec.raw.collar_slots[side].leading_edge.points.map(q => ({ x: q[0] / 100, y: q[1] / 100 }));
  const [top, bottom] = pts[0].y <= pts[1].y ? pts : [pts[1], pts[0]];
  return { top, bottom, turn: deg(Math.atan2(top.x - bottom.x, -(top.y - bottom.y))), angle_deg: spec.raw.collar_slots[side].leading_edge.angle_deg };
}
// A box of w x h inches turned `rotate`, enlarged by `grow` on every side, inside the polygon? (the corners and the middles of the sides)
const boxInside = (l, poly, grow) => P.helpers.boxInPolygon(poly, centreOf(l), l.w + 2 * grow, l.h + 2 * grow, l.rotate);

for(const uniform of ['abu', 'corporate_field']){
  for(const gender of ['male', 'female']){
    test(`${uniform} ${gender}: the cadet NCO chevron stands upright in the seam's frame, bottom edge parallel to the leaf's lower seam, the same on both leaves, centred on the leaf (5.1.1.1.1.4, 5.2.1.1.1, COLLAR9)`, async () => {
      // D8 (COLLAR9): COLLAR8 laid the chevron along the front edge; Ethan: "parallel to the bottom seam, same as the officer insignia".
      const spec = await store.load(SHEETS[uniform]);
      for(const [rank, fs] of NCO_BUILDS){
        const scene = await P.composeUniform(buildNco(uniform, gender, rank, fs), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side);
          assert.ok(l, `${ncoLabel(rank, fs)} ${side}`);
          const seam = spec.raw.collar_slots[side].bottom_edge, seamDeg = seam && Number.isFinite(seam.angle_deg) ? seam.angle_deg : 0;
          assert.ok(Math.abs(l.rotate - seamDeg) < 0.01, `${ncoLabel(rank, fs)} ${side}: turned ${l.rotate.toFixed(3)}, the seam calls for ${seamDeg}`);
          const c = centreOf(l), want = centroidOf(polyOf(spec, side));
          assert.ok(Math.hypot(c.x - want.x, c.y - want.y) < 0.02, `${ncoLabel(rank, fs)} ${side}: centred on the leaf`);
        }
      }
    });

    test(`${uniform} ${gender}: all enlisted collar chevrons share one scale factor; the C/CMSgt chevron stands 2.5 in tall where it clears the leaf by 0.1 in and every grade lies wholly inside the leaf (COLLAR8, Ethan's ruling, estimated)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      const factors = [];
      for(const [rank, fs] of NCO_BUILDS){
        const scene = await P.composeUniform(buildNco(uniform, gender, rank, fs), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), art = await store.load(l.id);
          factors.push(l.h / art.h);
          assert.ok(Math.abs(l.w / art.w - l.h / art.h) < 1e-3, `${ncoLabel(rank, fs)} ${side}: keeps its own aspect`);
          assert.ok(l.h / art.h > 1.2, `${ncoLabel(rank, fs)} ${side}: larger than the art (${(l.h / art.h).toFixed(3)})`);
          assert.ok(boxInside(l, polyOf(spec, side), 0), `${ncoLabel(rank, fs)} ${side}: inside the leaf`);
          for(const q of cornersOf(l)) assert.ok(inside(q, polyOf(spec, side)), `${ncoLabel(rank, fs)} ${side}: corner off the leaf`);
        }
      }
      assert.ok(Math.max(...factors) - Math.min(...factors) < 1e-3, `one common factor: ${Math.min(...factors)} .. ${Math.max(...factors)}`);
      for(const side of ['right', 'left']){
        const l = layer(await P.composeUniform(build(uniform, gender, 'cadet', 'C/CMSgt'), store), side);
        assert.ok(l.h <= 2.5 + 1e-3 && l.h > 2.3, `C/CMSgt ${side}: ${l.h} in tall`);
        assert.ok(boxInside(l, polyOf(spec, side), 0.1 - 1e-3), `C/CMSgt ${side}: clears the leaf outline by 0.1 in`);
      }
    });
  }
}

test('the enlisted chevron factor makes the C/CMSgt chevron 2.5 in tall when the leaf has room, and keeps the grades\' relative sizes (COLLAR8)', async () => {
  // Both leaves of the ABU sheet enlarged by 1.5 about their centroids (the front edge keeps its direction): 2.5 in clears with room to spare.
  const big = edited(j => {
    for(const n of ['collar_right', 'collar_left']){
      const pts = j.landmarks[n].map(([x, y]) => ({ x, y })), c = centroidOf(pts);
      j.landmarks[n] = pts.map(p => [c.x + (p.x - c.x) * 1.5, c.y + (p.y - c.y) * 1.5]);
    }
  });
  const cm = layer(await P.composeUniform(build('abu', 'male', 'cadet', 'C/CMSgt'), big), 'right');
  assert.ok(Math.abs(cm.h - 2.5) < 1e-3, `C/CMSgt is ${cm.h} in tall`);
  const art = await store.load(cm.id), f = 2.5 / art.h;
  for(const rank of CADET_NCOS){
    const l = layer(await P.composeUniform(build('abu', 'male', 'cadet', rank), big), 'right'), a = await store.load(l.id);
    assert.ok(Math.abs(l.h - a.h * f) < 1e-3 && Math.abs(l.w - a.w * f) < 1e-3, `${rank}: ${l.w} x ${l.h} is the art ${a.w} x ${a.h} at ${f.toFixed(4)}`);
  }
});

test('a leaf too small for the enlarged chief shrinks the common factor until it clears by 0.1 in; the grade below keeps the same factor (COLLAR8)', async () => {
  const small = edited(j => {
    for(const n of ['collar_right', 'collar_left']){
      const pts = j.landmarks[n].map(([x, y]) => ({ x, y })), c = centroidOf(pts);
      j.landmarks[n] = pts.map(p => [c.x + (p.x - c.x) * 0.8, c.y + (p.y - c.y) * 0.8]);
    }
  });
  const spec = await small.load('garment-abu-coat');
  const cm = layer(await P.composeUniform(build('abu', 'male', 'cadet', 'C/CMSgt'), small), 'right'), am = layer(await P.composeUniform(build('abu', 'male', 'cadet', 'C/Amn'), small), 'right');
  assert.ok(cm.h < 2.3, `C/CMSgt shrinks to ${cm.h} in`);
  assert.ok(boxInside(cm, polyOf(spec, 'right'), 0.1 - 1e-3) && !boxInside(Object.assign({}, cm, { w: cm.w * 1.02, h: cm.h * 1.02 }), polyOf(spec, 'right'), 0.1), 'the factor is the largest that clears by 0.1 in');
  const ca = await store.load(cm.id), aa = await store.load(am.id);
  assert.ok(Math.abs(cm.h / ca.h - am.h / aa.h) < 1e-3, 'C/Amn keeps the same factor');
});

test('the shirts\' chevron rule is untouched: Class B chevrons keep their natural size (Figure A5-5)', async () => {
  const scene = await P.composeUniform(build('blues_b', 'male', 'cadet', 'C/CMSgt'), store);
  const l = scene.layers.find(x => x.key === 'grade:right');
  if(l){ const art = await store.load(l.id); assert.ok(Math.abs(l.h - art.h) < 1e-6, `${l.h} vs ${art.h}`); }
});

test('the seam angle is read from the sheet: a seam stated 10 degrees off turns every piece on that leaf by 10 degrees from its COLLAR6 frame, the leaf without one keeps its own', async () => {
  // The wearer's right leaf of the ABU sheet is given a sloping bottom_edge (0.01 in): the pieces on it follow; the other leaf is untouched.
  const st = edited(j => { j.collar_slots.right.bottom_edge = { points: [[1467, 1237], [1737, 1237 + Math.round(270 * Math.tan(10 * Math.PI / 180))]] }; });
  const spec = await st.load('garment-abu-coat');
  const want = deg(Math.atan2(Math.round(270 * Math.tan(10 * Math.PI / 180)), 270));
  // [membership, rank, the turn from the seam's frame]: cloth rows and bars a quarter turn, the Colonel and generals the seam's own angle
  for(const [membership, rank, from] of [['cadet', 'C/Lt Col', 90], ['senior', 'Capt', 90], ['senior', 'Col', 0], ['senior', 'Brig Gen', 0]]){
    const scene = await P.composeUniform(build('abu', 'male', membership, rank), st);
    assert.ok(Math.abs(layer(scene, 'right').rotate - (want + from)) < 0.01, `${rank} right: ${layer(scene, 'right').rotate} vs ${want + from}`);
    assert.equal(layer(scene, 'left').rotate, from, `${rank} left`);
  }
  assert.ok(Math.abs(seamOf(spec, 'right').angle - want) < 0.01);
  // a sheet with no bottom_edge at all falls back to the leaf polygon's own bottom edge (the edge whose outward normal points most nearly down): level here
  const bare = edited(j => { delete j.collar_slots.right.bottom_edge; delete j.collar_slots.left.bottom_edge; });
  const sc = await P.composeUniform(build('abu', 'male', 'cadet', 'C/Lt Col'), bare);
  assert.equal(layer(sc, 'right').rotate, 90);
  assert.equal(layer(sc, 'left').rotate, 90);
});

test('the centre is the leaf polygon\'s centroid whatever the sheet states for a leading edge; the stated leading_edge turns the chevron and nothing else (COLLAR8)', async () => {
  const base = await P.composeUniform(build('abu', 'male', 'cadet', 'C/SSgt'), store);
  const st = edited(j => { j.collar_slots.right.leading_edge = { points: [[1709, 807], [1709, 1110]] }; });
  const moved = await P.composeUniform(build('abu', 'male', 'cadet', 'C/SSgt'), st);
  for(const side of ['right', 'left']){
    const a = centreOf(layer(base, side)), b = centreOf(layer(moved, side));   // the size may differ (the clear-the-outline factor follows the turn); the centre does not
    assert.ok(Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01, `${side}: same centre`);
  }
  assert.equal(layer(moved, 'right').rotate, 0, 'a vertical front edge stands the chevron upright');
  assert.equal(layer(moved, 'left').rotate, layer(base, 'left').rotate, 'the other leaf keeps its own edge');
});

test('H.polygonCentroid is the area centroid (a right triangle: a third of each leg); H.boxInPolygon tests a turned box against the outline (COLLAR6)', () => {
  const C = P.helpers.polygonCentroid, B = P.helpers.boxInPolygon;
  const tri = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 3 }];
  const c = C(tri);
  assert.ok(Math.abs(c.x - 1) < 1e-9 && Math.abs(c.y - 1) < 1e-9);
  // winding does not matter
  const r = C(tri.slice().reverse());
  assert.ok(Math.abs(r.x - 1) < 1e-9 && Math.abs(r.y - 1) < 1e-9);
  const sq = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }];
  assert.ok(B(sq, { x: 2, y: 1 }, 3.9, 1.9, 0));
  assert.ok(!B(sq, { x: 2, y: 1 }, 4.1, 1.9, 0), 'too wide');
  assert.ok(!B(sq, { x: 2, y: 1 }, 3, 1, 90), '3 x 1 turned a quarter turn is 1 x 3: too tall for a 2 high rectangle');
  assert.ok(B(sq, { x: 2, y: 1 }, 1.5, 1.9, 90), '1.5 x 1.9 turned is 1.9 x 1.5: fits');
});

test('the longest edge of the collar polygon is the front edge of the leaf on both sheets, both leaves (the fallback when the sheet states no leading_edge)', async () => {
  for(const u of ['abu', 'corporate_field']){
    const spec = await store.load(SHEETS[u]);
    for(const side of ['right', 'left']){
      const pts = polyOf(spec, side); let best = null, len = 0;
      for(let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length], d = Math.hypot(q.x - p.x, q.y - p.y); if(d > len){ len = d; best = { a: p, b: q }; } }
      const f = spec.raw.collar_slots[side].front_edge, a = { x: f.p1[0] / 100, y: f.p1[1] / 100 }, b = { x: f.p2[0] / 100, y: f.p2[1] / 100 };
      const ang = Math.abs(Math.asin(Math.min(1, Math.abs((b.x - a.x) * (best.b.y - best.a.y) - (b.y - a.y) * (best.b.x - best.a.x)) / (Math.hypot(b.x - a.x, b.y - a.y) * len))));
      assert.ok(deg(ang) < 1, `${u} ${side}: ${deg(ang).toFixed(2)} deg from the slot's front edge`);
    }
  }
});

test('the sheets state the leading edge twice, as collar_slots[side].leading_edge.points and as the landmark collar_leading_edge_<side>, and the two agree (0.02 in); the engine reads the slot', async () => {
  for(const sheet of Object.values(SHEETS)){
    const spec = await store.load(sheet);
    for(const side of ['right', 'left']){
      const le = spec.raw.collar_slots[side].leading_edge;
      assert.ok(le && le.points && le.points.length === 2, `${sheet} ${side}: leading_edge.points`);
      const lm = core.landmark(spec, 'collar_leading_edge_' + side).points;
      le.points.forEach((p, i) => assert.ok(Math.hypot(p[0] / 100 - lm[i].x, p[1] / 100 - lm[i].y) <= 0.02, `${sheet} ${side}: point ${i}`));
    }
  }
});
