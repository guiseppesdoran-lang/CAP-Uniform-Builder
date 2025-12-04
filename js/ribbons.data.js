// js/ribbons.data.js
// Catalog for all ribbons, devices, and associated metadata.
// Each entry defines an id, display name, precedence, and image.
// Precedence ordering is critical for rack building (lower number = higher precedence).

const RIBBONS = [
  {
    id: "spaatz_award",
    name: "Gen. Carl A. Spaatz Award",
    precedence: 1,
    img: "ribbons/spaatz_award.png",
  },
  {
    id: "eaker_award",
    name: "Gen. Ira C. Eaker Award",
    precedence: 2,
    img: "ribbons/eaker_award.png",
  },
  {
    id: "earhart_award",
    name: "Amelia Earhart Award",
    precedence: 3,
    img: "ribbons/earhart_award.png",
  },
  {
    id: "mitchell_award",
    name: "Billy Mitchell Award",
    precedence: 4,
    img: "ribbons/mitchell_award.png",
  },
  {
    id: "armstrong_achievement",
    name: "Neil Armstrong Achievement",
    precedence: 5,
    img: "ribbons/armstrong_achievement.png",
  },
  {
    id: "curry_achievement",
    name: "Gen. J. F. Curry Achievement",
    precedence: 6,
    img: "ribbons/curry_achievement.png",
  },
  {
    id: "mary_feik_achievement",
    name: "Mary Feik Achievement",
    precedence: 7,
    img: "ribbons/mary_feik_achievement.png",
  },
  {
    id: "wright_brothers_award",
    name: "Wright Brothers Award",
    precedence: 8,
    img: "ribbons/wright_brothers_award.png",
  },
  {
    id: "lindbergh_achievement",
    name: "Charles Lindbergh Achievement",
    precedence: 9,
    img: "ribbons/lindbergh_achievement.png",
  },
  {
    id: "hap_arnold_achievement",
    name: "Henry H. “Hap” Arnold Achievement",
    precedence: 10,
    img: "ribbons/hap_arnold_achievement.png",
  },
  {
    id: "rickenbacker_achievement",
    name: "Eddie Rickenbacker Achievement",
    precedence: 11,
    img: "ribbons/rickenbacker_achievement.png",
  },
  {
    id: "doolittle_achievement",
    name: "James Doolittle Achievement",
    precedence: 12,
    img: "ribbons/doolittle_achievement.png",
  },
  {
    id: "goddard_achievement",
    name: "Robert H. Goddard Achievement",
    precedence: 13,
    img: "ribbons/goddard_achievement.png",
  },

{
  id: "encampment_ribbon",
  name: "Encampment Ribbon",
  precedence: 15,
  img: "ribbons/encampment_ribbon.png",
},
{
  id: "community_service_ribbon",
  name: "Community Service Ribbon",
  precedence: 24,
  img: "ribbons/community_service_ribbon.png",
},
{
  id: "cadet_recruiter_ribbon",
  name: "Cadet Recruiter Ribbon",
  precedence: 25,
  img: "ribbons/cadet_recruiter_ribbon.png",
},
{
  id: "national_cadet_competition_ribbon",
  name: "National Cadet Competition Ribbon",
  precedence: 16,
  img: "ribbons/national_cadet_competition_ribbon.png",
},
{
  id: "national_color_guard_competition_ribbon",
  name: "National Color Guard Competition Ribbon",
  precedence: 30,
  img: "ribbons/national_color_guard_competition_ribbon.png",
},
{
  id: "commanders_commendation_award",
  name: "Commander’s Commendation Award",
  precedence: 20,
  img: "ribbons/commander_commendation_award.png",
},
{
  id: "cap_achievement_award",
  name: "CAP Achievement Award",
  precedence: 21,
  img: "ribbons/cap_achievment_award.png", // note: filename is spelled "achievment"
},
{
  id: "vfw_nco_award",
  name: "VFW NCO Award",
  precedence: 18,
  img: "ribbons/vfw_nco_award.png",
},
{
  id: "vfw_officer_award",
  name: "VFW Officer Award",
  precedence: 19,
  img: "ribbons/vfw_officer_award.png",
},
{
  id: "red_service_ribbon",
  name: "Red Service Ribbon",
  precedence: 31,
  img: "ribbons/red_service_ribbon.png",
},
{
  id: "disaster_relief_ribbon",
  name: "Disaster Relief Ribbon",
  precedence: 23,
  img: "ribbons/disaster_relief_ribbon.png",
},

  {
  id: "cap_gill_robb_wilson_ribbon",
  name: "Gill Robb Wilson Award",
  precedence: 40,
  img: "ribbons/cap_gill_robb_wilson_ribbon.png",
},
{
  id: "cap_paul_e_garber_ribbon",
  name: "Paul E. Garber Award",
  precedence: 41,
  img: "ribbons/cap_paul_e_garber_ribbon.png",
},
{
  id: "cap_grover_loening_aerospace_ribbon",
  name: "Grover Loening Award",
  precedence: 42,
  img: "ribbons/cap_grover_loening_aerospace_ribbon.png",
},
{
  id: "cap_leadership_ribbon",
  name: "CAP Leadership Ribbon",
  precedence: 43,
  img: "ribbons/cap_leadership_ribbon.png",
},
{
  id: "cap_membership_ribbon",
  name: "CAP Membership Ribbon",
  precedence: 44,
  img: "ribbons/cap_membership_ribbon.png",
},
{
  id: "cap_senior_recruiter_ribbon",
  name: "CAP Senior Recruiter Ribbon",
  precedence: 45,
  img: "ribbons/cap_senior_recruiter_ribbon.png",
},
{
  id: "cap_command_service_ribbon",
  name: "CAP Command Service Ribbon",
  precedence: 46,
  img: "ribbons/cap_command_service_ribbon.png",
},
{
  id: "cap_counterdrug_ribbon",
  name: "CAP Counterdrug Ribbon",
  precedence: 47,
  img: "ribbons/cap_counterdrug_ribbon.png",
},
{
  id: "cap_world_war_2_service_ribbon",
  name: "CAP World War II Service Ribbon",
  precedence: 48,
  img: "ribbons/cap_world_war_2_service_ribbon.png",
},
{
  id: "cap_cadet_orientation_pilot_ribbon",
  name: "CAP Cadet Orientation Pilot Ribbon",
  precedence: 27,
  img: "ribbons/cap_cadet_orientation_pilot_ribbon.png",
},
// etc...

  
];

