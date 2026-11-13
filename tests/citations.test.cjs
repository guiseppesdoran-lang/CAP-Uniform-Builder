'use strict';
// The regulation references are out of the page's sentences. A note, a hint or a message still ends its rule with the paragraph in brackets in the
// source, "(CAPR 39-1, 10.2.5)", but on the page js/citations.js takes each reference out of its text and puts it behind a small question mark at
// the end of the text; the Extra step's Regulation tab has the switch that shows them all in place again and the list of every text with what it
// cites. The pure parts are tested here: which brackets are a reference, the split, the list's markup, the stored switch, and the page's markup and
// styles. The last test reads every string of the page's scripts, so a reference written in a new shape cannot stay in a sentence unnoticed. A press on the
// mark opens the reference in a popover over the page, one at a time, held by the mark and not by its text (two rows with the same sentence were opened together
// by the old text key): the popover's placement, content and open-mark model are tested here as plain functions, and its glue as source.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stringLiterals } = require('./helpers/string-literals.cjs');
const C = require('../js/citations.js');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('a reference is brackets that open with a publication or a paragraph number', () => {
  for(const inner of ['CAPR 39-1, 10.2.5', 'CAPR 39-1 4.1.2.1', 'CAPR 39-3', 'CAPR 39-3, 21k(2)', 'CAPR 39-1, Attachment 4, Note 2', 'CAPR 39-1, 9.2.3 as changed by ICL 25-02',
    'ICL 25-02', 'ICL 18-02, 4b', 'ICL 26-14 7.1.1.2.1', 'DAFI 36-2903 3.1.1', '5.3.1.1', '1.4.1', '4.2.2.4, ICL 25-02', '8.2.4.1, 8.3.4.1', '9.2; DAFI 36-2903 3.1.1', '10.2, 10.2.5'])
    assert.ok(C.isCitation(inner), inner);
  // A measurement, a count and a remark are not: a decimal has two parts, a paragraph alone has three or more.
  for(const inner of ['1.5 in', '0.25 mm clearance', '2', '3.5, 4.5 in', '10.2', '2 ft x 2 ft chaplain patch', 'graduates', 'men', 'the CAPR 39-1 order', 'see ICL 25-02'])
    assert.ok(!C.isCitation(inner), inner);
});

test('the split takes each reference and the space before it, and leaves the sentence whole', () => {
  assert.deepEqual(C.split('Three on each side of the coat (CAPR 39-1, 4.1.2.1).'), { text: 'Three on each side of the coat.', refs: ['CAPR 39-1, 4.1.2.1'] });
  // Two in one text, the second by its number alone.
  assert.deepEqual(C.split('It goes under the AUX identifier (CAPR 39-1, 7.1.1.4.2.1); a patch picked in lieu of it takes its place (7.1.1.4.2.2).'),
    { text: 'It goes under the AUX identifier; a patch picked in lieu of it takes its place.', refs: ['CAPR 39-1, 7.1.1.4.2.1', '7.1.1.4.2.2'] });
  // Brackets inside the reference.
  assert.deepEqual(C.split('Imported as the Lifesaving Award ribbon (CAPR 39-3, 21k(2)) with one star'), { text: 'Imported as the Lifesaving Award ribbon with one star', refs: ['CAPR 39-3, 21k(2)'] });
  // An option's label.
  assert.deepEqual(C.split('Knit polo, seal embroidered (5.3.1.1)'), { text: 'Knit polo, seal embroidered', refs: ['5.3.1.1'] });
  // Brackets that are not a reference stay; so does a publication named in the sentence.
  for(const s of ['Plate 2.5 mm thick, 0.6 mm item pockets (0.25 mm clearance).', 'CAPR 39-1 requires rows of three on Class B and aviator shirts.', 'As written in ICL 26-14 (2 ft x 2 ft chaplain patch)',
    'The rack (3 rows) sits 1/2 in above the pocket.', 'Brackets left open (CAPR 39-1, 1.2', ''])
    assert.deepEqual(C.split(s), { text: s, refs: [] }, s);
  assert.deepEqual(C.split(null), { text: '', refs: [] });
  // The runs join back to the text exactly, so an element's textContent is what it was.
  const s = 'The crest is centered on the pocket (CAPR 39-1, 4.2.3.1.1.1), so the 1/2 in above it (4.2.2.4, ICL 25-02) is not kept.';
  const p = C.parts(s);
  assert.equal(p.map(x => x.text).join(''), s);
  assert.deepEqual(p.map(x => x.ref), [false, true, false, true, false]);
  assert.equal(p[1].text, ' (CAPR 39-1, 4.2.3.1.1.1)');
});

