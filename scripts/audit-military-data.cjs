#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {validateCatalog}=require('../military/military-core.js');
const ROOT=path.resolve(__dirname,'..');
const awards=JSON.parse(fs.readFileSync(path.join(ROOT,'data/import/normalized/military-awards.json'),'utf8'));
const devices=JSON.parse(fs.readFileSync(path.join(ROOT,'data/rules/verified/device-definitions.json'),'utf8'));
const report=validateCatalog({awards,devices});
const missingImages=[],brokenImages=[],hashes=new Map(),duplicates=[];
for(const award of awards){
  const asset=award.images?.ribbon || award.images?.badge || award.images?.lapelPin;
  if(!asset){ missingImages.push(award.id); continue; }
  const full=path.join(ROOT,asset);
  if(!fs.existsSync(full)){ brokenImages.push({id:award.id,asset}); continue; }
  const hash=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  if(hashes.has(hash)) duplicates.push([hashes.get(hash),award.id]); else hashes.set(hash,award.id);
}
const counts=awards.reduce((map,item)=>(map[item.type]=(map[item.type]||0)+1,map),{});
const precedenceRecords=awards.reduce((n,item)=>n+Object.keys(item.precedence||{}).length,0);
const verifiedRules=awards.reduce((n,item)=>n+Object.values(item.precedence||{}).filter(rule=>rule?.verified).length,0) +
  devices.filter(device=>device.verificationStatus==='OFFICIALLY_VERIFIED').length;
const output={generatedAt:new Date().toISOString(),counts,canonicalAwards:awards.length,precedenceRecords,verifiedRules,errors:report.errors,warnings:report.warnings,missingImages,brokenImages,duplicateImageHashes:duplicates};
fs.mkdirSync(path.join(ROOT,'reports'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'reports','military-data-audit.json'),JSON.stringify(output,null,2)+'\n');
const markdown=['# Military Data Audit','',`Generated: ${output.generatedAt}`,`Canonical records: ${awards.length}`,`Ribbons: ${counts.RIBBON||0}`,`Badges: ${counts.BADGE||0}`,`Lapel pins: ${counts.LAPEL_PIN||0}`,`Precedence records: ${precedenceRecords}`,`Officially verified rules: ${verifiedRules}`,`Missing production images: ${missingImages.length}`,`Broken asset paths: ${brokenImages.length}`,`Duplicate image hashes: ${duplicates.length}`,'','## Errors','',...(report.errors.length?report.errors.map(x=>`- ${x}`):['- None']),'','## Warnings','',...(report.warnings.length?report.warnings.map(x=>`- ${x}`):['- None']),''];
fs.writeFileSync(path.join(ROOT,'reports','military-data-audit.md'),markdown.join('\n'));
console.log(JSON.stringify(output,null,2));
if(report.errors.length) process.exitCode=1;
