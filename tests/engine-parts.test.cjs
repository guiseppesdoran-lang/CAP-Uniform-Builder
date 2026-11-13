'use strict';
// The parts of a drawn uniform that can be taken as a picture of their own (js/engine/parts.js): which layers belong to which part, which parts a build has, the box of a
// part (the engine's own boxes of its items plus a margin, never set numbers), the scene a part is drawn from, and the size of its picture.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const PARTS = require('../js/engine/parts.js');
const RULES = require('../data/uniform-rules.js');
const { makeBuild, nodeStore } = require('../scripts/render-builds.cjs');

const ROOT = path.join(__dirname, '..');
const scene = (spec, store) => P.composeUniform(makeBuild(spec), store || nodeStore());
const ids = planned => planned.parts.map(p => p.id);
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

const CADET_A = { uniform: 'blues_a', membership: 'cadet', rank: 'C/Capt', cord: 'national', ribbonSel: [['cap_achievment_award'], ['encampment_ribbon'], ['red_service_ribbon']], badgeIds: ['AirCrew1_DB3F0FCC3650F'] };

test('a cadet Class A with ribbons, a badge and a cord has the ribbon rack, both sides of the chest, the collar and shoulders, the cap and the cord, in that order', async () => {
  const planned = PARTS.plan(await scene(CADET_A), null);
  assert.deepEqual(ids(planned), ['ribbon-rack', 'left-chest', 'right-chest', 'collar-and-shoulders', 'headgear', 'cord']);
  assert.deepEqual(planned.parts.map(p => p.label), ['Ribbon rack', 'Left chest', 'Right chest', 'Collar and shoulders', 'Headgear', 'Cord']);
});

test('a part the build does not have is not offered: no ribbons, no badges, no cord, no patch, no name', async () => {
  const bare = PARTS.plan(await scene({ uniform: 'blues_a', membership: 'cadet', rank: 'C/Capt', name: { first: '', last: '', show: false } }), null);
  // The cap and the shoulder boards are always worn; nothing else is on this one.
  assert.deepEqual(ids(bare), ['collar-and-shoulders', 'headgear']);
  const noName = ids(PARTS.plan(await scene({ uniform: 'ocp', membership: 'senior', rank: 'Capt', name: { first: '', last: '', show: false } }), null));
  assert.ok(!noName.includes('left-chest'), 'no badge, so nothing on the left chest');
  assert.ok(!noName.some(i => /sleeve|pocket|cord|ribbon/.test(i)), noName.join());
  // A place the engine sets aside (the name plate, a tape) with nothing drawn on it is no part.
  const frames = (await scene({ uniform: 'ocp', membership: 'senior', rank: 'Capt', name: { first: '', last: '', show: false } })).layers.filter(l => /^clear:(name_tape|cap_tape)$/.test(l.key));
  assert.ok(frames.length > 0, 'the tapes are set aside');
  assert.ok(!noName.includes('right-chest'), noName.join());
});

test('the ribbons lie on the left of the chest and the name on the right: the wearer\'s left is the right of the picture', async () => {
  const s = await scene(CADET_A);
  const planned = PARTS.plan(s, null);
  const garment = s.layers.find(l => l.role === 'garment');
  const mid = garment.x + garment.w / 2;
  const left = planned.parts.find(p => p.id === 'left-chest'), right = planned.parts.find(p => p.id === 'right-chest');
  assert.ok(left.box.x >= mid - 1e-6, 'left chest is right of the garment\'s centre line');
  assert.ok(right.box.x + right.box.w <= mid + 1e-6, 'right chest is left of it');
  assert.ok(left.layers.some(l => l.role === 'ribbon') && left.layers.some(l => l.role === 'badge'));
  assert.ok(right.layers.some(l => l.role === 'text'), 'the name');
  assert.ok(!right.layers.some(l => l.role === 'ribbon' || l.role === 'badge'));
});

test('the left chest holds the rack and the badges round it, and is offered only when it holds more than the rack, which has its own picture', async () => {
  const planned = PARTS.plan(await scene(CADET_A), null);
  const rack = planned.parts.find(p => p.id === 'ribbon-rack'), left = planned.parts.find(p => p.id === 'left-chest');
  assert.ok(rack.layers.every(l => left.layers.includes(l)), 'every ribbon of the rack is on the left chest');
  assert.ok(left.box.h > rack.box.h, 'the badge makes it taller');
  const ribbonsOnly = PARTS.plan(await scene({ uniform: 'blues_a', membership: 'cadet', rank: 'C/Capt', ribbonSel: [['cap_achievment_award']] }), null);
  assert.ok(ids(ribbonsOnly).includes('ribbon-rack') && !ids(ribbonsOnly).includes('left-chest'), ids(ribbonsOnly).join());
  const badgeOnly = PARTS.plan(await scene({ uniform: 'blues_a', membership: 'cadet', rank: 'C/Capt', badgeIds: ['AirCrew1_DB3F0FCC3650F'] }), null);
  assert.ok(!ids(badgeOnly).includes('ribbon-rack') && ids(badgeOnly).includes('left-chest'), ids(badgeOnly).join());
});

