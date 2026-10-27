'use strict';
// LIVE-ENGINE 2 (Ethan's screenshot, Class B cadet officer: the blue 'CAP' epaulet lies tilted across the shoulder seam and the
// collar, over the shirt): the top view of the epaulet sleeve or shoulder board lies wholly above the garment's outline, 0.1 in
// clear of it, turned along the strap as before, with its grade as far from the strap's outer end as the edge-on strip's.
// The sheets give the strap and the collar leaves as landmarks but not the silhouette (only their clip path), so the engine
// seats the view against GARMENT_TOP, the upper outline measured from the sheet's own clip path (scripts/measure-garment-outline.cjs).

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
const OUTLINE = require('../scripts/measure-garment-outline.cjs');
const { silhouette } = require('../scripts/lib-svg-ink.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const NAME = { first: 'Pat', last: 'Doe', show: true };
const hb = (uniform, gender, membership, rank, opt) => HARNESS.makeBuild({ uniform, gender, membership, rank, name: NAME, opt: Object.assign({ rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' }, opt || {}) });

const area = p => { let a = 0; for(let i = 0; i < p.length; i++){ const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; };
// The garment's whole outer silhouette from the sheet's clip path (not the engine's cut table).
const SIL = {};
const silhouetteOf = id => SIL[id] || (SIL[id] = silhouette(fs.readFileSync(path.join(root, 'images', manifest.assets.find(a => a.id === id).path), 'utf8')).sort((a, b) => area(b) - area(a))[0].map(([x, y]) => ({ x, y })));

const inside = (p, ring) => { let c = false; for(let i = 0, j = ring.length - 1; i < ring.length; j = i++){ const a = ring[i], b = ring[j]; if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
function gap(quad, poly){
  if(quad.some(p => inside(p, poly)) || poly.some(p => inside(p, quad))) return 0;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const dist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
  let d = Infinity;
  for(let i = 0; i < 4; i++){
    const a = quad[i], b = quad[(i + 1) % 4];
    for(let j = 0; j < poly.length; j++){
      const c = poly[j], e = poly[(j + 1) % poly.length];
      if(Math.sign(cross(a, b, c)) !== Math.sign(cross(a, b, e)) && Math.sign(cross(c, e, a)) !== Math.sign(cross(c, e, b))) return 0;
      d = Math.min(d, dist(a, c, e), dist(b, c, e), dist(c, a, b), dist(e, a, b));
    }
  }
  return d;
}
const corners = l => {
  const o = l.origin || { x: l.x, y: l.y };
  return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, o, l.rotate || 0));
};

// [label, uniform, gender, opt]
const CUTS = [
  ['Class B shirt, short', 'blues_b', 'male', { sleeve: 'short' }], ['Class B shirt, long', 'blues_b', 'male', { sleeve: 'long' }],
  ['Class B blouse, short', 'blues_b', 'female', { sleeve: 'short' }], ['Class B blouse, long', 'blues_b', 'female', { sleeve: 'long' }],
  ['aviator shirt, short', 'aviator', 'male', { sleeve: 'short' }], ['aviator shirt, long', 'aviator', 'male', { sleeve: 'long' }],
  ['women\'s aviator shirt, short', 'aviator', 'female', { sleeve: 'short', femaleTop: 'shirt' }], ['women\'s aviator shirt, long', 'aviator', 'female', { sleeve: 'long', femaleTop: 'shirt' }],
  ['overblouse, short', 'aviator', 'female', { sleeve: 'short', femaleTop: 'overblouse' }], ['overblouse, long', 'aviator', 'female', { sleeve: 'long', femaleTop: 'overblouse' }],
  ['Class A coat', 'blues_a', 'male', {}], ['Class A coat', 'blues_a', 'female', {}],
  ['cadet semi-formal', 'semi_formal_usaf', 'male', {}], ['cadet semi-formal', 'semi_formal_usaf', 'female', {}]
];
const GRADES = [['cadet', 'C/Maj'], ['cadet', 'C/Col'], ['senior', 'Capt'], ['senior', 'Col'], ['senior', 'Maj Gen']];

test('every cut: the top view of each epaulet or board lies wholly above the garment outline, 0.1 in clear (R7)', async () => {
  let checked = 0;
  for(const [label, uniform, gender, opt] of CUTS) for(const [m, r] of GRADES) for(const headgear of ['none', 'auto']){
    const scene = await compose(hb(uniform, gender, m, r, Object.assign({ headgear }, opt)));
    const tops = scene.layers.filter(l => l.role === 'epaulet-top');
    if(!tops.length) continue;
    const poly = silhouetteOf(scene.garment);
    for(const t of tops){
      const gp = gap(corners(t), poly);
      assert.ok(gp >= 0.1 - 1e-6, `${label} ${gender} ${r} headgear ${headgear}: ${t.key} is ${gp.toFixed(3)} in from the garment outline`);
      checked++;
    }
  }
  assert.ok(checked >= 200, `${checked} views checked`);
});

test('the two views stay level and mirrored about the centre line after the seat (R7)', async () => {
  for(const [label, uniform, gender, opt] of CUTS.filter(c => c[1] === 'blues_b' || c[1] === 'aviator')) for(const [m, r] of GRADES){
    const scene = await compose(hb(uniform, gender, m, r, Object.assign({ headgear: 'none' }, opt)));
    const R = scene.layers.find(l => l.key === 'epaulet-top:right'), L = scene.layers.find(l => l.key === 'epaulet-top:left');
    if(!R || !L) continue;
    const g = scene.layers.find(l => l.role === 'garment');
    const cr = { x: R.x + R.w / 2, y: R.y + R.h / 2 }, cl = { x: L.x + L.w / 2, y: L.y + L.h / 2 };
    // The women's aviator shirt sheet states its two epaulet frames 1.25 degrees and 0.15 in apart (art follow-up, FOLLOWUPS): not mirrored by the art.
    if(uniform === 'aviator' && gender === 'female' && opt.femaleTop !== 'overblouse') continue;
    assert.ok(Math.abs(cr.x + cl.x - g.w) < 0.02 && Math.abs(cr.y - cl.y) < 0.02, `${label} ${r}: ${JSON.stringify(cr)} ${JSON.stringify(cl)}`);
  }
});

test('the grade on the top view is as far from the strap\'s outer end as the grade on the edge-on strip (R7)', async () => {
  let checked = 0;
  for(const [label, uniform, gender, opt] of CUTS.filter(c => c[1] === 'blues_b' || c[1] === 'aviator')) for(const [m, r] of GRADES){
    const scene = await compose(hb(uniform, gender, m, r, Object.assign({ headgear: 'none' }, opt)));
    for(const side of ['right', 'left']){
      const v = scene.layers.find(l => l.key === `epaulet-top:${side}`), edge = scene.layers.find(l => l.key === `grade:edge-${side}`);
      if(!v || !edge) continue;
      const s = await store.load(v.id), ins = core.anchor(s, 'insignia_center');
      if(!ins) continue;
      const c = { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      const top = scene.layers.find(l => l.key === `grade:top-${side}`);
      const at = top ? { x: top.x + top.w / 2, y: top.y + top.h / 2 } : core.rotatePoint({ x: v.x + ins.x, y: v.y + ins.y }, c, v.rotate || 0);
      // The strip's grade lies along the strap (the sheet's epaulet landmark frame) this far from its outer end; the top view is
      // level (DORAN5-ENG-3), so its grade lies this far from the same outer end horizontally, toward the collar.
      const spec = await store.load(scene.garment);
      const f = P.helpers.frameFromPolygon({ base: { w: spec.w } }, side, spec.landmarks[`epaulet_${side}`].points);
      // The sheet's own statement of the band (epaulet_axis p1, the band's outer end, p2, its collar end), which the strip's frame is (LIVE10-9).
      const ax = spec.landmarks.epaulet_axis && spec.landmarks.epaulet_axis[side];
      if(ax && ax.p1 && ax.p2){ const o = { x: ax.p1[0] / 100, y: ax.p1[1] / 100 }, n = { x: ax.p2[0] / 100, y: ax.p2[1] / 100 }, L = Math.hypot(n.x - o.x, n.y - o.y); f.outer = o; f.axis = { x: (n.x - o.x) / L, y: (n.y - o.y) / L }; }
      const e = { x: edge.x + edge.w / 2, y: edge.y + edge.h / 2 };
      const onStrap = (e.x - f.outer.x) * f.axis.x + (e.y - f.outer.y) * f.axis.y;
      const level = (at.x - f.outer.x) * Math.sign(f.axis.x);
      const d = level - onStrap;
      assert.ok(Math.abs(d) < (spec.landmarks[`epaulet_${side}`].points.length > 8 ? 0.06 : 0.03), `${label} ${r} ${side}: the top view's grade is ${d.toFixed(3)} in along the strap from the strip's grade`);
      checked++;
    }
  }
  assert.ok(checked >= 60, `${checked} grades compared`);
});

test('the engine\'s GARMENT_TOP table is the upper outline of the current garment sheets (regenerate with scripts/measure-garment-outline.cjs after an art sync)', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  const body = /\/\/ GARMENT_TOP begin\n([\s\S]*?)\/\/ GARMENT_TOP end/.exec(src);
  assert.ok(body, 'the table is in profiles-dress.js');
  const table = new Function(body[1] + '; return GARMENT_TOP;')();
  assert.deepEqual(table, OUTLINE.compute());
  assert.equal(Object.keys(table).length, OUTLINE.IDS.length);
});
