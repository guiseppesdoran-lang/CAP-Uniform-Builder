'use strict';
// CER (owner, 2026-11-11: "Ceremonials. Add that as a selectable uniform, and generate all applicable artwork"): the page side of the Honor Guard Uniform (CAPR 39-1 9.6). It is the
// Service Dress or the Blue Service uniform with the honor guard items put on, so State.uniform stays 'blues_a' or 'blues_b' and every rule and drawing of that uniform applies to it
// unchanged; State.ceremonial says the items are on. Offered to cadets and hidden, not greyed, for a senior member. Chosen by picture: what it is worn on (the coat, the shirt with short
// sleeves or with long sleeves, which is State.uniform and the sleeve choice the Class B already has), the role (guard or flag bearer), the chinstrap; always worn, not choices: the cap,
// the ascot with its patch, the silver cord, the belt or the sling. The cord picker shows the silver cord as worn and offers no other.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument } = require('./helpers/mini-dom.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const RULES = require('../data/uniform-rules.js');
const OP = require('../js/option-pictures.js');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

// ---- the card ---------------------------------------------------------------------------------------------------------------------

test('the Uniform step has one card for it, called Ceremonials, for cadets, right after Class B', () => {
  const html = read('index.html');
  const card = /<button class="uniformOption" data-uniform-id="ceremonial" data-allowed-for="cadet">\s*<div class="uName">([^<]*)<\/div>\s*<div class="uDesc smallText">([^<]*)<\/div>/.exec(html);
  assert.ok(card, 'the card');
  assert.equal(card[1], 'Ceremonials');
  assert.doesNotMatch(card[2], /CAPR|guidance|ruling/i, 'a description, not a rule sentence');
  const ids = [...html.matchAll(/data-uniform-id="([a-z_]+)"/g)].map(m => m[1]);
  assert.equal(ids[ids.indexOf('blues_b') + 1], 'ceremonial');
  assert.equal(ids.filter(id => id === 'ceremonial').length, 1);
});

// The page's own functions for the cards, in a context with fake cards.
function cards(membership, extra){
  const make = id => {
    const classes = new Set(['uniformOption']);
    return { dataset: { uniformId: id }, hidden: false, why: null, classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle(c, on){ if(on) classes.add(c); else classes.delete(c); return on; } }, classes,
      querySelector(sel){ return sel === '.uWhy' ? this.why : null; }, appendChild(n){ this.why = n; }, remove(){} };
  };
  const list = ['blues_a', 'blues_b', 'ceremonial', 'mess_dress', 'aviator', 'ocp'].map(make);
  const uniformListEl = { querySelectorAll: () => list, querySelector: sel => list.find(c => sel.includes(`"${c.dataset.uniformId}"`)) || null };
  const context = Object.assign({ State: Object.assign({ membership, rank: 'C/Maj', adultCadet: false, uniform: 'blues_a', ceremonial: false }, extra), CAPUBUniformRules: RULES, uniformListEl, document: { createElement: () => ({ classList: { add(){} }, set textContent(v){ this.text = v; }, get textContent(){ return this.text; }, remove(){} }) } }, console);
  vm.createContext(context);
  const setup = read('js/setup.js');
  const start = setup.indexOf('function isUniformAllowedFor'), end = setup.indexOf('\n}\n', setup.indexOf('function highlightActiveUniformButton')) + 3;
  vm.runInContext(setup.slice(start, end), context);
  return { context, list, card: id => list.find(c => c.dataset.uniformId === id) };
}

test('a senior member is not offered it at all: its card is hidden, not greyed and not in the fold of what the member may not wear; a cadet sees it', () => {
  const senior = cards('senior');
  senior.context.applyMemberTypeToUniformOptions();
  const c = senior.card('ceremonial');
  assert.equal(c.hidden, true, 'hidden');
  assert.ok(c.classes.has('hidden'));
  assert.ok(!c.classes.has('locked'), 'not locked: the fold of locked cards is for the uniforms the member may not wear');
  assert.ok(senior.card('mess_dress').classes.has('hidden') === false && !senior.card('ocp').classes.has('locked'), 'the other cards are as they were');
  const cadet = cards('cadet');
  cadet.context.applyMemberTypeToUniformOptions();
  assert.equal(cadet.card('ceremonial').hidden, false);
  assert.ok(!cadet.card('ceremonial').classes.has('hidden') && !cadet.card('ceremonial').classes.has('locked'));
  assert.ok(cadet.card('mess_dress').classes.has('locked'), 'a card a cadet may not wear is still locked, with its reason');
});

