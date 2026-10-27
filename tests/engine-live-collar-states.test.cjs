'use strict';
// LIVE10-MASTER-1 (Ethan: "short sleeves were fine, now they are not. the top button shouldn't be buttoned on class b's short sleeve"; CAPR 39-1 4.1.11.1.1.3, 4.1.12.4: the tie is
// optional with the short sleeve). The short Class B sheets (art 76963a86, synced 16c0dd3e) draw the open collar as their default and a second state, the closed leaves and neck, as a group
// drawn after it, and state `collar_states { open: 'collar', closed: 'collar-closed' }` with collar_right / collar_left (the open leaves) and collar_closed_right / collar_closed_left (the
// closed ones). The sheet's own note: hide group collar-closed for the open state, group collar for the closed state. The engine hides what the state does not show, and places the cadet NCO
// collar chevrons on the leaves of the state shown. The short sheets draw no collar-foreground group, so the engine redraws the group of the state shown (collar; collar-closed and tie) over the badges.
// A sheet that states no collar_states (the long Class B sheets, the aviator shirts) is drawn as it always was.
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
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));
const svgOf = id => fs.readFileSync(path.join(ROOT, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');

const SHORT = [['blues_b', 'male', 'garment-blues-class-b-shirt-male'], ['blues_b', 'female', 'garment-blues-class-b-blouse-female']];
const NO_STATES = [['blues_b', 'male', 'long', 'garment-blues-class-b-shirt-male-long'], ['blues_b', 'female', 'long', 'garment-blues-class-b-blouse-female-long'],
  ['aviator', 'male', 'short', 'garment-aviator-shirt-male'], ['aviator', 'female', 'long', 'garment-aviator-shirt-female-long']];

const build = (uniform, gender, membership, rank, opt, extra) => Object.assign(HARNESS.makeBuild({ uniform, gender, membership, rank, opt: Object.assign({ sleeve: 'short', headgear: 'none' }, opt || {}) }), extra || {});
const garmentLayer = scene => scene.layers.find(l => l.role === 'garment');
const chevrons = scene => scene.layers.filter(l => l.role === 'grade' && /rank-cadet-nco-/.test(l.id));
const centre = l => { const o = l.origin || { x: l.x + l.w / 2, y: l.y + l.h / 2 }; return { x: l.x + l.w / 2, y: l.y + l.h / 2, o }; };
const inside = (poly, p) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };

for(const [uniform, gender, sheet] of SHORT){
  test(`${sheet}: the sheet states its two collar states and the groups exist`, async () => {
    const sp = await store.load(sheet), svg = svgOf(sheet);
    assert.equal(sp.landmarks.collar_states.open, 'collar');
    assert.equal(sp.landmarks.collar_states.closed, 'collar-closed');
    for(const name of ['collar_right', 'collar_left', 'collar_closed_right', 'collar_closed_left']) assert.ok(sp.landmarks[name].points.length >= 6, name);
    assert.ok(svg.includes(`id="${sheet}__collar"`) && svg.includes(`id="${sheet}__collar-closed"`));
    assert.ok(svg.indexOf(`id="${sheet}__collar-closed"`) > svg.indexOf(`id="${sheet}__collar"`), 'the closed group is drawn after the open one');
    assert.ok(!svg.includes(`${sheet}__collar-foreground`), 'a short sheet draws no collar-foreground group');
  });

  test(`${sheet}: tie off shows the open collar (the closed group hidden), tie on the closed one (the open group hidden)`, async () => {
    const off = await P.composeUniform(build(uniform, gender, 'senior', 'Capt', { tie: false }), store);
    assert.deepEqual(garmentLayer(off).hideGroups, ['tie', 'collar-closed'], 'tie off: the tie and the closed collar are hidden, the open collar shows');
    const on = await P.composeUniform(build(uniform, gender, 'senior', 'Capt', { tie: true }), store);
    assert.deepEqual(garmentLayer(on).hideGroups, ['collar'], 'tie on: the open collar is hidden, the closed collar (drawn over it) and the tie show');
    // The page's default for the short sleeve is no tie (4.1.11.1.1.3, 4.1.12.4): the open collar.
    const dflt = await P.composeUniform(build(uniform, gender, 'senior', 'Capt', {}), store);
    assert.deepEqual(garmentLayer(dflt).hideGroups, ['tie', 'collar-closed']);
  });

  test(`${sheet}: the cadet NCO chevrons are on collar_right / collar_left with the tie off and on collar_closed_right / collar_closed_left with it on`, async () => {
    const sp = await store.load(sheet);
    const open = [sp.landmarks.collar_right.points, sp.landmarks.collar_left.points], closed = [sp.landmarks.collar_closed_right.points, sp.landmarks.collar_closed_left.points];
    for(const rank of ['C/SSgt', 'C/MSgt']){
      const off = await P.composeUniform(build(uniform, gender, 'cadet', rank, { tie: false }), store);
      const on = await P.composeUniform(build(uniform, gender, 'cadet', rank, { tie: true }), store);
      assert.equal(chevrons(off).length, 2);
      assert.equal(chevrons(on).length, 2);
      for(const c of chevrons(off)) assert.ok(open.some(poly => inside(poly, centre(c).o)), `${rank} tie off: the chevron's centre is on an open leaf`);
      for(const c of chevrons(on)) assert.ok(closed.some(poly => inside(poly, centre(c).o)), `${rank} tie on: the chevron's centre is on a closed leaf`);
      const moved = chevrons(off).map((c, i) => Math.hypot(c.origin.x - chevrons(on)[i].origin.x, c.origin.y - chevrons(on)[i].origin.y));
      assert.ok(moved.every(d => d > 0.3), `${rank}: the chevrons move with the leaves (${moved.map(d => d.toFixed(2))} in)`);
    }
  });

  test(`${sheet}: with the tie on the open collar's leaves reach past the closed ones, so the open group is hidden (the sheet's note)`, async () => {
    // The open leaves reach past the closed ones (the open collar is spread by the open neck): where they do, drawing both would show the open collar's cloth beside the closed leaves.
    const sp = await store.load(sheet);
    const cl = [sp.landmarks.collar_closed_right.points, sp.landmarks.collar_closed_left.points], op = [sp.landmarks.collar_right.points, sp.landmarks.collar_left.points];
    let outside = 0, total = 0;
    for(let k = 0; k < 2; k++){
      const xs = op[k].map(p => p.x), ys = op[k].map(p => p.y);
      for(let i = 0; i <= 40; i++) for(let j = 0; j <= 40; j++){
        const q = { x: Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * i / 40, y: Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * j / 40 };
        if(!inside(op[k], q)) continue;
        total++; if(!inside(cl[k], q)) outside++;
      }
    }
    assert.ok(outside / total > 0.05, `${(100 * outside / total).toFixed(0)} percent of the open leaves lies outside the closed ones: both drawn would show the open cloth`);
    const on = await P.composeUniform(build(uniform, gender, 'senior', 'Capt', { tie: true }), store);
    assert.ok(garmentLayer(on).hideGroups.includes('collar'));
  });
}

test('on a short sheet the collar still lies over the badges: the foreground is the group of the state shown (collar, or collar-closed with the tie), above the badges, and no badge is cut', async () => {
  for(const [uniform, gender] of [['blues_b', 'male'], ['blues_b', 'female']]){
    for(const tie of [false, true]){
      const scene = await P.composeUniform(build(uniform, gender, 'senior', 'Capt', { tie }, { badgeIds: ['emergency_services_badge', 'communications_technician_badge', 'christian_chaplin'] }), store);
      const fg = scene.layers.filter(l => l.role === 'garment-foreground');
      assert.equal(fg.length, 1, `${gender} tie ${tie}: one foreground layer`);
      assert.deepEqual(fg[0].onlyGroups, tie ? ['collar-closed', 'tie'] : ['collar'], `${gender} tie ${tie}: the groups of the state shown`);
      for(const l of scene.layers.filter(x => x.role === 'badge')){ assert.ok(!l.clipOut, `${l.key}: a badge is never cut`); assert.ok(l.z < fg[0].z, `${l.key}: below the foreground`); }
    }
  }
});

for(const [uniform, gender, sleeve, sheet] of NO_STATES){
  test(`${sheet}: a sheet that states no collar_states is drawn as before: the tie group alone is hidden, the same chevrons tie on or off`, async () => {
    const sp = await store.load(sheet);
    assert.equal(sp.landmarks.collar_states, undefined);
    const off = await P.composeUniform(build(uniform, gender, 'cadet', 'C/SSgt', { sleeve, tie: false }), store);
    assert.deepEqual(garmentLayer(off).hideGroups, ['tie']);
    const on = await P.composeUniform(build(uniform, gender, 'cadet', 'C/SSgt', { sleeve, tie: true }), store);
    assert.equal(garmentLayer(on).hideGroups, undefined);
    chevrons(off).forEach((c, i) => assert.deepEqual([c.x, c.y, c.rotate], [chevrons(on)[i].x, chevrons(on)[i].y, chevrons(on)[i].rotate]));
  });
}

test('the long Class B sheets still draw their collar-foreground group over the badges', async () => {
  for(const [uniform, gender, sleeve] of [['blues_b', 'male', 'long'], ['blues_b', 'female', 'long']]){
    const scene = await P.composeUniform(build(uniform, gender, 'senior', 'Capt', { sleeve }), store);
    assert.ok(scene.layers.some(l => l.role === 'garment-foreground'), `${gender} long: the collar foreground`);
  }
});
