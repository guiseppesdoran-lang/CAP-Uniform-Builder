'use strict';
// E6 ribbons: devices (the CAP tri-blade propeller, the cadet stars and honor credit), the rack's
// row width, and the miniature medals on the mess dress and the corporate semi-formal.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const awards = require('../js/engine/awards.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const rules = require('../data/uniform-rules.js');
const RA = require('../data/ribbon-awards.js');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = () => core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const layersBy = (scene, pred) => scene.layers.filter(pred);

function ribbons(sel){
  return sel.flatMap(([id, awardValue, awardLabel, membership]) => RA.resolve(id, { awardValue, awardLabel, membership }).map((r, i) => ({
    key: `ribbon:${id}${i ? '#' + i : ''}`, id, title: id, asset: 'ribbon-' + id.replace(/_/g, '-'), devices: r.devices, centered: r.centered
  })));
}
function medalsOf(rs){
  return rs.filter(r => !r.key.includes('#')).map(r => ({ key: r.key.replace('ribbon:', 'mini:'), title: r.title, ribbonAsset: r.asset, medal: 'medal-' + r.asset.slice(7) + '-miniature', devices: r.devices, centered: r.centered }));
}
function build(uniform, membership, rank, extra){
  const b = Object.assign({
    uniform, gender: 'male', membership, grade: G.gradeInfo(membership, rank, {}),
    opt: { headgear: 'auto' }, name: { first: 'Pat', last: 'Doe', show: true },
    ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
  if(extra && extra.opt) b.opt = Object.assign({ headgear: 'auto' }, extra.opt);
  return b;
}

// ---- 1. the triangular devices carry the CAP tri-blade -----------------------------------------

test('the propeller device is the CAP three-blade propeller in a triangle, centred on the ribbon (39-3 21c, 21d)', async () => {
  for(const metal of ['bronze', 'silver']){
    const svg = fs.readFileSync(path.join(root, 'images', 'devices', `device-propeller-${metal}.svg`), 'utf8');
    assert.match(svg, /<polygon points="60,18 108,98 12,98"/, `${metal}: the triangle`);
    const blades = [...svg.matchAll(/rotate\((\d+)\)/g)].map(m => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(blades, [0, 120, 240], `${metal}: three blades 120 degrees apart, not an empty outline`);
  }
  const rs = ribbons([['air_search_and_rescue_ribbon', 'mcchord_36800', '20 Sorties (Aircrew)'], ['search_find_ribbon', 'mcchord_24500', '2nd w/Prop']]);
  const scene = await P.composeUniform(build('blues_a', 'senior', 'Capt', { ribbons: rs }), store());
  const props = layersBy(scene, l => l.id === 'device-propeller-bronze');
  assert.equal(props.length, 2, 'a propeller on each aircrew ribbon');
  for(const p of props){
    const tile = layersBy(scene, l => l.role === 'ribbon' && p.key.startsWith(l.key + ':'))[0];
    assert.ok(Math.abs(p.x + p.w / 2 - (tile.x + tile.w / 2)) < 0.001, 'propeller centred on the ribbon');
  }
});

// ---- 2. cadet stars: COS on the Mitchell only, honor credit, and the picker's words ------------

// The picker's option lists live in js/galleries.js, a page script; run the two pieces it needs.
function pickerOptions(membership){
  const src = fs.readFileSync(path.join(root, 'js', 'galleries.js'), 'utf8');
  const a = src.indexOf('function ribbonSelectOnlyOptions');
  const b = src.indexOf('\nfunction ', a + 10);
  const c = src.indexOf('const CAPUB_COS_STAR_RIBBONS');
  const d = src.indexOf('\nfunction getRibbonAwardOptions');
  const sandbox = { State: { membership } };
  vm.runInNewContext(src.slice(a, b) + '\n' + src.slice(c, d) + '\nthis.override = capubRibbonOptionOverride;', sandbox);
  return id => sandbox.override(id);
}
const values = opts => (opts || []).map(o => o.value).filter(Boolean);

test('the COS star is offered on the Mitchell ribbon for cadets and nowhere else (39-3 14j)', () => {
  const cadet = pickerOptions('cadet');
  assert.ok(values(cadet('mitchell_award')).includes('earned_cos_star'));
  for(const id of ['eaker_award', 'earhart_award', 'spaatz_award', 'cadet_certificate_of_proficiency', 'frank_borman_falcon_award', 'armstrong_achievement', 'curry_achievement', 'wright_brothers_award']){
    assert.ok(!values(cadet(id)).includes('earned_cos_star'), `${id}: no COS star for a cadet`);
  }
  const senior = pickerOptions('senior');
  assert.ok(values(senior('mitchell_award')).includes('earned_cos_star'));
  assert.ok(values(senior('eaker_award')).includes('earned_cos_star'), 'a senior may move the star to the highest cadet ribbon');
});

test('honor credit is offered on cadet achievements 1-8 and draws a silver star', () => {
  const cadet = pickerOptions('cadet');
  for(const id of ['curry_achievement', 'hap_arnold_achievement', 'mary_feik_achievement', 'rickenbacker_achievement', 'lindbergh_achievement', 'doolittle_achievement', 'goddard_achievement', 'armstrong_achievement']){
    assert.ok(values(cadet(id)).includes('honor_credit'), `${id} offers honor credit`);
    assert.deepEqual(RA.resolve(id, { awardValue: 'honor_credit', membership: 'cadet' })[0].devices, ['device-star-silver'], id);
    assert.deepEqual(RA.resolve(id, { awardValue: 'earned', membership: 'cadet' })[0].devices, [], `${id} earned: no device`);
  }
  assert.ok(!values(cadet('wright_brothers_award')).includes('honor_credit'), 'the Wright Brothers Award has no honor credit');
  assert.ok(!values(cadet('mitchell_award')).includes('honor_credit'));
  // Goddard: honor credit and the Model Rocketry Badge are two stars (14h).
  assert.deepEqual(RA.resolve('goddard_achievement', { awardValue: 'honor_credit_and_rocketry' })[0].devices, ['device-star-silver', 'device-star-silver']);
  assert.deepEqual(RA.resolve('goddard_achievement', { awardValue: 'rocketry_star' })[0].devices, ['device-star-silver']);
});

test('every star the regulation gives a ribbon is offered and resolves to that star (39-3 9f, 9h, 14h, 14j, 20b-20d, 21a, 21j)', () => {
  const dev = (id, value, label, membership) => RA.resolve(id, { awardValue: value, awardLabel: label, membership }).flatMap(r => r.devices);
  assert.deepEqual(dev('commander_commendation_award', 'mcchord_46101', 'Basic Award (Region Cmdr)'), ['device-star-bronze']);
  assert.deepEqual(dev('commander_commendation_award', 'mcchord_42001', 'Basic Award (National Cmdr)'), ['device-star-silver']);
  assert.deepEqual(dev('lifesaving_award', 'mcchord_28001', 'Basic with Star'), ['device-star-silver']);
  assert.deepEqual(dev('national_cadet_competition_ribbon', 'mcchord_30700', 'S-B Stars'), ['device-star-silver', 'device-star-bronze']);
  assert.deepEqual(dev('national_color_guard_competition_ribbon', 'mcchord_31300', 'Bronze Star'), ['device-star-bronze']);
  assert.deepEqual(dev('cadet_advisory_council_ribbon', 'cac_national', 'National level (gold star)'), ['device-star-gold']);
  assert.deepEqual(dev('cadet_special_activity_ribbon', 'mcchord_32300', '2nd Award'), ['device-star-bronze'], 'a bronze star per further activity');
});

test('the picker names what each device stands for', () => {
  const say = (id, value, label, membership) => RA.describe(id, { awardValue: value, awardLabel: label, membership });
  assert.equal(say('mitchell_award', 'earned_cos_star', '', 'cadet'), 'Devices: silver star (Cadet Officer School)');
  assert.equal(say('mitchell_award', 'earned', '', 'cadet'), 'Basic ribbon, no devices');
  assert.equal(say('curry_achievement', 'honor_credit', '', 'cadet'), 'Devices: silver star (honor credit)');
  assert.equal(say('goddard_achievement', 'honor_credit_and_rocketry', '', 'cadet'), 'Devices: silver star (honor credit), silver star (Model Rocketry Badge)');
  assert.equal(say('cadet_advisory_council_ribbon', 'cac_region', '', 'cadet'), 'Devices: silver star (region level)');
  assert.match(say('air_search_and_rescue_ribbon', 'mcchord_36800', '20 Sorties (Aircrew)'), /propeller \(aircrew\)/);
  assert.match(say('lifesaving_award', 'mcchord_28001', 'Basic with Star'), /silver star \(lifesaving other than blood or organ transport\)/);
  assert.equal(say('cap_achievment_award', 'capub_total_12', '12th Award'), 'Devices: 2 silver clasps, bronze clasp');
  assert.match(fs.readFileSync(path.join(root, 'js', 'galleries.js'), 'utf8'), /CAPUBRibbonAwards\.describe\(id/, 'the tile uses it');
});

test('a Class A rack with the COS star, the rocketry star and aircrew propellers draws every device', async () => {
  const rs = ribbons([
    ['mitchell_award', 'earned_cos_star', '', 'cadet'], ['goddard_achievement', 'rocketry_star', '', 'cadet'],
    ['air_search_and_rescue_ribbon', 'mcchord_36800', '20 Sorties (Aircrew)', 'cadet'], ['search_find_ribbon', 'mcchord_24500', '2nd w/Prop', 'cadet'],
    ['cap_achievment_award', 'capub_total_7', '7th Award', 'cadet'], ['national_cadet_competition_ribbon', 'mcchord_30700', 'S-B Stars', 'cadet'],
    ['cadet_advisory_council_ribbon', 'cac_region', '', 'cadet'], ['cadet_special_activity_ribbon', 'mcchord_32400', '3rd Award', 'cadet'],
    ['community_service_ribbon'], ['encampment_ribbon']
  ]);
  const scene = await P.composeUniform(build('blues_a', 'cadet', 'C/Maj', { ribbons: rs, opt: { rackColumns: 3, rackArrangement: 'lapel' } }), store());
  const wanted = rs.reduce((n, r) => n + r.devices.length, 0);
  assert.equal(layersBy(scene, l => l.role === 'device').length, wanted);
  assert.deepEqual(scene.notes.filter(n => /No (artwork|ribbon)/.test(n)), []);
  assert.equal(layersBy(scene, l => l.key === 'ribbon:mitchell_award:device:0').length, 1);
});

// ---- 3. rack width: rows of three, four only where 11.2.7 allows -------------------------------

const RACK_IDS = ['cap_achievment_award', 'encampment_ribbon', 'red_service_ribbon', 'search_find_ribbon', 'cap_membership_ribbon', 'unit_citation_award', 'cap_leadership_ribbon', 'crisis_ribbon', 'community_service_ribbon', 'cadet_special_activity_ribbon', 'meritorious_service_award', 'lifesaving_award', 'iace_ribbon'];

test('the rack defaults to rows of three (11.2.7)', () => {
  assert.match(fs.readFileSync(path.join(root, 'js', 'state.js'), 'utf8'), /ribbonRackLayout:'3'/);
});

test('four across is offered only on the coats 11.2.7 names; Class B and the aviator shirt are three across', () => {
  assert.deepEqual(['blues_a', 'semi_formal_usaf'].filter(u => rules.allowsRackColumns(u, 4)), ['blues_a', 'semi_formal_usaf']);
  for(const u of Object.keys(rules.RULES).filter(u => !['blues_a', 'semi_formal_usaf'].includes(u))) assert.ok(!rules.allowsRackColumns(u, 4), `${u} allows no four-across rack`);
  const view = fs.readFileSync(path.join(root, 'js', 'uniform-view.js'), 'utf8');
  assert.match(view, /allowsRackColumns\(State\.uniform, 4\) \? String\(State\.ribbonRackLayout/, 'a saved four-across layout does not reach other uniforms');
});

test('every ribbon uniform lays the rack in rows of three, partial row on top, no gap between rows', async () => {
  for(const u of ['blues_a', 'blues_b', 'semi_formal_usaf', 'aviator']){
    const membership = u === 'semi_formal_usaf' ? 'cadet' : 'senior';
    const rank = membership === 'cadet' ? 'C/Capt' : 'Capt';
    for(const gender of ['male', 'female']){
      for(const n of [1, 2, 3, 4, 5, 7, 10, 13]){
        const rs = ribbons(RACK_IDS.slice(0, n).map(id => [id]));
        // The page asks for three; even a stray four-across option must not widen Class B or the aviator shirt.
        for(const cols of [3, 4]){
          const scene = await P.composeUniform(build(u, membership, rank, { gender, ribbons: rs, opt: { rackColumns: cols, rackArrangement: 'lapel' } }), store());
          const tiles = layersBy(scene, l => l.role === 'ribbon');
          assert.equal(tiles.length, rs.length, `${u} ${gender} ${n}`);
          const max = cols === 4 && rules.allowsRackColumns(u, 4) ? 4 : 3;
          const ys = [...new Set(tiles.map(t => t.y.toFixed(3)))].sort((a, b) => a - b);
          const counts = ys.map(y => tiles.filter(t => t.y.toFixed(3) === y).length);
          assert.ok(counts.every(c => c <= max), `${u} ${gender} ${n} (${cols}): rows ${counts} within ${max} across`);
          for(let i = 1; i < ys.length; i++) assert.ok(Math.abs(ys[i] - ys[i - 1] - 0.375) < 0.002, `${u} ${n}: no space between rows (11.3.3)`);
          if(max === 3 && n >= 3) assert.equal(counts[counts.length - 1], 3, `${u} ${n}: the bottom row is full`);
          const width = Math.max(...tiles.map(t => t.x + t.w)) - Math.min(...tiles.map(t => t.x));
          assert.ok(width <= max * 1.375 + 0.001, `${u} ${gender} ${n}: the rack is at most ${max} ribbons wide`);
        }
      }
    }
  }
});

// ---- 4. miniature medals ----------------------------------------------------------------------

const MEDAL_IDS = RACK_IDS.slice(0, 12);

test('mess dress miniatures: 11/16 in drapes, one medal per award, centred on the midpoint, four to a row with the upper rows over the drapes (11.2.8, 4.1.1.1.2.2)', async () => {
  // Awards with extra ribbons for their devices still wear one medal each (11.4.2).
  const rs = ribbons([['cap_achievment_award', 'capub_total_19', '19th Award'], ...MEDAL_IDS.slice(1).map(id => [id])]);
  assert.ok(rs.length > MEDAL_IDS.length, 'a clasp-heavy award makes a second ribbon');
  const medals = medalsOf(rs);
  assert.equal(medals.length, MEDAL_IDS.length, 'one medal per award');
  for(const gender of ['male', 'female']){
    const scene = await P.composeUniform(build('mess_dress', 'senior', 'Capt', { gender, medals }), store());
    const drapes = layersBy(scene, l => l.role === 'mini-drape');
    assert.equal(drapes.length, 12);
    assert.ok(drapes.every(d => Math.abs(d.w - 11 / 16) < 1e-9), 'miniature ribbons are 11/16 in wide (11.3)');
    const rowsY = [...new Set(drapes.map(d => d.y.toFixed(3)))].sort((a, b) => a - b);
    assert.equal(rowsY.length, 3);
    assert.deepEqual(rowsY.map(y => drapes.filter(d => d.y.toFixed(3) === y).length), [4, 4, 4], 'rows of four');
    const xs = [...new Set(drapes.map(d => d.x.toFixed(3)))];
    assert.equal(xs.length, 4, 'four columns, each row over the one below');
    // Each upper row hangs over half of the ribbon part of the row below it.
    const drapeH = drapes[0].h;
    const bodyH = Math.max(...layersBy(scene, l => l.role === 'mini-medal').map(l => l.h));
    for(let i = 1; i < rowsY.length; i++){
      assert.ok(Math.abs((Number(rowsY[i - 1]) + drapeH + bodyH) - (Number(rowsY[i]) + drapeH / 2)) < 0.02, 'the upper row ends halfway down the ribbon of the row below');
    }
    // Centred midway between the shoulder seam and the top button.
    const spec = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', `garment-mess-dress-${gender}.spec.json`), 'utf8'));
    const cy = spec.anchors.miniature_medals_center[1] / 100;
    const minis = layersBy(scene, l => l.role === 'mini-drape' || l.role === 'mini-medal');
    const mid = (Math.min(...minis.map(l => l.y)) + Math.max(...minis.map(l => l.y + l.h))) / 2;
    assert.ok(Math.abs(mid - cy) < 0.15, `${gender}: group centre ${mid.toFixed(2)} at ${cy}`);
  }
});

test('more than four in a row overlap equally toward the wearer\'s left, never past half, the medal at the lapel fully exposed (11.2.8)', async () => {
  const medals = medalsOf(ribbons(MEDAL_IDS.map(id => [id])));
  const scene = await P.composeUniform(build('mess_dress', 'senior', 'Capt', { medals, opt: { miniStyle: 'holding' } }), store());
  const drapes = layersBy(scene, l => l.role === 'mini-drape');
  const top = drapes.filter(d => d.y === Math.min(...drapes.map(x => x.y))).sort((a, b) => a.x - b.x);
  assert.ok(top.length > 4);
  const steps = top.slice(1).map((d, i) => d.x - top[i].x);
  assert.ok(steps.every(s => Math.abs(s - steps[0]) < 1e-6), 'equal overlap');
  assert.ok(steps[0] >= 11 / 32 - 1e-6 && steps[0] <= 11 / 16 + 1e-6, 'overlap is more than none only when needed and never above 50%');
  const lapelSide = Math.max(...top.map(d => d.z));
  assert.equal(top[0].z, lapelSide, 'the medal nearest the lapel (viewer\'s left on the wearer\'s left breast) draws on top');
});

test('semi-formal miniatures end 1/2 inch above the crest, 11/16 in ribbons, one per award (4.2.2.4, ICL 25-02)', async () => {
  const rs = ribbons([['cap_achievment_award', 'capub_total_12', '12th Award'], ...MEDAL_IDS.slice(1, 6).map(id => [id])]);
  const medals = medalsOf(rs);
  assert.equal(medals.length, 6);
  for(const gender of ['male', 'female']){
    const scene = await P.composeUniform(build('semi_formal', 'senior', 'Capt', { gender, medals }), store());
    const drapes = layersBy(scene, l => l.role === 'mini-drape');
    assert.equal(drapes.length, 6);
    assert.ok(drapes.every(d => Math.abs(d.w - 11 / 16) < 1e-9));
    const bodies = layersBy(scene, l => l.role === 'mini-medal');
    const bottom = Math.max(...bodies.map(l => l.y + l.h));
    const spec = JSON.parse(fs.readFileSync(path.join(root, 'images', 'garments', `garment-corporate-service-dress-blazer-${gender}.spec.json`), 'utf8'));
    const crestTop = spec.anchors.crest_top_center[1] / 100;
    assert.ok(Math.abs(crestTop - bottom - 0.5) < 0.12, `${gender}: lowest medals end ${(crestTop - bottom).toFixed(2)} in above the crest`);
    const ribbonsOnCoat = layersBy(scene, l => l.role === 'ribbon');
    assert.equal(ribbonsOnCoat.length, 0, 'miniatures replace the ribbon rack');
  }
});
