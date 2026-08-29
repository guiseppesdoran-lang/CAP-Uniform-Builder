#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const metalAssets={
  AirCrew1_DB3F0FCC3650F:'images/badges/AirCrew1_DB3F0FCC3650F.png',
  basic_incident_commander_badge:'images/badges/Basic_Incident_Commander_Badge.png',
  buddist_chaplin:'images/badges/buddist_chaplin.png',christian_chaplin:'images/badges/christian_chaplin.png',
  emt_basic_badge:'images/badges/emt_basic_badge.png',emt_intermediate:'images/badges/emt_intermediate.png',emt_paramedic:'images/badges/emt_paramedic.png',
  ground_team_basic_badge:'images/badges/ground_team_basic_badge.png',group_commander_badge:'images/badges/Group_commander_badge.png',
  incident_commander_1_badge:'images/badges/incident_commander_1_badge.png',incident_commander_2_badge:'images/badges/incident_commander_2_badge.png',
  jewish_chaplin:'images/badges/jewish_chaplin.png',legal_officer:'images/badges/Legal_officer.png',master_ground_team_badge:'images/badges/master_ground_team_badge.png',
  MasterAirCrew1_72AC4CAE7A310:'images/badges/MasterAirCrew1_72AC4CAE7A310.png',MasterObserver1_1B88D5071FD5C:'images/badges/MasterObserver1_1B88D5071FD5C.png',
  medical_officer:'images/badges/Medical_officer.png',muslim_chaplin:'images/badges/muslim_chaplin.png',national_staff_badge:'images/badges/national_staff_badge.png',
  nurse_officer:'images/badges/Nurse.png',observer_badge:'images/badges/observer_badge.png',senior_ground_team_badge:'images/badges/senior_ground_team_badge.png',
  SeniorAirCrew1_B289BAE6E515C:'images/badges/SeniorAirCrew1_B289BAE6E515C.png',SeniorObserver1_0E35802A29801:'images/badges/SeniorObserver1_0E35802A29801.png',
  squadron_commander_badge:'images/badges/Squadron Commander badge.png'
};

const records=Object.entries(metalAssets).map(([id,metalAsset])=>{
  const embroideredAsset=`images/badges/utility/${id}.png`;
  for(const asset of [metalAsset,embroideredAsset]){
    if(!fs.existsSync(path.join(root,...asset.split('/')))) throw new Error(`Missing CAP badge asset: ${asset}`);
  }
  return {
    id,
    organization:'CAP',
    representations:{
      metal:{status:'AVAILABLE',available:true,asset:metalAsset,style:'REGULATION_METAL',verificationStatus:'LOCAL_REVIEWED_ASSET'},
      embroidered:{
        status:'AVAILABLE',available:true,asset:embroideredAsset,style:'REGULATION_EMBROIDERED',backingProfile:'CAP_DARK_BLUE',
        borderInches:0.125,verificationStatus:'LOCAL_REVIEWED_ASSET',
        placementRole:id==='national_staff_badge'?'OCP_LEFT_SLEEVE_PATCH':'OCP_CHEST_BADGE'
      }
    }
  };
});
const output={schemaVersion:1,generatedAt:new Date().toISOString(),notes:'CAP badges with both reviewed metal and embroidered counterparts. Specialty-track badges without an authorized utility counterpart are intentionally absent rather than synthesized.',records};
fs.writeFileSync(path.join(root,'data/military/cap-badge-representations.json'),JSON.stringify(output,null,2)+'\n');
console.log(`Wrote ${records.length} CAP metal/embroidered badge pairs.`);
