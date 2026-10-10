// Guided flow, behind ?ux=2. The sidebar shows one step at a time: the finished steps fold
// into a one-line summary with an Edit button, and Back and Next move between them. Uniforms
// are grouped by occasion (CAPR 39-1 Table 1-1) with the reason for any that are locked, and
// the Items step leads with a card per kind of item instead of every control at once.
//
// It only rearranges and annotates the existing controls; every id and handler is the one the
// normal page uses, so with the flag off nothing here runs.
(function capubGuidedFlow(){
  if(typeof CAPUB_GUIDED==='undefined' || !CAPUB_GUIDED) return;

  const by=id=>document.getElementById(id);
  const STEPS=['profile','uniform','items','export'];
  const TITLES={
    profile:'1 · Who you are',
    uniform:'2 · What you are dressing for',
    items:'3 · What goes on it',
    export:'4 · Check & finish'
  };
  const SHORT={profile:'Who you are',uniform:'Uniform',items:'Items',export:'Check & finish'};
  const HINTS={
    profile:'Tell us who this uniform is for. A CAP member report fills this in for you.',
    uniform:'Choose what you are dressing for. We start you on a suggestion; change it if you like.',
    items:'Add what you have earned. Each card shows what this uniform allows.',
    export:'Check the result, then save or download it.'
  };
  const rules=()=>window.CAPUBUniformRules;
  let active=null;
  let built=false;

  const label=id=>String(id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const group=step=>by('stepGroup-'+step);
  const status=()=>window.CAPUB_V3 && window.CAPUB_V3.getStepStatuses ? window.CAPUB_V3.getStepStatuses() : {done:{},current:'profile'};

  function el(tag,cls,text){
    const n=document.createElement(tag);
    if(cls) n.className=cls;
    if(text!==undefined) n.textContent=text;
    return n;
  }

  /* ---------- step chrome: titles, summary rows, Back and Next ---------- */
  function buildStepChrome(){
    STEPS.forEach((step,index)=>{
      const g=group(step); if(!g) return;
      const title=g.querySelector('.stepGroupTitle');
      if(title) title.textContent=TITLES[step];

      const summary=el('div','guidedSummary');
      const text=el('span','guidedSummaryText');
      text.dataset.summary=step;
      const edit=el('button','ghost guidedEdit','Edit');
      edit.type='button';
      edit.setAttribute('aria-label',`Edit ${SHORT[step].toLowerCase()}`);
      edit.addEventListener('click',()=>setActive(step));
      summary.append(text,edit);
      (title ? title.after(summary) : g.prepend(summary));
      const hint=el('p','guidedHint',HINTS[step]);
      summary.after(hint);

      const nav=el('div','guidedNav');
      if(index>0){
        const back=el('button','ghost guidedBack','Back');
        back.type='button';
        back.addEventListener('click',()=>setActive(STEPS[index-1]));
        nav.append(back);
      }
      if(index<STEPS.length-1){
        const next=el('button','guidedNext');
        next.type='button';
        next.dataset.next=step;
        next.addEventListener('click',()=>setActive(STEPS[index+1]));
        nav.append(next);
      }
      g.append(nav);
    });
  }

  /* ---------- uniforms by occasion, with thumbnails and reasons ---------- */
  function buildUniformGroups(){
    const list=by('uniformList');
    if(!list || !rules()) return;
    const buttons=new Map([...list.querySelectorAll('.uniformOption')].map(b=>[b.dataset.uniformId,b]));
    const frag=document.createDocumentFragment();
    Object.entries(rules().GROUPS).forEach(([key,info])=>{
      const ids=rules().uniformIdsInGroup(key).filter(id=>buttons.has(id));
      if(!ids.length) return;
      const section=el('div','guidedUniformGroup');
      section.dataset.group=key;
      section.append(el('div','guidedGroupTitle',info.label));
      const grid=el('div','guidedUniformGrid');
      ids.forEach(id=>{
        const btn=buttons.get(id);
        btn.dataset.group=key;
        const thumb=el('img','guidedThumb');
        thumb.alt=''; thumb.loading='lazy'; thumb.decoding='async';
        thumb.dataset.uniform=id;
        btn.prepend(thumb);
        const tag=el('span','guidedTag','Your minimum uniform');
        tag.hidden=!rules().getUniformRule(id).minimum;
        tag.dataset.tag='minimum';
        const why=el('div','guidedWhy');
        why.dataset.why=id;
        // Name and description move into one column beside the thumbnail.
        const text=el('div','guidedText');
        text.append(...[...btn.children].filter(c=>c!==thumb),tag,why);
        btn.append(text);
        grid.append(btn);
      });
      section.append(grid);
      frag.append(section);
    });
    list.append(frag);
    // Uniforms this member may not wear live in one folded list, each with its reason.
    const locked=el('details','guidedLocked');
    locked.hidden=true;
    locked.append(el('summary','guidedLockedTitle'));
    locked.append(el('div','guidedUniformGrid'));
    list.append(locked);
  }
  // Put each uniform where it belongs for this member: allowed ones in their group, the rest
  // in the folded list. Only moves a card when it is in the wrong place.
  function sortUniforms(){
    const list=by('uniformList');
    const locked=list && list.querySelector('.guidedLocked');
    if(!locked) return;
    const lockedGrid=locked.querySelector('.guidedUniformGrid');
    list.querySelectorAll('.uniformOption').forEach(btn=>{
      const wantLocked=btn.classList.contains('locked');
      const home=wantLocked
        ? lockedGrid
        : list.querySelector(`.guidedUniformGroup[data-group="${btn.dataset.group}"] .guidedUniformGrid`);
      if(home && btn.parentElement!==home) home.append(btn);
    });
    const count=lockedGrid.children.length;
    locked.hidden=count===0;
    locked.querySelector('.guidedLockedTitle').textContent=`Not available to you (${count})`;
    list.querySelectorAll('.guidedUniformGroup').forEach(g=>{
      g.hidden=g.querySelector('.guidedUniformGrid').children.length===0;
    });
  }
  function refreshUniformGroups(){
    const list=by('uniformList');
    if(!list || !rules()) return;
    sortUniforms();
    const gender=State.gender==='female' ? 'female' : 'male';
    list.querySelectorAll('img.guidedThumb').forEach(img=>{
      const id=img.dataset.uniform;
      const cfg=typeof UNIFORMS!=='undefined' ? UNIFORMS[id] : null;
      const src=cfg && (cfg[gender] || cfg.male);
      const want=src && typeof ASSET==='function' ? ASSET(src) : '';
      if(want && img.getAttribute('src')!==want) img.setAttribute('src',want);
    });
    list.querySelectorAll('.guidedWhy').forEach(box=>{
      const reason=rules().lockedReason(box.dataset.why,State.membership);
      box.textContent=reason;
      box.hidden=!reason;
    });
  }

  /* ---------- items: one card per kind, with the rule in words ---------- */
  function buildItemCards(){
    const g=group('items');
    if(!g || by('guidedItemCards')) return;
    const wrap=el('div','guidedItemCards');
    wrap.id='guidedItemCards';
    [
      {key:'ribbons',title:'Ribbons',button:'Choose ribbons',target:'expandRibbons'},
      {key:'badges',title:'Badges',button:'Choose badges',target:'expandBadges'},
      {key:'patches',title:'Patches',button:'Choose patches',target:'expandPatches'}
    ].forEach(card=>{
      const box=el('div','guidedCard');
      box.dataset.card=card.key;
      box.append(el('div','guidedCardTitle',card.title));
      const count=el('div','guidedCardCount'); count.dataset.count=card.key;
      const rule=el('div','guidedCardRule'); rule.dataset.rule=card.key;
      const btn=el('button','',card.button); btn.type='button';
      btn.addEventListener('click',()=>by(card.target)?.click());
      box.append(count,rule,btn);
      wrap.append(box);
    });
    const title=g.querySelector('.stepGroupTitle');
    const summary=g.querySelector('.guidedSummary');
    (summary || title).after(wrap);

    // Everything the cards do not cover goes under one disclosure instead of a long scroll.
    const more=el('details','guidedAdvanced');
    more.append(el('summary','','More options: rack layout, devices, unit patch'));
    ['groupRibbons','groupBadges','groupPatches'].forEach(id=>{
      const panel=by(id); if(panel) more.append(panel);
    });
    wrap.after(more);
  }
  function ribbonRule(uniformId){
    const policy=rules().ribbonPolicy(uniformId);
    if(policy==='required') return 'Required on this uniform.';
    if(policy==='optional') return 'Optional on this uniform.';
    if(rules().allowsMiniMedals(uniformId)) return 'This uniform wears miniature medals.';
    return 'Not worn on this uniform.';
  }
  function refreshItemCards(){
    const wrap=by('guidedItemCards');
    if(!wrap || !rules()) return;
    const uniform=State.uniform;
    const auth=(typeof UI_AUTHZ!=='undefined' && UI_AUTHZ[uniform]) || {showBadges:true,showPatches:true};
    const ribbonIds=new Set((State.ribbons||[]).map(r=>r.id));
    const badgeCount=typeof countBadgesForLimit==='function' ? countBadgesForLimit() : (State.badges||[]).length;
    const cap=(rules().getUniformRule(uniform)||{}).badgeCap;
    const patches=(State.patches||[]).length;
    const wearsRibbons=rules().allowsRibbons(uniform) || rules().allowsMiniMedals(uniform);
    const set=(key,count,rule,usable)=>{
      const box=wrap.querySelector(`[data-card="${key}"]`); if(!box) return;
      box.querySelector('[data-count]').textContent=count;
      box.querySelector('[data-rule]').textContent=rule;
      box.querySelector('button').disabled=!usable;
      box.classList.toggle('unavailable',!usable);
    };
    set('ribbons',
      `${ribbonIds.size} selected`,
      ribbonRule(uniform),
      wearsRibbons);
    set('badges',
      cap ? `${badgeCount} of ${cap} badges` : `${badgeCount} selected`,
      auth.showBadges ? (cap ? `At most ${cap} on this uniform.` : 'Placed where the regulation puts them.') : 'Not worn on this uniform.',
      !!auth.showBadges);
    set('patches',
      `${patches} selected`,
      auth.showPatches ? 'Worn on this uniform.' : 'Not worn on this uniform.',
      !!auth.showPatches);
  }

  /* ---------- advanced: the collar and lapel overlay editor ---------- */
  function tuckAwayOverlay(){
    const panel=by('garmentOverlayPanel');
    const g=group('uniform');
    if(!panel || !g || g.querySelector('.guidedAdvanced')) return;
    const more=el('details','guidedAdvanced');
    more.append(el('summary','','Advanced: collar and lapel overlay'));
    more.append(panel);
    const nav=g.querySelector('.guidedNav');
    g.insertBefore(more,nav);
  }

  /* ---------- state -> screen ---------- */
  function summaryText(step){
    const m=State.membership==='cadet' ? 'Cadet' : State.membership==='senior' ? 'Senior member' : '';
    if(step==='profile') return m && State.rank ? `${m} · ${State.rank}` : 'Not set yet';
    if(step==='uniform'){
      const cut=State.gender==='female' ? 'Female cut' : State.gender==='male' ? 'Male cut' : '';
      return cut && State.uniform ? `${cut} · ${label(State.uniform)}` : 'Not set yet';
    }
    if(step==='items'){
      const r=new Set((State.ribbons||[]).map(x=>x.id)).size, b=(State.badges||[]).length, p=(State.patches||[]).length;
      return `${r} ribbons · ${b} badges · ${p} patches`;
    }
    const w=parseInt((by('capubV2WarningCount')||{}).textContent||'0',10)||0;
    return w ? `${w} to look at` : 'Looks good';
  }
  function setActive(step){
    if(!STEPS.includes(step)) return;
    active=step;
    render();
    const g=group(step);
    if(g) g.scrollIntoView({behavior:'smooth',block:'start'});
    // Move focus to the step's heading so a keyboard or screen-reader user lands on the new step.
    const heading=g && g.querySelector('.stepGroupTitle');
    if(heading){
      heading.tabIndex=-1;
      heading.focus({preventScroll:true});
    }
  }
  function render(){
    if(!built) return;
    const {done,current}=status();
    if(active===null) active=current;
    STEPS.forEach((step,index)=>{
      const g=group(step); if(!g) return;
      g.classList.toggle('isActive',step===active);
      g.classList.toggle('isDone',!!done[step] && step!==active);
      const s=g.querySelector('[data-summary]'); if(s) s.textContent=summaryText(step);
      const next=g.querySelector('.guidedNext');
      if(next){
        const target=STEPS[index+1];
        next.textContent=`Next: ${SHORT[target]}`;
        // Awards are optional, so Items never blocks; Profile and Uniform must be finished.
        next.disabled=(step==='profile' || step==='uniform') && !done[step];
      }
    });
    refreshUniformGroups();
    refreshItemCards();
  }

  // One render per frame. The timer is the fallback for hidden or occluded tabs, where the
  // browser pauses requestAnimationFrame and the sidebar would go stale.
  let queued=false;
  function schedule(){
    if(queued) return;
    queued=true;
    let ran=false;
    const run=()=>{ if(ran) return; ran=true; queued=false; render(); };
    requestAnimationFrame(run);
    setTimeout(run,100);
  }

  function init(){
    if(built) return;
    if(!group('profile') || !by('uniformList') || !window.CAPUB_V3) return setTimeout(init,150);
    buildStepChrome();
    buildUniformGroups();
    buildItemCards();
    tuckAwayOverlay();
    built=true;
    // The step bar at the top moves between steps here instead of scrolling.
    document.addEventListener('click',e=>{
      const stepBtn=e.target.closest && e.target.closest('.capubStep');
      if(!stepBtn) return;
      const {done}=status();
      const target=stepBtn.dataset.step;
      const prereqs={profile:[],uniform:['profile'],items:['profile','uniform'],export:['profile','uniform']}[target]||[];
      setActive(prereqs.every(p=>done[p]) ? target : status().current);
    },true);
    // After "Resume", go to the first unfinished step instead of staying on step one.
    document.addEventListener('click',e=>{
      if(e.target && e.target.id==='capubResumeYes') setTimeout(()=>{ active=null; render(); },500);
    },true);
    ['change','click','input'].forEach(evt=>document.addEventListener(evt,schedule,true));
    document.addEventListener('capub:history',schedule);
    render();
  }
  setTimeout(init,300);
})();
