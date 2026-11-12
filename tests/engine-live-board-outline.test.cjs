'use strict';
// B5 again (Ethan, 2026-11-10, looking at the first B5 pictures: "looking at some of the after photos theres some coat blue above the board"): the cadet officer's edge-on board lies on the very top of the
// shoulder. Seen from the front it lies over the ridge of the shoulder, so its upper edge is the coat's own upper outline (the outer edge of the outline's stroke) along its whole length, to the tip of the
// pointed neck end, and the point narrows from the lower edge only: no coat shows above the board and no background shows between the board and the coat.
// Measured here against the coat sheets' own outline (scripts/measure-garment-outline.cjs, the sheet's silhouette path): the outline is drawn with a stroke 0.06 in wide, half of it outside the path, so the
// drawn coat is the outline grown by 0.03 in. At each station along the board (outer end to tip, 4.55 in) `above` is how far the drawn coat reaches over the board's visible top (coat blue above the board)
// and `over` how far the board's visible top stands above the drawn coat (the board over the background), both along the board's up normal. The board's visible top is read from the drawn layers: the board
// sheet's body mapped through each placed layer (the straight part and the sheared pointed end) and cut to the layer's clip.
//   Men's coats: the shoulder line is one straight run, so the board's straight upper edge is on it.
//   Women's coats: the shoulder line bends 0.1 in above the straight seam 1.4 in from the shoulder point, so the board's edge stands higher and the board is cut to the drawn outline (option D of the owner's choice).
// Both are zero to a hair's breadth, 0.01 in (the outline table is simplified to 0.01 in).

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

// The board body (the board sheets' __board-body path, 0.1 in in from the sheet's edge), in the sheet's own inches: the right board's outer end is on the left, the left board's on the right; the pointed neck end is 0.74 in.
const BODY = { right: [[0, 0], [3.81, 0], [4.55, 1.15], [3.81, 2.3], [0, 2.3]], left: [[4.55, 0], [0.74, 0], [0, 1.15], [0.74, 2.3], [4.55, 2.3]] };
const TIP = { right: [4.55, 1.15], left: [0, 1.15] }, OUTER_TOP = { right: [0, 0], left: [4.55, 0] }, POINT_TOP = { right: [3.81, 0], left: [0.74, 0] };
// A point of the board sheet (art inches) in the scene: through the layer's placement (turn about its origin) and its shear, if it has one.
function toScene(l, [bx, by]){
  let p = core.rotatePoint({ x: l.x + (bx + 0.1) * l.w / 4.75, y: l.y + (by + 0.1) * l.h / 2.5 }, l.origin, l.rotate || 0);
  if(l.shear){
    const q = l.shear, r = q.deg * Math.PI / 180, e = { x: Math.cos(r), y: Math.sin(r) }, d = { x: -e.y, y: e.x }, v = { x: p.x - q.at.x, y: p.y - q.at.y };
    const x = v.x * e.x + v.y * e.y, y = v.x * d.x + v.y * d.y + q.b * x;
    p = { x: q.at.x + e.x * x + d.x * y, y: q.at.y + e.y * x + d.y * y };
  }
  return p;
}
const polyOf = pts => pts.map(p => [p.x, p.y]);
// { above, over } the largest of each over the stations from the outer end to the tip, and the tip's distance from the board's upper edge line.
function measure(ring, layers, side, half){
  const parts = layers.map(l => ({ l, body: polyOf(BODY[side].map(b => toScene(l, b))), clip: l.clip ? polyOf(l.clip) : null }));
  const visible = p => parts.some(q => inPoly(q.body, p) && (!q.clip || inPoly(q.clip, p)));
  const a0 = toScene(layers[0], OUTER_TOP[side]), tip = toScene(layers[layers.length - 1], TIP[side]);
  // the straight upper edge's line, from the outer end to where the point begins; the tip's distance from that line, and the board's length along it
  const a1 = toScene(layers[0], POINT_TOP[side]), el = Math.hypot(a1.x - a0.x, a1.y - a0.y), u = { x: (a1.x - a0.x) / el, y: (a1.y - a0.y) / el };
  let n = { x: u.y, y: -u.x }; if(n.y > 0) n = { x: -n.x, y: -n.y };
  const tipOff = Math.abs((tip.x - a0.x) * n.x + (tip.y - a0.y) * n.y), len = (tip.x - a0.x) * u.x + (tip.y - a0.y) * u.y;
  let above = 0, over = 0, worst = {};
  for(let s = 0.02; s <= len - 0.03; s += 0.02){
    const p = { x: a0.x + u.x * s, y: a0.y + u.y * s };
    // scan down the normal from 0.6 in above the edge line to 0.7 below it: the first visible point of the board, the first drawn point of the coat
    let tb = null, tc = null;
    for(let t = 0.6; t >= -0.7 && (tb === null || tc === null); t -= 0.002){
      const q = { x: p.x + n.x * t, y: p.y + n.y * t };
      if(tb === null && visible(q)) tb = t;
      if(tc === null && drawnCoat(ring, q, half)) tc = t;
    }
    if(tb === null || tc === null) continue;
    if(tc - tb > above){ above = tc - tb; worst.above = s; }
    if(tb - tc > over){ over = tb - tc; worst.over = s; }
  }
  return { above, over, len, tipOff, worst };
}

const hb = (uniform, gender, rank) => HARNESS.makeBuild({ uniform, gender, membership: 'cadet', rank, opt: { headgear: 'none' } });
const RINGS = OUTLINE.compute();

test('the coat sheets\' outline is stroked 0.06 in, half of it outside the path the board is fitted to', () => {
  for(const uniform of Object.keys(COATS)) for(const sex of ['male', 'female']) assert.equal(strokeOf(COATS[uniform][sex]), 0.06, `${COATS[uniform][sex]}: the silhouette's stroke width`);
});

for(const uniform of Object.keys(COATS)) for(const sex of ['male', 'female']) for(const rank of ['C/2d Lt', 'C/Col']){
  test(`${uniform} ${sex} ${rank}: the board's upper edge is the coat's drawn outline from the outer end to the tip: no coat above it, no background between, and the point narrows from the lower edge only`, async () => {
    const scene = await P.composeUniform(hb(uniform, sex, rank), store);
    const id = COATS[uniform][sex], ring = RINGS[id], half = strokeOf(id) / 2;
    for(const side of ['right', 'left']){
      const layers = scene.layers.filter(l => l.key === 'epaulet:' + side || l.key === 'epaulet-tip:' + side);
      assert.ok(layers.length >= 1, `${side}: the edge-on board is drawn`);
      const m = measure(ring, layers, side, half);
      assert.ok(Math.abs(m.len - 4.55) < 0.02, `${side}: the board is its 4.55 in long (${m.len.toFixed(3)})`);
      assert.ok(m.tipOff <= 0.005, `${side}: the tip lies ${m.tipOff.toFixed(3)} in off the upper edge line (the point narrows from the lower edge only)`);
      assert.ok(m.over <= 0.01, `${side}: the board stands ${m.over.toFixed(3)} in above the drawn coat at ${m.worst.over} in (background between the board and the coat)`);
      assert.ok(m.above <= 0.01, `${side}: ${m.above.toFixed(3)} in of coat shows above the board at ${m.worst.above} in`);
      assert.equal(layers.length, 2, `${side}: the board is its straight part and its sheared pointed end`);
      assert.ok(layers[1].shear && layers[1].clip, `${side}: the pointed end is cut at the point's start and sheared`);
    }
  });
}
