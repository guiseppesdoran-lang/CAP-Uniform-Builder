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

test('standalone military full-size and miniature medals are independently calibratable', () => {
  assert.match(indexSource, /function getMilitaryMedalCalibrationKey\(context,awardId\)/);
  assert.match(indexSource, /\? `medal:military:\$\{normalizedId\}`/);
  assert.match(indexSource, /: `mini:military:\$\{normalizedId\}`/);
  assert.match(indexSource, /const key=getMilitaryMedalCalibrationKey\(context,entry\.award\.id\)/);
  assert.match(indexSource, /image\.dataset\.calibKey=geometry\.entries\[column\]\.key/);
  assert.match(indexSource, /applyCalibToElement\(image,image\.dataset\.calibKey/);
});

test('standalone military miniature medals preserve the repository 50 by 176 geometry', () => {
  assert.match(indexSource, /MINIATURE_MEDAL:Object\.freeze\(\{width:50,height:176,overlap:22\}\)/);
  assert.doesNotMatch(indexSource, /const medalHeight=context==='FULL_SIZE_MEDAL'\?120:88/);
  assert.match(indexSource, /getCalibratedLayerGeometry\(key,\{x:0,y:0,w:medalWidth,h:medalHeight,r:0\}\)/);
});

test('CAP miniature medal rack centers rows using saved calibrated widths', () => {
  assert.match(indexSource, /const medalRowGeometry = medalRowsTopFirst\.map/);
  assert.match(indexSource, /getCalibratedLayerGeometry\(key,\{x:0,y:0,w:MINI_W,h:MINI_H,r:0\}\)/);
  assert.match(indexSource, /MINI_RACK_CENTER_X - geometry\.rowWidth \/ 2/);
});

test('standalone military calibration is isolated by service component and representation', () => {
  assert.match(indexSource, /if\(State\.organization && State\.organization !== 'CAP'\)/);
  assert.match(indexSource, /return `military_\$\{service\}_\$\{component\}_\$\{representation\}`/);
});

test('legacy standalone military medal calibration remains readable', () => {
  assert.match(indexSource, /function getLegacyMilitaryMedalCalibKeys\(key\)/);
  assert.match(indexSource, /`militaryMedal:\$\{service\}:\$\{context\}:\$\{awardId\}`/);
});

test('calibrator stays within the visible viewport', () => {
  assert.match(indexSource, /width:min\(360px,calc\(100vw - 42px\)\)/);
  assert.match(indexSource, /grid-template-columns:minmax\(0,1fr\) 68px/);
  assert.match(indexSource, /#calibKeyPill\{[\s\S]*?overflow-wrap:anywhere/);
});

test('military award bulk controls select basic and maximum verified quantities', () => {
  assert.match(indexSource, /id="militarySelectAllBasic"/);
  assert.match(indexSource, /id="militarySelectAllMax"/);
  assert.match(indexSource, /function maximumRenderableMilitaryAwardCount\(award,representationOverride=null\)/);
  assert.match(indexSource, /representation\.status==='AVAILABLE' && !!representation\.asset/);
  assert.match(indexSource, /awardCount:maximum \? maximumRenderableMilitaryAwardCount\(award\) : 1/);
});

test('CAP uniform ribbon and medal UI exposes working basic and maximum bulk controls', () => {
  assert.match(indexSource, /id="capSelectAllBasic"/);
  assert.match(indexSource, /id="capSelectAllMax"/);
  assert.match(indexSource, /function selectAllCapUniformAwards\(\{maximum=false\}=\{\}\)/);
  assert.match(indexSource, /getEligibleRibbonIds\(\)/);
  assert.match(indexSource, /maximumRenderableMilitaryAwardCount\(award,'RIBBON'\)/);
});

test('calibration issue 137 applies only to the male Class A bucket', () => {
  assert.match(indexSource, /'badge:master_emergency_services_badge:LP:0': Object\.freeze\(\{x:280\.7,y:249\.5,w:25,h:25,r:0\}\)/);
  assert.match(indexSource, /'badge:volunteer_university_instructor_badge:RP:0': Object\.freeze\(\{x:130\.4,y:248,w:40,h:40,r:0\}\)/);
  assert.match(indexSource, /function migrateApprovedCalibrationIssues\(\)/);
  assert.match(indexSource, /calibrationRecordMatches\(savedBucket\[key\], legacyRecord\)/);
  assert.match(indexSource, /migrateApprovedCalibrationIssues\(\);/);
  assert.match(indexSource, /CAPUB_ISSUE_137_MIGRATION_KEY/);
  assert.match(indexSource, /forceIssue137 \|\| calibrationRecordMatches/);
});
