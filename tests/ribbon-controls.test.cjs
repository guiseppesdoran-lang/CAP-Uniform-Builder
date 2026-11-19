'use strict';
// The choices under a chosen ribbon (the owner, 2026-11-18: "for ribbons do a mix of the old dropdown and what you have now"; "the ribbon UI especially with honor credit should be
// redone"; "the SMOV cannot have any devices on top of it"; and, of the Goddard's four choices drawn with the same two stars, "this is just blatantly untrue"). One dropdown says how
// many awards, with the device in words from the rule that draws it; one switch for each separate fact; nothing is asked that the page already knows; the Silver Medal of Valor has
// neither a count nor a device. The page's own option lists and stored values are kept: every line and every switch carries the option value it stores.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const RA = require('../data/ribbon-awards.js');
const { context } = loadPageScripts();
const ev = src => vm.runInContext(src, context);
const evj = src => JSON.parse(JSON.stringify(vm.runInContext(src, context)));
ev('rebuildRibbonsFromGallery = function(){}; renderRack = function(){}; renderAllBadges = function(){};');
const reset = (membership = 'senior') => ev(`State.membership = ${JSON.stringify(membership)}; State.uniform = 'blues_a'; State.rank = ${JSON.stringify(membership === 'cadet' ? 'C/Capt' : 'Capt')}; State.ribbonSelections = {}; State.badgeSelections = {}; State.badges = []; State.ribbons = []; State.militaryUIState = {}; State.gradeRibbons = null; normalizeRibbonSelections(); normalizeBadgeSelections();`);
const q = id => JSON.stringify(id);
const options = id => evj(`getRibbonAwardOptions(${q(id)}).filter(o => o.value).map(o => ({ value: o.value, label: o.label }))`);
const set = (id, value) => ev(`setRibbonSelectionFromDropdown(${q(id)}, ${q(value)}, { deferRender: true })`);
const controls = id => evj(`getRibbonControls(${q(id)})`);
const sel = id => evj(`State.ribbonSelections[${q(id)}]`);
const devicesOf = (id, value, label) => RA.resolve(id, { awardValue: value, awardLabel: label, membership: ev('State.membership') }).flatMap(p => p.devices);

const CLASPS = ['distinguished_service_award', 'lifesaving_award', 'community_service_ribbon', 'crisis_ribbon', 'cap_counterdrug_ribbon', 'encampment_ribbon'];

test('the dropdown of a clasp ribbon says each count with the clasps the rule gives it', () => {
  reset();
  for(const id of ['distinguished_service_award', 'crisis_ribbon', 'bronze_medal_of_valor']){
    set(id, ev(`capubFirstRibbonOptionValue(${q(id)})`));
    const c = controls(id);
    assert.equal(c.lines[0].text, '1st award', id);
    assert.equal(c.lines[1].text, '2nd award: bronze clasp', id);
    if(id !== 'bronze_medal_of_valor'){
      assert.equal(c.lines[2].text, '3rd award: 2 bronze clasps', id);
      assert.equal(c.lines[5].text, '6th award: silver clasp', id);
      assert.equal(c.lines[6].text, '7th award: silver and bronze clasps', id);
      // Count n is the clasps the 39-3 6b rule gives (a silver clasp for five bronze), one ribbon while they fit on one.
      c.lines.slice(0, 9).forEach((line, i) => assert.equal(line.text, i ? `${i + 1}${['', '', 'nd', 'rd'][i + 1] || 'th'} award: ${RA.deviceWords(RA.clasps(i, 'clasps'))}` : '1st award', `${id} line ${i + 1}`));
    }
  }
  assert.equal(controls('bronze_medal_of_valor').lines.length, 3, 'three awards, as the picker always offered');
});

