// Badge rules the pickers and the validator share: which badges belong to which Attachment 4
// family and position, the command insignia, specialty-track precedence and the badge count.
// (The uniform engine in js/engine places the badges; these only describe and count them.)

const AIRCREW_BADGE_IDS = new Set([
  'AirCrew1_DB3F0FCC3650F','SeniorAirCrew1_B289BAE6E515C','MasterAirCrew1_72AC4CAE7A310',
  'CAPPilot1_FA9D33EA587D8','CAPSeniorPilot1_D9725AE959752','CAPMasterPilot1_621A0E2ED15DA',
  'GliderPilot1_7BFB287379918','BalloonPilot1_442D89C94185B',
  'observer_badge','SeniorObserver1_0E35802A29801','MasterObserver1_1B88D5071FD5C',
  'solo_badge','pre_solo_badge',
  'uas_pilot_basic_badge','uas_pilot_senior_badge','uas_pilot_master_badge',
  'uas_technician_basic_badge','uas_technician_senior_badge','uas_technician_master_badge'
]);

// CAPR 39-1 Attachment 4 badge-position categories.
// OLP = over left pocket, OLPA = over left pocket above aviation,
// OLPU = over left pocket under aviation, ON/UN = over/under name tag,
// LP/RP = on pocket, ORP = over right pocket, OLPF = on left pocket flap.
const CHAPLAIN_BADGE_IDS = new Set([
  'buddist_chaplin','christian_chaplin','jewish_chaplin','muslim_chaplin'
]);
const GROUND_EMT_BADGE_IDS = new Set([
  'ground_team_basic_badge','senior_ground_team_badge','master_ground_team_badge',
  'emt_basic_badge','emt_intermediate','emt_paramedic'
]);
const OLPU_OCCUPATIONAL_BADGE_IDS = new Set([
  ...GROUND_EMT_BADGE_IDS,
  'medical_officer','nurse_officer','legal_officer',
  'basic_incident_commander_badge','incident_commander_2_badge','incident_commander_1_badge'
]);
const GOVERNANCE_SERVICE_BADGE_IDS = new Set([
  'senior_advisory_group_badge',
  'command_council_badge',
  'national_executive_committee_badge',
  'cap_national_command_board_badge',
  'national_staff_badge'
]);
const NATIONAL_STAFF_PRECEDENCE_EXCEPTIONS = new Set([
  'command_council_badge',
  'senior_advisory_group_badge'
]);

function getSpecialtySelectionPrecedence(id){
  if(NATIONAL_STAFF_PRECEDENCE_EXCEPTIONS.has(id)) return 0;
  if(id === 'national_staff_badge') return 1;
  return 2;
}

function applySpecialtySelectionPrecedence(ids){
  const source = Array.isArray(ids) ? [...ids] : [];
  const specialty = source
    .filter(id => SPECIALTY_TRACK_BADGE_IDS.has(id))
    .map((id, index) => ({ id, index }))
    .sort((a, b) => getSpecialtySelectionPrecedence(a.id) - getSpecialtySelectionPrecedence(b.id) || a.index - b.index)
    .map(item => item.id);
  let specialtyIndex = 0;
  return source.map(id => SPECIALTY_TRACK_BADGE_IDS.has(id) ? specialty[specialtyIndex++] : id);
}
const SPECIALTY_TRACK_BADGE_IDS = new Set([
  ...GOVERNANCE_SERVICE_BADGE_IDS,
  'emergency_services_badge','senior_emergency_services_badge','master_emergency_services_badge',
  'communications_technician_badge','communications_senior_badge','communications_master_badge',
  'information_technology_technician_badge','historian_technicianIbadge',
  'administration_technician_badge','administration_senior_badge','administration_master_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge','finance_senior_badge','finance_master_badge',
  'cyber_badges','stem_badges','volunteer_university_instructor_badge','cadet_programs_badge','cadet_programs_technician_badge','cadet_programs_senior_badge','cadet_programs_master_badge','administration_technician_badge','administration_senior_badge','administration_master_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge','finance_senior_badge','finance_master_badge',
  'administration_technician_badge','administration_senior_badge','administration_master_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge','finance_senior_badge','finance_master_badge'
]);
const POCKET_SERVICE_BADGE_IDS = new Set([
  ...SPECIALTY_TRACK_BADGE_IDS
]);
// Only these may take the CAP Crest's place on the corporate blazer (4.2.3.1.1.1). The National Staff
// badge may not: Attachment 4 marks it not authorized on the Corporate Service Dress.
const CORPORATE_SEMI_FORMAL_SERVICE_BADGE_IDS = new Set([
  'senior_advisory_group_badge',
  'command_council_badge',
  'national_executive_committee_badge',
  'cap_national_command_board_badge'
]);

