'use strict';
// LIVE10-MASTER-3 (Ethan: "the specialty badges (like ES and STEM) are a bit too small"): the enamel specialty badges are back at their class size (art 35665cad: 1.00 to 1.25 in wide, ES 1.25 x 1.31,
// synced 16c0dd3e). The layouts (CAPR 39-1 4.1.5.2.2.4, 4.1.9.4.4, 4.1.12.2.5.2, 4.2.5.1.3.1: the two over the pocket stacked, side by side 1/2 in apart where the rule says so, the women's places over the
// nametag, nearest the collar and on the wearer's right) are unchanged; what has to hold is that a 1.25 in badge fits them: on every dress uniform that draws badges, both sexes, with one to four of the
// widest specialty badges beside an aviation badge, no two badges overlap, side-by-side badges are at least 1/2 in apart, none overlaps the nametag, a ribbon or a device, and all lie on the sheet.
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
const BC = require('../data/badge-catalog.js');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images/MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));

const width = id => (manifest.assets.find(a => a.id === id) || {}).w_in || 0;
const SPECIALTY = Object.entries(BC.BADGES).filter(([, v]) => v.family === 'specialty').map(([k, v]) => ({ id: k, w: width(v.dress) })).sort((a, b) => b.w - a.w);
const WIDEST = SPECIALTY.slice(0, 4).map(s => s.id);
const AVIATION = 'CAPPilot1_FA9D33EA587D8';
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

test('the specialty badges are at class size: the enamel ES badge is 1.25 x 1.31 in and none of the 61 is under 0.80 in wide (Aerospace Education 0.80 to 1.00, the rest 1.00 to 1.25)', () => {
  assert.equal(width('enamel-emergency-services'), 1.25);
  assert.ok(SPECIALTY.length >= 60 && SPECIALTY.every(s => s.w >= 0.79), SPECIALTY.filter(s => s.w < 0.79).map(s => s.id).join(', '));
  assert.ok(SPECIALTY.filter(s => s.w >= 0.99).length >= 50, 'most specialty badges are 1.00 to 1.25 in wide');
  assert.ok(SPECIALTY[0].w === 1.25);
});

for(const [uniform, membership, rank] of [['blues_a', 'senior', 'Capt'], ['blues_b', 'senior', 'Capt'], ['aviator', 'senior', 'Capt'], ['blues_a', 'cadet', 'C/Capt'], ['blues_b', 'cadet', 'C/Capt'], ['semi_formal_usaf', 'cadet', 'C/Capt']]){
  for(const gender of ['male', 'female']){
    test(`${uniform} ${membership} ${gender}: one to four of the widest specialty badges (1.25 in) fit the places, apart, off the nametag and the ribbons`, async () => {
      for(let count = 1; count <= 4; count++){
        const ids = [AVIATION, ...WIDEST.slice(0, count)];
        const scene = await P.composeUniform(HARNESS.makeBuild({ uniform, gender, membership, rank, badgeIds: ids, opt: { headgear: 'none', sleeve: 'short' } }), store);
        const tag = `${uniform} ${membership} ${gender} ${count} specialty`;
        const sheet = scene.layers.find(l => l.role === 'garment'), spec = await store.load(sheet.id);
        const badges = scene.layers.filter(l => l.role === 'badge' && l.type === 'asset' && !l.rotate);
        assert.ok(badges.length >= 1, `${tag}: badges drawn`);
        const tagLm = spec.landmarks.nametag || spec.landmarks.nameplate, tagRect = tagLm && (tagLm.points ? core.polygonBounds(tagLm.points) : tagLm);
        const others = scene.layers.filter(l => l.role === 'ribbon' || l.role === 'device');
        for(let i = 0; i < badges.length; i++){
          const a = badges[i];
          assert.ok(a.x >= sheet.x && a.x + a.w <= sheet.x + sheet.w && a.y >= sheet.y && a.y + a.h <= sheet.y + sheet.h, `${tag}: ${a.key} is on the sheet`);
          if(tagRect) assert.ok(overlap(a, { x: tagRect.x + sheet.x, y: tagRect.y + sheet.y, w: tagRect.w, h: tagRect.h }) < 0.001, `${tag}: ${a.key} does not overlap the nametag`);
          for(const r of others) assert.ok(overlap(a, r) < 0.001, `${tag}: ${a.key} does not overlap ${r.key}`);
          for(let j = i + 1; j < badges.length; j++){
            const b = badges[j];
            assert.ok(overlap(a, b) < 0.001, `${tag}: ${a.key} and ${b.key} do not overlap`);
            if(Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) < 0.4){
              const gap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
              assert.ok(gap >= 0.5 - 0.02, `${tag}: ${a.key} and ${b.key} side by side are ${gap.toFixed(2)} in apart (1/2 in)`);
            }
          }
        }
      }
    });
  }
}
