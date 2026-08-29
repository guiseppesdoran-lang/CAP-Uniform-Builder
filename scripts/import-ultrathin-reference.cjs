#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {normalizeName}=require('../military/military-core.js');

const ROOT=path.resolve(__dirname,'..');
const BASE='https://www.ultrathin.com/ultrathin/';
const URLS={catalog:`${BASE}ribbons.js`,devices:`${BASE}devices.js`,precedence:`${BASE}precedences.js`};
const MANIFEST=path.join(ROOT,'data','imports','ultrathin_ribbon_reference_manifest.json');
const REPORT=path.join(ROOT,'reports','ultrathin-ribbon-reference-audit.md');
const LOCAL=path.join(ROOT,'data','military','canonical-awards.json');
const USER_AGENT='CAP-US-Military-Uniform-Builder/1.0 commercial discovery audit; contact via repository owner';

async function get(url){
  const response=await fetch(url,{headers:{'User-Agent':USER_AGENT,'Accept':'application/javascript,text/javascript,*/*'}});
  if(!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.text();
}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function key(value){
  return normalizeName(String(value||'')).toLowerCase()
    .replace(/\b(united states|u s)\b/g,' ')
    .replace(/\bmilitary medal\s*&?\s*$/,' ')
    .replace(/\b(medal and ribbon|medal|ribbon|award)\b\s*$/,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function neutralKey(value){
  return key(value)
    .replace(/^(air force|air and space|army|navy and marine corps|navy|marine corps|coast guard)\s+/,'')
    .replace(/\s+/g,' ')
    .trim();
}
function runCatalog(catalogSource,deviceSource,precedenceSource){
  const sandbox={alert(){},price_of_attachment:0,price_of_device:0};
  vm.runInNewContext(catalogSource,sandbox,{filename:'ultrathin-ribbons.js',timeout:2000});
  vm.runInNewContext(deviceSource,sandbox,{filename:'ultrathin-devices.js',timeout:2000});
  vm.runInNewContext(precedenceSource,sandbox,{filename:'ultrathin-precedences.js',timeout:2000});
  return sandbox;
}
function localIndex(awards){
  const exact=new Map(),neutralCandidates=new Map(),candidates=[];
  for(const award of awards) for(const value of [award.name,award.officialName,...(award.aliases||[])]){
    const normalized=key(value);
    if(normalized && !exact.has(normalized)) exact.set(normalized,award.id);
    const neutral=neutralKey(value);
    if(neutral){
      const candidates=neutralCandidates.get(neutral)||new Set();
      candidates.add(award.id);
      neutralCandidates.set(neutral,candidates);
    }
    if(normalized) candidates.push({id:award.id,value:normalized});
  }
  const neutral=new Map();
  for(const [name,candidates] of neutralCandidates) if(candidates.size===1) neutral.set(name,[...candidates][0]);
  return {exact,neutral,candidates};
}
function editSimilarity(left,right){
  const a=String(left),b=String(right),row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let diagonal=row[0]; row[0]=i;
    for(let j=1;j<=b.length;j++){
      const above=row[j],cost=a[i-1]===b[j-1]?0:1;
      row[j]=Math.min(row[j]+1,row[j-1]+1,diagonal+cost); diagonal=above;
    }
  }
  return 1-row[b.length]/Math.max(1,a.length,b.length);
}
function matchLocal(index,value,namespace){
  const exact=index.exact.get(key(value));
  if(exact) return {id:exact,method:'EXACT'};
  const neutral=index.neutral.get(neutralKey(value));
  if(neutral) return {id:neutral,method:'SERVICE_NEUTRAL_EXACT'};
  if(namespace!=='FEDERAL_OR_FOREIGN_CANDIDATE') return null;
  const target=neutralKey(value),byId=new Map();
  for(const candidate of index.candidates){
    const candidateName=neutralKey(candidate.value);
    const protectedToken=['dhs','dot','phs','noaa','cgaux'].find(token=>target.split(' ').includes(token));
    if(protectedToken && !candidateName.split(' ').includes(protectedToken)) continue;
    const score=editSimilarity(target,candidateName);
    if(score>(byId.get(candidate.id)||0)) byId.set(candidate.id,score);
  }
  const ranked=[...byId].sort((a,b)=>b[1]-a[1]);
  if(ranked[0]?.[1]>=0.87 && ranked[0][1]-(ranked[1]?.[1]||0)>=0.06) return {id:ranked[0][0],method:'HIGH_CONFIDENCE_NAME_SIMILARITY',score:Number(ranked[0][1].toFixed(4))};
  return null;
}
function discoveryNamespace(record){
  const id=String(record.id),name=String(record.title);
  if(/^CAP\d|^C\d/.test(id)) return 'CAP';
  if(/^PH/.test(id)) return 'PUBLIC_HEALTH_SERVICE';
  if(/^NO/.test(id)) return 'NOAA';
  if(/^MM/.test(id)) return 'MERCHANT_MARINE';
  if(/^AX|^Obsolete$/.test(id)) return 'COAST_GUARD_AUXILIARY';
  if(/^CIV|^DOT/.test(id)) return 'CIVILIAN';
  if(/^State$/i.test(id)) return 'STATE';
  if(/obsolete/i.test(name)) return 'HISTORICAL';
  return 'FEDERAL_OR_FOREIGN_CANDIDATE';
}

async function main(){
  const fetched=Object.fromEntries(await Promise.all(Object.entries(URLS).map(async([name,url])=>[name,await get(url)])));
  const source=runCatalog(fetched.catalog,fetched.devices,fetched.precedence);
  const index=localIndex(require(LOCAL));
  const serviceArrays={ARMY:source.precedence_army_left||[],NAVY:source.precedence_navy||[],MARINE_CORPS:source.precedence_marine||[],AIR_FORCE:source.precedence_af||[],SPACE_FORCE:source.precedence_af||[],COAST_GUARD:source.precedence_cg||[]};
  const servicesById=new Map();
  for(const [service,ids] of Object.entries(serviceArrays)) for(const id of ids){
    const list=servicesById.get(String(id))||[];
    if(!list.includes(service)) list.push(service);
    servicesById.set(String(id),list);
  }
  const ribbons=source.ribbons.map(record=>{
    const namespace=discoveryNamespace(record);
    const match=matchLocal(index,record.title,namespace);
    return {
      sourceId:String(record.id),name:String(record.title).trim(),namespace,services:servicesById.get(String(record.id))||[],
      localCanonicalId:match?.id||null,matchMethod:match?.method||null,matchScore:match?.score||null,
      representations:{miniatureMedal:record.miniature_medal_price===0?'NOT_APPLICABLE':'DISCOVERED',fullSizeMedal:record.large_medal_price===0?'NOT_APPLICABLE':'DISCOVERED'}
    };
  });
  const devices=source.devices.map(record=>({sourceId:String(record.id),name:String(record.title).trim(),superimposed:Boolean(record.superimpose)}));
  const missing=ribbons.filter(record=>!record.localCanonicalId);
  const missingByNamespace=Object.fromEntries([...new Set(missing.map(record=>record.namespace))].sort().map(namespace=>[namespace,missing.filter(record=>record.namespace===namespace).length]));
  const manifest={
    source:'ULTRATHIN_RIBBON_PRECEDENCE_VALIDATOR',sourceType:'commercial-discovery',
    sourceUrl:'https://www.ultrathin.com/ultrathin/ribbons_update.htm',accessedAt:new Date().toISOString(),
    runtimeDependency:false,regulatoryAuthority:false,assetPolicy:'NO_EXTERNAL_ARTWORK_PACKAGED',
    limitations:[
      'UltraThin is a secondary commercial discovery source, not regulatory authority.',
      'The public catalog includes historical, civilian, CAP, state, and non-U.S. records; discovery does not establish current wear authorization.',
      'Precedence and device rules must be verified against current official service publications before production enforcement.'
    ],
    sourceHashes:Object.fromEntries(Object.entries(fetched).map(([name,value])=>[name,sha256(value)])),
    counts:{ribbons:ribbons.length,devices:devices.length,matchedLocal:ribbons.length-missing.length,unmatchedDiscovery:missing.length,unmatchedByNamespace:missingByNamespace},
    ribbons,devices
  };
  fs.writeFileSync(MANIFEST,JSON.stringify(manifest,null,2)+'\n');
  const lines=['# UltraThin Ribbon Discovery Audit','',`Accessed: ${manifest.accessedAt}`,`Public catalog records: ${ribbons.length}`,`Device/attachment records: ${devices.length}`,`Normalized matches to local canonical awards: ${manifest.counts.matchedLocal}`,`Unmatched discovery records requiring reconciliation: ${missing.length}`,'','> UltraThin is used only for discovery. Its precedence, authorization, device, medal-availability, and artwork claims are not treated as official verification. Production has no runtime dependency on UltraThin.','','## Unmatched discovery summary','',...Object.entries(missingByNamespace).map(([namespace,count])=>`- ${namespace}: ${count}`),'',...Object.keys(missingByNamespace).sort().flatMap(namespace=>[`## ${namespace.replaceAll('_',' ')}`,'',...missing.filter(record=>record.namespace===namespace).map(record=>`- ${record.name} (${record.sourceId}) — ${record.services.join(', ')||'no service table membership recorded'}`),''])];
  fs.writeFileSync(REPORT,lines.join('\n')+'\n');
  console.log(JSON.stringify(manifest.counts,null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
