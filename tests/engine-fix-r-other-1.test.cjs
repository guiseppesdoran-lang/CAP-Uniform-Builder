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

// ---- 2. Cadet-only badges are not drawn on adults, and the other way round ----------------------------

test('a senior member is never shown a cadet-only badge, with a note (4.1.5.2.2.4.2, 4.1.9.4.4.2)', async () => {
  for(const uniform of ['blues_a', 'blues_b', 'aviator']){
    for(const sex of ['male', 'female']){
      const scene = await compose(build(uniform, sex, 'senior', 'Capt', ['model_rocketry_badge', 'stem_badges', 'cyber_badges', 'nra_marksman_badge', 'emergency_services_badge']));
      const ids = scene.layers.filter(l => l.role === 'badge').map(l => l.key);
      for(const id of ['model_rocketry_badge', 'stem_badges', 'cyber_badges', 'nra_marksman_badge']) assert.ok(!ids.includes('badge:' + id), `${uniform} ${sex}: ${id} is not drawn on a senior member`);
      assert.ok(scene.notes.some(n => /Model Rocketry Badge is worn by cadets only \(CAPR 39-1, 4\.1\.5\.2\.2\.4\.2\)/.test(n)), `${uniform} ${sex}: the note names the badge and paragraph: ${scene.notes.join(' | ')}`);
    }
  }
});

test('a cadet keeps the cadet-only badges and is not shown a badge the chart does not authorize for cadets', async () => {
  const scene = await compose(build('blues_a', 'male', 'cadet', 'C/Maj', ['model_rocketry_badge', 'senior_advisory_group_badge']));
  const ids = scene.layers.filter(l => l.role === 'badge').map(l => l.key);
  assert.ok(ids.includes('badge:model_rocketry_badge'), 'the cadet wears the rocketry badge');
  assert.ok(!ids.includes('badge:senior_advisory_group_badge'), 'a cadet does not wear a CAP service badge');
  assert.ok(scene.notes.some(n => /not worn by cadets/.test(n)));
});
