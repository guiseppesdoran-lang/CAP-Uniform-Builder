'use strict';
// LIVE10-MASTER-1 (Ethan: "short sleeves were fine, now they are not. the top button shouldn't be buttoned on class b's short sleeve"; CAPR 39-1 4.1.11.1.1.3, 4.1.12.4: the tie is
// optional with the short sleeve). The short Class B sheets (art 76963a86, synced 16c0dd3e) draw the open collar as their default and a second state, the closed leaves and neck, as a group
// drawn after it, and state `collar_states { open: 'collar', closed: 'collar-closed' }` with collar_right / collar_left (the open leaves) and collar_closed_right / collar_closed_left (the
// closed ones). The sheet's own note: hide group collar-closed for the open state, group collar for the closed state. The engine hides what the state does not show, and places the cadet NCO
// collar chevrons on the leaves of the state shown. The short sheets draw no collar-foreground group, so the engine redraws the group of the state shown (collar; collar-closed and tie) over the badges.
// LIVE12 E51 (Ducky: "why is the collar closed on the aviator shirt if theres no tie"; CAPR 39-1 4.2.5.1.4, 4.2.6.3: the tie / tab is optional with the short sleeve; 4.2.5.1.9, 4.2.6.9: the
// undershirt not visible with the collar open): the short aviator sheets (art 66518f14, LIVE12-ART 1) state the same two states, the open camp collar (the neck in the V) the default. Their closed
// group also holds a shirt-coloured cover of the open collar, so over the badges the engine redraws the tie and the closed group's named pieces, not the whole group.
// A sheet that states no collar_states (the long Class B and aviator sheets) is drawn as it always was.
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
const C = require('../js/engine/compose.js');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images/MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));
const svgOf = id => fs.readFileSync(path.join(ROOT, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');

const SHORT = [['blues_b', 'male', 'garment-blues-class-b-shirt-male'], ['blues_b', 'female', 'garment-blues-class-b-blouse-female'],
  ['aviator', 'male', 'garment-aviator-shirt-male'], ['aviator', 'female', 'garment-aviator-shirt-female']];
const NO_STATES = [['blues_b', 'male', 'long', 'garment-blues-class-b-shirt-male-long'], ['blues_b', 'female', 'long', 'garment-blues-class-b-blouse-female-long'],
  ['aviator', 'male', 'long', 'garment-aviator-shirt-male-long'], ['aviator', 'female', 'long', 'garment-aviator-shirt-female-long']];

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
      // The women's tie tab is drawn over the badges below the closed group's leaves, the group's cover and placket left to the base sheet under it (LIVE12 E60b, 4.1.12.4); the men's
      // tie with the closed group, in the sheet's order.
      const fg = scene.layers.filter(l => l.role === 'garment-foreground');
      const want = !tie ? [[['collar'], null]] : gender === 'female'
        ? [[['tie'], null], [['collar-closed'], ['collar-closed-cover', 'collar-closed-placket']]]
        : [[['collar-closed', 'tie'], null]];
      assert.deepEqual(fg.map(l => [l.onlyGroups, l.hideGroups || null]), want, `${gender} tie ${tie}: the groups of the state shown`);
      for(let i = 1; i < fg.length; i++) assert.ok(fg[i - 1].z < fg[i].z, 'in that order');
      for(const l of scene.layers.filter(x => x.role === 'badge')){ assert.ok(!l.clipOut, `${l.key}: a badge is never cut`); assert.ok(fg.every(f => l.z < f.z), `${l.key}: below the foreground`); }
    }
  }
});

