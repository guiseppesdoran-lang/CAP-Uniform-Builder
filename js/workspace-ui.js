// The workspace UI behavior module: the stepper panel (step tabs, one step at a time, Back and Next, the
// bottom sheet on a phone), the preview toolbar and zoom, the preview's empty state, the header chips
// and the toast. It runs as an IIFE at the same point in the load order as before.

/* ===========================
   CAPUB V3 POLISHED UI BEHAVIOR
   =========================== */
(function capubV3PolishedUI(){
  const V3 = window.CAPUB_V3 = { zoom: 1, compact:false };
  const safeBy = id => document.getElementById(id);
  // To this width the page is a phone stack (styles/app.css): app bar, step strip, the preview as a peek or full
  // screen, the step, a fixed action bar. Above it the panel sits beside the preview.
  const PHONE_QUERY='(max-width:700px)';
  const isPhone=()=>window.matchMedia(PHONE_QUERY).matches;
  const isPreviewFull=()=>document.body.classList.contains('previewFull');
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

  /* ---------- the stepper: four tabs, one step on screen, Back and Next in the footer ---------- */
  const STEP_ORDER=['profile','uniform','items','export'];
  const STEP_NAMES={profile:'Profile',uniform:'Uniform',items:'Items',export:'Extra'};
  // Awards are optional, so Extra only waits on profile and uniform.
  const STEP_PREREQS={profile:[],uniform:['profile'],items:['profile','uniform'],export:['profile','uniform']};
  // The step on screen. Null until the first render, which opens the first unfinished step.
  let activeStep=null;

  function getStepStatuses(){
    // The cut is part of the profile: the preview cannot draw without it.
    const hasProfile=!!(State.membership && State.rank && State.gender);
    const hasUniform=hasProfile && !!State.uniform;
    // Items holds the uniform's own options too (headgear, sleeves, the cord): choosing one counts as working on the step.
    const hasOptions=!!(State.shoulderCord || (State.garment && Object.keys(State.garment).length));
    const hasItems=!!((State.ribbons&&State.ribbons.length)||(State.badges&&State.badges.length)||(State.patches&&State.patches.length)||hasOptions);
    const warnings=parseInt((safeBy('capubV2WarningCount')||{}).textContent||'0',10)||0;
    const done={profile:hasProfile,uniform:hasUniform,items:hasUniform&&hasItems,export:hasUniform&&hasItems&&warnings===0};
    const current=STEP_ORDER.find(k=>!done[k]) || 'export';
    return {done,current};
  }
  const reachable=(step,done)=>STEP_PREREQS[step].every(k=>done[k]);
  const stepOf=el=>{ const g=el && el.closest ? el.closest('.stepGroup') : null; return g ? g.id.replace(/^stepGroup-/,'') : null; };

  // The preview stays blank until membership, rank and cut are all chosen; the footer's reason line says what is
  // missing (the card that used to list it over the preview is gone: LIVE13, Ethan found it confusing).
  function getProfileGaps(){
    return [
      {label:'Membership type',short:'a membership type',target:'membershipType',ok:!!State.membership},
      {label:'Rank',short:'a rank',target:'rankSetupSelect',ok:!!State.rank},
      {label:'Cut (male or female)',short:'the cut',target:'jacketSelect',ok:!!State.gender}
    ];
  }
  function listWords(words){
    if(words.length<2) return words.join('');
    return words.slice(0,-1).join(', ')+' and '+words[words.length-1];
  }
  // Why Next is closed on the step shown, in the member's words; empty when it is open.
  function nextNeeds(step,done){
    const nextStep=STEP_ORDER[STEP_ORDER.indexOf(step)+1];
    if(!nextStep || reachable(nextStep,done)) return '';
    if(step==='profile') return `Choose ${listWords(getProfileGaps().filter(g=>!g.ok).map(g=>g.short))} to go on.`;
    if(step==='uniform') return 'Choose a uniform to go on.';
    return 'Finish the earlier steps first.';
  }

  // Show a step. One whose prerequisites are not done opens the first unfinished step instead.
  function showStep(step,{focus=true}={}){
    if(!STEP_ORDER.includes(step)) return;
    const {done,current}=getStepStatuses();
    activeStep=reachable(step,done) ? step : current;
    const shell=safeBy('layoutShell');
    if(shell && !shell.classList.contains('sidebar-open') && typeof capubSetSidebarOpen==='function') capubSetSidebarOpen(true);
    renderStepper();
    const body=safeBy('stepBody'); if(body) body.scrollTop=0;
    // On a phone the step decides how the preview shows (hidden, a peek, the page's width), so it is refitted.
    if(isPhone()){ window.scrollTo(0,0); if(!V3.userZoomed) fitZoom(); }
    if(focus){
      // Focus lands on the step's heading, so a keyboard or screen-reader user arrives on the new step.
      const heading=safeBy('stepGroup-'+activeStep)?.querySelector('.stepGroupTitle');
      if(heading) heading.focus({preventScroll:true});
    }
  }
  // Show the step that holds a control; the notices' Fix buttons use it before focusing one.
  function showStepFor(el){
    const step=stepOf(el);
    if(step && step!==activeStep) showStep(step,{focus:false});
  }
  // Open the step a control is in, scroll to it and focus it. The membership and cut selects stand behind two
  // buttons (js/setup.js), so the first button takes the focus for them.
  function focusControl(id){
    const el=safeBy(id); if(!el) return;
    showStepFor(el);
    const target=(el.classList.contains('segmentedSource') && document.querySelector(`.segmented[data-segments-for="${id}"] button`)) || el;
    setTimeout(()=>{ target.scrollIntoView({behavior:'smooth',block:'center'}); target.focus({preventScroll:true}); },60);
  }

  function renderStepper(){
    if(typeof State==='undefined' || !safeBy('stepTab-profile')) return;
    const {done,current}=getStepStatuses();
    if(activeStep===null || !reachable(activeStep,done)) activeStep=current;
    STEP_ORDER.forEach(k=>{
      const tab=safeBy('stepTab-'+k), group=safeBy('stepGroup-'+k);
      const open=reachable(k,done), shown=k===activeStep;
      if(tab){
        tab.classList.toggle('done',!!done[k]);
        tab.classList.toggle('blocked',!open);
        tab.setAttribute('aria-selected',String(shown));
        tab.setAttribute('aria-disabled',String(!open));
        tab.tabIndex=shown ? 0 : -1;
        if(shown) tab.setAttribute('aria-current','step'); else tab.removeAttribute('aria-current');
        tab.title=open ? '' : 'Finish the earlier steps first';
      }
      if(group) group.hidden=!shown;
    });
    const shell=safeBy('layoutShell'); if(shell) shell.setAttribute('data-step',activeStep);
    const i=STEP_ORDER.indexOf(activeStep), nextStep=STEP_ORDER[i+1];
    const back=safeBy('stepBack'), next=safeBy('stepNext'), note=safeBy('stepFooterNote'), download=safeBy('downloadImage');
    if(back) back.hidden=i<=0;
    if(next){
      next.hidden=!nextStep;
      if(nextStep){
        next.textContent=`Next: ${STEP_NAMES[nextStep]}`;
        next.disabled=!reachable(nextStep,done);
      }
    }
    // On the last step the download is the primary action in the footer (placeDownload moved it there).
    if(download && download.closest('#stepFooter')) download.hidden=!!nextStep;
    if(note){
      const need=nextNeeds(activeStep,done);
      note.textContent=need; note.hidden=!need;
    }
    syncScrollHint();
  }
  // A fade above the footer while the step on screen has more below the fold.
  function syncScrollHint(){
    const body=safeBy('stepBody'), aside=safeBy('controls'), more=safeBy('stepMoreBtn');
    if(!body || !aside) return;
    const hasMore=!isPhone() && body.scrollHeight-body.clientHeight-body.scrollTop>2;
    aside.classList.toggle('hasMoreBelow', hasMore);
    if(more) more.hidden=!hasMore;
  }
  function wireStepper(){
    const tabs=document.querySelector('.stepTabs');
    if(!tabs || tabs.dataset.wired) return;
    tabs.dataset.wired='1';
    tabs.addEventListener('click',e=>{
      const tab=e.target.closest('.stepTab');
      if(tab) showStep(tab.dataset.step);
    });
    // Arrow keys move between the steps that are open; Home and End go to the first and last of them.
    tabs.addEventListener('keydown',e=>{
      const move={ArrowRight:1,ArrowLeft:-1,Home:'first',End:'last'}[e.key];
      if(move===undefined) return;
      const {done}=getStepStatuses();
      const open=STEP_ORDER.filter(k=>reachable(k,done));
      const at=Math.max(0,open.indexOf(activeStep));
      const to=move==='first' ? open[0] : move==='last' ? open[open.length-1] : open[(at+move+open.length)%open.length];
      e.preventDefault();
      showStep(to,{focus:false});
      safeBy('stepTab-'+to)?.focus();
    });
    safeBy('stepBack')?.addEventListener('click',()=>{ const i=STEP_ORDER.indexOf(activeStep); if(i>0) showStep(STEP_ORDER[i-1]); });
    safeBy('stepNext')?.addEventListener('click',()=>{ const i=STEP_ORDER.indexOf(activeStep); if(i<STEP_ORDER.length-1) showStep(STEP_ORDER[i+1]); });
    safeBy('stepMoreBtn')?.addEventListener('click',()=>{ const body=safeBy('stepBody'); if(body) body.scrollBy({top:Math.round(body.clientHeight*0.8),behavior:'smooth'}); });
    placeDownload();
    // After Resume, go to the first unfinished step instead of staying where the page opened.
    document.addEventListener('click',e=>{
      if(e.target && e.target.id==='capubResumeYes') setTimeout(()=>{ activeStep=null; renderStepper(); },500);
    },true);
    const body=safeBy('stepBody');
    if(body){
      body.addEventListener('scroll',syncScrollHint,{passive:true});
      if(typeof ResizeObserver==='function'){
        const ro=new ResizeObserver(syncScrollHint);
        ro.observe(body);
        body.querySelectorAll('.stepGroup').forEach(g=>ro.observe(g));
      }
    }
    window.addEventListener('resize',syncScrollHint);
  }
  // The download is the last step's primary action, so the button moves from the Finish panel into the footer. The
  // page's markup keeps it in the panel because js/placement-templates.js adds its Templates entry after that block.
  function placeDownload(){
    const download=safeBy('downloadImage'), row=document.querySelector('#stepFooter .stepFooterRow');
    if(!download || !row || download.parentNode===row) return;
    const action=download.closest('.finishAction');
    row.appendChild(download);
    if(action) action.hidden=true;
  }

  /* ---------- the Items cards: a count and the rule for this uniform on each ---------- */
  const rules=()=>window.CAPUBUniformRules;
  const BADGE_RULE='Each badge is placed where CAPR 39-1 puts it.';
  function ribbonRule(uniformId){
    const r=rules(); if(!r) return 'Choose the ribbons you have earned.';
    const policy=r.ribbonPolicy(uniformId);
    if(policy==='required') return 'Required on this uniform.';
    if(policy==='optional') return 'Optional on this uniform.';
    if(r.allowsMiniMedals(uniformId)) return 'Worn as miniature medals on this uniform.';
    return 'Not worn on this uniform; kept for the ones that wear them.';
  }
  function updateItemCards(){
    if(typeof State==='undefined') return;
    const r=rules(), u=State.uniform;
    const auth=(typeof UI_AUTHZ!=='undefined' && UI_AUTHZ[u]) || {showBadges:true,showPatches:true};
    const ribbons=new Set((State.ribbons||[]).map(x=>x.id)).size;
    const badges=typeof countBadgesForLimit==='function' ? countBadgesForLimit() : (State.badges||[]).length;
    const cap=r ? (r.getUniformRule(u)||{}).badgeCap : null;
    const dflt=r ? (r.getUniformRule(u)||{}).badgeDefault : null;
    // An officer's flight suit tag is the cloth one, 'may include one badge' (CAPR 39-1 8.2.4.1, 8.3.4.1).
    const officerCap=r ? (r.getUniformRule(u)||{}).officerBadgeCap : null;
    const officerTag=!!officerCap && typeof CAPUBEngine!=='undefined' && (()=>{ const g=CAPUBEngine.grades.gradeInfo(State.membership,State.rank,{track:(State.garment||{}).noGradeTrack}); return !!(g.officer && !g.cadet || (g.category==='senior-none' && g.track==='officer')); })();
    const patches=(State.patches||[]).length;
    const set=(key,count,n,rule,usable)=>{
      const card=document.querySelector(`.itemCard[data-card="${key}"]`); if(!card) return;
      const chip=card.querySelector('[data-count]');
      if(chip){ chip.textContent=count; chip.dataset.short=count.replace(/ selected$/,'').replace(/ of /,'/'); chip.classList.toggle('hasItems',n>0); }
      const line=card.querySelector('[data-rule]');
      if(line) line.textContent=rule;
      card.classList.toggle('unavailable',!usable);
    };
    set('ribbons',`${ribbons} selected`,ribbons,ribbonRule(u),!r || r.allowsRibbons(u) || r.allowsMiniMedals(u));
    // Remove ribbons: only where the regulation makes them optional, and the box follows the saved setup.
    const removeRow=safeBy('removeRibbonsRow'), removeBox=safeBy('removeRibbons');
    if(removeRow) removeRow.classList.toggle('hidden', !(r && r.ribbonPolicy(u)==='optional' && State.membership));
    if(removeBox) removeBox.checked=!!State.hideRibbons;
    const planned=(!auth.showBadges && r) ? r.plannedBadge(u) : null;
    set('badges',
      planned ? `Up to ${planned.count}` : (cap ? `${badges} of ${officerTag ? officerCap : cap}` : `${badges} selected`),
      badges,
      (!planned && cap && officerTag) ? `The officer's cloth name tag may include one badge (CAPR 39-1 ${((r.getUniformRule(u)||{}).refs||{}).badges}).` :
      (!planned && cap) ? (dflt && dflt<cap ? `${dflt} by default, up to ${cap} on this uniform, each where CAPR 39-1 puts it.` : `At most ${cap} on this uniform, each where CAPR 39-1 puts it.`) : BADGE_RULE,
      !!auth.showBadges || !!planned);
    set('patches',`${patches} selected`,patches,auth.showPatches ? 'Choose the patches you wear.' : 'Not worn on this uniform.',!!auth.showPatches);
  }
  // The member-report importer: one button at rest; once a report has been read, its result and the clear button.
  function watchImporter(){
    const status=safeBy('memberReportImportStatus'), clear=safeBy('clearImportedReportBtn');
    if(!status || !clear || status.dataset.watched) return;
    status.dataset.watched='1';
    const first=status.textContent;
    // The clear button (js/member-report-import.js) writes its own idle line; both mean nothing is imported.
    const idle=()=>{ const t=status.textContent.trim(); return t===first.trim() || /^No report imported yet\.?$/.test(t); };
    const sync=()=>{ clear.hidden=idle(); };
    sync();
    if(typeof MutationObserver==='function') new MutationObserver(sync).observe(status,{childList:true,characterData:true,subtree:true});
  }

  /* ---------- the phone: app-bar icons, the preview as a peek or full screen ---------- */
  // Undo and Redo sit in the app bar on a phone and in the preview toolbar elsewhere; the theme button is an icon
  // there (its data-mode picks the glyph). Idempotent: called on load, on every refresh and when the width crosses 700px.
  function syncPhoneChrome(){
    const phone=isPhone();
    const history=document.querySelector('.previewToolCard[aria-label="Undo and redo"]');
    const header=document.querySelector('body > header'), tools=safeBy('previewTools');
    if(history && header && tools){
      if(phone && history.parentNode!==header) header.insertBefore(history, safeBy('themeToggle'));
      else if(!phone && history.parentNode!==tools) tools.insertBefore(history, tools.firstChild);
    }
    const theme=safeBy('themeToggle');
    if(theme) theme.dataset.mode=currentTheme();
    const full=isPreviewFull();
    if(!phone && full) closePreview();
    const peek=safeBy('previewPeekBtn'); if(peek) peek.hidden=!phone || full;
    const close=safeBy('previewCloseBtn'); if(close) close.hidden=!(phone && full);
  }
  // On a phone the preview is a peek on steps 2 and 3 and at full width on step 4; a tap opens it over the page with
  // its own Close, Fit, zoom and Measurements.
  function openPreview(){
    if(!isPhone() || isPreviewFull()) return;
    document.body.classList.add('previewFull');
    V3.userZoomed=false;
    syncPhoneChrome();
    fitZoom();
    safeBy('previewCloseBtn')?.focus();
  }
  function closePreview(){
    if(!isPreviewFull()) return;
    document.body.classList.remove('previewFull');
    V3.userZoomed=false;
    syncPhoneChrome();
    fitZoom();
    safeBy('previewPeekBtn')?.focus();
  }
  function wirePhone(){
    const wrap=safeBy('previewWrapper');
    if(!wrap || wrap.dataset.phoneWired) return;
    wrap.dataset.phoneWired='1';
    safeBy('previewPeekBtn')?.addEventListener('click',e=>{ e.stopPropagation(); openPreview(); });
    // A tap anywhere on the peek opens it (the drawing takes no pointer events there, styles/app.css).
    wrap.addEventListener('click',e=>{
      if(!isPhone() || isPreviewFull()) return;
      const step=safeBy('layoutShell')?.getAttribute('data-step');
      if(step!=='uniform' && step!=='items') return;
      if(e.target.closest('button,.resumeBanner,.previewToolbar,.itemPopover')) return;
      openPreview();
    });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape' && isPreviewFull()) closePreview(); });
    const mq=window.matchMedia(PHONE_QUERY);
    const onChange=()=>{ syncPhoneChrome(); if(typeof capubSetSidebarOpen==='function') capubSetSidebarOpen(true); if(!V3.userZoomed) fitZoom(); };
    if(mq.addEventListener) mq.addEventListener('change',onChange); else if(mq.addListener) mq.addListener(onChange);
  }

  V3.getStepStatuses=getStepStatuses;
  V3.stepOrder=STEP_ORDER;
  V3.showStep=showStep;
  V3.showStepFor=showStepFor;
  V3.focusControl=focusControl;
  V3.openPreview=openPreview;
  V3.closePreview=closePreview;
  V3.isPhone=isPhone;
  V3.uniformName=uniformName;
  Object.defineProperty(V3,'activeStep',{get:()=>activeStep});

  /* ---------- the preview: toolbar, zoom ---------- */
  function ensurePreviewToolbar(){
    const wrap=safeBy('previewWrapper'); if(!wrap || safeBy('previewToolbar')) return;
    // One row above the uniform: status chips on the left, zoom on the right.
    // They used to be two separate floating cards that overlapped each other and,
    // beside the sidebar at ~1024px, pushed the zoom card off the right edge.
    const toolbar=document.createElement('div'); toolbar.id='previewToolbar'; toolbar.className='previewToolbar';
    toolbar.innerHTML=`<div id="capubTopBar" class="capubTopBar"><span class="capubPill">Uniform: <strong id="topUniformText">None</strong></span><span class="capubPill">Items: <strong id="topItemsText">0</strong></span></div><div id="previewTools" class="previewTools"><div class="previewToolCard" role="group" aria-label="Preview zoom"><button type="button" class="ghost" id="zoomOutBtn" aria-label="Zoom out">−</button><span class="zoomReadout" id="zoomReadout" aria-live="polite">100%</span><button type="button" class="ghost" id="zoomInBtn" aria-label="Zoom in">+</button><button type="button" class="ghost" id="zoomFitBtn">Fit</button></div></div>`;
    wrap.insertBefore(toolbar, wrap.firstChild);
    // Undo and redo sit in front of the zoom controls.
    const history=document.createElement('div');
    history.className='previewToolCard'; history.setAttribute('role','group'); history.setAttribute('aria-label','Undo and redo');
    history.innerHTML='<button type="button" class="ghost" id="undoBtn" aria-label="Undo">Undo</button><button type="button" class="ghost" id="redoBtn" aria-label="Redo">Redo</button>';
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
    // Measurements: the regulation distances drawn on the uniform, for copying onto a real one.
    const measure=document.createElement('div');
    measure.className='previewToolCard'; measure.setAttribute('role','group'); measure.setAttribute('aria-label','Measurements');
    // One control: the button switches the overlay, the caret attached to it opens the list of what is drawn (js/measure-panel.js).
    measure.classList.add('measureGroup');
    measure.innerHTML='<button type="button" class="ghost" id="measureBtn" aria-pressed="false" title="Show the regulation distances on the uniform">Measurements</button>'
      +'<button type="button" class="ghost measureCaret" id="measureListBtn" aria-label="Measurement options" title="Choose which measurements are drawn" aria-haspopup="dialog" aria-expanded="false" aria-controls="measurePanel"><span class="measureCaretIcon" aria-hidden="true"></span></button>';
    safeBy('previewTools').appendChild(measure);
    // On a phone the preview opens over the page; this closes it (hidden everywhere else, styles/app.css).
    const closeCard=document.createElement('div');
    closeCard.className='previewToolCard'; closeCard.setAttribute('role','group'); closeCard.setAttribute('aria-label','Close the preview');
    closeCard.innerHTML='<button type="button" class="ghost" id="previewCloseBtn" hidden>Close</button>';
    safeBy('previewTools').appendChild(closeCard);
    safeBy('previewCloseBtn').onclick=()=>closePreview();
    safeBy('measureBtn').onclick=()=>{
      State.showMeasurements=!State.showMeasurements;
      safeBy('measureBtn').setAttribute('aria-pressed', String(!!State.showMeasurements));
      window.CAPUBMeasure&&CAPUBMeasure.sync();
      if(State.showMeasurements && window.CAPUBMeasure) CAPUBMeasure.firstTimeOn();
      window.CAPUBUniformView&&CAPUBUniformView.scheduleRender();
    };
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
      // On a phone, centre the scaled uniform in the room beside it instead of hugging the left.
      const wrap=safeBy('previewWrapper');
      if(wrap && isPhone()){
        const style=getComputedStyle(wrap);
        const inner=wrap.clientWidth - parseFloat(style.paddingLeft||0) - parseFloat(style.paddingRight||0);
        const free=inner - area.offsetWidth*V3.zoom;
        area.style.marginLeft=free>0 ? Math.round(free/2)+'px' : '';
      }else{
        area.style.marginLeft='';
      }
    }
    const ro=safeBy('zoomReadout'); if(ro) ro.textContent=Math.round(V3.zoom*100)+'%';
  }
  // The header can wrap and the footer is two lines on a phone, so the shell is sized from what
  // they measure, not from a fixed number: the sidebar always reaches exactly from one to the other.
  function syncChromeHeights(){
    const root=document.documentElement;
    const header=document.querySelector('body > header'), footer=safeBy('pageFooter');
    if(header) root.style.setProperty('--chrome-header-h', header.offsetHeight + 'px');
    if(footer) root.style.setProperty('--chrome-footer-h', footer.offsetHeight + 'px');
  }
  function watchChromeHeights(){
    syncChromeHeights();
    window.addEventListener('resize', syncChromeHeights);
    window.addEventListener('orientationchange', syncChromeHeights);
    if(window.visualViewport) window.visualViewport.addEventListener('resize', syncChromeHeights);
    // The footer changes size at these widths; do not wait for the observer.
    for(const q of [PHONE_QUERY,'(max-width:480px)','(max-width:360px)']){
      const mq=window.matchMedia(q);
      if(mq.addEventListener) mq.addEventListener('change', syncChromeHeights);
    }
    if(typeof ResizeObserver==='function'){
      const ro=new ResizeObserver(syncChromeHeights);
      for(const el of [document.querySelector('body > header'), safeBy('pageFooter')]) if(el) ro.observe(el);
    }
    // Web fonts change the wrapping once they load.
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(syncChromeHeights);
  }
  function fitZoom(){
    const wrap=safeBy('previewWrapper'), area=safeBy('previewArea');
    if(!wrap || !area) return setZoom(1);
    const phone=isPhone();
    // Only the wrapper's side padding: the zoom controls live in a toolbar row above the uniform.
    const reserve=phone ? 24 : 44;
    const available=Math.max(phone ? 120 : 240,wrap.clientWidth-reserve);
    const previewWidth=area.offsetWidth || 450, previewHeight=area.offsetHeight || 600;
    // The wide field-uniform stage needs a lower floor to fit a phone without sideways scrolling.
    let z=Math.min(1, Math.max(.3, available/previewWidth));
    if(phone){
      const step=safeBy('layoutShell')?.getAttribute('data-step');
      if(isPreviewFull()){
        // The whole uniform on the screen under the toolbar, if it can be.
        const toolbar=safeBy('previewToolbar');
        const room=window.innerHeight-(toolbar ? toolbar.offsetHeight : 0)-40;
        if(room>120) z=Math.min(z, Math.max(.3, room/previewHeight));
      }else if(step==='uniform' || step==='items'){
        // The peek: the whole uniform in a short strip beside the Expand button.
        const room=wrap.clientHeight-16;
        if(room>40) z=Math.min(z, Math.max(.12, room/previewHeight));
      }else if(step==='export'){
        // Extra: the uniform above the check and the actions, not a full screen of it.
        const room=window.innerHeight*.46;
        if(room>120) z=Math.min(z, Math.max(.3, room/previewHeight));
      }
    }
    V3.fitWidth=previewWidth;
    setZoom(z);
  }
  // A uniform as the member reads it, from its card ("Blues: Class A", "OCP"), not its id ("Blues A", "Ocp").
  function uniformName(id){
    const card=[...document.querySelectorAll('.uniformOption')].find(b=>b.dataset.uniformId===id);
    const name=card && card.querySelector('.uName');
    return name ? name.textContent.trim() : String(id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  }
  function updateTopBar(){
    if(typeof State==='undefined') return;
    const uniform=safeBy('topUniformText'), items=safeBy('topItemsText');
    // Until membership, rank and cut are chosen the default would read as a real selection ("BLUES A") over an empty preview.
    const setupNeeded = !(State.membership && State.rank && State.gender);
    if(uniform) uniform.textContent = (State.uniform && !setupNeeded) ? uniformName(State.uniform) : '—';
    if(items) items.textContent = ((State.ribbons||[]).length + (State.badges||[]).length + (State.patches||[]).length).toString();
    // The preview is a picture, so say what it shows for anyone who cannot see it.
    const area=safeBy('previewArea');
    if(area){
      // Nothing to show yet: no blank white sheet in the middle of the page (styles/app.css #previewArea.isEmpty).
      area.classList.toggle('isEmpty',setupNeeded);
      area.setAttribute('role','group');
      area.setAttribute('aria-label', setupNeeded
        ? 'Uniform preview. Choose a membership type, rank and cut to begin.'
        : `Uniform preview: ${State.rank || ''} ${State.uniform ? uniformName(State.uniform) : ''} with ${(State.ribbons||[]).length} ribbons, ${(State.badges||[]).length} badges and ${(State.patches||[]).length} patches. Select an item to remove it.`.replace(/\s+/g,' '));
    }
  }
  function markActiveUniform(){
    if(typeof State==='undefined') return;
    document.querySelectorAll('.uniformOption').forEach(btn=>btn.classList.toggle('activeUniform',btn.dataset.uniformId===State.uniform));
  }
  // The Uniform options card at the top of the Items step (headgear, sleeves, skirt, the cord and the rest): shown while one of its two panels
  // has something for the uniform chosen, hidden when neither has. The panels follow the uniform themselves (js/garment-options.js render,
  // js/patches.js syncShoulderCordControl).
  function syncUniformOptionsCard(){
    const card=safeBy('uniformOptionsCard');
    if(!card) return;
    const shown=['garmentOptionsPanel','shoulderCordPanel'].map(safeBy).filter(p=>p && !p.hidden && !p.classList.contains('hidden'));
    card.hidden=!shown.length;
  }
  // The uniforms this member may not wear (js/setup.js marks them .locked with the reason) move out of the grid into
  // one fold at the end of the list, and back to their place in the regulation's order when they are allowed again, so
  // the list a member picks from is only what they may wear and still says why the rest is not there.
  function placeLockedUniforms(){
    const fold=safeBy('lockedUniforms'), grid=safeBy('lockedUniformGrid'), summary=safeBy('lockedUniformsSummary');
    const home=document.querySelector('#uniformList > .uniformGrid');
    if(!fold || !grid || !home) return;
    const cards=[...document.querySelectorAll('#uniformList .uniformOption')];
    cards.forEach((card,i)=>{
      if(!card.dataset.homeOrder) card.dataset.homeOrder=String(i);
      const locked=card.classList.contains('locked');
      if(locked && card.parentNode!==grid) grid.appendChild(card);
      if(!locked && card.parentNode===grid){
        const after=[...home.children].find(c=>Number(c.dataset.homeOrder)>Number(card.dataset.homeOrder));
        home.insertBefore(card,after||null);
      }
    });
    const n=grid.children.length;
    fold.hidden=n===0;
    if(summary && typeof State!=='undefined'){
      const who=State.membership==='cadet' ? 'cadets' : State.membership==='senior' ? 'senior members' : 'you';
      summary.textContent=`Not for ${who}: ${n} uniform${n===1?'':'s'}`;
    }
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
    const label=()=>{ const dark=currentTheme()==='dark'; btn.textContent=dark?'Light mode':'Dark mode'; btn.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode'); btn.dataset.mode=dark?'dark':'light'; };
    btn.addEventListener('click',()=>{
      const next=currentTheme()==='dark'?'light':'dark';
      document.documentElement.setAttribute('data-theme',next);
      try{ localStorage.setItem('capubTheme',next); }catch(_){}
      label();
    });
    label();
    header.appendChild(btn);
  }
  function refreshAll(){ ensureThemeToggle(); ensurePreviewToolbar(); wireStepper(); wirePhone(); watchImporter(); renderStepper(); syncPhoneChrome(); updateItemCards(); updateTopBar(); markActiveUniform(); placeLockedUniforms(); syncUniformOptionsCard(); refitIfStageChanged(); }
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
  document.addEventListener('capub:history',scheduleRefresh);
  window.addEventListener('resize',()=>{ if(V3.zoom<=1) fitZoom(); });
  // Opening, closing or resizing the controls sheet changes the room the uniform has.
  document.addEventListener('capub:sidebar',()=>{ if(!V3.userZoomed) setTimeout(fitZoom,230); });
  // A new drawing can change the stage's width (a wide field uniform sheet, a tall coat).
  document.addEventListener('capub:rendered',()=>{ if(!V3.userZoomed) fitZoom(); });
  watchChromeHeights();
  // The side panel is always open; js/setup.js closed it below 768px for the sheet that is gone.
  if(typeof capubSetSidebarOpen==='function') capubSetSidebarOpen(true);
  // The tabs and footer work from the first paint: wire them now, and again (idempotently) with the first refresh.
  wireStepper(); wirePhone(); watchImporter(); renderStepper();
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

// Click an item on the uniform to take it off. A small prompt names the item and asks before it
// goes, because a stray click on a crowded rack should not delete anything. The selection is
// unchecked, exactly as unticking it in the picker would, so Undo brings it back.
(function capubRemoveFromPreview(){
  const safeBy=id=>document.getElementById(id);
  const canvas=safeBy('uniformCanvas');
  if(!canvas) return;
  let pop=null;

  function describe(layer){
    const key=String(layer.dataset.calibKey || '');
    const m=/^(ribbon|mini|badge|patch|patchRegV2):([^:#]+)/.exec(key);
    if(!m) return null;
    const [,kind,id]=m;
    if(kind==='ribbon' || kind==='mini'){
      if(typeof getRibbonDisplayName!=='function') return null;
      return {type:'ribbon',id,name:getRibbonDisplayName(id)};
    }
    if(kind==='badge'){
      return {type:'badge',id,name:typeof getBadgeDisplayName==='function' ? getBadgeDisplayName(id) : id};
    }
    return {type:'patch',id,name:(typeof PATCH_META!=='undefined' && PATCH_META[id] && PATCH_META[id].label) || id.replace(/_/g,' ')};
  }
  function close(){
    if(pop){ pop.remove(); pop=null; }
    document.removeEventListener('keydown',onKey,true);
    document.removeEventListener('mousedown',onOutside,true);
  }
  function onKey(e){ if(e.key==='Escape') close(); }
  function onOutside(e){ if(pop && !pop.contains(e.target)) close(); }

  function remove(item){
    try{
      if(item.type==='ribbon'){
        const sel=State.ribbonSelections && State.ribbonSelections[item.id];
        if(sel) sel.checked=false;
        rebuildRibbonsFromGallery();
      }else if(item.type==='badge'){
        const sel=State.badgeSelections && State.badgeSelections[item.id];
        if(sel) sel.checked=false;
        rebuildBadgesFromGallery();
      }else{
        const sel=State.patchSelections && State.patchSelections[item.id];
        if(sel) sel.checked=false;
        rebuildPatchesFromGallery();
      }
      if(typeof fullRender==='function') fullRender();
    }catch(err){
      console.error('Remove from preview failed:',err);
    }
  }

  function show(item,x,y){
    close();
    pop=document.createElement('div');
    pop.className='itemPopover'; pop.setAttribute('role','dialog'); pop.setAttribute('aria-label','Remove item');
    const label=document.createElement('div'); label.className='itemPopoverName'; label.textContent=item.name;
    const row=document.createElement('div'); row.className='itemPopoverActions';
    const del=document.createElement('button'); del.type='button'; del.textContent='Remove';
    const keep=document.createElement('button'); keep.type='button'; keep.className='ghost'; keep.textContent='Keep';
    del.addEventListener('click',()=>{ remove(item); close(); });
    keep.addEventListener('click',close);
    row.append(del,keep);
    pop.append(label,row);
    document.body.appendChild(pop);
    // Keep it on screen.
    const w=pop.offsetWidth, h=pop.offsetHeight;
    pop.style.left=Math.max(8,Math.min(x+8,window.innerWidth-w-8))+'px';
    pop.style.top=Math.max(8,Math.min(y+8,window.innerHeight-h-8))+'px';
    document.addEventListener('keydown',onKey,true);
    // Next tick, so the click that opened it is not treated as an outside click.
    setTimeout(()=>document.addEventListener('mousedown',onOutside,true),0);
    del.focus();
  }

  canvas.addEventListener('click',e=>{
    const layer=e.target.closest && e.target.closest('.layer');
    if(!layer || !canvas.contains(layer)) return;
    const item=describe(layer);
    if(!item) return;
    show(item,e.clientX,e.clientY);
  });
})();

// Autosave and resume. The setup is written to this browser a moment after every change, so
// a refresh or a closed tab no longer loses it. On the next visit the member is asked whether
// to resume; nothing is loaded silently. It is separate from "Save to browser", which stays a
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
    if(profile.uniform) bits.push(window.CAPUB_V3.uniformName(profile.uniform)); // the Resume banner is a separate module from the name's
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
    const phone=window.matchMedia('(max-width:700px)').matches, body=safeBy('stepBody');
    const toolbar=safeBy('previewToolbar');
    if(phone && body) body.insertBefore(box,body.firstChild);
    else if(toolbar && toolbar.parentNode===wrap) wrap.insertBefore(box,toolbar.nextSibling);
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
  const feedback = document.getElementById('aboutFeedback');
  if(feedback){
    const sync = () => { feedback.hidden = !(window.CAPUBFeedback && typeof window.CAPUBFeedback.open === 'function'); };
    sync(); document.addEventListener('DOMContentLoaded', sync); setTimeout(sync, 400);
    feedback.addEventListener('click', () => { dialog.close(); window.CAPUBFeedback?.open(); });
  }
  // A click on the dimmed area outside the box closes it.
  dialog.addEventListener('click', event => { if(event.target === dialog) dialog.close(); });
})();
