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

test('military miniature medal calibration survives rerendering', () => {
  assert.match(indexSource, /if\(String\(key \|\| ''\)\.startsWith\('ribbon:'\) && over\)/);
  assert.doesNotMatch(indexSource, /startsWith\('ribbon:'\) \|\| String\(key \|\| ''\)\.startsWith\('mini:'\)/);
});

test('calibrator stays within the visible viewport', () => {
  assert.match(indexSource, /width:min\(360px,calc\(100vw - 42px\)\)/);
  assert.match(indexSource, /grid-template-columns:minmax\(0,1fr\) 68px/);
  assert.match(indexSource, /#calibKeyPill\{[\s\S]*?overflow-wrap:anywhere/);
});

test('military award bulk controls select basic and maximum verified quantities', () => {
  assert.match(indexSource, /id="militarySelectAllBasic"/);
  assert.match(indexSource, /id="militarySelectAllMax"/);
  assert.match(indexSource, /function maximumRenderableMilitaryAwardCount\(award\)/);
  assert.match(indexSource, /representation\.status==='AVAILABLE' && !!representation\.asset/);
  assert.match(indexSource, /awardCount:maximum \? maximumRenderableMilitaryAwardCount\(award\) : 1/);
});
