'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname,'..');
const core = require('../military/military-core.js');
const importedAwards = require('../data/import/normalized/military-awards.json');
const officialAdditions = require('../data/military/catalog-additions.json').awards;
const awards = [...importedAwards,...officialAdditions];
const devices = require('../data/rules/verified/device-definitions.json');
const badges = require('../data/military/badges.json').badges;
const officialArmyBadgeImport = require('../data/imports/official_army_badges.json');
const commonsNavyBadgeImport = require('../data/imports/commons_navy_badges.json');

function isSupportedImage(buffer){
  if(buffer.length >= 8 && buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return true;
  if(buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  if(buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0,6).toString('ascii'))) return true;
  if(buffer.length >= 12 && buffer.subarray(0,4).toString('ascii') === 'RIFF' && buffer.subarray(8,12).toString('ascii') === 'WEBP') return true;
  return /^(?:<\?xml[\s\S]*?\?>\s*)?<svg\b/i.test(buffer.toString('utf8',0,Math.min(buffer.length,1024)).trim());
}

test('every available military ribbon has a valid local repository asset', () => {
  const ribbons=awards.filter(award=>award.type === 'RIBBON');
  assert.ok(ribbons.length>0);
  for(const award of ribbons){
    const representation=core.getAwardRepresentation(award,'RIBBON');
    if(representation.status!=='AVAILABLE') continue;
    assert.ok(award.images?.ribbon,`${award.id} is missing images.ribbon`);
    assert.notEqual(award.images?.assetStatus,'SOURCE_ONLY',`${award.id} is still source-only`);
    const absolute=path.join(ROOT,...award.images.ribbon.split('/'));
    assert.ok(fs.existsSync(absolute),`${award.id} local asset does not exist: ${award.images.ribbon}`);
    const buffer=fs.readFileSync(absolute);
    assert.ok(buffer.length>0,`${award.id} local asset is empty`);
    assert.ok(isSupportedImage(buffer),`${award.id} local asset is not a supported image`);
  }
});

test('official awards without artwork remain explicit missing records', () => {
  const cross=awards.find(award=>award.id==='coast_guard_cross');
  assert.ok(cross,'Coast Guard Cross official-source record is missing');
  const representation=core.getAwardRepresentation(cross,'RIBBON');
  assert.equal(representation.status,'MISSING_ASSET');
  assert.equal(representation.available,false);
  assert.equal(representation.asset,null);
});

test('production military device artwork is local transparent PNG geometry',()=>{
  const imageDevices=devices.filter(device=>device.asset);
  assert.ok(imageDevices.length>=14);
  for(const device of imageDevices){
    const absolute=path.join(ROOT,...device.asset.split('/'));
    assert.ok(fs.existsSync(absolute),`${device.id} asset does not exist`);
    const buffer=fs.readFileSync(absolute);
    assert.ok(buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),`${device.id} is not PNG`);
    const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20),colorType=buffer[25];
    assert.equal(width,64,`${device.id} width`);
    assert.equal(height,64,`${device.id} height`);
    assert.ok(colorType===4 || colorType===6,`${device.id} lacks an alpha channel`);
  }
});

test('parametric numeral device sprites cover 2 through 99',()=>{
  for(let value=2;value<=99;value++){
    assert.ok(fs.existsSync(path.join(ROOT,'images','devices','military',`numeral_${value}.png`)),`numeral ${value} missing`);
  }
});

test('required McChord audit and visual QA reports exist',()=>{
  for(const file of [
    'reports/mcchord-asset-analysis.json',
    'reports/mcchord-ribbon-comparison.png',
    'reports/mcchord-mini-medal-comparison.png',
    'reports/military-ribbon-style-review.png',
    'reports/military-mini-medal-style-review.png',
    'reports/military-full-size-medal-style-review.png',
    'reports/military-badge-style-review.png',
    'reports/military-ribbon-device-contact-sheet.png',
    'reports/military-mini-medal-device-contact-sheet.png',
    'reports/military-award-combination-audit.md'
  ]) assert.ok(fs.existsSync(path.join(ROOT,...file.split('/'))),`${file} missing`);
});