test('the list in the Regulation tab: each text with what it cites, a number alone named as CAPR 39-1\'s', () => {
  assert.equal(C.refLabel('5.3.1.1'), 'CAPR 39-1, 5.3.1.1');
  assert.equal(C.refLabel('4.2.2.4, ICL 25-02'), 'CAPR 39-1, 4.2.2.4, ICL 25-02');
  assert.equal(C.refLabel('CAPR 39-3, 21a'), 'CAPR 39-3, 21a');
  assert.equal(C.refLabel('ICL 25-02'), 'ICL 25-02');
  const html = C.notesHtml([{ text: 'Three on each side of the coat.', refs: ['CAPR 39-1, 4.1.2.1'] }, { text: 'A <b> & "c"', refs: ['7.1.1.8', 'ICL 26-14 7.1.1.2.1'] }]);
  assert.match(html, /^<table class="regTable citeTable"><thead><tr><th scope="col">Note or hint<\/th><th scope="col">Reference<\/th><\/tr><\/thead><tbody>/);
  assert.ok(html.includes('<tr><th scope="row">Three on each side of the coat.</th><td class="regRef"><span>CAPR 39-1, 4.1.2.1</span></td></tr>'));
  assert.ok(html.includes('<th scope="row">A &lt;b&gt; &amp; &quot;c&quot;</th><td class="regRef"><span>CAPR 39-1, 7.1.1.8</span><span>ICL 26-14 7.1.1.2.1</span></td>'));
  assert.match(C.notesHtml([]), /^<p class="hintText">[^<]+<\/p>$/);
  assert.equal(C.notesHtml(null), C.notesHtml([]));
});

test('the switch is kept in the browser, off until it is turned on, and survives storage that fails', () => {
  const data = {}, storage = { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
  assert.equal(C.KEY_SHOWN, 'capubCitesShown');
  const a = C.createPrefs(storage);
  assert.equal(a.shown(), false);
  a.setShown(true);
  assert.equal(data.capubCitesShown, '1');
  assert.equal(C.createPrefs(storage).shown(), true);
  a.setShown(false);
  assert.equal(C.createPrefs(storage).shown(), false);
  const broken = C.createPrefs({ getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); } });
  assert.equal(broken.shown(), false);
  broken.setShown(true);
  assert.equal(broken.shown(), true);
  assert.equal(C.createPrefs(null).shown(), false);
});

test('the page: the script, the switch and the list in the Regulation tab, the mark and the hidden reference in the styles', () => {
  const html = read('index.html'), css = read('styles/app.css'), js = read('js/citations.js');
  assert.match(html, /<script src="js\/citations\.js[^"]*" defer><\/script>/);
  const tab = html.slice(html.indexOf('id="extraPanel-regulation"'));
  // The switch is a pair of pictures (js/profile-pickers.js syncCites); the box stays in the page, hidden, as its source of truth.
  assert.match(tab, /<input type="checkbox" id="citesShown" class="segmentedSource" tabindex="-1" aria-hidden="true">\s*<div id="citesShownPicker"><\/div>/);
  assert.ok(tab.indexOf('id="citesShown"') < tab.indexOf('id="regulationNotes"') && tab.indexOf('id="regulationNotes"') < tab.indexOf('id="regulationBody"'));
  // A reference is hidden until its text is opened or the switch is on; the switch takes the marks away.
  assert.ok(css.includes(':root:not([data-cites="shown"]) .citeRef{display:none}'));
  assert.ok(css.includes(':root[data-cites="shown"] .citeBtn,:root[data-cites="shown"] .citeOfSelect{display:none}'));
  assert.match(css, /\.citeBtn::before\{content:"\?"\}/);
  // The mark is small, so the target around it is larger, and larger again on a phone.
  assert.match(css, /\.citeBtn::after\{content:"";position:absolute;inset:-6px\}/);
  const start = css.lastIndexOf('@media (max-width:700px)');
  assert.match(css.slice(start), /\.citeBtn::after\{inset:-12px\}/);
  // The mark has no text of its own (the question mark is drawn by the stylesheet), it is reached by the keyboard, and the Regulation tab is left alone.
  assert.match(js, /setAttribute\('role', 'button'\); m\.tabIndex = 0;/);
  assert.match(js, /e\.key !== 'Enter' && e\.key !== ' '/);
  assert.match(js, /const SKIP = '[^']*#extraPanel-regulation'/);
  assert.doesNotMatch(js, /\.citeBtn[^\n]*textContent\s*=/);
  // The shopping list's paragraph chip waits behind the same mark.
  assert.match(read('purchase-feature-core.js'), /<span class="citeHost"><span class="citeRef capub-purchase-chip">CAPR 39-1 \$\{esc\(l\.ref\)\}<\/span><span class="citeBtn" role="button" tabindex="0" aria-label="Regulation reference" aria-expanded="false"><\/span><\/span>/);
});