const CAPUB_CADET_PROGRAMS_RATED_BADGE_IDS = new Set([
  'cadet_programs_badge',
  'cadet_programs_technician_badge',
  'cadet_programs_senior_badge',
  'cadet_programs_master_badge'
]);

function isBadgeAuthorizedOnCurrentDressUniform(id){
  // A uniform that names the badge families it authorizes (the polo, 5.3.1.1, 5.3.2.1.1) wears no other.
  const family = window.CAPUBBadgeCatalog?.family(id);
  if(family && !CAPUBUniformRules.allowsBadgeFamily(State.uniform, family)) return false;
  // The Corporate Service Dress (4.2.3.1.1.3) and the Corporate Semi-Formal, which carries its rules
  // forward (4.2.1, 4.2.2): the chaplain insignia and the listed service-badge substitutes for the
  // pocket CAP crest are the only badges worn on them.
  if(!CAPUBUniformRules.allowsOnlyChaplainBadge(State.uniform)) return true;
  return CHAPLAIN_BADGE_IDS.has(id) || CORPORATE_SEMI_FORMAL_SERVICE_BADGE_IDS.has(id);
}

// Whether the selected uniform wears this badge at all (LIVE13 E67, Ethan: "when someone is selecting on a uniform, it should only show
// the badges applicable. like for ABU's, the ES specialty track badges shouldn't apply"): by its Attachment 4 family and, on the field
// uniforms and the polo, by its having genuine field artwork (data/uniform-rules.js BADGE_WEAR, isBadgeWornOn; Ethan's LIVE-FIELD B6).
// The Badges picker lists only these. A badge the uniform does not wear stays selected (the member may switch uniforms back); it is
// not offered or drawn there, and the panel counts it (capubBadgesNotWornLine). The aviator blazer with the shirt beside it offers
// the shirt's badges too, as the engine draws them on that shirt.
function capubBadgeWearOptions(){
  return { underlayer: (State.garment && State.garment.underlayer) || 'shirt' };
}
function isBadgeWornOnCurrentUniform(id, uniformId = State.uniform){
  const badge = window.CAPUBBadgeCatalog?.get(id);
  if(!badge || !window.CAPUBUniformRules?.isBadgeWornOn) return true;
  return CAPUBUniformRules.isBadgeWornOn(uniformId, { id, family: badge.family, field: badge.field }, capubBadgeWearOptions());
}
// The member's selected badges (eligible for the membership) that the selected uniform does not wear, in selection order.
function getSelectedBadgesNotWornOnCurrentUniform(ids = State.badges){
  return [...new Set(ids || [])]
    .filter(id => typeof isBadgeEligibleForMembership !== 'function' || isBadgeEligibleForMembership(id, State.membership))
    .filter(id => !isBadgeWornOnCurrentUniform(id));
}
// The one line the Badges panel shows: "2 selected badges are not worn on this uniform (CAPR 39-1, ...)", or '' when none.
function capubBadgesNotWornLine(ids = State.badges){
  const n = getSelectedBadgesNotWornOnCurrentUniform(ids).length;
  if(!n) return '';
  const wear = window.CAPUBUniformRules?.badgeWear(State.uniform, capubBadgeWearOptions());
  const where = wear ? ` (CAPR 39-1, ${wear.ref}${wear.fieldArt ? '; genuine field artwork only' : ''})` : '';
  return `${n} selected badge${n === 1 ? ' is' : 's are'} not worn on this uniform${where}.`;
}

