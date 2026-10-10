// Extracted verbatim from index.html: the workspace UI behavior module (step guide,
// preview toolbar and zoom, empty state, command bar, header chips, toast).
// It runs as an IIFE at the same point in the load order as before.

/* ===========================
   CAPUB V3 POLISHED UI BEHAVIOR
   =========================== */
(function capubV3PolishedUI(){
  const V3 = window.CAPUB_V3 = { zoom: 1, compact:false };
  const safeBy = id => document.getElementById(id);
  function toast(msg, ms){
    let t=safeBy('capubToast');
    if(!t){
      t=document.createElement('div'); t.id='capubToast'; t.className='capubToast';
      t.setAttribute('role','status'); t.setAttribute('aria-live','polite');
      document.body.appendChild(t);
    }
    t.textContent=msg; t.classList.add('show');
    clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove('show'),ms||2200);
  }
  window.capubToastShow = toast;
  function ensureProgress(){
    const scroll=document.querySelector('.controlsScrollArea');
    if(!scroll || safeBy('capubProgress')) return;
    const box=document.createElement('div'); box.id='capubProgress'; box.className='capubProgress';
    box.innerHTML=`
      <button type="button" class="capubStep" data-step="profile"><strong>1. Profile</strong><span>Member + rank</span></button>
      <button type="button" class="capubStep" data-step="uniform"><strong>2. Uniform</strong><span>Style + cut</span></button>
      <button type="button" class="capubStep" data-step="items"><strong>3. Items</strong><span>Ribbons &amp; badges</span></button>
      <button type="button" class="capubStep" data-step="export"><strong>4. Finish</strong><span>Check + save</span></button>`;
    scroll.prepend(box);
    box.addEventListener('click',e=>{
      const step=e.target.closest('.capubStep'); if(step) goToStep(step.dataset.step);
    });
    const help=document.createElement('div'); help.className='capubSectionHint';
    help.innerHTML='<span>★</span><div><b>Work down the steps.</b> The bar at the bottom of the preview opens the ribbon and badge galleries and downloads your PNG.</div>';
    scroll.insertBefore(help, box.nextSibling);
  }
  // Where each step lives in the sidebar, in the order a member works through them.
  const STEP_ORDER=['profile','uniform','items','export'];
  const STEP_TARGETS={profile:'capMembershipPanel',uniform:'uniformBlock',items:'groupRibbons',export:'capubV2StatusPanel'};
  // Awards are optional, so Export only waits on profile and uniform.
  const STEP_PREREQS={profile:[],uniform:['profile'],items:['profile','uniform'],export:['profile','uniform']};
  function getStepStatuses(){
    const hasProfile=!!(State.membership && State.rank);
    const hasUniform=!!(State.gender && State.uniform);
    const hasItems=!!((State.ribbons&&State.ribbons.length)||(State.badges&&State.badges.length)||(State.patches&&State.patches.length));
    const warnings=parseInt((safeBy('capubV2WarningCount')||{}).textContent||'0',10)||0;
    const done={profile:hasProfile,uniform:hasProfile&&hasUniform,items:hasProfile&&hasUniform&&hasItems,export:hasProfile&&hasUniform&&hasItems&&warnings===0};
    const current=STEP_ORDER.find(k=>!done[k]) || 'export';
    return {done,current};
  }
  // A step is reachable once its prerequisites are done; clicking a blocked step
  // takes the member to the first unfinished one instead of an inert panel.
  function goToStep(step){
    const {done,current}=getStepStatuses();
    const reachable=STEP_PREREQS[step].every(k=>done[k]);
    const target=safeBy(STEP_TARGETS[reachable?step:current]);
    if(!target) return;
    if(typeof capubSetSidebarOpen==='function') capubSetSidebarOpen(true);
    target.scrollIntoView({behavior:'smooth',block:'start'});
    const focusable=target.querySelector('select:not(:disabled),input:not(:disabled):not([type=hidden])');
    if(focusable) setTimeout(()=>focusable.focus({preventScroll:true}),250);
  }
  V3.getStepStatuses=getStepStatuses;
  V3.stepOrder=STEP_ORDER;
  function updateProgress(){
    const steps=[...document.querySelectorAll('.capubStep')]; if(!steps.length || typeof State==='undefined') return;
    const {done,current}=getStepStatuses();
    steps.forEach(st=>{
      const k=st.dataset.step;
      const reachable=STEP_PREREQS[k].every(p=>done[p]);
      st.classList.toggle('done',!!done[k]);
      st.classList.toggle('current',k===current && !done[k]);
      st.classList.toggle('blocked',!reachable);
      if(k===current && !done[k]) st.setAttribute('aria-current','step'); else st.removeAttribute('aria-current');
      st.title = reachable ? '' : 'Finish the earlier steps first';
    });
  }
  // The preview stays blank until membership, rank and cut are all chosen, which
  // read as a broken page. Say what is missing and offer the next action instead.
  function getProfileGaps(){
    return [
      {label:'Membership type',target:'membershipType',ok:!!State.membership},
      {label:'Rank',target:'rankSetupSelect',ok:!!State.rank},
      {label:'Cut (male or female)',target:'jacketSelect',ok:!!State.gender}
    ];
  }
  function ensureEmptyState(){
    const area=safeBy('previewArea'); if(!area || safeBy('previewEmptyState')) return;
    const box=document.createElement('div'); box.id='previewEmptyState'; box.className='previewEmptyState';
    box.innerHTML='<div class="emptyTitle">Start your uniform</div><ul class="emptyChecklist" id="previewEmptyChecklist"></ul><button type="button" id="previewEmptyAction"></button>';
    area.appendChild(box);
    safeBy('previewEmptyAction').onclick=()=>{
      const next=getProfileGaps().find(g=>!g.ok); if(!next) return;
      if(typeof capubSetSidebarOpen==='function') capubSetSidebarOpen(true);
      const el=safeBy(next.target); if(!el) return;
      el.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>el.focus({preventScroll:true}),250);
    };
  }
  function updateEmptyState(){
    const box=safeBy('previewEmptyState'); if(!box || typeof State==='undefined') return;
    const gaps=getProfileGaps();
    const next=gaps.find(g=>!g.ok);
    const show=!!next;
    box.hidden=!show;
    if(!show) return;
    safeBy('previewEmptyChecklist').innerHTML=gaps.map(g=>`<li class="${g.ok?'ok':''}">${g.label}</li>`).join('');
    safeBy('previewEmptyAction').textContent='Choose '+next.label.replace(/ \(.*\)$/,'').toLowerCase();
  }
  function ensurePreviewToolbar(){
    const wrap=safeBy('previewWrapper'); if(!wrap || safeBy('previewToolbar')) return;
    // One row above the uniform: status chips on the left, zoom on the right.
    // They used to be two separate floating cards that overlapped each other and,
    // beside the sidebar at ~1024px, pushed the zoom card off the right edge.
    const toolbar=document.createElement('div'); toolbar.id='previewToolbar'; toolbar.className='previewToolbar';
    toolbar.innerHTML=`<div id="capubTopBar" class="capubTopBar"><span class="capubPill">Status: <strong id="topStatusText">Ready</strong></span><span class="capubPill">Uniform: <strong id="topUniformText">None</strong></span><span class="capubPill">Items: <strong id="topItemsText">0</strong></span></div><div id="previewTools" class="previewTools"><div class="previewToolCard" role="group" aria-label="Preview zoom"><button type="button" class="ghost" id="zoomOutBtn" aria-label="Zoom out">−</button><span class="zoomReadout" id="zoomReadout" aria-live="polite">100%</span><button type="button" class="ghost" id="zoomInBtn" aria-label="Zoom in">+</button><button type="button" class="ghost" id="zoomFitBtn">Fit</button></div></div>`;
    wrap.insertBefore(toolbar, wrap.firstChild);
    // Undo and redo sit in front of the zoom controls.
    const history=document.createElement('div');
    history.className='previewToolCard'; history.setAttribute('role','group'); history.setAttribute('aria-label','Undo and redo');
    history.innerHTML='<button type="button" class="ghost" id="undoBtn">Undo</button><button type="button" class="ghost" id="redoBtn">Redo</button>';
    safeBy('previewTools').insertBefore(history, safeBy('previewTools').firstChild);
    const syncHistory=()=>{
      const h=window.CAPUB_HISTORY;
      safeBy('undoBtn').disabled=!(h&&h.canUndo()); safeBy('redoBtn').disabled=!(h&&h.canRedo());
    };
    safeBy('undoBtn').onclick=()=>{ window.CAPUB_HISTORY&&window.CAPUB_HISTORY.undo(); };
    safeBy('redoBtn').onclick=()=>{ window.CAPUB_HISTORY&&window.CAPUB_HISTORY.redo(); };
    document.addEventListener('capub:history',syncHistory);
    document.addEventListener('keydown',e=>{
      if(!(e.metaKey||e.ctrlKey) || e.key.toLowerCase()!=='z') return;
      const t=e.target; if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      const h=window.CAPUB_HISTORY; if(!h) return;
      if(e.shiftKey) h.redo(); else h.undo();
    });
    syncHistory();
    safeBy('zoomOutBtn').onclick=()=>{ V3.userZoomed=true; setZoom(Math.max(.55,V3.zoom-.1)); };
    safeBy('zoomInBtn').onclick=()=>{ V3.userZoomed=true; setZoom(Math.min(1.65,V3.zoom+.1)); };
    safeBy('zoomFitBtn').onclick=()=>{ V3.userZoomed=false; fitZoom(); };
  }
  function setZoom(z){
    V3.zoom=Math.round(z*100)/100;
    const area=safeBy('previewArea');
    if(area){
      area.style.transform=`scale(${V3.zoom})`;
      // transform scales what is painted but not the layout box, so a zoomed-out
      // preview kept reserving its full 450x600 and forced sideways scrolling in
      // a narrow workspace. Pull the box in by the amount it shrank (or grow it).
      area.style.marginRight=((V3.zoom-1)*area.offsetWidth)+'px';
      area.style.marginBottom=((V3.zoom-1)*area.offsetHeight)+'px';
    }
    const ro=safeBy('zoomReadout'); if(ro) ro.textContent=Math.round(V3.zoom*100)+'%';
  }
  function fitZoom(){
    const wrap=safeBy('previewWrapper'), area=safeBy('previewArea');
    if(!wrap || !area) return setZoom(1);
    const mobile=window.matchMedia('(max-width:768px)').matches;
    // Only the wrapper's side padding: the zoom controls now live in a toolbar row
    // above the uniform instead of beside it.
    const reserve=mobile ? 24 : 44;
    const available=Math.max(240,wrap.clientWidth-reserve);
    const previewWidth=area.offsetWidth || 450;
    // The wide field-uniform stage needs a lower floor to fit a phone without sideways scrolling.
    const z=Math.min(1, Math.max(.3, available/previewWidth));
    V3.fitWidth=previewWidth;
    setZoom(z);
  }
  function updateTopBar(){
    if(typeof State==='undefined') return;
    const status=safeBy('topStatusText'), uniform=safeBy('topUniformText'), items=safeBy('topItemsText');
    const warnings=parseInt((safeBy('capubV2WarningCount')||{}).textContent||'0',10)||0;
    // Until membership, rank and cut are chosen the defaults would read as a real
    // selection ("BLUES A", "3 warnings") over an empty preview.
    const setupNeeded = !(State.membership && State.rank && State.gender);
    if(status) status.textContent = setupNeeded ? 'Setup needed' : (warnings ? `${warnings} warning${warnings===1?'':'s'}` : 'Good');
    if(uniform) uniform.textContent = (State.uniform && !setupNeeded) ? State.uniform.replace(/_/g,' ').toUpperCase() : '—';
    if(items) items.textContent = ((State.ribbons||[]).length + (State.badges||[]).length + (State.patches||[]).length).toString();
    const auth = (typeof UI_AUTHZ !== 'undefined' && UI_AUTHZ[State.uniform]) || {showBadges:true,showPatches:true};
    safeBy('cmdBadges')?.classList.toggle('hidden', !auth.showBadges);
    safeBy('cmdPatches')?.classList.toggle('hidden', !auth.showPatches);
  }
  function ensureCommandBar(){
    if(safeBy('capubCommandBar')) return;
    const bar=document.createElement('div'); bar.id='capubCommandBar'; bar.className='capubCommandBar';
    bar.innerHTML=`<button type="button" id="cmdRibbons">Ribbons</button><button type="button" id="cmdBadges">Badges</button><button type="button" id="cmdPatches">Patches</button><button type="button" class="ghost" id="cmdValidate">Check</button><button type="button" id="cmdDownload">Download PNG</button>`;
    document.body.appendChild(bar);
    safeBy('cmdRibbons').onclick=()=>safeBy('expandRibbons')?.click();
    safeBy('cmdBadges').onclick=()=>safeBy('expandBadges')?.click();
    safeBy('cmdPatches').onclick=()=>safeBy('expandPatches')?.click();
    safeBy('cmdDownload').onclick=()=>safeBy('downloadImage')?.click();
    safeBy('cmdValidate').onclick=()=>{ if(typeof fullRender==='function') fullRender(); const w=(safeBy('capubV2WarningCount')||{}).textContent||'0'; toast(w==='0'?'Validation complete: no automatic issues found.':`Validation complete: ${w} warning(s) found.`); safeBy('capubV2StatusPanel')?.scrollIntoView({behavior:'smooth',block:'center'}); };
  }
  function polishPanels(){
    document.querySelectorAll('.panelBlock').forEach((p,i)=>{ if(!p.dataset.uiPolished){ p.dataset.uiPolished='1'; p.style.animationDelay=(i*12)+'ms'; } });
  }
  function markActiveUniform(){
    if(typeof State==='undefined') return;
    document.querySelectorAll('.uniformOption').forEach(btn=>btn.classList.toggle('activeUniform',btn.dataset.uniformId===State.uniform));
  }
  // Field uniforms use a wider stage; refit when the stage size changes unless the member set their own zoom.
  function refitIfStageChanged(){
    const area=safeBy('previewArea');
    if(area && !V3.userZoomed && V3.fitWidth && area.offsetWidth && area.offsetWidth!==V3.fitWidth) fitZoom();
  }
  // Light/dark: the system setting by default, a member's choice kept in this browser.
  function currentTheme(){
    const set=document.documentElement.getAttribute('data-theme');
    if(set) return set;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function ensureThemeToggle(){
    const header=document.querySelector('header');
    if(!header || safeBy('themeToggle')) return;
    try{
      const saved=localStorage.getItem('capubTheme');
      if(saved==='light' || saved==='dark') document.documentElement.setAttribute('data-theme',saved);
    }catch(_){}
    const btn=document.createElement('button');
    btn.type='button'; btn.id='themeToggle'; btn.className='themeToggle';
    const label=()=>{ const dark=currentTheme()==='dark'; btn.textContent=dark?'Light mode':'Dark mode'; btn.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode'); };
    btn.addEventListener('click',()=>{
      const next=currentTheme()==='dark'?'light':'dark';
      document.documentElement.setAttribute('data-theme',next);
      try{ localStorage.setItem('capubTheme',next); }catch(_){}
      label();
    });
    label();
    header.appendChild(btn);
  }
  function refreshAll(){ ensureThemeToggle(); ensureProgress(); ensureEmptyState(); updateEmptyState(); ensurePreviewToolbar(); ensureCommandBar(); polishPanels(); updateProgress(); updateTopBar(); markActiveUniform(); refitIfStageChanged(); }
  const previousFullRender = (typeof fullRender==='function') ? fullRender : null;
  if(previousFullRender){
    fullRender = function capubV3FullRender(){ const result=previousFullRender.apply(this,arguments); scheduleRefresh(); return result; };
  }
  // Every click, input and change used to schedule its own full refresh; a drag or
  // a burst of typing queued dozens per frame. Coalesce them to one per frame.
  let refreshQueued=false;
  function scheduleRefresh(){
    if(refreshQueued) return;
    refreshQueued=true;
    // rAF keeps it to one refresh per painted frame; the timer is the fallback for
    // hidden or occluded tabs, where the browser pauses rAF and the UI would go stale.
    let ran=false;
    const run=()=>{ if(ran) return; ran=true; refreshQueued=false; refreshAll(); };
    requestAnimationFrame(run);
    setTimeout(run,100);
  }
  ['change','click','input'].forEach(evt=>document.addEventListener(evt,scheduleRefresh,true));
  window.addEventListener('resize',()=>{ if(V3.zoom<=1) fitZoom(); });
  setTimeout(()=>{ refreshAll(); fitZoom(); },80);
})();