test('UltraThin remains a discovery-only source with no runtime artwork dependency',()=>{
  const manifest=require('../data/imports/ultrathin_ribbon_reference_manifest.json');
  assert.equal(manifest.runtimeDependency,false);
  assert.equal(manifest.regulatoryAuthority,false);
  assert.equal(manifest.assetPolicy,'NO_EXTERNAL_ARTWORK_PACKAGED');
  assert.ok(manifest.counts.ribbons>=300,'expected the public UltraThin discovery catalog');
  assert.ok(manifest.counts.devices>=80,'expected the public UltraThin device discovery catalog');
  assert.ok(manifest.ribbons.some(record=>record.name==='Medal of Honor'));
  assert.ok(manifest.ribbons.every(record=>!('asset' in record)));
});

test('every available military ribbon uses the generated McChord-style canvas',()=>{
  const canonical=require('../data/military/canonical-awards.json');
  for(const award of canonical){
    const ribbon=award.representations?.ribbon;
    if(ribbon?.status!=='AVAILABLE') continue;
    assert.match(ribbon.asset,/^images\/military-ribbons\/mcchord-style\/.+\.png$/,`${award.id} is not mapped to the McChord-style collection`);
    const buffer=fs.readFileSync(path.join(ROOT,...ribbon.asset.split('/')));
    assert.ok(buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),`${award.id} is not PNG`);
    assert.equal(buffer.readUInt32BE(16),100,`${award.id} width`);
    assert.equal(buffer.readUInt32BE(20),30,`${award.id} height`);
  }
});

test('every Army-authorized badge has reviewed local transparent artwork',()=>{
  const armyBadges=badges.filter(badge=>(badge.authorizedServices || []).includes('ARMY'));
  assert.equal(armyBadges.length,32,'unexpected Army badge catalog size');
  for(const badge of armyBadges){
    const metal=badge.representations?.metal;
    assert.equal(metal?.status,'AVAILABLE',`${badge.id} metal artwork status`);
    assert.equal(metal?.verificationStatus,'OFFICIALLY_VERIFIED',`${badge.id} verification status`);
    const records=[metal,...Object.values(metal.variants || {})].filter(record=>record?.asset);
    assert.ok(records.length,`${badge.id} has no local artwork records`);
    for(const record of records){
      const absolute=path.join(ROOT,...record.asset.split('/'));
      assert.ok(fs.existsSync(absolute),`${badge.id} asset does not exist: ${record.asset}`);
      const buffer=fs.readFileSync(absolute);
      assert.ok(buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),`${badge.id} is not PNG`);
      assert.equal(buffer.readUInt32BE(16),256,`${badge.id} width`);
      assert.equal(buffer.readUInt32BE(20),160,`${badge.id} height`);
      assert.ok([4,6].includes(buffer[25]),`${badge.id} lacks an alpha channel`);
    }
  }
});

test('Army Aviator variants use distinct reviewed artwork',()=>{
  const aviator=badges.find(badge=>badge.id==='army_aviator_badge');
  assert.deepEqual(aviator.variants,['basic','senior','master']);
  const assets=aviator.variants.map(variant=>aviator.representations.metal.variants[variant].asset);
  assert.equal(new Set(assets).size,3);
});

test('official Army badge import manifest is complete',()=>{
  assert.equal(officialArmyBadgeImport.source,'https://www.army.mil/uniforms/');
  assert.equal(new Set(officialArmyBadgeImport.imported.map(record=>record.badgeId)).size,32);
  assert.equal(officialArmyBadgeImport.imported.length,60);
  assert.deepEqual(officialArmyBadgeImport.missing,[]);
});

