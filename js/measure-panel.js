// The measurement panel and the Regulation tab.
//
// The Measurements button has a caret attached to it that opens a list beside the preview (it also opens by itself the first time Measurements is turned
// on in a session); the list names every distance the build draws, by area, each with a checkbox; one that is unchecked is left
// off the drawing and the rest are laid out again over the room it frees (measure-layout.js filterScene). The choice is kept per uniform in this browser,
// with the switch that puts each callout's paragraph back on its pill (off by default). The Regulation tab in the Extra step lists the same distances
// with their paragraphs, for a member who asks for them. Everything here is plain functions over measure-layout.js's catalogue; the page's glue is at the end.
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

  // ---- markup, as strings (the page sets them as innerHTML; the tests read them) ----
  // The panel: the references switch, All and None, then each area's distances with a checkbox and the value.
  function panelHtml(cat, hidden, refs){
    const off = new Set(hidden || []);
    const total = cat.entries.length, shown = cat.entries.filter(e => !off.has(e.id)).length;
    const head = `<div class="mpHead"><strong id="measurePanelTitle">Measurements shown</strong><span class="mpCount" aria-live="polite">${shown} of ${total}</span><button type="button" class="ghost mpDone" data-mp="close">Done</button></div>`;
    const sw = `<label class="mpSwitch"><input type="checkbox" data-mp="refs"${refs ? ' checked' : ''}><span>Show regulation references</span></label>`;
    const bulk = `<div class="mpBulk" role="group" aria-label="Show or hide all"><button type="button" class="ghost" data-mp="all">All</button><button type="button" class="ghost" data-mp="none">None</button></div>`;
    if(!total) return head + sw + '<p class="mpEmpty hintText">This uniform draws no measurements.</p>';
    const groups = cat.groups.map(g => `<fieldset class="mpGroup"><legend>${esc(g.area)}</legend>` + g.entries.map(e =>
      `<label class="mpRow"><input type="checkbox" data-id="${esc(e.id)}"${off.has(e.id) ? '' : ' checked'}><span class="mpName">${esc(e.name)}${e.count > 1 ? ` <span class="mpTimes">(${e.count})</span>` : ''}</span><span class="mpVal">${esc(e.value)}</span></label>`).join('') + '</fieldset>').join('');
    return head + sw + bulk + `<div class="mpList">${groups}</div>`;
  }

  // The Regulation tab: a table by area of the rule, its value and its paragraph (CAPR 39-1, and the ICL where the engine cites one).
  function regulationHtml(cat){
    if(!cat || !cat.entries.length) return '<p class="hintText">Choose a uniform to see the rules the drawing applies.</p>';
    const rows = cat.groups.map(g => `<tbody><tr class="regArea"><th colspan="3" scope="colgroup">${esc(g.area)}</th></tr>` + g.entries.map(e => {
      const p = ML.refParts(e.ref);
      const cell = (p.capr ? `<span class="regCapr">${esc(p.capr)}</span>` : '') + (p.icl ? `<span class="regIcl">${esc(p.icl)}</span>` : '') || '<span class="regNone">none</span>';
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

  function fillPanel(){
    const panel = by('measurePanel'); if(!panel) return;
    const cat = currentCatalogue() || { entries: [], groups: [] };
    const top = panel.querySelector('.mpList'), scroll = top ? top.scrollTop : 0;
    // The same list is left as it is: a redraw after every change would replace the checkbox a finger is on.
    const html = panelHtml(cat, prefs.hidden(uniformId()), prefs.refs());
    if(panel.dataset.shown === html) return;
    panel.dataset.shown = html; panel.innerHTML = html;
    const list = panel.querySelector('.mpList'); if(list) list.scrollTop = scroll;
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
      panel.addEventListener('click', e => {
        e.stopPropagation();
        const t = e.target.closest ? e.target.closest('[data-mp]') : null; if(!t) return;
        const act = t.getAttribute('data-mp'), u = uniformId();
        if(act === 'close'){ setOpen(false); btn.focus(); return; }
        const cat = currentCatalogue(); if(!cat) return;
        if(act === 'all') prefs.setHidden(u, []);
        else if(act === 'none') prefs.setHidden(u, prefs.hidden(u).concat(cat.entries.map(x => x.id)));
        else return;
        fillPanel(); rerender();
      });
      panel.addEventListener('change', e => {
        const t = e.target, u = uniformId();
        if(t.getAttribute('data-mp') === 'refs'){ prefs.setRefs(t.checked); const c = currentCatalogue(); if(c) panel.dataset.shown = panelHtml(c, prefs.hidden(u), prefs.refs()); rerender(); return; }
        const id = t.getAttribute('data-id'); if(id == null) return;
        const hidden = prefs.hidden(u).filter(x => x !== id);
        if(!t.checked) hidden.push(id);
        prefs.setHidden(u, hidden);
        const count = panel.querySelector('.mpCount'), cat = currentCatalogue();
        if(count && cat){ const off = new Set(hidden); count.textContent = `${cat.entries.filter(x => !off.has(x.id)).length} of ${cat.entries.length}`; }
        if(cat) panel.dataset.shown = panelHtml(cat, hidden, prefs.refs());
        rerender();
      });
      document.addEventListener('click', e => { const p = by('measurePanel'); if(p && !p.hidden && !p.contains(e.target) && !(e.target.closest && e.target.closest('.measureGroup'))) setOpen(false); });
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
  return { createPrefs, panelHtml, regulationHtml, renderOptions, renderOptionsFor, esc, sync, start, firstTimeOn, KEY_HIDDEN, KEY_REFS, KEY_INTRO };
});
