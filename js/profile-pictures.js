// The pictures of the Uniform step's choices (js/profile-pickers.js shows them), made from the engine's own art, so a picture is what the builder draws for
// the member and never a second drawing of it.
//
//   const made = create(env);
//   made.uniforms(ids)    { now: { id: picture | null | undefined }, ready: Promise, settled }: one picture for each uniform card
//
// A uniform's picture is the engine's composition of the uniform for the member as they are (their cut, their grade, cadet or senior, the garment choices
// they made) with nothing else on it: no ribbons, badges, patches, name or cord, and no cap, so the garment fills the picture. The coat and the shirt, the
// field uniforms with their sleeves and the blazer beside its shirt are drawn by the page's own code (E.profiles.composeUniform, E.renderSvg.buildSvg) and
// shown as an image. Ceremonials is the Service Dress coat or the Blue Service shirt with the white pistol belt, the white ascot and the silver cord the
// engine puts on it. A picture is kept for the member and choices it was made for (the newest ones; the rest are let go), so a change of grade or cut
// makes only the pictures it changes.
//
// Loads as a classic script (window.CAPUBProfilePictures) and as a CommonJS module for the Node tests, which give `create` an environment of their own.
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.CAPUBProfilePictures = api;
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  // ---- the uniforms -----------------------------------------------------------------------------------------------------------------

  const PAD = 0.15;     // inches of white around the garment in a picture
  const KEEP = 80;      // pictures kept: the newest
  // What the member's ribbon rack asks of the drawing: nothing a bare garment uses.
  const RACK = ['rackColumns', 'rackAlign', 'rackArrangement', 'rackCounts', 'miniStyle'];

  // The Honor Guard Uniform on the garment it rides on: the coat's Class A unless the member is on the shirt's Class B, the role and the chinstrap the member
  // chose or the guidance figure's own (what js/uniform-view.js ceremonialFromState gives the engine).
  function ceremonialOf(rules, base){
    const c = rules.CEREMONIAL;
    const opt = base.opt || {};
    const uniform = Object.values(c.bases).includes(base.uniform) ? base.uniform : rules.ceremonialBase('coat');
    return {
      uniform,
      ceremonial: {
        role: c.roles.includes(opt.cerRole) ? opt.cerRole : c.roles[0],
        chinstrap: c.chinstraps.includes(opt.chinstrap) ? opt.chinstrap : rules.ceremonialChinstrap(uniform, opt.sleeve)
      }
    };
  }

  // The member as they are, without what they chose elsewhere: the garment, the grade and the garment choices stay; the items, the name, the cord and the cap go.
  function bare(rules, base, over){
    const o = over || {};
    const build = Object.assign({}, base, {
      uniform: o.uniform || base.uniform, gender: o.gender || base.gender,
      ribbons: [], medals: [], badges: [], badgeChoices: {}, badgeOrder: {}, patches: [], militaryBadges: [], command: null, cord: null, cordColour: null,
      name: { first: '', last: '', state: '', show: false }
    });
    delete build.ceremonial;
    delete build.cordOnTop;
    build.opt = Object.assign({}, base.opt, { headgear: 'none' });
    for(const k of RACK) delete build.opt[k];
    if(o.ceremonial){
      const c = ceremonialOf(rules, base);
      build.uniform = c.uniform;
      build.ceremonial = c.ceremonial;
      build.cord = rules.CEREMONIAL.cord;
      build.cordOnTop = true;
    }
    return build;
  }

  // The scene as the picture shows it: what the engine drew, without the white patches it lays where an overlay will go and any measuring layer.
  const framed = scene => Object.assign({}, scene, { layers: scene.layers.filter(l => l.type !== 'clear' && l.type !== 'measure') });

  function create(env){
    const cache = new Map();   // key -> { value, promise }; the newest last
    function drop(){
      while(cache.size > KEEP){
        const [key, old] = cache.entries().next().value;
        cache.delete(key);
        if(env.release && typeof old.value === 'string') env.release(old.value);
      }
    }
    // The picture of one uniform for the member as they are: { value, promise }, `value` set once it is made (null when it could not be).
    function picture(base, over){
      const build = bare(env.rules, base, over);
      const key = JSON.stringify(build);
      let hit = cache.get(key);
      if(hit){ cache.delete(key); cache.set(key, hit); return hit; }
      hit = { value: undefined };
      hit.promise = Promise.resolve()
        .then(() => env.compose(build))
        .then(scene => env.draw(framed(scene), PAD))
        .catch(error => { if(env.warn) env.warn(`The picture of ${build.uniform} could not be made`, error); return null; })
        .then(url => { hit.value = url; return url; });
      cache.set(key, hit);
      drop();
      return hit;
    }
    function member(){
      try{ return env.build(); }catch(error){ return null; }
    }
    // The pictures of a list of choices, each by the way `make` asks of `picture`.
    function pictures(keys, make){
      const base = member();
      const none = Object.fromEntries(keys.map(k => [k, null]));
      if(!base || !keys.length) return { now: none, ready: Promise.resolve(none), settled: true };
      const hits = keys.map(k => [k, picture(base, make(k))]);
      const now = Object.fromEntries(hits.map(([k, h]) => [k, h.value]));
      const settled = hits.every(([, h]) => h.value !== undefined);
      const ready = Promise.all(hits.map(([, h]) => h.promise)).then(urls => Object.fromEntries(keys.map((k, i) => [k, urls[i]])));
      return { now, ready, settled };
    }
    return {
      // `ids` are the uniform cards ('ceremonial' among them): the card's id is the uniform, Ceremonials the honor guard items on the coat or the shirt.
      uniforms: ids => pictures(ids, id => id === env.rules.CEREMONIAL.id ? { ceremonial: true } : { uniform: id })
    };
  }

  return { create, bare, PAD };
});