test('Air Force badge checkpoint uses normalized local digital artwork',()=>{
  const manifest=require('../data/imports/vanguard_air_force_badges.json');
  assert.equal(manifest.sourceType,'COMMERCIAL_CATALOG_DISCOVERY_REFERENCE');
  assert.equal(manifest.style.name,'MCCHORD_DIGITAL_SILVER');
  assert.equal(manifest.imported.length,171);
  assert.equal(new Set(manifest.imported.map(record=>record.badgeId)).size,63);
  assert.ok(manifest.imported.every(record=>record.asset&&!record.asset.startsWith('http')));
  for(const record of manifest.imported){
    const absolute=path.join(ROOT,...record.asset.split('/'));
    assert.ok(fs.existsSync(absolute),`${record.badgeId}:${record.variant} asset missing`);
    const buffer=fs.readFileSync(absolute);
    assert.ok(buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),`${record.badgeId}:${record.variant} is not PNG`);
    assert.equal(buffer.readUInt32BE(16),320,`${record.badgeId}:${record.variant} width`);
    assert.equal(buffer.readUInt32BE(20),180,`${record.badgeId}:${record.variant} height`);
    assert.ok([4,6].includes(buffer[25]),`${record.badgeId}:${record.variant} lacks alpha`);
    const badge=badges.find(candidate=>candidate.id===record.badgeId);
    const representation=badge?.representations?.metal?.variants?.[record.variant];
    assert.equal(representation?.asset,record.asset,`${record.badgeId}:${record.variant} catalog mapping`);
    assert.equal(representation?.style,'MCCHORD_DIGITAL_SILVER');
  }
});

test('Air Force miniature-medal checkpoint uses reviewed local McChord geometry',()=>{
  const manifest=require('../data/imports/vanguard_air_force_mini_medals.json');
  const overrides=require('../data/rules/verified/representation-overrides.json').awards;
  assert.equal(manifest.sourceType,'COMMERCIAL_CATALOG_DISCOVERY_REFERENCE');
  assert.equal(manifest.style,'MCCHORD_DIGITAL_MEDAL');
  assert.deepEqual(manifest.canvas,[50,176]);
  assert.ok(manifest.imported.length>=50,'expected the expanded Air Force miniature-medal checkpoint');
  assert.equal(new Set(manifest.imported.map(record=>record.awardId)).size,manifest.imported.length);
  for(const record of manifest.imported){
    assert.match(record.asset,/^images\/military-mini-medals\/air-force\/.+\.png$/);
    const absolute=path.join(ROOT,...record.asset.split('/'));
    assert.ok(fs.existsSync(absolute),`${record.awardId} miniature medal missing`);
    const buffer=fs.readFileSync(absolute);
    assert.ok(buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),`${record.awardId} is not PNG`);
    assert.equal(buffer.readUInt32BE(16),50,`${record.awardId} width`);
    assert.equal(buffer.readUInt32BE(20),176,`${record.awardId} height`);
    assert.ok([4,6].includes(buffer[25]),`${record.awardId} lacks alpha`);
    const resolved=overrides[record.awardId]?.miniatureMedal;
    if(resolved?.status==='NOT_APPLICABLE'){
      assert.equal(resolved.asset,null,`${record.awardId} ribbon-only override`);
      continue;
    }
    assert.equal(resolved?.asset,record.asset,`${record.awardId} override mapping`);
    assert.equal(resolved?.style,'MCCHORD_DIGITAL_MEDAL');
  }
});

