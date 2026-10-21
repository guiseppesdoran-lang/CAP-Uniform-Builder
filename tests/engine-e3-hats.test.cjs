'use strict';
// E3-HATS: the cap follows the member's cut and grade, sits on the collar, and carries the right device
// on its device slot (CAPR 39-1 6.2.1, 6.2.2, ICL 25-02 (g)). One matrix: grade class x cap x cut on
// every uniform that draws a cap.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
const { Z } = require('../js/engine/compose.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const read = p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8')));
const store = loader => core.createSpecStore(manifest, loader || read);
const EPS = 0.006;
const H = P.helpers;

function build(uniform, gender, membership, rank, headgear, track){
  return {
    uniform, gender, grade: G.gradeInfo(membership, rank, { track }),
    opt: { headgear },
    name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  };
}
const byRole = (scene, role) => scene.layers.filter(l => l.role === role);
const near = (a, b, msg) => assert.ok(Math.abs(a - b) <= EPS, `${msg}: ${a} vs ${b}`);

// What each grade class wears. `flight` / `service` give the cap id for a man ('men') and a woman
// ('women'), and the device; service is null where the class has no service cap (6.2.1.1).
const FLIGHT = (mid, dev) => ({ men: mid.men, women: mid.women, device: dev });
const CLASSES = [
  { name: 'cadet NCO (C/SSgt)', m: 'cadet', r: 'C/SSgt',
    flight: FLIGHT({ men: 'hat-flight-cap-men-cadet', women: 'hat-flight-cap-cadet' }, 'cap-device-nco-flight'), service: null },
  { name: 'cadet officer (C/Maj)', m: 'cadet', r: 'C/Maj',
    flight: FLIGHT({ men: 'hat-flight-cap-men-cadet', women: 'hat-flight-cap-cadet' }, 'rank-cadet-officer-major-metal-regular'),
    service: { men: 'hat-service-cap-men-cadet-officer', women: 'hat-service-cap-women-cadet-officer', device: 'cap-device-cadet-officer-service' } },
  { name: 'senior NCO (SMSgt)', m: 'senior', r: 'SMSgt',
    flight: FLIGHT({ men: 'hat-flight-cap-men-cadet', women: 'hat-flight-cap-cadet' }, 'cap-device-nco-flight'),
    service: { men: 'hat-service-cap-men-officer-nco', women: 'hat-service-cap-women-officer-nco', device: 'cap-device-nco-flight' } },
  { name: 'company grade (Capt)', m: 'senior', r: 'Capt',
    flight: FLIGHT({ men: 'hat-flight-cap-men-officer', women: 'hat-flight-cap-officer' }, 'cap-device-officer-flight'),
    service: { men: 'hat-service-cap-men-officer-nco', women: 'hat-service-cap-women-officer-nco', device: 'cap-device-officer-service' } },
  { name: 'field grade (Maj)', m: 'senior', r: 'Maj',
    flight: FLIGHT({ men: 'hat-flight-cap-men-officer', women: 'hat-flight-cap-officer' }, 'cap-device-officer-flight'),
    service: { men: 'hat-service-cap-men-field-grade', women: 'hat-service-cap-women-field-grade', device: 'cap-device-officer-service' } },
  { name: 'general (Maj Gen)', m: 'senior', r: 'Maj Gen',
    flight: FLIGHT({ men: 'hat-flight-cap-men-general', women: 'hat-flight-cap-general' }, 'cap-device-officer-flight'),
    service: { men: 'hat-service-cap-men-general', women: 'hat-service-cap-women-general', device: 'cap-device-officer-service' } }
];

async function hatAndDevice(b, st){
  const scene = await P.composeUniform(b, st || store());
  const hats = byRole(scene, 'hat'), devices = byRole(scene, 'hat-device');
  return { scene, hat: hats[0] || null, device: devices[0] || null, hats, devices };
}

// The garment the scene is built on and its anchor, in scene inches.
async function garmentAnchor(scene, name, st){
  const base = scene.layers.find(l => l.role === 'garment');
  const spec = await (st || store()).load(base.id);
  const a = core.anchor(spec, name);
  return a && { x: base.x + a.x, y: base.y + a.y };
}

const UNIFORMS = ['blues_a', 'blues_b', 'flight_suit'];

