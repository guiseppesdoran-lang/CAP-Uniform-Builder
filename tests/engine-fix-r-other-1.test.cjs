'use strict';
// FIX-R-OTHER-r1 review findings (engine side). One block per finding.

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
const INK = require('./helpers/ink-rest.cjs');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} vs ${b.toFixed(3)}`);

// ---- 1. Cadet NCO lapel chevrons rest on the gorge seam on the semi-formal too ------------------------

test('semi-formal cadet NCO chevrons rest on the gorge seam exactly as on the Class A (4.1.3.2, 4.1.4, 4.1.5.2.1.4, 4.1.9.3.5)', async () => {
  for(const sex of ['male', 'female']){
    const coat = await store.load(sex === 'male' ? 'garment-blues-class-a-coat' : 'garment-blues-class-a-coat-female');
    const semi = await compose(build('semi_formal_usaf', sex, 'cadet', 'C/SSgt', []));
    const a = await compose(build('blues_a', sex, 'cadet', 'C/SSgt', []));
    for(const side of ['right', 'left']){
      const s = byKey(semi, 'grade:' + side), c = byKey(a, 'grade:' + side);
      assert.ok(s && c, `${sex} ${side}: both coats draw the chevron`);
      near(s.y + s.h, c.y + c.h, 0.005, `${sex} ${side}: semi-formal chevron bottom equals the Class A's`);
      // The ink rests on the seam (FIX-R-OTHER-r2 #1; D8: the box bottom was 4.715 / 4.13 in, the ink is lower in the box).
      near(INK.placedInkGap(coat, side, s), 0, 0.006, `${sex} ${side}: lowest ink of the semi-formal chevron on the seam`);
    }
  }
});

// ---- 2. Cadet-only badges are not drawn on adults, and the other way round ----------------------------

test('a senior member is never shown a cadet-only badge, with a note (4.1.5.2.2.4.2, 4.1.9.4.4.2)', async () => {
  for(const uniform of ['blues_a', 'blues_b', 'aviator']){
    for(const sex of ['male', 'female']){
      const scene = await compose(build(uniform, sex, 'senior', 'Capt', ['model_rocketry_badge', 'stem_badges', 'cyber_badges', 'nra_marksman_badge', 'emergency_services_badge']));
      const ids = scene.layers.filter(l => l.role === 'badge').map(l => l.key);
      for(const id of ['model_rocketry_badge', 'stem_badges', 'cyber_badges', 'nra_marksman_badge']) assert.ok(!ids.includes('badge:' + id), `${uniform} ${sex}: ${id} is not drawn on a senior member`);
      assert.ok(scene.notes.some(n => /Model Rocketry Badge is worn by cadets only \(CAPR 39-1, 4\.1\.5\.2\.2\.4\.2\)/.test(n)), `${uniform} ${sex}: the note names the badge and paragraph: ${scene.notes.join(' | ')}`);
    }
  }
});

test('a cadet keeps the cadet-only badges and is not shown a badge the chart does not authorize for cadets', async () => {
  const scene = await compose(build('blues_a', 'male', 'cadet', 'C/Maj', ['model_rocketry_badge', 'senior_advisory_group_badge']));
  const ids = scene.layers.filter(l => l.role === 'badge').map(l => l.key);
  assert.ok(ids.includes('badge:model_rocketry_badge'), 'the cadet wears the rocketry badge');
  assert.ok(!ids.includes('badge:senior_advisory_group_badge'), 'a cadet does not wear a CAP service badge');
  assert.ok(scene.notes.some(n => /not worn by cadets/.test(n)));
});

// ---- 3. Class A: the edge-on epaulet or board carries the grade too (R7, D6, D42) -------------------------

test('Class A and semi-formal: the edge-on epaulet strip carries the grade, 5/8 in from its outer end, as well as the view from above', async () => {
  const cases = [
    ['blues_a', 'male', 'senior', 'Capt'], ['blues_a', 'male', 'senior', 'Col'], ['blues_a', 'male', 'senior', 'Maj Gen'],
    ['blues_a', 'female', 'senior', 'Capt'], ['blues_a', 'female', 'senior', 'Brig Gen'],
    ['blues_a', 'male', 'cadet', 'C/Maj'], ['blues_a', 'female', 'cadet', 'C/Col'],
    ['semi_formal_usaf', 'male', 'cadet', 'C/Maj'], ['semi_formal_usaf', 'female', 'cadet', 'C/2d Lt']
  ];
  for(const [uniform, sex, membership, rank] of cases){
    const scene = await compose(build(uniform, sex, membership, rank, []));
    for(const side of ['right', 'left']){
      const edge = byKey(scene, `grade:edge-${side}`);
      assert.ok(edge, `${uniform} ${sex} ${rank}: grade on the ${side} edge-on strip`);
    }
    assert.ok(scene.layers.some(l => l.role === 'epaulet-top' && l.key === 'epaulet-top:right'), `${uniform} ${sex} ${rank}: the view from above is still drawn`);
  }
});

