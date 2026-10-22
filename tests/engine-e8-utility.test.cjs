'use strict';
// E8-UTILITY: the OCP, ABU and Corporate Field Uniform (ICL 25-06 chapter 7, CAPR 39-1 5.1.1 and 5.2.1),
// measured in inches on the composed scene: the sleeve patches show in the flat sleeve view and in
// the edge view on the coat, the graduated commander's insignia rests on the loop that shows, no
// grade piece is mounted anywhere but the chest square and the caps, and the measurement overlay
// lists every distance the engine used.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const C = require('../js/engine/compose.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const ST = store();
const EPS = 0.01;

const OCP = 'garment-ocp-coat-abu-cut';
const UNIT = { id: 'sequoyah_cadet_squadron_patch', title: 'Unit', href: 'images/patches/sequoyah_cadet_squadron_patch.webp', aspect: 1, slot: 'R_SHOULDER', kind: 'unit' };
const WING = { id: 'nywg_patch', title: 'Wing', href: 'images/patches/nywg_patch.webp', aspect: 1, slot: 'L_SHOULDER', kind: 'general' };
const PILOT = { id: 'CAPPilot1_FA9D33EA587D8', title: 'Pilot Badge' };
const GT = { id: 'ground_team_basic_badge', title: 'Ground Team Badge' };
const PIN = { id: 'squadron_commander_badge', title: 'Squadron Commander Badge', graduated: true };

