'use strict';
// Remove ribbons (LIVE13, in place of the Quick strip of LIVE12 E48): a checkbox on the ribbons card, shown only on the
// shirts where CAPR 39-1 makes ribbons optional, that draws the shirt without its rack while the selections stay, like
// Short Stack keeps them. Saved with the setup and sanitized with it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const RULES = require('../data/uniform-rules.js');

test('the box sits on the ribbons card under Short Stack, hidden until a shirt it applies to is drawn', () => {
  const card = read('index.html').split('id="groupRibbons"')[1].split('id="groupBadges"')[0];
  assert.match(card, /<div id="removeRibbonsRow" class="hidden">\s*<label class="fieldNote mt-8 optionWithHint">\s*<input type="checkbox" id="removeRibbons">\s*Remove ribbons\s*<span class="hintText optionHint">Ribbons are optional on this shirt; it is drawn without them and your selections stay\.<\/span>/);
  assert.ok(card.indexOf('id="cadetHighestOnlyRow"') < card.indexOf('id="removeRibbonsRow"'));
  assert.doesNotMatch(read('index.html'), /quickStrip|Quick strip/);
});

test('it is offered on exactly the uniforms where ribbons are optional, and only there does the flag remove them', () => {
  const ui = read('js/workspace-ui.js');
  assert.match(ui, /removeRow\.classList\.toggle\('hidden', !\(r && r\.ribbonPolicy\(u\)==='optional' && State\.membership\)\)/);
  assert.match(ui, /removeBox\.checked=!!State\.hideRibbons/);
  const view = read('js/uniform-view.js');
  assert.match(view, /const removed = !!State\.hideRibbons && CAPUBUniformRules\.ribbonPolicy\(State\.uniform\) === 'optional';/);
  assert.match(view, /const ordered = removed \? \[\] : \(typeof sortRibbons === 'function' \? sortRibbons\(State\.ribbons \|\| \[\]\) : \(State\.ribbons \|\| \[\]\)\);/);
  const optional = Object.keys(RULES.RULES || {}).filter(u => RULES.ribbonPolicy(u) === 'optional');
  assert.deepEqual(optional.sort(), ['aviator', 'blues_b']);
  assert.equal(RULES.ribbonPolicy('blues_a'), 'required');
});

test('the flag is saved with the setup, sanitized to a boolean, and the quick strip is gone from the code', () => {
  const wiring = read('js/wiring.js');
  assert.match(read('js/state.js'), /hideRibbons:false,/);
  assert.doesNotMatch(read('js/state.js'), /quickStrip/);
  assert.match(wiring, /hideRibbons: !!State\.hideRibbons/);
  assert.match(wiring, /out\.hideRibbons = !!p\.hideRibbons;/);
  assert.match(wiring, /State\.hideRibbons = !!p\.hideRibbons;/);
  assert.match(wiring, /State\.hideRibbons = !!e\.target\.checked;\s*fullRender\(\);/);
  assert.doesNotMatch(wiring, /quickStrip|QuickStrip|Quick strip/);
});
