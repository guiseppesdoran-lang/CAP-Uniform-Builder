// The measurement panel and the Regulation tab.
//
// The Measurements button has a caret attached to it that opens a list beside the preview (it also opens by itself the first time Measurements is turned
// on in a session); the list names every distance the build draws, by area, each with an on/off switch (a button, never a checkbox: a tap on the mark turns the distance
// on or off); one that is off is left off the drawing and the rest are laid out again over the room it frees (measure-layout.js filterScene). A tap on a row's text opens
// its paragraph, as its question mark does; on a row with no paragraph it turns the distance on or off. The choice is kept per uniform in this browser, with the pair of
// pictures that puts each callout's paragraph back on its pill (off by default): the engine's own drawing of one distance, without and with it (js/profile-pictures.js callouts). The Regulation tab in the Extra step lists the same distances
// with their paragraphs, for a member who asks for them. A tap on a distance (its question mark in the list, or its line or label in the drawing) opens its paragraph in
// the popover the page's other question marks use (js/citations.js asks noteFor for what to show). Everything here is plain functions over measure-layout.js's catalogue;
// the page's glue is at the end.
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const ML = node ? require('./engine/measure-layout.js') : (root.CAPUBEngine && root.CAPUBEngine.measureLayout);
  const api = factory(ML);
  if(node) module.exports = api;
  else { root.CAPUBMeasure = api; if(typeof document !== 'undefined') api.start(); }
})(typeof self !== 'undefined' ? self : this, function(ML){
  'use strict';

  const KEY_HIDDEN = 'capubMeasureHidden', KEY_REFS = 'capubMeasureRefs', KEY_INTRO = 'capubMeasureIntro';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---- what is kept: { uniform: [ids hidden] } and the references switch, in the browser's storage (a stored value that does not read is ignored) ----
  function createPrefs(storage){
    const read = key => { try{ return storage && storage.getItem(key); }catch(e){ return null; } };
    const write = (key, value) => { try{ if(storage) storage.setItem(key, value); }catch(e){ /* private window or full storage: the choice lasts until reload */ } };
    let hiddenByUniform = null, refs = null;
    const load = () => {
      if(hiddenByUniform) return hiddenByUniform;
      hiddenByUniform = {};
      try{
        const v = JSON.parse(read(KEY_HIDDEN) || '{}');
        if(v && typeof v === 'object') for(const [u, ids] of Object.entries(v)) if(Array.isArray(ids)) hiddenByUniform[u] = ids.filter(i => typeof i === 'string');
      }catch(e){ /* unreadable: start clean */ }
      return hiddenByUniform;
    };
    return {
      hidden: uniform => (load()[uniform] || []).slice(),
      setHidden(uniform, ids){
        const all = load(), list = [...new Set(ids)];
        if(list.length) all[uniform] = list; else delete all[uniform];
        write(KEY_HIDDEN, JSON.stringify(all));
      },
      refs(){ if(refs === null) refs = read(KEY_REFS) === '1'; return refs; },
      setRefs(on){ refs = !!on; write(KEY_REFS, refs ? '1' : '0'); }
    };
  }

  // What a tap on a distance opens: the distance as a line and the paragraph(s) the catalogue holds for it, the CAPR 39-1 ones by number and the ICL's by its own name.
  // A distance no paragraph states (the OCP's shoulder seam to the flag or AUX is how the garment is drawn, not a rule) has none, and opens nothing.
  function noteOf(entry){
    if(!entry || !entry.ref) return null;
    const p = ML.refParts(entry.ref);
    const refs = [p.capr ? ML.refText(p.capr) : '', p.icl].filter(Boolean);
    return refs.length ? { rule: `${entry.name}: ${entry.value}.`, refs } : null;
  }

  // ---- markup, as strings (the page sets them as innerHTML; the tests read them) ----
  // The panel: under the head, in one scrolling list, the pair of pictures that choose whether the callouts quote their paragraph (set by the page), All and None, then each
  // area's distances with an on/off switch, the value, and the question mark.
  function panelHtml(cat, hidden){
    const off = new Set(hidden || []);
    const total = cat.entries.length, shown = cat.entries.filter(e => !off.has(e.id)).length;
    const head = `<div class="mpHead"><strong id="measurePanelTitle">Measurements shown</strong><span class="mpCount" aria-live="polite">${shown} of ${total}</span><button type="button" class="ghost mpDone" data-mp="close">Done</button></div>`;
    if(!total) return head + '<p class="mpEmpty hintText">This uniform draws no measurements.</p>';
    const refs = '<div class="mpRefs"></div>';
    const bulk = `<div class="mpBulk" role="group" aria-label="Show or hide all"><button type="button" class="ghost" data-mp="all">All</button><button type="button" class="ghost" data-mp="none">None</button></div>`;
    // A row: the switch (a button that is on or off, named by the distance and its value), the text (the name, its count, the value: a tap opens the paragraph the distance
    // has, by the page's own handler, js/citations.js) and beside it, not inside it, the question mark that opens the same paragraph, for a distance that has one.
    // A row with no paragraph keeps the mark's room empty, so the values of all the rows line up. The text is for the eye and the hand; the switch carries its words for assistive technology.
    const mark = e => noteOf(e) ? `<span class="citeBtn citeMeasure" role="button" tabindex="0" aria-expanded="false" aria-label="Regulation reference: ${esc(e.name)}, ${esc(e.value)}" data-cite-measure="${esc(e.id)}"></span>` : '<span class="mpNoMark" aria-hidden="true"></span>';
    const row = e => `<div class="mpRow">`
      + `<button type="button" class="mpToggle" role="switch" aria-checked="${off.has(e.id) ? 'false' : 'true'}" aria-label="${esc(e.name)}, ${esc(e.value)}" data-id="${esc(e.id)}"><span class="mpMark" aria-hidden="true"></span></button>`
      + `<span class="mpText"${noteOf(e) ? ` data-cite-measure="${esc(e.id)}"` : ''} aria-hidden="true"><span class="mpName">${esc(e.name)}${e.count > 1 ? ` <span class="mpTimes">(${e.count})</span>` : ''}</span><span class="mpVal">${esc(e.value)}</span></span>`
      + mark(e) + `</div>`;
    const groups = cat.groups.map(g => `<fieldset class="mpGroup"><legend>${esc(g.area)}</legend>` + g.entries.map(row).join('') + '</fieldset>').join('');
    // The pair of pictures and All and None scroll with the list under the head, so on a phone's sheet the distances are not squeezed into what the pictures leave.
    return head + `<div class="mpList">${refs}${bulk}${groups}</div>`;
  }

  // The Regulation tab: a table by area of the rule, its value and its paragraph (CAPR 39-1, and the ICL where the engine cites one).
  function regulationHtml(cat){
    if(!cat || !cat.entries.length) return '<p class="hintText">Choose a uniform to see the rules the drawing applies.</p>';
    const rows = cat.groups.map(g => `<tbody><tr class="regArea"><th colspan="3" scope="colgroup">${esc(g.area)}</th></tr>` + g.entries.map(e => {
      const p = ML.refParts(e.ref);
      const cell = (p.capr ? `<span class="regCapr">${esc(p.capr)}</span>` : '') + (p.icl ? `<span class="regIcl">${esc(p.icl)}</span>` : '') || '<span class="regNone">None</span>';
      return `<tr><th scope="row">${esc(e.name)}</th><td class="regVal">${esc(e.value)}</td><td class="regRef">${cell}</td></tr>`;
    }).join('') + '</tbody>').join('');
    return `<p class="hintText regNote">References are from CAPR 39-1 with ICL 26-14; a row names any other letter it cites.</p>`
      + `<table class="regTable"><thead><tr><th scope="col">Rule</th><th scope="col">Value</th><th scope="col">CAPR 39-1</th></tr></thead>${rows}</table>`;
  }

  // What the preview passes to buildSvg.
  const renderOptionsFor = (prefs, uniform) => ({ measureHide: prefs.hidden(uniform), measureRefs: prefs.refs() });

  // ---- the page ----
  const prefs = createPrefs((() => { try{ return typeof document !== 'undefined' ? localStorage : null; }catch(e){ return null; } })());
  const by = id => document.getElementById(id);
  const uniformId = () => (typeof State !== 'undefined' && State.uniform) || '';
  const currentCatalogue = () => { const v = window.CAPUBUniformView; return v && v.scene ? ML.catalogue(v.scene) : null; };
  const rerender = () => { const v = window.CAPUBUniformView; if(v && v.scheduleRender) v.scheduleRender(); };
  // The note of the distance with this id on the build now drawn (null when there is none or no paragraph states it).
  const noteFor = id => { const cat = currentCatalogue(); return cat ? noteOf(cat.entries.find(e => e.id === id)) : null; };

  // The pair of pictures of the callout, without and with its paragraph on the pill, in the panel's .mpRefs: the picture picker over the choice kept in prefs. It is made when the
  // panel is first filled (the panel's html is replaced when the distances change, and then the host is new and the group is made again); the pictures are the engine's
  // (js/profile-pickers.js shared), made once for the uniform and kept; one that cannot be made is the name alone; none where the uniform draws no distance with a paragraph.
  let refsSlot = null;
  function mountRefs(panel){
    const host = panel.querySelector('.mpRefs');
    if(!host){ refsSlot = null; return; }
    const pp = window.CAPUBProfilePickers, sh = pp && pp.shared;
    if(!sh || !window.VisualPicker){ host.hidden = true; return; }
    const on = prefs.refs();
    if(!refsSlot || refsSlot.host !== host){
      sh.claim('measureRefs');
      const optionsOf = urls => urls.off === false ? [] : [['off', 'Distance only'], ['on', 'With the paragraph']].map(([value, label]) => ({ value, label, picture: sh.tilePicture(urls, value, sh.BLANK) }));
      const picker = window.VisualPicker.render(host, { name: 'measureRefs', legend: 'On the drawing', options: optionsOf({}), value: on ? 'on' : 'off', size: 'large',
        onChange: value => { prefs.setRefs(value === 'on'); rerender(); } });
      picker.el.dataset.pickerFor = 'measureRefs';
      refsSlot = sh.slotOf(picker, ['off', 'on'], optionsOf);
      refsSlot.host = host;
      const base = refsSlot.optionsOf;
      refsSlot.optionsOf = urls => { const list = base(urls); host.hidden = urls.off === false; return list; };
    }
    refsSlot.picker.setValue(on ? 'on' : 'off');
    sh.feed(refsSlot, sh.maker().callouts());
  }
  function fillPanel(){
    const panel = by('measurePanel'); if(!panel) return;
    const cat = currentCatalogue() || { entries: [], groups: [] };
    const top = panel.querySelector('.mpList'), scroll = top ? top.scrollTop : 0;
    // The same list is left as it is: a redraw after every change would replace the switch a finger is on.
    const html = panelHtml(cat, prefs.hidden(uniformId()));
    if(panel.dataset.shown !== html){
      panel.dataset.shown = html; panel.innerHTML = html;
      const list = panel.querySelector('.mpList'); if(list) list.scrollTop = scroll;
    }
    try{ mountRefs(panel); }catch(error){ console.warn('[measurements]', error); }
  }
  function fillRegulation(){
    const host = by('regulationBody'); if(!host) return;
    host.innerHTML = regulationHtml(currentCatalogue());
  }
  function setOpen(open){
    const panel = by('measurePanel'), btn = by('measureListBtn'); if(!panel || !btn) return;
    panel.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    if(open) fillPanel();
  }
  // The caret that opens the panel is part of the Measurements control (js/workspace-ui.js builds both buttons as one group); this adds the panel and wires it.
  function ensureControls(){
    const measureBtn = by('measureBtn'), toolbar = by('previewToolbar'), btn = by('measureListBtn'); if(!measureBtn || !toolbar || !btn) return false;
    if(!by('measurePanel')){
      const panel = document.createElement('div');
      panel.id = 'measurePanel'; panel.className = 'measurePanel'; panel.hidden = true;
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', 'measurePanelTitle');
      toolbar.appendChild(panel);
      btn.addEventListener('click', e => { e.stopPropagation(); setOpen(by('measurePanel').hidden); });
      // Turns one distance on or off, in place: the switch, the count and the drawing, and the panel is left as it is (a redraw of the list would replace the switch a finger is on).
      function flip(sw){
        const u = uniformId(), id = sw.getAttribute('data-id'); if(id == null) return;
        const on = sw.getAttribute('aria-checked') !== 'true';
        const hidden = prefs.hidden(u).filter(x => x !== id);
        if(!on) hidden.push(id);
        prefs.setHidden(u, hidden);
        sw.setAttribute('aria-checked', String(on));
        const count = panel.querySelector('.mpCount'), cat = currentCatalogue();
        if(count && cat){ const off = new Set(hidden); count.textContent = `${cat.entries.filter(x => !off.has(x.id)).length} of ${cat.entries.length}`; }
        if(cat) panel.dataset.shown = panelHtml(cat, hidden);
        rerender();
      }
      panel.addEventListener('click', e => {
        e.stopPropagation();
        const near = sel => (e.target && e.target.closest ? e.target.closest(sel) : null);
        const sw = near('.mpToggle');
        if(sw){ flip(sw); return; }
        // The text of a row that has a paragraph is the page's mark (js/citations.js takes that press first); the text of one that has none turns the distance on or off.
        const text = near('.mpText');
        if(text){
          if(text.getAttribute('data-cite-measure') !== null) return;
          const row = text.closest ? text.closest('.mpRow') : null, own = row && row.querySelector('.mpToggle');
          if(own) flip(own);
          return;
        }
        const t = near('[data-mp]'); if(!t) return;
        const act = t.getAttribute('data-mp'), u = uniformId();
        if(act === 'close'){ setOpen(false); btn.focus(); return; }
        const cat = currentCatalogue(); if(!cat) return;
        if(act === 'all') prefs.setHidden(u, []);
        else if(act === 'none') prefs.setHidden(u, prefs.hidden(u).concat(cat.entries.map(x => x.id)));
        else return;
        fillPanel(); rerender();
      });
      // A press inside the paragraph's popover (it sits on the page, not in the panel) leaves the panel as it is.
      document.addEventListener('click', e => { const p = by('measurePanel'); if(p && !p.hidden && !p.contains(e.target) && !(e.target.closest && e.target.closest('.measureGroup, .citePop'))) setOpen(false); });
      document.addEventListener('keydown', e => { const p = by('measurePanel'); if(e.key === 'Escape' && p && !p.hidden){ setOpen(false); btn.focus(); } });
    }
    return true;
  }
  // Called whenever the preview has drawn, and when Measurements is toggled.
  function sync(){
    if(!ensureControls()) return;
    if(!by('measurePanel').hidden) fillPanel();
    fillRegulation();
  }
  // The panel opens on its own the first time Measurements is turned on in a session, so a member sees what can be chosen; after that only the caret opens it.
  let introShown = false;
  function firstTimeOn(){
    if(introShown) return;
    try{ if(sessionStorage.getItem(KEY_INTRO) === '1'){ introShown = true; return; } sessionStorage.setItem(KEY_INTRO, '1'); }catch(e){ /* no session storage: once per page load */ }
    introShown = true;
    if(ensureControls()) setOpen(true);
  }

  // The Extra step's two tabs: the existing content and the Regulation list.
  function wireExtraTabs(){
    const tabs = by('extraTabs'); if(!tabs || tabs.dataset.wired) return;
    tabs.dataset.wired = '1';
    const pick = which => {
      for(const btn of tabs.querySelectorAll('[role="tab"]')){
        const on = btn.dataset.tab === which;
        btn.setAttribute('aria-selected', String(on)); btn.tabIndex = on ? 0 : -1;
        const pane = by(btn.getAttribute('aria-controls')); if(pane) pane.hidden = !on;
      }
      if(which === 'regulation') fillRegulation();
    };
    tabs.addEventListener('click', e => { const b = e.target.closest ? e.target.closest('[role="tab"]') : null; if(b) pick(b.dataset.tab); });
    tabs.addEventListener('keydown', e => {
      const order = [...tabs.querySelectorAll('[role="tab"]')], at = order.findIndex(b => b.getAttribute('aria-selected') === 'true');
      const to = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if(to === undefined) return;
      e.preventDefault(); const next = order[(at + to + order.length) % order.length]; pick(next.dataset.tab); next.focus();
    });
  }

  function start(){
    const go = () => { wireExtraTabs(); sync(); };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    document.addEventListener('capub:rendered', sync);
  }

  const renderOptions = uniform => renderOptionsFor(prefs, uniform);
  return { createPrefs, panelHtml, regulationHtml, noteOf, noteFor, renderOptions, renderOptionsFor, esc, sync, start, firstTimeOn, KEY_HIDDEN, KEY_REFS, KEY_INTRO };
});
