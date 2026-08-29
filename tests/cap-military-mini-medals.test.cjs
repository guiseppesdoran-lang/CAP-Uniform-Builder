const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('CAP miniature medal resolver uses canonical military representations', () => {
  assert.match(indexSource, /getAwardRepresentation\?\.\(award,'MINIATURE_MEDAL'\)/);
  assert.match(indexSource, /representation\?\.available && representation\.asset/);
});

test('CAP miniature medal rack applies military award devices', () => {
  assert.match(indexSource, /militaryDevices:isMilitaryRibbonId\(r\.id\)/);
  assert.match(indexSource, /applyMilitaryMedalVariant\(mimg,entry\.path,entry\.militaryDevices,'MINIATURE_MEDAL'\)/);
});

