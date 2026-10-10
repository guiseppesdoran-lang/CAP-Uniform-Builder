'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rules=require('../data/uniform-rules.js');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html');
const planned=read('js/planned-uniforms.js');
const placement=read('js/placement.js');

test('cadets are shown the cadet semi-formal and everyone the Corporate flight duty uniform',()=>{
  assert.deepEqual(rules.plannedUniformsFor('cadet').map(u=>u.id).sort(),['corporate_flight_duty','semi_formal_usaf_cadet']);
  assert.deepEqual(rules.plannedUniformsFor('senior').map(u=>u.id),['corporate_flight_duty']);
  assert.deepEqual(rules.plannedUniformsFor(''),[]);
});

test('each planned uniform says what the regulation says, with paragraphs, and is never a real uniform',()=>{
  for(const u of rules.plannedUniformsFor('cadet')){
    assert.ok(u.label && u.facts.length>=2,`${u.id} has a label and facts`);
    assert.ok(u.facts.some(f=>/\d+\.\d+/.test(f)),`${u.id} cites a paragraph`);
    assert.equal(rules.getUniformRule(u.id),null,`${u.id} is not selectable`);
  }
});

test('the polo is recorded as allowing one badge that the builder cannot place yet',()=>{
  const b=rules.plannedBadge('polo');
  assert.equal(b.count,1);
  assert.equal(b.ref,'5.3.2.1.1');
  assert.equal(rules.plannedBadge('blues_a'),null);
  assert.equal(rules.getUniformRule('polo').badgeCap,1);
});

test('the sidebar shows them as read-only cards and says they are not drawn yet',()=>{
  assert.match(planned,/Authorized, not drawn yet/);
  assert.match(planned,/Not drawn yet/);
  assert.match(planned,/el\('details','plannedCard'\)/);
  assert.doesNotMatch(planned,/uniformOption|data-uniform-id/,'they are not uniform buttons');
  assert.ok(html.indexOf('js/planned-uniforms.js')>html.indexOf('js/workspace-ui.js'));
});

test('the polo keeps its Badges panel with a note and disabled buttons instead of hiding it',()=>{
  assert.match(html,/id="badgesPlannedNote"/);
  assert.match(placement,/Choosing it is not available yet\./);
  assert.match(placement,/b\.disabled = !!planned/);
});
