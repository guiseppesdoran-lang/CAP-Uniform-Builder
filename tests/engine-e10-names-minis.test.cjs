'use strict';
// E10 (critique D30): engraved names are sized from the plate spec's name zone with measured
// lettering metrics; semi-formal miniature medals keep their regulation spacing; the corporate
// blazer shows the shirt it is worn over beside it.
//   - Plate lettering: Arial Bold capitals, advance widths and cap height measured in Chrome
//     (canvas measureText at 1000 px). The capitals fill 0.9 of the zone's height; a long name is
//     condensed to 0.6 of its width, then made smaller; it never leaves the zone.
//   - CAPR 39-1 11.2.8, 11.3: miniature ribbons are 11/16 in wide; fewer than five medals in a row are
//     fully exposed (11/16 in apart); upper rows cover about half of the ribbon portion below.
//   - 4.2.1.4, 4.2.2.4 with ICL 25-02: the lowest row ends 1/2 in above the crest.
//   - 4.2.3.1, 4.2.4.1: the blazer is worn over the long-sleeve aviator shirt and tie.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
const C = require('../js/engine/compose.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const RA = require('../data/ribbon-awards.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));

function build(uniform, gender, membership, rank, last, extra){
  return Object.assign({
    uniform, gender, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'auto' }, name: { first: 'Pat', last, show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(4)} vs ${b.toFixed(4)}`);
const nameLayer = (scene, key) => scene.layers.find(l => l.key === (key || 'text:name'));
const FILL = 0.9;

// ---- the metrics ----------------------------------------------------------------------------------

test('lettering metrics: Arial Bold advances (per 1000 em) and the 0.716 cap height', () => {
  near(C.textAdvance('H'), 0.722, 1e-9, 'H');
  near(C.textAdvance('DORAN'), 3.666, 1e-9, 'DORAN');
  near(C.textAdvance('A-B'), 0.722 + 0.333 + 0.722, 1e-9, 'hyphen');
  near(C.CAP_HEIGHT, 0.716, 1e-9, 'cap height');
});

function fakeCtx(){
  const layers = [];
  return { layers, text(o){ const l = Object.assign({ type: 'text' }, o); layers.push(l); return l; } };
}

test('plateName: a name that fits fills the zone height at normal width, centred', () => {
  const zone = { x: 1, y: 2, w: 2.675, h: 0.32 };
  const ctx = fakeCtx();
  const r = C.plateName(ctx, 'Doran', zone, {});
  near(r.capH, FILL * zone.h, 1e-9, 'cap height');
  assert.equal(r.condense, 1);
  near(r.width, 3.666 * r.size, 1e-9, 'width is the measured advance');
  assert.ok(r.width < zone.w);
  const l = r.layer;
  near(l.x, zone.x + zone.w / 2, 1e-9, 'centred across');
  // 'central' baseline is the em box middle; the capitals' middle is moved onto the zone middle.
  near(l.y - zone.y - zone.h / 2, (0.358 - 0.3465) * l.size, 1e-9, 'cap middle on the zone middle');
  assert.equal(l.fitWidth, r.width, 'textLength is the measured width, so the font cannot widen it');
});

test('plateName: a long name is condensed to 0.6, then shrunk; it stays in the zone', () => {
  const zone = { x: 1, y: 2, w: 2.675, h: 0.32 };
  const r = C.plateName(fakeCtx(), 'Vandenberg-Castellano', zone, {});
  near(r.condense, 0.6, 1e-9, 'condense floor');
  assert.ok(r.size < zone.h * FILL / C.CAP_HEIGHT, 'smaller than the full size');
  near(r.width, zone.w, 1e-6, 'fills the zone width');
  assert.ok(r.capH < FILL * zone.h);
  // A name just too wide for normal lettering is only condensed, keeping the full height.
  const mid = C.plateName(fakeCtx(), 'Wojciechowski', zone, {});
  assert.ok(mid.condense < 1 && mid.condense > 0.6, `condense ${mid.condense}`);
  near(mid.capH, FILL * zone.h, 1e-9, 'full height');
  near(mid.width, zone.w, 1e-6, 'fills the zone width');
});

// ---- every plate -------------------------------------------------------------------------------

async function zoneOf(plateId, name, plate, single){
  const spec = await store.load(plateId);
  const r = core.landmarkBounds(spec, name);
  const s = plate.w / spec.w;
  let h = r.h * s;
  let y = single ? plate.y + (plate.h - h) / 2 : plate.y + r.y * s;
  // The three-line plates: lines 1-2 are drawn above the name; it stays 0.07 in clear of line 2's baseline (0.345 in) and of the
  // plate's inner border (0.02 in in), centred in that band (FIX-R-OTHER-r1 #1, D8; tests/engine-fix-r-other-5).
  if(!single && /3line/.test(plateId) && /nametag$/.test(plate.key)){
    const top = plate.y + 0.345 * s, bottom = plate.y + plate.h - 0.02 * s;
    h = Math.min(h * FILL, (bottom - top) - 0.14 * s) / FILL;
    y = (top + bottom) / 2 - h / 2;
  }
  return { x: plate.x + r.x * s, y, w: r.w * s, h };
}

const PLATES = [
  // uniform, sex, membership, rank, plate layer key, plate spec, single line?
  ['blues_a', 'male', 'cadet', 'C/Maj', 'clear:nametag', 'nameplate-3line-cadet', false],
  ['blues_a', 'female', 'cadet', 'C/Maj', 'clear:nametag', 'nameplate-3line-cadet', false],
  ['blues_a', 'male', 'senior', 'Capt', 'clear:nametag', 'nameplate-3line-adult', true],
  ['blues_a', 'female', 'senior', 'Capt', 'clear:nametag', 'nameplate-3line-adult', true],
  ['blues_b', 'male', 'senior', 'Capt', 'clear:nametag', 'nameplate-3line-adult', false],
  ['blues_b', 'female', 'cadet', 'C/Maj', 'clear:nametag', 'nameplate-3line-cadet', false],
  ['aviator', 'male', 'senior', 'Capt', 'nametag', 'nameplate-3line-adult', false],
  ['aviator', 'female', 'senior', 'Capt', 'nametag', 'nameplate-3line-adult', false]
];

for(const [uniform, sex, membership, rank, plateKey, plateId, single] of PLATES){
  for(const last of ['Doran', 'Hillard', 'Vandenberg-Castellano']){
    test(`${uniform} ${sex} ${membership}: "${last}" is sized from the plate's name zone and stays inside it`, async () => {
      const scene = await P.composeUniform(build(uniform, sex, membership, rank, last), store);
      const plate = scene.layers.find(l => l.key === plateKey);
      assert.ok(plate, 'plate drawn');
      const zone = await zoneOf(plateId, 'name', plate, single);
      const t = nameLayer(scene);
      assert.ok(t, 'name drawn');
      assert.equal(t.text, last.toUpperCase());
      assert.ok(t.h <= FILL * zone.h + 1e-6, `cap height ${t.h.toFixed(3)} within the zone ${zone.h.toFixed(3)}`);
      assert.ok(t.w <= zone.w + 1e-6, `width ${t.w.toFixed(3)} within the zone ${zone.w.toFixed(3)}`);
      near(t.x, zone.x + zone.w / 2, 1e-6, 'centred across the zone');
      // The capitals' middle is the zone's middle.
      near(t.y - (0.358 - 0.3465) * t.size, zone.y + zone.h / 2, 1e-6, 'centred up and down');
      if(last !== 'Vandenberg-Castellano') near(t.h, FILL * zone.h, 1e-6, 'a name that fits fills the zone height');
      else assert.ok(t.h < FILL * zone.h, 'a long name shrinks');
      // It is a real size: Doran on the 3-line plate is well over the old 0.17 in em.
      if(last === 'Doran') assert.ok(t.h > 0.2, `cap height ${t.h.toFixed(3)} in`);
    });
  }
}

