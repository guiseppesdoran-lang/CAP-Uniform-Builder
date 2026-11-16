// Where the uniform preview gets the artwork manifest and specs from (LIVE13 E65).
//
// In the source tree PACKS is null: the manifest is images/MANIFEST.json and each spec is its own file, both revalidated
// on every load because artwork is edited in place. scripts/build-site.cjs replaces PACKS in the built site with the index
// scripts/build-asset-packs.cjs writes: a manifest of just the rows the page reads, and one pack per uniform and cut
// holding the specs the engine loads to draw it. The engine asks for specs one after another, so a uniform drawn from its pack costs
// one request instead of a round trip per spec. A spec the pack does not hold is fetched on its own, as in the source tree.
// Packs carry the artwork version in their URL (ASSET's ?v=), so the browser may keep them.
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.CAPUBAssetPacks = api;
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';
  const PACKS = null;

  // getJson(path, cacheMode) resolves to the parsed JSON of an artwork path (relative to images/), or null when missing.
  function createLoader(getJson, packs = PACKS){
    const loaded = new Map();   // pack file -> Promise<{specs}|null>
    let ready = Promise.resolve();
    const specs = new Map();    // spec path -> spec JSON, from every pack loaded so far

    function manifest(){
      if(packs && packs.manifest){
        return getJson(packs.manifest).then(m => m || getJson('MANIFEST.json', 'no-cache')).then(m => {
          if(!m) throw new Error('MANIFEST.json missing');
          return m;
        });
      }
      return getJson('MANIFEST.json', 'no-cache').then(m => { if(!m) throw new Error('MANIFEST.json missing'); return m; });
    }

    // Starts loading the pack of the uniform in that cut ('male' or 'female'); specs asked for meanwhile wait for it.
    // Never rejects.
    function prepare(uniform, gender){
      const file = packs && packs.uniforms && packs.uniforms[`${uniform}-${gender === 'female' ? 'female' : 'male'}`];
      if(!file) return Promise.resolve(null);
      if(!loaded.has(file)){
        const p = Promise.resolve().then(() => getJson(file)).catch(() => null).then(pack => {
          if(pack && pack.specs) for(const k of Object.keys(pack.specs)) if(!specs.has(k)) specs.set(k, pack.specs[k]);
          return pack;
        });
        loaded.set(file, p);
        ready = Promise.all([ready, p]).then(() => undefined);
      }
      return loaded.get(file);
    }

    function spec(specPath){
      return ready.then(() => specs.has(specPath) ? specs.get(specPath) : getJson(specPath, 'no-cache'));
    }

    return { manifest, prepare, spec, enabled: !!(packs && packs.manifest) };
  }

  return { createLoader, PACKS };
});