test('Class A officer: the edge-on grade lies 5/8 in from the outer end of the strap, on the strap axis (DAFI 36-2903 4.5.1.1.1)', async () => {
  const scene = await compose(build('blues_a', 'male', 'senior', 'Capt', []));
  const edge = byKey(scene, 'grade:edge-right');
  // Right strap, from the left strap axis [16.52, 2.44] -> [20.22, 3.41] mirrored on the 23.726 in coat.
  const neck = { x: 23.726 - 16.52, y: 2.44 }, arm = { x: 23.726 - 20.22, y: 3.41 };
  const len = Math.hypot(arm.x - neck.x, arm.y - neck.y), u = { x: (neck.x - arm.x) / len, y: (neck.y - arm.y) / len };
  const c = { x: edge.x + edge.w / 2, y: edge.y + edge.h / 2 };
  // Distance of the grade centre from the outer end along the axis: 5/8 in plus half the grade's length.
  const along = (c.x - arm.x) * u.x + (c.y - arm.y) * u.y;
  assert.ok(along > 0.625 && along < 0.625 + 0.5, `grade ${along.toFixed(3)} in from the outer end`);
  const across = Math.abs((c.x - arm.x) * u.y - (c.y - arm.y) * u.x);
  assert.ok(across < 0.05, `centred on the strap axis (${across.toFixed(3)} in off)`);
});

// ---- 4. Class B short sleeve: the chevron is centred on the outer arm (4.1.11.1.1.1.3, 4.1.12.2.3.3) --------

test('Class B short sleeve: the sleeve chevron is centred on the drawn sleeve halfway between the shoulder seam and the sleeve bottom', async () => {
  // D8 (FIX-ART-r1 item 2, CAPR 39-1 4.1.11.1.1.1.3, 4.1.12.2.3.3): the sheets now carry chevron_halfway anchors and their short sleeves are widened
  // until the true-size 3 1/2 in chevron lies between the outline and the armhole seam; this asserted the old fixed midline (2.02 / 2.42 in) and that the
  // chevron passed the seam by up to 0.35 in (the wedge sleeve), which the art no longer does.
  for(const [sex, garment, size] of [['male', 'garment-blues-class-b-shirt-male', 3.5], ['female', 'garment-blues-class-b-blouse-female', 3.5]]){
    const spec = await store.load(garment);
    const sh = core.anchor(spec, 'shoulder_seam_right'), bottom = core.anchor(spec, 'sleeve_bottom_right'), half = core.anchor(spec, 'chevron_halfway_right'), halfL = core.anchor(spec, 'chevron_halfway_left');
    assert.ok(half && halfL, `${sex}: the sheet states chevron_halfway on both sleeves`);
    near(half.y, (sh.y + bottom.y) / 2, 0.01, `${sex}: chevron_halfway is halfway between the shoulder seam and the sleeve bottom`);
    const scene = await compose(build('blues_b', sex, 'senior', 'SMSgt', [], { opt: { sleeve: 'short', headgear: 'auto' } }));
    const r = byKey(scene, 'grade:sleeve-right'), l = byKey(scene, 'grade:sleeve-left');
    assert.ok(r && l, `${sex}: both sleeves carry the chevron`);
    near(r.x + r.w / 2, half.x, 0.03, `${sex}: right chevron centred on the sleeve's midline`);
    near(l.x + l.w / 2, halfL.x, 0.03, `${sex}: left chevron centred on its midline`);
    near(r.y + r.h / 2, (sh.y + bottom.y) / 2, 0.05, `${sex}: halfway between the shoulder seam and the bottom edge of the sleeve`);
    near(r.w, size, 0.01, `${sex}: regulation 3 1/2 in width, not scaled`);
    // The sleeve is wide enough: every row of the chevron clears the outer edge and the armhole seam (recorded by the art generator, base-art/make-blues-b.js).
    const fit = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', garment + '.spec.json'), 'utf8')).dimensions.sleeve_widening.chevron_3p5_fit;
    for(const side of ['right', 'left']){
      assert.ok(fit[side]['3p5'].outer_clearance_in >= 0.05, `${sex} ${side}: the chevron clears the sleeve's outer edge by ${fit[side]['3p5'].outer_clearance_in} in`);
      assert.ok(fit[side]['3p5'].seam_clearance_in >= 0.05, `${sex} ${side}: the chevron's inner edge is outside the armhole seam by ${fit[side]['3p5'].seam_clearance_in} in`);
    }
  }
});

