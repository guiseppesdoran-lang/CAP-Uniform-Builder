'use strict';
// A cadet's field uniform offers the same headgear as a senior member's (the visual audit of 2026-11-12 saw no headgear group on a cadet's ABU and four caps on a senior's; it did
// not say why). The list has no condition on the membership: the ABU, the OCP and the corporate field uniform offer the patrol cap, the tactical cap, the National Blue Beret
// (not where the member's unit forbids it) and no headgear, to a cadet of any grade and to a senior member, in either cut. The group is shown for each: a missing group could only
// come from the pictures, which the picker takes out when the engine draws every choice alike (tests/option-pictures.test.cjs), and the four choices are four different drawings
// for a cadet (checked here against the engine's own composition, not a copy of what it draws).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument } = require('./helpers/mini-dom.cjs');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const RB = require('../scripts/render-builds.cjs');
const Supplements = require('../js/supplements.js');

const FIELD = ['abu', 'ocp', 'corporate_field'];
const CADETS = ['C/AB', 'C/Amn', 'C/SSgt', 'C/2d Lt', 'C/Maj', 'C/Col'], SENIORS = ['SM', 'SSgt', 'Capt', 'Col'];

function panel(state){
  const doc = createDocument();
  const host = doc.createElement('div'); host.id = 'garmentOptions'; doc.body.append(host);
  const section = doc.createElement('section'); section.id = 'garmentOptionsPanel'; doc.body.append(section);
  const sandbox = { State: Object.assign({ uniform: 'abu', gender: 'male', membership: 'senior', rank: 'Capt', garment: {}, badges: [], unitPatchCharter: '' }, state), CAPUBEngine: { grades: G }, Supplements, document: doc, console, fullRender(){} };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  vm.runInNewContext(read('js/garment-options.js'), sandbox);
  sandbox.CAPUBGarmentOptions.render(true);
  return { host, O: sandbox.CAPUBGarmentOptions };
}
const group = host => host.querySelectorAll('.vp').find(v => v.dataset.name === 'garmentOpt-headgear');
const values = host => { const g = group(host); return g ? g.querySelectorAll('[role="radio"]').map(r => r.dataset.value) : null; };
const gradeFor = (membership, rank) => G.gradeInfo(membership, rank, {});
const plain = v => JSON.parse(JSON.stringify(v));

test('the headgear choices of a field uniform do not depend on the membership or the grade: a cadet is offered what a senior member is, in either cut', () => {
  for(const u of FIELD){
    const want = u === 'corporate_field' ? ['auto', 'tactical', 'boonie', 'beret', 'none'] : ['auto', 'tactical', 'beret', 'none'];
    for(const female of [false, true]){
      const lists = [];
      for(const [membership, ranks] of [['cadet', CADETS], ['senior', SENIORS]]){
        for(const rank of ranks){
          const { O } = panel({ uniform: u, gender: female ? 'female' : 'male', membership, rank });
          lists.push(plain(O.OPTIONS.find(o => o.key === 'headgear').choices({ u, female, g: gradeFor(membership, rank), cer: false }).map(x => x[0])));
        }
      }
      for(const l of lists) assert.deepEqual(l, want, `${u} ${female ? 'women' : 'men'}`);
    }
  }
});

test('the group is shown on a cadet\'s ABU as on a senior member\'s, men\'s and women\'s cut, for every grade', () => {
  for(const [membership, ranks] of [['cadet', CADETS], ['senior', SENIORS]]){
    for(const rank of ranks){
      for(const gender of ['male', 'female']){
        const { host } = panel({ uniform: 'abu', gender, membership, rank });
        assert.deepEqual(plain(values(host)), ['auto', 'tactical', 'beret', 'none'], `${membership} ${rank} ${gender}`);
      }
    }
  }
});

test('the four choices are four different drawings for a cadet, so the picker keeps the group (it is taken out only where every choice is drawn alike)', async () => {
  const manifest = JSON.parse(read('images/MANIFEST.json'));
  const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
  for(const [membership, rank] of [['cadet', 'C/Maj'], ['cadet', 'C/AB'], ['senior', 'Capt']]){
    const seen = new Map();
    for(const headgear of ['auto', 'tactical', 'beret', 'none']){
      const build = RB.makeBuild({ uniform: 'abu', gender: 'male', membership, rank, opt: { headgear } });
      const scene = await P.composeUniform(build, store);
      const sig = JSON.stringify(scene.layers.filter(l => l.type === 'asset').map(l => [l.id, l.key, l.x, l.y, l.w, l.h, l.onlyGroups, l.hideGroups]));
      seen.set(headgear, sig);
    }
    assert.equal(new Set(seen.values()).size, 4, `${membership} ${rank}: four different drawings`);
  }
});
