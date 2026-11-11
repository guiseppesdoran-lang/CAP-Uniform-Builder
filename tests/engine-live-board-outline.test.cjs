'use strict';
// B5 again (Ethan, 2026-11-10, looking at the first B5 pictures: "looking at some of the after photos theres some coat blue above the board"): the cadet officer's edge-on board lies on the very top of the
// shoulder. Its straight upper edge lies on the coat's own upper outline, the outer edge of the outline's stroke, along its whole length, so no coat shows above it and no background shows between the board
// and the coat. Measured here against the coat sheets' own outline (scripts/measure-garment-outline.cjs, the sheet's silhouette path): the outline is drawn with a stroke 0.06 in wide, half of it outside the
// path, so the drawn coat is the outline grown by 0.03 in. At each station along the board's straight upper edge, `above` is how far the drawn coat reaches over the edge, up the board's normal (coat blue
// above the board), and `over` how far the edge stands above the drawn coat (the board over the background).
//   Men's coats: the shoulder line is one straight run, so the edge is on it: both are zero (to a hair's breadth, 0.01 in: the outline table is simplified to 0.01 in).
//   Women's coats: the shoulder line bends, 0.1 in above the straight seam 1.4 in from the shoulder point, so a straight board cannot lie on it everywhere: the board's edge is on the seam (the bend's ends)
//   and the coat shows above it where the line bends; nothing stands over the background. The owner chooses how the bend is met (tests below pin the numbers).

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
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

const COATS = { blues_a: { male: 'garment-blues-class-a-coat', female: 'garment-blues-class-a-coat-female' }, semi_formal_usaf: { male: 'garment-semiformal-class-a-coat-male', female: 'garment-semiformal-class-a-coat-female' } };
const svgOf = id => fs.readFileSync(path.join(root, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');
// The sheets' outline stroke: the coat body's silhouette path carries `stroke-width`; half of it lies outside the path.
const strokeOf = id => Number(new RegExp(`id="${id}__silhouette"[^>]*?stroke-width="([\\d.]+)"|stroke-width="([\\d.]+)"[^>]*?id="${id}__silhouette"`).exec(svgOf(id)).slice(1).find(Boolean));

const inPoly = (poly, p) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if((a[1] > p.y) !== (b[1] > p.y) && p.x < (b[0] - a[0]) * (p.y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const distToRing = (poly, p) => {
  let best = Infinity;
  for(let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy));
  }
  return best;
};
const drawnCoat = (ring, p, half) => inPoly(ring, p) || distToRing(ring, p) <= half;

// The board body (the board sheets' __board-body path, 0.1 in in from the sheet's edge) mapped through the placed layer: vertex 0 the outer end's upper corner, vertex 1 where the pointed neck end begins.
const BODY = { right: [[0, 0], [3.81, 0]], left: [[4.55, 0], [0.74, 0]] };
const edgeOf = (l, side) => BODY[side].map(([bx, by]) => core.rotatePoint({ x: l.x + (bx + 0.1) * l.w / 4.75, y: l.y + (by + 0.1) * l.h / 2.5 }, l.origin, l.rotate || 0));

// { above, over }: the largest of each along the straight upper edge, in inches.
function measure(ring, layer, side, half){
  const [a, b] = edgeOf(layer, side), len = Math.hypot(b.x - a.x, b.y - a.y), u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  let n = { x: u.y, y: -u.x }; if(n.y > 0) n = { x: -n.x, y: -n.y };
  let above = 0, over = 0;
  for(let s = 0; s <= len + 1e-9; s += 0.02){
    const p = { x: a.x + u.x * s, y: a.y + u.y * s };
    if(drawnCoat(ring, p, half)){ let t = 0; while(t < 1.5 && drawnCoat(ring, { x: p.x + n.x * (t + 0.002), y: p.y + n.y * (t + 0.002) }, half)) t += 0.002; above = Math.max(above, t); }
    else { let t = 0; while(t < 1.5 && !drawnCoat(ring, { x: p.x - n.x * (t + 0.002), y: p.y - n.y * (t + 0.002) }, half)) t += 0.002; over = Math.max(over, t); }
  }
  return { above, over, len };
}

const hb = (uniform, gender, rank) => HARNESS.makeBuild({ uniform, gender, membership: 'cadet', rank, opt: { headgear: 'none' } });
const RINGS = OUTLINE.compute();

test('the coat sheets\' outline is stroked 0.06 in, half of it outside the path the board is fitted to', () => {
  for(const uniform of Object.keys(COATS)) for(const sex of ['male', 'female']) assert.equal(strokeOf(COATS[uniform][sex]), 0.06, `${COATS[uniform][sex]}: the silhouette's stroke width`);
});

for(const uniform of Object.keys(COATS)) for(const sex of ['male', 'female']) for(const rank of ['C/2d Lt', 'C/Col']){
  test(`${uniform} ${sex} ${rank}: the board's upper edge lies on the coat's drawn outline, ${sex === 'male' ? 'the whole length: no coat above it, no background between' : 'no background between the board and the coat; the coat shows above it only where the shoulder line bends'}`, async () => {
    const scene = await P.composeUniform(hb(uniform, sex, rank), store);
    const id = COATS[uniform][sex], ring = RINGS[id], half = strokeOf(id) / 2;
    for(const side of ['right', 'left']){
      const strip = scene.layers.find(l => l.key === 'epaulet:' + side);
      assert.ok(strip, `${side}: the edge-on board is drawn`);
      const m = measure(ring, strip, side, half);
      assert.ok(Math.abs(m.len - 3.81) < 0.01, `${side}: the straight upper edge is the board's 3.81 in (${m.len.toFixed(3)})`);
      assert.ok(m.over <= 0.01, `${side}: the board's edge stands ${m.over.toFixed(3)} in above the drawn coat (background between the board and the coat)`);
      if(sex === 'male') assert.ok(m.above <= 0.01, `${side}: ${m.above.toFixed(3)} in of coat shows above the board`);
      // the women's shoulder line bends 0.108 in (0.096 on the wearer's left) above the straight seam; the coat above the edge is that bend, and nothing more
      else assert.ok(m.above <= 0.115, `${side}: ${m.above.toFixed(3)} in of coat shows above the board (the bend is 0.108 in)`);
    }
  });
}