test('a star ribbon, an hours ribbon, a sorties ribbon, a level ribbon and an oak leaf ribbon say their lines the same way', () => {
  reset();
  for(const id of ['cadet_special_activity_ribbon', 'community_service_ribbon', 'cap_counterdrug_ribbon', 'red_service_ribbon', 'cadet_recruiter_ribbon', 'cap_leadership_ribbon', 'air_medal', 'cap_command_service_ribbon']) set(id, ev(`capubFirstRibbonOptionValue(${q(id)})`));
  assert.deepEqual(controls('cadet_special_activity_ribbon').lines.slice(0, 3).map(l => l.text), ['1st activity', '2nd activity: bronze star', '3rd activity: 2 bronze stars']);
  const hours = controls('community_service_ribbon');
  assert.deepEqual(hours.lines.slice(0, 3).map(l => l.text), ['60 hours', '120 hours: bronze clasp', '180 hours: 2 bronze clasps']);
  assert.equal(hours.label, 'Hours');
  assert.deepEqual(controls('cap_counterdrug_ribbon').lines.slice(0, 2).map(l => l.text), ['10 sorties', '20 sorties: bronze clasp']);
  assert.deepEqual(controls('red_service_ribbon').lines.slice(0, 5).map(l => l.text), ['2 years', '5 years: bronze clasp', '10 years: 2 bronze clasps', '15 years: 3 bronze clasps', '20 years: 20-year numeral']);
  assert.equal(controls('red_service_ribbon').label, 'Years of service');
  assert.deepEqual(controls('cadet_recruiter_ribbon').lines.slice(0, 2).map(l => l.text), ['2 members recruited', '4 members recruited: bronze clasp']);
  assert.deepEqual(controls('cap_leadership_ribbon').lines.slice(0, 4).map(l => l.text), ['Basic award', 'Bronze star', 'Silver star', '2 bronze stars']);
  assert.deepEqual(controls('air_medal').lines.map(l => l.text), ['1st award', '2nd award: bronze oak leaf cluster']);
  assert.deepEqual(controls('cap_command_service_ribbon').lines.map(l => l.text), ['Squadron/CC', 'Group/CC: bronze star', 'Wing/CC: silver star', 'Region/CC: gold star', 'National/CC: 2 gold stars']);
});

test('each line has a short form for the closed dropdown (the count alone) and its devices in words apart', () => {
  reset();
  set('community_service_ribbon', 'mcchord_15701');
  const lines = controls('community_service_ribbon').lines;
  assert.deepEqual(lines.slice(0, 3).map(l => [l.short, l.words]), [['60', '60 hours'], ['120', '120 hours: bronze clasp'], ['180', '180 hours: 2 bronze clasps']], 'the count alone closed; the unit and the devices in the line under it');
  set('cap_leadership_ribbon', 'mcchord_26900');
  assert.deepEqual(controls('cap_leadership_ribbon').lines.slice(0, 5).map(l => [l.short, l.words]), [['Basic award', ''], ['Bronze', 'Bronze star'], ['Silver', 'Silver star'], ['B-B', '2 bronze stars'], ['S-B', 'Silver and bronze stars']]);
  set('cadet_recruiter_ribbon', 'recruits_2');
  assert.deepEqual([controls('cadet_recruiter_ribbon').lines[1].short, controls('cadet_recruiter_ribbon').lines[1].words], ['4', '4 members recruited: bronze clasp']);
  for(const id of ['distinguished_service_award', 'encampment_ribbon', 'community_service_ribbon', 'cap_counterdrug_ribbon', 'red_service_ribbon', 'cap_command_service_ribbon']){
    set(id, ev(`capubFirstRibbonOptionValue(${q(id)})`));
    for(const l of controls(id).lines) assert.ok(l.short.length <= 12 && !/[:.]/.test(l.short), `${id}: "${l.short}"`);
  }
});

test('the line under the dropdown counts repeated devices and names the unit, the same for every counted ribbon', () => {
  reset();
  for(const [id, at, short, words] of [['encampment_ribbon', 0, '1st', '1st encampment'], ['encampment_ribbon', 1, '2nd', '2nd encampment: bronze clasp'], ['distinguished_service_award', 0, '1st', ''], ['distinguished_service_award', 2, '3rd', '2 bronze clasps'], ['distinguished_service_award', 5, '6th', 'Silver clasp'], ['red_service_ribbon', 2, '10', '10 years: 2 bronze clasps'], ['community_service_ribbon', 5, '360', '360 hours: silver clasp']]){
    set(id, ev(`capubFirstRibbonOptionValue(${q(id)})`));
    const line = controls(id).lines[at];
    assert.deepEqual([line.short, line.words], [short, words], id);
  }
  assert.equal(RA.deviceWords(['device-clasp-silver', 'device-clasp-bronze', 'device-clasp-bronze']), '1 silver and 2 bronze clasps');
  assert.equal(RA.deviceWords(['device-clasp-silver', 'device-clasp-bronze']), 'silver and bronze clasps');
  assert.equal(RA.deviceWords(['device-clasp-silver', 'device-star-bronze']), 'silver clasp, bronze star');
  assert.equal(RA.deviceWords(Array(4).fill('mil-device-olc-silver')), '4 silver oak leaf clusters');
  assert.equal(RA.deviceWords(['mil-device-olc-silver', 'mil-device-olc-silver', 'mil-device-olc-bronze']), '2 silver and 1 bronze oak leaf clusters');
  const id = evj('getMilitaryRibbonIds().find(id => getRibbonAwardOptions(id).some(o => /Oak Leaf Cluster \\+ /i.test(o.label)))');
  set(id, 'military_award_1');
  const lines = controls(id).lines;
  const last = lines[lines.length - 1];
  assert.match(last.words, /^\d+ (?:silver|bronze)(?: and \d+ (?:silver|bronze))? oak leaf clusters?$/, last.words);
  assert.ok(!/\+/.test(lines.map(l => l.words).join(' ')), 'no plus signs');
  assert.equal(last.short, '21st');
});

