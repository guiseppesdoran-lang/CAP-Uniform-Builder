'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rules=require('../data/uniform-rules.js');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const flow=read('js/guided-flow.js');
const state=read('js/state.js');
const html=read('index.html');
const css=read('styles/app.css');

test('the guided flow only runs behind ?ux=2',()=>{
  assert.match(state,/get\('ux'\) === '2'/);
  assert.match(state,/dataset\.ux = '2'/);
  assert.match(flow,/if\(typeof CAPUB_GUIDED==='undefined' \|\| !CAPUB_GUIDED\) return;/);
});

test('every guided rule is scoped to the flag so the normal page is untouched',()=>{
  const start=css.indexOf('/* ---- Guided flow (?ux=2)');
  const end=css.indexOf('/* ---- About dialog');
  const block=css.slice(start,end);
  const selectors=block.split('}').map(r=>r.split('{')[0].trim()).filter(s=>s && !s.startsWith('/*'));
  for(const sel of selectors){
    for(const part of sel.split(',').map(p=>p.trim())){
      assert.ok(/^html\[data-ux="2"\]/.test(part) || /\.guided/.test(part),`unscoped rule: ${part}`);
    }
  }
  // Classes the flow adds do not exist on the normal page, so bare .guided* rules cannot match there.
  assert.doesNotMatch(html,/class="[^"]*guided/);
});

test('it is loaded after the polish module it reads step status from',()=>{
  assert.ok(html.indexOf('js/workspace-ui.js')>0);
  assert.ok(html.indexOf('js/guided-flow.js')>html.indexOf('js/workspace-ui.js'));
});

test('uniforms are grouped by the regulation occasion groups and show why one is locked',()=>{
  assert.match(flow,/rules\(\)\.GROUPS/);
  assert.match(flow,/rules\(\)\.lockedReason\(/);
  assert.match(flow,/Your minimum uniform/);
  assert.deepEqual(Object.keys(rules.GROUPS),['formal','everyday','field']);
});

test('locked reasons name the paragraph and are empty when the member may wear it',()=>{
  assert.equal(rules.lockedReason('mess_dress','cadet'),'For senior members (CAPR 39-1, 4.1.1)');
  assert.equal(rules.lockedReason('corporate_field','cadet'),'For senior members (CAPR 39-1, 5.2.1)');
  assert.equal(rules.lockedReason('blues_a','cadet'),'');
  assert.equal(rules.lockedReason('mess_dress','senior'),'');
  assert.equal(rules.lockedReason('mess_dress',''),'');
});

test('Items never blocks Next, Profile and Uniform do',()=>{
  assert.match(flow,/\(step==='profile' \|\| step==='uniform'\) && !done\[step\]/);
});

test('rendering has a timer fallback for hidden tabs',()=>{
  assert.match(flow,/requestAnimationFrame\(run\);\s*setTimeout\(run,100\);/);
});
