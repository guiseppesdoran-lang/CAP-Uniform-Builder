'use strict';
// FIELD7: Ethan's live-review rulings on the field and flight uniforms, measured in inches on the composed scene.
//  5. the flight suit name tag's one badge is the member's pick of the badges the tag takes (8.2.4.1, 8.3.4.1)

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
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const ST = store();
const EPS = 0.006;

function build(uniform, membership, rank, extra){
  const b = Object.assign({
    uniform, gender: 'male', grade: G.gradeInfo(membership, rank, {}),
    opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
  if(extra && extra.opt) b.opt = Object.assign({ headgear: 'auto' }, extra.opt);
  return b;
}
const compose = b => P.composeUniform(b, store());
const PILOT = { id: 'CAPPilot1_FA9D33EA587D8', title: 'Pilot Badge' };
const MASTER_GT = { id: 'master_ground_team_badge', title: 'Master Ground Team Badge' };
const GROUP_PIN = { id: 'group_commander_badge', title: 'Group Commander Badge', graduated: false };
const onSuit = (scene, pred) => scene.layers.filter(l => l.figure !== 2 && pred(l));

// ---- 5. the name tag's one badge ----------------------------------------------------------------------------------------------------

test('FIELD7-5: a member with the master Ground Team badge and no aviation badge wears it on the flight suit tag, FDU and CFDU, both sexes, officer, NCO and cadet (8.2.4.1, 8.3.4.1)', async () => {
  for(const uniform of ['flight_suit', 'corporate_flight_suit']){
    for(const gender of ['male', 'female']){
      for(const [m, r] of [['senior', 'Capt'], ['senior', 'SMSgt'], ['cadet', 'C/Capt']]){
        const scene = await compose(build(uniform, m, r, { gender, badges: [MASTER_GT] }));
        const bs = onSuit(scene, l => l.role === 'badge');
        assert.deepEqual(bs.map(l => l.key), ['badge:' + MASTER_GT.id], `${uniform} ${gender} ${r}`);
        const tag = onSuit(scene, l => l.key === 'nametag')[0];
        assert.ok(bs[0].x >= tag.x && bs[0].x + bs[0].w <= tag.x + tag.w && bs[0].y >= tag.y && bs[0].y + bs[0].h <= tag.y + tag.h / 2 + EPS, `${uniform} ${gender} ${r}: on the tag, above the name`);
        assert.ok(!scene.conflicts.some(c => c.position === 'tag'), 'one candidate is no conflict');
      }
    }
  }
});

test('FIELD7-5: with the pilot badge and the master Ground Team badge the tag shows the pilot badge unless the member chooses the Ground Team badge; the scene reports the conflict at position tag (8.2.4.1, 8.3.4.1)', async () => {
  for(const uniform of ['flight_suit', 'corporate_flight_suit']){
    for(const [m, r] of [['senior', 'Capt'], ['senior', 'SMSgt'], ['cadet', 'C/SSgt']]){
      const badges = [PILOT, MASTER_GT];
      const dflt = await compose(build(uniform, m, r, { badges }));
      assert.deepEqual(onSuit(dflt, l => l.role === 'badge').map(l => l.key), ['badge:' + PILOT.id], `${uniform} ${r} default`);
      const c = dflt.conflicts.find(x => x.position === 'tag');
      assert.ok(c, `${uniform} ${r}: conflict reported`);
      assert.deepEqual(c.candidates.map(x => x.id), [PILOT.id, MASTER_GT.id]);
      assert.equal(c.limit, 1);
      assert.deepEqual(c.shown, [PILOT.id]);
      assert.equal(c.choice, null);
      const picked = await compose(build(uniform, m, r, { badges, badgeChoices: { tag: MASTER_GT.id } }));
      assert.deepEqual(onSuit(picked, l => l.role === 'badge').map(l => l.key), ['badge:' + MASTER_GT.id], `${uniform} ${r} chosen`);
      const c2 = picked.conflicts.find(x => x.position === 'tag');
      assert.deepEqual(c2.shown, [MASTER_GT.id]);
      assert.equal(c2.choice, MASTER_GT.id);
      assert.ok(picked.notes.some(n => /Master Ground Team Badge is shown; Pilot Badge is not shown/.test(n)), picked.notes.join(' | '));
    }
  }
});

test('FIELD7-5: the command pin stays an alternative on the tag and can be chosen over the occupational badge or the wings', async () => {
  const dflt = await compose(build('flight_suit', 'senior', 'SMSgt', { badges: [MASTER_GT], command: GROUP_PIN }));
  assert.deepEqual(onSuit(dflt, l => l.role === 'badge').map(l => l.key), ['badge:' + GROUP_PIN.id], 'the pin takes the occupational badge\'s place by default');
  const picked = await compose(build('flight_suit', 'senior', 'SMSgt', { badges: [MASTER_GT, PILOT], command: GROUP_PIN, badgeChoices: { tag: GROUP_PIN.id } }));
  assert.deepEqual(onSuit(picked, l => l.role === 'badge').map(l => l.key), ['badge:' + GROUP_PIN.id]);
  assert.deepEqual(picked.conflicts.find(x => x.position === 'tag').candidates.map(x => x.id), [PILOT.id, GROUP_PIN.id, MASTER_GT.id]);
  const gt = await compose(build('flight_suit', 'senior', 'SMSgt', { badges: [MASTER_GT, PILOT], command: GROUP_PIN, badgeChoices: { tag: MASTER_GT.id } }));
  assert.deepEqual(onSuit(gt, l => l.role === 'badge').map(l => l.key), ['badge:' + MASTER_GT.id]);
  const stale = await compose(build('flight_suit', 'senior', 'SMSgt', { badges: [PILOT], badgeChoices: { tag: MASTER_GT.id } }));
  assert.deepEqual(onSuit(stale, l => l.role === 'badge').map(l => l.key), ['badge:' + PILOT.id], 'a choice that is not held changes nothing');
});
