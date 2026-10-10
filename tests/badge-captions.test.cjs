'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {placementCaption,PHRASES}=require('../badge-captions.js');

test('regulation abbreviations become plain phrases (CAPR 39-1 Attachment 4)',()=>{
  assert.equal(placementCaption('OLP'),'Above the left pocket');
  assert.equal(placementCaption('OLPA'),'Above the left pocket, over aviation badges');
  assert.equal(placementCaption('OLPU'),'Above the left pocket, under aviation badges');
  assert.equal(placementCaption('ON'),'Above the nametag');
  assert.equal(placementCaption('UN'),'Below the nametag');
  assert.equal(placementCaption('LP,RP'),'On the left or right pocket');
  assert.equal(placementCaption('OLPF'),'On the left pocket flap');
});

test('a note after the dash is kept as a parenthetical',()=>{
  assert.equal(placementCaption('UN — graduated commander'),'Below the nametag (graduated commander)');
  assert.equal(placementCaption('ON — current commander'),'Above the nametag (current commander)');
  assert.equal(placementCaption('RP — Volunteer University exception'),'On the right pocket (Volunteer University exception)');
  assert.equal(placementCaption('LP only — not rendered unless selected first'),'On the left pocket (not rendered unless selected first)');
});

test('an unrecognised label is returned as it came, never guessed',()=>{
  assert.equal(placementCaption('XYZ'),'XYZ');
  assert.equal(placementCaption('somewhere odd'),'somewhere odd');
  assert.equal(placementCaption(''),'');
  assert.equal(placementCaption(null),'');
});

test('no caption still uses the regulation abbreviations',()=>{
  for(const text of Object.values(PHRASES)){
    assert.doesNotMatch(text,/\b(OLP|ORP|URBP|OLPA|OLPU|OLPF|FON)\b/);
  }
});

const fs=require('node:fs');
const path=require('node:path');
const catalog=fs.readFileSync(path.join(__dirname,'..','js','catalog.js'),'utf8');

test('badge ids that are image hashes have a real display name',()=>{
  const names=catalog.slice(catalog.indexOf('const BADGE_DISPLAY_NAMES'),catalog.indexOf('});',catalog.indexOf('const BADGE_DISPLAY_NAMES')));
  const hashed=[...new Set([...catalog.matchAll(/'([A-Za-z]+1_[0-9A-F]{12,})'/g)].map(m=>m[1]))];
  assert.ok(hashed.length>=10,'found the hashed aviation ids');
  for(const id of hashed) assert.match(names,new RegExp(`\\b${id}:\\s*'[^']+'`),`${id} has a name`);
});

test('all three badge tile builders use the plain-language line',()=>{
  for(const file of ['galleries.js','wiring.js','patches.js']){
    const text=fs.readFileSync(path.join(__dirname,'..','js',file),'utf8');
    assert.match(text,/getBadgeTileMetaHtml\(/,`${file} uses the shared line`);
    assert.doesNotMatch(text,/Regulation scale: \$\{Math\.round\(getBadgeRenderSize/,`${file} no longer prints the abbreviation line`);
  }
});
