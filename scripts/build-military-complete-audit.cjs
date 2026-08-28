#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const core=require('../military/military-core.js');

const root=path.resolve(__dirname,'..');
const readJson=relative=>JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
const importedAwards=readJson('data/import/normalized/military-awards.json');
const officialAdditions=readJson('data/military/catalog-additions.json').awards || [];
const sourceAwards=[...importedAwards,...officialAdditions];
const overrides=readJson('data/rules/verified/representation-overrides.json').awards || {};
const badges=readJson('data/military/badges.json').badges || [];
const devices=readJson('data/rules/verified/device-definitions.json');
const precedenceTables=readJson('data/rules/verified/service-precedence.json');
const canonical=core.canonicalizeAwards(sourceAwards).map(award=>({
  ...award,
  representations:core.normalizeRepresentations({...award,representations:overrides[award.id] || award.representations})
})).sort(core.compareAwardsUniversal);

function localFile(asset){
  if(!asset) return null;
  const full=path.join(root,String(asset).replaceAll('/',path.sep));
  return fs.existsSync(full) && fs.statSync(full).isFile() ? full : null;
}
function assetRecord(ownerType,ownerId,representation){
  const rep=representation.value;
  const full=localFile(rep.asset);
  return {
    ownerType,ownerId,representation:representation.name,status:rep.status,
    asset:rep.asset || null,exists:!!full,
    sha256:full ? crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex') : null,
    verificationStatus:rep.verificationStatus || null,
    sources:rep.sources || []
  };
}

const awardAssets=canonical.flatMap(award=>[
  assetRecord('AWARD',award.id,{name:'RIBBON',value:award.representations.ribbon}),
  assetRecord('AWARD',award.id,{name:'MINIATURE_MEDAL',value:award.representations.miniatureMedal}),
  assetRecord('AWARD',award.id,{name:'FULL_SIZE_MEDAL',value:award.representations.fullSizeMedal})
]);
const badgeAssets=badges.flatMap(badge=>Object.entries(badge.representations || {}).map(([name,value])=>
  assetRecord('BADGE',badge.id,{name:name.toUpperCase(),value})
));
const deviceAssets=devices.map(device=>{
  const full=localFile(device.asset);
  return {
    ownerType:'DEVICE',ownerId:device.id,representation:'DEVICE',
    status:full ? 'AVAILABLE' : 'MISSING_ASSET',asset:device.asset || null,exists:!!full,
    sha256:full ? crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex') : null,
    verificationStatus:device.verificationStatus || null,sources:device.sources || []
  };
});
const assets=[...awardAssets,...badgeAssets,...deviceAssets];
const repNames=['RIBBON','MINIATURE_MEDAL','FULL_SIZE_MEDAL'];
const representationTotals=Object.fromEntries(repNames.map(name=>{
  const rows=awardAssets.filter(item=>item.representation===name);
  return [name,Object.fromEntries(core.REPRESENTATION_STATUSES.map(status=>[status,rows.filter(item=>item.status===status).length]))];
}));
const discarded=sourceAwards.filter(item=>!core.isWearableAwardRecord(item)).map(item=>({id:item.id,name:item.officialName || item.name,type:item.type}));
const canonicalIds=new Set(canonical.map(award=>award.id));
const missingPrecedenceCatalogRecords=Object.entries(precedenceTables).flatMap(([service,table])=>(table.awards || [])
  .filter(id=>!canonicalIds.has(id)).map(id=>({service,id,source:table.source})));
const byService=Object.fromEntries(core.ORGANIZATIONS.filter(service=>service!=='CAP').map(service=>[
  service,canonical.filter(award=>(award.authorizedServices || []).map(core.normalizeService).includes(service)).length
]));
const summary={
  generatedAt:new Date().toISOString(),sourceRecords:importedAwards.length,officialAdditionRecords:officialAdditions.length,canonicalAwards:canonical.length,
  discardedNonAwardRecords:discarded.length,badges:badges.length,devices:devices.length,
  missingPrecedenceCatalogRecords:missingPrecedenceCatalogRecords.length,
  byService,representationTotals,
  awardsWithVerifiedPrecedence:canonical.filter(award=>Object.values(award.precedence || {}).some(rule=>rule?.verified)).length,
  awardsWithExplicitDeviceRules:canonical.filter(award=>Object.keys(award.devices || {}).length).length,
  brokenAvailableAssets:assets.filter(item=>item.status==='AVAILABLE' && !item.exists).length
};