// ---- 8. Mini medal devices are not hidden under the medal bodies of the row above ----------------------------

const HARNESS = require('../scripts/render-builds.cjs');
const TWELVE = [['distinguished_service_award'], ['exceptional_service_award'], ['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'], ['air_search_and_rescue_ribbon'], ['cap_gill_robb_wilson_ribbon'], ['cap_command_service_ribbon'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];

test('12 miniatures: no device on a lower row lies under the medal bodies of a row above (11.4.2, 11.2.8)', async () => {
  for(const [uniform, sex, rank, columns] of [['mess_dress', 'male', 'Col', 4], ['mess_dress', 'female', 'Col', 4], ['semi_formal', 'male', 'Capt', 4], ['semi_formal', 'female', 'Lt Col', 3]]){
    const b = HARNESS.makeBuild({ uniform, gender: sex, membership: 'senior', rank, ribbonSel: TWELVE, medalSel: true, opt: { rackColumns: columns, rackArrangement: 'lapel', miniStyle: 'mounting' } });
    const scene = await compose(b);
    const devices = scene.layers.filter(l => l.role === 'device' && /^mini:/.test(l.key));
    assert.ok(devices.length >= 3, `${uniform} ${sex}: the build has devices to check (${devices.length})`);
    const bodies = scene.layers.filter(l => l.role === 'mini-medal');
    for(const d of devices){
      // The device is turned a quarter: its box is its height wide and its width tall, about its centre.
      const cx = d.origin.x, cy = d.origin.y, hw = d.h / 2, hh = d.w / 2;
      for(const m of bodies){
        if(m.z <= d.z + 0.05) continue; // the same row or below
        const hit = cx + hw > m.x && cx - hw < m.x + m.w && cy + hh > m.y && cy - hh < m.y + m.h;
        assert.ok(!hit, `${uniform} ${sex}: device ${d.key} (y ${(cy - hh).toFixed(2)}-${(cy + hh).toFixed(2)}) is under the body ${m.key} (y ${m.y.toFixed(2)}-${(m.y + m.h).toFixed(2)})`);
      }
      // ... and stays on its drape, above the V point.
      const drape = scene.layers.find(l => l.role === 'mini-drape' && d.key.startsWith(l.key + ':'));
      assert.ok(drape && cy - hh >= drape.y - 1e-6 && cy + hh <= drape.y + drape.h - 0.14, `${uniform} ${sex}: ${d.key} is on its drape`);
    }
  }
});

// ---- 9. Corporate semi-formal: the lapel does not cover the minis; the chaplain badge stays in view ----------

// D8 (FIX-R-OTHER-r1 review round 3, 11.2.8): this test asserted the lapel foreground over every miniature
// medal (bea100ae); the lapel is now drawn under them and the rack slides clear of it (tests/engine-fix-r-other-3).
test('semi-formal blazer: the lapel foreground is under the miniature medals and the chaplain badge, the lowest row keeps its line (4.2.1.4, 4.2.2.4, 11.2.8)', async () => {
  for(const sex of ['male', 'female']){
    const b = HARNESS.makeBuild({ uniform: 'semi_formal', gender: sex, membership: 'senior', rank: 'Col', ribbonSel: TWELVE.slice(0, 7), medalSel: true, badgeIds: ['christian_chaplin'], opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } });
    const scene = await compose(b);
    const fg = scene.layers.find(l => l.role === 'garment-foreground' && l.onlyGroups && l.onlyGroups.includes('lapel-foreground'));
    assert.ok(fg, `${sex}: the lapel foreground is drawn`);
    const minis = scene.layers.filter(l => /^mini-/.test(l.role));
    assert.ok(minis.length && minis.every(l => l.z > fg.z), `${sex}: every miniature lies over the lapel foreground`);
    const chap = scene.layers.find(l => l.key === 'badge:christian_chaplin');
    assert.ok(chap && chap.z > fg.z, `${sex}: the chaplain badge is over the lapel foreground`);
  }
});

