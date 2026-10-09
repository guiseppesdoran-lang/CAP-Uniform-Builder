// Extracted verbatim from index.html: the universal calibration system (default per-uniform
// placements, the master calibration data and the calibrator helpers). Loaded between the
// two halves of the inline script so execution order is unchanged.

/* ===========================
   UNIVERSAL CALIBRATION SYSTEM
   =========================== */
const CAPUB_CALIBRATION_STORAGE_KEY = 'capub_admin_calibration_by_uniform_v20260805_female_class_a_capt_1785908806912';
const CAPUB_LEGACY_CALIBRATION_STORAGE_KEY = 'capub_admin_calibration_by_uniform';
function genderBucketFor(uniform, gender){
  const u = uniform || 'global';
  const g = gender || '';
  return g ? `${u}_${g}` : u;
}
function normalizeCalibrationBucketsFromPayload(parsed){
  const byUniform = JSON.parse(JSON.stringify(parsed?.coordinatesByUniform || parsed?.calib?.byUniform || {}));
  const gender = parsed?.activeGender || parsed?.gender || '';
  const activeUniform = parsed?.activeUniform || parsed?.uniform || '';

  // Older exports stored female/male coordinates under the base uniform name.
  // Move those into the gender-specific bucket so female Class A no longer
  // overwrites or mixes with male/default blues_a coordinates.
  if(gender && activeUniform && byUniform[activeUniform]){
    const target = genderBucketFor(activeUniform, gender);
    if(target !== activeUniform){
      byUniform[target] = { ...(byUniform[target] || {}), ...byUniform[activeUniform] };
      delete byUniform[activeUniform];
    }
  }

  // Defensive migration for the specific uploaded female calibration format.
  // If jacket_female was captured under blues_a/blues_b, treat it as female.
  for(const base of ['blues_a','blues_b']){
    const b = byUniform[base];
    if(b?.jacket && parsed?.renderedItems?.some?.(it => String(it.src||'').includes('jacket_female'))){
      byUniform[`${base}_female`] = { ...(byUniform[`${base}_female`] || {}), ...b };
      delete byUniform[base];
    }
  }
  return byUniform;
}
function calibKeyFor(el){
  return el?.dataset?.calibKey || null;
}
function getCurrentCalibUniform(){
  return genderBucketFor(State.uniform || 'global', State.gender || '');
}
function getBaseUniformFromCalibId(uniformId){
  return String(uniformId || '').replace(/_(male|female)$/,'');
}
function getCalibFallbackUniforms(uniformId=getCurrentCalibUniform()){
  const base = getBaseUniformFromCalibId(uniformId);
  const list = [uniformId];
  // Female Semi-Formal currently uses the exact female Mess Dress base image,
  // so its verified formal-uniform badge coordinates are interchangeable.
  if(uniformId === 'semi_formal_female') list.push('mess_dress_female');
  if(base && base !== uniformId) list.push(base);
  list.push('global');
  return [...new Set(list.filter(Boolean))];
}
function getCalibBucket(uniformId=getCurrentCalibUniform()){
  if(!State.calib.byUniform) State.calib.byUniform = {};
  if(!State.calib.byUniform[uniformId]) State.calib.byUniform[uniformId] = {};
  return State.calib.byUniform[uniformId];
}

function ensureMasterCalibrationSession(){
  if(!State.calib.masterSession || typeof State.calib.masterSession !== 'object'){
    State.calib.masterSession={active:false,startedAt:null,changesByUniform:{},contextByUniform:{}};
  }
  const session=State.calib.masterSession;
  if(!session.changesByUniform || typeof session.changesByUniform !== 'object') session.changesByUniform={};
  if(!session.contextByUniform || typeof session.contextByUniform !== 'object') session.contextByUniform={};
  return session;
}

function getCalibrationContextSnapshot(){
  return {
    uniform:State.uniform || null,
    calibrationBucket:getCurrentCalibUniform(),
    gender:State.gender || null,
    membership:State.membership || null,
    rank:State.rank || null,
    baseCandidates:typeof getBaseCandidates === 'function' ? getBaseCandidates() : [],
    canvas:typeof getCanvasRenderSize === 'function' ? getCanvasRenderSize() : null,
    selectedUniformItems:{
      ribbons:(State.ribbons || []).map(item=>({id:item.id,awardValue:item.awardValue || ''})),
      badges:[...(State.badges || [])],
      patches:[...(State.patches || [])]
    }
  };
}

function recordMasterCalibrationChange(key, calibration){
  const session=ensureMasterCalibrationSession();
  if(!session.active || !key) return;
  const bucketId=getCurrentCalibUniform();
  if(!session.changesByUniform[bucketId]) session.changesByUniform[bucketId]={};
  session.changesByUniform[bucketId][key]={...calibration};
  session.contextByUniform[bucketId]=getCalibrationContextSnapshot();
  updateMasterCalibrationStatus();
}

