'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const catalog=fs.readFileSync(path.join(__dirname,'..','js','catalog.js'),'utf8');

test('badge ids that are image hashes have a real display name',()=>{
  const names=catalog.slice(catalog.indexOf('const BADGE_DISPLAY_NAMES'),catalog.indexOf('});',catalog.indexOf('const BADGE_DISPLAY_NAMES')));
  const hashed=[...new Set([...catalog.matchAll(/'([A-Za-z]+1_[0-9A-F]{12,})'/g)].map(m=>m[1]))];
  assert.ok(hashed.length>=10,'found the hashed aviation ids');
  for(const id of hashed) assert.match(names,new RegExp(`\\b${id}:\\s*'[^']+'`),`${id} has a name`);
});

test('a badge tile is the picture and the name: no builder prints a line under it, plain-language or abbreviation',()=>{
  // The owner (2026-11-13): "remove these lower letters". Where a badge is worn is said in the window's status line when the tile is tapped (js/pick-lists.js badgeNote), not on the tile.
  const lists=fs.readFileSync(path.join(__dirname,'..','js','pick-lists.js'),'utf8');
  assert.doesNotMatch(lists,/getBadgeTileMetaHtml|caption: badge/,'pick-lists.js puts no caption on a badge tile');
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..','js','badge-rules.js'),'utf8'),/getBadgeTileMetaHtml/,'the line under a badge\'s name is gone with the tiles that had it');
  for(const file of ['galleries.js','wiring.js','patches.js','pick-lists.js']){
    const text=fs.readFileSync(path.join(__dirname,'..','js',file),'utf8');
    assert.doesNotMatch(text,/Regulation scale: \$\{Math\.round\(getBadgeRenderSize/,`${file} no longer prints the abbreviation line`);
  }
});

test('the top pilot badge is named Command Pilot, and a member report may say Command or Master',()=>{
  const names=fs.readFileSync(path.join(__dirname,'..','js','catalog.js'),'utf8');
  assert.match(names,/CAPMasterPilot1_621A0E2ED15DA: 'Command Pilot Badge'/);
  // The importer is run, not read: a Command or a Master Pilot Badge row is the top pilot badge.
  const vm=require('node:vm');
  const {loadPageScripts}=require('./helpers/page-scripts.cjs');
  const {context}=loadPageScripts();
  for(const row of ['Command Pilot Badge 01 Jan 2020','Master Pilot Badge 01 Jan 2020']){
    const parsed=JSON.parse(vm.runInContext('(t)=>JSON.stringify(parseCapMemberReport(t).authorizedBadges)',context)('Printer Friendly View - Member Details General Information 654321 WILSON, DAVID MALE SENIOR Maj 01 Mar 2024 15 Jan 2016 Decorations '+row));
    assert.ok(parsed.includes('CAPMasterPilot1_621A0E2ED15DA'),row);
  }
  assert.match(names,/cdi_senior_badge: 'Character Development Instructor Senior Badge'/);
});

test('a badge has one name: the page\'s display names agree with the badge catalog\'s (Ground Team Badge, CAPR 39-1 10.4.5; Recruiting and Retention)', () => {
  const vm=require('node:vm');
  const { loadPageScripts }=require('./helpers/page-scripts.cjs');
  const { context }=loadPageScripts();
  const ev=src=>vm.runInContext(src,context);
  const B=require('../data/badge-catalog.js').BADGES;
  const differ=[];
  for(const [id,b] of Object.entries(B)){
    const shown=ev(`getBadgeDisplayName(${JSON.stringify(id)})`);
    if(b.name && shown!==b.name) differ.push(`${id}: page "${shown}", catalog "${b.name}"`);
  }
  assert.deepEqual(differ,[]);
});
