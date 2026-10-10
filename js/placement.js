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

const badgeSlots = {
  ORP:  [],
  OLP:  [],
  UN:   [],
  ON:   [],
  URBP: [],
  OLPA: [],
  OLPU: [],
  LP:   [],
  RP:   [],
  LRP:  [],
  OLPF: []
};

function resetBadgeSlots(){
  Object.keys(badgeSlots).forEach(k => badgeSlots[k] = []);
}

function parseSlotPrefs(slotSpec){
  if(!slotSpec) return ['UN'];
  return String(slotSpec)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}


function getRenderableCommandBadgeIds(){
  const out = [];
  for(const id of State.badges){
    if(!isBadgeEligibleForMembership(id, State.membership)) continue;
    if(!isBadgeAuthorizedOnCurrentDressUniform(id)) continue;
    if(isCommandInsigniaBadge(id)) out.push(id);
  }
  return out;
}

function getRenderableBadgeIds(){
  return [...getRenderableCountedBadgeIds(), ...getRenderableCommandBadgeIds()];
}

function renderAllBadges(){
  clearMeasurementOverlay();
  [...uniformCanvas.querySelectorAll('.layer.badge')].forEach(n=>n.remove());
  resetBadgeSlots();
  if(!UI_AUTHZ[State.uniform]?.showBadges){
    renderMeasurementOverlay();
    return;
  }

  for(const id of getRenderableCountedBadgeIds()){
    placeBadgeSlotAnchored(id);
  }

  // Command insignia never counts against the four-badge limit and should render last
  // so it stays visible even when other badges are already present.
  for(const id of getRenderableCommandBadgeIds()){
    placeBadgeSlotAnchored(id);
  }

  renderSelectedMilitaryBadgesOnCap();

  renderMeasurementOverlay();
}

function renderSelectedMilitaryBadgesOnCap(){
  if(State.organization!=='CAP') return;
  const remaining=Math.max(0,4-getRenderableCountedBadgeIds().length);
  if(!remaining) return;
  const selected=getAllSelectableMilitaryBadges()
    .filter(badge=>State.militaryBadges?.[badge.id])
    .slice(0,remaining)
    .map(badge=>({badge,representation:getMilitaryBadgeRepresentation(badge)}))
    .filter(entry=>entry.representation?.status==='AVAILABLE' && entry.representation.asset);
  if(!selected.length) return;

  const renderSize=getCanvasRenderSize();
  const rack=getRenderedAwardRackElements();
  const rackTop=rack.length ? Math.min(...rack.map(el=>parseFloat(el.style.top)||0)) : renderSize.h*.38;
  const rackCenter=getTopRibbonRowCenterX() ?? renderSize.w*.65;
  const existing=[...uniformCanvas.querySelectorAll('.layer.badge:not(.capMilitaryBadge)')]
    .map(el=>({top:parseFloat(el.style.top)||0,bottom:(parseFloat(el.style.top)||0)+(parseFloat(el.style.height)||0)}))
    .filter(box=>box.bottom<=rackTop+1 && Math.abs(rackCenter-renderSize.w*.65)<renderSize.w);
  const stackBottom=existing.length ? Math.min(rackTop-4,...existing.map(box=>box.top-4)) : rackTop-4;
  const width=Math.max(46,Math.min(62,renderSize.w*.067));
  const height=width*.625;
  selected.forEach((entry,index)=>{
    const image=document.createElement('img');
    image.className='layer badge militaryBadgeTile capMilitaryBadge';
    image.dataset.militaryBadgeId=entry.badge.id;
    image.src=entry.representation.asset;
    image.alt=entry.badge.officialName || entry.badge.id;
    image.title=`U.S. military badge: ${entry.badge.officialName || entry.badge.id}`;
    const top=stackBottom-(selected.length-index)*height;
    Object.assign(image.style,{
      left:`${rackCenter-width/2}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`,
      objectFit:'contain',zIndex:String(176+index)
    });
    uniformCanvas.appendChild(image);
  });
}

function getRenderedAwardRackElements() {
  // Service uniforms use ribbonTile; Mess Dress and Semi-Formal use ribbonMini.
  // Badge placement must follow whichever award rack is actually rendered.
  return [...uniformCanvas.querySelectorAll('.layer.ribbonTile,.layer.ribbonMini')];
}

function getTopRibbonRowCenterX() {
  const ribbonEls = getRenderedAwardRackElements();
  if (!ribbonEls.length) return null;

  const minTop = Math.min(...ribbonEls.map(el => parseFloat(el.style.top) || 0));
  const topRow = ribbonEls.filter(el => Math.abs((parseFloat(el.style.top) || 0) - minTop) < 0.5);
  if (!topRow.length) return null;

  const lefts = topRow.map(el => parseFloat(el.style.left) || 0);
  const rights = topRow.map(el => (parseFloat(el.style.left) || 0) + (parseFloat(el.style.width) || RIBBON_WIDTH));
  return (Math.min(...lefts) + Math.max(...rights)) / 2;
}

function getTopRibbonRowY() {
  const ribbonEls = getRenderedAwardRackElements();
  if (!ribbonEls.length) return null;
  return Math.min(...ribbonEls.map(el => parseFloat(el.style.top) || 0));
}

const OVER_RIBBON_REFERENCE_TOP_BY_UNIFORM = {
  // Latest senior male Class A calibration export used a highest ribbon row at y=199.
  // Every calibrated badge keeps its own vertical offset from that highest ribbon row.
  blues_a: 199,
  blues_b: 199
};

function getReferenceCalibForKey(uniformId, key){
  for(const id of getCalibFallbackUniforms(uniformId)){
    const bucket = State.calib.byUniform?.[id] || {};
    if(bucket[key]) return bucket[key];
    const defaults = DEFAULT_CALIBRATION_BY_UNIFORM[id] || {};
    if(defaults[key]) return defaults[key];
  }
  return null;
}

function getNationalStaffTopForSpecialtySlot(slot){
  const uniformId = getCurrentCalibUniform();
  const sameSlot = getReferenceCalibForKey(uniformId, `badge:national_staff_badge:${slot}:0`);
  if(Number.isFinite(Number(sameSlot?.y))) return Number(sameSlot.y);

  // Older calibration files only carried the regulation left-pocket entry.
  // Its y coordinate is still the correct common top edge for the opposite
  // pocket and the female over-nameplate specialty row.
  const leftPocket = getReferenceCalibForKey(uniformId, 'badge:national_staff_badge:LP:0');
  if(Number.isFinite(Number(leftPocket?.y))) return Number(leftPocket.y);

  // National Staff was added after many saved calibration bundles, so derive
  // its regulation anchor when no explicit record exists.
  const renderSize = getCanvasRenderSize();
  const staffSize = getBadgeRenderSize('national_staff_badge');
  const base = getBadgeBaseAnchor(
    slot,
    'national_staff_badge',
    0,
    renderSize.w,
    renderSize.h,
    staffSize.width,
    staffSize.height
  );
  const staffKey = `badge:national_staff_badge:${slot}:0`;
  const resolved = getCalib(staffKey) || buildDerivedBadgeCalib(staffKey, {
    x:base?.x,
    y:base?.y,
    w:staffSize.width,
    h:staffSize.height,
    r:0
  });
  if(Number.isFinite(Number(resolved?.y))) return Number(resolved.y);
  return Number.isFinite(Number(base?.y)) ? Number(base.y) : null;
}

