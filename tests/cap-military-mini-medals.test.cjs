const test = require('node:test');
const { readAppSource } = require('./helpers/app-source.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexSource = readAppSource();
const styleSource = fs.readFileSync(path.join(__dirname, '..', 'styles', 'app.css'), 'utf8');

test('CAP miniature medal resolver uses canonical military representations', () => {
  assert.match(indexSource, /getAwardRepresentation\?\.\(award,'MINIATURE_MEDAL'\)/);
  assert.match(indexSource, /representation\?\.available && representation\.asset/);
});

test('calibrator stays within the visible viewport', () => {
  assert.match(styleSource, /width:min\(360px,calc\(100vw - 42px\)\)/);
  assert.match(styleSource, /grid-template-columns:minmax\(0,1fr\) 68px/);
  assert.match(styleSource, /#calibKeyPill\{[\s\S]*?overflow-wrap:anywhere/);
});

test('the ribbon picker has a Clear control and no select-all or select-max control (Ethan: remove the select all button for ribbons)', () => {
  assert.match(indexSource, /id="clearRibbons"/);
  assert.doesNotMatch(indexSource, /capSelectAllBasic|modalSelectAllBasic|selectAllCapUniformAwards|Select all \(basic\)/);
  assert.doesNotMatch(indexSource, /SelectAllMax|Select max devices/);
  assert.match(indexSource, /getEligibleRibbonIds\(\)/);
});
