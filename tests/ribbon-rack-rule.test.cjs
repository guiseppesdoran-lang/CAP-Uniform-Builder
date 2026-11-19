'use strict';
// The owner (2026-11-12): "the ribbon override still needs to ensure the ribbon rack is in the correct layout". Whatever width and upper-row arrangement the member picks, the rack the
// engine draws is a layout CAPR 39-1 11.2.7 allows for that number of ribbons on that garment (tests/helpers/rack-rule.cjs states the rule with its paragraphs and checks a drawn rack
// against it). The member's own rows (the custom grid) count only where they are such a layout; a saved setup that carries any other falls back to the allowed layout.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { violations, rowsOfLayers } = require('./helpers/rack-rule.cjs');
const { createDocument } = require('./helpers/mini-dom.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const core = require('../js/engine/core.js');
const awards = require('../js/engine/awards.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

const ribbons = n => Array.from({ length: n }, (_, i) => ({ key: 'ribbon:r' + i, id: 'r' + i, title: 'r' + i, asset: 'ribbon-armstrong-achievement', devices: [], centered: false }));
const WIDTHS = { '3': { rackColumns: 3 }, '4-left': { rackColumns: 4, rackAlign: 'outboard' }, '4-center': { rackColumns: 4 } };
const buildOf = (uniform, membership, rank, gender, n, opt) => ({
  uniform, gender, membership, grade: G.gradeInfo(membership, rank, {}), opt: Object.assign({ headgear: 'none' }, opt), name: { first: '', last: '', show: false },
  ribbons: ribbons(n), medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
});

// The rule's context for a drawn scene: where the rack rests, the welt's wearer's-left edge, the lapel.
async function contextOf(scene, build, choice){
  const coat = scene.layers.find(l => l.role === 'garment');
  const spec = await store.load(coat.id);
  const classA = ['blues_a', 'semi_formal_usaf'].includes(build.uniform);
  const base = { order: build.ribbons.map(r => r.key), width: Number(String(choice.width)[0]), align: choice.width === '4-left' ? 'left' : 'center', maxPerRow: classA ? 4 : 3, tolerance: awards.LAPEL_COVER_TOLERANCE };
  if(classA){
    const a = core.anchor(spec, 'welt_top_center'), welt = core.landmarkBounds(spec, 'welt_pocket'), lapel = spec.landmarks.lapel_left && spec.landmarks.lapel_left.points;
    return Object.assign(base, { rest: { x: a.x, y: a.y }, outboardX: welt.x + welt.w, covered: lapel ? r => awards.coverage(r, lapel) : null, lapelRule: choice.arrangement === 'lapel', allowCovered: choice.arrangement === 'standard' });
  }
  const a = core.anchor(spec, 'ribbon_row_bottom_center') || core.anchor(spec, 'ribbon_slot_center');
  return Object.assign(base, { rest: { x: a.x, y: null }, outboardX: a.x + 1.5 * 1.375, covered: null, lapelRule: false, allowCovered: true });
}

// ---- the rule ---------------------------------------------------------------------------------------------------------------------------------

test('the checker knows the rule: what it lets through and what it refuses (hand-built racks)', () => {
  const rack = (rows, left, y0 = 10) => rows.map((count, i) => Array.from({ length: count }, (_, j) => ({ key: `r${rows.slice(0, i).reduce((a, c) => a + c, 0) + j}`, x: left(i, count) + j * 1.375, y: y0 + i * 0.375, w: 1.375, h: 0.375 })));
  const centre = 20;
  const centred = (i, count) => centre - count * 1.375 / 2;
  const ctx = { width: 3, align: 'center', maxPerRow: 4, rest: { x: centre, y: 10 + 0.375 * 3 }, outboardX: centre + 2, tolerance: 0.02, lapelRule: false, allowCovered: true };
  assert.deepEqual(violations(rack([2, 3, 3], centred), ctx), [], 'rows of three, the incomplete row on top and centered over the row below');
  assert.deepEqual(violations(rack([3, 3, 3], centred), ctx), []);
  assert.match(violations(rack([1, 2, 3], centred), ctx).join(), /shorter than 3/, 'a pyramid of short rows: only the top row is incomplete');
  assert.match(violations(rack([3, 1, 3], centred), ctx).join(), /longer than the row below/, 'a short row in the middle');
  assert.match(violations(rack([2, 3, 3], (i, c) => i === 0 ? centre - 3 * 1.375 / 2 + 1.375 : centred(i, c)), ctx).join(), /not centered over the row below/, 'the top row off center');
  assert.match(violations(rack([3, 3], (i, c) => centred(i, c) + 0.5), ctx).join(), /not centered above the pocket/, 'rows of three off the pocket');
  assert.match(violations(rack([4, 4], centred), ctx).join(), /more than 3 across/, 'four across on a garment that has only three (Class B, aviator shirt)');
  assert.match(violations(rack([3, 3], centred), Object.assign({}, ctx, { rest: { x: centre, y: 10 + 0.375 * 2 + 0.1 } })).join(), /rest on the top edge/);
  const spaced = rack([3, 3], centred); spaced[0].forEach(l => { l.y -= 0.1; });
  assert.match(violations(spaced, ctx).join(), /no space between/, '11.3.3');
  assert.match(violations(rack([3, 3], centred), Object.assign({}, ctx, { order: ['r1', 'r0', 'r2', 'r3', 'r4', 'r5'] })).join(), /order of precedence/);
  const four = Object.assign({}, ctx, { width: 4, rest: { x: centre, y: 10 + 0.375 * 2 }, outboardX: centre + 1.8 });
  assert.deepEqual(violations(rack([4, 4], centred), four), [], 'four across, centered above the pocket');
  assert.deepEqual(violations(rack([4, 4], (i, c) => four.outboardX - c * 1.375), Object.assign({}, four, { align: 'left' })), [], 'four across, the left edge on the welt\'s edge');
  assert.match(violations(rack([4, 4], centred), Object.assign({}, four, { align: 'left' })).join(), /aligned with the left edge of the welt/);
  // Rows shortened to keep the lapel clear: only where the lapel is being kept clear, aligned to the left edge, never longer than the row below.
  const edge = centre + 1.5 * 1.375;
  const stepped = rack([1, 2, 3], (i, c) => i === 0 ? edge - 1.375 : i === 1 ? edge - 2 * 1.375 : centred(i, c));
  assert.match(violations(stepped, ctx).join(), /shorter than 3 where the lapel is not being kept clear/);
  const lapel = [{ x: centre - 5, y: 5 }, { x: centre - 1, y: 5 }, { x: centre - 1.5, y: 10.4 }, { x: centre - 5, y: 12 }];
  const keep = Object.assign({}, ctx, { lapelRule: true, allowCovered: false, covered: r => awards.coverage(r, lapel) });
  assert.deepEqual(violations(rack([1, 3], (i, c) => i === 0 ? edge - 1.375 : centred(i, c)), Object.assign({}, keep, { covered: () => 0 })).filter(v => /not centered over/.test(v)), [], 'the top row aligned to the edge: allowed where the lapel is kept clear ...');
  assert.match(violations(rack([1, 3], (i, c) => i === 0 ? edge - 1.375 : centred(i, c)), Object.assign({}, keep, { covered: () => 0 })).join(), /aligned to the edge though the lapel does not reach it centered/, '... and only where the lapel would reach it centered');
});

test('rows the member sets themselves are a layout only if they are the plain rows of three or of four (E.awards.plainRowsWidth)', () => {
  const w = (rowsTopFirst, n, max) => awards.plainRowsWidth([...rowsTopFirst].reverse(), n, max);
  assert.equal(w([3, 3, 3], 9), 3);
  assert.equal(w([1, 4, 4], 9), 4);
  assert.equal(w([2, 3, 3], 8), 3);
  assert.equal(w([4, 4], 8), 4);
  assert.equal(w([2], 2), 3, 'two ribbons are one row, the same for three across and four');
  assert.equal(w([1, 3], 4), 3);
  assert.equal(w([4], 4), 4);
  // Not layouts: a pyramid, a short row below the top, a row wider than its row below, rows that do not add up, nothing.
  for(const [rows, n] of [[[2, 3, 4], 9], [[1, 2, 3], 6], [[3, 1, 3], 7], [[4, 3], 7], [[1, 1, 1], 3], [[3, 3], 7], [[], 0]]) assert.equal(w(rows, n), 0, JSON.stringify(rows));
  assert.equal(w([4, 4], 8, 3), 0, 'four across where only three are authorized (Class B, the aviator shirt)');
  assert.deepEqual(awards.plainRowCounts(10, 3), [1, 3, 3, 3]);
  assert.deepEqual(awards.plainRowCounts(10, 4), [2, 4, 4]);
});

// ---- the engine draws an allowed layout for every count, width and arrangement the picker can produce ------------------------------------------------------

const GARMENTS = [
  ['blues_a', 'cadet', 'C/Capt'], ['blues_a', 'senior', 'Maj'], ['semi_formal_usaf', 'cadet', 'C/Capt'],
  ['blues_b', 'cadet', 'C/Capt'], ['blues_b', 'senior', 'Maj'], ['aviator', 'senior', 'Maj']
];

test('every rack the picker can produce is a layout 11.2.7 allows: 1 to 30 ribbons, every width and arrangement, every garment that wears ribbons, both cuts', async () => {
  let drawn = 0;
  const wrong = [];
  for(const [uniform, membership, rank] of GARMENTS){
    const classA = ['blues_a', 'semi_formal_usaf'].includes(uniform);
    for(const gender of ['male', 'female']){
      for(const width of classA ? Object.keys(WIDTHS) : ['3']){
        for(const arrangement of classA ? ['standard', 'lapel'] : ['standard']){
          for(let n = 1; n <= 30; n++){
            const build = buildOf(uniform, membership, rank, gender, n, Object.assign({ rackArrangement: arrangement }, WIDTHS[width]));
            const scene = await P.composeUniform(build, store);
            const rows = rowsOfLayers(scene.layers.filter(l => l.role === 'ribbon'));
            const bad = violations(rows, await contextOf(scene, build, { width, arrangement }));
            drawn++;
            if(bad.length) wrong.push(`${uniform} ${membership} ${gender} ${width} ${arrangement} ${n} ribbons: ${[...new Set(bad)].join('; ')}`);
          }
        }
      }
    }
  }
  assert.ok(drawn > 1200, `${drawn} racks checked`);
  assert.deepEqual(wrong, [], 'a rack outside 11.2.7:\n' + wrong.slice(0, 12).join('\n'));
});

test('a woman\'s coat with four across and the automatic arrangement: the lapel covers the bottom row, which 11.2.7 does not let be shortened, so the rack is the regular rows of four and the lapel covers a portion (11.1.8)', async () => {
  for(const membership of ['cadet', 'senior']){
    const rank = membership === 'cadet' ? 'C/Capt' : 'Maj';
    for(const width of ['4-left', '4-center']){
      const auto = await P.composeUniform(buildOf('blues_a', membership, rank, 'female', 9, Object.assign({ rackArrangement: 'lapel' }, WIDTHS[width])), store);
      const plain = await P.composeUniform(buildOf('blues_a', membership, rank, 'female', 9, Object.assign({ rackArrangement: 'standard' }, WIDTHS[width])), store);
      const rowsOf = scene => rowsOfLayers(scene.layers.filter(l => l.role === 'ribbon')).map(r => r.length);
      assert.deepEqual(rowsOf(auto), [1, 4, 4], `${membership} ${width}: rows of four, not rows of three`);
      assert.deepEqual(auto.layers.filter(l => l.role === 'ribbon').map(l => [l.x, l.y]), plain.layers.filter(l => l.role === 'ribbon').map(l => [l.x, l.y]), 'the regular rack');
      assert.ok(auto.notes.some(n => /covers the bottom row.*11\.1\.8/.test(n)), 'the page says why');
    }
    // Three across still keeps the lapel clear on the same coat: that is the arrangement's own work.
    const three = await P.composeUniform(buildOf('blues_a', membership, rank, 'female', 13, Object.assign({ rackArrangement: 'lapel' }, WIDTHS['3'])), store);
    assert.deepEqual(rowsOfLayers(three.layers.filter(l => l.role === 'ribbon')).map(r => r.length), [2, 2, 3, 3, 3], 'rows shortened above the bottom one');
    assert.ok(!three.notes.some(n => /covers the bottom row/.test(n)));
  }
});

// ---- rows the member sets themselves --------------------------------------------------------------------------------------------------------------------

test('the engine draws the member\'s own rows only if they are a layout 11.2.7 allows; any other is declined with a note and the regular rows are drawn', async () => {
  const rowsOf = scene => rowsOfLayers(scene.layers.filter(l => l.role === 'ribbon')).map(r => r.length);
  const build = (counts, n = 9, extra = {}) => buildOf('blues_a', 'senior', 'Maj', 'male', n, Object.assign({ rackColumns: 4, rackArrangement: 'standard', rackCounts: counts }, extra));
  const ok = await P.composeUniform(build([4, 4, 1]), store);          // bottom row first
  assert.deepEqual(rowsOf(ok), [1, 4, 4]);
  assert.ok(!ok.notes.some(n => /rows you set/.test(n)));
  const three = await P.composeUniform(build([3, 3, 3]), store);
  assert.deepEqual(rowsOf(three), [3, 3, 3]);
  for(const counts of [[4, 3, 2], [2, 3, 4], [3, 1, 3, 2], [1, 1, 1, 1, 1, 1, 1, 1, 1], [4, 4, 4]]){
    const scene = await P.composeUniform(build(counts), store);
    const rows = rowsOf(scene);
    if(counts.reduce((a, c) => a + c, 0) !== 9) continue;       // rows that do not add up are the page's old fallback, with its own note
    assert.ok(scene.notes.some(n => /rows you set are not a layout the regulation allows.*11\.2\.7/.test(n)), `${counts}: the note`);
    assert.deepEqual(rows, [1, 4, 4], `${counts}: the regular rows of the width the build names`);
  }
});

// The page's side: the state the page hands the engine.
const { loadPageScripts } = require('./helpers/page-scripts.cjs');
const { context } = loadPageScripts();
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context));
const CHOICES = ['air_force_aerial_achievement_medal', 'silver_medal_of_valor', 'bronze_medal_of_valor', 'distinguished_service_award', 'exceptional_service_award', 'meritorious_service_award',
  'commander_commendation_award', 'cap_achievment_award', 'lifesaving_award'];
