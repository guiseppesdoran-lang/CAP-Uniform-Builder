'use strict';
// FIX-ART-r2 review findings (engine side). One block per finding.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const EDGE = require('../scripts/measure-sleeve-edge.cjs').compute();
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function build(uniform, gender, membership, rank, extra, opt, gradeOpt){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo(membership, rank, gradeOpt || {}), opt: Object.assign({ headgear: 'auto' }, opt || {}), name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const compose = b => P.composeUniform(b, store);

// ---- 2. Class B: the plain epaulet strap on every shirt and blouse without an epaulet sleeve ------------------

const CLASS_B = [
  ['male', '', 'garment-blues-class-b-shirt-male'], ['male', 'long', 'garment-blues-class-b-shirt-male-long'],
  ['female', '', 'garment-blues-class-b-blouse-female'], ['female', 'long', 'garment-blues-class-b-blouse-female-long']
];

test('Class B shirt and blouse: NCOs, cadet NCOs, airmen and adults without grade carry the plain epaulet strap above the shoulder cord (4.1.11.1.1, 4.1.12.2, 9.3, 9.4.1)', async () => {
  for(const [sex, sleeve, garment] of CLASS_B){
    for(const [m, r, go, cord] of [['senior', 'SMSgt', {}, null], ['cadet', 'C/SSgt', {}, 'wing'], ['cadet', 'C/AB', {}, 'wing'], ['cadet', 'C/CMSgt', {}, 'region'], ['senior', 'SM', { track: 'nco' }, null]]){
      const scene = await compose(build('blues_b', sex, m, r, { cord }, { sleeve: sleeve || 'short' }, go));
      const strap = scene.layers.find(l => l.id === `${garment}-epaulet-plain`);
      assert.ok(strap, `${garment} ${r}: plain strap drawn`);
      assert.equal(strap.role, 'garment-layer');
      if(cord){
        const c = scene.layers.find(l => /-cord-/.test(l.id || ''));
        assert.ok(c, `${garment} ${r}: cord drawn`);
        assert.ok(strap.z > c.z, `${garment} ${r}: strap (z ${strap.z}) above the cord (z ${c.z})`);
      }
      assert.equal(scene.layers.filter(l => l.role === 'epaulet-top').length, 0, `${garment} ${r}: no top-down view (no grade on the strap)`);
      assert.ok(!(scene.notes || []).some(n => /No artwork/.test(n)), `${garment} ${r}: no missing artwork`);
    }
  }
});

test('Class B shirt and blouse: officers and cadet officers wear the epaulet sleeve, not the plain strap', async () => {
  for(const [sex, sleeve, garment] of CLASS_B){
    for(const [m, r, id] of [['senior', 'Capt', 'officer'], ['cadet', 'C/Maj', 'cadet-officer']]){
      const scene = await compose(build('blues_b', sex, m, r, {}, { sleeve: sleeve || 'short' }));
      // LIVE7-2: the slide-on sleeve is drawn edge-on from the sleeve art (epauletStrips), the sheet's own strip overlay is left unused.
      assert.equal(scene.layers.filter(l => l.role === 'epaulet').length, 2, `${garment} ${r}: sleeve strips`);
      assert.equal(scene.layers.filter(l => l.id === `${garment}-epaulet-sleeve-${id}`).length, 0, `${garment} ${r}: the sheet's strip overlay is unused`);
      assert.equal(scene.layers.filter(l => l.id === `${garment}-epaulet-plain`).length, 0, `${garment} ${r}: no plain strap under the sleeve`);
    }
  }
});

test('Class B plain strap: the layer lies on the garment sheet epaulet polygons (same box, strap inside the shoulder)', async () => {
  for(const [sex, sleeve, garment] of CLASS_B){
    const spec = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', `${garment}-epaulet-plain.spec.json`), 'utf8'));
    const base = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', `${garment}.spec.json`), 'utf8'));
    assert.deepEqual(spec.size_in, base.size_in, `${garment}: same box as the garment`);
    for(const t of ['right', 'left']){
      const lm = base.landmarks['epaulet_' + t], r = spec.landmarks['epaulet_plain_' + t];
      const xs = lm.map(p => p[0]), ys = lm.map(p => p[1]);
      assert.ok(Math.abs(r.x - Math.min(...xs)) < 1 && Math.abs(r.w - (Math.max(...xs) - Math.min(...xs))) < 1 && Math.abs(r.y - Math.min(...ys)) < 1 && Math.abs(r.h - (Math.max(...ys) - Math.min(...ys))) < 1, `${garment} ${t}: strap box = epaulet polygon box`);
    }
  }
});

// ---- 4. Mess dress: the white chevron lies on the widened sleeve, placed from the sheet's anchors ---------------

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const spec = id => JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', id + '.spec.json'), 'utf8'));
// The sheet's drawn silhouette as polygons in scene inches (the sheet's clipSil path, user units 0.01 in under the art transform).
function silhouette(id){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', id + '.svg'), 'utf8');
  const tr = svg.match(/<g id="[^"]*__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)"/);
  const d = svg.match(/<clipPath id="[^"]*__clipSil"><path d="([^"]+)"/)[1];
  const tx = +tr[1] / 100, ty = +tr[2] / 100, k = +tr[3] / 100;
  return d.split('M').filter(Boolean).map(sub => {
    const n = sub.replace(/Z/g, '').split('L').map(p => p.split(',').map(Number));
    return n.map(([x, y]) => ({ x: tx + x * k, y: ty + y * k }));
  });
}
const inSil = (pt, polys) => polys.reduce((c, poly) => {
  let inn = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if(((a.y > pt.y) !== (b.y > pt.y)) && (pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x)) inn = !inn;
  }
  return inn ? !c : c;
}, false);

