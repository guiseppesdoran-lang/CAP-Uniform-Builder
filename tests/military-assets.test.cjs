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

test('reviewed Navy artwork copies preserve official and asset provenance',()=>{
  assert.ok(commonsNavyBadgeImport.imported.length>=14,'expected the reviewed Navy artwork checkpoint');
  for(const record of commonsNavyBadgeImport.imported){
    assert.match(record.asset,/^images\/military-badges\/navy\/.+\.png$/);
    assert.ok(record.descriptionUrl?.startsWith('https://commons.wikimedia.org/'));
    const absolute=path.join(ROOT,...record.asset.split('/'));
    assert.ok(fs.existsSync(absolute),`${record.badgeId}:${record.variant} asset missing`);
    const buffer=fs.readFileSync(absolute);
    assert.equal(buffer.readUInt32BE(16),256,`${record.badgeId}:${record.variant} width`);
    assert.equal(buffer.readUInt32BE(20),160,`${record.badgeId}:${record.variant} height`);
    assert.ok([4,6].includes(buffer[25]),`${record.badgeId}:${record.variant} lacks alpha`);
  }
  assert.ok(fs.existsSync(path.join(ROOT,'reports','navy-badge-style-review.png')));
});
