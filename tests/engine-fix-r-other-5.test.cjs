'use strict';
// FIX-R-OTHER-r5: cadet officer board grade (edge-on vs top-down), blazer lapel over the semi-formal's miniatures,
// OCP two-badge gap from the blue edges, cadet officer grade off the ABU/CFU tactical cap.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

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
const critique = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts', 'critique-builds.cjs')], { encoding: 'utf8' }));
const crit = name => { const c = critique.find(x => x.name === name); assert.ok(c, `critique build ${name}`); return HARNESS.makeBuild(c.build); };
const AIRCREW = 'AirCrew1_DB3F0FCC3650F';

// ---- 1. The same regular-size grade edge-on and from above on the Class A and the cadet semi-formal coat --------------

test('Class A and cadet semi-formal coats: a cadet officer\'s edge-on strip carries the same regular-size grade as the top-down board, as long along the strap and squeezed only across it (CAPR 39-1 4.1.5.2.1.3, 4.1.9.3.4; R7)', async () => {
  const along = (l, u) => {
    const R = rad(l.rotate || 0), c = Math.cos(R), s = Math.sin(R);
    return Math.abs(l.w * (c * u.x + s * u.y)) + Math.abs(l.h * (-s * u.x + c * u.y));
  };
  let n = 0;
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const gender of ['male', 'female']) for(const rank of ['C/2d Lt', 'C/1st Lt', 'C/Capt', 'C/Maj', 'C/Lt Col', 'C/Col']){
    const scene = await compose(hb(uniform, gender, 'cadet', rank, { badgeIds: [AIRCREW] }));
    for(const side of ['right', 'left']){
      const edge = byKey(scene, `grade:edge-${side}`), top = byKey(scene, `grade:top-${side}`);
      const label = `${uniform} ${gender} ${rank} ${side}`;
      assert.ok(edge && top, `${label}: both views carry the grade`);
      assert.match(edge.id, /-metal-regular$/, `${label}: edge-on grade is the regular size (${edge.id})`);
      assert.equal(edge.id, top.id, `${label}: one grade in both views`);
      const r = rad(edge.rotate || 0), axis = { x: -Math.sin(r), y: Math.cos(r) }, cross = { x: Math.cos(r), y: Math.sin(r) };
      // The top view is level (DORAN5-ENG-3): its board's long axis is horizontal, so the grade's length along the board is measured horizontally.
      const level = { x: 1, y: 0 };
      assert.ok(Math.abs(along(edge, axis) - along(top, level)) <= 0.05, `${label}: along the strap ${along(edge, axis).toFixed(3)} edge-on vs ${along(top, level).toFixed(3)} from above`);
      assert.ok(along(edge, cross) <= 0.425, `${label}: squeezed to the 0.5 in board strip (${along(edge, cross).toFixed(3)} across)`);
      n++;
    }
  }
  assert.equal(n, 48);
});

test('Class A and cadet semi-formal coats: the edge-on grade\'s centre is as far from the strap\'s outer end as the top view\'s rank slot is from the board\'s outer end, on both sides and both cuts (R7; the board sheets\' rank_slot_center and board_outer_end)', async () => {
  // The strap's outer end is the shoulder point of the seam the coat sheet draws (its outline, tests/helpers/class-a-sheet.cjs), each side's own.
  const SHEET = require('./helpers/class-a-sheet.cjs');
  const COATS = { blues_a: { male: 'garment-blues-class-a-coat', female: 'garment-blues-class-a-coat-female' }, semi_formal_usaf: { male: 'garment-semiformal-class-a-coat-male', female: 'garment-semiformal-class-a-coat-female' } };
  let n = 0;
  for(const uniform of ['blues_a', 'semi_formal_usaf']) for(const gender of ['male', 'female']) for(const rank of ['C/2d Lt', 'C/Maj', 'C/Col']){
    const scene = await compose(hb(uniform, gender, 'cadet', rank, { badgeIds: [AIRCREW] }));
    for(const side of ['right', 'left']){
      const bs = await store.load(`garment-blues-shoulder-board-top-${gender}-${side}`);
      const slot = core.anchor(bs, 'rank_slot_center'), outer = core.anchor(bs, 'board_outer_end');
      const want = Math.hypot(slot.x - outer.x, slot.y - outer.y);
      const edge = byKey(scene, `grade:edge-${side}`);
      const end = SHEET.seam(COATS[uniform][gender], side).outer;
      const got = Math.hypot(edge.origin.x - end.x, edge.origin.y - end.y);
      assert.ok(Math.abs(got - want) < 0.02, `${uniform} ${gender} ${rank} ${side}: edge-on centre ${got.toFixed(3)} in from the strap's outer end, the top view's slot is ${want.toFixed(3)} in from the board's`);
      n++;
    }
  }
  assert.equal(n, 24);
});

test('the blue shirt\'s epaulet sleeves keep the cadet officer\'s miniature metal grade (CAPR 39-1 4.1.6.1.4)', async () => {
  for(const gender of ['male', 'female']){
    const scene = await compose(hb('blues_b', gender, 'cadet', 'C/Maj', { badgeIds: [AIRCREW] }));
    const edge = byKey(scene, 'grade:edge-right');
    assert.ok(edge, 'edge-on grade drawn');
    assert.match(edge.id, /-metal-miniature$/);
  }
});

// ---- 2. The blazer's left lapel and the semi-formal's miniature medals --------------------------------------------------

