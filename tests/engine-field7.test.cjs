'use strict';
// FIELD7: Ethan's live-review rulings on the field and flight uniforms, measured in inches on the composed scene.
//  5. the flight suit name tag's one badge is the member's pick of the badges the tag takes (8.2.4.1, 8.3.4.1)

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
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const ST = store();
const EPS = 0.006;

function build(uniform, membership, rank, extra){
  const b = Object.assign({
    uniform, gender: 'male', grade: G.gradeInfo(membership, rank, {}),
    opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
  if(extra && extra.opt) b.opt = Object.assign({ headgear: 'auto' }, extra.opt);
  return b;
}
const compose = b => P.composeUniform(b, store());
const PILOT = { id: 'CAPPilot1_FA9D33EA587D8', title: 'Pilot Badge' };
const MASTER_GT = { id: 'master_ground_team_badge', title: 'Master Ground Team Badge' };
const GROUP_PIN = { id: 'group_commander_badge', title: 'Group Commander Badge', graduated: false };
const onSuit = (scene, pred) => scene.layers.filter(l => l.figure !== 2 && pred(l));

// ---- 5. the name tag's one badge ----------------------------------------------------------------------------------------------------

test('FIELD7-5: a member with the master Ground Team badge and no aviation badge wears it on the flight suit tag, FDU and CFDU, both sexes, officer, NCO and cadet (8.2.4.1, 8.3.4.1)', async () => {
  for(const uniform of ['flight_suit', 'corporate_flight_suit']){
    for(const gender of ['male', 'female']){
      for(const [m, r] of [['senior', 'Capt'], ['senior', 'SMSgt'], ['cadet', 'C/Capt']]){
        const scene = await compose(build(uniform, m, r, { gender, badges: [MASTER_GT] }));
        const bs = onSuit(scene, l => l.role === 'badge');
        assert.deepEqual(bs.map(l => l.key), ['badge:' + MASTER_GT.id], `${uniform} ${gender} ${r}`);
        const tag = onSuit(scene, l => l.key === 'nametag')[0];
        assert.ok(bs[0].x >= tag.x && bs[0].x + bs[0].w <= tag.x + tag.w && bs[0].y >= tag.y && bs[0].y + bs[0].h <= tag.y + tag.h / 2 + EPS, `${uniform} ${gender} ${r}: on the tag, above the name`);
        assert.ok(!scene.conflicts.some(c => c.position === 'tag'), 'one candidate is no conflict');
      }
    }
  }
});

test('FIELD7-5: with the pilot badge and the master Ground Team badge the tag shows the pilot badge unless the member chooses the Ground Team badge; the scene reports the conflict at position tag (8.2.4.1, 8.3.4.1)', async () => {
  for(const uniform of ['flight_suit', 'corporate_flight_suit']){
    for(const [m, r] of [['senior', 'Capt'], ['senior', 'SMSgt'], ['cadet', 'C/SSgt']]){
      const badges = [PILOT, MASTER_GT];
      const dflt = await compose(build(uniform, m, r, { badges }));
      assert.deepEqual(onSuit(dflt, l => l.role === 'badge').map(l => l.key), ['badge:' + PILOT.id], `${uniform} ${r} default`);
      const c = dflt.conflicts.find(x => x.position === 'tag');
      assert.ok(c, `${uniform} ${r}: conflict reported`);
      assert.deepEqual(c.candidates.map(x => x.id), [PILOT.id, MASTER_GT.id]);
      assert.equal(c.limit, 1);
      assert.deepEqual(c.shown, [PILOT.id]);
      assert.equal(c.choice, null);
      const picked = await compose(build(uniform, m, r, { badges, badgeChoices: { tag: MASTER_GT.id } }));
      assert.deepEqual(onSuit(picked, l => l.role === 'badge').map(l => l.key), ['badge:' + MASTER_GT.id], `${uniform} ${r} chosen`);
      const c2 = picked.conflicts.find(x => x.position === 'tag');
      assert.deepEqual(c2.shown, [MASTER_GT.id]);
      assert.equal(c2.choice, MASTER_GT.id);
      assert.ok(picked.notes.some(n => /Master Ground Team Badge is shown; Pilot Badge is not shown/.test(n)), picked.notes.join(' | '));
    }
  }
});

test('FIELD7-5: the command pin stays an alternative on the tag and can be chosen over the occupational badge or the wings', async () => {
  const dflt = await compose(build('flight_suit', 'senior', 'SMSgt', { badges: [MASTER_GT], command: GROUP_PIN }));
  assert.deepEqual(onSuit(dflt, l => l.role === 'badge').map(l => l.key), ['badge:' + GROUP_PIN.id], 'the pin takes the occupational badge\'s place by default');
  const picked = await compose(build('flight_suit', 'senior', 'SMSgt', { badges: [MASTER_GT, PILOT], command: GROUP_PIN, badgeChoices: { tag: GROUP_PIN.id } }));
  assert.deepEqual(onSuit(picked, l => l.role === 'badge').map(l => l.key), ['badge:' + GROUP_PIN.id]);
  assert.deepEqual(picked.conflicts.find(x => x.position === 'tag').candidates.map(x => x.id), [PILOT.id, GROUP_PIN.id, MASTER_GT.id]);
  const gt = await compose(build('flight_suit', 'senior', 'SMSgt', { badges: [MASTER_GT, PILOT], command: GROUP_PIN, badgeChoices: { tag: MASTER_GT.id } }));
  assert.deepEqual(onSuit(gt, l => l.role === 'badge').map(l => l.key), ['badge:' + MASTER_GT.id]);
  const stale = await compose(build('flight_suit', 'senior', 'SMSgt', { badges: [PILOT], badgeChoices: { tag: MASTER_GT.id } }));
  assert.deepEqual(onSuit(stale, l => l.role === 'badge').map(l => l.key), ['badge:' + PILOT.id], 'a choice that is not held changes nothing');
});

// ---- 3. the flight jacket: an optional add-on, level with the suit -------------------------------------------------------------------------

test('FIELD7-3: the flight jacket is drawn only when opt.jacket is on, with none of its pieces otherwise, FDU and CFDU, both sexes', async () => {
  for(const uniform of ['flight_suit', 'corporate_flight_suit']){
    for(const gender of ['male', 'female']){
      for(const opt of [{}, { jacket: false }]){
        const scene = await compose(build(uniform, 'senior', 'Col', { gender, opt, badges: [PILOT], patches: [] }));
        assert.equal(scene.layers.filter(l => l.role === 'garment').length, 1, `${uniform} ${gender} ${JSON.stringify(opt)}: the suit only`);
        assert.ok(!scene.layers.some(l => l.figure === 2), `${uniform} ${gender}: no second figure`);
      }
      const on = await compose(build(uniform, 'senior', 'Col', { gender, opt: { jacket: true }, badges: [PILOT] }));
      assert.deepEqual(on.layers.filter(l => l.role === 'garment').map(l => l.id), [uniform === 'flight_suit' ? 'garment-fdu-flight-suit' : 'garment-cfdu-flight-suit', uniform === 'flight_suit' ? 'garment-flight-jacket-green' : 'garment-flight-jacket-blue']);
    }
  }
});

test('FIELD7-3: with the jacket on, its shoulder line (the sheets\' top_line_y_in, where the flag hangs 1/2 in from the seam) is level with the suit\'s, and so are the two flags', async () => {
  for(const uniform of ['flight_suit', 'corporate_flight_suit']){
    for(const gender of ['male', 'female']){
      const scene = await compose(build(uniform, 'senior', 'Col', { gender, opt: { jacket: true }, badges: [PILOT] }));
      const [suit, jacket] = scene.layers.filter(l => l.role === 'garment');
      const top = async l => (await ST.load(l.id)).raw.dimensions.sheet_alignment.top_line_y_in + l.y;
      assert.ok(Math.abs((await top(suit)) - (await top(jacket))) < 1e-6, `${uniform} ${gender}: shoulder lines ${(await top(suit)).toFixed(3)} vs ${(await top(jacket)).toFixed(3)}`);
      assert.ok(jacket.y > suit.y + 1, 'the jacket sheet sits lower than the suit sheet by the difference of their top lines');
      // The flags (both 1/2 in below the shoulder seam) are level.
      const flag = async l => { const s = await ST.load(l.id); return l.y + core.landmarkBounds(s, 'patch_flag_left').y; };
      assert.ok(Math.abs((await flag(suit)) - (await flag(jacket))) < 1e-6, `${uniform} ${gender}: flags level`);
    }
  }
});
// ---- 2. the ES patch on the right breast pocket of the flight suits (LIVE9-4 withdrew FIELD7-2's patch hung 1/8 in under the pocket) ---------------------------------------------------

test('LIVE9-4 (FIELD7-2 withdrawn): the ES patch is on the right breast pocket\'s body, centred on it, with "centered" drawn and no 1/8 in gap or estimate note, FDU and CFDU, both sexes, both styles (8.2.4.3, 8.3.4.3)', async () => {
  for(const [uniform, gid] of [['flight_suit', 'garment-fdu-flight-suit'], ['corporate_flight_suit', 'garment-cfdu-flight-suit']]){
    const spec = await ST.load(gid);
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'images/garments', gid + '.spec.json'), 'utf8'));
    for(const gender of ['male', 'female']){
      for(const style of ['style-1', 'style-2']){
        const scene = await compose(build(uniform, 'senior', 'Capt', { gender, opt: { esPatch: style } }));
        const g = scene.layers.find(l => l.id === gid), k = g.w / spec.w;
        const pts = raw.landmarks.chest_pocket_right.map(p => ({ x: g.x + p[0] * 0.01 * k, y: g.y + p[1] * 0.01 * k }));
        const bottom = Math.max(...pts.map(p => p.y)), top = Math.min(...pts.map(p => p.y));
        const es = onSuit(scene, l => l.role === 'patch')[0];
        const tag = `${uniform} ${gender} ${style}`;
        assert.ok(es, tag);
        const cx = es.x + es.w / 2, cy = es.y + es.h / 2;
        assert.ok(cy > top && es.y + es.h < bottom, `${tag}: on the pocket (${es.y.toFixed(2)} to ${(es.y + es.h).toFixed(2)} in, the pocket ${top.toFixed(2)} to ${bottom.toFixed(2)})`);
        const ms = onSuit(scene, l => l.type === 'measure');
        const centred = ms.find(m => m.label === 'centered');
        assert.ok(centred && Math.abs(centred.opts.mid.x - cx) < 0.005 && Math.abs(centred.from.x + centred.to.x - 2 * cx) < 0.01, `${tag}: "centered" spans the pocket's width at the patch's height and ticks at the patch's centre`);
        assert.ok(!ms.some(m => m.label === '⅛ in' && Math.abs(m.from.y - bottom) < 0.05), `${tag}: no gap under the pocket is drawn (the 1/8 in on the chest badge's blue border is another measure)`);
        assert.ok(!scene.notes.some(n => /gives no distance below it/.test(n)), `${tag}: no estimate note`);
      }
    }
  }
});