// Specialty/occupational badge visual families. These let one calibrated badge zone
// carry over to similar badges without forcing every badge to use the same dimensions.
const ES_POCKET_BADGE_IDS = new Set([
  'emergency_services_badge','senior_emergency_services_badge','master_emergency_services_badge'
]);
const SMALL_RIGHT_POCKET_SPECIALTY_BADGE_IDS = new Set([
  'communications_technician_badge','communications_senior_badge','communications_master_badge',
  'information_technology_technician_badge','historian_technicianIbadge',
  'administration_technician_badge','administration_senior_badge','administration_master_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge','finance_senior_badge','finance_master_badge'
]);
const LARGE_RIGHT_POCKET_SPECIALTY_BADGE_IDS = new Set([
  'volunteer_university_instructor_badge','cadet_programs_badge','cadet_programs_technician_badge','cadet_programs_senior_badge','cadet_programs_master_badge'
]);
const UNDER_NAMEPLATE_SPECIALTY_BADGE_IDS = new Set([
  ...SMALL_RIGHT_POCKET_SPECIALTY_BADGE_IDS,
  ...LARGE_RIGHT_POCKET_SPECIALTY_BADGE_IDS
]);
const FEMALE_OVER_NAMEPLATE_SPECIALTY_BADGE_IDS = new Set([
  'emergency_services_badge','senior_emergency_services_badge','master_emergency_services_badge',
  'communications_technician_badge','communications_senior_badge','communications_master_badge',
  'information_technology_technician_badge','historian_technicianIbadge',
  'administration_technician_badge','administration_senior_badge','administration_master_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge','finance_senior_badge','finance_master_badge',
  'cadet_programs_badge','cadet_programs_technician_badge','cadet_programs_senior_badge','cadet_programs_master_badge',
  // Female cadet-specific specialty badges. These are limited to the two-badge
  // specialty row above the nameplate on the female Class A uniform.
  'cyber_badges','stem_badges'
]);
const INCIDENT_COMMAND_SPECIALTY_BADGE_IDS = new Set([
  'basic_incident_commander_badge','incident_commander_2_badge','incident_commander_1_badge'
]);


function isFemaleClassAUniform(){
  return State.gender === 'female' && State.uniform === 'blues_a';
}

function isFemaleCadetClassAUniform(){
  return isFemaleClassAUniform() && State.membership === 'cadet';
}

function useFemaleOverNameplateSpecialtyLayout(id){
  // Female Class A technicality: specialty-track badges use the nameplate/command
  // badge anchor row, with a hard maximum of two badges in that row.
  return isFemaleClassAUniform() && FEMALE_OVER_NAMEPLATE_SPECIALTY_BADGE_IDS.has(id);
}

function getFemaleClassASpecialtyBadgeIds(){
  if(!isFemaleClassAUniform()) return [];
  return (State.badges || [])
    .filter(badgeId => isSelectableSpecialtyPocketBadge(badgeId))
    .filter(badgeId => useFemaleOverNameplateSpecialtyLayout(badgeId))
    .filter(badgeId => isBadgeEligibleForMembership(badgeId, State.membership));
}

function getRenderableFemaleClassASpecialtyBadgeIds(){
  return getFemaleClassASpecialtyBadgeIds().slice(0, 2);
}

function femaleClassASpecialtyRowIsFull(){
  return getRenderableFemaleClassASpecialtyBadgeIds().length >= 2;
}

function hasCurrentCommanderBadgeSelected(){
  return (State.badges || []).includes('squadron_commander_badge') && !State.commandInsignia?.graduatedCommander;
}

// Specialty-track/service badges, other than command insignia, are pocket badges.
// They are assigned by selection order: first specialty badge goes on the wearer's
// left pocket below the ribbons (LP); second goes on the wearer's right pocket (RP).
//
// Exception note: Volunteer University badge has no specific Class A fixed-position
// rule in CAPR 39-1 for this builder, so it intentionally stays in this flexible
// specialty placement group instead of being forced into a named occupational slot.
function isSelectableSpecialtyPocketBadge(id){
  return SPECIALTY_TRACK_BADGE_IDS.has(id) && !isCommandInsigniaBadge(id);
}

const MALE_CADET_LEFT_POCKET_EXCLUSIVE_BADGE_IDS = new Set([
  'model_rocketry_badge',
  'cyber_badges',
  'stem_badges'
]);