// ---- 10. Mess dress boards: edge-on strip at the shoulder line plus the view from above, both with the grade (R7) ----

test('mess dress officers: each shoulder has an edge-on strip and a lifted view from above, both carrying the grade', async () => {
  for(const [sex, rank] of [['male', 'Capt'], ['male', 'Col'], ['male', 'Maj Gen'], ['female', 'Lt Col'], ['female', 'Brig Gen']]){
    const scene = await compose(build('mess_dress', sex, 'senior', rank, []));
    for(const side of ['right', 'left']){
      const top = byKey(scene, `epaulet-top:${side}`), edge = byKey(scene, `epaulet-edge:${side}`);
      const gTop = byKey(scene, `grade:top-${side}`), gEdge = byKey(scene, `grade:edge-${side}`);
      assert.ok(top && edge && gTop && gEdge, `${sex} ${rank} ${side}: edge-on strip, view from above and both grades`);
      assert.ok(top.clip && top.y < -1.5, `${sex} ${rank} ${side}: the view from above is the board art lifted (${top.y.toFixed(2)} in) and clipped to the board`);
      // The edge-on grade lies on the strip's centre line.
      const th = (side === 'right' ? edge.rotate : edge.rotate - 180) * Math.PI / 180;
      const n = { x: Math.sin(th), y: -Math.cos(th) }; // perpendicular to the strip
      const gc = { x: gEdge.origin.x, y: gEdge.origin.y };
      assert.ok(Math.abs((gc.x - edge.origin.x) * n.x + (gc.y - edge.origin.y) * n.y) < 0.12, `${sex} ${rank} ${side}: the grade is on the strip`);
      near(edge.h, 0.4, 0.001, `${sex} ${rank} ${side}: the strip is 0.4 in thick`);
    }
  }
  const male = await compose(build('mess_dress', 'male', 'senior', 'Capt', []));
  assert.ok(!male.notes.some(n => /No artwork/.test(n)));
});

// ---- 11. The one-aviation-badge note cites the uniform's own paragraph ------------------------------------------

test('the one-aviation-badge note cites the uniform\'s own paragraph and is not given on the corporate blazers', async () => {
  const two = ['CAPPilot1_FA9D33EA587D8', 'observer_badge'];
  const note = async (uniform, sex, rank) => (await compose(build(uniform, sex, 'senior', rank, two))).notes.find(n => /Only one CAP aviation badge/.test(n));
  assert.match(await note('mess_dress', 'male', 'Col'), /4\.1\.1\.1\.3\.1\)/);
  assert.match(await note('mess_dress', 'female', 'Col'), /4\.1\.2\.1\.2\.5\)/);
  assert.match(await note('blues_a', 'male', 'Capt'), /4\.1\.5\.2\.2\.4\.1\)/);
  assert.match(await note('blues_a', 'female', 'Capt'), /4\.1\.9\.4\.4\.1\)/);
  assert.match(await note('blues_b', 'male', 'Capt'), /4\.1\.11\.1\.1\.2\.3\.1\)/);
  assert.match(await note('aviator', 'female', 'Capt'), /4\.2\.6\.2\.7\.1\)/);
  assert.equal(await note('semi_formal', 'male', 'Capt'), undefined);
  // The aviator shirt beside the blazer wears one aviation badge, so its note is given with the shirt's own paragraph
  // (FIX-R-OTHER-r4 item 5; D8: the blazer rule used to hide it, the shirt silently dropped the observer badge).
  assert.match(await note('aviator_blazer', 'female', 'Capt'), /4\.2\.6\.2\.7\.1\)/);
  assert.match(await note('aviator_blazer', 'male', 'Col'), /4\.2\.5\.1\.3\.1\)/);
  const blz = await compose(build('aviator_blazer', 'female', 'senior', 'Capt', two));
  assert.ok(blz.notes.some(n => /worn on the blazer; the other badges are not worn on it, the shirt beside it shows/.test(n)), 'the blazer note says the badges are not worn on the blazer');
  assert.equal(blz.layers.filter(l => /^badge:/.test(l.key)).length, 1, 'one aviation badge on the shirt, the second is dropped with a note');
  // With a turtleneck there is no shirt beside the blazer and the blazer's note keeps its plain wording.
  const turtle = await compose(build('aviator_blazer', 'female', 'senior', 'Capt', two, { opt: { headgear: 'auto', underlayer: 'turtleneck' } }));
  assert.ok(turtle.notes.some(n => /are worn on this uniform; the other badges are not shown/.test(n)), 'no shirt beside the blazer: the plain note');
  assert.ok(!turtle.notes.some(n => /Only one CAP aviation badge/.test(n)));
  const semi = await compose(build('semi_formal', 'male', 'senior', 'Capt', two));
  assert.ok(semi.notes.some(n => /Only the chaplain badge and the CSAG/.test(n)), 'the corporate badge note stays');
});

