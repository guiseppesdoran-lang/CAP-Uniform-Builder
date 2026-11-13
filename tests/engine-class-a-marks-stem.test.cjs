'use strict';
// A cadet on the men's Class A coat with the NRA marksmanship badge and the STEM badge (a member's report: "both on the wearer's left, the STEM badge belongs on the right"). CAPR 39-1
// 4.1.5.2.2.4.2 gives the specialty, STEM and Cyber badges the first place on the wearer's left (1 1/2 in below the top of the welt pocket), the second on the wearer's right (1 1/2 in below
// the nametag) and the third over the nametag, and gives the NRA marksmanship badge a place of its own ("centered on the welt pocket"), so the total of four (the paragraph's limit) is
// reached only with the marksmanship badge outside the three. This test pins what the drawing does under that reading: all four drawn, the STEM badge in the first place. Whether the
// marksmanship badge instead takes the left place and sends the STEM badge to the right is the owner's to rule (it would leave a fourth badge with no place).
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
const MARKS = 'nra_marksman_badge', STEM = 'stem_badges', ES = 'emergency_services_badge', COMMS = 'communications_technician_badge';

const build = ids => ({
  uniform: 'blues_a', gender: 'male', grade: G.gradeInfo('cadet', 'C/Col', {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
  ribbons: [], medals: [], badges: ids.map(id => ({ id, title: id })), command: null, militaryBadges: [], patches: [], cord: null, membership: 'cadet'
});
const layerOf = (scene, id) => scene.layers.find(l => l.role === 'badge' && new RegExp(`^badge:${id}(:|$)`).test(l.key));
const boxOf = l => core.layerBounds(l);

test('men\'s Class A, a cadet with the marksmanship badge, the STEM badge and two more: all four are drawn, the STEM badge in the first place on the left, the next on the right, the third over the nametag (4.1.5.2.2.4.2)', async () => {
  const scene = await P.composeUniform(build([MARKS, STEM, ES, COMMS]), store);
  const spec = await store.load('garment-blues-class-a-coat');
  const welt = spec.landmarks.welt_pocket, plate = spec.landmarks.nameplate;
  const [marks, stem, es, comms] = [MARKS, STEM, ES, COMMS].map(id => layerOf(scene, id));
  for(const l of [marks, stem, es, comms]) assert.ok(l, 'every one of the four badges is drawn (the limit of four is met)');
  const weltX = welt.x + welt.w / 2, plateX = plate.x + plate.w / 2;
  assert.ok(Math.abs(boxOf(marks).x + boxOf(marks).w / 2 - weltX) < 0.05, 'the marksmanship badge is centred on the welt pocket, the wearer\'s left');
  assert.ok(Math.abs(boxOf(stem).x + boxOf(stem).w / 2 - weltX) < 0.05, 'the first badge is on the wearer\'s left too');
  assert.ok(Math.abs(boxOf(stem).y - (welt.y + 1.5)) < 0.02, 'its top is 1 1/2 in below the top of the welt pocket');
  assert.ok(Math.abs(boxOf(es).x + boxOf(es).w / 2 - plateX) < 0.2 && Math.abs(boxOf(es).y - (plate.y + plate.h + 1.5)) < 0.02, 'the second badge is on the wearer\'s right, 1 1/2 in below the nametag');
  assert.ok(Math.abs(boxOf(comms).x + boxOf(comms).w / 2 - plateX) < 0.2 && Math.abs(boxOf(comms).y + boxOf(comms).h - (plate.y - 0.5)) < 0.02, 'the third is centred 1/2 in above the nametag');
  assert.deepEqual(scene.conflicts.filter(c => c.position === 'pocket').map(c => c.limit), [4], 'four places in all: the three of the sequence and the marksmanship badge\'s own');
});

test('the marksmanship badge counts in the four: with it and three more, a mix that has the STEM badge is still drawn whole whichever of the three the member picks', async () => {
  for(const others of [[STEM, ES, COMMS], [ES, STEM, COMMS], [COMMS, ES, STEM]]){
    const scene = await P.composeUniform(build([MARKS, ...others]), store);
    for(const id of [MARKS, ...others]) assert.ok(layerOf(scene, id), `${id} is drawn in ${others.join(' + ')}`);
  }
});
