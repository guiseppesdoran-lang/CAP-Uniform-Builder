'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const section=(startMarker,endMarker)=>html.slice(html.indexOf(startMarker),html.indexOf(endMarker,html.indexOf(startMarker)));
const finish=section('id="finishPanel"','</section>');
const tools=section('id="stepGroup-tools"','</details>');

test('the Finish section holds the three ways to finish',()=>{
  assert.match(finish,/id="downloadImage"/);
  assert.match(finish,/id="purchaseListSlot"/);
  assert.match(finish,/id="capubV2ExportJson"/);
  assert.match(finish,/id="capubV2ImportBtn"/);
  assert.match(finish,/id="capubV2ImportFile"/);
});

test('saving to a file is no longer buried in Builder tools',()=>{
  for(const id of ['capubV2ExportJson','capubV2ImportBtn','capubV2ImportFile']){
    assert.doesNotMatch(tools,new RegExp(`id="${id}"`),`${id} left Builder tools`);
  }
  assert.match(tools,/id="capubV2SaveLocal"/);
});

test('the shopping list button goes into the Finish slot and reads as secondary',()=>{
  const core=fs.readFileSync(path.join(__dirname,'..','purchase-feature-core.js'),'utf8');
  assert.match(core,/getElementById\('purchaseListSlot'\)/);
  assert.match(core,/btn\.className='ghost'/);
});

test('step four is named for what the member does there',()=>{
  assert.match(html,/4 · Check &amp; finish/);
  const ui=fs.readFileSync(path.join(__dirname,'..','js','workspace-ui.js'),'utf8');
  assert.match(ui,/<strong>4\. Finish<\/strong><span>Check \+ save<\/span>/);
});
