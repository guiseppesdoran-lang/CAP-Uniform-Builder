'use strict';
// FIX-R-OTHER-r1 review round 3: edge-on epaulet grades keep their length along the strap.

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

// ---- 5. Edge-on epaulet grade: foreshortened across the strap, true length along it ----------------------------------

test('edge-on epaulet grades keep their true length along the strap and are squeezed only across it (the strip keeps its length and is squeezed across); the colonel\'s eagle is as long on the strip as on the top view (R7; CAPR 39-1 4.2.5.1.1.1, 4.2.6.2.1; DAFI 36-2903 4.5.1.1.1)', async () => {
  const along = (l, u) => {
    const R = rad(l.rotate || 0), c = Math.cos(R), s = Math.sin(R);
    return Math.abs(l.w * (c * u.x + s * u.y)) + Math.abs(l.h * (-s * u.x + c * u.y));
  };
  let compared = 0, edgeOnly = 0;
  const cases = [];
  for(const gender of ['male', 'female']){
    for(const u of ['aviator', 'aviator_blazer', 'blues_b']) for(const rank of ['Capt', 'Maj', 'Lt Col', 'Col', 'Maj Gen']) cases.push([u, gender, 'senior', rank]);
    cases.push(['blues_b', gender, 'cadet', 'C/Maj'], ['blues_b', gender, 'cadet', 'C/Col']);
  }
  for(const [u, gender, membership, rank] of cases){
    const scene = await compose(hb(u, gender, membership, rank));
    for(const side of ['right', 'left']){
      const edge = byKey(scene, `grade:edge-${side}`), top = byKey(scene, `grade:top-${side}`), view = byKey(scene, `epaulet-top:${side}`);
      if(!edge || !view) continue;
      const label = `${u} ${gender} ${rank} ${side}`;
      // The strap axis: the view's long side, turned by its rotation.
      const r = rad(view.rotate || 0);
      const axis = { x: -Math.sin(r), y: Math.cos(r) }, cross = { x: Math.cos(r), y: Math.sin(r) };
      assert.ok(along(edge, cross) <= 0.32 + 0.005 || along(edge, axis) >= along(edge, cross), `${label}: edge-on grade fits the 0.4 in strip (${along(edge, cross).toFixed(3)} across)`);
      assert.ok(along(edge, cross) <= 0.32 + 0.005, `${label}: squeezed to the strip (${along(edge, cross).toFixed(3)} across)`);
      if(top){
        assert.ok(Math.abs(along(edge, axis) - along(top, axis)) < 0.01, `${label}: edge-on length ${along(edge, axis).toFixed(3)} equals the top view's ${along(top, axis).toFixed(3)}`);
        compared++;
      }else edgeOnly++;
      if(rank === 'Col' && membership === 'senior') assert.ok(along(edge, axis) > 0.6, `${label}: the eagle is ${along(edge, axis).toFixed(3)} in long on the strip, not a speck`);
    }
  }
  assert.ok(compared >= 6, `${compared} edge/top pairs compared (${edgeOnly} grades with the edge view only)`);
});
