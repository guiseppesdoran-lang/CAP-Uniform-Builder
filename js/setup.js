// Extracted verbatim from index.html: select population, sidebar toggle, tooltips, the setup flow
// and member type / uniform authorization.

/* ===========================
   POPULATE SELECTS
   =========================== */
function optionize(sel,list, pretty=false){
  sel.innerHTML='';
  list.forEach(v=>{
    const o=document.createElement('option');
    o.value=v;
    o.textContent = pretty ? v : v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    sel.appendChild(o);
  });
}

/*
  Eager asset preloading was removed here.

  It built a hidden <img> for every ribbon, rank, badge and patch at parse
  time with loading='eager' and decoding='sync', which pulled 27.7 MB over
  250 requests before the user had chosen anything - 26.3 MB of that was
  badge art alone, and decoding='sync' forced it onto the main thread.

  Nothing needed it. Every renderer builds its own <img> and resolves the
  source through capubInstallImageFallback(); renderPatches() already had a
  new Image() fallback, and placeBadgeSlotAnchored() only used the preloaded
  node as an existence check, now KNOWN_BADGE_IDS.

  The rank preload was pure waste on top of that: renderRankOverlay() has
  been retired because rank is baked into the base uniform art, and only 9 of
  the ~29 rank ids have files, so most requests 404 and then dragged the
  whole filename-variant fallback chain along behind them.
*/

/* ===========================
   SIDEBAR TOGGLE (HAMBURGER)
   =========================== */
function capubSetSidebarOpen(open){
  layoutShell.classList.toggle('sidebar-open', open);
  layoutShell.classList.toggle('sidebar-collapsed', !open);
  hamburgerBtn.setAttribute('aria-expanded', String(open));
}
function capubToggleSidebar(){
  capubSetSidebarOpen(!layoutShell.classList.contains('sidebar-open'));
}
capubSetSidebarOpen(!window.matchMedia('(max-width:768px)').matches);
hamburgerBtn.dataset.sidebarToggleWired='1';
hamburgerBtn.addEventListener('click', capubToggleSidebar);

/* ===========================
   TOOLTIP HOVER
   =========================== */
const tooltipEl = by('tooltip');
document.addEventListener('mouseover', e => {
  const t=e.target;
  if(t && t.dataset && t.dataset.tooltipTitle){
    const title=t.dataset.tooltipTitle||'';
    const reg  =t.dataset.tooltipReg||'';
    const why  =t.dataset.tooltipWhy||'';

    tooltipEl.innerHTML = `
      <strong>${title}</strong>
      ${reg ? `<div>${reg}</div>`:''}
      ${why ? `<div><em>${why}</em></div>`:''}
    `;
    tooltipEl.style.display='block';
  }
});
document.addEventListener('mousemove', e => {
  if(tooltipEl.style.display==='block'){
    tooltipEl.style.left = (e.clientX+14)+'px';
    tooltipEl.style.top  = (e.clientY+14)+'px';
  }
});
document.addEventListener('mouseout', e => {
  const t=e.target;
  if(t && t.dataset && t.dataset.tooltipTitle){
    tooltipEl.style.display='none';
  }
});

/* ===========================
   SETUP FLOW
   =========================== */
function updateSetupGates(){
  const readyMembership = !!State.membership;
  const readyRank       = !!State.rank;
  const readyGender     = !!State.gender;

  rankSetupSelect.disabled = !readyMembership;
  syncCadetFirstSergeantControl();

  const enableUniformGender = readyMembership && readyRank;
  uniformBlock.classList.toggle('disabledBlock', !enableUniformGender);
  genderBlock.classList.toggle('disabledBlock', !enableUniformGender);

  if(readyMembership && readyRank && readyGender && State.uniform){
    fullRender();
    refreshUI();
  }
}
function populateRankSetup(){
  rankSetupSelect.innerHTML = `<option value="">Select Rank</option>`;
  if(!State.membership) return;
  RANKS[State.membership].forEach(r=>{
    const opt=document.createElement('option');
    opt.value=r;
    opt.textContent=r;
    rankSetupSelect.appendChild(opt);
  });
}

