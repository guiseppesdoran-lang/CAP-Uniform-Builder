'use strict';
// FINAL fix 3, revised by LIVE-ENGINE 4: the grade on the front of the caps, per grade class. CAPR 39-1 ICL 25-02 contradicts itself
// on the navy tactical cap of the ABU and CFU: 6.2.11 has cadet officers wear grade on dark blue cloth centred on the front,
// 6.2.11.1 has NCOs and cadets wear no insignia. Ethan's ruling: cadet OFFICERS wear it (the ABU collar's cloth-bordered piece,
// centred 1/2 in above the visor like the officers'), cadet NCOs and airmen do not. The ABU patrol cap (5.1.1.6) and the OCP caps
// (7.1.1.8: officers and cadet officers; NCOs, cadet NCOs and airmen none) already followed that split.

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

// One cap is drawn (LIVE-ENGINE 3): its zone is the only one that can carry a grade, so each cap a uniform offers is tried in turn.
const CAPS = uniform => uniform === 'corporate_field' ? ['auto', 'tactical', 'boonie'] : ['auto', 'tactical'];
const hb2 = (uniform, gender, membership, rank, headgear) => HARNESS.makeBuild({ uniform, gender, membership, rank, name: NAME, badgeIds: [], opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting', headgear } });
const ZONE = { auto: 'patrol_cap_front_insignia_zone', tactical: 'baseball_cap_front_insignia_zone', boonie: 'boonie_hat_front_insignia_zone' };

for(const uniform of ['abu', 'corporate_field', 'ocp']){
  for(const gender of ['male', 'female']){
    for(const headgear of CAPS(uniform)){
      test(`${uniform} ${gender} ${headgear}: grade on the cap front per grade class (ICL 25-02 6.2.11.1, 5.1.1.6, 7.1.1.8)`, async () => {
        const reference = capGrades(await compose(hb2(uniform, gender, 'senior', 'Capt', headgear)));
        assert.deepEqual(reference, [ZONE[headgear].replace(/_front_insignia_zone$/, '')], `${uniform} ${gender} ${headgear}: a senior officer wears grade on the one cap drawn`);
        let checked = 0;
        for(const [label, membership, ranks] of CLASSES){
          for(const rank of ranks){
            const scene = await compose(hb2(uniform, gender, membership, rank, headgear));
            const got = capGrades(scene);
            let want;
            if(/NCO|airman basic/.test(label)) want = [];
            else if(label === 'cadet officer') want = reference;
            else want = reference;
            assert.deepEqual(got, want, `${uniform} ${gender} ${headgear} ${rank} (${label}): grade on ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
            checked++;
          }
        }
        assert.equal(checked, 15);
      });
    }
  }
}

test('the ABU and the CFU: a cadet officer on the navy tactical cap gets the grade and a note on the ICL\'s two paragraphs (6.2.11, 6.2.11.1); no other class, and no other cap, gets that note', async () => {
  for(const uniform of ['abu', 'corporate_field']){
    for(const rank of ['C/2d Lt', 'C/Maj', 'C/Col']){
      const cadet = await compose(hb2(uniform, 'male', 'cadet', rank, 'tactical'));
      assert.ok(cadet.notes.some(n => /6\.2\.11\.1/.test(n) && /6\.2\.11 /.test(n)), `${uniform} ${rank}: note cites 6.2.11 and 6.2.11.1`);
      assert.ok(cadet.layers.some(l => l.key === 'grade:baseball_cap_front_insignia_zone'), `${uniform} ${rank}: grade on the tactical cap`);
    }
    // The patrol cap, and any cap but the tactical one, is not that cap.
    for(const headgear of ['auto', 'none']) assert.ok(!(await compose(hb2(uniform, 'male', 'cadet', 'C/Maj', headgear))).notes.some(n => /6\.2\.11\.1/.test(n)), `${uniform} ${headgear}: no tactical cap note`);
    for(const [membership, rank] of [['cadet', 'C/SSgt'], ['cadet', 'C/AB'], ['senior', 'Capt'], ['senior', 'SMSgt']]){
      const s = await compose(hb2(uniform, 'male', membership, rank, 'tactical'));
      assert.ok(!s.notes.some(n => /6\.2\.11\.1/.test(n)), `${uniform} ${rank}: no tactical cap note`);
    }
  }
});

test('the cadet officer\'s grade on the tactical cap is the ABU collar\'s piece, centred on the cap 1/2 in above the visor like the officers\' (ICL 25-02 6.2.11.1)', async () => {
  for(const uniform of ['abu', 'corporate_field']) for(const gender of ['male', 'female']){
    const scene = await compose(hb2(uniform, gender, 'cadet', 'C/Maj', 'tactical'));
    const grade = scene.layers.find(l => l.key === 'grade:baseball_cap_front_insignia_zone');
    assert.equal(grade.id, 'rank-cadet-officer-major-cloth-bordered-regular', `${uniform} ${gender}: the cloth-bordered piece`);
    const collar = scene.layers.find(l => /^grade:(right|left)$/.test(l.key) && l.id === grade.id) || scene.layers.find(l => l.role === 'grade' && l.id === grade.id && l !== grade);
    assert.ok(collar, `${uniform} ${gender}: the same piece is on the collar`);
    const officer = await compose(hb2(uniform, gender, 'senior', 'Capt', 'tactical'));
    const og = officer.layers.find(l => l.key === 'grade:baseball_cap_front_insignia_zone');
    // Same centre line, same bottom: 1/2 in above the visor, centred on the cap front.
    assert.ok(Math.abs((grade.x + grade.w / 2) - (og.x + og.w / 2)) < 0.01, `${uniform} ${gender}: centred like the officers'`);
    assert.ok(Math.abs((grade.y + grade.h) - (og.y + og.h)) < 0.01, `${uniform} ${gender}: bottom 1/2 in above the visor like the officers'`);
    const half = scene.layers.find(l => l.type === 'measure' && Math.abs(l.to.y - (grade.y + grade.h)) < 1e-6 && Math.abs(l.from.y - l.to.y - 0.5) < 1e-6);
    assert.ok(half, `${uniform} ${gender}: the 1/2 in measure under the grade`);
  }
});