test('every reference written in a string of the page is one the split takes out', () => {
  const walk = (dir, out = []) => {
    for(const f of fs.readdirSync(dir, { withFileTypes: true })){
      const p = path.join(dir, f.name);
      if(f.isDirectory()){ if(f.name !== 'node_modules') walk(p, out); }
      else if(/\.js$/.test(f.name)) out.push(p);
    }
    return out;
  };
  const files = [...walk(path.join(root, 'js')), ...walk(path.join(root, 'data')), ...['purchase-catalog.js', 'purchase-feature-core.js', 'purchase-feature.js'].map(f => path.join(root, f))]
    .filter(f => path.basename(f) !== 'citations.js');
  // Whole brackets (one level of brackets inside) that name a publication or a paragraph and are still in the text after the split.
  const BRACKETS = /\((?:[^()]|\([^()]*\))*\)/g, CITES = /\b(?:CAPR|CAPP|CAPM|ICL|DAFI|AFI)\s?\d|\d+\.\d+\.\d+/;
  const left = [];
  let taken = 0;
  for(const f of files){
    for(const { text, line } of stringLiterals(fs.readFileSync(f, 'utf8'))){
      const s = C.split(text);
      taken += s.refs.length;
      for(const m of s.text.matchAll(BRACKETS)) if(CITES.test(m[0])) left.push(`${path.relative(root, f)}:${line}: ${m[0].slice(0, 120)}`);
    }
  }
  assert.deepEqual(left, [], 'a reference the page would leave in its sentence:\n' + left.join('\n'));
  assert.ok(taken >= 80, `expected the page's references, found ${taken}`);
  // index.html's own hints as well.
  const body = read('index.html').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const texts = body.replace(/<[^>]*>/g, '\n').split('\n').map(t => t.trim()).filter(Boolean);
  const inPage = texts.flatMap(t => C.split(t).refs);
  assert.ok(inPage.length >= 3, `index.html's hints cite paragraphs: ${inPage.length}`);
  for(const t of texts) for(const m of C.split(t).text.matchAll(BRACKETS)) assert.ok(!CITES.test(m[0]), t);
});

// ---- the popover (the owner: "the question marks should open only the thing that it was clicked on, and it shouldnt push everything down (should pop above a bit)") ----

test('the popover lists each reference of the text as the Regulation tab names it', () => {
  assert.deepEqual(C.refsOfText('Worn on the left (CAPR 39-1, 4.1.2.1).', []), ['CAPR 39-1, 4.1.2.1']);
  assert.deepEqual(C.refsOfText('It goes under the AUX identifier (CAPR 39-1, 7.1.1.4.2.1); a patch picked in lieu takes its place (7.1.1.4.2.2).', []), ['CAPR 39-1, 7.1.1.4.2.1', '7.1.1.4.2.2']);
  // A mark on a chip that is only the reference (the shopping list): the chip's own text, brackets or not.
  assert.deepEqual(C.refsOfText('CAPR 39-1 7.1.1', ['CAPR 39-1 7.1.1']), ['CAPR 39-1 7.1.1']);
  assert.deepEqual(C.refsOfText('(CAPR 39-1, 10.2.5)', [' (CAPR 39-1, 10.2.5)']), ['CAPR 39-1, 10.2.5']);
  assert.deepEqual(C.refsOfText('No reference here', []), []);
  assert.equal(C.popHtml(['5.3.1.1', 'ICL 25-02']), '<span class="citePopRef">CAPR 39-1, 5.3.1.1</span><span class="citePopRef">ICL 25-02</span>');
  assert.equal(C.popHtml(['A <b> & "c"']), '<span class="citePopRef">A &lt;b&gt; &amp; &quot;c&quot;</span>');
  assert.equal(C.popHtml([]), '');
});