// A short confirmation when ribbons, badges or patches are added or removed, so a change made
// in a picker that covers the preview is still acknowledged. It compares item counts, so it only
// speaks when something really was added or removed (including by undo and redo).
(function capubItemToasts(){
  const kinds=[
    ['ribbon',()=>new Set((State.ribbons||[]).map(r=>r.id)).size],
    ['badge',()=>(State.badges||[]).length],
    ['patch',()=>(State.patches||[]).length]
  ];
  let last=null;
  const counts=()=>kinds.map(([,count])=>{ try{ return count(); }catch(_){ return 0; } });
  function words(delta,name){
    return `${Math.abs(delta)} ${name}${Math.abs(delta)===1?'':'s'}`;
  }
  function onChange(){
    const now=counts();
    if(last===null){ last=now; return; }
    const parts=[];
    kinds.forEach(([name],i)=>{
      const delta=now[i]-last[i];
      if(delta>0) parts.push(`Added ${words(delta,name)}`);
      else if(delta<0) parts.push(`Removed ${words(delta,name)}`);
    });
    last=now;
    if(parts.length && typeof window.capubToastShow==='function') window.capubToastShow(parts.join(', '));
  }
  // Pickers re-render without a full render, so the history event alone misses them. Any change
  // or click schedules a check; onChange compares counts, so repeated checks say nothing twice.
  let timer=null;
  function check(){ clearTimeout(timer); timer=setTimeout(onChange,200); }
  document.addEventListener('capub:history',check);
  ['change','click'].forEach(evt=>document.addEventListener(evt,check,true));
  // Take the starting counts once the page has drawn, so the first change reports a difference.
  setTimeout(()=>{ if(last===null && typeof State!=='undefined') last=counts(); },400);
})();

