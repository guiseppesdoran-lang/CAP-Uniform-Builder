'use strict';
// The controls panel is a stepper (LIVE13 E102, Ethan: "UX needs to be completely redone. the scrolling mechanic is
// not obvious. needs to be a good UX"): four step tabs in a fixed header, one step's controls in the body, Back and
// Next in a fixed footer. The markup is read from index.html; the behaviour (js/workspace-ui.js capubV3PolishedUI)
// runs here against a small DOM stand-in built from that markup's ids, so the states, the gating and the labels are
// the module's own.

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const rules=require('../data/uniform-rules.js');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html');
const css=read('styles/app.css');
const ui=read('js/workspace-ui.js');
const aside=html.slice(html.indexOf('<aside id="controls"'),html.indexOf('</aside>'));
const stepOf=id=>{
  const at=aside.indexOf(`id="${id}"`);
  const groups=[...aside.matchAll(/id="stepGroup-([a-z]+)"/g)].filter(m=>m.index<at);
  return groups.length ? groups[groups.length-1][1] : null;
};

/* ---------- markup ---------- */

// Every control id the old one-column sidebar had, each still present exactly once (the wiring looks controls up by id).
// stepGroup-tools, the "More tools" fold, went (its contents live in steps 3 and 4), and the Quick strip panel went with its
// feature (LIVE13: a Remove ribbons box on the ribbons card instead).
const OLD_IDS=['controls','stepGroup-profile','memberReportImportPanel','importMemberReportBtn','clearImportedReportBtn','memberReportUpload','memberReportImportStatus','capMembershipPanel','membershipLabel','membershipType','adultCadetRow','adultCadetCheckbox','rankSetupSelect','cadetFirstSergeantBlock','cadetFirstSergeantCheckbox','optionalName','capubV2TextPanel','firstNameRow','capubV2FirstName','capubV2LastName','plateLineRow','capubV2PlateLine','capubV2ShowText','stepGroup-uniform','genderBlock','cutLabel','jacketSelect','uniformBlock','uniformList','garmentOptionsPanel','garmentOptions','shoulderCordPanel','shoulderCordSelect','shoulderCordNote','stepGroup-items','groupRibbons','clearRibbons','expandRibbons','cadetHighestOnlyRow','cadetHighestOnly','ribbonGallery','miniMountStyle','groupBadges','badgesPlannedNote','clearBadges','expandBadges','badgeGallery','groupPatches','clearPatches','expandPatches','unitPatchSearch','unitPatchSelect','unitPatchStatus','patchGallery','stepGroup-export','capubV2StatusPanel','capubV2RibbonCount','capubV2BadgeCount','capubV2PatchCount','capubV2WarningCount','capubV2Notices','finishPanel','downloadImage','purchaseListSlot','capubV2ExportJson','capubV2ImportBtn','capubV2ImportFile','ribbonRackPanel','ribbonRackColumns','ribbonRackColumnsHint','ribbonRackArrangement','ribbonRackArrangementHint','ribbonRowOverridePanel','ribbonRowOverrideEnabled','ribbonRowOverrideControls','ribbonRowOverrideGrid','addRibbonOverrideRow','removeRibbonOverrideRow','ribbonRowOverrideStatus','capubV2QuickPanel','capubV2SaveLocal','capubV2LoadLocal','capubV2Reset'];

test('every control id of the old sidebar is still on the page exactly once',()=>{
  const ids=[...html.matchAll(/(?<![-\w])id="([^"]+)"/g)].map(m=>m[1]);
  const count=id=>ids.filter(x=>x===id).length;
  for(const id of OLD_IDS) assert.equal(count(id),1,`id="${id}"`);
  assert.equal(count('stepGroup-tools'),0,'the More tools fold is gone');
  assert.equal(count('sheetClose')+count('sheetHandle'),0,'the bottom sheet is gone');
  assert.equal(count('quickStripPanel')+count('quickStripBtn')+count('quickStripHint'),0,'the quick strip is gone');
  assert.equal(count('removeRibbons'),1);
  const dupes=ids.filter((id,i)=>ids.indexOf(id)!==i);
  assert.deepEqual(dupes,[],'no id twice');
  // The gallery divs stay for the modal plumbing.
  for(const id of ['ribbonGallery','badgeGallery','patchGallery']) assert.match(aside,new RegExp(`<div id="${id}" class="galleryGrid"></div>`));
});

