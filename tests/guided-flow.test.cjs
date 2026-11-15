'use strict';
// The guided flow that lived behind ?ux=2 is the default panel now (tests/stepper.test.cjs). This file checks the
// flag is gone and that what it carried over, the lock reasons, still reads as the regulation does.

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rules=require('../data/uniform-rules.js');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const state=read('js/state.js');
const html=read('index.html');
const css=read('styles/app.css');
const ui=read('js/workspace-ui.js');
const wiring=read('js/wiring.js');

test('the ?ux=2 flag is gone from the state, the page, the styles and the wiring',()=>{
  assert.doesNotMatch(state,/CAPUB_GUIDED|dataset\.ux/);
  assert.doesNotMatch(html,/data-ux|class="[^"]*guided/);
  assert.doesNotMatch(css,/data-ux|\.guided/);
  assert.doesNotMatch(ui,/CAPUB_GUIDED|guided/);
  assert.doesNotMatch(wiring,/guidedEdit|isActive/);
});

test('the empty script that stood for the guided flow is gone: the page loads none by that name',()=>{
  assert.doesNotMatch(html,/guided-flow/);
});

test('the uniforms are one flat list in the regulation\'s order; the occasion groups stay in the data only',()=>{
  assert.deepEqual(Object.keys(rules.GROUPS),['formal','everyday','field']);
  assert.doesNotMatch(html,/uniformGroup/);
  assert.doesNotMatch(css,/uniformGroupTitle/);
});

test('locked reasons name the paragraph and are empty when the member may wear it',()=>{
  assert.equal(rules.lockedReason('mess_dress','cadet'),'For senior members (CAPR 39-1, 4.1.1)');
  assert.equal(rules.lockedReason('corporate_field','cadet'),'For cadets 18 and older who do not meet the USAF weight standard (CAPR 39-1, 1.2.5.2)');
  assert.equal(rules.lockedReason('semi_formal_usaf','senior'),'Not available to senior members (CAPR 39-1, 4.1.3, 4.1.4)');
  assert.equal(rules.lockedReason('blues_a','cadet'),'');
  assert.equal(rules.lockedReason('mess_dress','senior'),'');
  assert.equal(rules.lockedReason('mess_dress',''),'');
});

test('controls meet the 44px touch target',()=>{
  for(const sel of ['\\.noticeFix','\\.itemPopoverActions button','\\.moreDetails>summary','\\.optionalName>summary']){
    const m=new RegExp(`${sel}\\{[^}]*min-height:44px`).exec(css);
    assert.ok(m,`${sel} is 44px`);
  }
  assert.match(css,/\.footerLink\{[^}]*min-height:44px/);
  // The step tab is the bar's height less the border under it (--bar-h, which the toolbar over the preview shares): 57 - 1.
  assert.match(css,/--bar-h:57px;/);
  assert.match(css,/\.stepTab\{[^}]*min-height:calc\(var\(--bar-h\) - 1px\)/);
});
