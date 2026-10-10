'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
// What a member can read: comments and scripts removed.
const visible=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<script[\s\S]*?<\/script>/g,'');
// Words a member reads, without tag names, ids or attributes.
const words=visible.replace(/<[^>]+>/g,' ');

test('no internal vocabulary reaches the sidebar',()=>{
  for(const word of ['V2','modal plumbing','Builder tools','Gender / Cut','Quick Builder Tools','Multi-Apply']){
    assert.ok(!words.includes(word),`"${word}" is still on the page`);
  }
});

test('hint text is a line, not a paragraph',()=>{
  const hints=[...visible.matchAll(/<div class="hintText[^"]*"[^>]*>([\s\S]*?)<\/div>/g)]
    .map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())
    .filter(t=>t);
  assert.ok(hints.length>10,'found the hints');
  const long=hints.filter(t=>t.length>170);
  // The calibrator and the member-report importer explain a procedure; everything else stays short.
  assert.ok(long.length<=4,`these hints are long: ${long.map(t=>t.slice(0,60)).join(' | ')}`);
});

test('controls name the thing, not the implementation',()=>{
  assert.match(visible,/<label class="fieldLabel" for="jacketSelect">Cut<\/label>/);
  assert.match(visible,/Show miniature medals/);
  assert.match(visible,/Saved setups/);
});
