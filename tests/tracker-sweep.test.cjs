'use strict';
// Tracker sweep (E11): the rules and picker items of the audit tracker that live in the page's scripts
// and data. The page's classic scripts are loaded into one vm context behind a permissive DOM stub, as
// tests/member-report-rules.test.cjs does, so the real functions run.
//   Ribbons (CAPR 39-3): the National Commander's Citation and the Gill Robb Wilson Award share one place
//   (Attachment 2, Note 2); the Crisis Service Ribbon, the IACE and the annual cadet awards take the bronze
//   clasp for later awards (6b); the cadet recruiter ribbon counts recruits (21k(1)); the AAF Air Medal and
//   the Aerial Achievement Medal are federal awards, the AFOEA sits below them and above the CAP ribbons.
//   Badges and cords (CAPR 39-1): National Staff is not authorized on the corporate blazer and the semi-formal
//   (Attachment 4); the Aide de Camp cord is worn by senior members as well (9.3.4).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const RA = require('../data/ribbon-awards.js');
const rules = require('../data/uniform-rules.js');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

function loadPage(){
  const html = read('index.html');
  const sources = [...html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)].map(m => m[1]).filter(src => !/^https?:/.test(src));
  const element = () => new Proxy(function(){}, {
    get(_t, key){
      if(key === 'style' || key === 'dataset' || key === 'classList') return new Proxy({}, { get: () => () => {}, set: () => true });
      if(key === 'children' || key === 'childNodes') return [];
      if(key === 'length') return 0;
      if(['value', 'innerHTML', 'textContent', 'id', 'className'].includes(key) || key === Symbol.toPrimitive) return key === Symbol.toPrimitive ? () => '' : '';
      return element();
    },
    set: () => true,
    apply: () => element()
  });
  const document = new Proxy({}, { get: (_t, key) => (key === 'querySelectorAll' || key === 'getElementsByClassName') ? () => [] : element() });
  const noop = () => {};
  const storage = { getItem: () => null, setItem: noop, removeItem: noop };
  const context = {
    document, navigator: { userAgent: '' }, location: { href: '', search: '', hash: '' }, localStorage: storage, sessionStorage: storage,
    console: { log: noop, warn: noop, error: noop, info: noop }, setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, addEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }), requestAnimationFrame: () => 0,
    fetch: () => Promise.reject(new Error('offline')), URL, URLSearchParams, Image: function(){}, CustomEvent: function(){}, Event: function(){},
    MutationObserver: function(){ this.observe = noop }, ResizeObserver: function(){ this.observe = noop }
  };
  context.window = context; context.self = context; context.globalThis = context;
  vm.createContext(context);
  // The scripts that bootstrap the DOM throw under the stub; the functions the tests call are defined by then.
  for(const src of sources){
    try{ vm.runInContext(read(src), context, { filename: src }); }
    catch(error){ /* see above */ }
  }
  return code => vm.runInContext(code, context);
}
const ev = loadPage();

// ---- shared ribbon slot ------------------------------------------------------------------------------

test('the National Commander\'s Citation and the Gill Robb Wilson Award share one slot: choosing one clears the other (39-3 Attachment 2, Note 2)', () => {
  ev("State.membership = 'senior'; State.uniform = 'blues_a'; State.ribbonSelections = {}; normalizeRibbonSelections();");
  ev("setRibbonSelectionFromDropdown('national_commanders_citation', 'earned', {deferRender:true})");
  assert.equal(ev("State.ribbonSelections.national_commanders_citation.checked"), true);
  const grw = ev("getRibbonAwardOptions('cap_gill_robb_wilson_ribbon').find(o => o.value).value");
  ev(`setRibbonSelectionFromDropdown('cap_gill_robb_wilson_ribbon', ${JSON.stringify(grw)}, {deferRender:true})`);
  assert.equal(ev("State.ribbonSelections.cap_gill_robb_wilson_ribbon.checked"), true);
  assert.equal(ev("State.ribbonSelections.national_commanders_citation.checked"), false, 'the Citation is cleared');
  assert.equal(ev("State.ribbonSelections.national_commanders_citation.awardValue"), '');
  ev("setRibbonSelectionFromDropdown('national_commanders_citation', 'earned', {deferRender:true})");
  assert.equal(ev("State.ribbonSelections.cap_gill_robb_wilson_ribbon.checked"), false, 'and the other way round');
});