test('Air Force full-size medal checkpoint uses separate reviewed local artwork',()=>{
  const manifest=require('../data/imports/vanguard_air_force_full_size_medals.json');
  const overrides=require('../data/rules/verified/representation-overrides.json').awards;
  assert.equal(manifest.sourceType,'COMMERCIAL_CATALOG_DISCOVERY_REFERENCE');
  assert.equal(manifest.style,'MCCHORD_DIGITAL_MEDAL');
  assert.deepEqual(manifest.canvas,[100,220]);
  assert.ok(manifest.imported.length>=50,'expected the first full-size Air Force medal checkpoint');
  assert.equal(manifest.failed.length,0,'catalog image failures must remain audited');
  for(const record of manifest.imported){
    assert.match(record.asset,/^images\/military-full-size-medals\/air-force\/.+\.png$/);
    const absolute=path.join(ROOT,...record.asset.split('/'));
    assert.ok(fs.existsSync(absolute),`${record.awardId} full-size medal missing`);
    const buffer=fs.readFileSync(absolute);
    assert.equal(buffer.readUInt32BE(16),100,`${record.awardId} width`);
    assert.equal(buffer.readUInt32BE(20),220,`${record.awardId} height`);
    assert.ok([4,6].includes(buffer[25]),`${record.awardId} lacks alpha`);
    const resolved=overrides[record.awardId]?.fullSizeMedal;
    if(resolved?.status==='NOT_APPLICABLE'){
      assert.equal(resolved.asset,null,`${record.awardId} ribbon-only override`);
      continue;
    }
    assert.equal(resolved?.asset,record.asset,`${record.awardId} full-size mapping`);
  }
});

test('Air Force and Space Force utility badge counterparts use the regulation OCP backing profile',()=>{
  const candidates=badges.filter(badge=>
    (badge.authorizedServices || []).some(service=>['AIR_FORCE','SPACE_FORCE'].includes(service)) &&
    badge.representations?.embroidered?.status==='AVAILABLE'
  );
  assert.ok(candidates.length >= 20,'expected a substantial DAF embroidered badge checkpoint');
  for(const badge of candidates){
    const rep=badge.representations.embroidered.byService?.AIR_FORCE || badge.representations.embroidered.byService?.SPACE_FORCE || badge.representations.embroidered;
    assert.equal(rep.backingProfile,'DAF_SPICE_BROWN_OCP',badge.id);
    assert.equal(rep.style,'REGULATION_EMBROIDERED',badge.id);
    assert.ok(fs.existsSync(path.join(ROOT,rep.asset)),badge.id);
  }
});

test('military medal import manifests record split suspension and pendant geometry',()=>{
  for(const file of ['data/imports/vanguard_air_force_mini_medals.json','data/imports/vanguard_air_force_full_size_medals.json']){
    const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
    assert.match(manifest.geometryPolicy,/never stretched as one image/i,file);
    assert.ok(Number.isFinite(manifest.suspensionRibbonHeight),file);
  }
});

test('Army utility badge counterparts use the Army black OCP profile',()=>{
  const candidates=badges.map(badge=>badge.representations?.embroidered?.byService?.ARMY).filter(Boolean);
  assert.ok(candidates.length >= 10,'expected reviewed Army cloth counterparts');
  for(const rep of candidates){
    assert.equal(rep.backingProfile,'ARMY_BLACK_OCP');
    assert.equal(rep.style,'REGULATION_EMBROIDERED');
    assert.ok(fs.existsSync(path.join(ROOT,rep.asset)));
  }
});

test('Army medal checkpoint preserves split medal geometry',()=>{
  for(const representation of ['miniatureMedal','fullSizeMedal']){
    const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,`data/imports/vanguard_army_${representation}.json`),'utf8'));
    assert.ok(manifest.imported.length > 0,representation);
    assert.match(manifest.geometryPolicy,/never stretched as one image/i);
    for(const record of manifest.imported) assert.ok(fs.existsSync(path.join(ROOT,record.asset)),record.awardId);
  }
});

test('naval service medal checkpoints preserve split geometry and local assets',()=>{
  for(const service of ['navy','marine_corps','coast_guard']){
    for(const representation of ['miniatureMedal','fullSizeMedal']){
      const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,`data/imports/vanguard_${service}_${representation}.json`),'utf8'));
      assert.ok(manifest.imported.length > 0,`${service} ${representation}`);
      assert.match(manifest.geometryPolicy,/never stretched as one image/i);
      for(const record of manifest.imported) assert.ok(fs.existsSync(path.join(ROOT,record.asset)),record.awardId);
    }
  }
});