// ---- 13. The ES badges have no genuine field artwork: no field uniform draws them (LIVE-FIELD B6) -----------------------------

test('the Emergency Services badges are dress-only: the OCP, ABU and CFU draw the aviation badge alone and note the ES badge as having no field artwork', async () => {
  const B = require('../data/badge-catalog.js');
  for(const id of ['emergency_services_badge', 'senior_emergency_services_badge', 'master_emergency_services_badge']) assert.equal(B.art(id, 'field'), null, `${id} has no field form`);
  const badges = ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge'];
  for(const u of ['ocp', 'abu', 'corporate_field']){
    const scene = await compose(build(u, 'male', 'senior', 'Col', badges));
    assert.ok(byKey(scene, 'badge:CAPPilot1_FA9D33EA587D8'), `${u}: the pilot badge is drawn`);
    assert.ok(!byKey(scene, 'badge:emergency_services_badge'), `${u}: no ES badge`);
    assert.ok(scene.notes.some(n => /has no field artwork/.test(n)), `${u}: ${scene.notes.join(' | ')}`);
  }
});

// ---- 14. Patches under patches/ocp/ are crops of the old sleeve drawing: never drawn -----------------------------

test('the engine does not draw a patches/ocp crop; the harness resolves patches to full artwork as the page does (D22)', async () => {
  const crop = { id: 'TN-185_ocp_patch', title: 'TN-185', href: '/images/patches/ocp/TN-185_ocp_patch.webp', aspect: 1, slot: 'R_SHOULDER', kind: 'unit' };
  const scene = await compose(build('ocp', 'male', 'senior', 'Lt Col', ['CAPPilot1_FA9D33EA587D8'], { patches: [crop] }));
  assert.ok(!scene.layers.some(l => l.role === 'patch'), 'no patch layer from a crop');
  assert.ok(scene.notes.some(n => /only a crop of the old sleeve drawing/.test(n)), scene.notes.join(' | '));
  // The harness maps a crop to the whole patch (TN-330 has full art, archer_ocp_patch resolves through its base id) or leaves it off.
  const r = HARNESS.patchesFrom([{ id: 'TN-330_ocp_patch', kind: 'unit', img: 'patches/ocp/TN-330_ocp_patch.webp' }, { id: 'archer_ocp_patch', kind: 'general', img: 'patches/ocp/archer_ocp_patch.webp', slot: 'L_SHOULDER' }, { id: 'TN-185_ocp_patch', kind: 'unit', img: 'patches/ocp/TN-185_ocp_patch.webp' }]);
  assert.deepEqual(r.patches.map(p => p.href), ['/images/patches/sequoyah_cadet_squadron_patch.webp', '/images/patches/archer_patch.webp']);
  assert.ok(r.notes.some(n => /TN-185.*has no full patch artwork yet/.test(n)));
  const ok = await compose(HARNESS.makeBuild({ uniform: 'ocp', gender: 'male', membership: 'senior', rank: 'Lt Col', patchRefs: [{ id: 'TN-330_ocp_patch', kind: 'unit', img: 'patches/ocp/TN-330_ocp_patch.webp' }] }));
  const unit = ok.layers.find(l => l.role === 'patch' && /TN-330/.test(l.key));
  assert.ok(unit && unit.w <= 3.5 + 1e-6, 'the full patch is drawn under the flag');
});

// ---- 16. Flight suit name tag: a specialty badge is dropped for its own reason ----------------------------------

