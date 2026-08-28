'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../military/military-core.js');

function award(id, name, services, precedence, category='SERVICE'){
  return {
    id, name, officialName:name, awardClass:'FEDERAL_MILITARY', category,
    authorizedServices:services, precedence, devices:{}, sources:{catalog:['https://example.invalid']}
  };
}

const allServices = ['ARMY','MARINE_CORPS','NAVY','AIR_FORCE','SPACE_FORCE','COAST_GUARD'];

for(const service of allServices){
  test(`${service} sorting uses the selected service table`, () => {
    const high=award('high', 'High', [service], {[service]:{order:2,side:'LEFT',verified:true}});
    const low=award('low', 'Low', [service], {[service]:{order:9,side:'LEFT',verified:true}});
    assert.deepEqual(core.sortAwardsForMember([low,high],{organization:service}).map(x=>x.id),['high','low']);
  });
}

test('joint precedence can outrank service-equivalent decoration', () => {
  const joint=award('joint','Joint Service Commendation Medal',['ARMY'],{ARMY:{order:30,side:'LEFT'}});
  const service=award('army','Army Commendation Medal',['ARMY'],{ARMY:{order:31,side:'LEFT'}});
  assert.deepEqual(core.sortAwardsForMember([service,joint],{organization:'ARMY'}).map(x=>x.id),['joint','army']);
});

test('same-level interservice awards follow the wearer service table', () => {
  const navy=award('navy','Navy and Marine Corps Commendation Medal',['NAVY','MARINE_CORPS'],{NAVY:{order:20},MARINE_CORPS:{order:20}});
  const army=award('army','Army Commendation Medal',['ARMY','NAVY'],{NAVY:{order:21}});
  assert.deepEqual(core.sortAwardsForMember([army,navy],{organization:'NAVY'}).map(x=>x.id),['navy','army']);
});

test('right-breast Army unit awards remain on the right side', () => {
  const left=award('left','Campaign Medal',['ARMY'],{ARMY:{order:90,side:'LEFT'}},'CAMPAIGN');
  const right=award('right','Army Unit Award',['ARMY'],{ARMY:{order:1,side:'RIGHT'}},'UNIT_AWARD');
  assert.equal(core.getAwardPrecedence(right,{organization:'ARMY'}).side,'RIGHT');
  assert.deepEqual(core.sortAwardsForMember([right,left],{organization:'ARMY'}).map(x=>x.id),['left','right']);
});

test('campaign and foreign categories are deterministic when source order is unknown', () => {
  const foreign=award('foreign','Foreign Medal',['AIR_FORCE'],{},'FOREIGN_DECORATION');
  const campaign=award('campaign','Campaign Medal',['AIR_FORCE'],{},'CAMPAIGN');
  assert.deepEqual(core.sortAwardsForMember([foreign,campaign],{organization:'AIR_FORCE'}).map(x=>x.id),['campaign','foreign']);
});

test('every Medal of Honor variant outranks lower decorations even with an incomplete service table', () => {
  const moh=award('coast_guard_medal_of_honor','Medal of Honor',['COAST_GUARD'],{},'UNKNOWN');
  const cross=award('air_force_cross','Air Force Cross',['AIR_FORCE'],{AIR_FORCE:{order:1}},'UNKNOWN');
  const sorted=core.sortAwardsForMember([cross,moh],{organization:'AIR_FORCE'});
  assert.deepEqual(sorted.map(item=>item.id),['coast_guard_medal_of_honor','air_force_cross']);
  assert.equal(core.inferredCategory(moh),'MEDAL_OF_HONOR');
});

test('military repeat award devices are service-specific', () => {
  const sample=award('sample','Sample',['AIR_FORCE','NAVY'],{});
  sample.devices={
    AIR_FORCE:{repeatAward:{bronzeDevice:'BRONZE_OLC',silverDevice:'SILVER_OLC'}},
    NAVY:{repeatAward:{bronzeDevice:'GOLD_AWARD_STAR',silverDevice:'SILVER_AWARD_STAR'}}
  };
  assert.deepEqual(core.calculateDevices({award:sample,service:'AIR_FORCE',awardCount:7}).devices,['SILVER_OLC','BRONZE_OLC']);
  assert.deepEqual(core.calculateDevices({award:sample,service:'NAVY',awardCount:7}).devices,['SILVER_AWARD_STAR','GOLD_AWARD_STAR']);
});

