'use strict';
// E156 F5, F6, F1, F7: the first badge on the wearer's left is centred 1/2 in above the HIGHEST row of ribbons or medals (CAPR 39-1
// 4.1.5.2.2.4.1 Class A men, 4.1.9.4.4.1 women, 4.2.6.2.7.1 overblouse, 4.1.1.1.3.1 mess dress men, 4.1.2.1.2.5 women), not over the whole
// rack, and a badge never leaves the garment: a rack too tall for it to sit 1/2 in above stops it at the shoulder seam, the shoulder board,
// the accepted three-row place on the overblouse, and the scene says so.

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
const WINGS = 'CAPPilot1_FA9D33EA587D8', GT = 'ground_team_basic_badge';
const RIBBON_H = 0.375;

// A Colonel's ribbons in precedence order (the audit's full rack), one award each.
const IDS = ['air_medal', 'air_force_aerial_achievement_medal', 'Air_Force_Organizational_Excellence_Award', 'distinguished_service_award', 'exceptional_service_award', 'meritorious_service_award', 'commander_commendation_award', 'cap_achievment_award', 'lifesaving_award', 'air_search_and_rescue_ribbon', 'search_find_ribbon', 'disaster_relief_ribbon', 'cap_counterdrug_ribbon', 'homeland_security_ribbon', 'cap_cadet_orientation_pilot_ribbon', 'cap_gill_robb_wilson_ribbon', 'cap_command_service_ribbon', 'cap_leadership_ribbon', 'red_service_ribbon', 'cap_senior_recruiter_ribbon', 'iace_ribbon', 'unit_citation_award', 'national_commander_unit_citation_award', 'bronze_medal_of_valor', 'encampment_ribbon', 'community_service_ribbon', 'cap_membership_ribbon', 'cap_paul_e_garber_ribbon'];
const MEDALS = [['distinguished_service_award', 'capub_total_2', null], ['exceptional_service_award', 'capub_total_6', null], ['meritorious_service_award', 'capub_total_3', null], ['commander_commendation_award', 'national_region', null], ['cap_achievment_award', 'capub_total_11', null], ['lifesaving_award', 'lifesaving_star', 'silver star'], ['air_search_and_rescue_ribbon', 'capub_total_4', 'aircrew propeller'], ['search_find_ribbon', 'capub_total_3', 'aircrew propeller'], ['disaster_relief_ribbon', 'capub_total_3', 'silver_v'], ['cap_gill_robb_wilson_ribbon', null, 'Silver Star'], ['cap_command_service_ribbon', null, 'Wing'], ['cap_leadership_ribbon', null, 'Bronze Star Silver Star'], ['red_service_ribbon', null, '10 years'], ['cap_senior_recruiter_ribbon', null, '17 recruits'], ['iace_ribbon', 'capub_total_3', null], ['unit_citation_award', 'capub_total_2', null], ['bronze_medal_of_valor', 'capub_total_2', null], ['encampment_ribbon', 'capub_total_3', null], ['cap_membership_ribbon', null, null], ['cap_paul_e_garber_ribbon', null, 'Bronze Star']];

// `n` ribbons: the first n awards, one ribbon each (an award with extra devices still makes one ribbon).
function build(uniform, gender, n, o){
  return HARNESS.makeBuild(Object.assign({ uniform, gender, membership: 'senior', rank: 'Col', name: NAME, ribbonSel: IDS.slice(0, n).map(id => [id]), badgeIds: [WINGS], opt: {} }, o || {}));
}
const ribbonsOf = scene => scene.layers.filter(l => l.role === 'ribbon');
const topRowOf = scene => {
  const rs = ribbonsOf(scene), top = Math.min(...rs.map(l => l.y));
  const row = rs.filter(l => Math.abs(l.y - top) < 1e-6);
  const x0 = Math.min(...row.map(l => l.x)), x1 = Math.max(...row.map(l => l.x + l.w));
  return { x: x0, y: top, w: x1 - x0, cx: (x0 + x1) / 2, n: row.length };
};
const wingsOf = scene => scene.layers.find(l => l.role === 'badge' && /CAPPilot/.test(l.key));
const TALL = /too tall for the badge to sit 1\/2 in above/;

