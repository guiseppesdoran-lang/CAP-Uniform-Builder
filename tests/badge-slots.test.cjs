'use strict';
// LIVE7-1 (Ethan, on the Badges panel's chooser: "the headers for these look bad. also i don't like the 'pick the first one' thing. it should be to
// pick the badges on the left and right manually"). A position with more than one place lists its places (scene.conflicts[].slots), the member
// picks the badge for each (build.badgeChoices[position] = { slotKey: badgeId }), and the engine puts exactly that badge in that place. The old
// single badge id still reads as the first place.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

const ES = 'emergency_services_badge', COMM = 'communications_technician_badge', IT = 'information_technology_technician_badge';
const build = (uniform, gender, choices, badgeIds, rank) => Object.assign(
  HARNESS.makeBuild({ uniform, gender, membership: 'senior', rank: rank || 'Capt', badgeIds }), { badgeChoices: choices || {} });
const where = (scene, id) => { const l = scene.layers.find(x => x.role === 'badge' && x.key === 'badge:' + id); return l ? { x: l.x + l.w / 2, y: l.y + l.h / 2 } : null; };
const count = (scene, id) => scene.layers.filter(x => x.role === 'badge' && x.key.split(':')[1] === id).length;
const conflict = scene => scene.conflicts.find(c => c.position === 'pocket');

test('Class A, man: three badges fill the left pocket, the right pocket and the place over the nametag, each as the member picks it', async () => {
  const ids = [ES, COMM, IT];
  const def = await P.composeUniform(build('blues_a', 'male', {}, ids), store);
  const c = conflict(def);
  assert.ok(c, 'the pocket position is reported');
  assert.deepEqual(c.slots.map(s => s.key), ['left-pocket', 'right-pocket', 'over-nametag']);
  assert.deepEqual(c.slots.map(s => s.label), ["Left pocket (wearer's left)", "Right pocket (wearer's right)", 'Over the nametag']);
  assert.deepEqual(c.slots.map(s => s.badge), [ES, COMM, IT], 'by default the rule\'s order fills the places');
  // The wearer's left is the viewer's right: the larger x.
  const at = scene => ({ es: where(scene, ES), comm: where(scene, COMM), it: where(scene, IT) });
  const d = at(def);
  assert.ok(d.es.x > 15 && d.comm.x < 10 && d.it.y < d.comm.y - 2, 'default places');

  const picks = { 'left-pocket': IT, 'right-pocket': ES, 'over-nametag': COMM };
  const scene = await P.composeUniform(build('blues_a', 'male', { pocket: picks }, ids), store);
  const k = conflict(scene);
  assert.deepEqual(k.slots.map(s => [s.key, s.choice, s.badge, s.shown]), [['left-pocket', IT, IT, true], ['right-pocket', ES, ES, true], ['over-nametag', COMM, COMM, true]]);
  const p = at(scene);
  assert.ok(p.it.x > 15, 'the IT badge is on the left pocket');
  assert.ok(p.es.x < 10 && p.es.y > d.it.y + 2, 'the ES badge is on the right pocket, below the nametag');
  assert.ok(p.comm.y < p.es.y - 2, 'the communications badge is over the nametag');
  for(const id of ids) assert.equal(count(scene, id), 1, `${id} is drawn once`);
});

test('a badge picked for two places is placed once; the second place takes the next unplaced badge', async () => {
  const ids = [ES, COMM, IT];
  const scene = await P.composeUniform(build('blues_a', 'male', { pocket: { 'left-pocket': COMM, 'right-pocket': COMM } }, ids), store);
  const c = conflict(scene);
  assert.deepEqual(c.slots.map(s => s.badge), [COMM, ES, IT]);
  assert.deepEqual(c.slots.map(s => s.choice), [COMM, null, null]);
  for(const id of ids) assert.equal(count(scene, id), 1);
});

test('Class B, woman: the two places over the nametag, the wearer\'s left (nearest the collar) and the wearer\'s right, hold the picked badges', async () => {
  const ids = [ES, COMM];
  const def = await P.composeUniform(build('blues_b', 'female', {}, ids), store);
  const c = conflict(def);
  assert.deepEqual(c.slots.map(s => s.key), ['left', 'right']);
  assert.match(c.slots[0].label, /wearer's left/);
  assert.match(c.slots[1].label, /wearer's right/);
  const d = { es: where(def, ES), comm: where(def, COMM) };
  assert.ok(d.es.x > d.comm.x, 'default: the first badge on the wearer\'s left (the viewer\'s right)');
  const swapped = await P.composeUniform(build('blues_b', 'female', { pocket: { left: COMM, right: ES } }, ids), store);
  const s = { es: where(swapped, ES), comm: where(swapped, COMM) };
  assert.ok(s.comm.x > s.es.x, 'the communications badge is on the wearer\'s left, the ES badge on the wearer\'s right');
  assert.deepEqual(conflict(swapped).slots.map(x => x.badge), [COMM, ES]);
  assert.ok(Math.abs(s.es.y - s.comm.y) < 0.2, 'side by side');
});

test('Class A, woman: the same two places over the nametag', async () => {
  const ids = [ES, COMM];
  const scene = await P.composeUniform(build('blues_a', 'female', { pocket: { left: COMM, right: ES } }, ids), store);
  assert.deepEqual(conflict(scene).slots.map(x => x.badge), [COMM, ES]);
  assert.ok(where(scene, COMM).x > where(scene, ES).x);
});

test('the older single badge id reads as the first place', async () => {
  const ids = [ES, COMM, IT];
  const scene = await P.composeUniform(build('blues_a', 'male', { pocket: IT }, ids), store);
  const c = conflict(scene);
  assert.deepEqual(c.slots.map(s => s.badge), [IT, ES, COMM]);
  assert.equal(c.choice, IT);
  assert.ok(where(scene, IT).x > 15, 'on the left pocket');
  // and a key the uniform has no place for, or a badge that is not a candidate, is ignored
  const odd = await P.composeUniform(build('blues_a', 'male', { pocket: { nowhere: IT, 'left-pocket': 'not_a_badge' } }, ids), store);
  assert.deepEqual(conflict(odd).slots.map(s => s.badge), [ES, COMM, IT]);
});

test('the status of each place follows what was drawn', async () => {
  // Four badges and three places on the Class A: the one without a place is not drawn and no place claims it.
  const ids = [ES, COMM, IT, 'historian_technicianIbadge', 'senior_emergency_services_badge'];
  const scene = await P.composeUniform(build('blues_a', 'male', {}, ids), store);
  const c = conflict(scene);
  for(const s of c.slots) assert.equal(s.shown, count(scene, s.badge) > 0, s.key);
  assert.deepEqual(c.shown, c.slots.filter(s => s.shown).map(s => s.badge));
});

test('one place left: one pick, as before; the aviation position keeps its single slot', async () => {
  const scene = await P.composeUniform(build('blues_a', 'male', {}, ['CAPPilot1_FA9D33EA587D8', 'observer_badge']), store);
  const c = scene.conflicts.find(x => x.position === 'aviation');
  assert.equal(c.slots.length, 1);
  assert.equal(c.slots[0].key, 'only');
});

// ---- the page ----------------------------------------------------------------------------------------------------------------------

const { context } = loadPageScripts();
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context));

