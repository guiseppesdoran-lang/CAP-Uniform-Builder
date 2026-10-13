// Extracted verbatim from index.html: badge and patch placement (CAPR 39-1 slot categories,
// field uniform positioning, availability/alternates) and the render pipeline. Loaded between
// the halves of the inline script so execution order is unchanged.

/* ===========================
   BADGES (RENDER) — CAPR 39-1 SLOT CATEGORIES
   =========================== */

/*
  Slot names intentionally match CAPR 39-1 Attachment 4:
  ORP  = Over right pocket
  OLP  = Over left pocket / aviation badge position
  UN   = Under name tag
  ON   = Over name tag
  URBP = Under right breast pocket
  OLPA = Over left pocket, above aviation badges
  OLPU = Over left pocket, under aviation badges
  LP/RP = On left/right pocket
  OLPF = On left pocket flap (NRA badge)
*/


function getRenderableCommandBadgeIds(){
  const out = [];
  for(const id of State.badges){
    if(!isBadgeEligibleForMembership(id, State.membership)) continue;
    if(!isBadgeAuthorizedOnCurrentDressUniform(id)) continue;
    if(isCommandInsigniaBadge(id)) out.push(id);
  }
  return out;
}


function renderAllBadges(){
  return CAPUBUniformView.scheduleRender();
}


/* ===========================
   FIELD UNIFORM POSITIONING
   =========================== */


/* ===========================
   PATCHES (RENDER)
   =========================== */


function renderPatches(){
  return CAPUBUniformView.scheduleRender();
}

/* ===========================
   AVAILABILITY / ALTERNATES
   =========================== */
function updateAvailabilityUI(prevUniform){
  const auth = UI_AUTHZ[State.uniform] || {showRibbons:true,showPatches:true,showBadges:true};
  by('groupRibbons').classList.toggle('hidden', !auth.showRibbons && !UNIFORMS[State.uniform].mini);
  // A uniform that allows a badge but has no placement here (the polo) keeps its Badges panel
  // with a note, instead of the panel vanishing as if no badge were allowed.
  const planned = !auth.showBadges ? CAPUBUniformRules.plannedBadge(State.uniform) : null;
  by('groupBadges').classList.toggle('hidden', !auth.showBadges && !planned);
  const plannedNote = by('badgesPlannedNote');
  if(plannedNote){
    plannedNote.classList.toggle('hidden', !planned);
    plannedNote.textContent = planned
      ? `${planned.text.replace(/\.$/,'')} (CAPR 39-1, ${planned.ref}). Choosing it is not available yet.`
      : '';
  }
  ['expandBadges','clearBadges'].forEach(id => { const b = by(id); if(b) b.disabled = !!planned; });
  by('groupPatches').classList.toggle('hidden', !auth.showPatches);
  // Miniature medals are worn only on Mess Dress and Corporate Semi-Formal (CAPR 39-1 11.1.4).
  const miniWorn = CAPUBUniformRules.allowsMiniMedals(State.uniform);
  ['toggleMini','autoMini','miniMountStyle'].forEach(id=>{
    by(id)?.closest('label')?.classList.toggle('hidden', !miniWorn);
  });
  const badgeCommand = by('cmdBadges');
  const patchCommand = by('cmdPatches');
  if(badgeCommand) badgeCommand.classList.toggle('hidden', !auth.showBadges);
  if(patchCommand) patchCommand.classList.toggle('hidden', !auth.showPatches);

  if(prevUniform && prevUniform!==State.uniform){
    // Convert metal/cloth counterparts while the previous selections still
    // exist. Target-uniform cleanup would otherwise remove OCP-only patches
    // before they can become their dress-uniform metal equivalents.
    applyAlternates(prevUniform, State.uniform);
  }

  clearUnauthorizedPatchesForCurrentUniform();
  // Which awards are worn depends on the uniform (CAPR 39-1 11.1.6), so the rack follows it.
  if(prevUniform && prevUniform!==State.uniform) rebuildRibbonsFromGallery();
  buildPatchGallery();
  if(typeof buildUnitPatchSelector === 'function') buildUnitPatchSelector(by('unitPatchSearch')?.value || '');
}