// Autosave and resume. The setup is written to this browser a moment after every change, so
// a refresh or a closed tab no longer loses it. On the next visit the member is asked whether
// to resume; nothing is loaded silently. It is separate from "Save to Browser", which stays a
// deliberate named save. Everything stays in localStorage on this device.
(function capubAutosave(){
  const KEY='cap_uniform_builder_autosave_v1';
  const SAVE_DELAY_MS=600;
  const safeBy=id=>document.getElementById(id);
  let saveTimer=null;

  function read(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw) return null;
      const parsed=JSON.parse(raw);
      if(!parsed || typeof parsed!=='object' || !parsed.profile || typeof parsed.profile!=='object') return null;
      return parsed;
    }catch(_){ return null; }
  }
  function write(profile){
    try{ localStorage.setItem(KEY,JSON.stringify({savedAt:Date.now(),profile})); }catch(_){}
  }
  function clear(){
    try{ localStorage.removeItem(KEY); }catch(_){}
  }
  // A setup with no membership type yet is the empty page, not something worth resuming.
  function worthSaving(profile){
    return !!(profile && profile.membership);
  }
  function currentProfile(){
    const v2=window.CAPUB_V2;
    if(!v2 || typeof v2.collectProfile!=='function') return null;
    const p=v2.collectProfile();
    // Calibration and garment masks have their own storage; the setup is what the member built.
    delete p.calib; delete p.garmentMasks;
    return p;
  }
  function scheduleSave(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      const p=currentProfile();
      // A member who keeps building while the banner is up has started a new setup. The banner
      // still holds the earlier one in memory, so Resume works until the page is reloaded.
      if(worthSaving(p)) write(p);
    },SAVE_DELAY_MS);
  }

  function describe(profile){
    const bits=[];
    if(profile.rank) bits.push(profile.rank);
    if(profile.uniform) bits.push(String(profile.uniform).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()));
    const items=(Array.isArray(profile.ribbons)?profile.ribbons.length:0)
      +(Array.isArray(profile.badges)?profile.badges.length:0)
      +(Array.isArray(profile.patches)?profile.patches.length:0);
    bits.push(items+(items===1?' item':' items'));
    return bits.join(' · ');
  }
  function when(ts){
    const mins=Math.max(0,Math.round((Date.now()-Number(ts||0))/60000));
    if(!ts || mins<1) return 'just now';
    if(mins<60) return mins+(mins===1?' minute ago':' minutes ago');
    const hours=Math.round(mins/60);
    if(hours<48) return hours+(hours===1?' hour ago':' hours ago');
    return Math.round(hours/24)+' days ago';
  }

  function removeBanner(){
    const b=safeBy('capubResume');
    if(b) b.remove();
  }
  function showBanner(saved){
    removeBanner();
    const wrap=safeBy('previewWrapper');
    if(!wrap) return;
    const box=document.createElement('div');
    box.id='capubResume'; box.className='resumeBanner';
    box.setAttribute('role','region'); box.setAttribute('aria-label','Resume your last uniform');
    const text=document.createElement('div'); text.className='resumeText';
    const title=document.createElement('b'); title.textContent='Resume your last uniform?';
    const detail=document.createElement('span');
    detail.textContent=describe(saved.profile)+' · saved '+when(saved.savedAt);
    text.append(title,detail);
    const actions=document.createElement('div'); actions.className='resumeActions';
    const resume=document.createElement('button'); resume.type='button'; resume.id='capubResumeYes'; resume.textContent='Resume';
    const fresh=document.createElement('button'); fresh.type='button'; fresh.id='capubResumeNo'; fresh.className='ghost'; fresh.textContent='Start over';
    actions.append(resume,fresh);
    box.append(text,actions);
    const toolbar=safeBy('previewToolbar');
    if(toolbar && toolbar.parentNode===wrap) wrap.insertBefore(box,toolbar.nextSibling);
    else wrap.insertBefore(box,wrap.firstChild);

    resume.addEventListener('click',()=>{
      const v2=window.CAPUB_V2;
      try{
        if(v2 && typeof v2.applyProfile==='function') v2.applyProfile(saved.profile);
      }catch(_){
        if(typeof window.capubToastShow==='function') window.capubToastShow('That saved setup could not be loaded.');
        clear(); removeBanner(); return;
      }
      removeBanner();
      if(typeof window.capubToastShow==='function') window.capubToastShow('Resumed your last uniform.');
    });
    fresh.addEventListener('click',()=>{
      clear(); removeBanner();
    });
  }

  function init(){
    const saved=read();
    if(saved && worthSaving(saved.profile)){
      showBanner(saved);
    }
    // History events fire only when the setup actually changed (and after undo or redo).
    document.addEventListener('capub:history',scheduleSave);
    // Also save when the tab is hidden or closed, in case the timer has not fired yet.
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState!=='hidden') return;
      clearTimeout(saveTimer);
      const p=currentProfile();
      if(worthSaving(p)) write(p);
    });
  }
  // The toolbar is added by the polish module a moment after load; wait for it.
  setTimeout(init,350);
})();

// About dialog: the unofficial-site and privacy notice, opened from the footer.
(function capubAboutDialog(){
  const dialog = document.getElementById('aboutDialog');
  const open = document.getElementById('aboutOpen');
  if(!dialog || !open) return;
  open.addEventListener('click', () => {
    if(typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open','');
  });
  document.getElementById('aboutClose')?.addEventListener('click', () => dialog.close());
  // A click on the dimmed area outside the box closes it.
  dialog.addEventListener('click', event => { if(event.target === dialog) dialog.close(); });
})();
