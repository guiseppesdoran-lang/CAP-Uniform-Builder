const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { build, OUT } = require('../scripts/build-asset-index.cjs');

test('data/asset-index.js matches images/MANIFEST.json', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), build(), 'run node scripts/build-asset-index.cjs');
});
