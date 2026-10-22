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

// ---- 3. Semi-formal blazer: the lapel does not cover a miniature medal ----------------------------------------

const RA = require('../data/ribbon-awards.js');
const C = require('../js/engine/compose.js');
function minisOf(ids){
  return ids.flatMap(id => RA.resolve(id, id === 'cap_achievment_award' ? { capub_total_3: true } : {}).map(r => ({ key: 'mini:' + id, title: id, ribbonAsset: 'ribbon-' + id.replace(/_/g, '-'), medal: 'medal-' + id.replace(/_/g, '-') + '-miniature', devices: r.devices })));
}
const TWELVE = ['distinguished_service_award', 'exceptional_service_award', 'meritorious_service_award', 'commander_commendation_award', 'cap_achievment_award', 'search_find_ribbon', 'air_search_and_rescue_ribbon', 'cap_gill_robb_wilson_ribbon', 'cap_command_service_ribbon', 'cap_leadership_ribbon', 'cap_membership_ribbon', 'red_service_ribbon'];

// The wearer's left lapel read straight from the sheet's lapel-foreground group (art frame translate + path points).
function lapelFromSheet(sex){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', `garment-corporate-service-dress-blazer-${sex}.svg`), 'utf8');
  const tr = /<g id="[^"]*__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(100\)"/.exec(svg);
  const d = new RegExp(`id="[^"]*lapel-left" d="([^"]*)"`).exec(svg)[1];
  const pts = [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: +m[1] + tr[1] / 100, y: +m[2] + tr[2] / 100 }));
  return pts;
}
function boxOf(l){
  // The layer's box turned about its origin (devices are turned 90 deg).
  const cx = l.x + l.w / 2, cy = l.y + l.h / 2, t = rad(l.rotate || 0);
  const ox = l.origin ? l.origin.x : cx, oy = l.origin ? l.origin.y : cy;
  const pts = [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => ({ x: ox + (x - ox) * Math.cos(t) - (y - oy) * Math.sin(t), y: oy + (x - ox) * Math.sin(t) + (y - oy) * Math.cos(t) }));
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// FIX-R-OTHER-r2 #4 (D8): this test asked the whole rack to slide off the lapel; the slide put the women's rack 1.2-1.8 in
// off the crest, which 4.2.1.4 / 4.2.2.4 ('centered above the pocket', lowest row 1/2 in above the crest) does not allow.
// The rack stays centred and the lowest row keeps its line; the miniatures lie over the lapel (pinned on top, 11.2.8).
test('semi-formal blazer: the lowest row of miniatures stays 1/2 in over the crest for 1 to 12 medals (4.2.1.4, 4.2.2.4)', async () => {
  for(const sex of ['male', 'female']){
    const sheet = await store.load(`garment-corporate-service-dress-blazer-${sex}`);
    const crestTop = core.anchor(sheet, 'crest_top_center').y;
    // The men's rack ends at the pocket's top edge (FIX-R-OTHER-r1 #4, D8): 1/2 in over the crest is over the welt.
    const expected = Math.min(crestTop - 0.5, sex === 'male' ? core.anchor(sheet, 'pocket_top_center').y : Infinity);
    for(const n of [1, 4, 5, 9, 12]){
      const scene = await compose(build('semi_formal', sex, 'senior', 'Col', [], { medals: minisOf(TWELVE.slice(0, n)) }));
      const minis = scene.layers.filter(l => /^mini-/.test(l.role) || (l.role === 'device' && /:device:/.test(l.key)));
      assert.ok(minis.length >= n, `${sex} ${n}: minis drawn`);
      const bodies = scene.layers.filter(l => l.role === 'mini-medal');
      const lowest = Math.max(...bodies.map(l => l.y + l.h));
      assert.ok(Math.abs(lowest - expected) < 0.01, `${sex} ${n}: lowest medals end 1/2 in above the crest, men's at the pocket top (${lowest.toFixed(3)} vs ${expected.toFixed(3)})`);
    }
  }
});

test('semi-formal blazer: the lapel group is drawn under every miniature layer and under the chaplain badge', async () => {
  for(const sex of ['male', 'female']){
    const scene = await compose(build('semi_formal', sex, 'senior', 'Col', ['christian_chaplin'], { medals: minisOf(TWELVE) }));
    const fg = scene.layers.find(l => l.role === 'garment-foreground' && l.onlyGroups && l.onlyGroups.includes('lapel-foreground'));
    assert.ok(fg);
    for(const l of scene.layers.filter(l => /^mini-/.test(l.role) || l.role === 'device' || l.role === 'badge')) assert.ok(l.z > fg.z, `${sex}: ${l.key} over the lapel group`);
  }
});

// ---- 4. Corporate service dress (women): the nametag lies on the coat front, not on the lapel --------------------

function lapelRightFromSheet(sex){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', `garment-corporate-service-dress-blazer-${sex}.svg`), 'utf8');
  const tr = /<g id="[^"]*__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(100\)"/.exec(svg);
  const d = /id="[^"]*lapel-right" d="([^"]*)"/.exec(svg)[1];
  return [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: +m[1] + tr[1] / 100, y: +m[2] + tr[2] / 100 }));
}

