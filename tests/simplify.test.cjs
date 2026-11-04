'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rules=require('../data/uniform-rules.js');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html');
const css=read('styles/app.css');
const setup=read('js/setup.js');
const patches=read('js/patches.js');
const profile=html.slice(html.indexOf('id="stepGroup-profile"'),html.indexOf('id="stepGroup-uniform"'));
const ribbons=html.slice(html.indexOf('id="groupRibbons"'),html.indexOf('id="groupBadges"'));
const rack=html.slice(html.indexOf('id="rackLayoutMore"'),html.indexOf('</details>',html.indexOf('id="rackLayoutMore"')));

test('membership and cut are two buttons side by side, with the select kept as the source of truth',()=>{
  assert.match(html,/data-segments-for="membershipType"/);
  assert.match(html,/data-segments-for="jacketSelect"/);
  assert.match(html,/<select id="membershipType" class="segmentedSource"/);
  assert.match(html,/<select id="jacketSelect" class="segmentedSource"/);
  assert.match(css,/\.segmented\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.segmented button\{[^}]*min-height:44px/);
  assert.match(setup,/source\.dispatchEvent\(new Event\('change', \{bubbles:true\}\)\)/);
});

test('a uniform the member may not wear is folded under one line at the end of the list, muted, with its reason',()=>{
  assert.doesNotMatch(css,/\.uniformOption\.locked\{display:none\}/);
  assert.match(html,/<details class="lockedFold" id="lockedUniforms" hidden>\s*<summary id="lockedUniformsSummary">/);
  assert.match(css,/\.uniformOption\.locked\{\s*cursor:not-allowed;\s*opacity:\.7;/);
  assert.match(css,/\.uniformOption\.locked::after\{\s*content:attr\(data-locked-reason\);\s*display:block;/);
  assert.match(setup,/opt\.setAttribute\('data-locked-reason', CAPUBUniformRules\.lockedReason\(/);
  const ui=read('js/workspace-ui.js');
  assert.match(ui,/if\(locked && card\.parentNode!==grid\) grid\.appendChild\(card\);/);
  assert.match(ui,/summary\.textContent=`Not for \$\{who\}: \$\{n\} uniform\$\{n===1\?'':'s'\}`;/);
  assert.doesNotMatch(html,/Grayed-out uniforms/);
});

test('shoulder cords are for cadets on Class A and Class B only (CAPR 39-1 9.3, 9.4.1)',()=>{
  for(const id of Object.keys(rules.RULES)){
    const want=id==='blues_a' || id==='blues_b';
    assert.equal(rules.allowsShoulderCord(id,'cadet'),want,`${id} for a cadet`);
    assert.equal(rules.allowsShoulderCord(id,'senior'),false,`${id} for a senior member`);
  }
  assert.match(patches,/panel\.classList\.toggle\('hidden', !usable\)/);
  // The Aide-de-camp cord is also worn by senior members (9.3.4), so the control asks per cord.
  assert.match(patches,/CAPUBUniformRules\.allowsCord\(State\.uniform, State\.membership, o\.value\)/);
});

test('the collar and lapel mask editor is gone: the engine redraws the lapel from the artwork',()=>{
  assert.ok(!html.includes('id="garmentOverlayPanel"'));
  assert.ok(!html.includes('id="editGarmentMaskBtn"'));
});

test('the name is an optional block at the end of the Profile step, open by default',()=>{
  assert.match(profile,/<details class="optionalName" id="optionalName" open>\s*<summary>Add your name \(optional\)<\/summary>/);
  assert.ok(profile.includes('id="capubV2LastName"'));
  assert.ok(profile.indexOf('id="genderBlock"')<profile.indexOf('id="optionalName"'),'the cut comes before the name');
  assert.match(profile.slice(profile.indexOf('id="optionalName"'),profile.indexOf('id="optionalName"')+60),/\bopen\b/,'the name fold is open by default so the fields are in view');
});

test('the ribbon rack layout controls are folded under the Ribbons card as Advanced: rack layout',()=>{
  assert.match(rack,/<summary>Advanced: rack layout<\/summary>\s*<div id="ribbonRackPanel">/);
  for(const id of ['ribbonRackColumns','ribbonRackArrangement','ribbonRowOverridePanel','ribbonRackColumnsHint']){
    assert.ok(rack.includes(`id="${id}"`),`${id} is under Advanced: rack layout`);
  }
  assert.ok(ribbons.includes('id="rackLayoutMore"'),'the fold is on the Ribbons card');
  // The fold's summary names it; the label inside is not repeated.
  assert.equal((rack.match(/Ribbon rack layout/g)||[]).length,1);
});

test('ribbon devices are set in the ribbon picker, so the add-several tool is gone',()=>{
  for(const id of ['deviceTool','devicePicker','deviceApplyModeBtn','deviceRemoveModeBtn','deviceClearSelectionBtn']){
    assert.ok(!html.includes(`id="${id}"`),`${id} removed`);
  }
  const core=read('js/render-core.js');
  assert.doesNotMatch(core,/function wireDeviceUI|function buildDevicePicker/);
});

test('no badge tile carries a Rare Cadet Eligibility tag',()=>{
  for(const file of ['js/galleries.js','js/wiring.js','js/patches.js']){
    assert.doesNotMatch(read(file),/Rare Cadet Eligibility/,file);
  }
});

test('no Start your uniform card over the preview: before the setup is complete the stage is simply empty',()=>{
  for(const f of ['index.html','styles/app.css','js/workspace-ui.js']) assert.doesNotMatch(read(f),/previewEmptyState|emptyChecklist|Start your uniform/,f);
  // The renderer draws nothing until membership, cut and rank are chosen; the footer's reason line is the guidance.
  assert.match(read('js/uniform-view.js'),/if\(!State\.membership \|\| !State\.gender \|\| !State\.rank \|\| !CAPUBEngine\.profiles\.PROFILES\[State\.uniform\]\)\{/);
  assert.match(read('js/workspace-ui.js'),/return `Choose \$\{listWords\(getProfileGaps\(\)\.filter\(g=>!g\.ok\)\.map\(g=>g\.short\)\)\} to go on\.`;/);
});
