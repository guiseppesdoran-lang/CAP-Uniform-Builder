'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const catalog=fs.readFileSync(path.join(__dirname,'..','js','catalog.js'),'utf8');
const galleries=fs.readFileSync(path.join(__dirname,'..','js','galleries.js'),'utf8');

function groupIds(){
  const start=catalog.indexOf('const RIBBON_GROUPS = [');
  const end=catalog.indexOf('];',start);
  return [...catalog.slice(start,end).matchAll(/ids:\[([^\]]*)\]/g)]
    .flatMap(m=>[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]));
}
function displayNames(){
  const start=catalog.indexOf('const RIBBON_DISPLAY_NAMES = {');
  const end=catalog.indexOf('};',start);
  return Object.fromEntries([...catalog.slice(start,end).matchAll(/^  ([A-Za-z0-9_]+):\s*(['"])(.*)\2,?\s*$/gm)].map(m=>[m[1],m[3]]));
}

test('no ribbon is in two groups',()=>{
  const ids=groupIds();
  assert.ok(ids.length>=50,'found the groups');
  assert.equal(new Set(ids).size,ids.length,'each id appears once');
});

test('groups follow CAPR 39-3 Attachment 2 order',()=>{
  const start=catalog.indexOf('const RIBBON_GROUPS = [');
  const labels=[...catalog.slice(start,catalog.indexOf('];',start)).matchAll(/key:'([a-z]+)'/g)].map(m=>m[1]);
  assert.deepEqual(labels,['usaf','decorations','profdev','aeroed','cadet','service','activity','wartime']);
});

test('ribbons that title-case badly have their official names',()=>{
  const names=displayNames();
  assert.equal(names.cap_achievment_award,'CAP Achievement Award');
  assert.equal(names.afa_award,'AFA Award to Unit Cadet of the Year');
  assert.equal(names.vfw_officer_award,'VFW Outstanding Cadet Officer of the Year Award');
  assert.equal(names.crisis_ribbon,'CAP Crisis Service Ribbon');
  assert.equal(names.spaatz_award,'Gen Carl A. Spaatz Award');
  assert.equal(names.iace_ribbon,'IACE Ribbon');
});

test('the picker is grouped, drops raw ids, and shows mini medals only where they are worn',()=>{
  assert.match(galleries,/groupRibbonIds\(visible\)/);
  assert.match(galleries,/CAPUBUniformRules\.allowsMiniMedals\(State\.uniform\)/);
  const start=galleries.indexOf('function buildRibbonGallery');
  const builder=galleries.slice(start,galleries.indexOf('\nfunction ',start+10));
  assert.doesNotMatch(builder,/'Not selected'/);
  assert.doesNotMatch(builder,/\(\$\{escapeHtml\(id\)\}\)<\/div>/);
});

const wiring=fs.readFileSync(path.join(__dirname,'..','js','wiring.js'),'utf8');
const state=fs.readFileSync(path.join(__dirname,'..','js','state.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

test('cadets can wear only their highest achievement ribbon (39-1 11.1.2.2), and it is saved with the setup',()=>{
  assert.match(state,/cadetHighestOnly:false/);
  assert.match(galleries,/State\.membership === 'cadet' && State\.cadetHighestOnly/);
  assert.match(galleries,/CADET_ACHIEVEMENT_RIBBONS\.has\(id\) && id !== highestCadetAward/);
  assert.match(wiring,/cadetHighestOnly: State\.cadetHighestOnly/);
  assert.match(wiring,/out\.cadetHighestOnly = !!p\.cadetHighestOnly/);
  assert.match(wiring,/State\.cadetHighestOnly = p\.cadetHighestOnly/);
  assert.match(html,/id="cadetHighestOnlyRow" class="hidden"/);
  assert.match(html,/<input type="checkbox" id="cadetHighestOnly">\s*Short Stack\s*<span class="hintText optionHint">Only the highest cadet achievement ribbon is worn \(CAPR 39-1, 11\.1\.2\.2\); the others stay selected\.<\/span>/);
});

test('the option is cadet-only and does not delete selections',()=>{
  const placement=fs.readFileSync(path.join(__dirname,'..','js','placement.js'),'utf8');
  assert.match(placement,/cadetHighestOnlyRow'\)\?\.classList\.toggle\('hidden', State\.membership !== 'cadet'\)/);
  // The filter skips the ribbon while building the rack; it never edits ribbonSelections.
  const block=galleries.slice(galleries.indexOf('const highestCadetAward'),galleries.indexOf('const highestCadetAward')+700);
  assert.doesNotMatch(block,/ribbonSelections\[[^\]]+\]\.checked\s*=/);
});

/* ---- A ribbon tile keeps one height (Ethan: "the ui keeps shifting down because tiles increase size") ---- */
const css=fs.readFileSync(path.join(__dirname,'..','styles','app.css'),'utf8');
const rule=sel=>{
  const i=css.indexOf(sel+'{');
  assert.ok(i>=0,`css rule ${sel}`);
  return css.slice(i,css.indexOf('}',i));
};

test('the picked line and the counting rule share one fixed device area and a fixed preview slot',()=>{
  // The area is always rendered, picked or not, so it always takes the same room.
  const builder=galleries.slice(galleries.indexOf('function buildRibbonGallery'));
  assert.match(builder,/<div class="ribbonDeviceArea">/);
  assert.doesNotMatch(builder,/<div class="sub ribbonRuleHint">/,'no detached rule paragraph');
  assert.match(rule('.ribbonDeviceArea'),/height:calc\(3 \* 1\.3 \* var\(--t-xs\)\)/);
  const summary=rule('.ribbonDeviceArea .ribbonDeviceSummary');
  assert.match(summary,/overflow:hidden/);
  assert.match(summary,/-webkit-line-clamp:3/);
  // The enlarged drawn preview and the plain picture share one fixed slot.
  const slot=css.match(/\.ribbonSelectorTile:not\(\.militaryRibbonSelectorTile\) > img,\s*\.ribbonSelectorTile:not\(\.militaryRibbonSelectorTile\) > svg\.ribbonPreviewSvg\{([^}]*)\}/);
  assert.ok(slot,'preview slot rule');
  assert.match(slot[1],/width:96px;height:56px/);
});

// LIVE14 E71 (Ethan: "you can remove those question mark things by some of the service ribbons").
test('no "?" counting-rule button: the rule is the line under the select until the ribbon is picked, and stays in that line\'s title and the select\'s',()=>{
  assert.doesNotMatch(galleries,/ribbonRuleBtn|ribbonRulePop|hasRule/);
  const builder=galleries.slice(galleries.indexOf('function buildRibbonGallery'),galleries.indexOf('function wireRibbonTileControls'));
  assert.match(builder,/const areaTitle = \[pickedText, ruleHint \? escapeHtml\(ruleHint\) : ''\]\.filter\(Boolean\)\.join\(' \\u2022 '\);/);
  assert.match(builder,/ribbonDeviceSummary"\$\{areaTitle \? ` title="\$\{areaTitle\}"` : ''\}>\$\{pickedLine \|\| \(ruleHint \? escapeHtml\(ruleHint\) : ''\)\}<\/div>/);
  assert.match(builder,/<select class="rbAwardSelect" data-ribbon-id="\$\{escapeHtml\(id\)\}"\$\{ruleHint \? ` title="\$\{escapeHtml\(ruleHint\)\}"` : ''\}>/);
  const ra=require('../data/ribbon-awards.js');
  for(const id of ['cadet_recruiter_ribbon','cap_senior_recruiter_ribbon','search_find_ribbon','air_search_and_rescue_ribbon','iace_ribbon','crisis_ribbon'])
    assert.ok(ra.hint(id),`${id} has a rule note`);
});

test('in a real browser, picking three ribbons with devices moves no tile and changes no tile height (needs Chrome)',{timeout:180000},t=>{
  const chrome=process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r=require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'ribbon-picker-browser.cjs')],{encoding:'utf8',timeout:150000});
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.match(r.stdout,/PASS: \d+ tiles kept their height and position/);
});
