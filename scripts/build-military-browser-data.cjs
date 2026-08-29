#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const core=require('../military/military-core.js');
const {applyServicePrecedence}=require('./lib/apply-service-precedence.cjs');
const ROOT=path.resolve(__dirname,'..');
let awards=JSON.parse(fs.readFileSync(path.join(ROOT,'data/import/normalized/military-awards.json'),'utf8'));
const additionsPath=path.join(ROOT,'data/military/catalog-additions.json');
if(fs.existsSync(additionsPath)) awards.push(...(JSON.parse(fs.readFileSync(additionsPath,'utf8')).awards || []));
const precedenceTables=JSON.parse(fs.readFileSync(path.join(ROOT,'data/rules/verified/service-precedence.json'),'utf8'));
awards=applyServicePrecedence(awards,precedenceTables,core);
const devices=JSON.parse(fs.readFileSync(path.join(ROOT,'data/rules/verified/device-definitions.json'),'utf8'));
const representationPath=path.join(ROOT,'data/rules/verified/representation-overrides.json');
const representationOverrides=fs.existsSync(representationPath)
  ? JSON.parse(fs.readFileSync(representationPath,'utf8')).awards || {}
  : {};
const stylePath=path.join(ROOT,'data/rules/verified/ribbon-style-overrides.json');
const styleOverrides=fs.existsSync(stylePath)
  ? JSON.parse(fs.readFileSync(stylePath,'utf8')).awards || {}
  : {};
const canonicalBySourceId=new Map();
for(const canonical of core.canonicalizeAwards(awards)){
  for(const sourceId of canonical.sourceIds || [canonical.id]) canonicalBySourceId.set(sourceId,canonical.id);
}
for(const award of awards){
  const canonicalId=canonicalBySourceId.get(award.id) || award.id;
  const override={...(representationOverrides[canonicalId] || representationOverrides[award.id] || {}),...(styleOverrides[canonicalId] || styleOverrides[award.id] || {})};
  if(Object.keys(override).length) award.representations={...(award.representations || {}),...override};
}
const badgesPath=path.join(ROOT,'data/military/badges.json');
const badges=fs.existsSync(badgesPath) ? JSON.parse(fs.readFileSync(badgesPath,'utf8')).badges || [] : [];
const assetProfiles=JSON.parse(fs.readFileSync(path.join(ROOT,'data/military/asset-profiles.json'),'utf8'));
const deviceVariantPath=path.join(ROOT,'data/military/device-variant-manifest.json');
const deviceVariants=fs.existsSync(deviceVariantPath) ? JSON.parse(fs.readFileSync(deviceVariantPath,'utf8')) : {entries:[]};
const capBadgePath=path.join(ROOT,'data/military/cap-badge-representations.json');
const capBadgeRepresentations=fs.existsSync(capBadgePath) ? JSON.parse(fs.readFileSync(capBadgePath,'utf8')) : {records:[]};
const payload=`(function(root){ root.CAPUBMilitaryData = Object.freeze(${JSON.stringify({awards,devices,badges,assetProfiles,deviceVariants,capBadgeRepresentations})}); })(typeof globalThis !== 'undefined' ? globalThis : window);\n`;
fs.writeFileSync(path.join(ROOT,'military','military-data.js'),payload);
console.log(`Wrote ${awards.length} awards, ${devices.length} devices, and ${badges.length} badges to military/military-data.js`);
