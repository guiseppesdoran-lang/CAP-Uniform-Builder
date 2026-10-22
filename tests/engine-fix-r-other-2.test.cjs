'use strict';
// FIX-R-OTHER-r2 review findings (engine side). One block per finding.

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

// ---- 1. Class A and semi-formal: a badge on the lapel is drawn over it ---------------------------------------

test('Class A and cadet semi-formal: no badge lies under a higher-z lapel foreground layer (4.1.5.2.2.4.1, 4.1.9.4.4.1)', async () => {
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
      if(polys.some(p => share(box(l), p) > 0)){
        touched++;
        assert.ok(l.z > fg.z, `${uniform} ${sex} ${rank}: ${l.key} reaches the lapel, so it is above the lapel foreground (z ${l.z} vs ${fg.z})`);
        for(const ins of scene.layers.filter(x => /lapel-(us|cap)/.test(x.id || ''))) assert.ok(ins.z > l.z, `${uniform} ${sex} ${rank}: the lapel insignia stays above ${l.key}`);
      }
    }
  }
  assert.ok(touched >= 3, 'the cases include badges that reach the lapel (' + touched + ')');
});
