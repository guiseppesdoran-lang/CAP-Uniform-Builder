'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {exportFileName,slug}=require('../export-names.js');

const day=new Date(2026,9,10,15,30);

test('a download names the rank, the uniform and the day',()=>{
  assert.equal(exportFileName({rank:'C/SSgt',uniform:'blues_a'},'png',day),'CAP-Uniform_C-SSgt_Blues-A_2026-10-10.png');
  assert.equal(exportFileName({rank:'Lt Col',uniform:'aviator_blazer'},'json',day),'CAP-Uniform_Lt-Col_Aviator-Blazer_2026-10-10.json');
  assert.equal(exportFileName({rank:'C/Capt',uniform:'ocp'},'.png',day),'CAP-Uniform_C-Capt_Ocp_2026-10-10.png');
});

test('missing parts are left out rather than printed as null or undefined',()=>{
  assert.equal(exportFileName({},'png',day),'CAP-Uniform_2026-10-10.png');
  assert.equal(exportFileName({rank:null,uniform:'blues_b'},'png',day),'CAP-Uniform_Blues-B_2026-10-10.png');
});

test('the name is safe for any file system',()=>{
  const name=exportFileName({rank:'C/../Col<>:"|?*',uniform:'x y/z'},'png',day);
  assert.match(name,/^[A-Za-z0-9_.-]+$/);
  assert.equal(slug('  a//b  '),'a-b');
});

test('PNG and setup-file exports both use it',()=>{
  const boot=fs.readFileSync(path.join(__dirname,'..','js','bootstrap.js'),'utf8');
  const wiring=fs.readFileSync(path.join(__dirname,'..','js','wiring.js'),'utf8');
  assert.match(boot,/CAPUBExportNames\.exportFileName\(\{rank:State\.rank,uniform:State\.uniform\},'png'\)/);
  assert.match(wiring,/CAPUBExportNames\.exportFileName\(\{rank:State\.rank,uniform:State\.uniform\},'json'\)/);
});
