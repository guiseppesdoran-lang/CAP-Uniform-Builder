'use strict';
// Two occupational badges on the wearer's left (Class A, Class B, the aviator shirt, the cadet semi-formal coat; the mess dress stacks the same
// way): which one is worn highest. CAPR 39-1 4.1.5.2.2.4.1 (men, Class A and semi-formal), 4.1.9.4.4.1 (women), 4.1.11.1.1.2.3.1 and 4.1.12.2.5.1
// (Class B), 4.2.5.1.3.1 and 4.2.6.2.7.1 (aviator shirt) say the first badge is centred 1/2 in above the highest row of ribbons, the second 1/2 in
// above the first, the chaplain badge in the highest position and the two occupational badges the same size; they state no order between two
// occupational badges (7.1.1.3.1.5.2 puts them in one group). The order is a project decision, highest first: Incident Commander, Ground Team,
// the emergency medical badges, then the others as listed (data/badge-catalog.js OCCUPATIONAL_PRECEDENCE). Every number is read off the composed
// scene, in inches, and compared with the 1/2 in the paragraph gives.
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
const B = require('../data/badge-catalog.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function build(uniform, gender, badges){
  return {
    uniform, gender, grade: G.gradeInfo('senior', 'Capt', {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: badges.map(id => ({ id })), command: null, militaryBadges: [], patches: [], cord: null
  };
}
const layer = (scene, id) => scene.layers.find(l => l.key === 'badge:' + id);

const IC = 'basic_incident_commander_badge', GT = 'ground_team_basic_badge', EMT = 'emt_basic_badge', LEGAL = 'legal_officer';
const UNIFORMS = ['blues_a', 'blues_b', 'aviator', 'semi_formal_usaf', 'mess_dress'];

for(const uniform of UNIFORMS) for(const gender of ['male', 'female']){
  test(`${uniform} ${gender}: of two occupational badges the higher in the order is worn on top, listed either way, 1/2 in apart`, async () => {
    for(const [high, low] of [[IC, GT], [GT, EMT], [IC, EMT], [EMT, LEGAL], [GT, LEGAL]]){
      for(const listed of [[high, low], [low, high]]){
        const scene = await P.composeUniform(build(uniform, gender, listed), store);
        const h = layer(scene, high), l = layer(scene, low);
        assert.ok(h && l, `${uniform} ${gender} ${listed}: both badges drawn`);
        assert.ok(h.y < l.y, `${high} is above ${low} (listed ${listed.join(', ')}): ${h.y.toFixed(3)} vs ${l.y.toFixed(3)}`);
        // The second badge is centred 1/2 in above the first: the gap between them is the paragraph's half inch, and they share a centre line.
        assert.ok(Math.abs((l.y - (h.y + h.h)) - 0.5) < 0.02, `${uniform} ${gender}: ${(l.y - (h.y + h.h)).toFixed(3)} in between the two`);
        assert.ok(Math.abs((h.x + h.w / 2) - (l.x + l.w / 2)) < 0.01, 'centred on each other');
      }
    }
  });
}

test('the aviation badge is worn above the occupational badge, and only the higher occupational badge fits beside it (4.1.5.2.2.4.1)', async () => {
  // Only two of these are worn over the pocket: the aviation badge over one occupational badge, the higher one.
  const scene = await P.composeUniform(build('blues_a', 'male', [LEGAL, GT, IC, 'CAPPilot1_FA9D33EA587D8']), store);
  const pilot = layer(scene, 'CAPPilot1_FA9D33EA587D8'), ic = layer(scene, IC);
  assert.ok(pilot && ic, 'the pilot and the Incident Commander badge are worn');
  assert.ok(pilot.y < ic.y, 'aviation above occupational');
  assert.ok(!layer(scene, GT) && !layer(scene, LEGAL), 'the lower occupational badges are the ones left off when only two fit');
});

test('three occupational badges, two places: the two highest in the order are worn, in order', async () => {
  const scene = await P.composeUniform(build('blues_a', 'male', [LEGAL, EMT, GT]), store);
  assert.ok(layer(scene, GT) && layer(scene, EMT) && !layer(scene, LEGAL), 'Ground Team and the emergency medical badge are kept, the Legal Officer badge is not');
  assert.ok(layer(scene, GT).y < layer(scene, EMT).y, 'Ground Team above the EMT badge');
  assert.ok(scene.conflicts.some(c => c.position === 'over-pocket'), 'the member can still pick which two');
});

test('the precedence table lists only occupational badges, each once, and ranks anything else last', () => {
  const ids = B.OCCUPATIONAL_PRECEDENCE.flat();
  assert.equal(new Set(ids).size, ids.length, 'no badge twice');
  for(const id of ids) assert.equal(B.family(id), 'occupational', id);
  assert.equal(B.occupationalRank(IC), 0);
  assert.equal(B.occupationalRank(GT), 1);
  assert.equal(B.occupationalRank(EMT), 2);
  assert.equal(B.occupationalRank(LEGAL), B.OCCUPATIONAL_PRECEDENCE.length);
  assert.ok(B.occupationalRank('incident_commander_1_badge') === B.occupationalRank('incident_commander_2_badge'), 'the three levels of a badge share a tier');
});