test('a part\'s box is the union of the boxes of its items, and its view is that box and a margin of 1/4 inch on every side', async () => {
  const s = await scene(CADET_A);
  const planned = PARTS.plan(s, null);
  assert.equal(PARTS.MARGIN, 0.25);
  const rack = planned.parts.find(p => p.id === 'ribbon-rack');
  const ribbons = s.layers.filter(l => l.role === 'ribbon');
  const union = core.unionBounds(ribbons.map(core.layerBounds));
  for(const k of ['x', 'y', 'w', 'h']) near(rack.box[k], union[k], 'rack box ' + k);
  near(rack.view.x, union.x - 0.25, 'view x'); near(rack.view.y, union.y - 0.25, 'view y');
  near(rack.view.w, union.w + 0.5, 'view w'); near(rack.view.h, union.h + 0.5, 'view h');
  // The cord has no box in the scene (its sheet is the whole coat); the path the engine fitted for it, and its width, give it one.
  const cord = planned.parts.find(p => p.id === 'cord');
  const layer = s.layers.find(l => l.cordPath);
  const pts = core.polygonBounds(layer.cordPath.points.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p));
  const half = layer.cordPath.width / 2;
  near(cord.box.x, pts.x - half, 'cord box x'); near(cord.box.h, pts.h + 2 * half, 'cord box h');
});

test('the box of what a layer drew, when the page measures it, stands in for the box of its sheet; a layer the engine cut to a polygon is held to the polygon', async () => {
  const s = await scene(CADET_A);
  const lapel = s.layers.find(l => /lapel-cap$/.test(l.id) && l.role === 'garment-layer');
  assert.ok(lapel, 'a lapel insignia sheet');
  const without = PARTS.plan(s, null).parts.find(p => p.id === 'collar-and-shoulders');
  const measured = { x: 9.13, y: 4.61, w: 1.4, h: 0.55 };
  const withIt = PARTS.plan(s, l => l === lapel ? measured : null).parts.find(p => p.id === 'collar-and-shoulders');
  assert.ok(withIt.box.y + withIt.box.h >= measured.y + measured.h - 1e-6, 'the measured insignia is inside the box');
  assert.ok(withIt.box.y + withIt.box.h > without.box.y + without.box.h - 1e-6);
  // A whole sheet cut to a window shows only the window.
  const sheet = { type: 'asset', role: 'epaulet-top', key: 'epaulet-top:right', id: 'garment-x', x: -2, y: -4, w: 28, h: 33, rotate: 0, origin: { x: 0, y: 0 }, z: 32, clip: [{ x: 3, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 3, y: 2 }] };
  const garment = { type: 'asset', role: 'garment', id: 'garment-x', x: 0, y: 0, w: 28, h: 33, rotate: 0, origin: { x: 0, y: 0 }, z: 1 };
  const clipped = PARTS.plan({ layers: [garment, sheet] }, () => ({ x: -2, y: -4, w: 28, h: 33 }));
  assert.deepEqual(clipped.parts[0].box, { x: 3, y: 0, w: 3, h: 2 });
});

