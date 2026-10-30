'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=read('styles/app.css');
const ui=read('js/workspace-ui.js');
const setup=read('js/setup.js');
const html=read('index.html');

function block(query){
  const start=css.indexOf(`@media (${query})`);
  assert.ok(start>=0,`has a ${query} block`);
  let depth=0,i=css.indexOf('{',start);
  const begin=i;
  for(;i<css.length;i++){ if(css[i]==='{') depth++; if(css[i]==='}'){ depth--; if(depth===0) break; } }
  return css.slice(begin,i+1);
}

test('up to 900px the controls are a bottom sheet over the footer, not a side drawer',()=>{
  const sheet=block('max-width:900px');
  assert.match(sheet,/#controls[^{]*\{[^}]*bottom:var\(--chrome-footer-h,var\(--capub-footer-h\)\)/);
  assert.match(sheet,/height:var\(--sheet-h\)/);
  assert.match(sheet,/sidebar-collapsed #controls\{transform:translate3d\(0,110%,0\)/);
  assert.doesNotMatch(sheet,/translate3d\(-105%/);
  assert.match(ui,/const SHEET_QUERY='\(max-width:900px\)';/);
});

test('the sheet has a grip to drag it taller or away, and a Done button; the page leaves room under the uniform',()=>{
  assert.match(html,/<button type="button" id="sheetHandle" class="sheetHandle"/);
  assert.match(html,/id="sheetClose"/);
  assert.match(setup,/getElementById|by\('sheetClose'\)/);
  const sheet=block('max-width:900px');
  assert.match(sheet,/body:has\(#layoutShell\.sidebar-open\) #previewWrapper\{padding-bottom:calc\(var\(--sheet-h\)/);
  assert.match(sheet,/#controls\.sheetTall,#layoutShell\.sidebar-open #controls\.sheetTall\{height:var\(--sheet-tall-h\)\}/);
  // Drag down far enough closes it (or brings a tall sheet back); up makes it tall; a tap toggles tall.
  assert.match(ui,/if\(dy>90\)\{\s*if\(tall\) sheet\.classList\.remove\('sheetTall'\);\s*else if\(typeof capubSetSidebarOpen==='function'\) capubSetSidebarOpen\(false\);/);
  assert.match(ui,/else if\(dy<-50 && !tall\) sheet\.classList\.add\('sheetTall'\);\s*else if\(!moved\) sheet\.classList\.toggle\('sheetTall'\);/);
});

test('the uniform is refitted into the space above the sheet, from its resting position',()=>{
  assert.match(setup,/capub:sidebar/);
  assert.match(ui,/document\.addEventListener\('capub:sidebar'/);
  assert.match(ui,/window\.innerHeight - \(footer \? footer\.offsetHeight : 0\) - controls\.offsetHeight/);
});

test('above 900px the panel is always open beside the preview: no menu button, no grip, no close',()=>{
  const desktop=block('min-width:901px');
  assert.match(desktop,/\.hamburgerBtn\{display:none\}/);
  assert.match(desktop,/\.sheetClose,\.sheetGrip\{display:none\}/);
  assert.match(desktop,/#layoutShell\.sidebar-collapsed #controls\{width:var\(--sidebar-w\)/);
  // Resizing back from a phone layout reopens it.
  assert.match(ui,/if\(mq\.matches\) return;\s*sheet\.classList\.remove\('sheetTall'\);\s*if\(typeof capubSetSidebarOpen==='function'\) capubSetSidebarOpen\(true\);/);
});
