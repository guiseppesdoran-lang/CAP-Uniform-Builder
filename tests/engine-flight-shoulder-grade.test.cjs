'use strict';
// F4 (the owner, on the flight suit: "the ranks should probably be the same as the class a jacket, kinda half hanging off of the shoulder"): the
// officer grade on the flight suits' shoulders is drawn by the service coat's own rule (gradeOnStrap, profiles-dress.js) along the shoulder line the
// suit's sheet states (landmark shoulder_line): edge-on, squeezed across the shoulder to the coat's thickness, at its regulation size along it and its
// regulation distance from the seam (CAPR 39-1 8.2.3.1, 8.2.3.2, 8.3.3.1, 8.3.3.2), half of it standing over the outline. The flight jackets keep their
// grade zones (tests/engine-e7-flight.test.cjs).

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
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const ST = store();
const EPS = 0.006;

const SUITS = [
  { name: 'FDU', uniform: 'flight_suit', garment: 'garment-fdu-flight-suit' },
  { name: 'CFDU', uniform: 'corporate_flight_suit', garment: 'garment-cfdu-flight-suit' }
];
const RANKS = ['FO', 'TFO', 'SFO', '2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col', 'Brig Gen', 'Maj Gen'];
const BARS = new Set(['FO', 'TFO', 'SFO', '2d Lt', '1st Lt', 'Capt']);
const GENERALS = new Set(['Brig Gen', 'Maj Gen']);
const THICK = 0.46, ACROSS = THICK - 0.08;   // the thickness the sheets state for the shoulder seen edge-on, and what the coat squeezes a grade to on it

function build(uniform, gender, membership, rank, opt){
  return {
    uniform, gender, grade: G.gradeInfo(membership, rank, {}),
    opt: Object.assign({ headgear: 'auto' }, opt), name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  };
}
const compose = b => P.composeUniform(b, store());

// The shoulder line of a suit's sheet in scene inches (the garment sheet is figure 1, at the scene's origin, true size).
async function lineOf(garment, side){
  const spec = await ST.load(garment), l = spec.landmarks.shoulder_line[side];
  const outer = { x: l.p1[0] / 100, y: l.p1[1] / 100 }, neck = { x: l.p2[0] / 100, y: l.p2[1] / 100 };
  const length = Math.hypot(neck.x - outer.x, neck.y - outer.y);
  return { outer, neck, length, axis: { x: (neck.x - outer.x) / length, y: (neck.y - outer.y) / length }, thick: l.edge_thickness_in, spec };
}
const corners = l => {
  const o = l.origin || { x: l.x, y: l.y };
  return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, o, l.rotate || 0));
};
const centre = l => { const c = corners(l); return { x: (c[0].x + c[2].x) / 2, y: (c[0].y + c[2].y) / 2 }; };
// The piece's extent along the shoulder line and across it, from its corners.
const extents = (l, f) => {
  const c = corners(l), along = c.map(p => (p.x - f.outer.x) * f.axis.x + (p.y - f.outer.y) * f.axis.y), across = c.map(p => (p.x - f.outer.x) * -f.axis.y + (p.y - f.outer.y) * f.axis.x);
  return { a0: Math.min(...along), a1: Math.max(...along), c0: Math.min(...across), c1: Math.max(...across) };
};
const segDist = (p, u, v) => { const dx = v.x - u.x, dy = v.y - u.y, t = Math.max(0, Math.min(1, ((p.x - u.x) * dx + (p.y - u.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p.x - u.x - t * dx, p.y - u.y - t * dy); };
const inside = (p, poly) => { let r = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) r = !r; } return r; };
// Smallest distance between a convex quadrilateral and a polygon, 0 when they overlap.
const gap = (quad, poly) => {
  if(quad.some(p => inside(p, poly)) || poly.some(p => inside(p, quad))) return 0;
  let d = Infinity;
  for(const p of quad) for(let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i], poly[(i + 1) % poly.length]));
  for(const p of poly) for(let i = 0; i < quad.length; i++) d = Math.min(d, segDist(p, quad[i], quad[(i + 1) % quad.length]));
  return d;
};
// A path of the sheet's own drawing (figure inches under the art group's scale) as a polygon in sheet inches.
function sheetPath(garment, name, spec){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', garment + '.svg'), 'utf8');
  const d = new RegExp('id="' + garment + '__' + name + '"[^>]*\\sd="([^"]+)"').exec(svg) || new RegExp('\\sd="([^"]+)"[^>]*id="' + garment + '__' + name + '"').exec(svg);
  assert.ok(d, `${garment} draws ${name}`);
  const n = d[1].match(/-?\d*\.?\d+/g).map(Number), KF = spec.raw.dimensions.scale_factor_from_figure, c = spec.anchors.centerline_top, pts = [];
  for(let i = 0; i + 1 < n.length; i += 2) pts.push({ x: c.x + n[i] * KF, y: c.y + n[i + 1] * KF });
  return pts;
}

