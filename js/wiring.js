// Extracted verbatim from index.html: uniform button click, event wiring, the calibrator UI
// and the modal gallery. Loaded between the halves of the inline script so execution order
// is unchanged.

/* ===========================
   UNIFORM BUTTON CLICK
   =========================== */
uniformListEl.addEventListener('click', e=>{
  const btn=e.target.closest('.uniformOption');
  if(!btn) return;
  if(btn.classList.contains('locked')) return;

  const newUniform=btn.dataset.uniformId;
  const prevU=State.uniform;
  const prevCard=State.ceremonial ? CAPUBUniformRules.CEREMONIAL.id : prevU;
  // The Honor Guard Uniform is the Service Dress or the Blue Service uniform with the honor guard items put on: State.uniform stays the uniform it rides on (the coat's Class A
  // unless the member is already on the shirt's Class B), so every rule and drawing of that uniform applies to it unchanged.
  State.ceremonial=newUniform===CAPUBUniformRules.CEREMONIAL.id;
  if(State.ceremonial){
    if(!['blues_a','blues_b'].includes(State.uniform)) State.uniform=CAPUBUniformRules.ceremonialBase('coat');
  }else State.uniform=newUniform;
  if(prevCard!==newUniform) window.CAPUB_TELEMETRY?.track('uniform_switch', { from: prevCard, to: newUniform });

  fullRender(prevU);
  refreshUI();
});

/* ===========================
   EVENT WIRING
   =========================== */
const cadetHighestOnlyToggle = by('cadetHighestOnly');
if(cadetHighestOnlyToggle){
  cadetHighestOnlyToggle.addEventListener('change', e=>{
    State.cadetHighestOnly = e.target.checked;
    rebuildRibbonsFromGallery();
  });
}

// Remove ribbons (LIVE13, in place of the quick strip): on the shirts where ribbons are optional (CAPR 39-1 4.1.11.1.1.2.2,
// 4.1.12.2.4.2; the aviator shirt 4.2.5.1.2.2, 4.2.6.2.6.2) the drawing leaves the rack off while the selections stay
// (js/uniform-view.js buildRibbons). Saved with the setup; js/workspace-ui.js shows the box only where it applies.
const removeRibbonsToggle = by('removeRibbons');
if(removeRibbonsToggle){
  removeRibbonsToggle.addEventListener('change', e=>{
    State.hideRibbons = !!e.target.checked;
    fullRender();
    window.CAPUB_TELEMETRY?.track('remove_ribbons', { on: State.hideRibbons, uniform: State.uniform });
  });
}

const miniMountStyleSelect = by('miniMountStyle');
if(miniMountStyleSelect){
  miniMountStyleSelect.value = State.miniMountStyle;
  miniMountStyleSelect.addEventListener('change', e=>{
    State.miniMountStyle = e.target.value === 'holding' ? 'holding' : 'mounting';
    renderRack();
  });
}

/* Ribbon gallery buttons */
by('clearRibbons').addEventListener('click', ()=>{
  State.ribbons=[];
  State.ribbonSelections={};
  State.gradeRibbons=null;
  buildRibbonGallery();
  renderRack();
  renderAllBadges();
});

/* Badge gallery buttons */
by('clearBadges').addEventListener('click', ()=>{
  State.badges=[];
  State.badgeSelections={};
  buildBadgeGallery();
  renderAllBadges();
});

// The Badges panel's one line for the selected badges the uniform does not wear (LIVE13 E67): they stay selected, are not offered or
// drawn here, and the line says how many and by which paragraph (js/badge-rules.js capubBadgesNotWornLine).
function capubSyncBadgesNotWornNote(){
  const group = by('groupBadges');
  if(!group) return;
  let el = by('badgesNotWornNote');
  if(!el){
    el = document.createElement('div');
    el.id = 'badgesNotWornNote';
    el.className = 'hintText';
    el.setAttribute('role', 'note');
    const anchor = by('badgesPlannedNote');
    if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
    else group.appendChild(el);
  }
  const line = [capubBadgesNotWornLine(), typeof capubBadgesNotShownLine === 'function' ? capubBadgesNotShownLine() : ''].filter(Boolean).join(' ');
  el.textContent = line;
  el.classList.toggle('hidden', !line);
}

/* Patch gallery buttons */
by('clearPatches').addEventListener('click', ()=>{
  State.patches=[];
  State.patchSelections={};
  // The unit is the member's, chosen in the Profile step: clearing the patches leaves it.
  buildPatchGallery();
  renderPatches();
});


function syncRibbonRackColumnsControl(){
  const select = by('ribbonRackColumns');
  const hint = by('ribbonRackColumnsHint');
  const arrangementSelect = by('ribbonRackArrangement');
  const arrangementHint = by('ribbonRackArrangementHint');
  if(!select) return;

  // Four across is allowed only where 11.2.7 allows it (the Class A coat and the cadet semi-formal coat).
  const classA = CAPUBUniformRules.allowsRackColumns(State.uniform, 4);
  const preferredLayout = ['3','4-left','4-center'].includes(String(State.ribbonRackLayout))
    ? String(State.ribbonRackLayout)
    : '3';
  select.disabled = !classA;
  select.value = classA ? preferredLayout : '3';
  // The rack layout controls are the Class A coat's (and the cadet semi-formal coat's): they are not shown on a uniform that takes rows of three only.
  const rackFold = by('rackLayoutMore');
  if(rackFold) rackFold.classList.toggle('hidden', !classA);

  if(hint){
    hint.textContent = classA && preferredLayout === '4-center'
      ? 'Display option: the left-aligned four-across rack is shifted as one unit until its rows of four are centered over the pocket. This arrangement is not in accordance with the regulation.'
      : classA
        ? 'Choose three across, or align a four-across rack with the wearer-left/outboard pocket edge. Rows have no spacing.'
        : 'Rows of three are required on Class B and aviator shirts. Four-across is available only on Class A (CAPR 39-1, 11.2.7).';
  }

  if(arrangementSelect){
    const preferredArrangement = State.ribbonRackArrangement === 'standard' ? 'standard' : 'lapel';
    arrangementSelect.disabled = !classA;
    arrangementSelect.value = classA ? preferredArrangement : 'standard';
  }
  if(arrangementHint){
    arrangementHint.textContent = classA
      ? 'Automatic mode uses rows of three. Where the lapel would cover more than half of a ribbon, the upper rows hold fewer ribbons, aligned with the wearer\'s left edge (CAPR 39-1, 11.1.8).'
      : 'Lapel-avoidance ribbon arrangements apply only to the Class A service coat.';
  }
  syncRibbonRowOverrideControl();
}

// The rows the engine drew last, top row first: the starting point for a custom row grid.
function getAutomaticRibbonRowCounts(){
  return CAPUBUniformView.rackRowCounts();
}

