'use strict';
// LIVE10-5 / 5b (Ethan: "on mess dress the insignia shouldn't be blue lol", "again 2 different colors between the stars"). What the grade shows on the shoulder is
// the grade asset's own paint, so two things are held where node can see them (the pixels themselves are sampled in headless Chrome by tests/bullion-browser.cjs):
//   - the view from above and the edge strip of one shoulder draw the same asset, so they cannot differ in colour by construction;
//   - every paint server an asset refers to (url(#id), href="#id") is defined inside that asset, in a namespace of its own, so that the page's per-drawing id
//     scoping (render-svg scopeIds) carries the reference with it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images/MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));

const CASES = [
  ['mess_dress', 'senior', 'Col'], ['mess_dress', 'senior', 'Brig Gen'], ['mess_dress', 'senior', 'Maj Gen'], ['mess_dress', 'senior', 'Capt'],
  ['blues_a', 'cadet', 'C/Lt Col'], ['blues_a', 'cadet', 'C/Col'], ['blues_a', 'cadet', 'C/2d Lt']
];
for(const gender of ['male', 'female']){
  for(const [uniform, membership, rank] of CASES){
    test(`${uniform} ${gender} ${rank}: the grade on the view from above and on the edge strip is the same asset on both shoulders`, async () => {
      const scene = await P.composeUniform(HARNESS.makeBuild({ uniform, gender, membership, rank, opt: { headgear: 'none' } }), store);
      for(const side of ['right', 'left']){
        const top = scene.layers.find(l => l.key === `grade:top-${side}`);
        const edge = scene.layers.find(l => l.key === `grade:edge-${side}`);
        assert.ok(top && edge, `${side}: both views carry the grade`);
        assert.equal(top.id, edge.id, `${side}: one asset on both views`);
        assert.equal(top.type, 'asset');
        assert.equal(edge.type, 'asset');
        assert.equal(Boolean(top.hideGroups && top.hideGroups.length), Boolean(edge.hideGroups && edge.hideGroups.length), `${side}: neither view hides a part of the art the other shows`);
      }
    });
  }
}

test('every paint server, clip and symbol an asset refers to is defined in that asset, under the asset\'s own id', () => {
  const bad = [];
  for(const a of manifest.assets){
    if(!/\.svg$/.test(a.path)) continue;
    const text = fs.readFileSync(path.join(ROOT, 'images', a.path), 'utf8');
    const defined = new Set([...text.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    for(const m of text.matchAll(/url\(\s*['"]?#([^)'"\s]+)/g)) if(!defined.has(m[1])) bad.push(`${a.id}: url(#${m[1]}) is not defined in the asset`);
    for(const m of text.matchAll(/href="#([^"]+)"/g)) if(!defined.has(m[1])) bad.push(`${a.id}: href #${m[1]} is not defined in the asset`);
    for(const id of defined) if(!id.startsWith(a.id + '__') && id !== a.id) bad.push(`${a.id}: id "${id}" is not namespaced with the asset's id`);
  }
  assert.deepEqual(bad.slice(0, 10), [], `${bad.length} problems`);
});
