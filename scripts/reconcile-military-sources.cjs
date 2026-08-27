#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const awards=JSON.parse(fs.readFileSync(path.join(ROOT,'data','import','normalized','military-awards.json'),'utf8'));
const usammPath=path.join(ROOT,'data','imports','usamm_ezrackbuilder_manifest.json');
const usamm=fs.existsSync(usammPath)?JSON.parse(fs.readFileSync(usammPath,'utf8')):{ribbons:[],devices:[],relationships:[]};
const byId=new Map((usamm.ribbons||[]).map(item=>[item.awardId,item]));
const rows=awards.map(award=>({
  awardId:award.id,officialName:award.officialName||award.name,
  officialMilitaryRibbons:!!award.sources?.catalog?.length,
  usamm:byId.has(award.id),officialRegulation:!!award.sources?.regulation,
  status:award.sources?.regulation?'OFFICIALLY_VERIFIED':(byId.has(award.id)?'CROSS_REFERENCED':'DISCOVERED')
}));
const conflicts=[];
const output={generatedAt:new Date().toISOString(),records:rows.length,crossReferenced:rows.filter(x=>x.usamm).length,officiallyVerified:rows.filter(x=>x.officialRegulation).length,conflicts,items:rows};
const target=path.join(ROOT,'reports','military-source-reconciliation.json');
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({records:output.records,crossReferenced:output.crossReferenced,officiallyVerified:output.officiallyVerified,conflicts:conflicts.length},null,2));
