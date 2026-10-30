// Developer tools (the calibrator) exist only when the page is opened with ?dev=1.
const CAPUB_DEV = new URLSearchParams(location.search).has('dev');
if(CAPUB_DEV) document.documentElement.dataset.dev = '1';

// Short messages go to the page's toast; the browser alert is only the fallback before it exists.
function capubNotify(message, ms){
  if(typeof window.capubToastShow === 'function') window.capubToastShow(message, ms);
  else alert(message);
}

// Extracted verbatim from index.html: global state, membership/rank data and the base placement
// constants. Must load first among the app scripts.

/* ===========================
   GLOBAL STATE
   =========================== */

// --- CSS.escape polyfill (fixes selector issues with keys like "C/2d Lt") ---
if (typeof CSS === "undefined") window.CSS = {};
if (typeof CSS.escape !== "function") {
  CSS.escape = function (value) {
    return String(value).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, function (ch) {
      return "\\" + ch;
    });
  };
}

const State = {
  organization:'CAP',
  component:'ACTIVE',
  militaryAwards:{},
  militaryBadges:{},
  militaryRepresentation:'RIBBON',
  membership:'',
  gender:'',
  uniform:'blues_a',
  assetBase:'images',

  ribbons:[], // array of {id, devices:{}}
  badges:[],  // array of badge ids
  patches:[], // array of patch ids
  shoulderCord:null,
  unitPatchCharter:'',

  rank:null,
  cadetFirstSergeant:false,

  cadetHighestOnly:false,
  adultCadet:false,
  miniMountStyle:'mounting',
  ribbonRackLayout:'3', // rows of three unless the member picks four where 11.2.7 allows it
  ribbonRackArrangement:'lapel',
  ribbonRowOverrideEnabled:false,
  ribbonRowOverride:[],
  // Garment choices (sleeves, skirt, headgear...): see js/garment-options.js.
  garment:{},

  ribbonSelections:{}, 
  // The ribbons the setup's Rank select added for a cadet grade (js/setup.js capubApplyGradeRibbons): null, or
  // { rank, ids }. Only these come off again when the grade goes down; a ribbon the member checked or changed by hand
  // is never in it, and a member report import clears it (the import's selections win). Saved with the setup.
  gradeRibbons:null,
  ribbonGalleryExpanded:false,
  militaryUIState:{
    selectorOpen:true,
    expandedSections:[],
    sidebarScrollTop:0,
    modalScrollTop:0,
    catalogScrollTop:0,
    searchValue:'',
    serviceFilter:'ALL',
    awardTypeFilter:'ALL',
    focusedControl:null
  },

  badgeSelections:{},
  // Which badge goes where, for the positions that have more badges to place than one: { [uniformId]: { [position]: badgeId | { [slotKey]: badgeId } } }.
  // A position with one place (the one aviation badge) keeps a badge id; one with several places (left pocket, right pocket, over the nametag...)
  // keeps one badge id per place; an id alone, as saved before the places, is the first place. The engine reports the positions
  // (scene.conflicts); the Badges panel asks. Saved with the setup.
  badgeChoices:{},
  badgeGalleryExpanded:false,
  // Null until a member report is imported. Once populated, the badge picker
  // separates report-authorized badges from the remaining eligible catalog.
  reportAuthorizedBadgeIds:null,

  patchSelections:{},
  patchGalleryExpanded:false,

  commandInsignia:{
    graduatedCommander:false
  },

  // Remove ribbons (LIVE13): the shirts where ribbons are optional are drawn without the rack while the selections stay
  // (js/uniform-view.js buildRibbons reads it only where data/uniform-rules.js makes ribbons optional). Saved with the setup.
  hideRibbons:false,

  // UNIVERSAL calibration (per-layer key)
};

// Make State globally visible so later patch modules and popup/tooling code can
// safely read/write State without failing on window.State checks.
window.State = State;

/* ===========================
   MEMBERSHIP/RANK DATA
   =========================== */
