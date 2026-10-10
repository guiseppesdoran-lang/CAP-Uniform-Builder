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

  deviceApplyMode:false,
  deviceRemoveMode:false,
  selectedDevices:{},
  ribbonDragMode:false,
  forceMini:false,
  cadetHighestOnly:false,
  adultCadet:false,
  miniMountStyle:'mounting',
  ribbonRackLayout:'4-left',
  ribbonRackArrangement:'lapel',
  ribbonRowOverrideEnabled:false,
  ribbonRowOverride:[],
  showMeasurementOverlay:false,
  garmentOverlayMode:'both',
  garmentMasks:{},

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
  calib:{
    enabled:false,
    selectedKey:null,
    selectedKeys:[], // multi-select layer keys for admin calibration
    map:{}, // legacy/global fallback: key -> {x,y,w,h,r}
    byUniform:{}, // uniformId -> { layerKey -> {x,y,w,h,r} }
    masterSession:{
      active:false,
      startedAt:null,
      changesByUniform:{},
      contextByUniform:{}
    }
  }
};

// Make State globally visible so later patch modules and popup/tooling code can
// safely read/write State without failing on window.State checks.
window.State = State;

const CAPUB_GARMENT_MASK_STORAGE_KEY = 'capub_garment_alpha_masks_v1';
try{
  const savedGarmentMasks = JSON.parse(localStorage.getItem(CAPUB_GARMENT_MASK_STORAGE_KEY) || '{}');
  if(savedGarmentMasks && typeof savedGarmentMasks === 'object') State.garmentMasks = savedGarmentMasks;
}catch(err){
  State.garmentMasks = {};
}

let currentDrag = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

/* ===========================
   MEMBERSHIP/RANK DATA
   =========================== */
const RANKS = {
  senior: ["SM","SSgt","TSgt","MSgt","SMSgt","CMSgt","2d Lt","1st Lt","Capt","Maj","Lt Col","Col","Brig Gen","Maj Gen"],
  cadet: ["C/AB","C/Amn","C/A1C","C/SrA","C/SSgt","C/TSgt","C/MSgt","C/SMSgt","C/CMSgt","C/2d Lt","C/1st Lt","C/Capt","C/Maj","C/Lt Col","C/Col"]
};

const SENIOR_NCO_RANKS = new Set(["SSgt","TSgt","MSgt","SMSgt","CMSgt"]);
const OFFICER_RANKS = new Set([
  "2d Lt","1st Lt","Capt","Maj","Lt Col","Col","Brig Gen","Maj Gen",
  "C/2d Lt","C/1st Lt","C/Capt","C/Maj","C/Lt Col","C/Col"
]);

/* ===========================
   BASE PLACEMENT CONSTANTS
   =========================== */
let rackBaseX = 259; // LEFT EDGE of a 3-wide rack
let rackBaseY = 206; // TOP of bottom row

const RIBBON_WIDTH  = 23;
// CAPR 39-1 gives the service ribbon as 1 3/8 by 3/8 inches. Keep that
// physical 11:3 aspect ratio instead of stretching the artwork vertically.
const RIBBON_HEIGHT = RIBBON_WIDTH * (0.375 / 1.375);
const RIBBON_GAP_X  = 0;
const RIBBON_GAP_Y  = 0;

