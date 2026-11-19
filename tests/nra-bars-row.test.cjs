'use strict';
// The three Distinguished Expert bar switches are one row of three equal tiles under the NRA badge's tile, at a phone's width and on a desktop, and nothing moves when a bar is turned on.
// Needs Chrome; the work is in tests/nra-bars-row-browser.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('in a real browser, the three bar switches are one row of three equal tiles at 320, 390 and 1280 px and nothing moves (needs Chrome)', { timeout: 200000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'nra-bars-row-browser.cjs')], { encoding: 'utf8', timeout: 180000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
});
