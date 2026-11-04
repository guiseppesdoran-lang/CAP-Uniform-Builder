'use strict';
// The phone is a stack, not a bottom sheet (LIVE13 E105, Ethan: "the mobile UI/UX. should be different and functional"):
// app bar, the step strip stuck under it, the preview as a peek or at full width, the step as the page, a fixed action
// bar over the one-line footer. Above 700px the panel sits beside the preview at every width; nothing slides or drags.

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=read('styles/app.css');
const ui=read('js/workspace-ui.js');
const html=read('index.html');

function block(query){
  const start=css.indexOf(`@media (${query})`);
  assert.ok(start>=0,`has a ${query} block`);
  let depth=0,i=css.indexOf('{',start);
  const begin=i;
  for(;i<css.length;i++){ if(css[i]==='{') depth++; if(css[i]==='}'){ depth--; if(depth===0) break; } }
  return css.slice(begin,i+1);
}

test('there is no bottom sheet; the menu button hides and shows the panel on a desktop and is gone on a phone',()=>{
  for(const f of ['index.html','styles/app.css','js/workspace-ui.js']) assert.doesNotMatch(read(f),/sheetGrip|sheetHandle|sheetTall|sheetDragging|wireSheet|--sheet-h/,f);
  assert.doesNotMatch(html,/id="sheetClose"/);
  assert.match(css,/\.hamburgerBtn\{display:none\}/,'hidden by default, so a phone has none');
  const wide=block('min-width:701px');
  assert.match(wide,/\.hamburgerBtn\{[^}]*display:flex;/,'shown above 700px');
  assert.match(html,/<button id="hamburgerBtn" class="hamburgerBtn" type="button" aria-label="Hide the controls" title="Hide the controls" aria-controls="controls" aria-expanded="true">/);
  const setup=read('js/setup.js');
  assert.match(setup,/const menuLabel = open \? 'Hide the controls' : 'Show the controls';/);
  assert.match(ui,/if\(typeof capubSetSidebarOpen==='function'\) capubSetSidebarOpen\(true\);\s*\/\/ The tabs and footer work from the first paint/);
  assert.match(ui,/const PHONE_QUERY='\(max-width:700px\)';/);
});

test('to 700px the page is a stack: the panel\'s parts become siblings of the preview in order, under a sticky step strip',()=>{
  const phone=block('max-width:700px');
  assert.match(phone,/#layoutShell\{position:static;display:flex;flex-direction:column;overflow:visible\}/);
  assert.match(phone,/#controls,#layoutShell\.sidebar-open #controls,#layoutShell\.sidebar-collapsed #controls\{display:contents\}/);
  assert.match(phone,/\.controlsHeader\{order:0;position:sticky;top:0;z-index:60;width:100%;/);
  assert.match(phone,/#previewWrapper\{order:1\}/);
  assert.match(phone,/#stepBody\{order:2;width:100%;overflow:visible;padding:var\(--s3\) var\(--s3\) calc\(var\(--phone-bar-h\) \+ var\(--chrome-footer-h,var\(--capub-footer-h\)\) \+ var\(--s4\)\)\}/);
  assert.match(phone,/:root\{--capub-footer-h:40px;--phone-bar-h:72px;--peek-h:148px\}/);
});

test('the action bar is fixed over the footer, 48px tall, inset for the home bar; the app bar carries Undo, Redo and the theme as icons',()=>{
  const phone=block('max-width:700px');
  assert.match(phone,/\.controlsFooter\{\s*position:fixed;\s*left:0;\s*right:0;\s*bottom:var\(--chrome-footer-h,var\(--capub-footer-h\)\);\s*z-index:70;\s*padding:var\(--s2\) var\(--s3\) calc\(var\(--s2\) \+ env\(safe-area-inset-bottom,0px\)\);/);
  assert.match(phone,/\.stepFooterRow button\{min-height:48px\}/);
  assert.match(phone,/\.themeToggle\{[^}]*width:44px;min-width:44px;[^}]*font-size:0;/);
  assert.match(phone,/header #undoBtn::before\{content:"\\21B6"\}/);
  assert.match(phone,/header #redoBtn::before\{content:"\\21B7"\}/);
  assert.match(ui,/if\(phone && history\.parentNode!==header\) header\.insertBefore\(history, safeBy\('themeToggle'\)\);/);
  assert.match(ui,/else if\(!phone && history\.parentNode!==tools\) tools\.insertBefore\(history, tools\.firstChild\);/);
  assert.match(ui,/id="undoBtn" aria-label="Undo"/);
  assert.match(ui,/id="redoBtn" aria-label="Redo"/);
});

test('the preview: hidden on step 1, a peek on 2 and 3, in the page on 4, full-screen on demand with its own Close',()=>{
  const phone=block('max-width:700px');
  assert.match(phone,/#previewWrapper\{display:none;flex:0 0 auto;width:100%;/);
  assert.match(phone,/#layoutShell\[data-step="uniform"\] #previewWrapper,#layoutShell\[data-step="items"\] #previewWrapper\{\s*display:flex;\s*position:relative;\s*height:var\(--peek-h\);\s*cursor:pointer;/);
  assert.match(phone,/#layoutShell\[data-step="uniform"\] #uniformCanvas,#layoutShell\[data-step="items"\] #uniformCanvas\{pointer-events:none\}/,'a tap on the peek opens it, not an item');
  assert.match(phone,/#layoutShell\[data-step="export"\] #previewWrapper\{display:flex;flex-wrap:wrap;overflow:visible;/);
  assert.match(phone,/body\.previewFull #previewWrapper,body\.previewFull #layoutShell\[data-step\] #previewWrapper\{\s*display:flex;\s*flex-wrap:wrap;\s*position:fixed;\s*inset:0;\s*z-index:11000;/);
  assert.match(phone,/body\.previewFull #previewWrapper \.previewToolbar\{display:flex;[^}]*position:sticky;top:0;/);
  assert.match(html,/<button type="button" id="previewPeekBtn" class="ghost previewPeekBtn" aria-label="Open the preview full screen" hidden>Expand<\/button>/);
  assert.match(ui,/id="previewCloseBtn" hidden>Close<\/button>/);
  assert.match(ui,/const shell=safeBy\('layoutShell'\); if\(shell\) shell\.setAttribute\('data-step',activeStep\);/);
  assert.match(ui,/if\(e\.key==='Escape' && isPreviewFull\(\)\) closePreview\(\);/);
  // The zoom fits the peek strip and the full screen.
  assert.match(ui,/const room=wrap\.clientHeight-16;\s*if\(room>40\) z=Math\.min\(z, Math\.max\(\.12, room\/previewHeight\)\);/);
  assert.match(ui,/const room=window\.innerHeight-\(toolbar \? toolbar\.offsetHeight : 0\)-40;/);
});

test('above 700px the panel sits beside the preview, narrower on a tablet; pickers two across there',()=>{
  const desktop=block('min-width:701px');
  assert.doesNotMatch(desktop,/#layoutShell\.sidebar-collapsed #controls\{width:var\(--sidebar-w\)/,'a collapsed panel stays collapsed on a desktop');
  assert.match(css,/#layoutShell\.sidebar-collapsed #controls\{\s*width:0;/);
  const tablet=block('min-width:701px) and (max-width:1024px');
  assert.match(tablet,/:root\{--sidebar-w:340px\}/);
  assert.match(tablet,/\.modal \.galleryGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(ui,/const onChange=\(\)=>\{ syncPhoneChrome\(\); if\(typeof capubSetSidebarOpen==='function'\) capubSetSidebarOpen\(true\);/);
});
