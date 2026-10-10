'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const core=fs.readFileSync(path.join(__dirname,'..','purchase-feature-core.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','styles','app.css'),'utf8');

test('every cell of the item table is labelled so it can stand alone on a phone',()=>{
  for(const label of ['Include','Own it','Item','Quantity','Where to buy','Price']){
    assert.ok(core.includes(`data-label="${label}"`),`${label} cell is labelled`);
  }
});

test('the phone layout is one card per item and never hides the item name',()=>{
  const block=css.slice(css.indexOf('@media (max-width:760px){\n  .capub-purchase-summary'));
  assert.doesNotMatch(block,/nth-child\(3\)\)?[^}]*display:none/);
  assert.match(block,/\.capub-purchase-table td\[data-label="Item"\]\{order:-1/);
  assert.match(block,/\.capub-purchase-table,\.capub-purchase-table tbody,\.capub-purchase-table tr,\.capub-purchase-table td\{display:block;width:100%\}/);
});

test('the long sourcing note is folded, and its words are unchanged',()=>{
  assert.match(core,/<details class="capub-purchase-rule"><summary><b>How items are sourced<\/b><\/summary>/);
  assert.match(core,/A visually similar USAF or other military item is not treated as a substitute\./);
});

test('include and own-it checkboxes are 44px rows on a phone',()=>{
  assert.match(css,/td\[data-label="Include"\],\.capub-purchase-table td\[data-label="Own it"\]\{display:flex;align-items:center;min-height:44px\}/);
});
