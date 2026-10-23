'use strict';
// LIVE-FIELD B6 (Ethan: "this is not a thing / these don't exist / audit everything against the regs"): the OCP, ABU and Corporate Field
// Uniform offer and draw only badges whose field form is GENUINE, the original silver-on-dark-blue set (CAPR 39-1 7.1.1.3.1, 5.1.1.1.2.4,
// 5.2.1.1.2.6); dress enamel art never appears on a field uniform. The 56 specialty track badges and the three Emergency Services badges only
// had an estimated recolour of the enamel art (ff66b8ac, 4976eb93), which is not field artwork, so they are dress-only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
const CAT = require('../data/badge-catalog.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function build(uniform, membership, rank, badgeIds, extra){
  return Object.assign({
    uniform, gender: 'male', grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: badgeIds.map(id => ({ id, title: (CAT.get(id) || {}).name || id })), command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const compose = b => P.composeUniform(b, store);
const FIELD = ['ocp', 'abu', 'corporate_field'];

// The badges offered on a field uniform: 19 aviation (wings, sUAS), 3 ground team, 3 incident commander, 3 EMT, medical, nurse,
// legal officer, 4 chaplain, and the two command pins.
const GENUINE = [
  'CAPPilot1_FA9D33EA587D8', 'CAPSeniorPilot1_D9725AE959752', 'CAPMasterPilot1_621A0E2ED15DA', 'AirCrew1_DB3F0FCC3650F', 'SeniorAirCrew1_B289BAE6E515C',
  'MasterAirCrew1_72AC4CAE7A310', 'observer_badge', 'SeniorObserver1_0E35802A29801', 'MasterObserver1_1B88D5071FD5C', 'GliderPilot1_7BFB287379918',
  'BalloonPilot1_442D89C94185B', 'solo_badge', 'pre_solo_badge', 'uas_pilot_basic_badge', 'uas_pilot_senior_badge', 'uas_pilot_master_badge',
  'uas_technician_basic_badge', 'uas_technician_senior_badge', 'uas_technician_master_badge',
  'ground_team_basic_badge', 'senior_ground_team_badge', 'master_ground_team_badge',
  'basic_incident_commander_badge', 'incident_commander_2_badge', 'incident_commander_1_badge',
  'emt_basic_badge', 'emt_intermediate', 'emt_paramedic', 'medical_officer', 'nurse_officer', 'legal_officer',
  'christian_chaplin', 'jewish_chaplin', 'muslim_chaplin', 'buddist_chaplin',
  'squadron_commander_badge', 'group_commander_badge'
];

test('the catalog names a field form for exactly the genuine set, and each one is a loadable asset', async () => {
  assert.deepEqual(CAT.fieldIds().sort(), [...GENUINE].sort());
  for(const id of GENUINE){
    const art = CAT.art(id, 'field');
    assert.ok(art && store.has(art), `${id}: field art ${art} is in the manifest`);
    assert.ok(await store.load(art), `${id}: loads`);
    assert.notEqual(art, CAT.art(id, 'dress'), `${id}: the field form is not the dress asset`);
  }
});

test('every badge without a field form is dress-only: the 56 specialty track badges, the three ES badges, the service badges, the cadet-only badges', () => {
  const none = Object.keys(CAT.BADGES).filter(id => !CAT.hasField(id));
  for(const id of none) assert.ok(CAT.art(id, 'dress') || (CAT.levels(id) || []).length, `${id} still has dress art`);
  const specialty = Object.entries(CAT.BADGES).filter(([, v]) => v.family === 'specialty').map(([k]) => k);
  assert.ok(specialty.length >= 59, `${specialty.length} specialty badges (56 tracks + 3 ES)`);
  for(const id of specialty) assert.ok(none.includes(id), id);
  for(const id of ['senior_advisory_group_badge', 'command_council_badge', 'national_staff_badge', 'stem_badges', 'cyber_badges', 'model_rocketry_badge', 'nra_marksman_badge', 'volunteer_university_instructor_badge']) assert.ok(none.includes(id), id);
});

test('the picker on a field uniform offers only badges that have a field form (the utility list in js/patches.js, Attachment 7 Figure A7-3)', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'patches.js'), 'utf8');
  const m = /const CAPUB_DOCUMENT_UTILITY_BADGE_IDS = (\[[\s\S]*?\]);/.exec(src);
  assert.ok(m, 'the utility badge list is in patches.js');
  const ids = Function(`return ${m[1]}`)();
  assert.ok(ids.length >= 20);
  for(const id of ids) assert.ok(CAT.hasField(id), `${id} is offered on field uniforms, so it must have genuine field art`);
});

test('OCP, ABU and CFU: every badge in the catalog either draws its field form or is not drawn and noted; no dress, cloth or miniature art is ever drawn (LIVE-FIELD B6)', async () => {
  const foreign = new Set();
  for(const [id, b] of Object.entries(CAT.BADGES)){
    for(const a of [b.dress, b.cloth, b.mini, ...(b.levels || []).map(l => l[2])]) if(a && a !== b.field) foreign.add(a);
  }
  const fieldArt = new Set(CAT.fieldIds().map(id => CAT.art(id, 'field')));
  for(const a of fieldArt) foreign.delete(a);
  for(const uniform of FIELD){
    for(const id of Object.keys(CAT.BADGES)){
      if(CAT.family(id) === 'command') continue;
      // A senior officer; the cadet-only badges are dropped for seniors by their own rule (a different note).
      const scene = await compose(build(uniform, 'senior', 'Maj', [id]));
      const drawn = scene.layers.filter(l => l.role === 'badge');
      for(const l of drawn) assert.ok(!foreign.has(l.id), `${uniform} ${id}: ${l.id} is not field art`);
      const worn = uniform === 'ocp' ? CAT.hasField(id) : CAT.hasField(id) && ['aviation', 'occupational', 'chaplain'].includes(CAT.family(id));
      if(CAT.hasField(id) && worn){
        assert.equal(drawn.length, 1, `${uniform} ${id}: its field form is drawn`);
        assert.equal(drawn[0].id, CAT.art(id, 'field'));
      }else if(!CAT.hasField(id) && CAT.eligibleFor(id, 'senior')){
        assert.equal(drawn.length, 0, `${uniform} ${id}: not drawn`);
        assert.ok(scene.notes.some(n => /has no field artwork/.test(n)), `${uniform} ${id}: says why (${scene.notes.join(' | ')})`);
      }
    }
  }
});
