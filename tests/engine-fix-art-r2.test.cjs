'use strict';
// FIX-ART-r2 review findings (engine side). One block per finding.

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

function build(uniform, gender, membership, rank, extra, opt, gradeOpt){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo(membership, rank, gradeOpt || {}), opt: Object.assign({ headgear: 'auto' }, opt || {}), name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const compose = b => P.composeUniform(b, store);

// ---- 2. Class B: the plain epaulet strap on every shirt and blouse without an epaulet sleeve ------------------

const CLASS_B = [
  ['male', '', 'garment-blues-class-b-shirt-male'], ['male', 'long', 'garment-blues-class-b-shirt-male-long'],
  ['female', '', 'garment-blues-class-b-blouse-female'], ['female', 'long', 'garment-blues-class-b-blouse-female-long']
];

test('Class B shirt and blouse: NCOs, cadet NCOs, airmen and adults without grade carry the plain epaulet strap above the shoulder cord (4.1.11.1.1, 4.1.12.2, 9.3, 9.4.1)', async () => {
  for(const [sex, sleeve, garment] of CLASS_B){
    for(const [m, r, go, cord] of [['senior', 'SMSgt', {}, null], ['cadet', 'C/SSgt', {}, 'wing'], ['cadet', 'C/AB', {}, 'wing'], ['cadet', 'C/CMSgt', {}, 'region'], ['senior', 'SM', { track: 'nco' }, null]]){
      const scene = await compose(build('blues_b', sex, m, r, { cord }, { sleeve: sleeve || 'short' }, go));
      const strap = scene.layers.find(l => l.id === `${garment}-epaulet-plain`);
      assert.ok(strap, `${garment} ${r}: plain strap drawn`);
      assert.equal(strap.role, 'garment-layer');
      if(cord){
        const c = scene.layers.find(l => /-cord-/.test(l.id || ''));
        assert.ok(c, `${garment} ${r}: cord drawn`);
        assert.ok(strap.z > c.z, `${garment} ${r}: strap (z ${strap.z}) above the cord (z ${c.z})`);
      }
      assert.equal(scene.layers.filter(l => l.role === 'epaulet-top').length, 0, `${garment} ${r}: no top-down view (no grade on the strap)`);
      assert.ok(!(scene.notes || []).some(n => /No artwork/.test(n)), `${garment} ${r}: no missing artwork`);
    }
  }
});

test('Class B shirt and blouse: officers and cadet officers wear the epaulet sleeve, not the plain strap', async () => {
  for(const [sex, sleeve, garment] of CLASS_B){
    for(const [m, r, id] of [['senior', 'Capt', 'officer'], ['cadet', 'C/Maj', 'cadet-officer']]){
      const scene = await compose(build('blues_b', sex, m, r, {}, { sleeve: sleeve || 'short' }));
      assert.ok(scene.layers.find(l => l.id === `${garment}-epaulet-sleeve-${id}`), `${garment} ${r}: sleeve`);
      assert.equal(scene.layers.filter(l => l.id === `${garment}-epaulet-plain`).length, 0, `${garment} ${r}: no plain strap under the sleeve`);
    }
  }
});

test('Class B plain strap: the layer lies on the garment sheet epaulet polygons (same box, strap inside the shoulder)', async () => {
  for(const [sex, sleeve, garment] of CLASS_B){
    const spec = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', `${garment}-epaulet-plain.spec.json`), 'utf8'));
    const base = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', `${garment}.spec.json`), 'utf8'));
    assert.deepEqual(spec.size_in, base.size_in, `${garment}: same box as the garment`);
    for(const t of ['right', 'left']){
      const lm = base.landmarks['epaulet_' + t], r = spec.landmarks['epaulet_plain_' + t];
      const xs = lm.map(p => p[0]), ys = lm.map(p => p[1]);
      assert.ok(Math.abs(r.x - Math.min(...xs)) < 1 && Math.abs(r.w - (Math.max(...xs) - Math.min(...xs))) < 1 && Math.abs(r.y - Math.min(...ys)) < 1 && Math.abs(r.h - (Math.max(...ys) - Math.min(...ys))) < 1, `${garment} ${t}: strap box = epaulet polygon box`);
    }
  }
});