// The aviator's closed group draws, under masks and clips, a shirt-coloured cover of the open V and the two open pieces before its named pieces (the back of the collar, the two leaves, the
// women's neck edge). Redrawn whole over the badges it would paint the shirt over a ribbon lying where the open pieces would be; the foreground is the tie and the named pieces.
// The women's tie tab is redrawn on its own layer below the closed pieces (LIVE12 E59, 4.2.6.3: the tab is worn under the closed collar); the men's tie with them.
const AVIATOR_CLOSED_FG = { male: [['tie', 'collar-closed-back', 'collar-closed-right', 'collar-closed-left']], female: [['tie'], ['collar-closed-back', 'collar-closed-right', 'collar-closed-left', 'neck-edge']] };
const RACK = require('../data/ribbon-awards.js'), ALL_RIBBONS = Object.keys(RACK.FAMILIES).map(id => [id]);
test('short aviator sheets: the collar of the state shown lies over the badges and ribbons; the foreground is the open group, or the tie and the closed pieces without the cover; nothing is cut (4.2.5.1.3.1, 4.2.6.2.7.1)', async () => {
  for(const gender of ['male', 'female']){
    const sheet = 'garment-aviator-shirt-' + gender, svg = svgOf(sheet);
    for(const id of AVIATOR_CLOSED_FG[gender].flat()) assert.ok(svg.includes(`id="${sheet}__${id}"`), `${sheet}: ${id} is drawn`);
    // the cover the foreground leaves out: the closed group holds it before its named pieces
    const closedAt = svg.indexOf(`id="${sheet}__collar-closed"`);
    assert.ok(svg.indexOf(`${sheet}__coverArea`, closedAt) > closedAt && svg.indexOf(`${sheet}__coverArea`, closedAt) < svg.indexOf(`id="${sheet}__collar-closed-back"`), `${sheet}: the closed group's cover comes before its pieces`);
    for(const tie of [false, true]){
      const scene = await P.composeUniform(HARNESS.makeBuild({ uniform: 'aviator', gender, membership: 'senior', rank: 'Capt', opt: { sleeve: 'short', headgear: 'none', tie }, badgeIds: ['observer_badge', 'christian_chaplin'], ribbonSel: ALL_RIBBONS }), store);
      const fg = scene.layers.filter(l => l.role === 'garment-foreground');
      assert.deepEqual(fg.map(l => l.onlyGroups), tie ? AVIATOR_CLOSED_FG[gender] : [['collar']], `${gender} tie ${tie}: the groups of the state shown`);
      if(fg.length > 1) assert.ok(fg[0].z < fg[1].z, `${gender}: the tab below the closed pieces`);
      const placed = scene.layers.filter(x => ['badge', 'ribbon', 'device'].includes(x.role));
      assert.ok(placed.some(l => l.role === 'ribbon') && placed.some(l => l.role === 'badge'), 'ribbons and badges are drawn');
      // the rack of every CAP ribbon family reaches the collar of the state shown, and the foreground covers it there; the women's closed leaves end above the tallest rack (3.90 in), so not there
      const sp = await store.load(sheet);
      const polys = (tie ? ['collar_closed_right', 'collar_closed_left'] : ['collar_right', 'collar_left']).map(n => sp.landmarks[n].points);
      const reaches = placed.some(l => l.role === 'ribbon' && polys.some(poly => C.rectHitsPolygon(l, poly)));
      assert.equal(reaches, !(gender === 'female' && tie), `${gender} tie ${tie}: a ribbon reaches a collar leaf of the state shown`);
      // E130 (Doran: "It's cutting the wings off"): a ribbon or device is tucked under the collar; a badge the leaf reaches keeps its place and is drawn whole above the foreground.
      for(const l of placed){
        assert.ok(!l.clipOut, `${l.key}: covered by the collar, not cut`);
        const touches = l.role === 'badge' && polys.some(poly => C.rectHitsPolygon(l, poly));
        if(touches) assert.ok(fg.every(f => l.z > f.z), `${l.key}: a badge on the collar leaf is above the foreground, whole`);
        else assert.ok(fg.every(f => l.z < f.z), `${l.key}: below the foreground`);
      }
    }
  }
});

test('short aviator sheets: the cadet NCO chevrons lie above the collar foreground (they are worn on the collar), on the long sheets at the insignia layer as before', async () => {
  for(const gender of ['male', 'female']){
    for(const [sleeve, tie] of [['short', false], ['short', true], ['long', true]]){
      const scene = await P.composeUniform(build('aviator', gender, 'cadet', 'C/MSgt', { sleeve, tie }), store);
      const fg = scene.layers.filter(l => l.role === 'garment-foreground');
      assert.equal(chevrons(scene).length, 2);
      if(sleeve === 'long'){ assert.equal(fg.length, 0, `${gender} long: no foreground`); continue; }
      for(const c of chevrons(scene)) assert.ok(fg.every(f => c.z > f.z), `${gender} ${sleeve} tie ${tie}: the chevron (z ${c.z}) above the collar foreground (z ${fg.map(f => f.z)})`);
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