// ---- 1. the chest badges' distance from the CAP tape is measured to the embroidery ---------------------------------------------------

const FIELD_GARMENT = { ocp: 'garment-ocp-coat-abu-cut', abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' };
const BADGE_IDS = ['CAPPilot1_FA9D33EA587D8', 'ground_team_basic_badge', 'senior_ground_team_badge', 'master_ground_team_badge'];
const fieldBuild = (uniform, n, gender, extra) => build(uniform, 'senior', 'Capt', Object.assign({ gender, badges: BADGE_IDS.slice(0, n).map(id => ({ id, title: id })) }, extra));

// The tape's top edge, and the bottom edge of each chest badge's embroidery, in scene inches.
async function tapeAndBadges(scene, uniform){
  const gid = FIELD_GARMENT[uniform];
  const spec = await ST.load(gid), g = scene.layers.find(l => l.id === gid), k = g.w / spec.w;
  const tape = core.landmarkBounds(spec, 'cap_tape');
  const badges = [];
  for(const l of scene.layers.filter(x => x.role === 'badge' && x.type === 'asset' && x.figure !== 2)){
    const s = await ST.load(l.id), a = core.anchor(s, 'art_bottom_center');
    const kk = l.h / s.h;
    badges.push({ l, artBottom: a ? l.y + a.y * kk : l.y + l.h, blueBottom: l.y + l.h, blueTop: l.y });
  }
  return { tapeTop: g.y + tape.y * k, badges };
}
const calloutsOf = scene => scene.layers.filter(l => l.type === 'measure' && l.opts && l.opts.callout && l.opts.callout.span);

test('FIELD7-1: the lowest chest badge\'s embroidery is 1/2 in above the top of the CAP tape with one or two badges (OCP 7.1.1.3.1.1-2, ABU 5.1.1.1.2.4, CFU 5.2.1.1.2.6), both sexes, and the overlay carries the inset for it', async () => {
  for(const uniform of ['ocp', 'abu', 'corporate_field']){
    for(const gender of ['male', 'female']){
      for(const n of [1, 2]){
        const scene = await compose(fieldBuild(uniform, n, gender));
        const { tapeTop, badges } = await tapeAndBadges(scene, uniform);
        assert.equal(badges.length, n, `${uniform} ${gender} ${n}`);
        const lowest = badges.reduce((a, x) => (x.artBottom > a.artBottom ? x : a));
        assert.ok(Math.abs(tapeTop - lowest.artBottom - 0.5) < 0.005, `${uniform} ${gender} ${n}: tape top to embroidery bottom ${(tapeTop - lowest.artBottom).toFixed(4)} in`);
        // The blue backing lies 1/8 in lower than the embroidery, so it is 3/8 in from the tape, not 1/2.
        assert.ok(Math.abs(tapeTop - lowest.blueBottom - 0.375) < 0.005, `${uniform} ${gender} ${n}: backing ${(tapeTop - lowest.blueBottom).toFixed(4)} in from the tape`);
        const cs = calloutsOf(scene);
        assert.equal(cs.length, 1, `${uniform} ${gender} ${n}: one inset`);
        assert.equal(cs[0].label, '½ in');
        assert.equal(cs[0].opts.callout.caption, 'from the tape to the embroidery');
        assert.ok(Math.abs(cs[0].from.y - tapeTop) < 0.005 && Math.abs(cs[0].to.y - (tapeTop - 0.5)) < 0.005, `${uniform} ${gender} ${n}: measured from the tape's top edge to the embroidery's bottom edge`);
        assert.ok(Math.abs(cs[0].opts.callout.marks[0] - 0.375) < 0.005, 'the backing edge is marked 3/8 in from the tape');
      }
    }
  }
});

test('FIELD7-1: three and four OCP badges: the lowest embroidery is 1/8 in above the tape\'s top edge (7.1.1.3.1.3-4), the backing on the tape, in both layouts and both sexes', async () => {
  for(const gender of ['male', 'female']){
    for(const n of [3, 4]){
      for(const badgeLayout of ['column', 'pair']){
        const scene = await compose(fieldBuild('ocp', n, gender, { opt: { badgeLayout } }));
        const { tapeTop, badges } = await tapeAndBadges(scene, 'ocp');
        assert.equal(badges.length, n);
        const lowest = badges.reduce((a, x) => (x.artBottom > a.artBottom ? x : a));
        assert.ok(Math.abs(tapeTop - lowest.artBottom - 0.125) < 0.005, `${gender} ${n} ${badgeLayout}: tape top to embroidery bottom ${(tapeTop - lowest.artBottom).toFixed(4)} in`);
        assert.ok(Math.abs(tapeTop - lowest.blueBottom) < 0.005, `${gender} ${n} ${badgeLayout}: the blue backing lies on the tape`);
        const cs = calloutsOf(scene);
        assert.equal(cs.length, 1);
        assert.equal(cs[0].label, '⅛ in');
        assert.equal(cs[0].opts.callout.caption, 'from the tape to the embroidery');
      }
    }
  }
});

test('FIELD7-1: the gaps between OCP badges stay as 7.1.1.3.1 states them, blue backing edge to blue backing edge (Ethan ruled on the tape distance only)', async () => {
  const two = await compose(fieldBuild('ocp', 2, 'male'));
  const { badges } = await tapeAndBadges(two, 'ocp');
  const [up, low] = badges.sort((a, b) => a.blueTop - b.blueTop);
  assert.ok(Math.abs(low.blueTop - up.blueBottom - 0.5) < 0.005, `two badges: ${(low.blueTop - up.blueBottom).toFixed(4)} in between the backings`);
  const four = await compose(fieldBuild('ocp', 4, 'male'));
  const rows = (await tapeAndBadges(four, 'ocp')).badges;
  const byX = new Map();
  for(const x of rows){ const key = Math.round((x.l.x + x.l.w / 2) * 10); byX.set(key, (byX.get(key) || []).concat(x)); }
  // The top row is one row: it keeps 1/4 in from the TALLER of the two lower badges, so the other column's gap is 1/4 in plus the height
  // difference (the ground team badges grew with the EMT wreath, LIVE13 E91, so the two lower badges no longer share a height).
  const gaps = [];
  for(const col of byX.values()){
    col.sort((a, b) => a.blueTop - b.blueTop);
    for(let i = 1; i < col.length; i++) gaps.push(col[i].blueTop - col[i - 1].blueBottom);
  }
  assert.equal(gaps.length, 2, 'two columns of two');
  assert.ok(Math.abs(Math.min(...gaps) - 0.25) < 0.005, `four badges: ${Math.min(...gaps).toFixed(4)} in between the backings in the column with the taller lower badge`);
  for(const g of gaps) assert.ok(g > 0.25 - 0.005, `four badges: ${g.toFixed(4)} in between the backings`);
});

