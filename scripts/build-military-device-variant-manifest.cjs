#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const core=require('../military/military-core.js');

const ROOT=path.resolve(__dirname,'..');
const read=relative=>JSON.parse(fs.readFileSync(path.join(ROOT,relative),'utf8'));
const awards=read('data/military/canonical-awards.json');
const devices=read('data/rules/verified/device-definitions.json');
const representations=['RIBBON','MINIATURE_MEDAL','FULL_SIZE_MEDAL'];
const entries=[];
const ribbonAssets=new Map();

function allSubsets(values){
  return values.reduce((sets,value)=>[
    ...sets,
    ...sets.map(set=>[...set,value])
  ],[[]]);
}

function deviceSignature(devices){
  return devices.length ? devices.join('+') : 'NONE';
}

function ribbonAssetPath(awardId,devices){
  if(!devices.length) return null;
  const signature=deviceSignature(devices);
  const file=crypto.createHash('sha256').update(signature).digest('hex').slice(0,16);
  return `images/military-ribbon-variants/air-force/${awardId}/${file}.png`;
}

for(const award of awards){
  for(const service of award.authorizedServices || []){
    const rule=core.inferDeviceRules(award,service,{allowUnverified:false});
    if(!rule) continue;
    for(const representation of representations){
      const rep=core.getAwardRepresentation(award,representation);
      if(rep.status==='NOT_APPLICABLE') continue;
      const representationKey={RIBBON:'ribbon',MINIATURE_MEDAL:'miniatureMedal',FULL_SIZE_MEDAL:'fullSizeMedal'}[representation];
      const repRule=rule.representations?.[representationKey] || rule;
      const specials=repRule.allowedSpecialDevices || [];
      const configurations=allSubsets(specials);
      for(let awardCount=1;awardCount<=20;awardCount++){
        for(const specialDevices of configurations){
          const result=core.calculateDevices({award,service,awardCount,specialAuthorizations:specialDevices,deviceCatalog:devices,representation});
          if(!result.valid) continue;
          const entry={
            key:core.canonicalDeviceVariantKey({awardId:award.id,service,representation,awardCount,specialDevices}),
            awardId:award.id,service,representation,awardCount,specialDevices,devices:result.devices,
            strategy:'DETERMINISTIC_RUNTIME_COMPOSITE'
          };
          if(representation==='RIBBON'){
            const physicalRibbons=core.splitRibbonAwardInstances({
              award,service,awardCount,specialAuthorizations:specialDevices,
              deviceCatalog:devices,allowUnverifiedRules:false,maxDevices:4
            });
            entry.physicalRibbons=physicalRibbons.map(instance=>({
              awardCount:instance.awardCount,
              devices:instance.devices,
              valid:instance.valid,
              assetKey:`${award.id}::${service}::${deviceSignature(instance.devices || [])}`
            }));
            if(service==='AIR_FORCE'){
              for(const instance of physicalRibbons){
                const instanceDevices=instance.devices || [];
                if(instanceDevices.length>4) continue;
                const key=`${award.id}::${service}::${deviceSignature(instanceDevices)}`;
                if(!ribbonAssets.has(key)){
                  const base=core.getAwardRepresentation(award,'RIBBON').asset;
                  ribbonAssets.set(key,{
                    key,awardId:award.id,service,devices:instanceDevices,
                    asset:instanceDevices.length ? ribbonAssetPath(award.id,instanceDevices) : base,
                    strategy:instanceDevices.length ? 'PRECOMPOSED_PNG' : 'PRECOMPOSED_BASE',
                    canvas:[100,30],style:'MCCHORD_DIGITAL'
                  });
                }
              }
            }
          }
          entries.push(entry);
        }
      }
    }
  }
}

const payload={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  practicalAwardCountMaximum:20,
  maximumDevicesPerPhysicalRibbon:4,
  notes:'Only combinations accepted by an explicit award/service/representation rule are included. Ribbon entries include the physical-ribbon split required when more than four devices would otherwise appear. Air Force ribbonAssets point to repository-native McChord-style composites.',
  entries,
  ribbonAssets:[...ribbonAssets.values()].sort((left,right)=>left.key.localeCompare(right.key))
};
fs.writeFileSync(path.join(ROOT,'data/military/device-variant-manifest.json'),JSON.stringify(payload,null,2)+'\n');
console.log(`Wrote ${entries.length} authorized deterministic device variants.`);