test('repeat-award conversion remains correct through practical high quantities', () => {
  const sample=award('repeat','Repeat Medal',['AIR_FORCE'],{});
  sample.devices={AIR_FORCE:{repeatAward:{bronzeDevice:'BRONZE_OLC',silverDevice:'SILVER_OLC',bronzeValue:1,silverValue:5}}};
  for(const quantity of [1,2,3,4,5,6,7,8,9,10,11,15,20,25]){
    const result=core.calculateDevices({award:sample,service:'AIR_FORCE',awardCount:quantity});
    const represented=result.devices.reduce((sum,id)=>sum+(id==='SILVER_OLC'?5:1),0);
    assert.equal(represented,quantity-1,`quantity ${quantity}`);
    assert.equal(result.valid,true,`quantity ${quantity}`);
  }
});

test('invalid special device combinations are rejected', () => {
  const sample=award('sample','Sample',['ARMY'],{});
  sample.devices={ARMY:{repeatAward:{bronzeDevice:'BRONZE_OLC'},allowedSpecialDevices:['V_DEVICE']}};
  const result=core.calculateDevices({award:sample,service:'ARMY',specialAuthorizations:['C_DEVICE']});
  assert.equal(result.valid,false);
  assert.match(result.warnings.join(' '),/not authorized/);
});

test('explicit M and hourglass rules accept only their configured devices', () => {
  const sample=award('reserve','Reserve Medal',['ARMY'],{});
  sample.devices={ARMY:{allowedSpecialDevices:['M_DEVICE','BRONZE_HOURGLASS','SILVER_HOURGLASS','GOLD_HOURGLASS']}};
  const result=core.calculateDevices({
    award:sample,service:'ARMY',awardCount:1,
    specialAuthorizations:['M_DEVICE','SILVER_HOURGLASS']
  });
  assert.deepEqual(result.devices,['M_DEVICE','SILVER_HOURGLASS']);
  assert.equal(result.valid,true);
});

test('numerals are available only through clearly unverified manual mode', () => {
  const sample=award('numeral_award','Numeral Award',['ARMY'],{});
  const denied=core.calculateDevices({award:sample,service:'ARMY',manualDevices:['NUMERAL_15']});
  assert.deepEqual(denied.devices,[]);
  const manual=core.calculateDevices({award:sample,service:'ARMY',manualDevices:['NUMERAL_15'],allowUnverifiedRules:true});
  assert.deepEqual(manual.devices,['NUMERAL_15']);
  assert.equal(manual.valid,false);
  assert.match(manual.warnings.join(' '),/MANUAL \/ UNVERIFIED/);
});

test('duplicate catalog listings merge into one canonical award', () => {
  const merged=core.mergeAwardRecords([
    {name:'Bronze Star Medal',sourceName:'Bronze Star',authorizedServices:['ARMY'],sourceUrl:'https://example.invalid/army'},
    {name:'Bronze Star Medal',authorizedServices:['NAVY'],sourceUrl:'https://example.invalid/navy'}
  ]);
  assert.equal(merged.length,1);
  assert.deepEqual(merged[0].authorizedServices,['ARMY','NAVY']);
  assert.equal(merged[0].sources.catalog.length,2);
});

test('canonical catalog collapses branch copies of the Medal of Honor', () => {
  const canonical=core.canonicalizeAwards([
    award('air_force_medal_of_honor','Medal of Honor',['AIR_FORCE'],{AIR_FORCE:{order:0}}),
    award('army_medal_of_honor','Medal of Honor',['ARMY'],{ARMY:{order:0}}),
    award('medal_of_honor','Medal of Honor',['NAVY','MARINE_CORPS'],{NAVY:{order:0}})
  ]);
  assert.equal(canonical.length,1);
  assert.equal(canonical[0].id,'medal_of_honor');
  assert.deepEqual(canonical[0].authorizedServices,['AIR_FORCE','ARMY','NAVY','MARINE_CORPS']);
  assert.equal(canonical[0].sourceIds.length,3);
});

test('universal precedence keeps Medal of Honor above every service cross', () => {
  const moh=award('medal_of_honor','Medal of Honor',['ARMY','NAVY'],{},'UNKNOWN');
  const cross=award('air_force_cross','Air Force Cross',['AIR_FORCE'],{AIR_FORCE:{order:1}},'UNKNOWN');
  assert.deepEqual([cross,moh].sort(core.compareAwardsUniversal).map(item=>item.id),['medal_of_honor','air_force_cross']);
});

test('inferred repeat devices follow Army/Air Force and naval conventions', () => {
  const decoration=award('sample_commendation','Sample Commendation Medal',['AIR_FORCE','NAVY'],{},'UNKNOWN');
  assert.deepEqual(core.calculateDevices({award:decoration,service:'AIR_FORCE',awardCount:7,allowUnverifiedRules:true}).devices,['SILVER_OLC','BRONZE_OLC']);
  assert.deepEqual(core.calculateDevices({award:decoration,service:'NAVY',awardCount:7,allowUnverifiedRules:true}).devices,['SILVER_AWARD_STAR','GOLD_AWARD_STAR']);
});