for(const sex of ['male', 'female']){
  test(`aviator_blazer ${sex}: the name and the state are sized from the blazer plate's zones`, async () => {
    const scene = await P.composeUniform(build('aviator_blazer', sex, 'senior', 'Capt', 'Doe', { name: { first: 'Pat', last: 'Doe', state: 'New York', show: true } }), store);
    const plate = scene.layers.find(l => l.key === 'nametag' && l.id === 'nameplate-blazer-adult');
    assert.ok(plate, 'blazer plate');
    for(const [lm, key] of [['name', 'text:name'], ['state', 'text:state']]){
      const zone = await zoneOf('nameplate-blazer-adult', lm, plate, false);
      const t = scene.layers.find(l => l.key === key && l.y > plate.y && l.y < plate.y + plate.h);
      assert.ok(t, key);
      assert.ok(t.h <= FILL * zone.h + 1e-6 && t.w <= zone.w + 1e-6, `${key} inside its zone`);
      near(t.h, FILL * zone.h, 1e-6, `${key} fills its zone height`);
    }
  });
}

test('the blazer plate\'s long name stays inside the name zone', async () => {
  const scene = await P.composeUniform(build('aviator_blazer', 'male', 'senior', 'Capt', 'Vandenberg-Castellano'), store);
  const plate = scene.layers.find(l => l.key === 'nametag' && l.id === 'nameplate-blazer-adult');
  const zone = await zoneOf('nameplate-blazer-adult', 'name', plate, false);
  const t = scene.layers.filter(l => l.key === 'text:name').find(l => l.y > plate.y && l.y < plate.y + plate.h);
  assert.ok(t.w <= zone.w + 1e-6);
  assert.ok(t.h < FILL * zone.h);
});

