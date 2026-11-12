'use strict';
// The chest badges above the CAP tape and the commander's pin and ES patch above the name tape on the three field coats (OCP 7.1.1.3.1.1-4,
// ABU 5.1.1.1.2.4, CFU 5.2.1.1.2.6, 5.2.1.1.2.8-9), measured in inches on the composed scene for every badge the catalog draws there, in every layout:
//   one or two badges  the lowest badge's silver is 1/2 in above the top edge of the tape (7.1.1.3.1.1 'Measure from the top of the CAP tape to the
//                      silver of the badge'; the blue backing is then 3/8 in from the tape)
//   three or four      the lowest row's blue edge is 1/8 in above the tape (7.1.1.3.1.3-4 with 7.1.1.3.1 'Badge placement is measured from the blue
//                      fabric edges'), whatever the badges' heights: none lies on the tape (Ethan, 2026-11-12, two badges on the tape: "also fix this
//                      spacing issue")
//   between badges     1/2 in side by side, 1/4 in between rows of three and four, 1/2 in between the two of an OCP pair, all blue edge to blue edge on
//                      the OCP; the ABU and CFU pair 1/2 in silver to silver (5.2.1.1.2.6)
//   name tape          the current commander's pin 1/2 in above it, the ES patch 1/2 in above the pin
// No badge comes closer to the tape than that distance (within 0.01 in), and no two badges overlap. The scene is in inches and the page scales it as
// one, so the same distances hold at any width the page is shown at.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
const B = require('../data/badge-catalog.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const GARMENT = { ocp: 'garment-ocp-coat-abu-cut', abu: 'garment-abu-coat', corporate_field: 'garment-cfu-coat' };
const TOL = 0.01;

const PILOT = 'CAPPilot1_FA9D33EA587D8', GT = 'ground_team_basic_badge', EMT = 'emt_basic_badge', MED = 'medical_officer';
const withField = fam => Object.keys(B.BADGES).filter(id => B.BADGES[id].field && B.BADGES[id].family === fam);
const AVIATION = withField('aviation'), OCCUPATIONAL = withField('occupational'), CHAPLAIN = withField('chaplain');
const SENIOR = ['senior', 'Lt Col'], CADET = ['cadet', 'C/Lt Col'];

function build(uniform, gender, member, ids, opt, extra){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo(member[0], member[1], {}), opt: Object.assign({ headgear: 'auto' }, opt || {}), name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: ids.map(id => ({ id, title: id })), command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const compose = b => P.composeUniform(b, store);

// The top edge of a tape the sheet draws, in scene inches.
async function tapeTop(scene, uniform, landmark){
  const gid = GARMENT[uniform];
  const spec = await store.load(gid), g = scene.layers.find(l => l.id === gid);
  return g.y + core.landmarkBounds(spec, landmark).y * (g.w / spec.w);
}
// Every badge drawn above the CAP tape as { id, x, y, w, h, bottom, silver, silverTop }: the blue box, the embroidery's bottom and top edges, scene inches.
async function chestBadges(scene){
  const out = [];
  for(const l of scene.layers.filter(x => x.role === 'badge' && x.type === 'asset' && x.place === 'above the CAP tape')){
    const s = await store.load(l.id), k = l.h / s.h, bottom = core.anchor(s, 'art_bottom_center'), top = core.anchor(s, 'art_top_center');
    out.push({ id: l.key.replace(/^badge:/, ''), x: l.x, y: l.y, w: l.w, h: l.h, bottom: l.y + l.h, silver: l.y + bottom.y * k, silverTop: l.y + top.y * k });
  }
  return out;
}

// Every scenario for one uniform: { layout (how many badges), form, who, ids, opt, order }: each badge the catalog draws on a field coat is the only badge,
// the lower of two, the top of two, and on the OCP in the lowest row of three and four in both forms and both places (the member's order of equal
// badges, build.badgeOrder, puts the occupational ones where the scenario wants them).
function scenarios(uniform){
  const out = [];
  const one = uniform === 'ocp' ? [...AVIATION, ...OCCUPATIONAL] : [...CHAPLAIN, ...AVIATION, ...OCCUPATIONAL];
  for(const x of one) out.push({ layout: 1, who: x, ids: [x] });
  for(const x of OCCUPATIONAL) out.push({ layout: 2, who: x, ids: [PILOT, x] });
  for(const x of AVIATION) out.push({ layout: 2, who: x, ids: [x, GT] });
  if(uniform !== 'ocp'){
    for(const x of CHAPLAIN) out.push({ layout: 2, who: x, ids: [x, PILOT] });
    return out;
  }
  for(const x of OCCUPATIONAL){
    const [a, b] = OCCUPATIONAL.filter(o => o !== x);
    for(const form of ['column', 'pair']){
      const opt = { badgeLayout: form };
      out.push({ layout: 3, form, who: x, ids: [PILOT, a, x], opt, order: { occupational: [a, x] } });
      out.push({ layout: 3, form, who: x, ids: [PILOT, x, a], opt, order: { occupational: [x, a] } });
      out.push({ layout: 4, form, who: x, ids: [PILOT, a, b, x], opt, order: { occupational: [a, b, x] } });
      out.push({ layout: 4, form, who: x, ids: [PILOT, x, a, b], opt, order: { occupational: [x, a, b] } });
    }
  }
  return out;
}

async function check(uniform, gender, member, sc){
  const scene = await compose(build(uniform, gender, member, sc.ids, sc.opt, sc.order ? { badgeOrder: sc.order } : null));
  const top = await tapeTop(scene, uniform, 'cap_tape');
  const badges = await chestBadges(scene);
  const tag = `${uniform} ${gender} ${member[1]}, ${sc.layout} badges${sc.form ? ', ' + sc.form : ''} (${sc.ids.join(' ')})`;
  assert.equal(badges.length, sc.ids.length, `${tag}: every badge is drawn above the tape`);
  const lowest = Math.max(...badges.map(x => x.bottom));
  const row = badges.filter(x => Math.abs(x.bottom - lowest) < 0.02);
  if(sc.layout <= 2){
    // 1/2 in from the tape to the silver of the lowest badge; nothing nearer.
    for(const x of badges) assert.ok(top - x.silver > 0.5 - TOL, `${tag}: ${x.id} silver is ${(top - x.silver).toFixed(4)} in from the tape, the rule is 1/2 in`);
    for(const x of row) assert.ok(Math.abs(top - x.silver - 0.5) < TOL, `${tag}: ${x.id} silver is ${(top - x.silver).toFixed(4)} in above the tape, not 1/2 in`);
  }else{
    // 1/8 in from the tape to the blue edge of the lowest row, whatever the badges' heights; nothing nearer.
    for(const x of badges) assert.ok(top - x.bottom > 0.125 - TOL, `${tag}: ${x.id} blue edge is ${(top - x.bottom).toFixed(4)} in from the tape, the rule is 1/8 in`);
    assert.equal(row.length, sc.layout === 3 && sc.form === 'column' ? 1 : 2, `${tag}: the lowest row`);
    for(const x of row) assert.ok(Math.abs(top - x.bottom - 0.125) < TOL, `${tag}: ${x.id} blue edge is ${(top - x.bottom).toFixed(4)} in above the tape, not 1/8 in`);
  }
  for(let i = 0; i < badges.length; i++) for(let j = i + 1; j < badges.length; j++){
    const p = badges[i], q = badges[j];
    const across = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x), down = Math.min(p.bottom, q.bottom) - Math.max(p.y, q.y);
    assert.ok(!(across > 1e-6 && down > 1e-6), `${tag}: ${p.id} overlaps ${q.id}`);
  }
}

for(const uniform of ['ocp', 'abu', 'corporate_field']){
  test(`${uniform}: every badge in every layout is at the rule's distance above the CAP tape and overlaps no other badge, both sexes`, async () => {
    let n = 0;
    for(const gender of ['male', 'female']){
      for(const sc of scenarios(uniform)){ await check(uniform, gender, SENIOR, sc); n++; }
    }
    assert.ok(n > 100, `${n} scenarios`);
  });
}

test('a cadet wears the badges a cadet may, at the same distances above the tape (the owner\'s setup: wings over two small badges)', async () => {
  const seen = new Set();
  for(const gender of ['male', 'female']){
    for(const sc of scenarios('ocp')){
      if(sc.ids.some(id => !B.eligibleFor(id, 'cadet'))) continue;
      await check('ocp', gender, CADET, sc);
      seen.add(sc.layout + (sc.form || ''));
    }
  }
  for(const k of ['1', '2', '3column', '3pair', '4column', '4pair']) assert.ok(seen.has(k), `a cadet scenario for ${k}`);
});

test('the lowest row of three and four OCP badges is level on the tape whatever the badges\' heights: the tallest and the shortest side by side', async () => {
  const heights = [];
  for(const id of OCCUPATIONAL) heights.push([id, (await store.load(B.art(id, 'field'))).h]);
  heights.sort((a, b) => a[1] - b[1]);
  const short = heights[0][0], tall = heights[heights.length - 1][0];
  assert.ok(heights[heights.length - 1][1] - heights[0][1] > 0.3, 'the two differ by more than 0.3 in');
  for(const form of ['column', 'pair']){
    for(const ids of [[PILOT, short, tall], [PILOT, tall, short]]){
      const scene = await compose(build('ocp', 'male', SENIOR, ids, { badgeLayout: form }, { badgeOrder: { occupational: ids.slice(1) } }));
      const top = await tapeTop(scene, 'ocp', 'cap_tape');
      const badges = await chestBadges(scene);
      const wings = badges.find(x => x.id === PILOT), low = badges.filter(x => x !== wings);
      const row = form === 'pair' ? low : [low.reduce((a, x) => (x.bottom > a.bottom ? x : a))];
      for(const x of row) assert.ok(Math.abs(top - x.bottom - 0.125) < TOL, `${form} ${ids.slice(1).join(' ')}: ${x.id} (${x.h.toFixed(3)} in tall) is ${(top - x.bottom).toFixed(4)} in from the tape`);
      if(form === 'pair'){
        const [l, r] = [...low].sort((a, b) => a.x - b.x);
        assert.ok(Math.abs(r.x - (l.x + l.w) - 0.5) < TOL, `${ids.slice(1).join(' ')}: ${(r.x - l.x - l.w).toFixed(4)} in between the pair, not 1/2 in`);
        assert.ok(Math.abs(Math.min(l.y, r.y) - wings.bottom - 0.25) < TOL, `${ids.slice(1).join(' ')}: the wings stand 1/4 in above the taller of the two`);
      }
    }
  }
});

test('rows above one another keep their distances, blue edge to blue edge: 1/2 in between two OCP badges, 1/4 in between three, 1/4 in and 1/2 in in the stacks of four', async () => {
  const byId = async ids => Object.fromEntries((await chestBadges(await compose(build('ocp', 'male', SENIOR, ids)))).map(x => [x.id, x]));
  const two = await byId([PILOT, GT]);
  assert.ok(Math.abs(two[GT].y - two[PILOT].bottom - 0.5) < TOL, `two: ${(two[GT].y - two[PILOT].bottom).toFixed(4)} in`);
  const three = await byId([PILOT, GT, EMT]);
  assert.ok(Math.abs(three[GT].y - three[PILOT].bottom - 0.25) < TOL, 'three: wings to the second');
  assert.ok(Math.abs(three[EMT].y - three[GT].bottom - 0.25) < TOL, 'three: second to the third');
  // Four: two stacks of two. The wings and the badge under them are one stack, the other two the second; the rows are 1/4 in apart measured from the
  // taller of the lower badges, the stacks 1/2 in apart.
  const four = await byId([PILOT, GT, EMT, MED]);
  const rowTop = Math.min(four[EMT].y, four[MED].y);
  for(const id of [PILOT, GT]) assert.ok(Math.abs(rowTop - four[id].bottom - 0.25) < TOL, `four: ${id} is ${(rowTop - four[id].bottom).toFixed(4)} in above the taller of the lower row`);
  const leftEdge = Math.max(four[PILOT].x + four[PILOT].w, four[EMT].x + four[EMT].w), rightEdge = Math.min(four[GT].x, four[MED].x);
  assert.ok(Math.abs(rightEdge - leftEdge - 0.5) < TOL, `four: ${(rightEdge - leftEdge).toFixed(4)} in between the stacks`);
});

test('ABU and CFU: two badges are 1/2 in apart silver to silver and the lower is 1/2 in silver to tape, with a chaplain badge in the higher place, both sexes', async () => {
  for(const uniform of ['abu', 'corporate_field']){
    for(const gender of ['male', 'female']){
      for(const ids of [[PILOT, GT], [CHAPLAIN[0], PILOT], [CHAPLAIN[0], GT]]){
        const scene = await compose(build(uniform, gender, SENIOR, ids));
        const top = await tapeTop(scene, uniform, 'cap_tape');
        const [up, low] = (await chestBadges(scene)).sort((a, b) => a.y - b.y);
        const tag = `${uniform} ${gender} ${ids.join(' ')}`;
        assert.ok(Math.abs(low.silverTop - up.silver - 0.5) < TOL, `${tag}: silver to silver ${(low.silverTop - up.silver).toFixed(4)} in`);
        assert.ok(Math.abs(top - low.silver - 0.5) < TOL, `${tag}: silver to tape ${(top - low.silver).toFixed(4)} in`);
      }
    }
  }
});

test('the name tape: the current commander\'s pin is 1/2 in above it and the CFU ES patch 1/2 in above the pin, on all three coats, both sexes', async () => {
  for(const uniform of ['ocp', 'abu', 'corporate_field']){
    for(const gender of ['male', 'female']){
      for(const pinId of ['squadron_commander_badge', 'group_commander_badge']){
        for(const es of uniform === 'corporate_field' ? ['none', 'style-1', 'style-2'] : ['none']){
          const scene = await compose(build(uniform, gender, SENIOR, [], { esPatch: es }, { command: { id: pinId, title: pinId, graduated: false } }));
          const top = await tapeTop(scene, uniform, 'name_tape');
          const pin = scene.layers.find(l => l.role === 'badge' && /:ON:/.test(l.key));
          const tag = `${uniform} ${gender} ${pinId} ES ${es}`;
          assert.ok(pin, `${tag}: the pin is drawn`);
          assert.ok(Math.abs(top - (pin.y + pin.h) - 0.5) < TOL, `${tag}: the pin is ${(top - pin.y - pin.h).toFixed(4)} in above the name tape`);
          const patch = scene.layers.find(l => l.role === 'patch' && /^patch:patch-es-/.test(l.key));
          if(es === 'none') assert.ok(!patch, `${tag}: no ES patch`);
          else{
            assert.ok(patch, `${tag}: the ES patch is drawn`);
            assert.ok(Math.abs(pin.y - (patch.y + patch.h) - 0.5) < TOL, `${tag}: the ES patch is ${(pin.y - patch.y - patch.h).toFixed(4)} in above the pin`);
          }
        }
      }
    }
  }
});
