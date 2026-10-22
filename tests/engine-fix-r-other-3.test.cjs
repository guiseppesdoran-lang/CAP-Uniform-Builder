'use strict';
// FIX-R-OTHER-r1 review round 3 findings (engine side). One block per finding.

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
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function build(uniform, gender, membership, rank, badges, extra){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: (badges || []).map(id => ({ id })), command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const compose = b => P.composeUniform(b, store);
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const rad = d => d * Math.PI / 180;

// ---- 1, 2. Mess dress boards: bars across the board; every edge-on grade fits the strip --------------------

const BARS = ['2d Lt', '1st Lt', 'Capt'];
const MESS_GRADES = ['2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col', 'Brig Gen', 'Maj Gen'];

test('mess dress: the bars of 2d Lt, 1st Lt and Captain lie across the shoulder board, top view and edge-on (4.1.1.1.1.1, 4.1.2.1.1.1, Fig A5-1, A5-3)', async () => {
  for(const sex of ['male', 'female']){
    const boardsId = `garment-mess-dress-${sex}-officer-shoulder-boards`;
    const boards = await store.load(boardsId);
    for(const rank of BARS){
      const scene = await compose(build('mess_dress', sex, 'senior', rank));
      for(const side of ['right', 'left']){
        const frame = boards.landmarks[`rank_slot_${side}_frame`].deg;
        for(const key of [`grade:top-${side}`, `grade:edge-${side}`]){
          const l = byKey(scene, key);
          assert.ok(l, `${sex} ${rank}: ${key} drawn`);
          // The art's bars stand along its height, so their long axis is the layer's turn + 90 deg.
          const spec = await store.load(l.id);
          assert.ok(spec.h > spec.w, `${l.id}: the bars' long axis is the art's height`);
          const dot = Math.cos(rad(l.rotate + 90 - frame));
          assert.ok(Math.abs(dot) < 0.01, `${sex} ${rank} ${key}: bar axis is perpendicular to the board (cos ${dot.toFixed(4)})`);
        }
      }
    }
  }
});

test('mess dress: the leaf, stars and eagle keep their quarter turn to the board (4.1.1.1.1.2-3)', async () => {
  for(const sex of ['male', 'female']){
    const boards = await store.load(`garment-mess-dress-${sex}-officer-shoulder-boards`);
    for(const rank of ['Maj', 'Lt Col', 'Col']){
      const scene = await compose(build('mess_dress', sex, 'senior', rank));
      const frame = boards.landmarks.rank_slot_right_frame.deg;
      const l = byKey(scene, 'grade:top-right');
      assert.ok(Math.abs(Math.cos(rad(l.rotate - frame - 90))) > 0.999, `${sex} ${rank}: turned frame + 90 (${l.rotate} vs ${frame})`);
    }
  }
});

test('mess dress: every edge-on grade is 0.25-0.32 in across the 0.4 in strip, every grade, both cuts (R7)', async () => {
  for(const sex of ['male', 'female']) for(const rank of MESS_GRADES){
    const scene = await compose(build('mess_dress', sex, 'senior', rank));
    for(const side of ['right', 'left']){
      const strip = byKey(scene, `epaulet-edge:${side}`), l = byKey(scene, `grade:edge-${side}`);
      assert.ok(strip && l, `${sex} ${rank} ${side}: strip and grade drawn`);
      // l.w x l.h is the piece as drawn (after scale); rel is its turn relative to the strip.
      const rel = rad(l.rotate - strip.rotate);
      const across = l.w * Math.abs(Math.sin(rel)) + l.h * Math.abs(Math.cos(rel));
      assert.ok(across <= 0.32 + 0.002 && across >= 0.25, `${sex} ${rank} ${side}: ${across.toFixed(3)} in across a ${strip.h} in strip`);
    }
  }
});

// ---- 3. Semi-formal blazer: the lapel does not cover a miniature medal ----------------------------------------

const RA = require('../data/ribbon-awards.js');
const C = require('../js/engine/compose.js');
function minisOf(ids){
  return ids.flatMap(id => RA.resolve(id, id === 'cap_achievment_award' ? { capub_total_3: true } : {}).map(r => ({ key: 'mini:' + id, title: id, ribbonAsset: 'ribbon-' + id.replace(/_/g, '-'), medal: 'medal-' + id.replace(/_/g, '-') + '-miniature', devices: r.devices })));
}
const TWELVE = ['distinguished_service_award', 'exceptional_service_award', 'meritorious_service_award', 'commander_commendation_award', 'cap_achievment_award', 'search_find_ribbon', 'air_search_and_rescue_ribbon', 'cap_gill_robb_wilson_ribbon', 'cap_command_service_ribbon', 'cap_leadership_ribbon', 'cap_membership_ribbon', 'red_service_ribbon'];

// The wearer's left lapel read straight from the sheet's lapel-foreground group (art frame translate + path points).
function lapelFromSheet(sex){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', `garment-corporate-service-dress-blazer-${sex}.svg`), 'utf8');
  const tr = /<g id="[^"]*__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(100\)"/.exec(svg);
  const d = new RegExp(`id="[^"]*lapel-left" d="([^"]*)"`).exec(svg)[1];
  const pts = [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: +m[1] + tr[1] / 100, y: +m[2] + tr[2] / 100 }));
  return pts;
}
function boxOf(l){
  // The layer's box turned about its origin (devices are turned 90 deg).
  const cx = l.x + l.w / 2, cy = l.y + l.h / 2, t = rad(l.rotate || 0);
  const ox = l.origin ? l.origin.x : cx, oy = l.origin ? l.origin.y : cy;
  const pts = [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => ({ x: ox + (x - ox) * Math.cos(t) - (y - oy) * Math.sin(t), y: oy + (x - ox) * Math.sin(t) + (y - oy) * Math.cos(t) }));
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

test('semi-formal blazer: no miniature drape, medal or device touches the lapel, and the lowest row stays 1/2 in over the crest (11.2.8, 4.2.1.4, 4.2.2.4)', async () => {
  for(const sex of ['male', 'female']){
    const lapel = lapelFromSheet(sex);
    assert.ok(lapel.length > 10, `${sex}: lapel polygon read from the sheet`);
    const crestTop = core.anchor(await store.load(`garment-corporate-service-dress-blazer-${sex}`), 'crest_top_center').y;
    for(const n of [1, 4, 5, 9, 12]){
      const scene = await compose(build('semi_formal', sex, 'senior', 'Col', [], { medals: minisOf(TWELVE.slice(0, n)) }));
      const minis = scene.layers.filter(l => /^mini-/.test(l.role) || (l.role === 'device' && /:device:/.test(l.key)));
      assert.ok(minis.length >= n, `${sex} ${n}: minis drawn`);
      for(const l of minis) assert.ok(!C.rectHitsPolygon(boxOf(l), lapel), `${sex} ${n}: ${l.key} (${l.role}) clear of the lapel`);
      assert.ok(!scene.notes.some(x => /no room to move them clear/.test(x)), `${sex} ${n}: room to clear the lapel`);
      const bodies = scene.layers.filter(l => l.role === 'mini-medal');
      const lowest = Math.max(...bodies.map(l => l.y + l.h));
      assert.ok(Math.abs(lowest - (crestTop - 0.5)) < 0.01, `${sex} ${n}: lowest medals end 1/2 in above the crest (${lowest.toFixed(3)} vs ${(crestTop - 0.5).toFixed(3)})`);
    }
  }
});

test('semi-formal blazer: the lapel group is drawn under every miniature layer and under the chaplain badge', async () => {
  for(const sex of ['male', 'female']){
    const scene = await compose(build('semi_formal', sex, 'senior', 'Col', ['christian_chaplin'], { medals: minisOf(TWELVE) }));
    const fg = scene.layers.find(l => l.role === 'garment-foreground' && l.onlyGroups && l.onlyGroups.includes('lapel-foreground'));
    assert.ok(fg);
    for(const l of scene.layers.filter(l => /^mini-/.test(l.role) || l.role === 'device' || l.role === 'badge')) assert.ok(l.z > fg.z, `${sex}: ${l.key} over the lapel group`);
  }
});

// ---- 4. Corporate service dress (women): the nametag lies on the coat front, not on the lapel --------------------

function lapelRightFromSheet(sex){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', `garment-corporate-service-dress-blazer-${sex}.svg`), 'utf8');
  const tr = /<g id="[^"]*__art" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(100\)"/.exec(svg);
  const d = /id="[^"]*lapel-right" d="([^"]*)"/.exec(svg)[1];
  return [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: +m[1] + tr[1] / 100, y: +m[2] + tr[2] / 100 }));
}

