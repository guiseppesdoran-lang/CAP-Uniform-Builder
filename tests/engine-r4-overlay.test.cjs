'use strict';
// FIX-R-OTHER-r4 item 9: the OCP overlay's labels do not collide with each other, with the patches or with the flag and AUX patch
// the sheet draws, and the patch's width is measured below the Velcro, not along the patch's bottom edge (D26).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const ML = require('../js/engine/measure-layout.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const critique = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts', 'critique-builds.cjs')], { encoding: 'utf8' }));

const overlap = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
// Length of segment p-q inside box r (the segment is axis-aligned or short in these overlays; sampled).
const crosses = (p, q, r) => { for(let i = 0; i <= 40; i++){ const t = i / 40, x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t; if(x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true; } return false; };

test('OCP overlay: no label lies over another label, a patch, the flag or AUX patch, or another dimension; no patch carries a width measure (D26, MEAS)', async () => {
  for(const name of ['ocp-male-senior-LtCol-patches-overlay', 'ocp-male-senior-LtCol-graduated-commander', 'ocp-male-cadet-CSSgt-patches']){
    const spec = critique.find(x => x.name === name);
    const b = HARNESS.makeBuild(Object.assign({}, spec.build, { opt: Object.assign({}, spec.build.opt, { overlay: true }) }));
    const scene = await P.composeUniform(b, store);
    const B = scene.bounds, vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8], px = ML.previewPx(vb), area = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    const drawings = ML.layout(scene, { px, area });
    // The sleeve patches and the pieces the sheet draws there (flat and edge-on), as the layout sees them.
    const patchLike = scene.layers.filter(l => l.role === 'patch' || (l.type === 'clear' && /patch_(flag|aux)/.test(l.key))).map(l => core.layerBounds(l));
    assert.ok(patchLike.length >= 3, `${name}: patches and the drawn flag or AUX patch are obstacles`);
    drawings.forEach((d, i) => {
      for(const s of patchLike) assert.ok(overlap(d.label, s) < 0.05, `${name}: ${d.label.text} label lies over a patch or the flag/AUX at ${s.x.toFixed(2)},${s.y.toFixed(2)}`);
      drawings.slice(i + 1).forEach(e => {
        assert.equal(overlap(d.label, e.label), 0, `${name}: ${d.label.text} and ${e.label.text} labels apart`);
        assert.ok(!crosses(e.dim[0], e.dim[1], d.label), `${name}: a dimension runs over the ${d.label.text} label`);
        assert.ok(!crosses(d.dim[0], d.dim[1], e.label), `${name}: a dimension runs over the ${e.label.text} label`);
      });
    });
    // D8 (Ethan, MEAS: "the 2x2 square isn't needed (you just buy it from Vanguard)"): a patch's width is the size it is bought in,
    // not a distance the member sets, so the sleeve patches carry no width measure (the test held the 3 1/2 in line below the Velcro).
    assert.equal(scene.layers.filter(l => l.type === 'measure' && l.label === '3½ in').length, 0, `${name}: no patch width`);
  }
});
