// Extracted verbatim from index.html: the catalog tables (uniform definitions, NCO and cadet
// combined base images, ribbons/devices/mini medals, badges and patches). Loaded between
// the two halves of the inline script so execution order is unchanged.

/* ===========================
   UNIFORM DEFINITIONS
   =========================== */
function normalizeFieldUniformRenderKey(uniformId = State.uniform){
  const u = String(uniformId || '').toLowerCase();
  if(u === 'corporate_flight_suit') return 'cfdu';
  if(u === 'ocp' || u.includes('ocp')) return 'ocp';
  if(u === 'abu' || u.includes('abu')) return 'abu';
  if(u === 'cfu' || u === 'corporate_field' || u.includes('corporate') || u.includes('field')) return 'corporate_field';
  if(u === 'cfdu' || u.includes('cfdu')) return 'cfdu';
  if(u === 'fdu' || u === 'flight_suit' || u.includes('flight')) return 'flight_suit';
  return u;
}

function isFieldUniform(u){
  return ['abu','ocp','corporate_field','cfu','cfdu','fdu','flight_suit'].includes(String(u || '').toLowerCase()) ||
    ['abu','ocp','corporate_field','cfdu','flight_suit'].includes(normalizeFieldUniformRenderKey(u));
}


// Each uniform's base garment artwork (images/garments), used for the picker thumbnails. The
// preview itself is composed by js/engine from the same sheets.
const UNIFORMS = {
  blues_a:{male:'garments/garment-blues-class-a-coat.svg',               female:'garments/garment-blues-class-a-coat-female.svg',            ribbons:true,  mini:false},
  blues_b:{male:'garments/garment-blues-class-b-shirt-male.svg',         female:'garments/garment-blues-class-b-blouse-female.svg',          ribbons:true,  mini:false},
  mess_dress:{male:'garments/garment-mess-dress-male.svg',               female:'garments/garment-mess-dress-female.svg',                    ribbons:false, mini:true},
  semi_formal:{male:'garments/garment-corporate-service-dress-blazer-male.svg', female:'garments/garment-corporate-service-dress-blazer-female.svg', ribbons:false, mini:true},
  semi_formal_usaf:{male:'garments/garment-semiformal-class-a-coat-male.svg', female:'garments/garment-semiformal-class-a-coat-female.svg', ribbons:true, mini:false},
  aviator:{male:'garments/garment-aviator-shirt-male.svg',               female:'garments/garment-aviator-shirt-female.svg',                 ribbons:true,  mini:false},
  aviator_blazer:{male:'garments/garment-corporate-service-dress-blazer-male.svg', female:'garments/garment-corporate-service-dress-blazer-female.svg', ribbons:false, mini:false},
  corporate_field:{male:'garments/garment-cfu-coat.svg',                 female:'garments/garment-cfu-coat.svg',                             ribbons:false, mini:false},
  abu:{male:'garments/garment-abu-coat.svg',                             female:'garments/garment-abu-coat.svg',                             ribbons:false, mini:false},
  ocp:{male:'garments/garment-ocp-coat-abu-cut.svg',                     female:'garments/garment-ocp-coat-abu-cut.svg',                     ribbons:false, mini:false},
  flight_suit:{male:'garments/garment-fdu-flight-suit.svg',              female:'garments/garment-fdu-flight-suit.svg',                      ribbons:false, mini:false},
  corporate_flight_suit:{male:'garments/garment-cfdu-flight-suit.svg',   female:'garments/garment-cfdu-flight-suit.svg',                     ribbons:false, mini:false}
};
// Whether a uniform takes ribbons or miniature medals is a CAPR 39-1 rule (11.1.2-11.1.4), so
// it comes from data/uniform-rules.js rather than from the flags above.
Object.keys(UNIFORMS).forEach(id=>{
  if(!CAPUBUniformRules.getUniformRule(id)) return;
  UNIFORMS[id].ribbons = CAPUBUniformRules.allowsRibbons(id);
  UNIFORMS[id].mini = CAPUBUniformRules.allowsMiniMedals(id);
});

/* Collar/lapel foreground masks. Each entry clips a duplicate of the active
   base uniform image, so rank-specific and gender-specific artwork is reused
   exactly. The duplicate renders above ribbons, badges, and patches. */

const UI_AUTHZ = {
  blues_a:{ showBadges:true,  showPatches:false },
  blues_b:{ showBadges:true,  showPatches:false },
  aviator:{ showBadges:true,  showPatches:false },
  aviator_blazer:{ showBadges:true, showPatches:false },
  corporate_field:{ showBadges:true, showPatches:true },
  mess_dress:{ showBadges:true,  showPatches:false },
  semi_formal:{ showBadges:true, showPatches:false },
  abu:{ showBadges:true, showPatches:true },
  ocp:{ showBadges:true, showPatches:true },
  flight_suit:{ showBadges:true, showPatches:true },
  corporate_flight_suit:{ showBadges:true, showPatches:true },
  semi_formal_usaf:{ showBadges:true, showPatches:false }
};
// Ribbon wear is a CAPR 39-1 rule; see data/uniform-rules.js.
Object.keys(UI_AUTHZ).forEach(id=>{
  UI_AUTHZ[id].showRibbons = CAPUBUniformRules.allowsRibbons(id);
});

/* ===========================
   SENIOR MEMBER NCO BASE IMAGES
   =========================== */

/* ===========================
   CADET COMBINED CLASS A BASE IMAGES
   =========================== */
// Male cadet officer Class A images already include the jacket, shoulder boards,
// and officer grade. Enlisted/airman male Class A still falls back to the normal
// generic male jacket unless rank-specific male Class A files are added later.

// Female cadet Class A images are full base images with the cadet grade already
// built into the coat. File convention:
//   images/base/blues_class_a_female_c_<rank>.png


// Senior Member officer combined Class A base images.
// This intentionally operates the SAME WAY as the cadet officer jacket selection:
// one direct rank-to-file map is used as the base jacket image. No separate
// officer-rank overlay is rendered for these Class A senior officer selections.
//
// IMPORTANT: These paths must match the filenames in images/base EXACTLY,
// including capitalization. The uploaded ZIP currently includes:
//   images/base/CAP_female_Capt.webp
//   images/base/CAP_male_Maj.webp
// Add the remaining senior officer jacket images using the filenames below
// or update only this map if your actual filenames differ.


// Senior Member officer combined Class B base images.
// These are full base images with officer grade already built into the shirt.
// Naming convention:
//   images/base/{rank}_blues_class_b_{gender}.png


// Senior Member officer OCP blouse base images.
// Male and female senior officer OCP variants use the same rank-specific image.
// File convention:
//   images/base/{rank}_OCP_Blouse.png


// Cadet combined Class B base images.
// These are full base images with cadet grade already built into the shirt.
// Naming convention:
//   images/base/blues_class_b_{gender}_{cadet_rank}.png
// Senior member Class B pathing is intentionally unchanged and remains in
// SENIOR_NCO_BASE.blues_b and SENIOR_OFFICER_COMBINED_CLASSB.

const CADET_FIRST_SERGEANT_CLASSB_RANKS = new Set([
  "C/MSgt", "C/SMSgt", "C/CMSgt"
]);


function isCadetFirstSergeantEligible(rank = State.rank){
  return State.membership === 'cadet' && CADET_FIRST_SERGEANT_CLASSB_RANKS.has(rank);
}

function syncCadetFirstSergeantControl(){
  const eligible = isCadetFirstSergeantEligible();
  if(cadetFirstSergeantBlock) cadetFirstSergeantBlock.classList.toggle('hidden', !eligible);
  if(cadetFirstSergeantCheckbox){
    cadetFirstSergeantCheckbox.disabled = !eligible;
    if(!eligible){
      cadetFirstSergeantCheckbox.checked = false;
      State.cadetFirstSergeant = false;
    }else{
      cadetFirstSergeantCheckbox.checked = !!State.cadetFirstSergeant;
    }
  }
}


/* ===========================
   RIBBONS / DEVICES / MINI MEDALS
   =========================== */
const ribbonList = [
  'air_force_aerial_achievement_medal',
  // Highest-precedence ribbon added by user.
  // Asset path resolves to: images/ribbons/Air_Force_Organizational_Excellence_Award.png
  'Air_Force_Organizational_Excellence_Award',

  'silver_medal_of_valor','bronze_medal_of_valor','distinguished_service_award','exceptional_service_award','meritorious_service_award','commander_commendation_award','cap_achievment_award','lifesaving_award','national_commander_unit_citation_award','unit_citation_award',

  // Senior-member professional development / AE ribbons
  'national_commanders_citation',
  'cap_gill_robb_wilson_ribbon',
  'cap_paul_e_garber_ribbon',
  'cap_grover_loening_aerospace_ribbon',
  'cap_leadership_ribbon',
  'cap_membership_ribbon',
  'cap_a_scott_crossfield_ribbon',
  'cap_bridgadier_general_charles_yaeger_ribbon',

  // Cadet program awards / achievements
  'cadet_certificate_of_proficiency','historic_cadet_blue_achievement','historic_cadet_white_achievement','historic_cadet_red_achievement','frank_borman_falcon_award',
  'spaatz_award','eaker_award','earhart_award','mitchell_award','armstrong_achievement','goddard_achievement','doolittle_achievement','lindbergh_achievement','rickenbacker_achievement','wright_brothers_award','mary_feik_achievement','hap_arnold_achievement','curry_achievement',

  // Service ribbons / awards
  'afa_award','afsa_award','vfw_officer_award','vfw_nco_award',
  'cap_command_service_ribbon','crisis_ribbon','red_service_ribbon',

  // Activity ribbons
  'search_find_ribbon','air_search_and_rescue_ribbon','cap_counterdrug_ribbon','disaster_relief_ribbon','homeland_security_ribbon','cap_cadet_orientation_pilot_ribbon','community_service_ribbon','iace_ribbon','national_cadet_competition_ribbon','national_color_guard_competition_ribbon','cadet_advisory_council_ribbon','cadet_special_activity_ribbon','encampment_ribbon','cap_senior_recruiter_ribbon','cadet_recruiter_ribbon',

  // Wartime service awards (February 1942 through July 1945).
  'air_medal','cap_world_war_2_service_ribbon','anti_submarine_coastal_patrol_ribbon','southern_liaison_patrol_ribbon','tow_target_tracking_ribbon','courier_ribbon','forest_patrol_ribbon','missing_aircraft_ribbon'
];

// Robust ribbon precedence lookup. Unknown/renamed asset IDs are pushed to the end
// instead of sorting as -1 and jumping ahead of the Silver Medal of Valor.
const RIBBON_ID_ALIASES = {
  air_force_organizational_excellence_award: 'Air_Force_Organizational_Excellence_Award',
  Air_Force_Organizational_Excellence_Award: 'Air_Force_Organizational_Excellence_Award',
  cap_achievement_award: 'cap_achievment_award',
  commanders_commendation_award: 'commander_commendation_award',
  commander_commedation_award: 'commander_commendation_award',
  brigadier_general_charles_yeager_ribbon: 'cap_bridgadier_general_charles_yaeger_ribbon',
  charles_yeager_ribbon: 'cap_bridgadier_general_charles_yaeger_ribbon',
  yeager_award: 'cap_bridgadier_general_charles_yaeger_ribbon'
};
const RIBBON_DISPLAY_NAMES = {
  // Names as CAPR 39-3 Attachment 2 prints them. Ids keep their old spellings; only the label changes.
  silver_medal_of_valor: 'Silver Medal of Valor',
  bronze_medal_of_valor: 'Bronze Medal of Valor',
  commander_commendation_award: "Commander's Commendation Award",
  cap_achievment_award: 'CAP Achievement Award',
  national_commander_unit_citation_award: "National Commander's Unit Citation Award",
  cap_gill_robb_wilson_ribbon: 'Gill Robb Wilson Award',
  cap_paul_e_garber_ribbon: 'Paul E. Garber Award',
  cap_grover_loening_aerospace_ribbon: 'Grover Loening Aerospace Award',
  cap_leadership_ribbon: 'Leadership Award',
  cap_membership_ribbon: 'Membership Award',
  cap_a_scott_crossfield_ribbon: 'A. Scott Crossfield Award',
  cap_bridgadier_general_charles_yaeger_ribbon: 'Brig Gen Charles E. \u201cChuck\u201d Yeager Award',
  spaatz_award: 'Gen Carl A. Spaatz Award',
  eaker_award: 'Ira C. Eaker Award',
  earhart_award: 'Amelia Earhart Award',
  mitchell_award: 'Gen Billy Mitchell Award',
  armstrong_achievement: 'Neil Armstrong Achievement',
  goddard_achievement: 'Dr. Robert H. Goddard Achievement',
  doolittle_achievement: 'Gen Jimmy F. Doolittle Achievement',
  lindbergh_achievement: 'Charles A. Lindbergh Achievement',
  rickenbacker_achievement: 'Capt Eddie Rickenbacker Achievement',
  mary_feik_achievement: 'Mary Feik Achievement',
  hap_arnold_achievement: 'Gen Hap Arnold Achievement',
  curry_achievement: 'Gen J.F. Curry Achievement',
  afa_award: 'AFA Award to Unit Cadet of the Year',
  afsa_award: 'AFSA Award to Unit Cadet NCO of the Year',
  vfw_officer_award: 'VFW Outstanding Cadet Officer of the Year Award',
  vfw_nco_award: 'VFW Outstanding Cadet NCO of the Year Award',
  crisis_ribbon: 'CAP Crisis Service Ribbon',
  cap_command_service_ribbon: 'Command Service Ribbon',
  search_find_ribbon: 'Search \u201cFind\u201d Ribbon',
  air_search_and_rescue_ribbon: 'Air Search and Rescue Ribbon',
  cap_counterdrug_ribbon: 'Counterdrug Ribbon',
  iace_ribbon: 'IACE Ribbon',
  cap_cadet_orientation_pilot_ribbon: 'Cadet Orientation Pilot Ribbon',
  cap_senior_recruiter_ribbon: 'Senior Recruiter Ribbon',
  cap_world_war_2_service_ribbon: 'World War II Service Ribbon',
  air_force_aerial_achievement_medal: 'Air Force Aerial Achievement Medal',
  national_commanders_citation: "National Commander's Citation",
  cadet_certificate_of_proficiency: 'Cadet Certificate of Proficiency',
  historic_cadet_blue_achievement: 'Historic Cadet Blue Achievement',
  historic_cadet_white_achievement: 'Historic Cadet White Achievement',
  historic_cadet_red_achievement: 'Historic Cadet Red Achievement',
  frank_borman_falcon_award: 'Frank Borman Falcon Award',
  air_medal: 'Air Medal (US Army Air Forces)',
  anti_submarine_coastal_patrol_ribbon: 'Anti-Submarine Coastal Patrol Ribbon',
  southern_liaison_patrol_ribbon: 'Southern Liaison Patrol Ribbon',
  tow_target_tracking_ribbon: 'Tow-Target & Tracking Ribbon',
  courier_ribbon: 'Courier Ribbon',
  forest_patrol_ribbon: 'Forest Patrol Ribbon',
  missing_aircraft_ribbon: 'Missing Aircraft Ribbon'
};
const MILITARY_RIBBON_PREFIX = 'military:';
let militaryRibbonCatalogCache={dataRef:null,awards:[],byId:new Map(),ids:[]};
function isMilitaryRibbonId(id){
  return String(id || '').startsWith(MILITARY_RIBBON_PREFIX);
}
// U.S. military awards and the Air Force Organizational Excellence Award are not worn on
// Corporate-style uniforms (CAPR 39-1 11.1.6, 11.2.3). Selections are kept, so switching back
// to a USAF-style uniform brings them back.
function isAwardWornOnUniform(id, uniformId = State.uniform){
  return CAPUBUniformRules.isAwardAllowedOnUniform(id, uniformId, {isMilitary:isMilitaryRibbonId(id)});
}
function isMilitaryAwardWornOnUniform(uniformId = State.uniform){
  return CAPUBUniformRules.isAwardAllowedOnUniform('', uniformId, {isMilitary:true});
}

