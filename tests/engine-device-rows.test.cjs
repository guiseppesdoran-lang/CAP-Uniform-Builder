'use strict';
// Ribbon device rows (CAPR 39-3 6b and the per-award paragraphs; Doran: "it's having a hard time with devices"). For
// every CAP ribbon and every award level the picker offers, the devices the engine draws lie inside the ribbon box with
// at least 0.02 in to each end, on the ribbon's middle line, evenly spaced in a free run, without touching one another, in
// the order the regulation gives; and when devices could not fit at full size the gap closes first and then they all shrink
// by one factor, logged in the scene notes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const awards = require('../js/engine/awards.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const RA = require('../data/ribbon-awards.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const storeFor = m => core.createSpecStore(m, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const EPS = 1e-6;

// Every award level the ribbon picker offers for each CAP ribbon that carries devices.
function pickerOptions(){
  const { context } = loadPageScripts();
  const json = vm.runInContext(`(function(ids){
    const out = {};
    for(const id of ids) out[id] = getRibbonAwardOptions(id).filter(o => o && o.value).map(o => ({ value: o.value, label: o.label }));
    return JSON.stringify(out);
  })`, context)(Object.keys(RA.FAMILIES));
  return JSON.parse(json);
}

function ribbonsFor(entries, membership){
  return entries.flatMap(([id, o], n) => RA.resolve(id, { awardValue: o.value, awardLabel: o.label, membership }).map((r, i) => ({
    key: `ribbon:${id}:${n}${i ? '#' + i : ''}`, id, title: `${id} ${o.label}${i ? ' (additional ribbon)' : ''}`,
    asset: 'ribbon-' + id.replace(/_/g, '-'), devices: r.devices, centered: r.centered
  })));
}

async function composeRack(ribbons, m){
  const b = { uniform: 'blues_a', gender: 'male', membership: 'senior', grade: G.gradeInfo('senior', 'Capt', {}), opt: { headgear: 'auto' },
    name: { first: 'Pat', last: 'Doe', show: true }, ribbons, medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null };
  return P.composeUniform(b, storeFor(m || manifest));
}

// The viewer's-left-first order of a free run (awards.sortRun): level devices, stars, propellers, then silver before bronze clasps.
const RANK = id => awards.sortRun([id, 'device-clasp-bronze']).indexOf(id);

function checkRow(ribbon, devs, expected, problems){
  const where = `${ribbon.key} ${expected.label}`;
  const x0 = ribbon.x + awards.DEVICE_END_MARGIN - EPS, x1 = ribbon.x + ribbon.w - awards.DEVICE_END_MARGIN + EPS;
  const midY = ribbon.y + ribbon.h / 2;
  for(const d of devs){
    if(d.x < x0 || d.x + d.w > x1) problems.push(`${where}: ${d.id} reaches ${(d.x - ribbon.x).toFixed(3)}..${(d.x + d.w - ribbon.x).toFixed(3)} of a ${ribbon.w} in ribbon`);
    if(d.y < ribbon.y - EPS || d.y + d.h > ribbon.y + ribbon.h + EPS) problems.push(`${where}: ${d.id} is not inside the ribbon's height`);
    if(Math.abs(d.y + d.h / 2 - midY) > EPS) problems.push(`${where}: ${d.id} is not on the ribbon's middle line`);
  }
  const byX = [...devs].sort((a, b) => a.x - b.x);
  for(let i = 1; i < byX.length; i++) if(byX[i].x < byX[i - 1].x + byX[i - 1].w - EPS) problems.push(`${where}: ${byX[i - 1].id} and ${byX[i].id} overlap`);
  if(devs.length > awards.MAX_DEVICES) problems.push(`${where}: ${devs.length} devices on one ribbon (6b: at most four)`);
  if(expected.centered){
    // The first device is centred; the first clasp is halfway between it and the wearer's left edge (viewer's right), the second opposite.
    const c = devs[0];
    if(Math.abs(c.x + c.w / 2 - (ribbon.x + ribbon.w / 2)) > EPS) problems.push(`${where}: the ${c.id} is not centred`);
    if(devs[1]){
      const want = (ribbon.w / 2 + c.w / 2 + ribbon.w) / 2;
      if(Math.abs(devs[1].x + devs[1].w / 2 - ribbon.x - want) > EPS) problems.push(`${where}: the first clasp is not halfway between the device and the wearer's left edge`);
    }
    if(devs[2]){
      const want = ((ribbon.w / 2 - c.w / 2) / 2);
      if(Math.abs(devs[2].x + devs[2].w / 2 - ribbon.x - want) > EPS) problems.push(`${where}: the second clasp is not opposite the first`);
    }
  }else{
    if(byX.length > 2){
      const gaps = byX.slice(1).map((d, i) => d.x - (byX[i].x + byX[i].w));
      if(Math.max(...gaps) - Math.min(...gaps) > 1e-5) problems.push(`${where}: gaps are not even (${gaps.map(g => g.toFixed(3)).join(', ')})`);
    }
    // centred as a group
    const left = byX[0].x - ribbon.x, right = ribbon.x + ribbon.w - (byX[byX.length - 1].x + byX[byX.length - 1].w);
    if(Math.abs(left - right) > 1e-5) problems.push(`${where}: the run is not centred (${left.toFixed(3)} left, ${right.toFixed(3)} right)`);
    // precedence of a free run: viewer's left first (wearer's right first): level devices, silver before bronze
    const ranks = byX.map(d => RANK(d.id));
    for(let i = 1; i < ranks.length; i++) if(ranks[i] < ranks[i - 1]) problems.push(`${where}: ${byX[i].id} stands to the viewer's right of ${byX[i - 1].id}, against the run order`);
  }
}

