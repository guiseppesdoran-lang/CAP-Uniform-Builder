'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html');
const wiring=read('js/wiring.js');
const css=read('styles/app.css');

test('the picker has a footer with a live count and a Done button',()=>{
  assert.match(html,/id="galleryModalCount"[^>]*aria-live="polite"/);
  assert.match(html,/id="galleryModalDoneBtn"/);
  assert.match(css,/\.modalFooter\{/);
});

test('the count states the limit for badges and reads naturally for the rest',()=>{
  assert.match(wiring,/\$\{counted\} of \$\{cap\} badges selected/);
  assert.match(wiring,/ribbon\$\{count === 1 \? '' : 's'\} selected/);
  assert.match(wiring,/patch\$\{count === 1 \? '' : 'es'\} selected/);
});

test('Done closes the picker the same way Close does',()=>{
  assert.match(wiring,/modalDone\.addEventListener\('click', closeGalleryModal\)/);
});

test('the count is refreshed when the picker opens and after each pick',()=>{
  assert.match(wiring,/injectModalSearch\(kind\);\s*capubRefreshModalCount\(\);/);
  assert.match(wiring,/modalHost\.addEventListener\(evt, \(\) => setTimeout\(capubRefreshModalCount, 150\)\)/);
});
