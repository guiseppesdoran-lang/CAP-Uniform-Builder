'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const section=(startMarker,endMarker)=>html.slice(html.indexOf(startMarker),html.indexOf(endMarker,html.indexOf(startMarker)));
const finish=section('id="finishPanel"','</section>');
const saved=section('id="savedSetupsMore"','<div class="controlsFooter"');
const exportStep=section('id="stepGroup-export"','<div class="controlsFooter"');

test('the Finish section holds the three ways to finish',()=>{
  assert.match(finish,/id="downloadImage"/);
  assert.match(finish,/id="purchaseListSlot"/);
  assert.match(finish,/id="capubV2ExportJson"/);
  assert.match(finish,/id="capubV2ImportBtn"/);
  assert.match(finish,/id="capubV2ImportFile"/);
});

test('saving to a file and the reset are both in the open: Saved setups is plain, not a fold, and has no button that saves or loads by hand',()=>{
  for(const id of ['capubV2ExportJson','capubV2ImportBtn','capubV2ImportFile']){
    assert.doesNotMatch(saved,new RegExp(`id="${id}"`),`${id} is not under Saved setups`);
  }
  assert.match(saved,/<label class="fieldLabel">Saved setups<\/label>/);
  assert.doesNotMatch(exportStep,/<details/,'no fold on the Extra step hides a control');
  assert.match(saved,/id="capubV2Reset"/);
  assert.match(saved,/>Reset builder</);
  // The setup saves itself as the member works, so there is no button to save it to the browser or to load it back.
  assert.doesNotMatch(html,/capubV2SaveLocal|capubV2LoadLocal|Save to browser|Load saved/);
  // The hint lines are short and true.
  assert.match(saved,/<div class="hintText">Saved in this browser as you work\.<\/div>/);
  assert.match(finish,/<div class="hintText">Keep a copy, or move your setup to another device\.<\/div>/);
  assert.doesNotMatch(finish,/Keeps your whole setup|saved automatically/);
});

test('the shopping list button goes into the Finish slot and reads as secondary',()=>{
  const core=fs.readFileSync(path.join(__dirname,'..','purchase-feature-core.js'),'utf8');
  assert.match(core,/getElementById\('purchaseListSlot'\)/);
  assert.match(core,/btn\.className='ghost'/);
});

test('step four is named Extra everywhere the member sees it, and its download is the footer primary',()=>{
  assert.match(exportStep,/<h3 class="stepGroupTitle" tabindex="-1">Extra<\/h3>/);
  assert.match(html,/id="stepTab-export"[^>]*><span class="stepNum">4<\/span><span class="stepLabel">Extra<\/span>/);
  assert.match(finish,/<label class="fieldLabel">Downloads and files<\/label>/, 'the card inside Extra has a name of its own');
  const ui=fs.readFileSync(path.join(__dirname,'..','js','workspace-ui.js'),'utf8');
  assert.match(ui,/export:'Extra'/);
  assert.doesNotMatch(ui,/Check & finish|'Finish'/);
  // The download button is moved from the Finish panel into the footer once the page is up, and hidden there until the last step.
  assert.match(ui,/const download=safeBy\('downloadImage'\), row=document\.querySelector\('#stepFooter \.stepFooterRow'\);/);
  assert.match(ui,/if\(download && download\.closest\('#stepFooter'\)\) download\.hidden=!!nextStep;/);
});
