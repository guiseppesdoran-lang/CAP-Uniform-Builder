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

test('what is and is not collected is said at the gate, under the import button and in About (LIVE13, Ethan)',()=>{
  assert.match(visible,/<p class="accessGateNote">Anonymous usage counts only, to improve this tool\. Names are kept out and member searches are never stored\.<\/p>/);
  assert.match(visible,/<div id="memberReportImportStatus" class="hintText" aria-live="polite">Nothing is imported yet\. A report is read on your device and is not kept or sent\.<\/div>/);
  const about=visible.slice(visible.indexOf('<dialog id="aboutDialog"'),visible.indexOf('</dialog>'));
  assert.match(about,/<b>Privacy\.<\/b> Usage counts are collected only to improve this tool\./);
  assert.match(about,/ever leave your browser, member report searches are never stored, and with Do Not Track on/);
  // The visitor number (js/telemetry.js, kept in this browser unless Do Not Track is on) is said too, and the grade that a build count carries.
  assert.match(about,/which uniforms are built and for which grade,/);
  assert.match(about,/A random number kept in this browser tells a returning visit from a first one; it is not linked to you\./);
  assert.match(about,/only plain visit and build counts are sent and no number is kept\./);
  // The clear button shows once a report has been read, whichever idle line the status carries.
  const ui=fs.readFileSync(path.join(__dirname,'..','js','workspace-ui.js'),'utf8');
  assert.match(ui,/\/\^No report imported yet\\\.\?\$\/\.test\(t\)/);
});

test('controls name the thing, not the implementation',()=>{
  assert.match(visible,/<label class="fieldLabel" id="cutLabel" for="jacketSelect">Cut<\/label>/);
  assert.match(visible,/Miniature medal mounting method/);
  assert.match(visible,/Saved setups/);
});