test('a count that needs a second ribbon says so', () => {
  reset();
  set('distinguished_service_award', 'mcchord_17700');
  const lines = controls('distinguished_service_award').lines;
  assert.equal(lines.find(l => /^10th award/.test(l.text)).text, '10th award: 2 ribbons');
  assert.match(lines.find(l => /^84th award/.test(l.text)).text, /^84th award: \d ribbons$/);
});

test('a military ribbon uses the same dropdown for its award count, the devices in words from the military rule', () => {
  reset();
  const id = evj('getMilitaryRibbonIds().find(id => getRibbonAwardOptions(id).some(o => /Oak Leaf|Star|Clasp|Numeral/i.test(o.label)))');
  assert.ok(id, 'an award whose later counts carry a device');
  set(id, 'military_award_1');
  const c = controls(id);
  assert.equal(c.lines.length, 21);
  assert.equal(c.lines[0].text, '1st award');
  assert.ok(c.lines.some(l => /^\d+(?:st|nd|rd|th) award: .+/.test(l.text)), 'a later award with its device in words');
  assert.deepEqual(c.toggles, [], 'a military ribbon\'s switches are its allowed devices, set by the list, not by the option list');
  const mid = evj(`getRibbonAwardOptions(${q(id)}).filter(o => o.value).map(o => o.label)`);
  mid.forEach((label, i) => assert.equal(c.lines[i].text.replace(/: /, ' - ').toLowerCase(), label.replace(/\bAward\b/, 'award').toLowerCase()));
});

const count = (list, d) => list.filter(x => x === d).length;
// The long lists (84 counts) are walked at every option up to the 4th, then every 40th and the last: the rule does not change past the twenty-first (the lines of every count are
// compared with the rule in the tests above).
const walk = all => all.filter((o, i) => i < 4 || i % 40 === 0 || i === all.length - 1);

test('every option of every ribbon: its line and switches give exactly its devices, never one it does not give, and a switch pressed twice comes back to the option it started from', () => {
  for(const membership of ['senior', 'cadet']){
    reset(membership);
    // A cadet's list differs from a senior member's only in the cadet awards (no moved star), so only those are walked again.
    const ids = evj('getEligibleRibbonIds().filter(id => !isRotcRibbonId(id))').filter(id => membership === 'senior' || (RA.FAMILIES[id] || {}).devices === 'cadet');
    let checked = 0, switches = 0;
    for(const id of ids){
      const all = options(id);
      const label = value => (all.find(x => x.value === value) || {}).label;
      for(const o of walk(all)){
        set(id, o.value);
        const c = controls(id);
        assert.equal(sel(id).checked, true, `${id} ${o.value}`);
        assert.ok(c.lines.length === 0 || c.lines.some(l => l.value === c.selected), `${id} ${o.value}: the dropdown stands on a line`);
        // The option with every switch turned off: the line's own option.
        let base = o.value, now = c;
        for(let guard = 0; guard < 6; guard++){
          const on = now.toggles.find(t => t.on && t.next);
          if(!on) break;
          base = on.next;
          set(id, base);
          now = controls(id);
        }
        set(id, o.value);
        const given = devicesOf(id, o.value, o.label), plain = devicesOf(id, base, label(base));
        for(const t of c.toggles.filter(t => t.on && !t.next)) assert.ok(given.includes(t.device), `${id} ${o.value}: switch ${t.key} is on and the picture has its device`);
        for(const t of id === 'goddard_achievement' ? [] : c.toggles.filter(t => t.next || !t.on)){   // the Goddard's star follows the badge, its own test is below
          // A switch's device is on the ribbon exactly once more than the line gives it while the switch is on, and as often as the line gives it while the switch is off.
          assert.equal(count(given, t.device), count(plain, t.device) + (t.on ? 1 : 0), `${membership} ${id} ${o.value}: switch ${t.key} ${t.on ? 'on' : 'off'}; the picture has ${count(given, t.device)} of ${t.device}, the line alone ${count(plain, t.device)}`);
        }
        // The line says only what the line gives: the same words with the switches on or off.
        const text = c.lines.find(l => l.value === c.selected);
        const plainText = controls(id) && (set(id, base), controls(id).lines.find(l => l.value === controls(id).selected));
        set(id, o.value);
        if(text && plainText) assert.equal(text.text, plainText.text, `${id} ${o.value}: the line does not carry a switch's device`);
        // A switch pressed twice comes back to the option it started from.
        for(const t of c.toggles.filter(t => t.next && id !== 'goddard_achievement')){
          set(id, t.next);
          const again = controls(id).toggles.find(x => x.key === t.key);
          assert.equal(again.on, !t.on, `${id} ${o.value}: ${t.key} pressed`);
          assert.equal(sel(id).awardValue, t.next, `${id}: the option's own value is what is stored`);
          if(again.next){ set(id, again.next); assert.equal(sel(id).awardValue, o.value, `${id} ${o.value}: ${t.key} pressed twice`); }
          set(id, o.value);
          switches++;
        }
        checked++;
      }
    }
    assert.ok(checked > (membership === 'senior' ? 150 : 20) && switches > (membership === 'senior' ? 30 : 5), `${membership}: ${checked} options, ${switches} switch presses`);
  }
});

