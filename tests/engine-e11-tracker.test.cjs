'use strict';
// Tracker sweep (E11): engine rules the audit tracker left open.
//   - Class A shoulder boards and epaulet sleeves seen from above sit just above the shoulder, turned
//     along the strap, like the Class B and the aviator shirt (R7), not floating over the sheet's top edge.
//   - The corporate blazer's turtleneck hides the shirt collar as well as the shirt and the tie (4.2.3.4).
//   - The command insignia pin is not worn with the Command Council, CSAG, National Board or NEC badge
//     (10.2.5).
//   - The Aide de Camp cord is worn by senior members as well as cadets, on Class A and Class B (9.3.4);
//     the cadet cords stay with cadets (9.3) and off the cadet semi-formal.
//   - Headgear is mandatory with the Class A and Class B: 'No headgear' is drawn, with a note (4.1.6.7...).
//   - CFU: the ES patch goes 1/2 in above the command pin's real top edge (5.2.1.1.2.8).
//   - A CAP service badge is worn closest to the collar, the Volunteer University badge included (10.2.4).
//   - The Inspector General badge may carry a gold star (10.5.1).

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
const B = require('../data/badge-catalog.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function build(uniform, gender, membership, rank, badges, extra){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: (badges || []).map(id => ({ id })), command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const compose = b => P.composeUniform(b, store);
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} vs ${b.toFixed(3)}`);
const CMD = { id: 'squadron_commander_badge', title: 'Squadron Commander Badge', graduated: false };
const GRAD = { id: 'squadron_commander_badge', title: 'Squadron Commander Badge', graduated: true };

// ---- Class A views from above ------------------------------------------------------------------

// The four corners of a placed (possibly rotated) layer, in scene inches.
function corners(l){
  const o = l.origin, r = (l.rotate || 0) * Math.PI / 180;
  return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([px, py]) => {
    const dx = px - o.x, dy = py - o.y;
    return { x: o.x + dx * Math.cos(r) - dy * Math.sin(r), y: o.y + dx * Math.sin(r) + dy * Math.cos(r) };
  });
}

for(const [sex, membership, rank] of [
  ['male', 'senior', 'Capt'], ['male', 'senior', 'Col'], ['male', 'senior', 'Maj Gen'], ['female', 'senior', 'Lt Col'], ['female', 'senior', 'Brig Gen'],
  ['male', 'cadet', 'C/2d Lt'], ['male', 'cadet', 'C/Col'], ['female', 'cadet', 'C/Maj'], ['female', 'cadet', 'C/Col']
]){
  test(`Class A ${sex} ${rank}: the view from above of each epaulet or board rests just above its shoulder (R7)`, async () => {
    const scene = await compose(build('blues_a', sex, membership, rank, []));
    const coat = await store.load(sex === 'male' ? 'garment-blues-class-a-coat' : 'garment-blues-class-a-coat-female');
    const seam = { right: core.anchor(coat, 'shoulder_seam_right'), left: core.anchor(coat, 'shoulder_seam_left') };
    const tops = scene.layers.filter(l => l.role === 'epaulet-top');
    assert.equal(tops.length, 2);
    for(const side of ['right', 'left']){
      const view = byKey(scene, `epaulet-top:${side}`);
      assert.ok(view, `${side} view`);
      const c = corners(view);
      const lowest = Math.max(...c.map(p => p.y));
      // Not on the coat (it lies above the shoulder seam), and not floating: within 0.9 in of it. The old
      // rule hung the view 0.75 in over the sheet's top edge, 3 in above the shoulder.
      assert.ok(lowest <= seam[side].y + 0.05, `${side}: the view's lowest corner ${lowest.toFixed(2)} is above the seam height ${seam[side].y.toFixed(2)}`);
      assert.ok(seam[side].y - lowest < 0.9, `${side}: within 0.9 in of the shoulder (${(seam[side].y - lowest).toFixed(2)})`);
      // Over its own shoulder: the view's centre is on the shoulder's side of the centre line.
      assert.ok(side === 'right' ? view.origin.x < coat.w / 2 : view.origin.x > coat.w / 2, `${side} on its own side`);
      // Turned to lie along the strap, not left upright: some tilt, never more than a quarter turn off.
      const turn = Math.abs(((view.rotate % 90) + 90) % 90);
      assert.ok(turn > 5 && turn < 85, `${side}: lies along the sloping strap (rotate ${view.rotate})`);
    }
    // The grade is on every view from above.
    assert.ok(scene.layers.filter(l => /^grade:top-/.test(l.key)).length >= 1 || membership === 'senior', 'cadet boards carry the grade');
  });
}

