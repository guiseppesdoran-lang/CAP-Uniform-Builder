// Developer tools (the calibrator) exist only when the page is opened with ?dev=1.
const CAPUB_DEV = new URLSearchParams(location.search).has('dev');
if(CAPUB_DEV) document.documentElement.dataset.dev = '1';
// ?ux=2 turns on the guided flow (one step at a time). Without it the page is unchanged.
const CAPUB_GUIDED = new URLSearchParams(location.search).get('ux') === '2';
if(CAPUB_GUIDED) document.documentElement.dataset.ux = '2';

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
  ribbonRackLayout:'4-left',
  ribbonRackArrangement:'lapel',
  ribbonRowOverrideEnabled:false,
  ribbonRowOverride:[],
  // Garment choices (sleeves, skirt, headgear...): see js/garment-options.js.
  garment:{},

  ribbonSelections:{}, 
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
  badgeGalleryExpanded:false,
  // Null until a member report is imported. Once populated, the badge picker
  // separates report-authorized badges from the remaining eligible catalog.
  reportAuthorizedBadgeIds:null,

  patchSelections:{},
  patchGalleryExpanded:false,

  commandInsignia:{
    graduatedCommander:false
  },

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

const SENIOR_NCO_RANKS = new Set(["SSgt","TSgt","MSgt","SMSgt","CMSgt"]);
const OFFICER_RANKS = new Set([
  "2d Lt","1st Lt","Capt","Maj","Lt Col","Col","Brig Gen","Maj Gen",
  "C/2d Lt","C/1st Lt","C/Capt","C/Maj","C/Lt Col","C/Col"
]);

