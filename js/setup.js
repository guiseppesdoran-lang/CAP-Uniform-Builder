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
  // The preview refits: on a phone the controls are a sheet over the lower part of the screen.
  document.dispatchEvent(new CustomEvent('capub:sidebar',{detail:{open}}));
}
function capubToggleSidebar(){
  capubSetSidebarOpen(!layoutShell.classList.contains('sidebar-open'));
}
capubSetSidebarOpen(!window.matchMedia('(max-width:768px)').matches);
hamburgerBtn.dataset.sidebarToggleWired='1';
hamburgerBtn.addEventListener('click', capubToggleSidebar);
const sheetCloseBtn = by('sheetClose');
if(sheetCloseBtn) sheetCloseBtn.addEventListener('click', ()=>capubSetSidebarOpen(false));

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
      <strong>${escapeHtml(title)}</strong>
      ${reg ? `<div>${escapeHtml(reg)}</div>`:''}
      ${why ? `<div><em>${escapeHtml(why)}</em></div>`:''}
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
function syncAdultCadetControl(){
  const row = by('adultCadetRow');
  const box = by('adultCadetCheckbox');
  if(row) row.classList.toggle('hidden', State.membership !== 'cadet');
  if(box) box.checked = !!State.adultCadet;
}
const adultCadetBox = by('adultCadetCheckbox');
if(adultCadetBox){
  adultCadetBox.addEventListener('change', ()=>{
    State.adultCadet = adultCadetBox.checked;
    // Turning it off while on a Corporate uniform moves the member to one they may wear.
    if(State.membership && !isUniformAllowedFor(State.uniform, State.membership)){
      State.uniform = findFirstAllowedUniform(State.membership) || 'blues_a';
    }
    updateSetupGates();
    applyMemberTypeToUniformOptions();
    highlightActiveUniformButton();
    fullRender();
    buildBadgeGallery();
  });
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
  // The adult-cadet option only exists for cadets (CAPR 39-1, 1.2.5.2).
  if(State.membership !== 'cadet') State.adultCadet = false;
  syncAdultCadetControl();

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
// Who may wear a uniform is decided by data/uniform-rules.js (CAPR 39-1). A cadet aged 18 or
// older who does not meet the USAF weight standard also reaches the Corporate-style uniforms
// (1.2.5.2); State.adultCadet records that.
function isUniformAllowedFor(uniformId, membership){
  const btn = uniformListEl.querySelector(`.uniformOption[data-uniform-id="${uniformId}"]`);
  if(!btn) return false;
  return CAPUBUniformRules.isUniformAllowedFor(uniformId, membership, {adultCadet:!!State.adultCadet});
}
function findFirstAllowedUniform(membership){
  const opts=[...uniformListEl.querySelectorAll('.uniformOption')];
  for(const opt of opts){
    if(CAPUBUniformRules.isUniformAllowedFor(opt.dataset.uniformId, membership, {adultCadet:!!State.adultCadet})){
      return opt.dataset.uniformId;
    }
  }
  return null;
}
function applyMemberTypeToUniformOptions(){
  const opts=uniformListEl.querySelectorAll('.uniformOption');
  opts.forEach(opt=>{
    const isAllowed = State.membership
      ? CAPUBUniformRules.isUniformAllowedFor(opt.dataset.uniformId, State.membership, {adultCadet:!!State.adultCadet})
      : true;

    if(isAllowed){
      opt.classList.remove('locked');
      opt.removeAttribute('data-locked-reason');
    }else{
      opt.classList.add('locked');
      opt.setAttribute('data-locked-reason', 'This uniform is not authorized for this membership type.');
    }
  });
}
function highlightActiveUniformButton(){
  const opts=uniformListEl.querySelectorAll('.uniformOption');
  opts.forEach(opt=>{
    opt.classList.toggle('activeUniform', opt.dataset.uniformId===State.uniform);
  });
}
