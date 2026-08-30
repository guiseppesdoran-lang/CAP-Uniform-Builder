const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('military dress badges use regulation-aware chest and pocket zones', () => {
  assert.match(source, /function militaryBadgeDressPlacementRole\(badge\)/);
  assert.match(source, /return 'RIGHT_POCKET'/);
  assert.match(source, /return 'LEFT_POCKET'/);
  assert.match(source, /return 'ABOVE_AWARDS'/);
  assert.match(source, /MILITARY_LEFT_CHEST_CENTER_X/);
});

test('each military badge placement is independently calibratable', () => {
  assert.match(source, /image\.dataset\.calibKey=`militaryBadge:\$\{State\.organization\}:\$\{entry\.badge\.id\}:\$\{role\}:\$\{roleIndex\}`/);
  assert.match(source, /applyCalibToElement\(image,image\.dataset\.calibKey/);
});
