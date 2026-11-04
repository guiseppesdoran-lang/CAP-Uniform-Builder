'use strict';
// Small things the audit of 4 November 2026 found, each one a plain mistake: a title that no longer fits, the same word twice in one place, a spelling that differs
// from the rest of the page, a list that lost its bullets, a label cut off by its own box.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stringLiterals } = require('./helpers/string-literals.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'), css = read('styles/app.css');

test('the name block is titled Your name (every member is asked all three parts), and the card of downloads inside Extra has a name of its own', () => {
  assert.match(html, /<summary>Your name<\/summary>/);
  assert.doesNotMatch(html, /Add your name|\(optional\)/);
  const finish = html.slice(html.indexOf('id="finishPanel"'), html.indexOf('id="finishPanel"') + 200);
  assert.match(finish, /<label class="fieldLabel">Downloads and files<\/label>/);
});

test('the page spells center the American way, in every string a member reads outside the engine', () => {
  const files = ['js/garment-options.js', 'js/placement-templates.js', 'js/measure-panel.js', 'js/catalog.js', 'js/galleries.js', 'js/wiring.js', 'js/workspace-ui.js', 'js/patches.js', 'js/uniform-view.js'];
  const hits = [];
  for(const f of files) for(const { text, line } of stringLiterals(read(f))) if(/\bcentre|centred\b/i.test(text)) hits.push(`${f}:${line}: ${text.slice(0, 80)}`);
  assert.deepEqual(hits, []);
  assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, ''), /centre|centred/i);
});

test('the same things are called the same: Aide de Camp, Blues: Class A, None in the Regulation list', () => {
  assert.match(html, /<option value="aide_de_camp">Aide de Camp shoulder cord<\/option>/);
  assert.doesNotMatch(html, /Aide-de-camp/);
  assert.match(html, /four-across racks only on Blues: Class A\./);
  assert.doesNotMatch(html, /USAF-style Service Dress \(Class A\)/);
  assert.match(read('js/measure-panel.js'), /<span class="regNone">None<\/span>/);
});

test('the option labels of the rack and medal selects fit the box beside them (no ellipsis), and the explanation stays under the select', () => {
  const labels = [...html.matchAll(/<option value="(?:standard|lapel|mounting|holding)">([^<]+)<\/option>/g)].map(m => m[1]);
  assert.equal(labels.length, 4);
  for(const l of labels) assert.ok(l.length <= 40, `"${l}" is ${l.length} characters`);
  assert.ok(labels.includes('Automatic - clear of the lapel'));
  assert.match(html, /id="ribbonRackArrangementHint"/);
  assert.doesNotMatch(css, /\.uniformOption \.uDesc\{[^}]*text-overflow:ellipsis/, 'a uniform card\'s description wraps');
});

test('a list item that is a flex row still has its bullet, a chooser\'s search is flush with the top edge, a card\'s count wraps below its name, the footer links never shrink', () => {
  assert.match(css, /\.noticeList\{[^}]*list-style:none;/);
  assert.match(css, /\.noticeList li>span::before\{content:"\\2022\\00a0\\00a0"\}/);
  assert.match(css, /\.capubV2Search\{position:sticky;top:calc\(-1 \* var\(--s4\)\);[^}]*margin:calc\(-1 \* var\(--s4\)\) 0 var\(--s3\)\}/);
  assert.match(css, /\.cardHead\{display:flex;flex-wrap:wrap;/);
  assert.match(css, /\.footerLink\{[^}]*flex:0 0 auto;\s*white-space:nowrap;/);
});

test('the rack layout controls are shown only where four across is allowed, and the preview is centered beside the panel on every width', () => {
  assert.match(read('js/wiring.js'), /rackFold\.classList\.toggle\('hidden', !classA\)/);
  const ui = read('js/workspace-ui.js');
  assert.match(ui, /if\(wrap\)\{\s*const style=getComputedStyle\(wrap\);/);
  assert.doesNotMatch(ui, /if\(wrap && isPhone\(\)\)\{\s*const style=getComputedStyle/);
});
