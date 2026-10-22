'use strict';
// FIX-R-OTHER-r1 review round 3: semi-formal men's miniature rack ends at the pocket.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const NAME = { first: 'Pat', last: 'Doran', show: true };
const hb = (uniform, gender, membership, rank, o) => HARNESS.makeBuild(Object.assign({ uniform, gender, membership, rank, name: NAME, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } }, o || {}));
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const rad = d => d * Math.PI / 180;
// The centre line of the figure a layer belongs to (the second figure of a scene, the aviator shirt beside the blazer, is shifted).
const centreLine = (scene, l) => { const g = scene.layers.find(x => x.role === 'garment' && (x.figure || 1) === (l.figure || 1)); return g.x + g.w / 2; };

// ---- 4. Semi-formal men's blazer: no miniature crosses the pocket welt ---------------------------------------------

test('semi-formal men\'s blazer: the miniature rack ends at the pocket\'s top edge, whatever its size, and the chaplain badge keeps 1/2 in over the top row (4.2.1.4, 4.2.1.5, 4.2.3.1.1.1; DECISIONS FIX-R-OTHER-r1 #4)', async () => {
  const spec = await store.load('garment-corporate-service-dress-blazer-male');
  const weltTop = core.anchor(spec, 'pocket_top_center').y;
  const crest = core.anchor(spec, 'crest_top_center').y;
  const twelve = [['distinguished_service_award'], ['exceptional_service_award'], ['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'], ['air_search_and_rescue_ribbon'], ['cap_gill_robb_wilson_ribbon'], ['cap_command_service_ribbon'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];
  for(const rank of ['SMSgt', 'Capt', 'Col', 'Maj Gen']){
    for(const n of [2, 5, 12]){
      const scene = await compose(hb('semi_formal', 'male', 'senior', rank, { ribbonSel: twelve.slice(0, n), medalSel: true, badgeIds: ['chaplain_badge_senior'], opt: { rackColumns: 4, rackArrangement: 'lapel', miniStyle: 'mounting' } }));
      const bodies = scene.layers.filter(l => l.role === 'mini-medal');
      assert.ok(bodies.length >= 1, `${rank} ${n}: medals drawn`);
      const bottom = Math.max(...bodies.map(l => l.y + l.h));
      assert.ok(bottom <= weltTop + 1e-6, `${rank} ${n}: lowest medal body ends ${bottom.toFixed(3)} in, the pocket's top is ${weltTop.toFixed(3)} in`);
      assert.ok(bottom > weltTop - 0.01, `${rank} ${n}: the rack sits on the pocket's top edge`);
      assert.ok(crest - bottom >= 0.5, `${rank} ${n}: at least 1/2 in over the crest`);
      const chap = scene.layers.find(l => l.role === 'badge' && /chaplain/.test(l.key));
      if(chap){
        const top = Math.min(...scene.layers.filter(l => /^mini-(drape|medal)$/.test(l.role)).map(l => l.y));
        assert.ok(Math.abs(top - (chap.y + chap.h) - 0.5) < 0.01, `${rank} ${n}: chaplain badge 1/2 in over the top row`);
      }
      assert.ok(scene.notes.some(t => /end at the top of the pocket/.test(t)), `${rank} ${n}: the note says why the rack is not 1/2 in over the crest`);
    }
  }
});