test('a saved setup that lists both wears one: the higher in the order of precedence', () => {
  ev("State.membership = 'senior'; State.uniform = 'blues_a'; State.ribbonSelections = {}; normalizeRibbonSelections();");
  const grw = ev("getRibbonAwardOptions('cap_gill_robb_wilson_ribbon').find(o => o.value).value");
  ev(`State.ribbonSelections.cap_gill_robb_wilson_ribbon = { checked:true, devices:{}, awardValue:${JSON.stringify(grw)}, awardLabel:'x' };
      State.ribbonSelections.national_commanders_citation = { checked:true, devices:{}, awardValue:'earned', awardLabel:'Earned' };
      rebuildRibbonsFromGallery();`);
  const worn = Array.from(ev("State.ribbons.map(r => r.id)"));
  assert.deepEqual(worn.filter(id => id === 'national_commanders_citation' || id === 'cap_gill_robb_wilson_ribbon'), ['national_commanders_citation']);
});

// ---- order of the federal awards -------------------------------------------------------------------------

test('order: federal awards (AAF Air Medal, then the Aerial Achievement Medal), the AFOEA, then the CAP ribbons (39-1 11.2.1, ICL 18-02)', () => {
  const order = Array.from(ev("sortRibbons([{id:'cap_achievment_award'},{id:'Air_Force_Organizational_Excellence_Award'},{id:'air_force_aerial_achievement_medal'},{id:'air_medal'},{id:'meritorious_service_award'}]).map(r => r.id)"));
  assert.deepEqual(order, ['air_medal', 'air_force_aerial_achievement_medal', 'Air_Force_Organizational_Excellence_Award', 'meritorious_service_award', 'cap_achievment_award']);
});

// The Air Medal and the Aerial Achievement Medal of the CAP list are federal awards: among the military-catalog ribbons they stand where the military order puts the same award, not
// behind every one of them (39-1 11.2.1: federal awards first). The Air Medal follows the Legion of Merit, the Distinguished Flying Cross and the Bronze Star and comes before
// the commendation medals; the Aerial Achievement Medal follows it, before the commendation and achievement medals.
test('order: the CAP list\'s Air Medal and Aerial Achievement Medal take their place among the military ribbons, not behind them all (39-1 11.2.1)', () => {
  const sort = ids => Array.from(ev(`sortRibbons(${JSON.stringify(ids.map(id => ({ id })))}).map(r => r.id)`));
  const mil = id => 'military:' + id;
  const expected = [mil('legion_of_merit'), mil('bronze_star_medal'), 'air_medal', 'air_force_aerial_achievement_medal', mil('air_and_space_commendation_medal'), mil('army_achievement'), 'Air_Force_Organizational_Excellence_Award', 'meritorious_service_award', 'cap_achievment_award'];
  for(const id of expected) if(id.startsWith('military:')) assert.ok(ev(`getMilitaryRibbonAward(${JSON.stringify(id)})`), id + ' is in the military catalog');
  // Every starting order gives the same line.
  const rotate = (list, n) => list.slice(n).concat(list.slice(0, n));
  for(let n = 0; n < expected.length; n++) assert.deepEqual(sort(rotate(expected, n)), expected, 'rotated by ' + n);
  assert.deepEqual(sort([...expected].reverse()), expected, 'reversed');
  // An Air Force Commendation Medal no longer comes ahead of the Air Medal; the two stand where the catalog's own Air Medal does.
  assert.deepEqual(sort([mil('air_and_space_commendation_medal'), 'air_medal']), ['air_medal', mil('air_and_space_commendation_medal')]);
  assert.deepEqual(sort([mil('air_and_space_commendation_medal'), 'air_force_aerial_achievement_medal']), ['air_force_aerial_achievement_medal', mil('air_and_space_commendation_medal')]);
  assert.deepEqual(sort([mil('joint_service_commendation'), mil('air_medal'), 'air_medal']), [mil('air_medal'), 'air_medal', mil('joint_service_commendation')], 'level with the catalog\'s own Air Medal, the military ribbon first');
  assert.deepEqual(sort([mil('meritorious_service'), 'air_medal']), [mil('meritorious_service'), 'air_medal'], 'a decoration above the Air Medal stays above it');
});

test('order: the military ribbons keep their own order and every military ribbon still comes before the AFOEA and the CAP ribbons (nothing else moves)', () => {
  const sort = ids => Array.from(ev(`sortRibbons(${JSON.stringify(ids.map(id => ({ id })))}).map(r => r.id)`));
  const ids = ev('getMilitaryRibbonIds()').slice(0, 60);
  assert.ok(ids.length > 40);
  const shuffled = [...ids].reverse();
  assert.deepEqual(sort(shuffled), sort(ids), 'the military ribbons alone sort the same from any start');
  const withCap = sort([...shuffled, 'cap_achievment_award', 'Air_Force_Organizational_Excellence_Award', 'meritorious_service_award']);
  assert.deepEqual(withCap.slice(0, ids.length), sort(ids));
  assert.deepEqual(withCap.slice(ids.length), ['Air_Force_Organizational_Excellence_Award', 'meritorious_service_award', 'cap_achievment_award']);
  // The two CAP-list federal ribbons keep their order to each other, and the CAP ribbons keep theirs.
  assert.deepEqual(sort(['air_force_aerial_achievement_medal', 'air_medal']), ['air_medal', 'air_force_aerial_achievement_medal']);
});

