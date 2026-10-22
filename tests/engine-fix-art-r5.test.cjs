'use strict';
// FIX-ART-r5: artwork findings of review round 5, locked on the synced sheets.
//   1. One epaulet sleeve, one colour: the edge-on strip on the shoulder and the sleeve seen from above fill the same gray / blue.
//   2. Women's mess dress: the coat ends with the jacket fronts and the skirt shows from the cummerbund's lower edge down.
//   3. Women's mess dress: the collar leaves lie over the tie tab.
//   4. Men's short-sleeve aviator shirt: the 3 1/2 in NCO chevron lies between the outline and the armhole seam.
//   5. OCP coat: the collar leaves end on the placket top symmetrically at collar_apex.

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

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const assetPath = id => path.join(root, 'images', manifest.assets.find(a => a.id === id).path);
const readSvg = id => fs.readFileSync(assetPath(id), 'utf8');
const readSpec = id => JSON.parse(fs.readFileSync(assetPath(id).replace(/\.svg$/, '.spec.json'), 'utf8'));

function build(uniform, gender, membership, rank, opt){
  return {
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: Object.assign({ headgear: 'auto' }, opt || {}), name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  };
}

// ---- 1. one sleeve, one colour -----------------------------------------------------------------------------

const bodyFill = id => (readSvg(id).match(/<(?:path|rect) id="[^"]*(?:epaulet-sleeve-(?:right|left)-body|sleeve-body|__body)"[^>]*?fill="(#[0-9a-f]{6})"/i) || [])[1];

test('the edge-on epaulet sleeve strip and the sleeve seen from above fill the same colour on every sheet that draws both (CAPR 39-1 4.1.11.1.1.1.1 / 4.1.12.2.3.1 gray, 4.1.11.1.1.1.4 / 4.1.12.2.3.4 blue, 4.2.5.1.1.1 / 4.2.5.1.1.4 aviator)', () => {
  const gray = bodyFill('rank-epaulet-sleeve-gray-captain'), blue = bodyFill('rank-epaulet-sleeve-blue-cadet-major');
  assert.equal(gray, '#5f5c5c');
  assert.equal(blue, '#142347');
  assert.equal(bodyFill('rank-epaulet-sleeve-gray-blank'), gray);
  assert.equal(bodyFill('rank-epaulet-sleeve-blue-cadet-blank'), blue);
  let n = 0;
  for(const a of manifest.assets){
    const m = a.id.match(/^garment-(?:aviator-shirt|blues-class-b-(?:shirt|blouse))-.*epaulet-sleeve-(officer|cadet-officer)$/);
    if(!m) continue;
    n++;
    assert.equal(bodyFill(a.id), m[1] === 'officer' ? gray : blue, `${a.id}: strip fill`);
  }
  assert.equal(n, 16, 'the 8 Class B and 8 aviator edge-on strip sheets');
  for(const id of ['garment-blues-class-a-coat-senior-officer', 'garment-blues-class-a-coat-general-officer', 'garment-blues-class-a-coat-female-senior-officer', 'garment-blues-class-a-coat-female-general-officer']){
    assert.equal(bodyFill(id), gray, `${id}: Class A coat strip`);
  }
});

test('the scene of a Capt and a C/Maj on the Class B shirt and the aviator shirt draws strip and top view from the sleeve assets of one colour', async () => {
  for(const [uniform, gender, mem, rank, want] of [['blues_b', 'male', 'senior', 'Capt', '#5f5c5c'], ['blues_b', 'female', 'senior', 'Capt', '#5f5c5c'], ['blues_b', 'male', 'cadet', 'C/Maj', '#142347'], ['aviator', 'female', 'senior', 'Capt', '#5f5c5c']]){
    const scene = await P.composeUniform(build(uniform, gender, mem, rank, {}), store);
    const top = scene.layers.find(l => l.role === 'epaulet-top');
    assert.ok(top, `${uniform} ${gender} ${rank}: top view`);
    assert.equal(bodyFill(top.id), want, `${uniform} ${gender} ${rank}: top view fill`);
    const strip = scene.layers.find(l => /-epaulet-sleeve-(officer|cadet-officer)$/.test(l.id || ''));
    assert.ok(strip, `${uniform} ${gender} ${rank}: strip`);
    assert.equal(bodyFill(strip.id), want, `${uniform} ${gender} ${rank}: strip fill`);
  }
});

// ---- 2. women's mess dress: the jacket ends on the front hems ----------------------------------------------------

function silhouettePaths(id){
  const d = readSvg(id).match(/id="[^"]*silhouette" d="([^"]+)"/)[1];
  return d.split('M').filter(Boolean).map(sub => { const n = sub.match(/-?\d*\.?\d+/g).map(Number), pts = []; for(let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]); return pts; });
}

test('the women\'s mess jacket ends on the traced front hems: no coat between the fronts under the cummerbund or below the hems, and the skirt starts at the cummerbund\'s lower edge (CAPR 39-1 4.1.2.1, 4.1.2.2.4, 4.1.2.3)', async () => {
  const id = 'garment-mess-dress-female', spec = readSpec(id), fh = spec.dimensions.front_hems;
  const outline = silhouettePaths(id)[0];                 // inches from the centre line, y from the traced top (the art sits 0.25 in below the box top)
  const body = outline.filter(p => Math.abs(p[0]) < 8.7);
  // below the armpit gaps the only points inside the sleeves' inner edges are the hems, the fronts' edges and the cummerbund line
  const lowest = Math.max(...body.filter(p => p[1] > 20).map(p => p[1]));
  const hemMax = Math.max(fh.panels[0].y_in, fh.panels[1].y_in) - 0.25;
  assert.ok(lowest <= hemMax + 0.1, `lowest body point ${lowest} in, front hems end at ${hemMax} in (the old coat block ran to 32.7 in)`);
  assert.ok(lowest < 28, `the jacket is not hip-length-plus: ${lowest} in`);
  // the gap between the fronts: 2 to 3 in wide at the bottom (4.1.2.1), its top edge on the cummerbund's lower edge (4.1.2.2.4)
  assert.ok(fh.gap_between_fronts_in >= 2 && fh.gap_between_fronts_in <= 3, `gap ${fh.gap_between_fronts_in} in`);
  const cbBottom = Math.max(...spec.landmarks.cummerbund.map(p => p[1])) / 100;   // the sheet's box inches
  assert.ok(Math.abs(cbBottom - fh.cummerbund_bottom_y_in) < 0.02, `cummerbund bottom ${cbBottom} in, the gap's top edge ${fh.cummerbund_bottom_y_in} in`);
  const gapTop = body.filter(p => Math.abs(Math.abs(p[0]) - fh.gap_between_fronts_in / 2) < 0.1 && p[1] < 23 && p[1] > 22);
  assert.ok(gapTop.length >= 2, 'the gap\'s top corners lie on the cummerbund\'s lower edge');
  // the sleeves still run on to the cuffs
  assert.ok(Math.max(...outline.map(p => p[1])) > 32, 'the sleeves reach the cuffs');
});

test('the women\'s mess skirts have no full-width hem shadow at the old coat hem (33 in): the shade lies under the two front hems the jacket states', () => {
  const fh = readSpec('garment-mess-dress-female').dimensions.front_hems;
  for(const id of ['garment-mess-dress-skirt-female-a-line', 'garment-mess-dress-skirt-female-straight-split']){
    const svg = readSvg(id);
    assert.doesNotMatch(svg, /__hem-shadow"/, `${id}: no single hem shadow`);
    const shadows = [...svg.matchAll(/id="[^"]*__hem-shadow-(\d)" d="M([\d.]+),([\d.]+)L([\d.]+),/g)];
    assert.equal(shadows.length, 2, `${id}: one shadow under each front hem`);
    for(const m of shadows){
      const pn = fh.panels[Number(m[1]) - 1];
      assert.ok(Math.abs(Number(m[2]) - pn.x_in[0]) < 0.01 && Math.abs(Number(m[3]) - pn.y_in) < 0.01, `${id}: shadow ${m[1]} sits on its panel's hem`);
    }
  }
});

// ---- 3. women's mess dress: collar leaves over the tie tab -------------------------------------------------------

test('the women\'s mess tie tab is drawn under the blouse collar leaves, centred, and is the house tab size (CAPR 39-1 4.1.2.2.1; D19, 4d6678dd)', () => {
  const id = 'garment-mess-dress-female', svg = readSvg(id), spec = readSpec(id);
  const at = s => svg.indexOf(`id="${id}__${s}"`);
  assert.ok(at('tie-tab') > 0 && at('blouse-collar-right') > at('tie-tab') && at('blouse-collar-left') > at('tie-tab'), 'the leaves are drawn after the tab');
  const tab = spec.landmarks.tie_tab, xs = tab.map(p => p[0]), ys = tab.map(p => p[1]);
  const w = (Math.max(...xs) - Math.min(...xs)) / 100, h = (Math.max(...ys) - Math.min(...ys)) / 100, cx = (Math.max(...xs) + Math.min(...xs)) / 2 / 100;
  assert.ok(Math.abs(w - 2.7) < 0.02 && Math.abs(h - 1.6) < 0.02, `tab ${w} x ${h} in (was 4.5 x 4.27)`);
  assert.ok(Math.abs(cx - spec.size_in.w / 2) < 0.02, `tab centred: ${cx} vs ${spec.size_in.w / 2}`);
  assert.equal(spec.dimensions.tie_tab.size_source, 'estimated');
  // the tab's top edge is not above the leaves' inner meeting point (nothing shows above the leaves)
  const leaf = svg.match(new RegExp(`id="${id}__blouse-collar-left" d="M[^"]*"`))[0].match(/-?\d*\.?\d+/g).map(Number);
  const inner = []; for(let i = 0; i + 1 < leaf.length; i += 2) inner.push([leaf[i], leaf[i + 1]]);
  const innerY = inner.find(p => Math.abs(p[0]) < 0.01 && p[1] > 2.5)[1] + 0.25;
  assert.ok(Math.min(...ys) / 100 >= innerY - 0.011, `tab top ${Math.min(...ys) / 100} in, leaves meet at ${innerY} in`);
});

// ---- 4. aviator shirts: the 3 1/2 in NCO chevron lies between the outline and the armhole seam -------------------------

const inkPoints = id => [...readSvg(id).matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => [Number(m[1]) / 100, Number(m[2]) / 100]);
// the sheet's silhouette in scene inches (the art group sits at translate(x y) scale(100) in hundredths)
function silhouetteScene(id){
  const svg = readSvg(id), t = svg.match(new RegExp(`id="${id}__art" transform="translate\\(([-\\d.]+) ([-\\d.]+)\\)`)), d = svg.match(/id="[^"]*__silhouette" d="([^"]+)"/)[1];
  const n = d.match(/-?\d*\.?\d+/g).map(Number), pts = [];
  for(let i = 0; i + 1 < n.length; i += 2) pts.push([(Number(t[1]) + n[i] * 100) / 100, (Number(t[2]) + n[i + 1] * 100) / 100]);
  return pts;
}
const insidePoly = (p, P) => { let r = false; for(let i = 0, j = P.length - 1; i < P.length; j = i++){ const [xi, yi] = P[i], [xj, yj] = P[j]; if((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) r = !r; } return r; };
const distSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };

async function aviatorChevron(garment, gender, rank, sleeve){
  const spec = await store.load(garment), sil = silhouetteScene(garment);
  const scene = await P.composeUniform(build('aviator', gender, 'senior', rank, { sleeve }), store);
  const out = {};
  for(const side of ['right', 'left']){
    const l = scene.layers.find(x => x.role === 'grade' && x.key === 'grade:sleeve-' + side);
    assert.ok(l, `${garment} ${rank} ${side}: chevron`);
    assert.equal(l.w, 3.5, `${garment} ${rank}: the regulation 3 1/2 in size, not scaled`);
    const seam = core.landmark(spec, 'armhole_seam_' + side).points.slice().sort((a, b) => a.y - b.y);
    const seamX = y => {
      for(let i = 0; i < seam.length - 1; i++){ const a = seam[i], c = seam[i + 1]; if((a.y - y) * (c.y - y) <= 0 && a.y !== c.y) return a.x + (c.x - a.x) * (y - a.y) / (c.y - a.y); }
      return y > seam[seam.length - 1].y ? seam[seam.length - 1].x : seam[0].x;
    };
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2, r = l.rotate * Math.PI / 180;
    let seamClear = Infinity, outClear = Infinity, outside = 0;
    for(const [px, py] of inkPoints(l.id)){
      const dx = px - l.w / 2, dy = py - l.h / 2, q = [cx + dx * Math.cos(r) - dy * Math.sin(r), cy + dx * Math.sin(r) + dy * Math.cos(r)];
      const sx = seamX(q[1]);
      seamClear = Math.min(seamClear, side === 'right' ? sx - q[0] : q[0] - sx);
      let dm = Infinity; for(let i = 0; i < sil.length; i++) dm = Math.min(dm, distSeg(q, sil[i], sil[(i + 1) % sil.length]));
      const inside = insidePoly(q, sil);
      if(!inside) outside++;
      outClear = Math.min(outClear, inside ? dm : -dm);
    }
    out[side] = { seamClear, outClear, outside, layer: l };
  }
  return out;
}

test('the men\'s short-sleeve aviator shirt: every SSgt to CMSgt chevron is at least 0.1 in clear of the armhole seam and no ink is cut by the silhouette (4.2.5.1.1.3, D8)', async () => {
  for(const rank of ['SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt']){
    const r = await aviatorChevron('garment-aviator-shirt-male', 'male', rank, 'short');
    for(const side of ['right', 'left']){
      assert.ok(r[side].seamClear >= 0.1, `${rank} ${side}: ${r[side].seamClear.toFixed(3)} in from the armhole seam (want at least 0.1)`);
      assert.equal(r[side].outside, 0, `${rank} ${side}: ink outside the silhouette (the engine's clip would shave it)`);
      assert.ok(r[side].outClear >= 0.1, `${rank} ${side}: ink ${r[side].outClear.toFixed(3)} in inside the outline (want at least 0.1)`);
    }
  }
});

test('the other aviator shirts (women\'s short, both long) keep their chevron clear of the seam and the outline', async () => {
  for(const [garment, gender, sleeve] of [['garment-aviator-shirt-male-long', 'male', 'long'], ['garment-aviator-shirt-female', 'female', 'short'], ['garment-aviator-shirt-female-long', 'female', 'long']]){
    for(const rank of ['SSgt', 'CMSgt']){
      const r = await aviatorChevron(garment, gender, rank, sleeve);
      for(const side of ['right', 'left']){
        assert.ok(r[side].seamClear >= 0.1, `${garment} ${rank} ${side}: seam ${r[side].seamClear.toFixed(3)}`);
        assert.equal(r[side].outside, 0, `${garment} ${rank} ${side}: ink outside the silhouette`);
      }
    }
  }
});

test('the men\'s short aviator sheet states its sleeve anchors and armhole seams, flags the widening as an estimate and keeps the bodice as traced (only the sleeve run moves)', () => {
  const spec = readSpec('garment-aviator-shirt-male');
  for(const side of ['right', 'left']) for(const k of ['shoulder_seam_', 'sleeve_bottom_', 'chevron_halfway_']) assert.ok(spec.anchors[k + side], `${k}${side}`);
  const sh = spec.anchors.shoulder_seam_right, bot = spec.anchors.sleeve_bottom_right, half = spec.anchors.chevron_halfway_right;
  assert.ok(Math.abs(half[1] - (sh[1] + bot[1]) / 2) < 1, 'chevron_halfway is halfway between the shoulder seam and the sleeve bottom');
  assert.ok(spec.landmarks.armhole_seam_right.length >= 3 && spec.landmarks.armhole_seam_left.length >= 3);
  const w = spec.dimensions.sleeve_widening;
  assert.equal(w.size_source, 'estimated');
  assert.ok(w.outward_in >= 1.8, `widening ${w.outward_in}`);
  // bodice: the outline's side seam below the armpit is where the trace put it (the sleeve run moves; |x| <= 6.7 in below y 12.9 does not)
  const pts = silhouetteScene('garment-aviator-shirt-male').map(p => [p[0] - spec.size_in.w / 2, p[1] - 0.1]);
  const body = pts.filter(p => Math.abs(p[0]) < 6.7 && p[1] > 12.5);
  assert.ok(body.length >= 6, 'bodice points');
  const traced = [[6.428, 13.002], [6.527, 23.41], [6.58, 23.29], [6.55, 23.07]];
  for(const [x, y] of traced) assert.ok(body.some(p => Math.abs(Math.abs(p[0]) - x) < 0.03 && Math.abs(p[1] - y) < 0.03), `side seam point (${x}, ${y})`);
});
