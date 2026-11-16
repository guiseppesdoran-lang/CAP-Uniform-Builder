'use strict';
// Where each badge is worn, in words, as the drawing laid it out (scene.layers[].place), and why a badge the drawing leaves off is left off
// (scene.conflicts[].why). The Badges card lists them (js/badge-rules.js capubBadgeSummary). Every phrase is checked against the layer's own
// position in inches: the badge that "sits above" another is 1/2 in over it, centred on it (CAPR 39-1 4.1.5.2.2.4.1: the second badge 1/2 in above
// the first), and a pocket badge is on the pocket side the phrase names.
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
require('../js/engine/profiles-polo.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const PILOT = 'CAPPilot1_FA9D33EA587D8', GT = 'ground_team_basic_badge', COMMS = 'communications_technician_badge', ES = 'emergency_services_badge', IT = 'information_technology_technician_badge';

function build(uniform, gender, ids, extra){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo('senior', 'Capt', {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: ids.map(id => ({ id, title: id })), command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const layerOf = (scene, id) => scene.layers.find(l => l.role === 'badge' && new RegExp(`^badge:${id}(:|$)`).test(l.key));

test('Class A, men: the stack names what it stands on, the pocket badges their sides, every badge a place', async () => {
  const scene = await P.composeUniform(build('blues_a', 'male', [GT, PILOT, COMMS, ES]), store);
  const gt = layerOf(scene, GT), pilot = layerOf(scene, PILOT), comms = layerOf(scene, COMMS), es = layerOf(scene, ES);
  for(const l of [gt, pilot, comms, es]) assert.ok(l && l.place, `${l && l.key} has a place in words`);
  assert.equal(gt.place, 'above the left pocket', 'no ribbons: the first badge stands over the pocket');
  assert.equal(pilot.place, 'above the ' + GT, 'named by the badge below it');
  assert.match(es.place, /right/);
  assert.match(comms.place, /left/);
});

test('the badge that "sits above" another is 1/2 in over it and centred on it', async () => {
  const scene = await P.composeUniform(build('blues_a', 'male', [GT, PILOT]), store);
  const gt = layerOf(scene, GT), pilot = layerOf(scene, PILOT);
  assert.equal(pilot.place, 'above the ground_team_basic_badge', 'named by the badge below it (the title the page hands the engine)');
  assert.ok(Math.abs((gt.y - (pilot.y + pilot.h)) - 0.5) < 0.02, 'the gap is the 1/2 in of 4.1.5.2.2.4.1');
  assert.ok(Math.abs((gt.x + gt.w / 2) - (pilot.x + pilot.w / 2)) < 0.01, 'centred on each other');
});

test('Class A, men: the left badge is on the wearer\'s left (the viewer\'s right), the right badge on the wearer\'s right below the name tag', async () => {
  const scene = await P.composeUniform(build('blues_a', 'male', [COMMS, ES]), store);
  const comms = layerOf(scene, COMMS), es = layerOf(scene, ES);
  assert.match(comms.place, /wearer's left|left pocket/);
  assert.equal(es.place, "on the wearer's right, below the name tag");
  assert.ok(comms.x > es.x, 'the wearer\'s left is the viewer\'s right');
  const plate = scene.layers.find(l => l.type === 'asset' && /nametag|nameplate/.test(l.id || ''));
  if(plate) assert.ok(es.y > plate.y, 'below the name tag');
});

test('Class A, women: two badges over the name tag, one each side; the pin above them', async () => {
  const scene = await P.composeUniform(build('blues_a', 'female', [COMMS, ES], { command: { id: 'squadron_commander_badge', title: 'Pin', graduated: false } }), store);
  const comms = layerOf(scene, COMMS), es = layerOf(scene, ES), pin = layerOf(scene, 'squadron_commander_badge');
  assert.match(es.place, /wearer's (right|left)/);
  assert.match(comms.place, /wearer's (right|left)/);
  assert.notEqual(es.place, comms.place, 'the two sides differ');
  assert.ok(pin && /name tag|badges/.test(pin.place), 'the pin has a place');
});

test('the graduated pin is under the name tag, the current pin over it (10.2.5)', async () => {
  const cur = await P.composeUniform(build('blues_a', 'male', [], { command: { id: 'squadron_commander_badge', title: 'Pin', graduated: false } }), store);
  const grad = await P.composeUniform(build('blues_a', 'male', [], { command: { id: 'squadron_commander_badge', title: 'Pin', graduated: true } }), store);
  assert.equal(layerOf(cur, 'squadron_commander_badge').place, 'above the name tag');
  assert.equal(layerOf(grad, 'squadron_commander_badge').place, 'below the name tag');
  assert.ok(layerOf(cur, 'squadron_commander_badge').y < layerOf(grad, 'squadron_commander_badge').y, 'the current pin is the higher');
});

test('the OCP and ABU: every badge is above the CAP tape; the pin above the name tape (7.1.1.3.1, 5.1.1.1.2.4)', async () => {
  for(const uniform of ['ocp', 'abu']){
    const scene = await P.composeUniform(build(uniform, 'male', [GT, PILOT], { command: { id: 'squadron_commander_badge', title: 'Pin', graduated: false } }), store);
    assert.equal(layerOf(scene, GT).place, 'above the CAP tape', uniform);
    assert.equal(layerOf(scene, PILOT).place, 'above the CAP tape', uniform);
    assert.equal(layerOf(scene, 'squadron_commander_badge').place, 'above the name tape', uniform);
  }
});

test('the mess dress names the medals; the polo the name on the left breast', async () => {
  const mess = await P.composeUniform(build('mess_dress', 'male', [COMMS, ES]), store);
  assert.equal(layerOf(mess, COMMS).place, "below the medals, wearer's left");
  assert.equal(layerOf(mess, ES).place, "below the medals, wearer's right");
  const polo = await P.composeUniform(build('polo', 'male', [PILOT]), store);
  assert.equal(layerOf(polo, PILOT).place, 'over the name on the left breast');
});

test('a badge the drawing leaves off carries the reason of its position, with the paragraph', async () => {
  const aviation = await P.composeUniform(build('blues_a', 'male', ['CAPPilot1_FA9D33EA587D8', 'observer_badge']), store);
  const c = aviation.conflicts.find(x => x.position === 'aviation');
  assert.equal(c.why, 'Only one CAP aviation badge is worn (CAPR 39-1, 4.1.5.2.2.4.1)');
  const over = await P.composeUniform(build('blues_a', 'male', ['legal_officer', 'emt_basic_badge', 'master_ground_team_badge']), store);
  assert.equal(over.conflicts.find(x => x.position === 'over-pocket').why, 'Not more than two aviation and occupational badges are worn (CAPR 39-1, 4.1.5.2.2.4.1)');
  const women = await P.composeUniform(build('blues_a', 'female', ['legal_officer', 'emt_basic_badge', 'master_ground_team_badge']), store);
  assert.match(women.conflicts.find(x => x.position === 'over-pocket').why, /4\.1\.9\.4\.4\.1/);
});