test('Class A men and women, cadet semi-formal: the first badge is centred over the highest row, 1/2 in above it (4.1.5.2.2.4.1, 4.1.9.4.4.1)', async () => {
  let offCentre = 0;
  for(const [uniform, sex, ns] of [['blues_a', 'male', [4, 13, 20, 24]], ['blues_a', 'female', [4, 13, 16]], ['semi_formal_usaf', 'male', [13, 20]], ['semi_formal_usaf', 'female', [13]]]){
    for(const n of ns){
      const scene = await compose(build(uniform, sex, n));
      const top = topRowOf(scene), w = wingsOf(scene);
      assert.ok(w, `${uniform} ${sex} ${n}: wings drawn`);
      assert.ok(Math.abs(w.x + w.w / 2 - top.cx) < 0.011, `${uniform} ${sex} ${n}: wings centred on the highest row (${(w.x + w.w / 2).toFixed(3)} vs ${top.cx.toFixed(3)})`);
      assert.ok(Math.abs(top.y - (w.y + w.h) - 0.5) < 0.011, `${uniform} ${sex} ${n}: 1/2 in above the highest row (${(top.y - w.y - w.h).toFixed(3)})`);
      assert.ok(!scene.notes.some(t => TALL.test(t)), `${uniform} ${sex} ${n}: no tall-rack note`);
      const rack = core.unionBounds(ribbonsOf(scene).map(l => ({ x: l.x, y: l.y, w: l.w, h: l.h })));
      if(Math.abs(top.cx - (rack.x + rack.w / 2)) > 0.3) offCentre++;
    }
  }
  assert.ok(offCentre >= 3, 'the cases include shortened top rows that lie off the rack centre (' + offCentre + ')');
});