function applyAlternates(fromU,toU){
  const fromField=isFieldUniform(fromU);
  const toField  =isFieldUniform(toU);

  // Preserve the user's selected ribbons, mini-medals, badges, patches, and devices when changing uniforms.
  // When moving between service/dress uniforms and field uniforms, this only suggests corresponding
  // alternates by adding them; it never deletes the original selections.
  if(!fromField && toField){
    Object.entries(ALTERNATES.badgeToPatch).forEach(([badge,patch])=>{
      if(State.badges.includes(badge) && isPatchAuthorizedForUniform(patch)){
        State.patchSelections[patch] = {checked:true};
        if(!State.patches.includes(patch)) State.patches.push(patch);
      }
    });
    Object.entries(ALTERNATES.ribbonToPatch).forEach(([ribbon,patch])=>{
      if(State.ribbons.find(r=>r.id===ribbon) && isPatchAuthorizedForUniform(patch)){
        State.patchSelections[patch] = {checked:true};
        if(!State.patches.includes(patch)) State.patches.push(patch);
      }
    });
    rebuildPatchesFromGallery();
  } else if(fromField && !toField){
    Object.entries(ALTERNATES.patchToBadge).forEach(([patch,badge])=>{
      if(State.patches.includes(patch) && badge){
        State.badgeSelections[badge] = {checked:true};
      }
    });
    Object.entries(ALTERNATES.patchToRibbon).forEach(([patch,ribbon])=>{
      if(State.patches.includes(patch) && ribbon){
        State.ribbonSelections[ribbon] = State.ribbonSelections[ribbon] || {checked:true, devices:{}};
        State.ribbonSelections[ribbon].checked = true;
      }
    });

    rebuildBadgesFromGallery();
    rebuildRibbonsFromGallery();
  }
}

/* ===========================
   RENDER PIPELINE
   =========================== */

