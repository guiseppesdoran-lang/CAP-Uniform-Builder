// Extracted verbatim from index.html: sidebar toggle, tooltips, the setup flow
// and member type / uniform authorization.

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
// What the setup choices unlock, worked out from State alone: the rank list needs a membership
// type, and the uniform and cut blocks need membership and rank (they start as .disabledBlock,
// which also turns off pointer events). Anything that sets State without going through the
// change handlers (Resume, Load, Import, Undo) reaches this through refreshUI(), so the blocks
// can never stay locked over controls that already show their values.
function capubSyncSetupGates(){
  const enableUniformGender = !!State.membership && !!State.rank;
  rankSetupSelect.disabled = !State.membership;
  uniformBlock.classList.toggle('disabledBlock', !enableUniformGender);
  genderBlock.classList.toggle('disabledBlock', !enableUniformGender);
}
function updateSetupGates(){
  const readyMembership = !!State.membership;
  const readyRank       = !!State.rank;
  const readyGender     = !!State.gender;

  capubSyncSetupGates();
  syncCadetFirstSergeantControl();

  if(readyMembership && readyRank && readyGender && State.uniform){
    fullRender();
    refreshUI();
  }
}
/* Membership and cut are side-by-side buttons. The select behind each one is still the source
   of truth (and what saved setups, the importer and undo write to); the buttons only mirror it
   and set it. */
function capubSyncSegments(){
  document.querySelectorAll('.segmented[data-segments-for]').forEach(group=>{
    const source = by(group.dataset.segmentsFor);
    if(!source) return;
    group.querySelectorAll('button[data-value]').forEach(btn=>{
      const on = btn.dataset.value === source.value;
      btn.setAttribute('aria-checked', String(on));
      btn.classList.toggle('isOn', on);
    });
  });
}
document.querySelectorAll('.segmented[data-segments-for]').forEach(group=>{
  group.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-value]');
    const source = by(group.dataset.segmentsFor);
    if(!btn || !source || source.disabled || source.value === btn.dataset.value) return;
    source.value = btn.dataset.value;
    source.dispatchEvent(new Event('change', {bubbles:true}));
    capubSyncSegments();
  });
});
['change','click'].forEach(evt=>document.addEventListener(evt, ()=>setTimeout(capubSyncSegments,0), true));
document.addEventListener('capub:history', capubSyncSegments);
setTimeout(capubSyncSegments,0);

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
  // A cadet grade the new membership does not keep takes its ribbons with it (a ribbon checked by hand stays).
  capubApplyGradeRibbons();

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
  capubApplyGradeRibbons();
  updateSetupGates();
  fullRender();
});

/* ===========================
   GRADE IMPLIES RIBBONS (LIVE13 E66)
   =========================== */
