'use strict';

const fs=require('node:fs');
const path=require('node:path');
const core=require('../military/military-core.js');
const {applyServicePrecedence}=require('./lib/apply-service-precedence.cjs');

const root=path.resolve(__dirname,'..');
let awards=JSON.parse(fs.readFileSync(path.join(root,'data/import/normalized/military-awards.json'),'utf8'));
const additionsPath=path.join(root,'data/military/catalog-additions.json');
if(fs.existsSync(additionsPath)) awards.push(...(JSON.parse(fs.readFileSync(additionsPath,'utf8')).awards || []));
const precedenceTables=JSON.parse(fs.readFileSync(path.join(root,'data/rules/verified/service-precedence.json'),'utf8'));
awards=applyServicePrecedence(awards,precedenceTables,core);
const devices=JSON.parse(fs.readFileSync(path.join(root,'data/rules/verified/device-definitions.json'),'utf8'));
const overrides=JSON.parse(fs.readFileSync(path.join(root,'data/rules/verified/representation-overrides.json'),'utf8')).awards || {};
const stylePath=path.join(root,'data/rules/verified/ribbon-style-overrides.json');
const styleOverrides=fs.existsSync(stylePath)?JSON.parse(fs.readFileSync(stylePath,'utf8')).awards || {}:{};
const canonical=core.canonicalizeAwards(awards).map(award=>{
  const override={...(overrides[award.id] || {}),...(styleOverrides[award.id] || {})};
  const representations=core.normalizeRepresentations({...award,representations:{...(award.representations || {}),...override}});
  return {...award,representations};
}).sort(core.compareAwardsUniversal);

function local(asset){
  return !!asset && fs.existsSync(path.join(root,String(asset).replaceAll('/',path.sep)));
}
function yes(value){ return value ? 'Yes' : 'No'; }
function esc(value){ return String(value ?? '').replaceAll('|','\\|').replaceAll('\n',' '); }
function deviceRules(award){ return Object.values(award.devices || {}).filter(Boolean); }
function repeatSystems(award){
  return [...new Set(deviceRules(award).map(rule=>rule.repeatAwardSystem || (rule.repeatAward ? 'configured' : '')).filter(Boolean))].join(', ');
}
function specialDevices(award){
  return [...new Set(deviceRules(award).flatMap(rule=>rule.allowedSpecialDevices || []))];
}
function referencedDevices(award){
  const refs=[];
  for(const rule of deviceRules(award)){
    const text=JSON.stringify(rule);
    refs.push(...[...text.matchAll(/"([A-Z][A-Z0-9_]+)"/g)].map(match=>match[1]).filter(id=>/DEVICE|STAR|OLC|HOURGLASS|NUMERAL|ARROWHEAD/.test(id)));
  }
  return [...new Set(refs)];
}
function commercialFound(award,needle){
  return (award.sources?.catalog || []).some(source=>String(source).toLowerCase().includes(needle));
}

const totals={
  canonicalAwards:canonical.length,
  ribbons:canonical.filter(a=>a.representations.ribbon.available).length,
  miniatureMedals:canonical.filter(a=>a.representations.miniatureMedal.available).length,
  fullSizeMedals:canonical.filter(a=>a.representations.fullSizeMedal.available).length,
  deviceTypes:devices.length,
  repeatSupport:canonical.filter(a=>deviceRules(a).some(rule=>rule.repeatAward || rule.repeatAwardSystem)).length,
  specialDevices:canonical.filter(a=>specialDevices(a).length).length,
  officiallyVerified:canonical.filter(a=>a.verificationStatus==='OFFICIALLY_VERIFIED').length,
  officiallyVerifiedDeviceRules:canonical.filter(a=>deviceRules(a).some(rule=>rule.verificationStatus==='OFFICIALLY_VERIFIED')).length,
  missingDeviceRules:canonical.filter(a=>!deviceRules(a).length).length,
  missingRibbon:canonical.filter(a=>!local(a.representations.ribbon.asset)).length,
  missingMiniature:canonical.filter(a=>!local(a.representations.miniatureMedal.asset)).length,
  missingFullSize:canonical.filter(a=>!local(a.representations.fullSizeMedal.asset)).length
};

