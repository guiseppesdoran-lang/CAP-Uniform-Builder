'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const indexSource=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

test('military ribbon renderer prefers a single precomposed repository asset',()=>{
  assert.match(indexSource,/function getMilitaryPrecomposedRibbonAsset\(ribbonObj\)/);
  assert.match(indexSource,/deviceVariants\?\.ribbonAssets/);
  assert.match(indexSource,/image\.dataset\.militaryVariantStrategy=precomposed\.strategy/);
  assert.match(indexSource,/image\.src=ASSET\(precomposed\.asset\)/);
});

test('runtime composite remains an explicit missing-asset fallback',()=>{
  assert.match(indexSource,/DETERMINISTIC_RUNTIME_FALLBACK/);
  assert.match(indexSource,/buildMilitaryRibbonVariant\(ribbonObj\)/);
});

test('runtime fallback does not warp square device source canvases',()=>{
  assert.match(indexSource,/width:isCluster\?21:18,height:isCluster\?21:18/);
  assert.match(indexSource,/width:isCluster\?16:13,height:isCluster\?16:13/);
});

test('CAP and standalone military racks carry the wearer service into asset lookup',()=>{
  assert.match(indexSource,/inst\.militaryService=getMilitarySelectionService\(id,sel\)/);
  assert.match(indexSource,/militaryService:State\.organization/);
});
