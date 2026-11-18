'use strict';
// A list that opens something under a tile stays steady (the owner, 2026-11-18): the tapped tile does not move, the window does not scroll by itself, the list is not made again
// whole on a tap, and a chosen tile is never dimmed. Needs Chrome; the work is in tests/picker-steady-browser.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('in a real browser, a tap on a badge, a level or a ribbon moves nothing and rebuilds no list (needs Chrome)', { timeout: 400000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'picker-steady-browser.cjs')], { encoding: 'utf8', timeout: 380000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
});
