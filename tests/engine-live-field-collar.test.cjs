'use strict';
// ABU and Corporate Field Uniform collar grade (CAPR 39-1 5.1.1.1.1, 5.2.1.1.1), COLLAR6; the POSITION of every piece is the paragraphs' 1 in from the collar's edge since
// 2 November 2026 (Ethan: "for ABU rank alignment, it should be based off from an inch from the collar, not in the vertical center"): the turns below stand.
// Ethan, on the cadet Lt Col cloth drawn as a level rectangle pushed toward the leaf's outer side: "flip it 90 degrees, and center it, and apply that logic for everything else." Every collar grade
// piece is centred on its leaf (its centre the centroid of the collar_left / collar_right polygon, both axes) and stands in the frame of the leaf's lower seam (collar_slots[side].bottom_edge, level on
// both sheets): the cadet officers' cloth and the bars are turned a quarter turn from that frame so the cloth's long side stands vertical, the cadet NCO metal chevron is turned so its apex points at the V (COLLAR10), the Major's and
// Lieutenant Colonel's stem stays parallel to the ground away from the neck, the Colonel's beak forward, the generals' stars stacked perpendicular to the seam. D8: the COLLAR5 tests had the cadet pieces
// 1 in from the front edge and the officers 1 in above the seam, unturned; Ethan's ruling replaces those positions.
// COLLAR8 (Ethan, on the C/CMSgt chevrons standing small and upright on each leaf: "the long edge needs to be parallel to the collar, and the chief specifically needs to be bigger. for all enlisted
// things."): the cadet NCO metal chevron's long edge lies along the leaf's front (leading) edge, mirrored on the two leaves, and all enlisted collar chevrons are scaled by one common factor so the
// C/CMSgt one stands 2.5 in tall (less if it would not clear the leaf outline by 0.1 in). D8: the COLLAR6 tests had the chevrons upright.
// 2 November 2026 (the one-inch rule wins): the chevron's near edge is 1 in from the front edge, centred between the leaf's sides, one factor for the sheet never above the art's true size and small
// enough that the largest grade clears the leaf outline by the cloth's 1/8 in; the COLLAR8 2.5 in chief is gone.
// COLLAR10 (Ethan: "flip it 90 so the points are basically pointing at each other"): the chevron is a quarter turn from the seam's frame, apex inward toward the V (seam + 90 on the wearer's right leaf, - 90 on the left).

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
          if(membership === 'cadet' && CADET_NCOS.includes(rank)) continue;   // the chevrons: a quarter turn, apex inward (COLLAR10, below)
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

    test(`${uniform} ${gender}: officers' grade is 1 in from the bottom of the collar, cadet officers' 1 in from the front, each centred between the leaf's sides there; the cadet NCO chevron's near edge is 1 in from the front (5.1.1.1.1.1, 5.1.1.1.1.3-4, 5.2.1.1.1.1, 5.2.1.1.1.4, 5.2.1.1.1.6)`, async () => {
      const cases = [...CADET_OFFICERS.map(r => ['cadet', r]), ...CADET_NCOS.map(r => ['cadet', r]), ...SENIOR_OFFICERS.map(r => ['senior', r])];
      const spec = await store.load(SHEETS[uniform]);
      for(const [membership, rank] of cases){
        const scene = await P.composeUniform(build(uniform, gender, membership, rank), store), chevron = CADET_NCOS.includes(rank);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), poly = polyOf(spec, side);
          // the edge: the sheet's lower seam for the officers, its leading (front) edge for the cadets
          let a, b;
          if(membership === 'senior'){ const se = seamOf(spec, side); a = se.a; b = se.b; }
          else { const le = leadingOf(spec, side); a = le.top; b = le.bottom; }
          const len = Math.hypot(b.x - a.x, b.y - a.y), t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }, cen = centroidOf(poly);
          let n = { x: -t.y, y: t.x }; if((cen.x - a.x) * n.x + (cen.y - a.y) * n.y < 0) n = { x: -n.x, y: -n.y };
          const dist = q => (q.x - a.x) * n.x + (q.y - a.y) * n.y, along = q => (q.x - a.x) * t.x + (q.y - a.y) * t.y;
          // the art box includes the cloth's 1/8 in of blue, so the embroidery's near side is 1 in from the edge when the box's is 7/8 in; the metal chevron has no cloth: its near edge is 1 in
          const near = Math.min(...cornersOf(l).map(dist));
          assert.ok(Math.abs(near - (chevron ? 1 : 0.875)) < 0.01, `${rank} ${side}: the near side is ${near.toFixed(3)} in from the ${membership === 'senior' ? 'bottom' : 'front'} of the collar (the embroidery's 1 in, less the cloth's 1/8 in of blue)`);
          // centred between the leaf's sides at the piece's height: the middle of the chord the parallel to the edge through the piece's centre cuts across the leaf
          const c = centreOf(l), d = dist(c), xs = [];
          for(let i = 0; i < poly.length; i++){
            const p0 = poly[i], p1 = poly[(i + 1) % poly.length], d0 = dist(p0) - d, d1 = dist(p1) - d;
            if(d0 * d1 > 0 || d0 === d1) continue;
            const k = d0 / (d0 - d1); xs.push(along({ x: p0.x + k * (p1.x - p0.x), y: p0.y + k * (p1.y - p0.y) }));
          }
          const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
          assert.ok(Math.abs(along(c) - mid) < 0.02, `${rank} ${side}: centred ${along(c).toFixed(3)} along the edge, the chord's middle is ${mid.toFixed(3)}`);
        }
        // the 1 in is drawn once, on the wearer's right leaf
        const ones = measures(scene).filter(m => m.label === '1 in');
        assert.equal(ones.length, 1, `${rank}: one 1 in measure on the collar`);
        assert.ok(Math.abs(Math.hypot(ones[0].to.x - ones[0].from.x, ones[0].to.y - ones[0].from.y) - 1) < 0.01, `${rank}: it spans 1 in`);
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
    test(`${uniform} ${gender}: the cadet NCO chevron is turned a quarter turn from the seam's frame so its apex points inward at the placket V, mirrored on the two leaves (5.1.1.1.1.4, 5.2.1.1.1, COLLAR10)`, async () => {
      // D8 (COLLAR10): COLLAR9 stood the chevron upright in the seam's frame; Ethan: "flip it 90 so the points are basically pointing at each other."
      const spec = await store.load(SHEETS[uniform]);
      for(const [rank, fs] of NCO_BUILDS){
        const scene = await P.composeUniform(buildNco(uniform, gender, rank, fs), store);
        const apex = {};
        for(const side of ['right', 'left']){
          const l = layer(scene, side);
          assert.ok(l, `${ncoLabel(rank, fs)} ${side}`);
          const seam = spec.raw.collar_slots[side].bottom_edge, seamDeg = seam && Number.isFinite(seam.angle_deg) ? seam.angle_deg : 0;
          // the wearer's right leaf is the viewer's left: seam + 90 there, seam - 90 on the wearer's left leaf
          const want = seamDeg + (side === 'right' ? 90 : -90);
          assert.ok(Math.abs(l.rotate - want) < 0.01, `${ncoLabel(rank, fs)} ${side}: turned ${l.rotate.toFixed(3)}, a quarter turn from the seam calls for ${want}`);
          const c = centreOf(l);
          // the apex is the art's top_center anchor: turned by rotate about the centre, it lies half a height from the centre along (sin, -cos)
          const art = await store.load(l.id), r = l.rotate * Math.PI / 180, top = art.raw.anchors.top_center, mid = art.raw.anchors.center;
          assert.ok(Math.abs(top[0] - mid[0]) < 1e-6 && top[1] < mid[1], `${l.id}: the apex is the top of the art`);
          apex[side] = { x: c.x + Math.sin(r) * l.h / 2, y: c.y - Math.cos(r) * l.h / 2, c };
          const toward = side === 'right' ? 1 : -1;   // the V lies to the viewer's right of the wearer's right leaf
          assert.ok((apex[side].x - c.x) * toward > l.h / 2 - 0.01, `${ncoLabel(rank, fs)} ${side}: the apex points inward toward the V`);
        }
        assert.ok(apex.right.x < apex.left.x, `${ncoLabel(rank, fs)}: the two apexes face each other across the V`);
        const rs = layer(scene, 'right'), ls = layer(scene, 'left');
        assert.ok(Math.abs(rs.rotate + ls.rotate) < 0.01, `${ncoLabel(rank, fs)}: mirrored turns on the level seams (${rs.rotate} / ${ls.rotate})`);
      }
    });

    test(`${uniform} ${gender}: every cadet NCO and airman collar chevron has its near edge 1.00 in from the front edge of the collar, lies inside the leaf with the cloth's 1/8 in of blue margin, and all share one scale never above the art's true size (5.1.1.1.1.4, 5.2.1.1.1.6)`, async () => {
      const spec = await store.load(SHEETS[uniform]);
      const factors = [];
      for(const [rank, fs] of NCO_BUILDS){
        const scene = await P.composeUniform(buildNco(uniform, gender, rank, fs), store);
        for(const side of ['right', 'left']){
          const l = layer(scene, side), art = await store.load(l.id), le = leadingOf(spec, side), poly = polyOf(spec, side);
          factors.push(l.h / art.h);
          assert.ok(Math.abs(l.w / art.w - l.h / art.h) < 1e-3, `${ncoLabel(rank, fs)} ${side}: keeps its own aspect`);
          assert.ok(l.h / art.h <= 1 + 1e-6, `${ncoLabel(rank, fs)} ${side}: never larger than the art (${(l.h / art.h).toFixed(4)})`);
          assert.ok(boxInside(l, poly, 0.125 - 1e-3), `${ncoLabel(rank, fs)} ${side}: inside the leaf with 1/8 in to spare`);
          for(const q of cornersOf(l)) assert.ok(inside(q, poly), `${ncoLabel(rank, fs)} ${side}: corner off the leaf`);
          // the near edge: the nearest corner of the turned art box to the front edge, on the leaf's side of it
          const len = Math.hypot(le.bottom.x - le.top.x, le.bottom.y - le.top.y), cen = centroidOf(poly);
          let n = { x: -(le.bottom.y - le.top.y) / len, y: (le.bottom.x - le.top.x) / len };
          if((cen.x - le.top.x) * n.x + (cen.y - le.top.y) * n.y < 0) n = { x: -n.x, y: -n.y };
          const near = Math.min(...cornersOf(l).map(q => (q.x - le.top.x) * n.x + (q.y - le.top.y) * n.y));
          assert.ok(Math.abs(near - 1) < 0.01, `${ncoLabel(rank, fs)} ${side}: near edge ${near.toFixed(3)} in from the front edge`);
        }
      }
      assert.ok(Math.max(...factors) - Math.min(...factors) < 1e-3, `one common factor: ${Math.min(...factors)} .. ${Math.max(...factors)}`);
    });
  }
}

