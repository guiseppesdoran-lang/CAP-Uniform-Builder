'use strict';
// Tapping Measurements on a phone reloaded the page (the owner, 2026-11-12). Nothing in the controls can do it by script: every button of the top bar,
// the step bar, the preview toolbar and the footer is type="button" outside any form, and no script in js/ navigates or reloads except the Reset
// button after its confirmation. What is left is the browser's own pull-to-refresh: on a phone the open preview is a fixed layer that scrolls, the
// measurement list is a sheet over its bottom, and a downward drag that ran out of room at the top of either chained to the page, which Chrome on
// Android takes for a refresh. The page now stops the drag at both layers, and at the page itself while the preview is open.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const css = read('styles/app.css');
const html = read('index.html');
const ui = read('js/workspace-ui.js');
const panel = read('js/measure-panel.js');

function block(query){
  const start = css.indexOf(`@media (${query})`);
  assert.ok(start >= 0, `has a ${query} block`);
  let depth = 0, i = css.indexOf('{', start);
  const begin = i;
  for(; i < css.length; i++){
    if(css[i] === '{') depth++;
    if(css[i] === '}'){ depth--; if(depth === 0) break; }
  }
  return css.slice(begin, i + 1);
}

// The `<button ...>` tags of a piece of markup that carry no type="button" (a button with no type submits a form it sits in).
const untyped = markup => (markup.match(/<button\b[^>]*>/g) || []).filter(tag => !/\btype="button"/.test(tag));

test('on a phone the open preview, the measurement sheet and the page under them do not pass a drag on to the browser\'s pull-to-refresh', () => {
  const phone = block('max-width:700px');
  assert.match(phone, /html:has\(body\.previewFull\)\{overscroll-behavior-y:none\}/, 'the page itself does not overscroll while the preview is open');
  assert.match(phone, /body\.previewFull #previewWrapper\{overscroll-behavior:contain\}/, 'the open preview keeps a drag that runs out of room');
  assert.match(phone, /\.previewToolbar \.measurePanel\{overscroll-behavior:contain\}/, 'the measurement sheet keeps a drag that runs out of room');
  // The list inside the sheet already did.
  assert.match(css, /\.mpList\{[^}]*overscroll-behavior:contain/);
});

test('every button of the top bar, step bar, preview toolbar, measurement panel and footer is type="button"', () => {
  const top = html.slice(html.indexOf('<header>'), html.indexOf('<main id="layoutShell"'));
  assert.ok(/id="hamburgerBtn"/.test(top), 'the top part holds the menu button');
  assert.deepEqual(untyped(top), []);
  const steps = html.slice(html.indexOf('<div class="stepTabs"'), html.indexOf('</div>', html.indexOf('<div class="stepTabs"')));
  assert.equal((steps.match(/<button\b/g) || []).length, 4, 'the four step tabs');
  assert.deepEqual(untyped(steps), []);
  const foot = html.slice(html.indexOf('<div class="controlsFooter" id="stepFooter">'), html.indexOf('</aside>'));
  assert.ok(/id="stepNext"/.test(foot) && /id="stepBack"/.test(foot));
  assert.deepEqual(untyped(foot), []);
  const peek = html.slice(html.indexOf('<section id="previewWrapper"'), html.indexOf('</section>', html.indexOf('<section id="previewWrapper"')));
  assert.ok(/id="previewPeekBtn"/.test(peek));
  assert.deepEqual(untyped(peek), []);
  const page = html.slice(html.indexOf('<footer id="pageFooter">'), html.indexOf('</footer>', html.indexOf('<footer id="pageFooter">')));
  assert.ok(/id="aboutOpen"/.test(page));
  assert.deepEqual(untyped(page), []);
  // The ones the scripts build: Undo, Redo, zoom, Fit, Measurements and its caret, Close, the theme switch, and the panel's own.
  assert.deepEqual(untyped(ui), [], 'workspace-ui.js builds no button without a type');
  assert.match(ui, /btn\.type='button'; btn\.id='themeToggle'/);
  for(const id of ['undoBtn', 'redoBtn', 'zoomOutBtn', 'zoomInBtn', 'zoomFitBtn', 'measureBtn', 'measureListBtn', 'previewCloseBtn']) assert.match(ui, new RegExp(`<button type="button"[^>]*id="${id}"`), id);
  assert.deepEqual(untyped(panel), [], 'measure-panel.js builds no button without a type');
  assert.equal((panel.match(/<button type="button"/g) || []).length, 4, 'Done, All, None and the on/off switch of a distance');
  assert.doesNotMatch(panel, /<a\b|href=|type="submit"|<form\b|<input\b/, 'nothing in the panel is a link, a submit or a field');
});

test('the controls sit in no form, and the only form on the page is the access gate, closed before the page starts', () => {
  const forms = html.match(/<form\b/g) || [];
  assert.equal(forms.length, 1);
  assert.ok(html.indexOf('</form>') < html.indexOf('<header>'), 'the access form ends before the top bar');
  assert.doesNotMatch(ui + panel, /createElement\(['"]form['"]\)|<form\b/);
});

test('no script reloads or re-navigates the page except the Reset button, after its confirmation', () => {
  const scripts = fs.readdirSync(path.join(__dirname, '..', 'js')).filter(f => f.endsWith('.js'));
  const pattern = /location\.(reload|assign|replace)\(|location\.href\s*=[^=]|location\.hash\s*=[^=]|window\.open\(|history\.(pushState|replaceState|go|back|forward)\(|serviceWorker|addEventListener\(['"](hashchange|popstate)['"]|\.submit\(\)/;
  const found = [];
  for(const f of scripts){
    read(`js/${f}`).split('\n').forEach((line, n) => { if(pattern.test(line)) found.push(`${f}:${n + 1}`); });
  }
  assert.equal(found.length, 1, `found: ${found.join(', ')}`);
  assert.match(found[0], /^wiring\.js:/);
  const wiring = read('js/wiring.js');
  const line = wiring.split('\n').find(l => /location\.reload\(\)/.test(l));
  assert.match(line, /capubV2Reset|reset\.onclick/);
  assert.match(line, /await capubConfirm\(/, 'the reload follows the confirmation');
  assert.doesNotMatch(read('js/engine/render-svg.js') + read('js/uniform-view.js'), /location\./);
});