test('flight suit name tag: wings plus a specialty badge says specialty badges are not worn there, not that the tag is full (8.2.4.1, 8.3.4.1, 10.4, 10.5)', async () => {
  for(const [uniform, para] of [['flight_suit', '8.2.4.1'], ['corporate_flight_suit', '8.3.4.1']]){
    const nco = await compose(build(uniform, 'male', 'senior', 'SMSgt', ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge']));
    assert.ok(nco.notes.some(n => n === `Specialty track and service badges are not worn on the flight suit name tag (CAPR 39-1, ${para})`), `${uniform}: ${nco.notes.join(' | ')}`);
    assert.ok(!nco.notes.some(n => /at most two badges/.test(n)), `${uniform}: two badges is within the limit, so no 'at most two' note`);
    assert.ok(!nco.layers.some(l => l.key === 'badge:emergency_services_badge'));
    // Wings, an occupational badge and a third eligible badge: the tag is full, and says so.
    const full = await compose(build(uniform, 'male', 'senior', 'SMSgt', ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge', 'emt_basic_badge']));
    assert.ok(full.notes.some(n => /at most two badges/.test(n)), `${uniform}: a third eligible badge is the tag being full`);
    assert.ok(!full.notes.some(n => /Specialty track/.test(n)));
    // Wings and an occupational badge: both on the tag, no note.
    const two = await compose(build(uniform, 'male', 'senior', 'SMSgt', ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge']));
    assert.equal(two.layers.filter(l => l.role === 'badge' && l.figure !== 2).length, 2);
    assert.ok(!two.notes.some(n => /name tag/.test(n)));
  }
});

// ---- 4 (r2). The short-sleeve chevron is clipped to the garment silhouette (4.1.11.1.1.1.3, 4.1.12.2.3.3) -----------

function silhouette(garment){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', garment + '.svg'), 'utf8');
  const art = /<g id="[^"]*__art" transform="translate\(([\d.]+) ([\d.]+)\) scale\(100\)">/.exec(svg);
  const ox = Number(art[1]) / 100, oy = Number(art[2]) / 100;
  const d = /<clipPath id="[^"]*__clipSil"><path d="([^"]*)"/.exec(svg)[1];
  return (d.match(/-?\d+\.?\d*,-?\d+\.?\d*/g) || []).map(t => { const [x, y] = t.split(',').map(Number); return { x: ox + x, y: oy + y }; });
}
function inPoly(p, poly){
  let c = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

test('Class B short sleeve: the sleeve chevron layer carries the sheet silhouette clip, at full size, centred on chevron_halfway', async () => {
  for(const [sex, garment, chevron] of [['male', 'garment-blues-class-b-shirt-male', ''], ['female', 'garment-blues-class-b-blouse-female', ''], ['female', 'garment-blues-class-b-blouse-female', '4']]){
    const spec = await store.load(garment);
    const sil = silhouette(garment);
    const scene = await compose(build('blues_b', sex, 'senior', 'SMSgt', [], { opt: { sleeve: 'short', headgear: 'auto', chevron } }));
    for(const side of ['right', 'left']){
      const l = byKey(scene, 'grade:sleeve-' + side);
      assert.equal(l.clipSil, garment, `${sex} ${chevron || '3.5'} ${side}: clipped to the sheet's silhouette`);
      assert.ok(l.w >= 3.5 - 0.01, 'not scaled down (R1)');
      // The clip is the silhouette itself: the chevron's centre is on the garment, and the armhole seam is not a clip edge (the shirt front beyond it is inside).
      assert.ok(inPoly({ x: l.x + l.w / 2, y: l.y + l.h / 2 }, sil), `${sex} ${side}: centre inside the silhouette`);
      const inner = side === 'right' ? l.x + l.w : l.x;
      assert.ok(inPoly({ x: inner, y: l.y + l.h / 2 }, sil), `${sex} ${side}: the part past the armhole seam lies on the shirt front, inside the silhouette`);
    }
    near(byKey(scene, 'grade:sleeve-right').x + byKey(scene, 'grade:sleeve-right').w / 2, core.anchor(spec, 'chevron_halfway_right').x, 0.03, `${sex}: centred on the sheet's chevron_halfway`);
    assert.ok(spec.w > 0);
  }
  // The long sleeve is clipped the same way (E5-CHEVRONS: every dress sleeve chevron carries the clip, R8).
  const long = await compose(build('blues_b', 'male', 'senior', 'SMSgt', [], { opt: { sleeve: 'long', headgear: 'auto' } }));
  assert.equal(byKey(long, 'grade:sleeve-right').clipSil, 'garment-blues-class-b-shirt-male-long');
});
