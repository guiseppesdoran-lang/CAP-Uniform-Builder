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
