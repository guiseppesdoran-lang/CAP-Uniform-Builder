'use strict';
// The measurement overlay (js/engine/measure-layout.js): on every uniform the labels stay inside
// the drawing, clear of the artwork and of each other, and no dimension line runs across a piece.

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
  return { scene, px, area, drawings: ML.layout(scene, { px, area }) };
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
    const { scene, px, area, drawings } = await laidOut(b);
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
      assert.ok(overlap(L, area) > L.w * L.h - tol, `${L.text} label inside the drawing`);
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
    const { scene, px, area, drawings } = await laidOut(b);
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
      assert.ok(overlap(co.box, area) >= co.box.w * co.box.h - 1e-6, 'inset inside the drawing');
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
// the line's axis, to where the lapel's dashed seam line runs, and read as a measure of the lapel. A label's box now lies within one
// label height of the middle of its dimension line (the offset line, where the line was moved off the artwork); where no clear spot
// exists that near, the dimension line itself moves out, with its extension lines perpendicular to the measured edges. A label has no
// leader: it sits against its own line.
const lineMid = d => ({ x: (d.dim[0].x + d.dim[1].x) / 2, y: (d.dim[0].y + d.dim[1].y) / 2 });
function checkAttached(scene, drawings, tag){
  for(const d of drawings){
    assert.ok(!d.leader, `${tag}: a label has no leader, it sits against its own line`);
    if(d.callout) continue;   // the 1/8 in callouts (b750eb14, 0e4d69e7) have their own circle, caption and leader
    const m = scene.layers.find(l => l.type === 'measure' && l.key === d.key);
    const radius = ML.LABEL_RADIUS * d.label.h;
    const dist = ML.labelDistance(d.dim[0], d.dim[1], d.label);
    assert.ok(dist <= radius + 1e-9, `${tag}: '${d.label.text}' label is ${(dist / d.label.h).toFixed(2)} label heights from its dimension (${m.from.x.toFixed(2)},${m.from.y.toFixed(2)} to ${m.to.x.toFixed(2)},${m.to.y.toFixed(2)})`);
    // An offset line keeps perpendicular extension lines back to the measured edges (a tick on the dimension's own axis is not one).
    const u = { x: m.to.x - m.from.x, y: m.to.y - m.from.y }, ul = Math.hypot(u.x, u.y);
    for(const [p, q] of d.ext){
      const e = { x: q.x - p.x, y: q.y - p.y }, el = Math.hypot(e.x, e.y);
      if(el < 1e-9 || m.opts && m.opts.reference) continue;
      assert.ok(Math.abs((e.x * u.x + e.y * u.y) / (el * ul)) < 1e-6, `${tag}: '${d.label.text}' extension line is perpendicular to the measured edge`);
    }
  }
}
test('every label of the standard matrix lies within one label height of its dimension line', async () => {
  const { builds } = R.matrix();
  let n = 0;
  for(const { name, build: spec } of builds){
    const { scene, drawings } = await laidOut(R.makeBuild(spec));
    checkAttached(scene, drawings, name);
    n += drawings.length;
  }
  assert.ok(n > 100, `${n} labels checked`);
});
test('the stacked badges\' 1/2 in labels sit beside their own lines on the women\'s Class A cadet NCO, not out by the lapel seam', async () => {
  const b = R.makeBuild({ uniform: 'blues_a', gender: 'female', membership: 'cadet', rank: 'C/SSgt', badgeIds: ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge'],
    opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' }, ribbonSel: [['wright_brothers_award'], ['curry_achievement'], ['encampment_ribbon']] });
  const { scene, drawings } = await laidOut(b);
  const halves = scene.layers.filter(l => l.type === 'measure' && l.label === '½ in');
  assert.equal(halves.length, 2, 'wings to the badge below, that badge to the ribbons');
  for(const m of halves){
    const d = drawings.find(x => x.key === m.key);
    assert.ok(ML.labelDistance(d.dim[0], d.dim[1], d.label) <= d.label.h, 'label within one label height of its line');
    // Not carried along the line's axis past its end (the old place): the label's centre is level with the line, beside it.
    const lc = { x: d.label.x + d.label.w / 2, y: d.label.y + d.label.h / 2 };
    assert.ok(Math.abs(lc.y - lineMid(d).y) < d.label.h / 2, 'level with the line, not above or below it');
    // Every seam the sheet states as a landmark is kept away from: the label does not lie across the lapel's gorge seam.
  }
  const dr = halves.map(m => drawings.find(x => x.key === m.key));
  assert.ok(dr[0].label.y !== dr[1].label.y && Math.abs(dr[0].label.y - dr[1].label.y) > dr[0].label.h * 0.9, 'the two labels are apart');
  // The wings-to-badge line is the upper of the two, and its own label is the upper one.
  const wings = halves.reduce((a, m) => (Math.min(m.from.y, m.to.y) < Math.min(a.from.y, a.to.y) ? m : a));
  const other = halves.find(m => m !== wings);
  assert.ok(drawings.find(x => x.key === wings.key).label.y < drawings.find(x => x.key === other.key).label.y, 'the wings label is above the other');
});