test('the panel reads top to bottom: tabs, one step, footer; no instructions about the panel',()=>{
  assert.match(aside,/<div class="stepTabs" role="tablist" aria-label="Steps">/);
  const tabs=[...aside.matchAll(/<button type="button" role="tab" id="stepTab-([a-z]+)" class="stepTab" data-step="\1" aria-controls="stepGroup-\1"[^>]*><span class="stepNum">(\d)<\/span><span class="stepLabel">([^<]+)<\/span><\/button>/g)].map(m=>[m[1],m[2],m[3]]);
  assert.deepEqual(tabs,[['profile','1','Profile'],['uniform','2','Uniform'],['items','3','Items'],['export','4','Extra']]);
  assert.ok(aside.indexOf('class="stepTabs"')<aside.indexOf('id="stepBody"') && aside.indexOf('id="stepBody"')<aside.indexOf('id="stepFooter"'));
  assert.match(aside,/<div class="controlsFooter" id="stepFooter">[\s\S]*<button type="button" id="stepBack" class="ghost stepBack" hidden>Back<\/button>\s*<button type="button" id="stepNext" class="stepNext">Next: Uniform<\/button>/);
  for(const words of ['Work down the steps','capubSectionHint','Uniform Builder Controls','Choose profile, select uniform']) assert.ok(!html.includes(words) && !ui.includes(words) && !css.includes(words),`"${words}" is gone`);
  assert.doesNotMatch(aside,/<h3 class="stepGroupTitle"[^>]*>\d/,'the steps are not numbered twice');
});

test('only the first step is shown before the scripts run; each step is a tabpanel of its tab',()=>{
  for(const step of ['profile','uniform','items','export']){
    const re=new RegExp(`<div class="stepGroup" id="stepGroup-${step}" role="tabpanel" aria-labelledby="stepTab-${step}"( hidden)?>`);
    const m=re.exec(aside);
    assert.ok(m,`step ${step}`);
    assert.equal(!!m[1],step!=='profile',`${step} hidden`);
  }
});

test('the controls sit in the step they belong to; the cut is part of the profile',()=>{
  const where={
    profile:['memberReportImportPanel','membershipType','rankSetupSelect','jacketSelect','adultCadetCheckbox','cadetFirstSergeantCheckbox','optionalName'],
    uniform:['uniformList','garmentOptionsPanel','shoulderCordSelect'],
    items:['expandRibbons','clearRibbons','cadetHighestOnly','removeRibbons','miniMountStyle','ribbonRackColumns','ribbonRowOverridePanel','expandBadges','badgesPlannedNote','expandPatches','unitPatchSearch','unitPatchSelect'],
    export:['capubV2StatusPanel','capubV2Notices','downloadImage','purchaseListSlot','capubV2ExportJson','capubV2ImportBtn','capubV2SaveLocal','capubV2LoadLocal','capubV2Reset']
  };
  for(const [step,ids] of Object.entries(where)) for(const id of ids) assert.equal(stepOf(id),step,`${id} is in step ${step}`);
  assert.ok(aside.indexOf('id="rankSetupSelect"')<aside.indexOf('id="genderBlock"') && aside.indexOf('id="genderBlock"')<aside.indexOf('id="optionalName"'),'rank, then cut, then the name');
});

