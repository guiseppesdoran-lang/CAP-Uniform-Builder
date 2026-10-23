'use strict';
// FINAL fix 3: the grade on the front of the caps, per grade class. CAPR 39-1 ICL 25-02 6.2.11.1: NCOs and cadets
// wear no insignia on the patrol or tactical cap, only a nametape on the back; the parent 6.2.11 and 5.1.1.6 name
// cadet officers, and 6.2.11.1 (the paragraph written for the navy tactical cap) wins for that cap, as in
// FIX-R-OTHER-r5 #4. The OCP caps follow 7.1.1.8: officers and cadet officers wear grade, NCOs, cadet NCOs and
// airmen none.

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
const hb = (uniform, gender, membership, rank) => HARNESS.makeBuild({ uniform, gender, membership, rank, name: NAME, badgeIds: [], opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } });
const capGrades = scene => scene.layers.filter(l => /^grade:(patrol|baseball|boonie)_/.test(l.key || '')).map(l => l.key.replace(/^grade:/, '').replace(/_front_insignia_zone$/, '')).sort();

const CLASSES = [
  ['cadet officer', 'cadet', ['C/2d Lt', 'C/Maj', 'C/Col']],
  ['cadet NCO', 'cadet', ['C/Amn', 'C/SSgt', 'C/CMSgt']],
  ['cadet airman basic', 'cadet', ['C/AB']],
  ['senior NCO', 'senior', ['SSgt', 'SMSgt', 'CMSgt']],
  ['senior officer', 'senior', ['2d Lt', 'Capt', 'Maj', 'Col', 'Maj Gen']]
];

for(const uniform of ['abu', 'corporate_field', 'ocp']){
  for(const gender of ['male', 'female']){
    test(`${uniform} ${gender}: grade on the cap fronts per grade class (ICL 25-02 6.2.11.1, 5.1.1.6, 7.1.1.8)`, async () => {
      const reference = capGrades(await compose(hb(uniform, gender, 'senior', 'Capt')));
      assert.ok(reference.length >= 1, `${uniform} ${gender}: a senior officer wears grade on at least one cap`);
      let checked = 0;
      for(const [label, membership, ranks] of CLASSES){
        for(const rank of ranks){
          const scene = await compose(hb(uniform, gender, membership, rank));
          const got = capGrades(scene);
          let want;
          if(/NCO|airman basic/.test(label)) want = [];
          else if(label === 'cadet officer') want = uniform === 'ocp' ? reference : reference.filter(z => z !== 'baseball_cap');
          else want = reference;
          assert.deepEqual(got, want, `${uniform} ${gender} ${rank} (${label}): grade on ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
          checked++;
        }
      }
      assert.equal(checked, 15);
    });
  }
}

test('the ABU and the CFU: a cadet officer\'s scene says why the tactical cap front is bare (ICL 25-02 6.2.11.1); no other class gets that note', async () => {
  for(const uniform of ['abu', 'corporate_field']){
    const cadet = await compose(hb(uniform, 'male', 'cadet', 'C/Maj'));
    assert.ok(cadet.notes.some(n => /6\.2\.11\.1/.test(n)), `${uniform}: cadet officer`);
    for(const [membership, rank] of [['cadet', 'C/SSgt'], ['senior', 'Capt'], ['senior', 'SMSgt']]){
      const s = await compose(hb(uniform, 'male', membership, rank));
      assert.ok(!s.notes.some(n => /6\.2\.11\.1/.test(n)), `${uniform} ${rank}: no tactical cap note`);
    }
  }
});
