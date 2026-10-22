'use strict';
// FIX-ART-r4: artwork findings of review round 4, locked on the synced sheets.
//   1. Model Rocketry badge: 3 in is the regulation size (CAPR 39-1 Attachment 7 Fig A7-2 prints a 3 in dimension arrow over the full height).
//   2. NCO and cadet flight caps are plain blue (6.2.2.2.6): no lighter braid stroke on the flap edge.
//   3. Women's overblouse: the collar leaves end on the first button's line (Figure 4.18), so the first badge (4.2.6.2.7.1) is not under them.
//   6. Women's overblouse sleeve: the 3 1/2 in chevron lies between the outline and the armhole seam (4.2.6.2.3).

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
const assetPath = id => path.join(root, 'images', manifest.assets.find(a => a.id === id).path);
const readSvg = id => fs.readFileSync(assetPath(id), 'utf8');
const readSpec = id => JSON.parse(fs.readFileSync(assetPath(id).replace(/\.svg$/, '.spec.json'), 'utf8'));

function build(uniform, gender, membership, rank, opt){
  return {
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: Object.assign({ headgear: 'auto' }, opt || {}), name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  };
}

// ---- 1. Model Rocketry badge ------------------------------------------------------------------------------

test('the Model Rocketry badge is 3 in tall by the regulation: its citation is Fig A7-2\'s dimension arrow, not the app table', () => {
  const spec = readSpec('model-rocketry');
  assert.equal(spec.height_in, 3);
  assert.equal(spec.size_source, 'regulation');
  assert.match(spec.citation, /Fig A7-2/);
  assert.doesNotMatch(spec.citation, /not re-read/);
});

// ---- 2. NCO and cadet flight caps are plain blue -------------------------------------------------------------

