'use strict';
// ICL 26-14 to CAPR 39-1 (2 November 2026, effective 30 November 2026), 7.1.1.2.1 and 7.1.1.8: on the OCP a chaplain wears the chaplain occupational badge
// on the 2 x 2 in dark blue chest square in place of the grade, not above the CAP tape, and on the patrol and tactical cap in place of rank insignia. The
// letter says "2' x 2'"; Ethan rules it is inches, and asked for the letter as written as a joke (opt.chaplainAsWritten, 24 x 24 in, flagged `meme`).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
const CAT = require('../data/badge-catalog.js');
const PT = require('../js/placement-templates.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const CHAPLAIN = 'christian_chaplin', GT = 'ground_team_basic_badge';
function build(uniform, rank, badgeIds, opt){
  return {
    uniform, gender: 'male', grade: G.gradeInfo('senior', rank, {}), opt: Object.assign({ headgear: 'auto' }, opt || {}), name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: badgeIds.map(id => ({ id, title: (CAT.get(id) || {}).name || id })), command: null, militaryBadges: [], patches: [], cord: null
  };
}
const compose = b => P.composeUniform(b, store);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const FIELD_ART = CAT.art(CHAPLAIN, 'field');

async function squareRect(){
  const g = await store.load('garment-ocp-coat-abu-cut');
  return core.landmarkBounds(g, 'rank_square');
}

test('a chaplain on the OCP: the badge is on the 2 x 2 in chest square in place of the grade, and none is above the CAP tape (ICL 26-14, 7.1.1.2.1)', async () => {
  const sq = await squareRect();
  for(const rank of ['Lt Col', 'Capt', 'SMSgt', 'Maj Gen']){
    const scene = await compose(build('ocp', rank, [CHAPLAIN, GT]));
    const chest = scene.layers.find(l => l.key === `badge:${CHAPLAIN}:chest`);
    assert.ok(chest && chest.id === FIELD_ART, `${rank}: the chaplain badge's field art is on the chest`);
    assert.ok(chest.x >= sq.x - 1e-6 && chest.x + chest.w <= sq.x + sq.w + 1e-6 && chest.y >= sq.y - 1e-6 && chest.y + chest.h <= sq.y + sq.h + 1e-6, `${rank}: inside the 2 x 2 in square`);
    near(chest.x + chest.w / 2, sq.x + sq.w / 2, 0.01, `${rank}: centred across`); near(chest.y + chest.h / 2, sq.y + sq.h / 2, 0.01, `${rank}: centred down`);
    assert.ok(!scene.layers.some(l => l.key === 'grade:chest'), `${rank}: no grade insignia on the square`);
    const stack = scene.layers.filter(l => l.role === 'badge' && /^badge:/.test(l.key) && !/:chest$/.test(l.key));
    assert.deepEqual(stack.map(l => l.key), [`badge:${GT}`], `${rank}: the chaplain badge is not above the CAP tape; the other badge is`);
    assert.ok(!scene.layers.some(l => l.meme), `${rank}: nothing flagged as the meme`);
  }
});

test('a chaplain on the OCP caps (patrol and tactical): the chaplain badge, centred 1/2 in above the visor, in place of rank insignia, officer or not (ICL 26-14, 7.1.1.8)', async () => {
  for(const headgear of ['auto', 'tactical']) for(const rank of ['Lt Col', 'SMSgt']){
    const scene = await compose(build('ocp', rank, [CHAPLAIN], { headgear }));
    const caps = scene.layers.filter(l => /^grade:(patrol|baseball)_cap_front/.test(l.key || ''));
    assert.equal(caps.length, 1, `${headgear} ${rank}: one piece on the cap front`);
    assert.equal(caps[0].id, FIELD_ART, `${headgear} ${rank}: it is the chaplain badge`);
    assert.ok(!scene.layers.some(l => /^grade:(patrol|baseball)_cap_front/.test(l.key || '') && l.id !== FIELD_ART), `${headgear} ${rank}: no rank insignia`);
    const sq = scene.layers.filter(l => /grade-field/.test(l.key || ''));
    assert.equal(sq.length, 0, `${headgear} ${rank}: no 2 x 2 grade square on the cap`);
  }
  // The hook-and-loop grade option does not apply to a chaplain: the badge is the only option.
  const sq = await compose(build('ocp', 'Lt Col', [CHAPLAIN], { capGrade: 'square' }));
  assert.equal(sq.layers.filter(l => /^grade:patrol_cap_front/.test(l.key || '')).map(l => l.id).join(), FIELD_ART);
  assert.ok(!sq.layers.some(l => /grade-field/.test(l.key || '')));
  // A non-chaplain NCO wears nothing on the cap front (unchanged).
  const nco = await compose(build('ocp', 'SMSgt', [GT]));
  assert.ok(!nco.layers.some(l => /^grade:(patrol|baseball)_cap_front/.test(l.key || '')));
});

test('the letter as written (opt.chaplainAsWritten, the meme): a 24 x 24 in square centred on the chest with the badge scaled 12 times, flagged meme, not a placement', async () => {
  const sq = await squareRect(), cx = sq.x + sq.w / 2, cy = sq.y + sq.h / 2;
  const plain = await compose(build('ocp', 'Lt Col', [CHAPLAIN]));
  const scene = await compose(build('ocp', 'Lt Col', [CHAPLAIN], { chaplainAsWritten: true }));
  const square = scene.layers.find(l => l.type === 'rect' && l.meme);
  assert.ok(square, 'the big square');
  near(square.w, 24, 1e-9, 'wide'); near(square.h, 24, 1e-9, 'tall');
  near(square.x + 12, cx, 0.01, 'centred across'); near(square.y + 12, cy, 0.01, 'centred down');
  const badge = scene.layers.find(l => l.key === `badge:${CHAPLAIN}:chest`), one = plain.layers.find(l => l.key === `badge:${CHAPLAIN}:chest`);
  near(badge.w, 12 * one.w, 0.01, 'the badge is scaled with the square'); assert.ok(badge.meme, 'the badge is flagged');
  assert.ok(scene.notes.some(n => /ICL 26-14/.test(n) && /joke/.test(n)), 'the scene says it is not the regulation');
  assert.ok(!plain.layers.some(l => l.meme) && !plain.notes.some(n => /ICL 26-14/.test(n)), 'off by default');
  // No measurement is drawn for it, and the placement templates leave it out.
  assert.ok(!scene.layers.some(l => l.meme && l.type === 'measure'));
  const layersOf = s => PT.plan(s, id => store.load(id), { uniform: 'ocp' }).then(p => p.sides.flatMap(sd => sd.items));
  const items = await layersOf(scene), plainItems = await layersOf(plain);
  assert.equal(items.length, plainItems.length - 1, 'the templates leave the meme badge out (the real 2 in badge is the one more item)');
  assert.ok(!items.some(i => i.box && i.box.w > 12), 'no item as large as the meme square');
});

test('a build that is not a chaplain on the OCP is unchanged: the grade on the chest square, the badges above the tape, the meme flag does nothing', async () => {
  const base = await compose(build('ocp', 'Lt Col', [GT]));
  const flagged = await compose(build('ocp', 'Lt Col', [GT], { chaplainAsWritten: true }));
  assert.ok(base.layers.some(l => l.key === 'grade:chest') && base.layers.some(l => l.key === `badge:${GT}`));
  assert.ok(!flagged.layers.some(l => l.meme));
  assert.deepEqual(flagged.layers.map(l => l.key), base.layers.map(l => l.key));
  // The ABU is untouched: the chaplain badge stays in the stack above the tape and the grade on the collar.
  const abu = await compose(build('abu', 'Lt Col', [CHAPLAIN, GT]));
  assert.ok(abu.layers.some(l => l.key === `badge:${CHAPLAIN}`) && !abu.layers.some(l => l.key === `badge:${CHAPLAIN}:chest`));
});
