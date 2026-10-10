'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const wiring=fs.readFileSync(path.join(__dirname,'..','js','wiring.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'..','js','workspace-ui.js'),'utf8');

test('the setup notices point at the control that fixes them',()=>{
  assert.match(wiring,/Select membership type first\.',\{id:'membershipType'/);
  assert.match(wiring,/Select rank before building the uniform\.',\{id:'rankSetupSelect'/);
  assert.match(wiring,/Select male\/female cut[^']*',\{id:'jacketSelect'/);
  assert.match(wiring,/are selected\. Command insignia does not count against this limit\.`,\{id:'expandBadges'/);
});

test('a Fix link presses buttons, focuses fields, and opens a folded step first',()=>{
  const fn=wiring.slice(wiring.indexOf('function runNoticeFix'),wiring.indexOf('function runNoticeFix')+900);
  assert.match(fn,/guidedEdit/);
  assert.match(fn,/target\.tagName === 'BUTTON'/);
  assert.match(fn,/scrollIntoView/);
});

test('notice text still goes through textContent, never innerHTML',()=>{
  const render=wiring.slice(wiring.indexOf("const ul = by('capubV2Notices')"),wiring.indexOf("const ul = by('capubV2Notices')")+900);
  assert.match(render,/text\.textContent=n\.msg/);
  assert.doesNotMatch(render,/innerHTML = n\.msg|innerHTML=n\.msg/);
});

test('adding or removing items is acknowledged with a toast',()=>{
  assert.match(ui,/function capubItemToasts/);
  assert.match(ui,/Added \$\{words\(delta,name\)\}/);
  assert.match(ui,/Removed \$\{words\(delta,name\)\}/);
  assert.match(ui,/\['change','click'\]\.forEach\(evt=>document\.addEventListener\(evt,check,true\)\)/);
});

test('clicking an item on the uniform asks before removing it, and undo brings it back',()=>{
  assert.match(ui,/function capubRemoveFromPreview/);
  assert.match(ui,/label\.textContent=item\.name/);
  assert.match(ui,/if\(typeof State!=='undefined' && State\.calib && State\.calib\.enabled\) return;/);
  // Unticks the selection the way the picker does; nothing is deleted from the catalog.
  assert.match(ui,/sel\.checked=false;\s*rebuildRibbonsFromGallery\(\)/);
  assert.match(ui,/sel\.checked=false;\s*rebuildBadgesFromGallery\(\)/);
});
