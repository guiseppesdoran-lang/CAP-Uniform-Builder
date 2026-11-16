'use strict';
// The import card of the Profile step (the owner, 2026-11-12: "take away and simplify most of this text"): one button, one hint line, and one question mark
// beside the button that holds the steps, opened in the popover the regulation marks use. The status line stays empty until a report is read.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/citations.js');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = read('index.html');
const card = html.slice(html.indexOf('<section id="memberReportImportPanel"'), html.indexOf('<section id="capMembershipPanel"'));
const HELP = 'In eServices open Member Search, open your record, choose Printer Friendly View and save the page as a PDF. A text file of the same page also works. Importing replaces your ribbons, badges and patches. Undo brings them back.';

test('the card says two short things in sight: the button and one hint line; the status is empty until a report is read', () => {
  const visible = card.replace(/<[^>]*>/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  assert.deepEqual(visible, ['Import member report', 'Your Member Search report, saved as a PDF. It stays on this device.', 'Clear import notes']);
  assert.match(card, /<div id="memberReportImportStatus" class="hintText" aria-live="polite"><\/div>/);
  assert.doesNotMatch(card, /Nothing is imported yet|not kept or sent|Upload a CAP Member Search|Import a CAP member report/);
});

test('beside the button is a question mark that holds the steps: a help mark of the citation marks, with the words in an attribute and no regulation in them', () => {
  const mark = /<span class="citeBtn citeHelp" role="button" tabindex="0" aria-expanded="false" aria-label="([^"]+)" data-cite-help="([^"]+)"><\/span>/.exec(card);
  assert.ok(mark, 'the mark is in the card');
  assert.equal(mark[2], HELP);
  assert.match(mark[1], /import/i, 'a name for assistive technology');
  assert.ok(card.indexOf('id="importMemberReportBtn"') < card.indexOf('citeHelp') && card.indexOf('citeHelp') < card.indexOf('id="memberReportImportHint"'), 'after the button, before the hint');
  assert.equal(card.slice(card.indexOf('class="importRow"'), card.indexOf('id="memberReportUpload"')).match(/<button|<span class="citeBtn/g).length, 2, 'the two share a row');
  // No paragraph of a regulation, and nothing the citation script would take for one.
  assert.deepEqual(C.split(HELP).refs, []);
  assert.doesNotMatch(HELP, /CAPR|ICL|paragraph/);
  assert.match(HELP, /Printer Friendly View/);
  assert.match(HELP, /Undo brings them back\./);
});

test('js/citations.js opens a help mark in the one popover, as text, closed by the same presses; the stylesheet keeps the mark when references print in their text', () => {
  const js = read('js/citations.js'), css = read('styles/app.css');
  assert.match(js, /if\(btn\.hasAttribute\('data-cite-help'\)\)\{ showHelp\(btn\); return; \}/);
  const fn = js.slice(js.indexOf('function showHelp(btn){'), js.indexOf('function show(btn){'));
  assert.match(fn, /line\.textContent = text;/, 'the words are text, never markup');
  assert.doesNotMatch(fn, /innerHTML/);
  assert.match(fn, /open\.open\(btn, HELP_KEY/, 'held as the open mark, so a press elsewhere, Escape and moving on close it');
  assert.match(fn, /btn\.closest\('dialog\[open\]'\) \|\| document\.body/);
  assert.match(css, /:root\[data-cites="shown"\] \.citeBtn\.citeHelp\{display:inline-flex\}/);
  assert.match(css, /\.importRow\{display:flex;align-items:center;gap:var\(--s2\)\}/);
  assert.match(css, /#memberReportImportStatus:empty\{margin-top:0\}/, 'the empty status takes no room');
});
