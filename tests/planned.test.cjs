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

test('the polo is drawn now: nothing is planned for any member, and it is an offered uniform',()=>{
  for(const m of ['cadet','senior','']) assert.deepEqual(rules.plannedUniformsFor(m).map(u=>u.id),[],m||'no membership');
  assert.ok(rules.getUniformRule('polo'),'the polo is offered');
  assert.equal(rules.plannedBadge('polo'),null,'its badge is placed, so there is no "not available yet" note');
  assert.equal(rules.plannedBadge('blues_a'),null);
});

test('each planned uniform, if one is ever listed again, says what the regulation says and is never a real uniform',()=>{
  for(const u of rules.plannedUniformsFor('senior')){
    assert.ok(u.label && u.facts.length>=2,`${u.id} has a label and facts`);
    assert.ok(u.facts.some(f=>/\d+\.\d+/.test(f)),`${u.id} cites a paragraph`);
    assert.equal(rules.getUniformRule(u.id),null,`${u.id} is not selectable`);
  }
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
