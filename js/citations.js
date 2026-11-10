// Regulation references in the page's notes, hints and messages.
//
// The texts the page shows end their rule with its paragraph in brackets, "(CAPR 39-1, 10.2.5)". Read one after another the references crowd the
// sentences they belong to, so on the page each one is taken out of its text and put behind a small question mark at the end of it: a press shows
// the reference where it was, a second press hides it. The Extra step's Regulation tab has a switch that puts every reference back in its text (kept
// in this browser) and a list of each text on the page with its reference. The strings are not changed, here or where they are written, and an
// element's textContent reads as it did, so nothing that reads a note sees a difference. The first part is plain functions; the page's glue is at the end.
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
  // Left as they are: the drawing, code, what a member types, a text already done, and the Regulation tab, which is where references are read.
  const SKIP = 'svg, script, style, textarea, [contenteditable], .citeHost, #extraPanel-regulation';
  // No mark can sit inside these (a control inside a control, or a message nothing can be pressed on): the reference is hidden and the switch shows it.
  const PLAIN = 'button, a, summary, [role="button"], [role="tab"], [role="option"], .capubToast';
  const TIPPED = '[title*="("]';
  const open = new Set();        // the texts whose reference is showing, so the same text drawn again stays open
  const dirty = new Set();       // the lists whose options were read in this pass
  const listOf = new WeakMap();  // a list's mark -> the list

  function mark(isOpen){
    const m = document.createElement('span');
    m.className = 'citeBtn';
    m.setAttribute('role', 'button'); m.tabIndex = 0;
    m.setAttribute('aria-label', 'Regulation reference');
    m.setAttribute('aria-expanded', String(!!isOpen));
    return m;
  }

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
    if(!parent.closest(PLAIN)){
      if(open.has(value)) host.classList.add('citeOpen');
      host.append(mark(open.has(value)));
    }
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
  // A tooltip holds text only as well: its reference is cut from it and the whole text is kept on the element.
  function visitTip(el){
    const text = el.getAttribute('title');
    if(text === null || el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || el.closest('#extraPanel-regulation')) return;
    const s = split(text);
    if(s.refs.length){
      el.dataset.citeTitle = text;
      if(!prefs.shown()) el.setAttribute('title', s.text);
    }else if(el.dataset.citeTitle && split(el.dataset.citeTitle).text !== text) delete el.dataset.citeTitle;   // the page gave it another text
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
    const key = 'list:' + (sel.id || sel.name || sel.className), on = open.has(key);
    host.dataset.citeKey = key; host.dataset.citeFull = full;
    if(host.firstChild.textContent !== refs) host.firstChild.textContent = refs;
    host.classList.toggle('citeOpen', on);
    host.lastChild.setAttribute('aria-expanded', String(on));
  }

  function visit(n){
    if(n.nodeType === 3){ visitText(n); return; }
    if(n.nodeType !== 1 || n.namespaceURI !== 'http://www.w3.org/1999/xhtml' || n.closest(SKIP)) return;
    const found = [], walker = document.createTreeWalker(n, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode(x){
      if(x.nodeType === 3) return x.nodeValue.indexOf('(') === -1 ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
      return x.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
    } });
    while(walker.nextNode()) found.push(walker.currentNode);
    found.forEach(visitText);
    if(n.matches(TIPPED)) visitTip(n);
    n.querySelectorAll(TIPPED).forEach(visitTip);
  }
  function settle(){
    for(const sel of dirty) if(sel.isConnected) syncSelect(sel);
    dirty.clear();
    queueList();
  }
  function onMutations(list){
    for(const m of list){
      if(m.type === 'characterData'){ if(m.target.nodeType === 3 && m.target.isConnected) visitText(m.target); }
      else if(m.type === 'attributes'){ if(m.attributeName === 'title' && m.target.isConnected) visitTip(m.target); }
      else for(const n of m.addedNodes) if(n.isConnected) visit(n);
    }
    settle();
  }

  // The mark: a press, or Enter or the space bar, shows or hides the reference. Taken before anything else on the page, so a mark inside a label
  // or a row does not also tick the box or pick the row.
  function toggle(btn){
    const host = btn.parentNode;
    const sel = listOf.get(host);
    if(sel && sel.isConnected) syncSelect(sel);
    const key = host.dataset.citeKey || host.textContent, on = !host.classList.contains('citeOpen');
    host.classList.toggle('citeOpen', on);
    btn.setAttribute('aria-expanded', String(on));
    if(on) open.add(key); else open.delete(key);
  }
  const markOf = e => e.target && e.target.closest ? e.target.closest('.citeBtn') : null;
  function onClick(e){
    const btn = markOf(e); if(!btn) return;
    e.preventDefault(); e.stopPropagation();
    toggle(btn);
  }
  function onKey(e){
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const btn = markOf(e); if(!btn) return;
    e.preventDefault(); e.stopPropagation();
    toggle(btn);
  }
  function onChange(e){
    const t = e.target;
    if(t && t.nodeName === 'SELECT' && t.querySelector('option[data-cite-full]')) syncSelect(t);
  }

  // The switch: every reference back in its text, the marks away, and the options and the tooltips with their whole text.
  function applyShown(){
    const on = prefs.shown();
    if(on) document.documentElement.setAttribute('data-cites', 'shown'); else document.documentElement.removeAttribute('data-cites');
    for(const opt of document.querySelectorAll('option[data-cite-full]')){
      const text = on ? opt.dataset.citeFull : split(opt.dataset.citeFull).text;
      if(opt.textContent !== text) opt.textContent = text;
    }
    for(const el of document.querySelectorAll('[data-cite-title]')){
      const text = on ? el.dataset.citeTitle : split(el.dataset.citeTitle).text;
      if(el.getAttribute('title') !== text) el.setAttribute('title', text);
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
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('capub:rendered', queueList);
  }

  return { isCitation, parts, split, refLabel, notesHtml, createPrefs, esc, start, KEY_SHOWN };
});
