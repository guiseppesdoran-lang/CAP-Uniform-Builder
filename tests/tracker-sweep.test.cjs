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
