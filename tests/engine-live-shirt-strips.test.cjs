'use strict';
// LIVE10-MASTER-2 (Ethan, on the Class B shoulder where the slide-on sleeve covered the drawn strap as a face-on polygon, LIVE9-1): "seriously? those epaulets are supposed to
// be the same as the ones above. make them do the same thing as the class a's, on top and kind of flat, and make sure to include the CAP." The shirts' epaulet sleeves (Class B
// shirt and blouse, the aviator shirts, the overblouse, the shirt beside the blazer) are seen the way the Class A coat's boards are: an edge-on strip on the strap axis read from
// the sheet's epaulet_<side> landmark (CAPR 39-1 4.1.6.1.1, 4.1.6.1.4, 4.2.5.1.1.1, 4.2.6.2.1, Figs 4.8, 4.16, A5-1, A5-6; DAFI 36-2903 4.5.1.1.1). The rules:
//   - the strip is the sleeve art (gray, or blue for cadet officers) squeezed across the strap to its thickness, along the strap's own axis;
//   - its outer end is flush with the strap's outer end, its upper edge lies on the shoulder line (the strap's upper boundary) on average;
//   - its thickness is the sheet's epaulet_axis.edge_thickness_in when the sheet states it (per side or for both; the art-round-10 sheets state 0.46 in on all ten), else 0.5 in, the Class A boards' strip;
//   - it lies on the sheet's own strap band (the epaulet_<side> polygon, the 0.46 in edge-on band with its point and button at the collar end): its four corners are within 0.02 in of
//     that polygon's outline, its outer end on the band's outer end and its inner end across the band short of the point and the button;
//   - the grade is foreshortened along the strip as the Class A strip's is (squeezed across it to the thickness less 0.08 in, true size along it), 5/8 in from the outer end;
//   - the CAP lettering of the sleeve is on the strip at its collar end (the art's cap group is not hidden, its place is the art's cap_center on the squeezed strip);
//   - the strip covers neither the strap's point nor its button; the top view beside the figure is the sleeve at its true size, level, as before.
// Sheets that state no edge thickness would draw the strap face-on, so the strip would lie on its upper edge (the fallback, tested on a faked sheet); the real sheets state it.

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
const store = core.createSpecStore(manifest, p => Promise.resolve(loadRaw(p)));
const svgOf = id => fs.readFileSync(path.join(ROOT, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');

// A store whose garment sheets state epaulet_axis.edge_thickness_in, the way the redrawn sheets do: `form` 'both' puts it on the landmark itself, 'side' on each side's entry.
const storeStating = (thick, form) => core.createSpecStore(manifest, p => {
  const raw = loadRaw(p);
  if(raw.landmarks && raw.landmarks.epaulet_right && !/-(epaulet|cord|tie|collar|nametag|sleeve|general)/.test(p)){
    const ax = Object.assign({}, raw.landmarks.epaulet_axis || {});
    if(form === 'both'){ ax.edge_thickness_in = thick; for(const side of ['right', 'left']) if(ax[side]){ ax[side] = Object.assign({}, ax[side]); delete ax[side].edge_thickness_in; } }
    else for(const side of ['right', 'left']) ax[side] = Object.assign({}, ax[side] || {}, { edge_thickness_in: thick });
    raw.landmarks = Object.assign({}, raw.landmarks, { epaulet_axis: ax });
  }
  return Promise.resolve(raw);
});

const CASES = [];
for(const gender of ['male', 'female']){
  for(const sleeve of ['short', 'long']){
    CASES.push({ name: `Class B ${gender} ${sleeve}`, uniform: 'blues_b', gender, sleeve });
    CASES.push({ name: `aviator shirt ${gender} ${sleeve}`, uniform: 'aviator', gender, sleeve });
  }
}
const OVERBLOUSE = [
  { name: 'overblouse', uniform: 'aviator', gender: 'female', sleeve: 'short', opt: { femaleTop: 'overblouse' } },
  { name: 'overblouse long', uniform: 'aviator', gender: 'female', sleeve: 'long', opt: { femaleTop: 'overblouse' } }
];
const MEMBERS = [['senior', '2d Lt', 'gray'], ['senior', 'Capt', 'gray'], ['senior', 'Col', 'gray'], ['senior', 'Brig Gen', 'gray'], ['cadet', 'C/2d Lt', 'blue'], ['cadet', 'C/Lt Col', 'blue'], ['cadet', 'C/Col', 'blue']];

const compose = (c, membership, rank, st) => P.composeUniform(HARNESS.makeBuild({
  uniform: c.uniform, gender: c.gender, membership, rank, opt: Object.assign({ sleeve: c.sleeve, headgear: 'none' }, c.opt || {})
}), st || store);

// ---- small geometry ----
const inside = (poly, p) => { let c = false; for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
const segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
const outlineDist = (poly, p) => Math.min(...poly.map((a, i) => segDist(p, a, poly[(i + 1) % poly.length])));
const corners = l => { const o = l.origin || { x: l.x, y: l.y }; return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, o, l.rotate || 0)); };

// The strap's button as the sheet draws it: the first circle after the strap's own group in the sheet's svg, through the art group's translate and scale.
function buttonOf(garment, side){
  const svg = svgOf(garment);
  const t = svg.match(/__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/);
  assert.ok(t, garment + ': the art group states its translate and scale');
  const at = svg.indexOf(`__epaulet-${side}"`);
  assert.ok(at > 0, `${garment}: epaulet-${side} group`);
  const m = svg.slice(at).match(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/);
  assert.ok(m, `${garment}: a button circle after epaulet-${side}`);
  const [tx, ty, k] = [Number(t[1]), Number(t[2]), Number(t[3])];
  return { x: (tx + k * Number(m[1])) / 100, y: (ty + k * Number(m[2])) / 100, r: k * Number(m[3]) / 100 };
}

// What the strip must be on one shoulder: checks every rule above against the scene.
async function checkStrip(scene, sheet, side, tag, rank, cloth, thickWanted, st){
  // What the sheet states: per side, else for both, else the 0.5 in fallback.
  const ax = sheet.raw.landmarks.epaulet_axis || {};
  const stated = ax[side] && ax[side].edge_thickness_in != null ? ax[side].edge_thickness_in : ax.edge_thickness_in;
  const thick = stated != null ? stated : 0.5;
  if(thickWanted != null) assert.equal(thick, thickWanted, `${tag}: the sheet states ${stated}`);
  const strip = scene.layers.find(l => l.key === `epaulet:${side}`);
  assert.ok(strip && strip.type === 'asset', `${tag}: the edge-on strip is drawn`);
  assert.ok(!scene.layers.some(l => /-epaulet-sleeve-(officer|cadet-officer)$/.test(l.id || '')), `${tag}: the sheet's own strip overlay is unused`);
  assert.ok(!scene.layers.some(l => l.key === `epaulet:${side}` && l.type === 'polygon'), `${tag}: no face-on polygon over the strap`);
  const sleeve = await st.load(strip.id);
  assert.equal(strip.id, scene.layers.find(l => l.key === `epaulet-top:${side}`).id, `${tag}: the strip and the view from above are one sleeve`);
  assert.equal(sleeve.raw.colours[cloth], cloth === 'gray' ? '#5f5c5c' : '#142347', `${tag}: the sleeve art's cloth`);

  const strap = sheet.landmarks[`epaulet_${side}`].points, curved = strap.length > 8;
  // The strap's frame: the sheet's own statement of the band (epaulet_axis p1 outer end, p2 collar end) when it states one with a thickness, else the polygon's rectangle fit.
  const fr = P.helpers.frameFromPolygon({ base: { w: sheet.w } }, side, strap);
  if(ax[side] && ax[side].p1 && (ax[side].edge_thickness_in != null || ax.edge_thickness_in != null)){
    const o = { x: ax[side].p1[0] / 100, y: ax[side].p1[1] / 100 }, n = { x: ax[side].p2[0] / 100, y: ax[side].p2[1] / 100 }, L = Math.hypot(n.x - o.x, n.y - o.y);
    const axis = { x: (n.x - o.x) / L, y: (n.y - o.y) / L };
    let normal = { x: axis.y, y: -axis.x }; if(normal.y > 0) normal = { x: -normal.x, y: -normal.y };
    Object.assign(fr, { axis, normal, outer: o, neck: n, length: L });
  }
  const along = p => (p.x - fr.outer.x) * fr.axis.x + (p.y - fr.outer.y) * fr.axis.y;
  const across = p => (p.x - fr.outer.x) * fr.normal.x + (p.y - fr.outer.y) * fr.normal.y;

  // On the strap axis: the strip's long axis is the strap's, and it is T thick (what the sheet states, else 0.5 in).
  const box = corners(strip);
  const a = along, ends = box.map(a), lo = Math.min(...ends), hi = Math.max(...ends);
  const cs = box.map(across), thk = strip.w, len = strip.h;   // the layer's own size: the squeezed art (a curved band's strip is tilted to the band's own line, off the chord frame by a degree or two)
  assert.ok(Math.abs(thk - thick) < 0.02, `${tag}: the strip is ${thk.toFixed(3)} in thick (want ${thick})`);
  assert.ok(Math.abs((hi - lo) - strip.h) < (curved ? 0.15 : 0.02), `${tag}: the strip runs along the strap axis (${(hi - lo).toFixed(3)} against its length ${strip.h.toFixed(3)})`);
  // The sleeve's own length (3.84 in) over at most 82% of the strap's length.
  assert.ok(Math.abs(len - Math.min(sleeve.h, fr.length * 0.82)) < 0.02, `${tag}: the strip is the sleeve's length, ${len.toFixed(3)} in, within 82% of the strap`);
  // Outer end flush with the strap's outer end.
  assert.ok(Math.abs(lo) < 0.02, `${tag}: the strip's outer end is ${lo.toFixed(3)} in from the strap's outer end (flush)`);
  // Upper edge on the shoulder line: the strap's top boundary at the strip's x, on average.
  const upperA = box.filter(q => across(q) > Math.min(...cs) + thick / 2);
  assert.equal(upperA.length, 2, `${tag}: two upper corners`);
  const xs = strap.map(p => p.x);
  const lo2 = Math.max(Math.min(upperA[0].x, upperA[1].x), Math.min(...xs)), hi2 = Math.min(Math.max(upperA[0].x, upperA[1].x), Math.max(...xs));
  let sum = 0, n = 0;
  for(let i = 0; i <= 40; i++){
    const x = lo2 + (hi2 - lo2) * i / 40, top = P.helpers.polygonTopY(strap, x);
    if(top == null) continue;
    const t = (x - upperA[0].x) / ((upperA[1].x - upperA[0].x) || 1), y = upperA[0].y + (upperA[1].y - upperA[0].y) * t;
    sum += top - y; n++;
  }
  assert.ok(n > 5, `${tag}: the strip overlaps the strap's top boundary`);
  assert.ok(Math.abs(sum / n) < (thickWanted == null && curved ? 0.15 : thickWanted == null ? 0.03 : curved ? 0.25 : 0.12), `${tag}: the strip's upper edge lies ${(sum / n).toFixed(3)} in above the shoulder line on average (on it)`);

  // On the sheet's own band (not on a faked sheet whose stated thickness differs from the band it still draws): the strip's corners are on the epaulet_<side> polygon's outline (outer corners at its outer end, inner corners on its long edges), within 0.02 in.
  // The inner corners (on the band's long edges) within 0.02 in; the outer corners within 0.04 in (the sheet cuts the band's outer end 6.7 degrees off square, the sleeve's end is square); the
  // overblouse's band follows the curved shoulder, which a straight strip meets within 0.15 in.
  const tolIn = curved ? 0.15 : 0.02, tolOut = curved ? 0.15 : 0.04;
  if(thickWanted == null) for(const q of box) assert.ok(outlineDist(strap, q) <= (along(q) < (lo + hi) / 2 ? tolOut : tolIn), `${tag}: the strip's corner (${q.x.toFixed(2)}, ${q.y.toFixed(2)}) is ${outlineDist(strap, q).toFixed(3)} in from the sheet's band`);
  // Over the strip's length the band shows neither above nor below it: the band's width across the axis at each point along the strip is the strip's (within 0.02 in).
  if(thickWanted == null){
    // Along the strip's own centre line (its layer's turn: the art's collar end up, turned), at eleven stations: how far the sheet's band reaches either side of that line.
    const r = (strip.rotate || 0) * Math.PI / 180, dirS = { x: Math.sin(r), y: -Math.cos(r) }, nrmS = { x: Math.cos(r), y: Math.sin(r) };
    for(let i = 0; i <= 10; i++){
      const t = -strip.h / 2 + strip.h * (0.02 + 0.96 * i / 10), base = { x: strip.origin.x + dirS.x * t, y: strip.origin.y + dirS.y * t };
      const probe = sgn => { let v = 0; while(v < 1.5 && inside(strap, { x: base.x + nrmS.x * sgn * (v + 0.005), y: base.y + nrmS.y * sgn * (v + 0.005) })) v += 0.005; return v; };
      const bandWidth = probe(1) + probe(-1);
      assert.ok(Math.abs(bandWidth - thick) < (curved ? 0.07 : 0.03), `${tag}: the band is ${bandWidth.toFixed(3)} in across at station ${i} of the strip, the strip is ${thick} in: the band shows past the strip`);
    }
  }
  // The CAP lettering is on the strip, at its collar end, and the grade stands 5/8 in from the outer end clear of it.
  assert.ok(!(strip.hideGroups || []).includes('cap'), `${tag}: the sleeve's CAP lettering is not hidden`);
  assert.deepEqual(strip.hideGroups, ['grade', 'star1', 'star2', 'star3'], `${tag}: only the art's own grade, in whichever group the sleeve draws it (LIVE11-1), is left off (it is drawn foreshortened)`);
  const capAnchor = sleeve.anchors.cap_center, kLen = strip.h / sleeve.h;
  const capAlong = len - capAnchor.y * kLen;       // the art's top is the collar end
  assert.ok(capAlong > len / 2 && capAlong < len, `${tag}: the CAP lettering is at the collar end (${capAlong.toFixed(2)} of ${len.toFixed(2)} in)`);
  assert.ok(sleeve.raw.dimensions.cap_word_h_in * kLen < len * 0.2, `${tag}: the CAP lettering is a word on the strip, not the strip`);
  {
    const grade = scene.layers.find(l => l.key === `grade:edge-${side}`);
    if(grade){
      const gc = core.rotatePoint({ x: grade.x + grade.w / 2, y: grade.y + grade.h / 2 }, grade.origin, grade.rotate || 0);
      const gs = await st.load(grade.id);
      assert.ok(inside(box, gc), `${tag}: the grade is on the strip`);
      const quarter = /^(second-lieutenant|first-lieutenant|captain|flight-officer)/.test(grade.id.replace(/^rank-(senior|cadet-officer)-/, '')) && cloth === 'gray';
      const gAlong = along(gc), gHalf = (quarter ? gs.w : gs.h) / 2;
      assert.ok(Math.abs((gAlong - gHalf) - 0.625) < 0.03, `${tag}: the grade's outer edge is ${(gAlong - gHalf).toFixed(3)} in from the strip's end (5/8 in)`);
      assert.ok(gAlong + gHalf < capAlong - (sleeve.raw.dimensions.cap_word_h_in * kLen) / 2 + 0.05, `${tag}: the grade does not run onto the CAP lettering`);
      // Foreshortened as the Class A strip's grade: squeezed across the strip to its thickness less 0.08 in (never widened), true size along it.
      const gb = corners(grade), gAcross = Math.max(...gb.map(across)) - Math.min(...gb.map(across));
      assert.ok(gAcross <= thick - 0.08 + 0.02, `${tag}: the grade is ${gAcross.toFixed(3)} in across the ${thick} in strip`);
      for(const q of gb) assert.ok(inside(box, q) || outlineDist(box, q) < 0.02, `${tag}: the grade lies inside the strip`);
    }
  }

  // Neither the point nor the button of the strap under it is covered.
  const tip = strap.reduce((best, q) => along(q) > along(best) ? q : best, strap[0]);
  assert.ok(!inside(box, tip), `${tag}: the strap's tip is not covered`);
  const b = buttonOf(scene.garment, side);
  assert.ok(!inside(box, b), `${tag}: the strap's button is not covered`);
  assert.ok(Math.max(...ends) <= along(tip) + 1e-6, `${tag}: the strip ends before the strap's tip`);
  return { strip, box, len };
}

for(const c of [...CASES, ...OVERBLOUSE]){
  for(const [membership, rank, cloth] of MEMBERS){
    test(`${c.name}, ${rank}: the epaulet is an edge-on strip on the strap axis with the grade and the CAP on it (LIVE10-2)`, async () => {
      const scene = await compose(c, membership, rank);
      const sheet = await store.load(scene.garment);
      for(const side of ['right', 'left']) await checkStrip(scene, sheet, side, `${c.name} ${rank} ${side}`, rank, cloth, null, store);
    });
  }
}

for(const form of ['both', 'side']){
  for(const c of [CASES[0], CASES[1], CASES[3], CASES[6], OVERBLOUSE[0]]){
    test(`${c.name}: a sheet that states epaulet_axis.edge_thickness_in (${form === 'both' ? 'for both sides' : 'per side'}) sets the strip's thickness to it`, async () => {
      const st = storeStating(0.3, form);
      for(const [membership, rank, cloth] of [MEMBERS[1], MEMBERS[5]]){
        const scene = await compose(c, membership, rank, st);
        const sheet = await st.load(scene.garment);
        for(const side of ['right', 'left']) await checkStrip(scene, sheet, side, `${c.name} ${rank} ${side} (0.30)`, rank, cloth, 0.3, st);
      }
    });
  }
}

test('the view from above beside each shoulder is unchanged: the sleeve at its true size, level, carrying the grade and the CAP', async () => {
  for(const c of [CASES[0], CASES[1], OVERBLOUSE[0]]){
    const scene = await compose(c, 'senior', 'Capt');
    for(const side of ['right', 'left']){
      const top = scene.layers.find(l => l.key === `epaulet-top:${side}`);
      const s = await store.load(top.id);
      assert.ok(top && Math.abs(top.w - s.w) < 1e-6 && Math.abs(top.h - s.h) < 1e-6, `${c.name} ${side}: the view is the sleeve at true size`);
      assert.ok(!top.hideGroups, `${c.name} ${side}: the grade and the CAP lettering show on it`);
      assert.equal(Math.abs(top.rotate), 90, `${c.name} ${side}: level`);
    }
  }
});

test('the shirt beside the blazer draws the same strip', async () => {
  const scene = await P.composeUniform(HARNESS.makeBuild({ uniform: 'aviator_blazer', gender: 'male', membership: 'senior', rank: 'Maj' }), store);
  const strips = scene.layers.filter(l => l.role === 'epaulet');
  assert.equal(strips.length, 2);
  assert.ok(strips.every(l => l.type === 'asset' && l.figure === 2 && !(l.hideGroups || []).includes('cap')));
  assert.equal(scene.layers.filter(l => /^grade:edge-/.test(l.key || '')).length, 2);
});

test('NCOs and members with no grade: the engine draws no sleeve and no strip (the sheet\'s own band shows)', async () => {
  for(const uniform of ['blues_b', 'aviator']){
    const scene = await P.composeUniform(HARNESS.makeBuild({ uniform, gender: 'male', membership: 'senior', rank: 'MSgt' }), store);
    assert.equal(scene.layers.filter(l => l.role === 'epaulet').length, 0, uniform);
    assert.equal(scene.layers.filter(l => /^grade:edge-/.test(l.key || '')).length, 0, uniform);
  }
});

test('the Class A officers\' strip carries the sleeve\'s CAP lettering too, at its collar end under the shading, and the cadet officers\' board strip carries the board\'s crest (LIVE10-2, B3)', async () => {
  for(const gender of ['male', 'female']){
    for(const [membership, rank] of [['senior', 'Capt'], ['senior', 'Col'], ['senior', 'Brig Gen']]){
      const scene = await P.composeUniform(HARNESS.makeBuild({ uniform: 'blues_a', gender, membership, rank, opt: { headgear: 'none' } }), store);
      for(const side of ['right', 'left']){
        const cap = scene.layers.find(l => l.key === `epaulet-cap:${side}`);
        assert.ok(cap && cap.type === 'asset', `${gender} ${rank} ${side}: the CAP lettering is on the strip`);
        assert.deepEqual(cap.onlyGroups, ['cap'], 'only the lettering of the sleeve art is drawn');
        const shade = scene.layers.find(l => l.key === `epaulet-shade:light:${side}`), grade = scene.layers.find(l => l.key === `grade:edge-${side}`);
        assert.ok(cap.z < shade.z, `${gender} ${rank} ${side}: under the shading bands`);
        // The lettering is at the strip's collar end: the art's cap_center, counted from the art's top (the collar end), turned with the strip; the grade is far from it.
        const sleeve = await store.load(cap.id), k = cap.h / sleeve.h, r = (cap.rotate || 0) * Math.PI / 180;
        const up = { x: Math.sin(r), y: -Math.cos(r) };
        const lettering = { x: cap.origin.x + up.x * (cap.h / 2 - sleeve.anchors.cap_center.y * k), y: cap.origin.y + up.y * (cap.h / 2 - sleeve.anchors.cap_center.y * k) };
        assert.ok(inside(corners(cap), lettering), `${gender} ${rank} ${side}: the lettering lies on the strip`);
        const gc = core.rotatePoint({ x: grade.x + grade.w / 2, y: grade.y + grade.h / 2 }, grade.origin, grade.rotate || 0);
        assert.ok(Math.hypot(gc.x - lettering.x, gc.y - lettering.y) > 0.4, `${gender} ${rank} ${side}: the grade and the lettering are apart`);
      }
    }
    const cadet = await P.composeUniform(HARNESS.makeBuild({ uniform: 'blues_a', gender, membership: 'cadet', rank: 'C/Lt Col', opt: { headgear: 'none' } }), store);
    for(const side of ['right', 'left']){
      const strip = cadet.layers.find(l => l.key === `epaulet:${side}`);
      assert.ok(strip && /^garment-blues-shoulder-board-top-/.test(strip.id) && !strip.hideGroups && !strip.onlyGroups, `${gender} ${side}: the whole board, with its crest, is the strip`);
    }
  }
});

// LIVE11-1 (Ethan, on the aviator shirt with a Major General: "theres 4 stars here"): the Brigadier and Major General sleeves draw their stars as groups star1 / star2, with no
// `grade` group, so hiding `grade` left them on the strip beside the grade the engine draws. For every sleeve asset the groups left visible once the grade groups are hidden are cloth,
// the lace edge and the CAP lettering only.
test('every epaulet sleeve asset: hiding the grade groups leaves only the cloth, the lace edge and the CAP lettering visible (LIVE11-1)', () => {
  const HIDDEN = ['grade', 'star1', 'star2', 'star3'];
  const sleeves = manifest.assets.filter(a => /^rank-epaulet-sleeve-/.test(a.id));
  assert.ok(sleeves.length >= 19, 'the sleeve assets are in the manifest');
  for(const a of sleeves){
    const svg = fs.readFileSync(path.join(ROOT, 'images', a.path), 'utf8');
    // The top-level groups of the art, by their suffix after `<asset>__`.
    const tops = []; let depth = 0;
    for(const m of svg.matchAll(/<(\/?)g\b([^>]*?)(\/?)>/g)){
      if(m[1]){ depth--; continue; }
      const id = /\bid="([^"]*)"/.exec(m[2]);
      if(depth === 0 && id) tops.push(id[1].replace(a.id + '__', ''));
      if(!m[3]) depth++;
    }
    const visible = tops.filter(n => !HIDDEN.includes(n));
    for(const n of visible) assert.ok(['cloth', 'lace__edge', 'cap'].includes(n), `${a.id}: the group ${n} stays visible with the grade hidden`);
    assert.ok(visible.includes('cloth') && visible.includes('cap'), `${a.id}: cloth and CAP remain`);
  }
});

test('Major and Brigadier General on the shirts: the strip hides the art\'s own stars and carries one drawn grade (LIVE11-1)', async () => {
  for(const c of [CASES[0], CASES[3], CASES[1]]){
    for(const rank of ['Maj Gen', 'Brig Gen']){
      const scene = await compose(c, 'senior', rank);
      for(const side of ['right', 'left']){
        const strip = scene.layers.find(l => l.key === `epaulet:${side}`);
        assert.ok(strip.hideGroups.includes('star1') && strip.hideGroups.includes('star2'), `${c.name} ${rank} ${side}`);
        assert.equal(scene.layers.filter(l => l.key === `grade:edge-${side}`).length, 1);
      }
    }
  }
});