function isMaleCadetBlueUniform(){
  return State.membership === 'cadet' && State.gender === 'male' && ['blues_a','blues_b'].includes(State.uniform);
}

function isMaleCadetLeftPocketExclusiveBadge(id){
  return MALE_CADET_LEFT_POCKET_EXCLUSIVE_BADGE_IDS.has(id) && isMaleCadetBlueUniform();
}

function getSelectedMaleCadetLeftPocketExclusiveBadges(){
  return (State.badges || [])
    .filter(badgeId => MALE_CADET_LEFT_POCKET_EXCLUSIVE_BADGE_IDS.has(badgeId))
    .filter(badgeId => isBadgeEligibleForMembership(badgeId, State.membership));
}

function getActiveMaleCadetLeftPocketExclusiveBadge(){
  if(!isMaleCadetBlueUniform()) return null;
  return getSelectedMaleCadetLeftPocketExclusiveBadges()[0] || null;
}

function getGenderedPocketSlotForBadge(id){
  if(isMaleCadetLeftPocketExclusiveBadge(id)){
    // Model Rocketry, Cadet Cyber, and Cadet STEM are all left-pocket-only for male cadet blues.
    // If multiple are selected, only the first selected one may own LP.
    return getActiveMaleCadetLeftPocketExclusiveBadge() === id ? 'LP' : null;
  }

  // Female Class A cadet technicality:
  // Cyber and STEM are specialty badges and belong in the two-badge row above the nameplate.
  if(isFemaleCadetClassAUniform() && (id === 'cyber_badges' || id === 'stem_badges')){
    return getRenderableFemaleClassASpecialtyBadgeIds().includes(id) ? 'FON' : null;
  }

  if(id === 'model_rocketry_badge'){
    // On female cadet Class A, once the two specialty badge row above the nameplate
    // is already full, Model Rocketry goes to the same zone as the male uniform.
    if(isFemaleCadetClassAUniform() && femaleClassASpecialtyRowIsFull()) return 'LP';
    return State.gender === 'female' ? 'ON' : 'LP';
  }
  return 'LP';
}


