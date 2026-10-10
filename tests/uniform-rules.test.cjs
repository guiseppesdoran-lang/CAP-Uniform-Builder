'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rules=require('../data/uniform-rules.js');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

test('every sidebar uniform has a rule and agrees with it on who may wear it',()=>{
  const buttons=[...html.matchAll(/data-uniform-id="([^"]+)"\s+data-allowed-for="([^"]+)"/g)];
  assert.ok(buttons.length>=10,'found the uniform buttons');
  for(const [,id,allowed] of buttons){
    assert.ok(rules.getUniformRule(id),`${id} has a rule`);
    assert.deepEqual(rules.allowedMemberships(id),allowed.split(',').map(s=>s.trim()),`${id} membership`);
  }
  assert.equal(buttons.length,Object.keys(rules.RULES).length,'no rule without a button');
});

test('ribbons: required on Class A, optional on Class B and Aviator, none elsewhere (39-1 11.1.2, 11.1.3)',()=>{
  assert.equal(rules.ribbonPolicy('blues_a'),'required');
  assert.equal(rules.ribbonPolicy('blues_b'),'optional');
  assert.equal(rules.ribbonPolicy('aviator'),'optional');
  for(const id of ['aviator_blazer','corporate_field','abu','ocp','flight_suit','polo','mess_dress','semi_formal']){
    assert.equal(rules.ribbonPolicy(id),'none',id);
    assert.equal(rules.allowsRibbons(id),false,id);
  }
});

test('Corporate Service Dress and the Corporate Field Uniform wear no ribbons or medals (39-1 11.1.3)',()=>{
  for(const id of ['aviator_blazer','corporate_field']){
    assert.equal(rules.allowsRibbons(id),false,id);
    assert.equal(rules.allowsMiniMedals(id),false,id);
  }
});

test('miniature medals only on Mess Dress and Corporate Semi-Formal (39-1 11.1.4)',()=>{
  const withMini=Object.keys(rules.RULES).filter(id=>rules.allowsMiniMedals(id)).sort();
  assert.deepEqual(withMini,['mess_dress','semi_formal']);
});

test('four-across ribbon rows are only authorized on Class A (39-1 11.2.7)',()=>{
  const four=Object.keys(rules.RULES).filter(id=>rules.allowsRackColumns(id,4));
  assert.deepEqual(four,['blues_a']);
  assert.equal(rules.allowsRackColumns('blues_b',3),true);
  assert.equal(rules.allowsRackColumns('aviator',3),true);
});

test('U.S. military awards and the AF Organizational Excellence Award stay off Corporate-style uniforms (39-1 11.1.6, 11.2.3)',()=>{
  for(const id of Object.keys(rules.RULES)){
    const corporate=rules.getUniformRule(id).style==='corporate';
    assert.equal(rules.isAwardAllowedOnUniform('x',id,{isMilitary:true}),!corporate,id);
    assert.equal(rules.isAwardAllowedOnUniform('Air_Force_Organizational_Excellence_Award',id),!corporate,id);
  }
  assert.equal(rules.isAwardAllowedOnUniform('silver_medal_of_valor','aviator'),true,'CAP awards are not restricted');
  assert.equal(rules.isAwardAllowedOnUniform('x','blues_a',{isMilitary:true}),true);
  assert.equal(rules.isAwardAllowedOnUniform('x','aviator',{isMilitary:true}),false);
});

test('minimum uniforms are Class B and the Aviator Shirt (39-1 1.2.2, 1.2.3)',()=>{
  const minimum=Object.keys(rules.RULES).filter(id=>rules.RULES[id].minimum).sort();
  assert.deepEqual(minimum,['aviator','blues_b']);
});

test('Mess Dress is for adult officers and NCOs only (39-1 4.1.1)',()=>{
  assert.equal(rules.isUniformAllowedFor('mess_dress','cadet'),false);
  assert.equal(rules.isUniformAllowedFor('mess_dress','senior'),true);
});