test('the parts are held to the frame the whole picture was drawn in: if the engine shortens the scene\'s bounds, no part\'s picture shows more than the whole does', async () => {
  const s = await scene(CADET_A);
  const b = s.bounds, pad = 0.4;
  const full = PARTS.plan(s, null, { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad });
  const loose = PARTS.plan(s, null);
  assert.deepEqual(full.parts.map(p => [p.id, p.box, p.view]), loose.parts.map(p => [p.id, p.box, p.view]), 'a frame that holds every part changes nothing');
  // A frame cut at the bottom of the coat's upper part: the cord, which runs lower, ends at the cut; the parts above are as they were.
  const cord = loose.parts.find(p => p.id === 'cord');
  const cut = cord.box.y + cord.box.h / 2;
  const frame = { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: cut - (b.y - pad) };
  const short = PARTS.plan(s, null, frame);
  const shortCord = short.parts.find(p => p.id === 'cord');
  near(shortCord.box.y + shortCord.box.h, cut, 'the cord ends at the cut');
  assert.ok(shortCord.box.h < cord.box.h);
  for(const p of short.parts){
    assert.ok(p.view.y >= frame.y - 1e-9 && p.view.y + p.view.h <= frame.y + frame.h + 1e-9 && p.view.x >= frame.x - 1e-9 && p.view.x + p.view.w <= frame.x + frame.w + 1e-9, `${p.id} is inside the frame`);
  }
  assert.deepEqual(short.parts.find(p => p.id === 'headgear').box, loose.parts.find(p => p.id === 'headgear').box);
  // A part wholly below the cut is not offered.
  const high = PARTS.plan(s, null, { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: 2 });
  assert.ok(!ids(high).includes('ribbon-rack') && !ids(high).includes('right-chest'), ids(high).join());
  assert.ok(ids(high).includes('headgear'));
  // The page hands the frame it drew the whole picture in: the viewBox of the drawing.
  const src = fs.readFileSync(path.join(ROOT, 'js/uniform-view.js'), 'utf8');
  assert.match(src, /const vb = svg\.getAttribute\('viewBox'\)[\s\S]*E\.parts\.plan\(scene, measureDrawing\(svg, scene\), \{ x: vb\[0\], y: vb\[1\], w: vb\[2\], h: vb\[3\] \}\)/);
});

test('a patch is a part of the sleeve or pocket that carries it, named by the place; the edge-on view does not widen the box', async () => {
  const OCP = { uniform: 'ocp', membership: 'cadet', rank: 'C/SSgt', patchRefs: [{ id: 'pjoc_ocp_patch', kind: 'general' }, { id: 'unit_mar_dc_001', kind: 'unit' }] };
  const s = await scene(OCP);
  const planned = PARTS.plan(s, null);
  const places = planned.parts.filter(p => p.kind === 'patch');
  assert.deepEqual(places.map(p => p.id), ['left-sleeve', 'right-sleeve']);
  assert.deepEqual(places.map(p => p.label), ['Left sleeve', 'Right sleeve']);
  for(const part of places){
    const edge = part.layers.filter(l => /:edge$/.test(l.key)), flat = part.layers.filter(l => !/:edge$/.test(l.key));
    assert.ok(edge.length && flat.length, `${part.id} is drawn flat and edge-on`);
    const union = core.unionBounds(flat.map(core.layerBounds));
    for(const k of ['x', 'y', 'w', 'h']) near(part.box[k], union[k], `${part.id} box ${k}`);
  }
  // The flight suit's sleeve and the field uniforms' pockets are named for what they are.
  assert.deepEqual(ids(PARTS.plan(await scene({ uniform: 'flight_suit', membership: 'senior', rank: 'Capt', patchRefs: [{ id: 'honor_guard_patch', kind: 'general' }] }), null)).filter(i => /sleeve|pocket/.test(i)), ['right-sleeve']);
  const pocket = async (id, slot) => ids(PARTS.plan(await scene({ uniform: 'abu', membership: 'senior', rank: 'Capt', patchRefs: [{ id, kind: 'general', slot }] }), null)).filter(i => /sleeve|pocket/.test(i));
  assert.deepEqual(await pocket('honor_guard_patch', 'CHEST_LEFT'), ['left-pocket']);
  assert.deepEqual(await pocket('archer_patch', 'CHEST_RIGHT'), ['right-pocket']);
});

test('the headgear is every cap view the engine draws: both views of the OCP cap in one picture', async () => {
  const s = await scene({ uniform: 'ocp', membership: 'cadet', rank: 'C/SSgt' });
  const head = PARTS.plan(s, null).parts.find(p => p.id === 'headgear');
  const bounds = s.layers.filter(l => l.role === 'hat-view-bounds');
  assert.equal(bounds.length, 2, 'a front view and a back view');
  const union = core.unionBounds(bounds.map(core.layerBounds));
  for(const k of ['x', 'y', 'w', 'h']) near(head.box[k], union[k], 'headgear box ' + k);
  assert.ok(head.layers.some(l => l.role === 'text' && /back_name_tape/.test(l.key)), 'the name tape on the back of the cap is the cap\'s');
});

test('a grade worn on the chest alone is Grade insignia; a grade on the front of a field cap is the cap\'s', async () => {
  const ocp = PARTS.plan(await scene({ uniform: 'ocp', membership: 'senior', rank: 'Capt' }), null);
  assert.ok(ids(ocp).includes('rank-insignia') && !ids(ocp).includes('collar-and-shoulders'), ids(ocp).join());
  const head = ocp.parts.find(p => p.id === 'headgear');
  assert.ok(head.layers.some(l => l.role === 'grade' && /patrol_cap/.test(l.key)), 'the cap\'s own grade');
  const shoulders = ocp.parts.find(p => p.id === 'rank-insignia');
  assert.ok(shoulders.layers.every(l => l.key === 'grade:chest'));
});

