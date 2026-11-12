// The Uniform step's choices by picture (owner, 2026-11-12: "make the uniform selection, and the grade selection visual. mostly everything should be visual atp"; and
// on the first pickers: "this logic (visual rather than words) should be broadly applied"). What is drawn for each choice comes from js/profile-pictures.js.
//
//   Uniform   each uniform card (button.uniformOption, which every handler and test of the page knows) holds a picture of that uniform for the member, drawn by the
//             engine, above its name; the card's behaviour, its hiding and its folding when the member may not wear it are js/setup.js's and js/workspace-ui.js's.
//
// The pictures are made when the Uniform step is shown, and kept for the member they were made for. If one cannot be made the card is its name alone. js/setup.js
// capubSyncSegments calls sync(), which every change of the page's state reaches.
//
// Loads as a classic script (window.CAPUBProfilePickers).
(function(){
  'use strict';
  const doc = typeof document !== 'undefined' ? document : null;
  if(!doc) return;
  const by = id => doc.getElementById(id);
  const make = (tag, className, text) => {
    const node = doc.createElement(tag);
    if(className) node.className = className;
    if(text != null) node.textContent = text;
    return node;
  };
  const ready = () => !!(window.CAPUBProfilePictures && typeof State !== 'undefined');
  const TICK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" focusable="false" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const shown = id => { const n = by(id); return !!n && !n.hidden; };

  // ---- what the engine needs, made when a picture is first asked for ------------------------------------------------------------

  let pictures = null;
  function maker(){
    if(pictures) return pictures;
    const E = window.CAPUBEngine;
    const assets = window.CAPUBAssetPacks.createLoader((path, cache) => fetch(ASSET(path), cache ? { cache } : undefined).then(r => r.ok ? r.json() : null));
    let storeP = null;
    const getStore = () => storeP || (storeP = assets.manifest().then(m => E.core.createSpecStore(m, path => assets.spec(path))));
    pictures = window.CAPUBProfilePictures.create({
      rules: window.CAPUBUniformRules,
      build: () => window.CAPUBUniformView.buildFromState(),
      async compose(build){
        const [store] = await Promise.all([getStore(), assets.prepare(build.uniform, build.gender)]);
        return E.profiles.composeUniform(build, store);
      },
      async draw(scene, pad){
        const store = await getStore();
        const svg = await E.renderSvg.buildSvg(scene, id => store.entry(id).path, { pad });
        return URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
      },
      release: url => URL.revokeObjectURL(url),
      warn: (...a) => console.warn('[profile pictures]', ...a)
    });
    return pictures;
  }

  // ---- the uniforms -------------------------------------------------------------------------------------------------------------

  const cards = () => Array.from(doc.querySelectorAll('.uniformOption'));
  // A card the member may pick: not locked (folded away with its reason) and not hidden (Ceremonials, for a senior member).
  const pickable = card => !card.classList.contains('locked') && !card.hidden && !card.classList.contains('hidden');
  // The picture's box holds the card's place from the moment the card is shown, so the grid does not move when the pictures arrive.
  function boxOf(card){
    const own = Array.from(card.children || []).find(n => n.classList && n.classList.contains('uPicture'));
    if(own) return own;
    const box = make('span', 'vpPicture uPicture');
    box.setAttribute('aria-hidden', 'true');
    const tick = make('span', 'vpTick');
    tick.setAttribute('aria-hidden', 'true');
    tick.innerHTML = TICK;
    card.insertBefore(box, card.firstChild);
    card.append(tick);
    return box;
  }
  function paintCard(card, url){
    if(url === undefined) return;
    const box = boxOf(card);
    // A picture that could not be made leaves the card as its words.
    box.hidden = url === null;
    if(url === null) return;
    let img = Array.from(box.children || []).find(n => n.nodeName === 'IMG');
    if(!img){
      img = make('img');
      img.setAttribute('alt', '');
      img.setAttribute('draggable', 'false');
      box.append(img);
    }
    if(img.getAttribute('src') !== url) img.setAttribute('src', url);
  }
  let uniforms = { token: 0 };
  function syncUniforms(){
    const all = cards();
    // Which card is the one picked, to assistive technology as well as by its edge and tick.
    all.forEach(card => card.setAttribute('aria-pressed', card.classList.contains('activeUniform') ? 'true' : 'false'));
    if(!shown('stepGroup-uniform') || !State.membership || !State.rank || !State.gender) return;
    const live = all.filter(pickable);
    live.forEach(boxOf);
    const made = maker().uniforms(live.map(card => card.dataset.uniformId));
    const paint = urls => cards().filter(pickable).forEach(card => paintCard(card, urls[card.dataset.uniformId]));
    const token = ++uniforms.token;
    paint(made.now);
    if(!made.settled) made.ready.then(done => { if(token === uniforms.token) paint(done); });
  }

  // ---- all of it ----------------------------------------------------------------------------------------------------------------

  function sync(){
    if(!ready()) return;
    for(const part of [syncUniforms]){
      try{ part(); }catch(error){ console.warn('[profile pickers]', error); }
    }
  }
  doc.addEventListener('capub:rendered', sync);
  doc.addEventListener('capub:history', sync);
  // A step shown: the stepper sets data-step on the page (js/workspace-ui.js renderStepper).
  const shell = by('layoutShell');
  if(shell && typeof MutationObserver === 'function') new MutationObserver(() => sync()).observe(shell, { attributes: true, attributeFilter: ['data-step'] });
  setTimeout(sync, 0);

  window.CAPUBProfilePickers = { sync, syncUniforms };
})();