function militaryEscapeHtml(value){
  return String(value || '').replace(/[&<>"']/g,character=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[character]);
}


function getAvailableMilitaryBadgeVariants(badge,representationName='metal',service=State.organization){
  const configured=badge?.representations?.[representationName] || {};
  const representation=configured.byService?.[service] || configured;
  const variants=representation.variants || {};
  const available=Object.entries(variants)
    .filter(([,record])=>record?.status==='AVAILABLE' && record.asset)
    .map(([id,record])=>({id,record}));
  if(!available.length && representation.status==='AVAILABLE' && representation.asset){
    available.push({id:representation.defaultVariant || 'default',record:representation});
  }
  return available;
}

function getAllSelectableMilitaryBadges(){
  return (window.CAPUBMilitaryData?.badges || [])
    .filter(badge=>getAvailableMilitaryBadgeVariants(badge).length)
    .sort((a,b)=>String(a.officialName || a.id).localeCompare(String(b.officialName || b.id)));
}

function getMilitaryBadgeRepresentation(badge,preferred='metal',uniformFamily='SERVICE_DRESS'){
  const representationName=preferred==='auto'
    ? (/OCP|ABU|ODU|NWU|MCCUU|UTILITY/i.test(uniformFamily) ? 'embroidered' : 'metal')
    : preferred;
  const configured=badge?.representations?.[representationName] || {status:'MISSING_ASSET',available:false,asset:null};
  const base=configured.byService?.[State.organization] || configured;
  const available=getAvailableMilitaryBadgeVariants(badge,representationName,State.organization);
  const requested=State.militaryBadges?.[badge?.id]?.variant;
  const selectedVariant=requested || base.defaultVariant || available[0]?.id || badge?.variants?.[0] || 'default';
  const resolved=window.CAPUBMilitary?.resolveBadgeRepresentation?.(badge,{
    service:State.organization,uniformFamily,preferred:representationName,
    assetProfiles:window.CAPUBMilitaryData?.assetProfiles,variant:selectedVariant
  });
  if(resolved?.status==='AVAILABLE' && resolved.asset) return resolved;
  return available[0]?.record || base;
}


function militaryAwardFilterType(award){
  const category=String(award?.category || window.CAPUBMilitary?.inferredCategory?.(award) || 'UNKNOWN').toUpperCase();
  if(['MEDAL_OF_HONOR','SERVICE_CROSS','DISTINGUISHED_SERVICE','VALOR','SUPERIOR_SERVICE','LEGION_OF_MERIT','DISTINGUISHED_FLYING_CROSS','HEROISM','BRONZE_STAR','PURPLE_HEART','MERITORIOUS_SERVICE','AIR_MEDAL','COMMENDATION','ACHIEVEMENT','PRISONER_OF_WAR'].includes(category)) return 'DECORATIONS';
  if(category==='UNIT_AWARD' || category==='FOREIGN_UNIT_AWARD') return 'UNIT_AWARD';
  if(['CAMPAIGN','EXPEDITIONARY'].includes(category)) return 'CAMPAIGN_EXPEDITIONARY';
  if(['SERVICE','RESERVE','GOOD_CONDUCT'].includes(category)) return 'SERVICE';
  if(category==='TRAINING') return 'TRAINING';
  if(category.startsWith('FOREIGN')) return 'FOREIGN';
  return 'OTHER';
}


function maximumRenderableMilitaryAwardCount(award,representationOverride=null){
  const representation=representationOverride || State.militaryRepresentation || 'RIBBON';
  const service=State.organization;
  const deviceCatalog=window.CAPUBMilitaryData?.devices || [];
  let maximum=1;
  // The generated device matrix currently contains verified repeat-award
  // combinations through the twentieth award. Stop at the highest count the
  // configured service rule can represent without inventing a device.
  for(let count=2;count<=20;count+=1){
    const result=window.CAPUBMilitary?.calculateDevices?.({
      award,service,awardCount:count,representation,deviceCatalog
    });
    if(result?.valid) maximum=count;
  }
  return maximum;
}


function militaryBadgeDressPlacementRole(badge){
  const family=String(badge?.family || '').toUpperCase();
  const notes=JSON.stringify(badge?.placement?.serviceDress || '').toLowerCase();
  const id=String(badge?.id || '').toLowerCase();
  if(/right pocket|above the nametag|above the name tag/.test(notes)) return 'RIGHT_POCKET';
  if(/wearer's left|left pocket|below the bottom row|below the ribbons|below the medals/.test(notes)) return 'LEFT_POCKET';
  if(/marksmanship|rifle_qualification|pistol_qualification/.test(id)) return 'LEFT_POCKET';
  // Identification and command badges use dedicated pocket/duty-badge zones;
  // they must not be mixed into the occupational stack over the awards.
  if(family==='IDENTIFICATION' || family==='COMMAND') return 'RIGHT_POCKET';
  return 'ABOVE_AWARDS';
}


// The preview is drawn by js/uniform-view.js from the page state; every change asks for one render.
function fullRender(prevUniform){
  updateAvailabilityUI(prevUniform);
  return CAPUBUniformView.scheduleRender();
}

function refreshUI(){
  membershipTypeEl.value = State.membership || '';
  rankSetupSelect.value = State.rank || '';
  jacketSelect.value = State.gender || '';
  const miniStyleControl = by('miniMountStyle');
  if(miniStyleControl) miniStyleControl.value = State.miniMountStyle === 'holding' ? 'holding' : 'mounting';
  if(typeof syncAdultCadetControl === 'function') syncAdultCadetControl();
  if(typeof capubSyncSegments === 'function') capubSyncSegments();
  // Cadets only: the option to wear just the highest Cadet Program achievement ribbon.
  const highestOnly = by('cadetHighestOnly');
  if(highestOnly){
    highestOnly.checked = !!State.cadetHighestOnly;
    by('cadetHighestOnlyRow')?.classList.toggle('hidden', State.membership !== 'cadet');
  }
  syncRibbonRackColumnsControl();
  syncCadetFirstSergeantControl();

  highlightActiveUniformButton();
  applyMemberTypeToUniformOptions();

}