test('the popover floats just above its mark, below it where there is no room above, and stays inside the window', () => {
  const view = { w: 375, h: 740 }, size = { w: 240, h: 37 };
  const mark = (left, top) => ({ left, top, right: left + 16, bottom: top + 16 });
  // Room above: the box ends 8px over the mark and is centred on it.
  let at = C.placePop(mark(200, 300), size, view);
  assert.deepEqual(at, { left: 88, top: 255, side: 'above', arrow: 120 });
  assert.equal(at.top + size.h + 8, 300, 'the gap above the mark is 8px');
  // A mark near the right edge: the box is pushed in by the margin and the pointer still finds the mark.
  at = C.placePop(mark(340, 300), size, view);
  assert.equal(at.left + size.w, view.w - 8);
  assert.equal(at.left + at.arrow, 348, 'the pointer is under the mark\'s centre');
  // Near the left edge.
  at = C.placePop(mark(2, 300), size, view);
  assert.equal(at.left, 8);
  assert.equal(at.arrow, 12, 'the pointer never leaves the box\'s rounded corner');
  // No room above (a mark at the top of the window): below it.
  at = C.placePop(mark(100, 20), size, view);
  assert.equal(at.side, 'below');
  assert.equal(at.top, 20 + 16 + 8);
  // Exactly enough room above keeps it above; one pixel less puts it below.
  assert.equal(C.placePop(mark(100, 8 + 37 + 8), size, view).side, 'above');
  assert.equal(C.placePop(mark(100, 8 + 37 + 7), size, view).side, 'below');
});

test('one mark is open at a time, held by the mark and its place, never by its text', () => {
  // Two rows say the same sentence ("This uniform does not wear it (CAPR 39-1, ...)"): their marks share a key. The old state was the set of texts
  // open, so pressing one opened both when the page drew the list again.
  const open = C.createOpenMark();
  const [a, b] = [{ id: 'row 1' }, { id: 'row 2' }];
  assert.equal(open.get(), null);
  open.open(b, 'same sentence', 1);
  assert.ok(open.is(b) && !open.is(a), 'only the pressed mark is open');
  // The page draws the list again: new marks, same text. The open one is the one in the same place; its twin stays shut.
  const [a2, b2] = [{ id: 'row 1, drawn again' }, { id: 'row 2, drawn again' }];
  assert.equal(open.again([a2, b2]), b2);
  assert.ok(open.is(b2) && !open.is(a2));
  // A list that came back shorter closes it, and nothing opens in its place.
  assert.equal(open.again([a2]), null);
  assert.equal(open.get(), null);
  // Opening another closes the first: the model holds one.
  open.open(a, 'k', 0); open.open(b, 'k', 1);
  assert.ok(open.is(b) && !open.is(a));
  assert.equal(open.close().btn, b);
  assert.equal(open.get(), null);
  assert.equal(open.close(), null);
  assert.equal(C.markAgain(['x', 'y'], 1), 'y');
  assert.equal(C.markAgain(['x', 'y'], 2), null);
  assert.equal(C.markAgain(['x', 'y'], -1), null);
});

