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
// stepGroup-tools, the "More tools" fold, is the one container that went: its contents live in steps 3 and 4.
const OLD_IDS=['controls','sheetClose','stepGroup-profile','memberReportImportPanel','importMemberReportBtn','clearImportedReportBtn','memberReportUpload','memberReportImportStatus','capMembershipPanel','membershipLabel','membershipType','adultCadetRow','adultCadetCheckbox','rankSetupSelect','cadetFirstSergeantBlock','cadetFirstSergeantCheckbox','optionalName','capubV2TextPanel','firstNameRow','capubV2FirstName','capubV2LastName','plateLineRow','capubV2PlateLine','capubV2ShowText','stepGroup-uniform','genderBlock','cutLabel','jacketSelect','uniformBlock','uniformList','garmentOptionsPanel','garmentOptions','shoulderCordPanel','shoulderCordSelect','shoulderCordNote','stepGroup-items','quickStripPanel','quickStripHint','quickStripBtn','groupRibbons','clearRibbons','expandRibbons','cadetHighestOnlyRow','cadetHighestOnly','ribbonGallery','miniMountStyle','groupBadges','badgesPlannedNote','clearBadges','expandBadges','badgeGallery','groupPatches','clearPatches','expandPatches','unitPatchSearch','unitPatchSelect','unitPatchStatus','patchGallery','stepGroup-export','capubV2StatusPanel','capubV2RibbonCount','capubV2BadgeCount','capubV2PatchCount','capubV2WarningCount','capubV2Notices','finishPanel','downloadImage','purchaseListSlot','capubV2ExportJson','capubV2ImportBtn','capubV2ImportFile','ribbonRackPanel','ribbonRackColumns','ribbonRackColumnsHint','ribbonRackArrangement','ribbonRackArrangementHint','ribbonRowOverridePanel','ribbonRowOverrideEnabled','ribbonRowOverrideControls','ribbonRowOverrideGrid','addRibbonOverrideRow','removeRibbonOverrideRow','ribbonRowOverrideStatus','capubV2QuickPanel','capubV2SaveLocal','capubV2LoadLocal','capubV2Reset'];

test('every control id of the old sidebar is still on the page exactly once',()=>{
  const ids=[...html.matchAll(/(?<![-\w])id="([^"]+)"/g)].map(m=>m[1]);
  const count=id=>ids.filter(x=>x===id).length;
  for(const id of OLD_IDS) assert.equal(count(id),1,`id="${id}"`);
  assert.equal(count('stepGroup-tools'),0,'the More tools fold is gone');
  const dupes=ids.filter((id,i)=>ids.indexOf(id)!==i);
  assert.deepEqual(dupes,[],'no id twice');
  // The gallery divs stay for the modal plumbing.
  for(const id of ['ribbonGallery','badgeGallery','patchGallery']) assert.match(aside,new RegExp(`<div id="${id}" class="galleryGrid"></div>`));
});

test('the panel reads top to bottom: tabs, one step, footer; no instructions about the panel',()=>{
  assert.match(aside,/<div class="stepTabs" role="tablist" aria-label="Steps">/);
  const tabs=[...aside.matchAll(/<button type="button" role="tab" id="stepTab-([a-z]+)" class="stepTab" data-step="\1" aria-controls="stepGroup-\1"[^>]*><span class="stepNum">(\d)<\/span><span class="stepLabel">([^<]+)<\/span><\/button>/g)].map(m=>[m[1],m[2],m[3]]);
  assert.deepEqual(tabs,[['profile','1','Profile'],['uniform','2','Uniform'],['items','3','Items'],['export','4','Finish']]);
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
    items:['quickStripPanel','expandRibbons','clearRibbons','cadetHighestOnly','miniMountStyle','ribbonRackColumns','ribbonRowOverridePanel','expandBadges','badgesPlannedNote','expandPatches','unitPatchSearch','unitPatchSelect'],
    export:['capubV2StatusPanel','capubV2Notices','downloadImage','purchaseListSlot','capubV2ExportJson','capubV2ImportBtn','capubV2SaveLocal','capubV2LoadLocal','capubV2Reset']
  };
  for(const [step,ids] of Object.entries(where)) for(const id of ids) assert.equal(stepOf(id),step,`${id} is in step ${step}`);
  assert.ok(aside.indexOf('id="rankSetupSelect"')<aside.indexOf('id="genderBlock"') && aside.indexOf('id="genderBlock"')<aside.indexOf('id="optionalName"'),'rank, then cut, then the name');
});

test('the Items step is three cards, each with a count, a rule line, Choose… and Clear',()=>{
  for(const [key,choose,clear] of [['ribbons','expandRibbons','clearRibbons'],['badges','expandBadges','clearBadges'],['patches','expandPatches','clearPatches']]){
    const card=aside.slice(aside.indexOf(`data-card="${key}"`),aside.indexOf('</section>',aside.indexOf(`data-card="${key}"`)));
    assert.match(card,new RegExp(`<span class="countChip" data-count="${key}" aria-live="polite">0 selected</span>`));
    assert.match(card,new RegExp(`<div class="hintText cardRule" data-rule="${key}">`));
    assert.match(card,new RegExp(`<button id="${choose}" type="button">Choose ${key}…</button>`));
    assert.match(card,new RegExp(`<button id="${clear}" class="ghost" type="button" aria-label="Clear ${key}">Clear</button>`));
    assert.ok(card.indexOf(`id="${choose}"`)<card.indexOf(`id="${clear}"`),'Choose before Clear');
  }
  assert.match(aside,/<summary>Advanced: rack layout<\/summary>/);
});

