'use strict';
// The regulation references are out of the page's sentences. A note, a hint or a message still ends its rule with the paragraph in brackets in the
// source, "(CAPR 39-1, 10.2.5)", but on the page js/citations.js takes each reference out of its text and puts it behind a small question mark at
// the end of the text; the Extra step's Regulation tab has the switch that shows them all in place again and the list of every text with what it
// cites. The pure parts are tested here: which brackets are a reference, the split, the list's markup, the stored switch, and the page's markup and
// styles. The last test reads every string of the page's scripts, so a reference written in a new shape cannot stay in a sentence unnoticed.

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
  assert.match(tab, /<label class="mpSwitch"><input type="checkbox" id="citesShown"><span>[^<]+<\/span><\/label>/);
  assert.ok(tab.indexOf('id="citesShown"') < tab.indexOf('id="regulationNotes"') && tab.indexOf('id="regulationNotes"') < tab.indexOf('id="regulationBody"'));
  // A reference is hidden until its text is opened or the switch is on; the switch takes the marks away.
  assert.ok(css.includes(':root:not([data-cites="shown"]) .citeHost:not(.citeOpen)>.citeRef{display:none}'));
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