test('the popover in the page: one element over the page, closed by a press elsewhere, Escape and moving on; the page does not move', () => {
  const js = read('js/citations.js'), css = read('styles/app.css'), ui = read('js/workspace-ui.js');
  // The state is the open mark, not a set of texts, and the host no longer opens in place.
  assert.doesNotMatch(js, /citeOpen/);
  assert.doesNotMatch(js, /new Set\(\)[^\n]*(text|reference is showing)/);
  assert.match(js, /const open = createOpenMark\(\);/);
  // One popover, made once, outside the texts (so no textContent changes) and emptied when it closes.
  assert.match(js, /pop\.id = POP_ID; pop\.className = 'citePop';/);
  assert.match(js, /if\(pop\)\{ pop\.hidden = true; pop\.textContent = ''; \}/);
  assert.match(js, /btn\.closest\('dialog\[open\]'\) \|\| document\.body/);
  assert.match(js, /const SKIP = '[^']*\.citePop[^']*'/);
  // Pressed, pressed elsewhere, Escape, focus moving on, and the page scrolling or resizing: all at the window, before the page's own listeners.
  assert.match(js, /window\.addEventListener\('click', onClick, true\)/);
  assert.match(js, /window\.addEventListener\('pointerdown', onDown, true\)/);
  assert.match(js, /window\.addEventListener\('keydown', onKey, true\)/);
  assert.match(js, /window\.addEventListener\('focusin', onFocus, true\)/);
  assert.match(js, /window\.addEventListener\('scroll', queueReposition, \{ capture: true, passive: true \}\)/);
  assert.match(js, /if\(e\.key === 'Escape' && open\.get\(\)\)\{\s*e\.preventDefault\(\); e\.stopPropagation\(\);/);
  // The mark that was open is found again when the page draws its list again, and a mark scrolled out of its container closes it.
  assert.match(js, /function reanchor\(\)/);
  assert.match(js, /if\(!inView\(cur\.btn, r\)\)\{ close\(\); return; \}/);
  // What clips the mark: a box that is not drawn (display: contents on the phone's panel) clips nothing, the body clips nothing (it is only as tall as the
  // header while the panel and the choosers are fixed over it), and a fixed box is clipped by nothing above it. The popover opened and closed at once on
  // the phone, and again in a chooser, when these were not so.
  assert.match(js, /p !== document\.body && p !== root/);
  assert.match(js, /&& p\.getClientRects\(\)\.length\)\{/);
  assert.match(js, /if\(o\.position === 'fixed'\) break;/);
  // Fixed over the page, above the toast and the choosers, within the window; the pointer follows the mark.
  const pop = css.slice(css.indexOf('.citePop{'), css.indexOf('}', css.indexOf('.citePop{')));
  assert.match(pop, /position:fixed/);
  assert.match(pop, /z-index:26000/);
  assert.match(pop, /max-width:min\(300px,calc\(100vw - 16px\)\)/);
  assert.ok(Number(/z-index:(\d+)/.exec(pop)[1]) > Number(/\.capubToast\{[^}]*z-index:(\d+)/.exec(css)[1]), 'above the toast');
  assert.match(css, /\.citePop\[data-side="above"\]::after/);
  assert.match(css, /\.citePop\[data-side="below"\]::after/);
  // The list of chosen items is rebuilt only when a row changed, so a press (which the page answers with a redraw) leaves the marks in it alone.
  assert.match(ui, /if\(list\.dataset\.sig===sig\) return;/);
  assert.match(ui, /if\(line && line\.textContent!==said\) line\.textContent=said;/);
});

// ---- a greyed card's question mark (the owner: "i should be able to click on the question mark but i cannot") ----
// The National Staff Patch card a cadet sees is a .disabledBlock: pointer events off and the whole tile at 55% opacity, so the mark inside it took no press
// (the press went through to the grid behind) and was greyed with the tile. The fix is for every such card at once: the mark takes presses wherever it sits,
// and a card is greyed by a veil over it, with the mark above the veil, not by opacity on it.

// The stylesheet's rules as [selector, declarations], at-rules flattened (a rule inside @media is a rule of its own here).
const cssRules = css => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@][^{}]*)\{([^{}]*)\}/g)].map(m => [m[1].trim().replace(/\s+/g, ' '), m[2].replace(/\s+/g, '')]);