test('a senior member who has it on (a saved build, a link, a change of membership) falls back to the uniform it rides on, without the items', () => {
  const s = cards('senior', { ceremonial: true, uniform: 'blues_b' });
  s.context.applyMemberTypeToUniformOptions();
  assert.equal(s.context.State.ceremonial, false);
  assert.equal(s.context.State.uniform, 'blues_b', 'the shirt a senior member may wear stays');
  const c = cards('cadet', { ceremonial: true });
  c.context.applyMemberTypeToUniformOptions();
  assert.equal(c.context.State.ceremonial, true, 'a cadet keeps it');
});

test('Ceremonials is never the uniform a member falls back to, and its card is the one lit while it is on', () => {
  const s = cards('cadet');
  assert.equal(s.context.findFirstAllowedUniform('cadet'), 'blues_a');
  const lit = (ceremonial, uniform) => {
    const t = cards('cadet', { ceremonial, uniform });
    t.context.highlightActiveUniformButton();
    return t.list.filter(c => c.classes.has('activeUniform')).map(c => c.dataset.uniformId);
  };
  assert.deepEqual(lit(false, 'blues_b'), ['blues_b']);
  assert.deepEqual(lit(true, 'blues_b'), ['ceremonial'], 'not Class B as well');
  assert.deepEqual(lit(true, 'blues_a'), ['ceremonial']);
});

// ---- the choices, by picture ------------------------------------------------------------------------------------------------------