test('the suits draw the shoulder grade by the service coat\'s own function: one call a side, and the layers it returns are the ones in the scene (F4)', async () => {
  const gradeOnStrap = P.helpers.gradeOnStrap;
  assert.equal(typeof gradeOnStrap, 'function', 'the coat\'s grade rule is handed to the profiles');
  try{
    for(const suit of SUITS){
      const calls = [], returned = [];
      P.helpers.gradeOnStrap = async (...a) => { calls.push(a); const l = await gradeOnStrap(...a); returned.push(l); return l; };
      const scene = await compose(build(suit.uniform, 'male', 'senior', 'Capt'));
      assert.equal(calls.length, 2, `${suit.name}: one call to the coat's rule for each shoulder`);
      assert.deepEqual(calls.map(a => a[2]), ['right', 'left']);
      for(const l of returned) assert.ok(l && scene.layers.includes(l), `${suit.name}: the grade in the scene is the layer the coat's rule returned`);
      // The jacket beside the suit is not drawn by it: nothing is called when only the jacket draws a grade.
      calls.length = 0;
      const jacket = await compose(build(suit.uniform, 'male', 'senior', 'Capt', { jacket: true }));
      assert.equal(calls.length, 2, `${suit.name}: with the jacket added the suit still makes two calls and the jacket none`);
      assert.equal(jacket.layers.filter(l => l.role === 'grade').length, 4);
    }
  }finally{ P.helpers.gradeOnStrap = gradeOnStrap; }
});

test('every officer grade lies on the shoulder line, turned along it, squeezed across it as the coat squeezes it and at its regulation size along it, on both suits and both cuts (F4; 8.2.3, 8.3.3)', async () => {
  for(const suit of SUITS){
    for(const gender of ['male', 'female']){
      for(const rank of RANKS){
        const tag = `${suit.name} ${gender} ${rank}`;
        const scene = await compose(build(suit.uniform, gender, 'senior', rank));
        const grades = scene.layers.filter(l => l.role === 'grade');
        assert.equal(grades.length, 2, `${tag}: one grade piece on each shoulder`);
        const sheet = scene.layers.find(l => l.id === suit.garment);
        assert.ok(sheet && sheet.x === 0 && sheet.y === 0, `${tag}: the sheet is at the scene's origin, so its inches are the scene's`);
        for(const side of ['right', 'left']){
          const l = grades.find(x => x.key === 'grade:' + side), f = await lineOf(suit.garment, side), art = await ST.load(l.id);
          assert.ok(l, `${tag} ${side}`);
          // On the line: the piece's centre is on the chord from the shoulder point to the neck end, so half of it stands over the outline.
          const c = centre(l), off = (c.x - f.outer.x) * -f.axis.y + (c.y - f.outer.y) * f.axis.x;
          assert.ok(Math.abs(off) < 0.003, `${tag} ${side}: the piece's centre line is the shoulder line (off by ${off.toFixed(4)} in)`);
          // Turned: the bars lie across the shoulder (their long side across it), every other grade stands with its top toward the neck.
          const ex = extents(l, f), along = ex.a1 - ex.a0, across = ex.c1 - ex.c0;
          const quarter = BARS.has(rank), trueAlong = quarter ? art.w : art.h, trueAcross = quarter ? art.h : art.w;
          assert.ok(Math.abs(along - trueAlong) < EPS, `${tag} ${side}: ${along.toFixed(3)} in along the shoulder is its regulation ${trueAlong.toFixed(3)} in`);
          // Squeezed: to the coat's across size, and never widened.
          assert.ok(Math.abs(across - Math.min(ACROSS, trueAcross)) < EPS, `${tag} ${side}: ${across.toFixed(3)} in across the shoulder is the ${ACROSS.toFixed(2)} in the coat squeezes to`);
          // The art's own up direction: toward the neck, or (the bars, which are symmetric) a quarter turn from it.
          const r = (l.rotate || 0) * Math.PI / 180, up = { x: Math.sin(r), y: -Math.cos(r) };   // the art's top, after the turn
          const dot = up.x * f.axis.x + up.y * f.axis.y;
          if(quarter) assert.ok(Math.abs(dot) < 1e-3, `${tag} ${side}: the bars' long side is across the shoulder`);
          else assert.ok(dot > 0.999, `${tag} ${side}: the grade's top is toward the neck`);
          // Mirrored as the coat does: the colonel's eagle on the wearer's right only.
          assert.equal(!!l.flipX, rank === 'Col' && side === 'right', `${tag} ${side}: eagle mirrored on the wearer's right`);
        }
      }
    }
  }
});

