'use strict';
// FIX-R-OTHER-r5: cadet officer board grade (edge-on vs top-down), blazer lapel over the semi-formal's miniatures,
// OCP two-badge gap from the blue edges, cadet officer grade off the ABU/CFU tactical cap.

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

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const NAME = { first: 'Pat', last: 'Doran', show: true };
const hb = (uniform, gender, membership, rank, o) => HARNESS.makeBuild(Object.assign({ uniform, gender, membership, rank, name: NAME, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } }, o || {}));
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const rad = d => d * Math.PI / 180;
const critique = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts', 'critique-builds.cjs')], { encoding: 'utf8' }));
const crit = name => { const c = critique.find(x => x.name === name); assert.ok(c, `critique build ${name}`); return HARNESS.makeBuild(c.build); };
const AIRCREW = 'AirCrew1_DB3F0FCC3650F';

// ---- 1. The same regular-size grade edge-on and from above on the Class A and the cadet semi-formal coat --------------

test('Class A and cadet semi-formal coats: a cadet officer\'s edge-on strip carries the same regular-size grade as the top-down board, as long along the strap and squeezed only across it (CAPR 39-1 4.1.5.2.1.3, 4.1.9.3.4; R7)', async () => {
  const along = (l, u) => {
    const R = rad(l.rotate || 0), c = Math.cos(R), s = Math.sin(R);
    return Math.abs(l.w * (c * u.x + s * u.y)) + Math.abs(l.h * (-s * u.x + c * u.y));
  };
  let n = 0;
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const gender of ['male', 'female']) for(const rank of ['C/2d Lt', 'C/1st Lt', 'C/Capt', 'C/Maj', 'C/Lt Col', 'C/Col']){
    const scene = await compose(hb(uniform, gender, 'cadet', rank, { badgeIds: [AIRCREW] }));
    for(const side of ['right', 'left']){
      const edge = byKey(scene, `grade:edge-${side}`), top = byKey(scene, `grade:top-${side}`);
      const label = `${uniform} ${gender} ${rank} ${side}`;
      assert.ok(edge && top, `${label}: both views carry the grade`);
      assert.match(edge.id, /-metal-regular$/, `${label}: edge-on grade is the regular size (${edge.id})`);
      assert.equal(edge.id, top.id, `${label}: one grade in both views`);
      const r = rad(edge.rotate || 0), axis = { x: -Math.sin(r), y: Math.cos(r) }, cross = { x: Math.cos(r), y: Math.sin(r) };
      assert.ok(Math.abs(along(edge, axis) - along(top, axis)) <= 0.05, `${label}: along the strap ${along(edge, axis).toFixed(3)} edge-on vs ${along(top, axis).toFixed(3)} from above`);
      assert.ok(along(edge, cross) <= 0.325, `${label}: squeezed to the 0.4 in strip (${along(edge, cross).toFixed(3)} across)`);
      n++;
    }
  }
  assert.equal(n, 48);
});

test('the blue shirt\'s epaulet sleeves keep the cadet officer\'s miniature metal grade (CAPR 39-1 4.1.6.1.4)', async () => {
  for(const gender of ['male', 'female']){
    const scene = await compose(hb('blues_b', gender, 'cadet', 'C/Maj', { badgeIds: [AIRCREW] }));
    const edge = byKey(scene, 'grade:edge-right');
    assert.ok(edge, 'edge-on grade drawn');
    assert.match(edge.id, /-metal-miniature$/);
  }
});