function getMasterCalibrationSessionSnapshot(){
  const session=ensureMasterCalibrationSession();
  const scopes=Object.entries(session.changesByUniform).map(([calibrationBucket,items])=>({
    calibrationBucket,
    context:{...(session.contextByUniform[calibrationBucket] || {})},
    changes:Object.entries(items || {}).map(([key,savedCalibration])=>({key,savedCalibration:{...savedCalibration}}))
  })).filter(scope=>scope.changes.length);
  return {
    active:!!session.active,
    startedAt:session.startedAt || null,
    uniformCount:scopes.length,
    changeCount:scopes.reduce((sum,scope)=>sum+scope.changes.length,0),
    scopes
  };
}

function updateMasterCalibrationStatus(){
  const snapshot=getMasterCalibrationSessionSnapshot();
  const button=document.getElementById('calibMasterSession');
  const clear=document.getElementById('calibMasterClear');
  const status=document.getElementById('calibMasterStatus');
  if(button){
    button.textContent=`Master Session: ${snapshot.active ? 'ON' : 'OFF'}`;
    button.classList.toggle('ghost',!snapshot.active);
  }
  if(clear) clear.disabled=!snapshot.changeCount;
  if(status){
    status.textContent=snapshot.active
      ? `${snapshot.changeCount} changed item${snapshot.changeCount===1?'':'s'} across ${snapshot.uniformCount} uniform${snapshot.uniformCount===1?'':'s'} will be included in one push.`
      : snapshot.changeCount
        ? `${snapshot.changeCount} staged change${snapshot.changeCount===1?'':'s'} retained. Turn the master session on to submit them together.`
        : 'One-uniform submission mode.';
  }
}

window.CAPUB_MASTER_CALIBRATION={
  getSnapshot:getMasterCalibrationSessionSnapshot,
  isActive:()=>!!ensureMasterCalibrationSession().active
};

// The calibration boxes live in data/calibration-defaults.js, one line per box. The code below
// only adds boxes that follow from a rule: shoulder cords, field-uniform jackets and patches.
const DEFAULT_CALIBRATION_BY_UNIFORM = JSON.parse(JSON.stringify(window.CAPUB_CALIBRATION_DEFAULTS || {}));

// Fully independent shoulder-cord calibration defaults.
// Each cadet blues uniform bucket has six separate coordinate objects so every
// cord can be zeroed in independently by uniform, gender/cut, size, and rotation.
const SHOULDER_CORD_DEFAULTS = {
  blues_a_male: {
    group:       { x: 96,  y: 86,  w: 52,  h: 160, r: 0 },
    wing:        { x: 300,  y: 70,  w: 81,  h: 204, r: 2 },
    region:      { x: 288,  y: 27,  w: 121,  h: 318, r: 4 },
    national:    { x: 96,  y: 86,  w: 52,  h: 160, r: 0 },
    color_guard: { x: 96,  y: 86,  w: 52,  h: 160, r: 0 },
    honor_guard: { x: 96,  y: 86,  w: 52,  h: 160, r: 0 }
  },

  blues_a_female: {
    group:       { x: 271, y: 31,  w: 153, h: 278, r: 3 },
    wing:        { x: 284, y: 66,  w: 118, h: 239, r: 3 },
    region:      { x: 271, y: 32,  w: 153, h: 278, r: 3 },
    national:    { x: 271, y: 32,  w: 153, h: 278, r: 3 },
    color_guard: { x: 271, y: 32,  w: 153, h: 278, r: 3 },
    honor_guard: { x: 271, y: 32,  w: 153, h: 278, r: 3 }
  },

  blues_b_male: {
    group:       { x: 92,  y: 76,  w: 50,  h: 152, r: 0 },
    wing:        { x: 92,  y: 76,  w: 50,  h: 152, r: 0 },
    region:      { x: 92,  y: 76,  w: 50,  h: 152, r: 0 },
    national:    { x: 92,  y: 76,  w: 50,  h: 152, r: 0 },
    color_guard: { x: 92,  y: 76,  w: 50,  h: 152, r: 0 },
    honor_guard: { x: 92,  y: 76,  w: 50,  h: 152, r: 0 }
  },

  blues_b_female: {
    group:       { x: 100, y: 82,  w: 46,  h: 145, r: 0 },
    wing:        { x: 100, y: 82,  w: 46,  h: 145, r: 0 },
    region:      { x: 100, y: 82,  w: 46,  h: 145, r: 0 },
    national:    { x: 100, y: 82,  w: 46,  h: 145, r: 0 },
    color_guard: { x: 100, y: 82,  w: 46,  h: 145, r: 0 },
    honor_guard: { x: 100, y: 82,  w: 46,  h: 145, r: 0 }
  }
};