test('corporate service dress: the nametag clears the wearer\'s right lapel by 0.1 in, top edge at the slot, men and women (4.2.3.1.1.2, 4.2.4.1.1.2)', async () => {
  for(const sex of ['male', 'female']) for(const rank of ['SMSgt', 'Capt', 'Col']){
    const lapel = lapelRightFromSheet(sex);
    const spec = await store.load(`garment-corporate-service-dress-blazer-${sex}`);
    const slot = core.landmarkBounds(spec, 'nameplate_slot');
    const scene = await compose(build('aviator_blazer', sex, 'senior', rank, ['CAPPilot1_FA9D33EA587D8']));
    const plate = scene.layers.find(l => l.key === 'nametag' && !l.figure);
    assert.ok(plate, `${sex} ${rank}: nametag drawn`);
    const r = { x: plate.x - 0.1, y: plate.y, w: plate.w + 0.2, h: plate.h };
    assert.ok(!C.rectHitsPolygon(r, lapel), `${sex} ${rank}: the plate (x ${plate.x.toFixed(3)}-${(plate.x + plate.w).toFixed(3)}) is 0.1 in clear of the lapel`);
    assert.ok(Math.abs(plate.y - slot.y) < 0.01, `${sex} ${rank}: the top edge stays at the slot top (${plate.y} vs ${slot.y})`);
  }
});

