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
  const BLANK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3" aria-hidden="true"></svg>';
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

  // A picture's address is let go (revoked) when its picture is dropped from the ones kept (js/profile-pictures.js), but not while a tile on the page still shows it: an
  // image that is lazy, or is made again by the page, would then find nothing at its address. The address waits here until no image has it, and is let go then.
  const held = new Set();
  function sweep(){
    for(const url of [...held]){
      if(doc.querySelectorAll(`img[src="${url}"]`).length) continue;
      held.delete(url);
      URL.revokeObjectURL(url);
    }
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
      core: E.core, grades: E.grades, measure: E.measureLayout,
      build: () => window.CAPUBUniformView.buildFromState(),
      scene: () => window.CAPUBUniformView.scene,
      async compose(build){
        const [store] = await Promise.all([getStore(), assets.prepare(build.uniform, build.gender)]);
        return E.profiles.composeUniform(build, store);
      },
      // The drawing as a document a browser decodes on its own (js/profile-pictures.js standalone); null for a drawing that holds nothing, which is tried again.
      async draw(scene, pad, options){
        const store = await getStore();
        const svg = await E.renderSvg.buildSvg(scene, id => store.entry(id).path, Object.assign({ pad }, options));
        // Lettering (the name) needs the engraved face, which an image loads from nowhere: it is carried inside the drawing as data.
        if(svg.querySelector && svg.querySelector('text')) await E.renderSvg.embedFonts(svg);
        const text = window.CAPUBProfilePictures.standalone(new XMLSerializer().serializeToString(svg));
        return text ? URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' })) : null;
      },
      wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
      async spec(id){ return (await getStore()).load(id); },
      release: url => { held.add(url); sweep(); },
      warn: (...a) => console.warn('[profile pictures]', ...a)
    });
    return pictures;
  }

  // ---- the grade ----------------------------------------------------------------------------------------------------------------

  let grade = null;   // { picker, signature, token, last, shownSignature }
  // The devices of the grades the select offers, for the pictures to be made: { key, id, hide } for a grade that wears insignia.
  function gradeItems(membership, ranks){
    const P = window.CAPUBProfilePictures;
    const G = window.CAPUBEngine && window.CAPUBEngine.grades;
    return G ? ranks.map(rank => { const d = P.gradeDevice(G, membership, rank); return d ? { key: rank, id: d.id, hide: d.hide } : null; }).filter(Boolean) : [];
  }
  // `urls`: the picture of each grade that wears insignia, once made (undefined while it is being made, null if it could not be).
  function gradeOptions(membership, ranks, items, urls){
    const P = window.CAPUBProfilePictures;
    const wears = new Set(items.map(i => i.key));
    const options = [];
    for(const { group, ranks: members } of P.gradeGroups(membership, ranks)){
      for(const rank of members){
        // A grade that wears no insignia (C/AB, a senior member without grade) is the plain empty mark: nothing is worn. One whose picture is still being made holds its
        // place with a blank box; one that could not be made is its name alone.
        const picture = !wears.has(rank) ? window.VisualPicker.emptyMark() : urls[rank] ? urls[rank] : urls[rank] === null ? undefined : BLANK;
        options.push({ value: rank, label: rank, group, picture, note: P.gradeName(membership, rank) });
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
        host.append(make('div', 'fieldLabel', 'Grade'), make('div', 'hintText', 'Choose a membership type first.'));
        grade = { picker: null, signature, token: 0, last: {}, shownSignature: '' };
      }else{
        const items = gradeItems(membership, ranks);
        const picker = window.VisualPicker.render(host, {
          name: 'rank', legend: 'Grade', options: gradeOptions(membership, ranks, items, {}), value: source.value, size: 'small',
          onChange: value => write(source, value)
        });
        picker.el.dataset.pickerFor = 'rankSetupSelect';
        grade = { picker, signature, token: 0, last: {}, shownSignature: '{}', items, membership, ranks };
      }
    }
    if(!grade.picker) return;
    grade.picker.setValue(source.value);
    // The devices are drawn once the Profile step is the one shown. While another set is made (another kind of membership) the picture group holds blank boxes.
    if(!shown('stepGroup-profile')) return;
    const made = maker().grades(grade.items);
    const paint = urls => {
      const known = {};
      for(const i of grade.items){ if(urls[i.key] !== undefined) grade.last[i.key] = urls[i.key]; known[i.key] = grade.last[i.key]; }
      const sig = JSON.stringify(known);
      if(sig === grade.shownSignature) return;
      grade.shownSignature = sig;
      grade.picker.setOptions(gradeOptions(grade.membership, grade.ranks, grade.items, known));
    };
    const token = ++grade.token;
    paint(made.now);
    if(!made.settled) made.ready.then(done => { if(token === grade.token) paint(done); });
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

  // ---- where the references are shown ---------------------------------------------------------------------------------------------

  // Two tiles in place of the switch of the Regulation tab: a sample note with its reference behind the question mark, and the same with the reference printed in it, over
  // #citesShown, which stays as the source of truth (js/citations.js listens to its change and keeps the choice in the browser).
  let cites = null;
  function syncCites(){
    const source = by('citesShown'), host = by('citesShownPicker');
    if(!source || !host || !window.VisualPicker || !window.CAPUBProfilePictures) return;
    if(!cites){
      const P = window.CAPUBProfilePictures;
      const options = [['off', 'Behind a question mark', false], ['on', 'Printed in the text', true]].map(([value, label, on]) => ({ value, label, picture: P.citeSample(on) }));
      const picker = window.VisualPicker.render(host, { name: 'citesShown', legend: 'References in notes and hints', options, value: source.checked ? 'on' : 'off', size: 'large',
        onChange: value => { source.checked = value === 'on'; source.dispatchEvent(new Event('change', { bubbles: true })); } });
      picker.el.dataset.pickerFor = 'citesShown';
      cites = { picker };
    }
    cites.picker.setValue(source.checked ? 'on' : 'off');
  }

  // ---- the pictures of a choice made once and kept while another set is made ------------------------------------------------------

  // A group of pictures that are made for the member and are made again when the member changes: while the new ones are made the last stay, so a change does not blink.
  // `optionsOf(urls)` is the options for the pictures known (a value still being made is undefined, one that could not be made null, one that does not apply false).
  function slotOf(picker, keys, optionsOf){ return { picker, keys, optionsOf, token: 0, last: {}, signature: '' }; }
  function feed(slot, made){
    const paint = urls => {
      const known = {};
      for(const k of slot.keys){ if(urls[k] !== undefined) slot.last[k] = urls[k]; known[k] = urls[k] !== undefined ? urls[k] : slot.last[k]; }
      const signature = JSON.stringify(known);
      if(signature === slot.signature) return;
      slot.signature = signature;
      slot.picker.setOptions(slot.optionsOf(known));
    };
    const token = ++slot.token;
    paint(made.now);
    if(!made.settled) made.ready.then(done => { if(token === slot.token) paint(done); });
  }
  // The tile of a picture: still being made holds its place with a blank box, one that could not be made is its name alone.
  const tilePicture = (urls, key, blank) => urls[key] ? urls[key] : urls[key] === null ? undefined : blank;

  // ---- the membership ------------------------------------------------------------------------------------------------------------

  // Two tiles, the Class A coat the engine draws for a cadet and for a senior member (a stand-in grade of the same name in each: the grade is chosen after), over the select
  // #membershipType, which stays as the source of truth.
  let membership = null;
  function syncMembership(){
    const source = by('membershipType'), host = by('membershipPicker');
    if(!source || !host || !window.VisualPicker) return;
    if(!membership){
      const optionsOf = urls => [['cadet', 'Cadet'], ['senior', 'Senior member']].map(([value, label]) => ({ value, label, picture: tilePicture(urls, value, BLANK) }));
      const picker = window.VisualPicker.render(host, { name: 'membership', legend: 'Membership type', options: optionsOf({}), value: source.value, size: 'large', onChange: value => write(source, value) });
      picker.el.dataset.pickerFor = 'membershipType';
      membership = slotOf(picker, ['cadet', 'senior'], optionsOf);
    }
    membership.picker.setValue(source.value);
    if(shown('stepGroup-profile')) feed(membership, maker().memberships());
  }

  // ---- a cadet of 18 or older who does not meet the weight standard ---------------------------------------------------------------------

  // Two tiles in place of the box: the cadet's Class A coat and the Corporate blazer the member may also wear, over #adultCadetCheckbox, which stays as the source of truth. The
  // row is shown by js/setup.js syncAdultCadetControl to cadets only.
  let adult = null;
  function syncAdult(){
    const source = by('adultCadetCheckbox'), host = by('adultCadetPicker'), row = by('adultCadetRow');
    if(!source || !host || !row || !window.VisualPicker) return;
    if(!adult){
      const optionsOf = urls => [['no', 'Meets it, or under 18'], ['yes', '18 or older, does not meet it']].map(([value, label]) => ({ value, label, picture: tilePicture(urls, value, BLANK),
        note: value === 'yes' ? 'Cadets in this position may wear the Corporate uniforms (CAPR 39-1, 1.2.5.2).' : undefined }));
      const picker = window.VisualPicker.render(host, { name: 'adultCadet', legend: 'USAF weight standard', options: optionsOf({}), value: source.checked ? 'yes' : 'no', size: 'large',
        onChange: value => { source.checked = value === 'yes'; source.dispatchEvent(new Event('change', { bubbles: true })); } });
      picker.el.dataset.pickerFor = 'adultCadetCheckbox';
      adult = slotOf(picker, ['no', 'yes'], optionsOf);
    }
    adult.picker.setValue(source.checked ? 'yes' : 'no');
    if(shown('stepGroup-profile') && !row.classList.contains('hidden') && State.membership === 'cadet') feed(adult, maker().adults());
  }

  // ---- the name on the uniform ----------------------------------------------------------------------------------------------------

  // Two tiles in place of the box: the uniform at its name, with the name and without it, over #capubV2ShowText, which stays as the source of truth. A uniform that draws no
  // name (the mess dress, the semi-formal coats) has no such choice: the group is not offered. The name in the picture is the member's own once they have entered it; while they
  // are typing the pictures wait for a pause.
  let naming = null, nameTimer = 0;
  function syncName(){
    const source = by('capubV2ShowText'), host = by('showNamePicker');
    if(!source || !host || !window.VisualPicker) return;
    if(!naming){
      const optionsOf = urls => urls.on === false ? [] : [['on', 'Show my name'], ['off', 'Leave it off']].map(([value, label]) => ({ value, label, picture: tilePicture(urls, value, BLANK) }));
      const picker = window.VisualPicker.render(host, { name: 'showName', legend: 'Name on the uniform', options: optionsOf({}), value: source.checked ? 'on' : 'off', size: 'large',
        onChange: value => { source.checked = value === 'on'; source.dispatchEvent(new Event('change', { bubbles: true })); } });
      picker.el.dataset.pickerFor = 'capubV2ShowText';
      naming = slotOf(picker, ['on', 'off'], optionsOf);
      naming.host = host;
      const base = naming.optionsOf;
      naming.optionsOf = urls => { const list = base(urls); host.hidden = urls.on === false; return list; };
    }
    naming.picker.setValue(source.checked ? 'on' : 'off');
    if(!shown('stepGroup-profile') || !State.membership || !State.rank || !State.gender) return;
    const active = doc.activeElement;
    const typing = !!(active && active.nodeName === 'INPUT' && active.type !== 'checkbox' && up(active, n => n.id === 'capubV2TextPanel'));
    clearTimeout(nameTimer);
    if(typing) nameTimer = setTimeout(() => feed(naming, maker().names()), 500);
    else feed(naming, maker().names());
  }

  // ---- the unit's emblem ------------------------------------------------------------------------------------------------------------

  // A unit that has an emblem (data/unit-patch-art.js: 77 of the 1,454) shows it beside its name; the search and the list stay words.
  function syncUnitEmblem(){
    const img = by('unitEmblem');
    if(!img) return;
    const id = typeof getSelectedUnitPatchId === 'function' ? getSelectedUnitPatchId() : null;
    const meta = id && typeof PATCH_META === 'object' && PATCH_META ? PATCH_META[id] : null;
    const url = meta && meta.img && typeof ASSET === 'function' ? ASSET(meta.img) : '';
    if(url){
      if(img.getAttribute('src') !== url) img.setAttribute('src', url);
      img.hidden = false;
    }else if(!img.hidden){
      img.hidden = true;
      img.removeAttribute('src');
    }
  }

  // ---- the uniforms -------------------------------------------------------------------------------------------------------------

  const cards = () => Array.from(doc.querySelectorAll('.uniformOption'));
  // A card the member may pick: not locked (folded away with its reason) and not hidden (Honor Guard, for a senior member).
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

  // ---- an image that did not decode ----------------------------------------------------------------------------------------------

  // A picture the browser could not decode (a network error, a drawing it will not read) is not left as the browser's broken-image mark: the choice is its name alone. The
  // events of an image do not bubble, so one listener on the page takes them in the capture phase.
  const OURS = ['membership', 'rank', 'adultCadet', 'cut', 'firstSergeant', 'showName'];
  const up = (node, test) => { for(let n = node && node.parentNode; n && n.nodeType === 1; n = n.parentNode) if(test(n)) return n; return null; };
  const has = (n, name) => !!(n.classList && n.classList.contains(name));
  function dropImage(img){
    const box = up(img, n => has(n, 'vpPicture') || has(n, 'uPicture') || has(n, 'ptPicture'));
    if(!box) return;
    const tile = up(box, n => has(n, 'vpOption'));
    if(tile){ box.remove(); tile.classList.add('noPicture'); }
    else box.hidden = true;
  }
  // Only the pictures of these pickers and of the uniform cards: another picker's images are its own.
  const isOurs = img => !!(up(img, n => has(n, 'uniformOption') || has(n, 'ptCard')) || up(img, n => has(n, 'vp') && n.dataset && OURS.includes(n.dataset.name)));
  function checkImage(event){
    const img = event && event.target;
    if(!img || img.nodeName !== 'IMG' || !isOurs(img)) return;
    if(event.type === 'error' || !img.naturalWidth) dropImage(img);
  }
  doc.addEventListener('error', checkImage, true);
  doc.addEventListener('load', checkImage, true);

  // ---- all of it ----------------------------------------------------------------------------------------------------------------

  function sync(){
    if(!ready()) return;
    for(const part of [syncMembership, syncGrade, syncAdult, syncCut, syncDiamond, syncName, syncUnitEmblem, syncCites, syncUniforms]){
      try{ part(); }catch(error){ console.warn('[profile pickers]', error); }
    }
    sweep();
  }
  doc.addEventListener('capub:rendered', sync);
  doc.addEventListener('capub:history', sync);
  // A step shown: the stepper sets data-step on the page (js/workspace-ui.js renderStepper).
  const shell = by('layoutShell');
  if(shell && typeof MutationObserver === 'function') new MutationObserver(() => sync()).observe(shell, { attributes: true, attributeFilter: ['data-step'] });
  setTimeout(sync, 0);

  // What the other pages' pictures use (js/measure-panel.js, js/placement-templates.js, js/citations.js): the engine's pictures made once and kept, a group of tiles that holds the
  // last pictures while new ones are made, the blank box, and `claim(name)`, which puts a picker's pictures under the guard of an image that does not decode (the name alone).
  const shared = { maker, slotOf, feed, tilePicture, BLANK, BLANK_TALL, claim: name => { if(!OURS.includes(name)) OURS.push(name); } };
  window.CAPUBProfilePickers = { sync, syncMembership, syncGrade, syncAdult, syncCut, syncDiamond, syncName, syncUnitEmblem, syncCites, syncUniforms, dropImage, shared };
})();