test('the enlisted chevron factor is never above 1, the art\'s true size, however much room the leaf has (5.1.1.1.1.4)', async () => {
  // Both leaves of the ABU sheet enlarged by 1.5 about their centroids (the stated front edge moves out with them): the chief would clear at far above 1; it stays 1.
  const big = edited(j => {
    for(const n of ['collar_right', 'collar_left']){
      const pts = j.landmarks[n].map(([x, y]) => ({ x, y })), c = centroidOf(pts), side = n === 'collar_right' ? 'right' : 'left', le = j.collar_slots[side].leading_edge;
      j.landmarks[n] = pts.map(p => [c.x + (p.x - c.x) * 1.5, c.y + (p.y - c.y) * 1.5]);
      le.points = le.points.map(([x, y]) => [Math.round((c.x + (x / 100 - c.x) * 1.5) * 100), Math.round((c.y + (y / 100 - c.y) * 1.5) * 100)]);
    }
  });
  for(const rank of CADET_NCOS){
    const l = layer(await P.composeUniform(build('abu', 'male', 'cadet', rank), big), 'right'), a = await store.load(l.id);
    assert.ok(Math.abs(l.h - a.h) < 1e-3 && Math.abs(l.w - a.w) < 1e-3, `${rank}: ${l.w} x ${l.h} is the art ${a.w} x ${a.h}`);
  }
});

