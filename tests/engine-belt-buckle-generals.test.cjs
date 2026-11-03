'use strict';
// LIVE13 E126 (Doran: "I don't think there should be anything on the belt"; Ethan: "for generals"): the Wing and Star device on the belt buckle is the general
// officers' (the sheets' general-officer-buckle overlay); every other member, every uniform, wears the plain buckle.
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
const HARNESS = require('../scripts/render-builds.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const UNIFORMS = ['blues_a', 'blues_b', 'mess_dress', 'semi_formal_usaf', 'semi_formal', 'aviator', 'aviator_blazer', 'abu', 'ocp', 'corporate_field', 'flight_suit', 'corporate_flight_suit', 'polo'];
const SENIOR = ['SM', 'SSgt', 'CMSgt', 'FO', 'SFO', '2d Lt', 'Capt', 'Maj', 'Col', 'Brig Gen', 'Maj Gen'];
const CADET = ['C/AB', 'C/SSgt', 'C/CMSgt', 'C/2d Lt', 'C/Col'];

test('the Wing and Star buckle device is drawn for general officers only, on every uniform, cut and sleeve length', async () => {
  let checked = 0, drawnForGenerals = 0;
  for(const uniform of UNIFORMS) for(const gender of ['male', 'female']) for(const sleeve of ['short', 'long']) for(const [membership, ranks] of [['senior', SENIOR], ['cadet', CADET]]) for(const rank of ranks){
    const build = HARNESS.makeBuild({ uniform, gender, membership, rank, name: { first: 'Pat', last: 'Doran', show: true }, opt: { sleeve, headgear: 'auto' } });
    let scene;
    try{ scene = await P.composeUniform(build, store); }catch(e){ continue; }
    const buckle = scene.layers.filter(l => /buckle/.test(l.id || '') || /buckle/.test(l.key || ''));
    const general = G.gradeInfo(membership, rank, {}).general;
    if(!general) assert.deepEqual(buckle.map(l => l.id), [], `${uniform} ${gender} ${sleeve} ${rank}: nothing on the belt buckle`);
    else drawnForGenerals += buckle.length ? 1 : 0;
    checked++;
  }
  assert.ok(checked > 500, `${checked} builds checked`);
  assert.ok(drawnForGenerals > 0, 'the generals\' device is still drawn where the sheet has one (Class B)');
});

test('the plain buckle on the base sheets carries no emblem: the shirt, blouse, aviator and polo buckles are the plate, the tip and edges only', () => {
  for(const f of fs.readdirSync(path.join(root, 'images', 'garments')).filter(n => /\.svg$/.test(n) && !/general-officer-buckle/.test(n))){
    const s = fs.readFileSync(path.join(root, 'images', 'garments', f), 'utf8');
    for(const m of s.matchAll(/<g id="([^"]*__belt-buckle)"[\s\S]*?<\/g>/g)) assert.ok(!/wing|star|emblem/i.test(m[0]), `${f}: the plain buckle has no emblem`);
  }
});