test('Class A men: with the top rows shortened for the lapel the wings lie clear of the lapel they used to slide under (4.1.5.2.2.4.1)', async () => {
  const scene = await compose(build('blues_a', 'male', 24));
  const base = await store.load(scene.layers.find(l => l.key === 'base:jacket').id);
  const lapel = base.landmarks.lapel_left.points, w = wingsOf(scene);
  const inside = (p, poly) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if(((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; };
  let hit = 0;
  for(let i = 0; i < 40; i++) for(let j = 0; j < 40; j++) if(inside({ x: w.x + (i + 0.5) * w.w / 40, y: w.y + (j + 0.5) * w.h / 40 }, lapel)) hit++;
  // What is left is the wearer's collar over the badge's inner corner, which a centred badge may meet (11.1.8); it was 58 % before.
  assert.ok(hit / 1600 < 0.3, `wings under the lapel ${(hit / 16).toFixed(1)} % (was 58 %)`);
});

// The shoulder seam of the sheet, and the board's half thickness.
function seamClearance(scene, sheetId, box){
  const H = P.helpers;
  let worst = Infinity;
  for(const side of ['left', 'right']){
    const sm = H.shoulderSeamOf(sheetId, side);
    if(!sm) continue;
    const x0 = Math.min(sm.neck.x, sm.outer.x), x1 = Math.max(sm.neck.x, sm.outer.x);
    for(let i = 0; i <= 40; i++){
      const x = box.x + box.w * i / 40;
      if(x < x0 || x > x1) continue;
      const t = (x - sm.neck.x) / (sm.outer.x - sm.neck.x);
      const seamY = sm.neck.y + t * (sm.outer.y - sm.neck.y);
      worst = Math.min(worst, box.y - (seamY + 0.2));   // below the 0.4 in board centred on the seam
    }
  }
  return worst;
}

test('Women\'s Class A, tall racks: the wings stop below the shoulder board and the scene says the rack is too tall (4.1.9.4.4.1)', async () => {
  for(const n of [20, 26, 27, 28]){
    const scene = await compose(build('blues_a', 'female', n));
    const w = wingsOf(scene), sheet = scene.layers.find(l => l.key === 'base:jacket').id;
    assert.ok(w.y > 0, `${n}: the wings are on the sheet`);
    assert.ok(seamClearance(scene, sheet, w) >= -1e-6, `${n}: the wings clear the shoulder board (${seamClearance(scene, sheet, w).toFixed(3)} in)`);
    const note = scene.notes.find(t => TALL.test(t));
    if(n < 28) assert.ok(!note, `${n}: the wings still sit 1/2 in above the highest row`);
    else{
      assert.ok(note, `${n}: tall-rack note`);
      assert.match(note, /4\.1\.9\.4\.4\.1/);
      assert.match(note, /shoulder board|shoulder seam/);
    }
  }
  const small = await compose(build('blues_a', 'female', 4));
  assert.ok(!small.notes.some(t => TALL.test(t)));
});

test('Women\'s overblouse: the wings never rise past the place they take over three rows of ribbons, the collar overlap accepted there (4.2.6.2.7.1)', async () => {
  const yBottom = {};
  for(const n of [4, 9, 14, 19, 24]){
    const scene = await compose(build('aviator', 'female', n, { opt: { femaleTop: 'overblouse' } }));
    const badges = scene.layers.filter(l => l.role === 'badge');
    assert.equal(badges.length, 1 + (badges.length > 1 ? 1 : 0));
    const lowest = badges.reduce((a, l) => (l.y + l.h > a.y + a.h ? l : a));
    yBottom[n] = lowest.y + lowest.h;
    const top = topRowOf(scene);
    const rackTop = top.y;
    for(const l of badges) assert.ok(l.y > 0, `${n}: ${l.key} is on the sheet (y ${l.y.toFixed(2)})`);
    if(n <= 9){
      assert.ok(Math.abs(rackTop - yBottom[n] - 0.5) < 0.011, `${n}: 1/2 in above the highest row`);
      assert.ok(!scene.notes.some(t => TALL.test(t)), `${n}: no tall-rack note`);
    }else{
      assert.ok(Math.abs(yBottom[n] - yBottom[9]) < 0.011, `${n}: the badge stays where it stands over three rows (${yBottom[n].toFixed(3)} vs ${yBottom[9].toFixed(3)})`);
      const note = scene.notes.find(t => TALL.test(t));
      assert.ok(note, `${n}: tall-rack note`);
      assert.match(note, /4\.2\.6\.2\.7\.1/);
      assert.match(note, /three rows of ribbons/);
    }
  }
  assert.ok(Math.abs(yBottom[9] - (yBottom[4] - RIBBON_H)) < 0.011, 'three rows of ribbons put the badge one row (3/8 in) higher than two rows do');
});

// The edge-on shoulder board of the mess dress as a rotated rectangle.
function stripHits(scene, box){
  for(const l of scene.layers.filter(x => x.role === 'epaulet-edge' && x.strip)){
    const t = l.strip, o = t.origin;
    const rad = -(t.rotate || 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    for(let i = 0; i <= 20; i++) for(let j = 0; j <= 20; j++){
      const px = box.x + box.w * i / 20 - o.x, py = box.y + box.h * j / 20 - o.y;
      const lx = px * cos - py * sin + o.x, ly = px * sin + py * cos + o.y;
      if(lx >= t.x && lx <= t.x + t.w && ly >= t.y && ly <= t.y + t.h) return true;
    }
  }
  return false;
}
function messBuild(gender, n){
  return HARNESS.makeBuild({ uniform: 'mess_dress', gender, membership: 'senior', rank: 'Col', name: NAME, ribbonSel: MEDALS.slice(0, n), medalSel: true, badgeIds: [WINGS, GT], opt: { miniStyle: 'mounting' } });
}

test('Mess dress, 20 miniature medals with wings: the badges stay clear of the shoulder board and its grade, centred over the highest row (4.1.1.1.3.1, 4.1.2.1.2.5)', async () => {
  for(const gender of ['male', 'female']){
    for(const n of [4, 12, 20]){
      const scene = await compose(messBuild(gender, n));
      const drapes = scene.layers.filter(l => l.role === 'mini-drape');
      assert.ok(drapes.length >= Math.min(n, 4), `${gender} ${n}: miniatures drawn`);
      const top = Math.min(...drapes.map(l => l.y));
      const row = drapes.filter(l => Math.abs(l.y - top) < 1e-6);
      const cx = (Math.min(...row.map(l => l.x)) + Math.max(...row.map(l => l.x + l.w))) / 2;
      const w = wingsOf(scene);
      assert.ok(w, `${gender} ${n}: wings drawn`);
      assert.ok(Math.abs(w.x + w.w / 2 - cx) < 0.011, `${gender} ${n}: centred on the highest row`);
      for(const l of scene.layers.filter(x => x.role === 'badge')) assert.ok(!stripHits(scene, l), `${gender} ${n}: ${l.key} is clear of the shoulder board`);
      const note = scene.notes.find(t => TALL.test(t));
      if(n === 20 && gender === 'male'){
        assert.ok(note, 'male 20: tall-rack note');
        assert.match(note, /4\.1\.1\.1\.3\.1/);
        assert.match(note, /medals/);
      }
      if(n <= 12) assert.ok(!note, `${gender} ${n}: no tall-rack note`);
    }
  }
});