// ---- the corporate semi-formal miniatures -------------------------------------------------------

function medalsOf(ids){
  return ids.flatMap(id => RA.resolve(id, {}).map(r => ({ key: 'mini:' + id, title: id, ribbonAsset: 'ribbon-' + id.replace(/_/g, '-'), medal: 'medal-' + id.replace(/_/g, '-') + '-miniature', devices: r.devices })));
}
const IDS = ['distinguished_service_award', 'exceptional_service_award', 'meritorious_service_award', 'commander_commendation_award', 'cap_achievment_award', 'cap_gill_robb_wilson_ribbon', 'cap_command_service_ribbon', 'cap_membership_ribbon', 'cap_leadership_ribbon'];

for(const sex of ['male', 'female']){
  test(`semi_formal ${sex}: miniature medals sit 11/16 in apart in rows of four, upper rows hang over the ribbons below (one medal body and a short band of ribbon apart, the photo L1837), lowest row 1/2 in above the crest`, async () => {
    const medals = medalsOf(IDS);
    const scene = await P.composeUniform(build('semi_formal', sex, 'senior', 'Col', 'Doe', { medals }), store);
    const drapes = scene.layers.filter(l => l.role === 'mini-drape');
    assert.equal(drapes.length, medals.length);
    const W = 11 / 16, DRAPE = C.MINI_DRAPE.h;
    near(C.MINI_DRAPE.w, W, 1e-9, 'a miniature ribbon is 11/16 in wide (11.3)');
    const rows = new Map();
    drapes.forEach(l => { const k = l.y.toFixed(3); rows.set(k, [...(rows.get(k) || []), l]); });
    const ys = [...rows.keys()].map(Number).sort((a, b) => b - a);
    // The men's coat has room for rows of four beside the lapel; the women's, whose lapel and arm seam leave less,
    // wears three to a row (the rack has one column fewer where it would not fit between them, 11.2.8; FINAL semi-formal lapel fix, D8).
    // The rows lie closer now (a body and a 0.2 in band apart, Doran's photo L1837), so the rack is shorter and the least-overshoot column
    // count the women's coat settles on is two to a row (it was three at the old 1.65 in pitch; D8).
    assert.deepEqual(ys.map(y => rows.get(y.toFixed(3)).length), sex === 'male' ? [4, 4, 1] : [2, 2, 2, 2, 1], sex === 'male' ? 'rows of four, then the remainder' : 'rows of two');
    for(const [, row] of rows){
      row.sort((a, b) => a.x - b.x);
      for(let i = 1; i < row.length; i++) near(row[i].x - row[i - 1].x, W, 1e-6, 'step between medals in a row');
      near(row.reduce((s, l) => s + l.w, 0) / row.length, W, 1e-6, 'drape width');
    }
    const bodyH = scene.layers.filter(l => l.role === 'mini-medal').reduce((m, l) => Math.max(m, l.h), 0);
    // Row to row: the tallest body hanging below a drape plus a 0.05 in band of ribbon left in view (0.5 in where a lower row carries a device) (Doran's
    // photo L1837, Ethan: 'spaced way too far apart'; the old 50% of the drape was 1.65 in); the upper row's pendants hang over the ribbon below.
    const lowerDev = scene.layers.some(l => l.role === 'device' && /^mini:/.test(l.key) && drapes.find(d => l.key.startsWith(d.key + ':') && d.y > ys[ys.length - 1] + 0.01));
    let hang = 0;
    for(const l of scene.layers.filter(x => x.role === 'mini-medal')){ const s = await store.load(l.id); const at = core.anchor(s, 'ribbon_attach') || { x: 0, y: 0 }; hang = Math.max(hang, s.h - at.y); }
    for(let i = 1; i < ys.length; i++){
      near(ys[i - 1] - ys[i], hang + (lowerDev ? 0.5 : 0.05), 0.002, 'row pitch: a medal body and a band of ribbon');
      assert.ok(ys[i - 1] - ys[i] < DRAPE * 0.75, 'the upper row hangs over the ribbon below it');
    }
    // 1/2 in above the crest (the crest centre and its top come from the garment sheet).
    const spec = await store.load(`garment-corporate-service-dress-blazer-${sex}`);
    const crestTop = core.anchor(spec, 'crest_top_center').y;
    // The lowest row's medal bodies as drawn (4.2.2.4, ICL 25-02): not the tallest body of the whole set,
    // which may hang in an upper row and would leave a gap under the shorter ones.
    const lowKeys = new Set(rows.get(ys[0].toFixed(3)).map(l => l.key + ':medal'));
    const bottom = Math.max(...scene.layers.filter(l => l.role === 'mini-medal' && lowKeys.has(l.key)).map(l => l.y + l.h));
    // The men's blazer: the crest is centred on the pocket, so 1/2 in over it is over the welt; the rack ends at the pocket's top edge (FIX-R-OTHER-r1 #4, D8).
    const pocketTop = sex === 'male' ? core.anchor(spec, 'pocket_top_center').y : Infinity;
    near(bottom, Math.min(crestTop - 0.5, pocketTop), 0.01, 'lowest medals end 1/2 in above the crest, or at the top of the men\'s pocket');
  });
}