test('the chooser model has one radio group per place, with a heading row of title and count (LIVE13 E75: radios for every place, no select)', async () => {
  const pocket = (await P.composeUniform(build('blues_a', 'male', {}, [ES, COMM, IT, 'CAPPilot1_FA9D33EA587D8', 'observer_badge']), store)).conflicts;
  const model = run(`return CAPUBUniformView.chooserModel(${JSON.stringify(pocket)});`);
  const aviation = model.find(g => g.position === 'aviation'), slots = model.find(g => g.position === 'pocket');
  assert.equal(aviation.slots.length, 1);
  assert.equal(aviation.count, 'one is worn');
  assert.equal(slots.slots.length, 3, 'one radio group per place');
  assert.equal(slots.title, 'Pocket and nametag badges');
  assert.equal(slots.count, '3 are worn');
  assert.deepEqual(slots.options.map(o => o.id), [ES, COMM, IT]);
  for(const s of slots.slots) assert.ok(s.label && s.value);
  const src = read('js/uniform-view.js');
  assert.match(src, /el\('div', 'badgeChooserHead'\)/);
  assert.match(src, /el\('h4', 'badgeChooserTitle'/);
  assert.match(src, /el\('span', 'badgeChooserCount'/);
  assert.match(src, /el\('div', 'badgeChooserSlot'\)/);
  assert.match(src, /el\('div', 'badgeChooserSlotHead'\)/, 'a place has a heading row of its own');
  assert.match(src, /el\('h5', 'badgeChooserSlotName'/);
  assert.doesNotMatch(src.slice(src.indexOf("const CHOOSER_ID = 'badgeChooser'"), src.indexOf('function updateBadgeChooser')), /createElement\('select'\)/);
  const css = read('styles/app.css');
  assert.match(css, /\.badgeChooserSlotHead\{/);
  assert.doesNotMatch(css, /\.badgeChooserSelect/);
});

test('picking a badge already in another place swaps the two; the other places stay', () => {
  const group = { slots: [{ key: 'left-pocket', value: ES }, { key: 'right-pocket', value: COMM }, { key: 'over-nametag', value: IT }] };
  const r = run(`return CAPUBUniformView.nextBadgePicks(${JSON.stringify(group)}, 'left-pocket', '${COMM}');`);
  assert.deepEqual(r, { 'left-pocket': COMM, 'right-pocket': ES, 'over-nametag': IT });
  const same = run(`return CAPUBUniformView.nextBadgePicks(${JSON.stringify(group)}, 'over-nametag', '${IT}');`);
  assert.deepEqual(same, { 'left-pocket': ES, 'right-pocket': COMM, 'over-nametag': IT });
  assert.equal(new Set(Object.values(r)).size, 3, 'no badge in two places');
});

test('saved setups: place picks and the older single badge id both load; unknown keys and badge ids are dropped', () => {
  const saved = JSON.parse(run(`
    State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = 'blues_a';
    State.badgeChoices = { blues_a: { pocket: { 'left-pocket': '${IT}', 'right-pocket': '${ES}' }, aviation: 'observer_badge' }, blues_b: { pocket: '${COMM}' } };
    return JSON.stringify(CAPUB_V2.collectProfile());`));
  assert.deepEqual(saved.badgeChoices.blues_a.pocket, { 'left-pocket': IT, 'right-pocket': ES });
  assert.equal(saved.badgeChoices.blues_b.pocket, COMM, 'the older form is saved as it is');
  saved.badgeChoices.blues_a.pocket['bad key!'] = ES;
  saved.badgeChoices.blues_a.pocket['over-nametag'] = '<script>';
  saved.badgeChoices.blues_a.pocket.__proto__ = { x: 1 };
  const back = run(`State.badgeChoices = {}; try{ CAPUB_V2.applyProfile(${JSON.stringify(saved)}); }catch(_){ } return State.badgeChoices;`);
  assert.deepEqual(back.blues_a.pocket, { 'left-pocket': IT, 'right-pocket': ES });
  assert.equal(back.blues_a.aviation, 'observer_badge');
  assert.equal(back.blues_b.pocket, COMM, 'the older single id loads and is read as the first place by the engine');
});