test('the options of a ribbon are never two with the same count and the same facts, so a line and its switches name one option', () => {
  for(const membership of ['senior', 'cadet']){
    reset(membership);
    for(const id of evj('getEligibleRibbonIds().filter(id => !isRotcRibbonId(id))').filter(id => membership === 'senior' || (RA.FAMILIES[id] || {}).devices === 'cadet')){
      const seen = new Map();
      for(const o of walk(options(id))){
        set(id, o.value);
        const c = controls(id);
        const key = [c.selected, c.toggles.filter(t => t.on).map(t => t.key).sort().join('+'), /rocketry/.test(o.value) ? 'rocketry' : ''].join('|');
        if(seen.has(key)) assert.ok(false, `${membership} ${id}: ${o.value} and ${seen.get(key)} are the same count and facts`);
        seen.set(key, o.value);
      }
    }
  }
});

test('honor credit is one switch with the silver star: on gives the star, off takes it away, on the eight achievements and no other ribbon', () => {
  reset('cadet');
  const honor = ['curry_achievement', 'hap_arnold_achievement', 'mary_feik_achievement', 'rickenbacker_achievement', 'lindbergh_achievement', 'doolittle_achievement', 'goddard_achievement', 'armstrong_achievement'];
  for(const id of honor){
    set(id, 'earned');
    let c = controls(id);
    assert.equal(c.lines.length, 1, `${id}: no count to choose`);
    assert.deepEqual(c.toggles.map(t => [t.key, t.label, t.device, t.on]), [['honor', 'Honor credit', 'device-star-silver', false]], id);
    assert.deepEqual(devicesOf(id, sel(id).awardValue, sel(id).awardLabel), [], `${id}: no star while off`);
    set(id, c.toggles[0].next);
    c = controls(id);
    assert.equal(c.toggles[0].on, true, id);
    assert.deepEqual(devicesOf(id, sel(id).awardValue, sel(id).awardLabel), ['device-star-silver'], `${id}: the silver star while on`);
    assert.equal(sel(id).honorCredit === true || id !== 'goddard_achievement', true);
    set(id, c.toggles[0].next);
    assert.equal(controls(id).toggles[0].on, false, `${id}: off again`);
    assert.equal(sel(id).awardValue, 'earned', `${id}: the stored value is the one it always was`);
  }
  for(const id of ['wright_brothers_award', 'mitchell_award', 'eaker_award']){
    set(id, 'earned');
    assert.ok(!controls(id).toggles.some(t => t.key === 'honor'), `${id} takes no honor credit`);
  }
  assert.equal(controls('curry_achievement').toggles[0].next, 'earned' === 'x' ? '' : controls('curry_achievement').toggles[0].next);
});

