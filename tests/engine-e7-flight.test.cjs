'use strict';
// E7-FLIGHT: the flight duty uniforms and flight jackets (CAPR 39-1 ch. 8, 6.1.7), measured in inches
// on the composed scene: officer grade 1/2 in from the shoulder seam, general officer stars centred
// on the shoulder, the name tag's badge (ONE on every tag, Ethan's ruling over 8.2.4.1's 'up to two', LIVE-FIELD B8), the chest layout, the ES patch under the pocket.

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
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const EPS = 0.006;
const ST = store();

function build(uniform, membership, rank, extra){
  const b = Object.assign({
    uniform, gender: 'male', grade: G.gradeInfo(membership, rank, {}),
    opt: { headgear: 'auto', jacket: true }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
  if(extra && extra.opt) b.opt = Object.assign({ headgear: 'auto', jacket: true }, extra.opt);
  return b;
}
const PILOT = { id: 'CAPPilot1_FA9D33EA587D8', title: 'Pilot Badge' };
const GROUND_TEAM = { id: 'ground_team_basic_badge', title: 'Ground Team Badge' };
const GROUP_PIN = { id: 'group_commander_badge', title: 'Group Commander Badge', graduated: false };

// Both figures of a flight build: the suit (figure 1) and the jacket drawn beside it (figure 2).
const FIGURES = [
  { name: 'FDU', uniform: 'flight_suit', garment: 'garment-fdu-flight-suit', jacket: false },
  { name: 'CFDU', uniform: 'corporate_flight_suit', garment: 'garment-cfdu-flight-suit', jacket: false },
  { name: 'green jacket', uniform: 'flight_suit', garment: 'garment-flight-jacket-green', jacket: true },
  { name: 'blue jacket', uniform: 'corporate_flight_suit', garment: 'garment-flight-jacket-blue', jacket: true }
];

// A landmark of the garment as a rect in scene inches.
async function zoneOf(scene, garmentId, name){
  const spec = await ST.load(garmentId);
  const g = scene.layers.find(l => l.id === garmentId);
  assert.ok(g, `${garmentId} is in the scene`);
  const r = core.landmarkBounds(spec, name);
  assert.ok(r, `${garmentId} has ${name}`);
  const s = g.w / spec.w;
  return { x: g.x + r.x * s, y: g.y + r.y * s, w: r.w * s, h: r.h * s };
}
const onFigure = (scene, f, pred) => scene.layers.filter(l => (f.jacket ? l.figure === 2 : l.figure !== 2) && pred(l));

// ---- officer grade and general officer stars on the shoulders ---------------------------------

// D8 (FIX-R-OTHER-r1 review round 3, 8.2.3.2 / 8.3.3.2): the grade is 'centered on top of each shoulder with bottom edge
// of insignia placed 1/2 inch from shoulder seam', so the leaf and the eagle are turned 90 deg clockwise on the wearer's
// right and 90 deg counter-clockwise on the left (as the general officer stars, 8.2.3.1), their bottoms toward the seam.
// FIX-R-OTHER-r4 item 10 (D8): the bars (2d Lt, 1st Lt, Captain, the flight officer grades) are NOT turned: they stand
// upright, each bar along the seam and the pair side by side toward the neck, as on the Class B epaulet seen from above
// (bars across the strap, parallel to the seam; R8) and as the grade zone (1.60 x 1.25 in) is sized; turned they ran from
// the neck to the sleeve, across the seam. The piece's outer edge, its edge toward the seam, is on the half inch line.
const BARS = new Set(['2d Lt', '1st Lt', 'Capt', 'FO', 'TFO', 'SFO']);
test('officer grade: bars upright with their outer edge on the half inch line, leaf and eagle turned a quarter turn with their bottom edge on it, centred in height, never scaled (8.2.3.2, 8.3.3.2, 6.1.7)', async () => {
  const ranks = ['2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col'];
  for(const f of FIGURES){
    for(const rank of ranks){
      const scene = await P.composeUniform(build(f.uniform, 'senior', rank), store());
      const grades = onFigure(scene, f, l => l.role === 'grade');
      assert.equal(grades.length, 2, `${f.name} ${rank}: one grade piece on each shoulder`);
      const right = grades.find(l => l.key === 'grade:right'), left = grades.find(l => l.key === 'grade:left');
      const zr = await zoneOf(scene, f.garment, 'grade_zone_right');
      const zl = await zoneOf(scene, f.garment, 'grade_zone_left');
      const spec = await ST.load(right.id);
      const bars = BARS.has(rank);
      assert.equal(right.rotate, bars ? 0 : 90, `${f.name} ${rank}: wearer's right ${bars ? 'upright, the bars along the seam' : 'turned 90 deg clockwise (bottom toward the seam)'}`);
      assert.equal(left.rotate, bars ? 0 : -90, `${f.name} ${rank}: wearer's left ${bars ? 'upright' : 'turned 90 deg counter-clockwise'}`);
      assert.ok(Math.abs(right.w - spec.w) < 1e-6 && Math.abs(right.h - spec.h) < 1e-6, `${f.name} ${rank}: not scaled`);
      // The width along the shoulder is the piece's width when upright and its height when turned; the wearer's right
      // shoulder is the left of the picture, its seam side the zone's left edge: that is the piece's outer edge.
      const alongR = bars ? right.w : right.h, alongL = bars ? left.w : left.h;
      const rightSeamEdge = right.x + right.w / 2 - alongR / 2, leftSeamEdge = left.x + left.w / 2 + alongL / 2;
      assert.ok(Math.abs(rightSeamEdge - zr.x) < EPS, `${f.name} ${rank}: right grade outer edge ${rightSeamEdge.toFixed(3)} on the zone's seam edge ${zr.x.toFixed(3)}`);
      assert.ok(Math.abs(leftSeamEdge - (zl.x + zl.w)) < EPS, `${f.name} ${rank}: left grade outer edge on the zone's seam edge`);
      // Centred in the zone's height; a piece taller than the zone (the colonel's turned 1.59 in eagle against 1.25 in)
      // hangs from the zone's top instead of overflowing both ends onto the shoulder outline (FIX-R-OTHER-r2 #9).
      const highH = bars ? spec.h : spec.w, zoneH = Math.max(zr.h, highH);
      assert.ok(Math.abs((right.y + right.h / 2) - (zr.y + zoneH / 2)) < EPS && Math.abs((left.y + left.h / 2) - (zl.y + zoneH / 2)) < EPS, `${f.name} ${rank}: centred in the zone's height, or hung from its top when taller`);
      assert.ok(rightSeamEdge + alongR <= zr.x + zr.w + EPS, `${f.name} ${rank}: inside the zone along the shoulder`);
      // The bars fit the zone, which the art sized for them upright.
      if(bars) assert.ok(right.h <= zr.h + EPS && right.w <= zr.w + EPS, `${f.name} ${rank}: the upright bars (${right.w.toFixed(2)} x ${right.h.toFixed(2)} in) lie inside the ${zr.w.toFixed(2)} x ${zr.h.toFixed(2)} in zone`);
      // The colonel's eagle faces the wearer's front on both shoulders: mirrored on the right only.
      assert.equal(!!right.flipX, rank === 'Col', `${f.name} ${rank}: eagle mirrored on the wearer's right`);
      assert.ok(!left.flipX, `${f.name} ${rank}: not mirrored on the left`);
    }
  }
});

test('flight officers (FO, TFO, SFO) wear the same shoulder grade placement as the other bars', async () => {
  for(const rank of ['FO', 'TFO', 'SFO']){
    const scene = await P.composeUniform(build('flight_suit', 'senior', rank), store());
    const grades = onFigure(scene, FIGURES[0], l => l.role === 'grade');
    assert.equal(grades.length, 2, rank);
    const zr = await zoneOf(scene, FIGURES[0].garment, 'grade_zone_right');
    const r = grades.find(l => l.key === 'grade:right');
    assert.equal(r.rotate, 0, rank);
    assert.ok(Math.abs(r.x - zr.x) < EPS, rank);
  }
});

// The bars on the flight shoulder lie as they do on the Class B epaulet seen from above: their long axis (the art's height)
// perpendicular to the strap, i.e. parallel to the armhole seam (R7, R8, FIX-R-OTHER-r4 item 10; 8.2.3.2, 4.2.5.1.1.1).
test('flight shoulder bars match the epaulet\'s top view: the long axis of the bars is across the strap, along the seam', async () => {
  const axisOf = l => { const r = (l.rotate || 0) * Math.PI / 180; return { x: -Math.sin(r), y: Math.cos(r) }; };   // the art's height direction
  const cb = await P.composeUniform(build('blues_b', 'senior', 'Capt'), store());
  // The Class B captain's bars are placed by gradeOnStrap (the edge-on strip) with the same quarter turn the epaulet's top view art carries;
  // the strip's strap axis is the top view's long side.
  const top = cb.layers.find(l => l.key === 'grade:edge-right'), view = cb.layers.find(l => l.key === 'epaulet-top:right');
  assert.ok(top && view, 'the Class B captain has the epaulet view and the grade on the strip');
  const vr = (view.rotate || 0) * Math.PI / 180, strap = { x: -Math.sin(vr), y: Math.cos(vr) };     // the view's long side
  const a = axisOf(top);
  assert.ok(Math.abs(a.x * strap.x + a.y * strap.y) < 0.45, `Class B top view: the bars' long axis is across the strap (dot ${(a.x * strap.x + a.y * strap.y).toFixed(2)})`);
  for(const f of FIGURES){
    const scene = await P.composeUniform(build(f.uniform, 'senior', 'Capt'), store());
    for(const l of onFigure(scene, f, l => l.role === 'grade')){
      const ax = axisOf(l);
      // The shoulder line (the strap) runs along the picture's x axis here; the bars' long axis is the picture's y axis, the seam's direction.
      assert.ok(Math.abs(ax.x) < 1e-6 && Math.abs(ax.y) > 0.999, `${f.name} ${l.key}: the bars stand along the seam (${ax.x.toFixed(2)}, ${ax.y.toFixed(2)})`);
      assert.ok(l.h > l.w, `${f.name} ${l.key}: the long side of the bars is vertical`);
    }
  }
});

test('general officers: 1 in stars centred on the shoulder, points toward the neck (8.2.3.1, 8.3.3.1)', async () => {
  for(const f of FIGURES){
    for(const rank of ['Brig Gen', 'Maj Gen']){
      const scene = await P.composeUniform(build(f.uniform, 'senior', rank), store());
      const grades = onFigure(scene, f, l => l.role === 'grade');
      assert.equal(grades.length, 2, `${f.name} ${rank}`);
      for(const side of ['right', 'left']){
        const l = grades.find(x => x.key === 'grade:' + side);
        const z = await zoneOf(scene, f.garment, 'grade_zone_go_' + side);
        // Centre of the (possibly quarter-turned) piece is the centre of the zone: halfway between the
        // neck and the shoulder seam, which is how the zone is drawn.
        assert.ok(Math.abs((l.x + l.w / 2) - (z.x + z.w / 2)) < EPS && Math.abs((l.y + l.h / 2) - (z.y + z.h / 2)) < EPS, `${f.name} ${rank} ${side}: centred in the GO zone`);
        const turned = Math.abs(l.rotate || 0) === 90;
        const w = turned ? l.h : l.w, h = turned ? l.w : l.h;
        assert.ok(w <= z.w + 0.2 && h <= z.h + 0.2, `${f.name} ${rank} ${side}: fits the zone (cloth border included)`);
      }
      // Rank is never the officer grade zone placement: general stars sit further in than the 1/2 in line.
      const zr = await zoneOf(scene, f.garment, 'grade_zone_right');
      const gr = grades.find(x => x.key === 'grade:right');
      assert.ok(gr.x + gr.w / 2 > zr.x + 0.1, `${f.name} ${rank}: not on the officer line`);
      // Stacked pair quarter-turned: points toward the neck.
      if(rank === 'Maj Gen'){
        assert.equal(grades.find(x => x.key === 'grade:right').rotate, 90);
        assert.equal(grades.find(x => x.key === 'grade:left').rotate, -90);
      }
    }
  }
});

test('NCOs and cadets wear no shoulder grade on the flight suit (8.2.3.3, 8.3.3.3)', async () => {
  for(const [m, r] of [['senior', 'SMSgt'], ['cadet', 'C/SSgt'], ['cadet', 'C/Capt']]){
    const scene = await P.composeUniform(build('flight_suit', m, r), store());
    assert.equal(scene.layers.filter(l => l.role === 'grade').length, 0, r);
  }
});

// ---- the name tag: ONE badge (LIVE-FIELD B8; Ethan over 'up to two' in 8.2.4.1, 8.3.4.1): the aviation badge, else the command pin, else the occupational badge ----

const badgeLayers = (scene, f) => onFigure(scene, f, l => l.role === 'badge');

const OFFICERS = [['senior', 'Col'], ['senior', 'Maj Gen'], ['senior', 'Capt'], ['senior', 'Brig Gen']];
const NON_OFFICERS = [['senior', 'SMSgt'], ['senior', 'MSgt'], ['cadet', 'C/Capt'], ['cadet', 'C/SSgt']];

// Tag landmark badge_zone in scene inches, from the placed tag.
async function badgeZoneOf(scene, f){
  const tagSpec = await ST.load('nametag-flight-embroidered-blank');
  const tag = onFigure(scene, f, l => l.key === 'nametag')[0];
  const r = core.landmarkBounds(tagSpec, 'badge_zone'), s = tag.w / tagSpec.w;
  return { tag, zone: { x: tag.x + r.x * s, y: tag.y + r.y * s, w: r.w * s, h: r.h * s } };
}

test('officer cloth name tag carries ONE badge: "may include one badge" (8.2.4.1, 8.3.4.1); wings win over the command pin', async () => {
  for(const f of FIGURES){
    for(const [m, r] of OFFICERS){
      const scene = await P.composeUniform(build(f.uniform, m, r, { badges: [PILOT], command: GROUP_PIN }), store());
      const bs = badgeLayers(scene, f);
      assert.equal(bs.length, 1, `${f.name} ${r}: wings and a group commander pin on an officer cloth tag show one badge`);
      assert.equal(bs[0].key, 'badge:' + PILOT.id, `${f.name} ${r}: the aeronautical rating is the one badge`);
      const { zone } = await badgeZoneOf(scene, f);
      assert.ok(Math.abs(bs[0].x + bs[0].w / 2 - (zone.x + zone.w / 2)) < EPS, `${f.name} ${r}: centred in badge_zone`);
      assert.ok(Math.abs(bs[0].y + bs[0].h / 2 - (zone.y + zone.h / 2)) < EPS, `${f.name} ${r}: centred in badge_zone height`);
      assert.ok(bs[0].x >= zone.x - EPS && bs[0].x + bs[0].w <= zone.x + zone.w + EPS && bs[0].h <= zone.h + EPS, `${f.name} ${r}: inside badge_zone`);
      assert.ok(scene.notes.some(n => /name tag carries one badge here .*8\.[23]\.4\.1.*Pilot Badge is shown; Group Commander Badge is not shown/.test(n)), `${f.name} ${r}: says the pin is not shown: ${scene.notes.join(' | ')}`);
    }
  }
});

test('officer cloth name tag, no wings: the current command pin, else the occupational badge, one badge only (8.2.4.1, 8.3.4.1)', async () => {
  const f = FIGURES[0];
  const pinOnly = await P.composeUniform(build('flight_suit', 'senior', 'Capt', { badges: [GROUND_TEAM], command: GROUP_PIN }), store());
  assert.deepEqual(badgeLayers(pinOnly, f).map(l => l.key), ['badge:' + GROUP_PIN.id]);
  assert.ok(pinOnly.notes.some(n => /Group Commander Badge is shown; Ground Team Badge is not shown/.test(n)), 'ground team badge dropped, and said');
  const occ = await P.composeUniform(build('flight_suit', 'senior', 'Capt', { badges: [GROUND_TEAM] }), store());
  assert.deepEqual(badgeLayers(occ, f).map(l => l.key), ['badge:' + GROUND_TEAM.id]);
  assert.ok(!occ.notes.some(n => /name tag/.test(n)), 'nothing dropped, no note');
  const graduated = await P.composeUniform(build('flight_suit', 'senior', 'Capt', { badges: [GROUND_TEAM], command: Object.assign({}, GROUP_PIN, { graduated: true }) }), store());
  assert.deepEqual(badgeLayers(graduated, f).map(l => l.key), ['badge:' + GROUND_TEAM.id], 'a graduated pin is not worn');
  const wingsOnly = await P.composeUniform(build('flight_suit', 'senior', 'Col', { badges: [PILOT] }), store());
  assert.equal(badgeLayers(wingsOnly, f).length, 1);
  assert.ok(!wingsOnly.notes.some(n => /name tag/.test(n)));
});

test('NCO and cadet name tags carry ONE badge: wings and the command pin show the wings, centred in badge_zone, and the note names the pin (8.2.4.1, 8.3.4.1; Ethan)', async () => {
  for(const f of FIGURES){
    for(const [m, r] of NON_OFFICERS){
      const scene = await P.composeUniform(build(f.uniform, m, r, { badges: [PILOT], command: GROUP_PIN }), store());
      const { tag, zone } = await badgeZoneOf(scene, f);
      const bs = badgeLayers(scene, f);
      assert.equal(bs.length, 1, `${f.name} ${r}: one badge`);
      assert.equal(bs[0].key, 'badge:' + PILOT.id, `${f.name} ${r}: the wings`);
      assert.ok(Math.abs(bs[0].x + bs[0].w / 2 - (zone.x + zone.w / 2)) < EPS, `${f.name} ${r}: centred in badge_zone`);
      assert.ok(bs[0].x >= zone.x - EPS && bs[0].x + bs[0].w <= zone.x + zone.w + EPS && bs[0].y >= zone.y - EPS && bs[0].y + bs[0].h <= zone.y + zone.h + EPS && bs[0].y + bs[0].h <= tag.y + tag.h / 2, `${f.name} ${r}: in badge_zone, above the name`);
      assert.ok(scene.notes.some(n => /one badge here.*Pilot Badge is shown; Group Commander Badge is not shown/.test(n)), `${f.name} ${r}: ${scene.notes.join(' | ')}`);
    }
  }
});

test('NCO tag: wings and an occupational badge show the wings only and name the occupational badge; a lone badge of either kind is centred on the tag (8.2.4.1; Ethan)', async () => {
  const both = await P.composeUniform(build('flight_suit', 'senior', 'SMSgt', { badges: [PILOT, GROUND_TEAM] }), store());
  assert.deepEqual(badgeLayers(both, FIGURES[0]).map(l => l.key), ['badge:' + PILOT.id]);
  assert.ok(both.notes.some(n => /Pilot Badge is shown; Ground Team Badge is not shown/.test(n)), both.notes.join(' | '));
  for(const badges of [[PILOT], [GROUND_TEAM]]){
    const one = await P.composeUniform(build('flight_suit', 'senior', 'SMSgt', { badges }), store());
    const tag = onFigure(one, FIGURES[0], l => l.key === 'nametag')[0];
    const w = badgeLayers(one, FIGURES[0]);
    assert.equal(w.length, 1);
    assert.ok(Math.abs(w[0].x + w[0].w / 2 - (tag.x + tag.w / 2)) < 0.01, 'a lone badge is centred on the tag');
    assert.ok(!one.notes.some(n => /one badge here/.test(n)), 'nothing left off, no note');
  }
});

test('cadet and NCO tags, wings and an occupational badge: one badge, the wings, on all four garments, male and female (8.2.4.1, 8.3.4.1; Ethan)', async () => {
  const cases = [['cadet', 'C/Capt', [PILOT, GROUND_TEAM]], ['cadet', 'C/SSgt', [PILOT, GROUND_TEAM]], ['senior', 'SMSgt', [PILOT, GROUND_TEAM]]];
  for(const f of FIGURES){
    for(const gender of ['male', 'female']){
      for(const [m, r, badges] of cases){
        const scene = await P.composeUniform(build(f.uniform, m, r, { gender, badges }), store());
        const { zone } = await badgeZoneOf(scene, f);
        const bs = badgeLayers(scene, f);
        assert.equal(bs.length, 1, `${f.name} ${gender} ${r}: one badge`);
        assert.equal(bs[0].key, 'badge:' + PILOT.id, `${f.name} ${gender} ${r}: the wings`);
        assert.ok(Math.abs(bs[0].x + bs[0].w / 2 - (zone.x + zone.w / 2)) < EPS, `${f.name} ${gender} ${r}: centred in badge_zone`);
        assert.ok(scene.notes.some(n => /Ground Team Badge is not shown/.test(n)), `${f.name} ${gender} ${r}: names what was left off`);
      }
    }
  }
});

test('NCO tag, no wings: the current command pin takes the occupational badge\'s place; a graduated commander\'s pin is not on the tag (8.2.4.1; Ethan)', async () => {
  const s = await P.composeUniform(build('flight_suit', 'senior', 'SMSgt', { badges: [GROUND_TEAM], command: GROUP_PIN }), store());
  assert.deepEqual(badgeLayers(s, FIGURES[0]).map(l => l.key), ['badge:' + GROUP_PIN.id], 'the pin alone, in place of the occupational badge');
  assert.ok(s.notes.some(n => /Group Commander Badge is shown; Ground Team Badge is not shown/.test(n)));
  const g = await P.composeUniform(build('flight_suit', 'senior', 'SMSgt', { badges: [PILOT], command: Object.assign({}, GROUP_PIN, { graduated: true }) }), store());
  assert.deepEqual(badgeLayers(g, FIGURES[0]).map(l => l.key), ['badge:' + PILOT.id]);
  assert.ok(!g.notes.some(n => /one badge here/.test(n)), 'a graduated pin is not a candidate, so nothing is left off');
});

test('name tag lettering: officers name only; NCOs grade and CAP; cadets "Cadet" and CAP (8.2.4.1)', async () => {
  const lines = async (m, r) => {
    const sc = await P.composeUniform(build('flight_suit', m, r, { badges: [PILOT] }), store());
    return onFigure(sc, FIGURES[0], l => /^text:/.test(l.key)).map(l => l.key).sort();
  };
  assert.deepEqual(await lines('senior', 'Col'), ['text:name']);
  assert.deepEqual(await lines('senior', 'Maj Gen'), ['text:name']);
  assert.deepEqual(await lines('senior', 'SMSgt'), ['text:cap', 'text:grade', 'text:name']);
  assert.deepEqual(await lines('cadet', 'C/Capt'), ['text:cap', 'text:grade', 'text:name']);
  const c = await P.composeUniform(build('flight_suit', 'cadet', 'C/Capt'), store());
  const grade = c.layers.find(l => l.key === 'text:grade');
  assert.equal(grade.text, 'Cadet');
});

test('NCO tag: a third badge is not shown and says so (8.2.4.1; Ethan: one badge)', async () => {
  const sc = await P.composeUniform(build('flight_suit', 'senior', 'SMSgt', { badges: [PILOT, GROUND_TEAM, { id: 'senior_ground_team_badge', title: 'Senior GT' }] }), store());
  assert.equal(badgeLayers(sc, FIGURES[0]).length, 1);
  assert.ok(sc.notes.some(n => /Pilot Badge is shown; Ground Team Badge and Senior GT are not shown/.test(n)), sc.notes.join(' | '));
});

// ---- chest layout and the ES patch -------------------------------------------------------------

test('chest: CAP Command Patch on the wearer\'s right breast, name tag on the left, level and opposite (8.2.4.1, 8.2.4.2, 8.3.4.2, 6.1.7)', async () => {
  for(const f of FIGURES){
    const scene = await P.composeUniform(build(f.uniform, 'senior', 'Col', { badges: [PILOT] }), store());
    const spec = await ST.load(f.garment);
    const g = scene.layers.find(l => l.id === f.garment);
    const s = g.w / spec.w;
    const at = name => { const a = core.anchor(spec, name); return { x: g.x + a.x * s, y: g.y + a.y * s }; };
    const cmd = at('command_patch_center'), tape = at('name_tape_center'), mid = at('center').x;
    // The wearer's right is the left of the picture.
    assert.ok(cmd.x < mid && tape.x > mid, `${f.name}: Command Patch on the wearer's right, name tag on the left`);
    assert.ok(Math.abs(cmd.y - tape.y) < 0.2, `${f.name}: level with each other`);
    assert.ok(Math.abs((mid - cmd.x) - (tape.x - mid)) < 6, `${f.name}: about the same distance from the centre line (directly opposite)`);
    const tag = onFigure(scene, f, l => l.key === 'nametag')[0];
    assert.ok(Math.abs(tag.x + tag.w / 2 - tape.x) < EPS && Math.abs(tag.y + tag.h / 2 - tape.y) < EPS, `${f.name}: tag centred on the name tape position`);
    assert.ok(Math.abs(tag.w - 4) < 1e-6 && Math.abs(tag.h - 2) < 1e-6, `${f.name}: tag is 2 x 4 in`);
    // The Command Patch is drawn in the garment art, not as a separate member-chosen layer.
    assert.equal(onFigure(scene, f, l => l.role === 'patch').length, 0, `${f.name}: no chest patch layer by default`);
  }
});

test('ES patch: on the right breast pocket\'s body, centred side to side, inside the pocket polygon (8.2.4.3, 8.3.4.3; LIVE9-4, the CAPR 39-1 flight suit figure)', async () => {
  for(const f of FIGURES.filter(x => !x.jacket)){
    for(const style of ['style-1', 'style-2']){
      const scene = await P.composeUniform(build(f.uniform, 'senior', 'Capt', { opt: { esPatch: style } }), store());
      const es = onFigure(scene, f, l => l.role === 'patch')[0];
      assert.ok(es, `${f.name} ${style}: ES patch drawn`);
      const spec = await ST.load(f.garment);
      const g = scene.layers.find(l => l.id === f.garment), s = g.w / spec.w;
      const raw = JSON.parse(fs.readFileSync(path.join(root, 'images/garments', f.garment + '.spec.json'), 'utf8'));
      const pts = raw.landmarks.chest_pocket_right.map(p => ({ x: g.x + p[0] * 0.01 * s, y: g.y + p[1] * 0.01 * s })); // raw landmark polygons are in 0.01 in units
      const inside = q => { let c = false; for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){ const a = pts[i], b = pts[j]; if((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
      const cx = es.x + es.w / 2, cy = es.y + es.h / 2;
      for(const [i, j] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) assert.ok(inside({ x: cx + i * es.w / 2, y: cy + j * es.h / 2 }), `${f.name} ${style}: the patch's corner lies inside the pocket polygon`);
      // The centroid's height, midway between the pocket's two sides there.
      let a2 = 0, gx = 0, gy = 0;
      for(let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length], cr = p.x * q.y - q.x * p.y; a2 += cr; gx += (p.x + q.x) * cr; gy += (p.y + q.y) * cr; }
      const cent = { x: gx / (3 * a2), y: gy / (3 * a2) };
      assert.ok(Math.abs(cy - cent.y) < 0.01, `${f.name} ${style}: as high as the pocket's centroid (${cy.toFixed(3)} vs ${cent.y.toFixed(3)})`);
      const xs = [];
      for(let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length]; if((p.y - cy) * (q.y - cy) < 0) xs.push(p.x + (q.x - p.x) * (cy - p.y) / (q.y - p.y)); }
      assert.ok(Math.abs(cx - (Math.min(...xs) + Math.max(...xs)) / 2) < 0.01, `${f.name} ${style}: centred side to side on the pocket at that height (${cx.toFixed(3)} vs ${((Math.min(...xs) + Math.max(...xs)) / 2).toFixed(3)})`);
      // On the pocket, not below it: the patch's bottom is above the pocket's bottom edge.
      assert.ok(es.y + es.h < Math.max(...pts.map(p => p.y)), `${f.name} ${style}: on the pocket, not below it`);
      const spec2 = await ST.load(es.id);
      assert.ok(es.w <= spec2.w + 1e-6 && Math.abs(es.w / spec2.w - es.h / spec2.h) < 1e-3, `${f.name} ${style}: scaled uniformly, never enlarged`);
    }
  }
  const none = await P.composeUniform(build('flight_suit', 'senior', 'Capt'), store());
  assert.equal(none.layers.filter(l => l.role === 'patch').length, 0, 'no ES patch unless chosen');
});
