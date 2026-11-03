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

// ---- LIVE-FIELD B6: the arrangement above the CAP tape, measured on the composed scene (CAPR 39-1 ICL 25-06 7.1.1.3.1.1-6) ----------------
// Every distance is read from the badge layers' boxes (the blue cloth edges, the 1/8 in border counted) in scene inches; the single badge is
// measured to its silver (7.1.1.3.1.1), the multi-badge layouts blue edge to blue edge (7.1.1.3.1); FIELD7-1 (Ethan: "from the top of the blue on
// the civil air patrol to the white of the first badge"): the lowest badge of every count is measured from the tape's top edge to its silver, so
// the 1/8 in above the tape of three and four badges is to the silver and the backing lies on the tape; the gaps between badges stay blue to blue.

const OCP = 'garment-ocp-coat-abu-cut';
const CHAPLAIN = 'christian_chaplin', PILOT = 'CAPPilot1_FA9D33EA587D8', GT = 'ground_team_basic_badge', EMT = 'emt_basic_badge', MED = 'medical_officer', LEGAL = 'legal_officer';
const EPS = 0.006;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < EPS, `${msg}: ${a.toFixed(4)} vs ${b.toFixed(4)}`);

async function chest(uniform, membership, rank, ids, opt){
  const scene = await compose(build(uniform, membership, rank, ids, { opt: Object.assign({ headgear: 'auto' }, opt || {}) }));
  const garment = await store.load({ ocp: OCP, abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' }[uniform]);
  const T = core.anchor(garment, 'cap_tape_top_center');
  const badges = scene.layers.filter(l => l.role === 'badge' && !/:(ON|UN):/.test(l.key || '') && !/:chest$/.test(l.key || ''));
  const byId = {};
  for(const l of badges) byId[l.key.replace(/^badge:/, '')] = l;
  return { scene, T, badges, byId };
}
const silverBottom = async l => { const s = await store.load(l.id); return l.y + l.h - (s.h - core.anchor(s, 'art_bottom_center').y); };
const blueBottom = l => l.y + l.h;
const cx = l => l.x + l.w / 2;

test('one badge: centred, its silver 1/2 in above the CAP tape (7.1.1.3.1.1)', async () => {
  const { T, badges, byId } = await chest('ocp', 'senior', 'Maj', [GT]);
  assert.equal(badges.length, 1);
  near(await silverBottom(byId[GT]), T.y - 0.5, 'silver to tape');
  near(cx(byId[GT]), T.x, 'centred');
});

test('two badges: the first 1/2 in above the tape, the second 1/2 in above the first, blue edge to blue edge, centred on each other (7.1.1.3.1.2)', async () => {
  const { T, byId } = await chest('ocp', 'senior', 'Maj', [PILOT, GT]);
  near(await silverBottom(byId[GT]), T.y - 0.5, 'first badge, silver to tape');
  near(byId[PILOT].y + byId[PILOT].h, byId[GT].y - 0.5, 'second badge, blue to blue');
  near(cx(byId[PILOT]), cx(byId[GT]), 'centred on each other');
  near(cx(byId[GT]), T.x, 'centred on the tape');
  assert.ok(byId[PILOT].y < byId[GT].y, 'the aviation badge, higher in precedence, is the upper one');
});

test('three badges: by default a single column 1/8 in above the tape with 1/4 in between badges, each centred on the tape (7.1.1.3.1.3)', async () => {
  const { T, byId, scene } = await chest('ocp', 'senior', 'Maj', [PILOT, GT, EMT]);
  near(await silverBottom(byId[EMT]), T.y - 0.125, 'lowest badge: silver 1/8 in above the tape');
  near(blueBottom(byId[GT]), byId[EMT].y - 0.25, 'middle badge 1/4 in above the lowest');
  near(blueBottom(byId[PILOT]), byId[GT].y - 0.25, 'top badge 1/4 in above the middle');
  for(const id of [PILOT, GT, EMT]) near(cx(byId[id]), T.x, `${id} centred on the tape`);
  assert.ok(byId[PILOT].y < byId[GT].y && byId[GT].y < byId[EMT].y, 'precedence from the top down');
  assert.ok(!scene.notes.some(n => /At most/.test(n)), 'nothing left off');
});

test('three badges, the other form: two side by side 1/8 in above the tape and 1/2 in apart, the third centred 1/4 in above them (7.1.1.3.1.3)', async () => {
  const { T, byId } = await chest('ocp', 'senior', 'Maj', [PILOT, GT, EMT], { badgeLayout: 'pair' });
  const l = byId[GT], r = byId[EMT], top = byId[PILOT];
  near(await silverBottom(l), T.y - 0.125, 'left badge: silver 1/8 in above the tape');
  near(await silverBottom(r), T.y - 0.125, 'right badge: silver 1/8 in above the tape');
  near(r.x - (l.x + l.w), 0.5, '1/2 in apart');
  near((l.x + r.x + r.w) / 2, T.x, 'the pair centred on the tape');
  near(blueBottom(top), Math.min(l.y, r.y) - 0.25, 'third badge 1/4 in above the lower two');
  near(cx(top), T.x, 'third badge centred on the tape');
});

test('four badges: by default two stacks of two, 1/4 in apart vertically and 1/2 in horizontally, 1/8 in above the tape, the smaller centred on the larger (7.1.1.3.1.4)', async () => {
  const ids = [PILOT, GT, EMT, MED];
  const { T, byId } = await chest('ocp', 'senior', 'Maj', ids);
  const [a, b, c, d] = ids.map(id => byId[id]);        // top left, top right, bottom left, bottom right
  near(await silverBottom(c), T.y - 0.125, 'bottom left: silver 1/8 in above the tape');
  near(await silverBottom(d), T.y - 0.125, 'bottom right: silver 1/8 in above the tape');
  const rowTop = Math.min(c.y, d.y);
  near(blueBottom(a), rowTop - 0.25, 'top left 1/4 in above the taller lower badge');
  near(blueBottom(b), rowTop - 0.25, 'top right 1/4 in above the taller lower badge');
  near(cx(a), cx(c), 'left stack centred on each other');
  near(cx(b), cx(d), 'right stack centred on each other');
  const leftEdge = Math.max(a.x + a.w, c.x + c.w), rightEdge = Math.min(b.x, d.x);
  near(rightEdge - leftEdge, 0.5, '1/2 in between the stacks');
  near((Math.min(a.x, c.x) + Math.max(b.x + b.w, d.x + d.w)) / 2, T.x, 'both stacks centred on the tape');
});

test('four badges, the other form: two side by side on the tape, the other two stacked on the centre line 1/4 in above, 1/4 in apart (7.1.1.3.1.4)', async () => {
  const ids = [PILOT, GT, EMT, MED];
  const { T, byId } = await chest('ocp', 'senior', 'Maj', ids, { badgeLayout: 'pair' });
  const [a, b, c, d] = ids.map(id => byId[id]);
  near(await silverBottom(c), T.y - 0.125, 'bottom left: silver');
  near(await silverBottom(d), T.y - 0.125, 'bottom right: silver');
  near(d.x - (c.x + c.w), 0.5, '1/2 in apart');
  near(blueBottom(b), Math.min(c.y, d.y) - 0.25, 'third badge 1/4 in above the pair');
  near(blueBottom(a), b.y - 0.25, 'fourth badge 1/4 in above the third');
  near(cx(a), T.x, 'stack on the centre line'); near(cx(b), T.x, 'stack on the centre line');
});

test('precedence on the OCP: aviation, then CAP occupational badges, whatever order the member lists them; one aviation badge; the chaplain badge is not in the stack (7.1.1.3.1.5.1; ICL 26-14, 7.1.1.2.1 deletes the old 7.1.1.3.1.6)', async () => {
  const { byId, scene } = await chest('ocp', 'senior', 'Lt Col', [GT, LEGAL, 'SeniorAirCrew1_B289BAE6E515C', PILOT, CHAPLAIN]);
  assert.ok(!byId[PILOT], 'only the first aviation badge is worn');
  assert.ok(scene.notes.some(n => /Only one CAP aviation badge/.test(n)));
  assert.ok(!byId[CHAPLAIN], 'the chaplain badge is not above the CAP tape');
  const ys = ['SeniorAirCrew1_B289BAE6E515C', GT, LEGAL].map(id => byId[id]);
  assert.ok(ys.every(Boolean), 'three badges drawn above the tape');
  // Three badges, a single column, highest on top: aviation, then the occupational badges in the order listed.
  assert.ok(ys[0].y < ys[1].y && ys[1].y < ys[2].y, 'aviation on top, then the occupational badges as listed');
  // The chaplain badge does not count toward the four: four others and the chaplain draw all four, with no note that badges were left off.
  const four = await chest('ocp', 'senior', 'Lt Col', [GT, LEGAL, EMT, MED, CHAPLAIN]);
  assert.equal(four.badges.length, 4);
  assert.ok(four.byId[MED], 'four badges above the tape besides the chaplain badge');
  assert.ok(!four.scene.notes.some(n => /At most 4 badges|others are not shown/.test(n)));
  assert.ok(four.scene.layers.some(l => l.key === 'badge:' + CHAPLAIN + ':chest'), 'and the chaplain badge on the chest square');
  const five = await chest('ocp', 'senior', 'Lt Col', [GT, LEGAL, EMT, MED, PILOT, CHAPLAIN]);
  assert.equal(five.badges.length, 4);
  assert.ok(five.byId[PILOT] && !five.byId[MED], 'the lowest in precedence is left off');
  assert.ok(five.scene.notes.some(n => /At most 4 badges/.test(n)));
});

test('ABU and CFU: two badges, the second 1/2 in above the first, silver to silver (5.1.1.1.2.4, 5.2.1.1.2.6); the chaplain badge is the higher', async () => {
  for(const u of ['abu', 'corporate_field']){
    const { T, byId } = await chest(u, 'senior', 'Maj', [GT, CHAPLAIN]);
    near(await silverBottom(byId[GT]), T.y - 0.5, `${u}: first badge, silver to tape`);
    const s = await store.load(byId[CHAPLAIN].id);
    near(await silverBottom(byId[CHAPLAIN]), byId[GT].y + core.anchor(await store.load(byId[GT].id), 'art_top_center').y - 0.5, `${u}: silver to silver`);
    near(cx(byId[CHAPLAIN]), cx(byId[GT]), `${u}: centred on each other`);
    assert.ok(byId[CHAPLAIN].y < byId[GT].y && s, `${u}: chaplain higher`);
  }
});