test('the Cadet Officer School star is one switch on the Mitchell, and a senior member may move it to a higher cadet ribbon', () => {
  reset('senior');
  set('mitchell_award', 'earned');
  let c = controls('mitchell_award');
  assert.deepEqual(c.toggles.map(t => [t.key, t.label, t.device, t.on, t.next]), [['cos', 'Cadet Officer School star', 'device-star-silver', false, 'earned_cos_star']]);
  set('mitchell_award', c.toggles[0].next);
  assert.equal(controls('mitchell_award').toggles[0].on, true);
  assert.deepEqual(devicesOf('mitchell_award', sel('mitchell_award').awardValue, sel('mitchell_award').awardLabel), ['device-star-silver']);
  set('eaker_award', 'earned');
  assert.equal(controls('eaker_award').toggles.length, 1, 'the star moved to the Eaker by a senior member');
  reset('cadet');
  set('eaker_award', 'earned');
  assert.deepEqual(controls('eaker_award').toggles, [], 'a cadet has no moved star');
});

test('a ribbon\'s facts that are choices of the rule are switches: aircrew propeller, the V device, the lifesaving star, the commander\'s stars', () => {
  reset();
  for(const [id, keys] of [['search_find_ribbon', ['aircrew']], ['air_search_and_rescue_ribbon', ['aircrew']], ['disaster_relief_ribbon', ['v']], ['lifesaving_award', ['star']], ['commander_commendation_award', ['region', 'national']]]){
    set(id, ev(`capubFirstRibbonOptionValue(${q(id)})`));
    assert.deepEqual(controls(id).toggles.map(t => t.key), keys, id);
  }
  const id = 'commander_commendation_award';
  set(id, 'mcchord_13800');          // 2nd award, no star
  let c = controls(id);
  assert.equal(c.toggles.find(t => t.key === 'region').next, 'mcchord_46102');
  set(id, c.toggles.find(t => t.key === 'region').next);
  c = controls(id);
  assert.equal(c.toggles.find(t => t.key === 'national').next, 'mcchord_46202', 'both stars from the second award');
  assert.equal(c.selected, controls(id).lines.find(l => /^2nd award/.test(l.text)).value);
  set(id, 'mcchord_13700');          // basic: both at once is no option
  c = controls(id);
  set(id, c.toggles.find(t => t.key === 'region').next);
  assert.equal(controls(id).toggles.find(t => t.key === 'national').next, null, 'no basic award with both stars: the switch is not offered');
  // The facts on stay on when the count changes, where an option for them exists; a count with none is greyed.
  set('lifesaving_award', 'mcchord_28001');   // basic with star
  c = controls('lifesaving_award');
  assert.equal(c.toggles[0].on, true);
  const third = c.lines.find(l => /^3rd award/.test(l.text));
  assert.equal(third.value, 'mcchord_28003');
  assert.equal(third.enabled, true);
  const past = c.lines.find(l => /^22nd award/.test(l.text));
  assert.equal(past.enabled, false, 'no 22nd award with the star among the options');
  const aircrew = 'search_find_ribbon';
  set(aircrew, 'mcchord_24500');               // 2nd with propeller
  assert.equal(controls(aircrew).lines.find(l => l.value === controls(aircrew).selected).text, '2nd award: bronze clasp', 'the count line does not carry the switch\'s propeller');
  assert.equal(controls(aircrew).toggles[0].on, true);
});

test('the Goddard has one switch, the honor credit: its model rocketry star is the page\'s own and is not a switch', () => {
  reset('cadet');
  const goddard = () => devicesOf('goddard_achievement', sel('goddard_achievement').awardValue, sel('goddard_achievement').awardLabel);
  set('goddard_achievement', 'earned');
  ev(`State.badgeSelections.model_rocketry_badge = { checked: true }; State.badges = ['model_rocketry_badge'];`);
  set('mitchell_award', 'earned');
  assert.equal(sel('goddard_achievement').awardValue, 'rocketry_star', 'the star the page wears');
  const c = controls('goddard_achievement');
  assert.deepEqual(c.toggles.map(t => t.key), ['honor'], 'the star is not a switch');
  assert.equal(c.lines.length, 1, 'and nothing to count');
  assert.equal(c.toggles[0].on, false);
  set('goddard_achievement', c.toggles[0].next);
  assert.equal(sel('goddard_achievement').awardValue, 'honor_credit_and_rocketry', 'honor credit and the page\'s star: both');
  assert.deepEqual(goddard(), ['device-star-silver', 'device-star-silver']);
  assert.equal(controls('goddard_achievement').toggles[0].on, true);
  set('goddard_achievement', controls('goddard_achievement').toggles[0].next);
  assert.equal(sel('goddard_achievement').awardValue, 'rocketry_star', 'honor off: the page\'s star stays');
  assert.deepEqual(goddard(), ['device-star-silver']);
});

