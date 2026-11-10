// Regulation references in the page's notes, hints and messages.
//
// The texts the page shows end their rule with its paragraph in brackets, "(CAPR 39-1, 10.2.5)". Read one after another the references crowd the
// sentences they belong to, so on the page each one is taken out of its text and put behind a small question mark at the end of it: a press opens
// the reference in a small popover floating just above the mark (over the page: nothing moves), a second press, a press anywhere else or Escape closes
// it, and only one is open at a time. Which mark is open is kept by the mark, not by its text, so two rows that say the same sentence open one at a
// time. The Extra step's Regulation tab has a switch that puts every reference back in its text (kept in this browser) and a list of each text on the
// page with its reference. The strings are not changed, here or where they are written, and an element's textContent reads as it did, so nothing that
// reads a note sees a difference. The first part is plain functions; the page's glue is at the end.
(function(root, factory){
  const node = typeof module === 'object' && module.exports;
  const api = factory();
  if(node) module.exports = api;
  else { root.CAPUBCitations = api; if(typeof document !== 'undefined') api.start(); }
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  const KEY_SHOWN = 'capubCitesShown';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---- which brackets are a reference ----
  // One that opens with a publication ("CAPR 39-1, ...", "ICL 25-02"), or with a paragraph number of three parts or more ("4.2.2.4, ICL 25-02"), so a
  // decimal such as "(1.5 in)" is never one. A two-part paragraph ("10.2, ...") counts only beside a publication or a longer paragraph.
  const SOURCE = '(?:CAPR|CAPP|CAPM|ICL|DAFI|AFI)\\s?\\d';
  const LONG = '\\d+(?:\\.\\d+){2,}';
  const OPENS = new RegExp(`^(?:${SOURCE}|${LONG})`);
  const SHORT = /^\d+\.\d+[a-z]?\s?[,;]/;
  const NAMES = new RegExp(`\\b(?:${SOURCE}|${LONG})`);
  const isCitation = inner => OPENS.test(inner) || (SHORT.test(inner) && NAMES.test(inner));

  // A text as its runs, in order: plain ones and references. A reference takes the space before it, so the sentence closes up around it, and may
  // hold brackets of its own ("21k(2)"). Brackets that are not a reference stay in the plain run.
  function parts(text){
    const s = String(text == null ? '' : text), out = [];
    let from = 0, at = s.indexOf('(');
    while(at !== -1){
      let depth = 0, end = -1;
      for(let j = at; j < s.length; j++){
        if(s[j] === '(') depth++;
        else if(s[j] === ')' && --depth === 0){ end = j; break; }
      }
      if(end === -1) break;
      if(!isCitation(s.slice(at + 1, end))){ at = s.indexOf('(', at + 1); continue; }
      let start = at;
      while(start > from && /\s/.test(s[start - 1])) start--;
      if(start > from) out.push({ ref: false, text: s.slice(from, start) });
      out.push({ ref: true, text: s.slice(start, end + 1) });
      from = end + 1; at = s.indexOf('(', from);
    }
    if(from < s.length) out.push({ ref: false, text: s.slice(from) });
    return out;
  }
  // The text without its references, and the references without their brackets.
  function split(text){
    const p = parts(text);
    return { text: p.filter(x => !x.ref).map(x => x.text).join(''), refs: p.filter(x => x.ref).map(x => x.text.trim().slice(1, -1)) };
  }
  // A reference as the list names it: a paragraph given by its number alone is CAPR 39-1's.
  const refLabel = ref => /^\d/.test(ref) ? 'CAPR 39-1, ' + ref : ref;

  // The references a mark opens: those in the text it ends, else (a chip that is only the reference) the chip's own text without brackets.
  function refsOfText(full, chips){
    const found = split(full).refs;
    return found.length ? found : (chips || []).map(c => String(c).trim().replace(/^\(|\)$/g, '').trim()).filter(Boolean);
  }
  // The popover's content: each reference on a line of its own, as the list names it.
  const popHtml = refs => (refs || []).map(r => `<span class="citePopRef">${esc(refLabel(r))}</span>`).join('');
  // Where the popover goes, as fixed coordinates: centred on the mark, just above it (below it where there is no room above), kept inside the
  // window by a margin; `arrow` is how far from the popover's left edge the mark's centre is, for the pointer. anchor, size and view are in pixels.
  function placePop(anchor, size, view, gap = 8, margin = 8){
    const centre = (anchor.left + anchor.right) / 2;
    const left = Math.max(margin, Math.min(Math.round(centre - size.w / 2), view.w - margin - size.w));
    const above = anchor.top - gap - size.h >= margin;
    const top = Math.round(above ? anchor.top - gap - size.h : anchor.bottom + gap);
    const arrow = Math.round(Math.max(12, Math.min(size.w - 12, centre - left)));
    return { left, top, side: above ? 'above' : 'below', arrow };
  }
  // A mark that was open and was drawn again (the page redraws a list on any press) is found again by its text and its place among the marks that
  // share the text, so the one that was open stays open and its twin does not.
  const markAgain = (marks, ord) => (ord >= 0 && ord < marks.length ? marks[ord] : null);
  // Which mark is open: at most one, held by the mark itself and its place, never by its text, so a twin that says the same sentence stays shut.
  function createOpenMark(){
    let cur = null;
    return {
      get: () => cur,
      is: btn => !!cur && cur.btn === btn,
      open(btn, key, ord){ cur = { btn, key, ord }; return cur; },
      close(){ const was = cur; cur = null; return was; },
      // The marks that now carry the open one's text: the open one is the one at its old place, and if there is none it is closed.
      again(marks){
        if(!cur) return null;
        const next = markAgain(marks, cur.ord);
        if(next) cur.btn = next; else cur = null;
        return next;
      }
    };
  }

  // ---- markup, as a string (the page sets it as innerHTML; the tests read it) ----
  // The Regulation tab's list: each text on the page that cites a paragraph, and what it cites.
  function notesHtml(rows){
    if(!rows || !rows.length) return '<p class="hintText">No note or hint on the page cites a paragraph.</p>';
    const body = rows.map(r => `<tr><th scope="row">${esc(r.text)}</th><td class="regRef">${r.refs.map(x => `<span>${esc(refLabel(x))}</span>`).join('')}</td></tr>`).join('');
    return `<table class="regTable citeTable"><thead><tr><th scope="col">Note or hint</th><th scope="col">Reference</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  // ---- what is kept: the switch, in the browser's storage (a stored value that does not read is ignored) ----
  function createPrefs(storage){
    let shown = null;
    return {
      shown(){ if(shown === null){ try{ shown = !!storage && storage.getItem(KEY_SHOWN) === '1'; }catch(e){ shown = false; } } return shown; },
      setShown(on){ shown = !!on; try{ if(storage) storage.setItem(KEY_SHOWN, shown ? '1' : '0'); }catch(e){ /* private window or full storage: the choice lasts until reload */ } }
    };
  }

  // ---- the page ----
  const prefs = createPrefs((() => { try{ return typeof document !== 'undefined' ? localStorage : null; }catch(e){ return null; } })());
  const by = id => document.getElementById(id);
  const isHtml = n => typeof HTMLElement === 'function' && n instanceof HTMLElement;   // the page's own elements, not the drawing's
  // Left as they are: the drawing, code, what a member types, a text already done, and the Regulation tab, which is where references are read.
  const SKIP = 'svg, script, style, textarea, [contenteditable], .citeHost, .citePop, #extraPanel-regulation';
  // No mark can sit inside these (a control inside a control, or a message nothing can be pressed on): the reference is hidden and the switch shows it.
  // A uniform card the member may not wear is a button too, but it does nothing when pressed, so its reference keeps the mark.
  const PLAIN = 'button, a, summary, [role="button"], [role="tab"], [role="option"], .capubToast';
  const INERT = '.uniformOption.locked';
  const TEXT_ATTRS = ['title', 'placeholder', 'alt'];   // text a member can read that is not a node: tooltips, a field's hint, an image's text
  const TIPPED = TEXT_ATTRS.map(a => `[${a}*="("]`).join(',');
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const POP_ID = 'citePop';
  const dirty = new Set();       // the lists whose options were read in this pass
  const listOf = new WeakMap();  // a list's mark -> the list
  const open = createOpenMark(); // the mark whose reference is showing: { btn, key, ord }; only one at a time
  let pop = null;                // the popover, made when the first mark is pressed
  let frame = 0;                 // a pending reposition

  function mark(isOpen){
    const m = document.createElement('span');
    m.className = 'citeBtn';
    m.setAttribute('role', 'button'); m.tabIndex = 0;
    m.setAttribute('aria-label', 'Regulation reference');
    m.setAttribute('aria-expanded', String(!!isOpen));
    return m;
  }
  // A mark is told apart from its twins (the same sentence on another row) by its text and its place among the marks that carry that text.
  const keyOf = host => host.dataset.citeKey || host.dataset.citeFull || host.textContent;
  const marksOf = key => [...document.querySelectorAll('.citeBtn')].filter(b => b.parentNode && keyOf(b.parentNode) === key);

  // A text node that cites: replaced by a span holding the same text, the references in spans of their own, and the mark.
  function visitText(node){
    const parent = node.parentNode;
    if(!parent || parent.nodeType !== 1) return;
    if(parent.nodeName === 'OPTION'){ visitOption(parent); return; }
    const value = node.nodeValue;
    if(value.indexOf('(') === -1 || parent.closest(SKIP)) return;
    const p = parts(value);
    if(!p.some(x => x.ref)) return;
    const host = document.createElement('span');
    host.className = 'citeHost';
    for(const x of p){
      if(!x.ref){ host.append(x.text); continue; }
      const ref = document.createElement('span');
      ref.className = 'citeRef'; ref.textContent = x.text;
      host.append(ref);
    }
    const m = parent.closest(PLAIN) && !parent.closest(INERT) ? null : mark(false);
    if(m) host.append(m);
    parent.replaceChild(host, node);
  }
  // An option holds text only, so its reference is cut from the text (the whole text is kept on the option) and the list's label carries the mark.
  function visitOption(opt){
    const text = opt.textContent, s = split(text);
    if(s.refs.length){
      if(!opt.hasAttribute('value')) opt.setAttribute('value', opt.value);
      opt.dataset.citeFull = text;
      if(!prefs.shown()) opt.textContent = s.text;
    }else if(opt.dataset.citeFull && split(opt.dataset.citeFull).text !== text) delete opt.dataset.citeFull;   // the page gave it another text
    const sel = opt.closest('select');
    if(sel) dirty.add(sel);
  }
  // A tooltip, a field's hint and an image's text hold text only as well: the reference is cut from them and the whole text is kept on the element.
  const dataKey = attr => 'cite' + attr.charAt(0).toUpperCase() + attr.slice(1);
  function visitTip(el){
    if(!isHtml(el) || el.closest('#extraPanel-regulation')) return;
    for(const attr of TEXT_ATTRS){
      const text = el.getAttribute(attr);
      if(text === null) continue;
      const s = split(text), key = dataKey(attr);
      if(s.refs.length){
        el.dataset[key] = text;
        if(!prefs.shown()) el.setAttribute(attr, s.text);
      }else if(el.dataset[key] && split(el.dataset[key]).text !== text) delete el.dataset[key];   // the page gave it another text
    }
  }
  // The drawing's own tooltips (the <title> of a part of the art) are the same: the reference is cut from the text and the whole text kept on the element.
  function visitSvgTitle(t){
    const text = t.textContent;
    if(text.indexOf('(') === -1 && !t.dataset.citeSvgTitle) return;
    const s = split(text);
    if(s.refs.length){
      t.dataset.citeSvgTitle = text;
      if(!prefs.shown()) t.textContent = s.text;
    }else if(t.dataset.citeSvgTitle && split(t.dataset.citeSvgTitle).text !== text) delete t.dataset.citeSvgTitle;
  }
  // The mark on a list's label shows the reference of the option that is picked.
  function syncSelect(sel){
    const label = sel.closest('label') || (sel.id ? document.querySelector('label[for="' + sel.id.replace(/["\\]/g, '\\$&') + '"]') : null);
    if(!label) return;
    const opt = sel.options[sel.selectedIndex], full = (opt && opt.dataset.citeFull) || '';
    const refs = parts(full).filter(x => x.ref).map(x => x.text).join('');
    let host = label.querySelector('.citeOfSelect');
    if(!refs){ if(host) host.remove(); return; }
    if(!host){
      host = document.createElement('span');
      host.className = 'citeHost citeOfSelect';
      const ref = document.createElement('span');
      ref.className = 'citeRef';
      host.append(ref, mark(false));
      label.append(host);
    }
    listOf.set(host, sel);
    host.dataset.citeKey = 'list:' + (sel.id || sel.name || sel.className); host.dataset.citeFull = full;
    if(host.firstChild.textContent !== refs) host.firstChild.textContent = refs;
    host.lastChild.setAttribute('aria-expanded', String(open.is(host.lastChild)));
  }

  function visit(n){
    if(n.nodeType === 3){ visitText(n); return; }
    if(n.nodeType !== 1) return;
    if(n.namespaceURI === SVG_NS){
      if(n.localName === 'title') visitSvgTitle(n); else n.querySelectorAll('title').forEach(visitSvgTitle);
      return;
    }
    if(!isHtml(n) || n.closest(SKIP)) return;
    const found = [], walker = document.createTreeWalker(n, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode(x){
      if(x.nodeType === 3) return x.nodeValue.indexOf('(') === -1 ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
      return x.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
    } });
    while(walker.nextNode()) found.push(walker.currentNode);
    found.forEach(visitText);
    if(n.matches(TIPPED)) visitTip(n);
    n.querySelectorAll(TIPPED).forEach(visitTip);
    n.querySelectorAll('svg title').forEach(visitSvgTitle);
  }
  function settle(){
    for(const sel of dirty) if(sel.isConnected) syncSelect(sel);
    dirty.clear();
    reanchor();
    queueList();
  }
  function onMutations(list){
    for(const m of list){
      if(m.type === 'characterData'){ if(m.target.nodeType === 3 && m.target.isConnected) visitText(m.target); }
      else if(m.type === 'attributes'){ if(TEXT_ATTRS.includes(m.attributeName) && m.target.isConnected) visitTip(m.target); }
      else for(const n of m.addedNodes) if(n.isConnected) visit(n);
    }
    settle();
  }

  // ---- the popover ----
  function popover(){
    if(pop) return pop;
    pop = document.createElement('div');
    pop.id = POP_ID; pop.className = 'citePop';
    pop.setAttribute('role', 'status');
    pop.hidden = true;
    return pop;
  }
  // The mark is on the page and not under a part of its containers that is scrolled away or folded shut.
  function inView(el, r){
    if(!el.getClientRects().length) return false;
    const root = document.documentElement;
    let clip = { left: 0, top: 0, right: root.clientWidth, bottom: root.clientHeight };
    for(let p = el.parentElement; p && p !== root; p = p.parentElement){
      const o = getComputedStyle(p);
      if(!/auto|scroll|hidden|clip/.test(o.overflowX + o.overflowY) || !p.getClientRects().length) continue;   // a box that is not drawn (display: contents) clips nothing
      const c = p.getBoundingClientRect();
      clip = { left: Math.max(clip.left, c.left), top: Math.max(clip.top, c.top), right: Math.min(clip.right, c.right), bottom: Math.min(clip.bottom, c.bottom) };
    }
    return r.bottom > clip.top && r.top < clip.bottom && r.right > clip.left && r.left < clip.right;
  }
  function reposition(){
    frame = 0;
    const cur = open.get();
    if(!cur || !pop) return;
    const r = cur.btn.getBoundingClientRect();
    if(!inView(cur.btn, r)){ close(); return; }
    const root = document.documentElement, s = pop.getBoundingClientRect();
    const at = placePop(r, { w: s.width, h: s.height }, { w: root.clientWidth, h: root.clientHeight });
    pop.style.left = at.left + 'px'; pop.style.top = at.top + 'px';
    pop.dataset.side = at.side; pop.style.setProperty('--arrow', at.arrow + 'px');
  }
  function queueReposition(){ if(open.get() && !frame) frame = requestAnimationFrame(reposition); }
  function close(){
    const was = open.close();
    if(!was) return;
    was.btn.setAttribute('aria-expanded', 'false'); was.btn.removeAttribute('aria-describedby');
    if(pop){ pop.hidden = true; pop.textContent = ''; }
  }
  function show(btn){
    const host = btn.parentNode, sel = listOf.get(host);
    if(sel && sel.isConnected) syncSelect(sel);
    const refs = refsOfText(host.dataset.citeFull || host.textContent, [...host.querySelectorAll('.citeRef')].map(x => x.textContent));
    if(!refs.length) return;
    close();
    const key = keyOf(host), p = popover();
    open.open(btn, key, marksOf(key).indexOf(btn));
    btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-describedby', POP_ID);
    p.innerHTML = popHtml(refs);
    // Inside an open dialog the popover goes in the dialog, or the page's top layer would cover it.
    const root = btn.closest('dialog[open]') || document.body;
    if(p.parentNode !== root) root.appendChild(p);
    p.hidden = false;
    reposition();
  }
  // The page draws a list again on almost any press, which replaces its marks: the one that was open is found again among the new ones.
  function reanchor(){
    const cur = open.get();
    if(!cur || cur.btn.isConnected) return;
    const again = open.again(marksOf(cur.key));
    if(!again){ close(); return; }
    const focused = !document.activeElement || document.activeElement === document.body;
    again.setAttribute('aria-expanded', 'true'); again.setAttribute('aria-describedby', POP_ID);
    if(focused) again.focus({ preventScroll: true });
    queueReposition();
  }

  // The mark: a press, or Enter or the space bar, opens its reference or, when it is open, closes it. Taken before anything else on the page (the window's
  // capture phase), so a mark inside a label or a row does not also tick the box or pick the row, and the page does not redraw for it.
  function toggle(btn){
    if(open.is(btn)) close(); else show(btn);
  }
  const markOf = e => e.target && e.target.closest ? e.target.closest('.citeBtn') : null;
  const inPop = e => !!pop && !!e.target && pop.contains(e.target);
  function onClick(e){
    const btn = markOf(e);
    if(!btn){ if(open.get() && !inPop(e)) close(); return; }
    e.preventDefault(); e.stopPropagation();
    toggle(btn);
  }
  // Anywhere else: a press closes it before the press does its own work.
  function onDown(e){ if(open.get() && !markOf(e) && !inPop(e)) close(); }
  function onKey(e){
    if(e.key === 'Escape' && open.get()){
      e.preventDefault(); e.stopPropagation();
      const btn = open.get().btn;
      close();
      if(btn.isConnected) btn.focus({ preventScroll: true });
      return;
    }
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const btn = markOf(e); if(!btn) return;
    e.preventDefault(); e.stopPropagation();
    toggle(btn);
  }
  // Moving on by the keyboard closes it too.
  function onFocus(e){ if(open.get() && !open.is(e.target) && !inPop(e)) close(); }
  function onChange(e){
    const t = e.target;
    if(t && t.nodeName === 'SELECT' && t.querySelector('option[data-cite-full]')) syncSelect(t);
  }

  // The switch: every reference back in its text, the marks away, and the options and the tooltips with their whole text.
  function applyShown(){
    const on = prefs.shown();
    if(on){ close(); document.documentElement.setAttribute('data-cites', 'shown'); } else document.documentElement.removeAttribute('data-cites');
    for(const opt of document.querySelectorAll('option[data-cite-full]')){
      const text = on ? opt.dataset.citeFull : split(opt.dataset.citeFull).text;
      if(opt.textContent !== text) opt.textContent = text;
    }
    for(const attr of TEXT_ATTRS){
      const key = dataKey(attr);
      for(const el of document.querySelectorAll('[data-cite-' + attr + ']')){
        const text = on ? el.dataset[key] : split(el.dataset[key]).text;
        if(el.getAttribute(attr) !== text) el.setAttribute(attr, text);
      }
    }
    for(const t of document.querySelectorAll('[data-cite-svg-title]')){
      const text = on ? t.dataset.citeSvgTitle : split(t.dataset.citeSvgTitle).text;
      if(t.textContent !== text) t.textContent = text;
    }
    const box = by('citesShown');
    if(box) box.checked = on;
  }

  // The Regulation tab's list, from what is on the page now. A text in a closed picker or in a part of the page that is switched off is not on the
  // page; the other steps and tabs are.
  function onPage(el){
    for(let p = el; p && p !== document.body; p = p.parentElement){
      if(p.classList.contains('capubToast')) return false;
      if(p.matches('.stepGroup, [role="tabpanel"]')) continue;
      if(getComputedStyle(p).display === 'none') return false;
    }
    return true;
  }
  function collect(){
    const seen = new Set(), rows = [];
    for(const host of document.querySelectorAll('.citeHost')){
      const full = host.dataset.citeFull || host.textContent, s = split(full);
      if(!s.refs.length || seen.has(full) || !onPage(host)) continue;
      seen.add(full);
      rows.push({ text: s.text.replace(/\s+/g, ' ').trim(), refs: s.refs });
    }
    return rows;
  }
  let listed = null, listTimer = 0;
  function fillList(){
    listTimer = 0;
    const host = by('regulationNotes');
    if(!host || !host.getClientRects().length) return;   // filled when the tab is open; opening it is a change the page reports
    const html = notesHtml(collect());
    if(html === listed) return;
    listed = html; host.innerHTML = html;
  }
  function queueList(){ if(!listTimer) listTimer = setTimeout(fillList, 150); }

  function start(){
    const go = () => {
      applyShown();
      visit(document.body); settle();
      new MutationObserver(onMutations).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'hidden'] });
      const box = by('citesShown');
      if(box) box.addEventListener('change', () => { prefs.setShown(box.checked); applyShown(); });
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    window.addEventListener('click', onClick, true);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('focusin', onFocus, true);
    window.addEventListener('scroll', queueReposition, { capture: true, passive: true });
    window.addEventListener('resize', queueReposition);
    document.addEventListener('change', onChange, true);
    document.addEventListener('capub:rendered', queueList);
  }

  return { isCitation, parts, split, refLabel, refsOfText, popHtml, placePop, markAgain, notesHtml, createPrefs, createOpenMark, esc, start, KEY_SHOWN };
});