test('corporate service dress: the nametag clears the wearer\'s right lapel by 0.1 in, top edge at the slot, men and women (4.2.3.1.1.2, 4.2.4.1.1.2)', async () => {
  for(const sex of ['male', 'female']) for(const rank of ['SMSgt', 'Capt', 'Col']){
    const lapel = lapelRightFromSheet(sex);
    const spec = await store.load(`garment-corporate-service-dress-blazer-${sex}`);
    const slot = core.landmarkBounds(spec, 'nameplate_slot');
    const scene = await compose(build('aviator_blazer', sex, 'senior', rank, ['CAPPilot1_FA9D33EA587D8']));
    const plate = scene.layers.find(l => l.key === 'nametag' && !l.figure);
    assert.ok(plate, `${sex} ${rank}: nametag drawn`);
    const r = { x: plate.x - 0.1, y: plate.y, w: plate.w + 0.2, h: plate.h };
    assert.ok(!C.rectHitsPolygon(r, lapel), `${sex} ${rank}: the plate (x ${plate.x.toFixed(3)}-${(plate.x + plate.w).toFixed(3)}) is 0.1 in clear of the lapel`);
    assert.ok(Math.abs(plate.y - slot.y) < 0.01, `${sex} ${rank}: the top edge stays at the slot top (${plate.y} vs ${slot.y})`);
  }
});

// ---- 5. ABU and CFU: general officers' stars begin 1 in from the bottom of the collar ------------------------------

function inPoly(p, poly){
  let c = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if(((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c;
  }
  return c;
}
const corners = l => {
  const c = { x: l.x + l.w / 2, y: l.y + l.h / 2 }, t = rad(l.rotate);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: c.x + a * l.w / 2 * Math.cos(t) - b * l.h / 2 * Math.sin(t), y: c.y + a * l.w / 2 * Math.sin(t) + b * l.h / 2 * Math.cos(t) }));
};

