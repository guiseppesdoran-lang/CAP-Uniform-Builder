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
const tools=html.slice(html.indexOf('id="stepGroup-tools"'),html.indexOf('</details>',html.indexOf('id="stepGroup-tools"')));
const profile=html.slice(html.indexOf('id="stepGroup-profile"'),html.indexOf('id="stepGroup-uniform"'));
const ribbons=html.slice(html.indexOf('id="groupRibbons"'),html.indexOf('id="groupBadges"'));

test('membership and cut are two buttons side by side, with the select kept as the source of truth',()=>{
  assert.match(html,/data-segments-for="membershipType"/);
  assert.match(html,/data-segments-for="jacketSelect"/);
  assert.match(html,/<select id="membershipType" class="segmentedSource"/);
  assert.match(html,/<select id="jacketSelect" class="segmentedSource"/);
  assert.match(css,/\.segmented\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.segmented button\{[^}]*min-height:44px/);
  assert.match(setup,/source\.dispatchEvent\(new Event\('change', \{bubbles:true\}\)\)/);
});

test('a uniform the member may not wear is not listed, in either view',()=>{
  assert.match(css,/\.uniformOption\.locked\{display:none\}/);
  assert.match(css,/html\[data-ux="2"\] \.uniformOption\.locked\{display:none\}/);
  assert.doesNotMatch(html,/Grayed-out uniforms/);
});

test('shoulder cords are for cadets on Class A and Class B only (CAPR 39-1 9.3, 9.4.1)',()=>{
  for(const id of Object.keys(rules.RULES)){
    const want=id==='blues_a' || id==='blues_b';
    assert.equal(rules.allowsShoulderCord(id,'cadet'),want,`${id} for a cadet`);
    assert.equal(rules.allowsShoulderCord(id,'senior'),false,`${id} for a senior member`);
  }
  assert.match(patches,/panel\.classList\.toggle\('hidden', !usable\)/);
  assert.match(patches,/CAPUBUniformRules\.allowsShoulderCord\(State\.uniform, State\.membership\)/);
});

test('the collar and lapel mask editor is gone: the engine redraws the lapel from the artwork',()=>{
  assert.ok(!html.includes('id="garmentOverlayPanel"'));
  assert.ok(!html.includes('id="editGarmentMaskBtn"'));
});

test('the name is an optional, folded block in the Profile step',()=>{
  assert.match(profile,/<details class="optionalName" id="optionalName">\s*<summary>Add your name \(optional\)<\/summary>/);
  assert.ok(profile.includes('id="capubV2LastName"'));
  assert.ok(!tools.includes('capubV2LastName'));
  assert.doesNotMatch(profile.slice(profile.indexOf('id="optionalName"'),profile.indexOf('id="optionalName"')+60),/\bopen\b/);
});

test('the ribbon rack layout controls are one panel under More tools, off the Ribbons panel',()=>{
  for(const id of ['ribbonRackColumns','ribbonRackArrangement','ribbonRowOverridePanel','ribbonRackColumnsHint']){
    assert.ok(tools.includes(`id="${id}"`),`${id} is under More tools`);
    assert.ok(!ribbons.includes(`id="${id}"`),`${id} is not on the Ribbons panel`);
  }
  assert.match(tools,/<section id="ribbonRackPanel"/);
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

test('the Start your uniform card stands alone: the canvas hides while it shows',()=>{
  assert.match(css,/#previewArea:has\(> #previewEmptyState:not\(\[hidden\]\)\) #uniformCanvas\{visibility:hidden\}/);
});