test('every uniform belongs to a defined group',()=>{
  for(const [id,rule] of Object.entries(rules.RULES)){
    assert.ok(rules.GROUPS[rule.group],`${id} group`);
    assert.ok(['usaf','corporate'].includes(rule.style),`${id} style`);
  }
});

test('the app reads ribbon and award wear from the rule table, not from its own copies',()=>{
  const catalog=fs.readFileSync(path.join(__dirname,'..','js','catalog.js'),'utf8');
  const galleries=fs.readFileSync(path.join(__dirname,'..','js','galleries.js'),'utf8');
  assert.match(catalog,/UNIFORMS\[id\]\.ribbons = CAPUBUniformRules\.allowsRibbons\(id\)/);
  assert.match(catalog,/UI_AUTHZ\[id\]\.showRibbons = CAPUBUniformRules\.allowsRibbons\(id\)/);
  assert.match(galleries,/if\(!isAwardWornOnUniform\(id\)\) continue;/);
});

test('the Air Force Organizational Excellence Award is a senior award (39-3 Attachment 2)',()=>{
  const catalog=fs.readFileSync(path.join(__dirname,'..','js','catalog.js'),'utf8');
  const common=catalog.slice(catalog.indexOf('const COMMON_ELIGIBLE_RIBBONS'),catalog.indexOf('const COMMON_ELIGIBLE_RIBBONS')+400);
  const senior=catalog.slice(catalog.indexOf('const SENIOR_ONLY_RIBBONS'),catalog.indexOf('const SENIOR_ONLY_RIBBONS')+200);
  assert.doesNotMatch(common,/Air_Force_Organizational_Excellence_Award/);
  assert.match(senior,/Air_Force_Organizational_Excellence_Award/);
});

