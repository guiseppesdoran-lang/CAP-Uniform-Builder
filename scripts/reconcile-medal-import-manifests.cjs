#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const applicability=require('../data/rules/verified/medal-representation-applicability.json');
const ribbonOnly=new Set(applicability.ribbonOnlyAwardIds || []);
const folder=path.join(root,'data/imports');
let removed=0;
for(const name of fs.readdirSync(folder).filter(name=>/^vanguard_.*\.json$/.test(name))){
  const file=path.join(folder,name);
  const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(manifest.imported)) continue;
  const before=manifest.imported.length;
  const removedIds=manifest.imported.filter(record=>ribbonOnly.has(record.awardId)).map(record=>record.awardId);
  manifest.imported=manifest.imported.filter(record=>!ribbonOnly.has(record.awardId));
  if(manifest.imported.length===before) continue;
  removed+=before-manifest.imported.length;
  manifest.excludedRibbonOnly=[...new Set([...(manifest.excludedRibbonOnly || []),...removedIds])].sort();
  fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
}
console.log(`Removed ${removed} ribbon-only commercial matches from import manifests.`);