test('the uniform cards are a two-column grid by occasion, matching the rules; locked ones fold away with their reasons',()=>{
  for(const key of Object.keys(rules.GROUPS)){
    const group=aside.slice(aside.indexOf(`data-group="${key}"`),aside.indexOf('</div>\n            </div>',aside.indexOf(`data-group="${key}"`)));
    const ids=[...group.matchAll(/data-uniform-id="([a-z_]+)"/g)].map(m=>m[1]).sort();
    assert.deepEqual(ids,rules.uniformIdsInGroup(key).sort(),`group ${key}`);
  }
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
  // The scroll affordance: a fade above the footer while the body has more below.
  assert.match(css,/#controls\.hasMoreBelow \.controlsFooter::before\{opacity:1\}/);
  assert.match(ui,/aside\.classList\.toggle\('hasMoreBelow', body\.scrollHeight-body\.clientHeight-body\.scrollTop>2\)/);
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
    const parts=sel.replace(/\s*>\s*/g,' ').split(/\s+/);
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
  for(const [k,n,label] of [['profile','1','Profile'],['uniform','2','Uniform'],['items','3','Items'],['export','4','Finish']]){
    const t=el('button',{id:'stepTab-'+k,class:'stepTab','data-step':k,'aria-selected':k==='profile'?'true':'false'});
    t.dataset.step=k; t.textContent=n+' '+label; tabs.appendChild(t);
  }
  const grip=el('div',{class:'sheetGrip'},el('button',{id:'sheetHandle',class:'sheetHandle'}),el('button',{id:'sheetClose',class:'ghost sheetClose'}));
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
  const footer=el('div',{class:'controlsFooter',id:'stepFooter'},el('div',{id:'stepFooterNote',class:'stepFooterNote'}),el('div',{class:'stepFooterRow'},Object.assign(el('button',{id:'stepBack',class:'ghost stepBack'}),{hidden:true}),el('button',{id:'stepNext',class:'stepNext'})));
  const aside=el('aside',{id:'controls'},el('div',{class:'controlsHeader'},grip,tabs),stepBody,footer);
  shell.appendChild(aside);
  const previewArea=el('div',{id:'previewArea'},el('div',{id:'uniformCanvas'}));
  shell.appendChild(el('section',{id:'previewWrapper'},previewArea));
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

function boot({sheet=false}={}){
  const dom=makeDom();
  const src=ui.slice(ui.indexOf('(function capubV3PolishedUI(){'),ui.indexOf('// A short confirmation when ribbons'));
  const calls={sidebar:[]};
  const context={
    document:dom.document, State:{membership:'',rank:null,gender:'',uniform:'blues_a',ribbons:[],badges:[],patches:[]},
    setTimeout:(fn)=>{ fn(); return 0; }, clearTimeout(){}, requestAnimationFrame:fn=>{ fn(); return 0; },
    matchMedia:q=>({matches:q==='(max-width:900px)'?sheet:false,addEventListener(){},addListener(){}}),
    ResizeObserver:function(){ this.observe=()=>{}; }, MutationObserver:function(fn){ this.observe=()=>{ context.__statusWatcher=fn; }; },
    CustomEvent:function(type,init){ this.type=type; this.detail=init&&init.detail; }, Event:function(type){ this.type=type; },
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, getComputedStyle:()=>({paddingLeft:'0',paddingRight:'0'}),
    console, Object, parseInt, parseFloat, Math, String, Set, Number, Array, Promise, JSON, RegExp,
    innerWidth:1440, innerHeight:900,
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
  assert.equal(t.by('stepNext').textContent,'Next: Check & finish');
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

test('the preview empty state and a notice Fix open the step that holds the control before focusing it',()=>{
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
  // The empty state's button goes to the first gap.
  t.State.gender=''; t.V3.showStep('uniform'); t.refresh();
  t.by('previewEmptyAction').onclick();
  assert.deepEqual(t.shown(),['profile']);
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

test('on a phone the grip drags the sheet away, up makes it tall, a tap toggles tall',()=>{
  const t=boot({sheet:true});
  const handle=t.by('sheetHandle'), sheet=t.by('controls');
  const drag=(from,to)=>{ handle.fire('pointerdown',{clientY:from,pointerId:1}); handle.fire('pointermove',{clientY:to}); handle.fire('pointerup',{}); };
  drag(100,40);
  assert.equal(sheet.classList.contains('sheetTall'),true,'up makes it tall');
  drag(100,250);
  assert.equal(sheet.classList.contains('sheetTall'),false,'down from tall brings it back');
  assert.deepEqual(t.calls.sidebar,[],'not closed yet');
  drag(100,250);
  assert.deepEqual(t.calls.sidebar,[false],'down from the resting height closes it');
  handle.fire('pointerdown',{clientY:100,pointerId:1}); handle.fire('pointerup',{});
  assert.equal(sheet.classList.contains('sheetTall'),true,'a tap toggles tall');
  assert.equal(sheet.classList.contains('sheetDragging'),false);
  assert.equal(sheet.style.transform,'');
});