test('Navy and Marine utility badge counterparts retain distinct regulated backings',()=>{
  const expected={NAVY:'NAVAL_BLACK_NWU_III',MARINE_CORPS:'MARINE_BLACK_MARPAT'};
  for(const [service,profile] of Object.entries(expected)){
    const records=badges.map(badge=>badge.representations?.embroidered?.byService?.[service]).filter(Boolean);
    assert.ok(records.length > 0,service);
    for(const rep of records){
      assert.equal(rep.backingProfile,profile);
      assert.ok(fs.existsSync(path.join(ROOT,rep.asset)));
    }
  }
});

test('reviewed naval-service artwork copies preserve official and asset provenance',()=>{
  assert.ok(commonsNavyBadgeImport.imported.length>=14,'expected the reviewed Navy artwork checkpoint');
  for(const record of commonsNavyBadgeImport.imported){
    assert.match(record.asset,/^images\/military-badges\/(?:navy|marine-corps)\/.+\.png$/);
    assert.ok(record.descriptionUrl?.startsWith('https://commons.wikimedia.org/'));
    const absolute=path.join(ROOT,...record.asset.split('/'));
    assert.ok(fs.existsSync(absolute),`${record.badgeId}:${record.variant} asset missing`);
    const buffer=fs.readFileSync(absolute);
    assert.equal(buffer.readUInt32BE(16),256,`${record.badgeId}:${record.variant} width`);
    assert.equal(buffer.readUInt32BE(20),160,`${record.badgeId}:${record.variant} height`);
    assert.ok([4,6].includes(buffer[25]),`${record.badgeId}:${record.variant} lacks alpha`);
  }
  assert.ok(fs.existsSync(path.join(ROOT,'reports','navy-badge-style-review.png')));
  assert.ok(fs.existsSync(path.join(ROOT,'reports','marine-corps-badge-style-review.png')));
  const marineImports=commonsNavyBadgeImport.imported.filter(record=>record.badgeId.startsWith('marine_corps_'));
  assert.ok(marineImports.length>=2,'expected reviewed Marine Corps artwork copies');
});

test('Navy and Marine Corps parachutist variants use reviewed local artwork',()=>{
  const badge=badges.find(record=>record.id==='navy_parachutist_insignia');
  const variants=badge?.representations?.metal?.variants||{};
  assert.equal(variants.navy_marine_corps_parachutist?.status,'AVAILABLE');
  assert.equal(variants.basic_parachutist?.status,'AVAILABLE');
  for(const variant of Object.values(variants)){
    const absolute=path.join(ROOT,...variant.asset.split('/'));
    assert.ok(fs.existsSync(absolute),`${variant.asset} missing`);
  }
});

test('ribbon-only awards cannot resolve to miniature or full-size medals',()=>{
  const applicability=require('../data/rules/verified/medal-representation-applicability.json');
  const overrides=require('../data/rules/verified/representation-overrides.json').awards;
  assert.ok(applicability.ribbonOnlyAwardIds.length >= 50,'expected a substantive explicit ribbon-only classification');
  for(const awardId of applicability.ribbonOnlyAwardIds){
    for(const representation of ['miniatureMedal','fullSizeMedal']){
      const record=overrides[awardId]?.[representation];
      assert.equal(record?.status,'NOT_APPLICABLE',`${awardId}:${representation}`);
      assert.equal(record?.asset,null,`${awardId}:${representation}`);
      assert.equal(record?.verificationStatus,'OFFICIALLY_CLASSIFIED_RIBBON_ONLY',`${awardId}:${representation}`);
    }
  }
});

test('combat action and unit awards remain ribbon-only even when catalog artwork resembles a medal',()=>{
  const overrides=require('../data/rules/verified/representation-overrides.json').awards;
  for(const awardId of ['combat_action','air_force_combat_action','joint_meritorious_unit_award','navy_unit_commendation']){
    assert.equal(overrides[awardId].miniatureMedal.status,'NOT_APPLICABLE',awardId);
    assert.equal(overrides[awardId].fullSizeMedal.status,'NOT_APPLICABLE',awardId);
  }
});