// ---- ribbons repeated by the bronze clasp -----------------------------------------------------------------------

test('the IACE ribbon takes a bronze clasp for each later award, a silver clasp for five (39-3 6b)', () => {
  ev("State.membership = 'cadet'");
  const options = ev("getRibbonAwardOptions('iace_ribbon').filter(o => o.value)");
  assert.ok(options.length > 5, 'more than one choice');
  const devices = n => RA.resolve('iace_ribbon', { awardValue: options[n - 1].value, awardLabel: options[n - 1].label })[0].devices;
  assert.deepEqual(devices(1), []);
  assert.deepEqual(devices(2), ['device-clasp-bronze']);
  assert.deepEqual(devices(6), ['device-clasp-silver']);
  assert.deepEqual(devices(7), ['device-clasp-silver', 'device-clasp-bronze']);
});

// 39-3 6b: "Subsequent awards of the same decoration or ribbon are denoted by the CAP bronze triangular clasp, worn on the ribbon of the original award." The Silver Medal of Valor
// is a decoration like the Bronze: its second award is one bronze clasp, its third two, on the one ribbon. It was drawn as a ribbon for each award.
test('the Silver Medal of Valor repeats by the bronze clasp on one ribbon, as the Bronze Medal of Valor does (39-3 6b)', () => {
  assert.equal(RA.FAMILIES.silver_medal_of_valor.devices, 'clasps');
  assert.deepEqual(RA.FAMILIES.silver_medal_of_valor, RA.FAMILIES.bronze_medal_of_valor);
  assert.ok(!Object.values(RA.FAMILIES).some(f => f.devices === 'separate'), 'no award is drawn as a separate ribbon for each award');
  assert.equal(ev("typeof getRibbonDuplicateCountForSelection"), 'undefined', 'the page has no separate-ribbon count');
  ev("State.membership = 'cadet'");
  const parts = id => Array.from(ev(`getRibbonAwardOptions('${id}').filter(o => o.value).map(o => ({ value: o.value, label: o.label }))`))
    .map(o => RA.resolve(id, { awardValue: o.value, awardLabel: o.label }).map(p => p.devices));
  const silver = parts('silver_medal_of_valor');
  assert.deepEqual(silver, [[[]], [['device-clasp-bronze']], [['device-clasp-bronze', 'device-clasp-bronze']]], 'basic, 2nd, 3rd: one ribbon each');
  assert.deepEqual(silver, parts('bronze_medal_of_valor'), 'the same devices as the Bronze Medal of Valor');
  // Five bronze clasps are the silver clasp (6b); past four devices on a ribbon a second one is worn, which counts one award.
  const awards = n => RA.resolve('silver_medal_of_valor', { awardValue: 'capub_total_' + n, awardLabel: n + 'th Award' }).map(p => p.devices);
  assert.deepEqual(awards(5), [Array(4).fill('device-clasp-bronze')]);
  assert.deepEqual(awards(6), [['device-clasp-silver']]);
  assert.deepEqual(awards(22), [Array(4).fill('device-clasp-silver'), []]);
});

