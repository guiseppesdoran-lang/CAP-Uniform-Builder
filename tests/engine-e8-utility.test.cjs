'use strict';
// E8-UTILITY: the OCP, ABU and Corporate Field Uniform (ICL 25-06 chapter 7, CAPR 39-1 5.1.1 and 5.2.1),
// measured in inches on the composed scene: the sleeve patches show in the flat sleeve view and in
// the edge view on the coat, the graduated commander's insignia rests on the loop that shows, no
// grade piece is mounted anywhere but the chest square and the caps, and the measurement overlay
// lists every distance the engine used.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const C = require('../js/engine/compose.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const ST = store();
const EPS = 0.01;

const OCP = 'garment-ocp-coat-abu-cut';
const UNIT = { id: 'sequoyah_cadet_squadron_patch', title: 'Unit', href: 'images/patches/sequoyah_cadet_squadron_patch.webp', aspect: 1, slot: 'R_SHOULDER', kind: 'unit' };
const WING = { id: 'nywg_patch', title: 'Wing', href: 'images/patches/nywg_patch.webp', aspect: 1, slot: 'L_SHOULDER', kind: 'general' };
const PILOT = { id: 'CAPPilot1_FA9D33EA587D8', title: 'Pilot Badge' };
const GT = { id: 'ground_team_basic_badge', title: 'Ground Team Badge' };
const PIN = { id: 'squadron_commander_badge', title: 'Squadron Commander Badge', graduated: true };