// Ethan: "if someone selects a grade, it goes along with the ribbons required to get it. like for C/Lt Col, if selected,
// it selects all ach ribbons except spaatz and the encampment ribbon." Choosing a cadet grade adds the ribbons that grade
// requires (js/state.js capubGradeImpliedRibbons, CAPR 60-1), each as earned once, and takes off the ones an earlier grade
// added that the new grade does not imply. State.gradeRibbons records which the grade added; a ribbon the member checked
// or changed by hand is not in it and is never taken off. A senior grade implies none. Returns { added, removed }.
function capubGradeRibbonNames(ids){
  const names = ids.map(id => getRibbonDisplayName(id));
  if(names.length < 2) return names.join('');
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}
function capubApplyGradeRibbons({announce=true}={}){
  normalizeRibbonSelections();
  const rank = State.rank || null;
  const implied = State.membership === 'cadet'
    ? capubGradeImpliedRibbons(rank).filter(id => isRibbonEligibleForMembership(id, 'cadet'))
    : [];
  const wanted = new Set(implied);
  const record = State.gradeRibbons && Array.isArray(State.gradeRibbons.ids) ? State.gradeRibbons.ids : [];
  const kept = [], removed = [], added = [];
  for(const id of record){
    const sel = State.ribbonSelections[id];
    if(!sel?.checked) continue;
    if(wanted.has(id)){ kept.push(id); continue; }
    clearRibbonSelection(id);
    removed.push(id);
  }
  for(const id of implied){
    if(State.ribbonSelections[id]?.checked) continue; // on already: by hand, by the import, or by the grade before
    setRibbonSelectionFromDropdown(id, 'earned', {deferRender:true, byGrade:true});
    if(State.ribbonSelections[id]?.checked) added.push(id);
  }
  const ours = [...kept, ...added];
  State.gradeRibbons = ours.length ? {rank, ids:ours} : null;
  if(added.length || removed.length){
    buildRibbonGallery();
    rebuildRibbonsFromGallery();
  }
  if(announce){
    const lines = [];
    if(added.length) lines.push(`${rank}: added the ${capubGradeRibbonNames(added)}, earned on the way to this grade (CAPR 60-1).`);
    if(removed.length) lines.push(`Taken off, as the earlier grade had added ${removed.length === 1 ? 'it' : 'them'}: ${capubGradeRibbonNames(removed)}.`);
    // A senior member who expected the grade to fill the rack: it does not.
    if(State.membership === 'senior' && rank && (removed.length || !(State.ribbons || []).length)){
      lines.push('A senior member\'s grade adds no ribbons: promotion is not tied to one.');
    }
    // After the page's item-count toast (js/workspace-ui.js capubItemToasts speaks 200 ms after a change), so this one, which names
    // the ribbons, is the one left showing.
    if(lines.length) setTimeout(()=>capubNotify(lines.join(' '), added.length + removed.length > 4 ? 9000 : 6000), 450);
  }
  return {added, removed};
}
// A member report import sets the grade and the ribbons itself, and its selections win: the grade's record is
// dropped when an import starts, so a later grade change never takes off a ribbon the report gave.
document.addEventListener('DOMContentLoaded', ()=>{
  if(typeof applyCapMemberReportImport !== 'function' || applyCapMemberReportImport.capubGradeAware) return;
  const original = applyCapMemberReportImport;
  const wrapped = function(){
    State.gradeRibbons = null;
    return original.apply(this, arguments);
  };
  wrapped.capubGradeAware = true;
  window.applyCapMemberReportImport = wrapped;
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


/* ===========================
   MEMBER TYPE / UNIFORM AUTHZ
   =========================== */
// Who may wear a uniform is decided by data/uniform-rules.js (CAPR 39-1). A cadet aged 18 or
// older who does not meet the USAF weight standard also reaches the Corporate-style uniforms
// (1.2.5.2); State.adultCadet records that.
function isUniformAllowedFor(uniformId, membership){
  const btn = uniformListEl.querySelector(`.uniformOption[data-uniform-id="${uniformId}"]`);
  if(!btn) return false;
  return CAPUBUniformRules.isUniformAllowedFor(uniformId, membership, {adultCadet:!!State.adultCadet,rank:State.rank});
}
function findFirstAllowedUniform(membership){
  const opts=[...uniformListEl.querySelectorAll('.uniformOption')];
  for(const opt of opts){
    if(CAPUBUniformRules.isUniformAllowedFor(opt.dataset.uniformId, membership, {adultCadet:!!State.adultCadet,rank:State.rank})){
      return opt.dataset.uniformId;
    }
  }
  return null;
}
function applyMemberTypeToUniformOptions(){
  const opts=uniformListEl.querySelectorAll('.uniformOption');
  opts.forEach(opt=>{
    const isAllowed = State.membership
      ? CAPUBUniformRules.isUniformAllowedFor(opt.dataset.uniformId, State.membership, {adultCadet:!!State.adultCadet,rank:State.rank})
      : true;

    if(isAllowed){
      opt.classList.remove('locked');
      opt.removeAttribute('data-locked-reason');
    }else{
      opt.classList.add('locked');
      opt.setAttribute('data-locked-reason', CAPUBUniformRules.lockedReason(opt.dataset.uniformId, State.membership, {adultCadet:!!State.adultCadet,rank:State.rank}) || 'This uniform is not authorized for this membership type.');
    }
  });
}
function highlightActiveUniformButton(){
  const opts=uniformListEl.querySelectorAll('.uniformOption');
  opts.forEach(opt=>{
    opt.classList.toggle('activeUniform', opt.dataset.uniformId===State.uniform);
  });
}
