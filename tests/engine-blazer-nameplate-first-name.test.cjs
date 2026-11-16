'use strict';
// The Corporate Service Dress nameplate (CAPR 39-1 4.2.3.1.1.2, 4.2.4.1.1.2) takes the first name, when one is entered, ahead of the last name; the state, region or national
// line under it is unchanged. Ethan, 2 November 2026. The USAF-style nameplates and the aviator shirt's tag keep the last name only.
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

const build = (uniform, gender, membership, rank, first, last) => ({
  uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'none' }, name: { first, last, state: 'Tennessee', show: true },
  ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
});
const texts = (scene, key) => scene.layers.filter(l => l.key === key);

for(const gender of ['male', 'female']){
  for(const [membership, rank] of [['senior', 'Capt'], ['cadet', 'C/Maj']]){
    test(`${gender} ${rank}: the blazer nameplate reads FIRST LAST when a first name is given and only the last name when not, the state line unchanged, the text inside the name zone (4.2.3.1.1.2, 4.2.4.1.1.2)`, async () => {
      const full = await P.composeUniform(build('aviator_blazer', gender, membership, rank, 'Guiseppe', 'Doran'), store);
      const last = await P.composeUniform(build('aviator_blazer', gender, membership, rank, '', 'Doran'), store);
      // the plate's own name line is the first 'text:name' layer drawn at the plate; the companion aviator shirt's tag carries its own last-name line
      const plate = full.layers.find(l => l.key === 'nametag'), ps = await store.load(plate.id), zone = P.helpers.pieceRect(plate, ps, 'name');
      const onPlate = scene => texts(scene, 'text:name').filter(t => t.x > plate.x && t.x < plate.x + plate.w && t.y > plate.y && t.y < plate.y + plate.h);
      const [a] = onPlate(full), [b] = onPlate(last);
      assert.equal(onPlate(full).length, 1);
      assert.equal(a.text, 'GUISEPPE DORAN');
      assert.equal(b.text, 'DORAN');
      for(const t of [a, b]){
        assert.ok(t.x - t.w / 2 >= zone.x - 1e-6 && t.x + t.w / 2 <= zone.x + zone.w + 1e-6, `${t.text}: ${(t.x - t.w / 2).toFixed(3)}..${(t.x + t.w / 2).toFixed(3)} inside the zone ${zone.x.toFixed(3)}..${(zone.x + zone.w).toFixed(3)}`);
        assert.ok(t.h <= zone.h * 0.9 + 1e-6, `${t.text}: lettering ${t.h.toFixed(3)} in no taller than the zone's`);
      }
      assert.ok(a.h < b.h, 'the longer name is set smaller');
      assert.ok(full.notes.some(n => /set smaller to fit the nameplate \(CAPR 39-1 4\.2\.3\.1\.1\.2, 4\.2\.4\.1\.1\.2\)/.test(n)), 'and the note says so');
      assert.ok(!last.notes.some(n => /set smaller to fit the nameplate/.test(n)), 'the last name alone needs no note');
      for(const scene of [full, last]){
        const st = texts(scene, 'text:state');
        assert.equal(st.length, 1);
        assert.equal(st[0].text, 'TENNESSEE');
      }
      assert.deepEqual(texts(full, 'text:state')[0].h, texts(last, 'text:state')[0].h, 'the state line is the same size');
    });
  }
}

test('a very long first and last name still fits the name zone, smaller (the plate\'s text fitting rule)', async () => {
  for(const gender of ['male', 'female']){
    const scene = await P.composeUniform(build('aviator_blazer', gender, 'senior', 'Capt', 'Maximilian-Alexander', 'Featherstonehaugh'), store);
    const plate = scene.layers.find(l => l.key === 'nametag'), ps = await store.load(plate.id), zone = P.helpers.pieceRect(plate, ps, 'name');
    const t = texts(scene, 'text:name').find(x => x.x > plate.x && x.x < plate.x + plate.w && x.y > plate.y && x.y < plate.y + plate.h);
    assert.equal(t.text, 'MAXIMILIAN-ALEXANDER FEATHERSTONEHAUGH');
    assert.ok(t.x - t.w / 2 >= zone.x - 1e-6 && t.x + t.w / 2 <= zone.x + zone.w + 1e-6, `${gender}: inside the zone`);
  }
});

test('a first name is not drawn on the USAF-style (Class A) nameplate, the cadet 3-line nameplate, the aviator shirt, or the field uniforms: last name only', async () => {
  for(const [uniform, membership, rank] of [['blues_a', 'senior', 'Capt'], ['blues_a', 'cadet', 'C/Maj'], ['aviator', 'senior', 'Capt'], ['abu', 'senior', 'Capt'], ['ocp', 'senior', 'Capt']]){
    for(const gender of ['male', 'female']){
      const scene = await P.composeUniform(build(uniform, gender, membership, rank, 'Guiseppe', 'Doran'), store);
      const names = scene.layers.filter(l => l.type === 'text' && /^text:/.test(l.key || '') && l.key !== 'text:state').map(t => t.text);
      assert.ok(names.some(n => n === 'DORAN'), `${uniform} ${gender} ${rank}: the last name is drawn`);
      for(const n of names) assert.ok(!/GUISEPPE/.test(n), `${uniform} ${gender} ${rank}: no first name (${n})`);
    }
  }
});

test('the semi-formal uniforms have no nameplate: no name line either way', async () => {
  for(const gender of ['male', 'female']){
    for(const [uniform, membership, rank] of [['semi_formal', 'senior', 'Capt'], ['semi_formal_usaf', 'cadet', 'C/Maj']]){
      const scene = await P.composeUniform(build(uniform, gender, membership, rank, 'Guiseppe', 'Doran'), store);
      assert.equal(texts(scene, 'text:name').length, 0, `${uniform} ${gender}`);
    }
  }
});
