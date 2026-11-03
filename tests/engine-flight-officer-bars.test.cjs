'use strict';
// LIVE13 E125 (Doran: "having a really hard time placing the flight officer rank correctly... supposed to be placed the same as Lieutenant insignia. They should be
// rotated at 90 degrees on the collar."): the Flight Officer, Technical Flight Officer and Senior Flight Officer are bars of the lieutenants' size (0.32 x 1 in
// thread, 0.57 x 1.25 in cloth-bordered, 2 x 2 in OCP square), so on every uniform they lie where and how the 2d Lt's bar does: the same turn, size and place.
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
const UNIFORMS = ['blues_a', 'blues_b', 'mess_dress', 'semi_formal_usaf', 'aviator', 'abu', 'ocp', 'corporate_field', 'flight_suit', 'corporate_flight_suit'];
const FO = ['FO', 'TFO', 'SFO'];
const mk = (uniform, gender, rank) => HARNESS.makeBuild({ uniform, gender, membership: 'senior', rank, name: { first: 'Pat', last: 'Doran', show: true }, opt: { headgear: 'auto' } });
const gradeLayers = scene => scene.layers.filter(l => l.role === 'grade' && !/^grade:top-/.test(l.key || ''));

test('a flight officer grade has the 2d Lt bar\'s turn, centre and across-the-strap size on every uniform and both cuts (E125)', async () => {
  let n = 0;
  for(const uniform of UNIFORMS) for(const gender of ['male', 'female']){
    const ref = gradeLayers(await P.composeUniform(mk(uniform, gender, '2d Lt'), store));
    for(const rank of FO){
      const got = gradeLayers(await P.composeUniform(mk(uniform, gender, rank), store));
      const tag = `${uniform} ${gender} ${rank}`;
      assert.deepEqual(got.map(l => l.key), ref.map(l => l.key), `${tag}: the same pieces are drawn`);
      got.forEach((l, i) => {
        const r = ref[i], c = p => [p.x + p.w / 2, p.y + p.h / 2];
        assert.ok(Math.abs((l.rotate || 0) - (r.rotate || 0)) < 0.01, `${tag} ${l.key}: turned ${l.rotate} against the lieutenant's ${r.rotate}`);
        assert.ok(Math.hypot(c(l)[0] - c(r)[0], c(l)[1] - c(r)[1]) < 0.02, `${tag} ${l.key}: centre ${c(l).map(v => v.toFixed(2))} against the lieutenant's ${c(r).map(v => v.toFixed(2))}`);
        assert.ok(Math.abs(l.w - r.w) < 0.02 && Math.abs(l.h - r.h) < 0.02, `${tag} ${l.key}: ${l.w.toFixed(2)} x ${l.h.toFixed(2)} against ${r.w.toFixed(2)} x ${r.h.toFixed(2)}`);
        n++;
      });
    }
  }
  assert.ok(n > 100, `${n} pieces compared`);
});

test('the flight officers\' sleeve is drawn without its own stripes on the shoulder views, since the grade is drawn separately where the lieutenant\'s is (no rectangle at the board\'s outer end)', async () => {
  for(const uniform of ['blues_a', 'blues_b', 'aviator']) for(const rank of FO){
    const scene = await P.composeUniform(mk(uniform, 'male', rank), store);
    const sleeves = scene.layers.filter(l => /^rank-epaulet-sleeve-gray-/.test(l.id || ''));
    assert.ok(sleeves.length >= 4, `${uniform} ${rank}: the sleeve is drawn edge-on and from above on both shoulders`);
    for(const l of sleeves) assert.ok((l.hideGroups || []).includes('stripe1'), `${uniform} ${rank} ${l.key}: the art's own stripes are left off`);
  }
});

test('the flight officers\' grade on the ABU and CFU collar is turned a quarter, as the lieutenants\' bars are, and stacks along the seam', async () => {
  for(const uniform of ['abu', 'corporate_field']) for(const rank of FO){
    const scene = await P.composeUniform(mk(uniform, 'male', rank), store);
    for(const side of ['right', 'left']){
      const l = scene.layers.find(x => x.key === 'grade:' + side);
      assert.ok(l && l.rotate !== 0, `${uniform} ${rank} ${side}: turned off the horizontal (${l && l.rotate})`);
    }
  }
});