/**
 * Map of known devices (stars, clasps, numerals, etc.)
 * used to augment ribbons visually.
 */
const DEVICE_LIST = [
  "bronze_star",
  "silver_star",
  "bronze_clasp",
  "silver_clasp",
  "bronze_triangle",
  "silver_triangle",
  "propeller_device",
  "v_device",
];

const DEVICE_META = {
  bronze_star: { img: "devices/bronze_star.png", type: "star" },
  silver_star: { img: "devices/silver_star.png", type: "star" },
  bronze_clasp: { img: "devices/bronze_clasp.png", type: "clasp" },
  silver_clasp: { img: "devices/silver_clasp.png", type: "clasp" },
  bronze_triangle: { img: "devices/bronze_triangle.png", type: "triangle" },
  silver_triangle: { img: "devices/silver_triangle.png", type: "triangle" },
  propeller_device: { img: "devices/propeller_device.png", type: "propeller" },
  v_device: { img: "devices/v_device.png", type: "valor" },
};

/**
 * Helper: sort ribbons by precedence ascending (1 = highest)
 */
function sortRibbonsByPrecedence(ribbons) {
  return ribbons.sort((a, b) => a.precedence - b.precedence);
}

/**
 * Helper: get a ribbon by ID safely
 */
function getRibbonById(id) {
  return RIBBONS.find((r) => r.id === id) || null;
}

/**
 * Helper: resolve full image path given a ribbon id and asset base
 */
function resolveRibbonImg(id, assetBase = "images") {
  const ribbon = getRibbonById(id);
  if (!ribbon) return null;
  const base = assetBase.replace(/\/$/, "");
  const rel = ribbon.img.replace(/^images\//, "");
  return `${base}/${rel}`;
}

// Expose ribbon and device metadata for the non-module UI/renderer
window.ribbonsMeta = RIBBONS;
window.deviceMeta = DEVICE_META;

// Stub mini-medal map for now if it isn't defined elsewhere
window.miniMedalMap = window.miniMedalMap || {};