test('Class A: the cadet semi-formal coat also shows its boards just above the shoulder', async () => {
  const scene = await compose(build('semi_formal_usaf', 'male', 'cadet', 'C/Capt', []));
  const coat = await store.load('garment-semiformal-class-a-coat-male');
  const seam = core.anchor(coat, 'shoulder_seam_right');
  const view = byKey(scene, 'epaulet-top:right');
  assert.ok(view);
  assert.ok(Math.max(...corners(view).map(p => p.y)) <= seam.y + 0.05);
  assert.ok(seam.y - Math.max(...corners(view).map(p => p.y)) < 0.9);
});

// ---- blazer turtleneck --------------------------------------------------------------------------

test('corporate blazer, men: a turtleneck hides the shirt, the tie and the shirt collar (4.2.3.4)', async () => {
  const worn = await compose(build('aviator_blazer', 'male', 'senior', 'Capt', [], { opt: { headgear: 'auto', underlayer: 'turtleneck' } }));
  const base = worn.layers.find(l => l.role === 'garment');
  for(const g of ['shirt', 'tie', 'shirt-collar']) assert.ok(base.hideGroups.includes(g), `${g} hidden`);
  const shirt = await compose(build('aviator_blazer', 'male', 'senior', 'Capt', [], { opt: { headgear: 'auto', underlayer: 'shirt' } }));
  assert.ok(!shirt.layers.find(l => l.role === 'garment').hideGroups, 'the shirt and tie show with the shirt option');
});

// ---- command pin and governance badges -----------------------------------------------------------

for(const badge of ['command_council_badge', 'senior_advisory_group_badge', 'national_executive_committee_badge', 'cap_national_command_board_badge']){
  test(`the command pin is not worn with ${badge} (10.2.5)`, async () => {
    for(const [uniform, sex] of [['blues_a', 'male'], ['blues_a', 'female'], ['blues_b', 'male'], ['aviator', 'male'], ['ocp', 'male'], ['abu', 'female']]){
      const scene = await compose(build(uniform, sex, 'senior', 'Maj', [badge, 'CAPPilot1_FA9D33EA587D8'], { command: CMD }));
      assert.ok(!scene.layers.some(l => l.key.startsWith('badge:squadron_commander_badge')), `${uniform} ${sex}: no pin`);
      assert.ok(scene.notes.some(n => /10\.2\.5/.test(n)), `${uniform} ${sex}: says why`);
    }
  });
}

test('the command pin is worn with the National Staff and Volunteer University badges, which do not bar it', async () => {
  for(const badge of ['national_staff_badge', 'volunteer_university_instructor_badge']){
    for(const cmd of [CMD, GRAD]){
      const scene = await compose(build('blues_a', 'male', 'senior', 'Maj', [badge], { command: cmd }));
      assert.ok(scene.layers.some(l => l.key.startsWith('badge:squadron_commander_badge')), `${badge} ${cmd.graduated}: pin drawn`);
    }
  }
});

// ---- shoulder cords ----------------------------------------------------------------------------------

test('Aide de Camp cord: senior members and cadets wear it on Class A and Class B (9.3.4)', async () => {
  const cases = [['blues_a', 'male', 'senior', 'Col'], ['blues_a', 'female', 'senior', 'Capt'], ['blues_b', 'male', 'senior', 'Maj'], ['blues_b', 'female', 'senior', 'Lt Col'],
    ['blues_a', 'male', 'cadet', 'C/Maj'], ['blues_b', 'female', 'cadet', 'C/Capt']];
  for(const [uniform, sex, membership, rank] of cases){
    const scene = await compose(build(uniform, sex, membership, rank, [], { cord: 'aide_de_camp' }));
    assert.ok(scene.layers.some(l => /cord-aide-de-camp/.test(l.id || '')), `${uniform} ${sex} ${rank}: the aide cord is drawn`);
  }
});