test('a greyed, disabled or unavailable card keeps a question mark that takes presses and is not greyed with it', () => {
  const rules = cssRules(read('styles/app.css'));
  const decl = sel => rules.filter(([s]) => s.split(',').map(x => x.trim()).includes(sel)).map(r => r[1]).join(';');
  // The mark takes presses wherever it sits: pointer events are inherited, so it says so itself, and nothing turns them off again.
  assert.match(decl('.citeBtn'), /(^|;)pointer-events:auto(;|$)/);
  for(const [sel, d] of rules) if(/(^|[ >+~,])\.citeBtn\b/.test(sel) && /pointer-events:none/.test(d)) assert.fail(`${sel} turns the mark's presses off`);
  // A disabled block takes no presses of its own, is greyed by a veil, and has no opacity: opacity cannot be undone for a child.
  const block = decl('.disabledBlock');
  assert.match(block, /pointer-events:none/);
  assert.doesNotMatch(block, /opacity/);
  assert.match(block, /position:relative/);
  const veil = decl('.disabledBlock::after');
  assert.match(veil, /content:""/);
  assert.match(veil, /opacity:\.45/);
  assert.match(veil, /pointer-events:none/);
  assert.match(veil, /z-index:1(;|$)/);
  assert.match(decl('.disabledBlock .citeBtn'), /z-index:2(;|$)/, 'the mark sits above the veil');
  // No other greyed card is greyed by opacity or turns its presses off: a mark inside it would be dimmed or lost with it.
  const GREYED = ['.disabledBlock', '.uniformOption.locked', '.itemCard.unavailable'];
  for(const [sel, d] of rules){
    const subject = sel.split(',').map(x => x.trim()).filter(x => GREYED.some(g => x.startsWith(g)) && !/::(?:after|before)$/.test(x) && !/\.citeBtn/.test(x));
    for(const x of subject){
      if(x === '.disabledBlock') continue;
      assert.doesNotMatch(d, /(^|;)opacity:/, `${x} greys by opacity, which greys a reference mark with it`);
      assert.doesNotMatch(d, /pointer-events:none/, `${x} turns presses off, a reference mark in it needs them`);
    }
  }
  // Every rule that turns presses off belongs to something that cannot hold a reference (a decorative layer, the toast, a hidden source) or to the veil.
  const OFF = new Set(rules.filter(([, d]) => /pointer-events:none/.test(d)).map(([s]) => s));
  const KNOWN = ['.controlsFooter::before', '.capubToast', '.tooltipBubble', '.garmentForegroundOverlay', '.measurementOverlay', '.measurementArrowLayer', '.measurementArrowLayer svg',
    '.calib-selectable .measurementArrowLayer', '.segmentedSource', '.disabledBlock', '.disabledBlock::after',
    '#layoutShell[data-step="uniform"] #uniformCanvas,#layoutShell[data-step="items"] #uniformCanvas,#layoutShell[data-step="export"] #uniformCanvas'];
  for(const sel of OFF) assert.ok(KNOWN.includes(sel), `${sel} turns presses off: add it here only if nothing in it can hold a reference mark`);
});

// ---- no paragraph printed anywhere (the owner, on the cards of the uniforms a member may not wear: "question marks!") ----
// The reason on those cards was drawn by the stylesheet from an attribute (content: attr(data-locked-reason)), which no script of the page can reach, so the
// paragraph in it printed in the text. Every way text reaches a member now has a path through js/citations.js, and the tests below close the ones the page's
// own strings cannot show: text from the stylesheet, from an attribute, from the drawing's titles.

