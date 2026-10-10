'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html');
const css=read('styles/app.css');
const ui=read('js/workspace-ui.js');
const flow=read('js/guided-flow.js');

test('the footer is two short lines on a phone and the credit moves to About',()=>{
  assert.match(html,/class="footerShort"/);
  assert.match(css,/@media \(max-width:480px\)\{\s*\.footerFull,\.footerCredit\{display:none\}/);
  const about=html.slice(html.indexOf('<dialog id="aboutDialog"'),html.indexOf('</dialog>'));
  assert.match(about,/Developed by C\/Col\. Guiseppe Doran and C\/Lt Col\. Ethan Hillard/);
  assert.match(css,/:root\{--capub-footer-h:52px\}/);
});

test('the controls and the preview are labelled regions, and the preview says what it shows',()=>{
  assert.match(html,/<aside id="controls" aria-label="Uniform controls">/);
  assert.match(html,/<section id="previewWrapper" aria-label="Uniform preview">/);
  assert.match(ui,/area\.setAttribute\('aria-label'/);
  assert.match(ui,/Select an item to remove it/);
});

test('on a phone the scaled uniform is centred beside the sheet',()=>{
  assert.match(ui,/area\.style\.marginLeft=free>0 \? Math\.round\(free\/2\)\+'px' : ''/);
});

test('the member-report importer is a folded shortcut in the guided flow, and opens on a result',()=>{
  assert.match(flow,/Have a CAP member report\? Import it to fill this in/);
  assert.match(flow,/new MutationObserver\(\(\)=>\{ if\(status\.textContent!==first\) more\.open=true; \}\)/);
});