test('the distance from the seam is the regulation\'s: officers\' seam-side edge 1/2 in from the shoulder seam, generals\' stars centred halfway between neck and seam (F4; 8.2.3.1, 8.2.3.2, 8.3.3.1, 8.3.3.2)', async () => {
  for(const suit of SUITS){
    for(const rank of RANKS){
      const scene = await compose(build(suit.uniform, 'male', 'senior', rank));
      for(const side of ['right', 'left']){
        const l = scene.layers.find(x => x.key === 'grade:' + side), f = await lineOf(suit.garment, side), ex = extents(l, f);
        if(GENERALS.has(rank)) assert.ok(Math.abs((ex.a0 + ex.a1) / 2 - f.length / 2) < EPS, `${suit.name} ${rank} ${side}: centred halfway between the seam and the neck (${((ex.a0 + ex.a1) / 2).toFixed(3)} of ${f.length.toFixed(3)} in)`);
        else assert.ok(Math.abs(ex.a0 - 0.5) < EPS, `${suit.name} ${rank} ${side}: the seam-side edge is ${ex.a0.toFixed(3)} in from the shoulder seam, not 1/2 in`);
        // And the grade stays on the shoulder: short of the neck end, never over the sleeve.
        assert.ok(ex.a0 > 0.4 && ex.a1 < f.length, `${suit.name} ${rank} ${side}: between the seam and the neck end of the line`);
      }
      // The drawn 1/2 in is the same distance: the measure runs from the shoulder point along the line (officers; a general's rule is the middle, not a distance).
      const m = scene.layers.find(x => x.role === 'measure' && x.opts && x.opts.caption === 'shoulder seam to grade');
      if(GENERALS.has(rank)) assert.ok(!m, `${suit.name} ${rank}: no seam distance is drawn for a general`);
      else{
        const f = await lineOf(suit.garment, 'right');
        assert.ok(m, `${suit.name} ${rank}: the seam distance is drawn`);
        assert.ok(Math.hypot(m.from.x - f.outer.x, m.from.y - f.outer.y) < 1e-6 && Math.abs(Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y) - 0.5) < 1e-6, `${suit.name} ${rank}: the measure is 1/2 in from the shoulder point`);
      }
    }
  }
});

test('the CFDU\'s grade border (8.3.5.1: 1/8 in larger than the insignia) is measured once, along the shoulder at the piece\'s seam-side edge, where it keeps its true size; the FDU has none (F4)', async () => {
  for(const rank of RANKS){
    const fdu = await compose(build('flight_suit', 'male', 'senior', rank));
    assert.ok(!fdu.layers.some(l => l.role === 'measure' && l.label === '⅛ in'), `FDU ${rank}: no border measure`);
    const scene = await compose(build('corporate_flight_suit', 'male', 'senior', rank));
    const ms = scene.layers.filter(l => l.role === 'measure' && l.label === '⅛ in');
    assert.equal(ms.length, 1, `CFDU ${rank}: one border measure`);
    const f = await lineOf('garment-cfdu-flight-suit', 'right'), l = scene.layers.find(x => x.key === 'grade:right'), ex = extents(l, f), m = ms[0];
    assert.equal(m.opts.callout.caption, 'of blue around the embroidery');
    const a = p => (p.x - f.outer.x) * f.axis.x + (p.y - f.outer.y) * f.axis.y, off = p => (p.x - f.outer.x) * -f.axis.y + (p.y - f.outer.y) * f.axis.x;
    assert.ok(Math.abs(a(m.from) - ex.a0) < 1e-6 && Math.abs(a(m.to) - ex.a0 - 0.125) < 1e-6 && Math.abs(off(m.from)) < 1e-6 && Math.abs(off(m.to)) < 1e-6, `CFDU ${rank}: 1/8 in along the shoulder line from the piece's seam-side edge`);
  }
});

