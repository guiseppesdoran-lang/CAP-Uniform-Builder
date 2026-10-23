'use strict';// Every badge the picker offers has a thumbnail that exists in images/. The catalog names each badge's
// artwork by asset id (and each level of STEM, Cyber and NRA its own); the page resolves an id to a file
// through data/asset-index.js; the picker tile asks getBadgeAssetPath for the file. A badge with no field
// form (STEM, Cyber, Model Rocketry, NRA, the service badges) used to show a broken image on the OCP, ABU
// and the other field uniforms, because the field-uniform path fell through to a file that does not exist.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CAT = require('../data/badge-catalog.js');
const INDEX = (() => { const g = {}; new Function('window', 'globalThis', 'self', read('data/asset-index.js'))(g, g, g); return g.CAPUBAssetIndex; })();
const exists = rel => fs.existsSync(path.join(ROOT, 'images', rel));

test('every badge-catalog entry and every level variant resolves to an existing file in images/', () => {
  const missing = [];
  for(const [id, b] of Object.entries(CAT.BADGES)){
    const arts = new Set([b.dress, b.field, b.cloth, b.mini].filter(Boolean));
    for(const lv of b.levels || []) arts.add(lv[2]);
    assert.ok(arts.size, `${id} names no artwork`);
    for(const art of arts){
      if(!INDEX[art] || !exists(INDEX[art])) missing.push(`${id}: ${art}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('the cadet-only badges (STEM, Cyber, Model Rocketry, NRA) name dress art and a level resolves to its own file', () => {
  for(const id of CAT.CADET_ONLY){
    const b = CAT.get(id);
    assert.ok(INDEX[b.dress] && exists(INDEX[b.dress]), `${id} dress art`);
    for(const lv of CAT.levels(id) || []){
      assert.equal(CAT.art(id, 'dress', lv[0]), lv[2], `${id} ${lv[0]}`);
      assert.ok(INDEX[lv[2]] && exists(INDEX[lv[2]]), `${id} ${lv[0]} file`);
    }
  }
  assert.deepEqual(CAT.levels('stem_badges').map(l => l[0]), ['basic', 'advanced', 'master']);
  assert.deepEqual(CAT.levels('cyber_badges').map(l => l[0]), ['basic', 'advanced', 'master']);
  assert.equal(CAT.levels('nra_marksman_badge').length, 6);
  assert.equal(CAT.levels('model_rocketry_badge'), null);
});

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

test('the picker tile of every badge has an existing thumbnail on every uniform, for cadets and seniors', () => {
  const uniforms = ev('Object.keys(UNIFORMS)');
  assert.ok(uniforms.length >= 12);
  const bad = [];
  for(const membership of ['cadet', 'senior']){
    for(const u of uniforms){
      ev(`State.membership = '${membership}'; State.uniform = '${u}'; State.badgeSelections = {}`);
      for(const id of ev('getEligibleBadgeIdsForMembership(State.membership)')){
        const levels = CAT.levels(id) || [null];
        for(const lv of levels){
          ev(`State.badgeSelections['${id}'] = { checked: false, level: ${lv ? `'${lv[0]}'` : 'undefined'} }`);
          const p = ev(`getBadgeAssetPath('${id}')`);
          if(!exists(p)) bad.push(`${membership}/${u}/${id}${lv ? '/' + lv[0] : ''}: ${p}`);
        }
      }
    }
  }
  assert.deepEqual(bad, []);
});
