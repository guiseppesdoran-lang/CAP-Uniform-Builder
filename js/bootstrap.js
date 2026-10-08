// Extracted verbatim from index.html: the fail-safe button repair and the BOOTSTRAP init that
// performs the first render. It must load after every other app script and before js/patches.js.

/* ===========================
   FAIL-SAFE BUTTON REPAIR / ARROW CLICK PATCH
   =========================== */
function capubSafeWire(id, eventName, handler){
  const el = by(id);
  if(!el) return;
  const flag = `capubSafeWire_${eventName}`;
  if(el.dataset && el.dataset[flag] === '1') return;
  if(el.dataset) el.dataset[flag] = '1';
  el.addEventListener(eventName, function(evt){
    try{ handler.call(this, evt); }
    catch(err){ console.error(`[CAPUB button error] ${id}`, err); }
  });
}

function capubRepairCriticalButtons(){
  const menuButton=by('hamburgerBtn');
  if(menuButton && menuButton.dataset.sidebarToggleWired !== '1'){
    menuButton.dataset.sidebarToggleWired='1';
    menuButton.addEventListener('click', capubToggleSidebar);
  }

  capubSafeWire('expandRibbons','click', () => {
    if(typeof openGalleryModal === 'function') openGalleryModal('ribbons');
  });
  capubSafeWire('expandBadges','click', () => {
    if(typeof openGalleryModal === 'function') openGalleryModal('badges');
  });
  capubSafeWire('expandPatches','click', () => {
    if(typeof openGalleryModal === 'function') openGalleryModal('patches');
  });

  capubSafeWire('clearRibbons','click', () => {
    State.ribbons = [];
    State.ribbonSelections = {};
    if(typeof buildRibbonGallery === 'function') buildRibbonGallery();
    if(typeof renderRack === 'function') renderRack();
    if(typeof renderAllBadges === 'function') renderAllBadges();
    if(typeof updateStatusPanel === 'function') updateStatusPanel();
  });
  capubSafeWire('clearBadges','click', () => {
    State.badges = [];
    State.badgeSelections = {};
    if(typeof buildBadgeGallery === 'function') buildBadgeGallery();
    if(typeof renderAllBadges === 'function') renderAllBadges();
    if(typeof updateStatusPanel === 'function') updateStatusPanel();
  });
  capubSafeWire('clearPatches','click', () => {
    State.patches = [];
    State.patchSelections = {};
    if(typeof buildPatchGallery === 'function') buildPatchGallery();
    if(typeof renderPatches === 'function') renderPatches();
    if(typeof updateStatusPanel === 'function') updateStatusPanel();
  });

  capubSafeWire('downloadImage','click', async function () {
    const downloadButton = by('downloadImage');
    if(downloadButton?.dataset.exportBusy === '1') return;
    if(downloadButton) downloadButton.dataset.exportBusy = '1';

    try{
      const original = by('uniformCanvas');
      if(!original) throw new Error('No uniform preview was found.');
      const canvas = await composeUniformPngCanvas(original, 2);

      const link = document.createElement('a');
      link.download = `CAP_Uniform_${State.uniform || 'preview'}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      link.remove();
    }catch(err){
      console.error('PNG EXPORT ERROR:', err);
      alert(`PNG export failed: ${err?.message || err}`);
    }finally{
      if(downloadButton) delete downloadButton.dataset.exportBusy;
    }
  });

  const measurementToggle=by('toggleMeasurementOverlay');
  if(measurementToggle && measurementToggle.dataset.measurementToggleWired !== '1'){
    measurementToggle.dataset.measurementToggleWired='1';
    measurementToggle.addEventListener('change', evt => {
      State.showMeasurementOverlay = !!evt.target.checked;
      if(State.showMeasurementOverlay){
        if(typeof renderMeasurementOverlay === 'function') renderMeasurementOverlay();
      }else if(typeof clearMeasurementOverlay === 'function'){
        clearMeasurementOverlay();
      }
    });
  }

  capubSafeWire('toggleMini','change', evt => {
    State.forceMini = !!evt.target.checked;
    if(typeof renderRack === 'function') renderRack();
    if(typeof renderAllBadges === 'function') renderAllBadges();
  });

  // Make sure arrows never block normal UI/preview interaction unless calibrate mode is on.
  const styleId = 'capubDynamicArrowPointerMode';
  if(!by(styleId)){
    const st = document.createElement('style');
    st.id = styleId;
    st.textContent = `.measurementArrowLayer{pointer-events:none!important}.calib-selectable .measurementArrowLayer{pointer-events:auto!important}`;
    document.head.appendChild(st);
  }
}

// Run once immediately and again after bootstrap/dynamic UI creation.
try{ capubRepairCriticalButtons(); }catch(err){ console.error('CAPUB button repair failed', err); }
window.addEventListener('DOMContentLoaded', () => { try{ capubRepairCriticalButtons(); }catch(err){ console.error(err); } });
window.addEventListener('load', () => { try{ capubRepairCriticalButtons(); }catch(err){ console.error(err); } });


/* ===========================
   CAPUB PATCH — COMMAND DATES + ES/VU BADGE SLOT FIX
   Added 2026-05-12
   =========================== */
const CAPUB_COUNTED_BADGE_LIMIT = 5;





function getRenderableCountedBadgeIds(){
  const out = [];
  for(const id of State.badges){
    if(!isBadgeEligibleForMembership(id, State.membership)) continue;
    if(!isBadgeAuthorizedOnCurrentDressUniform(id)) continue;
    if(isCommandInsigniaBadge(id)) continue;
    if(out.length >= CAPUB_COUNTED_BADGE_LIMIT) break;
    out.push(id);
  }
  return out;
}

function selectHighestWearableImportedBadges(ids, membershipHint){
  const forbiddenImportBadges = new Set([
    'cdi_badge','character_development_instructor_badge',
    'mro_badge','msa_badge','mission_radio_operator_badge','mission_staff_assistant_badge',
    'udf_badge','urban_direction_finding_badge',
    'mission_safety_officer_badge','planning_section_chief_badge','operations_section_chief_badge',
    'logistics_section_chief_badge','communications_unit_leader_badge','public_information_officer_badge'
  ]);

  const membership = membershipHint || State.membership || '';
  const unique = [...new Set((ids || []).filter(Boolean))].filter(id => !forbiddenImportBadges.has(id));
  const eligible = unique.filter(id => !(membership === 'cadet' && !isCadetAuthorized(id)));

  const suppress = new Set();
  if(eligible.includes('master_ground_team_badge')){
    suppress.add('senior_ground_team_badge'); suppress.add('ground_team_basic_badge');
  }else if(eligible.includes('senior_ground_team_badge')){
    suppress.add('ground_team_basic_badge');
  }
  if(eligible.includes('master_emergency_services_badge')){
    suppress.add('senior_emergency_services_badge'); suppress.add('emergency_services_badge');
  }else if(eligible.includes('senior_emergency_services_badge')){
    suppress.add('emergency_services_badge');
  }

  const pilotBadges = ['CAPMasterPilot1_621A0E2ED15DA','CAPSeniorPilot1_D9725AE959752','CAPPilot1_FA9D33EA587D8','GliderPilot1_7BFB287379918','BalloonPilot1_442D89C94185B','solo_badge','pre_solo_badge'];
  const observerBadges = ['MasterObserver1_1B88D5071FD5C','SeniorObserver1_0E35802A29801','observer_badge'];
  const aircrewBadges = ['MasterAirCrew1_72AC4CAE7A310','SeniorAirCrew1_B289BAE6E515C','AirCrew1_DB3F0FCC3650F'];
  const keepBestFromFamily = family => family.filter(id => eligible.includes(id)).sort((a,b)=>importedBadgePriority(a)-importedBadgePriority(b))[0] || null;
  const aviationToKeep = keepBestFromFamily(pilotBadges) || keepBestFromFamily(observerBadges) || keepBestFromFamily(aircrewBadges);
  [...pilotBadges, ...observerBadges, ...aircrewBadges].forEach(id => { if(id !== aviationToKeep) suppress.add(id); });

  let out = eligible.filter(id => !suppress.has(id));
  out.sort((a,b) => importedBadgePriority(a) - importedBadgePriority(b));

  const command = out.filter(id => isCommandInsigniaBadge(id));
  const countedSource = out.filter(id => !isCommandInsigniaBadge(id));
  // Reserve the specialty-badge positions before the general badge cap is
  // applied. Sorting alone was insufficient: aviation and qualification badges
  // could consume every counted slot before the highest specialty ratings were
  // reached. The default is now the two highest rated specialty badges, with
  // the requested operations -> CP/AE -> personnel/support tie-break order.
  const protectedIds = [
    ...getHighestImportedSpecialtyBadgeIds(countedSource, 2),
    'volunteer_university_instructor_badge'
  ].filter(id => countedSource.includes(id));

  const counted = [];
  for(const id of protectedIds){
    if(!counted.includes(id)) counted.push(id);
  }
  for(const id of countedSource){
    if(counted.includes(id)) continue;
    if(counted.length >= CAPUB_COUNTED_BADGE_LIMIT) break;
    counted.push(id);
  }

  // Re-sort after protecting items so visual/import priority stays consistent.
  counted.sort((a,b) => importedBadgePriority(a) - importedBadgePriority(b));
  return [...command, ...counted];
}


/* ===========================
   V3.2 USER PATCHES
   - Female Class A current/graduated commander pin default moved 5px left.
   - Senior Aerospace Education badge asset mapped to images/badges/aerospace_senior_badge.webp.
   - v3.3: Command Service Ribbon now requires 365 days at the command level and maps Wing command to silver star; commander pin is blocked for Col and above with manual-selection warning.
   - Specialty-track import continues to use only the Specialty Tracks table.
   =========================== */

/* ===========================
   BOOTSTRAP
   =========================== */
(function init(){
  try{
    // Use a versioned storage key. Older builds used a shared key that may contain
    // female coordinates in the base blues_a bucket, which causes placement drift.
    const savedCal = localStorage.getItem(CAPUB_CALIBRATION_STORAGE_KEY);
    if(savedCal){
      const parsed = JSON.parse(savedCal);
      State.calib.byUniform = normalizeCalibrationBucketsFromPayload(parsed);
      if(parsed.legacyCoordinates) State.calib.map = parsed.legacyCoordinates;
    }
    // Clear stale calibration from previous generated files that changed Class A placement.
    try{ localStorage.removeItem(CAPUB_LEGACY_CALIBRATION_STORAGE_KEY); }catch(err){}
    try{ localStorage.removeItem('capub_admin_calibration_by_uniform_v20260512_female_fix2'); }catch(err){}
    try{ localStorage.removeItem('capub_admin_calibration_by_uniform_v20260512_female_fix1'); }catch(err){}
    try{ localStorage.removeItem('capub_admin_calibration_by_uniform_v20260512_female_a_shift_down26_left6_rightbadges_left15'); }catch(err){}
    // Older builds kept a copy of each generated setup in this browser; it is no longer used.
    try{ localStorage.removeItem('CAPUB_ADMIN_HISTORY_V1'); localStorage.removeItem('CAPUB_ADMIN_HISTORY_CLOUD_MIGRATED_V1'); sessionStorage.removeItem('CAPUB_ADMIN_AUTH_V1'); }catch(err){}
  }catch(err){ console.warn('Could not load saved calibration coordinates', err); }

  

mergeCalibDefaults();

  applyMemberTypeToUniformOptions();
  populateRankSetup();
  updateSetupGates();
  refreshUI();

  buildRibbonGallery();
  buildBadgeGallery();
  wireMemberReportImporter();
  buildPatchGallery();

  fullRender();
  initCalibratorUI();
})();