for(const sex of ['male', 'female']){
  test(`mess dress ${sex}: the sleeve chevron hangs on the sleeve's outer edge at the chevron_halfway height, and the sheet states a clear fit (4.1.1.1.1.4, 4.1.2.1.1.4)`, async () => {
    const garment = `garment-mess-dress-${sex}`, sp = await store.load(garment), fit = spec(garment).dimensions.sleeve_widening.chevron_fit;
    const sil = silhouette(garment);
    const opts = sex === 'female' ? [{ chevron: '4' }, { chevron: '3.5' }] : [{}];
    for(const opt of opts) for(const rank of ['SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt']){
      const scene = await compose(build('mess_dress', sex, 'senior', rank, {}, opt));
      const w = opt.chevron === '3.5' ? 3.5 : 4;
      for(const side of ['right', 'left']){
        const l = scene.layers.find(x => x.key === 'grade:sleeve-' + side);
        assert.ok(l, `${sex} ${rank} ${side}: chevron drawn`);
        // D8 (SLEEVE1, Ethan: "hanging off the side like they do in the utilities"): the chevron is centred on the sleeve's outer edge at the chevron_halfway height, narrowed to half and turned along the edge,
        // cut to the sheet's silhouette; it used to be centred on chevron_halfway at the true width, turned by the seam-to-elbow line.
        const c = core.anchor(sp, 'chevron_halfway_' + side), edge = EDGE[garment][side];
        near(l.y + l.h / 2, c.y, 0.01, `${sex} ${rank} ${side}: at the chevron_halfway height`);
        near(l.x + l.w / 2, edge[1][0], 0.01, `${sex} ${rank} ${side}: centred on the sleeve's outer edge`);
        near(l.w, w * 0.5, 0.01, `${sex} ${rank} ${side}: the regulation ${w} in chevron seen edge-on`);
        near(l.rotate, Math.atan2(-(edge[2][0] - edge[0][0]), edge[2][1] - edge[0][1]) * 180 / Math.PI, 0.01, `${sex} ${rank} ${side}: turned along the outer edge`);
        assert.equal(l.clipSil, garment, `${sex} ${rank} ${side}: cut to the silhouette`);
        const f = fit[side][opt.chevron === '3.5' ? '3p5' : '4'];
        assert.ok(f.outer_clearance_in >= 0.05 && f.seam_clearance_in >= 0.05, `${sex} ${side} ${w} in: the ink clears the outline by ${f.outer_clearance_in} in and the seam by ${f.seam_clearance_in} in`);
      }
    }
  });
}

test('mess dress: no literal chevron points are left (the sheets state shoulder_seam, elbow, sleeve_bottom and chevron_halfway on both sleeves)', () => {
  for(const sex of ['male', 'female']){
    const sp = spec(`garment-mess-dress-${sex}`);
    for(const side of ['right', 'left']) for(const k of ['shoulder_seam_', 'elbow_', 'sleeve_bottom_', 'chevron_halfway_']) assert.ok(sp.anchors[k + side], `${sex}: ${k}${side}`);
    near(sp.anchors.chevron_halfway_right[1], sp.anchors.chevron_halfway_left[1], 1, `${sex}: chevrons at one height`);
  }
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  assert.ok(!/chev:\s*\{\s*right:\s*\[2\.(61|57)/.test(src), 'MESS.chev constants removed');
});

// ---- 7. OCP: the CAP specialty track badges have NO field form (LIVE-FIELD B6, Ethan: dress enamel art never appears on a field uniform) ----
// ff66b8ac pointed the 56 specialty track badges at '<dress>-field' recolours of the enamel art; those recolours (ESTIMATED size, derived
// from the dress art, not a measured OCP badge) are not field artwork, so the catalog names none and a field uniform neither offers nor draws them.

test('the specialty family badges have no field form: the OCP does not draw them and says so, and nothing from enamel dress art is drawn (7.1.1.3.1)', async () => {
  const CAT = require('../data/badge-catalog.js');
  const ids = Object.entries(CAT.BADGES).filter(([, v]) => v.family === 'specialty').map(([k]) => k);
  assert.ok(ids.length >= 56, `${ids.length} specialty badges`);
  for(const id of ids){
    assert.equal(CAT.art(id, 'field'), null, `${id}: no field form`);
    assert.equal(CAT.hasField(id), false, id);
    assert.ok(CAT.art(id, 'dress'), `${id}: still a dress badge`);
  }
  for(const id of ['communications_technician_badge', 'aerospace_education_senior_badge', 'cadet_programs_master_badge', 'safety_technician_badge', 'emergency_services_badge']){
    const scene = await compose(build('ocp', 'male', 'senior', 'Capt', { badges: [{ id }] }));
    assert.ok(!scene.layers.find(l => l.key === 'badge:' + id), `${id} not drawn on the OCP`);
    assert.ok(!scene.layers.some(l => /^enamel-/.test(l.id || '')), `${id}: no enamel art on the OCP`);
    assert.ok((scene.notes || []).some(n => /cannot be shown on this uniform/.test(n)), `${id}: the note says why`);
  }
});
