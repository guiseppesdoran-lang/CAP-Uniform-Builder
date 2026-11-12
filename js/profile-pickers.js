// The Profile and Uniform steps' choices by picture (owner, 2026-11-12: "make the uniform selection, and the grade selection visual. mostly everything should be
// visual atp"; and on the first pickers: "this logic (visual rather than words) should be broadly applied"). What is drawn for each choice comes from
// js/profile-pictures.js; the groups of pictures are the page's picture picker (js/visual-picker.js), the look of the Uniform options panel.
//
//   Grade     a group of insignia under plain headings, in the order of rank, for the grades of the member's kind of membership. The select #rankSetupSelect stays
//             in the page, hidden, as the source of truth (as #membershipType stays behind its two buttons): saved setups, the report import and Undo write to it,
//             and a pick writes to it and fires its change.
//   Cut       two pictures of the member's own uniform, in the male and the female cut, over #jacketSelect the same way.
//   Diamond   the cadet first sergeant's chevron with and without the diamond, over #cadetFirstSergeantCheckbox the same way.
//   Uniform   each uniform card (button.uniformOption, which every handler and test of the page knows) holds a picture of that uniform for the member, drawn by the
//             engine, above its name; the card's behaviour, its hiding and its folding when the member may not wear it are js/setup.js's and js/workspace-ui.js's.
//
// The pictures of the uniforms are made when the Uniform step is shown (those of the cut, when the Profile step is shown to a member with a membership and a grade),
// and kept for the member they were made for. If one cannot be made the choice is its name alone. js/setup.js capubSyncSegments calls sync(), which every change of
// the page's state reaches.
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
  const BLANK_TALL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 4" aria-hidden="true"></svg>';
  const TICK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" focusable="false" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const shown = id => { const n = by(id); return !!n && !n.hidden; };
  // A choice made in a picture is written to the select (or the box) behind it, and its own change handler does the rest.
  function write(source, value){
    source.value = value;
    source.dispatchEvent(new Event('change', { bubbles: true }));
  }
  // The art of an asset: the address of its file (the page's own index of the artwork).
  function artUrl(id){
    const path = window.CAPUBAssetIndex && window.CAPUBAssetIndex[id];
    return path && typeof ASSET === 'function' ? ASSET(path) : null;
  }

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

  // ---- the grade ----------------------------------------------------------------------------------------------------------------

  let grade = null;   // { picker, signature }
  function gradeOptions(membership, ranks){
    const P = window.CAPUBProfilePictures;
    const G = window.CAPUBEngine && window.CAPUBEngine.grades;
    const options = [];
    for(const { group, ranks: members } of P.gradeGroups(membership, ranks)){
      for(const rank of members){
        const id = G ? P.gradeArt(G, membership, rank) : null;
        const url = id ? artUrl(id) : null;
        // A grade that wears no insignia (C/AB, a senior member without grade) is the plain empty mark: nothing is worn.
        options.push({ value: rank, label: rank, group, picture: url || window.VisualPicker.emptyMark(), note: P.gradeName(membership, rank) });
      }
    }
    return options;
  }
  function syncGrade(){
    const source = by('rankSetupSelect'), host = by('rankSetupPicker');
    if(!source || !host || !window.VisualPicker) return;
    const membership = State.membership || '';
    const ranks = Array.from(source.options || []).map(o => o.value).filter(Boolean);
    const signature = JSON.stringify([membership, ranks]);
    if(!grade || grade.signature !== signature){
      if(!ranks.length){
        // No kind of membership yet, so no grades to show.
        host.textContent = '';
        host.append(make('div', 'fieldLabel', 'Rank'), make('div', 'hintText', 'Choose a membership type first.'));
        grade = { picker: null, signature };
      }else{
        const picker = window.VisualPicker.render(host, {
          name: 'rank', legend: 'Rank', options: gradeOptions(membership, ranks), value: source.value, size: 'small',
          onChange: value => write(source, value)
        });
        picker.el.dataset.pickerFor = 'rankSetupSelect';
        grade = { picker, signature };
      }
    }
    if(grade.picker) grade.picker.setValue(source.value);
  }

  // ---- the cut ------------------------------------------------------------------------------------------------------------------

  let cut = null;   // { picker, signature, token, last }
  function cutOptions(urls){
    const known = urls || {};
    // A picture still being made holds its place with a blank box; one that could not be made is the name alone.
    const picture = v => known[v] ? known[v] : known[v] === null ? undefined : BLANK_TALL;
    return [['male', 'Male cut'], ['female', 'Female cut']].map(([value, label]) => ({ value, label, picture: picture(value) }));
  }
  function syncCut(){
    const source = by('jacketSelect'), host = by('cutPicker');
    if(!source || !host || !window.VisualPicker) return;
    if(!cut){
      const picker = window.VisualPicker.render(host, {
        name: 'cut', legend: 'Cut', options: cutOptions(), value: source.value, size: 'large', shape: 'tall',
        onChange: value => write(source, value)
      });
      picker.el.dataset.pickerFor = 'jacketSelect';
      cut = { picker, signature: '', token: 0, last: {} };
    }
    cut.picker.setValue(source.value);
    // The pictures are of the member's own uniform: made once there is a member, while the Profile step is the one shown.
    if(!shown('stepGroup-profile') || !State.membership || !State.rank) return;
    const made = maker().cuts();
    // While the pictures for a changed member (another grade) are made, the last ones stay, so a change does not blink.
    const paint = urls => {
      const shownNow = {};
      for(const v of ['male', 'female']){
        if(urls[v] !== undefined) cut.last[v] = urls[v];
        shownNow[v] = urls[v] !== undefined ? urls[v] : cut.last[v];
      }
      const signature = JSON.stringify(shownNow);
      if(signature === cut.signature) return;
      cut.signature = signature;
      cut.picker.setOptions(cutOptions(shownNow));
    };
    const token = ++cut.token;
    paint(made.now);
    if(!made.settled) made.ready.then(done => { if(token === cut.token) paint(done); });
  }

  // ---- the first sergeant's diamond -----------------------------------------------------------------------------------------------

  let diamond = null;   // { picker, signature }
  function syncDiamond(){
    const source = by('cadetFirstSergeantCheckbox'), host = by('firstSergeantPicker'), block = by('cadetFirstSergeantBlock');
    if(!source || !host || !block || !window.CAPUBEngine || !window.VisualPicker) return;
    // The block is shown by js/catalog.js syncCadetFirstSergeantControl for the three grades that take the diamond.
    if(block.classList.contains('hidden') || !State.rank) return;
    const G = window.CAPUBEngine.grades, P = window.CAPUBProfilePictures;
    const art = on => artUrl(P.gradeArt(G, State.membership, State.rank, { firstSergeant: on }));
    const signature = JSON.stringify([State.membership, State.rank]);
    if(!diamond || diamond.signature !== signature){
      const options = [['plain', 'Plain chevron', false], ['diamond', 'With diamond', true]].map(([value, label, on]) => ({ value, label, picture: art(on) || undefined }));
      const picker = window.VisualPicker.render(host, {
        name: 'firstSergeant', legend: 'Cadet First Sergeant diamond', options, value: source.checked ? 'diamond' : 'plain',
        onChange: value => { source.checked = value === 'diamond'; source.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      picker.el.dataset.pickerFor = 'cadetFirstSergeantCheckbox';
      diamond = { picker, signature };
    }
    diamond.picker.setValue(source.checked ? 'diamond' : 'plain');
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
    for(const part of [syncGrade, syncCut, syncDiamond, syncUniforms]){
      try{ part(); }catch(error){ console.warn('[profile pickers]', error); }
    }
  }
  doc.addEventListener('capub:rendered', sync);
  doc.addEventListener('capub:history', sync);
  // A step shown: the stepper sets data-step on the page (js/workspace-ui.js renderStepper).
  const shell = by('layoutShell');
  if(shell && typeof MutationObserver === 'function') new MutationObserver(() => sync()).observe(shell, { attributes: true, attributeFilter: ['data-step'] });
  setTimeout(sync, 0);

  window.CAPUBProfilePickers = { sync, syncGrade, syncCut, syncDiamond, syncUniforms };
})();