function build(uniform, membership, rank, extra){
  const b = Object.assign({
    uniform, gender: 'male', grade: G.gradeInfo(membership, rank, {}),
    opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
  return b;
}

const measures = scene => scene.layers.filter(l => l.type === 'measure');
const len = m => Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y);

async function rectOf(name, garment){
  const spec = await ST.load(garment || OCP);
  return core.landmarkBounds(spec, name);
}

// The sheet's own edge view of the right/left shoulder pocket, read from the artwork: the flag patch
// rect inside the pocket's edge group and the group's turn about its centre (scene inches).
function sheetEdgeView(side){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', OCP + '.svg'), 'utf8');
  const group = new RegExp(`<g id="${OCP}__sleeve-pocket-edge-${side}" transform="rotate\\(([-\\d.]+) ([-\\d.]+) ([-\\d.]+)\\)">`).exec(svg);
  assert.ok(group, `edge group on the ${side} sleeve`);
  const flagAt = svg.indexOf(`id="${OCP}__patch-${side === 'right' ? 'flag' : 'aux'}-edge-${side}"`);
  assert.ok(flagAt > 0, 'edge patch group');
  const rect = /<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(svg.slice(flagAt));
  // The sheet's art group is translate(top_center.x, centerline_top.y) scale(100).
  const art = /<g id="[^"]*__art" transform="translate\(([\d.]+) ([\d.]+)\) scale\(100\)">/.exec(svg);
  const ox = Number(art[1]) / 100, oy = Number(art[2]) / 100;
  const pivot = { x: ox + Number(group[2]), y: oy + Number(group[3]) };
  const r = { x: ox + Number(rect[1]), y: oy + Number(rect[2]), w: Number(rect[3]), h: Number(rect[4]) };
  return { tilt: Number(group[1]), pivot, flag: r, flagCenter: core.rotatePoint({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, pivot, Number(group[1])) };
}

// ---- D22: the patch shows on both sleeve views and the coat ----------------------------------------

test('OCP: the unit and higher headquarters patches show in the flat sleeve view and in the edge view on the coat (7.1.1.4.1.2, 7.1.1.4.2.1)', async () => {
  const scene = await P.composeUniform(build('ocp', 'senior', 'Capt', { patches: [UNIT, WING] }), store());
  for(const [p, slot, side, drawn] of [[UNIT, 'R_SHOULDER', 'right', 'patch_flag_right'], [WING, 'L_SHOULDER', 'left', 'patch_aux_left']]){
    const flat = scene.layers.find(l => l.key === `patch:${p.id}:${slot}:0`);
    const edge = scene.layers.find(l => l.key === `patch:${p.id}:${slot}:edge`);
    assert.ok(flat, `${p.title}: flat sleeve view`);
    assert.ok(edge, `${p.title}: edge view on the coat`);
    assert.equal(edge.role, 'patch');
    assert.equal(edge.href, flat.href);
    // The same patch, seen narrowed to half its width and as tall.
    assert.ok(Math.abs(edge.w - flat.w * 0.5) < EPS && Math.abs(edge.h - flat.h) < EPS, `${p.title}: edge view is the flat one narrowed to half`);
    assert.equal(edge.fit, 'stretch');

    // Where the sheet draws the flag/AUX patch in the edge view, this patch sits under it with the same
    // offset the flat view has, narrowed and turned the way the sheet turns its pocket.
    const sheet = sheetEdgeView(side);
    assert.ok(Math.abs(edge.rotate - sheet.tilt) < 1e-6, `${p.title}: turned ${sheet.tilt} deg like the sheet's pocket`);
    const drawnFlat = await rectOf(drawn);
    const dx = flat.x + flat.w / 2 - (drawnFlat.x + drawnFlat.w / 2), dy = flat.y + flat.h / 2 - (drawnFlat.y + drawnFlat.h / 2);
    const want = core.rotatePoint({ x: sheet.flag.x + sheet.flag.w / 2 + dx * 0.5, y: sheet.flag.y + sheet.flag.h / 2 + dy }, sheet.pivot, sheet.tilt);
    // the raster is turned about its own centre, so its origin is its centre in the turned view
    assert.ok(Math.abs(edge.origin.x - want.x) < 0.02 && Math.abs(edge.origin.y - want.y) < 0.02, `${p.title}: edge centre (${edge.origin.x.toFixed(3)}, ${edge.origin.y.toFixed(3)}) vs sheet (${want.x.toFixed(3)}, ${want.y.toFixed(3)})`);
    assert.ok(Math.abs(edge.x + edge.w / 2 - edge.origin.x) < 1e-6 && Math.abs(edge.y + edge.h / 2 - edge.origin.y) < 1e-6);
  }
  assert.equal(scene.layers.filter(l => l.role === 'patch').length, 4, 'two patches, each drawn twice');
});

test('OCP: composing the same build twice draws the same patches (the build is not consumed)', async () => {
  const b = build('ocp', 'senior', 'Capt', { patches: [UNIT, WING] });
  const one = await P.composeUniform(b, store());
  const two = await P.composeUniform(b, store());
  const keys = s => s.layers.filter(l => l.role === 'patch').map(l => l.key).sort();
  assert.deepEqual(keys(two), keys(one));
  assert.equal(b.patches.length, 2, 'the member\'s list is left alone');
});

test('OCP: both flat sleeve views and the coat agree for every grade (patch drawn per sleeve, per view)', async () => {
  for(const [m, r] of [['cadet', 'C/SSgt'], ['senior', 'Capt'], ['senior', 'Lt Col'], ['senior', 'SMSgt']]){
    for(const gender of ['male', 'female']){
      const scene = await P.composeUniform(build('ocp', m, r, { gender, patches: [UNIT, WING] }), store());
      for(const key of ['patch:sequoyah_cadet_squadron_patch:R_SHOULDER', 'patch:nywg_patch:L_SHOULDER']){
        assert.ok(scene.layers.some(l => l.key === key + ':0'), `${r} ${gender} ${key} flat`);
        assert.ok(scene.layers.some(l => l.key === key + ':edge'), `${r} ${gender} ${key} edge`);
      }
    }
  }
});

test('OCP: a patch stays inside the Velcro of its sleeve in the flat view (7.1.1.4)', async () => {
  const scene = await P.composeUniform(build('ocp', 'senior', 'Capt', { patches: [UNIT, WING] }), store());
  for(const [key, velcro] of [['patch:sequoyah_cadet_squadron_patch:R_SHOULDER:0', 'sleeve_flap_velcro_right'], ['patch:nywg_patch:L_SHOULDER:0', 'sleeve_flap_velcro_left']]){
    const l = scene.layers.find(x => x.key === key), v = await rectOf(velcro);
    assert.ok(l.x >= v.x - EPS && l.x + l.w <= v.x + v.w + EPS && l.y >= v.y - EPS && l.y + l.h <= v.y + v.h + EPS, key);
  }
});