function syncRibbonRowOverrideControl(){
  const checkbox=by('ribbonRowOverrideEnabled');
  const controls=by('ribbonRowOverrideControls');
  const grid=by('ribbonRowOverrideGrid');
  const status=by('ribbonRowOverrideStatus');
  if(!checkbox || !controls || !grid || !status) return;

  const classA=State.uniform==='blues_a';
  checkbox.disabled=!classA;
  checkbox.checked=classA && !!State.ribbonRowOverrideEnabled;
  controls.classList.toggle('hidden',!checkbox.checked);
  if(!checkbox.checked){ grid.innerHTML=''; return; }

  const columns=4; // rows of four are authorized on the Class A coat (11.2.7)
  const selectedCount=(State.ribbons || []).length;
  let counts=Array.isArray(State.ribbonRowOverride)
    ? State.ribbonRowOverride.map(Number).filter(Number.isInteger)
    : [];
  if(!counts.length || counts.some(count=>count<1 || count>columns)){
    counts=getAutomaticRibbonRowCounts();
    State.ribbonRowOverride=[...counts];
  }

  grid.innerHTML='';
  counts.forEach((count,rowIndex)=>{
    const row=document.createElement('div');
    row.className='ribbonOverrideRow';
    const label=document.createElement('span');
    label.className='ribbonOverrideRowLabel';
    label.textContent=rowIndex===0 ? 'Top row' : `Row ${rowIndex+1}`;
    row.appendChild(label);

    for(let choice=1; choice<=4; choice++){
      const button=document.createElement('button');
      button.type='button';
      button.className='ribbonOverrideCount';
      button.textContent=String(choice);
      button.disabled=choice>columns;
      button.classList.toggle('active',choice===count);
      button.setAttribute('aria-label',`${label.textContent}: ${choice} ribbon${choice===1?'':'s'}`);
      button.addEventListener('click',()=>{
        State.ribbonRowOverride[rowIndex]=choice;
        renderRack();
        renderAllBadges();
      });
      row.appendChild(button);
    }
    grid.appendChild(row);
  });

  const total=counts.reduce((sum,count)=>sum+count,0);
  const valid=selectedCount>0 && total===selectedCount;
  status.dataset.valid=String(valid);
  status.textContent=!selectedCount
    ? 'Select ribbons before building a custom row grid.'
    : valid
      ? `${total} ribbons assigned. Custom override is active.`
      : `${total} assigned; ${selectedCount} selected. Adjust the row counts to activate the override.`;

  const addButton=by('addRibbonOverrideRow');
  const removeButton=by('removeRibbonOverrideRow');
  if(addButton) addButton.disabled=!selectedCount || counts.length>=selectedCount;
  if(removeButton) removeButton.disabled=!selectedCount || counts.length<=1;
}

const ribbonRackColumnsSelect = by('ribbonRackColumns');
if(ribbonRackColumnsSelect){
  ribbonRackColumnsSelect.addEventListener('change', e=>{
    State.ribbonRackLayout = ['3','4-left','4-center'].includes(e.target.value)
      ? e.target.value
      : '3';
    if(State.ribbonRackLayout === '4-center'){
      capubNotify('The four-across rack centered above the welt/pocket is a display option and is not in accordance with the regulation.', 9000);
    }
    syncRibbonRackColumnsControl();
    renderRack();
    renderAllBadges();
  });
}

const ribbonRackArrangementSelect = by('ribbonRackArrangement');
if(ribbonRackArrangementSelect){
  ribbonRackArrangementSelect.addEventListener('change', e=>{
    State.ribbonRackArrangement = e.target.value === 'standard' ? 'standard' : 'lapel';
    syncRibbonRackColumnsControl();
    renderRack();
    renderAllBadges();
  });
}

const ribbonRowOverrideEnabled=by('ribbonRowOverrideEnabled');
if(ribbonRowOverrideEnabled){
  ribbonRowOverrideEnabled.addEventListener('change',e=>{
    State.ribbonRowOverrideEnabled=State.uniform==='blues_a' && !!e.target.checked;
    if(State.ribbonRowOverrideEnabled){
      State.ribbonRowOverride=getAutomaticRibbonRowCounts();
    }
    syncRibbonRowOverrideControl();
    renderRack();
    renderAllBadges();
  });
}

const addRibbonOverrideRow=by('addRibbonOverrideRow');
if(addRibbonOverrideRow){
  addRibbonOverrideRow.addEventListener('click',()=>{
    State.ribbonRowOverride=[1,...normalizeRibbonRowOverride(State.ribbonRowOverride,4)];
    renderRack();
    renderAllBadges();
  });
}

const removeRibbonOverrideRow=by('removeRibbonOverrideRow');
if(removeRibbonOverrideRow){
  removeRibbonOverrideRow.addEventListener('click',()=>{
    const counts=normalizeRibbonRowOverride(State.ribbonRowOverride,4);
    if(counts.length>1) counts.shift();
    State.ribbonRowOverride=counts;
    renderRack();
    renderAllBadges();
  });
}

/* ===========================
   MODAL GALLERY (Ribbons/Badges/Patches)
   =========================== */
const modalOverlay = by('galleryModalOverlay');
const modalEl      = by('galleryModal');
const modalTitle   = by('galleryModalTitle');
const modalHost    = by('galleryModalHost');
const modalClose   = by('galleryModalCloseBtn');