for(const uniform of UNIFORMS){
  for(const gender of ['male', 'female']){
    for(const cls of CLASSES){
      const hatKinds = uniform === 'flight_suit' ? ['auto'] : ['auto', 'service'];
      for(const kind of hatKinds){
        const service = kind === 'service' && cls.service;
        const want = service ? cls.service : cls.flight;
        const cut = gender === 'female' ? 'women' : 'men';
        test(`${uniform} ${gender} ${cls.name}, headgear ${kind}: ${service ? 'service' : 'flight'} cap in the ${cut}'s cut with the right device on its slot`, async () => {
          const st = store();
          const { scene, hat, device } = await hatAndDevice(build(uniform, gender, cls.m, cls.r, kind), st);
          assert.ok(hat, 'a cap is drawn');
          assert.equal(hat.id, want[cut], `the ${cut}'s cap`);
          // The figure is under the cap; only the epaulet views from above lie over the cap's corners (see below).
          assert.ok(hat.z > Math.max(...scene.layers.filter(l => !/^(hat|measure)/.test(l.role || '') && l.role !== 'epaulet-top' && !/^grade:top-/.test(l.key || '')).map(l => l.z)), 'cap on top of the figure');
          assert.ok(device, 'the cap carries a device');
          assert.equal(device.id, want.device);
          assert.ok(device.z > hat.z, 'device over the cap');
          // The device's mount_center sits on the cap's device_slot_center (R6).
          const hs = await st.load(hat.id), ds = await st.load(device.id);
          const slot = H.piecePoint(hat, hs, 'device_slot_center');
          const mount = H.piecePoint(device, ds, core.anchor(ds, 'mount_center') ? 'mount_center' : 'center');
          near(mount.x, slot.x, 'device x on the slot');
          near(mount.y, slot.y, 'device y on the slot');
          // The cap's size is its own art's size (no scaling by the engine).
          near(hat.w, hs.w, 'cap width');
          near(hat.h, hs.h, 'cap height');
        });
      }
    }
  }
}

test('the cap sits on the sheet\'s hat_attach landmark, else on top_center lowered 0.25 in unless the cap art already carries its seating', async () => {
  for(const [uniform, gender] of [['blues_a', 'male'], ['blues_a', 'female'], ['blues_b', 'male'], ['blues_b', 'female'], ['flight_suit', 'male']]){
    for(const [rank, kind] of [['Capt', 'auto'], ['Maj', 'service'], ['Maj Gen', 'auto']]){
      const st = store();
      const { scene, hat } = await hatAndDevice(build(uniform, gender, 'senior', rank, kind), st);
      const hs = await st.load(hat.id);
      const attach = H.piecePoint(hat, hs, 'garment_attach_center');
      // A sheet with its own hat_attach landmark (the FDU: its box carries 2.66 in of margin above the collar)
      // decides the seat; the others seat on top_center.
      const own = await garmentAnchor(scene, 'hat_attach', st);
      const top = own || await garmentAnchor(scene, 'top_center', st);
      const seated = !!(hs.raw && hs.raw.attach_overlap);
      near(attach.x, top.x, `${uniform} ${gender} ${hat.id} centred on the garment`);
      near(attach.y, top.y + (seated || own ? 0 : 0.25), `${uniform} ${gender} ${hat.id} seat`);
      // Worn: the cap's bottom edge is below the collar top (no gap); a flight cap sinks no more than 1 in into the garment
      // (a service cap's visor hangs lower).
      const collar = own || await garmentAnchor(scene, 'top_center', st);
      assert.ok(hat.y + hat.h >= collar.y - EPS && (!/^hat-flight/.test(hat.id) || hat.y + hat.h <= collar.y + 1), `${uniform} ${gender} ${hat.id}: cap bottom ${hat.y + hat.h} vs collar top ${collar.y}`);
    }
  }
});

test('a garment that draws a hat_attach landmark decides where the cap sits', async () => {
  const loader = async p => {
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'));
    if(/garment-blues-class-a-coat-female\.spec\.json$/.test(p)){
      raw.anchors = Object.assign({}, raw.anchors, { hat_attach: [raw.anchors.top_center[0], raw.anchors.top_center[1] + 61] });
    }
    return raw;
  };
  const st = store(loader);
  const { scene, hat } = await hatAndDevice(build('blues_a', 'female', 'senior', 'Capt', 'auto'), st);
  const hs = await st.load(hat.id);
  const attach = H.piecePoint(hat, hs, 'garment_attach_center');
  const lm = await garmentAnchor(scene, 'hat_attach', st);
  assert.ok(lm, 'the landmark is on the garment');
  near(attach.x, lm.x, 'x on the landmark');
  near(attach.y, lm.y, 'y on the landmark');
});

