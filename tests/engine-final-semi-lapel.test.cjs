'use strict';
// FINAL fix 1: the corporate semi-formal's miniature medal rack and chaplain badge lie beside the blazer's left lapel,
// not on it (CAPR 39-1 4.2.2.4 with ICL 25-02, 4.2.1.5, 4.2.2.5, 11.2.8).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const C = require('../js/engine/compose.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const NAME = { first: 'Pat', last: 'Doran', show: true };
const TWELVE = [['distinguished_service_award'], ['exceptional_service_award'], ['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['search_find_ribbon', 'aircrew'], ['air_search_and_rescue_ribbon'], ['cap_gill_robb_wilson_ribbon'], ['cap_command_service_ribbon'], ['cap_leadership_ribbon'], ['cap_membership_ribbon'], ['red_service_ribbon']];
const build = (gender, rank, n, o) => HARNESS.makeBuild(Object.assign({ uniform: 'semi_formal', gender, membership: 'senior', rank, name: NAME, ribbonSel: TWELVE.slice(0, n), medalSel: true, badgeIds: ['christian_chaplin'], opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } }, o || {}));

// The wearer's left lapel read from the sheet itself: the `lapel-left` path of the lapel-foreground group, in the
// art frame's units (translate + scale), as garment inches.
function lapelFromSheet(sex){
  const svg = fs.readFileSync(path.join(root, 'images', 'garments', `garment-corporate-service-dress-blazer-${sex}.svg`), 'utf8');
  const frame = /__art"[^>]*transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)"/.exec(svg);
  assert.ok(frame, `${sex}: art frame`);
  const tx = Number(frame[1]), ty = Number(frame[2]), k = Number(frame[3]);
  const d = new RegExp(`${sex}__lapel-left" d="([^"]+)"`).exec(svg);
  assert.ok(d, `${sex}: lapel-left path`);
  const pts = [...d[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: (tx + Number(m[1]) * k) / 100, y: (ty + Number(m[2]) * k) / 100 }));
  assert.ok(pts.length > 10);
  return pts;
}

// Every layer that is part of the rack or the badge: drape, medal body, device, mini raster, badge.
const worn = l => ['mini-drape', 'mini-medal', 'mini', 'device', 'badge'].includes(l.role);

// ICL 25-02 rewrote 4.2.2.4: the miniatures are "centered above the pocket" with the bottom row 1/2 in above the crest. The
// rack is therefore centred on the pocket (the crest's x, the slot's centre) and never slid toward the arm to clear the lapel
// (Doran, on the build that did: "the medals need to move left"); where the lapel edge crosses the rack's inner corner the
// lapel lies over the medals (11.1.8: the collar is worn over awards), so the lapel foreground is drawn above every medal and
// badge layer; the chaplain badge keeps its place 1/2 in above the top row (4.2.1.5, 4.2.2.5). D8: this replaces the test that
// required every box to be clear of the lapel.
for(const sex of ['male', 'female']){
  test(`semi_formal ${sex}: with 1 to 12 miniatures and the chaplain badge the rack is centred on the pocket, the lapel lies over any medal or badge it meets, the rack stays inside the arm seam, for every grade (4.2.2.4 as rewritten by ICL 25-02, 4.2.1.5, 11.1.8, 11.2.8)`, async () => {
    const lapel = lapelFromSheet(sex);
    const spec = await store.load(`garment-corporate-service-dress-blazer-${sex}`);
    const pocketX = core.anchor(spec, 'crest_center').x;
    let checked = 0, lapelOverMedals = 0;
    for(const rank of ['SMSgt', 'Capt', 'Col', 'Maj Gen']){
      for(const n of [1, 2, 4, 5, 7, 9, 12]){
        const scene = await compose(build(sex, rank, n));
        const layers = scene.layers.filter(worn);
        const badge = layers.find(l => l.role === 'badge' && /chaplin|chaplain/.test(l.key));
        assert.ok(badge, `${sex} ${rank} ${n}: the chaplain badge is drawn`);
        const drapes = layers.filter(l => l.role === 'mini-drape');
        assert.ok(drapes.length >= 1, `${sex} ${rank} ${n}: miniatures drawn`);
        // Centred above the pocket: the rack's centre is the pocket centre line, within 0.02 in .
        const x0 = Math.min(...drapes.map(l => l.x)), x1 = Math.max(...drapes.map(l => l.x + l.w));
        assert.ok(Math.abs((x0 + x1) / 2 - pocketX) < 0.02, `${sex} ${rank} ${n}: the rack's centre ${((x0 + x1) / 2).toFixed(3)} is the pocket centre ${pocketX.toFixed(3)}`);
        const topRow = drapes.filter(l => Math.abs(l.y - Math.min(...drapes.map(d => d.y))) < 0.01);
        const full = drapes.filter(l => Math.abs(l.y - Math.max(...drapes.map(d => d.y))) < 0.01);
        const fx0 = Math.min(...full.map(l => l.x)), fx1 = Math.max(...full.map(l => l.x + l.w));
        assert.ok(Math.abs((fx0 + fx1) / 2 - pocketX) < 0.02, `${sex} ${rank} ${n}: the lowest row's centre ${((fx0 + fx1) / 2).toFixed(3)} is within 0.02 in of the pocket centre ${pocketX.toFixed(3)}`);
        // The badge keeps its place: 1/2 in above the top row, on the pocket centre line.
        assert.ok(Math.abs((badge.x + badge.w / 2) - pocketX) < 0.02, `${sex} ${rank} ${n}: the badge is on the pocket centre line`);
        assert.ok(Math.abs(Math.min(...topRow.map(l => l.y)) - (badge.y + badge.h) - 0.5) < 0.02, `${sex} ${rank} ${n}: the badge is 1/2 in above the top row`);
        // The lapel lies over whatever it meets: a clipped lapel foreground above every rack and badge layer.
        const meets = layers.filter(l => C.rectHitsPolygon(core.layerBounds(l), lapel));
        const fg = scene.layers.filter(l => l.key === 'layer:foreground' && l.clip);
        if(meets.length){
          lapelOverMedals++;
          assert.equal(fg.length, 1, `${sex} ${rank} ${n}: one clipped lapel foreground over the rack`);
          assert.ok(fg[0].z > Math.max(...layers.map(l => l.z)), `${sex} ${rank} ${n}: the lapel foreground (z ${fg[0].z}) is above every medal and badge layer`);
        }
        // Rows and spacing unchanged: 11/16 in between medals of a row.
        const rows = new Map();
        drapes.forEach(l => rows.set(l.y.toFixed(3), [...(rows.get(l.y.toFixed(3)) || []), l.x]));
        for(const xs of rows.values()){ xs.sort((p, q) => p - q); for(let i = 1; i < xs.length; i++) assert.ok(Math.abs(xs[i] - xs[i - 1] - 11 / 16) < 1e-6, `${sex} ${rank} ${n}: 11/16 in apart`); }
        // The arm seam: the rack is narrowed (fewer columns), never slid, and says so only if it still strays past the seam.
        assert.ok(!scene.notes.some(t => /past the seam or the shoulder line/.test(t)), `${sex} ${rank} ${n}: the rack lies inside the arm seam and the shoulder line`);
        checked += layers.length;
      }
    }
    assert.ok(checked > 200);
    assert.ok(lapelOverMedals > 0, `${sex}: the lapel meets the rack for some build, so the foreground rule is exercised`);
  });
}

