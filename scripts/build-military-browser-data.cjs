#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const core=require('../military/military-core.js');
const ROOT=path.resolve(__dirname,'..');
const awards=JSON.parse(fs.readFileSync(path.join(ROOT,'data/import/normalized/military-awards.json'),'utf8'));
const devices=JSON.parse(fs.readFileSync(path.join(ROOT,'data/rules/verified/device-definitions.json'),'utf8'));
const representationPath=path.join(ROOT,'data/rules/verified/representation-overrides.json');
const representationOverrides=fs.existsSync(representationPath)
  ? JSON.parse(fs.readFileSync(representationPath,'utf8')).awards || {}
  : {};
const canonicalBySourceId=new Map();
for(const canonical of core.canonicalizeAwards(awards)){
  for(const sourceId of canonical.sourceIds || [canonical.id]) canonicalBySourceId.set(sourceId,canonical.id);
}
for(const award of awards){
  const canonicalId=canonicalBySourceId.get(award.id) || award.id;
  const override=representationOverrides[canonicalId] || representationOverrides[award.id];
  if(override) award.representations=override;
}
const payload=`(function(root){ root.CAPUBMilitaryData = Object.freeze(${JSON.stringify({awards,devices})}); })(typeof globalThis !== 'undefined' ? globalThis : window);\n`;
fs.writeFileSync(path.join(ROOT,'military','military-data.js'),payload);
console.log(`Wrote ${awards.length} awards and ${devices.length} devices to military/military-data.js`);
