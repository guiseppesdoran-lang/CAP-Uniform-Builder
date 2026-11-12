// Uniform engine: the shoulder cords as the page and the engine name them.
//
// The cord list (data/cords.js, window.CAP_CORDS) says how every cord is drawn; the page's state says which one the member chose. The state keeps the seven cords of
// the regulation (9.3) under the keys they have always had, with underscores (group, wing, region, national, color_guard, honor_guard, aide_de_camp), so a saved
// build or a shared link made before the supplement cords draws exactly as it did; a supplement cord is its own id in the list (ner-rcls). The list names the
// seven with hyphens. js/engine/cord-braid.js (CordBraid) draws any of them from the list's entry.
//
// Loads as a classic script (window.CAPUBEngine.cords) and as a CommonJS module for the Node tests.
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const api = factory(
    () => node ? require('../../data/cords.js') : root.CAP_CORDS,
    () => { if(node){ try{ return require('./cord-braid.js'); }catch(e){ return null; } } return root.CordBraid || null; }
  );
  if(node) module.exports = api;
  else { root.CAPUBEngine = root.CAPUBEngine || {}; root.CAPUBEngine.cords = api; }
})(typeof self !== 'undefined' ? self : this, function(getList, getBraid){
  'use strict';

  const REGULATION = ['group', 'wing', 'region', 'national', 'color_guard', 'honor_guard', 'aide_de_camp'];

  // The id the list gives a cord the state holds as `value` ('color_guard' is 'color-guard'; a supplement cord's id is its own). A build made by a script may name a
  // regulation cord by its sheet's id ('cord-group').
  function listId(value){ return String(value == null ? '' : value).replace(/^cord-/, '').replace(/_/g, '-'); }

  const all = () => { const l = getList(); return l ? [].concat(l.regulation || [], l.supplement || []) : []; };
  // The list's entry of a cord, or null.
  function entry(value){ const id = listId(value); return all().find(c => c.id === id) || null; }

  const supplementIds = () => { const l = getList(); return l ? (l.supplement || []).map(c => c.id) : []; };
  const isRegulation = value => REGULATION.includes(value);
  const isSupplement = value => typeof value === 'string' && supplementIds().includes(value);
  // A value the state may hold: one of the seven by its state key, or a supplement cord by its id.
  const isKnown = value => isRegulation(value) || isSupplement(value);
  // A cord whose colour the unit commander picks (the member picks it from chosenColours).
  function needsColour(value){ const e = entry(value); return !!e && e.style === 'chosen'; }

  // A cord that hangs an aiguillette (the Aide de Camp cord, two Florida cords): the list's entry names the aiguillette's colour.
  function hasAiguillette(value){ const e = entry(value); return !!e && !!e.aiguillette; }

  // The colours a chosen cord may take, each with its hex pair: the list's own, never the colour of a regulation cord.
  function chosenColours(){
    const l = getList();
    if(!l || !Array.isArray(l.chosen_colours)) return [];
    return l.chosen_colours.filter(n => l.palette && l.palette[n]).map(n => ({ name: n, main: l.palette[n].main, dark: l.palette[n].dark }));
  }
  const isChosenColour = name => typeof name === 'string' && chosenColours().some(c => c.name === name);

  // The cord ready to draw: the list's entry with its colour names turned into hex pairs (CordBraid.resolve), or null when the cord is not in the list, the drawing
  // function is not loaded, or a chosen cord has no colour from the palette.
  function resolve(value, colour){
    const braid = getBraid(), list = getList(), e = entry(value);
    if(!braid || !list || !e) return null;
    if(e.style === 'chosen' && !isChosenColour(colour)) return null;
    try{ return braid.resolve(list, e.id, e.style === 'chosen' ? colour : undefined) || null; }catch(err){ return null; }
  }

  // The braid of the aiguillette a cord hangs (the Aide de Camp cord, and the Florida cords that add one): a plain cord in the aiguillette's colour, or null when the cord
  // has no aiguillette.
  function pendantCord(value, colour){
    const e = resolve(value, colour);
    return e && e.aiguillette ? { id: e.id, name: e.name, style: 'solid', colours: [e.aiguillette] } : null;
  }

  // The metal of the tip an aiguillette ends in, as the list gives it for the aiguillette's colour (silver for a silver one, gold for a gold one): { main, dark }, or null.
  function tipMetal(value){
    const l = getList(), e = entry(value);
    return l && e && e.aiguillette && l.metals && l.metals[e.aiguillette] ? { main: l.metals[e.aiguillette].main, dark: l.metals[e.aiguillette].dark } : null;
  }

  // A short piece of a cord as a picture for a chooser, drawn by CordBraid: the braid running down and across the frame (cap and all), the strand and tip it hangs from the
  // shoulder end, and for a cord that hangs an aiguillette the pendant's braid beside it. A frame in inches, 4 to 3; a cord with a strand takes a taller one, whole, so its tip
  // is not cut. SVG markup, or '' when the drawing function is not loaded or the cord cannot be drawn (a chosen cord with no colour of the list's).
  function sampleSvg(value, colour){
    const braid = getBraid(), cord = resolve(value, colour);
    if(!braid || !cord) return '';
    const tall = !!(cord.strand || cord.knot), W = tall ? 0.5 : 0.62, H = tall ? 3.9 : 2.7, wide = +(H * 4 / 3).toFixed(3);
    const x0 = +(wide * (tall ? 0.46 : 0.42)).toFixed(3), x1 = +(x0 + (tall ? 1 : 0.9)).toFixed(3), y0 = 0.15, y1 = +(H - 0.15).toFixed(3);
    const id = 'cs-' + cord.id + '-';
    let body = '';
    const pend = cord.aiguillette ? pendantCord(value, colour) : null;
    if(pend) body += braid.draw([[+(x0 - 0.55).toFixed(3), y0], [+(x0 - 0.55).toFixed(3), +(y1 - 0.5).toFixed(3)]], pend, { unit: 1, width: 0.36, idPrefix: id + 'pendant-' }).run;
    const d = braid.draw([[x0, y0], [x1, y1]], cord, { unit: 1, width: W, idPrefix: id, cap: true });
    body += d.run + d.extras;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wide} ${H}" focusable="false" aria-hidden="true">${body}</svg>`;
  }

  // The regulation cord whose sheet carries a cord's geometry on every cut that takes one: each of the seven is its own carrier, a supplement cord has no sheet and
  // rides the honor guard cord's.
  const carrierOf = value => REGULATION.includes(listId(value).replace(/-/g, '_')) ? listId(value) : 'honor-guard';

  return { REGULATION, listId, entry, supplementIds, isRegulation, isSupplement, isKnown, needsColour, chosenColours, isChosenColour, hasAiguillette, resolve, pendantCord, tipMetal, sampleSvg, carrierOf };
});