test('reviewed CAP fabric badges have a dress counterpart and regulation blue backing metadata',()=>{
  const manifest=require('../data/military/cap-badge-representations.json');
  assert.ok(manifest.records.length >= 25,'expected reviewed CAP metal/fabric pairs');
  for(const badge of manifest.records){
    assert.equal(badge.organization,'CAP',badge.id);
    assert.equal(badge.representations.metal.status,'AVAILABLE',badge.id);
    assert.equal(badge.representations.embroidered.status,'AVAILABLE',badge.id);
    assert.equal(badge.representations.embroidered.backingProfile,'CAP_DARK_BLUE',badge.id);
    assert.equal(badge.representations.embroidered.borderInches,0.125,badge.id);
    assert.ok(fs.existsSync(path.join(ROOT,...badge.representations.metal.asset.split('/'))),`${badge.id}:metal`);
    assert.ok(fs.existsSync(path.join(ROOT,...badge.representations.embroidered.asset.split('/'))),`${badge.id}:embroidered`);
  }
  const nationalStaff=manifest.records.find(record=>record.id==='national_staff_badge');
  assert.equal(nationalStaff.representations.embroidered.placementRole,'OCP_LEFT_SLEEVE_PATCH');
});

test('service medal provenance manifests never reintroduce ribbon-only awards',()=>{
  const ribbonOnly=new Set(require('../data/rules/verified/medal-representation-applicability.json').ribbonOnlyAwardIds);
  const manifests=fs.readdirSync(path.join(ROOT,'data','imports')).filter(name=>/^vanguard_.*(?:mini|full).*medal/i.test(name));
  assert.ok(manifests.length >= 10,'expected service medal provenance manifests');
  for(const name of manifests){
    const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'data','imports',name),'utf8'));
    for(const record of manifest.imported || []) assert.ok(!ribbonOnly.has(record.awardId),`${name}:${record.awardId}`);
  }
});

test('Space Force checkpoint uses distinct local McChord-style medal canvases',()=>{
  const overrides=require('../data/rules/verified/representation-overrides.json').awards;
  const award=overrides.space_force_good_conduct_medal;
  for(const [representation,width,height] of [['miniatureMedal',50,176],['fullSizeMedal',100,220]]){
    const record=award[representation];
    assert.equal(record.status,'AVAILABLE',representation);
    assert.match(record.asset,/\/space-force\//,representation);
    const buffer=fs.readFileSync(path.join(ROOT,...record.asset.split('/')));
    assert.equal(buffer.readUInt32BE(16),width,representation);
    assert.equal(buffer.readUInt32BE(20),height,representation);
  }
});

test('complete asset manifest contains no broken AVAILABLE records',()=>{
  const manifest=require('../data/military/asset-manifest.json');
  const broken=manifest.assets.filter(record=>record.status==='AVAILABLE'&&!record.exists);
  assert.deepEqual(broken,[]);
});

test('curated service-title aliases fill only the reviewed canonical medal records',()=>{
  const overrides=require('../data/rules/verified/representation-overrides.json').awards;
  const expected={
    reserve_componets_achievement:['miniatureMedal','fullSizeMedal'],
    army_of_occupation:['miniatureMedal','fullSizeMedal'],
    womens_s_army_corps_service:['fullSizeMedal'],
    china_service:['miniatureMedal','fullSizeMedal'],
    navy_occupation_service:['miniatureMedal','fullSizeMedal'],
    coast_guard_medal:['miniatureMedal','fullSizeMedal'],
    united_nations:['miniatureMedal','fullSizeMedal'],
    rok_war_service:['fullSizeMedal']
  };
  for(const [awardId,representations] of Object.entries(expected)){
    for(const representation of representations){
      const record=overrides[awardId]?.[representation];
      assert.equal(record?.status,'AVAILABLE',`${awardId}:${representation}`);
      assert.equal(record?.style,'MCCHORD_DIGITAL_MEDAL',`${awardId}:${representation}`);
      assert.ok(fs.existsSync(path.join(ROOT,...record.asset.split('/'))),`${awardId}:${representation}`);
    }
  }
});