test('every CAP ribbon at every picker level: devices inside the ribbon, 0.02 in from the ends, evenly spaced, centred, never overlapping', async () => {
  const options = pickerOptions();
  const entries = [];
  for(const id of Object.keys(RA.FAMILIES)) for(const o of options[id] || []) entries.push([id, o]);
  assert.ok(entries.length > 1500, `the picker offers ${entries.length} award levels`);
  const problems = [];
  let rows = 0;
  for(const membership of ['cadet', 'senior']){
    // Racks of at most 24 ribbons per scene (a high award count is several ribbons: 6b, a second ribbon counts one award).
    const chunks = [];
    let cur = [], count = 0;
    for(const e of entries){
      const n = RA.resolve(e[0], { awardValue: e[1].value, awardLabel: e[1].label, membership }).length;
      if(cur.length && count + n > 24){ chunks.push(cur); cur = []; count = 0; }
      cur.push(e); count += n;
    }
    if(cur.length) chunks.push(cur);
    for(const chunk of chunks){
      const ribbons = ribbonsFor(chunk, membership);
      const scene = await composeRack(ribbons);
      assert.deepEqual(scene.notes.filter(n => /do not fit|No ribbon artwork/.test(n)), [], 'no ribbon is missing and no device row needed shrinking');
      for(const r of ribbons){
        const layer = scene.layers.find(l => l.role === 'ribbon' && l.key === r.key);
        assert.ok(layer, `${r.key} is drawn`);
        const devs = scene.layers.filter(l => l.role === 'device' && l.key.startsWith(r.key + ':device:'));
        assert.equal(devs.length, r.devices.length, `${r.key}: every device the award carries is drawn`);
        if(!devs.length) continue;
        rows++;
        checkRow(layer, devs, { centered: r.centered, label: `[${membership}]` }, problems);
      }
    }
  }
  assert.ok(rows > 2000, `${rows} device rows checked`);
  assert.deepEqual(problems.slice(0, 15), [], `${problems.length} device rows break a rule`);
});

test('the order of mixed devices follows CAPR 39-3: stars to the wearer\'s right of clasps (9f), silver clasps right of bronze (6b), the V first (21g)', async () => {
  const ribbons = ribbonsFor([
    ['commander_commendation_award', { value: 'mcchord_46203', label: '3rd Award (Region+Natl)' }],
    ['cap_achievment_award', { value: 'mcchord_45060', label: '6th Award' }],
    ['disaster_relief_ribbon', { value: 'silver_v_bronze_clasp_2', label: '3rd w/V Device' }]
  ], 'senior');
  const scene = await composeRack(ribbons);
  const row = key => scene.layers.filter(l => l.role === 'device' && l.key.startsWith(key + ':device:')).sort((a, b) => a.x - b.x).map(l => l.id.replace('device-', ''));
  const byId = id => ribbons.find(r => r.id === id).key;
  assert.deepEqual(row(byId('commander_commendation_award')), ['star-silver', 'star-bronze', 'clasp-bronze', 'clasp-bronze'], 'viewer\'s left first: the stars, then the clasps');
  assert.deepEqual(row(byId('cap_achievment_award')), ['clasp-silver']);
  const dr = ribbons.find(r => r.id === 'disaster_relief_ribbon');
  if(dr.devices.includes('device-v')) assert.equal(row(dr.key)[0], 'v', 'the V stands first, clasps follow');
});

test('the centred propeller and the Lifesaving star keep their clasps halfway to each edge (21d, 9h)', async () => {
  const ribbons = ribbonsFor([
    ['search_find_ribbon', { value: 'mcchord_24600', label: '3rd w/Prop' }],
    ['lifesaving_award', { value: 'mcchord_28003', label: '3rd with Star' }]
  ], 'senior');
  const scene = await composeRack(ribbons);
  for(const r of ribbons){
    const ribbon = scene.layers.find(l => l.role === 'ribbon' && l.key === r.key);
    const devs = scene.layers.filter(l => l.role === 'device' && l.key.startsWith(r.key + ':device:'));
    assert.equal(devs.length, 3);
    assert.ok(r.centered);
    const problems = [];
    checkRow(ribbon, devs, { centered: true, label: r.id }, problems);
    assert.deepEqual(problems, []);
    const mid = ribbon.x + ribbon.w / 2;
    const centre = devs[0];
    assert.ok(Math.abs(centre.x + centre.w / 2 - mid) < EPS);
    assert.ok(devs[1].x > centre.x, 'the first clasp is on the viewer\'s right, the wearer\'s left');
    assert.ok(devs[2].x < centre.x, 'the second clasp is on the viewer\'s left');
  }
});

