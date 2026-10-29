'use strict';
// The measurement overlay (js/engine/measure-layout.js): on every uniform the labels stay inside
// the drawing (or the room made around it for the pills and callouts), clear of the artwork and of each other, and no dimension line runs
// across a piece. Since LIVE13 E97 each measure is drawn as a tailor's dimension (witness lines, a dimension line with arrowheads, a pill with
// the length and a caption joined to the line by a leader, set off the cloth when a clear side is near): the tests of where a label sits read
// the leader instead of the old 'beside its line' rule.

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
const RA = require('../data/ribbon-awards.js');
const ML = require('../js/engine/measure-layout.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function ribbons(ids){
  return ids.flatMap(id => RA.resolve(id, {}).map((r, i) => ({ key: `ribbon:${id}${i ? '#' + i : ''}`, title: id, asset: 'ribbon-' + id.replace(/_/g, '-'), devices: r.devices, centered: r.centered })));
}
function build(uniform, membership, rank, extra){
  return Object.assign({
    uniform, gender: 'male', grade: G.gradeInfo(membership, rank, {}),
    opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const rack = ribbons(['mitchell_award', 'wright_brothers_award', 'encampment_ribbon', 'red_service_ribbon']);
const badges = ids => ids.map(id => ({ id }));

async function laidOut(b){
  const scene = await P.composeUniform(b, store());
  const B = scene.bounds;
  const vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8];
  const px = ML.previewPx(vb);
  const area = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  const calloutArea = ML.calloutRoom(vb, px);
  return { scene, px, area, calloutArea, drawings: ML.layout(scene, { px, area, calloutArea }) };
}

function overlap(a, b){
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const CASES = [
  ['Class A, captain', build('blues_a', 'senior', 'Capt', { ribbons: rack, badges: badges(['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8']) })],
  ['Class A, master sergeant', build('blues_a', 'senior', 'MSgt', { ribbons: rack, badges: badges(['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8', 'stem_badges']) })],
  ['Class A, women, cadet', build('blues_a', 'cadet', 'C/SSgt', { gender: 'female', ribbons: rack, badges: badges(['emergency_services_badge', 'model_rocketry_badge', 'CAPPilot1_FA9D33EA587D8']), cord: 'wing' })],
  ['Class B, technical sergeant', build('blues_b', 'senior', 'TSgt', { ribbons: rack, badges: badges(['emergency_services_badge', 'model_rocketry_badge', 'CAPPilot1_FA9D33EA587D8']) })],
  ['Class B long sleeve', build('blues_b', 'senior', 'MSgt', { opt: { headgear: 'auto', sleeve: 'long' }, ribbons: rack })],
  ['OCP', build('ocp', 'senior', 'Maj', { badges: badges(['CAPPilot1_FA9D33EA587D8']) })],
  ['Corporate Field Uniform with ES patch', build('corporate_field', 'senior', 'Capt', { opt: { headgear: 'auto', esPatch: 'style-1' }, badges: badges(['CAPPilot1_FA9D33EA587D8']) })],
  ['Blazer, women', build('aviator_blazer', 'senior', 'Lt Col', { gender: 'female', badges: badges(['christian_chaplin']) })],
  ['Class A, cadet officer', build('blues_a', 'cadet', 'C/Col', { ribbons: rack, badges: badges(['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8']), cord: 'group' })],
  ['mess dress', build('mess_dress', 'senior', 'MSgt', { medals: rack.map(r => ({ key: r.key.replace('ribbon:', 'mini:'), title: r.title, ribbonAsset: r.asset, medal: 'medal-' + r.asset.slice(7) + '-miniature', devices: r.devices })), badges: badges(['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8']) })]
];

for(const [name, b] of CASES){
  test(`measurement labels sit clear on the ${name}`, async () => {
    const { scene, px, area, calloutArea, drawings } = await laidOut(b);
    assert.ok(drawings.length > 0, 'something is measured');
    const solids = ML.obstaclesOf(scene);
    const tol = (2 * px) ** 2;
    // A measure inside a cap view (the grade 1/2 in from the visor) belongs to that view: where the views stand
    // too close for a free side, its label lies on that view's own cloth (FIX-R-OTHER-r2 #6; D8: this test asked
    // every label to clear the view's box too). The grade and the name tape in it are still solids.
    const views = scene.layers.filter(l => (l.role === 'hat' || l.role === 'hat-view') && l.obstacle).map(l => l.obstacle);
    const ownerOf = d => {
      const m = scene.layers.find(l => l.type === 'measure' && l.key === d.key);
      if(!m) return null;
      const mid = { x: (m.from.x + m.to.x) / 2, y: (m.from.y + m.to.y) / 2 };
      return views.find(v => mid.x >= v.x && mid.x <= v.x + v.w && mid.y >= v.y && mid.y <= v.y + v.h) || null;
    };
    drawings.forEach((d, i) => {
      const L = d.label;
      const own = ownerOf(d);
      // The pills, like the callouts, may lie past the drawing's edge in the room made for them (LIVE13 E97: set off the cloth; frameFor grows the frame to hold them).
      assert.ok(overlap(L, calloutArea) > L.w * L.h - tol, `${L.text} label inside the room made for it`);
      for(const s of solids) if(s !== own) assert.ok(overlap(L, s) <= 4 * tol, `${L.text} label clear of a piece at ${s.x.toFixed(2)},${s.y.toFixed(2)}`);
      drawings.slice(i + 1).forEach(e => assert.equal(overlap(L, e.label), 0, `${L.text} and ${e.label.text} labels apart`));
    });
  });
}

test('the lapel insignia seam is measured halfway, below the seam, with its tick on the midpoint', async () => {
  const { scene, drawings } = await laidOut(CASES[0][1]);
  const seams = scene.layers.filter(l => l.type === 'measure' && l.label === 'halfway' && l.opts && l.opts.offsetOnly && l.opts.side.y > 0);
  assert.equal(seams.length, 2);
  for(const m of seams){
    const d = drawings.find(x => x.key === m.key);
    assert.ok(d.dim[0].y > m.from.y && d.dim[1].y > m.to.y, 'the dimension line is below the seam');
    assert.equal(d.ticks.length, 1);
  }
});

test('sleeve chevrons are measured halfway between the shoulder seam and the elbow, on the wearer\'s right flat sleeve beside the figure (SLEEVE-ENG)', async () => {
  const { scene } = await laidOut(CASES[1][1]);
  const m = scene.layers.find(l => l.type === 'measure' && l.label === 'halfway to elbow' && l.opts && l.opts.side && l.opts.side.x > 0);
  assert.ok(m, 'a halfway measure on the sleeve');
  const flat = scene.layers.find(l => l.role === 'sleeve-flat' && /-sleeve-flat-right$/.test(l.id));
  assert.ok(m.from.x > flat.x && m.from.x < flat.x + flat.w, 'on the flat sleeve, the wearer\'s right');
  const mid = m.opts.mid;
  const t = ((mid.x - m.from.x) * (m.to.x - m.from.x) + (mid.y - m.from.y) * (m.to.y - m.from.y)) / ((m.to.x - m.from.x) ** 2 + (m.to.y - m.from.y) ** 2);
  assert.ok(Math.abs(t - 0.5) < 0.05, `the chevron is halfway (${t.toFixed(3)})`);
});

test('the men\'s pocket badges are measured to their top edge, with no centre mark', async () => {
  const { scene, drawings } = await laidOut(CASES[0][1]);
  const m = scene.layers.find(l => l.type === 'measure' && l.label === '1½ in');
  const badge = scene.layers.filter(l => l.role === 'badge').find(l => Math.abs(l.x + l.w / 2 - m.to.x) < 0.01 && Math.abs(l.y - m.to.y) < 0.01);
  assert.ok(badge, 'the measure ends on a badge top');
  assert.equal(drawings.find(d => d.key === m.key).centres.length, 0);
});

// The 1/8 in of blue is a few pixels on the stage: its measure carries a magnified callout (4x inset, leader to the highlighted corner).
const EIGHTH_CASES = [
  ['OCP', build('ocp', 'senior', 'Capt', { badges: badges(['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge', 'senior_ground_team_badge', 'basic_incident_commander_badge']) })],
  ['ABU', build('abu', 'senior', 'Capt', { badges: badges(['CAPPilot1_FA9D33EA587D8']) })],
  ['Corporate Field Uniform', build('corporate_field', 'senior', 'Capt', { badges: badges(['CAPPilot1_FA9D33EA587D8']) })],
  ['corporate flight suit', build('corporate_flight_suit', 'senior', 'Col')]
];
for(const [name, b] of EIGHTH_CASES){
  test(`the 1/8 in measures on the ${name} carry a 4x callout, joined to the corner, clear of artwork and labels`, async () => {
    const { scene, px, area, calloutArea, drawings } = await laidOut(b);
    const eighths = drawings.filter(d => d.label.text === '⅛ in');
    assert.ok(eighths.length > 0, 'a 1/8 in measure is drawn');
    assert.ok(scene.layers.some(l => /^clear:drawn:/.test(l.key || '')), 'the sheet-drawn pieces are kept clear');
    const solids = ML.obstaclesOf(scene);
    for(const d of eighths){
      const co = d.callout;
      assert.ok(co, '1/8 in has a callout');
      assert.equal(co.mag, 4);
      assert.ok(co.hard, 'a place was found that covers no piece and crosses no label');
      assert.ok(Math.abs(co.r * 2 / px - ML.CALLOUT.diameter) < 1e-6, 'inset diameter');
      // The leader runs from the circle's rim to a point on the piece it measures, and the highlight starts there.
      const [rim, tip] = co.leader;
      assert.ok(Math.abs(Math.hypot(rim.x - co.center.x, rim.y - co.center.y) - co.r) < 1e-6, 'leader leaves the rim');
      const m = scene.layers.find(l => l.type === 'measure' && l.key === d.key);
      assert.ok(Math.hypot(tip.x - m.from.x, tip.y - m.from.y) < 3, 'leader ends at the measured piece');
      assert.ok(Math.hypot(co.real.lines[0][1].x - tip.x, co.real.lines[0][1].y - tip.y) < 1e-6 || co.kind === 'gap', 'the cut edge is outlined from the leader tip');
      // The inset and its caption cover no piece (the one it measures included) and no other label, and lie in the drawing.
      assert.ok(overlap(co.box, calloutArea) >= co.box.w * co.box.h - 1e-6, 'inset inside the room made for it');
      for(const s of solids) assert.ok(overlap(co.box, grow(s, -0.25 * px)) === 0, `inset clear of a piece at ${s.x.toFixed(2)},${s.y.toFixed(2)}`);
      for(const e of drawings) if(e !== d) assert.equal(overlap(co.box, e.label), 0, `inset clear of the ${e.label.text} label`);
      // ... nor any piece the garment sheet draws itself (flag, AUX, command patch / crest, tapes, sleeve pocket and loop outlines).
      for(const l of scene.layers.filter(l => /^clear:drawn:/.test(l.key || ''))) assert.ok(overlap(co.box, grow(l, -0.25 * px)) === 0, `inset and caption clear of the sheet's ${l.key.slice(12)}`);
      // The dimension line across the band is the band's width magnified 4x.
      const across = Math.hypot(d.dim[1].x - d.dim[0].x, d.dim[1].y - d.dim[0].y);
      assert.ok(Math.abs(across - 4 * co.border) < 1e-6, 'dimension line is the band at 4x');
    }
  });
}
function grow(r, e){ return { x: r.x - e, y: r.y - e, w: r.w + 2 * e, h: r.h + 2 * e }; }

// ---- LIVE6-3: the centre mark is an open crosshair, never a solid cross over the artwork ----
// Ethan, on the flight cap: "wtf is this fucking plus sign lmao". The '1½ in' cap-device measure ends at the device's centre; the mark
// there was a bare gold cross, which read as a plus on the insignia. It is now a thin ring with four ticks outside it, empty inside, on the
// labels' dark halo, and a dimension drawn on the line itself stops at the ring.
const R = require('../scripts/render-builds.cjs');
const CAP_BUILDS = [
  ['Class A, captain (officer flight cap device)', build('blues_a', 'senior', 'Capt')],
  ['Class B, senior master sergeant (senior NCO device)', build('blues_b', 'senior', 'SMSgt')],
  ['Class A, cadet major (cadet officer device)', build('blues_a', 'cadet', 'C/Maj')]
];
const segs = d => [d.dim, ...d.bars, ...d.ticks, ...d.ext];
function segDist(p, [a, b]){
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function checkMarks(d, px, tag){
  for(const mk of d.centres){
    assert.ok(mk.r > 0 && Math.abs(mk.r - ML.PX.mark.ring * px) < 1e-9, `${tag}: a ring`);
    assert.equal(mk.ticks.length, 4, `${tag}: four ticks`);
    for(const [p, q] of mk.ticks){
      const dp = Math.hypot(p.x - mk.x, p.y - mk.y), dq = Math.hypot(q.x - mk.x, q.y - mk.y);
      assert.ok(Math.min(dp, dq) > mk.r + 1e-9, `${tag}: a tick starts outside the ring (${(Math.min(dp, dq) / px).toFixed(1)} px, ring ${(mk.r / px).toFixed(1)})`);
    }
    // Nothing of this measure's drawing (its dimension line, bars, extension lines) enters the ring: the piece's own centre shows through.
    for(const s of segs(d)) assert.ok(segDist(mk, s) >= mk.r - 1e-9, `${tag}: the ring's inside is empty (a line comes ${(segDist(mk, s) / px).toFixed(2)} px from the centre)`);
  }
}
for(const [name, b] of CAP_BUILDS){
  test(`the flight cap's 1½ in measure ends in an open centre mark that leaves the device's own ink alone: ${name}`, async () => {
    const { scene, px, drawings } = await laidOut(b);
    const m = scene.layers.find(l => l.type === 'measure' && l.label === '1½ in' && l.opts && l.opts.center === 'to');
    assert.ok(m, 'the cap device measure is drawn');
    const d = drawings.find(x => x.key === m.key);
    assert.equal(d.label.text, '1½ in', 'the regulation value stays in the label');
    assert.equal(d.centres.length, 1);
    assert.ok(Math.hypot(d.centres[0].x - m.to.x, d.centres[0].y - m.to.y) < 1e-9, 'the mark is at the device centre');
    checkMarks(d, px, name);
    // The device's own ink under the mark: the mark draws only the ring (a stroke) and the four ticks; the ring's inside holds nothing,
    // so the device's centre, where its eagle or shield is, is untouched.
    const dev = scene.layers.find(l => l.role === 'hat-device');
    assert.ok(Math.abs(d.centres[0].x - (dev.x + dev.w / 2)) < 0.05 && Math.abs(d.centres[0].y - (dev.y + dev.h / 2)) < 0.05, 'centred on the device');
  });
}
test('every centre mark on the standard matrix is an open ring with its ticks outside it and nothing inside', async () => {
  const { builds } = R.matrix();
  let marks = 0;
  for(const { name, build: spec } of builds){
    const { drawings, px } = await laidOut(R.makeBuild(spec));
    for(const d of drawings){ marks += d.centres.length; checkMarks(d, px, `${name} ${d.label.text}`); }
  }
  assert.ok(marks > 0, 'the matrix draws centre marks');
});
test('the renderer draws a centre mark as an unfilled ring on the dark halo, with no solid cross segment', () => {
  global.document = { createElementNS: (ns, name) => { return { name, a: {}, kids: [], setAttribute(k, v){ this.a[k] = v; }, appendChild(c){ this.kids.push(c); return c; } }; } };
  const hadSelf = 'self' in global;
  if(!hadSelf) global.self = global;
  delete require.cache[require.resolve('../js/engine/render-svg.js')];
  require('../js/engine/render-svg.js');
  const RS = global.self.CAPUBEngine.renderSvg;
  const dr = { key: 'k', label: { text: '1½ in', x: 0, y: 0, w: 1, h: 0.3 }, dim: [{ x: 0, y: 0 }, { x: 1, y: 0 }], bars: [], ext: [], ticks: [],
    centres: [ML.centreMark({ x: 2, y: 2 }, 0.05)], reference: null };
  const [g] = RS.measureNodes([dr], 0.05, 11, null, null);
  const circles = g.kids.filter(n => n.name === 'circle');
  assert.ok(circles.length >= 2, 'a halo ring and a gold ring');
  for(const c of circles) assert.equal(c.a.fill, 'none', 'a ring is never filled');
  assert.ok(circles.some(c => c.a.stroke === '#0b1020'), 'the ring has the dark halo');
  const lines = g.kids.filter(n => n.name === 'line');
  // No line crosses the mark's centre: every segment the renderer draws stays outside the ring (the old cross ran through it).
  for(const l of lines){
    const a = { x: Number(l.a.x1), y: Number(l.a.y1) }, b = { x: Number(l.a.x2), y: Number(l.a.y2) };
    assert.ok(segDist({ x: 2, y: 2 }, [a, b]) >= dr.centres[0].r - 1e-6, 'no line enters the ring');
  }
  delete global.document;
  if(!hadSelf) delete global.self;
});

// ---- LIVE6-2: a label stays attached to its own dimension ----
// Ethan, on the women's Class A cadet NCO: "the 1/2 inch placement here doesnt make any sense". The two badges stacked above the ribbons
// are measured 1/2 in apart on the line between them; both sides of that line are badges, so the label was carried 2 label heights along
// the line's axis, to where the lapel's dashed seam line runs, and read as a measure of the lapel. LIVE13 E97 (Ethan: "these measurements
// need to be made clearer"): the pill is joined to its own dimension line by a leader, from the pill's rim to the middle of the line, or it
// touches the line (then it has none); it is never left to be read against another line. The witness lines stay perpendicular to the
// measured edges.
const lineMid = d => ({ x: (d.dim[0].x + d.dim[1].x) / 2, y: (d.dim[0].y + d.dim[1].y) / 2 });
function checkAttached(scene, drawings, tag){
  for(const d of drawings){
    if(d.callout) continue;   // the 1/8 in callouts (b750eb14, 0e4d69e7) have their own circle, caption and leader
    const m = scene.layers.find(l => l.type === 'measure' && l.key === d.key);
    const mid = lineMid(d), px = d.label.size / ML.PX.font;
    if(d.leader){
      assert.ok(Math.hypot(d.leader[1].x - mid.x, d.leader[1].y - mid.y) < 1e-6, `${tag}: '${d.label.text}' leader ends on the middle of its own dimension line`);
      const rim = ML.rimPoint(d.label, mid);
      assert.ok(Math.hypot(d.leader[0].x - rim.x, d.leader[0].y - rim.y) < 1e-6, `${tag}: '${d.label.text}' leader leaves the pill's rim toward the line`);
    }else{
      const dist = ML.pointBoxDistance(mid, d.label);
      assert.ok(dist <= 2.5 * px + 1e-9, `${tag}: '${d.label.text}' pill without a leader touches its line (${(dist / px).toFixed(1)} px off; ${m.from.x.toFixed(2)},${m.from.y.toFixed(2)} to ${m.to.x.toFixed(2)},${m.to.y.toFixed(2)})`);
    }
    assert.ok(Array.isArray(d.label.caption), `${tag}: '${d.label.text}' pill carries its caption lines`);
    // An offset line keeps perpendicular extension lines back to the measured edges (a tick on the dimension's own axis is not one).
    const u = { x: m.to.x - m.from.x, y: m.to.y - m.from.y }, ul = Math.hypot(u.x, u.y);
    for(const [p, q] of d.ext){
      const e = { x: q.x - p.x, y: q.y - p.y }, el = Math.hypot(e.x, e.y);
      if(el < 1e-9 || m.opts && m.opts.reference) continue;
      assert.ok(Math.abs((e.x * u.x + e.y * u.y) / (el * ul)) < 1e-6, `${tag}: '${d.label.text}' extension line is perpendicular to the measured edge`);
    }
  }
}
test('every pill of the standard matrix is joined to its own dimension line by a leader, or touches it', async () => {
  const { builds } = R.matrix();
  let n = 0;
  for(const { name, build: spec } of builds){
    const { scene, drawings } = await laidOut(R.makeBuild(spec));
    checkAttached(scene, drawings, name);
    n += drawings.length;
  }
  assert.ok(n > 100, `${n} labels checked`);
});
test('the stacked badges\' 1/2 in pills are each joined to their own line on the women\'s Class A cadet NCO, not left by the lapel seam', async () => {
  const b = R.makeBuild({ uniform: 'blues_a', gender: 'female', membership: 'cadet', rank: 'C/SSgt', badgeIds: ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge'],
    opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' }, ribbonSel: [['wright_brothers_award'], ['curry_achievement'], ['encampment_ribbon']] });
  const { scene, drawings } = await laidOut(b);
  const halves = scene.layers.filter(l => l.type === 'measure' && l.label === '½ in');
  assert.equal(halves.length, 2, 'wings to the badge below, that badge to the ribbons');
  checkAttached(scene, halves.map(m => drawings.find(x => x.key === m.key)), 'stacked badges');
  const dr = halves.map(m => drawings.find(x => x.key === m.key));
  assert.equal(overlap(dr[0].label, dr[1].label), 0, 'the two pills are apart');
  // Each pill says what its line measures (LIVE13 E97: a caption under the length).
  for(const d of dr) assert.ok(d.label.caption.join(' ').includes('badge'), `'${d.label.text}' pill names the badge it measures to: ${d.label.caption.join(' ')}`);
});

// ---- MEAS3: no dimension line, bar, tick, extension line or dashed reference crosses a piece ----
// Ethan, on the Class A cadet officer's lapel: the 'halfway' dimension line, its bars and the dashed seam were drawn straight across the CAP
// cutout letters: "this shouldn't overlap with each other." The lapel insignia are whole-sheet overlays whose pieces the scene does not box, so
// the overlay reads their landmark rectangles (lapelPieces); a line that would cross a piece moves out perpendicular to its direction (extension
// lines perpendicular to the measured edges, the label within one label height), and the dashed reference is drawn only where it crosses nothing.
async function laidOutWithPieces(b){
  const scene = await P.composeUniform(b, store());
  const st = store();
  await st.loadAll(scene.layers.filter(l => l.type === 'asset').map(l => l.id));
  const pieces = ML.lapelPieces(scene, id => (st.has(id) ? st.get(id).landmarks : null));
  const B = scene.bounds;
  const vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8];
  const px = ML.previewPx(vb);
  const drawings = ML.layout(scene, { px, area: { x: vb[0], y: vb[1], w: vb[2], h: vb[3] }, pieces });
  return { scene, px, drawings, pieces, solids: ML.obstaclesOf(scene).concat(pieces) };
}
function drawnSegments(d){
  const out = [d.dim, ...d.bars, ...d.ticks, ...d.ext, ...(d.referenceSegs || (d.reference ? [d.reference] : []))];
  return out;   // (a centre mark's ring and ticks mark the piece itself, over its centre: they are not dimension lines)
}
const SAMPLES = 20, TOL = 0.01;
function crossings(drawings, allSolids, tag, scene){
  const bad = [];
  // A measure inside a cap view belongs to it (the grade 1/2 in from the visor, the device 1 1/2 in from the front of the flight cap): the view's
  // own cloth is not a piece to that measure. Nor is a piece measured to its centre: the line runs into its centre mark's ring, as Figure 6.2
  // draws the flight cap's device (LIVE13 E97).
  const views = scene ? scene.layers.filter(l => l.role === 'hat' || l.role === 'hat-view').map(l => l.obstacle || core.layerBounds(l)) : [];
  const inside = (p, v) => p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h;
  for(const d of drawings){
    const m = scene && scene.layers.find(l => l.type === 'measure' && l.key === d.key);
    const mid = m && { x: (m.from.x + m.to.x) / 2, y: (m.from.y + m.to.y) / 2 };
    const own = mid && views.find(v => inside(mid, v));
    const o = (m && m.opts) || {};
    const centres = (o.center === 'both' || o.center === 'from' ? [m.from] : []).concat(o.center === 'both' || o.center === 'to' ? [m.to] : []);
    const solids = allSolids.filter(r => !(own && r.x === own.x && r.y === own.y && r.w === own.w && r.h === own.h) && !centres.some(p => inside(p, r)));
    if(d.callout){
      // The magnified inset keeps its circle and caption off every piece (checked above); the plain lines of other measures keep off it.
      continue;
    }
    for(const [a, b] of drawnSegments(d)) for(let i = 0; i <= SAMPLES; i++){
      const t = i / SAMPLES, p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const hit = solids.find(r => p.x > r.x + TOL && p.x < r.x + r.w - TOL && p.y > r.y + TOL && p.y < r.y + r.h - TOL);
      if(hit){ bad.push(`${tag}: '${d.label.text}' line crosses the piece at ${hit.x.toFixed(2)},${hit.y.toFixed(2)} ${hit.w.toFixed(2)}x${hit.h.toFixed(2)}`); break; }
    }
    // Nor does any line cross a 1/8 in callout's circle and caption.
    for(const e of drawings) if(e.callout) for(const [a, b] of drawnSegments(d)){
      const bx = e.callout.box;
      for(let i = 0; i <= SAMPLES; i++){
        const t = i / SAMPLES, p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if(p.x > bx.x && p.x < bx.x + bx.w && p.y > bx.y && p.y < bx.y + bx.h){ bad.push(`${tag}: '${d.label.text}' line crosses a 1/8 in callout`); break; }
      }
    }
  }
  return bad;
}
const LAPEL_BUILDS = [];
for(const gender of ['male', 'female']){
  for(const rank of ['C/Maj', 'C/Col']) LAPEL_BUILDS.push([`Class A cadet ${rank}, ${gender} (CAP cutouts)`, build('blues_a', 'cadet', rank, { gender, ribbons: rack, badges: badges(['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8']), cord: 'group' })]);
  LAPEL_BUILDS.push([`Class A senior Capt, ${gender} (US pins)`, build('blues_a', 'senior', 'Capt', { gender, ribbons: rack, badges: badges(['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8']) })]);
  LAPEL_BUILDS.push([`Class A senior MSgt, ${gender} (sleeve halfway)`, build('blues_a', 'senior', 'MSgt', { gender, ribbons: rack, badges: badges(['emergency_services_badge', 'CAPPilot1_FA9D33EA587D8', 'stem_badges']) })]);
}
for(const [name, b] of LAPEL_BUILDS){
  test(`MEAS3: no dimension, bar, tick, extension line or dashed reference crosses a piece: ${name}`, async () => {
    const { scene, drawings, pieces, solids } = await laidOutWithPieces(b);
    assert.ok(drawings.some(d => d.label.text === 'halfway' || d.label.text === 'halfway to elbow'), 'a halfway measure is drawn');
    if(/CAP cutouts|US pins/.test(name)) assert.ok(pieces.length >= 2, 'the lapel insignia are pieces the lines keep off');
    assert.deepEqual(crossings(drawings, solids, name, scene), []);
    checkAttached(scene, drawings, name);
  });
}
test('MEAS3: the lapel \'halfway\' dimension moves below the seam and keeps its dashed edge off the CAP cutouts', async () => {
  const { scene, drawings, pieces } = await laidOutWithPieces(LAPEL_BUILDS[0][1]);
  const seams = scene.layers.filter(l => l.type === 'measure' && l.label === 'halfway' && l.opts && l.opts.reference);
  assert.equal(seams.length, 2);
  for(const m of seams){
    const d = drawings.find(x => x.key === m.key);
    assert.ok(d.dim[0].y > m.from.y && d.dim[1].y > m.to.y, 'the dimension line is below the seam');
    assert.ok(d.referenceSegs.length >= 2, 'the dashed seam is cut where the letters lie');
    const lens = d.referenceSegs.reduce((s, [p, q]) => s + Math.hypot(q.x - p.x, q.y - p.y), 0);
    assert.ok(lens < Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y) - 1, 'part of the seam is not drawn');
    assert.equal(d.ticks.length, 1);
  }
  assert.ok(pieces.length >= 2);
});
test('MEAS3: every build of the standard matrix draws no line across a piece, a lapel pin or a callout', async () => {
  const { builds } = R.matrix();
  let n = 0, bad = [];
  for(const { name, build: spec } of builds){
    const r = await laidOutWithPieces(R.makeBuild(spec));
    bad.push(...crossings(r.drawings, r.solids, name, r.scene));
    n += r.drawings.length;
  }
  assert.ok(n > 100);
  assert.deepEqual(bad, []);
});
test('MEAS3: the stacked-badge build keeps its 1/2 in lines off the badges and its labels beside their lines', async () => {
  const b = R.makeBuild({ uniform: 'blues_a', gender: 'female', membership: 'cadet', rank: 'C/SSgt', badgeIds: ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge'],
    opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' }, ribbonSel: [['wright_brothers_award'], ['curry_achievement'], ['encampment_ribbon']] });
  const { scene, drawings, solids } = await laidOutWithPieces(b);
  assert.deepEqual(crossings(drawings, solids, 'stacked badges', scene), []);
  checkAttached(scene, drawings, 'stacked badges');
});

// ---- FIELD7-4: the magnified callouts lie outside the garment, the hats and the flat sleeves ----
// Ethan: "all magnifying glasses throughout the board shouldn't overlap with the uniform or hat, should be above or to the side." The circle and its
// caption are set off the cloth of the sheet (its footprint, GARMENT_FOOTPRINT) and off every hat view and sleeve flat; the leader line may cross cloth.
test('FIELD7-4: the footprint table in the engine is the one scripts/measure-garment-footprint.cjs makes from the sheets', () => {
  const t = require('../scripts/measure-garment-footprint.cjs').compute();
  assert.deepEqual(Object.keys(ML.GARMENT_FOOTPRINT).sort(), Object.keys(t).sort());
  for(const id of Object.keys(t)) assert.deepEqual(ML.GARMENT_FOOTPRINT[id], t[id], `${id}: regenerate GARMENT_FOOTPRINT (node scripts/measure-garment-footprint.cjs)`);
});

test('FIELD7-4: every garment sheet the matrix draws has a footprint', async () => {
  const RB = require('../scripts/render-builds.cjs');
  const seen = new Set();
  for(const b of RB.matrix().builds){
    const scene = await P.composeUniform(RB.makeBuild(b.build), store());
    scene.layers.filter(l => l.role === 'garment' && l.type === 'asset').forEach(l => seen.add(l.id));
  }
  for(const id of seen) assert.ok(ML.GARMENT_FOOTPRINT[id], `${id} has a footprint`);
});

test('FIELD7-4: on every build of the standard matrix, no callout circle or caption touches the garment\'s cloth, a hat view, a hat or a flat sleeve; all are placed clear of pieces and labels', async () => {
  const RB = require('../scripts/render-builds.cjs');
  let callouts = 0;
  for(const b of RB.matrix().builds){
    const scene = await P.composeUniform(RB.makeBuild(b.build), store());
    const B = scene.bounds, vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8], px = ML.previewPx(vb);
    const area = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] }, calloutArea = ML.calloutRoom(vb, px);
    const drawings = ML.layout(scene, { px, area, calloutArea });
    const cloth = ML.clothBoxes(scene);
    assert.ok(cloth.length > 0, `${b.name}: the sheet's cloth is known`);
    const views = scene.layers.filter(l => l.type !== 'measure' && ['hat', 'hat-view', 'sleeve-flat'].includes(l.role)).map(l => l.obstacle || core.layerBounds(l));
    for(const d of drawings.filter(x => x && x.callout)){
      callouts++;
      const co = d.callout;
      assert.ok(co.hard && co.offCloth, `${b.name} ${d.label.text}: placed off the cloth with the leader clear of pieces`);
      for(const c of cloth) assert.equal(overlap(co.box, c), 0, `${b.name} ${d.label.text}: callout over the cloth at ${c.x.toFixed(1)},${c.y.toFixed(1)}`);
      for(const v of views) assert.equal(overlap(co.box, v), 0, `${b.name} ${d.label.text}: callout over a hat or flat sleeve`);
      assert.ok(overlap(co.box, calloutArea) >= co.box.w * co.box.h - 1e-6, `${b.name}: inside the room made for it`);
      // The frame the renderer takes holds it.
      const fr = ML.frameFor(vb, drawings, px);
      assert.ok(co.box.x >= fr[0] - 1e-9 && co.box.y >= fr[1] - 1e-9 && co.box.x + co.box.w <= fr[0] + fr[2] + 1e-9 && co.box.y + co.box.h <= fr[1] + fr[3] + 1e-9, `${b.name}: inside the frame`);
    }
  }
  assert.ok(callouts >= 50, `${callouts} callouts checked`);
});
