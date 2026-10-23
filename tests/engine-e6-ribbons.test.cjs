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

// D8 (FIX-ART-r1 item 9): this asserted the propeller device was the clasp's twin, a triangle carrying the blades; the aircrew propeller (39-3 Attachment 3, listed
// separately from clasps) is now the bare three-blade propeller, so the two read differently on a Find / ASAR ribbon that carries both.
test('the propeller device is the bare CAP three-blade propeller, no triangle, centred on the ribbon (39-3 21c, 21d)', async () => {
  for(const metal of ['bronze', 'silver']){
    const svg = fs.readFileSync(path.join(root, 'images', 'devices', `device-propeller-${metal}.svg`), 'utf8');
    assert.doesNotMatch(svg, /<polygon points="60,18 108,98 12,98"/, `${metal}: no triangle (that is the clasp)`);
    const blades = [...svg.matchAll(/translate\(60 71\) rotate\((\d+)\)/g)].map(m => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(blades, [0, 120, 240], `${metal}: three blades 120 degrees apart, not an empty outline`);
    const clasp = fs.readFileSync(path.join(root, 'images', 'devices', `device-clasp-${metal}.svg`), 'utf8');
    assert.notEqual(svg.replace(/<title>.*?<\/title>|<metadata>.*?<\/metadata>/g, '').replace(/data-asset-id="[^"]*"/, ''), clasp.replace(/<title>.*?<\/title>|<metadata>.*?<\/metadata>/g, '').replace(/data-asset-id="[^"]*"/, ''), `${metal}: the propeller is not the clasp's drawing`);
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

test('the CAP clasp is the triangle carrying the three-blade propeller, as on the worn clasps (39-3 6b, photo L1837)', async () => {
  for(const metal of ['bronze', 'silver']){
    const svg = fs.readFileSync(path.join(root, 'images', 'devices', `device-clasp-${metal}.svg`), 'utf8');
    assert.match(svg, /<polygon points="60,18 108,98 12,98"/, `${metal} clasp: the triangle`);
    const blades = [...svg.matchAll(/<g transform="translate\(60 71\) rotate\((\d+)\)"/g)].map(m => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(blades, [0, 120, 240], `${metal} clasp: three blades about the triangle's centre, not an outline`);
  }
  // A rack with CAP Achievement 7th Award draws clasps; the asset each layer points at carries the blades.
  const rs = ribbons([['cap_achievment_award', 'capub_total_7', '7th Award', 'cadet']]);
  const scene = await P.composeUniform(build('blues_a', 'cadet', 'C/Maj', { ribbons: rs }), store());
  const clasps = layersBy(scene, l => l.role === 'device' && /^device-clasp-/.test(l.id));
  assert.ok(clasps.length >= 1, 'the 7th award is worn as clasps');
  for(const c of clasps){
    const svg = fs.readFileSync(path.join(root, 'images', 'devices', c.id + '.svg'), 'utf8');
    assert.equal((svg.match(/rotate\((?:0|120|240)\)/g) || []).length, 3, `${c.id} has the three blades`);
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

// ---- 3b. the lapel never covers a ribbon in the automatic arrangement (11.2.7) ------------------

// 11.2.7: rows may be shortened and aligned to the wearer's left edge to prevent the service coat lapel
// from covering the ribbons. Doran's L1935 screenshot shows rows of three whose left ribbons are cut by the
// lapel (the engine used to let up to half a ribbon stand under it), not four across.
const LAPEL_GARMENT = { 'blues_a-male': 'garment-blues-class-a-coat', 'blues_a-female': 'garment-blues-class-a-coat-female', 'semi_formal_usaf-male': 'garment-semiformal-class-a-coat-male', 'semi_formal_usaf-female': 'garment-semiformal-class-a-coat-female' };
const SEL28 = ['Air_Force_Organizational_Excellence_Award', 'afa_award', 'afsa_award', 'air_force_aerial_achievement_medal', 'air_medal', 'air_search_and_rescue_ribbon', 'anti_submarine_coastal_patrol_ribbon', 'armstrong_achievement', 'bronze_medal_of_valor', 'cadet_advisory_council_ribbon', 'cadet_certificate_of_proficiency', 'cadet_recruiter_ribbon', 'cadet_special_activity_ribbon', 'cap_a_scott_crossfield_ribbon', 'cap_achievment_award', 'cap_bridgadier_general_charles_yaeger_ribbon', 'cap_cadet_orientation_pilot_ribbon', 'cap_command_service_ribbon', 'cap_counterdrug_ribbon', 'cap_gill_robb_wilson_ribbon', 'cap_grover_loening_aerospace_ribbon', 'cap_leadership_ribbon', 'cap_membership_ribbon', 'cap_paul_e_garber_ribbon', 'cap_senior_recruiter_ribbon', 'cap_world_war_2_service_ribbon', 'commander_commendation_award', 'community_service_ribbon'];

function rowCounts(tiles){
  const ys = [...new Set(tiles.map(t => t.y.toFixed(3)))].sort((a, b) => a - b);
  return ys.map(y => tiles.filter(t => t.y.toFixed(3) === y).length);
}

test('the lapel lets only a sliver of anti-aliasing stand over a ribbon, never half (11.2.7)', () => {
  assert.ok(awards.LAPEL_COVER_TOLERANCE > 0 && awards.LAPEL_COVER_TOLERANCE <= 0.03, `tolerance ${awards.LAPEL_COVER_TOLERANCE}`);
  const src = fs.readFileSync(path.join(root, 'js', 'engine', 'awards.js'), 'utf8');
  assert.match(src, /11\.2\.7[\s\S]{0,200}lapel/, 'the paragraph is cited next to the rule');
  assert.ok(!/maxCover : 0\.5/.test(src), 'the 50% default is gone');
});

test('automatic racks on the Class A coats and the semi-formal coat keep every ribbon clear of the lapel, bottom row on the welt, centred when the lapel is clear (11.2.7, Figure 11-1)', async () => {
  for(const uniform of ['blues_a', 'semi_formal_usaf']){
    for(const gender of ['male', 'female']){
      const garment = await store().load(LAPEL_GARMENT[`${uniform}-${gender}`]);
      const lapel = core.landmark(garment, 'lapel_left');
      const welt = core.anchor(garment, 'welt_top_center');
      assert.ok(lapel && lapel.points && welt, `${uniform} ${gender}: lapel polygon and welt anchor`);
      for(const n of [3, 13, 28]){
        const rs = ribbons(SEL28.slice(0, n).map(id => [id]));
        assert.equal(rs.length, n);
        for(const opt of [{}, { rackColumns: 3, rackArrangement: 'lapel' }]){
          const scene = await P.composeUniform(build(uniform, 'cadet', 'C/Maj', { gender, ribbons: rs, opt }), store());
          const tiles = layersBy(scene, l => l.role === 'ribbon');
          const label = `${uniform} ${gender} ${n} ${JSON.stringify(opt)}`;
          assert.equal(tiles.length, n, label);
          for(const t of tiles) assert.ok(awards.coverage(t, lapel.points) <= awards.LAPEL_COVER_TOLERANCE, `${label}: ${t.key} is under the lapel (${awards.coverage(t, lapel.points)})`);
          assert.ok(Math.abs(Math.max(...tiles.map(t => t.y + t.h)) - welt.y) < 1e-6, `${label}: the bottom row rests on the welt`);
          const counts = rowCounts(tiles);
          assert.ok(counts.every(c => c <= 3), `${label}: rows ${counts} within three across`);
          for(let i = 1; i < counts.length; i++) assert.ok(counts[i] >= counts[i - 1], `${label}: no row longer than the row below it (${counts})`);
          assert.equal(counts.reduce((a, c) => a + c, 0), n, label);
          // The bottom row is centred on the welt when the lapel is clear of the full rows.
          const bottom = tiles.filter(t => Math.abs(t.y + t.h - welt.y) < 1e-6);
          const centre = (Math.min(...bottom.map(t => t.x)) + Math.max(...bottom.map(t => t.x + t.w))) / 2;
          if(counts[counts.length - 1] === 3 && counts.every(c => c === 3 || c === counts[0])){
            assert.ok(Math.abs(centre - welt.x) < 1e-6, `${label}: full rows centred on the welt (${centre} vs ${welt.x})`);
          }
        }
      }
    }
  }
});

test('rows of three stay centred and untouched when the lapel is clear of them; a lapel that reaches them shortens only those rows to the wearer\'s left edge (11.2.7)', async () => {
  const garment = await store().load(LAPEL_GARMENT['blues_a-male']);
  const lapel = core.landmark(garment, 'lapel_left');
  const welt = core.anchor(garment, 'welt_top_center');
  const rs = ribbons(SEL28.slice(0, 13).map(id => [id]));
  const auto = await P.composeUniform(build('blues_a', 'cadet', 'C/Maj', { ribbons: rs, opt: { rackArrangement: 'lapel' } }), store());
  const std = await P.composeUniform(build('blues_a', 'cadet', 'C/Maj', { ribbons: rs, opt: { rackArrangement: 'standard' } }), store());
  const at = scene => layersBy(scene, l => l.role === 'ribbon').map(l => [l.key, l.x.toFixed(4), l.y.toFixed(4)].join('|')).join(';');
  assert.equal(at(auto), at(std), 'men\'s 13 ribbons: the lapel is clear, so the automatic rack is the plain rows of three, partial row on top');
  assert.deepEqual(rowCounts(layersBy(auto, l => l.role === 'ribbon')), [1, 3, 3, 3, 3]);
  const bottom = layersBy(auto, l => l.role === 'ribbon' && Math.abs(l.y + l.h - welt.y) < 1e-6);
  assert.ok(Math.abs((Math.min(...bottom.map(t => t.x)) + Math.max(...bottom.map(t => t.x + t.w))) / 2 - welt.x) < 1e-6, 'centred on the welt');

  // The women's coat: the lapel reaches the left ribbons of the upper rows, so those rows are shortened.
  const fgarment = await store().load(LAPEL_GARMENT['blues_a-female']);
  const flapel = core.landmark(fgarment, 'lapel_left');
  const fstd = await P.composeUniform(build('blues_a', 'cadet', 'C/Maj', { gender: 'female', ribbons: rs, opt: { rackArrangement: 'standard' } }), store());
  assert.ok(layersBy(fstd, l => l.role === 'ribbon').some(t => awards.coverage(t, flapel.points) > awards.LAPEL_COVER_TOLERANCE), 'the explicit standard arrangement (the member\'s choice) is left alone, lapel over the ribbons');
  const fauto = await P.composeUniform(build('blues_a', 'cadet', 'C/Maj', { gender: 'female', ribbons: rs, opt: { rackArrangement: 'lapel' } }), store());
  const counts = rowCounts(layersBy(fauto, l => l.role === 'ribbon'));
  assert.deepEqual(counts, [1, 2, 2, 2, 3, 3]);
  assert.ok(layersBy(fauto, l => l.role === 'ribbon').every(t => awards.coverage(t, flapel.points) <= awards.LAPEL_COVER_TOLERANCE));
  // Custom row counts are the member's own choice and are not shortened.
  const custom = await P.composeUniform(build('blues_a', 'cadet', 'C/Maj', { gender: 'female', ribbons: rs, opt: { rackArrangement: 'standard', rackCounts: [4, 3, 3, 3] } }), store());
  assert.deepEqual(rowCounts(layersBy(custom, l => l.role === 'ribbon')), [3, 3, 3, 4]);
  void lapel;
});

test('layoutRack: rows the lapel reaches shrink to the wearer\'s left edge; a ribbon no position keeps clear is counted, not hidden (11.2.7)', () => {
  const items = n => Array.from({ length: n }, (_, i) => ({ key: 'r' + i }));
  const slot = { perRow: 3, centerX: 8, bottomY: 0, outboardX: 10.0625, outboardSign: 1 };
  // A lapel over everything left of x = 7.5 above y = -0.4: the lower row (y -0.375..0) is clear, the rows above are not.
  const lapel = [{ x: 0, y: -50 }, { x: 7.5, y: -50 }, { x: 7.5, y: -0.4 }, { x: 0, y: -0.4 }];
  const r = awards.layoutRack(items(7), Object.assign({ lapel }, slot));
  assert.equal(r.mode, 'outboard');
  assert.equal(r.lapelBlocked, 0);
  assert.equal(r.rows.reduce((n, x) => n + x.length, 0), 7);
  assert.ok(r.placements.every(p => awards.coverage(p, lapel) <= awards.LAPEL_COVER_TOLERANCE), 'no ribbon under the lapel');
  const upper = r.placements.filter(p => p.y < -0.38);
  assert.ok(upper.every(p => p.x + p.w <= slot.outboardX + 1e-9 && p.x >= 7.5 - 1e-9), 'upper rows sit between the lapel and the wearer\'s left edge');
  // A lapel over every position leaves nothing clear: the ribbon is still shown, and reported.
  const wall = [{ x: 0, y: -50 }, { x: 99, y: -50 }, { x: 99, y: 50 }, { x: 0, y: 50 }];
  const b = awards.layoutRack(items(3), Object.assign({ lapel: wall }, slot));
  assert.ok(b.lapelBlocked > 0);
  assert.equal(b.placements.length, 3);
  // The explicit standard arrangement and custom row counts are the member's own choice.
  assert.equal(awards.layoutRack(items(7), Object.assign({ lapel, arrangement: 'standard' }, slot)).mode, 'center');
  assert.equal(awards.layoutRack(items(7), Object.assign({ lapel, countsBottomFirst: [3, 2, 2] }, slot)).mode, 'center');
});

// ---- 3c. shortened rows align with the full rows' edge; the top row centres over the row below (11.2.7) ----

// Rows grouped by y, bottom row first, each with its wearer's-left (viewer's right) edge.
function rowsOf(tiles){
  const ys = [...new Set(tiles.map(t => t.y.toFixed(4)))].sort((a, b) => b - a);
  return ys.map(y => {
    const r = tiles.filter(t => t.y.toFixed(4) === y);
    return { n: r.length, left: Math.min(...r.map(t => t.x)), right: Math.max(...r.map(t => t.x + t.w)), y: r[0].y, tiles: r };
  });
}

test('rows of three: every shortened row but the top one ends at the full rows\' wearer\'s-left edge, and the top row centres over the row below when the lapel is clear of it (11.2.7)', async () => {
  for(const uniform of ['blues_a', 'semi_formal_usaf']){
    for(const gender of ['male', 'female']){
      const garment = await store().load(LAPEL_GARMENT[`${uniform}-${gender}`]);
      const lapel = core.landmark(garment, 'lapel_left');
      for(const n of [10, 13, 16, 28]){
        const rs = ribbons(SEL28.slice(0, n).map(id => [id]));
        const scene = await P.composeUniform(build(uniform, 'cadet', 'C/Maj', { gender, ribbons: rs }), store());
        const rows = rowsOf(layersBy(scene, l => l.role === 'ribbon'));
        const label = `${uniform} ${gender} ${n}`;
        const full = rows.filter(r => r.n === 3);
        assert.ok(full.length >= 1, `${label}: at least one full row`);
        const edge = full[0].right;
        for(const r of full) assert.ok(Math.abs(r.right - edge) < 1e-6, `${label}: full rows share one wearer's-left edge`);
        rows.forEach((r, i) => {
          const isTop = i === rows.length - 1;
          if(r.n === 3 || isTop) return;
          assert.ok(Math.abs(r.right - edge) < 1e-6, `${label}: row ${i + 1} (${r.n} across) ends at ${r.right}, the full rows at ${edge}`);
        });
        const top = rows[rows.length - 1], below = rows[rows.length - 2];
        if(top.n < below.n){
          const belowCentre = (below.left + below.right) / 2;
          const centredLeft = belowCentre - top.n * 1.375 / 2;
          const clear = top.tiles.every((t, k) => awards.coverage({ x: centredLeft + k * t.w, y: t.y, w: t.w, h: t.h }, lapel.points) <= awards.LAPEL_COVER_TOLERANCE);
          if(clear) assert.ok(Math.abs((top.left + top.right) / 2 - belowCentre) < 1e-6, `${label}: the top row (${top.n}) is centred over the row below`);
          else assert.ok(Math.abs(top.right - edge) < 1e-6, `${label}: the top row cannot centre without the lapel covering it, so it aligns with the edge`);
        }
      }
    }
  }
});

test('rows of four: shortened rows align with the welt edge, the top row centres over the row below (11.2.7)', async () => {
  for(const gender of ['male', 'female']){
    const garment = await store().load(LAPEL_GARMENT[`blues_a-${gender}`]);
    const welt = core.landmarkBounds(garment, 'welt_pocket');
    const lapel = core.landmark(garment, 'lapel_left');
    for(const n of [10, 13, 28]){
      const rs = ribbons(SEL28.slice(0, n).map(id => [id]));
      const scene = await P.composeUniform(build('blues_a', 'cadet', 'C/Maj', { gender, ribbons: rs, opt: { rackColumns: 4 } }), store());
      const rows = rowsOf(layersBy(scene, l => l.role === 'ribbon'));
      const label = `blues_a ${gender} ${n} four across`;
      assert.ok(rows.every(r => r.n <= 4), label);
      rows.forEach((r, i) => {
        if(r.n === 4 || i === rows.length - 1) return;
        assert.ok(Math.abs(r.right - (welt.x + welt.w)) < 1e-6, `${label}: row ${i + 1} (${r.n} across) ends at ${r.right}, the welt edge is ${welt.x + welt.w}`);
      });
      const top = rows[rows.length - 1], below = rows[rows.length - 2];
      if(below && top.n < below.n){
        const belowCentre = (below.left + below.right) / 2;
        const clear = top.tiles.every((t, k) => awards.coverage({ x: belowCentre - top.n * 1.375 / 2 + k * t.w, y: t.y, w: t.w, h: t.h }, lapel.points) <= awards.LAPEL_COVER_TOLERANCE);
        if(clear) assert.ok(Math.abs((top.left + top.right) / 2 - belowCentre) < 1e-6, `${label}: the top row is centred`);
        else assert.ok(Math.abs(top.right - (welt.x + welt.w)) < 1e-6, `${label}: the top row aligns with the welt edge`);
      }
    }
  }
});

test('layoutRack: the shortened-row edge is the full rows\' edge, not the pocket edge, for three across; the lapel search tests the positions that are drawn (11.2.7)', () => {
  const items = n => Array.from({ length: n }, (_, i) => ({ key: 'r' + i }));
  // The welt edge (10.5) is outboard of the rack's own edge (8 + 1.5 * 1.375 = 10.0625).
  const slot = { perRow: 3, centerX: 8, bottomY: 0, outboardX: 10.5, outboardSign: 1 };
  const lapel = [{ x: 0, y: -50 }, { x: 7.5, y: -50 }, { x: 7.5, y: -0.4 }, { x: 0, y: -0.4 }];
  const r = awards.layoutRack(items(8), Object.assign({ lapel }, slot));
  assert.equal(r.mode, 'outboard');
  const rows = rowsOf(r.placements.map(p => Object.assign({}, p, { t: p })));
  const edge = 8 + 1.5 * 1.375;
  assert.ok(Math.abs(rows[0].right - edge) < 1e-9, 'the full bottom row ends at the rack\'s edge');
  for(const row of rows.slice(1, -1)) assert.ok(Math.abs(row.right - edge) < 1e-9, `a ${row.n}-across row ends at the full rows\' edge ${edge}, not at the welt edge 10.5`);
  assert.ok(r.placements.every(p => awards.coverage(p, lapel) <= awards.LAPEL_COVER_TOLERANCE));
  // Four across aligns with the welt edge.
  const r4 = awards.layoutRack(items(9), Object.assign({ lapel }, slot, { perRow: 4 }));
  const rows4 = rowsOf(r4.placements);
  for(const row of rows4.slice(1, -1)) assert.ok(Math.abs(row.right - 10.5) < 1e-9, 'four across: the welt edge');
  // Mirrored (wearer's left on the viewer's left): the same rule on the other side.
  const m = awards.layoutRack(items(8), { perRow: 3, centerX: 8, bottomY: 0, outboardX: 5.5, outboardSign: -1, lapel: [{ x: 99, y: -50 }, { x: 8.5, y: -50 }, { x: 8.5, y: -0.4 }, { x: 99, y: -0.4 }] });
  const mrows = rowsOf(m.placements);
  for(const row of mrows.slice(0, -1)) assert.ok(Math.abs(row.left - (8 - 1.5 * 1.375)) < 1e-9, 'mirrored: rows start at the full rows\' left edge');
});

test('layoutRack: the top row centres over the row below unless that puts a ribbon under the lapel, and then it aligns with the edge (11.2.7)', () => {
  const items = n => Array.from({ length: n }, (_, i) => ({ key: 'r' + i }));
  const slot = { perRow: 3, centerX: 8, bottomY: 0, outboardX: 10.0625, outboardSign: 1 };
  const H = awards.RIBBON_H;
  // A lapel over x < 6.8 above the bottom row: the bottom row of three is clear, the rows above
  // shorten to two (7.3125 onward), and the one ribbon left is the top row.
  const tall = [{ x: 0, y: -50 }, { x: 6.8, y: -50 }, { x: 6.8, y: -H - 0.02 }, { x: 0, y: -H - 0.02 }];
  const free = rowsOf(awards.layoutRack(items(6), Object.assign({ lapel: tall }, slot)).placements);
  assert.deepEqual(free.map(r => r.n), [3, 2, 1]);
  assert.ok(Math.abs((free[2].left + free[2].right) / 2 - (free[1].left + free[1].right) / 2) < 1e-9, 'centred over the row below while clear of the lapel');
  assert.ok(Math.abs(free[1].right - 10.0625) < 1e-9, 'the shortened row ends at the full row\'s edge');
  // A lapel that reaches only the centred top position over a row of three: the top ribbon moves to the edge.
  const topY = -3 * H;
  const nick = [{ x: 7.5, y: topY - 0.1 }, { x: 7.9, y: topY - 0.1 }, { x: 7.9, y: topY + 0.2 }, { x: 7.5, y: topY + 0.2 }];
  const pushed = awards.layoutRack(items(7), Object.assign({ lapel: nick }, slot));
  assert.equal(pushed.mode, 'outboard');
  assert.ok(pushed.placements.every(p => awards.coverage(p, nick) <= awards.LAPEL_COVER_TOLERANCE));
  const pr = rowsOf(pushed.placements);
  assert.deepEqual(pr.map(r => r.n), [3, 3, 1]);
  assert.ok(Math.abs(pr[2].right - 10.0625) < 1e-9, 'the top row aligns with the edge when centring would be covered');
  assert.ok(Math.abs(pr[1].left - pr[0].left) < 1e-9, 'the full rows stay centred');
  // The same rack with no lapel in the way keeps the top ribbon centred.
  const clear = rowsOf(awards.layoutRack(items(7), Object.assign({ lapel: [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 1, y: 6 }] }, slot)).placements);
  assert.ok(Math.abs((clear[2].left + clear[2].right) / 2 - 8) < 1e-9);
});

// ---- 4. miniature medals ----------------------------------------------------------------------

// Twelve awards that each have a CAP medal (community service, special activity and the other ribbon-only
// awards are not worn as miniatures, 11.2.8).
const MEDAL_IDS = ['cap_achievment_award', 'encampment_ribbon', 'red_service_ribbon', 'search_find_ribbon', 'cap_membership_ribbon', 'unit_citation_award', 'cap_leadership_ribbon', 'crisis_ribbon', 'meritorious_service_award', 'lifesaving_award', 'iace_ribbon', 'national_cadet_competition_ribbon'];
const hasAsset = id => manifest.assets.some(a => a.id === id);
const medalAssetOf = id => 'medal-' + id.replace(/_/g, '-') + '-miniature';

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
    // Each upper row hangs over the ribbon of the row below it, one medal body and a short band of ribbon apart (0.05 in, 0.5 in where a lower row carries a device) (Doran's photo L1837,
    // Ethan: 'spaced way too far apart'; 11.2.8 says about half of the ribbon, the old pitch of 1.65 in).
    const drapeH = drapes[0].h;
    let hang = 0;
    for(const l of layersBy(scene, l => l.role === 'mini-medal')){ const s = await store().load(l.id); const at = core.anchor(s, 'ribbon_attach') || { x: 0, y: 0 }; hang = Math.max(hang, s.h - at.y); }
    const lowerDev = layersBy(scene, l => l.role === 'device' && /^mini:/.test(l.key)).some(d => drapes.find(x => d.key.startsWith(x.key + ':') && x.y.toFixed(3) !== rowsY[0]));
    for(let i = 1; i < rowsY.length; i++){
      const pitch = Number(rowsY[i]) - Number(rowsY[i - 1]);
      assert.ok(Math.abs(pitch - (hang + (lowerDev ? 0.5 : 0.05))) < 0.02, `row pitch ${pitch.toFixed(3)} is a body (${hang.toFixed(3)}) and a band of ribbon`);
      assert.ok(pitch < drapeH * 0.75, 'the upper row hangs over the ribbon below it');
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
    // The men's rack ends at the pocket's top edge instead of 1/2 in over the crest, which is over the welt (FIX-R-OTHER-r1 #4, D8).
    const pocketTop = gender === 'male' ? spec.anchors.pocket_top_center[1] / 100 : Infinity;
    assert.ok(Math.abs(Math.min(crestTop - 0.5, pocketTop) - bottom) < 0.12, `${gender}: lowest medals end ${(crestTop - bottom).toFixed(2)} in above the crest`);
    const ribbonsOnCoat = layersBy(scene, l => l.role === 'ribbon');
    assert.equal(ribbonsOnCoat.length, 0, 'miniatures replace the ribbon rack');
  }
});

test('every miniature drape on the mess dress and the semi-formal coat hangs a medal; ribbon-only awards are dropped with a note (39-1 11.2.8, Table 11-1)', async () => {
  for(const id of MEDAL_IDS) assert.ok(hasAsset(medalAssetOf(id)), `${id} has a miniature medal`);
  const ribbonOnly = ['community_service_ribbon', 'cadet_special_activity_ribbon'];
  for(const id of ribbonOnly) assert.ok(!hasAsset(medalAssetOf(id)), `${id} has no medal`);
  const medals = medalsOf(ribbons([...MEDAL_IDS.map(id => [id]), ...ribbonOnly.map(id => [id])]));
  assert.equal(medals.length, 14);
  for(const u of ['mess_dress', 'semi_formal']){
    for(const gender of ['male', 'female']){
      const scene = await P.composeUniform(build(u, 'senior', 'Capt', { gender, medals }), store());
      const drapes = layersBy(scene, l => l.role === 'mini-drape');
      const bodies = layersBy(scene, l => l.role === 'mini-medal');
      assert.equal(drapes.length, 12, `${u} ${gender}: only the medal-bearing awards hang`);
      assert.equal(bodies.length, drapes.length, `${u} ${gender}: a medal on every drape`);
      for(const d of drapes) assert.ok(bodies.some(b => b.key === d.key + ':medal'), `${u} ${gender}: drape ${d.key} has its medal`);
      for(const id of ribbonOnly){
        assert.ok(!drapes.some(d => d.key === `mini:${id}`), `${id}: no empty drape`);
        assert.ok(scene.notes.some(n => n.includes('ribbon-only award, not worn as a miniature medal') && n.includes(id)), `${id}: noted`);
      }
    }
  }
});
