'use strict';
// A drawing is kept when a change leaves the scene as it was (js/uniform-view.js render), and the drawing it ends with is the one a fresh build gives, for twelve setups across the
// uniforms. Needs Chrome; the work is in tests/render-skip-browser.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('in a real browser, a drawing kept after a change that draws nothing new equals a fresh build, on twelve setups (needs Chrome)', { timeout: 500000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'render-skip-browser.cjs')], { encoding: 'utf8', timeout: 480000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
  assert.match(r.stdout, /drawings kept: [1-9]/, 'some drawings were kept, so the path was exercised');
});
