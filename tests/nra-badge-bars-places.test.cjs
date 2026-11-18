'use strict';
// The NRA Distinguished Expert with no bar and with all three (its drawing is 1.1 in taller with three): on every dress uniform that draws the marksmanship badge, men and women, with the
// rocketry badge, a rack of ribbons and the nametag, the badge is drawn whole on the sheet, over the rocketry badge where they touch, and touches no ribbon, device or nametag.
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
const MARKS = 'nra_marksman_badge', ROCKET = 'model_rocketry_badge';
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const RIBBONS = HARNESS.MEMBERS.find(m => m.tag === 'cadet-C-Maj').ribbons;

test('the drawing is chosen by the bars: the asset of the badge layer is the one for the combination, and its height grows with its bars', async () => {
  for(const [bars, id, h] of [[null, 'nobar', 2.346], [['rifle'], 'r', 2.714], [['pistol', 'shotgun'], 'ps', 3.082], [['rifle', 'pistol', 'shotgun'], 'rps', 3.45]]){
    const b = HARNESS.makeBuild({ uniform: 'blues_a', gender: 'male', membership: 'cadet', rank: 'C/Maj', opt: { headgear: 'none' } });
    b.badges = [{ id: MARKS, title: MARKS, level: 'distinguished-expert', bars }];
    const scene = await P.composeUniform(b, store);
    const layer = scene.layers.find(l => l.role === 'badge' && l.key.startsWith(`badge:${MARKS}`));
    assert.ok(layer, 'drawn');
    assert.equal(layer.id, `enamel-nra-distinguished-expert-${id}`);
    assert.ok(Math.abs(layer.h - h) < 0.01, `${id} is ${h} in high, got ${layer.h}`);
  }
});

for(const uniform of ['blues_a', 'blues_b', 'aviator', 'semi_formal_usaf']){
  for(const gender of ['male', 'female']){
    test(`${uniform} ${gender}: the Distinguished Expert with no bar and with three bars, beside the rocketry badge, touches no ribbon, device or nametag and lies over the rocketry badge`, async () => {
      for(const bars of [null, ['rifle', 'pistol', 'shotgun']]){
        const b = HARNESS.makeBuild({ uniform, gender, membership: 'cadet', rank: 'C/Maj', ribbonSel: RIBBONS, opt: { headgear: 'none', sleeve: 'short', rackColumns: 3 } });
        b.badges = [{ id: MARKS, title: MARKS, level: 'distinguished-expert', bars }, { id: ROCKET, title: ROCKET, level: null }];
        const scene = await P.composeUniform(b, store);
        const tag = `${uniform} ${gender} ${bars ? '3 bars' : 'no bar'}`;
        const sheet = scene.layers.find(l => l.role === 'garment'), spec = await store.load(sheet.id);
        const marks = scene.layers.find(l => l.role === 'badge' && l.key.startsWith(`badge:${MARKS}`));
        if(!marks){ assert.ok(scene.notes.length, `${tag}: not drawn only with a note`); continue; }
        assert.ok(marks.x >= sheet.x && marks.x + marks.w <= sheet.x + sheet.w && marks.y >= sheet.y && marks.y + marks.h <= sheet.y + sheet.h, `${tag}: on the sheet`);
        const lm = spec.landmarks.nametag || spec.landmarks.nameplate, tagRect = lm && (lm.points ? core.polygonBounds(lm.points) : lm);
        if(tagRect) assert.ok(overlap(marks, { x: tagRect.x + sheet.x, y: tagRect.y + sheet.y, w: tagRect.w, h: tagRect.h }) < 0.001, `${tag}: off the nametag`);
        for(const r of scene.layers.filter(l => l.role === 'ribbon' || l.role === 'device')) assert.ok(overlap(marks, r) < 0.001, `${tag}: off ${r.key}`);
        const rocket = scene.layers.find(l => l.role === 'badge' && l.key.startsWith(`badge:${ROCKET}`));
        if(rocket && overlap(marks, rocket) > 0) assert.ok(scene.layers.indexOf(marks) > scene.layers.indexOf(rocket), `${tag}: over the rocketry badge`);
      }
    });
  }
}
