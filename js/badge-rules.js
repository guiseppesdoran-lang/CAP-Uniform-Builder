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
const CORPORATE_SEMI_FORMAL_SERVICE_BADGE_IDS = new Set([
  ...GOVERNANCE_SERVICE_BADGE_IDS
]);

const CAPUB_CADET_PROGRAMS_RATED_BADGE_IDS = new Set([
  'cadet_programs_badge',
  'cadet_programs_technician_badge',
  'cadet_programs_senior_badge',
  'cadet_programs_master_badge'
]);

function isBadgeAuthorizedOnCurrentDressUniform(id){
  if(State.uniform !== 'semi_formal') return true;
  // CAPR 39-1 4.2.1/4.2.2 carries forward Corporate Service Dress rules:
  // the Chaplain insignia and the listed service-badge substitutes for the
  // pocket CAP crest are the only selectable badges worn on this uniform.
  return CHAPLAIN_BADGE_IDS.has(id) || CORPORATE_SEMI_FORMAL_SERVICE_BADGE_IDS.has(id);
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
// regulation abbreviation, drawn size and id sit in the tooltip, and show in full with ?dev=1.
function getBadgeTileMetaHtml(id, slotText){
  const slot = slotText || getBadgeSlotLabel(id);
  if(CAPUB_DEV){
    return `<div class="sub">${escapeHtml(id)}</div><div class="sub">Slot: <b>${escapeHtml(slot)}</b></div>`;
  }
  const caption = CAPUBBadgeCaptions.placementCaption(slot);
  const detail = `${slot} · ${id}`;
  return `<div class="sub" title="${escapeHtml(detail)}">Worn: <b>${escapeHtml(caption)}</b></div>`;
}
function countBadgesForLimit(ids = State.badges){
  return ids.filter(id => !isCommandInsigniaBadge(id)).length;
}
