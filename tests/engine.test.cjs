'use strict';
// The uniform engine (js/engine): every uniform composes for every member category, and the
// placement rules hold on the composed scene, measured in inches on the garment.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const awards = require('../js/engine/awards.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const rules = require('../data/uniform-rules.js');
const RA = require('../data/ribbon-awards.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function ribbon(id, awardValue){
  return RA.resolve(id, { awardValue }).map((r, i) => ({ key: `ribbon:${id}${i ? '#' + i : ''}`, title: id, asset: 'ribbon-' + id.replace(/_/g, '-'), devices: r.devices, centered: r.centered }));
}
function build(uniform, membership, rank, extra){
  const b = Object.assign({
    uniform, gender: 'male', grade: G.gradeInfo(membership, rank, {}),
    opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
  if(extra && extra.opt) b.opt = Object.assign({ headgear: 'auto' }, extra.opt);
  return b;
}
const layersBy = (scene, pred) => scene.layers.filter(pred);

test('every offered uniform has a profile', () => {
  for(const id of Object.keys(rules.RULES)) assert.ok(P.PROFILES[id], id);
});

test('every uniform composes for every member category and cut without missing artwork', async () => {
  const s = store();
  const members = [['cadet', 'C/AB'], ['cadet', 'C/SSgt'], ['cadet', 'C/Maj'], ['senior', 'SM'], ['senior', 'SMSgt'], ['senior', 'FO'], ['senior', 'Capt'], ['senior', 'Col'], ['senior', 'Maj Gen']];
  for(const id of Object.keys(rules.RULES)){
    for(const gender of ['male', 'female']){
      for(const [m, r] of members){
        const scene = await P.composeUniform(build(id, m, r, { gender }), s);
        assert.ok(scene.layers.length > 0, `${id} ${gender} ${r}`);
        const missing = scene.notes.filter(n => /^No artwork for/.test(n));
        assert.deepEqual(missing, [], `${id} ${gender} ${r}`);
        for(const l of scene.layers) assert.ok([l.x, l.y, l.w, l.h].every(Number.isFinite), `${id} ${r} ${l.key} has a finite box`);
      }
    }
  }
});

test('ribbons rest on the welt pocket in rows of three, the short row on top and centred (11.2.7)', async () => {
  const ribbons = ['cap_achievment_award', 'encampment_ribbon', 'red_service_ribbon', 'search_find_ribbon', 'cap_membership_ribbon'].flatMap(id => ribbon(id));
  const scene = await P.composeUniform(build('blues_a', 'senior', 'Capt', { ribbons }), store());
  const tiles = layersBy(scene, l => l.role === 'ribbon');
  assert.equal(tiles.length, 5);
  const bottom = Math.max(...tiles.map(t => t.y + t.h));
  assert.ok(Math.abs(bottom - 10.79) < 0.001, 'bottom row on the welt top');
  const rows = [...new Set(tiles.map(t => t.y.toFixed(3)))].sort();
  assert.equal(rows.length, 2);
  const top = tiles.filter(t => t.y.toFixed(3) === rows[0]);
  const low = tiles.filter(t => t.y.toFixed(3) === rows[1]);
  assert.equal(top.length, 2);
  assert.equal(low.length, 3);
  const mid = arr => (Math.min(...arr.map(t => t.x)) + Math.max(...arr.map(t => t.x + t.w))) / 2;
  assert.ok(Math.abs(mid(top) - mid(low)) < 0.001, 'top row centred over the row below');
  assert.equal(top[0].key, 'ribbon:cap_achievment_award', 'highest precedence top row, wearer\'s right');
});

test('the first aviation badge sits 1/2 inch above the ribbons (4.1.5.2.2.4.1)', async () => {
  const ribbons = ['cap_achievment_award', 'encampment_ribbon'].flatMap(id => ribbon(id));
  const scene = await P.composeUniform(build('blues_a', 'senior', 'Capt', { ribbons, badges: [{ id: 'CAPPilot1_FA9D33EA587D8' }] }), store());
  const rackTop = Math.min(...layersBy(scene, l => l.role === 'ribbon').map(t => t.y));
  const wings = layersBy(scene, l => l.key === 'badge:CAPPilot1_FA9D33EA587D8')[0];
  assert.ok(Math.abs(rackTop - (wings.y + wings.h) - 0.5) < 0.001);
});

test('a silver clasp replaces five bronze and the extra devices go on a second ribbon (CAPR 39-3)', () => {
  const six = RA.resolve('cap_achievment_award', { awardValue: 'capub_total_7' });
  const devices = six.flatMap(r => r.devices);
  assert.ok(devices.includes('device-clasp-silver'));
  assert.ok(six.every(r => r.devices.length <= awards.MAX_DEVICES));
});

test('upper rows of miniature medals hang over the drapes below them (11.2.8)', async () => {
  const medals = ['cap_achievment_award', 'encampment_ribbon', 'red_service_ribbon', 'search_find_ribbon', 'cap_membership_ribbon'].map(id => {
    const asset = 'ribbon-' + id.replace(/_/g, '-');
    return { key: 'mini:' + id, title: id, ribbonAsset: asset, medal: 'medal-' + asset.slice(7) + '-miniature', devices: [] };
  });
  const scene = await P.composeUniform(build('mess_dress', 'senior', 'Lt Col', { medals }), store());
  const drapes = layersBy(scene, l => l.role === 'mini-drape');
  const topY = Math.min(...drapes.map(d => d.y));
  const top = drapes.filter(d => d.y === topY), low = drapes.filter(d => d.y !== topY);
  assert.ok(top.length && low.length);
  assert.ok(Math.min(...top.map(d => d.z)) > Math.max(...low.map(d => d.z)), 'the upper row draws last');
});

test('cadet officer shoulder boards lie along the shoulder straps of the Class A coat', async () => {
  const scene = await P.composeUniform(build('blues_a', 'cadet', 'C/Capt'), store());
  const boards = layersBy(scene, l => /:board-(right|left)$/.test(l.key));
  assert.equal(boards.length, 2);
  for(const b of boards){
    assert.ok(Math.abs(Math.abs(b.rotate) - 14.7) < 0.2, `${b.key} turned with the strap`);
    assert.ok(b.origin.y > 2.5 && b.origin.y < 3.5, `${b.key} on the shoulder`);
  }
  const grade = layersBy(scene, l => l.role === 'grade');
  assert.equal(grade.length, 2);
  assert.ok(grade.every(g => /metal-regular$/.test(g.id)));
});

test('hats are drawn on top of the uniform, with the right device', async () => {
  const nco = await P.composeUniform(build('blues_b', 'senior', 'MSgt'), store());
  const hat = layersBy(nco, l => l.role === 'hat')[0];
  const device = layersBy(nco, l => l.role === 'hat-device')[0];
  assert.equal(hat.id, 'hat-flight-cap-men-cadet', 'the men\'s flight cap for a man');
  assert.equal(device.id, 'cap-device-nco-flight', 'ICL 25-02: NCO device on the flight cap');
  assert.ok(hat.z > Math.max(...nco.layers.filter(l => l.role !== 'hat' && l.role !== 'hat-device').map(l => l.z)));
  const mess = await P.composeUniform(build('mess_dress', 'senior', 'Col'), store());
  assert.equal(layersBy(mess, l => l.role === 'hat').length, 0, 'no headgear with mess dress');
});

test('the corporate blazer nameplate tops the left breast pocket, last name only, chaplain badge above (4.2.3.1.1.2-3)', async () => {
  const scene = await P.composeUniform(build('aviator_blazer', 'senior', 'Col', { badges: [{ id: 'christian_chaplin' }] }), store());
  const plate = layersBy(scene, l => l.key === 'nametag')[0];
  assert.ok(plate.x + plate.w / 2 > 12.761, 'wearer\'s left (viewer\'s right) of the centre line');
  assert.ok(Math.abs(plate.y - 12.377) < 0.01, 'top even with the pocket top');
  assert.equal(layersBy(scene, l => l.key === 'text:name')[0].text, 'DOE');
  const chaplain = layersBy(scene, l => l.key === 'badge:christian_chaplin')[0];
  assert.ok(Math.abs(plate.y - (chaplain.y + chaplain.h) - 0.5) < 0.001);
});

test('the semi-formal blazer swaps the necktie for a bow tie and shows no nametag', async () => {
  const scene = await P.composeUniform(build('semi_formal', 'senior', 'Col'), store());
  const base = scene.layers.find(l => l.role === 'garment');
  assert.deepEqual(base.hideGroups, ['tie']);
  assert.ok(scene.layers.some(l => l.id === 'tie-bow-black'));
  assert.ok(!scene.layers.some(l => l.key === 'nametag'));
});

test('badges earned in levels draw the chosen level (STEM, Cyber, NRA)', async () => {
  const B = require('../data/badge-catalog.js');
  assert.equal(B.art('stem_badges', 'dress', 'master'), 'enamel-stem-master');
  assert.equal(B.art('cyber_badges', 'dress'), 'enamel-cyber-basic');
  assert.equal(B.art('nra_marksman_badge', 'dress', 'expert'), 'enamel-nra-expert');
  const scene = await P.composeUniform(build('blues_a', 'cadet', 'C/Capt', { badges: [{ id: 'stem_badges', level: 'advanced' }] }), store());
  assert.ok(scene.layers.some(l => l.id === 'enamel-stem-advanced'));
});

test('cadet ribbon stars follow CAPR 39-3 (14h, 14j, 21j)', () => {
  const dev = (id, awardValue, awardLabel, membership) => RA.resolve(id, { awardValue, awardLabel, membership }).flatMap(r => r.devices);
  assert.deepEqual(dev('curry_achievement', 'honor_credit', 'Earned with Honor Credit', 'cadet'), [], 'no honor credit device');
  assert.deepEqual(dev('mitchell_award', 'earned_cos_star', '', 'cadet'), ['device-star-silver']);
  assert.deepEqual(dev('eaker_award', 'earned_cos_star', '', 'cadet'), [], 'cadets keep the COS star on the Mitchell');
  assert.deepEqual(dev('eaker_award', 'earned_cos_star', '', 'senior'), ['device-star-silver']);
  assert.deepEqual(dev('goddard_achievement', 'rocketry_star', '', 'cadet'), ['device-star-silver']);
  assert.deepEqual(dev('cadet_advisory_council_ribbon', 'cac_group', 'Group level (no device)'), []);
  assert.deepEqual(dev('cadet_advisory_council_ribbon', 'cac_wing', 'Wing level (bronze star)'), ['device-star-bronze']);
  assert.deepEqual(dev('cadet_advisory_council_ribbon', 'cac_region', 'Region level (silver star)'), ['device-star-silver']);
  assert.deepEqual(dev('cadet_advisory_council_ribbon', 'cac_national', 'National level (gold star)'), ['device-star-gold']);
});

test('cadet semi-formal: the right pocket badge stays level with the left one (4.1.3.2.2)', async () => {
  const badges = ['ground_team_basic_badge', 'AirCrew1_DB3F0FCC3650F', 'emergency_services_badge', 'communications_technician_badge'].map(id => ({ id }));
  const scene = await P.composeUniform(build('semi_formal_usaf', 'cadet', 'C/Capt', { badges, ribbons: ribbon('cap_achievment_award') }), store());
  const es = layersBy(scene, l => l.key === 'badge:emergency_services_badge')[0];
  const comms = layersBy(scene, l => l.key === 'badge:communications_technician_badge')[0];
  assert.ok(es && comms);
  assert.ok(Math.abs((es.y + es.h / 2) - (comms.y + comms.h / 2)) < 0.001, 'centres level');
  assert.ok(es.x > comms.x, 'ES on the wearer\'s left, comms on the right');
});

test('the flight jacket is drawn beside the flight suit, and the shirt beside the blazer', async () => {
  const fs = await P.composeUniform(build('flight_suit', 'senior', 'Capt'), store());
  const garments = fs.layers.filter(l => l.role === 'garment').map(l => l.id);
  assert.deepEqual(garments, ['garment-fdu-flight-suit', 'garment-flight-jacket-green']);
  const jacket = fs.layers.find(l => l.id === 'garment-flight-jacket-green');
  const suit = fs.layers.find(l => l.id === 'garment-fdu-flight-suit');
  assert.ok(jacket.x > suit.x + suit.w, 'to the right of the suit');
  const hidden = await P.composeUniform(build('flight_suit', 'senior', 'Capt', { opt: { jacket: false } }), store());
  assert.equal(hidden.layers.filter(l => l.role === 'garment').length, 1);
  const blazer = await P.composeUniform(build('aviator_blazer', 'senior', 'Capt'), store());
  assert.ok(blazer.layers.some(l => l.id === 'garment-aviator-shirt-male-long'));
  assert.ok(blazer.layers.some(l => l.id === 'garment-aviator-shirt-male-long-tie'));
});

test('grade rules: mess dress needs a grade, men\'s Class B chevrons are 3 1/2 in, C/AB has no OCP square', async () => {
  assert.equal(rules.isUniformAllowedFor('mess_dress', 'senior', { rank: 'SM' }), false);
  assert.equal(rules.isUniformAllowedFor('mess_dress', 'senior', { rank: 'MSgt' }), true);
  const men = await P.composeUniform(build('blues_b', 'senior', 'MSgt', { opt: { chevron: '4' } }), store());
  assert.ok(men.layers.filter(l => l.role === 'grade').every(l => /3p5in/.test(l.id)));
  const women = await P.composeUniform(build('blues_b', 'senior', 'MSgt', { gender: 'female', opt: { chevron: '4', sleeve: 'long' } }), store());
  assert.ok(women.layers.filter(l => l.role === 'grade').every(l => /-4in/.test(l.id)));
  const cab = await P.composeUniform(build('ocp', 'cadet', 'C/AB'), store());
  assert.deepEqual(cab.layers.find(l => l.role === 'garment').hideGroups, ['rank-square']);
});