test('semi_formal: with four or fewer medals none overlaps; with more than four they overlap by at most half', async () => {
  const four = await P.composeUniform(build('semi_formal', 'male', 'senior', 'Col', 'Doe', { medals: medalsOf(IDS.slice(0, 4)) }), store);
  const xs = four.layers.filter(l => l.role === 'mini-drape').map(l => l.x).sort((a, b) => a - b);
  for(let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 11 / 16 - 1e-6, 'fully exposed');
});

// ---- aviator blazer shows the shirt too ---------------------------------------------------------

for(const sex of ['male', 'female']){
  test(`aviator_blazer ${sex}: the long-sleeve aviator shirt is drawn beside the blazer, not on it`, async () => {
    const scene = await P.composeUniform(build('aviator_blazer', sex, 'senior', 'Capt', 'Doe'), store);
    const first = scene.layers.filter(l => !l.figure), second = scene.layers.filter(l => l.figure === 2);
    assert.ok(first.length && second.length, 'two figures');
    const a = core.unionBounds(first.filter(l => l.role !== 'text').map(core.layerBounds));
    const b = core.unionBounds(second.filter(l => l.role !== 'text').map(core.layerBounds));
    assert.ok(b.x >= a.x + a.w, 'the shirt starts to the right of the blazer');
    assert.ok(first.some(l => /blazer/.test(l.id || '')), 'blazer');
    assert.ok(second.some(l => /aviator|blues-class-b|shirt/.test(l.id || '')), 'shirt');
  });
}
