'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html');
const css=read('styles/app.css');
const ui=read('js/workspace-ui.js');

test('the footer is one word and its links on a phone; the credit and the feedback form are in About',()=>{
  assert.match(html,/class="footerShort"/);
  assert.match(html,/class="footerTiny">Unofficial</);
  const phone=css.slice(css.indexOf('@media (max-width:700px)'),css.indexOf('@media (max-width:360px)'));
  assert.match(phone,/\.footerFull,\.footerShort,\.footerCredit\{display:none\}/);
  assert.match(phone,/\.footerTiny\{display:inline\}/);
  assert.match(phone,/:root\{--capub-footer-h:40px;/);
  const about=html.slice(html.indexOf('<dialog id="aboutDialog"'),html.indexOf('</dialog>'));
  assert.match(about,/Developed by C\/Col\. Guiseppe Doran and C\/Lt Col\. Ethan Hillard/);
  assert.match(about,/id="aboutFeedback"/);
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

test('the member-report importer is one button with its explanation in plain words, and the clear button appears with a result',()=>{
  const card=html.slice(html.indexOf('id="memberReportImportPanel"'),html.indexOf('id="capMembershipPanel"'));
  assert.match(card,/<button id="importMemberReportBtn" class="ghost" type="button">Import member report…<\/button>/);
  assert.doesNotMatch(card,/<details/,'nothing in the import card is folded away');
  assert.match(card,/<div class="hintText mt-8" id="memberReportImportMore">\s*Upload a CAP Member Search/);
  assert.ok(card.indexOf('id="memberReportImportStatus"')<card.indexOf('id="clearImportedReportBtn"'),'the clear button follows the status line');
  assert.match(ui,/const sync=\(\)=>\{ clear\.hidden=idle\(\); \};/);
  assert.match(ui,/new MutationObserver\(sync\)\.observe\(status,\{childList:true,characterData:true,subtree:true\}\)/);
});