test('a leaf too small for the chevron at true size shrinks the common factor to the largest that clears by 1/8 in; the grade below keeps the same factor (5.1.1.1.1.4)', async () => {
  // Both leaves of the ABU sheet shrunk to 70 percent about their centroids, the stated front edge with them.
  const small = edited(j => {
    for(const n of ['collar_right', 'collar_left']){
      const pts = j.landmarks[n].map(([x, y]) => ({ x, y })), c = centroidOf(pts), side = n === 'collar_right' ? 'right' : 'left', le = j.collar_slots[side].leading_edge;
      j.landmarks[n] = pts.map(p => [c.x + (p.x - c.x) * 0.7, c.y + (p.y - c.y) * 0.7]);
      le.points = le.points.map(([x, y]) => [Math.round((c.x + (x / 100 - c.x) * 0.7) * 100), Math.round((c.y + (y / 100 - c.y) * 0.7) * 100)]);
    }
  });
  const spec = await small.load('garment-abu-coat');
  const cm = layer(await P.composeUniform(build('abu', 'male', 'cadet', 'C/CMSgt'), small), 'right'), am = layer(await P.composeUniform(build('abu', 'male', 'cadet', 'C/Amn'), small), 'right');
  const ca = await store.load(cm.id), aa = await store.load(am.id);
  assert.ok(cm.h / ca.h < 0.99, `C/CMSgt shrinks to ${(cm.h / ca.h).toFixed(3)} of the art`);
  assert.ok(boxInside(cm, polyOf(spec, 'right'), 0.125 - 1e-3), 'the factor clears the leaf by 1/8 in');
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

test('the chevron stands 1 in from the sheet\'s stated front edge: moving the stated edge moves the chevron with it and does not turn it (5.1.1.1.1.4; COLLAR10: the seam and the side turn it)', async () => {
  const base = await P.composeUniform(build('abu', 'male', 'cadet', 'C/SSgt'), store);
  const st = edited(j => { j.collar_slots.right.leading_edge = { points: [[1709, 807], [1709, 1110]] }; });
  const moved = await P.composeUniform(build('abu', 'male', 'cadet', 'C/SSgt'), st);
  const a = centreOf(layer(base, 'right')), b = centreOf(layer(moved, 'right'));
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.01, 'the right chevron follows the stated edge');
  // the new edge is the vertical line x = 17.09 in: the chevron's nearest corner stands 1 in from it
  const near = Math.min(...cornersOf(layer(moved, 'right')).map(q => Math.abs(q.x - 17.09)));
  assert.ok(Math.abs(near - 1) < 0.01, `the near edge is ${near.toFixed(3)} in from the moved front edge`);
  assert.equal(layer(moved, 'right').rotate, 90);
  assert.equal(layer(moved, 'left').rotate, -90);
});

test('a seam stated 10 degrees off turns the chevron by 10 degrees from its quarter turn, apex still inward on that leaf (COLLAR10)', async () => {
  const st = edited(j => { j.collar_slots.right.bottom_edge = { points: [[1467, 1237], [1737, 1237 + Math.round(270 * Math.tan(10 * Math.PI / 180))]] }; });
  const want = deg(Math.atan2(Math.round(270 * Math.tan(10 * Math.PI / 180)), 270));
  const sc = await P.composeUniform(build('abu', 'male', 'cadet', 'C/SSgt'), st);
  assert.ok(Math.abs(layer(sc, 'right').rotate - (want + 90)) < 0.01, `right: ${layer(sc, 'right').rotate}`);
  assert.equal(layer(sc, 'left').rotate, -90);
  const l = layer(sc, 'right'), r = l.rotate * Math.PI / 180;
  assert.ok(Math.sin(r) > 0.9, 'the apex still points toward the V (to the viewer\'s right)');
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