function getOverRibbonReferenceKey(slot, idx=0){
  if(slot === 'OLP'){
    const uniformId = getCurrentCalibUniform();
    const observerKey = `badge:observer_badge:OLP:${idx}`;
    if(getReferenceCalibForKey(uniformId, observerKey)) return observerKey;
    return `badge:AirCrew1_DB3F0FCC3650F:OLP:${idx}`;
  }
  if(slot === 'OLPU') return `badge:master_ground_team_badge:OLPU:${idx}`;
  if(slot === 'OLPA'){
    const uniformId = getCurrentCalibUniform();
    const observerKey = `badge:observer_badge:OLP:0`;
    if(getReferenceCalibForKey(uniformId, observerKey)) return observerKey;
    return `badge:AirCrew1_DB3F0FCC3650F:OLP:0`;
  }
  return null;
}

function selectedBadgeWouldRenderInSlot(id, slotName){
  if(!id) return false;
  if(id === 'nra_marksman_badge') return slotName === 'OLPF';
  if(isFemaleCadetClassAUniform() && (id === 'cyber_badges' || id === 'stem_badges')) return getGenderedPocketSlotForBadge(id) === slotName;
  if(id === 'model_rocketry_badge' || id === 'cyber_badges' || id === 'stem_badges') return getGenderedPocketSlotForBadge(id) === slotName;
  if(isCommandInsigniaBadge(id)) return getCommandInsigniaSlot() === slotName;
  if(CHAPLAIN_BADGE_IDS.has(id)) return slotName === 'OLPA';
  if(AIRCREW_BADGE_IDS.has(id)) return slotName === 'OLP';
  if(OLPU_OCCUPATIONAL_BADGE_IDS.has(id)) return slotName === 'OLPU';
  if(isSelectableSpecialtyPocketBadge(id)) return getSpecialtyPocketSlotBySelectionOrder(id) === slotName;
  return parseSlotPrefs(getBadgeSlotSpec(id)).includes(slotName);
}
function hasSelectedUnderAviationBadge(){
  return State.badges.some(id => id && selectedBadgeWouldRenderInSlot(id, 'OLPU'));
}
function hasSelectedAboveAviationBadge(){
  return State.badges.some(id => id && selectedBadgeWouldRenderInSlot(id, 'OLPA'));
}
function shouldUseLowerAviationPosition(){
  // Lower aviation positioning is now handled by the shared above-ribbon stack gap.
  return !hasSelectedUnderAviationBadge();
}
function getLowerAviationTop(badgeHeight=null){
  const liveTopRibbonY = getTopRibbonRowY();
  if(liveTopRibbonY === null) return null;
  // When no badge is worn in the OLPU position, the aviation badge should drop to the
  // lower single-badge position directly over the highest ribbon row. Keep a small,
  // consistent gap between the bottom of the badge and the top of the ribbons.
  const resolvedHeight = Number.isFinite(Number(badgeHeight)) ? Number(badgeHeight) : 17;
  const bottomGap = 5;
  return Math.round(liveTopRibbonY - resolvedHeight - bottomGap);
}
function applyBadgeAssetWithFallback(el, id){
  const assetCandidates = getBadgeAssetCandidates(id).map(ASSET);
  let idx = 0;

  function tryNext(){
    if(idx >= assetCandidates.length){
      // If the individual transparent PNG cannot be found, show a small visual
      // fallback instead of throwing an error. This also prevents the old
      // "candidates is not defined" failure path.
      el.replaceWith(createBadgeFallbackElement(id, el));
      return;
    }
    el.src = assetCandidates[idx++];
  }

  el.onerror = tryNext;
  tryNext();
}

function createBadgeFallbackElement(id, sourceEl){
  const div = document.createElement('div');
  div.className = 'layer badge badgeFallback' + (id === 'squadron_commander_badge' ? ' commandInsigniaFallback' : '');
  div.textContent = id === 'squadron_commander_badge' ? '' : 'BADGE';
  div.dataset.calibKey = sourceEl.dataset.calibKey;
  div.dataset.tooltipTitle = sourceEl.dataset.tooltipTitle || id.replace(/_/g,' ').toUpperCase();
  div.dataset.tooltipReg = sourceEl.dataset.tooltipReg || '';
  div.dataset.tooltipWhy = (sourceEl.dataset.tooltipWhy || '') + ' Image fallback shown because the badge PNG did not load.';
  ['left','top','width','height','transform','transformOrigin','display'].forEach(prop => {
    if(sourceEl.style[prop]) div.style[prop] = sourceEl.style[prop];
  });
  div.style.display = 'flex';
  return div;
}

function getDynamicOverRibbonBadgeTop(slot, idx=0){
  const liveTopRibbonY = getTopRibbonRowY();
  if(liveTopRibbonY === null) return null;

  const uniformId = getCurrentCalibUniform();
  const refRibbonTop = OVER_RIBBON_REFERENCE_TOP_BY_UNIFORM[uniformId];
  if(refRibbonTop === undefined || refRibbonTop === null) return null;

  const refKey = getOverRibbonReferenceKey(slot, idx);
  if(!refKey) return null;

  const refCalib = getReferenceCalibForKey(uniformId, refKey);
  if(!refCalib || !Number.isFinite(Number(refCalib.y))) return null;

  let verticalOffset = Number(refCalib.y) - Number(refRibbonTop);
  if(slot === 'OLPA') verticalOffset -= 34;
  return Math.round(Number(liveTopRibbonY) + verticalOffset);
}

function getBadgeHeightForLayout(id, slotName=null){
  /*
    Above-ribbon stacking must use the same rendered/calibrated height that the
    badge will actually receive. This keeps the visible bottom gap consistent
    for aviation and occupational badges instead of reserving a larger default
    height and making the badge look too far above the ribbons.
  */
  const uniformId = getCurrentCalibUniform();
  const baseSize = getBadgeRenderSize(id);
  // Regulation-sized badges must not inherit obsolete heights from saved
  // calibration records, or the stacking engine will reserve the old space.
  if(hasFixedBadgeRenderSize(id)) return baseSize.height;

  if(slotName){
    const directKey = `badge:${id}:${slotName}:0`;
    const directCalib = getReferenceCalibForKey(uniformId, directKey) || getCalib(directKey);
    const directHeight = Number(directCalib?.h);
    if(Number.isFinite(directHeight) && directHeight > 0) return directHeight;

    const derivedCalib = buildDerivedBadgeCalib(directKey, {
      w: Number(baseSize.width) || 60,
      h: Number(baseSize.height) || 25
    });
    const derivedHeight = Number(derivedCalib?.h);
    if(Number.isFinite(derivedHeight) && derivedHeight > 0) return derivedHeight;

    const familyKey = getOverRibbonReferenceKey(slotName, 0);
    const familyCalib = familyKey ? getReferenceCalibForKey(uniformId, familyKey) : null;
    const familyHeight = Number(familyCalib?.h);
    if(Number.isFinite(familyHeight) && familyHeight > 0) return familyHeight;
  }

  const explicitHeight = Number(baseSize.height);
  if(Number.isFinite(explicitHeight) && explicitHeight > 0) return explicitHeight;

  return 25;
}

function getPlannedBadgeIdForSlot(slotName){
  return getRenderableBadgeIds().find(id => selectedBadgeWouldRenderInSlot(id, slotName)) || null;
}

function getAboveRibbonStackTops(){
  const liveTopRibbonY = getTopRibbonRowY();
  if(liveTopRibbonY === null) return null;

  // CAPR 39-1 specifies a 1/2-inch gap between the medal/ribbon rack and each
  // successive badge. Convert that physical distance with the shared scale.
  const gap = 0.5 * CAPUB_PIXELS_PER_INCH;
  const orderBottomToTop = ['OLPU','OLP','OLPA'];
  const tops = {};
  let anchorTop = liveTopRibbonY;

  for(const slotName of orderBottomToTop){
    const badgeId = getPlannedBadgeIdForSlot(slotName);
    if(!badgeId) continue;
    const h = getBadgeHeightForLayout(badgeId, slotName);
    const top = Math.round(anchorTop - gap - h);
    tops[slotName] = top;
    // The next badge above uses the same regulation 1/2-inch separation.
    anchorTop = top;
  }

  return tops;
}

