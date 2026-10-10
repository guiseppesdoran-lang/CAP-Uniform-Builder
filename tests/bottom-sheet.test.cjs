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

function phoneBlock(){
  const start=css.indexOf('@media (max-width:768px)');
  let depth=0,i=css.indexOf('{',start);
  const begin=i;
  for(;i<css.length;i++){ if(css[i]==='{') depth++; if(css[i]==='}'){ depth--; if(depth===0) break; } }
  return css.slice(begin,i+1);
}

test('on a phone the controls are a bottom sheet over the footer, not a side drawer',()=>{
  const phone=phoneBlock();
  assert.match(phone,/#controls[^{]*\{[^}]*bottom:var\(--capub-footer-h\)/);
  assert.match(phone,/height:var\(--sheet-h\)/);
  assert.match(phone,/sidebar-collapsed #controls\{transform:translate3d\(0,110%,0\)/);
  assert.doesNotMatch(phone,/translate3d\(-105%/);
});

test('the sheet has a close button and the page leaves room under the uniform',()=>{
  assert.match(html,/id="sheetClose"/);
  assert.match(setup,/getElementById|by\('sheetClose'\)/);
  assert.match(phoneBlock(),/body:has\(#layoutShell\.sidebar-open\) #previewWrapper\{padding-bottom:calc\(var\(--sheet-h\)/);
});

test('the uniform is refitted into the space above the sheet, from its resting position',()=>{
  assert.match(setup,/capub:sidebar/);
  assert.match(ui,/document\.addEventListener\('capub:sidebar'/);
  assert.match(ui,/window\.innerHeight - \(footer \? footer\.offsetHeight : 0\) - sheet\.offsetHeight/);
});

test('desktop keeps the side panel and has no close button',()=>{
  assert.match(css,/@media \(min-width:769px\)\{\.sheetClose\{display:none\}\}/);
});
