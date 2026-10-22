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
const RIB = [['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];
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

// ---- 4. Corporate Semi-Formal: the miniature rack and the chaplain badge stay centred over the crest ---------------

test('semi-formal blazers: the miniature rack is centred on the crest and the chaplain badge on the sheet\'s chaplain anchor, 7 and 12 miniatures, every grade (4.2.1.4, 4.2.1.5, 4.2.2.4, 4.2.2.5, ICL 25-02)', async () => {
  const sevenIds = [['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];
  const twelveIds = [['distinguished_service_award'], ['exceptional_service_award'], ['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'], ['air_search_and_rescue_ribbon'], ['cap_gill_robb_wilson_ribbon'], ['cap_command_service_ribbon'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];
  let checked = 0;
  for(const sex of ['male', 'female']){
    const spec = await store.load(`garment-corporate-service-dress-blazer-${sex}`);
    const crest = core.anchor(spec, 'crest_center'), chap = core.anchor(spec, 'chaplain_badge_semiformal'), pocket = core.landmarkBounds(spec, 'breast_pocket');
    for(const [label, ids, cols] of [['7', sevenIds, 3], ['12', twelveIds, sex === 'male' ? 4 : 3]]){
      for(const rank of ['SMSgt', 'Capt', 'Col', 'Maj Gen']){
        const scene = await compose(hb('semi_formal', sex, 'senior', rank, { ribbonSel: ids, medalSel: true, badgeIds: ['christian_chaplin'], opt: { rackColumns: cols, rackArrangement: 'lapel', miniStyle: 'mounting' } }));
        const parts = scene.layers.filter(l => l.role === 'mini-drape' || l.role === 'mini-medal');
        assert.ok(parts.length >= Number(label), `${sex} ${label} ${rank}: minis drawn`);
        // The lowest row (the drapes at the greatest y) is centred on the crest.
        const all = parts.filter(l => l.role === 'mini-drape');
        const lowDrapeY = Math.max(...all.map(l => l.y));
        const lowest = all.filter(l => Math.abs(l.y - lowDrapeY) < 0.01);
        const cx = (Math.min(...lowest.map(l => l.x)) + Math.max(...lowest.map(l => l.x + l.w))) / 2;
        near(cx, crest.x, 0.02, `${sex} ${label} ${rank}: the lowest row is centred on the crest`);
        if(sex === 'male'){ assert.ok(pocket, 'the men\'s sheet states the breast pocket'); assert.ok(Math.max(...all.map(l => l.x + l.w)) <= pocket.x + pocket.w + 0.001, `${sex} ${label} ${rank}: the rack does not pass the pocket's right edge`); }
        const ch = byKey(scene, 'badge:christian_chaplin');
        assert.ok(ch, `${sex} ${label} ${rank}: chaplain badge drawn`);
        near(ch.x + ch.w / 2, chap.x, 0.02, `${sex} ${label} ${rank}: chaplain badge on chaplain_badge_semiformal`);
        near(ch.y + ch.h, Math.min(...all.map(l => l.y)) - 0.5, 0.02, `${sex} ${label} ${rank}: 1/2 in above the top row`);
        checked++;
      }
    }
  }
  assert.equal(checked, 16);
});

// ---- 5. Shirts: the collar lies over every badge that reaches it, on the companion shirt figure too ------------

const C = require('../js/engine/compose.js');
test('aviator and Class B shirts, the aviator beside the blazer included: every badge, ribbon or device that reaches a collar leaf is cut out by the leaf polygons where the leaf really is (4.2.5.1.3.1, 4.1.11.1.1.2.3.1)', async () => {
  const builds = [];
  for(const gender of ['male', 'female']){
    for(const rank of ['Capt', 'Col']){
      builds.push(['aviator_blazer', gender, rank, [PILOT, 'observer_badge', 'christian_chaplin']]);
      builds.push(['aviator', gender, rank, [PILOT, 'observer_badge', 'christian_chaplin']]);
      builds.push(['blues_b', gender, rank, [PILOT, 'emergency_services_badge', 'communications_technician_badge']]);
    }
  }
  let reached = 0;
  for(const [uniform, gender, rank, badgeIds] of builds){
    for(const sleeve of ['short', 'long']){
      const scene = await compose(hb(uniform, gender, 'senior', rank, { badgeIds, ribbonSel: RIB, opt: { headgear: 'none', sleeve, underlayer: 'shirt', femaleTop: 'shirt' } }));
      for(const sheet of scene.layers.filter(l => l.role === 'garment')){
        const spec = await store.load(sheet.id);
        const polys = ['collar_left', 'collar_right'].map(n => spec.landmarks[n]).filter(l => l && l.points).map(l => l.points.map(p => ({ x: p.x + sheet.x, y: p.y + sheet.y })));
        if(polys.length !== 2) continue;
        for(const l of scene.layers.filter(x => ['badge', 'ribbon', 'device'].includes(x.role) && (x.figure || 1) === (sheet.figure || 1) && !(x.rotate) && x.type === 'asset')){
          const touches = polys.filter(p => C.rectHitsPolygon(l, p));
          if(!touches.length) continue;
          reached++;
          const id = `${uniform} ${gender} ${rank} ${sleeve} ${l.key}`;
          assert.ok(l.clipOut && l.clipOut.length, `${id}: reaches a collar leaf, so it is cut by it`);
          // The cut-out polygons are on this figure, not on the first one.
          assert.ok(l.clipOut.some(p => C.rectHitsPolygon(l, p)), `${id}: the cut-out polygon lies where the badge is (x ${l.x.toFixed(2)})`);
        }
      }
    }
  }
  assert.ok(reached >= 4, `${reached} layers reach a collar leaf`);
});

test('aviator beside the blazer: the chaplain badge is under the shirt collar, on the shirt figure (the polygon moves with the figure)', async () => {
  const scene = await compose(hb('aviator_blazer', 'male', 'senior', 'Capt', { badgeIds: [PILOT, 'observer_badge', 'christian_chaplin'], ribbonSel: RIB }));
  const ch = scene.layers.find(l => l.key === 'badge:christian_chaplin' && l.figure === 2);
  assert.ok(ch && ch.clipOut, 'the shirt\'s chaplain badge is cut by the collar');
  for(const poly of ch.clipOut) for(const p of poly) assert.ok(p.x > 27, `cut-out point x ${p.x.toFixed(2)} is on the second figure`);
});

// ---- 1. Insignia rest on the gorge seam by their ink, not their box ----------------------------------------------

const INK = require('./helpers/ink-rest.cjs');
const COATS = { male: 'garment-blues-class-a-coat', female: 'garment-blues-class-a-coat-female' };

test('the engine\'s INK_REST table is the lower hull of the drawn ink of the current SVGs (regenerate with scripts/measure-ink-rest.cjs after an art sync)', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-dress.js'), 'utf8');
  const body = /\/\/ INK_REST begin\n([\s\S]*?)\/\/ INK_REST end/.exec(src);
  assert.ok(body, 'the table is in the engine between its markers');
  const table = new Function(body[1] + '; return INK_REST;')();
  const fresh = INK.allHulls();
  assert.deepEqual(Object.keys(table).sort(), Object.keys(fresh).sort(), 'the same pieces');
  assert.deepEqual(table, fresh, 'the same hulls');
});

test('cadet NCO metal chevrons (every grade, both cuts, Class A and semi-formal): the lowest ink rests on the gorge seam, parallel with the ground, centred on its midpoint (4.1.5.2.1.4, 4.1.9.3.5)', async () => {
  let checked = 0;
  for(const uniform of ['blues_a', 'semi_formal_usaf']){
    for(const sex of ['male', 'female']){
      const coat = await store.load(COATS[sex]);
      for(const rank of ['C/Amn', 'C/A1C', 'C/SrA', 'C/SSgt', 'C/TSgt', 'C/MSgt', 'C/SMSgt', 'C/CMSgt']){
        const scene = await compose(hb(uniform, sex, 'cadet', rank, {}));
        for(const side of ['right', 'left']){
          const l = byKey(scene, 'grade:' + side);
          assert.ok(l, `${uniform} ${sex} ${rank} ${side}: chevron drawn`);
          assert.equal(l.rotate || 0, 0, 'parallel with the ground');
          const gap = INK.placedInkGap(coat, side, l);
          near(gap, 0, 0.003, `${uniform} ${sex} ${rank} ${side}: lowest ink on the seam`);
          assert.ok(gap >= -0.001, `${uniform} ${sex} ${rank} ${side}: not over the seam (${gap.toFixed(4)})`);
          near(l.x + l.w / 2, core.anchor(coat, `gorge_seam_${side}_mid`).x, 0.005, 'centred on the seam midpoint');
          checked++;
        }
      }
    }
  }
  assert.equal(checked, 64);
});

test('the evidence builds: the cadet C/SSgt chevron box bottom is lower than before, the ink touches the seam (men 4.715 in box bottom, 0.095 in gap at the centre; women 4.13, 0.077)', async () => {
  for(const [sex, oldBottom] of [['male', 4.715], ['female', 4.13]]){
    const coat = await store.load(COATS[sex]);
    const scene = await compose(hb('blues_a', sex, 'cadet', 'C/SSgt', {}));
    const l = byKey(scene, 'grade:right');
    const bottom = l.y + l.h;
    // The shield's bottom point (the box bottom, 0.935 in down the box) is the lowest ink: it lies 0 to 0.02 in above the box edge.
    assert.ok(bottom - oldBottom > 0.01, `${sex}: the box now sits below the old rest (${bottom.toFixed(3)} vs ${oldBottom})`);
    near(INK.placedInkGap(coat, 'right', l), 0, 0.003, `${sex}: ink on the seam`);
  }
});

test('lapel US letters (officers, men and women) and cadet officer CAP letters: each lapel\'s lowest ink rests on its own seam (4.1.5.2.2.1, 4.1.9.4.1)', async () => {
  let checked = 0;
  for(const uniform of ['blues_a', 'semi_formal_usaf']){
    for(const sex of ['male', 'female']){
      const coat = await store.load(COATS[sex]);
      for(const [membership, rank, sheet] of [['senior', 'Capt', 'lapel-us'], ['senior', 'Col', 'lapel-us'], ['senior', 'Maj Gen', 'lapel-us'], ['cadet', 'C/Maj', 'lapel-cap'], ['cadet', 'C/Col', 'lapel-cap']]){
        if(uniform === 'semi_formal_usaf' && membership === 'senior') continue; // the semi-formal is a cadet uniform
        const scene = await compose(hb(uniform, sex, membership, rank, {}));
        const id = `${COATS[sex]}-${sheet}`;
        for(const side of ['right', 'left']){
          const l = scene.layers.find(x => x.id === id && (side === 'left' ? x.key.endsWith(':left') : !x.key.endsWith(':left')));
          assert.ok(l, `${uniform} ${sex} ${rank} ${side}: letters drawn`);
          assert.deepEqual(l.onlyGroups, [`${sheet}-${side}`], 'one side per layer');
          const gap = INK.overlayInkGap(coat, side, l);
          near(gap, 0, 0.003, `${uniform} ${sex} ${rank} ${side}: lowest ink of the letters on the seam`);
          assert.ok(gap >= -0.001, `${uniform} ${sex} ${rank} ${side}: not over the seam (${gap.toFixed(4)})`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked >= 28, String(checked));
});

test('the CAP collar insignia of an adult on the NCO track rests by its ink too', async () => {
  for(const sex of ['male', 'female']){
    const coat = await store.load(COATS[sex]);
    const scene = await compose(hb('blues_a', sex, 'senior', 'SM', { opt: { headgear: 'auto', noGradeTrack: 'nco' } }));
    for(const side of ['right', 'left']){
      const l = byKey(scene, 'collar:' + side);
      assert.ok(l, `${sex} ${side}: CAP collar insignia drawn`);
      near(INK.placedInkGap(coat, side, l), 0, 0.003, `${sex} ${side}: collar insignia ink on the seam`);
    }
  }
});


// ---- 7. ABU and CFU: the figure's arms carry the chevron and sleeve patch edge-on ---------------------------------

const ARM = require('../scripts/measure-arm-edge.cjs');
test('the engine\'s ARM_EDGE table is the outline of the arms of the current ABU and CFU sheets (regenerate with scripts/measure-arm-edge.cjs)', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'profiles-field.js'), 'utf8');
  const body = /\/\/ ARM_EDGE begin\n([\s\S]*?)\/\/ ARM_EDGE end/.exec(src);
  assert.ok(body);
  assert.deepEqual(new Function(body[1] + '; return ARM_EDGE;')(), ARM.compute());
});

const distToPolyline = (p, poly) => Math.min(...poly.slice(1).map((b, i) => {
  const a = poly[i], dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a[0] + t * dx), p.y - (a[1] + t * dy));
}));

test('ABU and CFU, senior NCO chevrons and shoulder patches: the figure\'s arms carry them edge-on, centred on the arm\'s outer edge, narrowed, turned with the edge and cut to the coat (5.1.1.1.1.2, 5.2.1.1.1.3, 5.1.1.1.2.2, 5.2.1.1.2.2-3; D22, D42)', async () => {
  const table = ARM.compute();
  const patch = { id: 'archer_ocp_patch', kind: 'general', img: 'patches/ocp/archer_ocp_patch.webp', slot: 'L_SHOULDER', label: 'ARCHER' };
  for(const [uniform, sheet] of [['abu', 'garment-abu-coat'], ['corporate_field', 'garment-cfu-coat']]){
    for(const gender of ['male', 'female']){
      const scene = await compose(hb(uniform, gender, 'senior', 'SMSgt', { patchRefs: [patch], badgeIds: [PILOT] }));
      const spec = await store.load(sheet);
      for(const side of ['right', 'left']){
        const flat = byKey(scene, `grade:sleeve-${side}`), edge = byKey(scene, `grade:sleeve-${side}:edge`);
        const id = `${uniform} ${gender} ${side}`;
        assert.ok(flat && edge, `${id}: the chevron on the flat sleeve and edge-on on the arm`);
        assert.equal(edge.clipSil, sheet, `${id}: cut to the coat silhouette`);
        near(edge.w, flat.w * 0.5, 0.001, `${id}: narrowed to half`);
        near(edge.h, flat.h, 0.001, `${id}: not shortened`);
        const centre = { x: edge.x + edge.w / 2, y: edge.y + edge.h / 2 };
        assert.ok(distToPolyline(centre, table[sheet][side]) < 0.05, `${id}: centred on the arm's outer edge (${centre.x.toFixed(2)}, ${centre.y.toFixed(2)})`);
        // Turned with the edge: clockwise on the wearer's right arm (the picture's left, the edge runs down and out to the left), the other way on the left.
        assert.ok(side === 'right' ? edge.rotate > 3 && edge.rotate < 25 : edge.rotate < -3 && edge.rotate > -25, `${id}: turn ${edge.rotate.toFixed(1)} deg follows the edge`);
        // The same distance down the sleeve: the chevron's centre lies about the arm's own length fraction below the seam.
        const seam = core.anchor(spec, `seam_top_center_${side}`);
        const frac = (flat.y + flat.h / 2 - seam.y) / 27.66;
        const arm = table[sheet][side];
        const armLen = arm.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - arm[i][0], p[1] - arm[i][1]), 0);
        near((centre.y - arm[0][1]) / (arm[arm.length - 1][1] - arm[0][1]), frac, 0.04, `${id}: same fraction of the sleeve down the arm (arm ${armLen.toFixed(1)} in)`);
      }
      const p = scene.layers.filter(l => l.role === 'patch' && /L_SHOULDER/.test(l.key));
      assert.deepEqual(p.map(l => l.key).sort(), ['patch:archer_ocp_patch:L_SHOULDER:0', 'patch:archer_ocp_patch:L_SHOULDER:edge'], `${uniform} ${gender}: the shoulder patch flat and edge-on`);
      const pe = p.find(l => /:edge$/.test(l.key));
      assert.equal(pe.clipSil, sheet);
      assert.ok(pe.x + pe.w / 2 < 40 && pe.w < p.find(l => /:0$/.test(l.key)).w * 0.55, 'narrowed');
    }
  }
});

test('ABU and CFU cadet and officer builds without sleeve items add nothing to the arms; the OCP keeps its own edge view', async () => {
  for(const uniform of ['abu', 'corporate_field']){
    const scene = await compose(hb(uniform, 'male', 'senior', 'Capt', {}));
    assert.ok(!scene.layers.some(l => /:edge$/.test(l.key || '')), `${uniform}: an officer wears no sleeve chevron or patch here`);
  }
  const ocp = await compose(hb('ocp', 'male', 'senior', 'Lt Col', { patchRefs: [{ id: 'archer_ocp_patch', kind: 'general', img: 'patches/ocp/archer_ocp_patch.webp', slot: 'L_SHOULDER', label: 'ARCHER' }] }));
  assert.ok(ocp.layers.some(l => /:edge$/.test(l.key || '')), 'the OCP edge views stay');
});
