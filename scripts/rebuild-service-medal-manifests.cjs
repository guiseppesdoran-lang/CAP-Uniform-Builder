#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const overrides=require('../data/rules/verified/representation-overrides.json').awards;
const ribbonOnly=new Set(require('../data/rules/verified/medal-representation-applicability.json').ribbonOnlyAwardIds || []);
const definitions=[
  ['AIR_FORCE','miniatureMedal','air-force','data/imports/vanguard_air_force_mini_medals.json',[50,176],116],
  ['AIR_FORCE','fullSizeMedal','air-force','data/imports/vanguard_air_force_full_size_medals.json',[100,220],132],
  ['SPACE_FORCE','miniatureMedal','space-force','data/imports/vanguard_space_force_miniatureMedal.json',[50,176],116],
  ['SPACE_FORCE','fullSizeMedal','space-force','data/imports/vanguard_space_force_fullSizeMedal.json',[100,220],132],
  ['ARMY','miniatureMedal','army','data/imports/vanguard_army_miniatureMedal.json',[50,176],116],
  ['ARMY','fullSizeMedal','army','data/imports/vanguard_army_fullSizeMedal.json',[100,220],132],
  ['NAVY','miniatureMedal','navy','data/imports/vanguard_navy_miniatureMedal.json',[50,176],116],
  ['NAVY','fullSizeMedal','navy','data/imports/vanguard_navy_fullSizeMedal.json',[100,220],132],
  ['MARINE_CORPS','miniatureMedal','marine-corps','data/imports/vanguard_marine_corps_miniatureMedal.json',[50,176],116],
  ['MARINE_CORPS','fullSizeMedal','marine-corps','data/imports/vanguard_marine_corps_fullSizeMedal.json',[100,220],132],
  ['COAST_GUARD','miniatureMedal','coast-guard','data/imports/vanguard_coast_guard_miniatureMedal.json',[50,176],116],
  ['COAST_GUARD','fullSizeMedal','coast-guard','data/imports/vanguard_coast_guard_fullSizeMedal.json',[100,220],132]
];

function committedManifest(relative){
  try{
    const git=process.env.CAPUB_GIT_EXE || 'git';
    return JSON.parse(execFileSync(git,['show',`HEAD:${relative}`],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}));
  }catch{return null;}
}

for(const [service,representation,slug,relative,canvas,suspensionRibbonHeight] of definitions){
  const file=path.join(root,...relative.split('/'));
  const previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
  const committed=committedManifest(relative) || {};
  // Prefer the committed provenance record when a failed retry previously
  // replaced rich product metadata with null placeholders.
  const priorByAward=new Map([...(previous.imported || []),...(committed.imported || [])].map(record=>[record.awardId,record]));
  const excludedRibbonOnly=[...new Set([...(committed.imported || []),...(previous.imported || [])]
    .map(record=>record.awardId).filter(id=>ribbonOnly.has(id)))].sort();
  const folder=representation==='miniatureMedal'?'military-mini-medals':'military-full-size-medals';
  const prefix=`images/${folder}/${slug}/`;
  const importedByAward=new Map([...(committed.imported || []),...(previous.imported || [])]
    .filter(record=>!ribbonOnly.has(record.awardId)).map(record=>[record.awardId,record]));
  for(const [awardId,record] of Object.entries(overrides)){
    const value=record[representation];
    if(value?.status!=='AVAILABLE' || !String(value.asset || '').startsWith(prefix)) continue;
    const prior=priorByAward.get(awardId) || {};
    importedByAward.set(awardId,{...prior,awardId,productTitle:value.productTitle || prior.productTitle || null,productUrl:value.sources?.[0] || prior.productUrl || null,image:value.sourceImage || prior.image || null,score:value.score || prior.score || null,asset:value.asset});
  }
  const priorOrder=[...(committed.imported || []),...(previous.imported || [])].map(record=>record.awardId);
  const order=[...new Set([...priorOrder,...importedByAward.keys()])];
  const imported=order.filter(id=>importedByAward.has(id)).map(id=>importedByAward.get(id));
  const output={
    ...previous,
    source:previous.source || `https://www.vanguardmil.com/collections/${representation==='miniatureMedal'?'miniature-medals':'medals'}`,
    sourceType:'COMMERCIAL_CATALOG_DISCOVERY_REFERENCE',service,representation,
    canvas,suspensionRibbonHeight,
    geometryPolicy:'Suspension ribbon and pendant are normalized independently; the photographed medal is never stretched as one image.',
    imported,
    excludedRibbonOnly
  };
  if(!excludedRibbonOnly.length) delete output.excludedRibbonOnly;
  fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');
  console.log(`${service}:${representation} ${imported.length}`);
}
