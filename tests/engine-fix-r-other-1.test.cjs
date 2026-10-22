'use strict';
// FIX-R-OTHER-r1 review findings (engine side). One block per finding.

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

function build(uniform, gender, membership, rank, badges, extra){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: (badges || []).map(id => ({ id })), command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const compose = b => P.composeUniform(b, store);
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} vs ${b.toFixed(3)}`);

// ---- 1. Cadet NCO lapel chevrons rest on the gorge seam on the semi-formal too ------------------------

test('semi-formal cadet NCO chevrons rest on the gorge seam exactly as on the Class A (4.1.3.2, 4.1.4, 4.1.5.2.1.4, 4.1.9.3.5)', async () => {
  for(const [sex, bottom] of [['male', 4.715], ['female', 4.13]]){
    const semi = await compose(build('semi_formal_usaf', sex, 'cadet', 'C/SSgt', []));
    const a = await compose(build('blues_a', sex, 'cadet', 'C/SSgt', []));
    for(const side of ['right', 'left']){
      const s = byKey(semi, 'grade:' + side), c = byKey(a, 'grade:' + side);
      assert.ok(s && c, `${sex} ${side}: both coats draw the chevron`);
      near(s.y + s.h, c.y + c.h, 0.005, `${sex} ${side}: semi-formal chevron bottom equals the Class A's`);
      if(side === 'right') near(s.y + s.h, bottom, 0.02, `${sex}: chevron bottom on the seam rest point`);
    }
  }
});
