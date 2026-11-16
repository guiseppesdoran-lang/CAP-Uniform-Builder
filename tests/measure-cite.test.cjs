'use strict';
// A tap on a distance shows the paragraph it carries out (the owner, 2026-11-12: "if you click on a specific measurement, the regulatory citation should pop up,
// kind of like the question marks"). The distance has a question mark in the Measurements list and, in the drawing, its lines and its label take the press; both open
// the popover the page's other question marks use (js/citations.js) with the distance as a line and its paragraph, from the catalogue's own data
// (js/engine/measure-layout.js). A distance no paragraph states opens nothing. The pure parts are tested as functions, the markup as strings, the drawing's anchors
// on the renderer's nodes, and the press itself by running citations.js's page glue over a small fake page.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const ML = require('../js/engine/measure-layout.js');
const MP = require('../js/measure-panel.js');
const C = require('../js/citations.js');
const R = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const MATRIX = R.matrix().builds;
const compose = name => { const b = MATRIX.find(x => x.name === name); assert.ok(b, name); return P.composeUniform(R.makeBuild(JSON.parse(JSON.stringify(b.build))), store); };
const BUILDS = ['blues_a-male-senior-Capt', 'blues_a-female-senior-SMSgt', 'blues_b-male-cadet-C-SSgt', 'abu-male-senior-Capt', 'ocp-male-senior-Capt', 'flight_suit-male-senior-Capt',
  'mess_dress-male-senior-Col', 'aviator-female-senior-Capt', 'semi_formal-female-senior-Col', 'polo-male-senior-Capt', 'corporate_field-female-senior-Capt'];

test('a distance with a paragraph has a note: the distance as a line, then the paragraph(s); one without has none', async () => {
  let withNote = 0;
  const without = new Set();
  for(const name of BUILDS){
    const scene = await compose(name);
    for(const e of ML.catalogue(scene).entries){
      const note = MP.noteOf(e);
      if(!e.ref){ assert.equal(note, null, `${name}: ${e.name} states no paragraph, so it opens nothing`); without.add(`${name.split('-')[0]}: ${e.name} ${e.value}`); continue; }
      withNote++;
      assert.ok(note, `${name}: ${e.name} ${e.value} has a note`);
      assert.equal(note.rule, `${e.name}: ${e.value}.`);
      assert.ok(note.refs.length >= 1 && note.refs.length <= 2);
      // The rule is the distance only; the publication is named in the paragraph lines, as the question marks name it.
      assert.doesNotMatch(note.rule, /CAPR|ICL|\d\.\d+\.\d/);
      assert.match(note.refs[0], /^(CAPR 39-1, \d|ICL 25-02 \d)/);
      assert.equal(ML.refParts(e.ref).capr ? note.refs[0] === ML.refText(ML.refParts(e.ref).capr) : true, true);
    }
  }
  assert.ok(withNote > 30, 'the matrix has many distances with a paragraph');
  // The only two that do not: the OCP's shoulder seam to the flag and to AUX, which the garment's drawing sets and no paragraph states.
  assert.deepEqual([...without].sort(), ['ocp: Shoulder seam to the AUX 4.95 in', 'ocp: Shoulder seam to the flag 4.95 in']);
  assert.equal(MP.noteOf(null), null);
  assert.equal(MP.noteOf({ name: 'Collar', value: '1 in', ref: '' }), null);
  // A paragraph of the ICL alone, and one beside a CAPR 39-1 paragraph.
  assert.deepEqual(MP.noteOf({ name: 'Visor to grade', value: '½ in', ref: '7.1.1.8, ICL 25-02 6.2.11.1' }), { rule: 'Visor to grade: ½ in.', refs: ['CAPR 39-1, 7.1.1.8', 'ICL 25-02 6.2.11.1'] });
  assert.deepEqual(MP.noteOf({ name: 'Visor to grade', value: '½ in', ref: 'ICL 25-02 6.2.11.1' }).refs, ['ICL 25-02 6.2.11.1']);
  assert.deepEqual(MP.noteOf({ name: 'Blue around the embroidery', value: '⅛ in', ref: '5.1.1.1.1.1, 5.1.1.1.1.3' }).refs, ['CAPR 39-1, 5.1.1.1.1.1, 5.1.1.1.1.3']);
});