test('the cadet cords (CAC, color guard, honor guard) are for cadets: a senior member shows none (9.3)', async () => {
  for(const cord of ['group', 'wing', 'region', 'national', 'color_guard', 'honor_guard']){
    const senior = await compose(build('blues_a', 'male', 'senior', 'Capt', [], { cord }));
    assert.ok(!senior.layers.some(l => /-cord-/.test(l.id || '')), `${cord}: none on a senior member`);
    const cadet = await compose(build('blues_a', 'male', 'cadet', 'C/Maj', [], { cord }));
    assert.ok(cadet.layers.some(l => /-cord-/.test(l.id || '')), `${cord}: drawn on a cadet`);
  }
});

test('no cord is drawn on the cadet semi-formal, the aviator shirt or a field uniform (9.3, 9.4.1)', async () => {
  for(const [uniform, sex, membership, rank] of [['semi_formal_usaf', 'male', 'cadet', 'C/Maj'], ['aviator', 'male', 'senior', 'Capt'], ['ocp', 'male', 'cadet', 'C/Maj'], ['mess_dress', 'male', 'senior', 'Capt']]){
    const scene = await compose(build(uniform, sex, membership, rank, [], { cord: 'aide_de_camp' }));
    assert.ok(!scene.layers.some(l => /-cord-|^cord-/.test(l.id || '')), `${uniform}: no cord`);
  }
});

// ---- headgear notice ----------------------------------------------------------------------------------

test('Class A and Class B: "No headgear" is drawn bare and says headgear is mandatory (4.1.6.7, 4.1.9.12, 4.1.11.1.1.7, 4.1.12.9)', async () => {
  const want = { 'blues_a:male': '4.1.6.7', 'blues_a:female': '4.1.9.12', 'blues_b:male': '4.1.11.1.1.7', 'blues_b:female': '4.1.12.9' };
  for(const [key, para] of Object.entries(want)){
    const [uniform, sex] = key.split(':');
    const none = await compose(build(uniform, sex, 'senior', 'Capt', [], { opt: { headgear: 'none' } }));
    assert.ok(!none.layers.some(l => l.role === 'hat'), `${key}: no cap drawn`);
    assert.ok(none.notes.some(n => /Headgear is mandatory/.test(n) && n.includes(para)), `${key}: note cites ${para}`);
    const worn = await compose(build(uniform, sex, 'senior', 'Capt', [], { opt: { headgear: 'auto' } }));
    assert.ok(worn.layers.some(l => l.role === 'hat'), `${key}: cap drawn`);
    assert.ok(!worn.notes.some(n => /Headgear is mandatory/.test(n)), `${key}: no note with a cap`);
  }
});

test('headgear is not required with the aviator shirt, the blazer or the mess dress: no notice (4.2.5.1.8, 4.2.3.7, 4.1.1.5)', async () => {
  for(const uniform of ['aviator', 'aviator_blazer', 'mess_dress']){
    const scene = await compose(build(uniform, 'male', 'senior', 'Capt', [], { opt: { headgear: 'none' } }));
    assert.ok(!scene.notes.some(n => /Headgear is mandatory/.test(n)), uniform);
  }
});

// ---- CFU ES patch ------------------------------------------------------------------------------------------

test('CFU: the ES patch is 1/2 in above the name tape, or above the real top edge of the current command pin (5.2.1.1.2.8)', async () => {
  for(const sex of ['male', 'female']){
    const bare = await compose(build('corporate_field', sex, 'senior', 'Maj', [], { opt: { headgear: 'auto', esPatch: 'style-1' } }));
    const es0 = bare.layers.find(l => l.key === 'patch:patch-es-style-1');
    assert.ok(es0, `${sex}: ES patch drawn`);
    const withPin = await compose(build('corporate_field', sex, 'senior', 'Maj', [], { opt: { headgear: 'auto', esPatch: 'style-1' }, command: CMD }));
    const pin = withPin.layers.find(l => /^badge:squadron_commander_badge:ON:0$/.test(l.key));
    const es1 = withPin.layers.find(l => l.key === 'patch:patch-es-style-1');
    assert.ok(pin && es1, `${sex}: pin and ES patch drawn`);
    near(es1.y + es1.h, pin.y - 0.5, 0.005, `${sex}: the patch's bottom 1/2 in above the pin's real top edge`);
    // The pin sits 1/2 in above the tape, so with it the patch is lifted by the pin's height plus 1/2 in.
    near(es0.y + es0.h - (es1.y + es1.h), pin.h + 0.5, 0.005, `${sex}: the pin lifts the patch by its own height and the 1/2 in`);
  }
});

// ---- service badge next to the collar ------------------------------------------------------------------------