fs.mkdirSync(path.join(root,'reports'),{recursive:true});
fs.mkdirSync(path.join(root,'data/military'),{recursive:true});
fs.writeFileSync(path.join(root,'data/military/asset-manifest.json'),JSON.stringify({schemaVersion:1,generatedAt:summary.generatedAt,assets},null,2)+'\n');
fs.writeFileSync(path.join(root,'reports/us-military-complete-catalog-audit.json'),JSON.stringify({summary,discarded,missingPrecedenceCatalogRecords,assets},null,2)+'\n');

const statusLine=name=>core.REPRESENTATION_STATUSES.map(status=>`${status}: ${representationTotals[name][status]}`).join('; ');
const audit=[
  '# U.S. Military Complete Catalog Audit','',`Generated: ${summary.generatedAt}`,'',
  '> This audit measures implemented, locally renderable data. It does not treat discovery links as authorization and does not count missing or unverified artwork as complete.','',
  '## Coverage','',
  `- Source discovery records: ${summary.sourceRecords}`,
  `- Official-source addition records: ${summary.officialAdditionRecords}`,
  `- Wearable canonical awards after filtering: ${summary.canonicalAwards}`,
  `- Rejected navigation/rank records: ${summary.discardedNonAwardRecords}`,
  `- Military badge records: ${summary.badges}`,
  `- Device definitions: ${summary.devices}`,
  `- Awards with at least one officially verified precedence entry: ${summary.awardsWithVerifiedPrecedence}`,
  `- Awards with an explicit service device rule: ${summary.awardsWithExplicitDeviceRules}`,
  `- Official precedence-table IDs missing from the canonical catalog: ${summary.missingPrecedenceCatalogRecords}`,
  `- Available records with broken local paths: ${summary.brokenAvailableAssets}`,'',
  '## Award representation status','',
  `- Ribbon — ${statusLine('RIBBON')}`,
  `- Miniature medal — ${statusLine('MINIATURE_MEDAL')}`,
  `- Full-size medal — ${statusLine('FULL_SIZE_MEDAL')}`,'',
  '## Service discovery coverage','',
  ...Object.entries(byService).map(([service,count])=>`- ${service}: ${count} canonical records containing that source-service tag`),'',
  '## Rejected non-award records','',
  ...(discarded.length ? discarded.map(item=>`- \`${item.id}\` — ${item.name} (${item.type})`) : ['- None']),'',
  '## Official table records absent from the catalog','',
  ...(missingPrecedenceCatalogRecords.length ? missingPrecedenceCatalogRecords.map(item=>`- ${item.service}: \`${item.id}\``) : ['- None']),'',
  '## Interpretation','',
  '- Service counts are discovery coverage, not proof that every award is currently authorized for wear by that service.',
  '- The military badge catalog is not complete until official-source records and approved local artwork are added.',
  '- Medal gaps remain explicit. No generic medal pendant or ribbon-only substitute is accepted.',''
];
fs.writeFileSync(path.join(root,'reports/us-military-complete-catalog-audit.md'),audit.join('\n'));

const gaps=[
  '# Military Catalog Gaps','',`Generated: ${summary.generatedAt}`,'',
  '## Blocking gaps','',
  `- Miniature medals needing approved local art: ${representationTotals.MINIATURE_MEDAL.MISSING_ASSET}`,
  `- Full-size medals needing approved local art: ${representationTotals.FULL_SIZE_MEDAL.MISSING_ASSET}`,
  `- Military badges needing catalog records and approved local art: ${badges.length ? 'catalog partially populated; see manifest' : 'catalog not yet populated'}`,
  `- Awards without explicit service device rules: ${summary.canonicalAwards-summary.awardsWithExplicitDeviceRules}`,
  `- Awards without an officially verified precedence entry: ${summary.canonicalAwards-summary.awardsWithVerifiedPrecedence}`,'',
  '## Required next work','',
  '- Reconcile each service catalog against current official publications and historical wearable tables.',
  '- Add service/component/foreign/state namespaces without merging similarly named awards.',
  '- Add full-size and miniature medal art only after award-specific source and style review.',
  '- Populate badge families, authorization, precedence, quantity, placement, and subdued/metal representations.',
  '- Add service- and representation-specific repeat-award, campaign, valor, combat, numeral, clasp, and special-device rules.',
  '- Add deterministic visual snapshots for racks, medal rows, badges, selected-card state, exports, and mobile layout.',''
];
fs.writeFileSync(path.join(root,'reports/military-catalog-gaps.md'),gaps.join('\n'));
console.log(JSON.stringify(summary,null,2));