function capubEnsureShoulderCordCalibrationDefaults(){
  for(const [bucketId, cords] of Object.entries(SHOULDER_CORD_DEFAULTS)){
    if(!DEFAULT_CALIBRATION_BY_UNIFORM[bucketId]) DEFAULT_CALIBRATION_BY_UNIFORM[bucketId] = {};

    for(const [cordId, coords] of Object.entries(cords)){
      const key = `shoulderCord:${cordId}`;
      if(!DEFAULT_CALIBRATION_BY_UNIFORM[bucketId][key]){
        DEFAULT_CALIBRATION_BY_UNIFORM[bucketId][key] = { ...coords };
      }
    }
  }
}
capubEnsureShoulderCordCalibrationDefaults();

// Field uniform render-stage defaults. These stop legacy Class A/Class B jacket
// calibrations from shrinking or shifting OCP/ABU/CFU/FDU base images. The field
// stage is intentionally 969.6 x 707.52 px per the current builder requirement.
function capubEnsureFieldUniformCalibrationDefaults(){
  const fieldJacket = { x:0, y:0, w:969.6, h:707.52, r:0 };
  ['ocp','abu','corporate_field','cfu','cfdu','fdu','flight_suit'].forEach(bucketId => {
    if(!DEFAULT_CALIBRATION_BY_UNIFORM[bucketId]) DEFAULT_CALIBRATION_BY_UNIFORM[bucketId] = {};
    if(!DEFAULT_CALIBRATION_BY_UNIFORM[bucketId].jacket){
      DEFAULT_CALIBRATION_BY_UNIFORM[bucketId].jacket = { ...fieldJacket };
    }
  });
}
capubEnsureFieldUniformCalibrationDefaults();


/* Badge sizes pinned by approved calibration issues #110 and #137 for the male Class A coat.
   getBadgeRenderSize() in js/catalog.js reads them; the matching positions are in
   data/calibration-defaults.js. */
const CAPUB_APPROVED_CALIBRATION_OVERRIDES = Object.freeze({
  blues_a_male: Object.freeze({
    'badge:cadet_programs_master_badge:LP:0': Object.freeze({x:283,y:248,w:25,h:35,r:0}),
    'badge:master_emergency_services_badge:LP:0': Object.freeze({x:280.7,y:249.5,w:25,h:25,r:0}),
    'badge:volunteer_university_instructor_badge:RP:0': Object.freeze({x:130.4,y:248,w:40,h:40,r:0})
  })
});
Object.assign(RIBBON_LAYOUT_BY_UNIFORM, {
  "blues_a_male":{"baseX":259.0,"bottomY":213,"w":23,"h":7,"gapX":0,"gapY":0},
  "blues_a_female":{"baseX":261,"bottomY":231,"w":23,"h":7,"gapX":0,"gapY":0}
});

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

function isFemaleBlueUniform(){
  return State.gender === 'female' && ['blues_a','blues_b'].includes(State.uniform);
}

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

function hasModelRocketrySelected(){
  return (State.badges || []).includes('model_rocketry_badge') &&
    !(State.membership === 'cadet' && !isCadetAuthorized('model_rocketry_badge'));
}