test('semi_formal men: the rack keeps rows of four and the lowest row its line, centred on the pocket and never slid toward the arm; the lapel lies over its inner corner (4.2.2.4 as rewritten by ICL 25-02)', async () => {
  const spec = await store.load('garment-corporate-service-dress-blazer-male');
  const crest = core.anchor(spec, 'crest_center');
  const scene = await compose(build('male', 'Capt', 12));
  const drapes = scene.layers.filter(l => l.role === 'mini-drape');
  const rows = new Map();
  drapes.forEach(l => rows.set(l.y.toFixed(3), (rows.get(l.y.toFixed(3)) || 0) + 1));
  assert.deepEqual([...rows.values()], [4, 4, 4], 'three rows of four');
  const x0 = Math.min(...drapes.map(l => l.x)), x1 = Math.max(...drapes.map(l => l.x + l.w));
  assert.ok(Math.abs((x0 + x1) / 2 - crest.x) < 0.02, `centred on the pocket centre line ${crest.x.toFixed(3)} (got ${((x0 + x1) / 2).toFixed(3)})`);
  assert.ok(!scene.notes.some(n => /moved toward the arm/.test(n)), 'no slide toward the arm');
  const fg = scene.layers.filter(l => l.key === 'layer:foreground' && l.clip);
  assert.equal(fg.length, 1, 'the lapel lies over the rack');
  assert.ok(fg[0].z > Math.max(...drapes.map(l => l.z)), 'the lapel foreground is above the medals');
  assert.ok(scene.notes.some(n => /lapel lies over the inner corner of the miniature medals/.test(n)), 'the lapel over the medals is noted');
});

test('semi_formal women: where the lapel and the arm seam leave no room for four to a row the rack has fewer columns, and says so (11.2.8)', async () => {
  const scene = await compose(build('female', 'Capt', 12));
  const drapes = scene.layers.filter(l => l.role === 'mini-drape');
  const perRow = new Map();
  drapes.forEach(l => perRow.set(l.y.toFixed(3), (perRow.get(l.y.toFixed(3)) || 0) + 1));
  assert.ok(Math.max(...perRow.values()) <= 4, 'at most four to a row');
  assert.equal(drapes.length, 12);
  const few = await compose(build('female', 'Capt', 2));
  assert.equal(few.layers.filter(l => l.role === 'mini-drape').length, 2);
  assert.ok(!few.notes.some(n => /to a row/.test(n)), 'two medals never need fewer columns');
});

test('semi_formal: the chaplain badge stays 1/2 in above the top row, centred on the rack or past it toward the arm (4.2.1.5, 4.2.2.5)', async () => {
  for(const sex of ['male', 'female']){
    for(const n of [2, 7, 12]){
      const scene = await compose(build(sex, 'Col', n));
      const drapes = scene.layers.filter(l => l.role === 'mini-drape');
      const badge = scene.layers.find(l => l.role === 'badge' && /chaplin|chaplain/.test(l.key));
      const top = Math.min(...drapes.map(l => l.y));
      assert.ok(Math.abs(top - (badge.y + badge.h) - 0.5) < 0.02, `${sex} ${n}: 1/2 in above the top row`);
      assert.equal(scene.layers.filter(l => l.role === 'badge').length, 1, `${sex} ${n}: the chaplain badge (the crest is the sheet's)`);
    }
  }
});
