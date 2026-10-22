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

// ---- 6. overblouse sleeve chevron -----------------------------------------------------------------------------

function inkPoints(id){
  return [...readSvg(id).matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => [Number(m[1]) / 100, Number(m[2]) / 100]);
}

test('the 3 1/2 in sleeve chevron on the short overblouse lies between the outline and the armhole seam: no ink past the seam onto the bodice (4.2.6.2.3, D8)', async () => {
  const spec = await store.load('garment-overblouse-female');
  const seam = core.landmark(spec, 'armhole_seam_right').points;
  const seamX = y => {
    for(let i = 0; i < seam.length - 1; i++){
      const a = seam[i], c = seam[i + 1];
      if((a.y - y) * (c.y - y) <= 0 && a.y !== c.y) return a.x + (c.x - a.x) * (y - a.y) / (c.y - a.y);
    }
    return y > seam[seam.length - 1].y ? seam[seam.length - 1].x : seam[0].x;
  };
  for(const rank of ['SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt']){
    const scene = await P.composeUniform(build('aviator', 'female', 'senior', rank, { sleeve: 'short', femaleTop: 'overblouse' }), store);
    const l = scene.layers.find(x => x.role === 'grade' && x.key === 'grade:sleeve-right');
    assert.ok(l, `${rank}: right chevron`);
    assert.equal(l.w, 3.5);
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2, r = l.rotate * Math.PI / 180;
    let worst = -Infinity;
    for(const [px, py] of inkPoints(l.id)){
      const dx = px - l.w / 2, dy = py - l.h / 2;
      worst = Math.max(worst, cx + dx * Math.cos(r) - dy * Math.sin(r) - seamX(cy + dx * Math.sin(r) + dy * Math.cos(r)));
    }
    assert.ok(worst < -0.05, `${rank}: chevron ink ${worst.toFixed(3)} in past the armhole seam (want at least 0.05 in clear)`);
    // the turn follows the sleeve (the outline's slanted edge, about 30 deg), the wearer's left mirrors it
    assert.ok(Math.abs(l.rotate - 30.4) < 1, `${rank}: rotate ${l.rotate}`);
    const left = scene.layers.find(x => x.role === 'grade' && x.key === 'grade:sleeve-left');
    assert.ok(Math.abs(left.rotate + l.rotate) < 1e-6 && Math.abs((left.x + left.w / 2) - (scene.bounds.w - (l.x + l.w / 2))) < 0.01, `${rank}: left mirrors right`);
  }
});

test('the overblouse sheet states its sleeve widening as an estimate (the regulation gives no sleeve width)', () => {
  const w = readSpec('garment-overblouse-female').dimensions.sleeve_widening;
  assert.ok(w && w.outward_in > 0 && w.size_source === 'estimated');
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
