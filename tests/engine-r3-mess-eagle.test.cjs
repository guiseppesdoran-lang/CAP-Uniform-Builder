'use strict';
// FIX-R-OTHER-r1 review round 3: mess dress colonel eagle orientation.

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
// The edge-on mess board is the board art squeezed (layer.squeeze); `strip` is the rectangle it fills.
const edgeStrip = l => l && l.strip ? Object.assign({}, l, l.strip) : l;
const rad = d => d * Math.PI / 180;
// The centre line of the figure a layer belongs to (the second figure of a scene, the aviator shirt beside the blazer, is shifted).
const centreLine = (scene, l) => { const g = scene.layers.find(x => x.role === 'garment' && (x.figure || 1) === (l.figure || 1)); return g.x + g.w / 2; };

function corners(l){
  const o = l.origin || { x: l.x, y: l.y };
  return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, o, l.rotate || 0));
}
const centre = l => { const c = corners(l); return { x: (c[0].x + c[2].x) / 2, y: (c[0].y + c[2].y) / 2 }; };

// ---- 3. Mess dress colonel eagle: head toward the collar end, beak toward the front edge ---------------------------

test('mess dress boards: the colonel\'s eagle lies with its wings across the board, its head toward the collar end and its beak turned toward the front edge (the edge-on strip), both shoulders and both cuts (4.1.1.1.1.2, 4.1.2.1.1.2; R4)', async () => {
  const asset = JSON.parse(fs.readFileSync(path.join(root, 'images', 'insignia', 'rank-senior-colonel-bullion.spec.json'), 'utf8'));
  assert.ok(asset.size_in.w > asset.size_in.h, 'eagle art: wings across the width');
  for(const gender of ['male', 'female']){
    const scene = await compose(hb('mess_dress', gender, 'senior', 'Col'));
    for(const side of ['right', 'left']){
      const top = byKey(scene, `grade:top-${side}`), edge = edgeStrip(byKey(scene, `epaulet-edge:${side}`));
      assert.ok(top && edge, `${gender} ${side}: eagle and edge-on strip`);
      // The art's head is up and its beak hooks toward the art's left (mirrored on the wearer's right).
      const r = rad(top.rotate);
      const up = { x: Math.sin(r), y: -Math.cos(r) };                 // head direction
      const sgn = top.flipX ? 1 : -1;
      const beak = { x: sgn * Math.cos(r), y: sgn * Math.sin(r) };    // beak direction
      // Board axis toward the collar end: along the strip, away from the outer end; the strip lies toward the front.
      // The top view's board is level (DORAN5-ENG-3): its axis is horizontal; the edge-on strip lies below it, on the shoulder.
      const axis = { x: 1, y: 0 };
      const ec = centre(edge), tc = centre(top);
      const toStrip = { x: ec.x - tc.x, y: ec.y - tc.y };
      const neckEnd = side === 'right' ? 1 : -1;   // the right shoulder's collar end is at the picture's right
      const dotAxis = beak.x * axis.x + beak.y * axis.y;
      assert.ok(Math.abs(dotAxis) < 0.05, `${gender} ${side}: beak perpendicular to the board axis (${dotAxis.toFixed(3)})`);
      assert.ok(beak.x * toStrip.x + beak.y * toStrip.y > 0, `${gender} ${side}: beak points toward the strip side`);
      assert.ok(up.x * neckEnd > 0.8, `${gender} ${side}: head toward the collar end (${up.x.toFixed(2)})`);
    }
  }
});