function militaryRibbonCatalogId(id){
  return isMilitaryRibbonId(id) ? String(id).slice(MILITARY_RIBBON_PREFIX.length) : String(id || '');
}
function getAllMilitaryRibbonAwards(){
  const dataRef=window.CAPUBMilitaryData?.awards || null;
  if(militaryRibbonCatalogCache.dataRef===dataRef) return militaryRibbonCatalogCache.awards;
  const raw=(window.CAPUBMilitaryData?.awards || []).filter(award =>
    award.type === 'RIBBON' && !window.CAPUBMilitary?.isCapAward(award)
  );
  // An award with no ribbon artwork would show as a broken image, so it is not offered until it has some.
  const awards=(window.CAPUBMilitary?.canonicalizeAwards?.(raw) || raw).filter(award => award?.images?.ribbon);
  const sorted=[...awards].sort(window.CAPUBMilitary?.compareAwardsUniversal || ((a,b)=>String(a.name).localeCompare(String(b.name))));
  const byId=new Map();
  for(const award of awards){
    byId.set(award.id,award);
    for(const sourceId of award.sourceIds || []) byId.set(sourceId,award);
  }
  militaryRibbonCatalogCache={
    dataRef,
    awards,
    byId,
    ids:sorted.map(award=>`${MILITARY_RIBBON_PREFIX}${award.id}`)
  };
  return awards;
}
function getMilitaryRibbonAward(id){
  getAllMilitaryRibbonAwards();
  const catalogId = militaryRibbonCatalogId(id);
  return militaryRibbonCatalogCache.byId.get(catalogId) || null;
}
function getMilitaryRibbonIds(){
  getAllMilitaryRibbonAwards();
  return [...militaryRibbonCatalogCache.ids];
}
const MILITARY_BRANCH_ORDER=['JOINT','ARMY','MARINE_CORPS','NAVY','AIR_FORCE','SPACE_FORCE','COAST_GUARD'];
const MILITARY_BRANCH_LABELS={JOINT:'Joint / Multi-Service',ARMY:'Army',MARINE_CORPS:'Marine Corps',NAVY:'Navy',AIR_FORCE:'Air Force',SPACE_FORCE:'Space Force',COAST_GUARD:'Coast Guard'};
function getMilitaryAwardBranch(award){
  const services=[...new Set((award?.authorizedServices || []).filter(service=>MILITARY_BRANCH_ORDER.includes(service)))];
  return services.length === 1 ? services[0] : 'JOINT';
}
function getMilitarySelectionService(id,selection=State.ribbonSelections?.[id]){
  const award=getMilitaryRibbonAward(id);
  const services=award?.authorizedServices || [];
  return services.includes(selection?.militaryService) ? selection.militaryService : (services[0] || 'AIR_FORCE');
}
function getRibbonDisplayName(id){
  if(isMilitaryRibbonId(id)){
    const award = getMilitaryRibbonAward(id);
    return award?.officialName || award?.name || militaryRibbonCatalogId(id).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  }
  return RIBBON_DISPLAY_NAMES[id] || id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
// Where a ribbon sits in CAPR 39-3 Attachment 2, so the picker reads the way the regulation does.
// Order within a group is the precedence order of ribbonList.
const RIBBON_GROUPS = [
  {key:'usaf', label:'Air Force awards', ids:['air_force_aerial_achievement_medal','Air_Force_Organizational_Excellence_Award']},
  {key:'decorations', label:'Decorations', ids:['silver_medal_of_valor','bronze_medal_of_valor','distinguished_service_award','exceptional_service_award','meritorious_service_award','commander_commendation_award','cap_achievment_award','lifesaving_award','national_commander_unit_citation_award','unit_citation_award']},
  {key:'profdev', label:'Professional development', ids:['national_commanders_citation','cap_gill_robb_wilson_ribbon','cap_paul_e_garber_ribbon','cap_grover_loening_aerospace_ribbon','cap_leadership_ribbon','cap_membership_ribbon']},
  {key:'aeroed', label:'Aerospace education', ids:['cap_a_scott_crossfield_ribbon','cap_bridgadier_general_charles_yaeger_ribbon']},
  {key:'cadet', label:'Cadet program awards', seniorLabel:'Cadet awards (only the highest is worn)', ids:['spaatz_award','eaker_award','earhart_award','mitchell_award','armstrong_achievement','goddard_achievement','doolittle_achievement','lindbergh_achievement','rickenbacker_achievement','wright_brothers_award','mary_feik_achievement','hap_arnold_achievement','curry_achievement','cadet_certificate_of_proficiency','historic_cadet_blue_achievement','historic_cadet_white_achievement','historic_cadet_red_achievement','frank_borman_falcon_award']},
  {key:'service', label:'Service', ids:['cap_command_service_ribbon','crisis_ribbon','red_service_ribbon','afa_award','afsa_award','vfw_officer_award','vfw_nco_award']},
  {key:'activity', label:'Activity', ids:['search_find_ribbon','air_search_and_rescue_ribbon','cap_counterdrug_ribbon','disaster_relief_ribbon','homeland_security_ribbon','cap_cadet_orientation_pilot_ribbon','community_service_ribbon','iace_ribbon','national_cadet_competition_ribbon','national_color_guard_competition_ribbon','cadet_advisory_council_ribbon','cadet_special_activity_ribbon','encampment_ribbon','cadet_recruiter_ribbon','cap_senior_recruiter_ribbon']},
  {key:'wartime', label:'Wartime service (1942\u20131945)', ids:['air_medal','cap_world_war_2_service_ribbon','anti_submarine_coastal_patrol_ribbon','southern_liaison_patrol_ribbon','tow_target_tracking_ribbon','courier_ribbon','forest_patrol_ribbon','missing_aircraft_ribbon']}
];
// Groups for one list of ids, in regulation order. Anything not placed lands in "Other".
function groupRibbonIds(ids, membership = State.membership){
  const placed = new Set();
  const groups = [];
  for(const group of RIBBON_GROUPS){
    const members = group.ids.filter(id => ids.includes(id));
    members.forEach(id => placed.add(id));
    if(members.length) groups.push({key:group.key, label:(membership === 'senior' && group.seniorLabel) || group.label, ids:members});
  }
  const rest = ids.filter(id => !placed.has(id));
  if(rest.length) groups.push({key:'other', label:'Other', ids:rest});
  return groups;
}
const RIBBON_PRECEDENCE_INDEX = new Map(ribbonList.map((id, idx) => [id, idx]));
function normalizeRibbonId(id){
  return RIBBON_ID_ALIASES[id] || id;
}
function precedence(id){
  if(isMilitaryRibbonId(id)) return -1;
  const normalized = normalizeRibbonId(id);
  return RIBBON_PRECEDENCE_INDEX.has(normalized)
    ? RIBBON_PRECEDENCE_INDEX.get(normalized)
    : Number.MAX_SAFE_INTEGER;
}

/* Ribbon eligibility by membership type. Senior members may select any cadet
   achievement ribbon earned, but may wear only one cadet-program award ribbon. */
const CADET_ACHIEVEMENT_RIBBONS = new Set([
  'curry_achievement','hap_arnold_achievement','mary_feik_achievement','wright_brothers_award',
  'rickenbacker_achievement','lindbergh_achievement','doolittle_achievement','goddard_achievement',
  'armstrong_achievement','mitchell_award','earhart_award','eaker_award','spaatz_award'
]);
const CADET_MILESTONES = new Set([
  'wright_brothers_award','mitchell_award','earhart_award','eaker_award','spaatz_award'
]);
const SENIOR_HIGHEST_CADET_AWARD_RIBBONS = new Set([
  ...CADET_ACHIEVEMENT_RIBBONS,
  'cadet_certificate_of_proficiency','historic_cadet_blue_achievement',
  'historic_cadet_white_achievement','historic_cadet_red_achievement',
  'frank_borman_falcon_award'
]);
const HISTORICAL_RIBBONS = new Set([
  'national_commanders_citation','cadet_certificate_of_proficiency','historic_cadet_blue_achievement',
  'historic_cadet_white_achievement','historic_cadet_red_achievement',
  'frank_borman_falcon_award','air_medal','cap_world_war_2_service_ribbon',
  'anti_submarine_coastal_patrol_ribbon','southern_liaison_patrol_ribbon',
  'tow_target_tracking_ribbon','courier_ribbon','forest_patrol_ribbon',
  'missing_aircraft_ribbon'
]);
const COMMON_ELIGIBLE_RIBBONS = new Set([
  'silver_medal_of_valor','bronze_medal_of_valor','distinguished_service_award','exceptional_service_award','meritorious_service_award','commander_commendation_award','cap_achievment_award','lifesaving_award','national_commander_unit_citation_award','unit_citation_award',
  'crisis_ribbon','red_service_ribbon','search_find_ribbon','air_search_and_rescue_ribbon','disaster_relief_ribbon','homeland_security_ribbon','community_service_ribbon','iace_ribbon','national_cadet_competition_ribbon','national_color_guard_competition_ribbon','cadet_advisory_council_ribbon','cadet_special_activity_ribbon','encampment_ribbon'
]);
const CADET_ONLY_RIBBONS = new Set([
  'spaatz_award','eaker_award','earhart_award','mitchell_award','armstrong_achievement','goddard_achievement','doolittle_achievement','lindbergh_achievement','rickenbacker_achievement','wright_brothers_award','mary_feik_achievement','hap_arnold_achievement','curry_achievement',
  'afa_award','afsa_award','vfw_officer_award','vfw_nco_award','cadet_recruiter_ribbon'
]);
const SENIOR_ONLY_RIBBONS = new Set([
  'Air_Force_Organizational_Excellence_Award',
  'air_force_aerial_achievement_medal',
  'national_commanders_citation',
  'cap_gill_robb_wilson_ribbon','cap_paul_e_garber_ribbon','cap_grover_loening_aerospace_ribbon','cap_leadership_ribbon','cap_membership_ribbon','cap_a_scott_crossfield_ribbon','cap_bridgadier_general_charles_yaeger_ribbon',
  'cadet_certificate_of_proficiency','historic_cadet_blue_achievement','historic_cadet_white_achievement','historic_cadet_red_achievement','frank_borman_falcon_award',
  'cap_command_service_ribbon','cap_counterdrug_ribbon','cap_cadet_orientation_pilot_ribbon','cap_senior_recruiter_ribbon',
  'air_medal','cap_world_war_2_service_ribbon','anti_submarine_coastal_patrol_ribbon','southern_liaison_patrol_ribbon','tow_target_tracking_ribbon','courier_ribbon','forest_patrol_ribbon','missing_aircraft_ribbon'
]);
const CADET_ELIGIBLE_RIBBONS = new Set([...COMMON_ELIGIBLE_RIBBONS, ...CADET_ONLY_RIBBONS]);
const SENIOR_ELIGIBLE_RIBBONS = new Set([...COMMON_ELIGIBLE_RIBBONS, ...SENIOR_ONLY_RIBBONS, ...CADET_ACHIEVEMENT_RIBBONS]);
function getEligibleRibbonIds(membership = State.membership){
  if(membership === 'cadet'){
    return ribbonList.filter(id => CADET_ELIGIBLE_RIBBONS.has(id));
  }
  if(membership === 'senior'){
    return ribbonList.filter(id => SENIOR_ELIGIBLE_RIBBONS.has(id));
  }
  return [...ribbonList];
}
function isRibbonEligibleForMembership(id, membership = State.membership){
  return getEligibleRibbonIds(membership).includes(id);
}

const deviceList = [
  '1_Bronze_Star_Device',
  '1_Silver_Star_Device'
];
/*
  Device catalogue. src is the device's artwork in images/devices (used for the picker
  thumbnails; the uniform engine places devices from the same files).

  w/h are no longer used for layout; the engine sizes devices from their artwork
  from the ribbon it sits on. They are kept as nominal aspect hints.

  weight orders devices within a run, highest first, so silver precedes bronze
  and gold precedes silver (CAPR 39-3 precedence, worn to the wearer's right).
*/
const deviceMeta = {
  '1_Bronze_Star_Device':      { label:'Bronze Star',      src:'devices/device-star-bronze.svg',      w:10, h:10, weight:1 },
  '1_Silver_Star_Device':      { label:'Silver Star',      src:'devices/device-star-silver.svg',      w:10, h:10, weight:2 },
  '1_Gold_Star_Device':        { label:'Gold Star',        src:'devices/device-star-gold.svg',        w:10, h:10, weight:3 },
  'V_Device':                  { label:'V Device',         src:'devices/device-v.svg',                  w:10, h:10, weight:4 },
  '1_Bronze_Propeller_Device': { label:'Bronze Propeller', src:'devices/device-propeller-bronze.svg', w:10, h:10, weight:1 },
  'BRONZE_OLC': { label:'Bronze Oak Leaf Cluster', src:'devices/mil-device-olc-bronze.svg', w:12, h:7, weight:3 },
  'SILVER_OLC': { label:'Silver Oak Leaf Cluster', src:'devices/mil-device-olc-silver.svg', w:12, h:7, weight:4 },
  'BRONZE_SERVICE_STAR': { label:'Bronze Service Star', src:'devices/device-star-bronze.svg', w:8, h:8, weight:3 },
  'SILVER_SERVICE_STAR': { label:'Silver Service Star', src:'devices/device-star-silver.svg', w:8, h:8, weight:4 },
  'GOLD_AWARD_STAR': { label:'Gold Award Star', src:'devices/device-star-gold.svg', w:8, h:8, weight:3 },
  'SILVER_AWARD_STAR': { label:'Silver Award Star', src:'devices/device-star-silver.svg', w:8, h:8, weight:4 },
  'V_DEVICE': { label:'V Device', src:'devices/device-v.svg', w:8, h:9, weight:8 },
  'C_DEVICE': { label:'C Device', src:'devices/mil-device-letter-c.svg', w:8, h:9, weight:7 },
  'R_DEVICE': { label:'R Device', src:'devices/mil-device-letter-r.svg', w:8, h:9, weight:7 },
  'M_DEVICE': { label:'M Device', src:'devices/mil-device-letter-m.svg', w:9, h:9, weight:7 },
  'N_DEVICE': { label:'N Device', src:'devices/mil-device-letter-n.svg', w:9, h:9, weight:7 },
  'BRONZE_HOURGLASS': { label:'Bronze Hourglass', src:'devices/mil-device-hourglass-bronze.svg', w:8, h:9, weight:6 },
  'SILVER_HOURGLASS': { label:'Silver Hourglass', src:'devices/mil-device-hourglass-silver.svg', w:8, h:9, weight:6 },
  'GOLD_HOURGLASS': { label:'Gold Hourglass', src:'devices/mil-device-hourglass-gold.svg', w:8, h:9, weight:6 },
  'ARROWHEAD_DEVICE': { label:'Arrowhead Device', src:'devices/mil-device-arrowhead.svg', w:7, h:9, weight:9 }
};

// device cap per ribbon (overflow creates additional ribbon instances)
const RIBBON_DEVICE_CAP = {
  '1_Silver_Star_Device': 4,
  '1_Bronze_Star_Device': 4
};


/* ===========================
   USER-SUPPLIED RIBBON IMAGE VARIANTS
   ===========================
   These files are expected in images/ribbons/. They are pre-rendered ribbon
   images that already include the device/level named in the dropdown, so the
   program does not overlay a separate device on top of them.
*/
const RIBBON_SPECIAL_IMAGE_OPTIONS = {
  // Honor-credit variants for Cadet Achievements 1-8.
  'curry_achievement': [
    { label:'Earned', value:'earned', image:null, devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', image:'curryH.png', devices:{} }
  ],
  'hap_arnold_achievement': [
    { label:'Earned', value:'earned', image:null, devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', image:'arnoldH.png', devices:{} }
  ],
  'mary_feik_achievement': [
    { label:'Earned', value:'earned', image:null, devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', image:'feikH.png', devices:{} }
  ],
  'rickenbacker_achievement': [
    { label:'Earned', value:'earned', image:null, devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', image:'rickenH.png', devices:{} }
  ],
  'lindbergh_achievement': [
    { label:'Earned', value:'earned', image:null, devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', image:'lindbeH.png', devices:{} }
  ],
  'doolittle_achievement': [
    { label:'Earned', value:'earned', image:null, devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', image:'doolitH.png', devices:{} }
  ],
  'goddard_achievement': [
    { label:'Earned', value:'earned', image:null, devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', image:'goddar-star.png', devices:{} },
    { label:'Earned + Model Rocketry (Mitchell required)', value:'rocketry_star', image:'goddar-star.png', devices:{} },
    { label:'Earned + Honor Credit and Model Rocketry', value:'honor_credit_and_rocketry', image:'goddarH.png', devices:{} }
  ],
  'armstrong_achievement': [
    { label:'Earned', value:'earned', image:null, devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', image:'armstrH.png', devices:{} }
  ],
  'mitchell_award': [
    { label:'Earned', value:'earned', image:null, devices:{} },
    { label:'Earned + COS Graduate Star', value:'earned_cos_star', image:'mitchel-star.png', devices:{} }
  ],
  // COS graduate star on the highest cadet milestone ribbon.
  // User asset expected at images/ribbons/eaker-star.png.
  'eaker_award': [
    { label:'Earned', value:'earned', image:null, devices:{} },
    { label:'Earned + COS Star', value:'earned_cos_star', image:'eaker-star.png', devices:{} }
  ],
  'bronze_medal_of_valor': [
    { label:'Basic Award', value:'earned', image:null, devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', image:'bronze02.png', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', image:'bronze03.png', devices:{} }
  ],
  'distinguished_service_award': [
    { label:'Basic Award', value:'earned', image:null, devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', image:'distin02.png', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', image:'distin03.png', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', image:'distin04.png', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', image:'distin05.png', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', image:'distin06.png', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', image:'distin07.png', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', image:'distin08.png', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', image:'distin09.png', devices:{} }
  ],
  'exceptional_service_award': [
    { label:'Basic Award', value:'earned', image:null, devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', image:'except02.png', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', image:'except03.png', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', image:'except04.png', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', image:'except05.png', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', image:'except06.png', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', image:'except07.png', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', image:'except08.png', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', image:'except09.png', devices:{} }
  ],
  'meritorious_service_award': [
    { label:'Basic Award', value:'earned', image:null, devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', image:'meriti02.png', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', image:'meriti03.png', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', image:'meriti04.png', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', image:'meriti05.png', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', image:'meriti06.png', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', image:'meriti07.png', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', image:'meriti08.png', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', image:'meriti09.png', devices:{} }
  ],
  'commander_commendation_award': [
    { label:'Wing Commander / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'Wing Level Multiple Award / 1 Bronze Clasp', value:'wing_bronze_clasp_1', image:'cmdrco02.png', devices:{} },
    { label:'Wing Level Multiple Award / 2 Bronze Clasps', value:'wing_bronze_clasp_2', image:'cmdrco03.png', devices:{} },
    { label:'Region Commander / Bronze Star', value:'region_bronze_star', image:'cmdrco01R.png', devices:{} },
    { label:'National Commander / Silver Star', value:'national_silver_star', image:'cmdrco01N.png', devices:{} },
    { label:'National Commander / Silver Star + 1 Bronze Clasp', value:'national_silver_star_bronze_clasp_1', image:'cmdrco02N.png', devices:{} },
    { label:'National Commander / Silver Star + 2 Bronze Clasps', value:'national_silver_star_bronze_clasp_2', image:'cmdrco03N.png', devices:{} },
    { label:'Region Commander / Bronze Star + 1 Bronze Clasp', value:'region_bronze_star_bronze_clasp_1', image:'cmdrco02R.png', devices:{} },
    { label:'National + Region + Wing / Silver Star + Bronze Star + Bronze Clasp', value:'national_region_wing', image:'cmdrco02NR.png', devices:{} }
  ],
  'cap_achievment_award': [
    { label:'Basic Award', value:'earned', image:null, devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', image:'AA02.png', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', image:'AA03.png', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', image:'AA04.png', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', image:'AA05.png', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', image:'AA06.png', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', image:'AA07.png', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', image:'AA08.png', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', image:'AA09.png', devices:{} }
  ],
  'lifesaving_award': [
    { label:'Basic Award', value:'earned', image:null, devices:{} },
    { label:'Lifesaving Action / Silver Star', value:'silver_star', image:'lifesa-star01.png', devices:{} },
    { label:'Subsequent Award / Bronze Clasp', value:'bronze_clasp_1', image:'lifesa02.png', devices:{} },
    { label:'Silver Star + 1 Bronze Clasp', value:'silver_star_bronze_clasp_1', image:'lifesa-star02.png', devices:{} },
    { label:'2 Bronze Clasps', value:'bronze_clasp_2', image:'lifesa03.png', devices:{} },
    { label:'Silver Star + 2 Bronze Clasps', value:'silver_star_bronze_clasp_2', image:'lifesa-star03.png', devices:{} },
    { label:'3 Bronze Clasps', value:'bronze_clasp_3', image:'lifesa04.png', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', image:'lifesa06.png', devices:{} },
    { label:'Silver Star + 2 Bronze Clasps + Additional Lifesaving Ribbon', value:'silver_star_bronze_clasp_2_plus_base', image:'lifesa-star03.png', devices:{}, duplicates:[{ image:'lifesa01.png', awardLabel:'Additional Lifesaving Award' }] }
  ],
  'national_commander_unit_citation_award': [
    { label:'Basic Award', value:'earned', image:null, devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', image:'unitci-nat02.png', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', image:'unitci-nat03.png', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', image:'unitci-nat04.png', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', image:'unitci-nat05.png', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', image:'unitci-nat06.png', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', image:'unitci-nat07.png', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', image:'unitci-nat08.png', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', image:'unitci-nat09.png', devices:{} }
  ],
  'unit_citation_award': [
    { label:'Basic Award', value:'earned', image:null, devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', image:'unitci02.png', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', image:'unitci03.png', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', image:'unitci04.png', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', image:'unitci05.png', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', image:'unitci06.png', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', image:'unitci07.png', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', image:'unitci08.png', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', image:'unitci09.png', devices:{} }
  ],
  'cap_gill_robb_wilson_ribbon': [
    { label:'Level V / No PME Star', value:'earned', image:null, devices:{} },
    { label:'SOS / Bronze Star', value:'sos_bronze_star', image:'wilson-b.png', devices:{} },
    { label:'ACSC / Silver Star', value:'acsc_silver_star', image:'wilson-s.png', devices:{} },
    { label:'AWC / Gold Star', value:'awc_gold_star', image:'wilson-g.png', devices:{} }
  ],
  'cap_paul_e_garber_ribbon': [
    { label:'Level IV / No PME Star', value:'earned', image:null, devices:{} },
    { label:'SOS / Bronze Star', value:'sos_bronze_star', image:'garber-star.png', devices:{} },
    { label:'ACSC / Silver Star', value:'acsc_silver_star', image:'garber-sstar.png', devices:{} },
    { label:'AWC / Gold Star', value:'awc_gold_star', image:'garber-gstar.png', devices:{} }
  ],
  'cap_leadership_ribbon': [
    { label:'Technician Rating / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'Senior Rating / Bronze Star', value:'senior_bronze_star', image:'leader-b.png', devices:{} },
    { label:'Master Rating / Silver Star', value:'master_silver_star', image:'leader-s.png', devices:{} },
    { label:'2 Bronze Stars', value:'two_bronze_stars', image:'leader-bb.png', devices:{} },
    { label:'Silver Star + Bronze Star', value:'silver_star_bronze_star', image:'leader-sb.png', devices:{} },
    { label:'Silver Star + 2 Bronze Stars', value:'silver_star_two_bronze_stars', image:'leader-sbb.png', devices:{} },
    { label:'2 Silver Stars', value:'two_silver_stars', image:'leader-ss.png', devices:{} },
    { label:'3 Bronze Stars', value:'three_bronze_stars', image:'leader-bbb.png', devices:{} }
  ],
  'cap_command_service_ribbon': [
    { label:'Squadron Commander / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'Group Commander / Bronze Star', value:'group_bronze_star', image:'cmdser-bronze.png', devices:{} },
    { label:'Wing Commander / Silver Star', value:'wing_silver_star', image:'cmdser-silver.png', devices:{} },
    { label:'Region Commander / Gold Star', value:'region_gold_star', image:'cmdser-gold.png', devices:{} },
    { label:'National Commander / 2 Gold Stars', value:'national_two_gold_stars', image:'cmdser-gold2.png', devices:{} }
  ],
  'red_service_ribbon': [
    { label:'2 Years / Basic Ribbon', value:'years_2', image:null, devices:{} },
    { label:'5 Years / 1 Bronze Clasp', value:'years_5', image:'redser-05yr.png', devices:{} },
    { label:'10 Years / 2 Bronze Clasps', value:'years_10', image:'redser-10yr.png', devices:{} },
    { label:'15 Years / 3 Bronze Clasps', value:'years_15', image:'redser-15yr.png', devices:{} },
    { label:'20 Years / Longevity Device', value:'years_20', image:'redser-20yr.png', devices:{} },
    { label:'25 Years / Silver Clasp', value:'years_25', image:'redser-25yr.png', devices:{} },
    { label:'30 Years / Silver Clasp + Bronze Clasp', value:'years_30', image:'redser-30yr.png', devices:{} },
    { label:'35 Years / Silver Clasp + 2 Bronze Clasps', value:'years_35', image:'redser-35yr.png', devices:{} },
    { label:'40 Years / Silver Clasp + 3 Bronze Clasps', value:'years_40', image:'redser-40yr.png', devices:{} }
  ],
  'search_find_ribbon': [
    { label:'Basic Find', value:'find_1', image:null, devices:{} },
    { label:'Aircrew Find / Bronze Propeller', value:'bronze_propeller', image:'find-prop01.png', devices:{} },
    { label:'Additional Distress Find / Bronze Clasp', value:'bronze_clasp_1', image:'find02.png', devices:{} },
    { label:'Bronze Propeller + 1 Bronze Clasp', value:'bronze_propeller_bronze_clasp_1', image:'find-prop02.png', devices:{} },
    { label:'3rd Distress Find / 2 Bronze Clasps', value:'bronze_clasp_2', image:'find03.png', devices:{} },
    { label:'Bronze Propeller + 2 Bronze Clasps', value:'bronze_propeller_bronze_clasp_2', image:'find-prop03.png', devices:{} },
    { label:'4th Distress Find / 3 Bronze Clasps', value:'bronze_clasp_3', image:'find04.png', devices:{} },
    { label:'4th Find (Aircrew) / Bronze Propeller + 2 Bronze Clasps + Additional Ribbon', value:'bronze_propeller_bronze_clasp_2_plus_base', image:'find-prop03.png', devices:{}, duplicates:[{ image:'find01.png', awardLabel:'Additional Find Ribbon' }] },
    { label:'5th Distress Find / 4 Bronze Clasps', value:'bronze_clasp_4', image:'find05.png', devices:{} }
  ],
  'air_search_and_rescue_ribbon': [
    { label:'10 Sorties / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'20 Sorties / 1 Bronze Clasp', value:'bronze_clasp_1', image:'sar02.png', devices:{} },
    { label:'Aircrew Sorties / Bronze Propeller', value:'bronze_propeller', image:'sar-prop01.png', devices:{} },
    { label:'Bronze Propeller + 1 Bronze Clasp', value:'bronze_propeller_bronze_clasp_1', image:'sar-prop02.png', devices:{} },
    { label:'30 Sorties / 2 Bronze Clasps', value:'bronze_clasp_2', image:'sar03.png', devices:{} },
    { label:'Bronze Propeller + 2 Bronze Clasps', value:'bronze_propeller_bronze_clasp_2', image:'sar-prop03.png', devices:{} },
    { label:'40 Sorties / 3 Bronze Clasps', value:'bronze_clasp_3', image:'sar04.png', devices:{} },
    { label:'40 Sorties (Aircrew) / Bronze Propeller + 2 Bronze Clasps + Additional Ribbon', value:'bronze_propeller_bronze_clasp_2_plus_base', image:'sar-prop03.png', devices:{}, duplicates:[{ image:'sar01.png', awardLabel:'Additional Air Search and Rescue Ribbon' }] },
    { label:'50 Sorties / 4 Bronze Clasps', value:'bronze_clasp_4', image:'sar05.png', devices:{} }
  ],
  'cap_counterdrug_ribbon': [
    { label:'10 Sorties / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'20 Sorties / 1 Bronze Clasp', value:'bronze_clasp_1', image:'coudru02.png', devices:{} },
    { label:'30 Sorties / 2 Bronze Clasps', value:'bronze_clasp_2', image:'coudru03.png', devices:{} },
    { label:'40 Sorties / 3 Bronze Clasps', value:'bronze_clasp_3', image:'coudru04.png', devices:{} },
    { label:'50 Sorties / 4 Bronze Clasps', value:'bronze_clasp_4', image:'coudru05.png', devices:{} },
    { label:'60 Sorties / 1 Silver Clasp', value:'silver_clasp_1', image:'coudru06.png', devices:{} },
    { label:'70 Sorties / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', image:'coudru07.png', devices:{} },
    { label:'80 Sorties / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', image:'coudru08.png', devices:{} },
    { label:'90 Sorties / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', image:'coudru09.png', devices:{} }
  ],
  'disaster_relief_ribbon': [
    { label:'Basic Award', value:'earned', image:null, devices:{} },
    { label:'Presidential Disaster / Silver V', value:'silver_v', image:'disast-V01.png', devices:{} },
    { label:'Additional Award / Bronze Clasp', value:'bronze_clasp_1', image:'disast02.png', devices:{} },
    { label:'Silver V + 1 Bronze Clasp', value:'silver_v_bronze_clasp_1', image:'disast-V02.png', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', image:'disast03.png', devices:{} },
    { label:'Silver V + 2 Bronze Clasps', value:'silver_v_bronze_clasp_2', image:'disast-V03.png', devices:{} },
    { label:'Silver V + 3 Bronze Clasps', value:'silver_v_bronze_clasp_3', image:'disast-V04.png', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', image:'disast04.png', devices:{} }
  ],
  'homeland_security_ribbon': [
    { label:'10 Sorties / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'20 Sorties / 1 Bronze Clasp', value:'bronze_clasp_1', image:'homeland02.png', devices:{} },
    { label:'30 Sorties / 2 Bronze Clasps', value:'bronze_clasp_2', image:'homeland03.png', devices:{} },
    { label:'40 Sorties / 3 Bronze Clasps', value:'bronze_clasp_3', image:'homeland04.png', devices:{} },
    { label:'50 Sorties / 4 Bronze Clasps', value:'bronze_clasp_4', image:'homeland05.png', devices:{} },
    { label:'60 Sorties / 1 Silver Clasp', value:'silver_clasp_1', image:'homeland06.png', devices:{} },
    { label:'70 Sorties / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', image:'homeland07.png', devices:{} },
    { label:'80 Sorties / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', image:'homeland08.png', devices:{} },
    { label:'90 Sorties / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', image:'homeland09.png', devices:{} }
  ],
  'cap_cadet_orientation_pilot_ribbon': [
    { label:'50 Orientation Flights / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'100 Orientation Flights / 1 Bronze Clasp', value:'bronze_clasp_1', image:'cadpil02.png', devices:{} },
    { label:'150 Orientation Flights / 2 Bronze Clasps', value:'bronze_clasp_2', image:'cadpil03.png', devices:{} },
    { label:'200 Orientation Flights / 3 Bronze Clasps', value:'bronze_clasp_3', image:'cadpil04.png', devices:{} },
    { label:'250 Orientation Flights / 4 Bronze Clasps', value:'bronze_clasp_4', image:'cadpil05.png', devices:{} },
    { label:'300 Orientation Flights / 1 Silver Clasp', value:'silver_clasp_1', image:'cadpil06.png', devices:{} },
    { label:'350 Orientation Flights / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', image:'cadpil07.png', devices:{} },
    { label:'400 Orientation Flights / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', image:'cadpil08.png', devices:{} },
    { label:'450 Orientation Flights / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', image:'cadpil09.png', devices:{} }
  ],
  'community_service_ribbon': [
    { label:'60 Hours / Basic Ribbon', value:'hours_60', image:null, devices:{} },
    { label:'120 Hours / 1 Bronze Clasp', value:'bronze_clasp_1', image:'commun02.png', devices:{} },
    { label:'180 Hours / 2 Bronze Clasps', value:'bronze_clasp_2', image:'commun03.png', devices:{} },
    { label:'240 Hours / 3 Bronze Clasps', value:'bronze_clasp_3', image:'commun04.png', devices:{} },
    { label:'300 Hours / 4 Bronze Clasps', value:'bronze_clasp_4', image:'commun05.png', devices:{} },
    { label:'360 Hours / 1 Silver Clasp', value:'silver_clasp_1', image:'commun06.png', devices:{} },
    { label:'420 Hours / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', image:'commun07.png', devices:{} },
    { label:'480 Hours / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', image:'commun08.png', devices:{} },
    { label:'540 Hours / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', image:'commun09.png', devices:{} }
  ],
  'national_cadet_competition_ribbon': [
    { label:'Wing/Region Representative / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'Region Winner / Bronze Star', value:'region_bronze_star', image:'ncc-b.png', devices:{} },
    { label:'National Sweepstakes / Silver Star', value:'national_silver_star', image:'ncc-s.png', devices:{} },
    { label:'2 Bronze Stars', value:'two_bronze_stars', image:'ncc-bb.png', devices:{} },
    { label:'Silver Star + Bronze Star', value:'silver_star_bronze_star', image:'ncc-sb.png', devices:{} },
    { label:'Silver Star + 2 Bronze Stars', value:'silver_star_two_bronze_stars', image:'ncc-sbb.png', devices:{} },
    { label:'2 Silver Stars', value:'two_silver_stars', image:'ncc-ss.png', devices:{} },
    { label:'2 Silver Stars + Bronze Star', value:'two_silver_stars_bronze_star', image:'ncc-ssb.png', devices:{} },
    { label:'3 Bronze Stars', value:'three_bronze_stars', image:'ncc-bbb.png', devices:{} }
  ],
  'national_color_guard_competition_ribbon': [
    { label:'Wing/Region Representative / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'Region Winner / Bronze Star', value:'region_bronze_star', image:'ncgc-b.png', devices:{} },
    { label:'National Sweepstakes / Silver Star', value:'national_silver_star', image:'ncgc-s.png', devices:{} },
    { label:'2 Bronze Stars', value:'two_bronze_stars', image:'ncgc-bb.png', devices:{} },
    { label:'Silver Star + Bronze Star', value:'silver_star_bronze_star', image:'ncgc-sb.png', devices:{} },
    { label:'Silver Star + 2 Bronze Stars', value:'silver_star_two_bronze_stars', image:'ncgc-sbb.png', devices:{} },
    { label:'2 Silver Stars', value:'two_silver_stars', image:'ncgc-ss.png', devices:{} },
    { label:'2 Silver Stars + Bronze Star', value:'two_silver_stars_bronze_star', image:'ncgc-ssb.png', devices:{} },
    { label:'3 Bronze Stars', value:'three_bronze_stars', image:'ncgc-bbb.png', devices:{} }
  ],
  'cadet_advisory_council_ribbon': [
    { label:'Group CAC / Basic Ribbon', value:'group', image:null, devices:{} },
    { label:'Wing CAC / Bronze Star', value:'wing_bronze_star', image:'cac-b.png', devices:{} },
    { label:'Region CAC / Silver Star', value:'region_silver_star', image:'cac-s.png', devices:{} },
    { label:'National CAC / Gold Star', value:'national_gold_star', image:'cac-g.png', devices:{} }
  ],
  'cadet_special_activity_ribbon': [
    { label:'1 Activity / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'2 Activities / 1 Bronze Star', value:'bronze_star_1', image:'ncsa02.png', devices:{} },
    { label:'3 Activities / 2 Bronze Stars', value:'bronze_star_2', image:'ncsa03.png', devices:{} },
    { label:'4 Activities / 3 Bronze Stars', value:'bronze_star_3', image:'ncsa04.png', devices:{} },
    { label:'5 Activities / 4 Bronze Stars', value:'bronze_star_4', image:'ncsa05.png', devices:{} },
    { label:'6 Activities / 1 Silver Star', value:'silver_star_1', image:'ncsa06.png', devices:{} },
    { label:'7 Activities / Silver Star + Bronze Star', value:'silver_star_bronze_star', image:'ncsa07.png', devices:{} },
    { label:'8 Activities / Silver Star + 2 Bronze Stars', value:'silver_star_two_bronze_stars', image:'ncsa08.png', devices:{} },
    { label:'9 Activities / Silver Star + 3 Bronze Stars', value:'silver_star_three_bronze_stars', image:'ncsa09.png', devices:{} }
  ],
  'encampment_ribbon': [
    { label:'1 Encampment / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'2 Encampments / 1 Bronze Clasp', value:'bronze_clasp_1', image:'encamp02.png', devices:{} },
    { label:'3 Encampments / 2 Bronze Clasps', value:'bronze_clasp_2', image:'encamp03.png', devices:{} },
    { label:'4 Encampments / 3 Bronze Clasps', value:'bronze_clasp_3', image:'encamp04.png', devices:{} },
    { label:'5 Encampments / 4 Bronze Clasps', value:'bronze_clasp_4', image:'encamp05.png', devices:{} },
    { label:'6 Encampments / 1 Silver Clasp', value:'silver_clasp_1', image:'encamp06.png', devices:{} },
    { label:'7 Encampments / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', image:'encamp07.png', devices:{} },
    { label:'8 Encampments / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', image:'encamp08.png', devices:{} },
    { label:'9 Encampments / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', image:'encamp09.png', devices:{} }
  ],
  'cap_senior_recruiter_ribbon': [
    { label:'7 Recruits / Basic Ribbon', value:'earned', image:null, devices:{} },
    { label:'17 Recruits / 1 Bronze Clasp', value:'bronze_clasp_1', image:'senrec02.png', devices:{} },
    { label:'27 Recruits / 2 Bronze Clasps', value:'bronze_clasp_2', image:'senrec03.png', devices:{} },
    { label:'37 Recruits / 3 Bronze Clasps', value:'bronze_clasp_3', image:'senrec04.png', devices:{} },
    { label:'47 Recruits / 4 Bronze Clasps', value:'bronze_clasp_4', image:'senrec05.png', devices:{} },
    { label:'57 Recruits / 1 Silver Clasp', value:'silver_clasp_1', image:'senrec06.png', devices:{} },
    { label:'67 Recruits / 2 Silver Clasps', value:'silver_clasp_2', image:'senrec11.png', devices:{} },
    { label:'77 Recruits / 3 Silver Clasps', value:'silver_clasp_3', image:'senrec16.png', devices:{} },
    { label:'87 Recruits / 4 Silver Clasps', value:'silver_clasp_4', image:'senrec21.png', devices:{} }
  ]
};

const SILVER_MEDAL_OF_VALOR_MAX_RIBBONS = 3;

function ribbonImageOptionList(id){
  const special = RIBBON_SPECIAL_IMAGE_OPTIONS[id] || null;
  if(!special) return null;
  return [
    { label:'- Select -', value:'', image:null, devices:{} },
    ...special
  ];
}

function getRibbonImageOverride(id, awardValue){
  // Composited award-count families render one base image at every level, with
  // the award count expressed as devices. Answer for them directly so every
  // consumer agrees - the rack, the gallery thumbnail and the PNG export - and
  // so the per-level artwork can be deleted.
  if(CAPUB_COMPOSITED_AWARD_FAMILIES[id]) return CAPUB_COMPOSITED_AWARD_FAMILIES[id];
  if(CAPUB_STAR_COMBO_FAMILIES[id]) return CAPUB_STAR_COMBO_FAMILIES[id];

  const mcchordOptions = globalThis.MCCHORD_RIBBON_VARIANTS?.[id];
  const options = Array.isArray(mcchordOptions) && mcchordOptions.length
    ? capubExtendMcchordOptionsTo84(id, mcchordOptions)
    : (RIBBON_SPECIAL_IMAGE_OPTIONS[id] || []);
  const match = options.find(opt => opt.value === awardValue);
  return match?.image || null;
}

function normalizeRibbonImageFileName(name){
  if(!name) return null;
  const n = String(name).trim();
  // User-supplied overrides may be written as either "eaker-star" or "eaker-star.png".
  // Browser image paths still need the real extension when the file is stored as a PNG.
  return /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(n) ? n : `${n}.png`;
}

function getRibbonImagePath(ribbonOrId){
  const id = typeof ribbonOrId === 'string' ? ribbonOrId : ribbonOrId?.id;
  if(isMilitaryRibbonId(id)) return getMilitaryRibbonAward(id)?.images?.ribbon || '';
  // The measured ribbon artwork (images/ribbons); devices are drawn on it by the engine.
  const art = window.CAPUBAssetIndex && CAPUBAssetIndex['ribbon-' + String(normalizeRibbonId(id)).replace(/_/g, '-')];
  if(art) return art;
  if(typeof ribbonOrId !== 'string' && ribbonOrId?.imageOverride){
    return `ribbons/${normalizeRibbonImageFileName(ribbonOrId.imageOverride)}`;
  }
  const awardValue = typeof ribbonOrId === 'string' ? (State.ribbonSelections?.[id]?.awardValue || '') : (ribbonOrId?.awardValue || '');
  const override = getRibbonImageOverride(id, awardValue);
  return override ? `ribbons/${normalizeRibbonImageFileName(override)}` : `ribbons/${normalizeRibbonId(id)}.png`;
}

function getRibbonDuplicateCountForSelection(id, awardValue){
  if(id === 'silver_medal_of_valor'){
    if(awardValue === 'silver_valor_2') return 2;
    if(awardValue === 'silver_valor_3') return 3;
  }
  return 1;
}

const miniMedalImages = {};
Object.assign(miniMedalImages, {
  'air_force_aerial_achievement_medal':'mini_medals/mcchord/m_usaf_aam01.webp',
  'silver_medal_of_valor':          'mini_medals/mcchord/m_silver.webp',
  'bronze_medal_of_valor':          'mini_medals/mcchord/m_bronze01.webp',
  'distinguished_service_award':    'mini_medals/mcchord/m_distin01.webp',
  'exceptional_service_award':      'mini_medals/mcchord/m_except01.webp',
  'meritorious_service_award':      'mini_medals/mcchord/m_meriti01.webp',
  'commander_commendation_award':   'mini_medals/mcchord/m_cmdrco01.webp',
  'cap_achievment_award':           'mini_medals/mcchord/m_AA01.webp',
  'lifesaving_award':               'mini_medals/mcchord/m_lifesa01.webp',
  'national_commander_unit_citation_award':'mini_medals/mcchord/m_unitci-nat01.webp',
  'unit_citation_award':            'mini_medals/mcchord/m_unitci01.webp',
  'national_commanders_citation':   'mini_medals/mcchord/m_natcmdrcom.webp',
  'cadet_certificate_of_proficiency':'mini_medals/mcchord/m_cadet_cop.webp',
  'frank_borman_falcon_award':      'mini_medals/mcchord/m_falcon.webp',
  'cap_gill_robb_wilson_ribbon':    'mini_medals/mcchord/m_wilson.webp',
  'cap_paul_e_garber_ribbon':       'mini_medals/mcchord/m_garber.webp',
  'cap_grover_loening_aerospace_ribbon':'mini_medals/mcchord/m_loening.webp',
  'cap_leadership_ribbon':          'mini_medals/mcchord/m_leader.webp',
  'cap_membership_ribbon':          'mini_medals/mcchord/m_member.webp',
  'cap_command_service_ribbon':     'mini_medals/mcchord/m_cmdser.webp',
  'cap_world_war_2_service_ribbon': 'mini_medals/mcchord/m_wartime.webp',
  'cap_senior_recruiter_ribbon':    'mini_medals/mcchord/m_senrec01.webp',
  'cap_bridgadier_general_charles_yaeger_ribbon':'mini_medals/mcchord/m_yeager.webp',
  'cap_a_scott_crossfield_ribbon':  'mini_medals/mcchord/m_crossf.webp',
  'crisis_ribbon':                  'mini_medals/mcchord/m_crisis.webp',
  'red_service_ribbon':             'mini_medals/mcchord/m_redser-02yr.webp',
  'search_find_ribbon':             'mini_medals/mcchord/m_find01.webp',
  'air_search_and_rescue_ribbon':   'mini_medals/mcchord/m_sar01.webp',
  'disaster_relief_ribbon':         'mini_medals/mcchord/m_disast01.webp',
  'iace_ribbon':                    'mini_medals/mcchord/m_iace01.webp',
  'spaatz_award':                   'mini_medals/mcchord/m_spaatz.webp',
  'eaker_award':                    'mini_medals/mcchord/m_eaker.webp',
  'earhart_award':                  'mini_medals/mcchord/m_earhar.webp',
  'mitchell_award':                 'mini_medals/mcchord/m_mitchel.webp',
  'national_cadet_competition_ribbon':'mini_medals/mcchord/m_ncc.webp',
  'national_color_guard_competition_ribbon':'mini_medals/mcchord/m_ncgc.webp',
  'encampment_ribbon':              'mini_medals/mcchord/m_encamp01.webp',
  'air_medal':                      'mini_medals/mcchord/m_airmedal.webp'
});

function getMiniMedalImagePath(ribbonOrId){
  const id = typeof ribbonOrId === 'string' ? ribbonOrId : ribbonOrId?.id;
  if(isMilitaryRibbonId(id)){
    const award = getMilitaryRibbonAward(id);
    const representation = window.CAPUBMilitary?.getAwardRepresentation?.(award,'MINIATURE_MEDAL');
    return representation?.available && representation.asset ? representation.asset : '';
  }
  const medalArt = window.CAPUBAssetIndex && CAPUBAssetIndex['medal-' + String(normalizeRibbonId(id)).replace(/_/g, '-') + '-miniature'];
  if(medalArt) return medalArt;
  const normalized = normalizeRibbonId(id);
  const base = miniMedalImages[normalized] || miniMedalImages[id] || '';
  if(!base) return '';

  const awardValue = typeof ribbonOrId === 'string'
    ? (State.ribbonSelections?.[id]?.awardValue || '')
    : (ribbonOrId?.awardValue || State.ribbonSelections?.[id]?.awardValue || '');
  const option = getRibbonSelectionOption(id, awardValue);
  // medalImage is set by composited award-count families, whose ribbon image is
  // one shared base; the medal still has its own per-level artwork.
  const medalSource = option?.medalImage || option?.image;
  if(!medalSource) return base;

  let medalFile = `m_${medalSource}`;
  if(id === 'commander_commendation_award'){
    medalFile = medalFile
      .replace(/NR(?=\.png$)/, 'sb')
      .replace(/N(?=\.png$)/, 's')
      .replace(/R(?=\.png$)/, 'b');
  }else if(id === 'lifesaving_award'){
    medalFile = medalFile.replace(/lifesa-star(\d+)\.png$/, 'lifesa$1s.png');
  }else if(id === 'search_find_ribbon'){
    medalFile = medalFile.replace(/find-prop(\d+)\.png$/, 'findP$1.png');
  }else if(id === 'air_search_and_rescue_ribbon'){
    medalFile = medalFile.replace(/sar-prop(\d+)\.png$/, 'sarP$1.png');
  }else if(id === 'disaster_relief_ribbon'){
    medalFile = medalFile.replace(/disast-V(\d+)\.png$/, 'disastV$1.png');
  }

  const variantAliases = {
    'm_silver01.png':'m_silver.png',
    'm_ncgc01.png':'m_ncgc.png',
    'm_mitchel-star.png':'m_mitchel_s.png',
    'm_eaker-star.png':'m_eaker_s.png',
    'm_wilson-b.png':'m_wilson_b.png',
    'm_wilson-s.png':'m_wilson_s.png',
    'm_wilson-g.png':'m_wilson_g.png',
    'm_garber-star.png':'m_garber_b.png',
    'm_garber-sstar.png':'m_garber_s.png',
    'm_garber-gstar.png':'m_garber_g.png',
    'm_cmdser-bronze.png':'m_cmdser_b.png',
    'm_cmdser-silver.png':'m_cmdser_s.png',
    'm_cmdser-gold.png':'m_cmdser_g.png',
    'm_cmdser-gold2.png':'m_cmdser_gg.png'
  };
  medalFile = variantAliases[medalFile] || medalFile;
  if(['cap_leadership_ribbon','national_cadet_competition_ribbon','national_color_guard_competition_ribbon'].includes(id)){
    medalFile = medalFile.replace(/-([bs]+)\.png$/, '_$1.png');
  }
  // The name above is derived from the ribbon variant filename, which is still
  // .png, but images/mini_medals is WebP since the optimizer ran. Without this
  // the first request for every device-variant medal would 404 and only find
  // the file on the fallback retry.
  medalFile = medalFile.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  return `mini_medals/mcchord/${medalFile}`;
}

/* ===========================
   BADGES / PATCHES
   =========================== */
const badgeList = [
  'AirCrew1_DB3F0FCC3650F','BalloonPilot1_442D89C94185B','CAPMasterPilot1_621A0E2ED15DA','CAPPilot1_FA9D33EA587D8','CAPSeniorPilot1_D9725AE959752','GliderPilot1_7BFB287379918','MasterAirCrew1_72AC4CAE7A310','MasterObserver1_1B88D5071FD5C','SeniorAirCrew1_B289BAE6E515C','SeniorObserver1_0E35802A29801',
  'buddist_chaplin','christian_chaplin','communications_technician_badge','communications_senior_badge','communications_master_badge','cyber_badges','emergency_services_badge','senior_emergency_services_badge','master_emergency_services_badge','volunteer_university_instructor_badge','basic_incident_commander_badge','incident_commander_2_badge','incident_commander_1_badge','cadet_programs_badge','administration_technician_badge','administration_senior_badge','administration_master_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge','finance_senior_badge','finance_master_badge','squadron_commander_badge','emt_basic_badge','emt_intermediate','emt_paramedic','ground_team_basic_badge','historian_technicianIbadge','information_technology_technician_badge','jewish_chaplin','legal_officer','master_ground_team_badge','medical_officer','model_rocketry_badge','muslim_chaplin','nra_marksman_badge','nurse_officer','observer_badge','pre_solo_badge','senior_ground_team_badge','solo_badge','stem_badges','uas_pilot_basic_badge','uas_pilot_senior_badge','uas_pilot_master_badge','uas_technician_basic_badge','uas_technician_senior_badge','uas_technician_master_badge'
];


// Robust badge asset resolver. This lets the program render badges even when the
// physical image files use human-friendly names instead of the internal badge ID.
const BADGE_IMAGE_OVERRIDES = {
  'master_emergency_services_badge': 'badges/Master_ES_Badge.webp',
  'senior_emergency_services_badge': 'badges/Senior_ES_Badge.webp',
  'volunteer_university_instructor_badge': 'badges/Vol_U_Badge.webp',
  'basic_incident_commander_badge': 'badges/Basic_Incident_Commander_Badge.webp',
  'incident_commander_2_badge': 'badges/incident_commander_2_badge.webp',
  'incident_commander_1_badge': 'badges/incident_commander_1_badge.webp',
  'cadet_programs_badge': 'badges/cadet programs badge.webp',
  'administration_technician_badge': 'badges/administration_technician_badge.png',
  'aerospace_education_technician_badge': 'badges/aerospace_education_technician_badge.webp',
  'aerospace_education_senior_badge': 'badges/aerospace_senior_badge.webp',
  'finance_technician_badge': 'badges/finance_technician_badge.webp',
  'administration_senior_badge': 'badges/administration_senior_badge.png',
  'administration_master_badge': 'badges/administration_master_badge.png',
  'aerospace_education_master_badge': 'badges/aerospace_education_master_badge.webp',
  'finance_senior_badge': 'badges/finance_senior_badge.png',
  'finance_master_badge': 'badges/finance_master_badge.png',
  'squadron_commander_badge': 'badges/Squadron Commander badge.webp',
  'communications_senior_badge': 'badges/communications_senior_badge.png',
  'communications_master_badge': 'badges/communications_master_badge.png',
  'uas_pilot_basic_badge': 'badges/cap_suas_pilot_badge.webp',
  'uas_pilot_senior_badge': 'badges/uas_pilot_senior_badge.webp',
  'uas_pilot_master_badge': 'badges/uas_pilot_master_badge.webp',
  'uas_technician_basic_badge': 'badges/uas_technician_basic_badge.webp',
  'uas_technician_senior_badge': 'badges/uas_technician_senior_badge.webp',
  'uas_technician_master_badge': 'badges/uas_technician_master_badge.webp',
  'cadet_programs_technician_badge': 'badges/cadet_programs_technician_badge_v2.webp',
  'cadet_programs_senior_badge': 'badges/cadet_programs_senior_badge_v2.webp',
  'cadet_programs_master_badge': 'badges/cadet_programs_master_badge_v2.webp'
};


// === CAPUB PATCH 2026-05-13: New badge image filenames in images/badges/ ===
// These overrides preserve the existing internal badge IDs where possible, while
// pointing them at the newly uploaded PNG filenames. New badges below are added
// into the normal badge gallery and use the same LP/RP specialty-track placement
// unless otherwise specified.
Object.assign(BADGE_IMAGE_OVERRIDES, {
  // Replacements for older/existing badge IDs
  'communications_technician_badge': 'badges/Comms_tech.webp',
  'communications_senior_badge': 'badges/Comms_senior.webp',
  'communications_master_badge': 'badges/Comms_master.webp',
  'stem_badges': 'badges/STEM_basic_badge.webp',
  'cyber_badges': 'badges/Cyber_basic_badge.webp',
  'legal_officer': 'badges/Legal_officer.webp',
  'nurse_officer': 'badges/Nurse.webp',
  'medical_officer': 'badges/Medical_officer.webp',
  'squadron_commander_badge': 'badges/Squadron Commander badge.webp',

  // New command/governance badges
  'group_commander_badge': 'badges/Group_commander_badge.webp',
  'senior_advisory_group_badge': 'badges/Senior_advisory_group_badge.webp',
  'national_executive_committee_badge': 'badges/National_Executive_Committee_Badge.webp',
  'command_council_badge': 'badges/Command_Council.webp',
  'cap_national_command_board_badge': 'badges/CAP_National_Command_Board.webp',
  'national_staff_badge': 'badges/national_staff_badge.webp',

  // Standardization / Evaluation
  'stan_eval_tech_badge': 'badges/Stan_eval_tech.webp',
  'stan_eval_senior_badge': 'badges/Stan_eval_senior.webp',
  'stan_eval_master_badge': 'badges/Stan_eval_master.webp',

  // Safety
  'safety_technician_badge': 'badges/Safety_tech.webp',
  'safety_senior_badge': 'badges/Safety_senior.webp',
  'safety_master_badge': 'badges/Safety_master.webp',

  // Recruiting and Retention
  'recruiting_retention_technician_badge': 'badges/Recruiter_tech.webp',
  'recruiting_retention_senior_badge': 'badges/Recruiter_senior.webp',
  'recruiting_retention_master_badge': 'badges/Recruiter_master.webp',

  // Public Affairs
  'public_affairs_technician_badge': 'badges/Public_affairs_tech.webp',
  'public_affairs_senior_badge': 'badges/Public_affairs_senior.webp',
  'public_affairs_master_badge': 'badges/Public_affairs_master.webp',

  // Professional Development
  'professional_development_technician_badge': 'badges/Professional_development_tech.webp',
  'professional_development_senior_badge': 'badges/Professional_development_senior.webp',
  'professional_development_master_badge': 'badges/Professional_development_master.webp',

  // Personnel
  'personnel_technician_badge': 'badges/Personnel_tech.webp',
  'personnel_senior_badge': 'badges/Personnel_senior.webp',
  'personnel_master_badge': 'badges/Personnel_master.webp',

  // Operations
  'operations_technician_badge': 'badges/Ops_tech.webp',
  'operations_senior_badge': 'badges/Ops_senior.webp',
  'operations_master_badge': 'badges/Ops_master.webp',

  // Logistics
  'logistics_technician_badge': 'badges/Logistics_tech.webp',
  'logistics_senior_badge': 'badges/Logistics_senior.webp',
  'logistics_master_badge': 'badges/Logistics_master.webp',

  // Inspector General
  'inspector_general_technician_badge': 'badges/IG_tech.webp',
  'inspector_general_senior_badge': 'badges/IG_senior.webp',
  'inspector_general_master_badge': 'badges/IG_master.webp',

  // Information Technology
  'information_technology_technician_badge': 'badges/IT_tech.webp',
  'information_technology_senior_badge': 'badges/IT_senior.webp',
  'information_technology_master_badge': 'badges/IT_master.webp',

  // Historian
  'historian_technicianIbadge': 'badges/Historian_tech.webp',
  'historian_senior_badge': 'badges/Historian_senior.webp',
  'historian_master_badge': 'badges/Historian_master.webp',

  // CDI
  'cdi_technician_badge': 'badges/CDI_tech.webp',
  'cdi_senior_badge': 'badges/CDI_senior.webp',
  'cdi_master_badge': 'badges/CDI_master.webp',

  // Administration
  'administration_technician_badge': 'badges/Admin_tech.webp',
  'administration_senior_badge': 'badges/Admin_senior.webp',
  'administration_master_badge': 'badges/Admin_master.webp',

  // Finance
  'finance_senior_badge': 'badges/Finance_senior.webp',
  'finance_master_badge': 'badges/Finance_master.webp',

  // Drug Demand Reduction
  'drug_demand_reduction_basic_badge': 'badges/Drug_Demand_Reduction_Basic_Badge.webp'
});

function getBadgeAssetPath(id){
  // The badge's dress artwork (or its field or cloth form when there is no dress form), at the
  // level the member chose for badges earned in levels.
  const cat = window.CAPUBBadgeCatalog;
  const level = State.badgeSelections?.[id]?.level;
  const art = cat && (cat.art(id, 'dress', level) || cat.art(id, 'field') || cat.art(id, 'cloth'));
  if(art && window.CAPUBAssetIndex && CAPUBAssetIndex[art]) return CAPUBAssetIndex[art];
  return BADGE_IMAGE_OVERRIDES[id] || `badges/${id}.webp`;
}
function titleCaseWords(str){
  return String(str || '')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
function addAssetCandidate(list, path){
  const clean = normalizeAssetSubpath(path);
  if(clean && !list.includes(clean)) list.push(clean);
}
function addAssetCandidateWithExtensions(list, basePath){
  const clean = normalizeAssetSubpath(basePath).replace(/\.(png|jpg|jpeg|webp)$/i, '');
  // webp first: badges, patches and base art are WebP since the optimizer ran,
  // so probing png first would cost a 404 on every fallback lookup. svg is gone
  // because the repo contains no svg assets at all.
  ['webp','png','jpg','jpeg'].forEach(ext => addAssetCandidate(list, `${clean}.${ext}`));
}
function getBadgeAssetCandidates(id){
  const candidates = [];
  const primary = getBadgeAssetPath(id);
  addAssetCandidate(candidates, primary);
  addAssetCandidateWithExtensions(candidates, `badges/${id}`);

  // Generic fallback variants for asset folders that use readable filenames
  // instead of the internal JS badge ID. These do not change the primary path;
  // they only prevent a blank render when the primary PNG is absent.
  const noBadge = String(id).replace(/_badge$/,'');
  const spaced = String(id).replace(/_/g,' ');
  const spacedNoBadge = noBadge.replace(/_/g,' ');
  const title = titleCaseWords(id);
  const titleNoBadge = titleCaseWords(noBadge);
  [
    noBadge,
    spaced,
    spacedNoBadge,
    title,
    titleNoBadge,
    `${titleNoBadge} Badge`,
    `${spacedNoBadge} badge`
  ].forEach(name => addAssetCandidateWithExtensions(candidates, `badges/${name}`));

  const extra = {
    communications_senior_badge: [
      'badges/communications_senior.png','badges/communications_senior_badge.png','badges/communications senior badge.png'
    ],
    communications_master_badge: [
      'badges/communications_master.png','badges/communications_master_badge.png','badges/communications master badge.png'
    ],
    uas_pilot_basic_badge: [
      'badges/uas_pilot_basic.png','badges/cap_suas_pilot_basic_badge.png','badges/UAS Pilot Basic Badge.png'
    ],
    uas_pilot_senior_badge: [
      'badges/uas_pilot_senior.png','badges/uas_pilot_senior_badge.webp','badges/UAS Pilot Senior Badge.png'
    ],
    uas_pilot_master_badge: [
      'badges/uas_pilot_master.png','badges/uas_pilot_master_badge.webp','badges/UAS Pilot Master Badge.png'
    ],
    administration_technician_badge: [
      'badges/administration_technician.png','badges/administration_technician_badge.png','badges/Administration Technician Badge.png'
    ],
    aerospace_education_technician_badge: [
      'badges/aerospace_education_technician.png','badges/aerospace_education_technician_badge.webp','badges/Aerospace Education Technician Badge.png'
    ],
    aerospace_education_senior_badge: [
      'badges/aerospace_senior_badge.webp','badges/aerospace_education_senior_badge.png','badges/aerospace_education_senior.png','badges/Aerospace Education Senior Badge.png'
    ],
    finance_technician_badge: [
      'badges/finance_technician.png','badges/finance_technician_badge.webp','badges/Finance Technician Badge.png'
    ],
    squadron_commander_badge: [
      'badges/Squadron Commander badge.webp','badges/Squadron_Commander_badge.png','badges/squadron_commander_badge.png','badges/squadron commander badge.webp'
    ],
    volunteer_university_instructor_badge: [
      'badges/Vol_U_Badge.webp','badges/volunteer_university_instructor_badge.png','badges/volunteer_university_badge.png'
    ],
    basic_incident_commander_badge: [
      'badges/Basic_Incident_Commander_Badge.webp','badges/basic_incident_commander_badge.webp'
    ],
    master_emergency_services_badge: [
      'badges/Master_ES_Badge.webp','badges/master_emergency_services_badge.png'
    ],
    senior_emergency_services_badge: [
      'badges/Senior_ES_Badge.webp','badges/senior_emergency_services_badge.png'
    ]
  };
  (extra[id] || []).forEach(path => addAssetCandidate(candidates, path));
  return candidates;
}

const allowedCadetBadges = new Set([
  // Cadet-only badges
  'model_rocketry_badge','cyber_badges','stem_badges','nra_marksman_badge',

  // Aviation / aircrew / observer badges cadets may earn in normal or rare circumstances
  'pre_solo_badge','solo_badge','CAPPilot1_FA9D33EA587D8',
  'observer_badge','SeniorObserver1_0E35802A29801',
  'AirCrew1_DB3F0FCC3650F','SeniorAirCrew1_B289BAE6E515C','MasterAirCrew1_72AC4CAE7A310',

  // UAS pilot badge levels cadets can technically earn in specific circumstances
  'uas_pilot_basic_badge','uas_pilot_senior_badge','uas_pilot_master_badge',

  // Emergency services / ground / EMS
  'ground_team_basic_badge','senior_ground_team_badge','master_ground_team_badge',
  'emt_basic_badge','emt_intermediate','emt_paramedic',
  'emergency_services_badge',

  // Cadet-authorized specialty-track badge exceptions
  'information_technology_technician_badge','historian_technicianIbadge',
  'communications_technician_badge','communications_senior_badge','communications_master_badge'
]);

const rareCadetBadges = new Set([
  'CAPPilot1_FA9D33EA587D8',
  'SeniorObserver1_0E35802A29801',
  'MasterAirCrew1_72AC4CAE7A310',
  'uas_pilot_senior_badge',
  'uas_pilot_master_badge'
]);


// Badges of the same kind at different levels: only the highest is worn (10.1.2). EMT and ground
// team badges are separate occupational badges and may be worn together. Only one command pin is
// worn (10.2.5).
const exclusiveBadges = [
  ['squadron_commander_badge','group_commander_badge'],
  ['basic_incident_commander_badge','incident_commander_2_badge'],
  ['basic_incident_commander_badge','incident_commander_1_badge'],
  ['incident_commander_2_badge','incident_commander_1_badge']
];

const badgeLocations = {
  // Aviation badges
  'AirCrew1_DB3F0FCC3650F':'OLP','BalloonPilot1_442D89C94185B':'OLP','CAPMasterPilot1_621A0E2ED15DA':'OLP','CAPPilot1_FA9D33EA587D8':'OLP','CAPSeniorPilot1_D9725AE959752':'OLP','GliderPilot1_7BFB287379918':'OLP','MasterAirCrew1_72AC4CAE7A310':'OLP',
  'SeniorAirCrew1_B289BAE6E515C':'OLP','pre_solo_badge':'OLP','solo_badge':'OLP','MasterObserver1_1B88D5071FD5C':'OLP','SeniorObserver1_0E35802A29801':'OLP','observer_badge':'OLP',
  'uas_pilot_basic_badge':'OLP','uas_pilot_senior_badge':'OLP','uas_pilot_master_badge':'OLP',
  'uas_technician_basic_badge':'OLP','uas_technician_senior_badge':'OLP','uas_technician_master_badge':'OLP',

  // Occupational badges per CAPR 39-1 Attachment 4
  'buddist_chaplin':'OLPA','christian_chaplin':'OLPA','jewish_chaplin':'OLPA','muslim_chaplin':'OLPA',
  'medical_officer':'OLPU','nurse_officer':'OLPU','emt_basic_badge':'OLPU','emt_intermediate':'OLPU','emt_paramedic':'OLPU','legal_officer':'OLPU',
  'ground_team_basic_badge':'OLPU','senior_ground_team_badge':'OLPU','master_ground_team_badge':'OLPU','basic_incident_commander_badge':'OLPU','incident_commander_2_badge':'OLPU','incident_commander_1_badge':'OLPU',

  // Specialty-track/service badge placement is dynamic by selection order:
  // first selected specialty badge = LP; second selected specialty badge = RP.
  'communications_technician_badge':'LP,RP',
  'communications_senior_badge':'LP,RP',
  'communications_master_badge':'LP,RP',
  'information_technology_technician_badge':'LP,RP',
  'historian_technicianIbadge':'LP,RP',
  'emergency_services_badge':'LP,RP',
  'senior_emergency_services_badge':'LP,RP',
  'master_emergency_services_badge':'LP,RP',
  'volunteer_university_instructor_badge':'LP,RP',
  'cadet_programs_badge':'LP,RP',
  'administration_technician_badge':'LP,RP',
  'aerospace_education_technician_badge':'LP,RP',
  'finance_technician_badge':'LP,RP',
  'cyber_badges':'LP,RP','stem_badges':'LP,RP',

  // Command insignia is chosen dynamically: current = ON, past/graduated = UN.
  'squadron_commander_badge':'ON',

  // Special cases
  'model_rocketry_badge':'LP,ON',
  'nra_marksman_badge':'OLPF'
};



const militaryRibbonVariantCache=new Map();
function capubLoadCompositeImage(src){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error(`Unable to load ${src}`));
    image.src=src;
  });
}
function militaryDeviceSequence(ribbonObj){
  if(Array.isArray(ribbonObj?.militaryDevices)) return [...ribbonObj.militaryDevices];
  const sequence=[];
  for(const [deviceId,count] of Object.entries(ribbonObj?.devices || {})){
    for(let index=0;index<Number(count || 0);index++) sequence.push(deviceId);
  }
  return sequence.sort((a,b)=>(deviceMeta[b]?.weight || 0)-(deviceMeta[a]?.weight || 0));
}
async function buildMilitaryRibbonVariant(ribbonObj){
  const basePath=getRibbonImagePath(ribbonObj);
  const devices=militaryDeviceSequence(ribbonObj);
  const key=`${basePath}|${devices.join(',')}`;
  if(militaryRibbonVariantCache.has(key)) return militaryRibbonVariantCache.get(key);
  const promise=(async()=>{
    const canvas=document.createElement('canvas');
    canvas.width=100; canvas.height=30;
    const context=canvas.getContext('2d');
    const base=await capubLoadCompositeImage(ASSET(basePath));
    context.drawImage(base,0,0,100,30);

    // Match the woven, shaded finish of the existing McChord 100x30 variants.
    context.save();
    context.globalCompositeOperation='soft-light';
    for(let x=0;x<100;x+=2){
      context.fillStyle=x%4===0?'rgba(255,255,255,.12)':'rgba(0,0,0,.08)';
      context.fillRect(x,0,1,30);
    }
    context.fillStyle='rgba(255,255,255,.09)'; context.fillRect(0,0,100,1);
    context.fillStyle='rgba(0,0,0,.16)'; context.fillRect(0,29,100,1);
    context.restore();

    const rendered=[];
    for(const deviceId of devices){
      const numeral=String(deviceId).match(/^NUMERAL_(\d{1,2})$/);
      const meta=deviceMeta[deviceId] || (numeral ? {
        label:`Numeral ${numeral[1]}`,
        src:`devices/mil-device-numeral-${Number(numeral[1])}.svg`,w:9,h:9,weight:6
      } : null);
      if(!meta) continue;
      try{
        const image=await capubLoadCompositeImage(ASSET(meta.src));
        const isCluster=deviceId.endsWith('_OLC');
        // Device source canvases are square. Preserve that aspect ratio here;
        // the oak-leaf glyph's own transparent padding provides its wide shape.
        rendered.push({deviceId,meta,image,width:isCluster?21:18,height:isCluster?21:18});
      }catch(error){ console.warn('[MILITARY RIBBON DEVICE]',error); }
    }
    const sizes=Object.fromEntries(rendered.map(item=>[item.deviceId,{width:item.width,height:item.height}]));
    const placements=window.CAPUBMilitaryDeviceLayout?.layoutDevices(
      rendered.map(item=>item.deviceId),{context:'ribbon',deviceSizes:sizes}
    ) || [];
    for(let index=0;index<rendered.length;index++){
      const item=rendered[index];
      const placement=placements[index] || {x:42,y:7,width:item.width,height:item.height};
      context.drawImage(item.image,placement.x,placement.y,placement.width,placement.height);
    }
    return canvas.toDataURL('image/png');
  })();
  militaryRibbonVariantCache.set(key,promise);
  return promise;
}
function getMilitaryPrecomposedRibbonAsset(ribbonObj){
  const awardId=militaryRibbonCatalogId(ribbonObj?.id);
  const service=String(ribbonObj?.militaryService || '').toUpperCase();
  const devices=militaryDeviceSequence(ribbonObj);
  if(!awardId || !service) return null;
  const signature=devices.length ? devices.join('+') : 'NONE';
  const key=`${awardId}::${service}::${signature}`;
  return (window.CAPUBMilitaryData?.deviceVariants?.ribbonAssets || [])
    .find(record=>record.key===key && record.asset) || null;
}
function applyMilitaryRibbonVariant(image,ribbonObj){
  if(!image || !isMilitaryRibbonId(ribbonObj?.id)) return;
  const token=`${ribbonObj.id}|${militaryDeviceSequence(ribbonObj).join(',')}`;
  image.dataset.militaryVariantToken=token;
  const precomposed=getMilitaryPrecomposedRibbonAsset(ribbonObj);
  if(precomposed?.asset){
    image.dataset.militaryVariantStrategy=precomposed.strategy || 'PRECOMPOSED_PNG';
    image.onerror=()=>{
      image.onerror=null;
      buildMilitaryRibbonVariant(ribbonObj).then(src=>{
        if(image.isConnected && image.dataset.militaryVariantToken===token) image.src=src;
      }).catch(error=>console.warn('[MILITARY RIBBON VARIANT]',error));
    };
    image.src=ASSET(precomposed.asset);
    return;
  }
  image.dataset.militaryVariantStrategy='DETERMINISTIC_RUNTIME_FALLBACK';
  buildMilitaryRibbonVariant(ribbonObj).then(src=>{
    if(image.isConnected && image.dataset.militaryVariantToken===token){
      image.onerror=null;
      image.src=src;
    }
  }).catch(error=>console.warn('[MILITARY RIBBON VARIANT]',error));
}

const militaryMedalVariantCache=new Map();


const CAPUB_ADDITIONAL_SPECIALTY_BADGE_IDS = [
  'administration_senior_badge','administration_master_badge',
  'aerospace_education_senior_badge','aerospace_education_master_badge',
  'finance_senior_badge','finance_master_badge',
  'cadet_programs_technician_badge','cadet_programs_senior_badge','cadet_programs_master_badge',
  'historian_senior_badge','historian_master_badge',
  'information_technology_senior_badge','information_technology_master_badge',
  'logistics_technician_badge','logistics_senior_badge','logistics_master_badge',
  'operations_technician_badge','operations_senior_badge','operations_master_badge',
  'personnel_technician_badge','personnel_senior_badge','personnel_master_badge',
  'professional_development_technician_badge','professional_development_senior_badge','professional_development_master_badge',
  'public_affairs_technician_badge','public_affairs_senior_badge','public_affairs_master_badge',
  'recruiting_retention_technician_badge','recruiting_retention_senior_badge','recruiting_retention_master_badge',
  'safety_technician_badge','safety_senior_badge','safety_master_badge',
  'inspector_general_technician_badge','inspector_general_senior_badge','inspector_general_master_badge',
  'drug_demand_reduction_technician_badge','drug_demand_reduction_senior_badge','drug_demand_reduction_master_badge'
];
CAPUB_ADDITIONAL_SPECIALTY_BADGE_IDS.forEach(id => {
  if(!badgeList.includes(id)) badgeList.push(id);
  SPECIALTY_TRACK_BADGE_IDS.add(id);
  POCKET_SERVICE_BADGE_IDS.add(id);
  SMALL_RIGHT_POCKET_SPECIALTY_BADGE_IDS.add(id);
  if(!badgeLocations[id]) badgeLocations[id] = 'LP,RP';
  FEMALE_OVER_NAMEPLATE_SPECIALTY_BADGE_IDS.add(id);
});



// === CAPUB PATCH 2026-05-13: Register newly supplied badges ===
const CAPUB_NEW_SPECIALTY_BADGE_IDS = [
  'stan_eval_tech_badge','stan_eval_senior_badge','stan_eval_master_badge',
  'cdi_technician_badge','cdi_senior_badge','cdi_master_badge',
  'drug_demand_reduction_basic_badge'
];

CAPUB_NEW_SPECIALTY_BADGE_IDS.forEach(id => {
  if(!badgeList.includes(id)) badgeList.push(id);
  SPECIALTY_TRACK_BADGE_IDS.add(id);
  POCKET_SERVICE_BADGE_IDS.add(id);
  SMALL_RIGHT_POCKET_SPECIALTY_BADGE_IDS.add(id);
  FEMALE_OVER_NAMEPLATE_SPECIALTY_BADGE_IDS.add(id);
  if(!badgeLocations[id]) badgeLocations[id] = 'LP,RP';
});

const CAPUB_NEW_COMMAND_BADGE_IDS = [
  'group_commander_badge'
];

const CAPUB_NEW_GOVERNANCE_SERVICE_BADGE_IDS = [
  'senior_advisory_group_badge',
  'national_executive_committee_badge',
  'command_council_badge',
  'cap_national_command_board_badge',
  'national_staff_badge'
];

CAPUB_NEW_COMMAND_BADGE_IDS.forEach(id => {
  if(!badgeList.includes(id)) badgeList.push(id);
  COMMAND_INSIGNIA_BADGE_IDS.add(id);
  if(!badgeLocations[id]) badgeLocations[id] = 'ON';
});

CAPUB_NEW_GOVERNANCE_SERVICE_BADGE_IDS.forEach(id => {
  if(!badgeList.includes(id)) badgeList.push(id);
  SPECIALTY_TRACK_BADGE_IDS.add(id);
  POCKET_SERVICE_BADGE_IDS.add(id);
  // The National Commander's Staff badge is always worn on the wearer's right (4.1.5.2.2.4.2).
  badgeLocations[id] = id === 'national_staff_badge' ? 'RP' : 'LP';
});

/* NEW: badge grouping for modal */
const BADGE_CATEGORIES = [
  { key:'Aviation', ids:[
    'CAPPilot1_FA9D33EA587D8','CAPSeniorPilot1_D9725AE959752','CAPMasterPilot1_621A0E2ED15DA',
    'AirCrew1_DB3F0FCC3650F','SeniorAirCrew1_B289BAE6E515C','MasterAirCrew1_72AC4CAE7A310',
    'observer_badge','SeniorObserver1_0E35802A29801','MasterObserver1_1B88D5071FD5C',
    'GliderPilot1_7BFB287379918','BalloonPilot1_442D89C94185B',
    'uas_pilot_basic_badge','uas_pilot_senior_badge','uas_pilot_master_badge',
    'uas_technician_basic_badge','uas_technician_senior_badge','uas_technician_master_badge',
    'solo_badge','pre_solo_badge'
  ]},
  { key:'Emergency Services / Ground', ids:[
    'emergency_services_badge','senior_emergency_services_badge','master_emergency_services_badge',
    'basic_incident_commander_badge','incident_commander_2_badge','incident_commander_1_badge','ground_team_basic_badge','senior_ground_team_badge','master_ground_team_badge'
  ]},
  { key:'Medical / EMS', ids:[
    'emt_basic_badge','emt_intermediate','emt_paramedic','medical_officer','nurse_officer'
  ]},
  { key:'Comms / IT / Cyber / STEM', ids:[
    'communications_technician_badge','communications_senior_badge','communications_master_badge',
    'information_technology_technician_badge','cyber_badges','stem_badges'
  ]},
  { key:'Professional Development / Cadet Programs', ids:[
    'volunteer_university_instructor_badge','cadet_programs_technician_badge','cadet_programs_senior_badge','cadet_programs_master_badge',
    'administration_technician_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge'
  ]},
  { key:'Command Insignia', ids:[
    'squadron_commander_badge','group_commander_badge'
  ]},
  { key:'Command Council / National Governance', ids:[
    'senior_advisory_group_badge','national_executive_committee_badge','command_council_badge','cap_national_command_board_badge','national_staff_badge'
  ]},
  { key:'Chaplain / Legal / Admin', ids:[
    'christian_chaplin','jewish_chaplin','muslim_chaplin','buddist_chaplin','legal_officer','historian_technicianIbadge',
    'administration_technician_badge','administration_senior_badge','administration_master_badge'
  ]},
  { key:'Specialty Tracks', ids:[
    'stan_eval_tech_badge','stan_eval_senior_badge','stan_eval_master_badge',
    'safety_technician_badge','safety_senior_badge','safety_master_badge',
    'recruiting_retention_technician_badge','recruiting_retention_senior_badge','recruiting_retention_master_badge',
    'public_affairs_technician_badge','public_affairs_senior_badge','public_affairs_master_badge',
    'professional_development_technician_badge','professional_development_senior_badge','professional_development_master_badge',
    'personnel_technician_badge','personnel_senior_badge','personnel_master_badge',
    'operations_technician_badge','operations_senior_badge','operations_master_badge',
    'logistics_technician_badge','logistics_senior_badge','logistics_master_badge',
    'inspector_general_technician_badge','inspector_general_senior_badge','inspector_general_master_badge',
    'information_technology_senior_badge','information_technology_master_badge',
    'historian_senior_badge','historian_master_badge',
    'cdi_technician_badge','cdi_senior_badge','cdi_master_badge',
    'drug_demand_reduction_technician_badge','drug_demand_reduction_senior_badge','drug_demand_reduction_master_badge'
  ]},
  { key:'Other', ids:[
    'model_rocketry_badge','nra_marksman_badge'
  ]}
];


// === CAPUB PATCH 2026-05-13: Badge picker grouping + member eligibility ===
// Senior members are not eligible for cadet-only STEM, Cyber, Model Rocketry, or NRA badges.
// Cadets only see their authorized badge set; cadet specialty badges are grouped together.
const SENIOR_INELIGIBLE_BADGES = new Set([
  'stem_badges','cyber_badges','model_rocketry_badge','nra_marksman_badge'
]);

function isSeniorAuthorized(id){
  return !SENIOR_INELIGIBLE_BADGES.has(id);
}

function isBadgeEligibleForMembership(id, membership = State.membership){
  if(membership === 'cadet') return isCadetAuthorized(id);
  if(membership === 'senior') return isSeniorAuthorized(id);
  return true;
}

function getEligibleBadgeIdsForMembership(membership = State.membership){
  const legacyAliases = new Set(['cadet_programs_badge','drug_demand_reduction_basic_badge']);
  return badgeList.filter(id => !legacyAliases.has(id) && isBadgeEligibleForMembership(id, membership));
}

const BADGE_DISPLAY_NAMES = Object.freeze({
  // Names for ids that read badly when title-cased: image hashes, abbreviations, old spellings.
  AirCrew1_DB3F0FCC3650F: 'Air Crew Badge',
  SeniorAirCrew1_B289BAE6E515C: 'Senior Air Crew Badge',
  MasterAirCrew1_72AC4CAE7A310: 'Master Air Crew Badge',
  CAPPilot1_FA9D33EA587D8: 'Pilot Badge',
  CAPSeniorPilot1_D9725AE959752: 'Senior Pilot Badge',
  CAPMasterPilot1_621A0E2ED15DA: 'Command Pilot Badge',
  SeniorObserver1_0E35802A29801: 'Senior Observer Badge',
  MasterObserver1_1B88D5071FD5C: 'Master Observer Badge',
  GliderPilot1_7BFB287379918: 'Glider Pilot Badge',
  BalloonPilot1_442D89C94185B: 'Balloon Pilot Badge',
  pre_solo_badge: 'Pre-Solo Badge',
  emt_basic_badge: 'EMT Basic Badge',
  emt_intermediate: 'EMT Intermediate Badge',
  emt_paramedic: 'EMT Paramedic Badge',
  nra_marksman_badge: 'NRA Marksmanship Badge',
  stem_badges: 'Cadet STEM Badge',
  cyber_badges: 'Cadet Cyber Badge',
  historian_technicianIbadge: 'Historian Technician Badge',
  buddist_chaplin: 'Buddhist Chaplain Badge',
  christian_chaplin: 'Christian Chaplain Badge',
  jewish_chaplin: 'Jewish Chaplain Badge',
  muslim_chaplin: 'Muslim Chaplain Badge',
  stan_eval_tech_badge: 'Standardization/Evaluation Technician Badge',
  stan_eval_senior_badge: 'Standardization/Evaluation Senior Badge',
  stan_eval_master_badge: 'Standardization/Evaluation Master Badge',
  cdi_technician_badge: 'Character Development Instructor Technician Badge',
  cdi_senior_badge: 'Character Development Instructor Senior Badge',
  cdi_master_badge: 'Character Development Instructor Master Badge',
  cap_national_command_board_badge: 'CAP National Command Board Badge',
  nurse_officer: 'Nurse Officer Badge',
  medical_officer: 'Medical Officer Badge',
  legal_officer: 'Legal Officer Badge',
  uas_pilot_basic_badge: 'sUAS Pilot Badge',
  uas_pilot_senior_badge: 'Senior sUAS Pilot Badge',
  uas_pilot_master_badge: 'Command sUAS Pilot Badge',
  uas_technician_basic_badge: 'sUAS Technician Badge',
  uas_technician_senior_badge: 'Senior sUAS Technician Badge',
  uas_technician_master_badge: 'Master sUAS Technician Badge',
  basic_incident_commander_badge: 'Basic Incident Commander Badge (IC3)',
  incident_commander_2_badge: 'Senior Incident Commander Badge (IC2)',
  incident_commander_1_badge: 'Master Incident Commander Badge (IC1)',
  cadet_programs_technician_badge: 'Cadet Programs Technician Badge',
  cadet_programs_senior_badge: 'Cadet Programs Senior Badge',
  cadet_programs_master_badge: 'Cadet Programs Master Badge',
  national_staff_badge: 'National Staff Badge',
  drug_demand_reduction_basic_badge: 'Drug Demand Reduction Basic Badge',
  drug_demand_reduction_technician_badge: 'Drug Demand Reduction Technician Badge',
  drug_demand_reduction_senior_badge: 'Drug Demand Reduction Senior Badge',
  drug_demand_reduction_master_badge: 'Drug Demand Reduction Master Badge'
});
function getBadgeDisplayName(id){
  return BADGE_DISPLAY_NAMES[id]
    || String(id || '').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
// The name with the chosen level, for badges earned in levels ("Cadet STEM Badge (Master)").
function getBadgeWornName(id){
  const lv = window.CAPUBBadgeCatalog?.levels(id) ? CAPUBBadgeCatalog.level(id, State.badgeSelections?.[id]?.level) : null;
  return lv ? `${getBadgeDisplayName(id)} (${lv[1]})` : getBadgeDisplayName(id);
}

const SENIOR_SPECIALTY_TRACK_GROUP_IDS = [
  'emergency_services_badge','senior_emergency_services_badge','master_emergency_services_badge',
  'communications_technician_badge','communications_senior_badge','communications_master_badge',
  'information_technology_technician_badge','information_technology_senior_badge','information_technology_master_badge',
  'historian_technicianIbadge','historian_senior_badge','historian_master_badge',
  'administration_technician_badge','administration_senior_badge','administration_master_badge',
  'aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge',
  'finance_technician_badge','finance_senior_badge','finance_master_badge',
  'volunteer_university_instructor_badge',
  'cadet_programs_technician_badge','cadet_programs_senior_badge','cadet_programs_master_badge',
  'logistics_technician_badge','logistics_senior_badge','logistics_master_badge',
  'operations_technician_badge','operations_senior_badge','operations_master_badge',
  'personnel_technician_badge','personnel_senior_badge','personnel_master_badge',
  'professional_development_technician_badge','professional_development_senior_badge','professional_development_master_badge',
  'public_affairs_technician_badge','public_affairs_senior_badge','public_affairs_master_badge',
  'recruiting_retention_technician_badge','recruiting_retention_senior_badge','recruiting_retention_master_badge',
  'safety_technician_badge','safety_senior_badge','safety_master_badge',
  'inspector_general_technician_badge','inspector_general_senior_badge','inspector_general_master_badge',
  'stan_eval_tech_badge','stan_eval_senior_badge','stan_eval_master_badge',
  'cdi_technician_badge','cdi_senior_badge','cdi_master_badge',
  'drug_demand_reduction_technician_badge','drug_demand_reduction_senior_badge','drug_demand_reduction_master_badge'
];

const CADET_SPECIALTY_TRACK_GROUP_IDS = [
  // Cadet-specific specialty badges
  'stem_badges','cyber_badges',
  // Cadet-authorized specialty-track badges
  'emergency_services_badge',
  'information_technology_technician_badge',
  'historian_technicianIbadge',
  'communications_technician_badge','communications_senior_badge','communications_master_badge'
];

function getBadgeCategoriesForCurrentMembership(){
  if(State.membership === 'cadet'){
    return [
      { key:'Aviation / Aircrew', ids:[
        'pre_solo_badge','solo_badge','CAPPilot1_FA9D33EA587D8',
        'observer_badge','SeniorObserver1_0E35802A29801',
        'AirCrew1_DB3F0FCC3650F','SeniorAirCrew1_B289BAE6E515C','MasterAirCrew1_72AC4CAE7A310',
        'uas_pilot_basic_badge','uas_pilot_senior_badge','uas_pilot_master_badge'
      ]},
      { key:'Emergency Services / Ground / EMS', ids:[
        'ground_team_basic_badge','senior_ground_team_badge','master_ground_team_badge',
        'emt_basic_badge','emt_intermediate','emt_paramedic'
      ]},
      { key:'Cadet Specialty Track Badges', ids:CADET_SPECIALTY_TRACK_GROUP_IDS },
      { key:'Cadet Activity / Marksmanship Badges', ids:[
        'model_rocketry_badge','nra_marksman_badge'
      ]}
    ];
  }

  if(State.membership === 'senior'){
    return [
      { key:'Aviation / Aircrew', ids:[
        'CAPPilot1_FA9D33EA587D8','CAPSeniorPilot1_D9725AE959752','CAPMasterPilot1_621A0E2ED15DA',
        'AirCrew1_DB3F0FCC3650F','SeniorAirCrew1_B289BAE6E515C','MasterAirCrew1_72AC4CAE7A310',
        'observer_badge','SeniorObserver1_0E35802A29801','MasterObserver1_1B88D5071FD5C',
        'GliderPilot1_7BFB287379918','BalloonPilot1_442D89C94185B',
        'uas_pilot_basic_badge','uas_pilot_senior_badge','uas_pilot_master_badge',
        'uas_technician_basic_badge','uas_technician_senior_badge','uas_technician_master_badge'
      ]},
      { key:'Emergency Services / Ground', ids:[
        'basic_incident_commander_badge','incident_commander_2_badge','incident_commander_1_badge','ground_team_basic_badge','senior_ground_team_badge','master_ground_team_badge'
      ]},
      { key:'Medical / EMS', ids:[
        'emt_basic_badge','emt_intermediate','emt_paramedic','medical_officer','nurse_officer'
      ]},
      { key:'Chaplain / Legal', ids:[
        'christian_chaplin','jewish_chaplin','muslim_chaplin','buddist_chaplin','legal_officer'
      ]},
      { key:'Senior Member Specialty Track Badges', ids:SENIOR_SPECIALTY_TRACK_GROUP_IDS },
      { key:'Command Insignia', ids:[
        'squadron_commander_badge','group_commander_badge'
      ]},
      { key:'Command Council / National Governance', ids:[
        'senior_advisory_group_badge','national_executive_committee_badge','command_council_badge','cap_national_command_board_badge','national_staff_badge'
      ]}
    ];
  }

  return BADGE_CATEGORIES;
}

const patchList = [
  'national_staff_ocp_patch',
  'ner_patch','nywg_patch','comms_patch','check_pilot_patch',
  'pjoc_ocp_patch',
  'pjoc_patch','nesa_patch','civil_engineering_academy_patch','cos_patch',
  'honor_guard_patch','engineering_academy_patch','nfa_patch','cla_patch',
  'proficient_pilot_patch','model_rocketry_patch','safety_patch','undergrad_pilot_training_patch',
  'nbb_patch','honor_guard_academy_patch','af_space_command_patch','dog_patch',
  'archer_patch','orientation_pilot_patch','cism_patch','plane_patch',
  'aerospace_education_patch','communications_patch'
];

const FIELD_BASE_BUILT_IN_PATCH_IDS = new Set(['us_flag_patch','aux_duty_identifier']);

const PATCH_META = {
  'national_staff_ocp_patch':{
    label:'National Staff OCP Sleeve Patch',
    slotHint:'L_SHOULDER',
    w:70,h:70,
    img:'badges/utility/national_staff_badge.webp',
    authorizedUniforms:['ocp'],
    allowedMemberships:['senior'],
    sourceBadgeId:'national_staff_badge'
  },
   // Previously added field-uniform patches.
  'ner_patch':{label:'Northeast Region Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/ner_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'nywg_patch':{label:'New York Wing Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/nywg_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'comms_patch':{label:'Communications Patch', slotHint:'CHEST_RIGHT', w:70,h:70, img:'patches/comms_patch.webp', authorizedUniforms:['abu','flight_suit','corporate_field'], requiresSpecialty:'communications_technician'},
  'check_pilot_patch':{label:'Check Pilot Patch', slotHint:'CHEST_LEFT', w:70,h:70, img:'patches/check_pilot_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},

  // OCP-specific patch assets added May 2026. Files are under images/patches/ocp/.
  'pjoc_ocp_patch':{label:'PJOC OCP Patch', slotHint:'L_SHOULDER', w:200,h:100, img:'patches/ocp/pjoc_ocp_patch.webp', authorizedUniforms:['ocp']},
  'tn185_ocp_patch':{label:'SER-TN-185 Music City Composite Squadron Unit Patch', slotHint:'R_SHOULDER', w:200,h:100, img:'patches/ocp/TN-185_ocp_patch.webp', authorizedUniforms:['abu','ocp','corporate_field']},

  // New field-uniform patches added May 2026. Files are under images/patches/.
  'pjoc_patch':{label:'PJOC Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/pjoc_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'nesa_patch':{label:'NESA Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/nesa_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'civil_engineering_academy_patch':{label:'Civil Engineering Academy Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/civil_engineering_academy_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'cos_patch':{label:'Cadet Officer School Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/cos_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'honor_guard_patch':{label:'Honor Guard Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/honor_guard_patch.webp', authorizedUniforms:['abu','flight_suit','corporate_field']},
  'engineering_academy_patch':{label:'Engineering Academy Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/engineering_academy_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'nfa_patch':{label:'National Flight Academy Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/nfa_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'cla_patch':{label:'Civic Leadership Academy Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/cla_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'proficient_pilot_patch':{label:'Proficient Pilot Patch', slotHint:'CHEST_LEFT', w:70,h:70, img:'patches/proficient_pilot_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'model_rocketry_patch':{label:'Model Rocketry Patch', slotHint:'CHEST_RIGHT', w:70,h:70, img:'patches/model_rocketry_patch.webp', authorizedUniforms:['abu','flight_suit','corporate_field'], allowedMemberships:['cadet']},
  'safety_patch':{label:'Safety Patch', slotHint:'CHEST_RIGHT', w:70,h:70, img:'patches/safety_patch.webp', authorizedUniforms:['abu','flight_suit','corporate_field'], allowedMemberships:['senior']},
  'undergrad_pilot_training_patch':{label:'Undergraduate Pilot Training Patch', slotHint:'CHEST_LEFT', w:70,h:70, img:'patches/undergrad_pilot_training_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'nbb_patch':{label:'National Blue Beret Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/nbb_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'honor_guard_academy_patch':{label:'Honor Guard Academy Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/honor_guard_academy_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'af_space_command_patch':{label:'Air Force Space Command Patch', slotHint:'L_SHOULDER', w:70,h:70, img:'patches/af_space_command_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'dog_patch':{label:'DOG Patch', slotHint:'CHEST_LEFT', w:70,h:70, img:'patches/dog_patch.webp', authorizedUniforms:['ocp','flight_suit','corporate_field']},
  'archer_patch':{label:'ARCHER Patch', slotHint:'CHEST_LEFT', w:70,h:70, img:'patches/archer_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'orientation_pilot_patch':{label:'Orientation Pilot Patch', slotHint:'CHEST_LEFT', w:70,h:70, img:'patches/orientation_pilot_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'cism_patch':{label:'CISM Patch', slotHint:'CHEST_RIGHT', w:70,h:70, img:'patches/cism_patch.webp', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'plane_patch':{label:'Plane Patch', slotHint:'CHEST_LEFT', w:70,h:70, img:'patches/plane_patch.webp', authorizedUniforms:['ocp','flight_suit','corporate_field']},

  // Legacy patch IDs kept for backward compatibility with older saved setups.
  'aerospace_education_patch':{label:'Aerospace Education Patch', slotHint:'CHEST_LEFT', w:60,h:60, img:'patches/aerospace_education_patch.png', authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'communications_patch':{label:'Legacy Communications Patch', slotHint:'CHEST_RIGHT', w:60,h:60, img:'patches/communications_patch.png', authorizedUniforms:['abu','flight_suit','corporate_field'], requiresSpecialty:'communications_technician'}
};

// CAP_UNIT_OPTIONS lives in data/unit-options.js (loaded above), keeping a 102 KB single-line literal out of this file.
const CAP_UNIT_OPTIONS = window.CAP_UNIT_OPTIONS || [];

const UNIT_PATCH_IMAGE_BY_CHARTER = {
  'SER-TN-185':'tn185_ocp_patch'
};

function getUnitPatchIdForCharter(code = State.unitPatchCharter){
  return UNIT_PATCH_IMAGE_BY_CHARTER[String(code || '').trim()] || null;
}

function getSelectedUnitPatchId(){
  return getUnitPatchIdForCharter(State.unitPatchCharter);
}

function isUnitPatchAuthorizedForCurrentUniform(){
  const patchId = getSelectedUnitPatchId();
  return !!patchId && isPatchAuthorizedForUniform(patchId);
}

function getUnitPatchSelectionLabel(code){
  const unit = CAP_UNIT_OPTIONS.find(u => u.code === code);
  return unit ? `${unit.code} - ${unit.name}` : String(code || '');
}

function renderUnitPatchStatus(){
  const status = by('unitPatchStatus');
  if(!status) return;
  if(!State.unitPatchCharter){
    status.textContent = 'No unit patch selected.';
    return;
  }
  const patchId = getSelectedUnitPatchId();
  if(!patchId){
    status.textContent = `${getUnitPatchSelectionLabel(State.unitPatchCharter)} selected. No image asset is available for this charter yet.`;
    return;
  }
  if(!isPatchAuthorizedForUniform(patchId)){
    status.textContent = `${getUnitPatchSelectionLabel(State.unitPatchCharter)} has an image asset, but it is not authorized for the current uniform selection.`;
    return;
  }
  status.textContent = `${getUnitPatchSelectionLabel(State.unitPatchCharter)} will render as the unit patch.`;
}

function buildUnitPatchSelector(filterText=''){
  const sel = by('unitPatchSelect');
  if(!sel) return;

  const normalized = String(filterText || '').trim().toLowerCase();
  const selected = State.unitPatchCharter || '';
  const matches = CAP_UNIT_OPTIONS.filter(unit => {
    if(!normalized) return true;
    return `${unit.code} ${unit.name}`.toLowerCase().includes(normalized);
  });

  sel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'No unit patch';
  sel.appendChild(none);

  matches.slice(0, 350).forEach(unit => {
    const opt = document.createElement('option');
    opt.value = unit.code;
    const hasPatch = !!UNIT_PATCH_IMAGE_BY_CHARTER[unit.code];
    opt.textContent = `${unit.code} - ${unit.name}${hasPatch ? '  ✓ patch available' : ''}`;
    sel.appendChild(opt);
  });

  if(selected && !matches.some(unit => unit.code === selected)){
    const unit = CAP_UNIT_OPTIONS.find(u => u.code === selected);
    const opt = document.createElement('option');
    opt.value = selected;
    opt.textContent = unit ? `${unit.code} - ${unit.name}  (selected)` : `${selected}  (selected)`;
    sel.appendChild(opt);
  }

  sel.value = selected;
  renderUnitPatchStatus();
}

const ALTERNATES = {
  badgeToPatch: {
    'national_staff_badge':'national_staff_ocp_patch',
    'communications_technician_badge':'comms_patch',
    'communications_senior_badge':'comms_patch',
    'communications_master_badge':'comms_patch'
  },
  patchToBadge: {
    'national_staff_ocp_patch':'national_staff_badge',
    'comms_patch':'communications_technician_badge',
    'communications_patch':'communications_technician_badge'
  },
  ribbonToPatch:{ 'cap_cadet_orientation_pilot_ribbon':'orientation_pilot_patch' },
  patchToRibbon:{ 'orientation_pilot_patch':'cap_cadet_orientation_pilot_ribbon' }
};

function normalizeUniformKeyForPatches(uniformId = State.uniform){
  const u = String(uniformId || '').toLowerCase();
  if(u === 'cfu') return 'corporate_field';
  if(u === 'cfdu' || u.includes('cfdu')) return 'cfdu';
  if(u === 'fdu') return 'flight_suit';
  if(u.includes('ocp')) return 'ocp';
  if(u.includes('abu')) return 'abu';
  if(u.includes('flight')) return 'flight_suit';
  if(u.includes('corporate') || u.includes('field')) return 'corporate_field';
  return u;
}

function isPatchAuthorizedForUniform(patchId, uniformId = State.uniform, membership = State.membership){
  const meta = PATCH_META[patchId];
  if(!meta) return false;

  const allowedUniforms = meta.authorizedUniforms || ['abu','ocp','flight_suit','corporate_field','cfdu'];
  const uniformOk = allowedUniforms.includes(normalizeUniformKeyForPatches(uniformId));
  if(!uniformOk) return false;

  const allowedMemberships = meta.allowedMemberships || null;
  if(allowedMemberships && !allowedMemberships.includes(membership)) return false;

  return true;
}

function getPatchAuthorizationReason(patchId, uniformId = State.uniform, membership = State.membership){
  const meta = PATCH_META[patchId];
  if(!meta) return 'Unknown patch.';

  const uniformKey = normalizeUniformKeyForPatches(uniformId);
  const allowedUniforms = meta.authorizedUniforms || ['abu','ocp','flight_suit','corporate_field','cfdu'];
  if(!allowedUniforms.includes(uniformKey)){
    if(patchId === 'comms_patch' || patchId === 'communications_patch') return 'Communications patch is not authorized on OCP.';
    if(patchId === 'model_rocketry_patch') return 'Model Rocketry patch is not authorized on OCP.';
    if(patchId === 'safety_patch') return 'Safety patch is not authorized on OCP.';
    if(patchId === 'honor_guard_patch') return 'Honor Guard patch is not authorized on OCP; Honor Guard Academy patch is authorized.';
    if(patchId === 'dog_patch' || patchId === 'plane_patch') return 'This patch is not authorized on ABUs.';
    return `Not authorized on ${String(uniformKey || 'this uniform').toUpperCase().replaceAll('_',' ')}.`;
  }

  const allowedMemberships = meta.allowedMemberships || null;
  if(allowedMemberships && !allowedMemberships.includes(membership)){
    if(patchId === 'model_rocketry_patch') return 'Model Rocketry patch is cadet-only.';
    if(patchId === 'safety_patch') return 'Safety patch is senior-member-only.';
    return `Authorized only for: ${allowedMemberships.join(', ')}.`;
  }

  return '';
}

function isCommsPatchId(patchId){
  return patchId === 'comms_patch' || patchId === 'communications_patch';
}

function clearUnauthorizedPatchesForCurrentUniform(){
  normalizePatchSelections();
  let changed = false;

  for(const id of Object.keys(State.patchSelections || {})){
    if(State.patchSelections[id]?.checked && !isPatchAuthorizedForUniform(id)){
      State.patchSelections[id].checked = false;
      changed = true;
    }
  }

  const before = State.patches.length;
  State.patches = (State.patches || []).filter(id => isPatchAuthorizedForUniform(id));
  if(before !== State.patches.length) changed = true;

  return changed;
}

function memberReportHasCommunicationsTechnicianSpecialty(text){
  const rows = (typeof parseMemberReportSpecialtyTracks === 'function')
    ? parseMemberReportSpecialtyTracks(text)
    : [];

  if(rows.length){
    return rows.some(row => {
      const name = normalizeSpecialtyTrackName(row.name);
      const level = normalizeSpecialtyTrackLevel(row.level);
      return row.eligible && /COMMUNICATIONS?/.test(name) && /TECHNICIAN|SENIOR|MASTER/.test(level);
    });
  }

  const t = String(text || '').replace(/\s+/g, ' ');
  return /Specialty\s+Tracks[\s\S]{0,3000}Communications?[\s\S]{0,160}(Technician|Senior|Master)/i.test(t) ||
         /Communications?[\s\S]{0,160}(Technician|Senior|Master)/i.test(t);
}

const rankListAll = [...RANKS.senior, ...RANKS.cadet];

// Membership test for badge placement. Replaces the old "does a preloaded
// <img id=badges-{id}> exist" probe, so placement no longer depends on every
// badge image having been fetched up front.
const KNOWN_BADGE_IDS = new Set(badgeList);