// CAP command insignia is handled as its own exception category and does not count
// against the normal four-badge limit.
const COMMAND_INSIGNIA_BADGE_IDS = new Set([
  'squadron_commander_badge'
]);
function isCommandInsigniaBadge(id){
  return COMMAND_INSIGNIA_BADGE_IDS.has(id);
}
function getCommandInsigniaSlot(){
  // Current commanders: ON (over nameplate). Graduated commanders: UN (under nameplate).
  return State.commandInsignia?.graduatedCommander ? 'UN' : 'ON';
}
function getBadgeSlotSpec(id){
  if(id === 'squadron_commander_badge') return getCommandInsigniaSlot();
  return badgeLocations[id] || 'UN';
}
function getBadgeSlotLabel(id){
  if(id === 'squadron_commander_badge'){
    return State.commandInsignia?.graduatedCommander ? 'UN — graduated commander' : 'ON — current commander';
  }
  if(id === 'model_rocketry_badge' || id === 'cyber_badges' || id === 'stem_badges'){
    if(isMaleCadetLeftPocketExclusiveBadge(id)){
      const owner = getActiveMaleCadetLeftPocketExclusiveBadge();
      return owner === id
        ? 'LP — male cadet left-pocket-only exception'
        : 'LP only — not rendered unless selected first';
    }
    if(id === 'model_rocketry_badge'){
      return getGenderedPocketSlotForBadge(id) === 'LP'
        ? 'LP — wearer\'s left pocket, under ribbons'
        : 'ON — female blues placement';
    }
  }
  if(id === 'volunteer_university_instructor_badge'){
    return 'RP — Volunteer University exception';
  }
  if(useFemaleOverNameplateSpecialtyLayout(id)){
    return hasCurrentCommanderBadgeSelected()
      ? 'FON — female specialty-track row above current commander badge'
      : 'FON — female specialty-track row over the nameplate';
  }
  return badgeLocations[id] || 'UN';
}
// The line under a badge's name in the pickers. Members read where it is worn in words; the
// regulation abbreviation, drawn size and id show only with ?dev=1.
function getBadgeTileMetaHtml(id, slotText){
  const slot = slotText || getBadgeSlotLabel(id);
  if(CAPUB_DEV){
    return `<div class="sub">${escapeHtml(id)}</div><div class="sub">Slot: <b>${escapeHtml(slot)}</b></div>`;
  }
  const caption = CAPUBBadgeCaptions.placementCaption(slot);
  return `<div class="sub">Worn: <b>${escapeHtml(caption)}</b></div>`;
}
function countBadgesForLimit(ids = State.badges){
  return ids.filter(id => !isCommandInsigniaBadge(id)).length;
}
// The badges that count against the selected uniform's limit: the ones it actually wears (LIVE13 E77; Ethan: "the check thing says the uniform is
// wrong despite it being right when [you pick every one] of your badges but you only have 4 on"). A badge the uniform does not wear (d5faf601, E67) or
// one selected beyond the positions the uniform has, which the member's position picks leave off, is not drawn and is not on the uniform. The
// drawing says which are on it (the engine's scene.badgesWorn, js/engine/profiles.js): the count is the selected badges it wears, command
// insignia excluded (4.1.5.2.2.4, 4.1.9.4.4, 4.1.11.1.1.2.3, 4.2.5.1.3). Before the first drawing of this uniform, or for a uniform the engine
// does not draw, the selected badges the uniform wears are counted, as before.
function countBadgesWornForLimit(ids = State.badges, scene = (typeof window !== 'undefined' && window.CAPUBUniformView) ? window.CAPUBUniformView.scene : null){
  const selected = [...new Set(ids || [])].filter(id => !isCommandInsigniaBadge(id) && isBadgeWornOnCurrentUniform(id));
  if(!scene || scene.uniform !== State.uniform || !Array.isArray(scene.badgesWorn)) return selected.length;
  const worn = new Set(scene.badgesWorn);
  return selected.filter(id => worn.has(id)).length;
}
// Selected badges the uniform wears that the drawing leaves off (more than its positions take): an informational count for the status panel, never a
// warning (LIVE13 E77).
function countBadgesSelectedNotDrawn(ids = State.badges, scene = (typeof window !== 'undefined' && window.CAPUBUniformView) ? window.CAPUBUniformView.scene : null){
  const selected = [...new Set(ids || [])].filter(id => !isCommandInsigniaBadge(id) && isBadgeWornOnCurrentUniform(id));
  if(!scene || scene.uniform !== State.uniform || !Array.isArray(scene.badgesWorn)) return 0;
  return selected.length - countBadgesWornForLimit(ids, scene);
}