const memberWith = (rows, layout) => run(`
  State.membership = 'senior'; State.uniform = 'blues_a'; State.gender = 'male'; State.rank = 'Maj'; State.badges = []; State.garment = {}; State.hideRibbons = false; State.cadetHighestOnly = false;
  State.ribbonRackLayout = ${JSON.stringify(layout || '3')}; State.ribbonRackArrangement = 'lapel';
  State.ribbonRowOverrideEnabled = ${rows ? 'true' : 'false'}; State.ribbonRowOverride = ${JSON.stringify(rows || [])};
  normalizeRibbonSelections(); for(const id of Object.keys(State.ribbonSelections)) clearRibbonSelection(id);
  for(const id of ${JSON.stringify(CHOICES)}) setRibbonSelectionFromDropdown(id, 'earned', { deferRender: true });
  rebuildRibbonsFromGallery();
  const o = CAPUBUniformView.buildFromState().opt; return { worn: State.ribbons.length, columns: o.rackColumns, align: o.rackAlign || null, arrangement: o.rackArrangement, counts: o.rackCounts };`);

test('the page hands the engine the member\'s own rows only where they are such a layout for the ribbons worn; otherwise the width and arrangement picked', () => {
  assert.equal(memberWith(null).worn, 9);
  assert.deepEqual(memberWith([1, 4, 4]), { worn: 9, columns: 4, align: null, arrangement: 'standard', counts: [4, 4, 1] }, 'rows of four');
  assert.deepEqual(memberWith([3, 3, 3]).counts, [3, 3, 3]);
  const fallback = layout => memberWith([2, 3, 4], layout);
  assert.deepEqual(fallback('3'), { worn: 9, columns: 3, align: null, arrangement: 'lapel', counts: null }, 'a pyramid: the member\'s three across');
  assert.deepEqual(fallback('4-left'), { worn: 9, columns: 4, align: 'outboard', arrangement: 'lapel', counts: null }, 'and their four across');
  assert.equal(memberWith([4, 4, 4]).counts, null, 'rows that do not add up to the ribbons worn');
  assert.equal(memberWith([1, 1, 1, 1, 1, 1, 1, 1, 1]).counts, null);
});

