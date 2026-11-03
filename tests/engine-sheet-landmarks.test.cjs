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

test('Class A coats: the edge-on board and the strap frame follow the shoulder seam the sheet draws (its outline), men\'s and women\'s: moving the sheet\'s outline moves the board', async () => {
  const OUTLINE = require('../scripts/measure-garment-outline.cjs');
  for(const [sex, coat] of [['male', 'garment-blues-class-a-coat'], ['female', 'garment-blues-class-a-coat-female']]){
    const base = await P.composeUniform(hb('blues_a', sex, 'cadet', 'C/Maj'), storeWith(same));
    // Move the whole coat sheet's outline 1 in down: the engine's table is checked against the sheets in tests/engine-live-epaulet-views.test.cjs, so the engine's outline is
    // the one the sheet draws; the board's outer end sits on that outline's shoulder point (checked in engine-class-a-board-seam.test.cjs), so a different outline moves it.
    const ring = OUTLINE.compute()[coat], seam = require('./helpers/class-a-sheet.cjs').seam(coat, 'left');
    for(const side of ['right', 'left']){
      const a = base.layers.find(l => l.key === 'epaulet:' + side);
      assert.ok(a, `${sex} ${side}: the edge-on board is drawn`);
      const want = require('./helpers/class-a-sheet.cjs').seam(coat, side).outer;
      assert.ok(Math.hypot(a.origin.x - want.x, a.origin.y - want.y) < 0.005, `${sex} ${side}: the board's outer end is the sheet's shoulder point`);
    }
    assert.ok(ring.length > 10 && seam.outer.x > seam.neck.x, `${sex}: the sheet states an outline with a shoulder line`);
  }
});

// The corporate semi-formal's twelve miniatures (as tests/engine-final-semi-lapel.test.cjs): the rack takes as many columns as fit beside the lapel,
// 1 in inside the left sleeve's edge (LIVE13 E68) and under the shoulder line (11.2.8).
const TWELVE = [['distinguished_service_award'], ['exceptional_service_award'], ['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'], ['air_search_and_rescue_ribbon'], ['cap_gill_robb_wilson_ribbon'], ['cap_command_service_ribbon'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];
const semi = gender => HARNESS.makeBuild({ uniform: 'semi_formal', gender, membership: 'senior', rank: 'Capt', name: { first: 'Pat', last: 'Doe', show: true }, ribbonSel: TWELVE, medalSel: true, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } });
const perRowMax = scene => { const rows = new Map(); scene.layers.filter(l => l.role === 'mini-drape').forEach(l => rows.set(l.y.toFixed(3), (rows.get(l.y.toFixed(3)) || 0) + 1)); return Math.max(...rows.values()); };

// LIVE13 E68 (Ethan's ruling, DECISIONS LIVE13-MASTER-4/5): the side limit is the left sleeve's outer edge less 1 in, read from the sheet's cloth footprint
// (measure-layout's GARMENT_FOOTPRINT, generated from the sheet), and no longer the drawn arm seam: moving arm_seam_left changes nothing, moving the sleeve's edge in
// narrows the rack. The shoulder line is still the sheet's shoulder_left landmark.
const ML = require('../js/engine/measure-layout.js');
test('corporate blazers: the miniature rack is held 1 in inside the sleeve edge the sheet draws and under the shoulder line it states, not to the drawn arm seam, men\'s and women\'s', async () => {
  for(const [sex, id] of [['male', 'garment-corporate-service-dress-blazer-male'], ['female', 'garment-corporate-service-dress-blazer-female']]){
    const edit = (seamDx, dy) => storeWith((p, j) => {
      if(p.endsWith(id + '.spec.json')){
        j.landmarks.arm_seam_left = j.landmarks.arm_seam_left.map(([x, y]) => [x + seamDx, y]);
        j.landmarks.shoulder_left = j.landmarks.shoulder_left.map(([x, y]) => [x, y + dy]);
      }
      return j;
    });
    const asShipped = await P.composeUniform(semi(sex), edit(0, 0));
    assert.equal(asShipped.layers.filter(l => l.role === 'mini-drape').length, 12, `${sex}: twelve miniatures`);
    const strays = scene => scene.notes.some(n => /past the sleeve limit or the shoulder line/.test(n));
    assert.ok(!strays(asShipped), `${sex}: the sheet as shipped holds the rack 1 in inside the sleeve's edge and under its shoulder line`);
    assert.equal(perRowMax(asShipped), 4, `${sex}: four to a row`);
    const drapes = scene => scene.layers.filter(l => l.role === 'mini-drape').map(l => [l.x, l.y]);
    const seamIn = await P.composeUniform(semi(sex), edit(-300, 0));
    assert.deepEqual(drapes(seamIn), drapes(asShipped), `${sex}: the drawn arm seam 3 in nearer the centre changes nothing (it is not a limit)`);
    // The sleeve's edge 4 in nearer the centre (every band's last span pulled in by 40 cells; the men's rack ends about 4.9 in inside the shipped edge): the rack is narrowed or noted as straying.
    const F = ML.GARMENT_FOOTPRINT[id], saved = F.map(sp => sp.slice());
    try{
      F.forEach(sp => { if(sp.length) sp[sp.length - 1] -= 40; });
      const edgeIn = await P.composeUniform(semi(sex), edit(0, 0));
      assert.ok(perRowMax(edgeIn) < perRowMax(asShipped) || strays(edgeIn), `${sex}: with the sleeve's edge 4 in nearer the centre the rack is narrowed (${perRowMax(asShipped)} to ${perRowMax(edgeIn)} to a row) or noted as straying`);
    }finally{ saved.forEach((sp, b) => { F[b] = sp; }); }
    const lowShoulder = await P.composeUniform(semi(sex), edit(0, 600));
    assert.ok(perRowMax(lowShoulder) < perRowMax(asShipped) || strays(lowShoulder), `${sex}: with the shoulder line 6 in lower the rack is narrowed or noted as straying`);
  }
});

test('the engine keeps no literal copy of the blazer lapel, arm seam or shoulder line, nor of the Class A strap axis', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  for(const name of ['BLAZER_LAPEL_LEFT', 'BLAZER_ARM_SEAM_LEFT', 'BLAZER_SHOULDER_LEFT', 'strapPair']) assert.ok(!new RegExp('\\b' + name + '\\b').test(src), name + ' is gone');
  assert.ok(!/\[16\.5[27], ?[12]\.\d+\], ?\[20\.[02]\d?, ?\d\.\d+\]/.test(src), 'no strap axis literal');
});