test('the Items step is three cards, each one row of name, count, Choose… and Clear, the rule under it',()=>{
  for(const [key,Key] of [['ribbons','Ribbons'],['badges','Badges'],['patches','Patches']]){
    const card=aside.slice(aside.indexOf(`data-card="${key}"`),aside.indexOf('</section>',aside.indexOf(`data-card="${key}"`)));
    assert.match(card,new RegExp(`<div class="cardRow">\\s*<div class="cardHead">\\s*<label class="fieldLabel">${Key}</label>\\s*<span class="countChip" data-count="${key}" data-short="0" aria-live="polite">0 selected</span>\\s*</div>\\s*<button id="expand${Key}" type="button" aria-label="Choose ${key}">Choose…</button>\\s*<button id="clear${Key}" class="ghost" type="button" aria-label="Clear ${key}">Clear</button>\\s*</div>\\s*<div class="hintText cardRule" data-rule="${key}">`));
  }
  assert.match(css,/\.cardRow\{display:grid;grid-template-columns:minmax\(0,1fr\) auto auto;/);
  assert.match(css,/#capubSubmitPatchButton\{grid-column:1 \/ -1;/,'the patch submission button wraps under the row');
  assert.match(aside,/<summary>Advanced: rack layout<\/summary>/);
});

test('the uniform cards are one flat two-column grid in the regulation\'s order, no headings; locked ones fold away with their reasons',()=>{
  const list=aside.slice(aside.indexOf('id="uniformList"'),aside.indexOf('id="lockedUniforms"'));
  const ids=[...list.matchAll(/data-uniform-id="([a-z_]+)"/g)].map(m=>m[1]);
  assert.deepEqual(ids,['blues_a','blues_b','mess_dress','semi_formal','semi_formal_usaf','aviator','aviator_blazer','polo','corporate_field','abu','ocp','flight_suit','corporate_flight_suit']);
  assert.deepEqual([...ids].sort(),Object.keys(rules.RULES).sort(),'every uniform the rules know, once');
  assert.doesNotMatch(aside,/uniformGroup|uniformGroupTitle|Field and flight|>Formal<|>Everyday</,'no occasion headings');
  assert.equal([...list.matchAll(/<div class="uniformGrid">/g)].length,1,'one grid');
  assert.equal([...aside.matchAll(/class="uniformOption"/g)].length,Object.keys(rules.RULES).length);
  assert.match(css,/\.uniformGrid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css,/\.uniformOption\.locked\{display:none\}/);
  assert.match(aside,/<details class="lockedFold" id="lockedUniforms" hidden>/);
  // Headgear, sleeves, skirt and the cord fold under one line whose text says what is chosen.
  assert.match(aside,/<details class="moreDetails optionsFold" id="uniformOptionsMore">\s*<summary id="uniformOptionsSummary">Uniform options<\/summary>/);
  assert.match(ui,/summary\.textContent=picks\.length \? `Uniform options: \$\{picks\.join\(' · '\)\}` : 'Uniform options';/);
});

test('the floating command bar and the ?ux=2 flag are gone from every file',()=>{
  const files=['index.html','styles/app.css','js/state.js','js/workspace-ui.js','js/wiring.js','js/bootstrap.js','js/guided-flow.js'];
  for(const f of files){
    const src=read(f);
    assert.doesNotMatch(src,/capubCommandBar|cmdRibbons|cmdDownload|cmdTemplates|cmdValidate/,f);
    assert.doesNotMatch(src,/data-ux|CAPUB_GUIDED/,f);
  }
  // The scroll cue: a fade above the footer and a More below button while the body has more below the fold.
  assert.match(css,/#controls\.hasMoreBelow \.controlsFooter::before\{opacity:1\}/);
  assert.match(aside,/<button type="button" id="stepMoreBtn" class="ghost stepMoreBtn" hidden>More below ↓<\/button>/);
  assert.match(ui,/const hasMore=!isPhone\(\) && body\.scrollHeight-body\.clientHeight-body\.scrollTop>2;/);
  assert.match(ui,/if\(more\) more\.hidden=!hasMore;/);
});

test('phone CSS: a stack with a sticky step strip, a fixed 48px action bar over the one-line footer, 16px fields, full-screen pickers',()=>{
  const start=css.indexOf('@media (max-width:700px)');
  const phone=css.slice(start,css.indexOf('@media (max-width:360px)',start));
  assert.match(phone,/#controls,#layoutShell\.sidebar-open #controls,#layoutShell\.sidebar-collapsed #controls\{display:contents\}/);
  assert.match(phone,/\.controlsHeader\{order:0;position:sticky;top:0;/);
  assert.match(phone,/#previewWrapper\{order:1\}/);
  assert.match(phone,/#stepBody\{order:2;/);
  assert.match(phone,/\.controlsFooter\{\s*position:fixed;\s*left:0;\s*right:0;\s*bottom:var\(--chrome-footer-h,var\(--capub-footer-h\)\);/);
  assert.match(phone,/padding:var\(--s2\) var\(--s3\) calc\(var\(--s2\) \+ env\(safe-area-inset-bottom,0px\)\);/);
  assert.match(phone,/\.stepFooterRow button\{min-height:48px\}/);
  assert.match(phone,/\.controlsFooter::before,\.stepMoreBtn\{display:none\}/,'no scroll cue on a phone: the page scrolls');
  assert.match(phone,/select,input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="range"\]\)\{font-size:16px\}/);
  assert.match(phone,/\.modal\{width:100vw;height:100vh;height:100dvh;border-radius:0;border:0\}/);
  assert.match(phone,/\.uniformGrid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(phone,/\.uniformOption\{min-height:56px\}/);
  // The peek and the overlay.
  assert.match(phone,/#layoutShell\[data-step="uniform"\] #previewWrapper,#layoutShell\[data-step="items"\] #previewWrapper\{\s*display:flex;\s*position:relative;\s*height:var\(--peek-h\);/);
  assert.match(phone,/#layoutShell\[data-step="export"\] #previewWrapper\{display:flex;/);
  assert.match(phone,/body\.previewFull #previewWrapper,body\.previewFull #layoutShell\[data-step\] #previewWrapper\{\s*display:flex;\s*flex-wrap:wrap;\s*position:fixed;\s*inset:0;/);
  assert.match(phone,/#previewWrapper\{display:none;/,'hidden on step 1');
  // The footer collapses to one word and its links, each drawing its own separator.
  assert.match(phone,/\.footerFull,\.footerShort,\.footerCredit\{display:none\}/);
  assert.match(phone,/\.footerTiny\{display:inline\}/);
  assert.match(phone,/#pageFooter\{gap:0;padding:0 var\(--s2\);font-size:0;line-height:1\}/);
  assert.match(phone,/\.footerLink\{[^}]*border-left:1px solid var\(--line\);/);
  assert.match(html,/<span class="footerTiny">Unofficial<\/span>/);
  assert.match(html,/<button type="button" id="aboutFeedback" class="ghost" hidden>Send feedback<\/button>/);
  assert.match(ui,/feedback\.addEventListener\('click', \(\) => \{ dialog\.close\(\); window\.CAPUBFeedback\?\.open\(\); \}\);/);
  // No sheet, no menu button, anywhere.
  for(const f of ['index.html','styles/app.css','js/workspace-ui.js']) assert.doesNotMatch(read(f),/sheetGrip|sheetHandle|sheetTall|wireSheet/,f);
  assert.match(css,/\.hamburgerBtn\{display:none\}/);
});

/* ---------- behaviour: the module against a DOM stand-in built from the page's ids ---------- */

function makeDom(){
  const byId=new Map();
  const all=[];
  class Node{
    constructor(tag,attrs={}){
      this.tagName=tag.toUpperCase(); this.children=[]; this.parentNode=null; this.listeners={};
      this.attrs={}; this.classes=new Set(); this.hidden=false; this.disabled=false; this.tabIndex=0; this.textContent='';
      this.style={setProperty(k,v){ this[k]=v; }}; this.dataset={}; this.scrollTop=0; this.scrollHeight=0; this.clientHeight=0; this.offsetWidth=450; this.offsetHeight=600; this.clientWidth=1000;
      this.focused=0; this.scrolledInto=0; this.open=false;
      for(const [k,v] of Object.entries(attrs)){
        if(k==='class') v.split(/\s+/).filter(Boolean).forEach(c=>this.classes.add(c));
        else if(k==='id') this.id=v;
        else this.attrs[k]=v;
      }
      this._id=this._id||'';
      const self=this;
      this.classList={add:(...c)=>c.forEach(x=>self.classes.add(x)),remove:(...c)=>c.forEach(x=>self.classes.delete(x)),contains:c=>self.classes.has(c),toggle:(c,f)=>{ const on=f===undefined?!self.classes.has(c):!!f; on?self.classes.add(c):self.classes.delete(c); return on; }};
      all.push(this);
    }
    get id(){ return this._id; }
    set id(v){ this._id=v; byId.set(v,this); }
    get className(){ return [...this.classes].join(' '); }
    set className(v){ this.classes=new Set(v.split(/\s+/).filter(Boolean)); }
    get innerHTML(){ return this._html||''; }
    // A flat read of the markup a module writes: each tag with an id becomes a child, so getElementById finds it.
    set innerHTML(v){ this._html=v; this.children=[]; for(const m of v.matchAll(/<(\w+)([^>]*)>/g)){ const attrs={}; for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]]=a[2]; if(attrs.id) this.appendChild(new Node(m[1],attrs)); } }
    get firstChild(){ return this.children[0]||null; }
    get previousElementSibling(){ const p=this.parentNode; if(!p) return null; const i=p.children.indexOf(this); return i>0?p.children[i-1]:null; }
    get offsetParent(){ return this.hidden?null:this.parentNode; }
    append(...n){ n.forEach(x=>this.appendChild(x)); }
    appendChild(n){ if(n.parentNode) n.parentNode.children.splice(n.parentNode.children.indexOf(n),1); n.parentNode=this; this.children.push(n); return n; }
    insertBefore(n,ref){ if(n.parentNode) n.parentNode.children.splice(n.parentNode.children.indexOf(n),1); n.parentNode=this; const i=ref?this.children.indexOf(ref):-1; if(i<0) this.children.push(n); else this.children.splice(i,0,n); return n; }
    setAttribute(k,v){ if(k==='class') this.className=v; else this.attrs[k]=String(v); }
    getAttribute(k){ return k==='class'?this.className:(k in this.attrs?this.attrs[k]:null); }
    removeAttribute(k){ delete this.attrs[k]; }
    hasAttribute(k){ return k in this.attrs; }
    addEventListener(type,fn){ (this.listeners[type]=this.listeners[type]||[]).push(fn); }
    removeEventListener(){}
    fire(type,ev={}){ ev.target=ev.target||this; ev.preventDefault=ev.preventDefault||(()=>{}); (this.listeners[type]||[]).forEach(fn=>fn(ev)); }
    focus(){ this.focused++; }
    scrollIntoView(){ this.scrolledInto++; }
    scrollBy(o){ this.scrollTop+=o.top||0; }
    getBoundingClientRect(){ return {top:0,bottom:40,left:0,right:0,width:0,height:0,x:0,y:0}; }
    setPointerCapture(){}
    matches(sel){ return sel.split(',').some(s=>matchSimple(this,s.trim())); }
    closest(sel){ let n=this; while(n){ if(n.matches && n.matches(sel)) return n; n=n.parentNode; } return null; }
    descendants(){ const out=[]; const walk=n=>n.children.forEach(c=>{ out.push(c); walk(c); }); walk(this); return out; }
    querySelectorAll(sel){ return sel.split(',').flatMap(s=>this.descendants().filter(n=>matchPath(n,s.trim(),this))); }
    querySelector(sel){ return this.querySelectorAll(sel)[0]||null; }
  }
  function matchSimple(n,sel){
    const m=/^([a-zA-Z]*)((?:[#.][\w-]+|\[[^\]]+\])*)$/.exec(sel); if(!m) return false;
    if(m[1] && n.tagName!==m[1].toUpperCase()) return false;
    for(const part of m[2].match(/[#.][\w-]+|\[[^\]]+\]/g)||[]){
      if(part[0]==='#'){ if(n.id!==part.slice(1)) return false; }
      else if(part[0]==='.'){ if(!n.classes.has(part.slice(1))) return false; }
      else { const a=/^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(part); if(!a) return false; const v=n.getAttribute(a[1]); if(v===null) return false; if(a[2]!==undefined && v!==a[2]) return false; }
    }
    return true;
  }
  function matchPath(n,sel,root){
    const parts=sel.replace(/\s*>\s*/g,' ').split(/\s+(?![^\[]*\])/);
    if(!matchSimple(n,parts[parts.length-1])) return false;
    let i=parts.length-2, p=n.parentNode;
    while(i>=0 && p){ if(matchSimple(p,parts[i])) i--; p=p.parentNode; }
    return i<0;
  }
  const el=(tag,attrs,...kids)=>{ const n=new Node(tag,attrs); kids.forEach(k=>n.appendChild(k)); return n; };
  // Build the page from the ids the module reads, in the places index.html puts them.
  const body=el('body',{});
  const header=el('header',{});
  body.appendChild(header);
  const shell=el('main',{id:'layoutShell',class:'sidebar-open'});
  body.appendChild(shell);
  const tabs=el('div',{class:'stepTabs',role:'tablist'});
  for(const [k,n,label] of [['profile','1','Profile'],['uniform','2','Uniform'],['items','3','Items'],['export','4','Extra']]){
    const t=el('button',{id:'stepTab-'+k,class:'stepTab','data-step':k,'aria-selected':k==='profile'?'true':'false'});
    t.dataset.step=k; t.textContent=n+' '+label; tabs.appendChild(t);
  }
  const stepBody=el('div',{class:'controlsScrollArea',id:'stepBody'});
  const groups={};
  for(const k of ['profile','uniform','items','export']){
    const g=el('div',{class:'stepGroup',id:'stepGroup-'+k},el('h3',{class:'stepGroupTitle'}));
    g.hidden=k!=='profile'; groups[k]=g; stepBody.appendChild(g);
  }
  const seg=(id,...values)=>{ const s=el('div',{class:'segmented','data-segments-for':id}); values.forEach(v=>s.appendChild(el('button',{'data-value':v}))); return s; };
  groups.profile.append(
    el('section',{id:'memberReportImportPanel',class:'panelBlock'},el('button',{id:'importMemberReportBtn'}),Object.assign(el('div',{id:'memberReportImportStatus',class:'hintText'}),{textContent:'No report imported yet.'}),el('button',{id:'clearImportedReportBtn'})),
    el('section',{id:'capMembershipPanel',class:'panelBlock'},seg('membershipType','cadet','senior'),el('select',{id:'membershipType',class:'segmentedSource'}),el('select',{id:'rankSetupSelect'})),
    el('section',{id:'genderBlock',class:'panelBlock'},seg('jacketSelect','male','female'),el('select',{id:'jacketSelect',class:'segmentedSource'}))
  );
  groups.uniform.append(el('section',{id:'uniformBlock',class:'panelBlock'},el('div',{id:'uniformList',class:'uniformList'})));
  for(const key of ['ribbons','badges','patches']){
    const card=el('section',{id:'group'+key[0].toUpperCase()+key.slice(1),class:'panelBlock itemCard','data-card':key},el('span',{class:'countChip','data-count':key}),el('div',{class:'hintText cardRule','data-rule':key}),el('button',{id:'expand'+key[0].toUpperCase()+key.slice(1)}));
    groups.items.appendChild(card);
  }
  const downloadAction=el('div',{class:'finishAction',id:'downloadAction'},el('button',{id:'downloadImage'}));
  const templates=el('div',{class:'finishAction'},el('button',{id:'placementTemplatesOpen'}));
  groups.export.append(el('section',{id:'capubV2StatusPanel',class:'panelBlock'},Object.assign(el('span',{id:'capubV2WarningCount'}),{textContent:'0'})),el('section',{id:'finishPanel',class:'panelBlock'},downloadAction,templates));
  const footer=el('div',{class:'controlsFooter',id:'stepFooter'},Object.assign(el('button',{id:'stepMoreBtn',class:'ghost stepMoreBtn'}),{hidden:true}),el('div',{id:'stepFooterNote',class:'stepFooterNote'}),el('div',{class:'stepFooterRow'},Object.assign(el('button',{id:'stepBack',class:'ghost stepBack'}),{hidden:true}),el('button',{id:'stepNext',class:'stepNext'})));
  const aside=el('aside',{id:'controls'},el('div',{class:'controlsHeader'},tabs),stepBody,footer);
  shell.appendChild(aside);
  const previewArea=el('div',{id:'previewArea'},el('div',{id:'uniformCanvas'}));
  shell.appendChild(el('section',{id:'previewWrapper'},previewArea,Object.assign(el('button',{id:'previewPeekBtn',class:'ghost previewPeekBtn'}),{hidden:true})));
  body.appendChild(el('footer',{id:'pageFooter'}));
  const document={
    body,documentElement:el('html',{}),
    getElementById:id=>byId.get(id)||null,
    querySelector:sel=>body.querySelector(sel),
    querySelectorAll:sel=>body.querySelectorAll(sel),
    createElement:tag=>new Node(tag),
    addEventListener:(t,fn)=>{ (document.listeners[t]=document.listeners[t]||[]).push(fn); },
    removeEventListener(){}, listeners:{},
    dispatchEvent:ev=>{ (document.listeners[ev.type]||[]).forEach(fn=>fn(ev)); return true; },
    fonts:{ready:Promise.resolve()}
  };
  return {document,byId,groups,Node};
}

function boot({phone=false}={}){
  const dom=makeDom();
  const src=ui.slice(ui.indexOf('(function capubV3PolishedUI(){'),ui.indexOf('// A short confirmation when ribbons'));
  const calls={sidebar:[]};
  const context={
    document:dom.document, State:{membership:'',rank:null,gender:'',uniform:'blues_a',ribbons:[],badges:[],patches:[]},
    setTimeout:(fn)=>{ fn(); return 0; }, clearTimeout(){}, requestAnimationFrame:fn=>{ fn(); return 0; },
    matchMedia:q=>({matches:q==='(max-width:700px)'?phone:false,addEventListener(){},addListener(){}}),
    ResizeObserver:function(){ this.observe=()=>{}; }, MutationObserver:function(fn){ this.observe=()=>{ context.__statusWatcher=fn; }; },
    CustomEvent:function(type,init){ this.type=type; this.detail=init&&init.detail; }, Event:function(type){ this.type=type; },
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, getComputedStyle:()=>({paddingLeft:'0',paddingRight:'0'}),
    console, Object, parseInt, parseFloat, Math, String, Set, Number, Array, Promise, JSON, RegExp,
    innerWidth:1440, innerHeight:900, scrollTo(){},
    capubSetSidebarOpen:open=>{ calls.sidebar.push(open); dom.document.getElementById('layoutShell').classList.toggle('sidebar-open',open); dom.document.getElementById('layoutShell').classList.toggle('sidebar-collapsed',!open); },
    CAPUBUniformRules:rules
  };
  context.window=context; context.addEventListener=()=>{}; context.visualViewport=null;
  vm.createContext(context);
  vm.runInContext(src,context,{filename:'workspace-ui.js'});
  const by=id=>dom.document.getElementById(id);
  const shown=()=>['profile','uniform','items','export'].filter(k=>!by('stepGroup-'+k).hidden);
  const tab=k=>by('stepTab-'+k);
  const refresh=()=>dom.document.dispatchEvent({type:'capub:history'});
  return {V3:context.CAPUB_V3,State:context.State,by,shown,tab,refresh,calls,context,dom};
}

test('exactly one step body is on screen at a time, and Next names the next step',()=>{
  const t=boot();
  assert.deepEqual(t.shown(),['profile']);
  assert.equal(t.by('stepNext').textContent,'Next: Uniform');
  assert.equal(t.by('stepNext').disabled,true,'Next waits for the profile');
  assert.equal(t.by('stepBack').hidden,true,'no Back on the first step');
  assert.equal(t.by('stepFooterNote').textContent,'Choose a membership type, a rank and the cut to go on.');
  // The download moved into the footer and hides until the last step.
  assert.equal(t.by('downloadImage').parentNode,t.by('stepNext').parentNode);
  assert.equal(t.by('downloadImage').hidden,true);
  assert.equal(t.by('downloadAction').hidden,true);
  // Asking for a later step before the profile is done keeps the profile on screen.
  t.V3.showStep('items');
  assert.deepEqual(t.shown(),['profile']);
});

test('tab states follow the prerequisites: profile, then uniform, then items; finish needs profile and uniform',()=>{
  const t=boot();
  const state=k=>({done:t.tab(k).classList.contains('done'),blocked:t.tab(k).classList.contains('blocked'),selected:t.tab(k).getAttribute('aria-selected'),current:t.tab(k).getAttribute('aria-current'),disabled:t.tab(k).getAttribute('aria-disabled')});
  assert.deepEqual(state('profile'),{done:false,blocked:false,selected:'true',current:'step',disabled:'false'});
  for(const k of ['uniform','items','export']) assert.deepEqual(state(k),{done:false,blocked:true,selected:'false',current:null,disabled:'true'});
  t.State.membership='cadet'; t.State.rank='C/Amn'; t.refresh();
  assert.equal(t.by('stepFooterNote').textContent,'Choose the cut to go on.','the cut is part of the profile');
  assert.equal(t.tab('uniform').classList.contains('blocked'),true);
  t.State.gender='male'; t.refresh();
  assert.deepEqual(state('profile'),{done:true,blocked:false,selected:'true',current:'step',disabled:'false'});
  assert.equal(t.by('stepNext').disabled,false);
  assert.equal(t.by('stepFooterNote').hidden,true);
  // The uniform has a default, so Items and Finish open with the profile.
  assert.equal(t.tab('uniform').classList.contains('done'),true);
  assert.equal(t.tab('items').classList.contains('blocked'),false);
  assert.equal(t.tab('export').classList.contains('blocked'),false);
  assert.equal(t.tab('items').classList.contains('done'),false,'no items yet');
  t.State.ribbons=[{id:'a'}]; t.refresh();
  assert.equal(t.tab('items').classList.contains('done'),true);
  assert.equal(t.tab('export').classList.contains('done'),true,'no warnings');
  t.by('capubV2WarningCount').textContent='2'; t.refresh();
  assert.equal(t.tab('export').classList.contains('done'),false,'warnings keep Finish open');
});

test('Next and Back walk the steps in order with the right labels; the last step has the download as its primary',()=>{
  const t=boot();
  Object.assign(t.State,{membership:'senior',rank:'Capt',gender:'female'}); t.refresh();
  t.by('stepNext').fire('click');
  assert.deepEqual(t.shown(),['uniform']);
  assert.equal(t.by('stepNext').textContent,'Next: Items');
  assert.equal(t.by('stepBack').hidden,false);
  assert.equal(t.by('stepGroup-uniform').querySelector('.stepGroupTitle').focused,1,'focus lands on the new step');
  t.by('stepNext').fire('click');
  assert.deepEqual(t.shown(),['items']);
  assert.equal(t.by('stepNext').textContent,'Next: Extra');
  t.by('stepNext').fire('click');
  assert.deepEqual(t.shown(),['export']);
  assert.equal(t.by('stepNext').hidden,true);
  assert.equal(t.by('downloadImage').hidden,false,'Download picture (PNG) is the footer primary');
  assert.equal(t.by('stepBack').hidden,false);
  t.by('stepBack').fire('click');
  assert.deepEqual(t.shown(),['items']);
  assert.equal(t.by('downloadImage').hidden,true);
  // A tab click and the arrow keys move too; a blocked tab does nothing.
  t.tab('profile').parentNode.fire('click',{target:t.tab('profile')});
  assert.deepEqual(t.shown(),['profile']);
  t.by('stepTab-profile').parentNode.fire('keydown',{key:'ArrowRight',target:t.tab('profile')});
  assert.deepEqual(t.shown(),['uniform']);
  t.by('stepTab-profile').parentNode.fire('keydown',{key:'End',target:t.tab('uniform')});
  assert.deepEqual(t.shown(),['export']);
  assert.equal(t.tab('export').tabIndex,0); assert.equal(t.tab('profile').tabIndex,-1);
  t.State.membership=''; t.refresh();
  assert.deepEqual(t.shown(),['profile'],'a step whose prerequisites went away gives way to the first unfinished one');
});

test('a notice Fix (and anything else that focuses a control) opens the step that holds it first',()=>{
  const t=boot();
  Object.assign(t.State,{membership:'senior',rank:'Capt',gender:'female'}); t.refresh();
  t.V3.showStep('export');
  t.V3.focusControl('jacketSelect');
  assert.deepEqual(t.shown(),['profile']);
  const firstCutButton=t.by('jacketSelect').parentNode.querySelector('.segmented[data-segments-for="jacketSelect"] button');
  assert.equal(firstCutButton.focused,1,'the first segmented button takes the focus for the hidden select');
  t.V3.showStep('profile');
  t.V3.showStepFor(t.by('expandBadges'));
  assert.deepEqual(t.shown(),['items']);
  assert.equal(t.by('previewEmptyState'),null,'no card over the preview');
});

test('the Items cards carry a count and the uniform\'s rule',()=>{
  const t=boot();
  Object.assign(t.State,{membership:'senior',rank:'Capt',gender:'male',uniform:'blues_a',ribbons:[{id:'a'},{id:'b'},{id:'a'}],badges:['x'],patches:[]}); t.refresh();
  const chip=k=>t.by('group'+k[0].toUpperCase()+k.slice(1)).querySelector('[data-count]');
  const rule=k=>t.by('group'+k[0].toUpperCase()+k.slice(1)).querySelector('[data-rule]').textContent;
  assert.equal(chip('ribbons').textContent,'2 selected'); assert.equal(chip('ribbons').classList.contains('hasItems'),true);
  assert.equal(rule('ribbons'),'Required on this uniform.');
  assert.equal(chip('badges').textContent,`1 of ${rules.getUniformRule('blues_a').badgeCap}`);
  assert.equal(chip('patches').textContent,'0 selected'); assert.equal(chip('patches').classList.contains('hasItems'),false);
  t.State.uniform='mess_dress'; t.refresh();
  assert.equal(rule('ribbons'),'Worn as miniature medals on this uniform.');
  t.State.uniform='ocp'; t.refresh();
  assert.equal(rule('ribbons'),'Not worn on this uniform; kept for the ones that wear them.');
  assert.equal(t.by('groupRibbons').classList.contains('unavailable'),true);
});

test('the clear-import button shows once a report has been read',()=>{
  const t=boot();
  assert.equal(t.by('clearImportedReportBtn').hidden,true);
  t.by('memberReportImportStatus').textContent='Imported: Capt, 12 ribbons.';
  t.context.__statusWatcher();
  assert.equal(t.by('clearImportedReportBtn').hidden,false);
});

test('on a phone the preview is a peek on steps 2 and 3 that opens full-screen and closes again; Undo and Redo sit in the app bar',()=>{
  const t=boot({phone:true});
  const shell=t.by('layoutShell');
  assert.equal(shell.getAttribute('data-step'),'profile','the shell says which step is up, for the phone layout');
  assert.ok(t.dom.document.querySelector('header .previewToolCard[aria-label="Undo and redo"]'),'Undo and Redo moved into the app bar');
  assert.equal(t.by('themeToggle').dataset.mode,'light');
  Object.assign(t.State,{membership:'senior',rank:'Capt',gender:'female'}); t.refresh();
  t.V3.showStep('uniform');
  assert.equal(shell.getAttribute('data-step'),'uniform');
  assert.equal(t.by('previewPeekBtn').hidden,false);
  assert.equal(t.by('previewCloseBtn').hidden,true);
  t.V3.openPreview();
  assert.equal(t.dom.document.body.classList.contains('previewFull'),true);
  assert.equal(t.by('previewCloseBtn').hidden,false);
  assert.equal(t.by('previewPeekBtn').hidden,true);
  assert.equal(t.by('previewCloseBtn').focused,1,'focus goes to Close');
  t.dom.document.dispatchEvent({type:'keydown',key:'Escape'});
  assert.equal(t.dom.document.body.classList.contains('previewFull'),false,'Escape closes it');
  assert.equal(t.by('previewPeekBtn').focused,1,'focus returns to the Expand button');
  // A tap on the peek opens it; a tap on a button in it does not.
  t.by('previewWrapper').fire('click',{target:t.by('previewArea')});
  assert.equal(t.dom.document.body.classList.contains('previewFull'),true);
  t.by('previewCloseBtn').onclick();
  assert.equal(t.dom.document.body.classList.contains('previewFull'),false);
  t.V3.showStep('export');
  assert.equal(shell.getAttribute('data-step'),'export');
  t.by('previewWrapper').fire('click',{target:t.by('previewArea')});
  assert.equal(t.dom.document.body.classList.contains('previewFull'),false,'on step 4 the preview is in the page; only the button opens the overlay');
  t.by('previewPeekBtn').fire('click',{stopPropagation(){}});
  assert.equal(t.dom.document.body.classList.contains('previewFull'),true);
});

test('the scroll cue: a More below button and fade on the desktop panel, nothing on a phone where the page scrolls',()=>{
  const d=boot();
  const body=d.by('stepBody'); body.scrollHeight=1400; body.clientHeight=600; body.scrollTop=0;
  body.fire('scroll');
  assert.equal(d.by('controls').classList.contains('hasMoreBelow'),true);
  assert.equal(d.by('stepMoreBtn').hidden,false);
  d.by('stepMoreBtn').fire('click');
  assert.equal(body.scrollTop,480,'the button scrolls the body by most of a screen');
  body.scrollTop=800; body.fire('scroll');
  assert.equal(d.by('stepMoreBtn').hidden,true);
  const p=boot({phone:true});
  const pb=p.by('stepBody'); pb.scrollHeight=1400; pb.clientHeight=600; pb.fire('scroll');
  assert.equal(p.by('controls').classList.contains('hasMoreBelow'),false);
  assert.equal(p.by('stepMoreBtn').hidden,true);
  assert.ok(!p.dom.document.querySelector('header .previewToolCard') || p.dom.document.querySelector('header .previewToolCard[aria-label="Undo and redo"]'));
  assert.ok(d.by('previewTools').querySelector('.previewToolCard[aria-label="Undo and redo"]'),'on the desktop the history card is in the preview toolbar');
});