function panel(state, scene){
  const doc = createDocument();
  const host = doc.createElement('div'); host.id = 'garmentOptions'; doc.body.append(host);
  const section = doc.createElement('section'); section.id = 'garmentOptionsPanel'; doc.body.append(section);
  const calls = [];
  const sandbox = {
    State: Object.assign({ uniform: 'blues_a', ceremonial: true, gender: 'male', membership: 'cadet', rank: 'C/Maj', garment: {}, badges: [] }, state),
    CAPUBEngine: { grades: G }, CAPUBUniformRules: RULES, document: doc, console,
    fullRender(prev){ calls.push(['fullRender', prev]); }, refreshUI(){ calls.push(['refreshUI']); }
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  if(scene) sandbox.CAPUBUniformView = { scene };
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  vm.runInNewContext(read('js/garment-options.js'), sandbox);
  sandbox.CAPUBGarmentOptions.render(true);
  return { sandbox, doc, host, calls, O: sandbox.CAPUBGarmentOptions };
}
const groups = host => host.querySelectorAll('.vp').map(v => v.dataset.name);
const tiles = (host, name) => host.querySelectorAll('.vp').find(v => v.dataset.name === name).querySelectorAll('[role="radio"]');
const labelsOf = (host, name) => tiles(host, name).map(t => t.querySelector('.vpLabel').textContent);
const picked = (host, name) => tiles(host, name).map(t => t.dataset.value + ':' + t.getAttribute('aria-checked'));
const noteOf = (host, name) => host.querySelectorAll('.vp').find(v => v.dataset.name === name).textContent;

test('the choices are four pictures: what it is worn on, the role, the cap (the one cap and none) and the chinstrap; none of the choices a Class B or an ordinary Class A has that cannot apply', () => {
  const p = panel({});
  assert.deepEqual(groups(p.host), ['garmentOpt-wornOn', 'garmentOpt-cerRole', 'garmentOpt-headgear', 'garmentOpt-chinstrap']);
  assert.deepEqual(labelsOf(p.host, 'garmentOpt-wornOn'), ['Service Dress coat', 'Blue shirt, short sleeves', 'Blue shirt, long sleeves']);
  assert.deepEqual(labelsOf(panel({ gender: 'female' }).host, 'garmentOpt-wornOn'), ['Service Dress coat', 'Blue blouse, short sleeves', 'Blue blouse, long sleeves']);
  assert.deepEqual(labelsOf(p.host, 'garmentOpt-cerRole'), ['Guard, white pistol belt', 'Flag bearer, white flag sling']);
  assert.deepEqual(labelsOf(p.host, 'garmentOpt-headgear'), ['Honor Guard cap', 'No headgear'], 'no flight cap, service cap or beret: only what can apply, and "no headgear" as on every dress uniform');
  assert.deepEqual(labelsOf(p.host, 'garmentOpt-chinstrap'), ['Chinstrap up', 'Chinstrap down']);
  assert.equal(p.host.querySelectorAll('select').length, 0, 'pictures, not drop-downs');
  // on the shirt: the sleeve is part of "worn on", the tie and the tie tab are not offered, whatever the sleeves
  for(const sleeve of ['short', 'long']) for(const gender of ['male', 'female']){
    const s = panel({ uniform: 'blues_b', gender, garment: { sleeve } });
    assert.deepEqual(groups(s.host), ['garmentOpt-wornOn', 'garmentOpt-cerRole', 'garmentOpt-headgear', 'garmentOpt-chinstrap'], `${gender} ${sleeve}: no sleeve picker`);
    assert.equal(s.host.querySelectorAll('input').filter(i => /garmentOpt-(tie|tieClasp)$/.test(i.id)).length, 0, `${gender} ${sleeve}: no tie box`);
  }
  // the same shirt outside Ceremonials has its sleeve choice and no honor guard choice
  const plain = panel({ uniform: 'blues_b', ceremonial: false });
  assert.ok(groups(plain.host).includes('garmentOpt-sleeve') && !groups(plain.host).some(g => /wornOn|cerRole|chinstrap/.test(g)));
});

test('what it is worn on is read from, and written to, State.uniform and the sleeve choice: no field of its own', () => {
  const read3 = state => picked(panel(state).host, 'garmentOpt-wornOn');
  assert.deepEqual(read3({ uniform: 'blues_a' }), ['coat:true', 'short:false', 'long:false']);
  assert.deepEqual(read3({ uniform: 'blues_b', garment: { sleeve: 'short' } }), ['coat:false', 'short:true', 'long:false']);
  assert.deepEqual(read3({ uniform: 'blues_b', garment: { sleeve: 'long' } }), ['coat:false', 'short:false', 'long:true']);
  assert.deepEqual(read3({ uniform: 'blues_b' }), ['coat:false', 'short:true', 'long:false'], 'short sleeves until the member picks');
  const p = panel({ uniform: 'blues_a' });
  tiles(p.host, 'garmentOpt-wornOn')[2].click();
  assert.equal(p.sandbox.State.uniform, 'blues_b');
  assert.equal(p.sandbox.State.garment.sleeve, 'long');
  assert.deepEqual(p.calls.find(c => c[0] === 'fullRender'), ['fullRender', 'blues_a'], 'drawn again as a change of uniform, so what follows the uniform follows');
  assert.ok(p.calls.some(c => c[0] === 'refreshUI'));
  assert.equal(p.sandbox.State.ceremonial, true, 'still Ceremonials');
  tiles(p.host, 'garmentOpt-wornOn')[0].click();
  assert.equal(p.sandbox.State.uniform, 'blues_a');
  assert.equal(p.sandbox.State.garment.sleeve, 'long', 'the shirt\'s sleeve choice is kept for the next time');
  assert.deepEqual(Object.keys(p.sandbox.State.garment).sort(), ['sleeve'], 'nothing saved for it but the sleeve');
  // sanitize: the choices a saved build could hold are these; wornOn is not one of them
  const clean = p.O.sanitize({ sleeve: 'long', cerRole: 'flag', chinstrap: 'down', wornOn: 'coat', headgear: 'auto' });
  assert.deepEqual(JSON.parse(JSON.stringify(clean)), { sleeve: 'long', cerRole: 'flag', chinstrap: 'down', headgear: 'auto' });
  assert.deepEqual(JSON.parse(JSON.stringify(p.O.sanitize({ cerRole: 'admiral', chinstrap: 'sideways' }))), {}, 'a value the picker could not have made is dropped');
});

test('the role is a choice of two with the belt as the start; the chinstrap starts at the figure\'s and the member\'s own pick then holds', () => {
  const role = panel({});
  assert.deepEqual(picked(role.host, 'garmentOpt-cerRole'), ['guard:true', 'flag:false']);
  tiles(role.host, 'garmentOpt-cerRole')[1].click();
  assert.equal(role.sandbox.State.garment.cerRole, 'flag');
  const start = state => picked(panel(state).host, 'garmentOpt-chinstrap');
  assert.deepEqual(start({ uniform: 'blues_a' }), ['up:false', 'down:true'], 'down on the coat');
  assert.deepEqual(start({ uniform: 'blues_b', garment: { sleeve: 'long' } }), ['up:false', 'down:true'], 'down with long sleeves');
  assert.deepEqual(start({ uniform: 'blues_b', garment: { sleeve: 'short' } }), ['up:true', 'down:false'], 'up with short sleeves');
  assert.deepEqual(start({ uniform: 'blues_b', garment: { sleeve: 'short', chinstrap: 'down' } }), ['up:false', 'down:true'], 'the member\'s pick holds');
  assert.deepEqual(start({ uniform: 'blues_a', garment: { chinstrap: 'up' } }), ['up:true', 'down:false']);
  const p = panel({ uniform: 'blues_b', garment: { sleeve: 'short' } });
  tiles(p.host, 'garmentOpt-chinstrap')[1].click();
  assert.equal(p.sandbox.State.garment.chinstrap, 'down');
  tiles(p.host, 'garmentOpt-wornOn')[2].click();
  assert.equal(p.sandbox.State.garment.chinstrap, 'down', 'it holds when the garment changes');
});

test('the chinstrap is not offered when no cap is worn', () => {
  const p = panel({ garment: { headgear: 'none' } });
  assert.deepEqual(groups(p.host), ['garmentOpt-wornOn', 'garmentOpt-cerRole', 'garmentOpt-headgear']);
});

test('a senior member sees none of it, and a member off Ceremonials sees the options of the uniform as they were', () => {
  const senior = panel({ membership: 'senior', rank: 'Capt', uniform: 'blues_b', garment: { sleeve: 'long' } });
  assert.deepEqual(groups(senior.host), ['garmentOpt-sleeve', 'garmentOpt-headgear'], 'a senior member on Class B: the sleeve and the headgear, as ever');
  assert.ok(senior.host.querySelectorAll('input').some(i => i.id === 'garmentOpt-tie'), 'and the tie box');
  assert.deepEqual(labelsOf(senior.host, 'garmentOpt-headgear'), ['Flight cap', 'Service cap', 'No headgear']);
  const off = panel({ ceremonial: false, uniform: 'blues_a' });
  assert.deepEqual(groups(off.host), ['garmentOpt-headgear']);
  assert.deepEqual(labelsOf(off.host, 'garmentOpt-headgear'), ['Flight cap', 'Service cap', 'No headgear']);
});

test('the words: each rule sentence states the rule and ends with its paragraph, and names no person, ruling or document', () => {
  const p = panel({});
  const shown = [];
  for(const name of ['garmentOpt-wornOn', 'garmentOpt-cerRole', 'garmentOpt-headgear', 'garmentOpt-chinstrap']){
    const vp = p.host.querySelectorAll('.vp').find(v => v.dataset.name === name);
    shown.push(...vp.querySelectorAll('.vpNote').map(n => n.textContent));
  }
  const src = read('js/garment-options.js');
  const sentences = [...src.matchAll(/'((?:Worn as|All members wear|Flag bearers wear|The male service cap|The black leather|During a performance)[^']*\(CAPR 39-1, 9\.6[0-9.]*(?:, 9\.6[0-9.]*)?\)\.)'/g)].map(m => m[1]);
  assert.equal(sentences.length, 8, 'worn on x3, role x2, the cap, chinstrap x2');
  for(const s of sentences){
    assert.match(s, /\(CAPR 39-1, 9\.6[0-9.]*(, 9\.6[0-9.]*)?\)\.$/, s);
    assert.doesNotMatch(s, /guidance|Doran|Ethan|owner|ruling|\.pdf|honor guard uniform guidance/i, s);
  }
  assert.ok(shown.length >= 1, 'a note is shown for the choice picked');
});

// ---- the build the page hands the engine ---------------------------------------------------------------------------------------------

const { context, referenceErrors } = loadPageScripts();
const ev = code => { const out = vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context); return out === undefined ? undefined : JSON.parse(out); };
const member = (extra = '') => ev(`State.membership = 'cadet'; State.gender = 'female'; State.rank = 'C/Maj'; State.uniform = 'blues_a'; State.ceremonial = false; State.garment = {}; State.shoulderCord = null; ${extra} return true;`);
const built = () => ev('const b = CAPUBUniformView.buildFromState(); return { uniform: b.uniform, ceremonial: b.ceremonial, cord: b.cord, cordColour: b.cordColour, cordOnTop: b.cordOnTop, keys: Object.keys(b), opt: { sleeve: b.opt.sleeve, headgear: b.opt.headgear } };');

