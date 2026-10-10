'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','js','workspace-ui.js'),'utf8');

// Each block in this file is its own IIFE, so a helper defined in one is not visible in the next.
// A block that used another block's helper would throw when the page loads and stop everything
// after it, so every block that calls a helper must define it.
test('every block that uses safeBy defines it',()=>{
  const blocks=source.split(/\n\(function /).slice(1);
  assert.ok(blocks.length>=5,'found the blocks');
  for(const block of blocks){
    const name=block.slice(0,block.indexOf('('));
    if(/\bsafeBy\(/.test(block)) assert.match(block,/const safeBy\s*=/,`${name} uses safeBy without defining it`);
  }
});

test('the file parses as a script',()=>{
  assert.doesNotThrow(()=>new Function(source));
});