const RANKS = {
  senior: ["SM","SSgt","TSgt","MSgt","SMSgt","CMSgt","FO","TFO","SFO","2d Lt","1st Lt","Capt","Maj","Lt Col","Col","Brig Gen","Maj Gen"],
  cadet: ["C/AB","C/Amn","C/A1C","C/SrA","C/SSgt","C/TSgt","C/MSgt","C/SMSgt","C/CMSgt","C/2d Lt","C/1st Lt","C/Capt","C/Maj","C/Lt Col","C/Col"]
};

// The ribbons a cadet grade implies (LIVE13 E66, Ethan: "if someone selects a grade, it goes along with the ribbons
// required to get it. like for C/Lt Col, if selected, it selects all ach ribbons except spaatz and the encampment ribbon").
// The cadet program's achievements and milestones in the order they are earned, as js/catalog.js CADET_ACHIEVEMENT_RIBBONS
// and the member report importer's achievement map order them (Curry 1, Arnold 2, Feik 3, the Wright Brothers Award after
// Achievement 3, Rickenbacker 4 to Armstrong 8, the Mitchell Award after Achievement 8, then Earhart, Eaker, Spaatz),
// each beside the grade it earns under CAPR 60-1: Achievements 1-3 make C/Amn, C/A1C and C/SrA; the Wright Brothers
// Award, which closes Phase I, makes C/SSgt; Achievements 4-7 make C/TSgt to C/CMSgt; Achievement 8 (Armstrong) brings
// no new grade, and the Mitchell Award, which needs it and an encampment, makes C/2d Lt; Achievements 9-11 have no ribbon
// (C/1st Lt) and the Earhart Award, closing Phase III, makes C/Capt; Achievements 12-15 have none (C/Maj); the Eaker Award,
// closing Phase IV, makes C/Lt Col, and the Spaatz Award C/Col. CAPR 60-1 is not in this repository and CAPR 39-1 does not
// state the grades, so the grade beside each step is CAPR 60-1 as read outside it (see the E66 commit). A grade implies
// every step up to and including its own. A senior member's grade implies no ribbon: promotion is not tied to one.
const CADET_GRADE_RIBBON_STEPS = Object.freeze([
  ['C/AB', []],
  ['C/Amn', ['curry_achievement']],
  ['C/A1C', ['hap_arnold_achievement']],
  ['C/SrA', ['mary_feik_achievement']],
  ['C/SSgt', ['wright_brothers_award']],
  ['C/TSgt', ['rickenbacker_achievement']],
  ['C/MSgt', ['lindbergh_achievement']],
  ['C/SMSgt', ['doolittle_achievement']],
  ['C/CMSgt', ['goddard_achievement']],
  ['C/2d Lt', ['armstrong_achievement','mitchell_award','encampment_ribbon']],
  ['C/1st Lt', []],
  ['C/Capt', ['earhart_award']],
  ['C/Maj', []],
  ['C/Lt Col', ['eaker_award']],
  ['C/Col', ['spaatz_award']]
]);
// Every ribbon some cadet grade implies, lowest grade first.
const CADET_GRADE_RIBBON_IDS = Object.freeze(CADET_GRADE_RIBBON_STEPS.flatMap(([,ids])=>ids));
// The ribbons the grade implies, in the order they are earned; [] for a senior grade, C/AB or no grade.
function capubGradeImpliedRibbons(rank){
  const at = CADET_GRADE_RIBBON_STEPS.findIndex(([grade])=>grade === rank);
  if(at < 0) return [];
  return CADET_GRADE_RIBBON_STEPS.slice(0, at + 1).flatMap(([,ids])=>ids);
}

const SENIOR_NCO_RANKS = new Set(["SSgt","TSgt","MSgt","SMSgt","CMSgt"]);
const OFFICER_RANKS = new Set([
  "2d Lt","1st Lt","Capt","Maj","Lt Col","Col","Brig Gen","Maj Gen",
  "C/2d Lt","C/1st Lt","C/Capt","C/Maj","C/Lt Col","C/Col"
]);