test('the page loads', () => assert.deepEqual(referenceErrors, []));

test('Ceremonials hands the engine the role, the chinstrap, the silver cord and the switch that lays it over the epaulet; no other uniform does', () => {
  member('State.ceremonial = true;');
  let b = built();
  assert.equal(b.uniform, 'blues_a', 'the uniform it rides on');
  assert.deepEqual(b.ceremonial, { role: 'guard', chinstrap: 'down' });
  assert.equal(b.cord, 'honor_guard');
  assert.equal(b.cordColour, null);
  assert.equal(b.cordOnTop, true);
  member('State.ceremonial = true; State.uniform = "blues_b"; State.garment = { sleeve: "short" };');
  assert.deepEqual(built().ceremonial, { role: 'guard', chinstrap: 'up' }, 'up with short sleeves');
  member('State.ceremonial = true; State.uniform = "blues_b"; State.garment = { sleeve: "short", chinstrap: "down", cerRole: "flag" };');
  assert.deepEqual(built().ceremonial, { role: 'flag', chinstrap: 'down' }, 'the member\'s picks');
  // the member's own cord stays chosen, and is what the other uniforms draw
  member('State.shoulderCord = "wing"; State.ceremonial = true;');
  assert.equal(built().cord, 'honor_guard');
  assert.equal(ev('return State.shoulderCord;'), 'wing', 'kept');
  member('State.shoulderCord = "wing";');
  b = built();
  assert.equal(b.cord, 'wing', 'the cord of the member outside Ceremonials');
  assert.ok(!b.keys.includes('ceremonial') && !b.keys.includes('cordOnTop'), 'no honor guard field, no switch');
  // every other uniform, cadet or senior: never the switch
  for(const uniform of ['blues_a', 'blues_b', 'semi_formal_usaf', 'abu', 'ocp', 'flight_suit']){
    member(`State.uniform = '${uniform}'; State.shoulderCord = 'honor_guard';`);
    assert.equal(built().cordOnTop, undefined, `${uniform}: the switch is off`);
  }
  for(const uniform of ['mess_dress', 'semi_formal', 'aviator', 'aviator_blazer', 'polo', 'corporate_field', 'corporate_flight_suit']){
    member(`State.membership = 'senior'; State.rank = 'Capt'; State.uniform = '${uniform}'; State.shoulderCord = 'aide_de_camp';`);
    assert.equal(built().cordOnTop, undefined, `${uniform}: the switch is off`);
  }
  const view = read('js/uniform-view.js');
  assert.equal([...view.matchAll(/cordOnTop/g)].length, 1, 'the page writes the switch in one place');
  assert.match(view, /ceremonial \? \{\s*\/\/[^\n]*\n\s*ceremonial,\s*cordOnTop: true\s*\} : \{\}/, 'and only beside the ceremonial build');
});