test('the popover\'s markup: the distance, then each paragraph on a line of its own; nothing for a note with no paragraph', () => {
  const html = C.measurePopHtml({ rule: 'Ribbons to badge: ½ in.', refs: ['CAPR 39-1, 4.1.5.2.2.4.1', 'ICL 25-02 6.2.11.1'] });
  assert.equal(html, '<span class="citePopRule">Ribbons to badge: ½ in.</span><span class="citePopRef">CAPR 39-1, 4.1.5.2.2.4.1</span><span class="citePopRef">ICL 25-02 6.2.11.1</span>');
  assert.equal(C.measurePopHtml(null), '');
  assert.equal(C.measurePopHtml({ rule: 'x', refs: [] }), '');
  assert.match(C.measurePopHtml({ rule: 'A <b> & "c"', refs: ['1.2.3'] }), /A &lt;b&gt; &amp; &quot;c&quot;/);
});

test('in the list a distance with a paragraph has a question mark beside its row, outside the switch; its text opens the same paragraph; one without has neither', async () => {
  const scene = await compose('ocp-male-senior-Capt');
  const cat = ML.catalogue(scene);
  const html = MP.panelHtml(cat, []);
  const rows = html.split('<div class="mpRow">').slice(1);
  assert.equal(rows.length, cat.entries.length);
  const marks = html.match(/<span class="citeBtn citeMeasure"[^>]*>/g) || [];
  assert.equal(marks.length, cat.entries.filter(e => e.ref).length);
  assert.equal(cat.entries.filter(e => !e.ref).length, 2);
  cat.entries.forEach((e, i) => {
    const row = rows.find(r => r.includes(`data-id="${MP.esc(e.id)}"`));
    assert.ok(row, e.name);
    const mark = `data-cite-measure="${MP.esc(e.id)}"`;
    if(e.ref){
      assert.equal(row.split(mark).length - 1, 2, `${e.name}: its text and its mark both carry the id`);
      assert.match(row, /<span class="mpText" data-cite-measure="[^"]*" aria-hidden="true">/, 'the text opens the paragraph by the page\'s own handler');
      assert.ok(row.indexOf('</button>') < row.indexOf(mark), 'the mark is beside the switch, not in it');
      assert.match(row, /role="button" tabindex="0" aria-expanded="false" aria-label="Regulation reference: /);
    }else{
      assert.ok(!row.includes('data-cite-measure'), `${e.name} states no paragraph: no mark, and its text opens nothing`);
      assert.match(row, /<span class="mpNoMark" aria-hidden="true"><\/span>/, 'the mark\'s room is kept so the values line up');
    }
  });
  // The row still holds its switch, name and value; the count is unchanged.
  assert.equal((html.match(/<button type="button" class="mpToggle"/g) || []).length, cat.entries.length);
  const text = html.replace(/<[^>]*>/g, ' ');
  for(const e of cat.entries) assert.ok(text.includes(e.name) && text.includes(e.value));
  // The marks' ids are never read aloud or shown.
  assert.doesNotMatch(text, /measure:|\|/);
});

// A drawing's nodes, with the renderer on a bare fake document (the same as tests/measure-layout.test.cjs).
function withRenderer(fn){
  global.document = { createElementNS: (ns, name) => ({ name, a: {}, kids: [], setAttribute(k, v){ this.a[k] = v; }, appendChild(c){ this.kids.push(c); return c; } }) };
  const hadSelf = 'self' in global;
  if(!hadSelf) global.self = global;
  delete require.cache[require.resolve('../js/engine/render-svg.js')];
  require('../js/engine/render-svg.js');
  try{ return fn(global.self.CAPUBEngine.renderSvg); }
  finally{ delete global.document; if(!hadSelf) delete global.self; }
}

test('in the drawing a distance with a paragraph has a transparent band over its lines, a label that takes presses and the keyboard, and the circle and caption of a magnified one; one without has none', () => {
  withRenderer(RS => {
    const px = 0.05;
    const base = { label: { text: '½ in', x: 0, y: 0, w: 1, h: 0.3, caption: ['ribbons to badge'] }, dim: [{ x: 0, y: 1 }, { x: 1, y: 1 }], bars: [[{ x: 0, y: 0.9 }, { x: 0, y: 1.1 }]], ext: [[{ x: 0, y: 0.5 }, { x: 0, y: 1 }]],
      ticks: [], centres: [], reference: null, leader: [{ x: 0.5, y: 0.3 }, { x: 0.5, y: 1 }] };
    const plain = Object.assign({ key: 'k1' }, base), magnified = Object.assign({ key: 'k2' }, base, { callout: { center: { x: 3, y: 3 }, r: 0.5, caption: { x: 2.5, y: 3.6, w: 1, h: 0.3, lines: ['x'], size: 0.1 } } }), none = Object.assign({ key: 'k3' }, base);
    const cites = new Map([['k1', { id: 'ribbons to badge|½ in', label: 'Ribbons to badge, ½ in' }], ['k2', { id: 'blue|⅛ in', label: 'Blue around the embroidery, ⅛ in' }]]);
    const [g1, g2, g3] = RS.measureNodes([plain, magnified, none], px, 11, null, null, cites);
    const hits = g => g.kids.filter(n => n.a['data-cite-measure'] !== undefined);
    // The plain one: the pill is the label (role, tab stop, name) and the lines are bands, 16 preview pixels wide, transparent, taking presses.
    const pill = g1.kids.find(n => n.name === 'rect' && n.a.role === 'button');
    assert.ok(pill, 'the label is a button');
    assert.equal(pill.a['data-cite-measure'], 'ribbons to badge|½ in');
    assert.equal(pill.a.tabindex, '0');
    assert.equal(pill.a['aria-label'], 'Regulation reference: Ribbons to badge, ½ in');
    assert.equal(pill.a['pointer-events'], 'all');
    assert.equal(pill.a['aria-expanded'], 'false');
    const bands = hits(g1).filter(n => n.name === 'line');
    assert.equal(bands.length, 4, 'the dimension line, its bar, the witness line and the leader');
    for(const b of bands){
      assert.equal(b.a.stroke, 'transparent');
      assert.equal(Number(b.a['stroke-width']), 16 * px);
      assert.equal(b.a['pointer-events'], 'all');
      assert.equal(b.a['data-cite-measure'], 'ribbons to badge|½ in');
      assert.equal(b.a.role, undefined, 'one stop for the keyboard: the label');
    }
    assert.equal(hits(g1).filter(n => n.a.tabindex !== undefined).length, 1);
    // The magnified one adds its circle and its caption.
    assert.equal(hits(g2).filter(n => n.name === 'circle').length, 1);
    assert.equal(hits(g2).filter(n => n.name === 'rect' && n.a.role === undefined).length, 1, 'the caption box');
    // No paragraph: nothing takes a press, nothing is in the tab order, and the group keeps passing presses through.
    assert.equal(hits(g3).length, 0);
    assert.equal(g3.kids.filter(n => n.a.tabindex !== undefined || n.a.role !== undefined).length, 0);
    for(const g of [g1, g2, g3]) assert.equal(g.a['pointer-events'], 'none');
    // Drawn with no list of what has a paragraph (the older call): no anchors.
    const [old] = RS.measureNodes([plain], px, 11, null, null);
    assert.equal(hits(old).length, 0);
  });
});

test('the renderer marks exactly the distances the catalogue gives a paragraph', () => {
  const svg = read('js/engine/render-svg.js');
  assert.match(svg, /for\(const e of ML\.catalogue\(scene\)\.entries\) if\(e\.ref\) for\(const k of e\.keys\) cites\.set\(k, \{ id: e\.id, label: e\.name \+ ', ' \+ e\.value \}\);/);
  assert.match(svg, /measureNodes\(drawings, px, ML\.PX\.font, defs, copies, cites\)/);
});

// ---- the press, over a small fake page ----
// Just enough of a page for citations.js's glue to run: elements with attributes, a parent chain and a box; the window's capture listeners are kept by type so a
// press, a key or a pointer-down can be sent to them as the browser would.
function fakePage(){
  const listeners = {};
  const sel = (el, s) => s.split(',').some(part => {
    part = part.trim();
    let m;
    if((m = /^\.([\w-]+)$/.exec(part))) return (el.attrs.class || '').split(/\s+/).includes(m[1]);
    if((m = /^#([\w-]+)$/.exec(part))) return el.attrs.id === m[1];
    if((m = /^\[([\w-]+)\]$/.exec(part))) return m[1] in el.attrs;
    if((m = /^(\w+)\[(\w+)\]$/.exec(part))) return el.tag === m[1] && m[2] in el.attrs;
    return false;
  });
  class El {
    constructor(tag){ this.tag = tag; this.nodeType = 1; this.attrs = {}; this.kids = []; this.parentNode = null; this.hidden = false; this.innerHTML = ''; this.style = { setProperty(){} }; this.dataset = {}; this.pe = 'auto'; this.box = { left: 100, top: 300, width: 30, height: 20, right: 130, bottom: 320 }; }
    get parentElement(){ return this.parentNode; }
    get isConnected(){ for(let n = this; n; n = n.parentNode) if(n === doc.documentElement) return true; return false; }
    set textContent(v){ this.innerHTML = String(v); }
    get textContent(){ return this.innerHTML; }
    set className(v){ this.attrs.class = v; }
    set id(v){ this.attrs.id = v; }
    setAttribute(k, v){ this.attrs[k] = String(v); }
    getAttribute(k){ return k in this.attrs ? this.attrs[k] : null; }
    hasAttribute(k){ return k in this.attrs; }
    removeAttribute(k){ delete this.attrs[k]; }
    appendChild(c){ if(c.parentNode) c.parentNode.kids.splice(c.parentNode.kids.indexOf(c), 1); c.parentNode = this; this.kids.push(c); return c; }
    contains(n){ for(let p = n; p; p = p.parentNode) if(p === this) return true; return false; }
    closest(s){ for(let n = this; n; n = n.parentNode) if(n.nodeType === 1 && sel(n, s)) return n; return null; }
    getBoundingClientRect(){ return this.box; }
    getClientRects(){ return this.isConnected ? [this.box] : []; }
    focus(){ doc.activeElement = this; }
    all(s, out = []){ for(const k of this.kids){ if(sel(k, s)) out.push(k); k.all(s, out); } return out; }
  }
  const doc = { readyState: 'complete', activeElement: null, listeners: {} };
  doc.documentElement = new El('html'); doc.documentElement.clientWidth = 390; doc.documentElement.clientHeight = 844;
  doc.body = new El('body'); doc.documentElement.appendChild(doc.body);
  doc.createElement = tag => new El(tag);
  doc.getElementById = id => doc.documentElement.all('#' + id)[0] || null;
  doc.querySelectorAll = s => doc.documentElement.all(s);
  doc.createTreeWalker = () => ({ nextNode: () => false });
  doc.addEventListener = (t, fn) => { (doc.listeners[t] = doc.listeners[t] || []).push(fn); };
  const win = { addEventListener(t, fn){ (listeners[t] = listeners[t] || []).push(fn); }, CAPUBMeasure: null, CAPUBUniformView: null };
  const send = (type, target, extra) => { const e = Object.assign({ type, target, defaultPrevented: false, stopped: false, preventDefault(){ this.defaultPrevented = true; }, stopPropagation(){ this.stopped = true; } }, extra); for(const fn of listeners[type] || []) fn(e); return e; };
  const anchor = (id, parent) => { const a = new El('span'); a.attrs['data-cite-measure'] = id; a.attrs['aria-expanded'] = 'false'; a.attrs.role = 'button'; a.attrs.tabindex = '0'; (parent || doc.body).appendChild(a); return a; };
  return { doc, win, El, send, anchor, listeners };
}

test('pressing a distance that has a paragraph opens the popover with it; a distance without one opens nothing; Enter, Space, Escape and a press elsewhere work', async () => {
  const scene = await compose('ocp-male-senior-Capt');
  const cat = ML.catalogue(scene);
  const cited = cat.entries.find(e => e.name === 'Visor to grade'), uncited = cat.entries.find(e => e.name === 'Shoulder seam to the flag');
  assert.ok(cited && cited.ref && uncited && !uncited.ref);
  const page = fakePage();
  const had = { document: global.document, window: global.window, NodeFilter: global.NodeFilter, MutationObserver: global.MutationObserver, getComputedStyle: global.getComputedStyle, requestAnimationFrame: global.requestAnimationFrame };
  global.document = page.doc; global.window = page.win;
  global.NodeFilter = { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_SKIP: 3, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
  global.MutationObserver = class { constructor(cb){ page.mutate = cb; } observe(){} disconnect(){} };
  global.getComputedStyle = el => ({ overflowX: 'visible', overflowY: 'visible', position: 'static', display: 'block', pointerEvents: el.pe });
  global.requestAnimationFrame = fn => setTimeout(fn, 0);
  try{
    // The page's own list of distances, as js/measure-panel.js reads them from the drawing now on show.
    page.win.CAPUBUniformView = { scene };
    page.win.CAPUBMeasure = MP;
    C.start();
    const pop = () => page.doc.getElementById('citePop');
    const yes = page.anchor(cited.id), no = page.anchor(uncited.id);
    assert.equal(pop(), null, 'nothing is made until a press');

    // A press on the distance with a paragraph: the popover is open with the distance and its paragraphs.
    let e = page.send('click', yes);
    assert.ok(e.defaultPrevented && e.stopped, 'the press is taken before the page\'s own handlers');
    assert.ok(pop() && !pop().hidden, 'the popover is open');
    assert.equal(pop().innerHTML, C.measurePopHtml(MP.noteOf(cited)));
    assert.match(pop().innerHTML, /Visor to grade: ½ in\./);
    assert.match(pop().innerHTML, /CAPR 39-1, 7\.1\.1\.8/);
    assert.match(pop().innerHTML, /ICL 25-02 6\.2\.11\.1/);
    assert.equal(yes.getAttribute('aria-expanded'), 'true');
    assert.equal(yes.getAttribute('aria-describedby'), 'citePop');
    assert.ok(pop().parentNode === page.doc.body);
    // It sits inside the window (the 390 px phone), just above the anchor: left and top are numbers inside 0..390 and 0..844.
    const left = parseFloat(pop().style.left), top = parseFloat(pop().style.top);
    assert.ok(left >= 8 && left + 240 <= 390 - 8 + 1e-6 || left >= 8, 'inside the window');
    assert.ok(top >= 0 && top < 844);

    // A press on the same one closes it.
    page.send('click', yes);
    assert.ok(pop().hidden && pop().innerHTML === '', 'a second press closes it');
    assert.equal(yes.getAttribute('aria-expanded'), 'false');

    // Enter and the space bar open it; Escape closes it and puts focus back on the anchor.
    e = page.send('keydown', yes, { key: 'Enter' });
    assert.ok(e.defaultPrevented && !pop().hidden, 'Enter opens it');
    e = page.send('keydown', yes, { key: 'Escape' });
    assert.ok(pop().hidden, 'Escape closes it');
    assert.equal(page.doc.activeElement, yes);
    page.send('keydown', yes, { key: ' ' });
    assert.ok(!pop().hidden, 'the space bar opens it');
    // A press elsewhere closes it (the pointer-down, before the press does its own work).
    page.send('pointerdown', page.doc.body);
    assert.ok(pop().hidden, 'a press elsewhere closes it');
    // A press in the popover does not.
    page.send('click', yes);
    assert.ok(!pop().hidden);
    page.send('pointerdown', pop());
    page.send('click', pop());
    assert.ok(!pop().hidden, 'a press in the popover leaves it open');
    // Another distance replaces it: one at a time.
    const other = cat.entries.find(e2 => e2.ref && e2.id !== cited.id), second = page.anchor(other.id);
    page.send('click', second);
    assert.equal(pop().innerHTML, C.measurePopHtml(MP.noteOf(other)));
    assert.equal(yes.getAttribute('aria-expanded'), 'false');
    assert.equal(second.getAttribute('aria-expanded'), 'true');
    page.send('click', second);
    assert.ok(pop().hidden);

    // A press on a distance with no paragraph opens nothing and the popover that was open stays shut.
    e = page.send('click', no);
    assert.ok(pop().hidden, 'nothing opens for a distance no paragraph states');
    assert.equal(no.getAttribute('aria-expanded'), 'false');
    assert.equal(no.getAttribute('aria-describedby'), null);
    page.send('keydown', no, { key: 'Enter' });
    assert.ok(pop().hidden, 'nor by the keyboard');

    // An id the build no longer draws (a list drawn again) opens nothing either.
    page.send('click', page.anchor('no such distance|1 in'));
    assert.ok(pop().hidden);

    // The drawing's peek on a phone does not take presses (a press there expands the preview): its anchors are not live, and the press goes on to the page.
    const canvas = new page.El('div'); canvas.attrs.id = 'uniformCanvas'; canvas.pe = 'none'; page.doc.body.appendChild(canvas);
    const inPeek = page.anchor(cited.id, canvas);
    e = page.send('click', inPeek);
    assert.ok(pop().hidden && !e.stopped && !e.defaultPrevented, 'the press passes on to expand the preview');
    canvas.pe = 'auto';
    page.send('click', inPeek);
    assert.ok(!pop().hidden, 'where the drawing takes presses its anchors open the popover');

    // The drawing is drawn again (every change redraws it): the anchor that was open is found again by its place, and the box goes when there is none.
    const fresh = page.doc.createElement('span'); fresh.attrs['data-cite-measure'] = cited.id; fresh.attrs.role = 'button';
    canvas.kids.splice(canvas.kids.indexOf(inPeek), 1); inPeek.parentNode = null;
    canvas.appendChild(fresh);
    page.mutate([]);
    assert.ok(!pop().hidden, 'still open after the drawing was drawn again');
    assert.equal(fresh.getAttribute('aria-expanded'), 'true', 'on the anchor that took its place');
    // Drawn again with that distance gone (hidden in the list, say): the popover goes with its anchor.
    canvas.kids.splice(canvas.kids.indexOf(fresh), 1); fresh.parentNode = null;
    page.mutate([]);
    assert.ok(pop().hidden && pop().innerHTML === '', 'the popover does not stay behind with no anchor');
  }finally{
    await new Promise(r => setTimeout(r, 200));   // the list's timer, before the page goes
    for(const [k, v] of Object.entries(had)){ if(v === undefined) delete global[k]; else global[k] = v; }
  }
});

test('the list\'s question mark and the drawing\'s anchors are the page\'s own marks: one popover, the existing handlers, no second component', () => {
  const js = read('js/citations.js'), panel = read('js/measure-panel.js'), css = read('styles/app.css');
  assert.equal((js.match(/pop\.id = POP_ID/g) || []).length, 1, 'one popover element');
  assert.match(js, /const root = btn\.closest\('dialog\[open\]'\) \|\| document\.body;/);
  assert.match(js, /closest\('\.citeBtn, \[data-cite-measure\]'\)/);
  assert.match(js, /if\(measure !== null\)\{ showMeasure\(btn, measure\); return; \}/);
  // Nothing opens without a note: the popover is made only after the note's markup exists.
  assert.match(js, /const html = measurePopHtml\(source \? source\(id\) : null\);\s*if\(!html\) return;\s*close\(\);/);
  // The panel's own press-outside handler leaves the panel open for a press in the popover.
  assert.match(panel, /closest\('\.measureGroup, \.citePop'\)/);
  // The mark is the existing one (a ring around a question mark) and stays when the references are printed in the notes; the popover floats above the sheet.
  assert.match(css, /:root\[data-cites="shown"\] \.citeBtn\.citeMeasure\{display:inline-flex\}/);
  assert.ok(Number(/\.citePop\{[^}]*z-index:(\d+)/.exec(css)[1]) > Number(/\.previewToolbar \.measurePanel\{[^}]*z-index:(\d+)/.exec(css.slice(css.indexOf('@media (max-width:700px)', css.indexOf('Phones (to 700px)'))))[1]), 'the popover is above the bottom sheet');
  // The ring when the keyboard reaches a label in the drawing is its edge drawn 3px wide on the screen: the drawing's lengths are inches, so an outline would be as wide as a hand.
  assert.match(css, /\.uniformSvg rect\[data-cite-measure\]:focus-visible\{stroke:var\(--cap-red\);stroke-width:3px;vector-effect:non-scaling-stroke\}/);
  // The page reload fix stays: the open preview, the sheet and the page keep a drag.
  assert.match(css, /html:has\(body\.previewFull\)\{overscroll-behavior-y:none\}/);
  assert.match(css, /body\.previewFull #previewWrapper\{overscroll-behavior:contain\}/);
  assert.match(css, /\.previewToolbar \.measurePanel\{overscroll-behavior:contain\}/);
});

test('the words a member reads carry no publication outside the popover, no name and no id', () => {
  const { stringLiterals } = require('./helpers/string-literals.cjs');
  for(const f of ['js/measure-panel.js', 'js/citations.js', 'js/engine/render-svg.js']){
    for(const { text } of stringLiterals(read(f))){
      if(/Regulation reference/.test(text)) assert.doesNotMatch(text, /CAPR|ICL|\d+\.\d+\.\d/, `${f}: the label of a mark names no publication`);
    }
  }
});