function build(uniform, membership, rank, extra){
  const b = Object.assign({
    uniform, gender: 'male', grade: G.gradeInfo(membership, rank, {}),
    opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
  return b;
}

const measures = scene => scene.layers.filter(l => l.type === 'measure');
const len = m => Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y);

async function rectOf(name, garment){
  const spec = await ST.load(garment || OCP);
  return core.landmarkBounds(spec, name);
}

// The sheet's own edge view of the right/left shoulder pocket, read from the artwork: the flag patch
// rect inside the pocket's edge group and the group's turn about its centre (scene inches).
function sheetEdgeView(side){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', OCP + '.svg'), 'utf8');
  const group = new RegExp(`<g id="${OCP}__sleeve-pocket-edge-${side}" transform="rotate\\(([-\\d.]+) ([-\\d.]+) ([-\\d.]+)\\)">`).exec(svg);
  assert.ok(group, `edge group on the ${side} sleeve`);
  const flagAt = svg.indexOf(`id="${OCP}__patch-${side === 'right' ? 'flag' : 'aux'}-edge-${side}"`);
  assert.ok(flagAt > 0, 'edge patch group');
  const rect = /<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(svg.slice(flagAt));
  // The sheet's art group is translate(top_center.x, centerline_top.y) scale(100).
  const art = /<g id="[^"]*__art" transform="translate\(([\d.]+) ([\d.]+)\) scale\(100\)">/.exec(svg);
  const ox = Number(art[1]) / 100, oy = Number(art[2]) / 100;
  const pivot = { x: ox + Number(group[2]), y: oy + Number(group[3]) };
  const r = { x: ox + Number(rect[1]), y: oy + Number(rect[2]), w: Number(rect[3]), h: Number(rect[4]) };
  return { tilt: Number(group[1]), pivot, flag: r, flagCenter: core.rotatePoint({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, pivot, Number(group[1])) };
}

// ---- D22: the patch shows on both sleeve views and the coat ----------------------------------------

test('OCP: the unit and higher headquarters patches show in the flat sleeve view and in the edge view on the coat (7.1.1.4.1.2, 7.1.1.4.2.1)', async () => {
  const scene = await P.composeUniform(build('ocp', 'senior', 'Capt', { patches: [UNIT, WING] }), store());
  for(const [p, slot, side, drawn] of [[UNIT, 'R_SHOULDER', 'right', 'patch_flag_right'], [WING, 'L_SHOULDER', 'left', 'patch_aux_left']]){
    const flat = scene.layers.find(l => l.key === `patch:${p.id}:${slot}:0`);
    const edge = scene.layers.find(l => l.key === `patch:${p.id}:${slot}:edge`);
    assert.ok(flat, `${p.title}: flat sleeve view`);
    assert.ok(edge, `${p.title}: edge view on the coat`);
    assert.equal(edge.role, 'patch');
    assert.equal(edge.href, flat.href);
    // The same patch, seen narrowed to half its width and as tall.
    assert.ok(Math.abs(edge.w - flat.w * 0.5) < EPS && Math.abs(edge.h - flat.h) < EPS, `${p.title}: edge view is the flat one narrowed to half`);
    assert.equal(edge.fit, 'stretch');

    // Where the sheet draws the flag/AUX patch in the edge view, this patch sits under it with the same
    // offset the flat view has, narrowed and turned the way the sheet turns its pocket.
    const sheet = sheetEdgeView(side);
    assert.ok(Math.abs(edge.rotate - sheet.tilt) < 1e-6, `${p.title}: turned ${sheet.tilt} deg like the sheet's pocket`);
    const drawnFlat = await rectOf(drawn);
    const dx = flat.x + flat.w / 2 - (drawnFlat.x + drawnFlat.w / 2), dy = flat.y + flat.h / 2 - (drawnFlat.y + drawnFlat.h / 2);
    const want = core.rotatePoint({ x: sheet.flag.x + sheet.flag.w / 2 + dx * 0.5, y: sheet.flag.y + sheet.flag.h / 2 + dy }, sheet.pivot, sheet.tilt);
    // the raster is turned about its own centre, so its origin is its centre in the turned view
    assert.ok(Math.abs(edge.origin.x - want.x) < 0.02 && Math.abs(edge.origin.y - want.y) < 0.02, `${p.title}: edge centre (${edge.origin.x.toFixed(3)}, ${edge.origin.y.toFixed(3)}) vs sheet (${want.x.toFixed(3)}, ${want.y.toFixed(3)})`);
    assert.ok(Math.abs(edge.x + edge.w / 2 - edge.origin.x) < 1e-6 && Math.abs(edge.y + edge.h / 2 - edge.origin.y) < 1e-6);
  }
  assert.equal(scene.layers.filter(l => l.role === 'patch').length, 4, 'two patches, each drawn twice');
});

test('OCP: composing the same build twice draws the same patches (the build is not consumed)', async () => {
  const b = build('ocp', 'senior', 'Capt', { patches: [UNIT, WING] });
  const one = await P.composeUniform(b, store());
  const two = await P.composeUniform(b, store());
  const keys = s => s.layers.filter(l => l.role === 'patch').map(l => l.key).sort();
  assert.deepEqual(keys(two), keys(one));
  assert.equal(b.patches.length, 2, 'the member\'s list is left alone');
});

test('OCP: both flat sleeve views and the coat agree for every grade (patch drawn per sleeve, per view)', async () => {
  for(const [m, r] of [['cadet', 'C/SSgt'], ['senior', 'Capt'], ['senior', 'Lt Col'], ['senior', 'SMSgt']]){
    for(const gender of ['male', 'female']){
      const scene = await P.composeUniform(build('ocp', m, r, { gender, patches: [UNIT, WING] }), store());
      for(const key of ['patch:sequoyah_cadet_squadron_patch:R_SHOULDER', 'patch:nywg_patch:L_SHOULDER']){
        assert.ok(scene.layers.some(l => l.key === key + ':0'), `${r} ${gender} ${key} flat`);
        assert.ok(scene.layers.some(l => l.key === key + ':edge'), `${r} ${gender} ${key} edge`);
      }
    }
  }
});

test('OCP: a patch stays inside the Velcro of its sleeve in the flat view (7.1.1.4)', async () => {
  const scene = await P.composeUniform(build('ocp', 'senior', 'Capt', { patches: [UNIT, WING] }), store());
  for(const [key, velcro] of [['patch:sequoyah_cadet_squadron_patch:R_SHOULDER:0', 'sleeve_flap_velcro_right'], ['patch:nywg_patch:L_SHOULDER:0', 'sleeve_flap_velcro_left']]){
    const l = scene.layers.find(x => x.key === key), v = await rectOf(velcro);
    assert.ok(l.x >= v.x - EPS && l.x + l.w <= v.x + v.w + EPS && l.y >= v.y - EPS && l.y + l.h <= v.y + v.h + EPS, key);
  }
});

// ---- D23: no grade piece is mounted above the AUX panel -------------------------------------------

test('OCP: the grade is the chest square and the cap piece; nothing mounted on the sleeve tabs but the graduated commander\'s patch (7.1.1.2, 7.1.1.3.1.7, 7.1.1.8)', async () => {
  const tabs = [await rectOf('glint_tab_left'), await rectOf('glint_tab_right')];
  const inTab = l => tabs.some(t => l.x + l.w / 2 > t.x && l.x + l.w / 2 < t.x + t.w && l.y + l.h / 2 > t.y && l.y + l.h / 2 < t.y + t.h);
  for(const [m, r] of [['cadet', 'C/SSgt'], ['cadet', 'C/Maj'], ['senior', 'Capt'], ['senior', 'Lt Col'], ['senior', 'Col'], ['senior', 'SMSgt'], ['senior', 'Brig Gen']]){
    for(const command of [null, PIN]){
      const scene = await P.composeUniform(build('ocp', m, r, { command, patches: [UNIT, WING] }), store());
      const grades = scene.layers.filter(l => l.role === 'grade');
      assert.ok(grades.length >= 1 && grades.every(g => !inTab(g)), `${r}: no grade piece on a sleeve tab`);
      const chest = grades.filter(g => g.key === 'grade:chest');
      assert.ok(chest.length <= 1, `${r}: at most the one chest grade`);
      const sq = await rectOf('rank_square');
      for(const g of chest) assert.ok(g.x >= sq.x - EPS && g.x + g.w <= sq.x + sq.w + EPS && g.y >= sq.y - EPS && g.y + g.h <= sq.y + sq.h + EPS, `${r}: chest grade inside the 2 x 2 square`);
      const rest = grades.filter(g => g.key !== 'grade:chest');
      assert.ok(rest.every(g => /^grade:(patrol|baseball|boonie)_/.test(g.key)), `${r}: any other grade is on a cap`);
      // The only thing worn on a tab is the commander's patch.
      const onTab = scene.layers.filter(l => l.type !== 'measure' && l.role !== 'garment' && inTab(l));
      assert.ok(onTab.every(l => l.role === 'badge' && /^badge:squadron_commander_badge:UN/.test(l.key)), `${r}: only the graduated commander's insignia on a tab`);
      assert.equal(onTab.length, command ? 1 : 0, `${r}: the commander's patch on the flat tab only when worn`);
    }
  }
});

test('OCP: the graduated commander\'s 1 in patch rests on the loop that shows, centred in it, never across the flap\'s edge (7.1.1.3.1.7)', async () => {
  const scene = await P.composeUniform(build('ocp', 'senior', 'Capt', { command: PIN }), store());
  const tab = await rectOf('glint_tab_left');
  const spec = await ST.load(OCP);
  const cover = spec.raw.dimensions.sleeve_pocket.iff_cover_in[1];
  const pin = scene.layers.find(l => l.key === 'badge:squadron_commander_badge:UN:0');
  assert.ok(pin);
  assert.ok(Math.abs(pin.w - 1) < EPS && Math.abs(pin.h - 1) < EPS, 'the 1 x 1 in patch');
  assert.ok(pin.y >= tab.y + cover - EPS, `top of the patch ${pin.y.toFixed(3)} is below the flap edge ${(tab.y + cover).toFixed(3)}`);
  assert.ok(pin.y + pin.h <= tab.y + tab.h + EPS, 'inside the loop');
  assert.ok(Math.abs(pin.x + pin.w / 2 - (tab.x + tab.w / 2)) < EPS, 'centred across the tab');
  const above = pin.y - (tab.y + cover), below = tab.y + tab.h - (pin.y + pin.h);
  assert.ok(Math.abs(above - below) < EPS, 'equal margin above and below');
  const edge = scene.layers.find(l => l.key === 'badge:squadron_commander_badge:UN:0:edge');
  assert.ok(edge, 'edge view on the coat');
  assert.ok(Math.abs(edge.w - 0.5) < EPS && Math.abs(edge.rotate - -12.375) < 1e-6);
  const sheet = sheetEdgeView('left');
  assert.ok(Math.abs(sheet.tilt - -12.375) < 1e-6, 'the sheet turns the left pocket the same way');
});

// ---- D22: nothing in the edge view goes past the Velcro or off the coat (7.1.1.4) -------------------

// The sheet's coat silhouette (clipSil) in scene inches, and the sheet's Velcro pieces of each edge
// view (the flap, the IFF loop) with their turn.
function sheetShapes(side){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', OCP + '.svg'), 'utf8');
  const art = /<g id="[^"]*__art" transform="translate\(([\d.]+) ([\d.]+)\) scale\(100\)">/.exec(svg);
  const ox = Number(art[1]) / 100, oy = Number(art[2]) / 100;
  const sil = /<clipPath id="[^"]*__clipSil"><path d="([^"]*)"/.exec(svg)[1];
  const silhouette = (sil.match(/-?\d+\.?\d*,-?\d+\.?\d*/g) || []).map(t => { const [x, y] = t.split(',').map(Number); return { x: ox + x, y: oy + y }; });
  const edge = sheetEdgeView(side);
  const groupAt = svg.indexOf(`<g id="${OCP}__sleeve-pocket-edge-${side}"`);
  const rectAt = (from, re) => { const m = re.exec(svg.slice(from)); return { x: ox + Number(m[1]), y: oy + Number(m[2]), w: Number(m[3]), h: Number(m[4]) }; };
  const num = '([-\\d.]+)';
  const flap = rectAt(groupAt, new RegExp(`<rect id="${OCP}__sleeve-flap-edge-${side}" x="${num}" y="${num}" width="${num}" height="${num}"`));
  const loop = rectAt(groupAt, new RegExp(`<rect x="${num}" y="${num}" width="(0.500)" height="(3.25)"`));
  return { silhouette, pivot: edge.pivot, tilt: edge.tilt, flap, loop };
}

function inPoly(p, poly){
  let c = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
// Inside a rect that is turned `tilt` degrees about `pivot` (tolerance in inches).
function inTurnedRect(p, r, pivot, tilt, tol){
  const q = core.rotatePoint(p, pivot, -tilt);
  return q.x >= r.x - tol && q.x <= r.x + r.w + tol && q.y >= r.y - tol && q.y <= r.y + r.h + tol;
}

test('OCP: every edge-view patch is clipped to its Velcro and to the coat silhouette, so none lands on the white beside the sleeve (7.1.1.4: patches will not extend past the Velcro)', async () => {
  for(const gender of ['male', 'female']){
    const scene = await P.composeUniform(build('ocp', 'senior', 'Capt', { gender, patches: [UNIT, WING], command: PIN }), store());
    const edges = scene.layers.filter(l => /:edge$/.test(l.key));
    assert.equal(edges.length, 3, `${gender}: unit patch, HHQ patch and the commander's patch each show in an edge view`);
    for(const l of edges){
      const side = /sequoyah/.test(l.key) ? 'right' : 'left';
      const sheet = sheetShapes(side);
      const piece = /badge:/.test(l.key) ? sheet.loop : sheet.flap;
      assert.ok(Array.isArray(l.clip) && l.clip.length >= 3, `${gender} ${l.key}: has a clip polygon`);
      // The clip is inside the mapped Velcro (flap or IFF loop) and inside the coat silhouette.
      for(const p of l.clip){
        assert.ok(inTurnedRect(p, piece, sheet.pivot, sheet.tilt, 0.005), `${gender} ${l.key}: clip corner (${p.x.toFixed(3)}, ${p.y.toFixed(3)}) is inside the ${/badge:/.test(l.key) ? 'IFF loop' : 'flap'}`);
        assert.ok(inPoly(p, sheet.silhouette), `${gender} ${l.key}: clip corner (${p.x.toFixed(3)}, ${p.y.toFixed(3)}) is inside the coat silhouette`);
      }
      // Every point of the patch that the clip lets through is on the Velcro and on the coat.
      const half = { w: l.w / 2, h: l.h / 2 }, c = l.origin, tilt = l.rotate || 0;
      let shown = 0, total = 0;
      for(let u = -half.w + 0.025; u < half.w; u += 0.05) for(let v = -half.h + 0.025; v < half.h; v += 0.05){
        const p = core.rotatePoint({ x: c.x + u, y: c.y + v }, c, tilt);
        total++;
        if(!inPoly(p, l.clip)) continue;
        shown++;
        assert.ok(inTurnedRect(p, piece, sheet.pivot, sheet.tilt, 0.005) && inPoly(p, sheet.silhouette), `${gender} ${l.key}: a visible point (${p.x.toFixed(3)}, ${p.y.toFixed(3)}) is off the Velcro or the coat`);
      }
      assert.ok(shown > 0, `${gender} ${l.key}: some of it shows`);
      if(!/badge:/.test(l.key)) assert.ok(shown / total > 0.4, `${gender} ${l.key}: most of the patch stays on the flap (${(100 * shown / total).toFixed(0)} %)`);
    }
  }
});

// ---- D26: the measurement overlay ------------------------------------------------------------------

test('every measurement is labelled with its own length, except the one marked approximate', async () => {
  for(const u of ['ocp', 'abu', 'corporate_field']){
    for(const [m, r] of [['senior', 'Capt'], ['senior', 'Lt Col'], ['senior', 'SMSgt'], ['cadet', 'C/SSgt']]){
      if(u === 'corporate_field' && m === 'cadet') continue;
      const scene = await P.composeUniform(build(u, m, r, { badges: [PILOT, GT], patches: [UNIT, WING], command: PIN }), store());
      for(const l of measures(scene)){
        if(/^about /.test(l.label)){ assert.ok(Math.abs(Number(l.label.replace(/[^\d.]/g, '')) - len(l)) < 0.06, `${u} ${r}: ${l.label} for ${len(l)}`); continue; }
        assert.equal(l.label, C.inchesLabel(len(l)), `${u} ${r}: label ${l.label} on a ${len(l).toFixed(3)} in line`);
      }
    }
  }
});

test('OCP overlay: chest square size, the collar-to-zipper drop from the garment apex, badges, tapes and caps', async () => {
  const scene = await P.composeUniform(build('ocp', 'senior', 'Capt', { badges: [PILOT, GT], patches: [UNIT, WING] }), store());
  const spec = await ST.load(OCP);
  const apex = core.anchor(spec, 'collar_apex'), sq = await rectOf('rank_square');
  const ms = measures(scene);
  // the square: 2 in each way
  const twos = ms.filter(m => m.label === '2 in');
  assert.equal(twos.length, 2, 'both sides of the 2 x 2 in square');
  assert.ok(twos.some(m => Math.abs(m.from.y - m.to.y) < 1e-6) && twos.some(m => Math.abs(m.from.x - m.to.x) < 1e-6));
  // from the point where the collar meets the zipper to the top of the square
  const drop = ms.find(m => /^about /.test(m.label));
  assert.ok(drop, 'collar to square');
  assert.ok(Math.abs(drop.from.x - apex.x) < 1e-6 && Math.abs(drop.from.y - apex.y) < 1e-6, 'starts at the collar_apex anchor');
  assert.ok(Math.abs(drop.to.y - sq.y) < 1e-6 && Math.abs(drop.to.x - apex.x) < 1e-6, 'ends on the placket at the top of the square');
  // two badges, 1/2 in each; the cap grade 1/2 in above the visor on both caps
  assert.ok(ms.filter(m => m.label === '½ in').length >= 4, 'badges and caps');
  // patch widths and the equal gaps that centre each under the flag and AUX
  assert.equal(ms.filter(m => m.label === '3½ in').length, 2, 'both patches');
  assert.equal(ms.filter(m => m.label === '0.47 in').length, 4, 'gap above and below each patch');
  // the CAP tape's lettering is kept clear of overlay labels
  assert.ok(scene.layers.some(l => l.type === 'clear' && l.key === 'clear:cap_tape'));
  assert.ok(ms.length >= 12, `${ms.length} measurements`);
});

test('OCP overlay: no square, no square measurements for a Cadet Airman Basic (7.1.1.2.2)', async () => {
  const scene = await P.composeUniform(build('ocp', 'cadet', 'C/AB'), store());
  assert.equal(measures(scene).filter(m => m.label === '2 in' || /^about /.test(m.label)).length, 0);
});

test('badges over the CAP tape: three then four, every regulation gap is measured (7.1.1.3.1.3, 7.1.1.3.1.4)', async () => {
  const B3 = [PILOT, GT, { id: 'basic_incident_commander_badge', title: 'Basic IC' }];
  const three = measures(await P.composeUniform(build('ocp', 'senior', 'Capt', { badges: B3 }), store())).map(m => m.label);
  assert.ok(three.includes('⅛ in'), '1/8 in above the tape');
  assert.ok(three.filter(l => l === '½ in').length >= 1, '1/2 in between the pair');
  assert.ok(three.includes('¼ in'), '1/4 in from the pair to the third');
  const B4 = B3.concat([{ id: 'medical_officer', title: 'Medical' }]);
  const four = measures(await P.composeUniform(build('ocp', 'senior', 'Capt', { badges: B4 }), store())).map(m => m.label);
  assert.ok(four.includes('⅛ in'));
  assert.ok(four.includes('½ in'));
  assert.equal(four.filter(l => l === '¼ in').length, 2, '1/4 in between the badges of each stack');
});

test('ABU and CFU overlay: grade 1 in from the collar\'s free edge, chevron width, patch widths, badges (5.1.1.1.1, 5.2.1.1.1, 5.1.1.1.2)', async () => {
  for(const u of ['abu', 'corporate_field']){
    const garment = u === 'abu' ? 'garment-abu-coat' : 'garment-cfu-coat';
    const spec = await ST.load(garment);
    const apex = core.anchor(spec, 'collar_apex');
    assert.ok(apex);
    // an officer: the grade centred 1 in from the bottom of each collar leaf
    const scene = await P.composeUniform(build(u, 'senior', 'Capt', { badges: [PILOT, GT], patches: [UNIT, WING] }), store());
    const ms = measures(scene);
    const ones = ms.filter(m => m.label === '1 in');
    assert.equal(ones.length, 2, `${u}: one on each collar`);
    for(const side of ['right', 'left']){
      const g = scene.layers.find(l => l.key === 'grade:' + side);
      const m = ones.find(x => Math.abs(x.to.x - g.origin.x) < 1e-6 && Math.abs(x.to.y - g.origin.y) < 1e-6);
      assert.ok(m, `${u} ${side}: the line ends on the centre of the grade`);
      assert.ok(Math.abs(len(m) - 1) < 1e-3, `${u} ${side}: 1 in`);
    }
    assert.ok(ms.filter(m => m.label === '½ in').length >= 2, `${u}: badges`);
    // a senior NCO: the chevron's width on each sleeve view the sheet draws
    const nco = await P.composeUniform(build(u, 'senior', 'SMSgt', { opt: { headgear: 'auto', chevron: '3.5' } }), store());
    const chev = nco.layers.filter(l => /^grade:sleeve-/.test(l.key) && !/:edge$/.test(l.key)); // the flat views; the arms' edge-on copies are narrowed (FIX-R-OTHER-r2 #7)
    assert.ok(chev.length >= 1);
    for(const c of chev) assert.ok(measures(nco).some(m => Math.abs(m.from.x - c.x) < 1e-6 && Math.abs(len(m) - c.w) < 1e-6), `${u}: chevron width`);
  }
  // patches: each one's width
  const cfu = await P.composeUniform(build('corporate_field', 'senior', 'Capt', { patches: [UNIT, WING, { id: 'cos_patch', title: 'COS', href: 'images/patches/cos_patch.webp', aspect: 1, slot: 'CHEST_LEFT', kind: 'general' }] }), store());
  const patches = cfu.layers.filter(l => l.role === 'patch' && !/:edge$/.test(l.key));
  assert.equal(patches.length, 3);
  for(const p of patches) assert.ok(measures(cfu).some(m => Math.abs(m.from.x - p.x) < 1e-6 && Math.abs(len(m) - p.w) < 1e-6), `${p.key} width`);
});

test('the CAP tape is kept clear of overlay labels on ABU and CFU too', async () => {
  for(const u of ['abu', 'corporate_field']){
    const scene = await P.composeUniform(build(u, 'senior', 'Capt'), store());
    assert.ok(scene.layers.some(l => l.key === 'clear:cap_tape'), u);
  }
});

// ---- D26 (4): collar grade orientation on the ABU and CFU ------------------------------------------

test('ABU and CFU collar grade is turned as each collar leaf\'s slot says (5.1.1.1.1.1, 5.1.1.1.1.3-4, 5.2.1.1.1)', async () => {
  for(const u of ['abu', 'corporate_field']){
    const garment = u === 'abu' ? 'garment-abu-coat' : 'garment-cfu-coat';
    const spec = await ST.load(garment);
    const slots = spec.raw.collar_slots;
    // Cadet officer (5.1.1.1.1.3, 5.2.1.1.1.4: 'one inch from the front of the collar and centered'): the row (the art's width) runs parallel to the leaf's front edge, its NEAR OUTLINE
    // 1 in from that edge, centred on the leaf, drawn from the sheet's collar_left / collar_right polygons (it was the sheet's slot centre, 1.44 in from the edge, so the near edge was 0.69 in
    // from it; D8: the old assertion pinned the slot's turn and not the distance). Cadet NCO: the chevron follows Figure A5-5 like the shirts' (tests/engine-e5-chevrons.test.cjs).
    for(const rank of ['C/2d Lt', 'C/Capt', 'C/Maj', 'C/Col']){
      const scene = await P.composeUniform(build(u, 'cadet', rank), store());
      for(const side of ['right', 'left']){
        const g = scene.layers.find(l => l.key === 'grade:' + side);
        assert.ok(g, `${u} ${rank} ${side}`);
        const d = slots[side].front_edge.dir_down;
        // the row's long axis (its width) points down the front edge
        const axis = core.rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, g.rotate);
        assert.ok(Math.abs(axis.x * d[1] - axis.y * d[0]) < 0.01, `${u} ${rank} ${side}: row parallel to the front edge`);
        // distance from the front edge line to the nearest point of the rotated box: 1 in
        const p1 = slots[side].front_edge.p1.map(v => v / 100), n = { x: d[1], y: -d[0] };
        const c = { x: g.x + g.w / 2, y: g.y + g.h / 2 }, a = (g.rotate * Math.PI) / 180;
        const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => ({ x: c.x + i * g.w / 2 * Math.cos(a) - j * g.h / 2 * Math.sin(a), y: c.y + i * g.w / 2 * Math.sin(a) + j * g.h / 2 * Math.cos(a) }));
        const dist = corners.map(q => Math.abs((q.x - p1[0]) * n.x + (q.y - p1[1]) * n.y));
        assert.ok(Math.abs(Math.min(...dist) - 1) < 0.01, `${u} ${rank} ${side}: near outline ${Math.min(...dist).toFixed(3)} in from the front edge`);
        const m = measures(scene).find(x => Math.abs(Math.hypot(x.to.x - x.from.x, x.to.y - x.from.y) - 1) < 0.01 && Math.hypot(x.to.x - c.x, x.to.y - c.y) < 1.2 && Math.hypot(x.to.x - c.x, x.to.y - c.y) > 0.4);
        assert.ok(m, `${u} ${rank} ${side}: the 1 in measure is drawn`);
      }
    }
    // Officers: bars/leaf square to the free edge for Capt, stem parallel to the ground for Maj/Lt Col, beak forward for Col.
    const rotOf = async (rank, side) => (await P.composeUniform(build(u, 'senior', rank), store())).layers.find(l => l.key === 'grade:' + side);
    assert.equal((await rotOf('Maj', 'right')).rotate, 90);
    assert.equal((await rotOf('Maj', 'left')).rotate, -90);
    assert.equal((await rotOf('Lt Col', 'right')).rotate, 90);
    assert.equal((await rotOf('Lt Col', 'left')).rotate, -90);
    assert.equal((await rotOf('Col', 'right')).flipX, true);
    assert.equal((await rotOf('Col', 'left')).flipX, undefined);
    assert.equal((await rotOf('Capt', 'right')).rotate, slots.right.officer.angle_deg);
    assert.equal((await rotOf('Capt', 'left')).rotate, slots.left.officer.angle_deg);
  }
});