test('miniature medals are their own part, and a scene of two garments has each garment\'s parts, named for it', async () => {
  const mess = PARTS.plan(await scene({ uniform: 'mess_dress', membership: 'senior', rank: 'Capt', ribbonSel: [['cap_achievment_award'], ['encampment_ribbon']], medalSel: true }), null);
  assert.ok(ids(mess).includes('miniature-medals') && !ids(mess).includes('ribbon-rack'), ids(mess).join());
  assert.equal(mess.parts.find(p => p.id === 'miniature-medals').label, 'Miniature medals');
  const two = PARTS.plan(await scene({ uniform: 'aviator_blazer', membership: 'senior', rank: 'Capt', ribbonSel: [['cap_achievment_award']], badgeIds: ['CAPPilot1_FA9D33EA587D8'] }), null);
  assert.ok(ids(two).includes('left-chest-blazer') && ids(two).includes('left-chest-shirt'), ids(two).join());
  assert.ok(two.parts.some(p => p.label === 'Left chest (shirt)'));
  assert.equal(new Set(ids(two)).size, ids(two).length, 'every part has its own file name');
  const jacket = ids(PARTS.plan(await scene({ uniform: 'flight_suit', membership: 'senior', rank: 'Capt', opt: { jacket: true } }), null));
  assert.ok(jacket.includes('left-chest-flight-suit') && jacket.includes('left-chest-jacket'), jacket.join());
});

test('a part is drawn from the garment and its own items: the items of the other parts are left out, the garment\'s own decoration stays', async () => {
  const s = await scene(CADET_A);
  const planned = PARTS.plan(s, null);
  const rack = planned.parts.find(p => p.id === 'ribbon-rack');
  const part = PARTS.sceneFor(s, planned, rack);
  assert.ok(part.layers.some(l => l.role === 'garment'), 'the garment');
  assert.ok(part.layers.some(l => l.role === 'garment-foreground' || l.role === 'garment-layer'), 'the garment\'s own overlays');
  assert.equal(part.layers.filter(l => l.role === 'ribbon').length, s.layers.filter(l => l.role === 'ribbon').length);
  for(const role of ['badge', 'text', 'epaulet', 'epaulet-top', 'grade', 'hat', 'hat-device']) assert.ok(!part.layers.some(l => l.role === role), `no ${role}`);
  assert.ok(!part.layers.some(l => l.cordPath), 'no cord');
  assert.ok(!part.layers.some(l => l.type === 'measure'));
  assert.deepEqual(part.bounds, rack.view, 'framed on the part and its margin');
  assert.notEqual(part.layers, s.layers, 'the drawing\'s own scene is not changed');
  assert.ok(s.layers.some(l => l.role === 'badge'), 'the whole scene still holds its badge');
  // Every other part, likewise, holds its own items and not the rack's.
  const cord = PARTS.sceneFor(s, planned, planned.parts.find(p => p.id === 'cord'));
  assert.ok(cord.layers.some(l => l.cordPath) && !cord.layers.some(l => l.role === 'ribbon'));
});

test('a part\'s picture is 150 pixels to the inch where that fits, its longer side between 1200 and 3000 pixels', () => {
  const r = PARTS.resolution({ x: 0, y: 0, w: 10, h: 4 });
  assert.deepEqual([r.widthPx, r.heightPx], [1500, 600]);
  assert.equal(r.ppi, 150);
  const small = PARTS.resolution({ x: 0, y: 0, w: 3, h: 1.5 });   // small parts are sharper still
  assert.equal(small.widthPx, 1200);
  assert.ok(small.ppi >= 150 && small.ppi === 400);
  const tall = PARTS.resolution({ x: 0, y: 0, w: 2, h: 15 });
  assert.equal(tall.heightPx, 2250);
  const big = PARTS.resolution({ x: 0, y: 0, w: 25, h: 6 });   // past 20 inches the 3000 pixel limit wins
  assert.equal(big.widthPx, 3000);
  assert.ok(big.ppi < 150);
  for(const [w, h] of [[0.4, 0.3], [1, 1], [5.3, 4], [19.9, 2], [26, 8], [0.5, 40]]){
    const x = PARTS.resolution({ x: 0, y: 0, w, h });
    const longer = Math.max(x.widthPx, x.heightPx);
    assert.ok(longer >= 1200 - 1 && longer <= 3000 + 1, `${w} x ${h}: ${longer}`);
    assert.ok(x.ppi >= 150 - 1e-9 || longer >= 3000 - 1, `${w} x ${h}: ${x.ppi}`);
  }
});

