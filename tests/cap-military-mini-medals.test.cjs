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

test('military miniature medal size calibration survives while rack positions stay dynamic', () => {
  assert.match(indexSource, /if\(String\(key \|\| ''\)\.startsWith\('ribbon:'\) && over\)/);
  assert.doesNotMatch(indexSource, /startsWith\('ribbon:'\) \|\| String\(key \|\| ''\)\.startsWith\('mini:'\)/);
  assert.match(indexSource, /function applyMiniRackCalibToElement\(el, key, base\)/);
  assert.match(indexSource, /\.\.\.\(over\.w !== undefined \? \{w:over\.w\} : \{\}\)/);
  assert.match(indexSource, /\.\.\.\(over\.h !== undefined \? \{h:over\.h\} : \{\}\)/);
  assert.match(indexSource, /applyMiniRackCalibToElement\(mimg, mimg\.dataset\.calibKey/);
  assert.doesNotMatch(indexSource, /applyCalibToElement\(mimg, mimg\.dataset\.calibKey/);
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
  assert.match(indexSource, /geometry\.offsets\[i\]/);
  assert.match(indexSource, /medalRowGeometry\[index\]\.suspensionHeight/);
  assert.match(indexSource, /mimg\.style\.objectFit='fill'/);
});

test('military medals allow independent width and height stretching', () => {
  assert.match(indexSource, /image\.style\.objectFit='fill'/);
  assert.match(indexSource, /w:geometry\.entries\[column\]\.size\.w,h:geometry\.entries\[column\]\.size\.h/);
  assert.match(indexSource, /function buildVariableMedalRowGeometry\(entries/);
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

test('master calibration issue 143 preserves partial records across its uniform buckets', () => {
  assert.match(indexSource, /const CAPUB_ISSUE_143_CALIBRATION_OVERRIDES = Object\.freeze/);
  assert.match(indexSource, /'badge:cadet_programs_master_badge:FON:0': Object\.freeze\(\{x:136,y:160\.3\}\)/);
  assert.match(indexSource, /'badge:master_emergency_services_badge:LP:0': Object\.freeze\(\{x:283\.4,y:248,w:20,h:20,r:0\}\)/);
  assert.match(indexSource, /'patch:national_staff_ocp_patch:L_SHOULDER:0': Object\.freeze\(\{x:834\.5,y:251,w:55,h:55,r:0\}\)/);
  assert.match(indexSource, /CAPUB_ISSUE_143_MIGRATION_KEY/);
  assert.match(indexSource, /State\.calib\.byUniform\[uniformId\]\[key\] = \{/);
});

test('master calibration issue 143 safely extrapolates related badge families', () => {
  assert.match(indexSource, /const CAPUB_ISSUE_143_FAMILY_CALIBRATION_EXTRAPOLATIONS = Object\.freeze/);
  assert.match(indexSource, /'badge:squadron_commander_badge:UN:0': Object\.freeze\(\{x:140\.8,y:227\.1\}\)/);
  assert.match(indexSource, /'badge:senior_emergency_services_badge:LP:0': Object\.freeze\(\{x:283\.4,y:248\}\)/);
  assert.match(indexSource, /'badge:cadet_programs_senior_badge:FON:0': Object\.freeze\(\{x:136,y:160\.3\}\)/);
  assert.match(indexSource, /'badge:command_council_badge:LP:0': Object\.freeze\(\{y:140\}\)/);
  assert.match(indexSource, /CAPUB_ISSUE_143_FAMILY_MIGRATION_KEY/);
  assert.match(indexSource, /applyIssue143Families/);
});