test('a senior member, a uniform that is not Class A or B, or no Ceremonials: the engine is asked for none of it', () => {
  member('State.ceremonial = true; State.membership = "senior"; State.rank = "Capt";');
  assert.equal(built().ceremonial, undefined);
  member('State.ceremonial = true; State.uniform = "ocp";');
  assert.equal(built().ceremonial, undefined);
  member('State.ceremonial = true; State.uniform = "semi_formal_usaf";');
  assert.equal(built().ceremonial, undefined);
  member('');
  assert.equal(built().ceremonial, undefined);
});

// ---- saved, shared, loaded ------------------------------------------------------------------------------------------------------------

test('Ceremonials is saved with the setup, comes back as it was, and a setup from before it existed loads without it', () => {
  member('State.ceremonial = true; State.uniform = "blues_b"; State.garment = { sleeve: "long", cerRole: "flag", chinstrap: "up" };');
  const saved = ev('return CAPUB_V2.collectProfile();');
  assert.equal(saved.ceremonial, true);
  assert.equal(saved.uniform, 'blues_b');
  assert.deepEqual(saved.garment, { sleeve: 'long', cerRole: 'flag', chinstrap: 'up' }, 'its choices are in the garment choices');
  ev('State.ceremonial = false; State.uniform = "blues_a"; State.garment = {};');
  ev(`try{ CAPUB_V2.applyProfile(${JSON.stringify(saved)}); }catch(_){ } return true;`);
  assert.equal(ev('return State.ceremonial;'), true);
  assert.equal(ev('return State.uniform;'), 'blues_b');
  assert.deepEqual(ev('return State.garment;'), { sleeve: 'long', cerRole: 'flag', chinstrap: 'up' });
  assert.equal(ev('return CAPUB_V2.collectProfile().ceremonial;'), true, 'saves again the same');
  // before it existed
  const old = JSON.parse(JSON.stringify(saved)); delete old.ceremonial; old.garment = { sleeve: 'long' };
  ev('State.ceremonial = true;');
  ev(`try{ CAPUB_V2.applyProfile(${JSON.stringify(old)}); }catch(_){ } return true;`);
  assert.equal(ev('return State.ceremonial;'), false, 'a setup saved before it existed draws as it did');
  assert.equal(ev('return CAPUB_V2.collectProfile().ceremonial;'), false);
});

