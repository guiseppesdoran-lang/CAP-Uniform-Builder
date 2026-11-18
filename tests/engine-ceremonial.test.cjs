'use strict';
// CER (owner, 2026-11-11: "Ceremonials. Add that as a selectable uniform, and generate all applicable artwork"): the Honor Guard Uniform of CAPR 39-1 9.6, the Service Dress coat
// (9.6.5) or the Blue Service shirt or blouse (9.6.6) with the honor guard items put on. It is not a second drawing: the engine draws Class A or Class B as it always does and
// adds the white pistol belt (9.6.7.6) or, for a flag bearer, the white flag sling (9.6.3) and never both, the white ascot with the Honor Guard patch (9.6.7.8) in place of the tie or
// tab, the metallic silver shoulder cord (9.6.7.5), under the epaulet like every cord, and the male service cap with the Cadet Officer device and the rear chinstrap (9.6.7.9), lifted until it
// clears the patch; on the shirt and blouse the collar is worn open and laid back (the sheet's group collar-honor-guard).
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
const RULES = require('../data/uniform-rules.js');
const { compute: hatInk } = require('../scripts/measure-hat-ink.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const INK = hatInk();

const CUTS = [
  { sheet: 'garment-blues-class-a-coat', uniform: 'blues_a', gender: 'male', opt: {}, chinstrap: 'down', name: "men's coat" },
  { sheet: 'garment-blues-class-a-coat-female', uniform: 'blues_a', gender: 'female', opt: {}, chinstrap: 'down', name: "women's coat" },
  { sheet: 'garment-blues-class-b-shirt-male', uniform: 'blues_b', gender: 'male', opt: { sleeve: 'short' }, chinstrap: 'up', name: "men's shirt, short" },
  { sheet: 'garment-blues-class-b-shirt-male-long', uniform: 'blues_b', gender: 'male', opt: { sleeve: 'long' }, chinstrap: 'down', name: "men's shirt, long" },
  { sheet: 'garment-blues-class-b-blouse-female', uniform: 'blues_b', gender: 'female', opt: { sleeve: 'short' }, chinstrap: 'up', name: "women's blouse, short" },
  { sheet: 'garment-blues-class-b-blouse-female-long', uniform: 'blues_b', gender: 'female', opt: { sleeve: 'long' }, chinstrap: 'down', name: "women's blouse, long" }
];
const CAPS = { up: 'hat-service-cap-honor-guard', down: 'hat-service-cap-honor-guard-chinstrap-down' };
const CADETS = ['C/SSgt', 'C/Maj'];

const build = (cut, o) => HARNESS.makeBuild(Object.assign({
  uniform: cut.uniform, gender: cut.gender, membership: 'cadet', rank: 'C/Maj', name: { first: 'Pat', last: 'Doe', show: true },
  opt: Object.assign({ headgear: 'auto' }, cut.opt), cord: 'honor_guard'
}, o || {}));
const guard = (cut, role, chinstrap, o) => build(cut, Object.assign({ ceremonial: { role, chinstrap } }, o || {}));
const compose = b => P.composeUniform(b, store);
const layerOf = (scene, role) => scene.layers.filter(l => l.role === role);
const lowestInk = (hat, spec) => hat.y + Math.max(...INK[hat.id].map(p => p[1])) * hat.w / spec.w;
const patchTopOf = async cut => (await store.load(`${cut.sheet}-honor-guard-ascot`)).raw.landmarks.patch_slot.y / 100;

test('who is offered it: cadets, not senior members; the ascot takes the tie\'s place, long sleeves included; the chinstrap starts at the figure\'s', () => {
  assert.equal(RULES.allowsCeremonial('cadet'), true);
  assert.equal(RULES.allowsCeremonial('senior'), false);
  assert.equal(RULES.allowsCeremonial(''), true, 'no membership chosen yet: the card is not hidden');
  assert.equal(RULES.isUniformAllowedFor('ceremonial', 'cadet'), true);
  assert.equal(RULES.isUniformAllowedFor('ceremonial', 'senior'), false);
  assert.equal(RULES.isUniformAllowedFor('ceremonial', 'senior', { adultCadet: true }), false);
  assert.deepEqual(RULES.CEREMONIAL.membership, ['cadet']);
  assert.deepEqual(RULES.CEREMONIAL.bases, { coat: 'blues_a', shirt: 'blues_b' }, 'it rides on Class A and Class B, and has no rule rows of its own');
  assert.equal(RULES.getUniformRule('ceremonial'), null);
  for(const gender of ['male', 'female']) for(const sleeve of ['short', 'long']){
    const plain = RULES.tieRule('blues_b', { gender, sleeve });
    const honor = RULES.tieRule('blues_b', { gender, sleeve, ceremonial: true });
    assert.equal(honor.offered, false, `${gender} ${sleeve}: no tie box`);
    assert.equal(honor.defaultOn, false, `${gender} ${sleeve}: no tie or tab`);
    assert.equal(plain.defaultOn, sleeve === 'long', 'the shirt\'s own rule is untouched');
  }
  assert.equal(RULES.ceremonialChinstrap('blues_a', undefined), 'down', 'on the coat');
  assert.equal(RULES.ceremonialChinstrap('blues_b', 'long'), 'down', 'with long sleeves');
  assert.equal(RULES.ceremonialChinstrap('blues_b', 'short'), 'up', 'with short sleeves');
  assert.equal(RULES.ceremonialBase('coat'), 'blues_a');
  assert.equal(RULES.ceremonialBase('shirt'), 'blues_b');
  assert.equal(RULES.CEREMONIAL.cord, 'honor_guard');
});

for(const cut of CUTS) for(const role of ['guard', 'flag']){
  test(`${cut.name}, ${role === 'flag' ? 'flag bearer' : 'guard'}: its belt or its sling and never both, the ascot with the patch centred on it, no tie or tab, the cap`, async () => {
    const scene = await compose(guard(cut, role, cut.chinstrap));
    const ids = scene.layers.filter(l => l.type === 'asset').map(l => l.id);
    const belt = `${cut.sheet}-honor-guard-belt`, sling = `${cut.sheet}-honor-guard-flag-sling`, ascot = `${cut.sheet}-honor-guard-ascot`;
    assert.equal(ids.includes(belt), role === 'guard', 'the white pistol belt is worn by every member except flag bearers');
    assert.equal(ids.includes(sling), role === 'flag', 'the white flag sling is worn by flag bearers instead of the belt');
    assert.equal(scene.layers.filter(l => l.role === 'honor-guard-belt' || l.role === 'honor-guard-sling').length, 1, 'never both (the flag bearer\'s sling is drawn a second time over the breast, role honor-guard-sling-over)');
    assert.equal(ids.filter(id => id === ascot).length, 1, 'the ascot');
    const patch = scene.layers.find(l => l.id === 'patch-honor-guard');
    assert.ok(patch, 'the Honor Guard patch');
    const ascotSpec = await store.load(ascot), at = core.anchor(ascotSpec, 'patch_center');
    assert.ok(Math.abs(patch.x + patch.w / 2 - at.x) < 0.001 && Math.abs(patch.y + patch.h / 2 - at.y) < 0.001, `the patch is centred on the ascot's patch_center (${at.x}, ${at.y})`);
    assert.ok(Math.abs(patch.w - 3) < 0.001 && Math.abs(patch.h - 2.938) < 0.001, 'at the patch\'s own size');
    // draw order: belt and sling over the body, under the epaulet strips, the nameplate and the badges; ascot over the body; the patch over the ascot; the cord above the sling
    const z = role === 'flag' ? layerOf(scene, 'honor-guard-sling')[0].z : layerOf(scene, 'honor-guard-belt')[0].z;
    const body = scene.layers.find(l => l.role === 'garment');
    const asc = layerOf(scene, 'honor-guard-ascot')[0];
    assert.ok(z > body.z && z < 4, 'over the body, under the nameplate (4) and everything above it');
    assert.ok(asc.z > body.z && patch.z > asc.z, 'the ascot over the body, the patch over the ascot');
    const cord = scene.layers.find(l => l.id === `${cut.sheet}-cord-honor-guard`);
    assert.ok(cord && cord.z > z, 'the cord lies above the belt or sling');
    const tie = scene.layers.filter(l => /tie/.test(l.role) || /-tie/.test(l.id || ''));
    assert.deepEqual(tie, [], 'no tie, tab or clasp is drawn');
    // the cap
    const cap = scene.layers.find(l => l.role === 'hat');
    assert.equal(cap.id, CAPS[cut.chinstrap], 'the cap form follows the chinstrap');
    assert.ok(scene.layers.some(l => l.role === 'hat-device' && l.id === 'cap-device-cadet-officer-service'), 'with the Cadet Officer cap device, for every member');
    assert.ok(!scene.notes.some(n => /cannot be shown/.test(n)), scene.notes.join(' | '));
  });
}

test('the chinstrap picks the cap form, and with none given it starts where the guidance figure has it', async () => {
  for(const cut of CUTS) for(const chin of ['up', 'down']){
    const scene = await compose(guard(cut, 'guard', chin));
    assert.equal(scene.layers.find(l => l.role === 'hat').id, CAPS[chin], `${cut.name} ${chin}`);
  }
  for(const cut of CUTS){
    const scene = await compose(build(cut, { ceremonial: { role: 'guard' } }));
    assert.equal(scene.layers.find(l => l.role === 'hat').id, CAPS[cut.chinstrap], `${cut.name}: the start value`);
  }
});

test('the cap is lifted until its lowest ink is 0.25 in or more above the top of the ascot\'s patch place, on every cut and both forms, and by no more than it must be', async () => {
  const lifted = [];
  for(const cut of CUTS) for(const chin of ['up', 'down']){
    const scene = await compose(guard(cut, 'guard', chin));
    const hat = scene.layers.find(l => l.role === 'hat'), spec = await store.load(hat.id);
    const limit = (await patchTopOf(cut)) - 0.25, bottom = lowestInk(hat, spec);
    assert.ok(bottom <= limit + 1e-6, `${cut.name} ${chin}: the lowest ink ${bottom.toFixed(3)} is above ${limit.toFixed(3)}`);
    // where the cap sits on every service cap: its garment_attach_center on the sheet's top_center, 0.25 in down
    const sheet = await store.load(cut.sheet), top = core.anchor(sheet, 'top_center'), attach = core.anchor(spec, 'garment_attach_center');
    const seat = top.y + 0.25 - attach.y;
    if(hat.y < seat - 1e-6){
      lifted.push(`${cut.name} ${chin}`);
      assert.ok(Math.abs(bottom - limit) < 0.002, `${cut.name} ${chin}: lifted just enough (ink ${bottom.toFixed(4)}, limit ${limit.toFixed(4)})`);
    }else assert.ok(Math.abs(hat.y - seat) < 1e-6, `${cut.name} ${chin}: not lifted when it clears`);
    // the device and the cap stay together
    const dev = scene.layers.find(l => l.role === 'hat-device');
    assert.ok(dev.y > hat.y && dev.y + dev.h < hat.y + hat.h, `${cut.name} ${chin}: the device is on the cap`);
  }
  assert.ok(lifted.length > 0, 'at least one cut needs the lift (the women\'s coat\'s patch is under the cap seated as every service cap is)');
});

test('outside Honor Guard the cap sits where it always did: no lift, no honor guard cap, the hat of the uniform', async () => {
  for(const cut of CUTS){
    const scene = await compose(HARNESS.makeBuild({ uniform: cut.uniform, gender: cut.gender, membership: 'cadet', rank: 'C/Maj', opt: Object.assign({ headgear: 'service' }, cut.opt) }));
    const hat = scene.layers.find(l => l.role === 'hat');
    assert.match(hat.id, /^hat-service-cap-(men|women)-cadet-officer$/, cut.name);
    const sheet = await store.load(cut.sheet), spec = await store.load(hat.id);
    const seat = core.anchor(sheet, 'top_center').y + 0.25 - core.anchor(spec, 'garment_attach_center').y;
    assert.ok(Math.abs(hat.y - seat) < 1e-6 || sheet.anchors.hat_attach, `${cut.name}: seated at top_center + 0.25 in`);
    assert.equal(scene.layers.filter(l => /honor-guard/.test(l.id || '')).length, 0, 'nothing of the honor guard');
    assert.ok(scene.layers.every(l => !l.showGroups), 'no group shown');
  }
});

test('the silver cord lies under everything in this uniform, as on the plain Class A and Class B (owner, 2026-11-18)', async () => {
  for(const cut of CUTS) for(const rank of ['C/Maj', 'C/Col']){
    const on = await compose(guard(cut, 'guard', 'down', { rank }));
    const flag = await compose(guard(cut, 'flag', 'down', { rank }));
    const plain = await compose(build(cut, { rank }));
    const run = scene => scene.layers.find(l => l.cordLook && !l.cordLook.pendant && !l.cordLook.tip);
    for(const [tag, scene] of [['guard', on], ['flag', flag]]){
      const r = run(scene), tagged = `${cut.name} ${rank} ${tag}`;
      assert.equal(r.id, `${cut.sheet}-cord-honor-guard`);
      assert.deepEqual(r.cordLook, { id: 'honor_guard', colour: null }, `${tagged}: the silver cord`);
      const over = scene.layers.filter(l => /^epaulet(-shade:[a-z]+|-tip)?:left$/.test(l.key || '') || l.role === 'epaulet' || l.role === 'epaulet-edge');
      assert.ok(over.length, `${tagged}: an epaulet or board is drawn`);
      assert.ok(over.every(l => l.z > r.z), `${tagged}: every epaulet layer lies over the cord (${r.z})`);
      assert.ok(scene.layers.filter(l => l.role === 'badge' || l.role === 'ribbon' || l.role === 'nameplate').every(l => l.z > r.z), `${tagged}: and what is pinned on`);
      assert.equal(r.z, 7.5, `${tagged}: at the plain uniform's height`);
      assert.ok(Array.isArray(r.clip) && Math.hypot(r.clip[0].x - r.clip[5].x, r.clip[0].y - r.clip[5].y) < 1, `${tagged}: cut away under the epaulet, as on the plain uniform`);
      assert.equal(r.cordPath.d, run(plain).cordPath.d, `${tagged}: the same path as on the plain uniform`);
    }
    assert.equal(run(plain).z, 7.5);
  }
});

test('nothing sets or reads a switch that lays the cord over the epaulet: the harness and the engine have none', () => {
  const engineDir = path.join(root, 'js', 'engine');
  for(const f of fs.readdirSync(engineDir).filter(f => f.endsWith('.js'))){
    const src = fs.readFileSync(path.join(engineDir, f), 'utf8');
    assert.doesNotMatch(src, /cordOnTop/, `${f} has no such switch`);
  }
  assert.equal('cordOnTop' in HARNESS.makeBuild({ uniform: 'blues_a', membership: 'cadet', rank: 'C/Maj' }), false, 'the harness has none');
  assert.equal(HARNESS.makeBuild({ uniform: 'blues_a', membership: 'cadet', rank: 'C/Maj' }).ceremonial, undefined, 'and it has no honor guard unless a build asks');
});

test('Class B: the honor guard collar is shown and what it replaces is hidden, exactly what the sheet\'s spec lists', async () => {
  for(const cut of CUTS.filter(c => c.uniform === 'blues_b')) for(const role of ['guard', 'flag']){
    const scene = await compose(guard(cut, role, cut.chinstrap));
    const spec = await store.load(cut.sheet), lm = spec.raw.landmarks.collar_honor_guard;
    const base = scene.layers.find(l => l.role === 'garment');
    // the women's blouse sheets also draw the slacks female team members wear (9.6.7.3) in place of the skirt: the sheet's landmark lower_slacks names both groups
    const slacks = spec.raw.landmarks.lower_slacks;
    assert.equal(!!slacks, cut.gender === 'female', `${cut.name}: only the women's blouse sheets carry slacks`);
    assert.deepEqual(base.showGroups, ['collar-honor-guard'].concat(slacks ? slacks.shows : []), `${cut.name}: shown`);
    assert.deepEqual([...base.hideGroups].sort(), [...lm.hides, ...(slacks ? slacks.hides : [])].sort(), `${cut.name}: hides exactly what the spec lists`);
    const fg = scene.layers.find(l => l.role === 'garment-foreground');
    assert.deepEqual(fg.onlyGroups, ['collar-honor-guard'], `${cut.name}: the collar redrawn over the badges is the honor guard collar`);
    assert.deepEqual(fg.showGroups, ['collar-honor-guard']);
    assert.deepEqual(fg.hideGroups, ['collar-honor-guard-neck'], 'without the neck band the ascot lies on');
  }
  for(const cut of CUTS.filter(c => c.uniform === 'blues_b')){
    const plain = await compose(build(cut, {}));
    const base = plain.layers.find(l => l.role === 'garment');
    assert.ok(!base.showGroups, `${cut.name}: outside Honor Guard the sheet shows no such group`);
  }
});

test('Class A: nothing of the coat is hidden, the shirt, collar flaps and tie being under the ascot, and the sling is under the lapel foreground and the shoulder boards', async () => {
  for(const cut of CUTS.filter(c => c.uniform === 'blues_a')){
    const scene = await compose(guard(cut, 'flag', 'down'));
    const base = scene.layers.find(l => l.role === 'garment');
    assert.ok(!base.hideGroups && !base.showGroups, `${cut.name}: the coat sheet is drawn whole`);
    const sling = layerOf(scene, 'honor-guard-sling')[0], lapel = scene.layers.find(l => l.id === `${cut.sheet}-lapel-foreground`);
    assert.ok(lapel && lapel.z > sling.z, `${cut.name}: the lapel foreground over the straps`);
    const asc = layerOf(scene, 'honor-guard-ascot')[0];
    assert.ok(lapel.z > asc.z, `${cut.name}: and over the ascot`);
    const strips = scene.layers.filter(l => /^epaulet/.test(l.role));
    assert.ok(strips.length && strips.every(l => l.z > sling.z), `${cut.name}: the shoulder boards over the straps`);
  }
});

// A full rack of ten ribbons with a badge over it and one below, and the nameplate: every breast item the sling's straps can cross.
const RACK = [['mitchell_award', 'earned_cos_star'], ['armstrong_achievement'], ['rickenbacker_achievement'], ['wright_brothers_award'], ['curry_achievement'], ['hap_arnold_achievement'], ['cap_achievment_award', 'capub_total_7'], ['community_service_ribbon'], ['cadet_special_activity_ribbon'], ['encampment_ribbon']];
const breastBuild = (cut, role) => guard(cut, role, cut.chinstrap, { rank: 'C/Maj', ribbonSel: RACK, badgeIds: ['AirCrew1_DB3F0FCC3650F', 'emergency_services_badge'] });
const BREAST = l => (l.type === 'asset' && ['ribbon', 'device', 'badge'].includes(l.role)) || l.key === 'text:name' || (l.type === 'asset' && l.role === 'garment-layer' && /-nametag-(cadet|adult)$/.test(l.id));
const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('the members\' insignia lie over the guard\'s pistol belt: ribbons, nameplate and badges are above it, and a guard has nothing drawn over the breast; the collar insignia sit on the honor guard leaves', async () => {
  for(const cut of CUTS){
    const b = guard(cut, 'guard', cut.chinstrap, { rank: cut.uniform === 'blues_b' ? 'C/MSgt' : 'C/SSgt', ribbonSel: [['wright_brothers_award'], ['curry_achievement']], badgeIds: ['AirCrew1_DB3F0FCC3650F'] });
    const scene = await compose(b);
    const belt = layerOf(scene, 'honor-guard-belt')[0];
    for(const role of ['ribbon', 'badge', 'nametag']){
      const rows = scene.layers.filter(l => l.role === role);
      for(const l of rows) assert.ok(l.z > belt.z, `${cut.name}: ${role} over the belt`);
    }
    assert.ok(scene.layers.some(l => l.role === 'ribbon'), `${cut.name}: ribbons are drawn`);
    assert.equal(layerOf(scene, 'honor-guard-sling-over').length, 0, `${cut.name}: nothing drawn over the breast`);
  }
  // cadet NCO chevrons on the shirt: on the leaves of the honor guard collar, not the everyday ones
  for(const cut of CUTS.filter(c => c.uniform === 'blues_b')){
    const scene = await compose(guard(cut, 'guard', cut.chinstrap, { rank: 'C/MSgt' }));
    const spec = await store.load(cut.sheet);
    const chevrons = scene.layers.filter(l => l.role === 'grade' && /^rank-cadet-nco-/.test(l.id));
    assert.equal(chevrons.length, 2, `${cut.name}: one on each leaf`);
    for(const side of ['right', 'left']){
      const poly = spec.landmarks[`collar_honor_guard_${side}`].points;
      const centres = chevrons.map(l => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 }));
      assert.ok(centres.some(c => inside(c, poly)), `${cut.name}: a chevron is centred on the ${side} honor guard leaf`);
    }
  }
});