function getSpecialtyPocketSlotBySelectionOrder(id){
  if(!isSelectableSpecialtyPocketBadge(id)) return null;
  if(useFemaleOverNameplateSpecialtyLayout(id)){
    return getRenderableFemaleClassASpecialtyBadgeIds().includes(id) ? 'FON' : null;
  }

  const specialtyOrder = (State.badges || [])
    .filter(badgeId => isSelectableSpecialtyPocketBadge(badgeId))
    .filter(badgeId => isBadgeEligibleForMembership(badgeId, State.membership));

  // National Staff is worn on the wearer's right pocket (RP). The other
  // governance/service badges use the wearer's left pocket (LP). Only one may
  // own the active governance position; a flexible specialty badge may use the
  // opposite pocket when one remains available.
  const activeGovernanceBadge = specialtyOrder.find(badgeId => GOVERNANCE_SERVICE_BADGE_IDS.has(badgeId)) || null;
  const governanceSlot = activeGovernanceBadge === 'national_staff_badge' ? 'RP' : 'LP';
  if(GOVERNANCE_SERVICE_BADGE_IDS.has(id)) return activeGovernanceBadge === id ? governanceSlot : null;
  if(activeGovernanceBadge){
    const firstOtherBadge = specialtyOrder.find(badgeId => !GOVERNANCE_SERVICE_BADGE_IDS.has(badgeId)) || null;
    const oppositePocket = governanceSlot === 'RP' ? 'LP' : 'RP';
    return firstOtherBadge === id ? oppositePocket : null;
  }

  const hasVolunteerUniversity = specialtyOrder.includes('volunteer_university_instructor_badge');
  const activeLpExclusive = getActiveMaleCadetLeftPocketExclusiveBadge();

  // Male cadet blues exception group: Model Rocketry, Cadet Cyber, and Cadet STEM are all
  // authorized only on the wearer's left pocket. If more than one of these is selected,
  // only the first selected one renders there.
  if(id === 'cyber_badges' || id === 'stem_badges'){
    return activeLpExclusive === id ? 'LP' : null;
  }

  // Exception: Volunteer University always renders on the wearer's right pocket.
  if(id === 'volunteer_university_instructor_badge') return 'RP';

  // If LP is owned by Model Rocketry/Cyber/STEM, flexible specialty badges that would have
  // used LP are bumped to RP. If Volunteer University already uses RP, there is no eligible slot.
  if(activeLpExclusive) return hasVolunteerUniversity ? null : 'RP';

  // When Volunteer University is selected without an LP-exclusive badge, every other flexible
  // specialty badge goes to the wearer's left pocket.
  if(hasVolunteerUniversity) return 'LP';

  const index = specialtyOrder.indexOf(id);

  // Default flexible specialty behavior when no exceptions are selected:
  // first specialty badge on LP, second on RP.
  if(index === 0) return 'LP';
  if(index === 1) return 'RP';
  return null;
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
function countBadgesForLimit(ids = State.badges){
  return ids.filter(id => !isCommandInsigniaBadge(id)).length;
}

function mergeCalibDefaults(){
  if(!State.calib.byUniform) State.calib.byUniform = {};
  for(const [uniformId, bucket] of Object.entries(DEFAULT_CALIBRATION_BY_UNIFORM)){
    if(!State.calib.byUniform[uniformId]) State.calib.byUniform[uniformId] = {};
    for(const [key, value] of Object.entries(bucket)){
      if(!State.calib.byUniform[uniformId][key]){
        State.calib.byUniform[uniformId][key] = { ...value };
      }
    }
  }
}

function parseBadgeCalibKey(key){
  const m = String(key||'').match(/^badge:([^:]+):([^:]+):(\d+)$/);
  if(!m) return null;
  return { id:m[1], slot:m[2], idx:parseInt(m[3],10) || 0 };
}

function buildDerivedBadgeCalib(key, base){
  const parsed = parseBadgeCalibKey(key);
  if(!parsed) return null;
  const defaultBuckets = getCalibFallbackUniforms().map(id => DEFAULT_CALIBRATION_BY_UNIFORM[id] || {});
  const defaults = Object.assign({}, ...defaultBuckets.reverse());

  let refKey = null;
  let yAdjust = 0;

  if(AIRCREW_BADGE_IDS.has(parsed.id) && parsed.slot === 'OLP'){
    // Aviation badges: OLP. Use the high position only when an OLPU badge is also present.
    refKey = `badge:observer_badge:OLP:${parsed.idx}`;
    if(!defaults[refKey]) refKey = `badge:AirCrew1_DB3F0FCC3650F:OLP:${parsed.idx}`;
  }else if(CHAPLAIN_BADGE_IDS.has(parsed.id) && parsed.slot === 'OLPA'){
    // Chaplain badges: OLPA, above aviation badges.
    refKey = `badge:observer_badge:OLP:0`;
    if(!defaults[refKey]) refKey = `badge:AirCrew1_DB3F0FCC3650F:OLP:0`;
    yAdjust = -34;
  }else if(OLPU_OCCUPATIONAL_BADGE_IDS.has(parsed.id) && parsed.slot === 'OLPU'){
    // Ground team, EMT, medical, legal, and incident commander badges: OLPU.
    // Use the calibrated visual family where available so rectangular IC badges
    // do not inherit ground-team badge dimensions.
    if(INCIDENT_COMMAND_SPECIALTY_BADGE_IDS.has(parsed.id)){
      refKey = `badge:basic_incident_commander_badge:OLPU:${parsed.idx}`;
      if(!defaults[refKey]) refKey = `badge:basic_incident_commander_badge:OLPU:0`;
    }else{
      refKey = `badge:master_ground_team_badge:OLPU:${parsed.idx}`;
      if(!defaults[refKey]) refKey = `badge:master_ground_team_badge:OLPU:0`;
    }
  }else if(isCommandInsigniaBadge(parsed.id)){
    // Command insignia/non-occupational badges use their own calibrated positions.
    refKey = `badge:${parsed.id}:${parsed.slot}:${parsed.idx}`;
    if(!defaults[refKey] && parsed.slot === 'UN') refKey = `badge:squadron_commander_badge:UN:${parsed.idx}`;
    if(!defaults[refKey] && parsed.slot === 'ON') refKey = `badge:squadron_commander_badge:ON:${parsed.idx}`;
  }else if(parsed.id === 'basic_incident_commander_badge' && ['UN','ON'].includes(parsed.slot)){
    // Incident Commander right-side versions use their own calibrated family, not an occupational pocket reference.
    refKey = `badge:basic_incident_commander_badge:${parsed.slot}:${parsed.idx}`;
    if(!defaults[refKey] && parsed.slot === 'UN') refKey = `badge:basic_incident_commander_badge:UN:0`;
  }else if(isSelectableSpecialtyPocketBadge(parsed.id) && parsed.slot === 'LP'){
    // First specialty-track/service badge: wearer's left pocket, below ribbons.
    if(ES_POCKET_BADGE_IDS.has(parsed.id)){
      refKey = `badge:master_emergency_services_badge:LP:${parsed.idx}`;
      if(!defaults[refKey]) refKey = `badge:emergency_services_badge:LP:${parsed.idx}`;
      if(!defaults[refKey]) refKey = `badge:emergency_services_badge:LP:0`;
    }else if(LARGE_RIGHT_POCKET_SPECIALTY_BADGE_IDS.has(parsed.id)){
      refKey = `badge:${parsed.id}:LP:${parsed.idx}`;
      if(!defaults[refKey]) refKey = `badge:volunteer_university_instructor_badge:LP:0`;
      if(!defaults[refKey]) refKey = `badge:emergency_services_badge:LP:0`;
    }else if(SMALL_RIGHT_POCKET_SPECIALTY_BADGE_IDS.has(parsed.id)){
      refKey = `badge:${parsed.id}:LP:${parsed.idx}`;
      if(!defaults[refKey]) refKey = `badge:communications_technician_badge:LP:0`;
      if(!defaults[refKey]) refKey = `badge:emergency_services_badge:LP:0`;
    }else{
      refKey = `badge:emergency_services_badge:LP:0`;
    }
  }else if(isSelectableSpecialtyPocketBadge(parsed.id) && parsed.slot === 'RP'){
    // Second specialty-track/service badge: wearer's right pocket.
    if(LARGE_RIGHT_POCKET_SPECIALTY_BADGE_IDS.has(parsed.id)){
      refKey = `badge:${parsed.id}:RP:${parsed.idx}`;
      if(!defaults[refKey]) refKey = `badge:volunteer_university_instructor_badge:RP:0`;
      if(!defaults[refKey]) refKey = `badge:volunteer_university_instructor_badge:UN:0`;
    }else if(SMALL_RIGHT_POCKET_SPECIALTY_BADGE_IDS.has(parsed.id)){
      refKey = `badge:communications_technician_badge:UN:0`;
    }else if(ES_POCKET_BADGE_IDS.has(parsed.id)){
      refKey = `badge:communications_technician_badge:UN:0`;
    }else{
      refKey = `badge:communications_technician_badge:UN:0`;
    }
  }else if(SPECIALTY_TRACK_BADGE_IDS.has(parsed.id) && parsed.slot === 'ON'){
    refKey = `badge:squadron_commander_badge:ON:${parsed.idx}`;
    if(!defaults[refKey]) refKey = `badge:communications_technician_badge:UN:${parsed.idx}`;
  }else if(SPECIALTY_TRACK_BADGE_IDS.has(parsed.id) && parsed.slot === 'UN'){
    // Retained only for older saved calibrations. New specialty-track badges use LP/RP by selection order.
    if(LARGE_RIGHT_POCKET_SPECIALTY_BADGE_IDS.has(parsed.id)){
      refKey = `badge:volunteer_university_instructor_badge:UN:${parsed.idx}`;
      if(!defaults[refKey]) refKey = `badge:volunteer_university_instructor_badge:UN:0`;
    }else if(SMALL_RIGHT_POCKET_SPECIALTY_BADGE_IDS.has(parsed.id)){
      refKey = `badge:communications_technician_badge:UN:${parsed.idx}`;
      if(!defaults[refKey]) refKey = `badge:communications_technician_badge:UN:0`;
    }else{
      refKey = `badge:communications_technician_badge:UN:${parsed.idx}`;
    }
  }else if(parsed.id === 'model_rocketry_badge' && parsed.slot === 'LP'){
    refKey = `badge:emergency_services_badge:LP:0`;
  }else if(parsed.id === 'model_rocketry_badge' && parsed.slot === 'ON'){
    refKey = `badge:squadron_commander_badge:ON:0`;
  }else if(parsed.id === 'nra_marksman_badge' && parsed.slot === 'OLPF'){
    refKey = `badge:emergency_services_badge:LP:0`;
  }

  if(!refKey || !defaults[refKey]) return null;

  const ref = defaults[refKey];
  const patch = { ...ref };
  if(Number.isFinite(Number(patch.y))) patch.y = Math.round(Number(patch.y) + yAdjust);

  // If an aviation/aeronautical badge is worn by itself, use the lower over-ribbon
  // OLP position instead of the high position that leaves room for an OLPU badge.
  if(AIRCREW_BADGE_IDS.has(parsed.id) && parsed.slot === 'OLP' && shouldUseLowerAviationPosition()){
    patch.y = 169;
  }

  // Over-left-pocket badges inherit the reference center but keep each badge family's
  // own dimensions, unless the reference was calibrated for the exact family.
  if(['OLP','OLPA','OLPU','OLPF'].includes(parsed.slot) && base && base.w && base.h){
    const refW = ref.w ?? base.w;
    const refH = ref.h ?? base.h;

    // Exact-family calibrations carry both position and rendered size.
    // Similar badges inherit the reference center but keep their own size.
    const exactFamily =
      (parsed.id === 'basic_incident_commander_badge' && refKey?.includes('basic_incident_commander_badge')) ||
      (AIRCREW_BADGE_IDS.has(parsed.id) && refKey?.includes(parsed.id));

    if(exactFamily){
      patch.x = Math.round(ref.x);
      patch.y = Math.round(ref.y + yAdjust);
      patch.w = refW;
      patch.h = refH;
    }else{
      patch.x = Math.round(ref.x + refW/2 - base.w/2);
      patch.y = Math.round((ref.y + yAdjust) + refH/2 - base.h/2);
      delete patch.w;
      delete patch.h;
    }
  }

  // Pocket/name-tag zone badges use calibrated family zones and sizes.
  if(SPECIALTY_TRACK_BADGE_IDS.has(parsed.id) && ['LP','RP','ON','UN'].includes(parsed.slot) && base){
    const refW = ref.w ?? base.w;
    const refH = ref.h ?? base.h;
    patch.x = Math.round(ref.x);
    patch.y = Math.round(ref.y + yAdjust);
    patch.w = refW;
    patch.h = refH;
  }

  return patch;
}
function getLegacyPatchCalibKey(key){
  const m = String(key || '').match(/^patch:([^:]+):/);
  return m ? `patch:${m[1]}` : null;
}
function getCalib(key){
  if(!key) return null;
  const legacyPatchKey = getLegacyPatchCalibKey(key);
  for(const uniformId of getCalibFallbackUniforms()){
    const bucket = State.calib.byUniform?.[uniformId] || {};
    if(bucket[key]) return bucket[key];
    if(legacyPatchKey && bucket[legacyPatchKey]) return bucket[legacyPatchKey];
    const defaults = DEFAULT_CALIBRATION_BY_UNIFORM[uniformId] || {};
    if(defaults[key]) return defaults[key];
    if(legacyPatchKey && defaults[legacyPatchKey]) return defaults[legacyPatchKey];
  }
  return State.calib.map[key] || (legacyPatchKey ? State.calib.map[legacyPatchKey] : null);
}
function normalizeCalibNumber(value,fallback=0){
  const parsed=Number.parseFloat(value);
  const safe=Number.isFinite(parsed) ? parsed : fallback;
  return Math.round(safe*1000)/1000;
}
function formatCalibNumber(value,fallback=0){
  return String(normalizeCalibNumber(value,fallback));
}
function setCalib(key, patch){
  if(!key) return;
  const bucket = getCalibBucket();
  const cur = bucket[key] || State.calib.map[key] || {};
  const precisePatch={...patch};
  for(const prop of ['x','y','w','h','r']){
    if(precisePatch[prop]!==undefined){
      precisePatch[prop]=normalizeCalibNumber(precisePatch[prop],prop==='w'||prop==='h' ? 1 : 0);
    }
  }
  bucket[key] = { ...cur, ...precisePatch };
  recordMasterCalibrationChange(key,bucket[key]);
}
function clearCalib(key){
  if(!key) return;
  const bucket = getCalibBucket();
  delete bucket[key];
  delete State.calib.map[key];
  const session=ensureMasterCalibrationSession();
  const bucketChanges=session.changesByUniform?.[getCurrentCalibUniform()];
  if(bucketChanges){
    delete bucketChanges[key];
    if(!Object.keys(bucketChanges).length){
      delete session.changesByUniform[getCurrentCalibUniform()];
      delete session.contextByUniform[getCurrentCalibUniform()];
    }
    updateMasterCalibrationStatus();
  }
}
function getLayerTypeFromKey(key, className=''){
  const k = String(key || '');
  if(k.startsWith('ribbon:')) return 'ribbon';
  if(k.startsWith('mini:')) return 'mini-medal';
  if(k.startsWith('medal:')) return 'full-size-medal';
  if(k.startsWith('badge:')) return 'badge';
  if(k.startsWith('patch:')) return 'patch';
  if(k.startsWith('device:')) return 'ribbon-device';
  if(k.startsWith('rank:')) return 'rank';
  if(k.startsWith('shoulderCord:')) return 'shoulder-cord';
  if(k.startsWith('text:')) return 'text';
  if(k.startsWith('arrow:')) return 'measurement-arrow';
  if(k === 'jacket') return 'base-uniform';
  if(String(className).includes('jacket')) return 'base-uniform';
  return 'layer';
}

function parseItemIdFromKey(key){
  const parts = String(key || '').split(':');
  if(parts.length >= 2) return parts[1];
  return String(key || '');
}

function readRenderedLayerRecord(el, index=0){
  if(!el) return null;
  const st = window.getComputedStyle(el);
  const left = normalizeCalibNumber(st.left,0);
  const top = normalizeCalibNumber(st.top,0);
  const width = normalizeCalibNumber(st.width,0);
  const height = normalizeCalibNumber(st.height,0);
  const transform = st.transform || '';
  const calibKey = el.dataset?.calibKey || `layer:${index}`;
  const calib = getCalib(calibKey) || {};
  let rotation = 0;

  if(calib.r !== undefined){
    rotation = Number(calib.r) || 0;
  }else if(transform && transform !== 'none'){
    const m = transform.match(/matrix\(([^)]+)\)/);
    if(m){
      const parts = m[1].split(',').map(v => parseFloat(v.trim()));
      if(parts.length >= 2){
        rotation = normalizeCalibNumber(Math.atan2(parts[1], parts[0]) * (180 / Math.PI),0);
      }
    }
  }

  const className = el.className || '';
  return {
    key: calibKey,
    type: getLayerTypeFromKey(calibKey, className),
    id: parseItemIdFromKey(calibKey),
    className,
    src: ('src' in el && el.src) ? el.getAttribute('src') || '' : '',
    text: el.tagName === 'DIV' ? (el.textContent || '') : '',
    x: left,
    y: top,
    w: width,
    h: height,
    r: rotation,
    naturalW: ('naturalWidth' in el) ? (el.naturalWidth || null) : null,
    naturalH: ('naturalHeight' in el) ? (el.naturalHeight || null) : null
  };
}

