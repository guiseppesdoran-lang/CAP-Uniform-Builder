'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const catalogPath=path.join(root,'data/import/normalized/military-awards.json');
const overridePath=path.join(root,'data/rules/verified/manual-overrides.json');
const awards=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const overrides=JSON.parse(fs.readFileSync(overridePath,'utf8'));
let changed=0;
for(const award of awards){
  const awardOverride=overrides.awards?.[award.id];
  const precedenceOverride=overrides.precedence?.[award.id];
  const deviceOverride=overrides.devices?.[award.id];
  if(awardOverride){ Object.assign(award,awardOverride); changed++; }
  if(precedenceOverride){ award.precedence=Object.assign({},award.precedence || {},precedenceOverride); changed++; }
  if(deviceOverride){ award.devices=Object.assign({},award.devices || {},deviceOverride); changed++; }
}
fs.writeFileSync(catalogPath,JSON.stringify(awards,null,2)+'\n');
console.log(`Applied ${changed} verified override groups without crawling a commercial source.`);
