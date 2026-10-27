'use strict';
// The quick strip (LIVE12 E48, Ducky: "there should be an option to quick strip the shirt down to just mini wings, rank, and name").
// The markup, the state default and the save/load plumbing are read here; tests/quick-strip-browser.cjs drives the button in headless
// Chrome and checks State and the drawn SVG.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const RULES = require('../data/uniform-rules.js');

test('the button sits at the top of the Items step, above the Ribbons panel, hidden until a shirt it applies to is drawn', () => {
  const items = read('index.html').split('id="stepGroup-items"')[1].split('id="stepGroup-export"')[0];
  const panel = items.indexOf('<section id="quickStripPanel" class="panelBlock hidden">');
  assert.ok(panel > 0 && panel < items.indexOf('id="groupRibbons"'), 'quick strip panel before the Ribbons panel');
  assert.match(items, /<button id="quickStripBtn" class="ghost mt-6" type="button" aria-pressed="false" aria-describedby="quickStripHint">Quick strip<\/button>/);
});

test('it is offered on exactly the uniforms where ribbons are optional', () => {
  const wiring = read('js/wiring.js');
  const offered = JSON.parse(/const UNIFORMS = (\[[^\]]*\]);/.exec(wiring.split('capubQuickStrip')[1])[1].replace(/'/g, '"'));
  const optional = Object.keys(RULES.RULES || {}).filter(u => RULES.ribbonPolicy(u) === 'optional');
  assert.deepEqual([...offered].sort(), optional.sort());
  assert.equal(RULES.ribbonPolicy('blues_b'), 'optional');
  assert.equal(RULES.ribbonPolicy('aviator'), 'optional');
  assert.equal(RULES.ribbonPolicy('blues_a'), 'required');
});

test('the strip is saved with the setup and its held selections go through the setup sanitizer', () => {
  const wiring = read('js/wiring.js');
  assert.match(read('js/state.js'), /quickStrip:null,/);
  assert.match(wiring, /quickStrip: State\.quickStrip \|\| null/);
  assert.match(wiring, /const held = sanitizeProfile\(Object\.assign\(\{\}, p, CAPUBQuickStrip\.pick\(qs\.snapshot\), \{ quickStrip: null \}\)\);/);
  assert.match(wiring, /State\.quickStrip = p\.quickStrip;/);
  assert.match(wiring, /if\(window\.CAPUBQuickStrip\) CAPUBQuickStrip\.adopt\(\);\s*fullRender\(\);/);
});

test('in a real browser, Quick strip leaves grade, nametag and wings and Restore puts everything back (needs Chrome)', { timeout: 240000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'quick-strip-browser.cjs')], { encoding: 'utf8', timeout: 220000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS: quick strip leaves grade, nametag and wings/m);
});