/*
  Per-uniform ribbon rack geometry.
  Male Class B intentionally reuses the male Class A rack geometry for both cadet and senior modes.
  This keeps all rendered image asset sizes and locations consistent between male Class A and male Class B.
*/
const RIBBON_LAYOUT_BY_UNIFORM = {
  // Men's Class A senior-member calibration: x columns 259/282/305 and top/bottom rows from the latest export.
  // Class A alone permits rows of four. The calibrated three-across origin is
  // converted at render time to either the wearer-left/outboard edge alignment
  // or the pocket-centered four-across placement authorized by CAPR 39-1.
  blues_a: { baseX: 259, bottomY: 206, columns: 4, w: RIBBON_WIDTH, h: RIBBON_HEIGHT, gapX: 0, gapY: 0 },
  // Class B and aviator-shirt racks remain rows of three.
  blues_b: { baseX: 259, bottomY: 206, columns: 3, w: RIBBON_WIDTH, h: RIBBON_HEIGHT, gapX: 0, gapY: 0 }
};
const MINI_MEDAL_LAYOUT_BY_UNIFORM = {
  // Male Mess Dress imported from CAPUB_coordinates_1786074847808.json.
  // The rack is centered at x=335 and its bottom row begins at y=184.
  // Vertical overlap is computed from the regulated miniature-medal scale.
  mess_dress_male: { centerX:335, bottomY:184 },

  // Female Mess Dress imported from CAPUB_coordinates_1786003225794.json.
  mess_dress_female: { centerX:317, bottomY:196 },

  // Corporate Semi-Formal has a lower, more inboard breast pocket than Mess
  // Dress. Center the rack on that pocket and keep its lower edge 1/2 inch
  // above the built-in CAP crest/service-badge position.
  semi_formal_male: { centerX:318, bottomY:198 },
  semi_formal_female: { centerX:317, bottomY:196 }
};
function getRibbonLayout(uniformId = State.uniform, rackLayoutOverride=null){
  const baseUniformId = uniformId || State.uniform || '';
  const genderBucketId = State.gender ? `${baseUniformId}_${State.gender}` : baseUniformId;
  const override = RIBBON_LAYOUT_BY_UNIFORM[genderBucketId] || RIBBON_LAYOUT_BY_UNIFORM[baseUniformId] || {};
  const w = override.w ?? RIBBON_WIDTH;
  const h = override.h ?? RIBBON_HEIGHT;
  const gapX = override.gapX ?? RIBBON_GAP_X;
  const gapY = override.gapY ?? RIBBON_GAP_Y;
  // CAPR 39-1 authorizes four-across ribbon rows only on the USAF-style
  // Service Dress (Class A). All Class B and aviator-shirt racks are
  // unconditionally limited to rows of three, even if a saved profile carries
  // a Class A four-across preference.
  const layoutPreference = rackLayoutOverride ?? State.ribbonRackLayout;
  const requestedRackLayout = ['3','4-left','4-center'].includes(String(layoutPreference))
    ? String(layoutPreference)
    : '4-left';
  const requestedColumns = requestedRackLayout === '3' ? 3 : 4;
  const columns = baseUniformId === 'blues_a' ? requestedColumns : 3;
  const configuredBaseX = override.baseX ?? rackBaseX;
  // The calibrated three-across rack is centered over the pocket. In a
  // front-facing preview, the wearer's left/outboard pocket edge is the
  // screen-right edge. Preserve that edge for the CAPR-authorized edge-aligned
  // four-across option; preserve the pocket centerline for the centered option.
  const threeAcrossWidth = (w*3) + (gapX*2);
  const requestedRackWidth = (w*columns) + (gapX*(columns-1));
  const pocketCenterX = configuredBaseX + threeAcrossWidth/2;
  const pocketOutboardX = configuredBaseX + threeAcrossWidth;
  let baseX = configuredBaseX;
  if(baseUniformId === 'blues_a' && requestedRackLayout === '4-center'){
    baseX = pocketCenterX - requestedRackWidth/2;
  }else if(baseUniformId === 'blues_a' && requestedRackLayout === '4-left'){
    baseX = pocketOutboardX - requestedRackWidth;
  }
  const bottomY = override.bottomY ?? rackBaseY;
  return {
    baseX,
    bottomY,
    columns,
    w,
    h,
    gapX,
    gapY,
    centerX: baseX + requestedRackWidth/2,
    wearerLeftPocketEdgeX: pocketOutboardX
  };
}

function rackSpanW(){
  const m = getRibbonLayout();
  return (m.w*m.columns) + (m.gapX*(m.columns-1));
}
function rackCenterX(){
  return getRibbonLayout().centerX;
}
function getRackOrigin(){
  const m = getRibbonLayout();
  return { x:m.baseX, y:m.bottomY };
}
