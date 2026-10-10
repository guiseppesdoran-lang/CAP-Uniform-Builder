'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'..','styles','app.css'),'utf8');
const galleries=fs.readFileSync(path.join(__dirname,'..','js','galleries.js'),'utf8');

test('the military ribbon filter row stacks on a phone instead of overflowing',()=>{
  assert.doesNotMatch(galleries,/filters\.style\.cssText='display:grid;grid-template-columns/);
  assert.match(css,/\.militaryRibbonCatalogFilters\{\s*display:grid;/);
  assert.match(css,/@media \(max-width:600px\)\{\s*\.militaryRibbonCatalogFilters\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test('folded sections inside the pickers are 44px targets',()=>{
  assert.match(css,/\.modal details>summary\{min-height:44px/);
});

test('a checkbox with its label is a 44px row',()=>{
  assert.match(css,/label\.fieldNote:has\(>input\[type=checkbox\]\)\{display:flex;align-items:center;gap:var\(--s2\);min-height:44px\}/);
});
