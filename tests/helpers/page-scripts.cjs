'use strict';
// The page's classic scripts share one global scope, so code that lives in them (the member
// report importer, the garment options, the galleries) is exercised by loading the scripts listed in
// index.html, in order, into one vm context behind a permissive DOM stub.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPageScripts(){
  const ROOT = path.join(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
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
  const referenceErrors = [];
  for(const src of sources){
    try{ vm.runInContext(fs.readFileSync(path.join(ROOT, src), 'utf8'), context, { filename: src }); }
    catch(error){ if(error?.name === 'ReferenceError') referenceErrors.push(src + ': ' + error.message); }
  }
  return { context, referenceErrors };
}

module.exports = { loadPageScripts };