// A setup saved when the repeats were separate ribbons holds 'silver_valor_2' or 'silver_valor_3' (labelled "2 Silver Medals of Valor"). It keeps its number of awards: one bronze
// clasp for the second, two for the third, on one ribbon.
test('a saved Silver Medal of Valor with the old separate-ribbon value is the same number of awards as clasps on one ribbon (39-3 6b)', () => {
  const clasps = n => Array(n).fill('device-clasp-bronze');
  for(const [value, label, awards] of [['silver_valor_1', '1 Silver Medal of Valor', 1], ['silver_valor_2', '2 Silver Medals of Valor', 2], ['silver_valor_3', '3 Silver Medals of Valor', 3]]){
    assert.deepEqual(RA.resolve('silver_medal_of_valor', { awardValue: value, awardLabel: label }).map(p => p.devices), [clasps(awards - 1)], value);
    assert.deepEqual(RA.resolve('silver_medal_of_valor', { awardValue: value }).map(p => p.devices), [clasps(awards - 1)], `${value} with no label`);
    assert.deepEqual(RA.resolve('silver_medal_of_valor', { awardValue: '', awardLabel: label }).map(p => p.devices), [clasps(awards - 1)], `${label} with no value`);
    // The setup is brought to the picker's own choice for that many awards, and the rack holds the one ribbon.
    ev("State.membership = 'cadet'; State.uniform = 'blues_a'; State.ribbonSelections = {}; normalizeRibbonSelections();");
    ev(`State.ribbonSelections.silver_medal_of_valor = { checked:true, devices:{}, awardValue:${JSON.stringify(value)}, awardLabel:${JSON.stringify(label)} }; rebuildRibbonsFromGallery();`);
    const chosen = ev("State.ribbonSelections.silver_medal_of_valor");
    assert.deepEqual(RA.resolve('silver_medal_of_valor', { awardValue: chosen.awardValue, awardLabel: chosen.awardLabel }).map(p => p.devices), [clasps(awards - 1)], `${value}: the picker's choice`);
    assert.match(chosen.awardLabel, awards === 1 ? /^Basic Award/ : new RegExp(`^${['', '', '2nd', '3rd'][awards]} Award`), `${value}: the choice is an option of the picker`);
    assert.ok(Array.from(ev("getRibbonAwardOptions('silver_medal_of_valor')")).some(o => o.value === chosen.awardValue), `${value}: a value the select offers`);
    assert.equal(Array.from(ev("State.ribbons.filter(r => r.id === 'silver_medal_of_valor')")).length, 1, `${value}: one ribbon on the rack, not one for each award`);
  }
});

// 39-3 6b allows four devices on a ribbon "unless otherwise stated"; the Lifesaving ribbon says otherwise (9h: "A maximum of three devices (one silver star and two clasps)", and above three a
// second ribbon, which counts for one subsequent award). Every ribbon of the award, with the star or without, holds three at most.
test('the Lifesaving ribbon holds three devices at most, a second ribbon beyond that; every other clasp ribbon still holds four (39-3 6b, 9h)', () => {
  const awardsOn = part => part.devices.reduce((n, d) => n + (d === 'device-clasp-silver' ? 5 : d === 'device-clasp-bronze' ? 1 : 0), 1);
  const options = Array.from(ev("getRibbonAwardOptions('lifesaving_award').filter(o => o.value).map(o => ({ value: o.value, label: o.label }))"));
  assert.ok(options.length >= 40, 'the Lifesaving options run past twenty awards');
  const check = (selection, total, where) => {
    const parts = RA.resolve('lifesaving_award', selection);
    parts.forEach((part, i) => assert.ok(part.devices.length <= 3, `${where}: ribbon ${i + 1} wears ${part.devices.length} devices`));
    parts.forEach((part, i) => { if(i) assert.ok(!part.devices.includes('device-star-silver'), `${where}: the star stays on the first ribbon`); });
    assert.equal(parts.reduce((n, part) => n + awardsOn(part), 0), total, `${where}: the ribbons add up to ${total} awards (a second ribbon counts one)`);
    return parts;
  };
  for(const o of options){
    const total = /basic/i.test(o.label) ? 1 : Number(/(\d+)(?:st|nd|rd|th)/.exec(o.label)[1]);
    const parts = check({ awardValue: o.value, awardLabel: o.label }, total, o.label);
    assert.equal(parts[0].devices.includes('device-star-silver'), /star/i.test(o.label), `${o.label}: the silver star on the first ribbon when the award has it`);
  }
  // The counts that matter: four awards fit one ribbon; five need a second plain ribbon (it counts for the fifth); with the star, four awards are star and two clasps, then the second ribbon.
  const parts = (value, label) => RA.resolve('lifesaving_award', { awardValue: value, awardLabel: label }).map(p => p.devices);
  assert.deepEqual(parts('capub_total_4', '4th Award'), [['device-clasp-bronze', 'device-clasp-bronze', 'device-clasp-bronze']]);
  assert.deepEqual(parts('capub_total_5', '5th Award'), [['device-clasp-bronze', 'device-clasp-bronze', 'device-clasp-bronze'], []]);
  assert.deepEqual(parts('capub_total_4', '4th with Star'), [['device-star-silver', 'device-clasp-bronze', 'device-clasp-bronze'], []]);
  for(let n = 1; n <= 60; n++) for(const star of [false, true]) check({ awardValue: 'capub_total_' + n, awardLabel: n + 'th Award' + (star ? ' with Star' : '') }, n, `${n}${star ? ' with star' : ''}`);
  // The other ribbons keep 6b's four: a fifth award is four bronze clasps on one ribbon; the Find ribbon's aircrew ribbon keeps its three (21d(4)).
  assert.deepEqual(RA.resolve('cap_achievment_award', { awardValue: 'capub_total_5', awardLabel: '5th Award' }).map(p => p.devices.length), [4]);
  assert.deepEqual(RA.resolve('cap_achievment_award', { awardValue: 'capub_total_9', awardLabel: '9th Award' }).map(p => p.devices.length), [4]);
  assert.deepEqual(RA.resolve('search_find_ribbon', { awardValue: 'mcchord_24601', awardLabel: '4th w/Prop' }).map(p => p.devices.length), [3, 0]);
  assert.deepEqual(RA.resolve('search_find_ribbon', { awardValue: 'mcchord_23300', awardLabel: '5th Award' }).map(p => p.devices.length), [4], 'a ground find ribbon, no propeller, holds four');
});

