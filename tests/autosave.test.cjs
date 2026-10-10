'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','js','workspace-ui.js'),'utf8');
const module_=source.slice(source.indexOf('function capubAutosave'),source.indexOf('About dialog:'));

test('autosave keeps its own key, separate from the named Save to Browser slot',()=>{
  assert.match(module_,/cap_uniform_builder_autosave_v1/);
  const wiring=fs.readFileSync(path.join(__dirname,'..','js','wiring.js'),'utf8');
  assert.match(wiring,/storageKey: 'cap_uniform_builder_profile_v2'/);
});

test('a saved setup is only offered, never loaded silently',()=>{
  assert.match(module_,/Resume your last uniform\?/);
  const applyCalls=module_.match(/applyProfile\(/g)||[];
  assert.equal(applyCalls.length,1,'applyProfile is called from one place');
  assert.match(module_,/resume\.addEventListener\('click'[\s\S]*applyProfile\(saved\.profile\)/);
});

test('storage reads and writes cannot throw into the page',()=>{
  for(const fn of ['read','write','clear']){
    const m=new RegExp(`function ${fn}\\([^)]*\\)\\{\\s*try\\{`).exec(module_);
    assert.ok(m,`${fn} is wrapped in try/catch`);
  }
});

test('stored values reach the page only through textContent, and the empty page is never saved',()=>{
  assert.doesNotMatch(module_,/innerHTML/);
  assert.match(module_,/return !!\(profile && profile\.membership\)/);
});

test('calibration and garment masks stay out of the autosave',()=>{
  assert.match(module_,/delete p\.calib; delete p\.garmentMasks;/);
});