test('women\'s Class A: the Volunteer University badge, a CAP service badge, is worn closest to the lapel (10.2.4)', async () => {
  const scene = await compose(build('blues_a', 'female', 'senior', 'Maj', ['volunteer_university_instructor_badge', 'emergency_services_badge']));
  const vu = byKey(scene, 'badge:volunteer_university_instructor_badge'), es = byKey(scene, 'badge:emergency_services_badge');
  assert.ok(vu && es);
  const cx = l => l.x + l.w / 2;
  // The wearer's left is the viewer's right: the lapel side.
  assert.ok(cx(vu) > cx(es), 'the service badge is on the lapel side of the pair');
});

// ---- Inspector General gold star -------------------------------------------------------------------------------

test('Inspector General senior and master badges offer the gold star of 10.5.1, drawn from the gold art', async () => {
  for(const level of ['senior', 'master']){
    const id = `inspector_general_${level}_badge`;
    assert.equal(B.levels(id).length, 2);
    assert.equal(B.art(id, 'dress'), `enamel-ig-${level}`, 'no device by default');
    assert.equal(B.art(id, 'dress', 'gold-star'), `enamel-ig-${level}-gold`);
    const scene = await compose(build('blues_a', 'male', 'senior', 'Maj', [], { badges: [{ id, level: 'gold-star' }] }));
    const badge = scene.layers.find(l => l.key === `badge:${id}`);
    assert.ok(badge && badge.id === `enamel-ig-${level}-gold`, `${level}: the gold-star badge is drawn`);
    const plain = await compose(build('blues_a', 'male', 'senior', 'Maj', [], { badges: [{ id }] }));
    assert.equal(plain.layers.find(l => l.key === `badge:${id}`).id, `enamel-ig-${level}`);
  }
});

// ---- cadet semi-formal lapel ---------------------------------------------------------------------------------

test('cadet semi-formal: the lapels are drawn over the badges and ribbons as on the Class A, the cadet chevrons above them (11.1.8)', async () => {
  for(const [sex, fg] of [['male', 'layer:garment-blues-class-a-coat-lapel-foreground'], ['female', 'layer:garment-blues-class-a-coat-female-lapel-foreground']]){
    for(const rank of ['C/SSgt', 'C/Maj']){
      const scene = await compose(build('semi_formal_usaf', sex, 'cadet', rank, ['AirCrew1_DB3F0FCC3650F', 'emergency_services_badge']));
      const lapel = byKey(scene, fg);
      assert.ok(lapel, `${sex} ${rank}: the lapel foreground is drawn`);
      const badges = scene.layers.filter(l => l.role === 'badge' || l.role === 'ribbon');
      assert.ok(badges.length >= 2);
      assert.ok(badges.every(l => l.z < lapel.z), `${sex} ${rank}: every badge and ribbon is under the lapel`);
      for(const chevron of scene.layers.filter(l => /^grade:(left|right)$/.test(l.key))) assert.ok(chevron.z > lapel.z, `${sex} ${rank}: the chevron lies over the lapel`);
    }
  }
});

test('cadet semi-formal: cadet officers keep the lapel CAP, drawn above the lapel foreground (4.1.3.2, 4.1.4: worn as for the Service Dress)', async () => {
  for(const [sex, base] of [['male', 'garment-blues-class-a-coat'], ['female', 'garment-blues-class-a-coat-female']]){
    for(const rank of ['C/Maj', 'C/Col']){
      const scene = await compose(build('semi_formal_usaf', sex, 'cadet', rank, []));
      const fg = byKey(scene, `layer:${base}-lapel-foreground`), cap = byKey(scene, `layer:${base}-lapel-cap`);
      assert.ok(fg, `${sex} ${rank}: the lapel foreground is drawn`);
      assert.ok(cap, `${sex} ${rank}: the lapel CAP insignia is drawn`);
      assert.ok(cap.z > fg.z, `${sex} ${rank}: the lapel CAP (z ${cap.z}) lies above the lapel foreground (z ${fg.z})`);
    }
  }
  // Cadet NCOs wear chevrons, not the lapel CAP.
  const nco = await compose(build('semi_formal_usaf', 'male', 'cadet', 'C/SSgt', []));
  assert.ok(!byKey(nco, 'layer:garment-blues-class-a-coat-lapel-cap'), 'a cadet NCO has no lapel CAP');
});

// ---- unit patch on the ABU and the CFU ----------------------------------------------------------------------------------

