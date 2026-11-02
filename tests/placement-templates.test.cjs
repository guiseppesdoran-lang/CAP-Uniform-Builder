'use strict';
// Placement templates (LIVE13 E64). Ethan: "paper/3d printed helpers. like if someone prints out a sheet of paper and puts it on their
// blues they just put stuff on top and that will build the holes. same with the 3d printing thing. it will give them a custom 3d printed
// file for the blues to put all of their badges and stuff on. one for each side if applicable."
//
// Composes three builds the way the page does (scripts/render-builds.cjs makeBuild, the engine in node) and checks, against the scene
// and the garment sheets' own specs (not copies of their numbers):
//   - which sides are offered, and that the ABU's sewn items give a sewing guide with no pins and no jig;
//   - every pin position (estimated from the item's width: 1/4 in in from each end on its centreline above 1 in wide, one centre pin
//     otherwise; the ribbon rack's two mounting-bar pins on its widest row);
//   - the registration lines (the welt pocket's top edge under the bottom ribbon row, the button line, the collar edge);
//   - the paper is a stencil (Doran, 2026-11-02: "a cutout of the space between the badges or ribbons"): each item's footprint a solid
//     cut line with a scissor mark, the pins as ticks on the paper outside each hole, the garment edges as dashed lines with a one-word
//     label; the SVG is 1:1 (width and height in inches or mm, viewBox in inches), the PDF is well formed with US Letter or A4 pages;
//   - page packing: a side goes on one page whenever its items fit the printable area at true scale (the men's Class A left chest with
//     a 22-ribbon rack, three badges and the pocket badge below the rack, which used to spill its lowest item onto a second page), and a
//     side taller than a page is split between the holes and tiled with crop marks;
//   - the STL is binary, watertight (every edge used twice, once each way), and its holes are where the scene puts the pins (0.1 mm).

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
const rawSpec = id => JSON.parse(fs.readFileSync(path.join(root, 'images', manifest.assets.find(a => a.id === id).path.replace(/\.svg$/, '.spec.json')), 'utf8'));
const MM = 25.4;

