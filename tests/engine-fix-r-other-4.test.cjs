'use strict';
// FIX-R-OTHER-r2 review round 4 findings (engine side). One block per finding.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const NAME = { first: 'Pat', last: 'Doe', show: true };
const PILOT = 'CAPPilot1_FA9D33EA587D8';
// A harness build (the same ids the page and the critique set use).
const hb = (uniform, gender, membership, rank, o) => HARNESS.makeBuild(Object.assign({ uniform, gender, membership, rank, name: NAME, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } }, o || {}));
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const badgeLayers = scene => scene.layers.filter(l => l.role === 'badge' && l.figure !== 2);

// ---- 3. Women's badge pair over the nametag: the first badge is nearest the collar ----------------------------

test('women\'s Class A and Class B: the first badge over the nametag is nearest the collar, the second to the wearer\'s right (4.1.9.4.4.2, 4.1.12.2.5.2)', async () => {
  for(const uniform of ['blues_a', 'blues_b']){
    const scene = await compose(hb(uniform, 'female', 'senior', 'Capt', { badgeIds: [PILOT, 'emergency_services_badge', 'communications_technician_badge'] }));
    const es = byKey(scene, 'badge:emergency_services_badge'), comms = byKey(scene, 'badge:communications_technician_badge');
    assert.ok(es && comms, `${uniform}: both specialty badges drawn`);
    // The wearer's right is the picture's left: the second badge has the smaller x.
    assert.ok(es.x > comms.x, `${uniform}: first badge (ES, x ${es.x}) is on the collar side of the second (Comms, x ${comms.x})`);
    near(es.x - (comms.x + comms.w), 0.5, 0.005, `${uniform}: 1/2 in apart`);
  }
});

test('women\'s pair: a CAP service badge is closest to the collar and National Staff to the wearer\'s right of a second badge, whatever the order the member listed (4.1.9.4.4.2, 4.1.12.2.5.2)', async () => {
  for(const uniform of ['blues_a', 'blues_b']){
    for(const order of [['emergency_services_badge', 'volunteer_university_instructor_badge'], ['volunteer_university_instructor_badge', 'emergency_services_badge']]){
      const scene = await compose(hb(uniform, 'female', 'senior', 'Capt', { badgeIds: order }));
      const vu = byKey(scene, 'badge:volunteer_university_instructor_badge'), es = byKey(scene, 'badge:emergency_services_badge');
      assert.ok(vu && es, `${uniform} ${order}: both drawn`);
      assert.ok(vu.x > es.x, `${uniform} ${order}: the service badge is the collar side`);
    }
    const scene = await compose(hb(uniform, 'female', 'senior', 'Capt', { badgeIds: ['emergency_services_badge', 'national_staff_badge'] }));
    const ns = byKey(scene, 'badge:national_staff_badge'), es = byKey(scene, 'badge:emergency_services_badge');
    assert.ok(ns && es && ns.x < es.x, `${uniform}: National Staff is to the wearer's right of the second badge`);
  }
});

// ---- 9. Flight garments: the turned officer grade stays inside its zone's top ---------------------------------