test('ABU and CFU: a general officer\'s stars begin 1 in up the perpendicular from the collar\'s bottom edge, the 1 in measure is drawn (5.1.1.1.1.1, 5.2.1.1.1.1)', async () => {
  for(const uniform of ['abu', 'corporate_field']) for(const sex of ['male', 'female']) for(const rank of ['Brig Gen', 'Maj Gen']){
    const scene = await compose(build(uniform, sex, 'senior', rank));
    const spec = await store.load(scene.layers.find(l => l.key === 'base:jacket' || /^base:/.test(l.key || '')).id);
    for(const side of ['right', 'left']){
      const edge = (spec.raw || spec).collar_slots[side].bottom_edge;
      const a = { x: edge.p1[0] / 100, y: edge.p1[1] / 100 }, d = { x: (edge.p2[0] - edge.p1[0]) / 100, y: (edge.p2[1] - edge.p1[1]) / 100 };
      const len = Math.hypot(d.x, d.y);
      const l = scene.layers.find(x => x.key === 'grade:' + side);
      assert.ok(l, `${uniform} ${sex} ${rank} ${side}: grade drawn`);
      // The cloth's bottom edge midpoint is the corner pair at the piece's bottom: distance from the edge line.
      const cs = corners(l), bottomMid = { x: (cs[2].x + cs[3].x) / 2, y: (cs[2].y + cs[3].y) / 2 };
      const dist = Math.abs((bottomMid.x - a.x) * d.y - (bottomMid.y - a.y) * d.x) / len;
      assert.ok(Math.abs(dist - (1 - 0.125)) < 0.02, `${uniform} ${sex} ${rank} ${side}: the stars' silver begins 1 in up (cloth ${dist.toFixed(3)} in from the edge)`);
      assert.ok(Math.abs(l.rotate) > 13 && Math.abs(l.rotate) < 13.5, `${uniform} ${sex} ${rank}: the 13.2 deg turn is kept`);
    }
    assert.ok(scene.layers.some(x => x.type === 'measure' && x.label === '1 in'), `${uniform} ${sex} ${rank}: a 1 in measure`);
  }
});

test('ABU and CFU: no officer grade cloth corner lies outside the collar leaf, except the major general\'s top outer corner the drawn leaf is too small for (FOLLOWUP art)', async () => {
  for(const uniform of ['abu', 'corporate_field']) for(const sex of ['male', 'female']) for(const rank of ['Capt', 'Maj', 'Lt Col', 'Col', 'Brig Gen', 'Maj Gen']){
    const scene = await compose(build(uniform, sex, 'senior', rank));
    const spec = await store.load(scene.layers.find(l => /^base:/.test(l.key || '')).id);
    for(const side of ['right', 'left']){
      const poly = core.landmark(spec, `collar_${side}`).points;
      const l = scene.layers.find(x => x.key === 'grade:' + side);
      const out = corners(l).filter(p => !inPoly(p, poly));
      if(rank === 'Maj Gen') assert.ok(out.length <= 1, `${uniform} ${sex} ${rank} ${side}: only the top outer corner (${out.length})`);
      else assert.equal(out.length, 0, `${uniform} ${sex} ${rank} ${side}: every corner on the leaf`);
    }
  }
});

// ---- 7. Utility uniforms: the patrol cap is seated on the figure (R6) ----------------------------------------