test('the flag bearer\'s sling lies over the ribbons, their devices, the badges and the nameplate with its name, under the collar, the lapels, the boards and the cord, on a coat and on every Class B sheet; nothing else is moved', async () => {
  for(const cut of CUTS){
    const scene = await compose(breastBuild(cut, 'flag'));
    const [low, over] = [layerOf(scene, 'honor-guard-sling'), layerOf(scene, 'honor-guard-sling-over')];
    assert.equal(low.length, 1, `${cut.name}: the sling at its own place`);
    assert.equal(over.length, 1, `${cut.name}: and once more over the breast`);
    const [s, o] = [low[0], over[0]];
    assert.equal(o.id, s.id, 'the same art');
    assert.deepEqual([o.x, o.y, o.w, o.h, o.rotate], [s.x, s.y, s.w, s.h, s.rotate], 'at the same place: nothing moves');
    assert.ok(o.z > s.z, 'above the first');
    assert.ok(o.noBounds, 'and does not change the drawing\'s frame');
    // after every breast item
    const items = scene.layers.filter(BREAST);
    for(const role of ['ribbon', 'device', 'badge']) assert.ok(items.some(l => l.role === role), `${cut.name}: a ${role} is worn`);
    assert.ok(items.some(l => l.key === 'text:name') && items.some(l => l.role === 'garment-layer'), `${cut.name}: the nameplate and the name`);
    assert.equal(items.filter(l => l.role === 'ribbon').length, 10, 'a rack of ten');
    for(const l of items) assert.ok(l.z < o.z, `${cut.name}: ${l.key} is drawn before the strap over the breast (${l.z} against ${o.z})`);
    // the box the strap is drawn over holds every item whole
    const clip = o.clip, box = { x: Math.min(...clip.map(p => p.x)), y: Math.min(...clip.map(p => p.y)) };
    box.w = Math.max(...clip.map(p => p.x)) - box.x; box.h = Math.max(...clip.map(p => p.y)) - box.y;
    for(const l of items.filter(l => l.role !== 'garment-layer')){
      const bb = core.layerBounds(l);
      assert.ok(bb.x >= box.x && bb.y >= box.y && bb.x + bb.w <= box.x + box.w && bb.y + bb.h <= box.y + box.h, `${cut.name}: ${l.key} lies inside the box`);
    }
    // before the collar and the lapels, the boards and their grade
    // (the coat's own `lapel-left` piece at 13.5 lies over the rack where the sling's art is cut away by the lapel: the strap has no pixel there to draw)
    const collar = scene.layers.filter(l => (l.role === 'garment-foreground' && (l.onlyGroups || []).includes('collar-honor-guard')) || /-lapel-(foreground|cap|us)$/.test(l.id || ''));
    assert.ok(collar.length, `${cut.name}: a collar or lapel is drawn over the breast`);
    for(const l of collar) assert.ok(l.z > o.z, `${cut.name}: ${l.key} over the strap`);
    // the boards and their grade (the coat's are over the strap; the shirt's epaulets are low, under the breast items, and lie clear of the box), the board seen from above, the cap
    for(const l of scene.layers.filter(l => l.role === 'epaulet-top' || l.role === 'hat' || (cut.uniform === 'blues_a' && (/^epaulet/.test(l.role) || l.role === 'grade')))) assert.ok(l.z > o.z, `${cut.name}: ${l.key} over the strap`);
    // what stays over the low strap and does not lie in the box: the boards, the grades, the patch, the cord's whole run, the gloves
    for(const l of scene.layers.filter(l => /^epaulet/.test(l.role) || l.role === 'patch' || (l.role === 'grade' && !/chest/.test(l.key)))) assert.ok(!meets(core.layerBounds(l), box), `${cut.name}: ${l.key} is clear of the box`);
    const cord = scene.layers.find(l => l.cordPath), room = box;
    // the coats' cord is drawn over the strap; the shirts' is low, under the badges, and its whole run lies outside the box
    if(cord.z > o.z) assert.ok(cut.uniform === 'blues_a', `${cut.name}: only the coats' cord is over the strap`);
    else assert.ok(cord.cordPath.points.every(p => !meets({ x: p[0] - cord.cordPath.width / 2, y: p[1] - cord.cordPath.width / 2, w: cord.cordPath.width, h: cord.cordPath.width }, room)), `${cut.name}: the cord's run is clear of the box`);
    const gloves = (await store.load(`${cut.sheet}-honor-guard-gloves`)).raw.landmarks;
    for(const name of ['glove_right', 'glove_left', 'gloves_under_sling']){
      const e = gloves[name] && gloves[name].extent;
      if(e) assert.ok(!meets({ x: e.x, y: e.y, w: e.w_in, h: e.h_in }, box), `${cut.name}: ${name} is clear of the box`);
    }
    // nothing else is moved: but for the strap, the gloves and the name's z, the flag bearer's drawing is the guard's
    const plain = await compose(breastBuild(cut, 'guard'));
    const rest = sc => JSON.stringify(sc.layers.filter(l => !/^honor-guard-(belt|sling|sling-over|gloves)$/.test(l.role) && l.role !== 'measure').map(l => (l.key === 'text:name' ? Object.assign({}, l, { z: 0 }) : l)));
    assert.ok(rest(scene) === rest(plain), `${cut.name}: every other piece is where the guard's is`);
  }
});

