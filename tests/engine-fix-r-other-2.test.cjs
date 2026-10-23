'use strict';
// FIX-R-OTHER-r2 review findings (engine side). One block per finding.

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
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function build(uniform, gender, membership, rank, badges, extra){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: (badges || []).map(id => ({ id })), command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const RA = require('../data/ribbon-awards.js');
function ribbonOf(id){
  return RA.resolve(id, {}).map(r => ({ key: 'ribbon:' + id, title: id, asset: 'ribbon-' + id.replace(/_/g, '-'), devices: r.devices, centered: r.centered }));
}
const RACK = ['meritorious_service_award', 'commander_commendation_award', 'cap_achievment_award', 'search_find_ribbon', 'cap_leadership_ribbon', 'cap_membership_ribbon', 'red_service_ribbon'].flatMap(ribbonOf);
const compose = b => P.composeUniform(b, store);
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const PILOT = 'CAPPilot1_FA9D33EA587D8', AIRCREW = 'AirCrew1_DB3F0FCC3650F', GT = 'ground_team_basic_badge';

function inside(p, poly){
  let c = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if(((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c;
  }
  return c;
}
// Share of the box (0..1) that lies inside the polygon, sampled finely.
function share(r, poly){
  let n = 0, hit = 0;
  for(let i = 0; i < 40; i++) for(let j = 0; j < 40; j++){ n++; if(inside({ x: r.x + (i + 0.5) * r.w / 40, y: r.y + (j + 0.5) * r.h / 40 }, poly)) hit++; }
  return hit / n;
}
const box = l => ({ x: l.x, y: l.y, w: l.w, h: l.h });

// ---- 1. Class A and semi-formal: the collar lies over every badge ------------------------------------------
// (Ethan 2026-10-22, 'the collar should be over the badges'; this replaces the earlier rule that lifted a badge that reached the lapel
// above it, D8)

test('Class A and cadet semi-formal: every badge is below the lapel foreground, none is lifted over a lapel (4.1.5.2.2.4.1, 4.1.9.4.4.1, 11.1.8)', async () => {
  const cases = [
    ['blues_a', 'female', 'cadet', 'C/Maj', [AIRCREW, GT]], ['blues_a', 'male', 'senior', 'Capt', [PILOT, GT]],
    ['blues_a', 'female', 'senior', 'Col', [PILOT, GT]], ['blues_a', 'male', 'cadet', 'C/Maj', [AIRCREW, GT]],
    ['semi_formal_usaf', 'female', 'cadet', 'C/Maj', [AIRCREW, GT]], ['semi_formal_usaf', 'male', 'cadet', 'C/Maj', [AIRCREW, GT]]
  ];
  let touched = 0;
  for(const [uniform, sex, membership, rank, badges] of cases){
    const scene = await compose(build(uniform, sex, membership, rank, badges, { ribbons: RACK }));
    const fg = scene.layers.find(l => /lapel-foreground$/.test(l.key || '') || /lapel-foreground/.test(l.id || ''));
    assert.ok(fg, `${uniform} ${sex} ${rank}: the lapel foreground is drawn`);
    const base = scene.layers.find(l => l.key === 'base:jacket');
    const spec = await store.load(base.id);
    const polys = ['lapel_left', 'lapel_right'].map(n => spec.landmarks[n] && spec.landmarks[n].points).filter(Boolean);
    const bs = scene.layers.filter(l => l.role === 'badge');
    assert.equal(bs.length, 2, `${uniform} ${sex} ${rank}: two left badges`);
    for(const l of bs){
      assert.ok(l.z < fg.z, `${uniform} ${sex} ${rank}: ${l.key} is below the lapel foreground (z ${l.z} vs ${fg.z})`);
      assert.equal(l.z, C.Z.badge, `${uniform} ${sex} ${rank}: ${l.key} is not lifted`);
      if(polys.some(p => share(box(l), p) > 0)){
        touched++;
        for(const ins of scene.layers.filter(x => /lapel-(us|cap)/.test(x.id || ''))) assert.ok(ins.z > l.z, `${uniform} ${sex} ${rank}: the lapel insignia stays above ${l.key}`);
      }
    }
  }
  assert.ok(touched >= 3, 'the cases include badges that reach the lapel (' + touched + ')');
});

test('Class A: the lapel foreground group covers the lapel where the wings cross it (its face polygon is the coat sheet\'s lapel polygon), and the wings stay below it', async () => {
  const twelve = [];
  for(let i = 0; i < 12; i++) twelve.push(RACK[i % RACK.length]);
  const scene = await compose(build('blues_a', 'female', 'senior', 'Capt', [PILOT], { ribbons: twelve }));
  const fg = scene.layers.find(l => /lapel-foreground$/.test(l.key || ''));
  const fgSpec = await store.load(fg.id);
  const base = await store.load(scene.layers.find(l => l.key === 'base:jacket').id);
  const wings = scene.layers.find(l => l.role === 'badge');
  const face = fgSpec.landmarks.lapel_face_left.points;
  assert.ok(share(box(wings), face) > 0.05, 'the wings cross the lapel face');
  assert.ok(wings.z < fg.z, 'the wings are below the lapel foreground');
  // the foreground's face is the sheet's lapel: nothing of the garment's lapel polygon is left uncovered where the wings are
  const lapel = base.landmarks.lapel_left.points;
  assert.ok(Math.abs(share(box(wings), lapel) - share(box(wings), face)) < 0.02, 'the foreground face covers the garment lapel polygon where the wings are');
});

// ---- 2. Class B and aviator shirts: the collar lies over a badge that reaches it -------------------------------

const THREE = [PILOT, GT, 'emergency_services_badge'];
test('Class B: the collar leaves are drawn again above the badges (the sheet\'s collar-foreground group); no badge is cut (4.1.11.1.1.2.3.1, 4.1.12.2.5.1; Ethan 2026-10-22: never slice a badge, D8)', async () => {
  for(const sex of ['male', 'female']){
    for(const sleeve of ['short', 'long']){
      for(const [membership, rank] of [['senior', 'Capt'], ['senior', 'Col']]){
        const scene = await compose(build('blues_b', sex, membership, rank, THREE, { ribbons: RACK, opt: { headgear: 'auto', sleeve } }));
        const fg = scene.layers.find(l => l.role === 'garment-foreground' && l.onlyGroups && l.onlyGroups.includes('collar-foreground'));
        assert.ok(fg, `${sex} ${sleeve} ${rank}: the collar foreground is drawn`);
        for(const l of scene.layers.filter(x => x.role === 'badge')){
          assert.ok(!l.clipOut, `${sex} ${sleeve} ${rank}: ${l.key} is whole`);
          assert.ok(l.z < fg.z, `${sex} ${sleeve} ${rank}: ${l.key} is below the collar foreground (z ${l.z} vs ${fg.z})`);
        }
      }
    }
  }
});

test('a badge clear of the collar is not clipped', async () => {
  const scene = await compose(build('blues_b', 'male', 'senior', 'Capt', [PILOT], { ribbons: [] }));
  for(const l of scene.layers.filter(x => x.role === 'badge')) assert.ok(!l.clipOut, `${l.key} is clear of the collar`);
});

// ---- 3. The shoulder view from above does not hide the cap device (R6, R7) -----------------------------------

function corners(l){
  const o = l.origin || { x: l.x, y: l.y };
  return [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => core.rotatePoint({ x, y }, o, l.rotate || 0));
}
function overlap(a, b){
  for(const poly of [a, b]) for(let i = 0; i < poly.length; i++){
    const p = poly[i], q = poly[(i + 1) % poly.length], nx = p.y - q.y, ny = q.x - p.x;
    const pr = pts => { const v = pts.map(r => r.x * nx + r.y * ny); return [Math.min(...v), Math.max(...v)]; };
    const A = pr(a), B = pr(b);
    if(A[1] <= B[0] || B[1] <= A[0]) return false;
  }
  return true;
}
test('Class B officers and cadet officers: no epaulet view from above overlaps the cap device box, and the view stays on its shoulder (R6, R7, 6.2.2.2.1)', async () => {
  for(const sex of ['male', 'female']){
    for(const [membership, rank] of [['senior', 'Capt'], ['senior', 'Col'], ['senior', 'Maj Gen'], ['cadet', 'C/Maj'], ['cadet', 'C/Col'], ['cadet', 'C/2d Lt']]){
      const scene = await compose(build('blues_b', sex, membership, rank, []));
      const dev = scene.layers.find(l => l.role === 'hat-device');
      assert.ok(dev, `${sex} ${rank}: the cap device is drawn`);
      for(const v of scene.layers.filter(l => l.role === 'epaulet-top')){
        // The cadet colonel's three diamonds are a 2.25 in box the view cannot clear on the shoulder; the ink clears it.
        if(rank !== 'C/Col') assert.ok(!overlap(corners(v), corners(dev)), `${sex} ${rank}: ${v.key} clears the cap device`);
        // on the shoulder: still within 0.7 in of where it would sit with no cap (same view on the other side, mirrored)
        const other = scene.layers.find(l => l.role === 'epaulet-top' && l !== v);
        const mirrored = scene.layers[0] && (v.x + v.w / 2 + other.x + other.w / 2) / 2;
        assert.ok(Math.abs(Math.abs(v.origin.x - mirrored) - Math.abs(other.origin.x - mirrored)) < 0.7, `${sex} ${rank}: ${v.key} stays within 0.7 in of the mirror of the other view`);
      }
    }
  }
});

test('the slid view carries its grade with it (the top-view grade keeps its place on the sleeve)', async () => {
  const scene = await compose(build('blues_b', 'male', 'senior', 'Col', []));
  const v = scene.layers.find(l => l.key === 'epaulet-top:right'), gr = scene.layers.find(l => l.key === 'grade:top-right');
  const v2 = scene.layers.find(l => l.key === 'epaulet-top:left'), g2 = scene.layers.find(l => l.key === 'grade:top-left');
  assert.ok(v && v2, 'both views');
  if(gr && g2){
    const d1 = Math.hypot(gr.origin.x - v.origin.x, gr.origin.y - v.origin.y), d2 = Math.hypot(g2.origin.x - v2.origin.x, g2.origin.y - v2.origin.y);
    assert.ok(Math.abs(d1 - d2) < 0.02, `grade-to-view distance equal on both sides (${d1.toFixed(3)} vs ${d2.toFixed(3)})`);
  }
});
