'use strict';
// The 3D aligners of the placement templates. The owner, 2026-11-12: "the 3d files shouldnt be a big block with holed in it (3d printers
// arent that precise. they should be like kind of the already published rack alligners are ... label uniform.ebhq.dev on them".
//
// For several builds (a cadet's Class A and Class B, a senior's, men's and women's, a full rack with three badges) this reads every STL
// the page would offer, back from its bytes, and checks, against the scene's own measurements (not copies of numbers):
//   - the shell is closed (every edge in two triangles, once each way), the normals point out, the volume is what the plate and the letters
//     come to; millimetres; 2 mm thick, the letters 0.6 mm over it; the underside one flat plane at z = 0;
//   - no hole through the plate (the outline is a tree of bars: no pin hole, no window, no cylinder) and no feature under 1.2 mm;
//   - it registers on a garment edge: its feet are straight on the pocket's top edge, the button line, the collar, lapel or shoulder
//     board edge the scene draws, and the whole plate lies on one side of it;
//   - each item stands clear of the plate by 0.5 mm on its posts or rests on a shelf, nothing between; no item overlaps the plate;
//   - the address (uniform.ebhq.dev) and what the plate is for are on it, capitals 6 mm tall with 1.2 mm strokes raised 0.6 mm;
//   - a notch at the middle of the pocket (or of the items) on its far edge, and its feet run out to the pocket's sides;
//   - it fits a 180 x 180 mm bed, or the stack is cut in plates used one after the other;
//   - the spacer gauges: a bar as wide as each gap the plates use, marked with its size.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const RB = require('../scripts/render-builds.cjs');
const PT = require('../js/placement-templates.js');
const STL = require('../js/placement-stl.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const MM = 25.4;
const DOMAIN = 'uniform.ebhq.dev';

const FEW = [['meritorious_service_award'], ['commander_commendation_award'], ['cap_leadership_ribbon']];
const BUILDS = {
  seniorMenA: { uniform: 'blues_a', gender: 'male', membership: 'senior', rank: 'Capt', opt: { rackColumns: 3 },
    ribbonSel: [['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_7'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon'], ['search_find_ribbon']],
    badgeIds: ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge'] },
  seniorWomenA: { uniform: 'blues_a', gender: 'female', membership: 'senior', rank: 'Maj', opt: { rackColumns: 3 }, ribbonSel: FEW, badgeIds: ['CAPPilot1_FA9D33EA587D8'] },
  seniorMenB: { uniform: 'blues_b', gender: 'male', membership: 'senior', rank: 'Col', opt: { rackColumns: 3 }, ribbonSel: FEW, badgeIds: ['CAPPilot1_FA9D33EA587D8'] },
  cadetWomenB: { uniform: 'blues_b', gender: 'female', membership: 'cadet', rank: 'C/SSgt', opt: { rackColumns: 3 },
    ribbonSel: [['wright_brothers_award'], ['curry_achievement'], ['encampment_ribbon']], badgeIds: ['AirCrew1_DB3F0FCC3650F'] },
  cadetMenB: { uniform: 'blues_b', gender: 'male', membership: 'cadet', rank: 'C/Capt', opt: { rackColumns: 3 },
    ribbonSel: [['wright_brothers_award'], ['curry_achievement'], ['encampment_ribbon']], badgeIds: ['AirCrew1_DB3F0FCC3650F'] },
  cadetMenA: { uniform: 'blues_a', gender: 'male', membership: 'cadet', rank: 'C/Col', opt: { rackColumns: 3 },
    ribbonSel: [['wright_brothers_award'], ['curry_achievement']], badgeIds: ['AirCrew1_DB3F0FCC3650F'] },
  // A 22-ribbon rack with two badges above it and one on the pocket below.
  fullRack: { uniform: 'blues_a', gender: 'male', membership: 'senior', rank: 'Capt', opt: { rackColumns: 4 },
    ribbonSel: ['meritorious_service_award', 'commander_commendation_award', ['cap_achievment_award', 'capub_total_7'], 'lifesaving_award', 'unit_citation_award', 'cap_gill_robb_wilson_ribbon', 'cap_paul_e_garber_ribbon', 'cap_grover_loening_aerospace_ribbon', 'cap_leadership_ribbon', 'cap_membership_ribbon', 'cap_a_scott_crossfield_ribbon', 'cap_bridgadier_general_charles_yaeger_ribbon', 'cap_command_service_ribbon', 'crisis_ribbon', 'red_service_ribbon', 'search_find_ribbon', 'air_search_and_rescue_ribbon', 'cap_counterdrug_ribbon', 'disaster_relief_ribbon', 'homeland_security_ribbon', 'community_service_ribbon', 'cap_senior_recruiter_ribbon'].map(r => Array.isArray(r) ? r : [r]),
    badgeIds: ['observer_badge', 'master_ground_team_badge', 'communications_senior_badge'] }
};
const cache = new Map();
async function planOf(name){
  if(!cache.has(name)){
    const spec = BUILDS[name];
    const scene = await P.composeUniform(RB.makeBuild(spec), store);
    cache.set(name, await PT.plan(scene, id => store.load(id), { uniform: spec.uniform, rank: spec.rank, name: 'Pat Doe', uniformLabel: 'Test garment' }));
  }
  return cache.get(name);
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// ---- small geometry on the models ---------------------------------------------------------------------

const inRegion = (p, r) => STL.pointInRing(p, r.outer) && !r.holes.some(h => STL.pointInRing(p, h));
const onPlate = (p, regions) => regions.some(r => inRegion(p, r));
const area = r => STL.signedArea(r.outer) + r.holes.reduce((a, h) => a + STL.signedArea(h), 0);   // holes are clockwise: their area is negative
const loops = regions => regions.flatMap(r => [r.outer, ...r.holes]);
const distSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const distToLoops = (p, ls) => Math.min(...ls.flatMap(l => l.map((a, i) => distSeg(p, a, l[(i + 1) % l.length]))));
// Smallest distance from a corner of the outline to an edge that is not one of its own two: the narrowest wall or gap of the plate.
function narrowest(ls){
  let m = Infinity;
  for(const l of ls) for(let i = 0; i < l.length; i++) for(const lp of ls) for(let j = 0; j < lp.length; j++){
    if(lp === l && (j === i || (j + 1) % l.length === i)) continue;
    const a = lp[j], b = lp[(j + 1) % lp.length];
    if(a === l[i] || b === l[i]) continue;
    m = Math.min(m, distSeg(l[i], a, b));
  }
  return m;
}
const triArea = t => Math.abs((t.v[1][0] - t.v[0][0]) * (t.v[2][1] - t.v[0][1]) - (t.v[2][0] - t.v[0][0]) * (t.v[1][1] - t.v[0][1])) / 2;

// What the scene says about an item, in the plate's file frame (millimetres, the plate's lower-left corner at 0, 0).
function itemShape(side, it, piece){
  const R = side.region, mm = p => [(p.x - R.x) * MM - piece.origin[0], (R.y + R.h - p.y) * MM - piece.origin[1]];
  const pts = it.frame && it.frame.deg % 90 !== 0 ? it.frame.corners : [{ x: it.box.x, y: it.box.y }, { x: it.box.x + it.box.w, y: it.box.y }, { x: it.box.x + it.box.w, y: it.box.y + it.box.h }, { x: it.box.x, y: it.box.y + it.box.h }];
  return pts.map(mm);
}
// The scene's garment edge a piece registers on, as the lines it may lie along (file frame): each ref of the piece's kind, a button line
// moved to the buttons' own edge.
function edgeLines(side, piece){
  const R = side.region, mm = p => [(p.x - R.x) * MM - piece.origin[0], (R.y + R.h - p.y) * MM - piece.origin[1]];
  const out = [];
  for(const r of side.refs.filter(x => x.kind === piece.edge)) for(const s of r.segs){
    const a = mm(s[0]), b = mm(s[1]), off = (r.lipOffset || 0) * MM, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    for(const k of off ? [-off, off] : [0]) out.push({ a: [a[0] + n[0] * k, a[1] + n[1] * k], b: [b[0] + n[0] * k, b[1] + n[1] * k], n });
  }
  return out;
}

// One aligner, read back from its bytes.
function checkPiece(side, i, label){
  const piece = PT.aligners(side)[i];
  const { bytes, model } = PT.alignerStl(side, i);
  assert.equal(bytes.length, 84 + 50 * model.triangles.length, `${label}: binary STL size`);
  const parsed = STL.parseBinaryStl(bytes);
  const stats = STL.meshStats(parsed.triangles);
  assert.ok(stats.watertight, `${label}: closed (${stats.open} open, ${stats.misoriented} misoriented of ${stats.edges} edges)`);
  assert.ok(stats.volume > 0, `${label}: normals point out`);
  assert.match(parsed.header, /uniform\.ebhq\.dev aligner/, `${label}: the header names the address`);

  // The plate and the letters, in the file.
  const T = piece.thickness;
  near(T, 2, 1e-9, `${label}: 2 mm thick`);
  const zs = [...new Set(parsed.triangles.flatMap(t => t.v.map(v => +v[2].toFixed(4))))].sort((a, b) => a - b);
  assert.deepEqual(zs, [0, 2, 2.6], `${label}: levels are the underside, the plate's top and the letters' top`);
  const plateArea = piece.regions.reduce((a, r) => a + area(r), 0), raisedArea = piece.raised.reduce((a, r) => a + area(r), 0);
  near(stats.volume, T * plateArea + piece.letters.raise * raisedArea, 0.002 * stats.volume, `${label}: the volume is the plate and its letters`);
  const under = parsed.triangles.filter(t => t.v.every(v => Math.abs(v[2]) < 1e-6));
  near(under.reduce((a, t) => a + triArea(t), 0), plateArea, 1e-3 * plateArea, `${label}: the underside is one flat plane the size of the plate`);
  assert.ok(under.every(t => t.normal[2] < -0.99), `${label}: the underside faces the garment`);
  near(parsed.triangles.filter(t => t.v.every(v => Math.abs(v[2] - 2.6) < 1e-6)).reduce((a, t) => a + triArea(t), 0), raisedArea, 1e-3 * raisedArea, `${label}: the letters' tops are the letters`);

  // No hole through the plate: a tree of bars. No feature under 1.2 mm.
  assert.ok(piece.regions.every(r => r.holes.length === 0), `${label}: the plate has no hole in it`);
  const narrow = narrowest(loops(piece.regions));
  assert.ok(narrow >= 1.2 - 1e-6, `${label}: the narrowest wall or gap is ${narrow.toFixed(3)} mm`);
  // It fits the bed.
  assert.ok(piece.size.w <= 180 && piece.size.h <= 180, `${label}: ${piece.size.w.toFixed(1)} x ${piece.size.h.toFixed(1)} mm fits a 180 mm bed`);

  // The letters: the address and what the plate is for, 6 mm capitals with 1.2 mm strokes, exactly the stroke font's loops.
  assert.deepEqual(piece.texts.map(t => t.text).sort(), [DOMAIN, piece.label.toLowerCase()].sort(), `${label}: the address and the label`);
  assert.ok(piece.letters.height >= 5 && piece.letters.stroke >= 1 && piece.letters.raise === 0.6, `${label}: letters at least 5 mm tall, strokes at least 1 mm, raised 0.6 mm`);
  const want = [DOMAIN, piece.label.toLowerCase()].reduce((a, s) => a + STL.textRegions(s, piece.letters.cell).reduce((b, r) => b + area(r), 0), 0);
  near(raisedArea, want, 1e-6 * want + 1e-6, `${label}: the raised area is exactly the two lines of letters`);
  for(const t of piece.texts) near(t.width, STL.textSize(t.text, piece.letters.cell).w, 1e-9, `${label}: ${t.text} is as wide as its letters`);
  for(const r of piece.raised) for(const v of r.outer) assert.ok(onPlate(v, piece.regions) && distToLoops(v, loops(piece.regions)) >= 0.9, `${label}: every letter stands on the plate, clear of its edge`);

  // It registers on a garment edge: two or more of its corners on the edge's line, the whole plate on one side of it.
  if(!/^(level|item-top)$/.test(piece.edge)){
    const lines = edgeLines(side, piece);
    assert.ok(lines.length, `${label}: the scene draws a ${piece.edge} edge`);
    const verts = loops(piece.regions).flat();
    const ok = lines.some(L => {
      const d = verts.map(v => (v[0] - L.a[0]) * L.n[0] + (v[1] - L.a[1]) * L.n[1]);
      return verts.filter((v, k) => Math.abs(d[k]) <= 0.02).length >= 2 && (d.every(x => x >= -0.02) || d.every(x => x <= 0.02));
    });
    assert.ok(ok, `${label}: two or more corners on the ${piece.edge} edge's line and the plate wholly on one side`);
  }

  // The items it holds: none overlaps the plate; each stands 0.5 mm clear of a post or rests on a shelf, and nothing is between.
  const ls = loops(piece.regions);
  const mine = side.items.filter(it => piece.items.includes(it.name));
  assert.equal(mine.length, piece.items.length, `${label}: the plate names items of the side`);
  for(const it of mine){
    const sh = itemShape(side, it, piece);
    for(let u = 0.05; u < 1; u += 0.1) for(let v = 0.05; v < 1; v += 0.1){
      const a = sh[0], b = sh[1], d = sh[3];
      const p = [a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v];
      assert.ok(!onPlate(p, piece.regions), `${label}: ${it.name} does not overlap the plate`);
    }
    // The middle of each side of the item: butting (a shelf), 0.5 mm clear (a post or a bar), or free (the open side); nothing tighter than 0.5 mm.
    const gaps = sh.map((a, k) => { const b = sh[(k + 1) % sh.length]; return distToLoops([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ls); });
    for(const g of gaps) assert.ok(g <= 0.02 || g >= 0.45, `${label}: ${it.name}: a side is ${g.toFixed(3)} mm from the plate, neither butting nor 0.5 mm clear`);
    assert.ok(gaps.filter(g => g <= 0.56).length >= 1, `${label}: ${it.name} is held by the plate`);
  }
  // At least one item of the plate stands 0.5 mm from a post (the clearance the cradle gives on its sides).
  assert.ok(mine.some(it => itemShape(side, it, piece).some((a, k, sh) => { const b = sh[(k + 1) % sh.length]; const g = distToLoops([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ls); return g >= 0.45 && g <= 0.55; })), `${label}: an item stands 0.5 mm clear of a post or a bar`);

  // The notches: a centre notch on the far edge, its tip a corner of the outline; on a pocket, at the pocket's middle.
  assert.ok(piece.marks.length >= 1, `${label}: a centre notch`);
  for(const m of piece.marks) assert.ok(ls.flat().some(v => Math.hypot(v[0] - m.at[0], v[1] - m.at[1]) < 0.01), `${label}: the notch's tip is a corner of the outline`);
  if(piece.edge === 'pocket-top'){
    const xs = side.refs.filter(r => r.kind === 'pocket-side').flatMap(r => r.segs.map(s => (s[0].x - side.region.x) * MM - piece.origin[0]));
    if(xs.length >= 2) near(piece.marks[0].at[0], (Math.min(...xs) + Math.max(...xs)) / 2, 0.05, `${label}: the notch is at the middle of the pocket`);
  }
  return { piece, parsed, stats };
}

test('every aligner of the builds: a closed thin flat plate, no hole, letters, registered on a garment edge, items clear by 0.5 mm', async () => {
  let n = 0;
  const kinds = new Set();
  for(const name of Object.keys(BUILDS)){
    const plan = await planOf(name);
    for(const side of plan.sides.filter(s => s.attach === 'pin')){
      const list = PT.aligners(side);
      assert.ok(list.length >= 1, `${name} ${side.key}: at least one aligner`);
      list.forEach((p, i) => { checkPiece(side, i, `${name} ${side.key} #${i + 1} (${p.label})`); n++; kinds.add(p.edge); });
    }
  }
  assert.ok(n >= 25, `aligners checked: ${n}`);
  // The edges they register on: the pocket, the button line, the collar and the shoulder board among them.
  for(const k of ['pocket-top', 'button-line', 'collar-edge', 'epaulet-edge']) assert.ok(kinds.has(k), `an aligner registers on a ${k}`);
});

test('a men\'s Class A left chest: a plate over the pocket (feet on its top edge) and one on it, the labels say so', async () => {
  const plan = await planOf('seniorMenA');
  const side = plan.sides.find(s => s.key === 'left-chest');
  const list = PT.aligners(side);
  assert.deepEqual(list.map(p => p.label), ['LEFT CHEST', 'LEFT POCKET']);
  const [above, below] = list;
  // The pocket's top edge is where each plate's straight feet stand: the one above has its lowest edge on it, the one below its highest.
  const weltY = (side.region.y + side.region.h - side.refs.find(r => r.kind === 'pocket-top').segs[0][0].y) * MM;
  near(above.origin[1], weltY, 0.01, 'the plate above starts on the pocket top');
  near(below.origin[1] + below.size.h, weltY, 0.01, 'the plate on the pocket ends on the pocket top');
  const feet = (p, y) => loops(p.regions).flatMap(l => l.map((a, k) => [a, l[(k + 1) % l.length]])).filter(([a, b]) => Math.abs(a[1] - y) < 1e-3 && Math.abs(b[1] - y) < 1e-3 && Math.abs(a[0] - b[0]) > 4);
  assert.ok(feet(above, 0).length >= 2, 'two straight feet on the edge (above)');
  assert.ok(feet(below, below.size.h).length >= 2, 'two straight feet on the edge (below)');
  // The rack's two legs are 0.5 mm clear of its sides, the shelf above is the gap to the badge.
  const rack = side.items.find(i => i.kind === 'rack'), badge = side.items.find(i => i.name === 'Pilot Badge');
  const gap = (rack.box.y - (badge.box.y + badge.box.h)) * MM;
  near(gap, 12.7, 0.05, 'the badge is 1/2 in above the rack');
  assert.ok(PT.aligners(side)[0].gaps.some(g => Math.abs(g - gap) < 0.05), 'the plate knows that gap');
});

test('the tilted collar and the shoulder board grades have a plate drawn in the grade\'s own frame', async () => {
  const b = await planOf('cadetWomenB');
  const collar = b.sides.find(s => s.key === 'left-collar');
  const piece = PT.aligners(collar)[0];
  assert.equal(piece.tilted, true);
  assert.equal(piece.edge, 'collar-edge');
  const c = await planOf('cadetMenA');
  const sh = PT.aligners(c.sides.find(s => s.key === 'left-shoulder'))[0];
  assert.equal(sh.edge, 'epaulet-edge');
  assert.equal(sh.label, 'LEFT SHOULDER');
});

test('a side with no usable garment edge says so on its plate and stands level with the item', async () => {
  const plan = await planOf('seniorMenA');
  const side = plan.sides.find(s => s.key === 'right-chest');
  const bare = Object.assign({}, side, { refs: [] });
  const [p] = PT.aligners(bare);
  assert.equal(p.edge, 'level');
  assert.match(p.notes.join(' '), /No garment edge is known on this side/);
  const r = checkPiece(bare, 0, 'bare right chest');
  assert.ok(r.stats.watertight);
});

test('a stack too tall for the bed is cut in plates used one after the other, the next standing on the top edge of the item pinned below it', async () => {
  const plan = await planOf('fullRack');
  const side = plan.sides.find(s => s.key === 'left-chest');
  const top = side.items.filter(i => i.kind === 'badge' && i.box.y < 8).sort((a, b) => a.box.y - b.box.y)[0];
  const extra = [1, 2, 3].map(k => Object.assign({}, top, { name: 'Extra badge ' + k, box: { x: top.box.x, y: top.box.y - k * (top.box.h + 0.5), w: top.box.w, h: top.box.h } }));
  const tall = Object.assign({}, side, { items: [...side.items, ...extra] });
  const list = PT.aligners(tall);
  assert.deepEqual(list.map(p => p.label), ['LEFT CHEST 1 OF 2', 'LEFT CHEST 2 OF 2', 'LEFT POCKET']);
  assert.deepEqual(list.map(p => p.edge), ['pocket-top', 'item-top', 'pocket-top']);
  list.forEach((p, i) => checkPiece(tall, i, `tall stack plate ${i + 1}`));
  // The second plate's feet are on the line at the top edge of the highest item the first plate holds.
  const R = tall.region, first = tall.items.filter(it => list[0].items.includes(it.name));
  const lastTop = Math.max(...first.map(it => (R.y + R.h - it.box.y) * MM));
  near(list[1].origin[1], lastTop, 0.01, 'the second plate starts on the first plate\'s highest item\'s top edge');
  assert.deepEqual([...list[0].items, ...list[1].items, ...list[2].items].sort(), tall.items.filter(i => i.attach === 'pin').map(i => i.name).sort(), 'every item is on exactly one plate');
});

test('the spacer gauges: a bar as wide as each gap the plates use, marked with its size, closed and flat, with the address', async () => {
  let files = 0;
  for(const name of Object.keys(BUILDS)){
    const plan = await planOf(name);
    const sizes = PT.gaugeSizes(plan);
    assert.ok(sizes.length >= 1, `${name}: at least one spacer gauge`);
    for(const s of sizes){ near(s.mm, s.sixteenths * MM / 16, 1e-9, `${name}: ${s.label} is a whole number of sixteenths`); assert.match(s.label, /^(\d+ )?(\d+\/\d+|\d+) IN$/); }
    // Every gap a plate uses is a gauge (to 1/16 in), between 1/16 in and 2 in.
    for(const side of plan.sides.filter(x => x.attach === 'pin')) for(const p of PT.aligners(side)) for(const g of p.gaps){
      const n = Math.round(g / MM * 16);
      if(n >= 1 && n <= 32) assert.ok(sizes.some(s => s.sixteenths === n), `${name}: a gauge for the ${g.toFixed(2)} mm gap of ${p.label}`);
    }
    const built = PT.gaugeFiles(sizes);
    built.forEach((f, i) => {
      const { bytes, model } = PT.gaugeStl(plan, i);
      const parsed = STL.parseBinaryStl(bytes), stats = STL.meshStats(parsed.triangles);
      assert.ok(stats.watertight && stats.volume > 0, `${name}: gauge file ${i + 1} is a closed solid`);
      assert.ok(f.size.w <= 180 && f.size.h <= 180, `${name}: gauge file ${i + 1} fits the bed`);
      assert.match(parsed.header, /uniform\.ebhq\.dev spacer gauges/);
      const zs = [...new Set(parsed.triangles.flatMap(t => t.v.map(v => +v[2].toFixed(4))))].sort((a, b) => a - b);
      assert.deepEqual(zs, [0, 2, 2.6]);
      assert.ok(f.regions.every(r => r.holes.length === 0), 'no hole in a gauge');
      const corners = f.regions.flatMap(r => r.outer);
      assert.equal(f.bars.length, f.sizes.length);
      for(const bar of f.bars){
        near(bar.x1 - bar.x0, bar.mm, 1e-9, `${name}: the bar for ${bar.label} is as wide as the gap`);
        for(const x of [bar.x0, bar.x1]) assert.ok(corners.some(v => Math.abs(v[0] - x) < 0.001 && Math.abs(v[1] - bar.y0) < 0.001), `${name}: a bar ${bar.mm.toFixed(2)} mm wide stands on its own, the plate's corners are on it (${bar.label})`);
      }
      const texts = new Set(model.texts.map(t => t.text));
      assert.ok(texts.has(DOMAIN));
      for(const g of f.sizes) assert.ok(texts.has(g.label.toLowerCase()), `${name}: ${g.label} is written on its gauge`);
      files++;
    });
  }
  assert.ok(files >= 7);
  assert.equal(PT.gaugeSizes(await planOf('seniorMenA')).map(s => s.label).join(','), '1/2 IN,1 1/2 IN');
});

test('the labels: every letter the plates write is in the stroke font, sizes are inches and sixteenths', () => {
  for(const s of ['UNIFORM.EBHQ.DEV', 'LEFT CHEST', 'RIGHT SHOULDER', 'LEFT POCKET', 'LEFT COLLAR', 'RIGHT LAPEL', '1 1/2 IN', '3/8 IN', 'LEFT CHEST 1 OF 2']){
    const w = STL.textSize(s, 1.2).w;
    assert.ok(w > 0, s);
    const regions = STL.textRegions(s, 1.2);
    const box = regions.flatMap(r => r.outer);
    const h = Math.max(...box.map(p => p[1])) - Math.min(...box.map(p => p[1]));
    assert.ok(h >= 6 - 1e-6 && h <= 6.6, `${s}: capitals are 6 mm tall (a slanted stroke runs a little past): ${h.toFixed(3)}`);
  }
  assert.throws(() => STL.textSize('~', 1.2), /no letter drawn/);
  assert.deepEqual(PT.gaugeSizes({ sides: [] }), []);
});

// ---- the kernel -----------------------------------------------------------------------------------------

test('boolean2d: a union of bars minus cuts, loops counter-clockwise, holes clockwise, touching bars merged', () => {
  // Three bars (50 + 60 + 30, the third overlapping the first by 2 x 2) minus the part of a triangle that lies inside them (base 4/3, height 2).
  const [a] = STL.regionsOf(STL.boolean2d([STL.rect(0, 0, 10, 5), STL.rect(0, 5, 4, 20), STL.rect(8, 3, 14, 8)], [[[2, -1], [4, -1], [3, 2]]]));
  assert.equal(a.holes.length, 0);
  near(area(a), 50 + 60 + 30 - 4 - 4 / 3, 1e-3, 'exact area');
  assert.ok(STL.signedArea(a.outer) > 0, 'the outline is counter-clockwise');
  // A ring of bars encloses a hole: clockwise, owned by the outline.
  const ring = STL.regionsOf(STL.boolean2d([STL.rect(0, 0, 10, 2), STL.rect(0, 8, 10, 10), STL.rect(0, 0, 2, 10), STL.rect(8, 0, 10, 10)], []));
  assert.equal(ring.length, 1);
  assert.equal(ring[0].holes.length, 1);
  near(area(ring[0]), 100 - 36, 1e-3, 'a frame');
  // Two squares touching only at a corner are refused: the solid would be pinched.
  assert.throws(() => STL.boolean2d([STL.rect(0, 0, 5, 5), STL.rect(5, 5, 10, 10)], []), /touch/);
  // A cut across a bar leaves two feet, straight on the cut line.
  const feet = STL.regionsOf(STL.boolean2d([STL.rect(0, -3, 30, 5)], [STL.rect(-1, -10, 31, 0)]));
  near(feet[0].outer.reduce((m, p) => Math.min(m, p[1]), 9), 0, 1e-9, 'cut straight on y = 0');
});

test('the plate solid: a plate with raised letters is a closed solid of the right volume; a concave ring is triangulated exactly', () => {
  const tx = STL.textRegions('UNIFORM.EBHQ.DEV', 1.2).map(r => ({ outer: r.outer.map(p => [p[0] + 3, p[1] + 3]), holes: r.holes.map(h => h.map(p => [p[0] + 3, p[1] + 3])) }));
  const plate = [{ outer: STL.rect(0, 0, 90, 12), holes: [] }];
  const m = STL.buildPlate({ regions: plate, raised: tx });
  const s = STL.meshStats(m.triangles);
  assert.ok(s.watertight);
  const lettersArea = tx.reduce((a, r) => a + area(r), 0);
  near(s.volume, 90 * 12 * 2 + lettersArea * 0.6, 1e-6, 'volume');
  const text = STL.textSize('UNIFORM.EBHQ.DEV', 1.2);
  near(text.h, 6, 1e-9, 'letters 6 mm tall');
  assert.ok(text.w > 70 && text.w < 80);
  // A letter off the plate is refused.
  assert.throws(() => STL.buildPlate({ regions: plate, raised: [{ outer: STL.rect(100, 3, 104, 8), holes: [] }] }), /off the plate/);
  const ring = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [4, 3], [4, 4], [0, 4]];
  const tris = STL.triangulate(ring, []);
  near(tris.reduce((a, t) => a + STL.signedArea(t), 0), STL.signedArea(ring), 1e-12, 'concave ring area');
});

test('the source has no pin hole, pocket or lip left, and the Finish entry says how to print', () => {
  const stl = fs.readFileSync(path.join(root, 'js', 'placement-stl.js'), 'utf8');
  const pt = fs.readFileSync(path.join(root, 'js', 'placement-templates.js'), 'utf8');
  assert.doesNotMatch(stl, /holeDiameter|holeSides|pocketDepth|lipHeight|lipWidth|function circle|buildJig/);
  assert.doesNotMatch(pt, /jigInput|jigStl|growOrtho|CLEARANCE_MM|3D jig/);
  const m = /<div class="hintText">([^<]*aligners[^<]*)<\/div>/.exec(pt);
  assert.ok(m, 'the entry has a hint line about the aligners');
  assert.match(m[1], /Print the aligners flat, no supports\./);
  assert.doesNotMatch(m[1], /CAPR|AFI|paragraph/);
  assert.ok(m[1].split('. ').length <= 2, 'one short line');
  assert.match(pt, /The 3D aligners are thin flat plates: print each one flat, no supports\./);
  const names = PT.fileNames({ key: 'left-chest' }, 'letter');
  assert.equal(names.stl, 'CAP-Placement_left-chest_aligner.stl');
  assert.equal(names.stlN(2), 'CAP-Placement_left-chest_aligner-2.stl');
  assert.equal(names.gauges(1), 'CAP-Placement_spacers.stl');
  assert.equal(names.gauges(2), 'CAP-Placement_spacers-2.stl');
});
