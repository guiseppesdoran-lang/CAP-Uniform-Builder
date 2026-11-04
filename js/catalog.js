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
  polo:{male:'garments/garment-polo-male.svg',                          female:'garments/garment-polo-female.svg',                         ribbons:false, mini:false},
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
  polo:{ showBadges:true, showPatches:false },
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
// JROTC and ROTC ribbons (CAPR 39-1 11.2.5): the order of wear puts them after every CAP ribbon (11.2.1), so they
// come last in the list. data/rotc-ribbons.js is generated from the sheets in images/ribbons/military.
const ROTC_RIBBONS = window.CAPUBRotcRibbons || { limit:3, ref:'11.2.5', services:[], ribbons:[], isRotcRibbonId:()=>false, get:()=>null };
function isRotcRibbonId(id){ return ROTC_RIBBONS.isRotcRibbonId(id); }
ribbonList.push(...ROTC_RIBBONS.ribbons.map(r => r.id));

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
  // JROTC/ROTC ribbons are awarded by the military departments, so the military awards' rule covers them (11.1.6, 11.2.5).
  return CAPUBUniformRules.isAwardAllowedOnUniform(id, uniformId, {isMilitary:isMilitaryRibbonId(id) || isRotcRibbonId(id)});
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
  if(isRotcRibbonId(id)) return ROTC_RIBBONS.get(id).name;
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
  {key:'cadet', label:'Cadet program awards', seniorLabel:'Cadet awards', seniorNote:'One cadet award ribbon is worn, the highest. Every cadet milestone award earned may be worn as a miniature medal on the mess dress and the corporate semi-formal (CAPR 39-1 11.1.4).', ids:['spaatz_award','eaker_award','earhart_award','mitchell_award','armstrong_achievement','goddard_achievement','doolittle_achievement','lindbergh_achievement','rickenbacker_achievement','wright_brothers_award','mary_feik_achievement','hap_arnold_achievement','curry_achievement','cadet_certificate_of_proficiency','historic_cadet_blue_achievement','historic_cadet_white_achievement','historic_cadet_red_achievement','frank_borman_falcon_award']},
  {key:'service', label:'Service', ids:['cap_command_service_ribbon','crisis_ribbon','red_service_ribbon','afa_award','afsa_award','vfw_officer_award','vfw_nco_award']},
  {key:'activity', label:'Activity', ids:['search_find_ribbon','air_search_and_rescue_ribbon','cap_counterdrug_ribbon','disaster_relief_ribbon','homeland_security_ribbon','cap_cadet_orientation_pilot_ribbon','community_service_ribbon','iace_ribbon','national_cadet_competition_ribbon','national_color_guard_competition_ribbon','cadet_advisory_council_ribbon','cadet_special_activity_ribbon','encampment_ribbon','cadet_recruiter_ribbon','cap_senior_recruiter_ribbon']},
  {key:'wartime', label:'Wartime service (1942\u20131945)', ids:['air_medal','cap_world_war_2_service_ribbon','anti_submarine_coastal_patrol_ribbon','southern_liaison_patrol_ribbon','tow_target_tracking_ribbon','courier_ribbon','forest_patrol_ribbon','missing_aircraft_ribbon']},
  // JROTC/ROTC ribbons come after the CAP awards and before foreign ones (11.2.1); three at most, while enrolled (11.2.5).
  ...ROTC_RIBBONS.services.map(service => ({
    key:'rotc-' + service.key, label:service.label + ' ribbons', ids:ROTC_RIBBONS.ribbons.filter(r => r.service === service.key).map(r => r.id),
    note:`Worn after the CAP ribbons, at most ${ROTC_RIBBONS.limit} in all, only while enrolled in the program (CAPR 39-1, ${ROTC_RIBBONS.ref})`
  })),
];
// Groups for one list of ids, in regulation order. Anything not placed lands in "Other".
function groupRibbonIds(ids, membership = State.membership){
  const placed = new Set();
  const groups = [];
  for(const group of RIBBON_GROUPS){
    const members = group.ids.filter(id => ids.includes(id));
    members.forEach(id => placed.add(id));
    if(members.length) groups.push({key:group.key, label:(membership === 'senior' && group.seniorLabel) || group.label, note:(membership === 'senior' && group.seniorNote) || group.note || '', ids:members});
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
ROTC_RIBBONS.ribbons.forEach(r => COMMON_ELIGIBLE_RIBBONS.add(r.id)); // enrolled cadets and senior members alike (39-3 Attachment 2)
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
   RIBBON LEVELS
   ===========================
   The levels a ribbon's dropdown offers, by award. The devices each level carries come from
   data/ribbon-awards.js; the ribbon itself is the measured sheet in images/ribbons.
*/
const RIBBON_SPECIAL_IMAGE_OPTIONS = {
  // Honor-credit variants for Cadet Achievements 1-8.
  'curry_achievement': [
    { label:'Earned', value:'earned', devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', devices:{} }
  ],
  'hap_arnold_achievement': [
    { label:'Earned', value:'earned', devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', devices:{} }
  ],
  'mary_feik_achievement': [
    { label:'Earned', value:'earned', devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', devices:{} }
  ],
  'rickenbacker_achievement': [
    { label:'Earned', value:'earned', devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', devices:{} }
  ],
  'lindbergh_achievement': [
    { label:'Earned', value:'earned', devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', devices:{} }
  ],
  'doolittle_achievement': [
    { label:'Earned', value:'earned', devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', devices:{} }
  ],
  'goddard_achievement': [
    { label:'Earned', value:'earned', devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', devices:{} },
    { label:'Earned + Model Rocketry (Mitchell required)', value:'rocketry_star', devices:{} },
    { label:'Earned + Honor Credit and Model Rocketry', value:'honor_credit_and_rocketry', devices:{} }
  ],
  'armstrong_achievement': [
    { label:'Earned', value:'earned', devices:{} },
    { label:'Earned with Honor Credit', value:'honor_credit', devices:{} }
  ],
  'mitchell_award': [
    { label:'Earned', value:'earned', devices:{} },
    { label:'Earned + COS Graduate Star', value:'earned_cos_star', devices:{} }
  ],
  // COS graduate star on the highest cadet milestone ribbon.
  'eaker_award': [
    { label:'Earned', value:'earned', devices:{} },
    { label:'Earned + COS Star', value:'earned_cos_star', devices:{} }
  ],
  'bronze_medal_of_valor': [
    { label:'Basic Award', value:'earned', devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} }
  ],
  'distinguished_service_award': [
    { label:'Basic Award', value:'earned', devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', devices:{} }
  ],
  'exceptional_service_award': [
    { label:'Basic Award', value:'earned', devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', devices:{} }
  ],
  'meritorious_service_award': [
    { label:'Basic Award', value:'earned', devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', devices:{} }
  ],
  'commander_commendation_award': [
    { label:'Wing Commander / Basic Ribbon', value:'earned', devices:{} },
    { label:'Wing Level Multiple Award / 1 Bronze Clasp', value:'wing_bronze_clasp_1', devices:{} },
    { label:'Wing Level Multiple Award / 2 Bronze Clasps', value:'wing_bronze_clasp_2', devices:{} },
    { label:'Region Commander / Bronze Star', value:'region_bronze_star', devices:{} },
    { label:'National Commander / Silver Star', value:'national_silver_star', devices:{} },
    { label:'National Commander / Silver Star + 1 Bronze Clasp', value:'national_silver_star_bronze_clasp_1', devices:{} },
    { label:'National Commander / Silver Star + 2 Bronze Clasps', value:'national_silver_star_bronze_clasp_2', devices:{} },
    { label:'Region Commander / Bronze Star + 1 Bronze Clasp', value:'region_bronze_star_bronze_clasp_1', devices:{} },
    { label:'National + Region + Wing / Silver Star + Bronze Star + Bronze Clasp', value:'national_region_wing', devices:{} }
  ],
  'cap_achievment_award': [
    { label:'Basic Award', value:'earned', devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', devices:{} }
  ],
  'lifesaving_award': [
    { label:'Basic Award', value:'earned', devices:{} },
    { label:'Lifesaving Action / Silver Star', value:'silver_star', devices:{} },
    { label:'Subsequent Award / Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'Silver Star + 1 Bronze Clasp', value:'silver_star_bronze_clasp_1', devices:{} },
    { label:'2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'Silver Star + 2 Bronze Clasps', value:'silver_star_bronze_clasp_2', devices:{} },
    { label:'3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'Silver Star + 2 Bronze Clasps + Additional Lifesaving Ribbon', value:'silver_star_bronze_clasp_2_plus_base', devices:{}, duplicates:[{ awardLabel:'Additional Lifesaving Award' }] }
  ],
  'national_commander_unit_citation_award': [
    { label:'Basic Award', value:'earned', devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', devices:{} }
  ],
  'unit_citation_award': [
    { label:'Basic Award', value:'earned', devices:{} },
    { label:'2nd Award / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'5th Award / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'6th Award / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'7th Award / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', devices:{} },
    { label:'8th Award / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', devices:{} },
    { label:'9th Award / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', devices:{} }
  ],
  'cap_gill_robb_wilson_ribbon': [
    { label:'Level V / No PME Star', value:'earned', devices:{} },
    { label:'SOS / Bronze Star', value:'sos_bronze_star', devices:{} },
    { label:'ACSC / Silver Star', value:'acsc_silver_star', devices:{} },
    { label:'AWC / Gold Star', value:'awc_gold_star', devices:{} }
  ],
  'cap_paul_e_garber_ribbon': [
    { label:'Level IV / No PME Star', value:'earned', devices:{} },
    { label:'SOS / Bronze Star', value:'sos_bronze_star', devices:{} },
    { label:'ACSC / Silver Star', value:'acsc_silver_star', devices:{} },
    { label:'AWC / Gold Star', value:'awc_gold_star', devices:{} }
  ],
  'cap_leadership_ribbon': [
    { label:'Technician Rating / Basic Ribbon', value:'earned', devices:{} },
    { label:'Senior Rating / Bronze Star', value:'senior_bronze_star', devices:{} },
    { label:'Master Rating / Silver Star', value:'master_silver_star', devices:{} },
    { label:'2 Bronze Stars', value:'two_bronze_stars', devices:{} },
    { label:'Silver Star + Bronze Star', value:'silver_star_bronze_star', devices:{} },
    { label:'Silver Star + 2 Bronze Stars', value:'silver_star_two_bronze_stars', devices:{} },
    { label:'2 Silver Stars', value:'two_silver_stars', devices:{} },
    { label:'3 Bronze Stars', value:'three_bronze_stars', devices:{} }
  ],
  'cap_command_service_ribbon': [
    { label:'Squadron Commander / Basic Ribbon', value:'earned', devices:{} },
    { label:'Group Commander / Bronze Star', value:'group_bronze_star', devices:{} },
    { label:'Wing Commander / Silver Star', value:'wing_silver_star', devices:{} },
    { label:'Region Commander / Gold Star', value:'region_gold_star', devices:{} },
    { label:'National Commander / 2 Gold Stars', value:'national_two_gold_stars', devices:{} }
  ],
  'red_service_ribbon': [
    { label:'2 Years / Basic Ribbon', value:'years_2', devices:{} },
    { label:'5 Years / 1 Bronze Clasp', value:'years_5', devices:{} },
    { label:'10 Years / 2 Bronze Clasps', value:'years_10', devices:{} },
    { label:'15 Years / 3 Bronze Clasps', value:'years_15', devices:{} },
    { label:'20 Years / Longevity Device', value:'years_20', devices:{} },
    { label:'25 Years / Silver Clasp', value:'years_25', devices:{} },
    { label:'30 Years / Silver Clasp + Bronze Clasp', value:'years_30', devices:{} },
    { label:'35 Years / Silver Clasp + 2 Bronze Clasps', value:'years_35', devices:{} },
    { label:'40 Years / Silver Clasp + 3 Bronze Clasps', value:'years_40', devices:{} }
  ],
  'search_find_ribbon': [
    { label:'Basic Find', value:'find_1', devices:{} },
    { label:'Aircrew Find / Bronze Propeller', value:'bronze_propeller', devices:{} },
    { label:'Additional Distress Find / Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'Bronze Propeller + 1 Bronze Clasp', value:'bronze_propeller_bronze_clasp_1', devices:{} },
    { label:'3rd Distress Find / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'Bronze Propeller + 2 Bronze Clasps', value:'bronze_propeller_bronze_clasp_2', devices:{} },
    { label:'4th Distress Find / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'4th Find (Aircrew) / Bronze Propeller + 2 Bronze Clasps + Additional Ribbon', value:'bronze_propeller_bronze_clasp_2_plus_base', devices:{}, duplicates:[{ awardLabel:'Additional Find Ribbon' }] },
    { label:'5th Distress Find / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} }
  ],
  'air_search_and_rescue_ribbon': [
    { label:'10 Sorties / Basic Ribbon', value:'earned', devices:{} },
    { label:'20 Sorties / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'Aircrew Sorties / Bronze Propeller', value:'bronze_propeller', devices:{} },
    { label:'Bronze Propeller + 1 Bronze Clasp', value:'bronze_propeller_bronze_clasp_1', devices:{} },
    { label:'30 Sorties / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'Bronze Propeller + 2 Bronze Clasps', value:'bronze_propeller_bronze_clasp_2', devices:{} },
    { label:'40 Sorties / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'40 Sorties (Aircrew) / Bronze Propeller + 2 Bronze Clasps + Additional Ribbon', value:'bronze_propeller_bronze_clasp_2_plus_base', devices:{}, duplicates:[{ awardLabel:'Additional Air Search and Rescue Ribbon' }] },
    { label:'50 Sorties / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} }
  ],
  'cap_counterdrug_ribbon': [
    { label:'10 Sorties / Basic Ribbon', value:'earned', devices:{} },
    { label:'20 Sorties / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'30 Sorties / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'40 Sorties / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'50 Sorties / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'60 Sorties / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'70 Sorties / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', devices:{} },
    { label:'80 Sorties / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', devices:{} },
    { label:'90 Sorties / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', devices:{} }
  ],
  'disaster_relief_ribbon': [
    { label:'Basic Award', value:'earned', devices:{} },
    { label:'Presidential Disaster / Silver V', value:'silver_v', devices:{} },
    { label:'Additional Award / Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'Silver V + 1 Bronze Clasp', value:'silver_v_bronze_clasp_1', devices:{} },
    { label:'3rd Award / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'Silver V + 2 Bronze Clasps', value:'silver_v_bronze_clasp_2', devices:{} },
    { label:'Silver V + 3 Bronze Clasps', value:'silver_v_bronze_clasp_3', devices:{} },
    { label:'4th Award / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} }
  ],
  'homeland_security_ribbon': [
    { label:'10 Sorties / Basic Ribbon', value:'earned', devices:{} },
    { label:'20 Sorties / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'30 Sorties / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'40 Sorties / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'50 Sorties / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'60 Sorties / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'70 Sorties / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', devices:{} },
    { label:'80 Sorties / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', devices:{} },
    { label:'90 Sorties / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', devices:{} }
  ],
  'cap_cadet_orientation_pilot_ribbon': [
    { label:'50 Orientation Flights / Basic Ribbon', value:'earned', devices:{} },
    { label:'100 Orientation Flights / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'150 Orientation Flights / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'200 Orientation Flights / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'250 Orientation Flights / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'300 Orientation Flights / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'350 Orientation Flights / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', devices:{} },
    { label:'400 Orientation Flights / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', devices:{} },
    { label:'450 Orientation Flights / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', devices:{} }
  ],
  'community_service_ribbon': [
    { label:'60 Hours / Basic Ribbon', value:'hours_60', devices:{} },
    { label:'120 Hours / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'180 Hours / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'240 Hours / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'300 Hours / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'360 Hours / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'420 Hours / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', devices:{} },
    { label:'480 Hours / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', devices:{} },
    { label:'540 Hours / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', devices:{} }
  ],
  'national_cadet_competition_ribbon': [
    { label:'Wing/Region Representative / Basic Ribbon', value:'earned', devices:{} },
    { label:'Region Winner / Bronze Star', value:'region_bronze_star', devices:{} },
    { label:'National Sweepstakes / Silver Star', value:'national_silver_star', devices:{} },
    { label:'2 Bronze Stars', value:'two_bronze_stars', devices:{} },
    { label:'Silver Star + Bronze Star', value:'silver_star_bronze_star', devices:{} },
    { label:'Silver Star + 2 Bronze Stars', value:'silver_star_two_bronze_stars', devices:{} },
    { label:'2 Silver Stars', value:'two_silver_stars', devices:{} },
    { label:'2 Silver Stars + Bronze Star', value:'two_silver_stars_bronze_star', devices:{} },
    { label:'3 Bronze Stars', value:'three_bronze_stars', devices:{} }
  ],
  'national_color_guard_competition_ribbon': [
    { label:'Wing/Region Representative / Basic Ribbon', value:'earned', devices:{} },
    { label:'Region Winner / Bronze Star', value:'region_bronze_star', devices:{} },
    { label:'National Sweepstakes / Silver Star', value:'national_silver_star', devices:{} },
    { label:'2 Bronze Stars', value:'two_bronze_stars', devices:{} },
    { label:'Silver Star + Bronze Star', value:'silver_star_bronze_star', devices:{} },
    { label:'Silver Star + 2 Bronze Stars', value:'silver_star_two_bronze_stars', devices:{} },
    { label:'2 Silver Stars', value:'two_silver_stars', devices:{} },
    { label:'2 Silver Stars + Bronze Star', value:'two_silver_stars_bronze_star', devices:{} },
    { label:'3 Bronze Stars', value:'three_bronze_stars', devices:{} }
  ],
  'cadet_advisory_council_ribbon': [
    { label:'Group CAC / Basic Ribbon', value:'group', devices:{} },
    { label:'Wing CAC / Bronze Star', value:'wing_bronze_star', devices:{} },
    { label:'Region CAC / Silver Star', value:'region_silver_star', devices:{} },
    { label:'National CAC / Gold Star', value:'national_gold_star', devices:{} }
  ],
  'cadet_special_activity_ribbon': [
    { label:'1 Activity / Basic Ribbon', value:'earned', devices:{} },
    { label:'2 Activities / 1 Bronze Star', value:'bronze_star_1', devices:{} },
    { label:'3 Activities / 2 Bronze Stars', value:'bronze_star_2', devices:{} },
    { label:'4 Activities / 3 Bronze Stars', value:'bronze_star_3', devices:{} },
    { label:'5 Activities / 4 Bronze Stars', value:'bronze_star_4', devices:{} },
    { label:'6 Activities / 1 Silver Star', value:'silver_star_1', devices:{} },
    { label:'7 Activities / Silver Star + Bronze Star', value:'silver_star_bronze_star', devices:{} },
    { label:'8 Activities / Silver Star + 2 Bronze Stars', value:'silver_star_two_bronze_stars', devices:{} },
    { label:'9 Activities / Silver Star + 3 Bronze Stars', value:'silver_star_three_bronze_stars', devices:{} }
  ],
  'encampment_ribbon': [
    { label:'1 Encampment / Basic Ribbon', value:'earned', devices:{} },
    { label:'2 Encampments / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'3 Encampments / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'4 Encampments / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'5 Encampments / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'6 Encampments / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'7 Encampments / 1 Silver Clasp + 1 Bronze Clasp', value:'silver_clasp_1_bronze_clasp_1', devices:{} },
    { label:'8 Encampments / 1 Silver Clasp + 2 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_2', devices:{} },
    { label:'9 Encampments / 1 Silver Clasp + 3 Bronze Clasps', value:'silver_clasp_1_bronze_clasp_3', devices:{} }
  ],
  'cap_senior_recruiter_ribbon': [
    { label:'7 Recruits / Basic Ribbon', value:'earned', devices:{} },
    { label:'17 Recruits / 1 Bronze Clasp', value:'bronze_clasp_1', devices:{} },
    { label:'27 Recruits / 2 Bronze Clasps', value:'bronze_clasp_2', devices:{} },
    { label:'37 Recruits / 3 Bronze Clasps', value:'bronze_clasp_3', devices:{} },
    { label:'47 Recruits / 4 Bronze Clasps', value:'bronze_clasp_4', devices:{} },
    { label:'57 Recruits / 1 Silver Clasp', value:'silver_clasp_1', devices:{} },
    { label:'67 Recruits / 2 Silver Clasps', value:'silver_clasp_2', devices:{} },
    { label:'77 Recruits / 3 Silver Clasps', value:'silver_clasp_3', devices:{} },
    { label:'87 Recruits / 4 Silver Clasps', value:'silver_clasp_4', devices:{} }
  ]
};

const SILVER_MEDAL_OF_VALOR_MAX_RIBBONS = 3;

function ribbonImageOptionList(id){
  const special = RIBBON_SPECIAL_IMAGE_OPTIONS[id] || null;
  if(!special) return null;
  return [
    { label:'- Select -', value:'', devices:{} },
    ...special
  ];
}

function getRibbonImagePath(ribbonOrId){
  const id = typeof ribbonOrId === 'string' ? ribbonOrId : ribbonOrId?.id;
  if(isMilitaryRibbonId(id)) return getMilitaryRibbonAward(id)?.images?.ribbon || '';
  if(isRotcRibbonId(id)) return (window.CAPUBAssetIndex && CAPUBAssetIndex[ROTC_RIBBONS.get(id).asset]) || '';
  // The measured ribbon artwork (images/ribbons); devices are drawn on it by the engine.
  return (window.CAPUBAssetIndex && CAPUBAssetIndex['ribbon-' + String(normalizeRibbonId(id)).replace(/_/g, '-')]) || '';
}

function getRibbonDuplicateCountForSelection(id, awardValue){
  if(id === 'silver_medal_of_valor'){
    if(awardValue === 'silver_valor_2') return 2;
    if(awardValue === 'silver_valor_3') return 3;
  }
  return 1;
}

// Whether a ribbon has a miniature medal to show (the medal body's sheet, CAP medals; a medal of any kind that is not a ribbon-only award, U.S.
// military medals, whose drape is drawn while the body's art is pending). The picture is drawn by js/uniform-view.js miniMedalPreview.
function hasMiniMedal(id){
  if(isMilitaryRibbonId(id)){
    const award = getMilitaryRibbonAward(id);
    return !!award && window.CAPUBMilitary?.getAwardRepresentation?.(award,'MINIATURE_MEDAL')?.status !== 'NOT_APPLICABLE';
  }
  return !!(window.CAPUBAssetIndex && CAPUBAssetIndex['medal-' + String(normalizeRibbonId(id)).replace(/_/g, '-') + '-miniature']);
}

/* ===========================
   BADGES / PATCHES
   =========================== */
const badgeList = [
  'AirCrew1_DB3F0FCC3650F','BalloonPilot1_442D89C94185B','CAPMasterPilot1_621A0E2ED15DA','CAPPilot1_FA9D33EA587D8','CAPSeniorPilot1_D9725AE959752','GliderPilot1_7BFB287379918','MasterAirCrew1_72AC4CAE7A310','MasterObserver1_1B88D5071FD5C','SeniorAirCrew1_B289BAE6E515C','SeniorObserver1_0E35802A29801',
  'buddist_chaplin','christian_chaplin','communications_technician_badge','communications_senior_badge','communications_master_badge','cyber_badges','emergency_services_badge','senior_emergency_services_badge','master_emergency_services_badge','volunteer_university_instructor_badge','basic_incident_commander_badge','incident_commander_2_badge','incident_commander_1_badge','cadet_programs_badge','administration_technician_badge','administration_senior_badge','administration_master_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge','finance_senior_badge','finance_master_badge','squadron_commander_badge','emt_basic_badge','emt_intermediate','emt_paramedic','ground_team_basic_badge','historian_technicianIbadge','information_technology_technician_badge','jewish_chaplin','legal_officer','master_ground_team_badge','medical_officer','model_rocketry_badge','muslim_chaplin','nra_marksman_badge','nurse_officer','observer_badge','pre_solo_badge','senior_ground_team_badge','solo_badge','stem_badges','uas_pilot_basic_badge','uas_pilot_senior_badge','uas_pilot_master_badge','uas_technician_basic_badge','uas_technician_senior_badge','uas_technician_master_badge'
];


function getBadgeAssetPath(id){
  // The badge's dress artwork (or its field or cloth form when there is no dress form), at the
  // level the member chose for badges earned in levels.
  const cat = window.CAPUBBadgeCatalog;
  const level = State.badgeSelections?.[id]?.level;
  const art = cat && (cat.art(id, 'dress', level) || cat.art(id, 'field') || cat.art(id, 'cloth'));
  return (art && window.CAPUBAssetIndex && CAPUBAssetIndex[art]) || '';
}
function getBadgeAssetCandidates(id){
  return [getBadgeAssetPath(id)].filter(Boolean);
}

// The cadet-authorized list is shared with the engine (data/badge-catalog.js), so the page's picker and the
// uniform drawing agree on who wears which badge.
const allowedCadetBadges = new Set(CAPUBBadgeCatalog.CADET_AUTHORIZED);

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



function militaryDeviceSequence(ribbonObj){
  if(Array.isArray(ribbonObj?.militaryDevices)) return [...ribbonObj.militaryDevices];
  const sequence=[];
  for(const [deviceId,count] of Object.entries(ribbonObj?.devices || {})){
    for(let index=0;index<Number(count || 0);index++) sequence.push(deviceId);
  }
  return sequence.sort((a,b)=>(deviceMeta[b]?.weight || 0)-(deviceMeta[a]?.weight || 0));
}


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
const SENIOR_INELIGIBLE_BADGES = new Set(CAPUBBadgeCatalog.CADET_ONLY);

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
  basic_incident_commander_badge: 'Basic Incident Commander Badge',
  incident_commander_2_badge: 'Senior Incident Commander Badge',
  incident_commander_1_badge: 'Master Incident Commander Badge',
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
        'uas_pilot_basic_badge','uas_pilot_senior_badge','uas_pilot_master_badge',
        // The sUAS technician badges are cadet-authorized (data/badge-catalog.js CADET_AUTHORIZED) like the sUAS pilot badges; the cadet
        // list left them out, so a cadet's chooser never showed them (Doran: "I'm not seeing the sUAS technician badges").
        'uas_technician_basic_badge','uas_technician_senior_badge','uas_technician_master_badge'
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
  // The National Staff patch (the National Staff Badge in cloth). Attachment 4 puts the badge on the right pocket of the ABU and the CFU
  // (RP), on the right sleeve of the flight suits (RS), and 7.1.1.4.2.2 lets it be worn in lieu of the HHQ patch on the OCP's left sleeve;
  // the Corporate Service Uniform and the dress uniforms wear the metal badge (the badge chooser). It is no wing, region or national
  // patch (the ABU and CFU left sleeve takes those, 5.1.1.1.2.2), so it has no echelon and `placesOnly` keeps it to its pocket
  // (CAPR 39-1, 10.2.3: members appointed to a National Staff position).
  'national_staff_ocp_patch':{
    label:'National Staff Patch',
    slotHint:'L_SHOULDER',
    w:70,h:70,
    authorizedUniforms:['abu','ocp','corporate_field','flight_suit','cfdu'],
    placesOnly:{ abu:['CHEST_RIGHT'], corporate_field:['CHEST_RIGHT'] },
    allowedMemberships:['senior'],
    sourceBadgeId:'national_staff_badge'
  },
   // Previously added field-uniform patches.
  'ner_patch':{label:'Northeast Region Patch', slotHint:'L_SHOULDER', echelon:'region', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'nywg_patch':{label:'New York Wing Patch', slotHint:'L_SHOULDER', echelon:'wing', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'comms_patch':{label:'Communications Patch', slotHint:'CHEST_RIGHT', w:70,h:70, authorizedUniforms:['abu','flight_suit','corporate_field'], requiresSpecialty:'communications_technician'},
  'check_pilot_patch':{label:'Check Pilot Patch', slotHint:'CHEST_LEFT', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},

  // OCP-specific patches added May 2026.
  'pjoc_ocp_patch':{label:'PJOC OCP Patch', slotHint:'L_SHOULDER', w:200,h:100, authorizedUniforms:['ocp']},
  'tn185_ocp_patch':{label:'SER-TN-185 Music City Composite Squadron Unit Patch', slotHint:'R_SHOULDER', w:200,h:100, authorizedUniforms:['abu','ocp','corporate_field']},

  // New field-uniform patches added May 2026.
  'pjoc_patch':{label:'PJOC Patch', slotHint:'L_SHOULDER', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'nesa_patch':{label:'NESA Patch', slotHint:'L_SHOULDER', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'civil_engineering_academy_patch':{label:'Civil Engineering Academy Patch', slotHint:'L_SHOULDER', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'cos_patch':{label:'Cadet Officer School Patch', slotHint:'L_SHOULDER', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'honor_guard_patch':{label:'Honor Guard Patch', slotHint:'L_SHOULDER', w:70,h:70, authorizedUniforms:['abu','flight_suit','corporate_field']},
  'engineering_academy_patch':{label:'Engineering Academy Patch', slotHint:'L_SHOULDER', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'nfa_patch':{label:'National Flight Academy Patch', slotHint:'L_SHOULDER', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'cla_patch':{label:'Civic Leadership Academy Patch', slotHint:'L_SHOULDER', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'proficient_pilot_patch':{label:'Proficient Pilot Patch', slotHint:'CHEST_LEFT', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'model_rocketry_patch':{label:'Model Rocketry Patch', slotHint:'CHEST_RIGHT', w:70,h:70, authorizedUniforms:['abu','flight_suit','corporate_field'], allowedMemberships:['cadet']},
  'safety_patch':{label:'Safety Patch', slotHint:'CHEST_RIGHT', w:70,h:70, authorizedUniforms:['abu','flight_suit','corporate_field'], allowedMemberships:['senior']},
  'undergrad_pilot_training_patch':{label:'Undergraduate Pilot Training Patch', slotHint:'CHEST_LEFT', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'nbb_patch':{label:'National Blue Beret Patch', slotHint:'L_SHOULDER', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'honor_guard_academy_patch':{label:'Honor Guard Academy Patch', slotHint:'L_SHOULDER', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'af_space_command_patch':{label:'Air Force Space Command Patch', slotHint:'L_SHOULDER', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'dog_patch':{label:'DOG Patch', slotHint:'CHEST_LEFT', w:70,h:70, authorizedUniforms:['ocp','flight_suit','corporate_field']},
  'archer_patch':{label:'ARCHER Patch', slotHint:'CHEST_LEFT', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'orientation_pilot_patch':{label:'Orientation Pilot Patch', slotHint:'CHEST_LEFT', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'cism_patch':{label:'CISM Patch', slotHint:'CHEST_RIGHT', w:70,h:70, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'plane_patch':{label:'Plane Patch', slotHint:'CHEST_LEFT', w:70,h:70, authorizedUniforms:['ocp','flight_suit','corporate_field']},

  // Legacy patch IDs kept for backward compatibility with older saved setups.
  'aerospace_education_patch':{label:'Aerospace Education Patch', slotHint:'CHEST_LEFT', w:60,h:60, authorizedUniforms:['abu','ocp','flight_suit','corporate_field','cfdu']},
  'communications_patch':{label:'Legacy Communications Patch', slotHint:'CHEST_RIGHT', w:60,h:60, authorizedUniforms:['abu','flight_suit','corporate_field'], requiresSpecialty:'communications_technician'}
};

// Each patch's picture: its SVG, from data/patch-art.js (scripts/sync-patches.cjs). A patch not listed has no picture yet.
for(const [id, art] of Object.entries(window.CAPUBPatchArt || {})) if(PATCH_META[id]) Object.assign(PATCH_META[id], { img: art.img, asset: art.asset || null });

// CAP_UNIT_OPTIONS lives in data/unit-options.js (loaded above), keeping a 102 KB single-line literal out of this file.
const CAP_UNIT_OPTIONS = window.CAP_UNIT_OPTIONS || [];

// The unit emblems: one row per art-tree patch spec that carries a charter (data/unit-patch-art.js, written by scripts/sync-patches.cjs):
// { charter, patchId, label, echelon, w, h, asset, img }. A new unit emblem is a spec with its charter and a sync, no code. The charter table
// below, the patch catalog entries and each unit's higher headquarters patch are all built from these rows.
// Rows of kind "activity" (an NCSA activity patch: no charter) are catalog entries below the NCSA patches' constant; the unit rows have charters.
const UNIT_PATCH_ALL_ROWS = Array.isArray(window.CAPUBUnitPatchArt) ? window.CAPUBUnitPatchArt : [];
const UNIT_PATCH_ART = UNIT_PATCH_ALL_ROWS.filter(row => row.kind !== 'activity' && row.charter);
const UNIT_PATCH_ROW_BY_CHARTER = Object.fromEntries(UNIT_PATCH_ART.map(row => [row.charter, row]));

// Charter number -> the patch it wears. The hand entry is the fallback (SER-TN-185 before its spec carried a charter); a row wins over it.
const UNIT_PATCH_IMAGE_BY_CHARTER = {
  'SER-TN-185':'tn185_ocp_patch'
};
for(const row of UNIT_PATCH_ART) UNIT_PATCH_IMAGE_BY_CHARTER[row.charter] = row.patchId;

// Where each level's patch is worn (CAPR 39-1, 8.2.4.5 and 8.3.4.5): a wing, region or national patch on every field uniform and on the flight
// suits; a group's or a squadron's on the ABU, the OCP and the Corporate Field Uniform only.
const UNIT_PATCH_UNIFORMS_BY_ECHELON = Object.freeze({
  national: ['abu','ocp','flight_suit','corporate_field','cfdu'],
  region: ['abu','ocp','flight_suit','corporate_field','cfdu'],
  wing: ['abu','ocp','flight_suit','corporate_field','cfdu'],
  group: ['abu','ocp','corporate_field'],
  squadron: ['abu','ocp','corporate_field']
});
// `echelon` on a patch catalog entry marks the wing, region and national patches that the ABU and CFU left sleeve takes and the engine
// reads as headquarters patches; a group's or squadron's patch has `unitEchelon` only and is worn as the organizational patch.
for(const row of UNIT_PATCH_ART){
  const hq = row.echelon === 'wing' || row.echelon === 'region' || row.echelon === 'national';
  PATCH_META[row.patchId] = Object.assign({
    label: row.label, kind: 'unit', unitEchelon: row.echelon, charter: row.charter,
    slotHint: 'R_SHOULDER', w: 70, h: 70,
    authorizedUniforms: UNIT_PATCH_UNIFORMS_BY_ECHELON[row.echelon] || UNIT_PATCH_UNIFORMS_BY_ECHELON.squadron.slice(),
  }, unitPatchPicture(row), hq ? { echelon: row.echelon } : {});
}
// How a row's picture reaches the page: an SVG is an engine asset (drawn at its spec's size); official digital artwork taken as given is a PNG, drawn
// as a picture at the size its spec gives (`sizeIn`, inches; w and h carry the proportions).
function unitPatchPicture(row){
  if(/\.svg$/i.test(row.img)) return { img: row.img, asset: row.asset };
  return { img: row.img, asset: null, w: row.w, h: row.h, sizeIn: { w: row.w, h: row.h } };
}

// The patch of a charter: its own, or, for a wing's or region's headquarters squadron (-000), the headquarters' (-001), which wears the same emblem.
function getUnitPatchIdForCharter(code = State.unitPatchCharter){
  const c = String(code || '').trim();
  if(!c) return null;
  const hit = UNIT_PATCH_IMAGE_BY_CHARTER[c] || UNIT_PATCH_IMAGE_BY_CHARTER[c.toUpperCase()];
  if(hit) return hit;
  const up = c.toUpperCase();
  if(/-000$/.test(up) && ['wing', 'region'].includes(getUnitEchelon(up))) return UNIT_PATCH_IMAGE_BY_CHARTER[up.replace(/-000$/, '-001')] || null;
  return null;
}

// True when the charter's own patch artwork exists (the Unit patch list marks it).
function unitCharterHasArtwork(code){
  const id = getUnitPatchIdForCharter(code);
  return !!id && !!PATCH_META[id]?.img;
}

function getSelectedUnitPatchId(){
  return getUnitPatchIdForCharter(State.unitPatchCharter);
}

// The level of a unit, from its charter number (data/unit-options.js): XXX-XXX-000 and -001 are a region's headquarters (and its headquarters
// squadron), XXX-YY-000 and -001 a wing's, NHQ-NHQ-000, -001 and the three-letter sections are National Headquarters; every other number is a
// group, a squadron or a flight, which the flight suits do not wear a patch for.
const UNIT_LEVEL_RANK = Object.freeze({ squadron:0, group:1, wing:2, region:3, national:4 });
function getUnitEchelon(code){
  const row = UNIT_PATCH_ROW_BY_CHARTER[String(code || '').trim().toUpperCase()];
  if(row) return row.echelon;
  const parts = String(code || '').trim().toUpperCase().split('-');
  if(parts.length < 2) return 'squadron';
  const last = parts[parts.length - 1], mid = parts.length > 2 ? parts[parts.length - 2] : '', first = parts[0];
  if(first === 'NHQ' && mid === 'NHQ') return (last === '000' || last === '001' || /^[A-Z]{3}$/.test(last)) ? 'national' : 'squadron';
  if(last === '000' || last === '001') return mid && mid === first ? 'region' : 'wing';
  const unit = (typeof CAP_UNIT_OPTIONS !== 'undefined' ? CAP_UNIT_OPTIONS : []).find(u => u.code === String(code).trim());
  return unit && /\bGROUP\b|\bGP\b|\bHQ GROUP\b/i.test(unit.name) ? 'group' : 'squadron';
}

// Where a unit's own patch is not worn below a level: the flight suits take no organizational patch for a group, a squadron or a flight
// (CAPR 39-1, 8.2.4.5 FDU, 8.3.4.5 CFDU: "except organizational patches for groups, squadrons or flights are not approved for wear").
const UNIT_PATCH_FLOOR = Object.freeze({
  flight_suit: { level:'wing', ref:'8.2.4.5', words:'the flight suit' },
  cfdu: { level:'wing', ref:'8.3.4.5', words:'the Corporate Flight Duty Uniform' }
});
function getUnitPatchFloor(uniformId = State.uniform){
  // The patch catalog files the Corporate Flight Suit under the flight suit's key; its own paragraph is 8.3.4.5.
  if(/corporate_flight|cfdu/i.test(String(uniformId || ''))) return UNIT_PATCH_FLOOR.cfdu;
  return UNIT_PATCH_FLOOR[normalizeUniformKeyForPatches(uniformId)] || null;
}
function isUnitCharterWornOnUniform(code, uniformId = State.uniform){
  const floor = getUnitPatchFloor(uniformId);
  return !floor || UNIT_LEVEL_RANK[getUnitEchelon(code)] >= UNIT_LEVEL_RANK[floor.level];
}
// The charters whose patch is this patch (the unit patches have a picture by charter number).
function getUnitPatchCharters(patchId){
  return Object.keys(UNIT_PATCH_IMAGE_BY_CHARTER).filter(code => UNIT_PATCH_IMAGE_BY_CHARTER[code] === patchId);
}

// The higher headquarters (HHQ) patch of a unit, from its charter number: a group's or squadron's is its wing's patch (the wing's headquarters,
// XXX-YY-001), a wing's is its region's (XXX-XXX-001), a region's and National Headquarters' the CAP command patch. Null when that patch has no
// artwork in the unit emblem rows. (CAPR 39-1, 7.1.1.4.2.1: the OCP's left sleeve carries the higher headquarters patch under AUX.)
const UNIT_COMMAND_PATCH_ROW = UNIT_PATCH_ART.find(r => r.charter === 'NHQ-NHQ-000') || UNIT_PATCH_ART.find(r => r.asset === 'patch-cap-command-patch') || UNIT_PATCH_ART.find(r => r.echelon === 'national') || null;
function getUnitHhqPatchId(code = State.unitPatchCharter){
  const c = String(code || '').trim().toUpperCase();
  if(!c) return null;
  const level = getUnitEchelon(c);
  if(level === 'region' || level === 'national') return UNIT_COMMAND_PATCH_ROW ? UNIT_COMMAND_PATCH_ROW.patchId : null;
  const parts = c.split('-');
  if(parts.length < 3) return null;
  if(level === 'wing') return UNIT_PATCH_IMAGE_BY_CHARTER[`${parts[0]}-${parts[0]}-001`] || null;
  if(parts[0] === 'NHQ') return UNIT_COMMAND_PATCH_ROW ? UNIT_COMMAND_PATCH_ROW.patchId : null;
  return UNIT_PATCH_IMAGE_BY_CHARTER[`${parts[0]}-${parts[1]}-001`] || null;
}

// What the OCP's left sleeve carries for the chosen unit: its higher headquarters patch, placed automatically under AUX when the unit patch has
// artwork and the HHQ patch exists (7.1.1.4.2.1), unless the member has picked a patch in lieu of it (7.1.1.4.2.2: any other patch of the OCP's left
// sleeve, a Ranger tab included). Null off the OCP, with no unit patch, or when there is no HHQ patch to place.
function getUnitHhqPlan(uniformId = State.uniform){
  if(normalizeUniformKeyForPatches(uniformId) !== 'ocp') return null;
  const unit = getUnitPatchIdForCharter(State.unitPatchCharter);
  if(!unit || !PATCH_META[unit]?.img || !isPatchAuthorizedForUniform(unit, uniformId)) return null;
  const hhq = getUnitHhqPatchId(State.unitPatchCharter);
  if(!hhq || !PATCH_META[hhq]?.img || !isPatchAuthorizedForUniform(hhq, uniformId)) return null;
  const inLieu = (State.patches || []).find(id => id !== hhq && PATCH_META[id] && isPatchAuthorizedForUniform(id, uniformId) && getPatchSlot(id, uniformId) === 'L_SHOULDER') || null;
  return { patchId: hhq, label: PATCH_META[hhq].label, worn: !inLieu, inLieu };
}

function isUnitPatchAuthorizedForCurrentUniform(){
  const patchId = getSelectedUnitPatchId();
  return !!patchId && isPatchAuthorizedForUniform(patchId);
}

function getUnitPatchSelectionLabel(code){
  const unit = CAP_UNIT_OPTIONS.find(u => u.code === code);
  return unit ? `${unit.code} - ${unit.name}` : String(code || '');
}

// The one line the Unit patch list carries on a uniform that takes no patch below wing level.
function getUnitPatchFloorNote(uniformId = State.uniform){
  const floor = getUnitPatchFloor(uniformId);
  return floor ? `Only wing, region and national units are listed: ${floor.words} takes no group or squadron patch (CAPR 39-1, ${floor.ref}).` : '';
}

function renderUnitPatchStatus(){
  const status = by('unitPatchStatus');
  if(!status) return;
  const floorNote = getUnitPatchFloorNote();
  if(!State.unitPatchCharter){
    status.textContent = floorNote ? `No unit patch selected. ${floorNote}` : 'No unit patch selected.';
    return;
  }
  if(!isUnitCharterWornOnUniform(State.unitPatchCharter)){
    status.textContent = `${getUnitPatchSelectionLabel(State.unitPatchCharter)} is not worn on this uniform. ${floorNote}`;
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
  let line = `${getUnitPatchSelectionLabel(State.unitPatchCharter)} will render as the unit patch.`;
  const hhq = getUnitHhqPlan();
  if(hhq && hhq.worn) line += ` The ${hhq.label} patch, its higher headquarters, goes on the left sleeve under the AUX identifier (CAPR 39-1, 7.1.1.4.2.1); a patch you pick in lieu of it takes its place (7.1.1.4.2.2).`;
  else if(hhq) line += ` The ${hhq.label} patch, its higher headquarters, is not placed: the patch you picked in lieu of it is on the left sleeve (CAPR 39-1, 7.1.1.4.2.2).`;
  status.textContent = line;
  const img = PATCH_META[patchId]?.img;
  if(img && typeof document !== 'undefined' && document.createElement){
    const thumb = document.createElement('img');
    thumb.className = 'unitPatchThumb';
    thumb.alt = '';
    thumb.src = ASSET(img);
    thumb.style.cssText = 'display:block;height:56px;width:auto;margin:6px 0 0;';
    status.appendChild(thumb);
  }
}

// The units the Unit patch list offers for a search, the ones whose patch artwork exists first, each with its line of text.
function getUnitPatchOptions(filterText=''){
  const normalized = String(filterText || '').trim().toLowerCase();
  const found = CAP_UNIT_OPTIONS.filter(unit => {
    if(!isUnitCharterWornOnUniform(unit.code)) return false;
    if(!normalized) return true;
    return `${unit.code} ${unit.name}`.toLowerCase().includes(normalized);
  });
  const rows = found.map(unit => {
    const hasArtwork = unitCharterHasArtwork(unit.code);
    return { code: unit.code, hasArtwork, text: `${unit.code} - ${unit.name}${hasArtwork ? '  ✓ artwork available' : ''}` };
  });
  // The units whose patch artwork exists come first, so a member finds them without searching.
  return [...rows.filter(r => r.hasArtwork), ...rows.filter(r => !r.hasArtwork)];
}

function buildUnitPatchSelector(filterText=''){
  const sel = by('unitPatchSelect');
  if(!sel) return;

  const selected = State.unitPatchCharter || '';
  const matches = getUnitPatchOptions(filterText);

  sel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'No unit patch';
  sel.appendChild(none);

  matches.slice(0, 350).forEach(unit => {
    const opt = document.createElement('option');
    opt.value = unit.code;
    opt.textContent = unit.text;
    sel.appendChild(opt);
  });

  if(selected && !matches.some(unit => unit.code === selected)){
    const unit = CAP_UNIT_OPTIONS.find(u => u.code === selected);
    const opt = document.createElement('option');
    opt.value = selected;
    const kept = isUnitCharterWornOnUniform(selected) ? '(selected)' : '(selected, not worn on this uniform)';
    opt.textContent = unit ? `${unit.code} - ${unit.name}  ${kept}` : `${selected}  ${kept}`;
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

  // A unit's own patch below wing level is not worn on the flight suits (8.2.4.5, 8.3.4.5).
  if(unitPatchBelowFloor(patchId, uniformId)) return false;

  return true;
}

// True when this is a unit patch whose unit is a group, squadron or flight and the uniform takes none of those.
function unitPatchBelowFloor(patchId, uniformId = State.uniform){
  if(!getUnitPatchFloor(uniformId)) return false;
  const codes = getUnitPatchCharters(patchId);
  return codes.length > 0 && codes.every(code => !isUnitCharterWornOnUniform(code, uniformId));
}

function getPatchAuthorizationReason(patchId, uniformId = State.uniform, membership = State.membership){
  const meta = PATCH_META[patchId];
  if(!meta) return 'Unknown patch.';

  const uniformKey = normalizeUniformKeyForPatches(uniformId);
  const allowedUniforms = meta.authorizedUniforms || ['abu','ocp','flight_suit','corporate_field','cfdu'];
  if((allowedUniforms.includes(uniformKey) || meta.kind === 'unit') && unitPatchBelowFloor(patchId, uniformId)){
    const floor = getUnitPatchFloor(uniformId);
    return `Only a wing, region or national patch is worn on ${floor.words}, not a group or squadron patch (CAPR 39-1, ${floor.ref}).`;
  }
  if(!allowedUniforms.includes(uniformKey)){
    if(patchId === 'comms_patch' || patchId === 'communications_patch') return 'Communications patch is not authorized on OCP.';
    if(patchId === 'model_rocketry_patch') return 'Model Rocketry patch is not authorized on OCP.';
    if(patchId === 'safety_patch') return 'Safety patch is not authorized on OCP.';
    if(patchId === 'honor_guard_patch') return 'Honor Guard patch is not authorized on OCP; Honor Guard Academy patch is authorized.';
    if(patchId === 'dog_patch' || patchId === 'plane_patch') return 'This patch is not authorized on ABUs.';
    return `Not authorized on ${PATCH_UNIFORM_WORDS[uniformKey] || 'this uniform'}.`;
  }

  const allowedMemberships = meta.allowedMemberships || null;
  if(allowedMemberships && !allowedMemberships.includes(membership)){
    if(patchId === 'model_rocketry_patch') return 'Model Rocketry patch is cadet-only.';
    if(patchId === 'safety_patch') return 'Safety patch is senior-member-only.';
    if(patchId === 'national_staff_ocp_patch') return 'Senior members only: worn by members appointed to a National Staff position (CAPR 39-1, 10.2.3).';
    const who = allowedMemberships.map(m => m === 'senior' ? 'senior members' : m === 'cadet' ? 'cadets' : m).join(' and ');
    return `${who.charAt(0).toUpperCase()}${who.slice(1)} only.`;
  }

  return '';
}

// The uniforms' names for the patch tiles' wording (Ethan: "dont do stuff like L Shoulder, spell it all out"): no key or
// slot constant is ever shown to a member.
const PATCH_UNIFORM_WORDS = Object.freeze({
  abu: 'the ABU', ocp: 'the OCP', corporate_field: 'the Corporate Field Uniform', flight_suit: 'the flight suit', cfdu: 'the Corporate Flight Duty Uniform'
});

// Where a patch is worn on each field uniform, in the regulation's words (CAPR 39-1). One row per place: the engine's slot
// (js/engine/profiles-field.js fieldPatches, profiles.js flightPatches read `slot`), its name in words, and which patches it takes
// (the unit patch, or by the patch's echelon: a wing, region or national patch against every other patch). Attachment 4's table gives
// the places patch by patch: wing, national rocker and overseas patches LS; region patches LS or RP; the organizational (unit) patch
// RP; every other patch L/RP on the ABU and CFU, the NCSA patches RS or L/RP on the CFU; RS on the flight suits.
//  ABU    5.1.1.1.2.2: the left sleeve takes one wing, region or national patch, 1/2 in below the shoulder seam; 5.1.1.1.2.3: one patch
//         in all on the breast pocket (the unit patch, a region patch, or one other, Attachment 4); the right sleeve has no place.
//  CFU    5.2.1.1.2.2: left sleeve, wing, region or national patch; 5.2.1.1.2.3: right sleeve, one special activity (NCSA) patch;
//         5.2.1.1.2.4: left breast pocket, one patch; 5.2.1.1.2.5: right breast pocket, one patch (the unit patch goes there).
//  OCP    7.1.1.4.1.2: right sleeve, the unit patch centred under the flag; 7.1.1.4.2.1: left sleeve, the higher headquarters patch
//         under the AUX identifier; 7.1.1.4.2.2: the patches worn in lieu of it, in the same place.
//  FDU    8.2.4.5 (CFDU 8.3.4.5): one authorized patch on the right sleeve, inside the loop tape.
// The member picks among the places a patch may take (State.patchPlacements); the first place is the regulation's primary one.
// The National Cadet Special Activity patches (10.9.14): the ones the CFU's right sleeve takes (5.2.1.1.2.3, Attachment 4 "NCSA Patches").
const NCSA_PATCH_IDS = new Set(['pjoc_patch','nesa_patch','civil_engineering_academy_patch','cos_patch','engineering_academy_patch','nfa_patch','cla_patch','nbb_patch','honor_guard_academy_patch']);
// The activity patches of the art tree (kind "activity": the NCSA schools and academies without a catalog entry of their own) are NCSA patches like NESA
// and PJOC: the same uniforms, the same places (the CFU's right sleeve, the pockets, the flight suit's sleeve), the Worn picker where there are several.
for(const row of UNIT_PATCH_ALL_ROWS){
  if(row.kind !== 'activity' || PATCH_META[row.patchId]) continue;
  PATCH_META[row.patchId] = Object.assign({
    label: row.label, kind: 'activity', slotHint: 'L_SHOULDER', w: 70, h: 70,
    authorizedUniforms: ['abu','ocp','flight_suit','corporate_field','cfdu']
  }, unitPatchPicture(row));
  NCSA_PATCH_IDS.add(row.patchId);
  if(!patchList.includes(row.patchId)) patchList.push(row.patchId);
}
const PATCH_PLACES = Object.freeze({
  abu: [
    { slot:'L_SHOULDER', label:'Left sleeve, ½ in below the shoulder seam', ref:'5.1.1.1.2.2', takes: p => !!p.echelon },
    { slot:'CHEST_RIGHT', label:'Right breast pocket', ref:'5.1.1.1.2.3', takes: p => !p.echelon || p.echelon === 'region' },
    { slot:'CHEST_LEFT', label:'Left breast pocket', ref:'5.1.1.1.2.3', takes: p => !p.unit && !p.echelon }
  ],
  corporate_field: [
    { slot:'L_SHOULDER', label:'Left sleeve, ½ in below the shoulder seam', ref:'5.2.1.1.2.2', takes: p => !!p.echelon },
    { slot:'R_SHOULDER', label:'Right sleeve, ½ in below the shoulder seam', ref:'5.2.1.1.2.3', takes: p => p.ncsa },
    { slot:'CHEST_RIGHT', label:'Right breast pocket', ref:'5.2.1.1.2.5', takes: p => !p.echelon || p.echelon === 'region' },
    { slot:'CHEST_LEFT', label:'Left breast pocket', ref:'5.2.1.1.2.4', takes: p => !p.unit && !p.echelon }
  ],
  ocp: [
    { slot:'R_SHOULDER', label:'Right sleeve, under the flag', ref:'7.1.1.4.1.2', takes: p => p.unit },
    { slot:'L_SHOULDER', label:'Left sleeve, under the AUX identifier', ref:'7.1.1.4.2.1, 7.1.1.4.2.2', takes: p => !p.unit }
  ],
  flight_suit: [
    { slot:'R_SHOULDER', label:'Right sleeve, on the loop tape', ref:'8.2.4.5, 8.3.4.5', takes: () => true }
  ]
});
PATCH_PLACES.cfdu = PATCH_PLACES.flight_suit;

function isUnitPatchId(patchId){
  return Object.values(UNIT_PATCH_IMAGE_BY_CHARTER).includes(patchId);
}

// The places this patch may be worn on the uniform, the regulation's primary place first.
function getPatchPlaces(patchId, uniformId = State.uniform){
  const meta = PATCH_META[patchId];
  if(!meta) return [];
  const p = { unit: isUnitPatchId(patchId), echelon: meta.echelon || null, ncsa: NCSA_PATCH_IDS.has(patchId) };
  const key = normalizeUniformKeyForPatches(uniformId), only = meta.placesOnly?.[key];
  return (PATCH_PLACES[key] || []).filter(place => place.takes(p) && (!only || only.includes(place.slot)));
}

// The place the patch is drawn in: the member's pick for this uniform when it is one of the patch's places, else the catalog's
// own place when it is one, else the regulation's primary place. Null where the uniform has no place for it.
function getPatchSlot(patchId, uniformId = State.uniform){
  const places = getPatchPlaces(patchId, uniformId);
  if(!places.length) return null;
  const picked = State.patchPlacements?.[normalizeUniformKeyForPatches(uniformId)]?.[patchId];
  const own = PATCH_META[patchId]?.slotHint;
  return (places.find(pl => pl.slot === picked) || places.find(pl => pl.slot === own) || places[0]).slot;
}

function setPatchPlacement(patchId, slot, uniformId = State.uniform){
  const key = normalizeUniformKeyForPatches(uniformId);
  if(!State.patchPlacements) State.patchPlacements = {};
  if(!State.patchPlacements[key]) State.patchPlacements[key] = {};
  if(getPatchPlaces(patchId, uniformId).some(pl => pl.slot === slot)) State.patchPlacements[key][patchId] = slot;
  else delete State.patchPlacements[key][patchId];
}

// The place in words for the tile: "Right sleeve, on the loop tape".
function getPatchPlaceLabel(patchId, uniformId = State.uniform){
  const slot = getPatchSlot(patchId, uniformId);
  const place = slot && getPatchPlaces(patchId, uniformId).find(pl => pl.slot === slot);
  return place ? place.label : '';
}

// One patch tile's inner HTML, the same in every patch picker (the sidebar gallery, the Choose… popup): the picture, the name,
// Add, and where it is worn in words, or why it is not offered. No id, file name, slot constant or pixel size (Ethan: "please
// remove the file names, and dont do stuff like L Shoulder, spell it all out"). Where the patch has more than one place on
// the uniform the line is a picker (class ptPlace); the tile element carries data-patch-id for the wiring.
function patchTileHtml(patchId, { uniformId = State.uniform, membership = State.membership } = {}){
  const meta = PATCH_META[patchId] || {};
  const title = meta.label || String(patchId).replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
  const authorized = isPatchAuthorizedForUniform(patchId, uniformId, membership);
  let where;
  if(!authorized){
    where = `<div class="sub"><b>${escapeHtml(getPatchAuthorizationReason(patchId, uniformId, membership) || 'Not authorized on this uniform.')}</b></div>`;
  }else{
    const places = getPatchPlaces(patchId, uniformId);
    if(places.length > 1){
      // More than one authorized place (the Corporate Field Uniform's right sleeve and two pockets): the member picks, the regulation's
      // primary place first and chosen until the member changes it (Osprey: "a drop down for the authorised patch placements").
      const slot = getPatchSlot(patchId, uniformId);
      const options = places.map(pl => `<option value="${escapeHtml(pl.slot)}"${pl.slot === slot ? ' selected' : ''}>${escapeHtml(pl.label)}</option>`).join('');
      where = `<div class="miniRow"><label>Worn <select class="ptPlace" aria-label="Where the ${escapeHtml(title)} is worn">${options}</select></label></div>`;
    }else{
      const label = getPatchPlaceLabel(patchId, uniformId);
      where = `<div class="sub">Worn: <b>${escapeHtml(label || meta.note || 'where CAPR 39-1 puts it')}</b></div>`;
    }
  }
  return `
    ${meta.img ? `<img loading="lazy" decoding="async" src="${ASSET(meta.img)}" alt="${escapeHtml(title)}">` : ''}
    <div style="flex:1;min-width:0;">
      <div class="title">${escapeHtml(title)}</div>
      <div class="miniRow"><label><input type="checkbox" class="ptChk"> Add</label></div>
      ${where}
    </div>`;
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
