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
  State.uniform=newUniform;
  if(prevU!==newUniform) window.CAPUB_TELEMETRY?.track('uniform_switch', { from: prevU, to: newUniform });

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
  State.unitPatchCharter='';
  const unitSearch = by('unitPatchSearch');
  if(unitSearch) unitSearch.value='';
  buildPatchGallery();
  if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector('');
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
      ? 'Display option: the left-aligned four-across rack is shifted as one unit until its rows of four are centered over the pocket. This arrangement is not in accordance with CAPR 39-1.'
      : classA
        ? 'Choose three across, or align a four-across rack with the wearer-left/outboard pocket edge. Rows have no spacing.'
        : 'CAPR 39-1 requires rows of three on Class B and aviator shirts. Four-across is available only on Class A.';
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
      capubNotify('The four-across rack centered above the welt/pocket is a display option and is not in accordance with CAPR 39-1.', 9000);
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
  modalHost.innerHTML = '';

  const host = document.createElement('div');

  const header = document.createElement('div');
  header.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:10px;";
  header.innerHTML = `
    <div style="font-size:12px;color:var(--muted);line-height:1.3;">
      
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <button id="modalShowLess" class="ghost" type="button" style="width:auto;padding:8px 10px;border-radius:10px;">Show less</button>
      <button id="modalShowAll" class="ghost" type="button" style="width:auto;padding:8px 10px;border-radius:10px;">Show all</button>
    </div>
  `;
  host.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'galleryGrid';
  host.appendChild(grid);

  modalHost.appendChild(host);

  function syncFromSidebar(){
    if(kind==='ribbons'){
      const hadMilitaryUI=!!grid.querySelector('details[data-military-section]');
      if(hadMilitaryUI) captureMilitaryGalleryUI(grid,modalHost.parentElement,'modalScrollTop');
      const ui=getMilitaryUIState();
      const modalSnapshot=hadMilitaryUI ? {
        expandedSections:[...(ui.expandedSections || [])],
        modalScrollTop:ui.modalScrollTop,
        focusedControl:ui.focusedControl ? {...ui.focusedControl} : null
      } : null;
      State.ribbonGalleryExpanded = true;
      buildRibbonGallery({capture:false});
      if(modalSnapshot){
        ui.expandedSections=modalSnapshot.expandedSections;
        ui.modalScrollTop=modalSnapshot.modalScrollTop;
        ui.focusedControl=modalSnapshot.focusedControl;
      }
      modalTitle.textContent = "Ribbons / miniature medals";
      const sidebar = by('ribbonGallery');
      grid.innerHTML = sidebar ? sidebar.innerHTML : '';
      wireModalInteractions('ribbons');
      fillRibbonTilePreviews(grid);
      restoreMilitaryGalleryUI(grid,modalHost.parentElement,'modalScrollTop');
      queueMicrotask(()=>window.CAPUB_refreshModalGallerySearch?.('ribbons'));
    }

    if(kind==='badges'){
      State.badgeGalleryExpanded = true;
      modalTitle.textContent = "Badges";
      buildGroupedBadgeModal(grid);
      return;
    }

    if(kind==='patches'){
      State.patchGalleryExpanded = true;
      buildPatchGallery();
      modalTitle.textContent = "Patches";
      const sidebar = by('patchGallery');
      grid.innerHTML = sidebar ? sidebar.innerHTML : '';
      wireModalInteractions('patches');
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

    const buildTile = id => {
        const sel = State.badgeSelections[id] || {checked:false};
        const title = getBadgeDisplayName(id);

        const tile = document.createElement('div');
        tile.className = 'galleryTile';
        tile.innerHTML = `
          <img loading="lazy" decoding="async" src="${ASSET(getBadgeAssetPath(id))}" alt="${escapeHtml(title)}">
          <div style="flex:1;min-width:0;">
            <div class="title">${escapeHtml(title)}</div>
            <div class="miniRow">
              <label><input type="checkbox" class="bdChk"> Add</label>
            </div>
            ${badgeLevelSelectHtml(id)}
            ${id==='squadron_commander_badge' ? `<div class="miniRow"><label><input type="checkbox" class="cmdGradChk"> Graduated commander</label></div>` : ``}
            ${getBadgeTileMetaHtml(id)}
          </div>
        `;
        wireBadgeLevelSelect(tile, id);

        const chk = tile.querySelector('.bdChk');
        const gradChk = tile.querySelector('.cmdGradChk');
        chk.checked = !!sel.checked;
        if(gradChk) gradChk.checked = !!State.commandInsignia?.graduatedCommander;
        chk.onchange = ()=>{
          sel.checked = chk.checked;
          State.badgeSelections[id] = sel;
          rebuildBadgesFromGallery();
        };
        if(gradChk){
          gradChk.onchange = ()=>{
            if(!State.commandInsignia) State.commandInsignia = {};
            State.commandInsignia.graduatedCommander = gradChk.checked;
            if(gradChk.checked){
              sel.checked = true;
              chk.checked = true;
              State.badgeSelections[id] = sel;
            }
            rebuildBadgesFromGallery();
          };
        }

        return tile;
    };

    const appendCategorizedBadges = (container, allowedIds) => {
      const allowedSet = new Set(allowedIds);
      getBadgeCategoriesForCurrentMembership().forEach(cat=>{
        const ids = cat.ids.filter(id => eligibleSet.has(id) && allowedSet.has(id));
        if(!ids.length) return;

        const h = document.createElement('div');
        h.style.cssText = "margin:10px 0 6px;font-weight:800;color:var(--ink);font-size:13px;";
        h.textContent = cat.key;

        const subGrid = document.createElement('div');
        subGrid.className = 'galleryGrid';
        ids.forEach(id => subGrid.appendChild(buildTile(id)));
        container.appendChild(h);
        container.appendChild(subGrid);
      });
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

    // U.S. military badges are not worn on Corporate-style uniforms (CAPR 39-1 4.2.5.1.3).
    const militaryBadges=isMilitaryAwardWornOnUniform() ? getAllSelectableMilitaryBadges() : [];
    if(militaryBadges.length){
      const militaryRoot=document.createElement('details');
      militaryRoot.dataset.militaryBadgeCatalog='true';
      militaryRoot.style.cssText='margin:14px 0 12px;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--panel);';
      const militarySummary=document.createElement('summary');
      militarySummary.style.cssText='cursor:pointer;font-weight:850;color:var(--ink);padding:4px 0;';
      militarySummary.textContent=`U.S. military badges (${militaryBadges.length})`;
      militaryRoot.appendChild(militarySummary);
      // The ABU, OCP, flight suit and Corporate Semi-Formal allow military badges and the builder does not draw them there yet.
      if(!CAPUBUniformRules.drawsMilitaryBadges(State.uniform)){
        const notDrawn=document.createElement('div');
        notDrawn.className='sub militaryBadgesNotDrawn'; notDrawn.setAttribute('role','note'); notDrawn.style.cssText='margin:6px 0 8px;font-weight:700;';
        notDrawn.textContent='U.S. military badges are not drawn on this uniform yet. Your choices are kept for the uniforms that show them.';
        militaryRoot.appendChild(notDrawn);
      }

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
        const branchGrid=document.createElement('div');
        branchGrid.className='galleryGrid';
        for(const badge of records){
          const variants=getAvailableMilitaryBadgeVariants(badge);
          const selected=State.militaryBadges?.[badge.id];
          const activeVariant=selected?.variant || badge.representations?.metal?.defaultVariant || variants[0].id;
          const representation=variants.find(item=>item.id===activeVariant)?.record || variants[0].record;
          const tile=document.createElement('div');
          tile.className='galleryTile militaryBadgeGalleryTile';
          tile.dataset.militaryBadgeId=badge.id;
          const preview=document.createElement('img');
          preview.src=representation.asset; preview.alt=badge.officialName || badge.id;
          const body=document.createElement('div'); body.style.cssText='flex:1;min-width:0;';
          const title=document.createElement('div'); title.className='title'; title.textContent=badge.officialName || badge.id;
          const sub=document.createElement('div'); sub.className='sub'; sub.textContent=[(badge.family && badge.family!=='OTHER') ? String(badge.family).charAt(0)+String(badge.family).slice(1).toLowerCase() : '',(badge.authorizedServices || []).map(militaryServiceLabel).join(' / ')].filter(Boolean).join(' • ');
          const controls=document.createElement('div'); controls.className='miniRow';
          const label=document.createElement('label');
          const checkbox=document.createElement('input'); checkbox.type='checkbox'; checkbox.className='militaryBadgeCatalogCheck'; checkbox.checked=!!selected;
          label.append(checkbox,document.createTextNode(' Add'));
          controls.appendChild(label);
          let variantSelect=null;
          if(variants.length>1){
            variantSelect=document.createElement('select'); variantSelect.className='militaryBadgeVariant'; variantSelect.title='Badge level or variant';
            for(const variant of variants){
              const option=document.createElement('option'); option.value=variant.id;
              option.textContent=variant.id.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
              variantSelect.appendChild(option);
            }
            variantSelect.value=activeVariant;
            controls.appendChild(variantSelect);
          }
          checkbox.onchange=()=>{
            if(!State.militaryBadges) State.militaryBadges={};
            if(checkbox.checked) State.militaryBadges[badge.id]={selected:true,variant:variantSelect?.value || activeVariant};
            else delete State.militaryBadges[badge.id];
            fullRender();
          };
          if(variantSelect) variantSelect.onchange=()=>{
            if(!State.militaryBadges) State.militaryBadges={};
            checkbox.checked=true;
            State.militaryBadges[badge.id]={selected:true,variant:variantSelect.value};
            preview.src=getMilitaryBadgeRepresentation(badge).asset;
            fullRender();
          };
          body.append(title,sub,controls); tile.append(preview,body); branchGrid.appendChild(tile);
        }
        details.appendChild(branchGrid); militaryRoot.appendChild(details);
      }
      modalHost.appendChild(militaryRoot);
    }
  }

  function wireModalInteractions(k){
    if(k==='ribbons'){
      wireRibbonTileControls(grid);
      grid.querySelectorAll('.militaryRibbonCatalogSearch').forEach(input=>{
        input.oninput=()=>{
          const ui=getMilitaryUIState();
          ui.gallerySearchValue=input.value;
          ui.focusedControl={ribbonId:'',deviceId:'',className:'militaryRibbonCatalogSearch',selectionStart:input.selectionStart};
          clearTimeout(wireModalInteractions.searchTimer);
          wireModalInteractions.searchTimer=setTimeout(()=>syncFromSidebar(),100);
        };
      });
      grid.querySelectorAll('.militaryRibbonCatalogService,.militaryRibbonCatalogType').forEach(select=>{
        select.onchange=()=>{
          const ui=getMilitaryUIState();
          if(select.classList.contains('militaryRibbonCatalogService')) ui.galleryServiceFilter=select.value || 'ALL';
          else ui.galleryAwardTypeFilter=select.value || 'ALL';
          captureMilitaryGalleryUI(grid,modalHost.parentElement,'modalScrollTop');
          syncFromSidebar();
        };
      });
      grid.querySelectorAll('details[data-military-section]').forEach(details=>{
        details.addEventListener('toggle',()=>{
          if(details.open && details.querySelector(':scope > [data-military-lazy="true"]')){
            captureMilitaryGalleryUI(grid,modalHost.parentElement,'modalScrollTop');
            syncFromSidebar();
          }
        });
      });
      grid.querySelectorAll('.rbAwardSelect,.militaryServiceSelect,.militarySpecialDevice,.militaryNumeralDevice,.militaryAdvancedMode').forEach(control=>{
        const original=control.onchange;
        control.onchange=(event)=>{
          captureMilitaryGalleryUI(grid,modalHost.parentElement,'modalScrollTop');
          original?.call(control,event);
          syncFromSidebar();
        };
      });
    }

    if(k==='patches'){
      const showCount = State.patchGalleryExpanded ? patchList.length : Math.min(10, patchList.length);
      const ids = patchList.slice(0, showCount);

      const tiles = [...grid.querySelectorAll('.galleryTile')];
      tiles.forEach((tile, i) => {
        const id = ids[i];
        if(!id) return;
        const sel = State.patchSelections[id] || {checked:false};

        const chk = tile.querySelector('.ptChk');
        if(chk){
          chk.checked = !!sel.checked;
          chk.onchange = () => {
            sel.checked = chk.checked;
            rebuildPatchesFromGallery();
            syncFromSidebar();
          };
        }
      });
    }
  }

  host.querySelector('#modalShowLess').onclick = ()=>{
    if(kind==='ribbons'){ State.ribbonGalleryExpanded=false; buildRibbonGallery(); }
    if(kind==='badges'){ State.badgeGalleryExpanded=false; buildBadgeGallery(); }
    if(kind==='patches'){ State.patchGalleryExpanded=false; buildPatchGallery(); }
    syncFromSidebar();
  };
  host.querySelector('#modalShowAll').onclick = ()=>{
    if(kind==='ribbons'){ State.ribbonGalleryExpanded=true; buildRibbonGallery(); }
    if(kind==='badges'){ State.badgeGalleryExpanded=true; buildBadgeGallery(); }
    if(kind==='patches'){ State.patchGalleryExpanded=true; buildPatchGallery(); }
    syncFromSidebar();
  };

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
      rank: State.rank,
      cadetFirstSergeant: State.cadetFirstSergeant,
      shoulderCord: State.shoulderCord || '',
      unitPatchCharter: State.unitPatchCharter || '',
      assetBase: State.assetBase,
      ribbons: State.ribbons,
      badges: State.badges,
      patches: State.patches,
      ribbonSelections: State.ribbonSelections,
      badgeSelections: State.badgeSelections,
      badgeChoices: State.badgeChoices || {},
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
    out.rank = out.membership && RANKS[out.membership].includes(p.rank) ? p.rank : null;
    out.cadetFirstSergeant = !!p.cadetFirstSergeant;
    out.shoulderCord = typeof p.shoulderCord === 'string' && has(SHOULDER_CORD_META, p.shoulderCord) ? p.shoulderCord : null;
    out.unitPatchCharter = typeof p.unitPatchCharter === 'string' && /^[A-Za-z0-9-]{0,24}$/.test(p.unitPatchCharter) ? p.unitPatchCharter : '';

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
        honorCredit: !!sel.honorCredit,
        rocketryCredit: !!sel.rocketryCredit
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
    State.rank = p.rank;
    State.cadetFirstSergeant = p.cadetFirstSergeant;
    if(!isCadetFirstSergeantEligible(State.rank)) State.cadetFirstSergeant = false;
    State.shoulderCord = p.shoulderCord;
    State.unitPatchCharter = p.unitPatchCharter;
    State.assetBase = 'images';
    State.ribbons = [];
    State.badges = p.badges;
    State.patches = p.patches;
    State.ribbonSelections = p.ribbonSelections;
    State.badgeSelections = p.badgeSelections;
    State.badgeChoices = p.badgeChoices || {};
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
    if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector(by('unitPatchSearch')?.value || '');
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
    if(!State.rank) addNotice('warn','Select rank before building the uniform.',{id:'rankSetupSelect',label:'Choose'});
    if(!State.gender) addNotice('warn','Select the male or female cut so the uniform can be drawn.',{id:'jacketSelect',label:'Choose'});
    if(State.membership && !isUniformAllowedFor(State.uniform, State.membership)) addNotice('err','Selected uniform is not authorized for the selected membership type.');
    if(State.unitPatchCharter && typeof getSelectedUnitPatchId === 'function' && !getSelectedUnitPatchId()) addNotice('warn',`The ${getUnitPatchSpokenName(State.unitPatchCharter)} patch picture is not available yet, so no unit patch is shown.`);
    if(State.unitPatchCharter && typeof getSelectedUnitPatchId === 'function' && getSelectedUnitPatchId() && !isUnitPatchAuthorizedForCurrentUniform()) addNotice('warn',`The ${getUnitPatchSpokenName(State.unitPatchCharter)} unit patch is not worn on this uniform, so it is not shown.`);
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
      addNotice('ok','On the blazer itself only the chaplain badge and, in place of the CAP Crest, the CSAG, Command Council, National Board or NEC badge are worn (CAPR 39-1, 4.2.3.1.1.1, 4.2.3.1.1.3); the other badges are shown on the aviator shirt drawn beside it.');
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
      if(State.badges.includes('squadron_commander_badge') && State.commandInsignia?.graduatedCommander) addNotice('ok','Squadron Commander badge is marked as Graduated Commander and is shown under the nameplate (UN); command insignia remains outside the normal four-badge count.');
      if(State.badges.includes('squadron_commander_badge') && !State.commandInsignia?.graduatedCommander) addNotice('ok','Squadron Commander badge is marked as Current Commander and is shown over the nameplate (ON); command insignia remains outside the normal four-badge count.');
      const aviation = State.badges.filter(id => ['OLP','OLPA','OLPU'].some(s => String(badgeLocations[id]||'').includes(s)));
      if(aviation.length > 2) addNotice('warn','More than two aviation/occupational-style badges are selected for the wearer’s left side.',{id:'expandBadges',label:'Review badges'});
    }
    if(State.uniform === 'mess_dress' && State.membership === 'cadet') addNotice('err','Mess Dress is not available to cadets in this builder.');
    if(!CAPUB_V2.notices.length) addNotice('ok','No automatic validation issues found. Final approval still requires CAPR 39-1 review and any applicable supplement.');
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
    wrap.innerHTML = `<input id="capubV2ModalSearch" placeholder="Search ${kind} by name or category..."/><div class="sub"><span id="capubV2ModalCount"></span> visible.</div><div id="capubV2ModalEmpty" class="sub" role="status" hidden></div>`;
    body.insertBefore(wrap, body.firstChild);
    const input = wrap.querySelector('input');
    const count = wrap.querySelector('#capubV2ModalCount');
    input.value=State.modalGallerySearchValues[kind] || '';
    function filter(){
      const q = input.value.trim().toLowerCase();
      State.modalGallerySearchValues[kind]=input.value;
      let visible = 0;
      body.querySelectorAll('.galleryTile').forEach(tile=>{
        const show = !q || tile.textContent.toLowerCase().includes(q);
        tile.classList.toggle('isFilteredOut', !show);
        if(show) visible++;
      });
      if(count) count.textContent = visible;
      // A category heading with every tile filtered out would sit there on its own.
      if(kind === 'badges'){
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
    const save = by('capubV2SaveLocal'), load = by('capubV2LoadLocal'), exp = by('capubV2ExportJson'), impBtn = by('capubV2ImportBtn'), impFile = by('capubV2ImportFile');
    const reset = by('capubV2Reset');
    const fn = by('capubV2FirstName'), ln = by('capubV2LastName'), pl = by('capubV2PlateLine'), sh = by('capubV2ShowText');
    if(save) save.onclick = ()=>{ localStorage.setItem(CAPUB_V2.storageKey, JSON.stringify(collectProfile())); updateStatusPanel(); capubNotify('Uniform setup saved in this browser.'); };
    if(load) load.onclick = ()=>{ const raw = localStorage.getItem(CAPUB_V2.storageKey); if(!raw){ capubNotify('No saved setup found in this browser.'); return; } applyProfile(JSON.parse(raw)); };
    if(exp) exp.onclick = ()=>(window.CAPUB_TELEMETRY?.track('setup_file', { action: 'save' }), downloadText(CAPUBExportNames.exportFileName({rank:State.rank,uniform:State.uniform},'json'), JSON.stringify(collectProfile(), null, 2)));
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
  document.addEventListener('capub:rendered', () => { updateStatusPanel(); capubRefreshModalCount(); });

  // Wire once after this script block has loaded.
  setTimeout(()=>{ wireV2Controls(); updateStatusPanel(); },0);
})();

