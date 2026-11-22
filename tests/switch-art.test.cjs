'use strict';
// The picture on a switch (a device on a ribbon's switch, a bar on a badge's) is a box with the drawing fitted inside a clear pixel all round, at 20 and 24 px and at device pixel ratios 1, 2 and 3.
// Needs Chrome; the work is in tests/switch-art-browser.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('in a real browser, no edge of a switch picture shows in its outer pixel at ratios 1, 2 and 3 (needs Chrome)', { timeout: 400000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'switch-art-browser.cjs')], { encoding: 'utf8', timeout: 380000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
});