function getDynamicBadgeTopFromAppliedPosition(el, id=null, slot=null){
  /*
    Only badges physically stacked above the ribbon rack should move when the
    ribbon rack grows upward. Pocket/name-tag/command badges already have their
    own calibrated coordinates and must not be shifted by ribbon top Y.
  */
  if(!['OLPU','OLP','OLPA'].includes(slot)) return null;

  const liveTopRibbonY = getTopRibbonRowY();
  if(liveTopRibbonY === null) return null;

  const stackTops = getAboveRibbonStackTops();
  if(stackTops && Number.isFinite(stackTops[slot])) return stackTops[slot];

  return null;
}

function getPreferredBadgeSlotForRendering(id, prefs){
  if(State.uniform === 'semi_formal' && CORPORATE_SEMI_FORMAL_SERVICE_BADGE_IDS.has(id)){
    return id === 'national_staff_badge' ? 'RP' : 'LP';
  }
  if(isCommandInsigniaBadge(id)) return getCommandInsigniaSlot();
  if(id === 'nra_marksman_badge') return 'OLPF';
  if(id === 'model_rocketry_badge' || id === 'cyber_badges' || id === 'stem_badges') return getGenderedPocketSlotForBadge(id);
  if(CHAPLAIN_BADGE_IDS.has(id)) return 'OLPA';
  if(AIRCREW_BADGE_IDS.has(id)) return 'OLP';
  if(OLPU_OCCUPATIONAL_BADGE_IDS.has(id)) return 'OLPU';
  if(isSelectableSpecialtyPocketBadge(id)) return getSpecialtyPocketSlotBySelectionOrder(id);
  return prefs?.[0] || 'UN';
}

function slotHasRoom(slot){
  if(!badgeSlots[slot]) badgeSlots[slot] = [];
  // Treat the named categories as physical locations. Most should only hold one item;
  // this prevents the program from stacking unrelated badges in the wrong category.
  const single = new Set(['ORP','OLP','UN','ON','URBP','OLPA','OLPU','LP','RP','LRP','OLPF']);
  if(slot === 'FON') return badgeSlots[slot].length < 2;
  if(single.has(slot)) return badgeSlots[slot].length < 1;
  return badgeSlots[slot].length < 1;
}

function chooseBadgeSlot(id, prefs){
  const preferred = getPreferredBadgeSlotForRendering(id, prefs);

  // Some rules are physical-position rules, not preference lists.
  // If the rule says there is no valid slot, do not fall back into another location.
  if(!preferred) return null;

  if(isCommandInsigniaBadge(id)) return preferred;

  let ordered = [preferred, ...prefs.filter(p => p && p !== preferred)];

  // Flexible specialty badges use custom physical-slot logic.
  if(isSelectableSpecialtyPocketBadge(id)){
    const hasVolunteerUniversity = (State.badges || []).includes('volunteer_university_instructor_badge');
    const activeLpExclusive = getActiveMaleCadetLeftPocketExclusiveBadge();

    if(useFemaleOverNameplateSpecialtyLayout(id)){
      ordered = preferred ? [preferred] : [];
    }else if(GOVERNANCE_SERVICE_BADGE_IDS.has(id)){
      // Governance service badges are fixed to the wearer's left side and may
      // not fall through to the opposite pocket when LP is occupied.
      ordered = preferred ? [preferred] : [];
    }else if(id === 'volunteer_university_instructor_badge'){
      ordered = ['RP'];
    }else if(id === 'cyber_badges' || id === 'stem_badges'){
      // Female Class A: Cyber/STEM are specialty badges in the two-badge FON row.
      // Male cadet blues: they remain left-pocket exclusive.
      ordered = preferred ? [preferred] : [];
    }else if(activeLpExclusive){
      // Model Rocketry/Cyber/STEM occupies LP; bump the flexible specialty badge to RP.
      // If Volunteer University is already in RP, there is no remaining eligible pocket.
      ordered = hasVolunteerUniversity ? [] : ['RP'];
    }else if(hasVolunteerUniversity){
      ordered = ['LP'];
    }else{
      ordered = preferred === 'LP' ? ['LP','RP'] : ['RP','LP'];
    }
  }

  for(const candidate of ordered){
    if(slotHasRoom(candidate)) return candidate;
  }
  return null;
}

function getFemaleSpecialtyBadgeRowIds(){
  return getRenderableFemaleClassASpecialtyBadgeIds();
}

function getFemaleSpecialtyBadgeAnchor(id, bw, bh, W, H){
  const ids = getFemaleSpecialtyBadgeRowIds();
  const index = Math.max(0, ids.indexOf(id));

  // Female Class A patch:
  // Specialty-track badges above the nameplate should be centered on the
  // command badge's centerline whether or not the command badge is selected.
  // A single specialty badge or a two-badge row sits 10px above where the
  // current commander badge would render, and two badges keep 10px between them.
  // Additional technicality: when no commander badge is worn, this over-nameplate
  // specialty row sits .5" above the nameplate, which is approximated here by
  // moving the prior over-nameplate Y anchor 22px lower.
  if(State.gender === 'female' && State.uniform === 'blues_a'){
    const gap = 10;
    const widths = ids.map(badgeId => Number(getBadgeRenderSize(badgeId).width) || bw || 25);
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, ids.length - 1) * gap;
    const prevWidth = widths.slice(0, index).reduce((sum, width) => sum + width, 0) + (gap * index);

    const cmdKey = 'badge:squadron_commander_badge:ON:0';
    const cmdRef = getCalib(cmdKey) || { x: W * 0.32 - 7.5, y: H * 0.30 - 7.5, w: 15, h: 15 };
    const cmdCenterX = Number(cmdRef.x || 0) + (Number(cmdRef.w) || 15) / 2;
    const cmdTop = Number.isFinite(Number(cmdRef.y)) ? Number(cmdRef.y) : (H * 0.30 - 7.5);
    const commanderBadgeIsWorn = (State.badges || []).includes('squadron_commander_badge');
    const baseTop = cmdTop - 10 - bh;

    return {
      x: Math.round((cmdCenterX - totalWidth / 2) + prevWidth),
      y: Math.round(baseTop + (commanderBadgeIsWorn ? 0 : 22))
    };
  }

  // Non-Class-A female fallback behavior.
  const gap = 8;
  const widths = ids.map(badgeId => Number(getBadgeRenderSize(badgeId).width) || bw || 25);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, ids.length - 1) * gap;

  const nameplate = getMeasurementNameplateBox();
  const centerX = nameplate ? nameplate.centerX : W * 0.32;
  const startX = centerX - totalWidth / 2;
  const prevWidth = widths.slice(0, index).reduce((sum, width) => sum + width, 0) + (gap * index);

  let top = null;
  if(hasCurrentCommanderBadgeSelected()){
    const cmdH = Number(getBadgeRenderSize('squadron_commander_badge').height) || 15;
    const baseTop = nameplate ? (nameplate.top - gap - cmdH) : (H * 0.30);
    top = baseTop - gap - bh;
  }else if(nameplate){
    top = nameplate.top - gap - bh;
  }else{
    top = H * 0.30;
  }

  return {
    x: Math.round(startX + prevWidth),
    y: Math.round(top)
  };
}

