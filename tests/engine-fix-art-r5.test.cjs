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
