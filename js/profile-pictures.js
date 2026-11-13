// The pictures of the Profile and Uniform steps' choices (js/profile-pickers.js shows them), made from the engine's own art, so a picture is what the builder
// draws for the member and never a second drawing of it.
//
//   gradeGroups(membership, ranks)    the headings the grades are shown under, in the order of rank: [{ group, ranks }]
//   gradeDevice(G, membership, rank, o)  the insignia the engine draws for a grade as worn on the blues, without cloth: { id, hide }, or null for a grade that
//                                     wears none (C/AB, SM); `hide` are the groups of the asset left off (its backing)
//   gradeArt(G, membership, rank, o)  the asset id of that device
//   gradeName(membership, rank)       the grade's name in words ("Cadet Major")
//   const made = create(env);
//   made.uniforms(ids)                { now: { id: picture | null | undefined }, ready: Promise, settled }: one picture for each uniform card
//   made.cuts()                       { now: { male, female }, ready, settled }: the uniform the member is on, in each cut
//   made.grades(items)                { now: { key: picture | null | undefined }, ready, settled }: the devices of the grades, items [{ key, id, hide }]
//   standalone(markup)                a drawing as a file a browser decodes on its own as an image (see below), or null when nothing was drawn
//
// A uniform's picture is the engine's composition of the uniform for the member as they are (their cut, their grade, cadet or senior, the garment choices
// they made) with nothing else on it: no ribbons, badges, patches, name or cord, and no cap, so the garment fills the picture. The coat and the shirt, the
// field uniforms with their sleeves and the blazer beside its shirt are drawn by the page's own code (E.profiles.composeUniform, E.renderSvg.buildSvg) and
// shown as an image. Honor Guard is the Service Dress coat or the Blue Service shirt with the white pistol belt, the white ascot and the silver cord the
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

  // ---- grades ---------------------------------------------------------------------------------------------------------------------

  // The grades under plain headings, in the order of rank (the order of js/state.js RANKS, which a test compares).
  const GROUPS = {
    cadet: [
      ['Airmen', ['C/AB', 'C/Amn', 'C/A1C', 'C/SrA']],
      ['Non-commissioned officers', ['C/SSgt', 'C/TSgt', 'C/MSgt', 'C/SMSgt', 'C/CMSgt']],
      ['Officers', ['C/2d Lt', 'C/1st Lt', 'C/Capt', 'C/Maj', 'C/Lt Col', 'C/Col']]
    ],
    senior: [
      ['No grade', ['SM']],
      ['Non-commissioned officers', ['SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt']],
      ['Flight officers', ['FO', 'TFO', 'SFO']],
      ['Officers', ['2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col']],
      ['General officers', ['Brig Gen', 'Maj Gen']]
    ]
  };
  const NAMES = {
    'C/AB': 'Cadet Airman Basic', 'C/Amn': 'Cadet Airman', 'C/A1C': 'Cadet Airman First Class', 'C/SrA': 'Cadet Senior Airman', 'C/SSgt': 'Cadet Staff Sergeant',
    'C/TSgt': 'Cadet Technical Sergeant', 'C/MSgt': 'Cadet Master Sergeant', 'C/SMSgt': 'Cadet Senior Master Sergeant', 'C/CMSgt': 'Cadet Chief Master Sergeant',
    'C/2d Lt': 'Cadet Second Lieutenant', 'C/1st Lt': 'Cadet First Lieutenant', 'C/Capt': 'Cadet Captain', 'C/Maj': 'Cadet Major', 'C/Lt Col': 'Cadet Lieutenant Colonel',
    'C/Col': 'Cadet Colonel',
    'SM': 'Senior Member without a grade', 'SSgt': 'Staff Sergeant', 'TSgt': 'Technical Sergeant', 'MSgt': 'Master Sergeant', 'SMSgt': 'Senior Master Sergeant',
    'CMSgt': 'Chief Master Sergeant', 'FO': 'Flight Officer', 'TFO': 'Technical Flight Officer', 'SFO': 'Senior Flight Officer', '2d Lt': 'Second Lieutenant',
    '1st Lt': 'First Lieutenant', 'Capt': 'Captain', 'Maj': 'Major', 'Lt Col': 'Lieutenant Colonel', 'Col': 'Colonel', 'Brig Gen': 'Brigadier General', 'Maj Gen': 'Major General'
  };
  const gradeName = (membership, rank) => NAMES[rank] || String(rank || '');

  // The ranks the select offers, each with its heading; a rank no heading names is shown without one.
  function gradeGroups(membership, ranks){
    const table = GROUPS[membership] || [];
    const list = Array.isArray(ranks) ? ranks : [];
    const out = [];
    for(const [group, members] of table){
      const here = members.filter(r => list.includes(r));
      if(here.length) out.push({ group, ranks: here });
    }
    const named = new Set(table.flatMap(([, members]) => members));
    const rest = list.filter(r => !named.has(r));
    if(rest.length) out.push({ group: '', ranks: rest });
    return out;
  }

  // The insignia the engine draws for a grade on the blues, as the device alone, with no cloth backing: the cadet chevrons and the cadet officers' discs and diamonds
  // in the metal the Class A coat's lapels and boards wear them in (profiles-dress.js composeClassA), the senior officers', flight officers' and generals' insignia in
  // the embroidered thread of the epaulet sleeve (epauletGradeId), and the senior NCO chevron without the navy field it is sewn on (the asset's `field` group, left off
  // as the engine leaves groups off a sheet). `firstSergeant` puts the first sergeant's diamond on a cadet chevron that takes it.
  function gradeDevice(G, membership, rank, options){
    const g = G.gradeInfo(membership, rank, { firstSergeant: !!(options && options.firstSergeant) });
    if(!g.key) return null;
    if(g.category === 'cadet-nco') return { id: G.cadetNcoChevron(g, 'metal'), hide: [] };
    if(g.category === 'cadet-officer') return { id: G.cadetOfficerInsignia(g, 'metal-regular'), hide: [] };
    if(g.category === 'senior-nco') return { id: G.seniorChevron(g, {}), hide: ['field'] };
    // A flight officer's thread bar is a navy bar with silver stripes, and the navy is as dark as the tile: the cloth-bordered sheet's own `thread` group is the same bar's
    // outline and stripes, which is the device, so that sheet is drawn with its `cloth` group left off.
    if(g.category === 'flight-officer') return { id: G.seniorOfficerInsignia(g, 'cloth-bordered', { horizontal: false }), hide: ['cloth'] };
    return { id: G.seniorOfficerInsignia(g, 'thread', { horizontal: false }), hide: [] };
  }
  function gradeArt(G, membership, rank, options){
    const d = gradeDevice(G, membership, rank, options);
    return d ? d.id : null;
  }

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

  // A drawing the page makes with E.renderSvg.buildSvg is made to sit in the page: it carries a class and a role for the page's stylesheet, the engraved lettering's font
  // by a relative address, the sheets' metadata, and no size of its own, only a viewBox in inches. Shown as an image on its own (an object address in an <img>) it must
  // be a document the browser can decode alone, and Safari is the strict one: a drawing with no width and height has the size of its viewBox taken as pixels, and a
  // picture framed on 0.81 in (the C/2d Lt's disc) is then smaller than a pixel and shown as an image that did not load; a font by an address that is not a file of
  // the image is a reference outside it. So the font and the metadata are left out, the namespaces and an XML declaration are there, and the picture has the size of
  // IMAGE_PX on its longer side. A drawing that holds nothing (a sheet that could not be fetched leaves the drawing empty, without an error) is null.
  const IMAGE_PX = 320;
  const fmtPx = n => String(Math.round(n * 100) / 100);
  function standalone(markup){
    let text = String(markup == null ? '' : markup);
    if(!/<(?:use|image)\b/.test(text)) return null;
    text = text.replace(/<metadata\b[\s\S]*?<\/metadata>/g, '').replace(/<style\b[^>]*\bengraved-fonts\b[^>]*>[\s\S]*?<\/style>/g, '');
    const root = /<svg\b[^>]*>/.exec(text);
    const box = root && /\sviewBox="\s*([-+\d.eE]+)[\s,]+([-+\d.eE]+)[\s,]+([-+\d.eE]+)[\s,]+([-+\d.eE]+)\s*"/.exec(root[0]);
    if(!box) return null;
    const w = parseFloat(box[3]), h = parseFloat(box[4]);
    if(!(w > 0) || !(h > 0)) return null;
    const k = IMAGE_PX / Math.max(w, h);
    let tag = root[0].replace(/\s(?:width|height)="[^"]*"/g, '');
    if(!/\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(tag)) tag = tag.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    if(/\sxlink:href=/.test(text) && !/\sxmlns:xlink=/.test(tag)) tag = tag.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    tag = tag.replace('<svg', `<svg width="${fmtPx(w * k)}" height="${fmtPx(h * k)}"`);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + text.replace(root[0], tag);
  }

  // Drawing is tried again when it fails or comes out empty (a fetch of a sheet that is cut off by a busy server or a flaky connection): twice more, a moment apart.
  async function drawn(env, scene, pad){
    let last = new Error('nothing was drawn');
    for(let attempt = 0; attempt < 3; attempt++){
      try{
        const url = await env.draw(scene, pad);
        if(url) return url;
        last = new Error('nothing was drawn');
      }catch(error){ last = error; }
      if(attempt < 2 && env.wait) await env.wait(300 * (attempt + 1));
    }
    throw last;
  }
  // `fn` over the list, a few at a time: a page of thirty pictures does not ask for thirty sheets at once.
  async function inBatches(list, size, fn){
    for(let i = 0; i < list.length; i += size) await Promise.all(list.slice(i, i + size).map(fn));
  }

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
        .then(scene => drawn(env, framed(scene), PAD))
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
    // The devices of grades: each is its asset (with the groups of its backing left off) centred in a square frame that its larger side fills, so a chevron and a single
    // pip are the same size class on the tiles, whichever way each is longer. { now, ready, settled } as for the uniforms.
    const sizes = new Map();   // asset id -> { w, h } in inches
    const sets = new Map();    // the items asked for -> { value, promise }; the newest last
    const KEEP_SETS = 6, MARGIN = 1.08;
    function dropSets(){
      while(sets.size > KEEP_SETS){
        const [key, old] = sets.entries().next().value;
        sets.delete(key);
        if(env.release && old.value) Object.values(old.value).forEach(u => { if(typeof u === 'string') env.release(u); });
      }
    }
    async function drawGrades(list){
      await Promise.all(list.map(async i => { if(!sizes.has(i.id)){ const spec = await env.spec(i.id); sizes.set(i.id, { w: spec.w, h: spec.h }); } }));
      const out = {};
      await inBatches(list, 4, async i => {
        const s = sizes.get(i.id), frame = Math.max(s.w, s.h) * MARGIN;
        const layer = { type: 'asset', id: i.id, x: -s.w / 2, y: -s.h / 2, w: s.w, h: s.h, rotate: 0, origin: { x: 0, y: 0 }, z: 1, role: 'grade', key: 'grade:' + i.id };
        if(i.hide && i.hide.length) layer.hideGroups = [...i.hide];
        const scene = { title: 'Grade', layers: [layer], bounds: { x: -frame / 2, y: -frame / 2, w: frame, h: frame }, notes: [], conflicts: [] };
        out[i.key] = await drawn(env, scene, 0).catch(error => { if(env.warn) env.warn(`The picture of ${i.key} could not be made`, error); return null; });
      });
      return out;
    }
    function grades(items){
      const list = (Array.isArray(items) ? items : []).filter(i => i && i.id);
      const keys = list.map(i => i.key);
      const none = Object.fromEntries(keys.map(k => [k, null]));
      if(!list.length || !env.spec) return { now: none, ready: Promise.resolve(none), settled: true };
      const signature = JSON.stringify(list.map(i => [i.key, i.id, i.hide || []]));
      let set = sets.get(signature);
      if(set){ sets.delete(signature); sets.set(signature, set); }
      else{
        set = { value: undefined };
        set.promise = Promise.resolve().then(() => drawGrades(list)).catch(error => { if(env.warn) env.warn('The pictures of the grades could not be made', error); return none; })
          .then(done => { set.value = done; return done; });
        sets.set(signature, set);
        dropSets();
      }
      return { now: set.value || Object.fromEntries(keys.map(k => [k, undefined])), ready: set.promise, settled: !!set.value };
    }
    return {
      grades,
      // `ids` are the uniform cards ('ceremonial' among them): the card's id is the uniform, Honor Guard the honor guard items on the coat or the shirt.
      uniforms: ids => pictures(ids, id => id === env.rules.CEREMONIAL.id ? { ceremonial: true } : { uniform: id }),
      // The uniform the member is on (Honor Guard rides on the coat or the shirt, and is pictured as it), in each cut: the same pictures as its card's where the cut is the member's.
      cuts: () => pictures(['male', 'female'], gender => ({ gender }))
    };
  }

  return { create, bare, standalone, gradeGroups, gradeDevice, gradeArt, gradeName, GROUPS, PAD, IMAGE_PX };
});
