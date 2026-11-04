'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'..','styles','app.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

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

test('the app bar fits a phone: the title and the tag stack so neither is cut off, the theme button is a 44px icon, nothing scrolls sideways',()=>{
  const phone=block('max-width:700px');
  assert.match(phone,/html,body\{overflow-x:hidden\}/);
  assert.match(phone,/header\{display:grid;grid-template-columns:minmax\(0,1fr\) auto auto;/);
  assert.match(phone,/header h1\{grid-column:1;grid-row:1;min-width:0;font-size:var\(--t-lg\);line-height:1\.1;white-space:nowrap\}/);
  assert.match(phone,/header h1::after\{display:none\}/);
  assert.match(phone,/\.unofficialTag\{grid-column:1;grid-row:2;justify-self:start;/);
  assert.match(phone,/\.themeToggle\{grid-column:3;grid-row:1 \/ 3;flex:0 0 auto;width:44px;min-width:44px;margin:0;padding:0;font-size:0;/);
});

test('on a 320px phone the tag goes and the item counts shorten to their number',()=>{
  const narrow=block('max-width:360px');
  assert.match(narrow,/\.unofficialTag\{display:none\}/);
  assert.match(narrow,/\.countChip\{font-size:0\}/);
  assert.match(narrow,/\.countChip::before\{content:attr\(data-short\);font-size:var\(--t-xs\)\}/);
  assert.match(html,/data-short="0"/);
});

test('the preview toolbar is as wide as the wrapper it sits in, on the desktop and in the phone overlay',()=>{
  assert.match(css,/\.previewToolbar\{[^}]*flex:0 0 calc\(100% \+ 2 \* var\(--s5\)\)/);
  const phone=block('max-width:700px');
  assert.match(phone,/body\.previewFull #previewWrapper \.previewToolbar\{display:flex;flex-basis:calc\(100% \+ 2 \* var\(--s3\)\);/);
});

test('the phone toolbar drops the status pills (the check grid has them) and keeps Fit, zoom, Measurements and Close',()=>{
  const phone=block('max-width:700px');
  assert.match(phone,/\.previewToolbar \.capubTopBar\{display:none\}/);
  assert.match(phone,/#previewCloseBtn\{display:inline-flex;align-items:center\}/);
  assert.doesNotMatch(phone,/#layoutShell\[data-step="export"\] \.previewToolCard/,'step 4 has no toolbar of its own any more: it is a peek, the overlay has the toolbar');
});

test('on a phone Extra shows the uniform as a peek, like Uniform and Items, so Check your uniform is on the first screen',()=>{
  const phone=block('max-width:700px');
  assert.match(phone,/#layoutShell\[data-step="uniform"\] #previewWrapper,#layoutShell\[data-step="items"\] #previewWrapper,#layoutShell\[data-step="export"\] #previewWrapper\{[^}]*height:var\(--peek-h\)/);
  assert.match(phone,/#layoutShell\[data-step="export"\] #uniformCanvas\{pointer-events:none\}/);
  assert.doesNotMatch(phone,/#layoutShell\[data-step="export"\] #previewWrapper\{display:flex;flex-wrap:wrap;overflow:visible/,'the full-width preview of step 4 is gone');
  assert.doesNotMatch(phone,/#layoutShell\[data-step="export"\] \.previewPeekBtn\{position:static/,'the Expand button sits in the peek on step 4 as on steps 2 and 3');
  const ui=fs.readFileSync(path.join(__dirname,'..','js','workspace-ui.js'),'utf8');
  assert.match(ui,/step==='uniform' \|\| step==='items' \|\| step==='export'\)\{\s*\/\/ The peek/);
  assert.doesNotMatch(ui,/window\.innerHeight\*\.46/);
});

test('the footer is one line on a phone, Unofficial · About · Feedback, with no overlap',()=>{
  const phone=block('max-width:700px');
  assert.match(phone,/#pageFooter\{gap:0;padding:0 var\(--s2\);font-size:0;line-height:1\}/);
  assert.match(phone,/#pageFooter>\*\{font-size:var\(--t-xs\)\}/);
  assert.match(phone,/\.footerLink\{display:inline-flex;align-items:center;margin:0 0 0 var\(--s2\);min-height:40px;padding:0 var\(--s2\);border-left:1px solid var\(--line\);border-radius:0;font-size:var\(--t-xs\)\}/);
  assert.doesNotMatch(phone,/\.footerLink::before/,'no drawn dots: the rule on the link is the separator');
  assert.match(html,/<span class="footerTiny">Unofficial<\/span>/);
});