function collectRenderedLayerSnapshot(){
  return [...uniformCanvas.querySelectorAll('.layer')]
    .filter(el => el.dataset?.calibIgnore !== 'true')
    .map((el, index) => readRenderedLayerRecord(el, index))
    .filter(Boolean);
}

function collectRenderedLayerMap(){
  const map = {};
  collectRenderedLayerSnapshot().forEach((item, index) => {
    const key = item.key || `layer:${index}`;
    // If duplicate keys exist, preserve each layer instead of overwriting silently.
    if(map[key]){
      let i = 2;
      while(map[`${key}#${i}`]) i++;
      map[`${key}#${i}`] = item;
    }else{
      map[key] = item;
    }
  });
  return map;
}

function getAllCalibrationExport(){
  const renderedItems = collectRenderedLayerSnapshot();
  const renderedMap = collectRenderedLayerMap();
  return {
    app: 'CAP Uniform Builder',
    type: 'uniform-coordinate-calibration',
    exportedAt: new Date().toISOString(),
    activeUniform: State.uniform || null,
    activeCalibrationBucket: getCurrentCalibUniform(),
    activeMembership: State.membership || null,
    activeRank: State.rank || null,
    activeGender: State.gender || null,
    coordinatesByUniform: State.calib.byUniform || {},
    legacyCoordinates: State.calib.map || {},

    // This is the section to send back for placement help. It includes EVERY visible/rendered layer.
    // It does not drive placement on reload, so it will not break dynamic ribbon ordering.
    renderedItems,
    renderedItemsByUniform: {
      [getCurrentCalibUniform() || State.uniform || 'global']: renderedItems
    },
    renderedCoordinatesByUniform: {
      [getCurrentCalibUniform() || State.uniform || 'global']: renderedMap
    }
  };
}
function saveCalibrationToBrowser(){
  const payload = getAllCalibrationExport();
  payload.storageVersion = CAPUB_CALIBRATION_STORAGE_KEY;
  localStorage.setItem(CAPUB_CALIBRATION_STORAGE_KEY, JSON.stringify(payload));
  // Remove the old shared key so stale bad calibrations from earlier builds cannot keep shifting placement.
  try{ localStorage.removeItem(CAPUB_LEGACY_CALIBRATION_STORAGE_KEY); }catch(err){}
}
function downloadCalibrationJson(){
  const payload = JSON.stringify(getAllCalibrationExport(), null, 2);
  const blob = new Blob([payload], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CAPUB_coordinates_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function getFemaleClassAItemOffset(key){
  // Uploaded calibration buckets now carry the final gender-specific positions.
  // Do not apply the old hard-coded female Class A shift, because that double-shifts
  // calibrated assets after importing CAPUB_coordinates_1780678412590.json.
  return { x:0, y:0 };
}

function applyFemaleClassAItemOffset(v, key){
  const offset = getFemaleClassAItemOffset(key);
  if(offset.x || offset.y){
    if(v.x !== undefined && Number.isFinite(Number(v.x))) v.x = Number(v.x) + offset.x;
    if(v.y !== undefined && Number.isFinite(Number(v.y))) v.y = Number(v.y) + offset.y;
  }
  return v;
}

function applyCalibToElement(el, key, base){
  let over = getCalib(key) || buildDerivedBadgeCalib(key, base);

  // Ribbon geometry remains dynamic so precedence ordering and centered partial
  // rows cannot be broken by old per-award exports. Miniature medals are not
  // stripped here: an administrator who explicitly selects a `mini:` layer must
  // be able to calibrate its regulated size and placement, save it, and see that
  // calibration survive the next render.
  if(String(key || '').startsWith('ribbon:') && over){
    over = { ...over };
    delete over.x;
    delete over.y;
    delete over.w;
    delete over.h;
  }

  const v = applyFemaleClassAItemOffset({ ...base, ...(over||{}) }, key);

  if(v.x !== undefined) el.style.left = `${v.x}px`;
  if(v.y !== undefined) el.style.top  = `${v.y}px`;
  if(v.w !== undefined) el.style.width  = `${v.w}px`;
  if(v.h !== undefined) el.style.height = `${v.h}px`;

  const rot = (v.r !== undefined) ? v.r : 0;
  el.style.transform = `rotate(${rot}deg)`;
  el.style.transformOrigin = 'center center';

  return v;
}
function getSelectedCalibKeys(){
  const keys = Array.isArray(State.calib.selectedKeys) ? State.calib.selectedKeys.filter(Boolean) : [];
  if(keys.length) return [...new Set(keys)];
  return State.calib.selectedKey ? [State.calib.selectedKey] : [];
}
function getRenderedRecordForKey(key){
  const el = findLayerByCalibKey(key);
  if(!el) return null;
  return readRenderedLayerRecord(el, 0);
}
function buildCalibJson(key){
  const saved = getCalib(key) || {};
  const rendered = getRenderedRecordForKey(key);
  return JSON.stringify({
    uniform: getCurrentCalibUniform(),
    key,
    savedCalibration: saved,
    rendered: rendered || { key, ...saved }
  }, null, 2);
}
function buildSelectedCalibJson(){
  const keys = getSelectedCalibKeys();
  const payload = {
    uniform: getCurrentCalibUniform(),
    selectedCount: keys.length,
    assets: keys.map(key => ({
      key,
      savedCalibration: getCalib(key) || {},
      rendered: getRenderedRecordForKey(key) || null
    }))
  };
  return JSON.stringify(payload, null, 2);
}
function refreshCalibratorReadout(){
  const outJson = by('calibJson');
  if(!outJson) return;
  const keys = getSelectedCalibKeys();
  if(!keys.length){ outJson.textContent=''; return; }
  outJson.textContent = keys.length === 1 ? buildCalibJson(keys[0]) : buildSelectedCalibJson();
}

/* ==========================================================
   FIX: robust element lookup for calib keys with special chars
   (prevents querySelector from failing on keys like "C/2d Lt")
   ========================================================== */
function findLayerByCalibKey(key){
  if(!key) return null;
  let el = null;
  try{
    el = uniformCanvas.querySelector(`.layer[data-calib-key="${CSS.escape(key)}"]`);
  }catch(err){
    el = [...uniformCanvas.querySelectorAll('.layer')].find(n => n.dataset.calibKey === key) || null;
  }
  return el;
}

function nudgeSelected(dx,dy){
  const keys = getSelectedCalibKeys();
  if(!keys.length) return;

  keys.forEach(key => {
    const el = findLayerByCalibKey(key);
    const st = el ? window.getComputedStyle(el) : null;
    const cur = getCalib(key) || {};
    const x = (cur.x !== undefined) ? normalizeCalibNumber(cur.x,0) : normalizeCalibNumber(st?.left,0);
    const y = (cur.y !== undefined) ? normalizeCalibNumber(cur.y,0) : normalizeCalibNumber(st?.top,0);
    const nx = normalizeCalibNumber(x + dx,0);
    const ny = normalizeCalibNumber(y + dy,0);
    setCalib(key, { x:nx, y:ny });
    if(el){
      el.style.left = nx+'px';
      el.style.top  = ny+'px';
    }
  });

  const primary = keys[0];
  const pEl = findLayerByCalibKey(primary);
  if(pEl){
    const st = window.getComputedStyle(pEl);
    const x = normalizeCalibNumber(st.left,0);
    const y = normalizeCalibNumber(st.top,0);
    const xr = by('calX'), xn = by('calXn');
    const yr = by('calY'), yn = by('calYn');
    if(xr) xr.value = formatCalibNumber(x); if(xn) xn.value = formatCalibNumber(x);
    if(yr) yr.value = formatCalibNumber(y); if(yn) yn.value = formatCalibNumber(y);
  }
  refreshCalibratorReadout();
}