test('ABU and CFU: the unit patch is worn on the right breast pocket, the other pocket patch on the left (Attachment 4, 5.1.1.1.2.3, 5.2.1.1.2.4-5)', async () => {
  const unit = { id: 'unit-x', href: 'images/patches/nywg_patch.webp', aspect: 1, slot: 'R_SHOULDER', kind: 'unit', title: 'Unit patch' };
  const other = { id: 'other-p', href: 'images/patches/archer_patch.webp', aspect: 1, slot: 'CHEST_LEFT', kind: 'general', title: 'Archer patch' };
  for(const [uniform, garment, pockets] of [['abu', 'garment-abu-coat', 1], ['corporate_field', 'garment-cfu-coat', 2]]){
    const sheet = await store.load(garment);
    const scene = await compose(build(uniform, 'male', 'senior', 'Maj', [], { patches: [unit, other] }));
    const placed = scene.layers.filter(l => l.role === 'patch');
    const u = placed.find(l => l.key.startsWith('patch:unit-x:'));
    assert.ok(u, `${uniform}: the unit patch is drawn`);
    const right = core.landmarkBounds(sheet, 'chest_pocket_right');
    assert.ok(u.x >= right.x && u.x + u.w <= right.x + right.w + 1e-6, `${uniform}: inside the right pocket's width`);
    assert.ok(u.y >= right.y && u.y + u.h <= right.y + right.h, `${uniform}: on the right pocket`);
    assert.equal(placed.length, pockets, `${uniform}: ${pockets} pocket patch${pockets > 1 ? 'es' : ''} (one in all on the ABU, one a pocket on the CFU)`);
    if(pockets === 2){
      const o = placed.find(l => l.key.startsWith('patch:other-p:')), left = core.landmarkBounds(sheet, 'chest_pocket_left');
      assert.ok(o && o.x >= left.x && o.x + o.w <= left.x + left.w + 1e-6, 'the other patch is on the left pocket');
    }
  }
});

// ---- collar over chest badges and patches on the ABU, CFU and OCP --------------------------------------------------------
// The collar lies over what is worn where it meets the collar (5.2.1.1.2.8 puts the ES patch 1/2 in above the command insignia; 5.2.1.1.2.6 the badges 1/2 in
// above the tape), so the coat's own 'collar-front' group is drawn again above the patches and badges and the collar's grade above that.

