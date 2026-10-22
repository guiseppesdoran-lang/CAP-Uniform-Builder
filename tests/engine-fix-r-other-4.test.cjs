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
