#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const applicabilityPath=path.join(root,'data/rules/verified/medal-representation-applicability.json');
const overridesPath=path.join(root,'data/rules/verified/representation-overrides.json');
const applicability=JSON.parse(fs.readFileSync(applicabilityPath,'utf8'));
const overrides=JSON.parse(fs.readFileSync(overridesPath,'utf8'));
const sources=applicability.sources || [];

for(const awardId of applicability.ribbonOnlyAwardIds || []){
  const record=overrides.awards[awardId] ||= {};
  for(const representation of ['miniatureMedal','fullSizeMedal']){
    record[representation]={
      status:'NOT_APPLICABLE',
      available:false,
      asset:null,
      verificationStatus:'OFFICIALLY_CLASSIFIED_RIBBON_ONLY',
      sources,
      notes:'This award is represented by a ribbon or unit-award emblem, not a hanging medal.'
    };
  }
}

fs.writeFileSync(overridesPath,JSON.stringify(overrides,null,2)+'\n');
console.log(`Applied ribbon-only medal classifications to ${(applicability.ribbonOnlyAwardIds || []).length} awards.`);