test('U.S. military badges are kept off Corporate-style uniforms in both the gallery and the render (39-1 4.2.5.1.3)',()=>{
  const placement=fs.readFileSync(path.join(__dirname,'..','js','placement.js'),'utf8');
  const wiring=fs.readFileSync(path.join(__dirname,'..','js','wiring.js'),'utf8');
  assert.match(placement,/function renderSelectedMilitaryBadgesOnCap\(\)\{[\s\S]{0,260}isMilitaryAwardWornOnUniform\(\)/);
  assert.match(wiring,/isMilitaryAwardWornOnUniform\(\) \? getAllSelectableMilitaryBadges\(\) : \[\]/);
});

test('Corporate Service Dress and Corporate Semi-Formal authorize only the chaplain badge (39-1 4.2.3.1.1.3, 4.2.1)',()=>{
  const only=Object.keys(rules.RULES).filter(id=>rules.allowsOnlyChaplainBadge(id)).sort();
  assert.deepEqual(only,['aviator_blazer','semi_formal']);
  assert.equal(rules.allowsOnlyChaplainBadge('aviator'),false,'the Aviator Shirt allows more');
  assert.equal(rules.allowsOnlyChaplainBadge('blues_a'),false);
  const wiring=fs.readFileSync(path.join(__dirname,'..','js','wiring.js'),'utf8');
  assert.match(wiring,/allowsOnlyChaplainBadge\(State\.uniform\)/);
  assert.match(wiring,/Not authorized here:/);
});

/* ---- Every value in the table, stated against its paragraph of CAPR 39-1 ----
   Each row is what the regulation text says for that uniform. A change to the table has to
   change a row here, which is the moment to have the regulation open. */
const REG={
  blues_a:{style:'usaf',who:['cadet','senior'],adultCadet:false,ribbons:'required',mini:false,usafAwards:true,rack:[3,4],badges:4,shared:false,
    para:'4.1.5.2.2.3 (ribbons mandatory), 11.2.7 (rows of four only here), 4.1.5.2.2.4 (four badges)'},
  blues_b:{style:'usaf',who:['cadet','senior'],adultCadet:false,ribbons:'optional',mini:false,usafAwards:true,rack:[3],badges:4,shared:false,minimum:true,
    para:'1.2.2 (minimum uniform), 4.1.11.1.1.2.2 (ribbons optional), 11.2.7 (rows of three), 4.1.11.1.1.2.3 (four badges)'},
  mess_dress:{style:'usaf',who:['senior'],adultCadet:false,ribbons:'none',mini:true,usafAwards:true,rack:[],badges:4,shared:false,
    para:'4.1.1 and 4.1.2 (officers and NCOs only), 11.1.4 (miniature medals), 4.1.1.1.3 and 4.1.2.1.2.4 (four badges)'},
  semi_formal:{style:'corporate',who:['senior'],adultCadet:true,ribbons:'none',mini:true,usafAwards:false,rack:[],badges:null,shared:false,chaplainOnly:true,
    para:'4.2.1 and 4.2.2 (Corporate Semi-Formal, 18 and older, only CAP miniature medals), 4.2.3.1.1.3 via "worn as for Corporate Service Dress"'},
  aviator:{style:'corporate',who:['senior'],adultCadet:true,ribbons:'optional',mini:false,usafAwards:false,rack:[3],badges:4,shared:false,minimum:true,
    para:'1.2.3 (minimum Corporate uniform), 4.2.5.1.2.2 (CAP ribbons optional, military not authorized), 11.2.7, 4.2.5.1.3 (four badges, no military)'},
  aviator_blazer:{style:'corporate',who:['senior'],adultCadet:true,ribbons:'none',mini:false,usafAwards:false,rack:[],badges:null,shared:false,chaplainOnly:true,
    para:'11.1.3 (no ribbons), 4.2.3.1.1.3 (chaplain badge is the only occupational badge); the regulation states no badge total'},
  corporate_field:{style:'corporate',who:['senior'],adultCadet:true,ribbons:'none',mini:false,usafAwards:false,rack:[],badges:8,shared:true,
    para:'11.1.3 (no ribbons), 5.2.1.1.2 (badges and patches together not more than eight; no military badges)'},
  abu:{style:'usaf',who:['cadet','senior'],adultCadet:false,ribbons:'none',mini:false,usafAwards:true,rack:[],badges:4,shared:true,
    para:'5.1.1.1.2 (badges and patches together not more than four; military badges count toward it)'},
  ocp:{style:'usaf',who:['cadet','senior'],adultCadet:false,ribbons:'none',mini:false,usafAwards:true,rack:[],badges:4,shared:false,
    para:'ICL 25-06 7.1.1.3.1 (four badges above the CAP tape; military badges per DAFI 36-2903)'},
  flight_suit:{style:'usaf',who:['cadet','senior'],adultCadet:false,ribbons:'none',mini:false,usafAwards:true,rack:[],badges:2,shared:false,
    para:'8.2.1 (active members), 11.1.3 (no ribbons), 8.2.4.1 (up to two badges on the nametag, military aviation badges allowed)'},
  polo:{style:'corporate',who:['senior'],adultCadet:false,ribbons:'none',mini:false,usafAwards:false,rack:[],badges:1,shared:false,
    para:'5.3.2 (no grade insignia), 1.2.5.2 (cadets excluded from the Working Uniform), 5.3.2.1.1 (one badge)'}
};

test('every value in the table is the one the regulation states',()=>{
  assert.deepEqual(Object.keys(rules.RULES).sort(),Object.keys(REG).sort(),'one row per uniform');
  for(const [id,reg] of Object.entries(REG)){
    const rule=rules.getUniformRule(id);
    const at=(field)=>`${id}.${field} (${reg.para})`;
    assert.equal(rule.style,reg.style,at('style'));
    assert.deepEqual(rule.membership,reg.who,at('membership'));
    assert.equal(rule.adultCadet,reg.adultCadet,at('adultCadet'));
    assert.equal(rule.ribbons,reg.ribbons,at('ribbons'));
    assert.equal(rule.mini,reg.mini,at('mini'));
    assert.equal(rule.usafAwards,reg.usafAwards,at('usafAwards'));
    assert.deepEqual(rule.rackColumns,reg.rack,at('rackColumns'));
    assert.equal(rule.badgeCap,reg.badges,at('badgeCap'));
    assert.equal(!!rule.patchesShareBadgeCap,reg.shared,at('patchesShareBadgeCap'));
    assert.equal(!!rule.minimum,!!reg.minimum,at('minimum'));
    assert.equal(!!rule.chaplainBadgeOnly,!!reg.chaplainOnly,at('chaplainBadgeOnly'));
  }
});

test('every rule that states a limit or a restriction carries its paragraph',()=>{
  for(const [id,rule] of Object.entries(rules.RULES)){
    assert.ok(rule.refs,`${id} has refs`);
    if(rule.badgeCap!=null) assert.ok(rule.refs.badges,`${id} cites where its badge limit comes from`);
    if(rule.adultCadet) assert.equal(rule.refs.adultCadet,'1.2.5.2',`${id} cites the adult-cadet paragraph`);
    if(rule.ribbons==='none') assert.ok(rule.refs.ribbons,`${id} cites why it wears no ribbons`);
    if(rule.minimum) assert.ok(rule.refs.minimum,`${id} cites the minimum-uniform paragraph`);
  }
});

test('a cadet reaches Corporate uniforms only as an adult cadet, and never the Working Uniform (39-1 1.2.5.2)',()=>{
  for(const id of ['semi_formal','aviator','aviator_blazer','corporate_field']){
    assert.equal(rules.isUniformAllowedFor(id,'cadet'),false,`${id}: a cadet by default`);
    assert.equal(rules.isUniformAllowedFor(id,'cadet',{adultCadet:true}),true,`${id}: an adult cadet`);
    assert.equal(rules.isUniformAllowedFor(id,'senior'),true,`${id}: a senior member`);
  }
  assert.equal(rules.isUniformAllowedFor('polo','cadet',{adultCadet:true}),false);
  // The option never widens anything for a senior member, or onto USAF-only uniforms.
  assert.equal(rules.isUniformAllowedFor('mess_dress','cadet',{adultCadet:true}),false);
  assert.equal(rules.isUniformAllowedFor('blues_a','cadet'),true);
});

test('badge limits: patches count with badges on the ABU and Corporate Field only',()=>{
  assert.deepEqual(rules.badgeLimit('abu',{badges:3,patches:2}),{cap:4,counted:5,shared:true,over:true});
  assert.deepEqual(rules.badgeLimit('abu',{badges:2,patches:2}),{cap:4,counted:4,shared:true,over:false});
  assert.equal(rules.badgeLimit('corporate_field',{badges:5,patches:3}).over,false);
  assert.equal(rules.badgeLimit('corporate_field',{badges:5,patches:4}).over,true);
  assert.equal(rules.badgeLimit('ocp',{badges:4,patches:2}).over,false,'OCP patches are separate');
  assert.equal(rules.badgeLimit('flight_suit',{badges:3}).over,true);
  assert.equal(rules.badgeLimit('aviator_blazer',{badges:9}).over,false,'no total is stated for the blazer');
});

test('uniforms the regulation allows but the builder does not draw are listed, not offered',()=>{
  assert.ok(rules.NOT_MODELLED.semi_formal_usaf_cadet);
  assert.ok(rules.NOT_MODELLED.corporate_flight_duty);
  for(const id of Object.keys(rules.NOT_MODELLED)){
    assert.equal(rules.getUniformRule(id),null,`${id} is not an offered uniform`);
    assert.ok(rules.NOT_MODELLED[id].why);
  }
});
