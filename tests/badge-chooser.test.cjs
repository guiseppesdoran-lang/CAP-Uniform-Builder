'use strict';
// LIVE-DRESS B2 (Ethan: "if multiple applicable badges are selected in one area a ui should pop up to make you choose which one you want
// displayed"). The engine reports each position that has more badges selected than it takes (scene.conflicts: { position, label, limit,
// candidates, shown, choice }); the member's pick (build.badgeChoices, kept per uniform and position in State.badgeChoices and saved with the
// setup) decides which is shown, instead of the first listed. The Badges panel (js/uniform-view.js) renders a radio per candidate.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

const PILOT = 'CAPPilot1_FA9D33EA587D8', OBSERVER = 'observer_badge', GT = 'ground_team_basic_badge', EMT = 'emt_basic_badge', MED = 'medical_officer';
const build = (choices, badgeIds, uniform) => Object.assign(HARNESS.makeBuild({ uniform: uniform || 'blues_a', gender: 'male', membership: 'senior', rank: 'Capt', badgeIds }), { badgeChoices: choices || {} });
const shownBadges = scene => scene.layers.filter(l => l.role === 'badge').map(l => l.key.replace(/^badge:/, ''));

test('three aviation badges selected: the scene reports the position with every candidate and the one shown; the member\'s pick is honoured', async () => {
  const ids = [PILOT, 'SeniorPilot1_D9725AE959752', OBSERVER, 'MasterObserver1_1B88D5071FD5C'];
  const first = await P.composeUniform(build({}, ids), store);
  const c = first.conflicts.find(x => x.position === 'aviation');
  assert.ok(c, 'an aviation conflict is reported');
  assert.equal(c.limit, 1);
  assert.ok(c.candidates.length >= 2 && c.candidates.every(x => x.id && x.title), 'candidates carry id and title');
  assert.deepEqual(c.shown, [c.candidates[0].id], 'by default the first listed is shown');
  assert.equal(c.choice, null);
  assert.ok(first.notes.some(n => /Only one CAP aviation badge is worn/.test(n)), 'the note is kept');
  for(const cand of c.candidates){
    const scene = await P.composeUniform(build({ aviation: cand.id }, ids), store);
    const sc = scene.conflicts.find(x => x.position === 'aviation');
    assert.deepEqual(sc.shown, [cand.id], `${cand.id} is the one shown`);
    assert.equal(sc.choice, cand.id);
    const aviation = shownBadges(scene).filter(id => c.candidates.some(x => x.id === id));
    assert.deepEqual(aviation, [cand.id], 'only the chosen aviation badge is drawn');
  }
});

test('a choice for a badge that is not a candidate is ignored; no conflict, no report', async () => {
  const scene = await P.composeUniform(build({ aviation: 'not_a_badge' }, [PILOT, OBSERVER]), store);
  const c = scene.conflicts.find(x => x.position === 'aviation');
  assert.equal(c.choice, null);
  assert.deepEqual(c.shown, [PILOT]);
  const one = await P.composeUniform(build({ aviation: OBSERVER }, [PILOT]), store);
  assert.deepEqual(one.conflicts, [], 'one aviation badge: nothing to choose');
});

test('over the left pocket: two are worn; the member\'s pick goes first and the rule\'s order fills the other place', async () => {
  const ids = [PILOT, GT, EMT, MED];
  const def = await P.composeUniform(build({}, ids), store);
  const c = def.conflicts.find(x => x.position === 'over-pocket');
  assert.ok(c && c.limit === 2);
  assert.deepEqual(c.shown, [PILOT, GT], 'the aviation badge, then the first occupational one');
  assert.deepEqual(shownBadges(def).filter(id => [PILOT, GT, EMT, MED].includes(id)).sort(), [GT, PILOT].sort());
  const picked = await P.composeUniform(build({ 'over-pocket': EMT }, ids), store);
  assert.deepEqual(picked.conflicts.find(x => x.position === 'over-pocket').shown, [EMT, PILOT]);
  assert.deepEqual(shownBadges(picked).filter(id => [PILOT, GT, EMT, MED].includes(id)).sort(), [EMT, PILOT].sort());
});

test('one service badge is worn: the pick decides which', async () => {
  const ids = ['senior_advisory_group_badge', 'command_council_badge'];
  const def = await P.composeUniform(build({}, ids), store);
  const c = def.conflicts.find(x => x.position === 'service');
  assert.ok(c, 'the service position is reported');
  const other = c.candidates.map(x => x.id).find(id => id !== c.shown[0]);
  const scene = await P.composeUniform(build({ service: other }, ids), store);
  assert.deepEqual(scene.conflicts.find(x => x.position === 'service').shown, [other]);
  assert.ok(shownBadges(scene).includes(other) && !shownBadges(scene).includes(c.shown[0]));
});

// ---- the page: the choice lives in State per uniform and position, and is saved with the setup -------------------------------------

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
  for(const src of sources){
    try{ vm.runInContext(read(src), context, { filename: src }); }
    catch(error){ /* the scripts that bootstrap the DOM throw under the stub; the functions are defined by then */ }
  }
  return code => vm.runInContext(code, context);
}

const ev = loadPage();

test('State.badgeChoices exists, is saved with the setup and comes back through the profile loader (known uniforms, positions and badges only)', () => {
  assert.equal(ev('JSON.stringify(State.badgeChoices)'), '{}');
  ev(`State.membership = 'senior'; State.gender = 'male'; State.rank = 'Capt'; State.uniform = 'blues_a'; State.badgeChoices = { blues_a: { aviation: '${OBSERVER}', 'over-pocket': '${EMT}' }, mess_dress: { aviation: '${PILOT}' } }`);
  const saved = JSON.parse(ev('JSON.stringify(CAPUB_V2.collectProfile())'));
  assert.deepEqual(saved.badgeChoices, { blues_a: { aviation: OBSERVER, 'over-pocket': EMT }, mess_dress: { aviation: PILOT } }, 'collected with the setup');
  // load it back (a file someone sent is untrusted: unknown uniforms, positions and badge ids are dropped)
  saved.badgeChoices.bogus_uniform = { aviation: PILOT };
  saved.badgeChoices.blues_a.bogus_position = PILOT;
  saved.badgeChoices.blues_a.service = '<script>';
  ev('State.badgeChoices = {}');
  try{ ev(`CAPUB_V2.applyProfile(${JSON.stringify(saved)})`); }catch(_){ /* the DOM-driven refresh throws under the stub; State was set before it */ }
  assert.deepEqual(JSON.parse(ev('JSON.stringify(State.badgeChoices)')), { blues_a: { aviation: OBSERVER, 'over-pocket': EMT }, mess_dress: { aviation: PILOT } });
});

test('the page hands the engine the choices of the uniform being drawn, and the chooser is wired to the radios', () => {
  const src = read('js/uniform-view.js');
  assert.match(src, /badgeChoices: Object\.assign\(\{\}, \(State\.badgeChoices \|\| \{\}\)\[State\.uniform\] \|\| \{\}\)/);
  assert.match(src, /type = 'radio'/);
  assert.match(src, /createElement\('fieldset'\)/);
  assert.match(src, /createElement\('legend'\)/);
  assert.match(src, /updateBadgeChooser\(scene\)/);
  const css = read('styles/app.css');
  assert.match(css, /\.badgeChooserGroup\{/);
  assert.doesNotMatch(css.slice(css.indexOf('.badgeChooser{')), /#[0-9a-fA-F]{3,6}\b/, 'the chooser takes its colours from the tokens');
});
