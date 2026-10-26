'use strict';
// LIVE9-3 (Ethan: "the corporate field is significantly smaller than the abus for some reason. should be the same size"). Both coat sheets draw the same 29.96 in coat,
// but the CFU sheet (39.3 x 44.56 in) stacks its boonie hat views above the ball and patrol cap rows (baseball_cap_front at y 6.1 in, the ABU's at 0.4 in) and the
// scene frame took the whole sheet box, so the page fitted a taller box into the same stage and drew the CFU smaller. The frame now comes from what is shown: the
// garment's cloth footprint (measure-layout's GARMENT_FOOTPRINT) with the cap views the build wears and every other piece, so a hidden hat row never pads it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images/MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));
const compose = (uniform, headgear, extra) => P.composeUniform(HARNESS.makeBuild(Object.assign({ uniform, gender: 'male', membership: 'senior', rank: 'Capt', opt: { headgear } }, extra || {})), store);

test('the ABU, the CFU and the OCP coat frame to the same height for the same hat choice, to 0.5 in (LIVE9-3)', async () => {
  for(const hat of ['auto', 'tactical', 'none']){
    const [abu, cfu, ocp] = await Promise.all([compose('abu', hat), compose('corporate_field', hat), compose('ocp', hat)]);
    for(const [name, s] of [['CFU', cfu], ['OCP', ocp]]) assert.ok(Math.abs(s.bounds.h - abu.bounds.h) < 0.5, `${hat}: ${name} frame ${s.bounds.h.toFixed(2)} in high against the ABU's ${abu.bounds.h.toFixed(2)}`);
  }
});

test('the frame is the cloth, not the sheet: it is shorter than the CFU sheet by its hat rows, and a female build agrees (LIVE9-3)', async () => {
  const sheet = await store.load('garment-cfu-coat');
  for(const gender of ['male', 'female']){
    const cfu = await compose('corporate_field', 'none', { gender }), abu = await compose('abu', 'none', { gender });
    assert.ok(cfu.bounds.h < sheet.h - 10, `${gender}: CFU frame ${cfu.bounds.h.toFixed(2)} in against a ${sheet.h} in sheet`);
    assert.ok(Math.abs(cfu.bounds.h - abu.bounds.h) < 0.5, `${gender}: ${cfu.bounds.h.toFixed(2)} against ${abu.bounds.h.toFixed(2)}`);
  }
});

test('a build with the boonie hat chosen still frames the boonie (LIVE9-3)', async () => {
  const scene = await compose('corporate_field', 'boonie');
  const views = scene.layers.filter(l => /^hat-view-bounds:hat-boonie/.test(l.key || ''));
  assert.equal(views.length, 2, 'the boonie front and back views');
  for(const v of views){
    assert.ok(v.y >= scene.bounds.y - 1e-6 && v.x >= scene.bounds.x - 1e-6 && v.x + v.w <= scene.bounds.x + scene.bounds.w + 1e-6 && v.y + v.h <= scene.bounds.y + scene.bounds.h + 1e-6, `the boonie view (${v.x.toFixed(2)}, ${v.y.toFixed(2)}) lies in the frame`);
  }
  const patrol = await compose('corporate_field', 'auto');
  assert.ok(scene.bounds.h >= patrol.bounds.h - 0.5, 'the boonie frame is not shorter than the patrol cap\'s by more than the hat\'s own height difference');
});
