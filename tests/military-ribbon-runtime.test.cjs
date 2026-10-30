'use strict';
// A military ribbon is drawn as a CAP ribbon is: an SVG `asset`, the devices placed by the engine. Nothing composes a picture in the page (LIVE13 E118).
const test=require('node:test');
const { readAppSource } = require('./helpers/app-source.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const indexSource=readAppSource();
const style=fs.readFileSync(path.join(__dirname,'..','styles','app.css'),'utf8');

test('no precomposed ribbon picture and no canvas compositing are left',()=>{
  assert.doesNotMatch(indexSource,/getMilitaryPrecomposedRibbonAsset|buildMilitaryRibbonVariant|applyMilitaryRibbonVariant|militaryRibbonVariantCache|capubLoadCompositeImage/);
  assert.doesNotMatch(indexSource,/deviceVariants\?\.ribbonAssets/);
});

test('the uniform hands the engine the ribbon SVG and the chooser tile draws it with its devices',()=>{
  assert.match(indexSource,/asset: getMilitaryRibbonAward\(id\)\?\.images\?\.ribbonAsset \|\| null, devices, centered: false, military: true/);
  assert.match(indexSource,/ribbonDevicePlan\(sequence\)/);
  assert.match(indexSource,/querySelector\('\.militaryRibbonArt img, :scope > img'\)/);
});

test('the chooser tile has no fabric overlay, no filter and no box',()=>{
  const rules=style.match(/[^{}]*militaryRibbonArt[^{}]*\{[^}]*\}/g)||[];
  assert.ok(rules.length);
  for(const rule of rules){
    assert.doesNotMatch(rule,/filter|gradient|box-shadow|background/,rule);
    assert.doesNotMatch(rule,/::after|::before/,rule);
  }
});
