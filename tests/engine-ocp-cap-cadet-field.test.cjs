'use strict';
// CAPR 39-1 7.1.1.8 (Tactical and Patrol OCP Caps): officers and cadet officers wear "sewn or Velcro® rank insignia centered, 1/2 inch from the visor, on the
// front of caps", with "only 1/8th inch of blue fabric showing past the widest and tallest part of the insignia". b78a4271 turned every cadet officer's art a
// quarter on the OCP chest square AND the caps, which laid a C/Maj's diamond with its long points across on the cap (Ethan: "this is incorrect. flip it 90").
// The cap carries the cadet FIELD grades as the art is drawn: each diamond's long points vertical, the C/Lt Col's two and the C/Col's three side by side in one
// horizontal row, centred on the cap's line, the blue showing 1/8 in past the widest and the tallest point (sewn) or the row inside the 2 x 2 in square (Velcro).
// The company grades' discs keep the vertical stack b78a4271 gave them (it fits the square). The OCP chest square is as b78a4271 left it (7.1.1.2.2).
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
const R = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(4)} vs ${b.toFixed(4)}`);

const base = R.matrix().builds.find(x => x.name === 'ocp-male-senior-Capt').build;
const build = (rank, headgear, capGrade) => R.makeBuild(Object.assign(JSON.parse(JSON.stringify(base)), { membership: 'cadet', rank, opt: Object.assign({}, base.opt, { headgear }, capGrade ? { capGrade } : {}) }));
const ZONE = { auto: 'patrol_cap_front_insignia_zone', tactical: 'baseball_cap_front_insignia_zone' };
const FIELD = { 'C/Maj': 1, 'C/Lt Col': 2, 'C/Col': 3 };
const EIGHTH = 0.125;

// The diamonds of an asset's art in its own units (0.01 in): the polygons' bounding boxes, left to right.
function diamonds(id){
  const svg = fs.readFileSync(path.join(root, 'images', 'insignia', id + '.svg'), 'utf8');
  const vbw = Number(/viewBox="0 0 ([\d.]+) /.exec(svg)[1]);
  const out = [...svg.matchAll(/<polygon points="([^"]+)"/g)].map(m => {
    const pts = m[1].trim().split(/\s+/).map(s => s.split(',').map(Number));
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }).sort((a, b) => a.x0 - b.x0);
  out.vbw = vbw;
  return out;
}

for(const rank of Object.keys(FIELD)){
  for(const headgear of ['auto', 'tactical']){
    for(const capGrade of [null, 'square']){
      test(`OCP ${rank}, ${headgear === 'auto' ? 'patrol' : 'tactical'} cap, ${capGrade ? '2 x 2 in Velcro square' : 'sewn'}: diamonds long points vertical, one centred row, 1/2 in from the visor, 1/8 in of blue`, async () => {
        const scene = await P.composeUniform(build(rank, headgear, capGrade), store);
        const key = 'grade:' + ZONE[headgear];
        const layer = scene.layers.find(l => l.key === key);
        assert.equal(layer.rotate || 0, 0, 'not turned');
        const art = diamonds(layer.id), u = layer.w / art.vbw;   // inches per user unit of the piece as placed
        assert.equal(art.length, FIELD[rank], 'one diamond per grade');
        const d = art.map(q => ({ x0: layer.x + q.x0 * u, x1: layer.x + q.x1 * u, y0: layer.y + q.y0 * u, y1: layer.y + q.y1 * u }));
        d.forEach((q, i) => assert.ok(q.y1 - q.y0 > q.x1 - q.x0 + 0.05, `diamond ${i + 1}: long axis vertical (${(q.x1 - q.x0).toFixed(3)} wide x ${(q.y1 - q.y0).toFixed(3)} tall in)`));
        // One horizontal row: the same top and bottom, side by side, no overlap beyond touching points.
        d.forEach(q => { near(q.y0, d[0].y0, 1e-6, 'row top'); near(q.y1, d[0].y1, 1e-6, 'row bottom'); });
        d.slice(1).forEach((q, i) => assert.ok(q.x0 >= d[i].x1 - 1e-6 - (d[i].x1 - d[i].x0), `diamond ${i + 2} to the right of ${i + 1}`));
        const row = { x0: d[0].x0, x1: d[d.length - 1].x1, y0: d[0].y0, y1: d[0].y1 };
        // 1/2 in from the visor, measured; centred on the cap's line.
        const bottom = layer.y + layer.h;
        const half = scene.layers.find(l => l.type === 'measure' && l.label === '½ in' && Math.abs(l.to.y - bottom) < 1e-6);
        assert.ok(half, 'the 1/2 in from the visor ends at the piece\'s lower edge');
        near((row.x0 + row.x1) / 2, half.to.x, 0.005, 'the row is centred on the cap\'s line');
        near(layer.x + layer.w / 2, half.to.x, 1e-6, 'the piece is centred on the cap\'s line');
        if(!capGrade){
          // Sewn: the cloth shows exactly 1/8 in past the widest (row) and tallest (diamond) points, all round.
          near(row.x0 - layer.x, EIGHTH, 0.005, 'blue left of the widest point'); near(layer.x + layer.w - row.x1, EIGHTH, 0.005, 'blue right of the widest point');
          near(row.y0 - layer.y, EIGHTH, 0.005, 'blue above the tallest point'); near(bottom - row.y1, EIGHTH, 0.005, 'blue below the tallest point');
          const m = scene.layers.find(l => l.type === 'measure' && l.label === '⅛ in' && l.from.y >= layer.y - 1e-6 && l.from.y <= bottom + 1e-6);
          assert.ok(m && Math.abs(m.from.y - layer.y) < 1e-6 && Math.abs(m.to.y - (layer.y + EIGHTH)) < 0.005, 'the 1/8 in measure runs across the top border');
        }else{
          // Velcro: the 2 x 2 in square; the row inside it with at least 1/8 in all round (the C/Col's row is exactly 1/8 in from each side).
          const f = scene.layers.find(l => l.key === 'grade-field:' + ZONE[headgear]).obstacle;
          near(f.w, 2, 1e-6, 'square width'); near(f.h, 2, 1e-6, 'square height');
          near(f.y + f.h, bottom, 1e-6, 'the square\'s lower edge is the 1/2 in measure\'s end');
          assert.ok(row.x0 - f.x >= EIGHTH - 0.005 && f.x + f.w - row.x1 >= EIGHTH - 0.005, 'at least 1/8 in of blue left and right of the row');
          assert.ok(row.y0 - f.y >= EIGHTH && f.y + f.h - row.y1 >= EIGHTH, 'at least 1/8 in of blue above and below the diamonds');
          if(rank === 'C/Col') near(row.x0 - f.x, EIGHTH, 0.005, 'the three diamonds span the square to 1/8 in');
        }
      });
    }
  }
}

test('the cap\'s company grades keep the vertical stack of discs and it fits the 2 x 2 in square; the chest square is unchanged, turned a quarter (7.1.1.2.2)', async () => {
  const sg = await store.load('garment-ocp-coat-abu-cut');
  const sq = core.landmarkBounds(sg, 'rank_square');
  for(const [rank, n] of [['C/2d Lt', 1], ['C/1st Lt', 2], ['C/Capt', 3], ['C/Maj', 1], ['C/Lt Col', 2], ['C/Col', 3]]){
    for(const capGrade of [null, 'square']){
      const scene = await P.composeUniform(build(rank, 'auto', capGrade), store);
      const cap = scene.layers.find(l => l.key === 'grade:patrol_cap_front_insignia_zone');
      if(rank in FIELD) continue;
      assert.equal(cap.rotate, 90, `${rank}: discs turned to a vertical stack on the cap`);
      const b = core.layerBounds(cap);
      if(!capGrade) assert.ok(b.h > b.w || n === 1, `${rank}: the stack stands vertical (${b.w} x ${b.h})`);
      if(capGrade){
        // The stack of the square's art: n discs 0.5833 in across in a 2 in square, 1/8 in clear of its edge at the C/Capt's three.
        near(b.w, 2, 1e-6, 'square'); near(b.h, 2, 1e-6, 'square');
        assert.ok(n * 0.5833 <= 2 - 2 * EIGHTH + 0.001, `${rank}: the stack of ${n} discs (0.5833 in each) fits the square with 1/8 in clear`);
      }
    }
    const scene = await P.composeUniform(build(rank, 'auto'), store);
    const chest = scene.layers.find(l => l.key === 'grade:chest');
    assert.equal(chest.rotate, 90, `${rank}: the chest piece stays turned a quarter`);
    const cb = core.layerBounds(chest);
    near(cb.x + cb.w / 2, sq.x + sq.w / 2, 0.01, `${rank}: chest centred across the square`); near(cb.y + cb.h / 2, sq.y + sq.h / 2, 0.01, `${rank}: chest centred down the square`);
    near(cb.w, 2, 1e-6, 'chest art box'); near(cb.h, 2, 1e-6, 'chest art box');
    // The diamonds, turned, lie with their long points horizontal and stack vertically.
    if(rank in FIELD){
      const ds = diamonds(chest.id);
      assert.equal(ds.length, FIELD[rank]);
      ds.forEach(d => assert.ok(d.y1 - d.y0 > d.x1 - d.x0, `${rank}: drawn long vertical, so turned they lie long horizontal`));
    }
  }
});
