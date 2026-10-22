'use strict';
// FIX-R-OTHER-r1 review round 3 findings (engine side). One block per finding.

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
const rad = d => d * Math.PI / 180;

// ---- 1, 2. Mess dress boards: bars across the board; every edge-on grade fits the strip --------------------

const BARS = ['2d Lt', '1st Lt', 'Capt'];
const MESS_GRADES = ['2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col', 'Brig Gen', 'Maj Gen'];

test('mess dress: the bars of 2d Lt, 1st Lt and Captain lie across the shoulder board, top view and edge-on (4.1.1.1.1.1, 4.1.2.1.1.1, Fig A5-1, A5-3)', async () => {
  for(const sex of ['male', 'female']){
    const boardsId = `garment-mess-dress-${sex}-officer-shoulder-boards`;
    const boards = await store.load(boardsId);
    for(const rank of BARS){
      const scene = await compose(build('mess_dress', sex, 'senior', rank));
      for(const side of ['right', 'left']){
        const frame = boards.landmarks[`rank_slot_${side}_frame`].deg;
        for(const key of [`grade:top-${side}`, `grade:edge-${side}`]){
          const l = byKey(scene, key);
          assert.ok(l, `${sex} ${rank}: ${key} drawn`);
          // The art's bars stand along its height, so their long axis is the layer's turn + 90 deg.
          const spec = await store.load(l.id);
          assert.ok(spec.h > spec.w, `${l.id}: the bars' long axis is the art's height`);
          const dot = Math.cos(rad(l.rotate + 90 - frame));
          assert.ok(Math.abs(dot) < 0.01, `${sex} ${rank} ${key}: bar axis is perpendicular to the board (cos ${dot.toFixed(4)})`);
        }
      }
    }
  }
});

test('mess dress: the leaf, stars and eagle keep their quarter turn to the board (4.1.1.1.1.2-3)', async () => {
  for(const sex of ['male', 'female']){
    const boards = await store.load(`garment-mess-dress-${sex}-officer-shoulder-boards`);
    for(const rank of ['Maj', 'Lt Col', 'Col']){
      const scene = await compose(build('mess_dress', sex, 'senior', rank));
      const frame = boards.landmarks.rank_slot_right_frame.deg;
      const l = byKey(scene, 'grade:top-right');
      assert.ok(Math.abs(Math.cos(rad(l.rotate - frame - 90))) > 0.999, `${sex} ${rank}: turned frame + 90 (${l.rotate} vs ${frame})`);
    }
  }
});

test('mess dress: every edge-on grade is 0.25-0.32 in across the 0.4 in strip, every grade, both cuts (R7)', async () => {
  for(const sex of ['male', 'female']) for(const rank of MESS_GRADES){
    const scene = await compose(build('mess_dress', sex, 'senior', rank));
    for(const side of ['right', 'left']){
      const strip = byKey(scene, `epaulet-edge:${side}`), l = byKey(scene, `grade:edge-${side}`);
      assert.ok(strip && l, `${sex} ${rank} ${side}: strip and grade drawn`);
      // l.w x l.h is the piece as drawn (after scale); rel is its turn relative to the strip.
      const rel = rad(l.rotate - strip.rotate);
      const across = l.w * Math.abs(Math.sin(rel)) + l.h * Math.abs(Math.cos(rel));
      assert.ok(across <= 0.32 + 0.002 && across >= 0.25, `${sex} ${rank} ${side}: ${across.toFixed(3)} in across a ${strip.h} in strip`);
    }
  }
});
