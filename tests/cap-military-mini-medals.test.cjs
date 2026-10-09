const test = require('node:test');
const { readAppSource } = require('./helpers/app-source.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexSource = readAppSource();
const styleSource = fs.readFileSync(path.join(__dirname, '..', 'styles', 'app.css'), 'utf8');

test('CAP miniature medal resolver uses canonical military representations', () => {
  assert.match(indexSource, /getAwardRepresentation\?\.\(award,'MINIATURE_MEDAL'\)/);
  assert.match(indexSource, /representation\?\.available && representation\.asset/);
});

test('CAP miniature medal rack applies military award devices', () => {
  assert.match(indexSource, /militaryDevices:isMilitaryRibbonId\(r\.id\)/);
  assert.match(indexSource, /applyMilitaryMedalVariant\(mimg,entry\.path,entry\.militaryDevices,'MINIATURE_MEDAL'\)/);
});

test('military miniature medal size calibration survives while rack positions stay dynamic', () => {
  assert.match(indexSource, /if\(String\(key \|\| ''\)\.startsWith\('ribbon:'\) && over\)/);
  assert.doesNotMatch(indexSource, /startsWith\('ribbon:'\) \|\| String\(key \|\| ''\)\.startsWith\('mini:'\)/);
  assert.match(indexSource, /function applyMiniRackCalibToElement\(el, key, base\)/);
  assert.match(indexSource, /\.\.\.\(over\.w !== undefined \? \{w:over\.w\} : \{\}\)/);
  assert.match(indexSource, /\.\.\.\(over\.h !== undefined \? \{h:over\.h\} : \{\}\)/);
  assert.match(indexSource, /applyMiniRackCalibToElement\(mimg, mimg\.dataset\.calibKey/);
  assert.doesNotMatch(indexSource, /applyCalibToElement\(mimg, mimg\.dataset\.calibKey/);
});

test('CAP miniature medal rack centers rows using saved calibrated widths', () => {
  assert.match(indexSource, /const medalRowGeometry = medalRowsTopFirst\.map/);
  assert.match(indexSource, /getCalibratedLayerGeometry\(key,\{x:0,y:0,w:MINI_W,h:MINI_H,r:0\}\)/);
  assert.match(indexSource, /MINI_RACK_CENTER_X - geometry\.rowWidth \/ 2/);
  assert.match(indexSource, /geometry\.offsets\[i\]/);
  assert.match(indexSource, /medalRowGeometry\[index\]\.suspensionHeight/);
  assert.match(indexSource, /mimg\.style\.objectFit='fill'/);
});

test('calibrator stays within the visible viewport', () => {
  assert.match(styleSource, /width:min\(360px,calc\(100vw - 42px\)\)/);
  assert.match(styleSource, /grid-template-columns:minmax\(0,1fr\) 68px/);
  assert.match(styleSource, /#calibKeyPill\{[\s\S]*?overflow-wrap:anywhere/);
});

test('CAP uniform ribbon and medal UI exposes working basic and maximum bulk controls', () => {
  assert.match(indexSource, /id="capSelectAllBasic"/);
  assert.match(indexSource, /id="capSelectAllMax"/);
  assert.match(indexSource, /function selectAllCapUniformAwards\(\{maximum=false\}=\{\}\)/);
  assert.match(indexSource, /getEligibleRibbonIds\(\)/);
  assert.match(indexSource, /maximumRenderableMilitaryAwardCount\(award,'RIBBON'\)/);
});
