'use strict';
// A small DOM for the tests of scripts that build elements (js/visual-picker.js, the garment options panel). Not a browser: elements, text, attributes,
// classes, events that bubble, focus, and the selectors the scripts use (a tag, #id, .class, [attr], [attr="v"] and those joined, with commas). Markup set with
// innerHTML is kept as a string (`html`), not parsed.

class Node {
  constructor(tag, doc){
    this.nodeName = this.tagName = String(tag).toUpperCase();
    this.ownerDocument = doc;
    this.childNodes = [];
    this.parentNode = null;
    this.attrs = {};
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.html = '';
    this.hidden = false;
    this.tabIndex = -1;
    const owner = this;
    const names = () => (owner.attrs.class || '').split(/\s+/).filter(Boolean);
    const write = list => { owner.attrs.class = list.join(' '); };
    this.classList = {
      add: (...c) => write([...new Set([...names(), ...c])]),
      remove: (...c) => write(names().filter(x => !c.includes(x))),
      contains: c => names().includes(c),
      toggle: (c, force) => { const on = force === undefined ? !names().includes(c) : !!force; if(on) this.classList.add(c); else this.classList.remove(c); return on; }
    };
  }
  get className(){ return this.attrs.class || ''; }
  set className(v){ this.attrs.class = String(v); }
  get id(){ return this.attrs.id || ''; }
  set id(v){ this.attrs.id = String(v); }
  get children(){ return this.childNodes.filter(n => n.nodeType === 1); }
  get nodeType(){ return 1; }
  get firstChild(){ return this.childNodes[0] || null; }
  get textContent(){ return this.childNodes.map(n => n.nodeType === 3 ? n.nodeValue : n.textContent).join(''); }
  set textContent(v){
    this.childNodes.forEach(n => { n.parentNode = null; });
    this.childNodes = [];
    this.html = '';
    if(v !== '' && v != null) this.append(String(v));
  }
  get innerHTML(){ return this.html; }
  set innerHTML(v){
    this.childNodes.forEach(n => { n.parentNode = null; });
    this.childNodes = [];
    this.html = String(v);
  }
  setAttribute(k, v){ this.attrs[k] = String(v); if(k === 'tabindex') this.tabIndex = Number(v); if(k === 'hidden') this.hidden = true; }
  getAttribute(k){
    if(k === 'tabindex') return this.tabIndex === -1 && !('tabindex' in this.attrs) ? null : String(this.tabIndex);
    return k in this.attrs ? this.attrs[k] : null;
  }
  hasAttribute(k){ return this.getAttribute(k) !== null; }
  removeAttribute(k){ delete this.attrs[k]; }
  append(...items){
    for(const it of items){
      const n = typeof it === 'string' ? new Text(it, this.ownerDocument) : it;
      if(n.parentNode) n.parentNode.removeChild(n);
      n.parentNode = this;
      this.childNodes.push(n);
    }
  }
  appendChild(n){ this.append(n); return n; }
  removeChild(n){ const i = this.childNodes.indexOf(n); if(i >= 0){ this.childNodes.splice(i, 1); n.parentNode = null; } return n; }
  replaceChildren(...items){ this.textContent = ''; this.append(...items); }
  remove(){ if(this.parentNode) this.parentNode.removeChild(this); }
  contains(n){ for(let p = n; p; p = p.parentNode) if(p === this) return true; return false; }
  addEventListener(type, fn){ (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener(type, fn){ this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
  dispatchEvent(e){
    e.target = e.target || this;
    e.preventDefault = e.preventDefault || (() => { e.defaultPrevented = true; });
    e.stopPropagation = e.stopPropagation || (() => { e.stopped = true; });
    for(let n = this; n && !e.stopped; n = n.parentNode){
      e.currentTarget = n;
      for(const fn of (n.listeners && n.listeners[e.type]) || []) fn(e);
      if(e.bubbles === false) break;
    }
    return !e.defaultPrevented;
  }
  focus(){ this.ownerDocument.activeElement = this; }
  blur(){ if(this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null; }
  click(){ this.dispatchEvent({ type: 'click', bubbles: true }); }
  matches(sel){ return sel.split(',').some(part => matchesCompound(this, part.trim())); }
  closest(sel){ for(let n = this; n && n.nodeType === 1; n = n.parentNode) if(n.matches(sel)) return n; return null; }
  querySelectorAll(sel){
    const out = [];
    const walk = n => { for(const c of n.children){ if(c.matches(sel)) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  querySelector(sel){ return this.querySelectorAll(sel)[0] || null; }
}

class Text {
  constructor(v, doc){ this.nodeValue = String(v); this.nodeType = 3; this.parentNode = null; this.ownerDocument = doc; }
  get textContent(){ return this.nodeValue; }
}

// One compound selector: tag, #id, .class and [attr] / [attr="value"], in any order, no spaces.
function matchesCompound(node, sel){
  if(!sel) return false;
  const re = /^([A-Za-z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w:-]+)(?:=("[^"]*"|'[^']*'|[^\]]*))?\]/y;
  let at = 0, m;
  while(at < sel.length){
    re.lastIndex = at;
    m = re.exec(sel);
    if(!m) throw new Error('mini-dom: unsupported selector ' + sel);
    at = re.lastIndex;
    if(m[1] && node.nodeName !== m[1].toUpperCase()) return false;
    if(m[2] && node.id !== m[2]) return false;
    if(m[3] && !node.classList.contains(m[3])) return false;
    if(m[4]){
      const have = node.getAttribute(m[4]);
      if(have === null) return false;
      if(m[5] !== undefined && have !== m[5].replace(/^["']|["']$/g, '')) return false;
    }
  }
  return true;
}

function createDocument(){
  const doc = {
    activeElement: null,
    createElement: tag => new Node(tag, doc),
    createElementNS: (ns, tag) => new Node(tag, doc),
    createTextNode: v => new Text(v, doc),
    listeners: {},
    addEventListener(type, fn){ (doc.listeners[type] = doc.listeners[type] || []).push(fn); },
    getElementById(id){ return doc.body.contains && (function find(n){ for(const c of n.children){ if(c.id === id) return c; const r = find(c); if(r) return r; } return null; })(doc.body); }
  };
  doc.body = new Node('body', doc);
  return doc;
}

const keydown = (key, extra) => Object.assign({ type: 'keydown', key, bubbles: true }, extra);

module.exports = { createDocument, keydown, Node };
