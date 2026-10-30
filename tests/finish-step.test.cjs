'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const section=(startMarker,endMarker)=>html.slice(html.indexOf(startMarker),html.indexOf(endMarker,html.indexOf(startMarker)));
const finish=section('id="finishPanel"','</section>');
const saved=section('id="savedSetupsMore"','</details>');
const exportStep=section('id="stepGroup-export"','<div class="controlsFooter"');

test('the Finish section holds the three ways to finish',()=>{
  assert.match(finish,/id="downloadImage"/);
  assert.match(finish,/id="purchaseListSlot"/);
  assert.match(finish,/id="capubV2ExportJson"/);
  assert.match(finish,/id="capubV2ImportBtn"/);
  assert.match(finish,/id="capubV2ImportFile"/);
});

test('saving to a file is in the open; the browser slot is the folded Saved setups',()=>{
  for(const id of ['capubV2ExportJson','capubV2ImportBtn','capubV2ImportFile']){
    assert.doesNotMatch(saved,new RegExp(`id="${id}"`),`${id} is not under Saved setups`);
  }
  assert.match(saved,/<summary>Saved setups<\/summary>/);
  for(const id of ['capubV2SaveLocal','capubV2LoadLocal','capubV2Reset']) assert.match(saved,new RegExp(`id="${id}"`));
  assert.match(saved,/>Save to browser</);
  assert.match(saved,/>Load saved</);
  assert.match(saved,/>Reset builder</);
});

test('the shopping list button goes into the Finish slot and reads as secondary',()=>{
  const core=fs.readFileSync(path.join(__dirname,'..','purchase-feature-core.js'),'utf8');
  assert.match(core,/getElementById\('purchaseListSlot'\)/);
  assert.match(core,/btn\.className='ghost'/);
});

test('step four is named Extra everywhere the member sees it, and its download is the footer primary',()=>{
  assert.match(exportStep,/<h3 class="stepGroupTitle" tabindex="-1">Extra<\/h3>/);
  assert.match(html,/id="stepTab-export"[^>]*><span class="stepNum">4<\/span><span class="stepLabel">Extra<\/span>/);
  assert.match(finish,/<label class="fieldLabel">Extra<\/label>/);
  const ui=fs.readFileSync(path.join(__dirname,'..','js','workspace-ui.js'),'utf8');
  assert.match(ui,/export:'Extra'/);
  assert.doesNotMatch(ui,/Check & finish|'Finish'/);
  // The download button is moved from the Finish panel into the footer once the page is up, and hidden there until the last step.
  assert.match(ui,/const download=safeBy\('downloadImage'\), row=document\.querySelector\('#stepFooter \.stepFooterRow'\);/);
  assert.match(ui,/if\(download && download\.closest\('#stepFooter'\)\) download\.hidden=!!nextStep;/);
});