// ---- 5. ABU and CFU: general officers' stars begin 1 in from the bottom of the collar ------------------------------

function inPoly(p, poly){
  let c = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if(((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c;
  }
  return c;
}
const corners = l => {
  const c = { x: l.x + l.w / 2, y: l.y + l.h / 2 }, t = rad(l.rotate);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: c.x + a * l.w / 2 * Math.cos(t) - b * l.h / 2 * Math.sin(t), y: c.y + a * l.w / 2 * Math.sin(t) + b * l.h / 2 * Math.cos(t) }));
};

test('ABU and CFU: a general officer\'s stars begin 1 in up the perpendicular from the collar\'s bottom edge, the 1 in measure is drawn (5.1.1.1.1.1, 5.2.1.1.1.1)', async () => {
  for(const uniform of ['abu', 'corporate_field']) for(const sex of ['male', 'female']) for(const rank of ['Brig Gen', 'Maj Gen']){
    const scene = await compose(build(uniform, sex, 'senior', rank));
    const spec = await store.load(scene.layers.find(l => l.key === 'base:jacket' || /^base:/.test(l.key || '')).id);
    for(const side of ['right', 'left']){
      const edge = (spec.raw || spec).collar_slots[side].bottom_edge;
      const a = { x: edge.p1[0] / 100, y: edge.p1[1] / 100 }, d = { x: (edge.p2[0] - edge.p1[0]) / 100, y: (edge.p2[1] - edge.p1[1]) / 100 };
      const len = Math.hypot(d.x, d.y);
      const l = scene.layers.find(x => x.key === 'grade:' + side);
      assert.ok(l, `${uniform} ${sex} ${rank} ${side}: grade drawn`);
      // The cloth's bottom edge midpoint is the corner pair at the piece's bottom: distance from the edge line.
      const cs = corners(l), bottomMid = { x: (cs[2].x + cs[3].x) / 2, y: (cs[2].y + cs[3].y) / 2 };
      const dist = Math.abs((bottomMid.x - a.x) * d.y - (bottomMid.y - a.y) * d.x) / len;
      assert.ok(Math.abs(dist - (1 - 0.125)) < 0.02, `${uniform} ${sex} ${rank} ${side}: the stars' silver begins 1 in up (cloth ${dist.toFixed(3)} in from the edge)`);
      assert.ok(Math.abs(l.rotate) > 13 && Math.abs(l.rotate) < 13.5, `${uniform} ${sex} ${rank}: the 13.2 deg turn is kept`);
    }
    assert.ok(scene.layers.some(x => x.type === 'measure' && x.label === '1 in'), `${uniform} ${sex} ${rank}: a 1 in measure`);
  }
});

test('ABU and CFU: no officer grade cloth corner lies outside the collar leaf, except the major general\'s top outer corner the drawn leaf is too small for (FOLLOWUP art)', async () => {
  for(const uniform of ['abu', 'corporate_field']) for(const sex of ['male', 'female']) for(const rank of ['Capt', 'Maj', 'Lt Col', 'Col', 'Brig Gen', 'Maj Gen']){
    const scene = await compose(build(uniform, sex, 'senior', rank));
    const spec = await store.load(scene.layers.find(l => /^base:/.test(l.key || '')).id);
    for(const side of ['right', 'left']){
      const poly = core.landmark(spec, `collar_${side}`).points;
      const l = scene.layers.find(x => x.key === 'grade:' + side);
      const out = corners(l).filter(p => !inPoly(p, poly));
      if(rank === 'Maj Gen') assert.ok(out.length <= 1, `${uniform} ${sex} ${rank} ${side}: only the top outer corner (${out.length})`);
      else assert.equal(out.length, 0, `${uniform} ${sex} ${rank} ${side}: every corner on the leaf`);
    }
  }
});
