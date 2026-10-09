// Extracted verbatim from index.html: the workspace UI behavior module (step guide,
// preview toolbar and zoom, empty state, command bar, header chips, toast).
// It runs as an IIFE at the same point in the load order as before.

/* ===========================
   CAPUB V3 POLISHED UI BEHAVIOR
   =========================== */
(function capubV3PolishedUI(){
  const V3 = window.CAPUB_V3 = { zoom: 1, compact:false };
  const safeBy = id => document.getElementById(id);
  function toast(msg){
    let t=safeBy('capubToast');
    if(!t){ t=document.createElement('div'); t.id='capubToast'; t.className='capubToast'; document.body.appendChild(t); }
    t.textContent=msg; t.classList.add('show');
    clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove('show'),2200);
  }
  function ensureProgress(){
    const scroll=document.querySelector('.controlsScrollArea');
    if(!scroll || safeBy('capubProgress')) return;
    const box=document.createElement('div'); box.id='capubProgress'; box.className='capubProgress';
    box.innerHTML=`
      <button type="button" class="capubStep" data-step="profile"><strong>1. Profile</strong><span>Member + rank</span></button>
      <button type="button" class="capubStep" data-step="uniform"><strong>2. Uniform</strong><span>Style + cut</span></button>
      <button type="button" class="capubStep" data-step="items"><strong>3. Items</strong><span>Ribbons &amp; badges</span></button>
      <button type="button" class="capubStep" data-step="export"><strong>4. Export</strong><span>Validate + PNG</span></button>`;
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
    safeBy('zoomOutBtn').onclick=()=>setZoom(Math.max(.55,V3.zoom-.1));
    safeBy('zoomInBtn').onclick=()=>setZoom(Math.min(1.65,V3.zoom+.1));
    safeBy('zoomFitBtn').onclick=()=>fitZoom();
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
    const z=Math.min(1, Math.max(.5, available/previewWidth));
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
    bar.innerHTML=`<button type="button" id="cmdRibbons">Ribbons</button><button type="button" id="cmdBadges">Badges</button><button type="button" id="cmdPatches">Patches</button><button type="button" class="ghost" id="cmdValidate">Validate</button><button type="button" id="cmdDownload">Download PNG</button>`;
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
  function refreshAll(){ ensureProgress(); ensureEmptyState(); updateEmptyState(); ensurePreviewToolbar(); ensureCommandBar(); polishPanels(); updateProgress(); updateTopBar(); markActiveUniform(); }
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
