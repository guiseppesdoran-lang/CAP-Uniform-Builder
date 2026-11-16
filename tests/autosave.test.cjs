'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const { createDocument }=require('./helpers/mini-dom.cjs');

const source=fs.readFileSync(path.join(__dirname,'..','js','workspace-ui.js'),'utf8');
const module_=source.slice(source.indexOf('function capubAutosave'),source.indexOf('About dialog:'));

test('autosave keeps its own key; the old by-hand save is gone and Reset still clears both keys',()=>{
  assert.match(module_,/cap_uniform_builder_autosave_v1/);
  const wiring=fs.readFileSync(path.join(__dirname,'..','js','wiring.js'),'utf8');
  assert.match(wiring,/storageKey: 'cap_uniform_builder_profile_v2'/);
  assert.doesNotMatch(wiring,/capubV2SaveLocal|capubV2LoadLocal|Uniform setup saved in this browser|No saved setup found in this browser/);
  assert.doesNotMatch(source,/Save to browser/);
  assert.match(wiring,/localStorage\.removeItem\(CAPUB_V2\.storageKey\); localStorage\.removeItem\('cap_uniform_builder_autosave_v1'\)/);
});

test('a saved setup is only offered, never loaded silently',()=>{
  assert.match(module_,/Resume your last uniform\?/);
  const applyCalls=module_.match(/applyProfile\(/g)||[];
  assert.equal(applyCalls.length,1,'applyProfile is called from one place');
  assert.match(module_,/resume\.addEventListener\('click'[\s\S]*applyProfile\(saved\.profile\)/);
});

test('storage reads and writes cannot throw into the page',()=>{
  for(const fn of ['read','write','clear']){
    const m=new RegExp(`function ${fn}\\([^)]*\\)\\{\\s*try\\{`).exec(module_);
    assert.ok(m,`${fn} is wrapped in try/catch`);
  }
});

test('stored values reach the page only through textContent, and the empty page is never saved',()=>{
  assert.doesNotMatch(module_,/innerHTML/);
  assert.match(module_,/return !!\(profile && profile\.membership\)/);
});

test('calibration and garment masks stay out of the autosave',()=>{
  assert.match(module_,/delete p\.calib; delete p\.garmentMasks;/);
});

// The save and the card that offers the last uniform on return, run: the module's own code against a stand-in page, with the stored value kept between two visits.
function visit(storage,profile){
  const doc=createDocument();
  const wrap=doc.createElement('div'); wrap.id='previewWrapper';
  wrap.insertBefore=(node)=>wrap.append(node);
  doc.body.append(wrap);
  const timers=[], toasts=[], applied=[];
  const ctx={
    document:doc, console,
    localStorage:{ getItem:k=>storage.has(k)?storage.get(k):null, setItem:(k,v)=>storage.set(k,String(v)), removeItem:k=>storage.delete(k) },
    setTimeout:(fn,ms)=>{ timers.push({fn,ms}); return timers.length; }, clearTimeout:()=>{},
    matchMedia:()=>({matches:false}),
    CAPUB_V3:{ uniformName:id=>id==='blues_a'?'Blues: Class A':String(id) },
    CAPUB_V2:{ collectProfile:()=>JSON.parse(JSON.stringify(profile.current)), applyProfile:p=>applied.push(p) },
    capubToastShow:m=>toasts.push(m)
  };
  ctx.window=ctx; ctx.self=ctx;
  doc.visibilityState='visible';
  vm.runInNewContext(AUTOSAVE_SOURCE,ctx,{filename:'js/workspace-ui.js'});
  return { doc, ctx, timers, toasts, applied, wrap, run:ms=>{ const due=timers.filter(t=>ms===undefined||t.ms===ms); due.forEach(t=>timers.splice(timers.indexOf(t),1)); due.forEach(t=>t.fn()); }, fire:type=>(doc.listeners[type]||[]).forEach(fn=>fn({})) };
}
const AUTOSAVE_SOURCE=source.slice(source.indexOf('(function capubAutosave(){'),source.indexOf('// About dialog:'));
const SETUP={ membership:'cadet', rank:'C/Capt', uniform:'blues_a', ceremonial:false, ribbons:[{id:'a'},{id:'b'}], badges:['x'], patches:[], calib:{x:1}, garmentMasks:{y:1} };

test('the setup saves itself a moment after each change, and not before it has a membership',()=>{
  const storage=new Map(), profile={current:SETUP};
  const page=visit(storage,profile);
  page.run(350);   // the module starts a moment after the page loads
  assert.equal(storage.size,0,'nothing is written on load');
  page.fire('capub:history');
  assert.equal(storage.size,0,'not at once: after the delay');
  page.run(600);
  const saved=JSON.parse(storage.get('cap_uniform_builder_autosave_v1'));
  assert.equal(saved.profile.rank,'C/Capt');
  assert.equal(saved.profile.ribbons.length,2);
  assert.equal(typeof saved.savedAt,'number');
  assert.equal(saved.profile.calib,undefined,'calibration stays out');
  assert.equal(saved.profile.garmentMasks,undefined);
  // The empty page is not saved.
  const blank=new Map(), none=visit(blank,{current:{membership:'',rank:null,uniform:'blues_a'}});
  none.run(350);
  none.fire('capub:history'); none.run(600);
  assert.equal(blank.size,0);
  // A tab that is hidden saves at once, before the timer.
  const hidden=new Map(), tab=visit(hidden,profile);
  tab.run(350);
  tab.doc.visibilityState='hidden';
  tab.fire('visibilitychange');
  assert.ok(hidden.has('cap_uniform_builder_autosave_v1'));
});

test('on the next visit the last uniform is offered, never loaded until the member says Resume; Start over clears it',()=>{
  const storage=new Map([['cap_uniform_builder_autosave_v1',JSON.stringify({savedAt:Date.now()-5*60000,profile:SETUP})]]);
  const page=visit(storage,{current:{membership:'',rank:null}});
  page.run(350);   // the module looks for a saved setup a moment after the page loads
  const banner=page.doc.getElementById('capubResume');
  assert.ok(banner,'the card is on the page');
  assert.equal(banner.getAttribute('role'),'region');
  assert.equal(banner.getAttribute('aria-label'),'Resume your last uniform');
  assert.match(banner.textContent,/Resume your last uniform\?/);
  assert.match(banner.textContent,/C\/Capt · Blues: Class A · 3 items · saved 5 minutes ago/);
  assert.deepEqual(page.applied,[],'nothing is loaded silently');
  banner.querySelector('#capubResumeYes').click();
  assert.equal(page.applied.length,1);
  assert.equal(page.applied[0].uniform,'blues_a');
  assert.equal(page.doc.getElementById('capubResume'),null,'the card goes');
  assert.deepEqual(page.toasts,['Resumed your last uniform.']);
  assert.ok(storage.has('cap_uniform_builder_autosave_v1'),'what was saved stays until the next save');
  // Start over: the saved setup is cleared and the card goes, with nothing loaded.
  const again=visit(storage,{current:{membership:''}});
  again.run(350);
  again.doc.getElementById('capubResume').querySelector('#capubResumeNo').click();
  assert.equal(storage.has('cap_uniform_builder_autosave_v1'),false);
  assert.equal(again.doc.getElementById('capubResume'),null);
  assert.deepEqual(again.applied,[]);
  // Nothing saved, no card.
  const empty=visit(new Map(),{current:{membership:''}});
  empty.run(350);
  assert.equal(empty.doc.getElementById('capubResume'),null);
});