test('semi-formal blazer: the rack is centred above the pocket and the lapel lies over its inner corner, so a lapel foreground is clipped above the miniature medals and the note says so (CAPR 39-1 4.2.2.4 with ICL 25-02, 11.1.8; D8: it was clear of the lapel before the ICL ruling)', async () => {
  for(const gender of ['male', 'female']){
    const scene = await compose(crit(`semi_formal-${gender}-senior-Capt-12minis`));
    const drapes = scene.layers.filter(l => l.role === 'mini-drape');
    assert.ok(drapes.length, `${gender}: miniature medals drawn`);
    const fg = scene.layers.filter(l => l.key === 'layer:foreground' && l.clip);
    assert.equal(fg.length, 1, `${gender}: the lapel foreground is clipped over the miniature medals`);
    assert.ok(fg[0].z > Math.max(...drapes.map(l => l.z)), `${gender}: above every medal`);
    assert.ok(scene.notes.some(n => /lapel lies over the inner corner of the miniature medals/.test(n)), `${gender}: the note about the lapel over the medals`);
  }
});

// ---- 3. OCP: two badges are 1/2 in apart from blue edge to blue edge --------------------------------------------------

test('OCP two chest badges: the upper badge\'s blue bottom edge is 1/2 in above the lower one\'s blue top edge (CAPR 39-1 ICL 26-14 7.1.1.3.1, 7.1.1.3.1.2); the ABU and CFU stay silver to silver', async () => {
  for(const gender of ['male', 'female']) for(const [membership, rank, ids] of [['cadet', 'C/SSgt', [AIRCREW, 'ground_team_basic_badge']], ['cadet', 'C/Maj', [AIRCREW, 'ground_team_basic_badge']], ['senior', 'Capt', ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge']], ['senior', 'SMSgt', ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge']]]){
    const scene = await compose(hb('ocp', gender, membership, rank, { badgeIds: ids }));
    const bs = scene.layers.filter(l => l.role === 'badge').sort((a, b) => a.y - b.y);
    assert.equal(bs.length, 2, `${gender} ${rank}: two badges`);
    const gap = bs[1].y - (bs[0].y + bs[0].h);
    assert.ok(Math.abs(gap - 0.5) < 0.005, `${gender} ${rank}: blue to blue ${gap.toFixed(3)} in`);
  }
  // Silver to silver on the CFU (5.2.1.1.2.6 'insignia-to-insignia, not blue to blue'): the blue gap is 1/2 in plus both borders.
  const scene = await compose(hb('corporate_field', 'male', 'senior', 'Capt', { badgeIds: ['CAPPilot1_FA9D33EA587D8', 'observer_badge'] }));
  const bs = scene.layers.filter(l => l.role === 'badge').sort((a, b) => a.y - b.y);
  if(bs.length === 2) assert.ok(bs[1].y - (bs[0].y + bs[0].h) < 0.5 - 0.01, 'CFU: silver to silver leaves less than 1/2 in of blue to blue');
});

// ---- 4. ABU and CFU navy tactical cap: the cadet officer's grade (ICL 25-02 6.2.11 vs 6.2.11.1) ------------------------------
// FIX-R-OTHER-r5 #4 left it off (6.2.11.1 wins); LIVE-ENGINE 4 (Ethan's ruling) shows it for cadet officers, not for cadet NCOs and airmen.

test('ABU and CFU: a cadet officer wears the grade on the navy tactical cap (ICL 25-02 6.2.11) and on the patrol cap (5.1.1.6); the OCP ball cap keeps it (7.1.1.8); cadet NCOs wear none (6.2.11.1)', async () => {
  // One cap is drawn (LIVE-ENGINE 3): the tactical cap is chosen for the tactical zone, the default patrol cap for the patrol one.
  const tactical = { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting', headgear: 'tactical' };
  for(const gender of ['male', 'female']) for(const u of ['abu', 'corporate_field']){
    const scene = await compose(hb(u, gender, 'cadet', 'C/Maj', { badgeIds: [AIRCREW], opt: tactical }));
    assert.ok(byKey(scene, 'grade:baseball_cap_front_insignia_zone'), `${u} ${gender}: the grade on the tactical cap`);
    assert.ok(scene.notes.some(n => /6\.2\.11\.1/.test(n)), `${u} ${gender}: note cites 6.2.11.1`);
    const patrol = await compose(hb(u, gender, 'cadet', 'C/Maj', { badgeIds: [AIRCREW] }));
    assert.ok(byKey(patrol, 'grade:patrol_cap_front_insignia_zone'), `${u} ${gender}: the patrol cap keeps the cadet officer grade`);
    const nco = await compose(hb(u, gender, 'cadet', 'C/SSgt', { badgeIds: [AIRCREW], opt: tactical }));
    assert.ok(!byKey(nco, 'grade:baseball_cap_front_insignia_zone'), `${u} ${gender}: a cadet NCO wears none`);
    const sen = await compose(hb(u, gender, 'senior', 'Capt', { badgeIds: ['CAPPilot1_FA9D33EA587D8'], opt: tactical }));
    assert.ok(byKey(sen, 'grade:baseball_cap_front_insignia_zone'), `${u} ${gender}: a senior officer keeps the grade on the tactical cap`);
  }
  const ocp = await compose(hb('ocp', 'male', 'cadet', 'C/Maj', { badgeIds: [AIRCREW], opt: tactical }));
  assert.ok(byKey(ocp, 'grade:baseball_cap_front_insignia_zone'), 'OCP ball cap keeps the cadet officer grade');
});
