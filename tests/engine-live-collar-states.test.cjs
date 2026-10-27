'use strict';
// LIVE10-MASTER-1 (Ethan: "short sleeves were fine, now they are not. the top button shouldn't be buttoned on class b's short sleeve"; CAPR 39-1 4.1.11.1.1.3, 4.1.12.4: the tie is
// optional with the short sleeve). The redrawn short Class B sheets draw the open collar as their default and a second state, the closed leaves and neck, as a group drawn after it,
// and say so in the landmark collar_states { open: <group>, closed: <group> } with collar_right / collar_left (the open leaves) and collar_closed_right / collar_closed_left (the
// closed ones). The engine hides the closed group unless the tie is on, and places the cadet NCO collar chevrons on the leaves of the state shown. The real sheets arrive with the
// art sync (FOLLOWUPS), so this is written against the landmark names and proved on a faked sheet; a sheet that states no collar_states must be unchanged.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images/MANIFEST.json'), 'utf8'));
const loadRaw = p => JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'));
const plain = core.createSpecStore(manifest, p => Promise.resolve(loadRaw(p)));

// The sheets get collar_states, and closed leaves that are the open ones drawn 80 percent size about their own centre and moved 0.5 in toward the middle.
const SHEETS = ['garment-blues-class-b-shirt-male', 'garment-blues-class-b-blouse-female'];
const shrink = (poly, k, dx) => { const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cy = poly.reduce((s, q) => s + q[1], 0) / poly.length; return poly.map(q => [cx + (q[0] - cx) * k + dx, cy + (q[1] - cy) * k]); };
const faked = core.createSpecStore(manifest, p => {
  const raw = loadRaw(p), id = p.replace(/^.*\//, '').replace(/\.spec\.json$/, '');
  if(SHEETS.includes(id)){
    const lm = Object.assign({}, raw.landmarks, { collar_states: { open: 'collar', closed: 'collar-closed' } });
    lm.collar_closed_right = shrink(raw.landmarks.collar_right, 0.8, 50);
    lm.collar_closed_left = shrink(raw.landmarks.collar_left, 0.8, -50);
    raw.landmarks = lm;
  }
  return Promise.resolve(raw);
});

const build = (uniform, gender, membership, rank, opt) => HARNESS.makeBuild({ uniform, gender, membership, rank, opt: Object.assign({ sleeve: 'short', headgear: 'none' }, opt || {}) });
const garmentLayer = scene => scene.layers.find(l => l.role === 'garment');
const chevrons = scene => scene.layers.filter(l => l.role === 'grade' && /rank-cadet-nco-/.test(l.id));
const centre = l => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });
const inside = (poly, p) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };

for(const [uniform, gender, sheet] of [['blues_b', 'male', SHEETS[0]], ['blues_b', 'female', SHEETS[1]]]){
  test(`${sheet}: the closed collar group is hidden until the tie is on`, async () => {
    const off = await P.composeUniform(build(uniform, gender, 'senior', 'Capt', { tie: false }), faked);
    assert.deepEqual(garmentLayer(off).hideGroups, ['tie', 'collar-closed'], 'tie off: the tie and the closed collar are hidden, the open collar shows');
    const on = await P.composeUniform(build(uniform, gender, 'senior', 'Capt', { tie: true }), faked);
    assert.equal(garmentLayer(on).hideGroups, undefined, 'tie on: the closed collar (drawn after the open one) and the tie show');
  });

  test(`${sheet}: the cadet NCO chevrons are on the leaves of the state shown`, async () => {
    const sp = await faked.load(sheet);
    const open = [sp.landmarks.collar_right.points, sp.landmarks.collar_left.points], closed = [sp.landmarks.collar_closed_right.points, sp.landmarks.collar_closed_left.points];
    const off = await P.composeUniform(build(uniform, gender, 'cadet', 'C/SSgt', { tie: false }), faked);
    const on = await P.composeUniform(build(uniform, gender, 'cadet', 'C/SSgt', { tie: true }), faked);
    assert.equal(chevrons(off).length, 2);
    assert.equal(chevrons(on).length, 2);
    for(const c of chevrons(off)) assert.ok(open.some(poly => inside(poly, centre(c))), 'tie off: the chevron is on an open leaf');
    for(const c of chevrons(on)) assert.ok(closed.some(poly => inside(poly, centre(c))), 'tie on: the chevron is on a closed leaf');
    const moved = chevrons(off).map((c, i) => Math.hypot(centre(c).x - centre(chevrons(on)[i]).x, centre(c).y - centre(chevrons(on)[i]).y));
    assert.ok(moved.some(d => d > 0.2), `the chevrons move with the leaves (${moved.map(d => d.toFixed(2))} in)`);
  });
}

test('a sheet that states no collar_states is unchanged: the tie group alone is hidden, the same chevrons, the same scene with or without the new code path', async () => {
  for(const [uniform, gender] of [['blues_b', 'male'], ['blues_b', 'female']]){
    const off = await P.composeUniform(build(uniform, gender, 'cadet', 'C/SSgt', { tie: false }), plain);
    assert.deepEqual(garmentLayer(off).hideGroups, ['tie']);
    const on = await P.composeUniform(build(uniform, gender, 'cadet', 'C/SSgt', { tie: true }), plain);
    assert.equal(garmentLayer(on).hideGroups, undefined);
    // Tie on or off, the chevrons lie where they did: on the one collar the sheet draws.
    chevrons(off).forEach((c, i) => assert.deepEqual([c.x, c.y, c.rotate], [chevrons(on)[i].x, chevrons(on)[i].y, chevrons(on)[i].rotate]));
  }
});

test('the aviator shirts, which state no collar_states, are drawn as before', async () => {
  for(const gender of ['male', 'female']){
    const scene = await P.composeUniform(build('aviator', gender, 'senior', 'Capt', { tie: false }), plain);
    assert.deepEqual(garmentLayer(scene).hideGroups, ['tie']);
  }
});