test('NCO / cadet flight caps (men\'s, women\'s, legacy alias) are plain blue: the flap edge is a seam in the body\'s dark tone, not a lighter braid stroke (6.2.2.2.6)', () => {
  for(const id of ['hat-flight-cap-men-cadet', 'hat-flight-cap-cadet', 'hat-flight-cap-women-cadet']){
    const svg = readSvg(id), spec = readSpec(id);
    assert.match(spec.name, /\(plain blue\)$/, `${id}: name`);
    assert.doesNotMatch(svg, /#14337f|#243f93/i, `${id}: no lighter blue stroke on the flap edge`);
    // the body and the seam share one tone family: every stroke in the art is a dark outline tone
    const strokes = [...svg.matchAll(/stroke="(#[0-9a-f]{6})"/gi)].map(m => m[1].toLowerCase());
    for(const c of strokes) assert.ok(['#03112f', '#06143f'].includes(c), `${id}: stroke ${c}`);
  }
});

// ---- 3. overblouse collar ----------------------------------------------------------------------------------

test('the overblouse collar leaves end on the first button\'s line or above it, so the badge 1/2 in above the ribbons is not under them (Figure 4.18, 4.2.6.2.7.1)', async () => {
  for(const garment of ['garment-overblouse-female', 'garment-overblouse-female-long']){
    const spec = await store.load(garment);
    const button = core.anchor(spec, 'button_1_center');
    for(const side of ['left', 'right']){
      const poly = core.landmark(spec, 'collar_' + side).points;
      const lowest = Math.max(...poly.map(p => p.y));
      assert.ok(lowest <= button.y + 0.02, `${garment} ${side}: leaf reaches y ${lowest.toFixed(2)} in, first button at ${button.y.toFixed(2)} in`);
    }
  }
});

test('the first badge on the overblouse is whole: no collar leaf polygon crosses the pilot wings\' ink box', async () => {
  const b = build('aviator', 'female', 'senior', 'Col', { femaleTop: 'overblouse' });
  b.badges = [{ id: 'CAPPilot1_FA9D33EA587D8' }];
  const scene = await P.composeUniform(b, store);
  const wings = scene.layers.find(l => l.role === 'badge');
  assert.ok(wings, 'pilot badge drawn');
  const spec = await store.load('garment-overblouse-female');
  for(const side of ['left', 'right']){
    const poly = core.landmark(spec, 'collar_' + side).points;
    // the wings' lower-left/lower-right band: the inner 0.9 in of each wing at the height of the roundel's lower half
    const near = poly.filter(p => p.x > wings.x && p.x < wings.x + wings.w && p.y > wings.y + 0.3 && p.y < wings.y + wings.h);
    assert.equal(near.length, 0, `${side} leaf has a vertex inside the wings' lower box: ${JSON.stringify(near)}`);
  }
});

// FIX-ART-r4 round 2: the leaf's lower tip lies on the first button's line (Figure 4.18's size); with the ribbon stack of a decorated officer (three rows) the nameplate is already at its
// lowest allowed place (4.2.6.2.6.1.2) and the pilot wings (1/2 in above the top row, 4.2.6.2.7.1) reach into the leaf's wedge: the engine says so rather than hiding the wing tip silently.
const HARNESS = require('../scripts/render-builds.cjs');
const SEVEN = [['distinguished_service_award', null], ['exceptional_service_award', null], ['meritorious_service_award', null], ['cap_achievment_award', 'capub_total_7'], ['cap_gill_robb_wilson_ribbon', null], ['cap_membership_ribbon', null], ['cap_command_service_ribbon', null]];

test('a badge box that meets a collar leaf polygon is reported in the scene notes (the overblouse pilot wings over seven ribbons); a badge clear of the leaves is not', async () => {
  const under = await P.composeUniform(HARNESS.makeBuild({ uniform: 'aviator', gender: 'female', membership: 'senior', rank: 'Col', ribbonSel: SEVEN, badgeIds: ['CAPPilot1_FA9D33EA587D8'], opt: { femaleTop: 'overblouse' } }), store);
  const wings = under.layers.find(l => l.role === 'badge');
  assert.ok(wings && wings.clipOut && wings.clipOut.length, 'the wings are clipped by the leaf (the tuck)');
  assert.ok(under.notes.some(n => /collar leaf lies over part of the .*badge/i.test(n)), `notes: ${JSON.stringify(under.notes)}`);
  const clear = await P.composeUniform(HARNESS.makeBuild({ uniform: 'aviator', gender: 'female', membership: 'senior', rank: 'Col', ribbonSel: [], badgeIds: ['CAPPilot1_FA9D33EA587D8'], opt: { femaleTop: 'overblouse' } }), store);
  assert.ok(!clear.layers.find(l => l.role === 'badge').clipOut, 'no ribbons: the wings sit below the leaves');
  assert.ok(!clear.notes.some(n => /collar leaf lies over/i.test(n)), `notes: ${JSON.stringify(clear.notes)}`);
});

// ---- 6. overblouse sleeve chevron -----------------------------------------------------------------------------

function inkPoints(id){
  return [...readSvg(id).matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => [Number(m[1]) / 100, Number(m[2]) / 100]);
}

// Round-4 review of ddb0e91f: the first widening warped every outline point beyond |x| > 5 in down to the hem (the bodice flared and the side seam stepped
// outward 1 in at the waist). The widening moves the sleeve's own run of the outline only: nothing below the armpit.
function silhouettePoints(id){
  const svg = readSvg(id), d = svg.match(/id="[^"]*silhouette" d="([^"]+)"/)[1];
  const n = d.match(/-?\d*\.?\d+/g).map(Number), pts = [];
  for(let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);   // inches from the neck centre line, y from the sheet's top
  return pts;
}

async function chevronClearance(garment, rank, sleeve){
  const spec = await store.load(garment);
  const seam = core.landmark(spec, 'armhole_seam_right').points;
  const seamX = y => {
    for(let i = 0; i < seam.length - 1; i++){
      const a = seam[i], c = seam[i + 1];
      if((a.y - y) * (c.y - y) <= 0 && a.y !== c.y) return a.x + (c.x - a.x) * (y - a.y) / (c.y - a.y);
    }
    return y > seam[seam.length - 1].y ? seam[seam.length - 1].x : seam[0].x;
  };
  const scene = await P.composeUniform(build('aviator', 'female', 'senior', rank, { sleeve, femaleTop: 'overblouse' }), store);
  const l = scene.layers.find(x => x.role === 'grade' && x.key === 'grade:sleeve-right');
  assert.ok(l, `${garment} ${rank}: right chevron`);
  assert.equal(l.w, 3.5);
  const cx = l.x + l.w / 2, cy = l.y + l.h / 2, r = l.rotate * Math.PI / 180;
  let worst = -Infinity;
  for(const [px, py] of inkPoints(l.id)){
    const dx = px - l.w / 2, dy = py - l.h / 2;
    worst = Math.max(worst, cx + dx * Math.cos(r) - dy * Math.sin(r) - seamX(cy + dx * Math.sin(r) + dy * Math.cos(r)));
  }
  return { scene, spec, layer: l, worst };
}

test('the 3 1/2 in sleeve chevron on the short overblouse lies between the outline and the armhole seam: no ink past the seam onto the bodice (4.2.6.2.3, D8)', async () => {
  for(const rank of ['SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt']){
    const { scene, spec, layer: l, worst } = await chevronClearance('garment-overblouse-female', rank, 'short');
    assert.ok(worst <= -0.1, `${rank}: chevron ink ${worst.toFixed(3)} in past the armhole seam (want at least 0.1 in clear)`);
    // the turn follows the sheet's own sleeve axis (shoulder_seam -> sleeve_bottom), the wearer's left mirrors it
    const s = core.anchor(spec, 'shoulder_seam_right'), e = core.anchor(spec, 'sleeve_bottom_right');
    const turn = Math.atan2(s.x - e.x, e.y - s.y) * 180 / Math.PI;
    assert.ok(Math.abs(l.rotate - turn) < 0.05, `${rank}: rotate ${l.rotate}, sleeve axis ${turn.toFixed(2)}`);
    const left = scene.layers.find(x => x.role === 'grade' && x.key === 'grade:sleeve-left');
    assert.ok(Math.abs(left.rotate + l.rotate) < 1e-6 && Math.abs((left.x + left.w / 2) - (scene.bounds.w - (l.x + l.w / 2))) < 0.01, `${rank}: left mirrors right`);
  }
});

test('the long overblouse states its sleeve anchors and its 3 1/2 in chevron lies between the outline and the armhole seam; the engine keeps no literal points for it (4.2.6.2.3, D8)', async () => {
  const spec = await store.load('garment-overblouse-female-long');
  for(const side of ['right', 'left']) for(const k of ['shoulder_seam_', 'elbow_', 'sleeve_bottom_', 'chevron_halfway_']) assert.ok(core.anchor(spec, k + side), `long overblouse: ${k}${side}`);
  const sh = core.anchor(spec, 'shoulder_seam_right'), el = core.anchor(spec, 'elbow_right'), half = core.anchor(spec, 'chevron_halfway_right');
  assert.ok(Math.abs(half.y - (sh.y + el.y) / 2) < 0.01, 'chevron_halfway is halfway between the shoulder seam and the elbow');
  for(const rank of ['SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt']){
    const { layer: l, worst } = await chevronClearance('garment-overblouse-female-long', rank, 'long');
    assert.ok(worst <= -0.1, `${rank}: chevron ink ${worst.toFixed(3)} in past the armhole seam (want at least 0.1 in clear)`);
    assert.ok(Math.abs((l.x + l.w / 2) - half.x) < 0.05 && Math.abs((l.y + l.h / 2) - half.y) < 0.05, `${rank}: centred on chevron_halfway`);
    const turn = Math.atan2(sh.x - el.x, el.y - sh.y) * 180 / Math.PI;
    assert.ok(Math.abs(l.rotate - turn) < 0.05, `${rank}: rotate ${l.rotate}, sleeve axis ${turn.toFixed(2)} (the engine's literal 31 deg is gone)`);
  }
});

test('the overblouse sheets state their sleeve widening as an estimate (the regulation gives no sleeve width)', () => {
  for(const id of ['garment-overblouse-female', 'garment-overblouse-female-long']){
    const w = readSpec(id).dimensions.sleeve_widening;
    assert.ok(w && w.outward_in > 0 && w.size_source === 'estimated', id);
  }
});

test('the short overblouse bodice is as traced: the widening moves the sleeve run only, so the side seam runs smoothly from the armpit to the hem and the hem is not wider than the traced one (round-4 review of ddb0e91f)', () => {
  const pts = silhouettePoints('garment-overblouse-female');
  const hemY = Math.max(...pts.map(p => p[1])) - 1;
  const hem = pts.filter(p => p[1] > 14 && p[1] <= hemY + 1);
  const hemWidth = Math.max(...hem.map(p => p[0])) - Math.min(...hem.map(p => p[0]));
  assert.ok(Math.abs(hemWidth - 11.062) < 0.01, `hem width ${hemWidth.toFixed(3)} in (traced 11.062)`);
  // the picture-left side seam, from under the cuff down to the hem corner: no step, no flare past the traced 5.6 in
  const belowCuffY = 12.4;   // the sleeve's cuff ends at y 12.16 in, so everything lower is bodice
  const side = pts.filter(p => p[0] < 0 && p[1] > belowCuffY && p[1] < 20.1);   // above the hem's flat bottom edge
  assert.ok(side.length > 40, 'side seam points');
  for(const p of side) assert.ok(Math.abs(p[0]) < 5.6, `side seam point ${p} flares past the traced bodice`);
  for(let i = 1; i < side.length; i++) assert.ok(Math.abs(side[i][0] - side[i - 1][0]) < 0.15, `step in the side seam at ${side[i]}`);
  // the widening reaches no point of the bodice
  const widest = Math.max(...pts.filter(p => p[1] > belowCuffY).map(p => Math.abs(p[0])));
  assert.ok(widest < 5.6, `widest bodice point ${widest.toFixed(2)} in`);
});

// ---- 4, 5. long-sleeve aviator shirts draw the closed collar (tie / tab worn, 4.2.5.1.4, 4.2.6.3) ---------------------------------

test('the long aviator shirts draw the collar closed: the leaves meet at the knot / tab top close under their tips, the V between them is filled, and the short shirts keep the open collar', async () => {
  for(const [id, tie] of [['garment-aviator-shirt-male-long', 'tie_knot_top_center'], ['garment-aviator-shirt-female-long', 'tie_tab_top_center']]){
    const spec = await store.load(id), svg = readSvg(id);
    assert.match(svg, new RegExp(`id="${id}__closed-collar"`), `${id}: closed-collar group`);
    assert.match(svg, new RegExp(`id="${id}__collar-right"`));
    const tieSpec = readSpec(id + (tie === 'tie_knot_top_center' ? '-tie' : '-tie-tab'));
    for(const side of ['left', 'right']){
      const poly = core.landmark(spec, 'collar_' + side).points;
      const topY = Math.min(...poly.map(p => p.y));
      // the leaves' inner corner (the junction) is within 2.2 in of the tips, not the 5.4 in of the traced open V
      const junction = side === 'right' ? poly.reduce((m, p) => p.x > m.x ? p : m, poly[0]) : poly.reduce((m, p) => p.x < m.x ? p : m, poly[0]);
      assert.ok(junction.y - topY < 2.2, `${id} ${side}: leaves meet ${(junction.y - topY).toFixed(2)} in below the tips`);
    }
    // the tie / tab starts at the junction row and is clipped by both leaf polygons (the leaves lie over it)
    assert.ok(tieSpec.anchors[tie], `${id}: tie anchor ${tie}`);
    const tsvg = readSvg(id + (tie === 'tie_knot_top_center' ? '-tie' : '-tie-tab'));
    assert.match(tsvg, /noLeaf0/);
    assert.match(tsvg, /noLeaf1/);
  }
  for(const id of ['garment-aviator-shirt-male', 'garment-aviator-shirt-female']) assert.doesNotMatch(readSvg(id), /closed-collar/, `${id}: short shirt keeps the traced collar`);
});

test('the aviator beside the blazer and the plain aviator both draw the long shirt with the closed collar (tie knot at the neckband, leaves over the tie)', async () => {
  for(const [uniform, gender] of [['aviator', 'male'], ['aviator', 'female']]){
    const scene = await P.composeUniform(build(uniform, gender, 'senior', 'Capt', { sleeve: 'long', femaleTop: 'shirt' }), store);
    const garment = scene.layers.find(l => l.role === 'garment');
    assert.match(garment.id, /-long$/);
    const tie = scene.layers.find(l => /-tie(-tab)?$/.test(l.id || ''));
    assert.ok(tie, `${gender}: tie / tab layer`);
  }
});