// What the footer of the picker says is selected right now.
let capubModalKind = null;
function capubModalCountText(kind){
  if(kind === 'ribbons'){
    const count = new Set((State.ribbons || []).map(r => r.id)).size;
    return `${count} ribbon${count === 1 ? '' : 's'} selected`;
  }
  if(kind === 'badges'){
    // The CAP badges and the U.S. military badges selected (the military ones are drawn among the badges over the left pocket).
    const counted = (typeof countBadgesForLimit === 'function' ? countBadgesForLimit() : (State.badges || []).length) + (typeof countMilitaryBadgesSelected === 'function' ? countMilitaryBadgesSelected() : 0);
    const rule = CAPUBUniformRules.getUniformRule(State.uniform) || {};
    const cap = rule.badgeCap;
    if(cap && counted > cap) return `${counted} of ${cap} badges selected. This uniform wears ${cap} (CAPR 39-1, ${(rule.refs || {}).badges}); choose which to show under Badges.`;
    return cap ? `${counted} of ${cap} badges selected` : `${counted} badge${counted === 1 ? '' : 's'} selected`;
  }
  if(kind === 'patches'){
    const count = (State.patches || []).length;
    return `${count} patch${count === 1 ? '' : 'es'} selected`;
  }
  return '';
}
function capubRefreshModalCount(){
  const out = by('galleryModalCount');
  if(out) out.textContent = capubModalCountText(capubModalKind);
}
function openGalleryModal(kind){
  capubModalKind = kind;
  window.CAPUB_MODAL_PICKERS = [];   // the picture pickers of the window (a builder that has some lists them: the search reads them)
  modalHost.innerHTML = '';

  const host = document.createElement('div');

  const grid = document.createElement('div');
  grid.className = 'galleryGrid';
  host.appendChild(grid);

  modalHost.appendChild(host);

  function syncFromSidebar(){
    if(kind==='ribbons'){
      // The ribbons as picture tiles of the picture picker (js/pick-lists.js ribbonLists): the CAP ribbons in the order of precedence under their headings, the JROTC / ROTC menu
      // and the U.S. military ones by branch. All of them, in one list.
      State.ribbonGalleryExpanded = true;
      modalTitle.textContent = "Ribbons / miniature medals";
      grid.innerHTML = '';
      grid.className = '';
      window.CAPUB_MODAL_PICKERS = CAPUBPickLists.ribbonLists(grid);
    }

    if(kind==='badges'){
      State.badgeGalleryExpanded = true;
      modalTitle.textContent = "Badges";
      buildGroupedBadgeModal(grid);
      return;
    }

    if(kind==='patches'){
      // The patches the uniform takes, as picture tiles of the picture picker (js/pick-lists.js patchList): all of them, in one list.
      State.patchGalleryExpanded = true;
      modalTitle.textContent = "Patches";
      grid.innerHTML = '';
      grid.className = '';
      window.CAPUB_MODAL_PICKERS = [CAPUBPickLists.patchList(grid)];
    }
  }

  function buildGroupedBadgeModal(rootGrid){
    rootGrid.innerHTML = '';
    normalizeBadgeSelections();

    // Only the badges the selected uniform wears (js/badge-rules.js isBadgeWornOnCurrentUniform, LIVE13 E67).
    const eligibleSet = new Set(
      getEligibleBadgeIdsForMembership(State.membership).filter(id => isBadgeWornOnCurrentUniform(id))
    );

    // Clear host and rebuild with headings + subgrids (nice grouping)
    modalHost.innerHTML = '';
    modalHost.appendChild(host);
    const notWornLine = capubBadgesNotWornLine();
    if(notWornLine){
      const note = document.createElement('div');
      note.className = 'sub badgesNotWornNote';
      note.setAttribute('role', 'note');
      note.style.margin = '4px 0 8px';
      note.textContent = notWornLine + ' They stay selected for the uniforms that wear them.';
      modalHost.appendChild(note);
    }

    // The badges are picture tiles of the picture picker (js/pick-lists.js, js/visual-picker.js toggle mode): each badge's own drawing with its name and the place it is worn
    // under it; a tap turns the badge on or off and the tile shows it. `window.CAPUB_MODAL_PICKERS` lists the pickers of the open window (the search reads it) and
    // `capubSyncBadgeTiles` puts every tile as the state says.
    const pickers = [];
    window.CAPUB_MODAL_PICKERS = pickers;
    window.capubSyncBadgeTiles = () => pickers.forEach(entry => entry.refresh());
    const appendCategorizedBadges = (container, allowedIds) => {
      const allowedSet = new Set(allowedIds);
      // A command pin is not offered above the grade that wears one (CAPR 39-1, 10.2.5): the row of the Items step says so.
      const groups = getBadgeCategoriesForCurrentMembership()
        .map(cat => ({ key: cat.key, ids: cat.ids.filter(id => eligibleSet.has(id) && allowedSet.has(id) && (!isCommandInsigniaBadge(id) || isCommandInsigniaGradeEligible(State.rank))) }))
        .filter(g => g.ids.length);
      if(groups.length) pickers.push(CAPUBPickLists.badgeList(container, groups));
    };

    const eligibleIds = [...eligibleSet];
    const importedAuthorized = Array.isArray(State.reportAuthorizedBadgeIds)
      ? State.reportAuthorizedBadgeIds.filter(id => eligibleSet.has(id))
      : null;

    if(importedAuthorized){
      const authorizedSet = new Set(importedAuthorized);
      const sections = [
        {
          label:`Authorized by member report (${importedAuthorized.length})`,
          open:true,
          ids:importedAuthorized,
          empty:'No authorized badges were detected in the imported report.'
        },
        {
          label:'Other possible badges',
          open:false,
          ids:eligibleIds.filter(id => !authorizedSet.has(id)),
          empty:'No other eligible badges are available.'
        }
      ];

      sections.forEach(section => {
        const details = document.createElement('details');
        details.open = section.open;
        details.style.cssText = 'margin:8px 0 12px;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--panel);';
        const summary = document.createElement('summary');
        summary.style.cssText = 'cursor:pointer;font-weight:850;color:var(--ink);padding:4px 0;';
        summary.textContent = section.label;
        details.appendChild(summary);
        if(section.ids.length){
          appendCategorizedBadges(details, section.ids);
        }else{
          const empty = document.createElement('div');
          empty.className = 'sub';
          empty.style.margin = '10px 0 4px';
          empty.textContent = section.empty;
          details.appendChild(empty);
        }
        modalHost.appendChild(details);
      });
    }else{
      appendCategorizedBadges(modalHost, eligibleIds);
    }

    // U.S. military badges are offered on the uniforms that wear U.S. military awards and that the builder draws them on (data/uniform-rules.js usafAwards, drawsMilitaryBadges); on the
    // ABU, OCP, flight suit and Corporate Semi-Formal they are not offered at all, and a choice made on another uniform is kept (the Check says so).
    const militaryBadges=isMilitaryAwardWornOnUniform() && CAPUBUniformRules.drawsMilitaryBadges(State.uniform) ? getAllSelectableMilitaryBadges() : [];
    if(militaryBadges.length){
      const militaryRoot=document.createElement('details');
      militaryRoot.dataset.militaryBadgeCatalog='true';
      militaryRoot.style.cssText='margin:14px 0 12px;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--panel);';
      const militarySummary=document.createElement('summary');
      militarySummary.style.cssText='cursor:pointer;font-weight:850;color:var(--ink);padding:4px 0;';
      militarySummary.textContent=`U.S. military badges (${militaryBadges.length})`;
      militaryRoot.appendChild(militarySummary);

      for(const branch of MILITARY_BRANCH_ORDER){
        const records=militaryBadges.filter(badge=>{
          const services=(badge.authorizedServices || []).filter(service=>MILITARY_BRANCH_ORDER.includes(service));
          return (services.length===1 ? services[0] : 'JOINT')===branch;
        });
        if(!records.length) continue;
        const details=document.createElement('details');
        details.className='militaryBadgeBranchMenu';
        const summary=document.createElement('summary');
        summary.textContent=`${MILITARY_BRANCH_LABELS[branch]} (${records.length})`;
        details.appendChild(summary);
        pickers.push(CAPUBPickLists.militaryBadgeList(details, branch, records));
        militaryRoot.appendChild(details);
      }
      modalHost.appendChild(militaryRoot);
    }
  }

  syncFromSidebar();

  // openGalleryModal is called twice (a later patch re-wraps it); only the first call knows the opener.
  const freshOpen = !modalOverlay.classList.contains('open');
  if(freshOpen) modalOpener = document.activeElement;
  modalOverlay.classList.add('open');
  modalOverlay.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  // A chooser opens at its top, not where the one before it was left (the body scrolls, and keeps its position between choosers).
  if(freshOpen){
    if(modalHost.parentElement) modalHost.parentElement.scrollTop = 0;
    if(typeof getMilitaryUIState === 'function') getMilitaryUIState().modalScrollTop = 0;
  }
  modalClose.focus();
}

let modalOpener = null;
function closeGalleryModal(){
  modalOverlay.classList.remove('open');
  modalOverlay.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  if(modalOpener && typeof modalOpener.focus === 'function' && document.contains(modalOpener)) modalOpener.focus();
  modalOpener = null;

  buildRibbonGallery();
  buildBadgeGallery();
  buildPatchGallery();
}