// Ethan: "this isn't a thing" (the Crisis Service Ribbon's Nth service period / N bronze clasps) and "OTY awards
// are once" (the AFA Award to Unit Cadet of the Year showing 2nd/3rd/4th Award). Each of these is awarded once.
test('the Crisis Service Ribbon and the Cadet of the Year awards (AFA, AFSA, VFW officer, VFW NCO) are awarded once: only the basic award, no clasps, no repeat counts', () => {
  for(const id of ['crisis_ribbon', 'afa_award', 'afsa_award', 'vfw_officer_award', 'vfw_nco_award']){
    assert.equal(RA.FAMILIES[id].once, true, id);
    for(const membership of ['cadet', 'senior']){
      ev(`State.membership = '${membership}'`);
      const options = ev(`getRibbonAwardOptions('${id}')`);
      assert.deepEqual(Array.from(options, o => [o.label, o.value]), [['- Select -', ''], ['Basic Award', 'award_1']], `${id} ${membership}`);
    }
    // Whatever count a saved selection or an import carries, the ribbon wears no device and is one ribbon.
    for(const [awardValue, awardLabel] of [['award_1', 'Basic Award'], ['award_4', '4th Award'], ['count_6', ''], ['capub_total_9', '9th Award'], ['bronze_clasp_3', '3rd service period / 2 Bronze Clasps']]){
      const parts = RA.resolve(id, { awardValue, awardLabel });
      assert.equal(parts.length, 1, `${id} ${awardValue}`);
      assert.deepEqual(parts[0].devices, [], `${id} ${awardValue}`);
    }
    assert.match(RA.hint(id), /once/i, id);
    assert.doesNotMatch(RA.hint(id), /clasp marks|service period/i, id);
  }
  // An imported 'earned' selection is the one award.
  ev("State.membership = 'senior'");
  assert.equal(ev("getRibbonSelectionOption('crisis_ribbon', 'earned').value"), 'award_1');
});

test('the AFOEA stays a single award (ICL 18-02: one award period)', () => {
  ev("State.membership = 'senior'");
  assert.equal(ev("getRibbonAwardOptions('Air_Force_Organizational_Excellence_Award').filter(o => o.value).length"), 1);
});

test('the cadet recruiter ribbon counts recruits: 2 earn it, a bronze clasp per 2 more, silver for five, another silver per 10 (39-3 21k(1))', () => {
  ev("State.membership = 'cadet'");
  const options = ev("getRibbonAwardOptions('cadet_recruiter_ribbon').filter(o => o.value)");
  assert.match(options[0].label, /^2 members recruited$/);
  const d = recruits => {
    const o = options.find(x => new RegExp(`^${recruits} members`).test(x.label));
    assert.ok(o, `an option for ${recruits}`);
    return RA.resolve('cadet_recruiter_ribbon', { awardValue: o.value, awardLabel: o.label })[0].devices;
  };
  assert.deepEqual(d(2), []);
  assert.deepEqual(d(4), ['device-clasp-bronze']);
  assert.deepEqual(d(10), Array(4).fill('device-clasp-bronze'));
  assert.deepEqual(d(12), ['device-clasp-silver'], 'a silver clasp replaces five bronze');
  assert.deepEqual(d(22), ['device-clasp-silver', 'device-clasp-silver']);
});

test('the picker has a rule line for the ribbons whose counting is not plain "Nth award" (39-3 21c, 21d, 21k, 6b)', () => {
  for(const id of ['search_find_ribbon', 'air_search_and_rescue_ribbon', 'crisis_ribbon', 'cadet_recruiter_ribbon', 'cap_senior_recruiter_ribbon', 'iace_ribbon', 'national_commanders_citation', 'cap_gill_robb_wilson_ribbon']){
    assert.ok(RA.hint(id).length > 20, `${id} has a hint`);
  }
  assert.match(RA.hint('search_find_ribbon'), /20 non-distress finds/);
  assert.equal(RA.hint('meritorious_service_award'), '');
  assert.match(read('js/galleries.js'), /CAPUBRibbonAwards\.hint\(id\)/);
});