// ---- a saved setup is settled once the rack is drawn --------------------------------------------------------------------------------------------------------

function settle(state, worn){
  const doc = createDocument();
  const sandbox = {
    State: Object.assign({ uniform: 'blues_a', ribbonRackLayout: '3', ribbonRackArrangement: 'lapel', ribbonRowOverrideEnabled: true, ribbonRowOverride: [], ribbons: [] }, state), document: doc, console,
    CAPUBEngine: { awards }, CAPUBUniformView: { buildFromState: () => ({ ribbons: new Array(worn) }) }, CAPUBOptionPictures: undefined,
    refreshUI(){ sandbox.refreshed = (sandbox.refreshed || 0) + 1; }, fullRender(){ sandbox.rendered = (sandbox.rendered || 0) + 1; }
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/item-pickers.js'), sandbox);
  return sandbox;
}
const snap = s => JSON.parse(JSON.stringify({ on: s.State.ribbonRowOverrideEnabled, rows: s.State.ribbonRowOverride, layout: s.State.ribbonRackLayout, arrangement: s.State.ribbonRackArrangement }));

test('a saved setup with the member\'s own rows: rows that are a layout become the width that lays them; any other are dropped and the rack is the member\'s width and arrangement', () => {
  const four = settle({ ribbonRowOverride: [1, 4, 4] }, 9);
  assert.deepEqual(snap(four), { on: false, rows: [], layout: '4-center', arrangement: 'standard' }, 'rows of four: four across, centered, the regular arrangement, the rack as it was');
  assert.equal(four.rendered, 1, 'drawn again');
  const three = settle({ ribbonRowOverride: [3, 3, 3], ribbonRackLayout: '4-left' }, 9);
  assert.deepEqual(snap(three), { on: false, rows: [], layout: '3', arrangement: 'standard' });
  const bad = settle({ ribbonRowOverride: [2, 3, 4], ribbonRackLayout: '4-left' }, 9);
  assert.deepEqual(snap(bad), { on: false, rows: [], layout: '4-left', arrangement: 'lapel' }, 'a pyramid is dropped: the width and arrangement are the member\'s');
  // Rows that do not add up to the ribbons worn are not in force; they are left as they are (the ribbons may still be on their way).
  const stale = settle({ ribbonRowOverride: [1, 4, 4] }, 8);
  assert.deepEqual(snap(stale), { on: true, rows: [1, 4, 4], layout: '3', arrangement: 'lapel' });
  assert.equal(stale.rendered, undefined);
  // Another uniform ignores the rows, so nothing is settled there.
  const other = settle({ ribbonRowOverride: [2, 3, 4], uniform: 'blues_b' }, 9);
  assert.equal(snap(other).on, true);
  // The control stays on the page (the page's own code reads it) but is not offered: the member's rows can give no layout the width does not.
  const html = read('index.html');
  assert.match(html, /<div id="ribbonRowOverridePanel" hidden>/);
  assert.match(html, /<input type="checkbox" id="ribbonRowOverrideEnabled">/);
});