membershipTypeEl.addEventListener('change', ()=>{
  const previousRank = State.rank;
  const previousGender = State.gender;
  State.membership = membershipTypeEl.value || '';

  populateRankSetup();

  // Preserve selections and only clear rank if the new membership type does not offer that rank.
  if(previousRank && RANKS[State.membership]?.includes(previousRank)){
    State.rank = previousRank;
    rankSetupSelect.value = previousRank;
  }else{
    State.rank = null;
    rankSetupSelect.value = '';
  }

  if(!isCadetFirstSergeantEligible()) State.cadetFirstSergeant = false;
  syncCadetFirstSergeantControl();

  // Preserve gender/cut while switching member type.
  State.gender = previousGender || jacketSelect.value || '';
  jacketSelect.value = State.gender;

  // Do NOT clear ribbons, mini-medals, badges, patches, or device selections here.
  // The validation panel will warn about items that are not authorized for the active profile.

  // Rebuild the ribbon list and current rendered rack whenever membership changes.
  buildRibbonGallery();
  rebuildRibbonsFromGallery();

  if(State.membership && !isUniformAllowedFor(State.uniform, State.membership)){
    const fallback=findFirstAllowedUniform(State.membership) || 'blues_a';
    State.uniform=fallback;
  }

  updateSetupGates();
  applyMemberTypeToUniformOptions();
  highlightActiveUniformButton();

  fullRender();
  buildBadgeGallery();
});

rankSetupSelect.addEventListener('change', ()=>{
  State.rank = rankSetupSelect.value || null;
  if(!isCadetFirstSergeantEligible()) State.cadetFirstSergeant = false;
  syncCadetFirstSergeantControl();
  updateSetupGates();
  fullRender();
});

if(cadetFirstSergeantCheckbox){
  cadetFirstSergeantCheckbox.addEventListener('change', ()=>{
    State.cadetFirstSergeant = !!cadetFirstSergeantCheckbox.checked && isCadetFirstSergeantEligible();
    syncCadetFirstSergeantControl();
    fullRender();
  });
}

jacketSelect.addEventListener('change', ()=>{
  State.gender = jacketSelect.value || '';
  updateSetupGates();
  fullRender();
});

garmentOverlaySelect?.addEventListener('change', ()=>{
  State.garmentOverlayMode = ['both','left','right','off'].includes(garmentOverlaySelect.value)
    ? garmentOverlaySelect.value
    : 'both';
  fullRender();
});
garmentMaskSide?.addEventListener('change', syncGarmentMaskStatus);
editGarmentMaskBtn?.addEventListener('click', beginGarmentMaskEdit);
resetGarmentMaskBtn?.addEventListener('click', resetCurrentGarmentMask);
saveGarmentMaskBtn?.addEventListener('click', ()=>closeGarmentMaskEditor(true));
cancelGarmentMaskBtn?.addEventListener('click', ()=>closeGarmentMaskEditor(false));
undoGarmentMaskBtn?.addEventListener('click', ()=>{
  const previous=garmentMaskEditor.history.pop();
  if(!previous) return;
  garmentMaskEditor.points=previous.map(point=>({...point}));
  renderGarmentMaskEditor();
  if(undoGarmentMaskBtn) undoGarmentMaskBtn.disabled=!garmentMaskEditor.history.length;
});

/* ===========================
   MEMBER TYPE / UNIFORM AUTHZ
   =========================== */
function isUniformAllowedFor(uniformId, membership){
  const btn = uniformListEl.querySelector(`.uniformOption[data-uniform-id="${uniformId}"]`);
  if(!btn) return false;
  const allowed=(btn.dataset.allowedFor||'').split(',').map(s=>s.trim());
  return membership ? allowed.includes(membership) : true;
}
function findFirstAllowedUniform(membership){
  const opts=[...uniformListEl.querySelectorAll('.uniformOption')];
  for(const opt of opts){
    const allowed=(opt.dataset.allowedFor||'').split(',').map(s=>s.trim());
    if(allowed.includes(membership)){
      return opt.dataset.uniformId;
    }
  }
  return null;
}
function applyMemberTypeToUniformOptions(){
  const opts=uniformListEl.querySelectorAll('.uniformOption');
  opts.forEach(opt=>{
    const allowed=(opt.dataset.allowedFor||'').split(',').map(s=>s.trim());
    const isAllowed = State.membership ? allowed.includes(State.membership) : true;

    if(isAllowed){
      opt.classList.remove('locked');
      opt.removeAttribute('data-locked-reason');
    }else{
      opt.classList.add('locked');
      opt.setAttribute('data-locked-reason', 'This Uniform Is Not Authorized For This Membership Type');
    }
  });
}
function highlightActiveUniformButton(){
  const opts=uniformListEl.querySelectorAll('.uniformOption');
  opts.forEach(opt=>{
    if(opt.dataset.uniformId===State.uniform){
      opt.style.outline=`2px solid var(--brand)`;
      opt.style.boxShadow=`0 0 0 3px rgba(0,40,85,.15)`;
      opt.style.background=`rgba(0,40,85,.05)`;
    }else{
      opt.style.outline='';
      opt.style.boxShadow='';
      opt.style.background='';
    }
  });
}