test('the sling over the breast is the flag bearer\'s alone, and the drawing is otherwise the one without it: a guard, every other uniform and a flag bearer with nothing on the breast', async () => {
  for(const cut of CUTS){
    // a flag bearer with no ribbon, badge or name still wears the nameplate: the strap is drawn over it alone
    const bare = await compose(guard(cut, 'flag', cut.chinstrap, { name: { first: '', last: '', show: false } }));
    const [bo] = layerOf(bare, 'honor-guard-sling-over'), plate = bare.layers.find(l => l.key === 'clear:nametag');
    assert.ok(bo && plate, `${cut.name}: the plate`);
    assert.ok(bo.clip[0].x < plate.x && bo.clip[0].y < plate.y && bo.clip[2].x > plate.x + plate.w && bo.clip[2].y > plate.y + plate.h && bo.clip[2].x - bo.clip[0].x < plate.w + 0.5, `${cut.name}: the box is the plate's, a hair larger`);
    // the order of a guard's breast is what it was: the same layers in the same z
    const g = await compose(breastBuild(cut, 'guard'));
    assert.equal(layerOf(g, 'honor-guard-sling-over').length, 0);
    assert.equal(g.layers.find(l => l.key === 'text:name').z, 20, `${cut.name}: a guard's name is drawn where it always was`);
    const f = await compose(breastBuild(cut, 'flag'));
    assert.ok(f.layers.find(l => l.key === 'text:name').z < layerOf(f, 'honor-guard-sling-over')[0].z, `${cut.name}: a flag bearer's name goes under the strap with its plate`);
    // out of Honor Guard, the sling is not in the drawing
    const plain = await compose(build(cut, { rank: 'C/Maj', ribbonSel: RACK }));
    assert.equal(plain.layers.filter(l => /^honor-guard/.test(l.role)).length, 0, `${cut.name}: no sling outside Honor Guard`);
  }
});

