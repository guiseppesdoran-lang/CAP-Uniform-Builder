'use strict';
// The engine reads the Class A coat's strap and the corporate blazers' lapel, arm seam and shoulder line from the sheets' own specs, and
// keeps no copy of them (the men's coat was redrawn at true scale in art e1b1ab14 and every literal measured on the old sheet went stale;
// the blazer sheets state lapel_left, arm_seam_left and shoulder_left since art ab7ab7d6). Each test moves the number in the spec the
// engine loads and expects the scene to follow; a literal in the engine would not.

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
// A store that loads the shipped specs, with `edit(path, json)` applied to the ones it names.
const storeWith = edit => core.createSpecStore(manifest, p => Promise.resolve(edit(p, JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8')))));
const same = (p, j) => j;
const hb = (uniform, gender, membership, rank, opt) => HARNESS.makeBuild({ uniform, gender, membership, rank, name: { first: 'Pat', last: 'Doe', show: true }, opt: Object.assign({ rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' }, opt || {}) });

test('Class A coats: the edge-on board and the strap frame follow the strap axis the cord assets state for the coat (garment_fit), men\'s and women\'s', async () => {
  for(const [sex, fit] of [['male', 'class_a_coat'], ['female', 'class_a_coat_female']]){
    const base = await P.composeUniform(hb('blues_a', sex, 'cadet', 'C/Maj'), storeWith(same));
    // Move the strap 1 in down the sheet (100 user units).
    const moved = await P.composeUniform(hb('blues_a', sex, 'cadet', 'C/Maj'), storeWith((p, j) => {
      if(/^cords\/cord-.*\.spec\.json$/.test(p)) j.garment_fit[fit].strap_axis = j.garment_fit[fit].strap_axis.map(([x, y]) => [x, y + 100]);
      return j;
    }));
    for(const side of ['right', 'left']){
      const a = base.layers.find(l => l.key === 'epaulet:' + side), b = moved.layers.find(l => l.key === 'epaulet:' + side);
      assert.ok(a && b, `${sex} ${side}: the edge-on board is drawn`);
      assert.ok(Math.abs((b.origin.y - a.origin.y) - 1) < 0.001, `${sex} ${side}: the board's outer end moved ${(b.origin.y - a.origin.y).toFixed(3)} in with the sheet's strap axis (1 in)`);
    }
  }
});

test('Class A coat without a stated strap axis: no board is invented from a literal, and the build says so', async () => {
  const scene = await P.composeUniform(hb('blues_a', 'male', 'cadet', 'C/Maj'), storeWith((p, j) => { if(/^cords\/cord-.*\.spec\.json$/.test(p)) delete j.garment_fit; return j; }));
  assert.ok(!scene.layers.some(l => l.key === 'epaulet:left' || l.key === 'epaulet:right'), 'no edge-on board without a strap axis');
  assert.ok(scene.notes.some(n => /^No artwork for the shoulder strap position/.test(n)), 'the note says the strap position is missing');
});

// The corporate semi-formal's twelve miniatures (as tests/engine-final-semi-lapel.test.cjs): the rack takes as many columns as fit between the
// lapel and the arm seam under the shoulder line (11.2.8).
const TWELVE = [['distinguished_service_award'], ['exceptional_service_award'], ['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'], ['air_search_and_rescue_ribbon'], ['cap_gill_robb_wilson_ribbon'], ['cap_command_service_ribbon'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];
const semi = gender => HARNESS.makeBuild({ uniform: 'semi_formal', gender, membership: 'senior', rank: 'Capt', name: { first: 'Pat', last: 'Doe', show: true }, ribbonSel: TWELVE, medalSel: true, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } });
const perRowMax = scene => { const rows = new Map(); scene.layers.filter(l => l.role === 'mini-drape').forEach(l => rows.set(l.y.toFixed(3), (rows.get(l.y.toFixed(3)) || 0) + 1)); return Math.max(...rows.values()); };

test('corporate blazers: the miniature rack is held to the arm seam and the shoulder line the sheet states (landmarks), men\'s and women\'s', async () => {
  for(const [sex, id] of [['male', 'garment-corporate-service-dress-blazer-male'], ['female', 'garment-corporate-service-dress-blazer-female']]){
    const edit = (dx, dy) => storeWith((p, j) => {
      if(p.endsWith(id + '.spec.json')){
        j.landmarks.arm_seam_left = j.landmarks.arm_seam_left.map(([x, y]) => [x + dx, y]);
        j.landmarks.shoulder_left = j.landmarks.shoulder_left.map(([x, y]) => [x, y + dy]);
      }
      return j;
    });
    const asShipped = await P.composeUniform(semi(sex), edit(0, 0));
    const seamIn = await P.composeUniform(semi(sex), edit(-300, 0));
    assert.equal(asShipped.layers.filter(l => l.role === 'mini-drape').length, 12, `${sex}: twelve miniatures`);
    const strays = scene => scene.notes.some(n => /past the seam or the shoulder line/.test(n));
    assert.ok(!strays(asShipped), `${sex}: the sheet as shipped holds the rack inside its arm seam and shoulder line`);
    assert.ok(perRowMax(seamIn) < perRowMax(asShipped) || strays(seamIn), `${sex}: with the arm seam 3 in nearer the centre the rack is narrowed (${perRowMax(asShipped)} to ${perRowMax(seamIn)} to a row) or noted as straying`);
    const lowShoulder = await P.composeUniform(semi(sex), edit(0, 600));
    assert.ok(perRowMax(lowShoulder) < perRowMax(asShipped) || strays(lowShoulder), `${sex}: with the shoulder line 6 in lower the rack is narrowed or noted as straying`);
  }
});

test('the engine keeps no literal copy of the blazer lapel, arm seam or shoulder line, nor of the Class A strap axis', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  for(const name of ['BLAZER_LAPEL_LEFT', 'BLAZER_ARM_SEAM_LEFT', 'BLAZER_SHOULDER_LEFT', 'strapPair']) assert.ok(!new RegExp('\\b' + name + '\\b').test(src), name + ' is gone');
  assert.ok(!/\[16\.5[27], ?[12]\.\d+\], ?\[20\.[02]\d?, ?\d\.\d+\]/.test(src), 'no strap axis literal');
});