const lines=[
  '# Military Award Combination Audit','',
  `Generated: ${new Date().toISOString()}`,'',
  '> This report is intentionally conservative. A local ribbon image does not prove a device rule or medal representation. Missing and unverified fields remain gaps; inferred branch conventions are available only in the builder’s **Manual / unverified configuration** mode.','',
  '## Totals','',
  `- Total canonical awards: ${totals.canonicalAwards}`,
  `- Ribbon representations with a catalog asset reference: ${totals.ribbons}`,
  `- Miniature medal representations with a reviewed mapping: ${totals.miniatureMedals}`,
  `- Full-size medal representations with a reviewed mapping: ${totals.fullSizeMedals}`,
  `- Device types in the local catalog: ${totals.deviceTypes}`,
  `- Awards with explicit repeat support: ${totals.repeatSupport}`,
  `- Awards with explicit special-device support: ${totals.specialDevices}`,
  `- Officially verified canonical award records: ${totals.officiallyVerified}`,
  `- Awards with at least one officially verified device rule: ${totals.officiallyVerifiedDeviceRules}`,
  `- Awards missing explicit device rules: ${totals.missingDeviceRules}`,
  `- Awards missing local ribbon artwork: ${totals.missingRibbon}`,
  `- Awards missing reviewed miniature-medal artwork: ${totals.missingMiniature}`,
  `- Awards missing reviewed full-size-medal artwork: ${totals.missingFullSize}`,'',
  '## Award records','',
  '| Award | Canonical ID | Origin | Services | Ribbon | Mini | Full | Repeat system | Max known count | Special devices | Known combinations | MoA | UltraThin | Official device rule | Missing device asset | Missing placement rule |',
  '|---|---|---|---|---:|---:|---:|---|---|---|---|---:|---:|---:|---:|---:|'
];
for(const award of canonical){
  const reps=award.representations;
  const rules=deviceRules(award);
  const known=['base'];
  if(rules.some(rule=>rule.repeatAward)) known.push('repeat quantity');
  if(specialDevices(award).length) known.push('authorized special');
  const missingDeviceAsset=referencedDevices(award).some(id=>{
    const definition=devices.find(device=>device.id===id);
    return !definition?.asset || !local(definition.asset);
  });
  lines.push(`| ${esc(award.officialName || award.name)} | \`${esc(award.id)}\` | ${esc(award.originatingService || (award.authorizedServices || [])[0] || 'UNKNOWN')} | ${esc((award.authorizedServices || []).join(', '))} | ${yes(local(reps.ribbon.asset))} | ${yes(local(reps.miniatureMedal.asset))} | ${yes(local(reps.fullSizeMedal.asset))} | ${esc(repeatSystems(award) || '—')} | ${esc(award.maximumKnownAwardCount || (rules.length?'not stated':'UNVERIFIED'))} | ${esc(specialDevices(award).join(', ') || '—')} | ${esc(known.join(', '))} | ${yes(commercialFound(award,'medalsofamerica'))} | ${yes(commercialFound(award,'ultrathin'))} | ${yes(rules.some(rule=>rule.verificationStatus==='OFFICIALLY_VERIFIED'))} | ${yes(missingDeviceAsset)} | ${yes(rules.length>0 && !rules.some(rule=>rule.deviceLayout || rule.placement))} |`);
}
lines.push('','## Known limitations','',
  '- Commercial catalog matches are discovery evidence only and do not authorize wear or devices.',
  '- Only explicitly reviewed miniature/full-size military medal mappings are available. All other representations remain unavailable rather than being faked.',
  '- Device-placement verification is still incomplete. Runtime composition uses a deterministic layout, but award/service exceptions require an official-source override before normal-mode use.',
  '- McChord-style conversion status is evaluated separately by `scripts/analyze_mcchord_assets.py`.','');

fs.mkdirSync(path.join(root,'reports'),{recursive:true});
fs.writeFileSync(path.join(root,'reports/military-award-combination-audit.md'),lines.join('\n'));
fs.mkdirSync(path.join(root,'data/military'),{recursive:true});
fs.writeFileSync(path.join(root,'data/military/canonical-awards.json'),JSON.stringify(canonical,null,2)+'\n');
console.log(JSON.stringify(totals,null,2));
