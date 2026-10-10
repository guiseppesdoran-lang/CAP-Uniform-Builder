'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const catalog=fs.readFileSync(path.join(__dirname,'..','js','catalog.js'),'utf8');
const galleries=fs.readFileSync(path.join(__dirname,'..','js','galleries.js'),'utf8');

function groupIds(){
  const start=catalog.indexOf('const RIBBON_GROUPS = [');
  const end=catalog.indexOf('];',start);
  return [...catalog.slice(start,end).matchAll(/ids:\[([^\]]*)\]/g)]
    .flatMap(m=>[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]));
}
function displayNames(){
  const start=catalog.indexOf('const RIBBON_DISPLAY_NAMES = {');
  const end=catalog.indexOf('};',start);
  return Object.fromEntries([...catalog.slice(start,end).matchAll(/^  ([A-Za-z0-9_]+):\s*(['"])(.*)\2,?\s*$/gm)].map(m=>[m[1],m[3]]));
}

test('no ribbon is in two groups',()=>{
  const ids=groupIds();
  assert.ok(ids.length>=50,'found the groups');
  assert.equal(new Set(ids).size,ids.length,'each id appears once');
});

test('groups follow CAPR 39-3 Attachment 2 order',()=>{
  const start=catalog.indexOf('const RIBBON_GROUPS = [');
  const labels=[...catalog.slice(start,catalog.indexOf('];',start)).matchAll(/key:'([a-z]+)'/g)].map(m=>m[1]);
  assert.deepEqual(labels,['usaf','decorations','profdev','aeroed','cadet','service','activity','wartime']);
});

test('ribbons that title-case badly have their official names',()=>{
  const names=displayNames();
  assert.equal(names.cap_achievment_award,'CAP Achievement Award');
  assert.equal(names.afa_award,'AFA Award to Unit Cadet of the Year');
  assert.equal(names.vfw_officer_award,'VFW Outstanding Cadet Officer of the Year Award');
  assert.equal(names.crisis_ribbon,'CAP Crisis Service Ribbon');
  assert.equal(names.spaatz_award,'Gen Carl A. Spaatz Award');
  assert.equal(names.iace_ribbon,'IACE Ribbon');
});

test('the picker is grouped, drops raw ids, and shows mini medals only where they are worn',()=>{
  assert.match(galleries,/groupRibbonIds\(visible\)/);
  assert.match(galleries,/CAPUBUniformRules\.allowsMiniMedals\(State\.uniform\)/);
  const start=galleries.indexOf('function buildRibbonGallery');
  const builder=galleries.slice(start,galleries.indexOf('\nfunction ',start+10));
  assert.doesNotMatch(builder,/'Not selected'/);
  assert.doesNotMatch(builder,/\(\$\{escapeHtml\(id\)\}\)<\/div>/);
});
