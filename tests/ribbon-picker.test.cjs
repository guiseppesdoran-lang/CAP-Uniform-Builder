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

const lists=fs.readFileSync(path.join(__dirname,'..','js','pick-lists.js'),'utf8');
const ribbonCode=lists.slice(lists.indexOf('// ---- ribbons'),lists.indexOf('return { badgeList'));

test('the picker is grouped, drops raw ids, and shows mini medals only where they are worn',()=>{
  assert.match(ribbonCode,/ribbonGroups\(capIds\)/);
  assert.match(lists,/CAPUBUniformRules\.allowsMiniMedals\(State\.uniform\)/);
  assert.doesNotMatch(ribbonCode,/Not selected/);
  assert.doesNotMatch(ribbonCode,/- Select -/,'off is the tile\'s tap, not a choice in the select');
  assert.doesNotMatch(ribbonCode,/escapeHtml\(id\)|\(\$\{id\}\)/,'no raw id in the text');
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
  assert.match(html,/<input type="checkbox" id="cadetHighestOnly" tabindex="-1">\s*Short Stack\s*<span class="hintText optionHint">Only the highest cadet achievement ribbon is worn \(CAPR 39-1, 11\.1\.2\.2\); the others stay selected\.<\/span>/);
});

test('the option is cadet-only and does not delete selections',()=>{
  const placement=fs.readFileSync(path.join(__dirname,'..','js','placement.js'),'utf8');
  assert.match(placement,/cadetHighestOnlyRow'\)\?\.classList\.toggle\('hidden', State\.membership !== 'cadet'\)/);
  // The filter skips the ribbon while building the rack; it never edits ribbonSelections.
  const block=galleries.slice(galleries.indexOf('const highestCadetAward'),galleries.indexOf('const highestCadetAward')+700);
  assert.doesNotMatch(block,/ribbonSelections\[[^\]]+\]\.checked\s*=/);
});

/* ---- The ribbon tiles (the picture picker's toggle mode) ---- */
const css=fs.readFileSync(path.join(__dirname,'..','styles','app.css'),'utf8');
const rule=sel=>{
  const i=css.indexOf(sel+'{');
  assert.ok(i>=0,`css rule ${sel}`);
  return css.slice(i,css.indexOf('}',i));
};

test('a ribbon\'s picture box is wide and low (a ribbon is 3.7 times as wide as high), its controls are under the tile only while it is on, and its picked line is clamped to three lines',()=>{
  assert.match(rule('.vp[data-size="large"][data-shape="wide"] .vpPicture'),/aspect-ratio:3 \/ 1/);
  const summary=rule('.vpControls .ribbonDeviceSummary');
  assert.match(summary,/overflow:hidden/);
  assert.match(summary,/-webkit-line-clamp:3/);
  // The controls are made only for a ribbon that is on.
  assert.match(ribbonCode,/controls: isOn => isOn \? ribbonControls\(d, id, military, after\) : null/);
  assert.match(ribbonCode,/name: spec\.name, mode: 'toggle', size: 'large', shape: 'wide'/);
});

// LIVE14 E71 (Ethan: "you can remove those question mark things by some of the service ribbons").
test('no "?" counting-rule button: the rule is in the title of the picked line and of the select',()=>{
  assert.doesNotMatch(galleries+lists,/ribbonRuleBtn|ribbonRulePop|hasRule/);
  assert.match(ribbonCode,/if\(hint\) select\.setAttribute\('title', hint\);/);
  assert.match(ribbonCode,/const title = \[`Selected: \$\{picked\.label\}\$\{picked\.rest\}`, hint\]\.filter\(Boolean\)\.join\('[^']+'\);\s*line\.setAttribute\('title', title\);/);
  const ra=require('../data/ribbon-awards.js');
  for(const id of ['cadet_recruiter_ribbon','cap_senior_recruiter_ribbon','search_find_ribbon','air_search_and_rescue_ribbon','iace_ribbon','crisis_ribbon'])
    assert.ok(ra.hint(id),`${id} has a rule note`);
});

test('in a real browser, the ribbons are picture tiles, a tap turns one on with its controls under it, and the rule is kept in the picked line (needs Chrome)',{timeout:180000},t=>{
  const chrome=process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r=require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'ribbon-picker-browser.cjs')],{encoding:'utf8',timeout:150000});
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.match(r.stdout,/^PASS$/m);
});
