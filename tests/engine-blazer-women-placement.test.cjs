'use strict';
// LIVE13 E127 (Ethan, on the women's corporate blazer: "the mini medals go onto the sleeve, and the crest doesnt fit. female uniforms need different placements than
// male ones"). The re-measured women's sheet (LIVE13-ART 19) states each place from CAPR 39-1 4.2.2 and 4.2.4 in its `placement` object; the engine takes the nameplate,
// the miniature rack and the crest from those slots and holds the slots to the sheet's own lapel and armhole seam.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const loader = (edit) => p => { const j = JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8')); return Promise.resolve(edit && /garment-corporate-service-dress-blazer-female\.spec\.json$/.test(p) ? edit(j) : j); };
const store = core.createSpecStore(manifest, loader());
const SHEET = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', 'garment-corporate-service-dress-blazer-female.spec.json'), 'utf8'));
const PL = SHEET.placement;
const OFFSET_Y = 0.1;   // the sheets' art group sits 0.1 in down in the box; the spec's placement numbers are from the collar top
const CENTRE_X = SHEET.anchors.top_center[0] / 100;
const RIBBONS = [['meritorious_service_award'], ['commander_commendation_award'], ['cap_achievment_award', 'capub_total_3'], ['cap_membership_ribbon'], ['red_service_ribbon'], ['search_find_ribbon', 'aircrew'], ['air_search_and_rescue_ribbon'], ['cap_leadership_ribbon'], ['cap_command_service_ribbon']];
const mk = (uniform, gender, n, o) => HARNESS.makeBuild(Object.assign({ uniform, gender, membership: 'senior', rank: 'Capt', name: { first: 'Pat', last: 'Doran', show: true }, opt: {}, medalSel: n > 0, ribbonSel: RIBBONS.slice(0, n) }, o || {}));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} vs ${b.toFixed(3)}`);
const slot = (r) => ({ x: r.x_in[0], y: r.y_in[0], w: r.x_in[1] - r.x_in[0], h: r.y_in[1] - r.y_in[0] });

test('the women\'s nameplate is the sheet\'s slot: centred on the pair, top edge at the slot\'s top, clear of the lapel and the seam (4.2.4.1.1.2)', async () => {
  const scene = await P.composeUniform(mk('aviator_blazer', 'female', 0), store);
  const tag = scene.layers.find(l => l.key === 'nametag'), s = slot(PL.nameplate_slot);
  near(tag.x + tag.w / 2, CENTRE_X + PL.pair_center_x_in, 0.01, 'centred on the pair');
  near(tag.y, s.y + OFFSET_Y, 0.01, 'top edge at the slot\'s top');
  assert.ok(tag.x >= CENTRE_X + s.x - 0.02 && tag.x + tag.w <= CENTRE_X + s.x + s.w + 0.02, 'inside the slot across');
  assert.ok(!scene.notes.some(n => /lapel edge|armhole seam/.test(n)), 'the guard has nothing to say: ' + scene.notes.join(' | '));
});

test('the women\'s miniature rack: centred on the medal slot, its lowest row 1/2 in above the crest, the rack of four across inside the slot (4.2.2.4, ICL 25-02)', async () => {
  const s = slot(PL.medal_slot);
  for(const n of [1, 2, 3, 4]){
    const scene = await P.composeUniform(mk('semi_formal', 'female', n), store);
    const medals = scene.layers.filter(l => l.role === 'mini-medal');
    assert.equal(medals.length, n);
    const x0 = Math.min(...medals.map(l => l.x)), x1 = Math.max(...medals.map(l => l.x + l.w)), bottom = Math.max(...medals.map(l => l.y + l.h));
    near((x0 + x1) / 2, CENTRE_X + PL.pair_center_x_in, 0.05, `${n} medals centred on the slot (half a medal either way)`);
    near(bottom, PL.crest.top_in - 0.5 + OFFSET_Y, 0.15, `${n} medals: lowest row ends 1/2 in above the crest`);
    if(n === 4){
      assert.ok(x1 - x0 <= PL.medal_slot.rack_4_across_in + 0.02, `four across ${(x1 - x0).toFixed(2)} in, the slot's ${PL.medal_slot.rack_4_across_in}`);
      assert.ok(x0 >= CENTRE_X + s.x - 0.01 && x1 <= CENTRE_X + s.x + s.w + 0.01, 'inside the slot across');
    }
    // The medals are on the chest, never on the sleeve: their right edge is clear of the sheet's armhole seam at their height.
    const seam = SHEET.landmarks.arm_seam_left.map(p => [p[0] / 100, p[1] / 100]);
    const seamX = y => { for(let i = 1; i < seam.length; i++) if(y <= seam[i][1]) return seam[i - 1][0] + (seam[i][0] - seam[i - 1][0]) * (y - seam[i - 1][1]) / (seam[i][1] - seam[i - 1][1]); return seam[seam.length - 1][0]; };
    for(const l of scene.layers.filter(l => /^mini/.test(l.role || ''))) assert.ok(l.x + l.w + 0.25 <= seamX(l.y) && l.x + l.w + 0.25 <= seamX(l.y + l.h), `${n} medals: ${l.key} is clear of the seam by 1/4 in`);
    assert.ok(!scene.notes.some(n2 => /sleeve|armhole seam|lapel edge/.test(n2)), 'no sleeve or seam note');
  }
});

test('the women\'s crest and the pair are the cut\'s own: the crest centred where the sheet states it, not where the men\'s pocket puts it (4.2.4.1.1.1)', async () => {
  const sc = await P.composeUniform(mk('semi_formal', 'female', 4), store);
  const crest = sc.layers.find(l => /^layer:garment-corporate-service-dress-blazer-female$/.test(l.key) || l.role === 'garment');
  assert.ok(crest, 'the blazer sheet carries the crest');
  const C = SHEET.anchors.crest_center;
  near(C[0] / 100, CENTRE_X + PL.crest.center_in[0], 0.01, 'crest across');
  near(C[1] / 100, PL.crest.center_in[1] + OFFSET_Y, 0.01, 'crest down');
  // The men's blazer is a different cut: its pair stands on its pocket, nowhere near the women's numbers.
  const men = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', 'garment-corporate-service-dress-blazer-male.spec.json'), 'utf8'));
  assert.ok(!men.placement, 'the men\'s sheet has no placement object: it keeps the pocket rules (4.2.3)');
});

test('the fit guard: a sheet whose armhole seam or lapel comes within 0.2 in of a slot is reported, so a moved line cannot put the medals back on the sleeve unseen', async () => {
  const moved = core.createSpecStore(manifest, loader(j => { j.landmarks.arm_seam_left = j.landmarks.arm_seam_left.map(p => [p[0] - 330, p[1]]); return j; }));
  const sc = await P.composeUniform(mk('semi_formal', 'female', 4), moved);
  assert.ok(sc.notes.some(n => /armhole seam/.test(n) && /sleeve/.test(n)), 'seam note: ' + sc.notes.join(' | '));
  const lap = core.createSpecStore(manifest, loader(j => { j.landmarks.lapel_left = j.landmarks.lapel_left.map(p => [p[0] + 120, p[1]]); return j; }));
  const sl = await P.composeUniform(mk('aviator_blazer', 'female', 0), lap);
  assert.ok(sl.notes.some(n => /lapel edge/.test(n)), 'lapel note: ' + sl.notes.join(' | '));
});
