'use strict';
// Ethan: "the stars are a little small. should be the same size of the triblade". A star on a ribbon is drawn as
// tall as the CAP tri-blade propeller on the same rack, keeping its own aspect; the clasp, propeller and V sizes
// are unchanged. The factor is applied in the engine (compose.js deviceSizes), not in the art or the manifest.

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
const RA = require('../data/ribbon-awards.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const spec = id => manifest.assets.find(a => a.id === id);

function ribbons(sel){
  return sel.flatMap(([id, awardValue, awardLabel, membership]) => RA.resolve(id, { awardValue, awardLabel, membership }).map((r, i) => ({
    key: `ribbon:${id}${i ? '#' + i : ''}`, id, title: id, asset: 'ribbon-' + id.replace(/_/g, '-'), devices: r.devices, centered: r.centered
  })));
}
function build(uniform, membership, rank, extra){
  return Object.assign({
    uniform, gender: 'male', membership, grade: G.gradeInfo(membership, rank, {}),
    opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}

test('a star device is drawn as tall as the propeller device on the same Class A rack, with its own aspect', async () => {
  const rs = ribbons([
    ['mitchell_award', 'earned_cos_star', 'Earned + COS graduate (silver star)', 'cadet'],
    ['search_find_ribbon', 'mcchord_24500', '2nd w/Prop', 'cadet'],
    ['cap_gill_robb_wilson_ribbon', 'sos', 'Squadron Officer School (bronze star)', 'senior']
  ]);
  const scene = await P.composeUniform(build('blues_a', 'senior', 'Capt', { ribbons: rs }), store());
  const devices = scene.layers.filter(l => l.role === 'device');
  const props = devices.filter(l => l.id === 'device-propeller-bronze');
  const stars = devices.filter(l => /^device-star-/.test(l.id));
  assert.ok(props.length >= 1, 'a propeller is drawn');
  assert.ok(stars.length >= 1, 'a star is drawn');
  for(const star of stars){
    assert.ok(Math.abs(star.h - props[0].h) < 0.0005, `${star.id} is ${star.h} in tall, the propeller ${props[0].h}`);
    const own = spec(star.id);
    assert.ok(Math.abs(star.w / star.h - own.w_in / own.h_in) < 0.002, `${star.id} keeps its aspect`);
  }
});

test('the other devices keep their spec sizes', async () => {
  const rs = ribbons([['cap_achievment_award', 'capub_total_7', '7th Award'], ['search_find_ribbon', 'mcchord_24500', '2nd w/Prop']]);
  const scene = await P.composeUniform(build('blues_a', 'senior', 'Capt', { ribbons: rs }), store());
  for(const d of scene.layers.filter(l => l.role === 'device' && !/^device-star-/.test(l.id))){
    const own = spec(d.id);
    assert.ok(Math.abs(d.w - own.w_in) < 0.0005 && Math.abs(d.h - own.h_in) < 0.0005, `${d.id} is ${d.w} x ${d.h}, its spec ${own.w_in} x ${own.h_in}`);
  }
});
