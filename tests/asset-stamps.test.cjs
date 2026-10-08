const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('index.html asset URLs carry current content hashes', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'stamp-assets.cjs'), '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