test('the grade has the coat\'s foreshortening: the Class A coat\'s officer grade and the suit\'s are squeezed across the shoulder to the same thickness (F4)', async () => {
  // The squeezed side is the short one of the placed box (the thickness 0.38 in against a piece 0.65 in or more along the shoulder).
  const across = (scene, key) => { const l = scene.layers.find(x => x.key === key); return Math.min(l.w, l.h); };
  const coat = await compose(build('blues_a', 'male', 'senior', 'Capt'));
  const suit = await compose(build('flight_suit', 'male', 'senior', 'Capt'));
  const a = across(coat, 'grade:edge-right'), b = across(suit, 'grade:right');
  assert.ok(Math.abs(a - b) < 0.01, `coat ${a.toFixed(3)} in, suit ${b.toFixed(3)} in`);
  const coatM = await compose(build('blues_a', 'male', 'senior', 'Maj')), suitM = await compose(build('flight_suit', 'male', 'senior', 'Maj'));
  assert.ok(Math.abs(across(coatM, 'grade:edge-right') - across(suitM, 'grade:right')) < 0.01, 'a leaf is squeezed the same way');
});

test('nothing the grade lies on or beside is covered: it keeps clear of the collar, the name tag, the command patch, the pockets and the sleeve, on both suits (F4)', async () => {
  for(const suit of SUITS){
    const spec = await ST.load(suit.garment);
    const collars = ['collar-left', 'collar-right'].map(n => sheetPath(suit.garment, n, spec));
    const zones = ['name_tape', 'patch_command_right_breast', 'es_patch_zone'].map(n => { const r = core.landmarkBounds(spec, n); return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }]; })
      .concat(['chest_pocket_left', 'chest_pocket_right'].map(n => spec.landmarks[n].points));
    for(const rank of RANKS){
      for(const gender of ['male', 'female']){
        const scene = await compose(build(suit.uniform, gender, 'senior', rank));
        for(const side of ['right', 'left']){
          const q = corners(scene.layers.find(x => x.key === 'grade:' + side)), f = await lineOf(suit.garment, side);
          for(const poly of collars) assert.ok(gap(q, poly) > 0.1, `${suit.name} ${gender} ${rank} ${side}: ${gap(q, poly).toFixed(3)} in from the collar`);
          for(const poly of zones) assert.ok(gap(q, poly) > 0.5, `${suit.name} ${gender} ${rank} ${side}: clear of the name tag, the command patch and the pockets`);
          // Inboard of the armhole seam: no part of the piece is over the sleeve, where the flag and the loop square are sewn.
          const seamX = f.outer.x, sign = side === 'right' ? 1 : -1;
          for(const p of q) assert.ok((p.x - seamX) * sign > 0.3, `${suit.name} ${gender} ${rank} ${side}: inboard of the seam`);
        }
      }
    }
  }
});

test('the flight jackets and everyone who wears no shoulder grade are as they were (F4)', async () => {
  // NCOs and cadets, cadet officers included, wear none on the suit (8.2.3.3, 8.3.3.3).
  for(const suit of SUITS) for(const [m, r] of [['senior', 'SMSgt'], ['cadet', 'C/SSgt'], ['cadet', 'C/Capt'], ['cadet', 'C/Col']]){
    const scene = await compose(build(suit.uniform, 'male', m, r));
    assert.equal(scene.layers.filter(l => l.role === 'grade').length, 0, `${suit.name} ${r}`);
  }
  // The jackets keep drawing the grade face-on in their zones, never along a shoulder line: they state none and the suit's rule is not called for them.
  const gradeOnStrap = P.helpers.gradeOnStrap;
  let calls = 0;
  P.helpers.gradeOnStrap = async (...a) => { calls++; return gradeOnStrap(...a); };
  try{
    for(const suit of SUITS){
      const scene = await compose(build(suit.uniform, 'male', 'senior', 'Capt', { jacket: true }));
      const jacket = scene.layers.filter(l => l.role === 'grade' && l.figure === 2);
      assert.equal(jacket.length, 2, `${suit.name} jacket: one grade on each shoulder`);
      for(const l of jacket) assert.equal(l.rotate, 0, `${suit.name} jacket: the bars stand upright in their zone`);
      const jacketSheet = scene.layers.find(l => l.role === 'garment' && l.figure === 2);
      assert.ok(!(await ST.load(jacketSheet.id)).landmarks.shoulder_line, `${jacketSheet.id} states no shoulder line`);
    }
    assert.equal(calls, 4, 'two calls a suit, none for the jackets');
  }finally{ P.helpers.gradeOnStrap = gradeOnStrap; }
});
