'use strict';
// Dialogs and messages (audit 4 November 2026): Reset builder asks in the page's own dialog, not the browser's confirm box; a message that appears while a chooser
// is open rides above the chooser's footer instead of covering Done.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'), state = read('js/state.js'), wiring = read('js/wiring.js'), ui = read('js/workspace-ui.js'), css = read('styles/app.css');

// A small stand-in for the dialog and its buttons.
function fakeDom(){
  const listeners = new Map();
  const el = id => {
    const e = { id, textContent: '', open: false, focused: 0, handlers: {},
      addEventListener(type, fn){ (this.handlers[type] = this.handlers[type] || []).push(fn); },
      removeEventListener(type, fn){ this.handlers[type] = (this.handlers[type] || []).filter(f => f !== fn); },
      fire(type, event = {}){ for(const fn of [...(this.handlers[type] || [])]) fn(Object.assign({ target: this }, event)); },
      focus(){ this.focused++; } };
    return e;
  };
  const nodes = {};
  for(const id of ['confirmDialog', 'confirmTitle', 'confirmMessage', 'confirmOk', 'confirmCancel']) nodes[id] = el(id);
  nodes.confirmDialog.showModal = function(){ this.open = true; };
  nodes.confirmDialog.close = function(){ if(!this.open) return; this.open = false; this.fire('close'); };
  return { nodes, document: { getElementById: id => nodes[id] || null } };
}
function loadConfirm(){
  const dom = fakeDom();
  const src = /function capubConfirm\([\s\S]*?\n}\n/.exec(state)[0];
  const ctx = { document: dom.document, window: { confirm: () => { ctx.native++; return true; } }, native: 0, Promise };
  vm.createContext(ctx);
  vm.runInContext(src + '; this.capubConfirm = capubConfirm;', ctx);
  return { ctx, nodes: dom.nodes };
}

test('capubConfirm asks in the page\'s dialog: the confirm button answers yes, Cancel, a click outside and Escape answer no', async () => {
  const { ctx, nodes } = loadConfirm();
  const ask = () => ctx.capubConfirm({ title: 'Reset the builder?', message: 'This clears it.', confirmLabel: 'Reset', cancelLabel: 'Keep my setup' });
  let p = ask();
  assert.equal(nodes.confirmDialog.open, true);
  assert.equal(nodes.confirmTitle.textContent, 'Reset the builder?');
  assert.equal(nodes.confirmMessage.textContent, 'This clears it.');
  assert.equal(nodes.confirmOk.textContent, 'Reset');
  assert.equal(nodes.confirmCancel.textContent, 'Keep my setup');
  assert.equal(nodes.confirmCancel.focused, 1, 'focus starts on the safe answer');
  nodes.confirmOk.fire('click');
  assert.equal(await p, true);
  p = ask(); nodes.confirmCancel.fire('click'); assert.equal(await p, false);
  p = ask(); nodes.confirmDialog.fire('click', { target: nodes.confirmDialog }); assert.equal(await p, false, 'a click on the dimmed area');
  p = ask(); nodes.confirmDialog.close(); assert.equal(await p, false, 'Escape closes the dialog');
  assert.equal(ctx.native, 0, 'the browser\'s box is never used while the dialog exists');
  assert.equal(nodes.confirmOk.handlers.click.length, 0, 'the listeners are taken off again');
});

test('Reset builder uses it, and no native confirm is left in the page\'s own flows but the report upload\'s', () => {
  assert.match(html, /<dialog id="confirmDialog" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">/);
  assert.match(wiring, /reset\.onclick = async \(\)=>\{ if\(!await capubConfirm\(\{ title: 'Reset the builder\?'/);
  assert.doesNotMatch(wiring, /confirm\('Reset the entire builder setup\?'\)/);
  assert.match(css, /#confirmDialog\{/);
});

test('a message shown while a chooser is open sits above the chooser\'s footer, never on its Done button', () => {
  assert.match(ui, /t\.classList\.toggle\('aboveModal',!!\(overlay && overlay\.classList\.contains\('open'\)\)\);/);
  assert.match(css, /\.capubToast\.aboveModal\{\s*right:calc\(\(100vw - min\(1100px,96vw\)\) \/ 2 \+ var\(--s4\)\);\s*bottom:calc\(\(100vh - min\(720px,86vh\)\) \/ 2 \+ 76px\);/);
  assert.match(css, /\.capubToast\.aboveModal\{right:var\(--s3\);bottom:calc\(76px \+ env\(safe-area-inset-bottom,0px\)\)\}/, 'on a phone the chooser is the whole screen');
});
