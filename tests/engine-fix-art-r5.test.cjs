'use strict';
// FIX-ART-r5: artwork findings of review round 5, locked on the synced sheets.
//   1. One epaulet sleeve, one colour: the edge-on strip on the shoulder and the sleeve seen from above fill the same gray / blue.
//   2. Women's mess dress: the coat ends with the jacket fronts and the skirt shows from the cummerbund's lower edge down.
//   3. Women's mess dress: the collar leaves lie over the tie tab.
//   4. Men's short-sleeve aviator shirt: the 3 1/2 in NCO chevron lies between the outline and the armhole seam.
//   5. OCP coat: the collar leaves end on the placket top symmetrically at collar_apex.

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

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const assetPath = id => path.join(root, 'images', manifest.assets.find(a => a.id === id).path);
const readSvg = id => fs.readFileSync(assetPath(id), 'utf8');
const readSpec = id => JSON.parse(fs.readFileSync(assetPath(id).replace(/\.svg$/, '.spec.json'), 'utf8'));

function build(uniform, gender, membership, rank, opt){
  return {
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: Object.assign({ headgear: 'auto' }, opt || {}), name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  };
}

// ---- 1. one sleeve, one colour -----------------------------------------------------------------------------

const bodyFill = id => (readSvg(id).match(/<(?:path|rect) id="[^"]*(?:epaulet-sleeve-(?:right|left)-body|sleeve-body|__body)"[^>]*?fill="(#[0-9a-f]{6})"/i) || [])[1];

test('the edge-on epaulet sleeve strip and the sleeve seen from above fill the same colour on every sheet that draws both (CAPR 39-1 4.1.11.1.1.1.1 / 4.1.12.2.3.1 gray, 4.1.11.1.1.1.4 / 4.1.12.2.3.4 blue, 4.2.5.1.1.1 / 4.2.5.1.1.4 aviator)', () => {
  const gray = bodyFill('rank-epaulet-sleeve-gray-captain'), blue = bodyFill('rank-epaulet-sleeve-blue-cadet-major');
  assert.equal(gray, '#5f5c5c');
  assert.equal(blue, '#142347');
  assert.equal(bodyFill('rank-epaulet-sleeve-gray-blank'), gray);
  assert.equal(bodyFill('rank-epaulet-sleeve-blue-cadet-blank'), blue);
  let n = 0;
  for(const a of manifest.assets){
    const m = a.id.match(/^garment-(?:aviator-shirt|blues-class-b-(?:shirt|blouse))-.*epaulet-sleeve-(officer|cadet-officer)$/);
    if(!m) continue;
    n++;
    assert.equal(bodyFill(a.id), m[1] === 'officer' ? gray : blue, `${a.id}: strip fill`);
  }
  assert.equal(n, 16, 'the 8 Class B and 8 aviator edge-on strip sheets');
  for(const id of ['garment-blues-class-a-coat-senior-officer', 'garment-blues-class-a-coat-general-officer', 'garment-blues-class-a-coat-female-senior-officer', 'garment-blues-class-a-coat-female-general-officer']){
    assert.equal(bodyFill(id), gray, `${id}: Class A coat strip`);
  }
});

test('the scene of a Capt and a C/Maj on the Class B shirt and the aviator shirt draws strip and top view from the sleeve assets of one colour', async () => {
  for(const [uniform, gender, mem, rank, want] of [['blues_b', 'male', 'senior', 'Capt', '#5f5c5c'], ['blues_b', 'female', 'senior', 'Capt', '#5f5c5c'], ['blues_b', 'male', 'cadet', 'C/Maj', '#142347'], ['aviator', 'female', 'senior', 'Capt', '#5f5c5c']]){
    const scene = await P.composeUniform(build(uniform, gender, mem, rank, {}), store);
    const top = scene.layers.find(l => l.role === 'epaulet-top');
    assert.ok(top, `${uniform} ${gender} ${rank}: top view`);
    assert.equal(bodyFill(top.id), want, `${uniform} ${gender} ${rank}: top view fill`);
    const strip = scene.layers.find(l => /-epaulet-sleeve-(officer|cadet-officer)$/.test(l.id || ''));
    assert.ok(strip, `${uniform} ${gender} ${rank}: strip`);
    assert.equal(bodyFill(strip.id), want, `${uniform} ${gender} ${rank}: strip fill`);
  }
});