// ---- what the drawing wears ------------------------------------------------------------------------------------------------------
// The cards of the Items step, the top bar and the footers of the pickers count what the drawing puts on the uniform (the engine's
// scene.ribbonsWorn, scene.badgesWorn and scene.patchesWorn, js/engine/profiles.js), not what is selected: a patch with no place left
// on the ABU, a badge the uniform does not wear, the ribbons on a uniform that wears none are kept but are not on it, and a count that
// says otherwise disagrees with the picture. Before the first drawing of this uniform the selections are counted, as before.
function capubDrawnScene(scene = (typeof window !== 'undefined' && window.CAPUBUniformView) ? window.CAPUBUniformView.scene : null){
  return scene && scene.uniform === State.uniform ? scene : null;
}
// The patches a drawing wears, each once, read off its layers (key 'patch:<id>', 'patch:<id>:<slot>:<n>' or the edge-on copy of one).
function capubPatchesWorn(scene){
  const ids = [];
  for(const l of (scene && scene.layers) || []){
    const m = l.role === 'patch' ? /^patch:([^:]+)/.exec(l.key || '') : null;
    if(m && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}
// The awards a drawing wears, each once: a ribbon (key 'ribbon:<id>', or 'ribbon:<id>#<n>' for the extra ribbons a second award needs) or a
// miniature medal's drape ('mini:<id>'; its body and devices are not awards of their own).
function capubRibbonsWorn(scene){
  const ids = [];
  for(const l of (scene && scene.layers) || []){
    const m = l.role === 'ribbon' ? /^ribbon:(.+?)(?:#\d+)?$/.exec(l.key || '') : (l.role === 'mini-drape' ? /^mini:(.+?)(?:#\d+)?$/.exec(l.key || '') : null);
    if(m && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}
// The U.S. military badges the drawing wears (State.militaryBadges, drawn by the dress profiles, which count them among the badges
// over the left pocket, 10.10.1.2).
function countMilitaryBadgesWorn(scene){
  const sc = capubDrawnScene(scene);
  const picked = Object.keys(State.militaryBadges || {}).filter(id => State.militaryBadges[id] && State.militaryBadges[id].selected);
  if(!sc || !Array.isArray(sc.badgesWorn)) return 0;
  return picked.filter(id => sc.badgesWorn.includes(id)).length;
}
// The U.S. military badges selected, where the uniform allows them (the picker's footer counts them with the CAP badges).
function countMilitaryBadgesSelected(){
  if(typeof isMilitaryAwardWornOnUniform === 'function' && !isMilitaryAwardWornOnUniform()) return 0;
  return Object.keys(State.militaryBadges || {}).filter(id => State.militaryBadges[id] && State.militaryBadges[id].selected).length;
}
// The badges on the uniform: the CAP badges it wears (command insignia excluded, as the limit counts them) and the U.S. military badges drawn.
function countBadgesShown(scene){
  return countBadgesWornForLimit(State.badges, capubDrawnScene(scene)) + countMilitaryBadgesWorn(scene);
}
// The ribbons (or miniature medals) on the uniform.
function countRibbonsShown(scene){
  const sc = capubDrawnScene(scene);
  if(!sc || !Array.isArray(sc.layers)) return new Set((State.ribbons || []).map(r => r.id)).size;
  return capubRibbonsWorn(sc).length;
}
// The patches the member chose (general patches, the unit patch, and the higher headquarters patch the OCP adds under it), each with its
// resolved id (the OCP form of a patch is another asset, js/patches.js capubResolvePatchIdForUniform), and which of them the drawing wears.
// `hidden` carries the reason the member reads: the drawing's own note for the patch when it gave one, else that no place is left.
function capubPatchPlan(scene){
  const sc = capubDrawnScene(scene);
  const resolve = id => typeof window.capubResolvePatchIdForUniform === 'function' ? window.capubResolvePatchIdForUniform(id, State.uniform) : id;
  const chosen = [];
  const add = (id, kind) => {
    if(!id) return;
    const resolved = resolve(id);
    const meta = (typeof PATCH_META !== 'undefined') && (PATCH_META[resolved] || PATCH_META[id]);
    if(!meta) return;
    if(chosen.some(c => c.resolved === resolved && (c.kind === 'hhq') === (kind === 'hhq'))) return;
    chosen.push({ id, resolved, kind, title: meta.label || String(resolved).replace(/_/g, ' ') });
  };
  const unit = typeof getSelectedUnitPatchId === 'function' ? getSelectedUnitPatchId() : null;
  if(unit && typeof isUnitPatchAuthorizedForCurrentUniform === 'function' && isUnitPatchAuthorizedForCurrentUniform()) add(unit, 'unit');
  const hhq = typeof getUnitHhqPlan === 'function' ? getUnitHhqPlan() : null;
  if(unit && hhq && hhq.worn) add(hhq.patchId, 'hhq');
  (State.patches || []).forEach(id => add(id, 'general'));
  const worn = sc && Array.isArray(sc.layers) ? new Set(capubPatchesWorn(sc)) : null;
  const notes = sc && Array.isArray(sc.notes) ? sc.notes : [];
  const shown = worn ? chosen.filter(c => worn.has(c.resolved)) : chosen;
  const hidden = worn ? chosen.filter(c => !worn.has(c.resolved)).map(c => {
    const own = notes.find(n => n.startsWith(c.title + ' '));
    return Object.assign({}, c, { line: own || `${c.title} is not shown: no place is left for it on this uniform` });
  }) : [];
  return { chosen, shown, hidden };
}
// The patches on the uniform, the unit patch and its higher headquarters patch included.
function countPatchesShown(scene){
  return capubPatchPlan(scene).shown.length;
}