test('a setup that names it for a senior member, on another uniform, or with a value that is not true loads without it', () => {
  const profile = (o) => Object.assign({ version: '2026-05-08-v2', membership: 'cadet', gender: 'male', uniform: 'blues_a', rank: 'C/Maj', ceremonial: true }, o);
  const load = p => { ev('State.ceremonial = false;'); ev(`try{ CAPUB_V2.applyProfile(${JSON.stringify(p)}); }catch(_){ } return true;`); return ev('return State.ceremonial;'); };
  assert.equal(load(profile({})), true);
  assert.equal(load(profile({ membership: 'senior', rank: 'Capt' })), false, 'a senior member');
  assert.equal(load(profile({ uniform: 'ocp' })), false, 'not on the coat or the shirt');
  assert.equal(load(profile({ uniform: 'semi_formal_usaf' })), false);
  for(const junk of ['true', 1, 'yes', {}, [], null]) assert.equal(load(profile({ ceremonial: junk })), false, JSON.stringify(junk));
});

test('the Check list says the white gloves are worn and not drawn, with the paragraph; and says nothing of them outside Ceremonials', () => {
  member('State.ceremonial = true;');
  const lines = ev('return CAPUB_V2.validateBuild().map(n => n.msg);');
  assert.ok(lines.some(l => /gloves/i.test(l) && /not shown on the drawing/.test(l) && /\(CAPR 39-1, 9\.6\.7\.7\)\.$/.test(l)), lines.join(' | '));
  member('');
  assert.ok(!ev('return CAPUB_V2.validateBuild().map(n => n.msg);').some(l => /gloves/i.test(l)));
});

test('the Check list tells a woman on the Blue Service that slacks are worn and not drawn (the blouse sheets draw a skirt), and tells nobody else', () => {
  const slacks = lines => lines.filter(l => /slacks/i.test(l));
  member('State.ceremonial = true; State.uniform = "blues_b";');
  const women = slacks(ev('return CAPUB_V2.validateBuild().map(n => n.msg);'));
  assert.equal(women.length, 1, women.join(' | '));
  assert.match(women[0], /^Female members wear only slacks with this uniform; the blouse is drawn over its skirt, and slacks are not drawn yet \(CAPR 39-1, 9\.6\.7\.3\)\.$/);
  member('State.ceremonial = true; State.uniform = "blues_a";');
  assert.deepEqual(slacks(ev('return CAPUB_V2.validateBuild().map(n => n.msg);')), [], 'the coat sheet draws no skirt');
  member('State.ceremonial = true; State.uniform = "blues_b"; State.gender = "male";');
  assert.deepEqual(slacks(ev('return CAPUB_V2.validateBuild().map(n => n.msg);')), [], 'the men\'s shirt is drawn over trousers');
  member('State.uniform = "blues_b";');
  assert.deepEqual(slacks(ev('return CAPUB_V2.validateBuild().map(n => n.msg);')), [], 'and outside Ceremonials');
});

// ---- the cord ---------------------------------------------------------------------------------------------------------------------