test('the stylesheet draws no text from an attribute and prints no reference', () => {
  const css = read('styles/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // Text a stylesheet draws cannot be reached by the citations script: only these attributes are drawn (a count's short form, a shopping list column's
  // name on a phone), nothing that holds a sentence.
  const drawn = [...css.matchAll(/content:\s*([^;}]+)/g)].map(m => m[1].trim());
  const ATTRS = [...new Set(drawn.flatMap(d => [...d.matchAll(/attr\(\s*([\w-]+)\s*\)/g)].map(m => m[1])))].sort();
  assert.deepEqual(ATTRS, ['data-label', 'data-short'], 'the stylesheet draws text from: ' + ATTRS.join(', '));
  for(const m of read('purchase-feature-core.js').matchAll(/data-label="([^"]*)"/g)) assert.deepEqual(C.split(m[1]).refs, [], m[1]);
  for(const d of drawn) assert.deepEqual(C.split(d.replace(/^["']|["']$/g, '')).refs, [], 'the stylesheet prints a reference: ' + d);
});

test('every reason a uniform card is locked carries its paragraph in the text the page cuts, and the card holds it as a line of its own', () => {
  const rules = require('../data/uniform-rules.js');
  const reasons = new Set();
  for(const membership of ['cadet', 'senior']) for(const adultCadet of [false, true]) for(const id of Object.keys(rules.UNIFORM_RULES || rules.RULES || {})){
    const why = rules.lockedReason(id, membership, { adultCadet });
    if(why) reasons.add(why);
  }
  assert.ok(reasons.size >= 3, 'the locked reasons: ' + [...reasons].join(' | '));
  for(const why of reasons){
    const s = C.split(why);
    assert.ok(s.refs.length >= 1, 'a locked reason without a paragraph: ' + why);
    assert.doesNotMatch(s.text, /\(/, 'a bracket left in the reason once the paragraph is cut: ' + why);
  }
  const setup = read('js/setup.js'), js = read('js/citations.js');
  assert.match(setup, /why\.className='uWhy'/);
  // The card is a button that does nothing when pressed; its mark is allowed there, and only there.
  assert.match(js, /const INERT = '\.uniformOption\.locked';/);
  assert.match(js, /parent\.closest\(PLAIN\) && !parent\.closest\(INERT\) \? null : mark\(false\)/);
});

test('a tooltip, a field hint, an image text and the drawing\'s own titles lose their reference to the mark and get it back with the switch', () => {
  const js = read('js/citations.js'), html = read('index.html');
  assert.match(js, /const TEXT_ATTRS = \['title', 'placeholder', 'alt'\];/);
  assert.match(js, /attributeFilter: \['title', 'hidden'\]|attributeFilter: \[/);
  assert.match(js, /TEXT_ATTRS\.includes\(m\.attributeName\)/);
  // The base art's parts carry a title (a tooltip) that cites a paragraph; the drawing is in the page as inline SVG, which the walk over the text skips.
  assert.match(js, /function visitSvgTitle\(t\)/);
  assert.match(js, /n\.querySelectorAll\('svg title'\)\.forEach\(visitSvgTitle\)/);
  assert.match(js, /\[data-cite-svg-title\]/);
  // index.html: no field hint or image text cites a paragraph in the markup itself.
  for(const m of html.matchAll(/\b(placeholder|alt)="([^"]*)"/g)) assert.deepEqual(C.split(m[2]).refs, [], `${m[1]}="${m[2]}"`);
});

test('the drawing\'s titles lose every bracket that names a publication or a paragraph, whatever the remark around it', () => {
  assert.deepEqual(C.splitLoose('Name tape centred on the back of the cap, blank (matches coat name tape width; CAPR 39-1 7.1.1.8)'), { text: 'Name tape centred on the back of the cap, blank', refs: ['matches coat name tape width; CAPR 39-1 7.1.1.8'] });
  assert.deepEqual(C.splitLoose('Patch (traced from CAPR 39-1 Fig A6-4)'), { text: 'Patch', refs: ['traced from CAPR 39-1 Fig A6-4'] });
  assert.deepEqual(C.splitLoose('Button (one group per design, hidden by name: -wing-star (wing and star, the default) or -cap-crest; CAPR 39-1 4.1.1.1)').text, 'Button');
  assert.deepEqual(C.splitLoose('Grade (Velcro panel) centred (CAPR 39-1 6.2.7.2, 7.1.1.8)'), { text: 'Grade (Velcro panel) centred', refs: ['CAPR 39-1 6.2.7.2, 7.1.1.8'] });
  // A bracket that names none stays, and so does a title that has none.
  for(const t of ['Rank square (1.5 in)', 'Chevrons centred halfway', '', null]) assert.deepEqual(C.splitLoose(t), { text: String(t == null ? '' : t), refs: [] }, String(t));
});

test('every title in the art cites its paragraph in a shape the page cuts from the tooltip', () => {
  // The art (images/, copied from the art tree) is drawn into the page as inline SVG, which the walk over the page\'s text skips; its <title> elements are
  // tooltips, and a few hundred of them cite a paragraph, some inside a longer remark that the plain split does not take for a reference.
  const walk = (dir, out = []) => {
    for(const f of fs.readdirSync(dir, { withFileTypes: true })){
      const p = path.join(dir, f.name);
      if(f.isDirectory()) walk(p, out); else if(/\.svg$/.test(f.name)) out.push(p);
    }
    return out;
  };
  const BRACKETS = /\((?:[^()]|\([^()]*\))*\)/g, CITES = /\b(?:CAPR|CAPP|CAPM|ICL|DAFI|AFI)\s?\d|\d+\.\d+\.\d+/;
  let titles = 0, loose = 0;
  const left = [];
  for(const f of walk(path.join(root, 'images'))){
    const svg = fs.readFileSync(f, 'utf8');
    if(svg.indexOf('<title') === -1) continue;
    for(const m of svg.matchAll(/<title>([^<]*)<\/title>/g)){
      const text = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'");
      titles++;
      if(C.split(text).text !== C.splitLoose(text).text) loose++;
      for(const b of C.splitLoose(text).text.matchAll(BRACKETS)) if(CITES.test(b[0])) left.push(`${path.relative(root, f)}: ${b[0].slice(0, 100)}`);
    }
  }
  assert.ok(titles >= 500, `the art's titles: ${titles}`);
  assert.deepEqual(left, [], 'a title with a bracketed reference the cut leaves:\n' + left.join('\n'));
  assert.ok(loose >= 1, 'some titles hold a reference only the loose cut takes out');
});
