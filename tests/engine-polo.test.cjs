'use strict';
// The Corporate Working Uniform, the polo (CAPR 39-1 5.3, Figure 5.5): three dark blue shirts, the embroidered seal on the right
// breast (5.3.1.1, 5.3.1.3) or the seal screen-printed on the left (5.3.1.2), the optional embroidered name in white thread and
// ONE badge or duty title 1/2 inch over it (5.3.2.1.1), no accoutrements on the printed shirt (5.3.2.1.2), no grade insignia (5.3.2),
// no ribbons (11.1.3), the CAP baseball cap optional (5.3.7). Run on the synced sheets (tests/helpers/polo-sheets.cjs).

const test = require('node:test');
const assert = require('node:assert/strict');

const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const polo = require('../tests/helpers/polo-sheets.cjs');
const { store } = polo;

const PILOT = 'CAPPilot1_FA9D33EA587D8';
const GROUND_TEAM = 'ground_team_basic_badge';
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} vs ${b.toFixed(3)}`);

function build(extra){
  const o = extra || {};
  return Object.assign({
    uniform: 'polo', gender: 'male', membership: 'senior', grade: G.gradeInfo('senior', o.rank || 'Capt', {}),
    opt: Object.assign({ sleeve: 'short', headgear: 'auto' }, o.opt || {}),
    name: Object.assign({ first: 'Pat', last: 'Doe', show: true }, o.name || {}),
    ribbons: [], medals: [], badges: (o.badgeIds || []).map(id => ({ id, title: id })), command: null, militaryBadges: [], patches: [], cord: null
  }, o.build || {});
}
const compose = b => P.composeUniform(b, store);
const keyed = (scene, key) => scene.layers.find(l => l.key === key);
const text = scene => scene.layers.filter(l => l.type === 'text');
const sheetOf = (sex, long) => `garment-polo-${sex}${long ? '-long' : ''}`;
const CUTS = [['male', false], ['male', true], ['female', false], ['female', true]];

test('the polo is a registered profile, one sheet per cut and sleeve length (5.3.1, 5.3.1.1)', async () => {
  assert.ok(P.PROFILES.polo);
  for(const [sex, long] of CUTS){
    const scene = await compose(build({ build: { gender: sex }, opt: { sleeve: long ? 'long' : 'short' } }));
    assert.equal(scene.garment, sheetOf(sex, long));
  }
});

test('a woman may wear either cut: the men\'s version with the pocket, or her own without (5.3.1.1, 5.3.1.3)', async () => {
  const hers = await compose(build({ build: { gender: 'female' } }));
  const his = await compose(build({ build: { gender: 'female' }, opt: { poloCut: 'male' } }));
  const long = await compose(build({ build: { gender: 'female' }, opt: { poloCut: 'male', sleeve: 'long' } }));
  assert.equal(hers.garment, 'garment-polo-female');
  assert.equal(his.garment, 'garment-polo-male');
  assert.equal(long.garment, 'garment-polo-male-long');
  const man = await compose(build({ opt: { poloCut: 'female' } }));
  assert.equal(man.garment, 'garment-polo-male', 'a man wears the men\'s cut whatever the option says');
});

test('the embroidered seal is centred on the sheet\'s seal_slot at its size, on the knit and the tactical shirt (5.3.1.1, 5.3.1.3)', async () => {
  for(const [sex, long] of CUTS) for(const shirt of ['embroidered', 'tactical']){
    const scene = await compose(build({ build: { gender: sex }, opt: { sleeve: long ? 'long' : 'short', poloShirt: shirt } }));
    const sheet = await store.load(sheetOf(sex, long));
    const slot = polo.slot(sheet, 'seal_slot');
    const seal = keyed(scene, 'polo:seal');
    assert.ok(seal, `${sex} ${long} ${shirt}: seal placed`);
    assert.equal(seal.id, 'insignia-cap-seal');
    near(seal.x + seal.w / 2, slot.x + slot.w / 2, 0.01, 'seal centre x');
    near(seal.y + seal.h / 2, slot.y + slot.h / 2, 0.01, 'seal centre y');
    near(seal.w, slot.w, 0.01, 'seal width is the slot\'s');
    assert.equal(seal.w, seal.h, 'the seal stays round');
  }
});

test('the knit polo\'s seal is on the wearer\'s right breast, the viewer\'s left; its name and badge on the left breast (5.3.1.1)', async () => {
  const scene = await compose(build({ badgeIds: [PILOT] }));
  const seal = keyed(scene, 'polo:seal');
  const name = text(scene).find(t => t.key === 'text:polo-name');
  const badge = scene.layers.find(l => l.role === 'badge');
  const mid = scene.layers[0].w / 2;
  assert.ok(seal.x + seal.w / 2 < mid, 'seal on the figure\'s right (picture left)');
  assert.ok(name.x > mid && badge.x + badge.w / 2 > mid, 'name and badge on the figure\'s left (picture right)');
});

test('the screen-printed shirt draws the sheet and its print and nothing else: no seal, name, badge or title (5.3.1.2, 5.3.2.1.2)', async () => {
  for(const [sex, long] of CUTS){
    const scene = await compose(build({ build: { gender: sex }, opt: { sleeve: long ? 'long' : 'short', poloShirt: 'print', poloMark: 'badge' }, badgeIds: [PILOT] }));
    const drawn = scene.layers.filter(l => !['clear', 'surface'].includes(l.role));
    assert.deepEqual(drawn.map(l => l.id), [sheetOf(sex, long), sheetOf(sex, long) + '-seal-print'], `${sex} ${long}`);
    assert.ok(!keyed(scene, 'polo:seal'), 'the print is the sheet\'s overlay, not the embroidered seal');
    assert.equal(text(scene).length, 0);
    assert.ok(scene.notes.some(n => /no accoutrements/.test(n) && /5\.3\.2\.1\.2/.test(n)), 'says why the name and badge are not shown');
  }
  const bare = await compose(build({ opt: { poloShirt: 'print' }, name: { first: '', last: '' } }));
  assert.ok(!bare.notes.some(n => /accoutrements/.test(n)), 'no note when nothing was asked for');
});

test('the tactical shirt carries its overlay (pen pocket on the left sleeve); the knit shirts do not (5.3.1.3)', async () => {
  for(const [sex, long] of CUTS){
    const o = { build: { gender: sex }, opt: { sleeve: long ? 'long' : 'short' } };
    const tac = await compose(build(Object.assign({}, o, { opt: Object.assign({}, o.opt, { poloShirt: 'tactical' }) })));
    assert.ok(tac.layers.some(l => l.id === sheetOf(sex, long) + '-tactical'), `${sex} ${long}: tactical overlay`);
    assert.ok(!tac.layers.some(l => /-seal-print$/.test(l.id || '')));
    const knit = await compose(build(o));
    assert.ok(!knit.layers.some(l => /-tactical$|-seal-print$/.test(l.id || '')), `${sex} ${long}: knit has neither overlay`);
  }
});

test('the embroidered name is first and last in white block capitals inside the sheet\'s name_slot (5.3.2.1.1)', async () => {
  for(const [sex, long] of CUTS){
    const scene = await compose(build({ build: { gender: sex }, opt: { sleeve: long ? 'long' : 'short' } }));
    const sheet = await store.load(sheetOf(sex, long));
    const slot = polo.slot(sheet, 'name_slot');
    const t = text(scene);
    assert.equal(t.length, 1);
    assert.equal(t[0].text, 'PAT DOE');
    assert.equal(t[0].color.toLowerCase(), '#f4f6f8', 'white thread');
    near(t[0].x, slot.x + slot.w / 2, 0.01, 'centred in the slot');
    assert.ok(t[0].w <= slot.w + 1e-6, 'no wider than the slot');
    assert.ok(t[0].h <= slot.h + 1e-6, 'capitals no taller than the slot');
    near(t[0].y + t[0].h * 0, slot.y + slot.h / 2, slot.h * 0.2, 'on the slot\'s middle');
  }
});

test('a long name is condensed to the slot, not run past it (5.3.2.1.1)', async () => {
  const scene = await compose(build({ name: { first: 'Maximilian', last: 'Featherstonehaugh-Cholmondeley' } }));
  const slot = polo.slot(await store.load('garment-polo-male'), 'name_slot');
  const t = text(scene)[0];
  assert.ok(t.w <= slot.w + 1e-6, `${t.w} fits ${slot.w}`);
});

test('the name is optional: off by the option, off by the page\'s Show name, empty, or one name only (5.3.1.1)', async () => {
  assert.equal(text(await compose(build({ opt: { poloName: false } }))).length, 0);
  assert.equal(text(await compose(build({ name: { show: false } }))).length, 0);
  assert.equal(text(await compose(build({ name: { first: '', last: '' } }))).length, 0);
  assert.equal(text(await compose(build({ name: { first: '' } })))[0].text, 'DOE');
});

test('one badge goes 1/2 inch over the name, centred on the sheet\'s badge_slot, measured name top to badge bottom (5.3.2.1.1)', async () => {
  for(const [sex, long] of CUTS){
    const scene = await compose(build({ build: { gender: sex }, opt: { sleeve: long ? 'long' : 'short' }, badgeIds: [PILOT] }));
    const sheet = await store.load(sheetOf(sex, long));
    const at = polo.point(sheet, 'badge_slot');
    const badge = scene.layers.find(l => l.role === 'badge');
    assert.ok(badge, `${sex} ${long}: badge placed`);
    assert.equal(badge.id, 'pilot-field', 'the embroidered (field) form, not the enamel dress badge');
    assert.deepEqual([...badge.hideGroups], ['backing'], 'embroidered on the shirt itself: the dark blue cloth backing is not drawn');
    near(badge.x + badge.w / 2, at.x, 0.01, 'centred on badge_slot');
    const name = text(scene)[0];
    const spec = await store.load(badge.id);
    const k = badge.h / spec.h;
    const bottom = badge.y + spec.anchors.art_bottom_center.y * k;
    near(name.y - name.h / 2 - bottom, 0.5, 0.01, 'visible bottom of the badge is 1/2 in over the top of the name\'s capitals');
    const m = scene.layers.filter(l => l.type === 'measure');
    assert.equal(m.length, 1);
    assert.equal(m[0].label, '½ in');
    near(m[0].to.y - m[0].from.y, -0.5, 0.01, 'the measure runs the 1/2 in');
    near(m[0].from.y, name.y - name.h / 2, 0.01, 'from the top of the name');
  }
});

test('with no name the badge keeps its place 1/2 inch over where the name would be (5.3.2.1.1)', async () => {
  const withName = await compose(build({ badgeIds: [PILOT] }));
  const without = await compose(build({ badgeIds: [PILOT], name: { show: false } }));
  const a = withName.layers.find(l => l.role === 'badge'), b = without.layers.find(l => l.role === 'badge');
  near(b.y + b.h, a.y + a.h, 0.1, 'badge bottom within a tenth of an inch');
});

test('only one badge is worn: the choice goes to the member, the rest are noted (5.3.2.1.1)', async () => {
  const scene = await compose(build({ badgeIds: [PILOT, GROUND_TEAM, 'christian_chaplin'] }));
  assert.equal(scene.layers.filter(l => l.role === 'badge').length, 1);
  assert.ok(scene.notes.some(n => /Only one badge or duty title/.test(n) && /5\.3\.2\.1\.1/.test(n)));
  const c = scene.conflicts.find(x => x.position === 'polo');
  assert.ok(c && c.limit === 1 && c.candidates.length === 3);
  const chosen = await compose(build({ badgeIds: [PILOT, GROUND_TEAM], build: { badgeChoices: { polo: GROUND_TEAM } } }));
  assert.equal(chosen.layers.find(l => l.role === 'badge').id, 'ground-team-basic-field');
});

test('only service, aviation, occupational (chaplain included) and specialty track badges are worn; a badge without embroidered art is refused with a note (5.3.2.1.1)', async () => {
  const staff = await compose(build({ badgeIds: ['national_staff_badge'] }));
  assert.equal(staff.layers.filter(l => l.role === 'badge').length, 0);
  assert.ok(staff.notes.some(n => /not worn on the polo/.test(n) && /5\.3\.2\.1\.1/.test(n)), staff.notes.join('|'));
  const service = await compose(build({ badgeIds: ['command_council_badge'] }));
  assert.equal(service.layers.filter(l => l.role === 'badge').length, 0, 'a service badge is named by 5.3.1.1 but has no embroidered art');
  assert.ok(service.notes.some(n => /no field artwork/.test(n)), service.notes.join('|'));
  const es = await compose(build({ badgeIds: ['emergency_services_badge'] }));
  assert.equal(es.layers.filter(l => l.role === 'badge').length, 0);
  assert.ok(es.notes.some(n => /no field artwork/.test(n)), 'a specialty badge with no embroidered form is refused');
  const chaplain = await compose(build({ badgeIds: ['christian_chaplin'] }));
  assert.equal(chaplain.layers.filter(l => l.role === 'badge').length, 1);
});

test('a duty title is embroidered in the name\'s lettering, 1/2 inch over the name, in place of the badge (5.3.2.1.1)', async () => {
  const scene = await compose(build({ opt: { poloMark: 'title', dutyTitle: 'Squadron Commander' }, badgeIds: [PILOT] }));
  const t = text(scene);
  const title = t.find(x => x.key === 'text:polo-title'), name = t.find(x => x.key === 'text:polo-name');
  assert.equal(title.text, 'SQUADRON COMMANDER');
  assert.equal(title.color.toLowerCase(), '#f4f6f8');
  near((name.y - name.h / 2) - (title.y + title.h / 2), 0.5, 0.02, 'title capitals end 1/2 in over the name');
  assert.equal(scene.layers.filter(l => l.role === 'badge').length, 0, 'one badge or title, not both');
  assert.ok(scene.notes.some(n => /duty title is worn in place of the badge/.test(n)));
  const slot = polo.slot(await store.load('garment-polo-male'), 'name_slot');
  assert.ok(title.w <= slot.w + 1e-6);
  const none = await compose(build({ opt: { poloMark: 'title', dutyTitle: '   ' } }));
  assert.equal(text(none).filter(x => x.key === 'text:polo-title').length, 0);
});

test('no grade insignia, ribbons, medals, nameplate, cords, patches or command pin on any grade (5.3.2, 5.3.2.1, 11.1.3, 11.1.6)', async () => {
  const ribbon = { key: 'ribbon:cap_achievment_award', title: 'x', asset: 'ribbon-cap-achievment-award', devices: [], centered: false };
  const ok = new Set(['garment', 'garment-layer', 'seal', 'text', 'badge', 'measure', 'clear', 'surface', 'hat']);
  for(const rank of ['SM', 'SrA', 'SMSgt', 'CMSgt', '2d Lt', 'Capt', 'Col', 'Brig Gen', 'Maj Gen']){
    if(!G.gradeInfo('senior', rank, {})) continue;
    for(const sex of ['male', 'female']) for(const shirt of ['embroidered', 'tactical', 'print']){
      const scene = await compose(build({ rank, build: { gender: sex, ribbons: [ribbon], medals: [ribbon],
        command: { id: 'squadron_commander_badge', title: 'Squadron Commander', graduated: false }, cord: 'wing', patches: [{ id: 'x', title: 'x', href: '/x.webp', aspect: 1, slot: 'L_SHOULDER', kind: 'general' }] },
        opt: { poloShirt: shirt }, badgeIds: [PILOT] }));
      for(const l of scene.layers) assert.ok(ok.has(l.role), `${rank} ${sex} ${shirt}: unexpected ${l.role} ${l.key}`);
      for(const l of scene.layers) assert.ok(!/^(rank|ribbon|medal|mini|nameplate|cord|epaulet|collar|patch|tape|device)-/.test(l.id || ''), `${rank}: ${l.id}`);
      assert.ok(!scene.layers.some(l => l.role === 'nametag' || l.role === 'ribbon' || l.role === 'patch' || l.role === 'grade'));
      assert.ok(scene.notes.some(n => /Ribbons and medals are not worn/.test(n) && /11\.1\.3/.test(n)));
    }
  }
});

test('a graded member is told the polo wears no grade; a member without grade is not (5.3.2)', async () => {
  const graded = await compose(build({ rank: 'Capt' }));
  assert.ok(graded.notes.some(n => /No grade insignia is worn on the polo/.test(n) && /5\.3\.2/.test(n)));
  const sm = await compose(build({ rank: 'SM' }));
  assert.ok(!sm.notes.some(n => /No grade insignia/.test(n)));
});

test('the CAP baseball cap is optional headgear, front and back views in the boxes the sheet states, above the shoulders (5.3.7)', async () => {
  const off = await compose(build());
  assert.ok(!off.layers.some(l => l.role === 'hat' || l.role === 'hat-view'), 'headgear is not required with this uniform');
  for(const [sex, long] of CUTS){
    const on = await compose(build({ build: { gender: sex }, opt: { baseballCap: true, sleeve: long ? 'long' : 'short' } }));
    const sheet = await store.load(sheetOf(sex, long));
    const view = sheet.raw.landmarks.hat_view;
    const front = on.layers.find(l => l.role === 'hat'), back = on.layers.find(l => l.role === 'hat-view');
    assert.ok(front && /^hat-baseball-cap/.test(front.id), 'the cap is drawn');
    near(front.x, view.front.x / 100, 0.01, 'front view at the sheet\'s box x');
    near(front.y, view.front.y / 100, 0.01, 'front view at the sheet\'s box y');
    near(front.w, view.front.w / 100, 0.01, 'front view at the box width');
    assert.ok(front.y + front.h <= 0.6, `${sex} ${long}: the cap sits above the shoulders`);
    assert.ok(back && /-back$/.test(back.id), 'the back view');
    near(back.x, view.back.x / 100, 0.01, 'back view at the sheet\'s box x');
    assert.ok(back.x >= front.x + front.w, 'the back view lies to the picture\'s right of the front');
    assert.ok(!on.layers.some(l => l.role === 'hat-device'), 'the baseball cap carries no cap device');
  }
});

test('the printed polo hides the men\'s pocket: it has no pocket or accoutrements (5.3.1.2, 5.3.2.1.2)', async () => {
  const print = await compose(build({ opt: { poloShirt: 'print' } }));
  assert.deepEqual([...print.layers[0].hideGroups], ['pocket']);
  const knit = await compose(build());
  assert.ok(!knit.layers[0].hideGroups);
  assert.ok(!print.layers.some(l => l.role === 'surface' && l.key === 'clear:pocket'), 'no pocket zone is kept clear on the printed shirt');
});

test('no epaulet, sleeve flat, cord or collar views are drawn, and the scene is just the figure, its print or seal, name and badge', async () => {
  const scene = await compose(build({ rank: 'SMSgt', badgeIds: [PILOT], opt: { baseballCap: true } }));
  assert.ok(!scene.layers.some(l => /sleeve-flat|epaulet|cord|collar/.test((l.id || '') + (l.role || ''))));
});

test('on the polo sheets: every slot is on the sheet, the seal on the right breast, the print and name on the left (5.3.1)', async () => {
  for(const [sex, long] of CUTS){
    const sheet = await store.load(sheetOf(sex, long));
    for(const name of ['seal_slot', 'name_slot', 'badge_slot', 'print_seal_slot']){
      const r = polo.slot(sheet, name);
      assert.ok(r, `${sheet.id} states ${name}`);
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= sheet.w + 1e-6 && r.y + r.h <= sheet.h + 1e-6, `${sheet.id} ${name} inside the sheet`);
    }
    const mid = sheet.w / 2;
    const seal = polo.slot(sheet, 'seal_slot'), print = polo.slot(sheet, 'print_seal_slot'), nm = polo.slot(sheet, 'name_slot');
    assert.ok(seal.x + seal.w / 2 < mid, `${sheet.id}: seal slot on the wearer's right`);
    assert.ok(print.x + print.w / 2 > mid && nm.x + nm.w / 2 > mid, `${sheet.id}: print and name on the wearer's left`);
    const badge = polo.point(sheet, 'badge_slot');
    assert.ok(badge && badge.y < nm.y, `${sheet.id}: badge slot above the name`);
    assert.equal(!!polo.slot(sheet, 'pocket'), sex === 'male', `${sheet.id}: the left chest pocket is the men's (5.3.1.1)`);
    assert.ok(sheet.anchors.top_center && sheet.raw.landmarks.hat_view.front, `${sheet.id}: hat_view for the cap`);
    near(polo.slot(sheet, 'badge_slot').y + polo.slot(sheet, 'badge_slot').h + 0.5, nm.y, 0.02, `${sheet.id}: the badge slot ends 1/2 in over the name slot (5.3.2.1.1)`);
  }
});

test('the tactical overlay\'s pen pocket is on the wearer\'s LEFT sleeve and the printed overlay carries the white seal (5.3.1.3, 5.3.1.2)', async () => {
  for(const [sex, long] of CUTS){
    const id = sheetOf(sex, long);
    for(const part of ['-tactical', '-seal-print']) assert.ok(polo.manifest.assets.some(a => a.id === id + part), `${id}${part} is synced`);
    const tactical = await store.load(id + '-tactical');
    const pen = polo.slot(tactical, 'pen_pocket_slot');
    assert.ok(pen, `${id}: pen_pocket_slot`);
    assert.ok(pen.x + pen.w / 2 > tactical.w / 2, 'the picture\'s right is the wearer\'s left');
    const scene = await compose(build({ build: { gender: sex }, opt: { sleeve: long ? 'long' : 'short', poloShirt: 'tactical' } }));
    assert.ok(scene.layers.some(l => l.role === 'surface' && l.key === 'clear:pen_pocket_slot'), 'labels keep off the pen pocket');
  }
});
