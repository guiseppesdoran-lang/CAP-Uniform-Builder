const test = require('node:test');
const { readAppSource } = require('./helpers/app-source.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexSource = readAppSource();
const styleSource = fs.readFileSync(path.join(__dirname, '..', 'styles', 'app.css'), 'utf8');

test('CAP miniature medal resolver uses canonical military representations', () => {
  assert.match(indexSource, /getAwardRepresentation\?\.\(award,'MINIATURE_MEDAL'\)\?\.status !== 'NOT_APPLICABLE'/);
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

test('no picker has a select-all, select-max or add-all control: ribbons, badges, patches, military badges and devices keep Clear only (Ethan: make sure that the select all buttons for everything are gone)', () => {
  const sources = [indexSource];
  const jsDir = path.join(__dirname, '..', 'js');
  for(const f of fs.readdirSync(jsDir).filter(n => n.endsWith('.js'))) sources.push(fs.readFileSync(path.join(jsDir, f), 'utf8'));
  const bulk = /select[\s_-]*all|select[\s_-]*max|add[\s_-]*all|check[\s_-]*all|tick[\s_-]*all|toggle[\s_-]*all|choose[\s_-]*all/i;
  sources.forEach(src => assert.doesNotMatch(src, bulk));
  for(const id of ['clearRibbons', 'clearBadges', 'clearPatches']) assert.match(indexSource, new RegExp(`id="${id}"`));
  // The modal's Show All / Show Less only widen the list of what is on offer; they select nothing.
  assert.match(indexSource, /modalShowAll/);
});