test('a service cap is not offered to a cadet NCO: the flight cap with the NCO device', async () => {
  for(const gender of ['male', 'female']){
    const { hat, device } = await hatAndDevice(build('blues_a', gender, 'cadet', 'C/SSgt', 'service'));
    assert.match(hat.id, /^hat-flight-cap-/);
    assert.equal(device.id, 'cap-device-nco-flight');
  }
});

test('headgear none draws no cap', async () => {
  for(const uniform of UNIFORMS){
    const { hats, devices } = await hatAndDevice(build(uniform, 'male', 'senior', 'Capt', 'none'));
    assert.equal(hats.length + devices.length, 0, uniform);
  }
});

test('members without grade wear the flight cap of their track (1.4.1.1, 1.4.2.1), the same on the Class A and the FDU', async () => {
  for(const uniform of ['blues_a', 'blues_b', 'flight_suit']){
    for(const gender of ['male', 'female']){
      const off = await hatAndDevice(build(uniform, gender, 'senior', 'SM', 'auto', 'officer'));
      assert.equal(off.hat.id, gender === 'female' ? 'hat-flight-cap-officer' : 'hat-flight-cap-men-officer', `${uniform} ${gender} officer track`);
      assert.equal(off.device.id, 'cap-device-officer-flight');
      const nco = await hatAndDevice(build(uniform, gender, 'senior', 'SM', 'auto', 'nco'));
      assert.equal(nco.hat.id, gender === 'female' ? 'hat-flight-cap-cadet' : 'hat-flight-cap-men-cadet', `${uniform} ${gender} NCO track`);
      assert.equal(nco.device, null, 'no device before an NCO grade');
    }
  }
});

test('no flight cap with the corporate flight suit (8.3.8)', async () => {
  const { hats } = await hatAndDevice(build('corporate_flight_suit', 'male', 'senior', 'Capt', 'auto'));
  assert.equal(hats.length, 0);
});

// The cap seats on the collar (6.2.2) and, where it is as wide as the neck opening, its corners reach the
// epaulet or shoulder-board views from above. R7 wants both views to show, so the views are drawn over the cap
// and over its device: a partly covered 'CAP' lettering or slide edge is a failure.
const boxOf = l => {
  const c = { x: l.x + l.w / 2, y: l.y + l.h / 2 };
  const pts = [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, c, l.rotate || 0));
  return { x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)), y1: Math.max(...pts.map(p => p.y)) };
};
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

test('the epaulet-view layers are above every cap layer in the draw order (R7)', () => {
  assert.ok(Z.epauletTop > Z.hatDevice && Z.epauletTopGrade > Z.epauletTop);
});

for(const uniform of ['blues_a', 'blues_b']){
  for(const gender of ['male', 'female']){
    for(const [m, r] of [['cadet', 'C/Maj'], ['senior', 'Capt'], ['senior', 'Maj Gen']]){
      for(const kind of ['auto', 'service']){
        test(`${uniform} ${gender} ${r}, headgear ${kind}: no cap layer covers an epaulet view from above (R7, 6.2.2)`, async () => {
          const { scene } = await hatAndDevice(build(uniform, gender, m, r, kind));
          const tops = byRole(scene, 'epaulet-top');
          const caps = scene.layers.filter(l => l.role === 'hat' || l.role === 'hat-device');
          assert.ok(caps.length >= 1, 'a cap is drawn');
          for(const t of tops){
            for(const c of caps){
              if(overlaps(boxOf(t), boxOf(c))) assert.ok(t.z > c.z, `${t.key} (z ${t.z}) over ${c.key} (z ${c.z})`);
            }
            // The grade drawn on the view (mirrored eagle, board rank slot) goes with it.
            for(const g of scene.layers.filter(l => /^grade:top-/.test(l.key || ''))) assert.ok(g.z > Math.max(...caps.map(c => c.z)), `${g.key} over the cap`);
          }
          if(uniform === 'blues_b') assert.equal(tops.length, 2, 'both top-down views on the Class B');
        });
      }
    }
  }
}
