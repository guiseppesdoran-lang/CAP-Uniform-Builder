'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../military/military-core.js');
const root=path.resolve(__dirname,'..');
const profiles=JSON.parse(fs.readFileSync(path.join(root,'data/military/asset-profiles.json'),'utf8'));

test('device variant keys are deterministic and insensitive to special-device input order',()=>{
  const first=core.canonicalDeviceVariantKey({awardId:'Air Medal',service:'USAF',representation:'ribbon',awardCount:7,specialDevices:['V_DEVICE','C_DEVICE']});
  const second=core.canonicalDeviceVariantKey({awardId:'air_medal',service:'AIR_FORCE',representation:'RIBBON',awardCount:7,specialDevices:['C_DEVICE','V_DEVICE']});
  assert.equal(first,second);
});

test('badge representation resolver selects metal for dress and embroidered for utility uniforms',()=>{
  const badge={representations:{
    metal:{status:'AVAILABLE',available:true,asset:'metal.png'},
    embroidered:{status:'AVAILABLE',available:true,asset:'cloth.png'}
  }};
  assert.equal(core.resolveBadgeRepresentation(badge,{service:'AIR_FORCE',uniformFamily:'SERVICE_DRESS',assetProfiles:profiles}).asset,'metal.png');
  const cloth=core.resolveBadgeRepresentation(badge,{service:'AIR_FORCE',uniformFamily:'OCP',assetProfiles:profiles});
  assert.equal(cloth.asset,'cloth.png');
  assert.equal(cloth.backingProfile,'DAF_SPICE_BROWN_OCP');
});

test('miniature medal profile preserves the McChord 50 by 176 template and suspension split',()=>{
  assert.deepEqual(profiles.awardGeometry.miniatureMedal.canvas,[50,176]);
  assert.equal(profiles.awardGeometry.miniatureMedal.suspensionRibbonHeight,116);
});