function getBadgeBaseAnchor(slot, id, idx, W, H, bw, bh){
  const rackX = getTopRibbonRowCenterX() ?? rackCenterX();
  const topRibbonY = getTopRibbonRowY();

  // These are fallback anchors only. Exact calibrated family positions are applied
  // by applyCalibToElement/buildDerivedBadgeCalib when calibration exists.
  const base = {
    OLPA: { x: rackX,  y: topRibbonY !== null ? topRibbonY - (bh + 150) : H * 0.18, dy: 0 },
    OLP:  { x: rackX,  y: topRibbonY !== null ? topRibbonY - (bh + 100) : H * 0.22, dy: 0 },
    OLPU: { x: rackX,  y: topRibbonY !== null ? topRibbonY - (bh + 50)  : H * 0.27, dy: 0 },
    OLPF: { x: W*0.64, y: H*0.50, dy: 0 },

    ORP:  { x: W*0.32, y: H*0.30, dy: 0 },
    ON:   { x: W*0.32, y: H*0.30, dy: 0 },
    UN:   { x: W*0.32, y: H*0.39, dy: 0 },
    URBP: { x: W*0.32, y: H*0.48, dy: 0 },
    // The left-pocket badge shares the award rack's pocket centerline on each
    // uniform instead of using one canvas percentage for dissimilar artwork.
    LP:   { x: rackX, y: H*0.46, dy: 0 },
    RP:   { x: W*0.32, y: H*0.46, dy: 0 },
    LRP:  { x: W*0.64, y: H*0.46, dy: 0 }
  };

  if(slot === 'FON') return getFemaleSpecialtyBadgeAnchor(id, bw, bh, W, H);

  // Field-uniform badges/qualification patch-style items use their own anchors
  // so OCP, ABU, CFU, and flight suit coordinates can be calibrated separately.
  if(isFieldUniform(State.uniform)){
    return getFieldBadgeAnchor(slot, id, idx, W, H, bw, bh);
  }

  const a = base[slot] || base.UN;
  return {
    x: Math.round(a.x - bw/2),
    y: Math.round(a.y - bh/2 + (a.dy || 0) * idx)
  };
}