modalClose.addEventListener('click', closeGalleryModal);
const modalDone = by('galleryModalDoneBtn');
if(modalDone) modalDone.addEventListener('click', closeGalleryModal);
// Picks re-render a moment after the click, so read the counts a beat later.
['change','click'].forEach(evt => modalHost.addEventListener(evt, () => setTimeout(capubRefreshModalCount, 150)));
modalOverlay.addEventListener('click', (e)=>{
  if(e.target === modalOverlay) closeGalleryModal();
});
document.addEventListener('keydown', (e)=>{
  if(!modalOverlay.classList.contains('open')) return;
  if(e.key === 'Escape'){ closeGalleryModal(); return; }
  if(e.key !== 'Tab') return;
  // Keep Tab inside the dialog while it is open.
  const focusable = [...modalEl.querySelectorAll('button,select,input,a[href],summary,[tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && el.offsetParent !== null);
  if(!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  else if(!modalEl.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
});

/* IMPORTANT: Picker buttons open the popup */
by('expandRibbons').addEventListener('click', ()=> openGalleryModal('ribbons'));
by('expandBadges').addEventListener('click',  ()=> openGalleryModal('badges'));
by('expandPatches').addEventListener('click', ()=> openGalleryModal('patches'));

const unitPatchSearchEl = by('unitPatchSearch');
const unitPatchSelectEl = by('unitPatchSelect');
if(unitPatchSearchEl){
  unitPatchSearchEl.addEventListener('input', () => {
    if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector(unitPatchSearchEl.value);
  });
}
if(unitPatchSelectEl){
  unitPatchSelectEl.addEventListener('change', () => {
    State.unitPatchCharter = unitPatchSelectEl.value || '';
    renderUnitPatchStatus();
    renderPatches();
    if(typeof window.capubV2FullRender === 'function') window.capubV2FullRender();
  });
}
if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector('');


/* ===========================
   CAPUB V2 FUNCTIONALITY PATCH
   - Adds validation, status, search, save/load and undo.
   =========================== */
(function capubV2Patch(){
  const V2_VERSION = '2026-05-08-v2';
  State.text = State.text || { lastName:'', show:true };

  const CAPUB_V2 = window.CAPUB_V2 = {
    version: V2_VERSION,
    storageKey: 'cap_uniform_builder_profile_v2',
    missingAssetBaseline: [],
    notices: []
  };

  function pretty(id){ return String(id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
  // fix names the control that resolves the notice: {id, label}. A button is pressed; anything
  // else is scrolled to and focused. Notices without one just explain.
  function addNotice(type,msg,fix){ CAPUB_V2.notices.push({type,msg,fix:fix || null}); }
  function runNoticeFix(fix){
    const target = fix && by(fix.id);
    if(!target) return;
    // The control may sit in a step other than the one on screen (js/workspace-ui.js).
    if(window.CAPUB_V3 && typeof CAPUB_V3.showStepFor === 'function') CAPUB_V3.showStepFor(target);
    if(target.tagName === 'BUTTON'){ target.click(); return; }
    setTimeout(()=>{
      target.scrollIntoView({behavior:'smooth', block:'center'});
      target.focus({preventScroll:true});
    }, 60);
  }
  function downloadText(filename,text){
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function collectProfile(){
    return {
      version: V2_VERSION,
      membership: State.membership,
      gender: State.gender,
      uniform: State.uniform,
      ceremonial: !!State.ceremonial,
      rank: State.rank,
      cadetFirstSergeant: State.cadetFirstSergeant,
      shoulderCord: State.shoulderCord || '',
      shoulderCordColour: State.shoulderCordColour || '',
      unitPatchCharter: State.unitPatchCharter || '',
      // What the member's report showed, which the setup carries so that Resume and a reload bring it back with the unit: the cords of a supplement it
      // shows earned (js/supplements-import.js) and the badges it authorized (the badge list's own group).
      supplementCordsEarned: Array.isArray(State.supplementCordsEarned) ? State.supplementCordsEarned : [],
      reportAuthorizedBadgeIds: Array.isArray(State.reportAuthorizedBadgeIds) ? State.reportAuthorizedBadgeIds : null,
      assetBase: State.assetBase,
      ribbons: State.ribbons,
      badges: State.badges,
      patches: State.patches,
      ribbonSelections: State.ribbonSelections,
      badgeSelections: State.badgeSelections,
      badgeChoices: State.badgeChoices || {},
      badgeOrder: window.CAPUBBadgeCatalog.pruneEqual(State.badgeOrder, State.badges),
      militaryBadges: State.militaryBadges || {},
      patchSelections: State.patchSelections,
      cadetHighestOnly: State.cadetHighestOnly,
      adultCadet: State.adultCadet,
      miniMountStyle: State.miniMountStyle,
      ribbonRackLayout: State.ribbonRackLayout,
      ribbonRackArrangement: State.ribbonRackArrangement,
      ribbonRowOverrideEnabled: State.ribbonRowOverrideEnabled,
      ribbonRowOverride: State.ribbonRowOverride,
      text: State.text,
      garment: State.garment || {},
      commandInsignia: State.commandInsignia,
      // The ribbons the cadet grade added (js/setup.js capubApplyGradeRibbons), so a later grade change takes off only those.
      gradeRibbons: State.gradeRibbons || null,
      // Remove ribbons (LIVE13): the shirt is drawn without its rack while the selections stay.
      hideRibbons: !!State.hideRibbons
    };
  }

  /*
    A saved or imported setup is untrusted input: it can come from a file someone else
    sent. sanitizeProfile() keeps only values the builder itself could have produced
    (known uniforms, ranks, ribbon/badge/patch ids, device ids and bounded counts) and
    drops everything else, so nothing outside those lists ever reaches State or the page.
  */
  // The positions where the engine may ask which badge to show (scene.conflicts, js/engine/profiles-dress.js, profiles.js).
  const BADGE_POSITIONS = ['aviation', 'over-pocket', 'service', 'pocket', 'polo', 'tag'];
  // A position with several places keeps { slotKey: badgeId }, the slot keys the engine names ("left-pocket", "over-nametag", "left"...); a position
  // with one place, and a setup saved before the places, keep one badge id, which the engine reads as the first place.
  const SLOT_KEY = /^[a-z][a-z0-9-]{0,29}$/;
  const SAFE_TOKEN = /^[A-Za-z0-9_.:#-]{0,80}$/;
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function safeToken(value){ return typeof value === 'string' && SAFE_TOKEN.test(value) ? value : ''; }
  function sanitizeProfile(p){
    const out = {};
    out.membership = ['senior','cadet'].includes(p.membership) ? p.membership : '';
    out.gender = ['male','female'].includes(p.gender) ? p.gender : '';
    out.uniform = typeof p.uniform === 'string' && has(UNIFORMS, p.uniform) ? p.uniform : 'blues_a';
    // The Honor Guard Uniform is Class A or Class B with the honor guard items, for cadets: a setup that names it for a senior member, or on any other uniform, loads without it.
    out.ceremonial = p.ceremonial === true && ['blues_a','blues_b'].includes(out.uniform) && CAPUBUniformRules.CEREMONIAL.membership.includes(out.membership);
    out.rank = out.membership && RANKS[out.membership].includes(p.rank) ? p.rank : null;
    out.cadetFirstSergeant = !!p.cadetFirstSergeant;
    // A cord the page offers: one of the seven by its key, or a supplement cord by its id (js/engine/cords.js); the colour only for a cord whose colour the unit commander picks.
    out.shoulderCord = CAPUBEngine.cords.isKnown(p.shoulderCord) ? p.shoulderCord : null;
    out.shoulderCordColour = out.shoulderCord && CAPUBEngine.cords.needsColour(out.shoulderCord) && CAPUBEngine.cords.isChosenColour(p.shoulderCordColour) ? p.shoulderCordColour : null;
    out.unitPatchCharter = typeof p.unitPatchCharter === 'string' && /^[A-Za-z0-9-]{0,24}$/.test(p.unitPatchCharter) ? p.unitPatchCharter : '';
    // Cords by id as the cord list knows them, badges as the badge list does: nothing else is kept.
    out.supplementCordsEarned = [...new Set(Array.isArray(p.supplementCordsEarned) ? p.supplementCordsEarned : [])].filter(id => typeof id === 'string' && CAPUBEngine.cords.isKnown(id)).slice(0, 40);
    out.reportAuthorizedBadgeIds = Array.isArray(p.reportAuthorizedBadgeIds) ? [...new Set(p.reportAuthorizedBadgeIds)].filter(id => typeof id === 'string' && badgeList.includes(id)) : null;

    const ribbons = p.ribbonSelections && typeof p.ribbonSelections === 'object' ? p.ribbonSelections : {};
    out.ribbonSelections = {};
    for(const id of [...ribbonList, ...getMilitaryRibbonIds()]){
      const sel = ribbons[id];
      if(!sel || typeof sel !== 'object') continue;
      const devices = {};
      if(sel.devices && typeof sel.devices === 'object'){
        for(const [deviceId, count] of Object.entries(sel.devices)){
          const n = Math.trunc(Number(count));
          if(has(deviceMeta, deviceId) && Number.isFinite(n) && n > 0 && n <= 99) devices[deviceId] = n;
        }
      }
      // awardLabel is left out on purpose: normalizeRibbonSelections() recomputes it from the catalog instead of trusting the file.
      out.ribbonSelections[id] = {
        checked: !!sel.checked,
        devices,
        awardValue: safeToken(sel.awardValue),
        honorCredit: !!sel.honorCredit
      };
      if(isMilitaryRibbonId(id)){
        // getMilitarySelectionService() still checks the service against the award's own list.
        out.ribbonSelections[id].militaryService = safeToken(sel.militaryService);
        out.ribbonSelections[id].specialAuthorizations = (Array.isArray(sel.specialAuthorizations) ? sel.specialAuthorizations : [])
          .filter(deviceId => typeof deviceId === 'string' && has(deviceMeta, deviceId)).slice(0, 12);
        const numeral = Math.trunc(Number(sel.manualNumeral));
        out.ribbonSelections[id].manualNumeral = Number.isFinite(numeral) ? Math.min(99, Math.max(0, numeral)) : 0;
      }
    }

    const pick = (list, selections) => {
      const source = selections && typeof selections === 'object' ? selections : {};
      const kept = {};
      for(const id of list){
        if(!source[id] || typeof source[id] !== 'object') continue;
        kept[id] = { checked: !!source[id].checked };
        const levels = window.CAPUBBadgeCatalog?.levels(id);
        if(levels && levels.some(l => l[0] === source[id].level)) kept[id].level = source[id].level;
        // The bars of a Distinguished Expert (kept whatever the level now, so they are there when the member comes back to it); a setup saved without them has none.
        const barKeys = window.CAPUBBadgeCatalog?.barsOn(id, source[id].bars) || [];
        if(barKeys.length) kept[id].bars = barKeys;
      }
      return kept;
    };
    out.badges = (Array.isArray(p.badges) ? p.badges : []).filter(id => typeof id === 'string' && badgeList.includes(id));
    // An id no longer offered keeps its meaning (PATCH_ALIASES), so a setup saved before the change loads with the same patch.
    const aliased = id => (typeof id === 'string' && Object.prototype.hasOwnProperty.call(PATCH_ALIASES, id)) ? PATCH_ALIASES[id] : id;
    out.patches = [...new Set((Array.isArray(p.patches) ? p.patches : []).map(aliased))].filter(id => typeof id === 'string' && patchList.includes(id));
    out.badgeSelections = pick(badgeList, p.badgeSelections);
    // The member's choice of badge per uniform and position (the Badges panel): known uniforms, known positions, known badge ids.
    out.badgeChoices = {};
    const choicesIn = p.badgeChoices && typeof p.badgeChoices === 'object' && !Array.isArray(p.badgeChoices) ? p.badgeChoices : {};
    for(const u of Object.keys(choicesIn)){
      if(!has(UNIFORMS, u) || !choicesIn[u] || typeof choicesIn[u] !== 'object') continue;
      for(const position of BADGE_POSITIONS){
        const id = choicesIn[u][position];
        if(typeof id === 'string' && badgeList.includes(id)) (out.badgeChoices[u] = out.badgeChoices[u] || {})[position] = id;
        else if(id && typeof id === 'object' && !Array.isArray(id)){
          const slots = {};
          for(const key of Object.keys(id)) if(has(id, key) && SLOT_KEY.test(key) && typeof id[key] === 'string' && badgeList.includes(id[key])) slots[key] = id[key];
          if(Object.keys(slots).length) (out.badgeChoices[u] = out.badgeChoices[u] || {})[position] = slots;
        }
      }
    }
    // The order of badges of equal standing: the groups the catalog knows, badge ids of the group that this setup also holds, two or more.
    out.badgeOrder = window.CAPUBBadgeCatalog.pruneEqual(p.badgeOrder, out.badges);
    // U.S. military badges: known ids only, with a token-safe variant.
    out.militaryBadges = {};
    const milBadgeIds = new Set((window.CAPUBMilitaryData?.badges || []).map(b => b.id));
    const milIn = p.militaryBadges && typeof p.militaryBadges === 'object' ? p.militaryBadges : {};
    for(const id of Object.keys(milIn)){
      const sel = milIn[id];
      if(!milBadgeIds.has(id) || !sel || typeof sel !== 'object' || !sel.selected) continue;
      out.militaryBadges[id] = { selected: true, variant: safeToken(sel.variant) || undefined };
    }
    const patchSelectionsIn = {};
    for(const [id, sel] of Object.entries(p.patchSelections && typeof p.patchSelections === 'object' ? p.patchSelections : {})){
      const to = aliased(id);
      if(!(patchSelectionsIn[to] && patchSelectionsIn[to].checked)) patchSelectionsIn[to] = sel;
    }
    out.patchSelections = pick(patchList, patchSelectionsIn);

    out.cadetHighestOnly = !!p.cadetHighestOnly;
    out.adultCadet = out.membership === 'cadet' && !!p.adultCadet;
    out.miniMountStyle = p.miniMountStyle === 'holding' ? 'holding' : 'mounting';
    out.ribbonRackLayout = ['3','4-left','4-center'].includes(String(p.ribbonRackLayout))
      ? String(p.ribbonRackLayout)
      : (Number(p.ribbonRackColumns) === 4 ? '4-left' : '3');
    out.ribbonRackArrangement = p.ribbonRackArrangement === 'standard' ? 'standard' : 'lapel';
    out.ribbonRowOverrideEnabled = !!p.ribbonRowOverrideEnabled;
    out.ribbonRowOverride = Array.isArray(p.ribbonRowOverride)
      ? p.ribbonRowOverride.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 20).slice(0, 12)
      : [];
    const text = p.text && typeof p.text === 'object' ? p.text : {};
    out.garment = window.CAPUBGarmentOptions ? CAPUBGarmentOptions.sanitize(p.garment) : {};
    out.text = {
      firstName: String(text.firstName || '').slice(0, 40),
      lastName: String(text.lastName || '').slice(0, 40),
      plateLine: String(text.plateLine || '').slice(0, 40),
      show: text.show !== false
    };
    out.commandInsignia = { graduatedCommander: !!(p.commandInsignia && p.commandInsignia.graduatedCommander) };
    // The grade's record: a cadet grade and the ribbons some cadet grade implies (js/state.js CADET_GRADE_RIBBON_IDS), nothing else.
    out.gradeRibbons = null;
    const gr = p.gradeRibbons;
    if(gr && typeof gr === 'object' && !Array.isArray(gr) && out.membership === 'cadet' && RANKS.cadet.includes(gr.rank) && Array.isArray(gr.ids)){
      const ids = [...new Set(gr.ids.filter(id => typeof id === 'string' && CADET_GRADE_RIBBON_IDS.includes(id)))];
      if(ids.length) out.gradeRibbons = { rank: gr.rank, ids };
    }
    out.hideRibbons = !!p.hideRibbons;
    return out;
  }

  function applyProfile(raw){
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const p = sanitizeProfile(raw);
    State.membership = p.membership;
    State.gender = p.gender;
    State.uniform = p.uniform;
    State.ceremonial = p.ceremonial;
    State.rank = p.rank;
    State.cadetFirstSergeant = p.cadetFirstSergeant;
    if(!isCadetFirstSergeantEligible(State.rank)) State.cadetFirstSergeant = false;
    State.shoulderCord = p.shoulderCord;
    State.shoulderCordColour = p.shoulderCordColour;
    State.unitPatchCharter = p.unitPatchCharter;
    State.supplementCordsEarned = p.supplementCordsEarned;
    State.reportAuthorizedBadgeIds = p.reportAuthorizedBadgeIds;
    State.assetBase = 'images';
    State.ribbons = [];
    State.badges = p.badges;
    State.patches = p.patches;
    State.ribbonSelections = p.ribbonSelections;
    State.badgeSelections = p.badgeSelections;
    State.badgeChoices = p.badgeChoices || {};
    State.badgeOrder = p.badgeOrder || {};
    State.militaryBadges = p.militaryBadges || {};
    State.patchSelections = p.patchSelections;
    State.cadetHighestOnly = p.cadetHighestOnly;
    State.adultCadet = p.adultCadet;
    State.miniMountStyle = p.miniMountStyle;
    State.ribbonRackLayout = p.ribbonRackLayout;
    State.ribbonRackArrangement = p.ribbonRackArrangement;
    State.ribbonRowOverrideEnabled = p.ribbonRowOverrideEnabled;
    State.ribbonRowOverride = p.ribbonRowOverride;
    State.text = p.text;
    State.garment = p.garment;
    State.commandInsignia = p.commandInsignia;
    State.gradeRibbons = p.gradeRibbons;
    State.hideRibbons = !!p.hideRibbons;

    populateRankSetup();
    syncCadetFirstSergeantControl();
    if(typeof syncShoulderCordControl === 'function') syncShoulderCordControl();
    refreshUI();
    rebuildRibbonsFromGallery();
    syncTextControls();
    buildRibbonGallery(); buildBadgeGallery(); buildPatchGallery();
    // The unit's code goes in the search box, as it does after an import, so the list is narrowed to the unit and shows it (and its emblem) at once.
    const unitSearch = by('unitPatchSearch');
    if(unitSearch && State.unitPatchCharter) unitSearch.value = State.unitPatchCharter;
    if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector(unitSearch?.value || '');
    fullRender();
  }

  function syncTextControls(){
    const fn = by('capubV2FirstName');
    const ln = by('capubV2LastName');
    const pl = by('capubV2PlateLine');
    const sh = by('capubV2ShowText');
    if(fn) fn.value = State.text?.firstName || '';
    if(pl) pl.value = State.text?.plateLine || '';
    if(ln) ln.value = State.text?.lastName || '';
    if(sh) sh.checked = State.text?.show !== false;
  }

  function validateBuild(){
    CAPUB_V2.notices = [];
    if(!State.membership) addNotice('warn','Select membership type first.',{id:'membershipType',label:'Choose'});
    if(!State.rank) addNotice('warn','Select a grade before building the uniform.',{id:'rankSetupSelect',label:'Choose'});
    if(!State.gender) addNotice('warn','Select the male or female cut so the uniform can be drawn.',{id:'jacketSelect',label:'Choose'});
    if(State.membership && !isUniformAllowedFor(State.uniform, State.membership)) addNotice('err','Selected uniform is not authorized for the selected membership type.');
    if(State.unitPatchCharter && typeof getSelectedUnitPatchId === 'function' && !getSelectedUnitPatchId()) addNotice('warn',`The ${getUnitPatchSpokenName(State.unitPatchCharter)} patch picture is not available yet, so no unit patch is shown.`);
    if(State.unitPatchCharter && typeof getSelectedUnitPatchId === 'function' && getSelectedUnitPatchId() && !isUnitPatchAuthorizedForCurrentUniform()) addNotice('warn',`The ${getUnitPatchSpokenName(State.unitPatchCharter)} unit patch is not worn on this uniform, so it is not shown.`);
    // A wing patch a supplement of the member's unit requires on this uniform and the build does not have (a warning: the member may leave it off).
    if(window.Supplements && typeof Supplements.warnings === 'function') for(const w of Supplements.warnings(State)) addNotice('warn',w.msg,w.fix);
    if(State.membership === 'cadet'){
      const bad = State.badges.filter(id=>!isCadetAuthorized(id));
      if(bad.length) addNotice('err','Cadet profile includes non-cadet badge(s): '+bad.map(pretty).join(', '),{id:'expandBadges',label:'Review badges'});
    }
    if(State.membership === 'senior'){
      const bad = State.badges.filter(id=>!isSeniorAuthorized(id));
      if(bad.length) addNotice('err','Senior profile includes cadet-only badge(s): '+bad.map(pretty).join(', '),{id:'expandBadges',label:'Review badges'});
    }
    // Badge limits and award wear come from data/uniform-rules.js (CAPR 39-1).
    // Some uniforms count patches against the same limit as badges (ABU, Corporate Field).
    const patchTotal = (State.patches || []).length
      + ((typeof getSelectedUnitPatchId === 'function' && getSelectedUnitPatchId() && isUnitPatchAuthorizedForCurrentUniform()) ? 1 : 0)
      + ((typeof getUnitHhqPlan === 'function' && getUnitHhqPlan()?.worn) ? 1 : 0);
    // The limit is on badges worn: the ones the drawing puts on this uniform, command insignia excluded (js/badge-rules.js
    // countBadgesWornForLimit). A badge the uniform does not wear (LIVE13 E67), or one selected beyond its positions, is not drawn
    // and does not count (LIVE13 E77; Ethan: "the check thing says the uniform is wrong despite it being right when [you pick every one]
    // of your badges but you only have 4 on").
    const limit = CAPUBUniformRules.badgeLimit(State.uniform, {badges: countBadgesWornForLimit(), patches: patchTotal});
    if(limit.over){
      const what = limit.shared ? 'badges and patches together' : 'counted badges';
      addNotice('err',`This uniform allows ${limit.cap} ${what} and ${limit.counted} are selected. Command insignia does not count against this limit.`,{id:'expandBadges',label:'Review badges'});
    }
    // The badges the selected uniform does not wear (data/uniform-rules.js BADGE_WEAR: the blazers take only the chaplain badge and
    // the CSAG, Command Council, National Board or NEC badge, 4.2.3.1.1.1, 4.2.3.1.1.3; the polo one aviation, occupational or
    // specialty track badge, 5.3.2.1.1; the field uniforms the genuine field set, 5.1.1.1.2.4, 5.2.1.1.2.6, 7.1.1.3.1, B6). They are
    // not offered or drawn on it and stay selected for the others (LIVE13 E67).
    const notWornLine = capubBadgesNotWornLine();
    if(notWornLine){
      const names = getSelectedBadgesNotWornOnCurrentUniform().map(getBadgeDisplayName).join(', ');
      // Information, not a warning: the badges stay selected for the uniforms that wear them (LIVE13 E77).
      addNotice('ok',`${notWornLine} Not shown here: ${names}. They come back on a uniform that wears them.`,{id:'expandBadges',label:'Review badges'});
    }
    if(State.uniform === 'aviator_blazer' && capubBadgeWearOptions().underlayer === 'shirt'
      && (State.badges || []).some(id => !isBadgeAuthorizedOnCurrentDressUniform(id))){
      addNotice('ok','On the blazer itself only the chaplain badge and, in place of the CAP Crest, the Senior Advisory Group, Command Council, National Board or National Executive Committee badge are worn (CAPR 39-1, 4.2.3.1.1.1, 4.2.3.1.1.3); the other badges are shown on the aviator shirt drawn beside it.');
    }
    // Each award chosen that this uniform does not wear, named, with the paragraph that says so (the choice is kept for the uniforms that wear it).
    for(const id of Object.entries(State.ribbonSelections || {}).filter(([k,sel])=>sel && sel.checked && !isAwardWornOnUniform(k)).map(([k])=>k)){
      const name = typeof getRibbonDisplayName === 'function' ? getRibbonDisplayName(id) : pretty(id);
      const why = (id === 'Air_Force_Organizational_Excellence_Award')
        ? (State.uniform === 'mess_dress' ? 'is not worn on the Mess Dress (ICL 18-02, 4b)' : 'is not worn on the CAP Corporate uniforms (CAPR 39-1, 11.2.3)')
        : 'is not worn on this uniform (CAPR 39-1, 11.1.6)';
      addNotice('warn',`${name} ${why}, so it is not shown. It comes back on a uniform that wears it.`,{id:'expandRibbons',label:'Review ribbons'});
    }
    // Patches chosen that the drawing leaves off, each with its reason; badges likewise (the drawing's own words, js/uniform-view.js).
    for(const c of capubPatchPlan().hidden) addNotice('ok',c.line,{id:'expandPatches',label:'Review patches'});
    const milChosen = Object.keys(State.militaryBadges || {}).filter(id => State.militaryBadges[id] && State.militaryBadges[id].selected);
    if(milChosen.length && !CAPUBUniformRules.drawsMilitaryBadges(State.uniform)){
      addNotice('ok',`${milChosen.length} U.S. military badge${milChosen.length===1?' is':'s are'} chosen but not drawn on this uniform yet. ${milChosen.length===1?'It stays':'They stay'} chosen for the uniforms that show them.`,{id:'expandBadges',label:'Review badges'});
    }
    if(State.uniform === 'ocp'){
      // U.S. flag and AUX duty identifier are mandatory but are now baked into the OCP base image.
      // They are not selectable render layers and should not create validation warnings.
    }
    if(['blues_a','blues_b','aviator','aviator_blazer'].includes(State.uniform)){
      if(State.gender === 'female' && State.uniform === 'blues_a'){
        const femaleSpecialtyCount = getFemaleClassASpecialtyBadgeIds().length;
        if(femaleSpecialtyCount > 2) addNotice('err','Female Class A specialty-track badges above the nameplate are limited to two. Additional specialty badges are not shown in that row.');
        if(State.membership === 'cadet' && femaleClassASpecialtyRowIsFull() && State.badges.includes('model_rocketry_badge')){
          addNotice('ok','Female cadet Class A: with two specialty badges already above the nameplate, Model Rocketry is shown in the left-pocket place used on the male uniform.');
        }
      }
      const commandPin = getSelectedCommandInsigniaId();
      if(commandPin){
        addNotice('ok', State.commandInsignia?.graduatedCommander
          ? `${getBadgeDisplayName(commandPin)}: worn as a graduated commander, below the name tag. It is not counted among the four badges (CAPR 39-1, 10.2.5).`
          : `${getBadgeDisplayName(commandPin)}: worn as a current commander, above the name tag. It is not counted among the four badges (CAPR 39-1, 10.2.5).`);
      }
      const aviation = State.badges.filter(id => ['OLP','OLPA','OLPU'].some(s => String(badgeLocations[id]||'').includes(s)));
      if(aviation.length > 2) addNotice('warn','More than two aviation/occupational-style badges are selected for the wearer’s left side.',{id:'expandBadges',label:'Review badges'});
    }
    if(State.uniform === 'mess_dress' && State.membership === 'cadet') addNotice('err','Mess Dress is not available to cadets in this builder.');
    // The white parade gloves as the drawing shows them (9.6.7.7): on the hands, the top of the glove just above the wrist, on the coat and with long sleeves; folded under the belt, or under the flag
    // sling's waist band for a flag bearer, with short sleeves, where no sleeve covers the wrists.
    if(State.ceremonial && State.membership === 'cadet'){
      const gm = State.garment || {};
      const folded = State.uniform === 'blues_b' && gm.sleeve !== 'long';
      const place = gm.cerRole === 'flag' ? 'the flag sling\'s waist band, palm out, the tops over its upper edge' : 'the belt, palm out, the tops over the belt';
      addNotice('ok', folded
        ? `White parade gloves are shown folded under ${place}, because no sleeve covers the wrists here (CAPR 39-1, ${CAPUBUniformRules.CEREMONIAL.refs.gloves}).`
        : `White parade gloves are worn, the top of the glove just above the wrist (CAPR 39-1, ${CAPUBUniformRules.CEREMONIAL.refs.gloves}).`);
    }
    // What a woman wears with it, on the coat and on the blouse alike (9.6.7.3): only slacks.
    if(State.ceremonial && State.membership === 'cadet' && State.gender === 'female') addNotice('ok',`Female members wear only slacks with this uniform (CAPR 39-1, ${CAPUBUniformRules.CEREMONIAL.refs.slacks}).`);
    if(!CAPUB_V2.notices.length) addNotice('ok','No automatic validation issues found. Final approval still requires a review against the regulation and any applicable supplement.');
    return CAPUB_V2.notices;
  }

  function updateStatusPanel(){
    const notices = validateBuild();
    capubSyncBadgesNotWornNote();
    const rc = by('capubV2RibbonCount'), bc = by('capubV2BadgeCount'), pc = by('capubV2PatchCount'), wc = by('capubV2WarningCount');
    // The tiles count what the drawing puts on the uniform (js/badge-rules.js), as the Items cards and the top bar do.
    if(rc) rc.textContent = countRibbonsShown();
    if(bc) bc.textContent = countBadgesShown();
    if(pc) pc.textContent = countPatchesShown();
    if(wc) wc.textContent = notices.filter(n=>n.type !== 'ok').length;
    const ul = by('capubV2Notices');
    if(ul){
      ul.innerHTML = '';
      notices.forEach(n=>{
        const li=document.createElement('li'); li.className=n.type;
        const text=document.createElement('span'); text.textContent=n.msg; li.appendChild(text);
        if(n.fix){
          const fix=document.createElement('button');
          fix.type='button'; fix.className='ghost noticeFix'; fix.textContent=n.fix.label || 'Fix';
          fix.addEventListener('click',()=>runNoticeFix(n.fix));
          li.appendChild(fix);
        }
        ul.appendChild(li);
      });
    }
  }

  // The window's short status line, under the search: what a tap on a tile says (where the badge or patch is worn, or why it is left off, with its paragraph) when the tile itself shows
  // only the picture and the name. js/pick-lists.js calls it; an empty text clears it.
  window.capubModalSay = text => {
    const line = by('capubV2ModalSay');
    if(!line) return;
    const t = String(text || '');
    line.hidden = !t;
    if(line.dataset.said !== t){ line.dataset.said = t; line.textContent = t; }
  };

  function injectModalSearch(kind){
    const body = modalHost;
    if(!body) return;
    if(!State.modalGallerySearchValues) State.modalGallerySearchValues={};
    if(body.querySelector('.capubV2Search')){
      window.CAPUB_refreshModalGallerySearch?.(kind);
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'capubV2Search';
    wrap.innerHTML = `<input id="capubV2ModalSearch" placeholder="Search ${kind} by name or category"/><div class="sub"><span id="capubV2ModalCount"></span> visible.</div><div id="capubV2ModalEmpty" class="sub" role="status" hidden></div>`;
    body.insertBefore(wrap, body.firstChild);
    // The status line of the lists that say something when a tile is tapped (badges, patches) sits between the scrolling list and the footer, one line always kept for it: a line that
    // appears or goes inside the list pushed every tile under it down or up by its height whenever a badge was turned on or off.
    const scroller = body.parentNode;
    if(scroller && scroller.parentNode){
      const old = document.getElementById('capubV2ModalSay');
      if(old && old.parentNode) old.parentNode.removeChild(old);
      if(kind === 'badges' || kind === 'patches'){
        const say = document.createElement('div');
        say.id = 'capubV2ModalSay';
        say.className = 'capubModalSay';
        say.setAttribute('role', 'status');
        say.setAttribute('aria-live', 'polite');
        say.hidden = true;
        scroller.parentNode.insertBefore(say, scroller.nextSibling);
      }
    }
    const input = wrap.querySelector('input');
    const count = wrap.querySelector('#capubV2ModalCount');
    input.value=State.modalGallerySearchValues[kind] || '';
    function filter(){
      const q = input.value.trim().toLowerCase();
      State.modalGallerySearchValues[kind]=input.value;
      let visible = 0;
      // The chooser's picture tiles hide themselves, and a section with none left (js/visual-picker.js filter); a window still of the old cards filters those.
      const pickers = window.CAPUB_MODAL_PICKERS || [];
      pickers.forEach(entry => { visible += entry.picker.filter(q); });
      if(!pickers.length) body.querySelectorAll('.galleryTile').forEach(tile=>{
        const show = !q || tile.textContent.toLowerCase().includes(q);
        tile.classList.toggle('isFilteredOut', !show);
        if(show) visible++;
      });
      if(count) count.textContent = visible;
      // A category heading with every tile filtered out would sit there on its own.
      if(kind === 'badges' && !pickers.length){
        body.querySelectorAll('.galleryGrid').forEach(grid=>{
          const heading = grid.previousElementSibling;
          if(!heading || heading.tagName !== 'DIV' || heading.style.fontWeight !== '800') return;
          const any = [...grid.children].some(t=>!t.classList.contains('isFilteredOut'));
          heading.classList.toggle('isFilteredOut', !any);
        });
      }
      const empty = wrap.querySelector('#capubV2ModalEmpty');
      if(empty){
        empty.hidden = !(q && visible === 0);
        empty.textContent = q && visible === 0 ? `Nothing in ${kind} matches \u201c${input.value.trim()}\u201d.` : '';
      }
    }
    input.addEventListener('input', filter);
    window.CAPUB_refreshModalGallerySearch = requestedKind=>{
      if(requestedKind && requestedKind!==kind) return;
      filter();
    };
    filter();
    setTimeout(()=>input.focus(),50);
  }

  // Override render pipeline to include V2 layers and live validation after original rendering.
  const originalFullRender = fullRender;
  fullRender = function capubV2FullRender(prevUniform){
    const out = originalFullRender(prevUniform);
    updateStatusPanel();
    return out;
  };

  const originalOpenGalleryModal = openGalleryModal;
  openGalleryModal = function capubV2OpenGallery(kind){
    if(kind === 'ribbons') State.ribbonGalleryExpanded = true;
    if(kind === 'badges') State.badgeGalleryExpanded = true;
    if(kind === 'patches') State.patchGalleryExpanded = true;
    originalOpenGalleryModal(kind);
    injectModalSearch(kind);
    capubRefreshModalCount();
  };

  // Safer clear actions: keep UI selections in sync.
  const clearRibbonsBtn = by('clearRibbons');
  if(clearRibbonsBtn) clearRibbonsBtn.addEventListener('click', ()=>setTimeout(updateStatusPanel,0));
  const clearBadgesBtn = by('clearBadges');
  if(clearBadgesBtn) clearBadgesBtn.addEventListener('click', ()=>setTimeout(updateStatusPanel,0));
  const clearPatchesBtn = by('clearPatches');
  if(clearPatchesBtn) clearPatchesBtn.addEventListener('click', ()=>setTimeout(updateStatusPanel,0));

  /*
    Undo and redo. A snapshot is the same profile a saved setup uses, minus the calibration
    and mask data, so going back is applyProfile() on an earlier snapshot. A render that
    changes the snapshot records the one before it.
  */
  const HISTORY_LIMIT = 50;
  const undoStack = [];
  let redoStack = [];
  let lastSnap = null;
  let replaying = false;
  function snapshotNow(){
    const p = collectProfile();
    p.calib = undefined;
    p.garmentMasks = undefined;
    return JSON.stringify(p);
  }
  function captureHistory(){
    if(replaying) return;
    const now = snapshotNow();
    if(lastSnap === null){ lastSnap = now; return; }
    if(now === lastSnap) return;
    undoStack.push(lastSnap);
    if(undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    lastSnap = now;
    document.dispatchEvent(new CustomEvent('capub:history'));
  }
  function replay(from, to){
    if(!from.length) return;
    const target = from.pop();
    to.push(snapshotNow());
    replaying = true;
    try{ applyProfile(JSON.parse(target)); }
    finally{ replaying = false; }
    lastSnap = snapshotNow();
    document.dispatchEvent(new CustomEvent('capub:history'));
  }
  window.CAPUB_HISTORY = {
    undo(){ replay(undoStack, redoStack); },
    redo(){ replay(redoStack, undoStack); },
    canUndo(){ return undoStack.length > 0; },
    canRedo(){ return redoStack.length > 0; }
  };
  (function wrapFullRenderForHistory(){
    const previous = fullRender;
    fullRender = function capubHistoryFullRender(){
      const result = previous.apply(this, arguments);
      setTimeout(captureHistory, 0);
      return result;
    };
  })();
  // A pick in a chooser (a ribbon, a badge, a patch, a unit) redraws without a full render, so it was recorded only with the next full render and Undo took the
  // pick and whatever came after it in one step. Every change or click in the page now records what it changed once the handler has run; captureHistory records
  // nothing when the setup is the same as the last one, so a click that changes nothing adds no step.
  ['change','click'].forEach(evt => document.addEventListener(evt, () => setTimeout(captureHistory, 30), true));

  function wireV2Controls(){
    syncTextControls();
    const exp = by('capubV2ExportJson'), impBtn = by('capubV2ImportBtn'), impFile = by('capubV2ImportFile');
    const reset = by('capubV2Reset');
    const fn = by('capubV2FirstName'), ln = by('capubV2LastName'), pl = by('capubV2PlateLine'), sh = by('capubV2ShowText');
    if(exp) exp.onclick = ()=>(window.CAPUB_TELEMETRY?.track('setup_file', { action: 'save' }), downloadText(CAPUBExportNames.exportFileName({rank:State.rank,uniform:State.ceremonial ? 'honor_guard' : State.uniform},'json'), JSON.stringify(collectProfile(), null, 2)));
    if(impBtn && impFile) impBtn.onclick = ()=>impFile.click();
    if(impFile) impFile.onchange = async ()=>{ const f=impFile.files?.[0]; if(!f) return; applyProfile(JSON.parse(await f.text())); impFile.value=''; window.CAPUB_TELEMETRY?.track('setup_file', { action: 'open' }); };
    if(reset) reset.onclick = async ()=>{ if(!await capubConfirm({ title: 'Reset the builder?', message: 'This clears your uniform, ribbons, badges, patches and name from this browser and starts again. A setup you saved to a file is not affected.', confirmLabel: 'Reset', cancelLabel: 'Keep my setup' })) return; try{ localStorage.removeItem(CAPUB_V2.storageKey); localStorage.removeItem('cap_uniform_builder_autosave_v1'); }catch(_){} location.reload(); };
    const readText = ()=>{
      State.text.firstName = fn?.value || '';
      State.text.lastName = ln?.value || '';
      State.text.plateLine = pl?.value || '';
      State.text.show = sh?.checked !== false;
    };
    // Typing redraws the uniform only; leaving the field (change) runs the full update and saves.
    [fn,ln,pl,sh].forEach(el=>{
      if(!el) return;
      el.addEventListener('input', ()=>{ readText(); CAPUBUniformView.scheduleRender(); });
      el.addEventListener('change', ()=>{ readText(); fullRender(); });
    });
  }

  // Make functions available for console debugging.
  CAPUB_V2.collectProfile = collectProfile;
  CAPUB_V2.applyProfile = applyProfile;
  CAPUB_V2.validateBuild = validateBuild;

  // The Check panel follows the drawing just made: which badges are worn is known once the engine has drawn them (LIVE13 E77).
  document.addEventListener('capub:rendered', () => {
    updateStatusPanel(); capubRefreshModalCount();
    // The open chooser's lists put the line under each badge's name as the drawing just made has it (what it did with the badge: its place, or why it is left off).
    const open = document.getElementById('galleryModalOverlay');
    if(open && open.classList.contains('open')) (window.CAPUB_MODAL_PICKERS || []).forEach(entry => { if(entry && typeof entry.rendered === 'function') entry.rendered(); });
  });

  // Wire once after this script block has loaded.
  setTimeout(()=>{ wireV2Controls(); updateStatusPanel(); },0);
})();