// ---- badges and cords ------------------------------------------------------------------------------------------------

test('Corporate Service Dress and Semi-Formal: the National Staff badge is not authorized, the Command Council badge may take the crest\'s place (4.2.3.1.1.1, Attachment 4)', () => {
  for(const uniform of ['semi_formal', 'aviator_blazer']){
    ev(`State.uniform = '${uniform}'`);
    assert.equal(ev("isBadgeAuthorizedOnCurrentDressUniform('national_staff_badge')"), false, uniform);
    assert.equal(ev("isBadgeAuthorizedOnCurrentDressUniform('volunteer_university_instructor_badge')"), false, uniform);
    assert.equal(ev("isBadgeAuthorizedOnCurrentDressUniform('emergency_services_badge')"), false, uniform);
    for(const ok of ['command_council_badge', 'senior_advisory_group_badge', 'national_executive_committee_badge', 'cap_national_command_board_badge', 'christian_chaplin']){
      assert.equal(ev(`isBadgeAuthorizedOnCurrentDressUniform('${ok}')`), true, `${uniform} ${ok}`);
    }
  }
  ev("State.uniform = 'blues_a'");
  assert.equal(ev("isBadgeAuthorizedOnCurrentDressUniform('national_staff_badge')"), true, 'every badge is allowed on the Class A');
});

test('shoulder cords: cadets wear the cadet cords on Class A and Class B, the Aide de Camp cord is worn by senior members too, nobody on other uniforms (9.3, 9.3.4, 9.4.1)', () => {
  for(const uniform of Object.keys(rules.RULES)){
    const dress = uniform === 'blues_a' || uniform === 'blues_b';
    assert.equal(rules.allowsAideCord(uniform), dress, `${uniform}: aide cord`);
    for(const membership of ['cadet', 'senior']){
      assert.equal(rules.allowsCord(uniform, membership, 'aide_de_camp'), dress, `${uniform} ${membership} aide`);
      for(const cord of ['group', 'wing', 'region', 'national', 'color_guard', 'honor_guard']){
        assert.equal(rules.allowsCord(uniform, membership, cord), dress && membership === 'cadet', `${uniform} ${membership} ${cord}`);
      }
      assert.equal(rules.allowsCord(uniform, membership, null), false);
    }
  }
});

test('the cord control offers the Aide de Camp cord, names the white and silver cords, and notes what each is for', () => {
  const html = read('index.html');
  assert.match(html, /<option value="aide_de_camp">Aide de Camp shoulder cord<\/option>/);
  assert.match(html, /<option value="color_guard">Color Guard shoulder cord - white<\/option>/);
  assert.match(html, /<option value="honor_guard">Honor Guard shoulder cord - silver<\/option>/);
  assert.match(html, /id="shoulderCordNote"/);
  const meta = ev("SHOULDER_CORD_META");
  assert.match(meta.honor_guard.note, /9\.3\.3/);
  assert.match(meta.color_guard.note, /9\.3\.2/);
  assert.match(meta.aide_de_camp.note, /9\.3\.4/);
  assert.match(read('js/uniform-view.js'), /allowsCord\(State\.uniform, State\.membership, State\.shoulderCord\)/);
});

test('the name has no cap tape field left: the tape art is fixed (UI audit 4.5)', () => {
  assert.doesNotMatch(read('index.html'), /capubV2CapTape/);
  assert.doesNotMatch(read('js/wiring.js'), /capTape/);
  assert.doesNotMatch(read('js/uniform-view.js'), /capTape/);
});

test('unused functions and the dead references to controls the page no longer has are gone (UI audit 6.2-6.5)', () => {
  assert.doesNotMatch(read('js/placement.js'), /toggleMini|autoMini/);
  for(const [file, names] of Object.entries({
    'js/member-report-import.js': ['removeMemberReportSection', 'countDatedRowsInSection', 'hasCurrentDutyPosition', 'hasSpecialtyTrackLevel', 'highestSpecialtyTrackLevelFromReport', 'addImportedBadge', 'shouldImportCommandInsigniaForMember'],
    'js/placement.js': ['militaryBadgeDressPlacementRole'], 'js/setup.js': ['optionize']
  })){
    for(const name of names) assert.doesNotMatch(read(file), new RegExp(`function ${name}\\b`), name);
  }
  // What the page still calls is still defined.
  for(const name of ['fullRender', 'refreshUI', 'updateAvailabilityUI']) assert.equal(ev(`typeof ${name}`), 'function', name);
});

