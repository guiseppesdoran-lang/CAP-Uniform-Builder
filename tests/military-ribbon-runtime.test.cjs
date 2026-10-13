'use strict';

const test=require('node:test');
const { readAppSource } = require('./helpers/app-source.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const indexSource=readAppSource();

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