const BUILDS = {
  classA: { uniform: 'blues_a', gender: 'male', membership: 'senior', rank: 'Capt', opt: { rackColumns: 3 },
    ribbonSel: [['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_7'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon'], ['search_find_ribbon']],
    badgeIds: ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge'] },
  classB: { uniform: 'blues_b', gender: 'female', membership: 'cadet', rank: 'C/SSgt', opt: { rackColumns: 3 },
    ribbonSel: [['wright_brothers_award'], ['curry_achievement'], ['encampment_ribbon']], badgeIds: ['AirCrew1_DB3F0FCC3650F'] },
  abu: { uniform: 'abu', gender: 'male', membership: 'senior', rank: 'Capt', badgeIds: ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge'] },
  abuCadet: { uniform: 'abu', gender: 'male', membership: 'cadet', rank: 'C/SSgt', badgeIds: ['AirCrew1_DB3F0FCC3650F'] },
  // Doran's build (2026-11-02): a 22-ribbon rack, the Observer and Master Ground Team badges above it, the Communications Senior badge on
  // the pocket below it, the nameplate on the other side.
  doran: { uniform: 'blues_a', gender: 'male', membership: 'senior', rank: 'Capt', opt: { rackColumns: 4 },
    ribbonSel: ['meritorious_service_award', 'commander_commendation_award', ['cap_achievment_award', 'capub_total_7'], 'lifesaving_award', 'unit_citation_award', 'cap_gill_robb_wilson_ribbon', 'cap_paul_e_garber_ribbon', 'cap_grover_loening_aerospace_ribbon', 'cap_leadership_ribbon', 'cap_membership_ribbon', 'cap_a_scott_crossfield_ribbon', 'cap_bridgadier_general_charles_yaeger_ribbon', 'cap_command_service_ribbon', 'crisis_ribbon', 'red_service_ribbon', 'search_find_ribbon', 'air_search_and_rescue_ribbon', 'cap_counterdrug_ribbon', 'disaster_relief_ribbon', 'homeland_security_ribbon', 'community_service_ribbon', 'cap_senior_recruiter_ribbon'].map(r => Array.isArray(r) ? r : [r]),
    badgeIds: ['observer_badge', 'master_ground_team_badge', 'communications_senior_badge'] }
};
const cache = new Map();
async function planOf(name){
  if(!cache.has(name)){
    const spec = BUILDS[name];
    const scene = await P.composeUniform(RB.makeBuild(spec), store);
    const plan = await PT.plan(scene, id => store.load(id), { uniform: spec.uniform, rank: spec.rank, name: 'Pat Doe', uniformLabel: 'Test garment' });
    cache.set(name, { scene, plan });
  }
  return cache.get(name);
}
const sideOf = (plan, key) => { const s = plan.sides.find(x => x.key === key); assert.ok(s, `side ${key} offered (have ${plan.sides.map(x => x.key)})`); return s; };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
// The scene's own box of a layer, rotated about its origin.
function frame(l){
  const r = (l.rotate || 0) * Math.PI / 180, o = l.origin;
  const c = { x: l.x + l.w / 2, y: l.y + l.h / 2 };
  const cx = o.x + (c.x - o.x) * Math.cos(r) - (c.y - o.y) * Math.sin(r), cy = o.y + (c.x - o.x) * Math.sin(r) + (c.y - o.y) * Math.cos(r);
  return { cx, cy, w: l.w, ux: Math.cos(r), uy: Math.sin(r) };
}
const expectedPins = l => { const f = frame(l); return f.w > 1 ? [-1, 1].map(s => ({ x: f.cx + s * (f.w / 2 - 0.25) * f.ux, y: f.cy + s * (f.w / 2 - 0.25) * f.uy })) : [{ x: f.cx, y: f.cy }]; };
function samePins(got, want, msg){
  assert.equal(got.length, want.length, `${msg}: pin count`);
  const g = got.slice().sort((a, b) => a.x - b.x || a.y - b.y), w = want.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  g.forEach((p, i) => { near(p.x, w[i].x, 1e-6, `${msg} pin ${i} x`); near(p.y, w[i].y, 1e-6, `${msg} pin ${i} y`); });
}

// Holes found in the STL itself: the vertices on the underside (z = 0) within 1 mm of where the pin should be, all on a 0.75 mm circle.
function stlHoleCentre(tris, at){
  const pts = new Map();
  for(const t of tris) for(const v of t.v) if(Math.abs(v[2]) < 1e-4 && Math.hypot(v[0] - at[0], v[1] - at[1]) < 1.0) pts.set(v.join(','), v);
  const list = [...pts.values()];
  if(list.length < 8) return null;
  const cx = list.reduce((a, v) => a + v[0], 0) / list.length, cy = list.reduce((a, v) => a + v[1], 0) / list.length;
  const radii = list.map(v => Math.hypot(v[0] - cx, v[1] - cy));
  return { x: cx, y: cy, n: list.length, rMin: Math.min(...radii), rMax: Math.max(...radii) };
}
function checkJig(side, label){
  const { bytes, model } = PT.jigStl(side, {});
  assert.equal(bytes.length, 84 + 50 * model.triangles.length, `${label}: binary STL size`);
  const parsed = STL.parseBinaryStl(bytes);
  const stats = STL.meshStats(parsed.triangles);
  assert.ok(stats.watertight, `${label}: watertight (${stats.open} open, ${stats.misoriented} misoriented of ${stats.edges} edges)`);
  assert.ok(stats.volume > 0, `${label}: normals point out`);
  const R = side.region;
  const xs = parsed.triangles.flatMap(t => t.v.map(v => v[0])), ys = parsed.triangles.flatMap(t => t.v.map(v => v[1])), zs = parsed.triangles.flatMap(t => t.v.map(v => v[2]));
  near(Math.min(...xs), 0, 1e-3, `${label}: plate starts at x 0`); near(Math.max(...xs), R.w * MM, 1e-2, `${label}: plate width`);
  near(Math.min(...ys), 0, 1e-3, `${label}: plate starts at y 0`); near(Math.max(...ys), R.h * MM, 1e-2, `${label}: plate height`);
  near(Math.max(...zs), 2.5, 1e-6, `${label}: plate 2.5 mm`);
  assert.ok(zs.some(z => Math.abs(z - 1.9) < 1e-5), `${label}: 0.6 mm pockets`);
  if(model.lips.length) near(Math.min(...zs), -3, 1e-6, `${label}: 3 mm lips`);
  const pins = side.items.filter(i => i.attach === 'pin').flatMap(i => i.pins);
  assert.equal(model.holes.length, pins.length, `${label}: one hole per pin (${model.notes.join('; ')})`);
  for(const p of pins){
    const want = [(p.x - R.x) * MM, (R.y + R.h - p.y) * MM];
    const got = stlHoleCentre(parsed.triangles, want);
    assert.ok(got, `${label}: a hole near ${want}`);
    assert.ok(Math.hypot(got.x - want[0], got.y - want[1]) <= 0.1, `${label}: hole at ${got.x},${got.y} for pin ${want}`);
    assert.ok(got.rMin > 0.74 && got.rMax < 0.76, `${label}: 1.5 mm hole (r ${got.rMin}-${got.rMax})`);
  }
  return { model, parsed };
}

test('Class A, men, Capt with ribbons and badges: the sides that carry pins', async () => {
  const { plan } = await planOf('classA');
  assert.deepEqual(plan.sides.map(s => s.key).sort(), ['left-chest', 'left-lapel', 'right-chest', 'right-lapel']);
  assert.ok(plan.sides.every(s => s.attach === 'pin'));
});

test('Class A left chest: the rack\'s mounting-bar pins and each badge\'s pins, from the scene', async () => {
  const { scene, plan } = await planOf('classA');
  const side = sideOf(plan, 'left-chest');
  const ribbons = scene.layers.filter(l => l.role === 'ribbon');
  const rack = side.items.find(i => i.kind === 'rack');
  assert.equal(rack.name, 'Ribbon rack, 7 ribbons');
  // Rows, the widest nearest the rack's middle carries the bar's pins 1/4 in in from its ends.
  const rows = [...new Set(ribbons.map(l => l.y.toFixed(3)))].map(Number).sort((a, b) => a - b).map(y => { const r = ribbons.filter(l => Math.abs(l.y - y) < 0.01); const x0 = Math.min(...r.map(l => l.x)), x1 = Math.max(...r.map(l => l.x + l.w)); return { y, h: r[0].h, x0, x1, w: x1 - x0 }; });
  const top = rows[0].y, bottom = rows[rows.length - 1].y + rows[rows.length - 1].h, mid = (top + bottom) / 2;
  const widest = Math.max(...rows.map(r => r.w));
  const bar = rows.filter(r => r.w > widest - 0.01).sort((a, b) => Math.abs(a.y + a.h / 2 - mid) - Math.abs(b.y + b.h / 2 - mid))[0];
  samePins(rack.pins, [{ x: bar.x0 + 0.25, y: bar.y + bar.h / 2 }, { x: bar.x1 - 0.25, y: bar.y + bar.h / 2 }], 'rack');
  // The rack's outline is its rows: 1, 3, 3 ribbons, the top one centred.
  assert.equal(rows.length, 3);
  assert.equal(rack.outline.length, 8, 'stepped outline of a 1-3-3 rack');
  for(const key of ['badge:CAPPilot1_FA9D33EA587D8', 'badge:emergency_services_badge']){
    const l = scene.layers.find(x => x.key === key);
    const it = side.items.find(i => i.name === l.title);
    samePins(it.pins, expectedPins(l), key);
    assert.equal(it.pins.length, 2, `${key} is wider than 1 in`);
  }
  assert.ok(side.items.every(i => i.attach === 'pin'));
});

test('Class A left chest: the welt pocket\'s top edge is the registration line under the bottom row of ribbons', async () => {
  const { scene, plan } = await planOf('classA');
  const side = sideOf(plan, 'left-chest');
  const welt = rawSpec('garment-blues-class-a-coat').landmarks.welt_pocket;
  const ref = side.refs.find(r => r.kind === 'pocket-top');
  assert.ok(ref && ref.lip, 'pocket top edge, a lip on the jig');
  const seg = ref.segs[0];
  near(seg[0].y, welt.y / 100, 1e-6, 'line at the welt top'); near(seg[1].y, welt.y / 100, 1e-6, 'level');
  near(seg[0].x, welt.x / 100, 1e-6, 'from the welt\'s left end'); near(seg[1].x, (welt.x + welt.w) / 100, 1e-6, 'to its right end');
  const bottomRow = Math.max(...scene.layers.filter(l => l.role === 'ribbon').map(l => l.y + l.h));
  near(bottomRow, welt.y / 100, 1e-3, 'bottom ribbon row on the welt top (11.1.4.1)');
  const sides = side.refs.find(r => r.kind === 'pocket-side');
  assert.equal(sides.segs.length, 2, 'both welt side edges');
  // The side's region holds its items and the lines.
  const R = side.region;
  for(const it of side.items) assert.ok(it.box.x >= R.x && it.box.y >= R.y && it.box.x + it.box.w <= R.x + R.w && it.box.y + it.box.h <= R.y + R.h, `${it.name} inside the sheet`);
});

test('Class A right chest and lapels: the nameplate\'s two pins, one centre pin for each "U.S." insignia', async () => {
  const { scene, plan } = await planOf('classA');
  const right = sideOf(plan, 'right-chest');
  const tag = scene.layers.find(l => l.key === 'clear:nametag');
  const plate = right.items.find(i => i.kind === 'nametag');
  samePins(plate.pins, [{ x: tag.x + 0.25, y: tag.y + tag.h / 2 }, { x: tag.x + tag.w - 0.25, y: tag.y + tag.h / 2 }], 'nameplate');
  assert.ok(right.refs.some(r => r.kind === 'lapel-edge'), 'the lapel edge is the nameplate\'s line-up');
  const us = rawSpec('garment-blues-class-a-coat-lapel-us');
  for(const side of ['left', 'right']){
    const s = sideOf(plan, side + '-lapel');
    const layer = scene.layers.find(l => (l.onlyGroups || [])[0] === `lapel-us-${side}`);
    const lm = us.landmarks[`lapel_us_${side}`];
    const it = s.items[0];
    assert.equal(it.name, '"U.S." lapel insignia');
    samePins(it.pins, [{ x: (lm.x + lm.w / 2) / 100 + layer.x, y: (lm.y + lm.h / 2) / 100 + layer.y }], `${side} lapel`);
    assert.ok(s.refs.some(r => r.kind === 'gorge-seam'), `${side}: the gorge seam`);
  }
});

test('Class B, women, cadet: rack and badge on the left, nameplate on the right, metal grade pinned on both collar points', async () => {
  const { scene, plan } = await planOf('classB');
  assert.deepEqual(plan.sides.map(s => s.key).sort(), ['left-chest', 'left-collar', 'right-chest', 'right-collar']);
  const left = sideOf(plan, 'left-chest');
  assert.equal(left.items.find(i => i.kind === 'rack').name, 'Ribbon rack, 3 ribbons');
  const badge = scene.layers.find(l => l.key === 'badge:AirCrew1_DB3F0FCC3650F');
  samePins(left.items.find(i => i.kind === 'badge').pins, expectedPins(badge), 'aircrew badge');
  // No pocket on the blouse: the button line is the line-up, through the centres the sheet gives.
  const blouse = rawSpec('garment-blues-class-b-blouse-female');
  for(const key of ['left-chest', 'right-chest']){
    const ref = sideOf(plan, key).refs.find(r => r.kind === 'button-line');
    assert.ok(ref, `${key}: button line`);
    near(ref.segs[0][0].x, blouse.anchors.button_1_center[0] / 100, 1e-6, `${key}: button line x`);
  }
  for(const side of ['left', 'right']){
    const s = sideOf(plan, side + '-collar');
    const l = scene.layers.find(x => x.key === 'grade:' + side);
    assert.match(l.id, /metal/);
    const it = s.items[0];
    samePins(it.pins, expectedPins(l), `${side} collar grade`);
    near(it.pins[0].x, it.pins[1].x, 1e-9, `${side}: the chevron turned a quarter, its two pins one above the other`);
    assert.ok(s.refs.some(r => r.kind === 'collar-edge'), `${side}: collar edge`);
  }
});

test('ABU: the sewn-on tapes, badges and cloth grade give a sewing guide, no pins and no jig; a cadet\'s metal collar grade is pinned', async () => {
  const { plan } = await planOf('abu');
  assert.ok(plan.sides.length >= 3);
  for(const s of plan.sides){
    assert.equal(s.attach, 'sew', `${s.key} sewn`);
    assert.ok(s.items.every(i => i.pins.length === 0), `${s.key}: no pin holes`);
    const svg = PT.paperSvg(s, plan.meta, 'letter');
    assert.match(svg, /Sewing guide: the items on this side are sewn on/);
    assert.doesNotMatch(svg, /Pin ticks are estimated/);
    assert.match(svg, /Mark the garment through each hole with tailor's chalk/);
    assert.doesNotMatch(svg, /stroke="rgb\(191,26,26\)"/, 'no red pin ticks on a sewing guide');
  }
  const left = sideOf(plan, 'left-chest');
  assert.deepEqual(left.items.map(i => i.kind).sort(), ['badge', 'badge', 'tape']);
  assert.ok(left.refs.some(r => r.kind === 'pocket-top' && /flap/.test(r.label)), 'the chest pocket flap\'s top edge');
  const cadet = (await planOf('abuCadet')).plan;
  const collar = sideOf(cadet, 'left-collar');
  assert.equal(collar.attach, 'pin');
  assert.equal(collar.items[0].pins.length, 2);
  checkJig(collar, 'ABU cadet left collar');
  assert.equal(sideOf(cadet, 'left-chest').attach, 'sew');
});

const inBox = (p, b, tol) => p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol;
const onEdge = (p, b, tol) => inBox(p, b, tol) && (Math.abs(p.x - b.x) < tol || Math.abs(p.x - b.x - b.w) < tol || Math.abs(p.y - b.y) < tol || Math.abs(p.y - b.y - b.h) < tol);

test('paper SVG: one page at 1:1 in inches (Letter) or millimetres (A4), the scale bars, the four how-to lines, the pin rule and the ribbon list in the small footer', async () => {
  const { plan } = await planOf('classA');
  const side = sideOf(plan, 'left-chest');
  const svg = PT.paperSvg(side, plan.meta, 'letter');
  assert.match(svg, /<svg [^>]*width="8\.5in" height="11in" viewBox="0 0 8\.5 11"/);
  assert.match(svg, /Pin ticks are estimated from each item's width/);
  assert.match(svg, /Ribbon rack, top row first: row 1: Meritorious Service Award/);
  const a4 = PT.paperSvg(side, plan.meta, 'a4');
  assert.match(a4, /<svg [^>]*width="210mm" height="297mm" viewBox="0 0 8\.2677 11\.6929"/);
  const pages = PT.paperPages(side, plan.meta, 'letter');
  assert.equal(pages.length, 1);
  const texts = pages[0].ops.filter(o => o.t === 'text');
  // The how-to: four lines in sentence case, the print line first and in the warning colour, no shouting.
  const steps = texts.filter(o => o.s === 0.085 && !o.text.startsWith('Page ')).slice(0, 4).map(o => o.text);
  assert.equal(steps.length, 4);
  assert.match(steps[0], /^Print at 100% \(actual size\), no scaling: the bars at the top right must measure 1 in and 25 mm\.$/);
  assert.match(steps[1], /^Cut out each solid outline, starting at its scissor mark/);
  assert.match(steps[2], /^Lay the sheet on the garment and line up the blue dashed lines/);
  assert.match(steps[3], /^Mark the garment through each hole; the red ticks outside a hole are where its pins go/);
  assert.ok(!texts.some(o => /PRINT AT 100%|SEWING GUIDE|Symbols:/.test(o.text)), 'no upper-case how-to and no symbol key');
  // The ribbon list and the pin rule are the footer, in a smaller size than any line above the sheet.
  const foot = texts.filter(o => /^Ribbon rack, top row first|^Pin ticks are estimated/.test(o.text));
  assert.equal(foot.length, 2);
  assert.ok(foot.every(o => o.s <= 0.065 && o.y > pages[0].origin.y + pages[0].tile.h), 'the ribbon list and the pin rule sit under the sheet in the small size');
  // The scale bars are 1 in and 25 mm long in the page's inches.
  const bars = pages[0].ops.filter(o => o.t === 'line' && o.w === 0.02);
  assert.deepEqual(bars.map(b => +(b.x2 - b.x1).toFixed(6)).sort(), [+(25 / MM).toFixed(6), 1]);
  // The sheet (the items with a small margin and the lines beside them) sits inside the page margins, centred.
  const g = pages[0].ops.find(o => o.t === 'group');
  const S = pages[0].sheet;
  assert.deepEqual(PT.sheetOf(side), S);
  assert.ok(g.dx + S.x >= 0.3 - 1e-9 && g.dx + S.x + S.w <= 8.2 + 1e-9, 'sheet inside the side margins');
  near(g.dx + S.x - 0.3, 8.2 - (g.dx + S.x + S.w), 1e-9, 'centred');
  assert.equal(g.clip.w, S.w); assert.equal(g.clip.h, S.h);
  for(const it of side.items) assert.ok(inBox({ x: it.box.x, y: it.box.y }, S, 0) && inBox({ x: it.box.x + it.box.w, y: it.box.y + it.box.h }, S, 0), it.name + ' on the sheet');
  assert.ok(S.h < side.region.h && S.y > side.region.y, 'the sheet is tighter than the jig plate');
});

test('the stencil: every item is one solid cut line with a scissor mark at its top-left corner, the pins are red ticks outside the cut, the garment edges dashed with one-word labels', async () => {
  const { plan } = await planOf('classA');
  const side = sideOf(plan, 'left-chest');
  const pages = PT.paperPages(side, plan.meta, 'letter');
  const ops = pages[0].ops.find(o => o.t === 'group').ops;
  const cutsDrawn = ops.filter(o => o.cut);
  assert.equal(cutsDrawn.length, side.items.length, 'one cut per item');
  assert.ok(cutsDrawn.every(o => o.t === 'poly' && o.closed && !o.dash && o.w >= 0.014), 'solid closed cut lines');
  const rack = side.items.find(i => i.kind === 'rack');
  assert.equal(rack.cut.length, 4, 'the rack is cut as one rectangle');
  assert.deepEqual(boxOfPts(rack.cut), rack.box);
  assert.equal(rack.outline.length, 8, 'the jig keeps the stepped outline');
  assert.ok(!ops.some(o => o.t === 'circle' && o.r === 0.06), 'no pin rings inside the holes (they would be cut away)');
  assert.ok(!ops.some(o => o.t === 'poly' && o.w === 0.006), 'no ribbon part boxes inside the rack\'s hole');
  for(const it of side.items){
    const cutOp = cutsDrawn.find(o => o.pts.length === it.cut.length && o.pts.every((p, i) => Math.abs(p[0] - it.cut[i].x) < 1e-9 && Math.abs(p[1] - it.cut[i].y) < 1e-9));
    assert.ok(cutOp, it.name + ' cut where the item is');
    // The scissor mark: two blades and two handles centred on the cut's top-left corner.
    const tl = it.cut.slice().sort((p, q) => p.y - q.y || p.x - q.x)[0];
    const sc = ops.filter(o => o.scissors && (o.t === 'line' ? Math.hypot((o.x1 + o.x2) / 2 - tl.x, (o.y1 + o.y2) / 2 - tl.y) < 0.1 : Math.hypot(o.cx - tl.x, o.cy - tl.y) < 0.2));
    assert.equal(sc.filter(o => o.t === 'line').length, 2, it.name + ': blades at the corner');
    assert.equal(sc.filter(o => o.t === 'circle').length, 2, it.name + ': handles at the corner');
    // Pin ticks: each starts on the cut's edge at the pin's x (top and bottom) or y (left and right) and points outward.
    const ticks = ops.filter(o => o.tick && onEdge({ x: o.x1, y: o.y1 }, it.box, 1e-6));
    assert.ok(ticks.length >= it.pins.length * 2, it.name + ': ticks for ' + it.pins.length + ' pins');
    for(const p of it.pins){
      assert.ok(ticks.some(k => Math.abs(k.x1 - p.x) < 1e-9 && Math.abs(k.y1 - it.box.y) < 1e-9 && k.y2 < k.y1), it.name + ': a tick above the pin');
      assert.ok(ticks.some(k => Math.abs(k.x1 - p.x) < 1e-9 && Math.abs(k.y1 - it.box.y - it.box.h) < 1e-9 && k.y2 > k.y1), it.name + ': a tick below the pin');
      assert.ok(ticks.some(k => Math.abs(k.y1 - p.y) < 1e-9 && Math.abs(k.x1 - it.box.x) < 1e-9 && k.x2 < k.x1), it.name + ': a tick left of the pin');
      assert.ok(ticks.some(k => Math.abs(k.y1 - p.y) < 1e-9 && Math.abs(k.x1 - it.box.x - it.box.w) < 1e-9 && k.x2 > k.x1), it.name + ': a tick right of the pin');
    }
    for(const k of ticks){ assert.ok(!inBox({ x: k.x2, y: k.y2 }, it.box, -1e-6), it.name + ': the tick is on the paper outside the hole'); near(Math.hypot(k.x2 - k.x1, k.y2 - k.y1), 0.1, 1e-9, 'tick length'); }
    assert.ok(ticks.every(k => k.color[0] > 0.7 && k.color[1] < 0.2), it.name + ': red ticks');
    assert.ok(ops.some(o => o.t === 'text' && o.text === it.name && o.y < it.box.y && o.y > it.box.y - 0.3), it.name + ': named above its hole');
  }
  // The garment edges: the welt top and sides and the lapel edge, dashed in the reference colour, each with a one-word label.
  const dashed = ops.filter(o => o.t === 'line' && o.dash && o.color[2] > 0.7);
  assert.ok(dashed.length >= 4, 'welt top, two welt sides and the lapel edge');
  const refLabels = ops.filter(o => o.t === 'text' && o.color[2] > 0.7).map(o => o.text);
  assert.deepEqual([...new Set(refLabels)].sort(), ['lapel', 'pocket']);
  assert.ok(refLabels.every(l => !/\s/.test(l)), 'one word each');
});
const boxOfPts = pts => { const xs = pts.map(p => p.x), ys = pts.map(p => p.y); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };

test('page packing: Doran\'s men\'s Class A left chest (22-ribbon rack, Observer, Master Ground Team, Communications Senior on the pocket) is one Letter and one A4 page, the footer giving way first', async () => {
  const { scene, plan } = await planOf('doran');
  assert.equal(scene.layers.filter(l => l.role === 'ribbon').length, 22);
  const side = sideOf(plan, 'left-chest');
  assert.deepEqual(side.items.map(i => i.name).sort(), ['Communications Senior Badge', 'Master Ground Team Badge', 'Observer Badge', 'Ribbon rack, 22 ribbons']);
  const items = side.items.map(i => i.box);
  const span = Math.max(...items.map(b => b.y + b.h)) - Math.min(...items.map(b => b.y));
  assert.ok(span > 8 && span < 9.2, 'the items span ' + span.toFixed(2) + ' in, more than the old drawing band left room for');
  for(const paper of ['letter', 'a4']){
    const pages = PT.paperPages(side, plan.meta, paper);
    assert.equal(pages.length, 1, paper + ': one page');
    const t = pages[0].tile;
    for(const it of side.items) assert.ok(inBox({ x: it.box.x, y: it.box.y }, t, 1e-9) && inBox({ x: it.box.x + it.box.w, y: it.box.y + it.box.h }, t, 1e-9), paper + ': ' + it.name + ' on page 1');
    const H = PT.PAPERS[paper].h;
    assert.ok(pages[0].origin.y + t.h <= H - 0.3 + 1e-9, paper + ': the sheet ends above the bottom margin');
    const foot = pages[0].ops.filter(o => o.t === 'text' && o.y > pages[0].origin.y + t.h);
    assert.ok(foot.some(o => /^Ribbon rack, top row first: row 1: Meritorious Service Award/.test(o.text)), paper + ': the ribbon list is on the page');
    assert.ok(foot.every(o => o.y + 0.02 <= H - 0.3 + 1e-9), paper + ': the footer ends above the bottom margin');
    if(paper === 'letter') assert.ok(new Set(foot.map(o => o.x)).size >= 3, 'Letter: the footer went to columns to make room');
  }
  // The right chest carries the nameplate alone, one page; the jig is untouched by the stencil (its plate is still the side's region).
  const right = sideOf(plan, 'right-chest');
  assert.deepEqual(right.items.map(i => i.kind), ['nametag']);
  assert.equal(PT.paperPages(right, plan.meta, 'letter').length, 1);
  const jig = PT.jigInput(side);
  near(Math.max(...jig.plate.map(p => p[0])), side.region.w * MM, 1e-3, 'plate width from the region');
  near(Math.max(...jig.plate.map(p => p[1])), side.region.h * MM, 1e-3, 'plate height from the region');
  assert.equal(jig.pockets.find(p => /Ribbon rack/.test(p.name)).ring.length, side.items.find(i => i.kind === 'rack').outline.length, 'the rack pocket keeps the stepped outline');
});

test('paper PDF: written without a library, one page per tile, US Letter 612 x 792 pt or A4 595.28 x 841.89 pt, valid cross-reference', async () => {
  const { plan } = await planOf('classA');
  const side = sideOf(plan, 'left-chest');
  for(const [paper, box] of [['letter', '0 0 612 792'], ['a4', '0 0 595.27559 841.88976']]){
    const pdf = Buffer.from(PT.paperPdf(side, plan.meta, paper)).toString('latin1');
    assert.ok(pdf.startsWith('%PDF-1.4\n'));
    assert.match(pdf, /\/Count 1 /);
    assert.ok(pdf.includes(`/MediaBox [${box}]`), `${paper} MediaBox`);
    const xref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(pdf)[1]);
    assert.equal(pdf.slice(xref, xref + 4), 'xref');
    const offs = pdf.slice(xref).split('\n').slice(3).filter(l => / 00000 n $/.test(l)).map(l => Number(l.slice(0, 10)));
    offs.forEach((o, i) => assert.ok(pdf.startsWith(`${i + 1} 0 obj`, o), `object ${i + 1} at its offset`));
    for(const m of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g)){ const start = m.index + m[0].length; assert.equal(pdf.slice(start + Number(m[1]), start + Number(m[1]) + 10), '\nendstream', 'stream length'); }
    assert.match(pdf, /\(Print at 100% \\\(actual size\\\), no scaling: the bars at the top right must measure 1 in and 25 mm\.\)/);
  }
});

test('a side taller than a page is split between the holes, tiled with crop marks and matching letters, one PDF page per tile', async () => {
  const { plan } = await planOf('classA');
  const side = sideOf(plan, 'left-chest');
  // The same items again 7 in lower: a sheet about 13 in tall whose only item-free band near the middle is between the two groups.
  const shift = it => Object.assign({}, it, { box: Object.assign({}, it.box, { y: it.box.y + 7 }), c: { x: it.c.x, y: it.c.y + 7 }, cut: it.cut.map(p => ({ x: p.x, y: p.y + 7 })), outline: it.outline.map(p => ({ x: p.x, y: p.y + 7 })), pins: it.pins.map(p => ({ x: p.x, y: p.y + 7 })), parts: [] });
  const big = Object.assign({}, side, { items: side.items.concat(side.items.map(shift)), refs: [] });
  big.region = Object.assign({}, side.region, { h: side.region.h + 7 });
  const S = PT.sheetOf(big);
  assert.ok(S.h > 11, 'taller than a page: ' + S.h);
  const pages = PT.paperPages(big, plan.meta, 'letter');
  assert.equal(pages.length, 2, 'two tiles');
  const tiles = pages.map(p => p.tile);
  near(tiles.reduce((a, t) => a + t.h, 0), S.h, 1e-9, 'the tiles cover the sheet once');
  const split = tiles[0].y + tiles[0].h;
  for(const it of big.items) assert.ok(it.box.y + it.box.h <= split + 1e-9 || it.box.y >= split - 1e-9, it.name + ' is not cut by the page split');
  assert.ok(big.items.some(it => it.box.y + it.box.h <= split) && big.items.some(it => it.box.y >= split), 'items on both pages');
  const texts = pages.map(p => p.ops.filter(o => o.t === 'text').map(o => o.text));
  assert.ok(texts[0].some(t => /^Page 1 of 2 \(row 1, column 1\): trim at the crop marks/.test(t)));
  assert.ok(texts[0].includes('A') && texts[1].includes('A'), 'the shared edge carries the same letter on both pages');
  const crops = pages[0].ops.filter(o => o.t === 'line' && o.w === 0.008 && (Math.abs(o.x2 - o.x1) > 0.2 || Math.abs(o.y2 - o.y1) > 0.2));
  assert.ok(crops.length >= 8, 'crop marks at the four corners');
  const svg = PT.paperSvg(big, plan.meta, 'letter');
  assert.match(svg, /height="22in"/);
  assert.match(svg, /data-pages="2"/);
  assert.match(Buffer.from(PT.paperPdf(big, plan.meta, 'letter')).toString('latin1'), /\/Count 2 /);
  // A sheet wider than a page is tiled in columns too, and a region with no gap splits at the page's limit.
  const wide = Object.assign({}, side, { region: Object.assign({}, side.region, { w: 17, h: 2 }) });
  const wideItems = [0, 8].map(dx => Object.assign({}, side.items[0], { box: { x: side.region.x + dx, y: side.region.y + 0.5, w: 8, h: 1 }, cut: [], pins: [] }));
  wideItems.forEach(it => { it.cut = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => ({ x: it.box.x + u * it.box.w, y: it.box.y + v * it.box.h })); it.outline = it.cut; it.c = { x: it.box.x + 4, y: it.box.y + 0.5 }; });
  wide.items = wideItems; wide.refs = [];
  const wp = PT.paperPages(wide, plan.meta, 'letter');
  assert.ok(wp.length >= 3, 'columns: ' + wp.length);
  near(wp.reduce((a, p) => a + p.tile.w * p.tile.h, 0), PT.sheetOf(wide).w * PT.sheetOf(wide).h, 1e-6, 'the tiles cover the sheet once');
});

test('3D jigs: binary, watertight, holes where the pins are (within 0.1 mm), for every pinned side of the three builds', async () => {
  let n = 0;
  for(const name of ['classA', 'classB']){
    const { plan } = await planOf(name);
    for(const side of plan.sides.filter(s => s.attach === 'pin')){ checkJig(side, `${name} ${side.key}`); n++; }
  }
  assert.equal(n, 8);
  const { plan } = await planOf('classA');
  const { model } = checkJig(sideOf(plan, 'left-chest'), 'Class A left chest');
  assert.ok(model.lips.some(l => /welt pocket top/.test(l.name)), 'a lip on the welt pocket top');
  assert.equal(model.pockets.length, 3, 'a pocket for the rack and each badge');
  const { plan: b } = await planOf('classB');
  assert.ok(checkJig(sideOf(b, 'left-chest'), 'Class B left chest').model.lips.some(l => /button/.test(l.name)), 'a lip on the button line');
});

test('the triangulation: a square plate with holes and a stepped pocket gives a closed solid of the right volume', () => {
  const plate = [[0, 0], [100, 0], [100, 60], [0, 60]];
  const pockets = [{ ring: [[10, 10], [45, 10], [45, 20], [10, 20]], name: 'a' }, { ring: [[50, 30], [80, 30], [80, 40], [60, 40], [60, 50], [50, 50]], name: 'b' }];
  const holes = [{ x: 15, y: 15, name: '1' }, { x: 40, y: 15, name: '2' }, { x: 55, y: 45, name: '3' }, { x: 90, y: 50, name: '4' }];
  const lips = [{ a: [5, 5], b: [95, 5], toward: [50, 50], name: 'pocket top' }];
  const m = STL.buildJig({ plate, pockets, holes, lips });
  const s = STL.meshStats(m.triangles);
  assert.ok(s.watertight);
  const hole = STL.signedArea(STL.circle(0, 0, 0.75, 24));
  const want = 100 * 60 * 2.5 - (35 * 10 + 30 * 10 + 10 * 10) * 0.6 - hole * (1.9 * 3 + 2.5) + 90 * 2 * 3;
  near(s.volume, want, 1e-6, 'volume');
  // Ear clipping covers a concave ring exactly.
  const ring = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [4, 3], [4, 4], [0, 4]];
  const tris = STL.triangulate(ring, []);
  near(tris.reduce((a, t) => a + STL.signedArea(t), 0), STL.signedArea(ring), 1e-12, 'concave ring area');
});

test('file names and the page control: the Templates entry in the Finish panel opens the window', () => {
  // The floating command bar that used to carry a Templates button is gone; the entry this module adds to the
  // Check & finish step, after the download block, is the one place the window opens from.
  const ws = fs.readFileSync(path.join(root, 'js', 'workspace-ui.js'), 'utf8');
  assert.doesNotMatch(ws, /cmdTemplates|capubCommandBar/);
  const src = fs.readFileSync(path.join(root, 'js', 'placement-templates.js'), 'utf8');
  assert.match(src, /id="placementTemplatesOpen" type="button" class="ghost">Placement templates \(print or 3D-print\)<\/button>/);
  assert.match(src, /const png = document\.getElementById\('downloadImage'\);\s*const action = png && png\.closest\('\.finishAction'\);/);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<div class="finishAction" id="downloadAction">\s*<button id="downloadImage" type="button">Download picture \(PNG\)<\/button>\s*<\/div>/);
  // PDF is the main action for each side and the SVG a link after it (LIVE13 E78, Ethan: "nobody prints svg's lol make pdf the default").
  assert.match(src, /data-what="pdf">Paper \(PDF\)<\/button>\$\{s\.attach === 'pin' \? `<button type="button" class="ghost" data-side="\$\{esc\(s\.key\)\}" data-what="stl">3D jig \(STL\)<\/button>` : ''\}<button type="button" class="ptAlt" data-side="\$\{esc\(s\.key\)\}" data-what="svg">also as SVG<\/button>/);
  assert.doesNotMatch(src, /data-what="pdf"[^>]*class="ghost"|class="ghost"[^>]*data-what="pdf"/, 'the PDF button is not the secondary style');
  assert.match(src, />3D jig \(STL\)</);
  assert.match(src, /Sewn on: paper sewing guide only, no 3D jig/);
});