test('flight suits and jackets: no senior officer\'s turned cloth grade rises above the grade zone, a piece taller than the zone hangs from its top, the seam-side edge stays on the 1/2 in line (8.2.3.2, 8.3.3.2, 8.3.5.1)', async () => {
  const cases = [['flight_suit', {}], ['corporate_flight_suit', {}], ['flight_suit', { jacket: 'green' }], ['corporate_flight_suit', { jacket: 'blue' }]];
  let checked = 0, tall = 0;
  for(const [uniform, o] of cases){
    for(const rank of ['2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col', 'FO', 'TFO', 'SFO']){
      for(const gender of ['male', 'female']){
        const scene = await compose(hb(uniform, gender, 'senior', rank, { opt: Object.assign({ headgear: 'auto' }, o) }));
        const sheets = scene.layers.filter(x => x.role === 'garment');
        for(const l of scene.layers.filter(x => /^grade:(right|left)$/.test(x.key || ''))){
          const side = l.key.split(':')[1];
          const sheet = sheets.find(x => (x.figure || 1) === (l.figure || 1));
          const spec = await store.load(sheet.id);
          const z = spec.landmarks['grade_zone_' + side];
          const box = core.layerBounds(l);
          const zx = z.x + sheet.x, zy = z.y + sheet.y;
          const id = `${uniform}${o.jacket ? '+' + o.jacket : ''} ${gender} ${rank} ${side}`;
          assert.ok(box.y >= zy - 0.005, `${id}: the grade top ${box.y.toFixed(3)} is not above the zone top ${zy.toFixed(3)}`);
          if(box.h > z.h + 0.005){ tall++; near(box.y, zy, 0.005, `${id}: a piece taller than the zone hangs from its top`); }
          else assert.ok(box.y + box.h <= zy + z.h + 0.005, `${id}: a piece that fits stays in the zone`);
          // The seam side (the sleeve side of the zone) is the half inch line.
          if(side === 'right') near(box.x, zx, 0.005, `${id}: seam-side edge on the zone's seam line`);
          else near(box.x + box.w, zx + z.w, 0.005, `${id}: seam-side edge on the zone's seam line`);
          // And the whole piece is on the garment sheet.
          assert.ok(box.x >= sheet.x && box.x + box.w <= sheet.x + sheet.w && box.y >= sheet.y && box.y + box.h <= sheet.y + sheet.h, `${id}: inside the sheet`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked >= 150 && tall >= 8, `checked ${checked} grades, ${tall} taller than the zone (the colonel's eagles)`);
});

// ---- 6. Overlay: a measure inside a cap view is drawn beside that view ----------------------------------------

const ML = require('../js/engine/measure-layout.js');
async function laidOut(b){
  const scene = await compose(b);
  const B = scene.bounds;
  const vb = [B.x - 0.4, B.y - 0.4, B.w + 0.8, B.h + 0.8];
  const px = ML.previewPx(vb);
  const area = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  return { scene, drawings: ML.layout(scene, { px, area }) };
}
const gap1 = (p, r) => Math.hypot(Math.max(r.x - p.x, 0, p.x - (r.x + r.w)), Math.max(r.y - p.y, 0, p.y - (r.y + r.h)));
const segIn = (a, b, r) => { // does segment a-b run through box r by more than a hair?
  const d = { x: b.x - a.x, y: b.y - a.y };
  let t0 = 0, t1 = 1;
  for(const [p, q] of [[-d.x, a.x - r.x], [d.x, r.x + r.w - a.x], [-d.y, a.y - r.y], [d.y, r.y + r.h - a.y]]){
    if(p === 0){ if(q < 0) return false; continue; }
    const t = q / p;
    if(p < 0){ if(t > t1) return false; if(t > t0) t0 = t; } else { if(t < t0) return false; if(t < t1) t1 = t; }
  }
  return (t1 - t0) * Math.hypot(d.x, d.y) > 0.01;
};

test('overlay: the 1/2 in measure of a cap view\'s grade is drawn beside that view, not beside another cap view (7.1.1.8, 6.2.11.1; D26)', async () => {
  let checked = 0;
  for(const uniform of ['ocp', 'abu', 'corporate_field']){
    for(const gender of ['male', 'female']){
      for(const [membership, rank] of [['senior', 'Capt'], ['senior', 'Lt Col'], ['senior', 'Col'], ['cadet', 'C/Capt'], ['cadet', 'C/Maj']]){
        const { scene, drawings } = await laidOut(hb(uniform, gender, membership, rank, { opt: { headgear: 'auto', overlay: true } }));
        const views = scene.layers.filter(l => (l.role === 'hat' || l.role === 'hat-view') && l.obstacle).map(l => ({ key: l.key, box: l.obstacle }));
        for(const m of scene.layers.filter(l => l.type === 'measure')){
          const mid = { x: (m.from.x + m.to.x) / 2, y: (m.from.y + m.to.y) / 2 };
          const owner = views.find(v => mid.x >= v.box.x && mid.x <= v.box.x + v.box.w && mid.y >= v.box.y && mid.y <= v.box.y + v.box.h);
          if(!owner) continue;
          const d = drawings.find(x => x.key === m.key);
          assert.ok(d, `${uniform} ${gender} ${rank}: ${m.key} drawn`);
          const id = `${uniform} ${gender} ${rank} ${m.key} in ${owner.key}`;
          // The dimension line is within an inch of its own view.
          for(const p of d.dim) assert.ok(gap1(p, owner.box) <= 1, `${id}: the dimension is ${gap1(p, owner.box).toFixed(2)} in from its view`);
          // And nothing of it (dimension, extension lines, label) lies over another view.
          for(const other of views.filter(v => v !== owner)){
            assert.ok(!segIn(d.dim[0], d.dim[1], other.box), `${id}: the dimension runs over ${other.key}`);
            for(const [p, q] of d.ext) assert.ok(!segIn(p, q, other.box), `${id}: an extension line runs over ${other.key}`);
            const L = d.label;
            const ov = Math.min(L.x + L.w, other.box.x + other.box.w) - Math.max(L.x, other.box.x) > 0 && Math.min(L.y + L.h, other.box.y + other.box.h) - Math.max(L.y, other.box.y) > 0;
            assert.ok(!ov, `${id}: the label lies over ${other.key}`);
          }
          checked++;
        }
      }
    }
  }
  assert.ok(checked >= 20, `${checked} measures inside a cap view checked`);
});