test('campaign participation uses bronze and silver service stars', () => {
  const campaign=award('sample_campaign','Sample Campaign Medal',['ARMY'],{},'CAMPAIGN');
  assert.deepEqual(core.calculateDevices({award:campaign,service:'ARMY',awardCount:7,allowUnverifiedRules:true}).devices,['SILVER_SERVICE_STAR','BRONZE_SERVICE_STAR']);
});

test('normal mode never guesses a missing award-specific device rule', () => {
  const decoration=award('unknown_commendation','Unknown Commendation Medal',['AIR_FORCE'],{},'COMMENDATION');
  const result=core.calculateDevices({award:decoration,service:'AIR_FORCE',awardCount:2});
  assert.equal(result.valid,false);
  assert.deepEqual(result.devices,[]);
  assert.match(result.warnings.join(' '),/No repeat-award device rule/);
});

test('one canonical selection preserves quantity and devices across representations', () => {
  const selected=core.createAwardSelection('bronze_star_medal',{quantity:7,specialDevices:['V_DEVICE']});
  const canonical={
    id:'bronze_star_medal',
    representations:{
      ribbon:{available:true,asset:'ribbon.png'},
      miniatureMedal:{available:true,asset:'mini.png'},
      fullSizeMedal:{available:false}
    }
  };
  assert.equal(selected.quantity,7);
  assert.deepEqual(selected.specialDevices,['V_DEVICE']);
  assert.equal(core.getAwardRepresentation(canonical,'RIBBON').asset,'ribbon.png');
  assert.equal(core.getAwardRepresentation(canonical,'MINIATURE_MEDAL').asset,'mini.png');
  assert.equal(core.getAwardRepresentation(canonical,'FULL_SIZE_MEDAL').available,false);
});

test('canonicalization preserves reviewed medal representations from source records', () => {
  const canonical=core.canonicalizeAwards([{
    id:'aerial_achievement', name:'Aerial Achievement Medal', authorizedServices:['AIR_FORCE'],
    representations:{miniatureMedal:{available:true,asset:'images/mini.png'}}
  }]);
  assert.equal(canonical[0].id,'aerial_achievement_medal');
  assert.equal(core.getAwardRepresentation(canonical[0],'MINIATURE_MEDAL').asset,'images/mini.png');
});

test('legacy ribbon-only assets do not create fake miniature medals', () => {
  const canonical={id:'training_ribbon',images:{ribbon:'training.png'}};
  const representations=core.normalizeRepresentations(canonical);
  assert.equal(representations.ribbon.available,true);
  assert.equal(representations.miniatureMedal.available,false);
  assert.equal(representations.fullSizeMedal.available,false);
});

test('CAP authorization stays independent of Air Force authorization', () => {
  const cap=award('cap','CAP Ribbon',['CAP'],{CAP:{order:1}});
  cap.awardClass='CAP';
  assert.equal(core.isAuthorizedForService(cap,'CAP'),true);
  assert.equal(core.isAuthorizedForService(cap,'AIR_FORCE'),false);
});

test('military ribbons remain selectable regardless of source branch', () => {
  const army=award('army','Army Service Ribbon',['ARMY'],{ARMY:{order:80}});
  const navy=award('navy','Navy Sea Service Deployment Ribbon',['NAVY'],{NAVY:{order:80}});
  for(const service of allServices){
    assert.equal(core.isAuthorizedForService(army,service),true,`${service} should see Army ribbons`);
    assert.equal(core.isAuthorizedForService(navy,service),true,`${service} should see Navy ribbons`);
  }
});

test('CAP-category ribbons never appear in a military branch catalog', () => {
  const cap=award('cap','CAP Achievement Award',['CAP'],{CAP:{order:10}},'CAP');
  cap.awardClass='CAP';
  assert.equal(core.isAuthorizedForService(cap,'CAP'),true);
  for(const service of allServices){
    assert.equal(core.isAuthorizedForService(cap,service),false);
  }
});

test('catalog validator reports duplicate ids and missing metadata', () => {
  const bad={id:'x',name:'X',authorizedServices:[],precedence:{},sources:{catalog:[]}};
  const result=core.validateCatalog({awards:[bad,bad],devices:[]});
  assert.equal(result.valid,false);
  assert.ok(result.errors.some(x=>x.includes('Duplicate award id')));
  assert.ok(result.warnings.some(x=>x.includes('missing service authorization')));
});
