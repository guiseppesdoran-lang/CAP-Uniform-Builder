'use strict';
// FIX-R-OTHER-r1 review round 3: the two shoulder views from above stay mirror images.

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

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const NAME = { first: 'Pat', last: 'Doran', show: true };
const hb = (uniform, gender, membership, rank, o) => HARNESS.makeBuild(Object.assign({ uniform, gender, membership, rank, name: NAME, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } }, o || {}));
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const rad = d => d * Math.PI / 180;
// The centre line of the figure a layer belongs to (the second figure of a scene, the aviator shirt beside the blazer, is shifted).
const centreLine = (scene, l) => { const g = scene.layers.find(x => x.role === 'garment' && (x.figure || 1) === (l.figure || 1)); return g.x + g.w / 2; };

// ---- 2. Class B officers: the two shoulder views stay mirror images ---------------------------------------------

function corners(l){
  const o = l.origin || { x: l.x, y: l.y };
  return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, o, l.rotate || 0));
}
function overlap(a, b){
  for(const poly of [a, b]){
    for(let i = 0; i < poly.length; i++){
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const nx = p.y - q.y, ny = q.x - p.x;
      const proj = pts => { const v = pts.map(r => r.x * nx + r.y * ny); return [Math.min(...v), Math.max(...v)]; };
      const A = proj(a), B = proj(b);
      if(A[1] <= B[0] || B[1] <= A[0]) return false;
    }
  }
  return true;
}
const centre = l => { const c = corners(l); return { x: (c[0].x + c[2].x) / 2, y: (c[0].y + c[2].y) / 2 }; };

test('Class B and aviator shirt: the pair of shoulder views from above mirrors about the centre line, every officer, both cuts, with the cap device still clear (R7; CAPR 39-1 4.1.11.1.1.1.1, Fig 4.9, 6.2.2.2.1)', async () => {
  let slid = 0, checked = 0;
  const cases = [];
  for(const gender of ['male', 'female']){
    for(const rank of ['Capt', 'Lt Col', 'Col', 'Maj Gen']) for(const u of ['blues_b', 'aviator', 'aviator_blazer']) cases.push([u, gender, 'senior', rank]);
    cases.push(['blues_b', gender, 'cadet', 'C/Maj']);
  }
  for(const [u, gender, membership, rank] of cases){
    const scene = await compose(hb(u, gender, membership, rank));
    const R = byKey(scene, 'epaulet-top:right'), L = byKey(scene, 'epaulet-top:left');
    if(!R || !L) continue;
    // The women's aviator shirt sheet states its two epaulet frames 1.25 degrees and 0.15 in apart (art follow-up, FOLLOWUPS): not a slide.
    if(u !== 'blues_b' && gender === 'female') continue;
    const w = 2 * centreLine(scene, R), cr = centre(R), cl = centre(L);
    const label = `${u} ${gender} ${rank}`;
    assert.ok(Math.abs(cr.x + cl.x - w) < 0.01, `${label}: view centres mirror in x (${cr.x.toFixed(3)} + ${cl.x.toFixed(3)} vs ${w})`);
    assert.ok(Math.abs(cr.y - cl.y) < 0.01, `${label}: view centres level (${cr.y.toFixed(3)} vs ${cl.y.toFixed(3)})`);
    assert.equal(R.slid || null, L.slid || null, `${label}: both views slid by the same amount`);
    for(const name of ['grade']){
      const gr = byKey(scene, 'grade:top-right'), gl = byKey(scene, 'grade:top-left');
      if(gr && gl){
        const a = centre(gr), c = centre(gl);
        assert.ok(Math.abs(a.x + c.x - w) < 0.02 && Math.abs(a.y - c.y) < 0.02, `${label}: the top-view ${name} mirrors too`);
      }
    }
    for(const dev of scene.layers.filter(l => l.role === 'hat-device')){
      for(const v of [R, L]) assert.ok(!overlap(corners(v), corners(dev)), `${label}: ${v.key} clear of the cap device`);
    }
    if(R.slid) slid++;
    checked++;
  }
  assert.ok(checked >= 16 && slid >= 3, `${checked} checked, ${slid} with a slide`);
});

