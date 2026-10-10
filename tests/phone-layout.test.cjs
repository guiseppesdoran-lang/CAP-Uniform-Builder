'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'..','styles','app.css'),'utf8');

function block(query){
  const start=css.indexOf(`@media (${query})`);
  assert.ok(start>=0,`has a ${query} block`);
  let depth=0,i=css.indexOf('{',start);
  const begin=i;
  for(;i<css.length;i++){
    if(css[i]==='{') depth++;
    if(css[i]==='}'){ depth--; if(depth===0) break; }
  }
  return css.slice(begin,i+1);
}

test('the header fits a 375px phone: the tag shrinks and the theme button may wrap',()=>{
  const phone=block('max-width:480px');
  assert.match(phone,/\.unofficialTag\{[^}]*font-size:var\(--t-xs\)/);
  assert.match(phone,/\.themeToggle\{[^}]*max-width:64px/);
  assert.match(phone,/header\{padding-right:var\(--s3\)\}/);
});

test('on a 320px phone the Unofficial notice moves into the subtitle rather than disappearing',()=>{
  const narrow=block('max-width:360px');
  assert.match(narrow,/\.unofficialTag\{display:none\}/);
  assert.match(narrow,/header h1::after\{content:"Unofficial tool"\}/);
});

test('the phone toolbar keeps status and items and drops the uniform pill',()=>{
  assert.match(block('max-width:480px'),/#capubTopBar \.capubPill:nth-child\(2\)\{display:none\}/);
});
