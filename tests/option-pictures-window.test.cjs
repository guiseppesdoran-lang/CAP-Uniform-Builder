'use strict';
// A picture of an option is drawn from only the layers that reach its window and is the same picture (js/option-pictures.js inWindow). Needs Chrome; the work is in
// tests/option-pictures-window-browser.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('in a real browser, a picture drawn from the layers that reach its window equals the picture of the whole scene, on the OCP, the Mess Dress and the Class A (needs Chrome)', { timeout: 300000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'option-pictures-window-browser.cjs')], { encoding: 'utf8', timeout: 280000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
});
