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

for(const sex of ['male', 'female']){
  test(`semi_formal ${sex}: with 1 to 12 miniatures and the chaplain badge no medal, device or badge box meets the lapel, for every grade (4.2.2.4, 4.2.1.5, 11.2.8)`, async () => {
    const lapel = lapelFromSheet(sex);
    let checked = 0;
    for(const rank of ['SMSgt', 'Capt', 'Col', 'Maj Gen']){
      for(const n of [1, 2, 4, 5, 7, 9, 12]){
        const scene = await compose(build(sex, rank, n));
        const layers = scene.layers.filter(worn);
        assert.ok(layers.some(l => l.role === 'badge' && /chaplin|chaplain/.test(l.key)), `${sex} ${rank} ${n}: the chaplain badge is drawn`);
        assert.ok(layers.filter(l => l.role === 'mini-drape').length >= 1, `${sex} ${rank} ${n}: miniatures drawn`);
        for(const l of layers){
          const box = core.layerBounds(l);
          assert.ok(!C.rectHitsPolygon(box, lapel), `${sex} ${rank} ${n}: ${l.role} ${l.key} (${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${box.w.toFixed(2)} x ${box.h.toFixed(2)}) meets the lapel`);
          checked++;
        }
        // Nothing clips the rack: no lapel foreground is drawn over it.
        assert.ok(!scene.layers.some(l => l.key === 'layer:foreground' && l.clip), `${sex} ${rank} ${n}: no lapel foreground clipped over the rack`);
        // The rack's centre lies between the lapel edge and the arm seam at its height: right of every lapel point in the
        // rack's rows and left of the seam at the rack's mid height.
        const drapes = layers.filter(l => l.role === 'mini-drape');
        const x0 = Math.min(...drapes.map(l => l.x)), x1 = Math.max(...drapes.map(l => l.x + l.w));
        const y0 = Math.min(...drapes.map(l => l.y)), y1 = Math.max(...drapes.map(l => l.y + l.h));
        const lapelRight = Math.max(...lapel.filter(p => p.y >= y0 && p.y <= y1).map(p => p.x), -Infinity);
        assert.ok((x0 + x1) / 2 > lapelRight, `${sex} ${rank} ${n}: the rack's centre ${(x0 + x1) / 2} is past the lapel edge ${lapelRight}`);
      }
    }
    assert.ok(checked > 200);
  });
}

test('semi_formal men: the rack keeps rows of four and the lowest row its line; it moves toward the arm only as far as the lapel needs (4.2.2.4)', async () => {
  const spec = await store.load('garment-corporate-service-dress-blazer-male');
  const crest = core.anchor(spec, 'crest_center');
  const scene = await compose(build('male', 'Capt', 12));
  const drapes = scene.layers.filter(l => l.role === 'mini-drape');
  const rows = new Map();
  drapes.forEach(l => rows.set(l.y.toFixed(3), (rows.get(l.y.toFixed(3)) || 0) + 1));
  assert.deepEqual([...rows.values()], [4, 4, 4], 'three rows of four');
  const x0 = Math.min(...drapes.map(l => l.x)), x1 = Math.max(...drapes.map(l => l.x + l.w));
  assert.ok((x0 + x1) / 2 > crest.x, 'moved toward the arm');
  assert.ok((x0 + x1) / 2 < crest.x + 2.5, 'by no more than the lapel needs');
  assert.ok(scene.notes.some(n => /moved toward the arm until they clear the lapel/.test(n)), 'the move is noted');
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