test('across the standard matrix every part has a box inside the drawing, a name made of lower case words and hyphens, and no part repeats', async () => {
  const store = nodeStore();
  const members = [['cadet', 'C/SSgt'], ['cadet', 'C/Capt'], ['senior', 'Capt'], ['senior', 'Maj Gen']];
  let builds = 0, parts = 0;
  for(const uniform of Object.keys(RULES.RULES)) for(const gender of ['male', 'female']) for(const [membership, rank] of members){
    if(!RULES.isUniformAllowedFor(uniform, membership, { rank })) continue;
    const spec = { uniform, gender, membership, rank, ribbonSel: [['cap_achievment_award'], ['encampment_ribbon']], badgeIds: ['CAPPilot1_FA9D33EA587D8'], opt: { jacket: true } };
    if(RULES.allowsShoulderCord(uniform, membership)) spec.cord = 'wing';
    if(RULES.allowsMiniMedals(uniform)) spec.medalSel = true;
    const s = await scene(spec, store);
    const planned = PARTS.plan(s, null);
    builds++;
    const seen = new Set();
    for(const p of planned.parts){
      parts++;
      const where = `${uniform} ${gender} ${rank} ${p.id}`;
      assert.match(p.file, /^[a-z]+(-[a-z]+)*$/, where);
      assert.ok(!seen.has(p.id), `${where} appears twice`); seen.add(p.id);
      assert.ok(Number.isFinite(p.box.x + p.box.y + p.box.w + p.box.h) && p.box.w > 0 && p.box.h > 0, where);
      const b = s.bounds;
      assert.ok(p.box.x >= b.x - 1 && p.box.y >= b.y - 1 && p.box.x + p.box.w <= b.x + b.w + 1 && p.box.y + p.box.h <= b.y + b.h + 1, `${where} lies inside the drawing`);
      assert.ok(p.layers.length > 0 && p.layers.some(l => l.type !== 'clear'), where);
      const res = PARTS.resolution(p.view);
      assert.ok(res.widthPx <= 3000 && res.heightPx <= 3000, where);
    }
    // Nothing is in two groups: a layer belongs to one kind of item.
    assert.equal(planned.groupOf.size, new Set(planned.groupOf.keys()).size);
  }
  assert.ok(builds > 60 && parts > 250, `${builds} builds, ${parts} parts`);
});

test('every layer of every build is a part\'s item or one of the garment\'s own pieces: a role the engine starts to draw is noticed here', async () => {
  const GARMENT_OWN = new Set(['garment', 'garment-layer', 'garment-foreground', 'sleeve-flat', 'tie', 'seal', 'scarf', 'surface', 'clear', 'measure', 'epaulet-shade-none',
    'honor-guard-belt', 'honor-guard-sling', 'honor-guard-sling-over', 'honor-guard-ascot', 'honor-guard-gloves', 'patch']);
  const store = nodeStore();
  const unknown = new Set();
  for(const uniform of Object.keys(RULES.RULES)) for(const membership of ['cadet', 'senior']){
    const rank = membership === 'cadet' ? 'C/Capt' : 'Capt';
    if(!RULES.isUniformAllowedFor(uniform, membership, { rank })) continue;
    for(const opt of [{}, { jacket: true }, { sleeve: 'long' }]){
      const s = await scene({ uniform, membership, rank, opt, ribbonSel: [['cap_achievment_award']], badgeIds: ['CAPPilot1_FA9D33EA587D8'], cord: RULES.allowsShoulderCord(uniform, membership) ? 'wing' : null }, store);
      const planned = PARTS.plan(s, null);
      for(const l of s.layers){
        if(planned.groupOf.has(l)) continue;
        if(!GARMENT_OWN.has(l.role)) unknown.add(`${l.role} (${l.key})`);
        if(l.role === 'patch') assert.ok(/^ascot:/.test(l.key), `${l.key}: a patch that is no part's`);
      }
    }
  }
  assert.deepEqual([...unknown], [], 'a role with no part: add it to js/engine/parts.js or to this list');
});

test('what a member reads says the rule, never a regulation: part names are plain words', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/engine/parts.js'), 'utf8');
  const words = [...src.matchAll(/label: '([^']+)'/g)].map(m => m[1]);
  assert.ok(words.length >= 9, words.join());
  for(const w of words) assert.doesNotMatch(w, /CAPR|ICL|\d|paragraph|regulation/i, w);
});
