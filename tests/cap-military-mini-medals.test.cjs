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
});