const UTILITY = { ocp: 'garment-ocp-coat-abu-cut', abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' };
const boxOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('OCP, ABU and CFU: the patrol cap (ABU cap, OCP patrol cap, Blue Field Cap) is seated on the collar, centred on the figure, nothing lies over it (R6; 5.1.1.6, 6.2.9.1, 7.1.1.8)', async () => {
  for(const uniform of Object.keys(UTILITY)) for(const sex of ['male', 'female']) for(const [membership, rank] of [['senior', 'Capt'], ['senior', 'SMSgt'], ['cadet', 'C/Maj'], ['cadet', 'C/SSgt']]){
    const scene = await compose(build(uniform, sex, membership, rank));
    const spec = await store.load(UTILITY[uniform]);
    const hat = scene.layers.find(l => l.role === 'hat');
    assert.ok(hat, `${uniform} ${sex} ${rank}: a hat layer on the figure`);
    assert.deepEqual(hat.onlyGroups, ['hat-patrol-front']);
    const top = core.anchor(spec, 'top_center'), apex = core.anchor(spec, 'collar_apex');
    const lm = core.landmarkBounds(spec, 'patrol_cap_front');
    // The cap's bottom centre is on the collar's back top (5.635 in above the V's apex) lowered by the 1/4 in seat.
    const bottomCenter = { x: lm.x + lm.w / 2 + hat.x, y: lm.y + lm.h + hat.y };
    assert.ok(Math.abs(bottomCenter.x - top.x) < 0.005, `${uniform} ${sex} ${rank}: centred on the figure (${bottomCenter.x} vs ${top.x})`);
    assert.ok(Math.abs(bottomCenter.y - (apex.y - 5.635 + 0.25)) < 0.005, `${uniform} ${sex} ${rank}: seated on the collar (${bottomCenter.y.toFixed(3)})`);
    // The hat is the patrol cap's own box, on top of the garment, and the other views do not touch it.
    const hbox = { x: lm.x + hat.x, y: lm.y + hat.y, w: lm.w, h: lm.h };
    for(const v of scene.layers.filter(l => l.role === 'hat-view')){
      const vl = core.landmarkBounds(spec, { 'hat-patrol-back': 'patrol_cap_back', 'hat-ball-front': 'baseball_cap_front', 'hat-ball-back': 'baseball_cap_back', 'hat-boonie-front': 'boonie_hat_front', 'hat-boonie-back': 'boonie_hat_back' }[v.onlyGroups[0]]);
      assert.ok(!boxOverlap({ x: vl.x + v.x, y: vl.y + v.y, w: vl.w, h: vl.h }, hbox), `${uniform} ${sex} ${rank}: ${v.onlyGroups[0]} is clear of the seated cap`);
    }
    // The overlay keeps clear of the cap's own box, not of the whole sheet the view is drawn from.
    assert.ok(hat.obstacle && hat.obstacle.w < 10 && hat.obstacle.h < 8, `${uniform}: the hat's obstacle is its own box`);
    const base = scene.layers.find(l => l.key === 'base:jacket');
    assert.ok(hat.z > base.z && base.hideGroups.includes('hat-patrol-front'), `${uniform}: the sheet's own patrol cap view is hidden, the cap is drawn over the garment`);
    // Officers' grade is on the seated cap's front, over it, where the view now is.
    const grade = scene.layers.find(l => l.key === 'grade:patrol_cap_front_insignia_zone');
    if((membership === 'senior' && rank === 'Capt') || rank === 'C/Maj'){
      assert.ok(grade, `${uniform} ${sex} ${rank}: grade on the cap`);
      assert.ok(grade.z > hat.z && grade.x >= hbox.x && grade.x + grade.w <= hbox.x + hbox.w && grade.y >= hbox.y && grade.y + grade.h <= hbox.y + hbox.h, `${uniform} ${sex} ${rank}: the grade lies on the seated cap`);
    }
  }
});

test('OCP, ABU and CFU: the accessory cap views are kept, in rows above the seated cap, with their name tape text and grade where they now are; headgear none leaves the sheet as drawn', async () => {
  for(const uniform of Object.keys(UTILITY)){
    const scene = await compose(build(uniform, 'male', 'senior', 'Capt'));
    const spec = await store.load(UTILITY[uniform]);
    const views = scene.layers.filter(l => l.role === 'hat-view');
    assert.ok(views.length >= 3, `${uniform}: accessory views kept (${views.length})`);
    assert.ok(views.every(v => v.y < 0 || v.y === 0), `${uniform}: lifted, never lowered`);
    // The last name on a cap back tape lies on the tape where the view now is.
    for(const [lmName, group] of [['baseball_cap_back_name_tape', 'hat-ball-back'], ['patrol_cap_back_name_tape', 'hat-patrol-back']]){
      const tape = core.landmarkBounds(spec, lmName);
      if(!tape) continue;
      const v = views.find(x => x.onlyGroups[0] === group);
      const t = scene.layers.find(l => l.key === 'text:' + lmName);
      assert.ok(v && t, `${uniform} ${lmName}: view and name text`);
      assert.ok(Math.abs(t.x - (tape.x + tape.w / 2 + v.x)) < 0.05 && Math.abs(t.y - (tape.y + tape.h / 2 + v.y)) < 0.1, `${uniform} ${lmName}: the name is on the tape where its view is`);
    }
    const none = await compose(build(uniform, 'male', 'senior', 'Capt', [], { opt: { headgear: 'none' } }));
    assert.ok(!none.layers.some(l => l.role === 'hat' || l.role === 'hat-view'), `${uniform}: no hat layers with headgear none`);
  }
});

// ---- 6, 9. The critique build set and the matrix prove the utility patches, the commander insignia and the flight name tags ----

const HARNESS = require('../scripts/render-builds.cjs');
const { execFileSync } = require('node:child_process');
const critique = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts', 'critique-builds.cjs')], { encoding: 'utf8' }));
const composeNamed = async (list, name) => compose(HARNESS.makeBuild(list.find(x => x.name === name).build));
const { NOT_DRAWN } = HARNESS; // the harness's own regex, not a copy

test('critique set: the utility builds draw the unit and HHQ patches (patchRefs), no "not drawn" note, ES badge on the OCP (D22, 7.1.1.4.1.2, 7.1.1.4.2)', async () => {
  for(const name of ['ocp-male-cadet-CSSgt-patches', 'ocp-male-senior-LtCol-patches-overlay', 'abu-male-senior-SMSgt', 'corporate_field-female-senior-Capt']){
    const scene = await composeNamed(critique, name);
    assert.deepEqual(scene.notes.filter(n => NOT_DRAWN.test(n)), [], `${name}: nothing left undrawn`);
    const patches = scene.layers.filter(l => l.role === 'patch');
    assert.ok(patches.length >= 2, `${name}: unit and HHQ patches drawn (${patches.length})`);
  }
  const ocp = await composeNamed(critique, 'ocp-male-senior-LtCol-patches-overlay');
  assert.ok(ocp.layers.some(l => l.key === 'badge:emergency_services_badge'), 'the OCP LtCol keeps its ES badge');
  // The one build whose unit patch has no full art says so, so the gap is visible.
  const noArtBuild = HARNESS.makeBuild(critique.find(x => x.name === 'ocp-male-senior-LtCol-no-unit-art').build);
  assert.ok((noArtBuild.harnessNotes || []).some(n => NOT_DRAWN.test(n)), 'the no-art build carries the note');
});

test('critique set: OCP graduated and current commander builds draw the left-loop insignia and the chest badge (D23, 7.1.1.4.2, 7.1.1.3.1.7)', async () => {
  const grad = await composeNamed(critique, 'ocp-male-senior-LtCol-graduated-commander');
  const cur = await composeNamed(critique, 'ocp-male-senior-LtCol-current-commander');
  const gl = grad.layers.filter(l => /^badge:squadron_commander_badge/.test(l.key || ''));
  const cl = cur.layers.filter(l => /^badge:squadron_commander_badge/.test(l.key || ''));
  assert.deepEqual(gl.map(l => l.key).sort(), ['badge:squadron_commander_badge:UN:0', 'badge:squadron_commander_badge:UN:0:edge'], 'graduated: the left loop on the flat sleeve and the edge view');
  assert.ok(gl.every(l => l.x > 30), 'graduated: on the wearer\'s left sleeve (the picture\'s right)');
  assert.deepEqual(cl.map(l => l.key), ['badge:squadron_commander_badge:ON:0'], 'current: the chest badge only');
});

test('critique set: the flight builds cover the two-badge tag, the command pin, C/Capt on both suits and both ES patch styles (D14, D17, 8.2.4.1, 8.3.4.1, 8.2.4.3)', async () => {
  const names = new Set(critique.map(b => b.name));
  for(const n of ['flight_suit-male-cadet-CSSgt-wings-ground-team', 'flight_suit-female-cadet-CSSgt-wings-ground-team', 'flight_suit-female-senior-SMSgt-wings-pin', 'flight_suit-male-cadet-CCapt-es-style1', 'flight_suit-male-cadet-CCapt-es-style2', 'corporate_flight_suit-female-cadet-CCapt-es-style1', 'corporate_flight_suit-female-cadet-CCapt-es-style2']) assert.ok(names.has(n), n);
  const two = await composeNamed(critique, 'flight_suit-male-cadet-CSSgt-wings-ground-team');
  assert.equal(two.layers.filter(l => l.role === 'badge' && l.figure !== 2).length, 2, 'two badges on the cadet tag');
  assert.ok(!two.notes.some(n => /not worn on the flight suit name tag/.test(n)), 'no rejection note');
  const pin = await composeNamed(critique, 'flight_suit-female-senior-SMSgt-wings-pin');
  assert.equal(pin.layers.filter(l => l.role === 'badge' && l.figure !== 2).length, 2, 'wings and the command pin on the NCO tag');
  for(const [n, style] of [['flight_suit-male-cadet-CCapt-es-style1', 'patch-es-style-1'], ['flight_suit-male-cadet-CCapt-es-style2', 'patch-es-style-2'], ['corporate_flight_suit-female-cadet-CCapt-es-style1', 'patch-es-style-1'], ['corporate_flight_suit-female-cadet-CCapt-es-style2', 'patch-es-style-2']]){
    const sc = await composeNamed(critique, n);
    assert.ok(sc.layers.some(l => l.id === style), `${n}: ES patch ${style} drawn`);
    if(/^flight_suit/.test(n)) assert.ok(sc.layers.some(l => l.role === 'hat' && /cadet/.test(l.id)), `${n}: the cadet flight cap (6.2.2.2.2)`);
  }
});

test('standard matrix: the flight suits wear an occupational badge, so the name tag carries two badges', async () => {
  const { builds } = HARNESS.matrix();
  for(const uniform of ['flight_suit', 'corporate_flight_suit']){
    const b = builds.find(x => x.name === `${uniform}-male-senior-SMSgt`);
    assert.ok(b && b.build.badgeIds.includes('ground_team_basic_badge') && !b.build.badgeIds.includes('emergency_services_badge'), uniform);
    const scene = await compose(HARNESS.makeBuild(b.build));
    assert.ok(scene.layers.filter(l => l.role === 'badge' && l.figure !== 2).length >= 2, `${uniform}: two badges on the NCO tag`);
    assert.ok(!scene.notes.some(n => /not worn on the flight suit name tag/.test(n)), `${uniform}: no rejection note`);
  }
});

test('the harness flags engine notes that say a piece is not drawn, as it flags "No artwork for"', () => {
  assert.ok(NOT_DRAWN.test('TN-185_ocp_patch is only a crop of the old sleeve drawing, so it is not drawn; it needs full patch artwork'));
  const src = fs.readFileSync(path.join(root, 'scripts', 'render-builds.cjs'), 'utf8');
  assert.match(src, /withNotDrawn/);
});

test('the harness flags the engine\'s missing-art note for a badge with no field artwork (OCP Command Council badge, a service badge with no field form, G4)', async () => {
  const scene = await compose(HARNESS.makeBuild({ uniform: 'ocp', gender: 'male', membership: 'senior', rank: 'Capt', badgeIds: ['command_council_badge'], ribbonSel: [] }));
  const missing = scene.notes.filter(n => /has no \w+ artwork/.test(n));
  assert.ok(missing.length, 'the engine says the badge is not shown: ' + JSON.stringify(scene.notes));
  assert.deepEqual(missing.filter(n => !NOT_DRAWN.test(n)), [], 'and the harness counts it as not drawn');
  assert.ok(!NOT_DRAWN.test('At most two aviation and occupational badges are worn over the left pocket; the rest are not shown'), 'a rule trim is not missing art');
  assert.ok(!NOT_DRAWN.test('Only one service badge is worn; the others are not shown'), 'a rule trim is not missing art');
});