// ---- review FIX-ART-r1 (7, 9): the officer grade lies on the collar leaf; the sleeve patch hangs 1/2 in below the seam ----

test('ABU and CFU officer grade (Capt, Maj, Lt Col, Col, Brig Gen) lies wholly inside the collar leaf, 1 in from the bottom edge (5.1.1.1.1.1, 5.2.1.1.1.1)', async () => {
  const inPoly = (p, P) => { let r = false; for(let i = 0, j = P.length - 1; i < P.length; j = i++){ const [xi, yi] = P[i], [xj, yj] = P[j]; if(((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) r = !r; } return r; };
  for(const u of ['abu', 'corporate_field']){
    const spec = await ST.load(u === 'abu' ? 'garment-abu-coat' : 'garment-cfu-coat');
    // (Maj Gen's 2.06 in star stack is not here: it needs more leaf than the drawn collar has, see FOLLOWUPS)
    for(const rank of ['Capt', 'Maj', 'Lt Col', 'Col', 'Brig Gen']){
      const scene = await P.composeUniform(build(u, 'senior', rank), store());
      for(const side of ['right', 'left']){
        const g = scene.layers.find(l => l.key === 'grade:' + side);
        assert.ok(g, `${u} ${rank} ${side}`);
        const poly = spec.raw.landmarks['collar_' + side].map(p => [p[0] / 100, p[1] / 100]);
        const c = { x: g.x + g.w / 2, y: g.y + g.h / 2 }, a = (g.rotate * Math.PI) / 180;
        const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => ({ x: c.x + i * g.w / 2 * Math.cos(a) - j * g.h / 2 * Math.sin(a), y: c.y + i * g.w / 2 * Math.sin(a) + j * g.h / 2 * Math.cos(a) }));
        for(const q of corners) assert.ok(inPoly(q, poly), `${u} ${rank} ${side}: corner ${q.x.toFixed(2)},${q.y.toFixed(2)} off the leaf`);
      }
    }
  }
});

test('ABU and CFU sleeve patches hang 1/2 in below the shoulder seam and the overlay draws the 1/2 in (5.1.1.1.2.2, 5.2.1.1.2.2-3)', async () => {
  const left = { id: 'wing_patch', title: 'Wing', href: 'images/patches/wing.webp', aspect: 1, slot: 'L_SHOULDER', kind: 'general' };
  const right = { id: 'act_patch', title: 'Activity', href: 'images/patches/act.webp', aspect: 1.4, slot: 'R_SHOULDER', kind: 'general' };
  for(const [u, patches] of [['abu', [left]], ['corporate_field', [left, right]]]){
    const garment = u === 'abu' ? 'garment-abu-coat' : 'garment-cfu-coat';
    const spec = await ST.load(garment);
    const scene = await P.composeUniform(build(u, 'senior', 'Capt', { patches }), store());
    for(const p of scene.layers.filter(l => l.role === 'patch' && /L_SHOULDER|R_SHOULDER/.test(l.key) && !/:edge$/.test(l.key))){
      const side = /L_SHOULDER/.test(p.key) ? 'left' : 'right';
      const seam = core.anchor(spec, 'seam_top_center_' + side);
      assert.ok(Math.abs(p.y - seam.y - 0.5) < 0.005, `${u} ${side}: patch top ${p.y} is ${(p.y - seam.y).toFixed(3)} in below the seam`);
      assert.ok(measures(scene).some(m => Math.abs(m.from.y - seam.y) < 1e-6 && Math.abs(m.to.y - p.y) < 1e-6 && Math.abs(len(m) - 0.5) < 0.005), `${u} ${side}: the 1/2 in measure`);
    }
  }
});

// review FIX-ART-r1 (10): the two shoulder-pocket edge views of the OCP coat mirror each other and lie on the coat, so the AUX patch is as whole as the flag
test('OCP shoulder pockets seen edge-on: the sheet states one mirrored frame for both, the AUX and the flag are not cut by the coat silhouette (7.1.1.1.2, 7.1.1.4)', async () => {
  const spec = await ST.load('garment-ocp-coat-abu-cut');
  const ev = spec.raw.dimensions.edge_view, top = core.anchor(spec, 'top_center');
  assert.ok(ev && ev.scale === 0.5 && ev.tilt_deg > 10, 'edge_view stated');
  assert.ok(Math.abs((top.x - ev.pivot_right_in[0]) - (ev.pivot_left_in[0] - top.x)) < 0.01, 'pivots mirror about the centre line');
  assert.ok(Math.abs(ev.pivot_right_in[1] - ev.pivot_left_in[1]) < 0.01, 'same height');
  for(let i = 0; i < ev.visible_right.length; i++) assert.ok(Math.abs(ev.visible_right[i][1] - ev.visible_left[i][1]) < 0.06, `silhouette in the pocket frame, row ${i}`);
  // the drawn pocket (4.5 in wide face, scale 0.5 for the patches) is inside the silhouette: its outer face u = -2.25 * 0.5 lies at or inside the 0.04 in margin line where the pocket is at its widest
  const vis = ev.visible_right, mid = vis.find(p => p[0] === 0);
  assert.ok(mid[1] <= -2.25 * 0.5 + 0.02 && mid[1] >= -2.25 * 0.5 - 0.05, `silhouette at the pocket centre: ${mid[1]}`);
  // the patches (3.25 in x 0.5) at their rows, every corner inside the silhouette line
  for(const p of vis.filter(q => q[0] >= -3 && q[0] <= -1)) assert.ok(p[1] <= -1.625 / 2 + 0.01, `row ${p[0]}: the silhouette is outboard of the 1.625 in AUX/flag patch (u ${p[1]})`);
});