test('the picker offers real choices for every ribbon: no placeholder entries, none empty (UI audit 2.7)', () => {
  assert.doesNotMatch(read('js/galleries.js'), /Basic Award \+ V Device Placeholder|Gold-Level Placeholder/);
  for(const membership of ['cadet', 'senior']){
    ev(`State.membership = '${membership}'`);
    for(const id of Array.from(ev('ribbonList'))){
      const options = Array.from(ev(`getRibbonAwardOptions('${id}')`));
      assert.ok(options.filter(o => o.value).length >= 1, `${membership} ${id}: has a choice`);
      assert.ok(options.every(o => !/placeholder/i.test(o.label)), `${membership} ${id}: no placeholder label`);
    }
  }
});

test('the preview carries no "Uniform Preview" label over the artwork (UI audit 7)', () => {
  assert.doesNotMatch(read('styles/app.css'), /content:"Uniform Preview"/);
});

// ---- JROTC and ROTC ribbons (tracker Ribbon 6; CAPR 39-1 11.2.1, 11.2.5) --------------------------------------

const ROTC = require('../data/rotc-ribbons.js');
const MANIFEST = JSON.parse(read('images/MANIFEST.json'));
const pick = id => ev(`getRibbonAwardOptions('${id}').find(o => o.value).value`);
const choose = id => ev(`setRibbonSelectionFromDropdown('${id}', ${JSON.stringify(pick(id))}, {deferRender:true})`);
const fresh = (membership, uniform) => ev(`State.membership = '${membership}'; State.gender = 'male'; State.rank = '${membership === 'cadet' ? 'C/Capt' : 'Capt'}'; State.uniform = '${uniform || 'blues_a'}'; State.ribbonSelections = {}; State.ribbons = []; normalizeRibbonSelections();`);

test('the catalog lists the 110 JROTC/ROTC sheets of the art tree, each with its sheet in the manifest at 1 3/8 x 3/8 in (39-1 11.3)', () => {
  assert.equal(ROTC.ribbons.length, 110);
  assert.equal(new Set(ROTC.ribbons.map(r => r.id)).size, 110, 'ids are unique');
  for(const r of ROTC.ribbons){
    const entry = MANIFEST.assets.find(a => a.id === r.asset);
    assert.ok(entry, `${r.asset} is in the manifest`);
    assert.deepEqual([entry.w_in, entry.h_in], [1.375, 0.375], r.asset);
    assert.ok(fs.existsSync(path.join(ROOT, 'images', entry.path)), `${r.asset} file`);
    assert.equal(r.id, 'rotc_' + r.asset.slice('mil-ribbon-rotc-'.length).replace(/-/g, '_'));
    assert.ok(ROTC.services.some(s => s.key === r.service), r.id);
  }
  assert.equal(ROTC.limit, 3);
  assert.equal(ROTC.ref, '11.2.5');
});

test('the picker groups the JROTC/ROTC ribbons by service after the CAP groups, with the three-ribbon rule beside them, for cadets and senior members', () => {
  for(const membership of ['cadet', 'senior']){
    fresh(membership);
    const groups = Array.from(ev('groupRibbonIds(getEligibleRibbonIds())')).map(g => ({ key: g.key, n: g.ids.length, note: g.note }));
    const rotcGroups = groups.filter(g => /^rotc-/.test(g.key));
    assert.deepEqual(rotcGroups.map(g => g.n), [29, 34, 19, 28], membership);
    assert.equal(groups.findIndex(g => /^rotc-/.test(g.key)), groups.findIndex(g => g.key === 'activity') + 1 + (groups.some(g => g.key === 'wartime') ? 1 : 0), 'after the last CAP group');
    for(const g of rotcGroups) assert.match(g.note, /at most 3.*while enrolled.*11\.2\.5|at most 3.*enrolled.*11\.2\.5/i);
    assert.equal(groups.filter(g => g.key === 'other').length, 0, 'none falls into Other');
  }
});

test('a JROTC/ROTC ribbon is chosen once, with no devices, and shows its own sheet and name', () => {
  fresh('cadet');
  const id = 'rotc_navy_jrotc_unit_service_ribbon';
  assert.equal(ev(`getRibbonDisplayName('${id}')`), 'Navy JROTC Unit Service Ribbon');
  assert.deepEqual(Array.from(ev(`getRibbonAwardOptions('${id}')`)).filter(o => o.value).map(o => o.value), ['earned']);
  assert.equal(ev(`getRibbonImagePath('${id}')`), ev("CAPUBAssetIndex['mil-ribbon-rotc-navy-jrotc-unit-service-ribbon']"));
  assert.ok(ev(`getRibbonImagePath('${id}')`));
});

