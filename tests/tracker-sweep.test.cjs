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

// ---- ribbons repeated by the bronze clasp -----------------------------------------------------------------------

test('the Crisis Service Ribbon is earned once a service period and a later period adds a bronze clasp (39-3, Crisis Service Ribbon)', () => {
  ev("State.membership = 'senior'");
  const options = ev("getRibbonAwardOptions('crisis_ribbon').filter(o => o.value)");
  assert.ok(options.length >= 3);
  options.forEach((o, i) => {
    const parts = RA.resolve('crisis_ribbon', { awardValue: o.value, awardLabel: o.label });
    assert.equal(parts.length, 1);
    assert.deepEqual(parts[0].devices, Array(i).fill('device-clasp-bronze'), o.label);
  });
  // An imported 'earned' selection is the first period.
  assert.equal(ev("getRibbonSelectionOption('crisis_ribbon', 'earned').value"), options[0].value);
});

test('the IACE ribbon and the annual cadet awards take a bronze clasp for each later award, a silver clasp for five (39-3 6b)', () => {
  for(const id of ['iace_ribbon', 'afa_award', 'afsa_award', 'vfw_officer_award', 'vfw_nco_award']){
    ev("State.membership = 'cadet'");
    const options = ev(`getRibbonAwardOptions('${id}').filter(o => o.value)`);
    assert.ok(options.length > 5, `${id}: more than one choice`);
    const devices = n => RA.resolve(id, { awardValue: options[n - 1].value, awardLabel: options[n - 1].label })[0].devices;
    assert.deepEqual(devices(1), []);
    assert.deepEqual(devices(2), ['device-clasp-bronze']);
    assert.deepEqual(devices(6), ['device-clasp-silver']);
    assert.deepEqual(devices(7), ['device-clasp-silver', 'device-clasp-bronze']);
  }
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