test('devices that cannot fit: the gap closes first, then every device shrinks by one factor (awards.layoutDevices)', () => {
  const sizes = { a: { w: 0.4, h: 0.2 }, b: { w: 0.4, h: 0.2 }, c: { w: 0.4, h: 0.2 }, d: { w: 0.4, h: 0.2 }, e: { w: 0.4, h: 0.2 }, w: { w: 0.9, h: 0.2 } };
  const margin = awards.DEVICE_END_MARGIN;
  const extent = (list, k) => ({ x0: Math.min(...list.map(d => d.x - sizes[d.id].w * k / 2)), x1: Math.max(...list.map(d => d.x + sizes[d.id].w * k / 2)) });
  // Three 0.4 in devices: 1.2 in plus the wanted gaps fit as they are.
  const three = awards.layoutDevices(['a', 'b', 'c'], sizes, {});
  assert.equal(three.scale, 1);
  // Two wide devices leave less than the wanted 0.04 in gap: the gap closes, the devices keep their size.
  const wide = { x: { w: 0.66, h: 0.2 }, y: { w: 0.66, h: 0.2 } };
  const closing = awards.layoutDevices(['x', 'y'], wide, {});
  assert.equal(closing.scale, 1);
  const gap = (closing[1].x - 0.33) - (closing[0].x + 0.33);
  assert.ok(gap >= 0 && gap < 0.04, `gap closed to ${gap.toFixed(4)}`);
  assert.ok(closing[0].x - 0.33 >= margin - EPS && closing[1].x + 0.33 <= awards.RIBBON_W - margin + EPS);
  // Four 0.4 in devices do not fit even touching: one factor for all, margins kept, no overlap, the gap is gone.
  const four = awards.layoutDevices(['a', 'b', 'c', 'd'], sizes, {});
  const k = four.scale;
  assert.ok(k < 1 && k > 0.8, `scale ${k}`);
  const e = extent(four, k);
  assert.ok(Math.abs(e.x0 - margin) < 1e-9 && Math.abs(awards.RIBBON_W - e.x1 - margin) < 1e-9, 'the group lies exactly 0.02 in inside both ends');
  for(let i = 1; i < four.length; i++) assert.ok(Math.abs(four[i].x - four[i - 1].x - 0.4 * k) < 1e-9, 'touching, evenly');
  // A centred device with wide clasps: the halfway clasps would pass the ends, so all three shrink together.
  const centred = awards.layoutDevices(['w', 'a', 'b'], sizes, { centered: true });
  assert.ok(centred.scale < 1);
  const ce = extent(centred, centred.scale);
  assert.ok(ce.x0 >= margin - 1e-9 && ce.x1 <= awards.RIBBON_W - margin + 1e-9);
  const sorted = [...centred].sort((p, q) => p.x - q.x);
  for(let i = 1; i < sorted.length; i++) assert.ok(sorted[i].x - sizes[sorted[i].id].w * centred.scale / 2 >= sorted[i - 1].x + sizes[sorted[i - 1].id].w * centred.scale / 2 - 1e-9, 'no overlap');
});

test('a device row that does not fit is drawn at the one scale the engine logs in the scene notes', async () => {
  const wide = JSON.parse(JSON.stringify(manifest));
  for(const a of wide.assets) if(a.id === 'device-clasp-bronze'){ a.w_in = 0.5; a.h_in = 0.4; }
  const ribbons = ribbonsFor([['cap_achievment_award', { value: 'mcchord_45050', label: '5th Award' }]], 'senior');
  assert.equal(ribbons[0].devices.length, 4);
  const scene = await composeRack(ribbons, wide);
  const note = scene.notes.find(n => /do not fit the ribbon at full size/.test(n));
  assert.ok(note, 'the scale is logged');
  const ribbon = scene.layers.find(l => l.role === 'ribbon');
  const devs = scene.layers.filter(l => l.role === 'device');
  assert.equal(devs.length, 4);
  const k = devs[0].w / 0.5;
  assert.ok(k < 1);
  assert.ok(note.includes(k.toFixed(2)), `the note names the scale ${k.toFixed(2)}: ${note}`);
  const problems = [];
  checkRow(ribbon, devs, { centered: false, label: 'wide clasps' }, problems);
  assert.deepEqual(problems, []);
  assert.ok(devs.every(d => Math.abs(d.h / d.w - 0.4 / 0.5) < 1e-6), 'each device keeps its aspect');
});