test('JROTC/ROTC ribbons follow the CAP ribbons in the rack and precede foreign awards (39-1 11.2.1)', () => {
  fresh('senior');
  for(const id of ['rotc_army_jrotc_proficiency', 'cap_membership_ribbon', 'rotc_air_force_jrotc_color_guard', 'cap_achievment_award']) choose(id);
  ev('rebuildRibbonsFromGallery()');
  assert.deepEqual(Array.from(ev('State.ribbons.map(r => r.id)')), ['cap_achievment_award', 'cap_membership_ribbon', 'rotc_air_force_jrotc_color_guard', 'rotc_army_jrotc_proficiency']);
  assert.equal(ev("ribbonPrecedenceGroup('rotc_army_jrotc_proficiency')"), 2);
  assert.ok(ev("ribbonPrecedenceGroup('cap_membership_ribbon')") < 2 && ev("ribbonPrecedenceGroup('rotc_army_jrotc_proficiency')") < 3, 'CAP before JROTC before foreign (group 3)');
  const built = Array.from(ev('CAPUBUniformView.buildFromState().ribbons')).map(r => [r.asset, r.rotc === true]);
  assert.deepEqual(built.map(b => b[0]), ['ribbon-cap-achievment-award', 'ribbon-cap-membership-ribbon', 'mil-ribbon-rotc-air-force-jrotc-color-guard', 'mil-ribbon-rotc-army-jrotc-proficiency']);
  assert.deepEqual(built.map(b => b[1]), [false, false, true, true]);
});

test('three JROTC/ROTC ribbons may be worn: a fourth is refused, and a saved setup that lists more wears the first three (39-1 11.2.5)', () => {
  fresh('cadet');
  const ids = ['rotc_navy_jrotc_unit_service_ribbon', 'rotc_army_jrotc_n_1_10', 'rotc_air_force_jrotc_color_guard', 'rotc_army_jrotc_recruiting'];
  ev('window.__toasts = []; window.capubToastShow = m => window.__toasts.push(m)');
  ids.forEach(choose);
  assert.deepEqual(ids.filter(id => ev(`State.ribbonSelections.${id}.checked`)), ids.slice(0, 3), 'the fourth is cleared');
  assert.match(String(ev('window.__toasts[0]')), /At most 3 JROTC\/ROTC ribbons.*11\.2\.5/);
  // A saved setup written by hand with four ticked.
  ev(`State.ribbonSelections.${ids[3]}.checked = true; State.ribbonSelections.${ids[3]}.awardValue = 'earned'; rebuildRibbonsFromGallery();`);
  assert.equal(Array.from(ev('State.ribbons.map(r => r.id)')).length, 3);
  ev('CAPUBUniformView.buildFromState()');
  assert.deepEqual(Array.from(ev('CAPUBUniformView.ribbonNotes')), ['Only 3 JROTC/ROTC ribbons may be worn, so the first 3 in order are shown (CAPR 39-1, 11.2.5)']);
});

test('JROTC/ROTC ribbons follow the military awards\' rule on the uniforms: worn on the USAF-style, not on Corporate-style uniforms that bar military awards (11.1.6)', () => {
  const id = 'rotc_army_jrotc_proficiency';
  for(const u of ['blues_a', 'blues_b', 'mess_dress', 'semi_formal_usaf']) assert.equal(ev(`isAwardWornOnUniform('${id}', '${u}')`), ev(`isAwardWornOnUniform('military:air_force_cross', '${u}')`), u);
  for(const u of ['blues_a', 'blues_b']) assert.equal(ev(`isAwardWornOnUniform('${id}', '${u}')`), true, u);
});

test('the picker tile for a JROTC/ROTC ribbon carries no miniature medal box, and saved setups keep the choice (the sanitiser walks ribbonList)', () => {
  assert.match(read('js/galleries.js'), /allowsMiniMedals\(State\.uniform\) && !isRotcRibbonId\(id\)/);
  assert.match(read('js/wiring.js'), /for\(const id of \[\.\.\.ribbonList, \.\.\.getMilitaryRibbonIds\(\)\]\)/);
  assert.ok(ROTC.ribbons.every(r => ev(`ribbonList.includes('${r.id}')`)));
});

test('miniature medals: none is drawn for a JROTC/ROTC ribbon and the drawing says so (the engine has no miniature for them)', () => {
  fresh('senior', 'semi_formal');
  ev("State.gender = 'male'");
  for(const id of ['cap_membership_ribbon', 'rotc_army_jrotc_proficiency']) choose(id);
  ev('rebuildRibbonsFromGallery()');
  const build = ev('CAPUBUniformView.buildFromState()');
  assert.deepEqual(Array.from(build.medals).map(m => m.ribbonAsset), ['ribbon-cap-membership-ribbon']);
  assert.deepEqual(Array.from(ev('CAPUBUniformView.ribbonNotes')), ['The JROTC/ROTC ribbons have no miniature medal, so none is shown for them']);
});