test('the cord picker shows the silver cord as worn and offers no other, and the member\'s own choice is kept', () => {
  member('State.ceremonial = true; State.shoulderCord = "wing";');
  const options = ev('return capubShoulderCordOptions();');
  assert.deepEqual(options.map(o => o.value), ['honor_guard'], 'one cord, no "no cord", no supplement cords, no colours');
  assert.match(options[0].mark, /Worn with this uniform/);
  assert.match(options[0].picture, /^<svg /, 'a picture of the cord');
  assert.match(options[0].note, /^Metallic silver, Army-style, worn on the left shoulder at the seam on top of the epaulet \(CAPR 39-1, 9\.6\.7\.5\)\.$/);
  assert.equal(ev('return capubCordIsFixed();'), true);
  ev('capubPickShoulderCord("group"); return true;');
  assert.equal(ev('return State.shoulderCord;'), 'wing', 'a pick does not change the member\'s cord');
  member('State.shoulderCord = "wing";');
  const normal = ev('return capubShoulderCordOptions();');
  assert.ok(normal.length > 7 && normal.some(o => o.value === 'wing') && normal[0].value === '', 'outside Ceremonials the choices are as they were');
  member('State.ceremonial = true; State.membership = "senior"; State.rank = "Capt";');
  assert.equal(ev('return capubCordIsFixed();'), false, 'a senior member is offered it not');
});

// ---- the pictures -------------------------------------------------------------------------------------------------------------------

const penv = { core, build: () => { throw new Error('the tests give the build'); }, compose: b => P.composeUniform(b, store), spec: id => store.load(id), entry: id => store.entry(id), url: p => 'images/' + p, empty: () => '<svg id="empty"></svg>' };
const cadet = (uniform, gender, extra) => Object.assign({
  uniform, gender, membership: 'cadet', grade: G.gradeInfo('cadet', 'C/Maj', {}), opt: { headgear: 'auto' },
  name: { first: 'Pat', last: 'Doe', show: true }, ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null,
  ceremonial: { role: 'guard', chinstrap: 'down' }, cordOnTop: true
}, extra || {});
const idsOf = spec => spec.scene.layers.filter(l => l.type === 'asset').map(l => l.id);

test('the pictures are made from what the engine draws: the three garments, the belt and the sling, the cap with its strap up and down', async () => {
  for(const gender of ['male', 'female']){
    const sheets = gender === 'male' ? ['garment-blues-class-a-coat', 'garment-blues-class-b-shirt-male', 'garment-blues-class-b-shirt-male-long'] : ['garment-blues-class-a-coat-female', 'garment-blues-class-b-blouse-female', 'garment-blues-class-b-blouse-female-long'];
    const worn = await OP.RECIPES.wornOn.make(penv, cadet('blues_a', gender), ['coat', 'short', 'long']);
    ['coat', 'short', 'long'].forEach((v, i) => {
      const ids = idsOf(worn[v]);
      assert.ok(ids.includes(sheets[i]), `${gender} ${v}: the garment`);
      assert.ok(ids.includes(`${sheets[i]}-honor-guard-belt`) && ids.includes(`${sheets[i]}-honor-guard-ascot`), `${gender} ${v}: with the belt and the ascot`);
      assert.ok(!ids.some(id => /^hat-/.test(id)), `${gender} ${v}: no cap in it`);
    });
    const role = await OP.RECIPES.cerRole.make(penv, cadet('blues_b', gender, { opt: { headgear: 'auto', sleeve: 'long' } }), ['guard', 'flag']);
    const sheet = sheets[2];
    assert.ok(idsOf(role.guard).includes(`${sheet}-honor-guard-belt`) && !idsOf(role.guard).includes(`${sheet}-honor-guard-flag-sling`));
    assert.ok(idsOf(role.flag).includes(`${sheet}-honor-guard-flag-sling`) && !idsOf(role.flag).includes(`${sheet}-honor-guard-belt`));
    const cap = await OP.RECIPES.chinstrap.make(penv, cadet('blues_a', gender), ['up', 'down']);
    assert.ok(idsOf(cap.up).includes('hat-service-cap-honor-guard') && idsOf(cap.up).includes('cap-device-cadet-officer-service'), `${gender}: strap up`);
    assert.ok(idsOf(cap.down).includes('hat-service-cap-honor-guard-chinstrap-down'), `${gender}: strap down`);
  }
  // the cap pictures of the headgear choice are not mistaken for an ordinary Class A's
  const k = OP.RECIPES.headgear.key;
  assert.notDeepEqual(k(cadet('blues_a', 'male')), k(cadet('blues_a', 'male', { ceremonial: undefined })));
});

test('the telemetry counts it as an option the member changed, with no words', () => {
  const src = read('js/telemetry.js');
  assert.match(src, /if\(S\.ceremonial\) options\.ceremonial = true;/);
});
