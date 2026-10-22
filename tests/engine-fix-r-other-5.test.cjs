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
      assert.ok(Math.abs(along(edge, axis) - along(top, axis)) <= 0.05, `${label}: along the strap ${along(edge, axis).toFixed(3)} edge-on vs ${along(top, axis).toFixed(3)} from above`);
      assert.ok(along(edge, cross) <= 0.325, `${label}: squeezed to the 0.4 in strip (${along(edge, cross).toFixed(3)} across)`);
      n++;
    }
  }
  assert.equal(n, 48);
});

test('the blue shirt\'s epaulet sleeves keep the cadet officer\'s miniature metal grade (CAPR 39-1 4.1.6.1.4)', async () => {
  for(const gender of ['male', 'female']){
    const scene = await compose(hb('blues_b', gender, 'cadet', 'C/Maj', { badgeIds: [AIRCREW] }));
    const edge = byKey(scene, 'grade:edge-right');
    assert.ok(edge, 'edge-on grade drawn');
    assert.match(edge.id, /-metal-miniature$/);
  }
});

// ---- 2. The blazer's left lapel lies over the semi-formal's miniature medals ---------------------------------------------

test('semi-formal blazer: the left lapel is drawn above every miniature drape, medal and device, clipped to the lapel; the chaplain badge stays whole above it with a scene note (CAPR 39-1 11.1.8, 4.2.1.5, 4.2.2.5)', async () => {
  for(const gender of ['male', 'female']){
    const scene = await compose(crit(`semi_formal-${gender}-senior-Capt-12minis`));
    const fgs = scene.layers.filter(l => l.key === 'layer:foreground');
    const top = fgs.find(l => l.clip);
    assert.ok(top && top.clip.length > 10, `${gender}: a lapel foreground clipped to the lapel polygon`);
    const minis = scene.layers.filter(l => /^mini/.test(l.key || '') || ['mini-drape', 'mini-medal', 'device'].includes(l.role));
    assert.ok(minis.length >= 24, `${gender}: ${minis.length} mini layers`);
    assert.ok(minis.every(l => l.z < top.z), `${gender}: no drape, medal or device above the lapel (max ${Math.max(...minis.map(l => l.z))} vs ${top.z})`);
    // The lapel polygon's bounds reach the rack (the lapel edge runs through its left column).
    const xs = top.clip.map(p => p.x), ys = top.clip.map(p => p.y);
    const hit = minis.filter(l => l.x < Math.max(...xs) && l.x + l.w > Math.min(...xs) && l.y < Math.max(...ys) && l.y + l.h > Math.min(...ys));
    assert.ok(hit.length > 0);
  }
  for(const gender of ['male', 'female']){
    const scene = await compose(crit(`semi_formal-${gender}-senior-SMSgt-lapel-chaplain`));
    const top = scene.layers.find(l => l.key === 'layer:foreground' && l.clip);
    const badge = scene.layers.find(l => l.role === 'badge');
    assert.ok(top && badge, `${gender}: lapel foreground and chaplain badge`);
    assert.ok(badge.z > top.z, `${gender}: the badge (z ${badge.z}) is whole above the lapel (z ${top.z})`);
    assert.ok(scene.notes.some(n => /meets the lapel/.test(n)), `${gender}: scene note that the badge meets the lapel`);
  }
});

// ---- 3. OCP: two badges are 1/2 in apart from blue edge to blue edge --------------------------------------------------

test('OCP two chest badges: the upper badge\'s blue bottom edge is 1/2 in above the lower one\'s blue top edge (CAPR 39-1 ICL 25-06 7.1.1.3.1, 7.1.1.3.1.2); the ABU and CFU stay silver to silver', async () => {
  for(const gender of ['male', 'female']) for(const [membership, rank, ids] of [['cadet', 'C/SSgt', [AIRCREW, 'emergency_services_badge']], ['cadet', 'C/Maj', [AIRCREW, 'emergency_services_badge']], ['senior', 'Capt', ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge']], ['senior', 'SMSgt', ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge']]]){
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

// ---- 4. ABU and CFU navy tactical cap: no cadet grade (6.2.11.1) ---------------------------------------------------------

test('ABU and CFU: a cadet officer wears no grade on the navy tactical cap (ICL 25-02 6.2.11.1), the ABU patrol cap keeps it (5.1.1.6); the OCP ball cap keeps it (7.1.1.8); senior officers keep it', async () => {
  for(const gender of ['male', 'female']) for(const u of ['abu', 'corporate_field']){
    const scene = await compose(hb(u, gender, 'cadet', 'C/Maj', { badgeIds: [AIRCREW] }));
    assert.ok(!byKey(scene, 'grade:baseball_cap_front_insignia_zone'), `${u} ${gender}: no grade on the tactical cap`);
    assert.ok(scene.notes.some(n => /6\.2\.11\.1/.test(n)), `${u} ${gender}: note cites 6.2.11.1`);
    if(u === 'abu') assert.ok(byKey(scene, 'grade:patrol_cap_front_insignia_zone'), `${gender}: the ABU patrol cap keeps the cadet officer grade`);
    const sen = await compose(hb(u, gender, 'senior', 'Capt', { badgeIds: ['CAPPilot1_FA9D33EA587D8'] }));
    assert.ok(byKey(sen, 'grade:baseball_cap_front_insignia_zone'), `${u} ${gender}: a senior officer keeps the grade on the tactical cap`);
  }
  const ocp = await compose(hb('ocp', 'male', 'cadet', 'C/Maj', { badgeIds: [AIRCREW] }));
  assert.ok(byKey(ocp, 'grade:baseball_cap_front_insignia_zone'), 'OCP ball cap keeps the cadet officer grade');
});