// The collar's pieces in scene inches: the leaf polygons (landmarks collar_left / collar_right) and the lapel quads of the sheet's 'collar-front' group,
// which lie in the same frame as the leaves (the leaf path's first vertex is the landmark's first point).
async function collarPieces(garmentId){
  const spec = await store.load(garmentId);
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', garmentId + '.svg'), 'utf8');
  const nums = d => d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const pts = d => { const n = nums(d), out = []; for(let i = 0; i + 1 < n.length; i += 2) out.push({ x: n[i], y: n[i + 1] }); return out; };
  const out = [];
  for(const side of ['left', 'right']){
    const leaf = spec.landmarks['collar_' + side].points.map(p => ({ x: p.x != null ? p.x : p[0], y: p.y != null ? p.y : p[1] }));
    out.push({ name: 'leaf-' + side, points: leaf });
    const leafD = new RegExp(`id="${garmentId}__collar-leaf-${side}" d="([^"]+)"`).exec(svg)[1];
    const quadD = new RegExp(`id="${garmentId}__collar-${side}" d="([^"]+)"`).exec(svg)[1];
    const first = pts(leafD)[0];
    const dx = leaf[0].x - first.x, dy = leaf[0].y - first.y;
    out.push({ name: 'lapel-' + side, points: pts(quadD).map(p => ({ x: p.x + dx, y: p.y + dy })) });
  }
  return out;
}
function insidePoly(pt, poly){
  let c = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
// How many 0.05 in sample points of the layer's box lie inside the piece.
function overlapSamples(l, poly){
  let n = 0;
  for(let x = l.x; x <= l.x + l.w; x += 0.05) for(let y = l.y; y <= l.y + l.h; y += 0.05) if(insidePoly({ x, y }, poly)) n++;
  return n;
}
const COLLAR_FG = scene => scene.layers.find(l => l.key === 'layer:foreground' && l.onlyGroups && l.onlyGroups.includes('collar-front'));
const TWO_BADGES = ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge'];

for(const [uniform, garment, patchStyles] of [['corporate_field', 'garment-cfu-coat', ['style-1', 'style-2']], ['abu', 'garment-abu-coat', [null]]]){
  for(const sex of ['male', 'female']){
    for(const style of patchStyles){
      for(const [membership, rank] of [['senior', 'Maj'], ['senior', 'Col'], ['cadet', 'C/SSgt'], ['cadet', 'C/Maj']]){
        test(`${uniform} ${sex} ${rank}${style ? ' ES ' + style : ''}: the collar group is drawn above every badge and patch that reaches it, under the collar grade (5.2.1.1.2.8, 5.2.1.1.2.6, 5.2.1.1.1)`, async () => {
          const scene = await compose(build(uniform, sex, membership, rank, TWO_BADGES, { command: CMD, opt: Object.assign({ headgear: 'auto' }, style ? { esPatch: style } : {}) }));
          const fg = COLLAR_FG(scene);
          assert.ok(fg, 'a collar-front foreground layer is drawn');
          assert.deepEqual(fg.onlyGroups, ['collar-front']);
          const pieces = await collarPieces(garment);
          const under = scene.layers.filter(l => (l.role === 'patch' || l.role === 'badge') && pieces.some(p => overlapSamples(l, p.points) > 0));
          for(const l of under) assert.ok(fg.z > l.z, `${l.key} reaches the collar, so it lies under the collar group (z ${l.z} vs ${fg.z})`);
          // Every patch and badge layer is under the collar group, not only those that touch it (a build that moves one later must not lose the cover).
          for(const l of scene.layers.filter(x => x.role === 'patch' || x.role === 'badge')) assert.ok(fg.z > l.z, `${l.key} is under the collar group`);
          const grades = scene.layers.filter(l => l.role === 'grade' && /^grade:(left|right)$/.test(l.key));
          assert.ok(grades.length >= 2, 'the collar grade is drawn on both leaves');
          for(const g of grades) assert.ok(g.z > fg.z, `${g.key} stays whole on the leaf (z ${g.z} vs ${fg.z})`);
          // Nothing is moved to clear the collar: the ES patch's 1/2 in above the pin is checked below, and the two badges are both drawn.
          assert.equal(scene.layers.filter(l => l.role === 'badge' && /^badge:(CAPPilot1|ground_team)/.test(l.key)).length, 2);
        });
      }
    }
  }
}

test('CFU senior officer with the ES patch and the command pin: the patch reaches the collar and is covered by it, the oak leaf is above the collar (5.2.1.1.2.8, 5.2.1.1.1.1)', async () => {
  let reached = 0;
  const pieces = await collarPieces('garment-cfu-coat');
  for(const sex of ['male', 'female']){
    for(const style of ['style-1', 'style-2']){
      const scene = await compose(build('corporate_field', sex, 'senior', 'Maj', TWO_BADGES, { command: CMD, opt: { headgear: 'auto', esPatch: style } }));
      const fg = COLLAR_FG(scene);
      const es = scene.layers.find(l => l.key === 'patch:patch-es-' + style);
      assert.ok(es && fg);
      // The ES patch is 1/2 in above the pin (5.2.1.1.2.8): unchanged.
      const pin = scene.layers.find(l => /^badge:squadron_commander_badge:ON:0$/.test(l.key));
      near(pin.y - (es.y + es.h), 0.5, 0.02, `${sex} ${style}: the ES patch is 1/2 in above the command insignia`);
      if(pieces.some(p => overlapSamples(es, p.points) > 0)) reached++;
      assert.ok(fg.z > es.z, `${sex} ${style}: the collar covers the ES patch`);
      for(const g of scene.layers.filter(l => /^grade:(left|right)$/.test(l.key))) assert.ok(g.z > fg.z);
    }
  }
  assert.ok(reached >= 2, 'the ES patch reaches the collar in these builds (' + reached + ')');
});

test('OCP: the collar group is drawn again above the badges (the same group as the ABU and CFU coats)', async () => {
  const scene = await compose(build('ocp', 'male', 'senior', 'Maj', [...TWO_BADGES, 'emergency_services_badge', 'AirCrew1_DB3F0FCC3650F'], { command: CMD }));
  const fg = COLLAR_FG(scene);
  assert.ok(fg, 'the collar foreground is drawn');
  for(const l of scene.layers.filter(x => x.role === 'badge')) assert.ok(fg.z > l.z);
});