function inside(p, ring){
  let c = false;
  for(let i = 0, j = ring.length - 1; i < ring.length; j = i++){
    const a = ring[i], b = ring[j];
    if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

test('a build without ceremonial, or one for a senior member, draws none of it; every grade of cadet wears the same items', async () => {
  for(const cut of CUTS){
    const plain = await compose(build(cut, { cord: null }));
    assert.equal(plain.layers.filter(l => /honor-guard-(belt|flag-sling|ascot)/.test(l.id || '') || l.id === 'patch-honor-guard').length, 0, `${cut.name}: no honor guard items`);
    const senior = await compose(guard(cut, 'guard', 'up', { membership: 'senior', rank: 'Capt', cord: null }));
    assert.equal(senior.layers.filter(l => /honor-guard/.test(l.id || '')).length, 0, `${cut.name}: a senior member is not drawn it`);
    for(const rank of CADETS){
      const scene = await compose(guard(cut, 'guard', cut.chinstrap, { rank }));
      assert.ok(scene.layers.some(l => l.id === `${cut.sheet}-honor-guard-belt`) && scene.layers.some(l => l.id === 'patch-honor-guard'), `${cut.name} ${rank}`);
      assert.equal(scene.layers.find(l => l.role === 'hat').id, CAPS[cut.chinstrap]);
    }
  }
});

test('a member who asks for no headgear is shown without a cap, with the page\'s note that headgear is mandatory', async () => {
  for(const cut of CUTS){
    const scene = await compose(guard(cut, 'guard', cut.chinstrap, { opt: Object.assign({ headgear: 'none' }, cut.opt) }));
    assert.equal(scene.layers.filter(l => l.role === 'hat').length, 0, cut.name);
    assert.ok(scene.notes.some(n => /Headgear is mandatory/.test(n)), cut.name);
  }
});