function getLayerRectFromStyles(el){
  const x = parseFloat(el.style.left);
  const y = parseFloat(el.style.top);
  const w = parseFloat(el.style.width);
  const h = parseFloat(el.style.height);
  if(!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { x, y, w, h, right:x+w, bottom:y+h };
}

function rectOverlapArea(a, b){
  const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

function badgeWouldPhysicallyOverlap(el){
  const rect = getLayerRectFromStyles(el);
  if(!rect) return null;

  const existing = [...uniformCanvas.querySelectorAll('.layer.badge')];
  for(const other of existing){
    const otherRect = getLayerRectFromStyles(other);
    if(!otherRect) continue;

    const overlap = rectOverlapArea(rect, otherRect);
    const smaller = Math.min(rect.w * rect.h, otherRect.w * otherRect.h);

    // Ignore tiny 1-2px edge/canvas rounding contact, but block any real overlap.
    if(overlap > 2 && overlap / Math.max(1, smaller) > 0.03){
      return other;
    }
  }
  return null;
}

function placeBadgeSlotAnchored(id){
  // This used to probe for a hidden preloaded <img id="badges-{id}">, but the
  // node was only ever an existence check - the rendered element is the fresh
  // clone below, with its src resolved by applyBadgeAssetWithFallback(). Ask
  // the id list directly so badge placement does not depend on eager preload.
  if(!KNOWN_BADGE_IDS.has(id)) return false;

  let slotSpec = getBadgeSlotSpec(id);
  if(id === 'nra_marksman_badge') slotSpec = 'OLPF';
  if(id === 'model_rocketry_badge' || id === 'cyber_badges' || id === 'stem_badges'){
    if(isMaleCadetLeftPocketExclusiveBadge(id)){
      slotSpec = 'LP';
    }else if(isFemaleCadetClassAUniform() && (id === 'cyber_badges' || id === 'stem_badges')){
      slotSpec = 'FON';
    }else if(isFemaleCadetClassAUniform() && id === 'model_rocketry_badge' && femaleClassASpecialtyRowIsFull()){
      slotSpec = 'LP';
    }else if(id === 'model_rocketry_badge'){
      slotSpec = 'LP,ON';
    }
  }

  const prefs = parseSlotPrefs(slotSpec);
  const slot = chooseBadgeSlot(id, prefs);
  if(!slot) return false;

  const renderSize = getCanvasRenderSize();
  const W = renderSize.w;
  const H = renderSize.h;

  const sz = getBadgeRenderSize(id);
  const bw = sz.width;
  const bh = sz.height;

  const idx = badgeSlots[slot].length;
  const base = getBadgeBaseAnchor(slot, id, idx, W, H, bw, bh);

  const clone = new Image();
  clone.className = 'layer badge';
  clone.style.display = 'block';
  clone.dataset.calibKey = `badge:${id}:${slot}:${idx}`;

  clone.dataset.tooltipTitle = (id==='squadron_commander_badge' && State.commandInsignia?.graduatedCommander)
    ? 'GRADUATED COMMANDER INSIGNIA'
    : getBadgeDisplayName(id).toUpperCase();
  clone.dataset.tooltipReg = `Badge slot: ${slot}`;
  clone.dataset.tooltipWhy = (id==='squadron_commander_badge')
    ? (State.commandInsignia?.graduatedCommander ? 'Past/graduated command insignia renders under the name tag (UN).' : 'Current command insignia renders over the name tag (ON).')
    : `Rendered in the CAPR 39-1 category ${slot}.`;

  if(isCommandInsigniaBadge(id)) clone.style.zIndex = '30';

  // Corporate Dress and Corporate Semi-Formal wear the miniature governance
  // insignia as a lapel pin. The pin is physically attached to the lapel, so it
  // must remain in front of the cloned lapel foreground (z-index 9000), while
  // ribbons, medals, and every non-lapel badge continue to pass behind it.
  if(isCorporateForegroundLapelPin(id)) clone.style.zIndex = '9010';

  applyCalibToElement(clone, clone.dataset.calibKey, { x: base.x, y: base.y, w: bw, h: bh, r: 0 });

  // Old calibration exports may contain legacy 25/60 px badge dimensions.
  // Keep their calibrated center point, but enforce CAPR 39-1 physical scale.
  if(hasFixedBadgeRenderSize(id)){
    const appliedLeft = parseFloat(clone.style.left);
    const appliedTop = parseFloat(clone.style.top);
    const appliedWidth = parseFloat(clone.style.width);
    const appliedHeight = parseFloat(clone.style.height);
    if([appliedLeft,appliedTop,appliedWidth,appliedHeight].every(Number.isFinite)){
      clone.style.left = `${appliedLeft + (appliedWidth - bw) / 2}px`;
      clone.style.top = `${appliedTop + (appliedHeight - bh) / 2}px`;
    }
    clone.style.width = `${bw}px`;
    clone.style.height = `${bh}px`;
  }

  // FON is a computed two-badge row on the female Class A coat. Historical
  // per-badge calibration entries must not override its shared row geometry;
  // doing so stacks the two specialty badges diagonally/vertically.
  if(slot === 'FON'){
    clone.style.left = `${base.x}px`;
    clone.style.top = `${base.y}px`;
    clone.style.width = `${bw}px`;
    clone.style.height = `${bh}px`;
    clone.style.transform = 'rotate(0deg)';
  }

  // All service-uniform specialty badges use the National Staff badge as the
  // vertical reference. Aligning their top edges (instead of centers) keeps
  // differently proportioned badges visually level and avoids stale per-badge
  // y values from older calibration exports.
  if(isSelectableSpecialtyPocketBadge(id) && id !== 'national_staff_badge' &&
     ['blues_a','blues_b','aviator'].includes(State.uniform) &&
     ['LP','RP','ON','UN','FON'].includes(slot)){
    const referenceTop = getNationalStaffTopForSpecialtySlot(slot);
    if(Number.isFinite(referenceTop)) clone.style.top = `${referenceTop}px`;
  }

  // Above-ribbon badges share the live rack centerline. This prevents stale
  // three-column calibration x-values from putting otherwise correctly sized
  // badges beneath the Class A lapel after the authorized four-column layout
  // moves the rack outboard.
  if(['OLPA','OLP','OLPU'].includes(slot) && !isFieldUniform(State.uniform)){
    const liveRackCenterX = getTopRibbonRowCenterX() ?? rackCenterX();
    clone.style.left = `${liveRackCenterX - bw / 2}px`;
  }

  const dynamicTop = getDynamicBadgeTopFromAppliedPosition(clone, id, slot);
  if(dynamicTop !== null) clone.style.top = `${dynamicTop}px`;

  const conflict = badgeWouldPhysicallyOverlap(clone);
  if(conflict){
    const blockedBy = conflict.dataset?.tooltipTitle || conflict.dataset?.calibKey || 'another badge';
    console.warn(`Badge ${id} was not rendered in ${slot} because it would overlap ${blockedBy}.`);
    return false;
  }

  applyBadgeAssetWithFallback(clone, id);
  uniformCanvas.appendChild(clone);
  badgeSlots[slot].push(id);
  return true;
}

/* ===========================
   FIELD UNIFORM POSITIONING
   =========================== */
const FIELD_UNIFORM_PATCH_LAYOUTS = {
  // Each field uniform has its own independent starting coordinates.
  // These are base defaults only; the calibrator still saves exact final
  // coordinates in separate buckets such as ocp_male, abu_male, and
  // corporate_field_male/female so OCP adjustments do not move ABU or CFU.
  ocp: {
    L_SHOULDER:{x:126,y:206,dy:76},
    R_SHOULDER:{x:324,y:206,dy:76},
    CHEST_LEFT:{x:182,y:328,dy:68},
    CHEST_RIGHT:{x:268,y:328,dy:68}
  },
  abu: {
    L_SHOULDER:{x:122,y:216,dy:76},
    R_SHOULDER:{x:328,y:216,dy:76},
    CHEST_LEFT:{x:178,y:336,dy:68},
    CHEST_RIGHT:{x:272,y:336,dy:68}
  },
  corporate_field: {
    L_SHOULDER:{x:118,y:210,dy:76},
    R_SHOULDER:{x:332,y:210,dy:76},
    CHEST_LEFT:{x:176,y:326,dy:68},
    CHEST_RIGHT:{x:274,y:326,dy:68}
  },
  // CFDU is intentionally separate from CFU so calibration can diverge.
  cfdu: {
    L_SHOULDER:{x:118,y:210,dy:76},
    R_SHOULDER:{x:332,y:210,dy:76},
    CHEST_LEFT:{x:176,y:326,dy:68},
    CHEST_RIGHT:{x:274,y:326,dy:68}
  },
  flight_suit: {
    L_SHOULDER:{x:118,y:205,dy:76},
    R_SHOULDER:{x:332,y:205,dy:76},
    CHEST_LEFT:{x:176,y:320,dy:68},
    CHEST_RIGHT:{x:274,y:320,dy:68}
  }
};

const FIELD_UNIFORM_BADGE_LAYOUTS = {
  // Future-proof field badge/qualification patch anchors. These are separate
  // from blues badge anchors and separate by uniform, matching the patch system.
  ocp: {
    ORP:{x:268,y:328}, ON:{x:268,y:328}, UN:{x:268,y:376}, URBP:{x:268,y:424},
    OLP:{x:182,y:328}, OLPU:{x:182,y:376}, OLPA:{x:182,y:280}, LP:{x:182,y:396}, RP:{x:268,y:396}, OLPF:{x:182,y:430}
  },
  abu: {
    ORP:{x:272,y:336}, ON:{x:272,y:336}, UN:{x:272,y:384}, URBP:{x:272,y:432},
    OLP:{x:178,y:336}, OLPU:{x:178,y:384}, OLPA:{x:178,y:288}, LP:{x:178,y:404}, RP:{x:272,y:404}, OLPF:{x:178,y:438}
  },
  corporate_field: {
    ORP:{x:274,y:326}, ON:{x:274,y:326}, UN:{x:274,y:374}, URBP:{x:274,y:422},
    OLP:{x:176,y:326}, OLPU:{x:176,y:374}, OLPA:{x:176,y:278}, LP:{x:176,y:394}, RP:{x:274,y:394}, OLPF:{x:176,y:428}
  },
  // CFDU is intentionally separate from CFU so badge/qualification calibration can diverge.
  cfdu: {
    ORP:{x:274,y:326}, ON:{x:274,y:326}, UN:{x:274,y:374}, URBP:{x:274,y:422},
    OLP:{x:176,y:326}, OLPU:{x:176,y:374}, OLPA:{x:176,y:278}, LP:{x:176,y:394}, RP:{x:274,y:394}, OLPF:{x:176,y:428}
  },
  flight_suit: {
    ORP:{x:274,y:320}, ON:{x:274,y:320}, UN:{x:274,y:368}, URBP:{x:274,y:416},
    OLP:{x:176,y:320}, OLPU:{x:176,y:368}, OLPA:{x:176,y:272}, LP:{x:176,y:388}, RP:{x:274,y:388}, OLPF:{x:176,y:422}
  }
};

function getFieldUniformLayoutKey(uniformId = State.uniform){
  return normalizeFieldUniformRenderKey(uniformId);
}

function getFieldPatchAnchor(slot, idx, meta, W, H){
  const uniformKey = getFieldUniformLayoutKey();
  const uniformLayout = FIELD_UNIFORM_PATCH_LAYOUTS[uniformKey] || FIELD_UNIFORM_PATCH_LAYOUTS.ocp;
  const anchor = uniformLayout?.[slot] || FIELD_UNIFORM_PATCH_LAYOUTS.ocp.L_SHOULDER;
  const w = Number(meta?.w) || 70;
  const h = Number(meta?.h) || 70;
  return {
    x: Math.round(Number(anchor.x) - w / 2),
    y: Math.round(Number(anchor.y) - h / 2 + (Number(anchor.dy) || 0) * idx),
    w,
    h,
    r: Number(anchor.r) || 0
  };
}

function getFieldBadgeAnchor(slot, id, idx, W, H, bw, bh){
  const uniformKey = getFieldUniformLayoutKey();
  const uniformLayout = FIELD_UNIFORM_BADGE_LAYOUTS[uniformKey] || FIELD_UNIFORM_BADGE_LAYOUTS.ocp;
  const anchor = uniformLayout?.[slot] || uniformLayout?.UN || FIELD_UNIFORM_BADGE_LAYOUTS.ocp.UN;
  return {
    x: Math.round(Number(anchor.x) - bw / 2),
    y: Math.round(Number(anchor.y) - bh / 2 + (Number(anchor.dy) || 0) * idx),
    r: Number(anchor.r) || 0
  };
}

/* ===========================
   PATCHES (RENDER)
   =========================== */
const patchSlots = { L_SHOULDER:[], R_SHOULDER:[], CHEST_LEFT:[], CHEST_RIGHT:[] };
function resetPatchSlots(){ Object.keys(patchSlots).forEach(k=>patchSlots[k]=[]); }

function planPatches(ids){
  resetPatchSlots();
  const capsPerUniform = {
    blues_a:{L_SHOULDER:1,R_SHOULDER:1,CHEST_LEFT:1,CHEST_RIGHT:1},
    blues_b:{L_SHOULDER:1,R_SHOULDER:1,CHEST_LEFT:1,CHEST_RIGHT:1},
    aviator:{L_SHOULDER:1,R_SHOULDER:1,CHEST_LEFT:1,CHEST_RIGHT:1},
    aviator_blazer:{L_SHOULDER:1,R_SHOULDER:1,CHEST_LEFT:0,CHEST_RIGHT:0},
    corporate_field:{L_SHOULDER:2,R_SHOULDER:2,CHEST_LEFT:1,CHEST_RIGHT:1},
    abu:{L_SHOULDER:2,R_SHOULDER:2,CHEST_LEFT:1,CHEST_RIGHT:1},
    ocp:{L_SHOULDER:2,R_SHOULDER:2,CHEST_LEFT:1,CHEST_RIGHT:1},
    flight_suit:{L_SHOULDER:2,R_SHOULDER:2,CHEST_LEFT:2,CHEST_RIGHT:2},
    semi_formal:{L_SHOULDER:0,R_SHOULDER:0,CHEST_LEFT:0,CHEST_RIGHT:0},
    mess_dress:{L_SHOULDER:0,R_SHOULDER:0,CHEST_LEFT:0,CHEST_RIGHT:0},
    polo:{L_SHOULDER:0,R_SHOULDER:0,CHEST_LEFT:0,CHEST_RIGHT:0}
  }[State.uniform] || {L_SHOULDER:1,R_SHOULDER:1,CHEST_LEFT:1,CHEST_RIGHT:1};

  const plannedIds = [];
  const selectedUnitPatchId = (typeof getSelectedUnitPatchId === 'function') ? getSelectedUnitPatchId() : null;
  if(selectedUnitPatchId && isPatchAuthorizedForUniform(selectedUnitPatchId)){
    plannedIds.push(selectedUnitPatchId);
  }
  (ids || []).forEach(id => {
    if(id && id !== selectedUnitPatchId) plannedIds.push(id);
  });

  for(const id of plannedIds){
    if(FIELD_BASE_BUILT_IN_PATCH_IDS.has(id)) continue;
    const meta=PATCH_META[id]; if(!meta) continue;
    if(!isPatchAuthorizedForUniform(id)) continue;
    const hint=meta.slotHint || 'L_SHOULDER';
    const cap=capsPerUniform[hint]??0;
    if(cap===0) continue;
    if(patchSlots[hint].length>=cap) continue;
    patchSlots[hint].push(id);
  }
}

function renderPatches(){
  [...uniformCanvas.querySelectorAll('.layer.patch')].forEach(n=>n.remove());
  if(!UI_AUTHZ[State.uniform]?.showPatches) return;

  planPatches(State.patches);

  const renderSize = getCanvasRenderSize();
  const W = renderSize.w;
  const H = renderSize.h;

  for(const slot of Object.keys(patchSlots)){
    const ids=patchSlots[slot];
    for(let idx=0; idx<ids.length; idx++){
      const id = ids[idx];
      if(FIELD_BASE_BUILT_IN_PATCH_IDS.has(id)) continue;
      const meta=PATCH_META[id];
      const src = by('patch-'+id);
      const el  = (src?src.cloneNode():new Image());
      if(!src){ el.src=ASSET(meta.img); }

      el.className='layer patch';
      el.style.display='block';

      const fieldUniformKey = getFieldUniformLayoutKey();
      const isOcpUnitSleeveSprite = fieldUniformKey === 'ocp'
        && id === 'tn185_ocp_patch'
        && slot === 'R_SHOULDER';
      // The OCP unit-patch image is a composite sprite: its complete patch
      // belongs on the detached right-sleeve view while its cropped copy lines
      // up with the sleeve on the torso artwork. It therefore needs the
      // mirrored sleeve-sprite origin, not the generic shoulder center anchor.
      const base = isOcpUnitSleeveSprite
        ? {x:70, y:212, w:200, h:100, r:0}
        : getFieldPatchAnchor(slot, idx, meta, W, H);

      // Keep each field uniform independent. A patch calibrated on OCP will save
      // under ocp_male/ocp_female and will not reuse ABU or CFU coordinates.
      // V2 prevents previously saved generic-anchor coordinates from moving
      // the OCP unit sprite back across the name tape and chest.
      el.dataset.calibKey = isOcpUnitSleeveSprite
        ? `patchRegV2:${id}:${slot}:${idx}`
        : `patch:${id}:${slot}:${idx}`;
      applyCalibToElement(el, el.dataset.calibKey, base);

      el.onerror=()=>{};

      el.dataset.tooltipTitle = (PATCH_META[id]?.label || id.replace(/_/g,' ')).toUpperCase();
      el.dataset.tooltipReg   = "Field/utility patch placement";
      el.dataset.tooltipWhy   = "Displayed on sleeve/chest per field uniform rules.";

      uniformCanvas.appendChild(el);
    }
  }
}

/* ===========================
   AVAILABILITY / ALTERNATES
   =========================== */
function updateAvailabilityUI(prevUniform){
  const auth = UI_AUTHZ[State.uniform] || {showRibbons:true,showPatches:true,showBadges:true};
  by('groupRibbons').classList.toggle('hidden', !auth.showRibbons && !UNIFORMS[State.uniform].mini);
  by('groupBadges').classList.toggle('hidden', !auth.showBadges);
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

function clearMeasurementOverlay(){
  uniformCanvas.querySelectorAll('.measurementOverlay,.measurementArrowLayer').forEach(n=>n.remove());
}

function getMeasurementRibbonRackBox(){
  const ribbonEls = [...uniformCanvas.querySelectorAll('.layer.ribbonTile,.layer.ribbonMini')];
  if(!ribbonEls.length) return null;

  const left = Math.min(...ribbonEls.map(el => parseFloat(el.style.left) || 0));
  const top = Math.min(...ribbonEls.map(el => parseFloat(el.style.top) || 0));
  const right = Math.max(...ribbonEls.map(el => (parseFloat(el.style.left) || 0) + (parseFloat(el.style.width) || 0)));
  const bottom = Math.max(...ribbonEls.map(el => (parseFloat(el.style.top) || 0) + (parseFloat(el.style.height) || 0)));

  return {
    kind:'ribbonRack',
    slot:'RIBBONS',
    label:'Ribbon Rack',
    left, top, right, bottom,
    centerX:(left + right) / 2,
    centerY:(top + bottom) / 2
  };
}

function parseRenderedBadgeMeta(el){
  const key = el.dataset?.calibKey || '';
  const m = key.match(/^badge:(.*?):([A-Z]+):(\d+)$/);
  const left = parseFloat(el.style.left) || 0;
  const top = parseFloat(el.style.top) || 0;
  const width = parseFloat(el.style.width) || el.naturalWidth || 0;
  const height = parseFloat(el.style.height) || el.naturalHeight || 0;
  return {
    kind:'badge',
    id: m?.[1] || '',
    slot: m?.[2] || '',
    idx: Number(m?.[3] || 0),
    label: el.dataset?.tooltipTitle || m?.[1] || 'Badge',
    left,
    top,
    right:left + width,
    bottom:top + height,
    centerX:left + width/2,
    centerY:top + height/2,
    width,
    height
  };
}

function rangesOverlap(a1, a2, b1, b2){
  return Math.min(a2, b2) - Math.max(a1, b1);
}

function getMeasurementNameplateBox(){
  const nameplateEl = [...uniformCanvas.querySelectorAll('.layer')]
    .find(el => {
      const key = String(el.dataset?.calibKey || '').toLowerCase();
      return key.includes(':nameplate') || el.classList.contains('nameplate');
    });

  if(nameplateEl){
    const left = parseFloat(nameplateEl.style.left) || 0;
    const top = parseFloat(nameplateEl.style.top) || 0;
    const width = parseFloat(nameplateEl.style.width) || nameplateEl.offsetWidth || 72;
    const height = parseFloat(nameplateEl.style.height) || nameplateEl.offsetHeight || 14;
    return {
      kind:'nameplate',
      slot:'NAMEPLATE',
      id:'nameplate',
      idx:0,
      label:'Nameplate',
      left,
      top,
      right:left + width,
      bottom:top + height,
      centerX:left + width/2,
      centerY:top + height/2,
      width,
      height
    };
  }

  // Fallback reference point for blues uniforms when the placeholder nameplate text
  // is not currently rendered. This keeps the requested measurement lines available
  // for calibration and follows the same default geometry used by the generated
  // nameplate text layer.
  if(['blues_a','blues_b','aviator','aviator_blazer'].includes(State.uniform)){
    const renderSize = getCanvasRenderSize();
    const W = renderSize.w;
    const H = renderSize.h;
    const key = `text:${State.uniform}:nameplate`;
    const fallbackWidth = 72;
    // The nameplate is on the wearer's right side, opposite the ribbon rack.
    // Store x as the left edge so centerX lands on the same 32% centerline used
    // by ON/UN/RP badge anchors.
    const fallback = {
      x:(W*.32) - (fallbackWidth/2),
      y:H*.345,
      w:fallbackWidth,
      h:14,
      r:0,
      ...(getCalib(key) || {})
    };
    const left = Number(fallback.x) || 0;
    const top = Number(fallback.y) || 0;
    const width = Number(fallback.w) || 72;
    const height = Number(fallback.h) || 14;
    return {
      kind:'nameplate',
      slot:'NAMEPLATE',
      id:'nameplate',
      idx:0,
      label:'Nameplate',
      left,
      top,
      right:left + width,
      bottom:top + height,
      centerX:left + width/2,
      centerY:top + height/2,
      width,
      height
    };
  }

  return null;
}

function getMeasurementRenderableItems(){
  const items = [];
  const ribbonBox = getMeasurementRibbonRackBox();
  if(ribbonBox) items.push(ribbonBox);

  const nameplateBox = getMeasurementNameplateBox();
  if(nameplateBox) items.push(nameplateBox);

  const badgeEls = [...uniformCanvas.querySelectorAll('.layer.badge')];
  badgeEls.forEach(el => items.push(parseRenderedBadgeMeta(el)));

  return items;
}

function getCaprReferenceGapLabel(upper, lower){
  const aboveRibbonSlots = new Set(['OLPU','OLP','OLPA']);
  const leftPocketSlots = new Set(['LP','LRP','OLPF']);
  const belowNameplateSlots = new Set(['RP','UN','URBP']);

  if(!upper || !lower) return '';

  // CAPR 39-1 references used by this overlay:
  // - 0.50" from the highest ribbon to the first occupational/above-ribbon badge
  // - 1.50" from the bottom of the ribbon rack to the next below-ribbon badge
  if(lower.kind === 'ribbonRack' && aboveRibbonSlots.has(upper.slot)) return '0.50"';
  if(State.uniform === 'blues_a' && upper.kind === 'ribbonRack' && leftPocketSlots.has(lower.slot)) return '1.50"';
  if(State.uniform === 'blues_a' && upper.kind === 'nameplate' && belowNameplateSlots.has(lower.slot)) return '1.50"';
  if(aboveRibbonSlots.has(upper.slot) && aboveRibbonSlots.has(lower.slot)) return '0.50"';
  return '';
}

function buildMeasurementArrowKey(upper, lower){
  const upperToken = upper?.slot || upper?.kind || 'item';
  const lowerToken = lower?.slot || lower?.kind || 'item';
  const lowerId = lower?.id || lower?.slot || lower?.kind || 'item';
  const lowerIdx = Number.isFinite(Number(lower?.idx)) ? Number(lower.idx) : 0;
  return `arrow:${upperToken}:to:${lowerToken}:${lowerId}:${lowerIdx}`;
}

function getDynamicArrowCalibration(arrowKey, base){
  // Arrows are derived annotations, not uniform assets. Legacy calibration
  // exports contain absolute arrow boxes which become stale whenever a badge,
  // ribbon rack, gender, uniform, or preview size changes. Always use the live
  // item edges so both arrowheads remain attached to what they measure.
  return { ...base };
}

function makeMeasurementArrow(svgUnused, arrowKey, x1, y1, x2, y2, label, placeLeft=false){
  if(![x1,y1,x2,y2].every(Number.isFinite)) return;

  const renderSize = getCanvasRenderSize();
  const baseLine = { x1, y1, x2, y2 };

  const wrap = document.createElement('div');
  wrap.className = 'layer measurementArrowLayer';
  wrap.dataset.calibKey = arrowKey;
  wrap.dataset.dynamicArrowBase = JSON.stringify(baseLine);
  wrap.dataset.tooltipTitle = 'Measurement Arrow';
  wrap.dataset.tooltipReg = 'Dynamic calibration item';
  wrap.dataset.tooltipWhy = 'This arrow recalculates from the current badge and ribbon edges.';

  wrap.style.left = '0px';
  wrap.style.top = '0px';
  wrap.style.width = `${renderSize.w}px`;
  wrap.style.height = `${renderSize.h}px`;
  wrap.style.transform = 'none';

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${renderSize.w} ${renderSize.h}`);
  svg.setAttribute('preserveAspectRatio', 'none');

  const markerId = `capubArrowHead_${arrowKey.replace(/[^a-zA-Z0-9_-]/g,'_')}`;
  const defs = document.createElementNS(NS, 'defs');
  const marker = document.createElementNS(NS, 'marker');
  marker.setAttribute('id', markerId);
  marker.setAttribute('markerWidth', '4');
  marker.setAttribute('markerHeight', '4');
  marker.setAttribute('refX', '2');
  marker.setAttribute('refY', '2');
  marker.setAttribute('orient', 'auto-start-reverse');

  const arrowPath = document.createElementNS(NS, 'path');
  arrowPath.setAttribute('d', 'M 0 0 L 4 2 L 0 4 z');
  arrowPath.setAttribute('fill', '#c1121f');
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const line = document.createElementNS(NS, 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('x2', x2);
  line.setAttribute('y1', y1);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', '#c1121f');
  line.setAttribute('stroke-width', '1.35');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  line.setAttribute('marker-start', `url(#${markerId})`);
  line.setAttribute('marker-end', `url(#${markerId})`);
  svg.appendChild(line);

  if(label){
    const text = document.createElementNS(NS, 'text');
    const middleX = (x1 + x2) / 2;
    const middleY = (y1 + y2) / 2;
    text.setAttribute('x', placeLeft ? middleX - 7 : middleX + 7);
    text.setAttribute('y', Math.max(10, middleY - 3));
    text.setAttribute('text-anchor', placeLeft ? 'end' : 'start');
    text.textContent = label;
    svg.appendChild(text);
  }

  wrap.appendChild(svg);
  uniformCanvas.appendChild(wrap);
}

function renderMeasurementOverlay(){
  clearMeasurementOverlay();
  if(!State.showMeasurementOverlay) return;

  const items = getMeasurementRenderableItems()
    .filter(Boolean)
    .filter(item => item.kind !== 'ribbon')
    .filter(item => Number.isFinite(item.top) && Number.isFinite(item.bottom) && Number.isFinite(item.centerX));

  if(items.length < 2) return;

  const canvasWidth = getCanvasRenderSize().w;
  const clampArrowX = x => Math.max(18, Math.min(canvasWidth - 18, x));
  const ribbonRack = items.find(item => item.kind === 'ribbonRack') || null;
  const nameplate = items.find(item => item.kind === 'nameplate') || null;
  const classALeftPocketSlots = new Set(['LP','LRP','OLPF']);
  const classABelowNameplateSlots = new Set(['RP','UN','URBP']);

  const verticalGap = (upper, lower) => lower.top - upper.bottom;
  const horizontalOverlap = (a, b) => Math.max(0, rangesOverlap(a.left, a.right, b.left, b.right));
  const centerDistance = (a, b) => Math.abs((a.centerX || 0) - (b.centerX || 0));

  function isRibbonRackRelated(a, b){
    return a?.kind === 'ribbonRack' || b?.kind === 'ribbonRack';
  }

  function requiredClassAUpper(lower){
    if(State.uniform !== 'blues_a' || lower?.kind !== 'badge') return null;
    if(ribbonRack && classALeftPocketSlots.has(lower.slot)) return ribbonRack;
    if(nameplate && classABelowNameplateSlots.has(lower.slot) && nameplate.bottom <= lower.top) return nameplate;
    return null;
  }

  function shouldMeasurePair(upper, lower){
    if(!upper || !lower || upper === lower) return false;
    if(verticalGap(upper, lower) <= 0) return false;

    // Always allow direct ribbon-rack adjacency, but only to badges/items in
    // the same general column.
    if(isRibbonRackRelated(upper, lower)){
      return horizontalOverlap(upper, lower) > 0 || centerDistance(upper, lower) <= 85;
    }

    // For normal stacked items, prefer same-column items. This prevents lines
    // randomly jumping across the jacket while still allowing slightly offset
    // badges to be measured.
    return horizontalOverlap(upper, lower) > 0 || centerDistance(upper, lower) <= 55;
  }

  function bestUpperFor(lower){
    const candidates = items
      .filter(upper => upper !== lower)
      .filter(upper => upper.bottom <= lower.top)
      .filter(upper => shouldMeasurePair(upper, lower))
      .map(upper => ({
        upper,
        gap: verticalGap(upper, lower),
        overlap: horizontalOverlap(upper, lower),
        centerDelta: centerDistance(upper, lower)
      }))
      .filter(entry => entry.gap > 0);

    if(!candidates.length) return null;

    candidates.sort((a, b) => {
      // The nearest item above is usually the correct measurement target.
      if(a.gap !== b.gap) return a.gap - b.gap;

      // If gaps tie, prefer the one that overlaps horizontally.
      const aOverlapScore = a.overlap > 0 ? 0 : 1;
      const bOverlapScore = b.overlap > 0 ? 0 : 1;
      if(aOverlapScore !== bOverlapScore) return aOverlapScore - bOverlapScore;

      return a.centerDelta - b.centerDelta;
    });

    return candidates[0].upper;
  }

  const drawn = new Set();

  for(const lower of items){
    // Class A pocket measurements use their prescribed reference item even if
    // another nearby badge would otherwise win the generic nearest-item rule.
    const upper = requiredClassAUpper(lower) || bestUpperFor(lower);
    if(!upper) continue;

    const gap = verticalGap(upper, lower);
    if(gap < 3) continue;

    const pairId = `${upper.kind}:${upper.slot}:${upper.id}:${upper.idx}->${lower.kind}:${lower.slot}:${lower.id}:${lower.idx}`;
    if(drawn.has(pairId)) continue;
    drawn.add(pairId);

    const label = getCaprReferenceGapLabel(upper, lower); // label only when a known CAPR reference applies
    // Edge-to-edge measurement: start at the absolute bottom-center of the
    // ribbon rack/nameplate and finish at the badge's exact top-center.
    const x1 = clampArrowX(upper.centerX);
    const x2 = clampArrowX(lower.centerX);
    const placeLeft = ((x1 + x2) / 2) > (canvasWidth * 0.7);
    const arrowKey = buildMeasurementArrowKey(upper, lower);

    makeMeasurementArrow(null, arrowKey, x1, upper.bottom, x2, lower.top, label, placeLeft);
  }
}


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


function buildVariableMedalRowGeometry(entries,{holding=false,overlapPixels=0,suspensionRatio=(116/176)}={}){
  const widths=entries.map(item=>Math.max(.01,Number(item.size.w) || 1));
  const heights=entries.map(item=>Math.max(.01,Number(item.size.h) || 1));
  const offsets=[];
  let cursor=0;
  for(let index=0;index<entries.length;index++){
    offsets.push(cursor);
    if(index===entries.length-1) continue;
    let overlap=0;
    if(holding && entries.length>4){
      const naturalWidth=widths.reduce((sum,width)=>sum+width,0);
      const targetWidth=Math.max(...widths)*4;
      const desired=Math.max(0,(naturalWidth-targetWidth)/(entries.length-1));
      overlap=Math.min(desired,Math.min(widths[index],widths[index+1])*.5);
    }else if(overlapPixels>0){
      overlap=Math.min(overlapPixels,Math.min(widths[index],widths[index+1])*.5);
    }
    cursor+=widths[index]-overlap;
  }
  return {
    entries,
    offsets,
    rowWidth:(offsets.at(-1) || 0)+(widths.at(-1) || 0),
    slotHeight:Math.max(1,...heights),
    suspensionHeight:Math.max(1,...heights.map(height=>height*suspensionRatio))
  };
}

function getCalibratedLayerGeometry(key,base){
  const saved=getCalib(key) || {};
  return {
    x:saved.x!==undefined ? normalizeCalibNumber(saved.x,base.x || 0) : base.x,
    y:saved.y!==undefined ? normalizeCalibNumber(saved.y,base.y || 0) : base.y,
    w:saved.w!==undefined ? Math.max(.01,normalizeCalibNumber(saved.w,base.w || 1)) : base.w,
    h:saved.h!==undefined ? Math.max(.01,normalizeCalibNumber(saved.h,base.h || 1)) : base.h,
    r:saved.r!==undefined ? normalizeCalibNumber(saved.r,base.r || 0) : (base.r || 0)
  };
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


function fullRender(prevUniform){
  if(garmentMaskEditor.active) closeGarmentMaskEditor(false,false);
  uniformCanvas.style.background='';
  applyPreviewRenderArea();
  clearLayers();
  clearMeasurementOverlay();
  applyJacket();

  if(!getBaseCandidates().length) return;

  updateAvailabilityUI(prevUniform);
  renderPatches();
  renderRack();
  renderAllBadges();
  renderMeasurementOverlay();
}

function refreshUI(){
  membershipTypeEl.value = State.membership || '';
  rankSetupSelect.value = State.rank || '';
  jacketSelect.value = State.gender || '';
  if(garmentOverlaySelect) garmentOverlaySelect.value = ['both','left','right','off'].includes(State.garmentOverlayMode)
    ? State.garmentOverlayMode
    : 'both';
  syncGarmentMaskStatus();
  if(assetBaseInput) assetBaseInput.value=State.assetBase;
  const overlayToggle = by('toggleMeasurementOverlay');
  if(overlayToggle) overlayToggle.checked = !!State.showMeasurementOverlay;
  const miniStyleControl = by('miniMountStyle');
  if(miniStyleControl) miniStyleControl.value = State.miniMountStyle === 'holding' ? 'holding' : 'mounting';
  syncRibbonRackColumnsControl();
  syncCadetFirstSergeantControl();

  highlightActiveUniformButton();
  applyMemberTypeToUniformOptions();

}