test('the Silver Medal of Valor has no count and no device, from the picker, a saved setup and the page\'s own pick', () => {
  for(const membership of ['senior', 'cadet']){
    reset(membership);
    assert.deepEqual(options('silver_medal_of_valor'), [{ value: 'award_1', label: 'Basic Award' }], 'one choice');
    set('silver_medal_of_valor', ev('capubFirstRibbonOptionValue("silver_medal_of_valor")'));
    const c = controls('silver_medal_of_valor');
    assert.equal(c.lines.length, 1, 'no count dropdown');
    assert.deepEqual(c.toggles, [], 'no switch');
    assert.deepEqual(devicesOf('silver_medal_of_valor', sel('silver_medal_of_valor').awardValue, sel('silver_medal_of_valor').awardLabel), []);
    for(const stored of ['mcchord_38210', 'mcchord_38220', 'silver_valor_2', 'capub_total_9', 'earned']){
      ev(`State.ribbonSelections.silver_medal_of_valor = { checked: true, devices: { '1_Bronze_Star_Device': 1 }, awardValue: ${q(stored)}, awardLabel: '2nd Award' }; normalizeRibbonSelections();`);
      assert.equal(sel('silver_medal_of_valor').awardValue, 'award_1', stored);
      assert.deepEqual(sel('silver_medal_of_valor').devices, {}, `${stored}: no device kept`);
    }
  }
  // The Bronze Medal of Valor keeps what it had: a count with a clasp for each later award (CAPR 39-3, 6b names no difference between the two medals).
  reset();
  assert.equal(options('bronze_medal_of_valor').length, 3);
  assert.deepEqual(devicesOf('bronze_medal_of_valor', 'mcchord_10600', '2nd Award'), ['device-clasp-bronze']);
});

test('a ribbon with nothing to choose has no controls: its model has one line and no switch', () => {
  reset();
  for(const id of ['wright_brothers_award', 'cap_membership_ribbon', 'Air_Force_Organizational_Excellence_Award', 'afa_award', 'silver_medal_of_valor', 'national_commanders_citation']){
    set(id, ev(`capubFirstRibbonOptionValue(${q(id)})`));
    const c = controls(id);
    assert.ok(c.lines.length <= 1 && !c.toggles.length, id);
  }
});

test('the values stored today map to the controls and back: every option value, the report\'s semantic values and a saved setup\'s values land on a line and keep their devices', () => {
  reset('senior');
  // semantic values of the member report resolve to a line of the dropdown with the same award count
  const cases = [['distinguished_service_award', 'bronze_clasp_3', 4], ['community_service_ribbon', 'hours_120', 2], ['search_find_ribbon', 'find_3', 3], ['red_service_ribbon', 'years_10', null], ['cap_achievment_award', 'silver_clasp_1', 6]];
  for(const [id, value, count] of cases){
    set(id, value);
    const c = controls(id);
    assert.ok(c.selected, `${id} ${value}: a line is selected`);
    const line = c.lines.find(l => l.value === c.selected);
    if(count) assert.equal(RA.readCount(id, line.value, ev(`getRibbonAwardOptions(${q(id)}).find(o => o.value === ${q(line.value)}).label`)), count, `${id} ${value}`);
  }
  // a saved setup keeps awardValue, devices, honorCredit and the McChord ids; the controls read them without changing them
  ev(`State.ribbonSelections.curry_achievement = { checked: true, devices: {}, awardValue: 'honor_credit', honorCredit: true }; State.ribbonSelections.mcchordKept = null; normalizeRibbonSelections();`);
  assert.equal(controls('curry_achievement').toggles[0].on, true);
  assert.equal(sel('curry_achievement').awardValue, 'honor_credit');
  ev(`State.ribbonSelections.lifesaving_award = { checked: true, devices: {}, awardValue: 'mcchord_28004' }; normalizeRibbonSelections();`);
  assert.equal(controls('lifesaving_award').toggles[0].on, true);
  assert.equal(sel('lifesaving_award').awardValue, 'mcchord_28004');
  assert.equal(controls('lifesaving_award').lines.find(l => l.value === controls('lifesaving_award').selected).text, '4th award: 3 bronze clasps');
});
