// js/ribbons.data.js
// Catalog for all ribbons, devices, and associated metadata.
// Each entry defines an id, display name, precedence, and image.
// Precedence ordering is critical for rack building (lower number = higher precedence).

export const RIBBONS = [
  { id: "gen_carl_spaatz_award", name: "Gen. Carl A. Spaatz Award", precedence: 1, img: "ribbons/gen_carl_spaatz_award.png" },
  { id: "gen_ira_eaker_award", name: "Gen. Ira C. Eaker Award", precedence: 2, img: "ribbons/gen_ira_eaker_award.png" },
  { id: "ameilia_earhart_award", name: "Amelia Earhart Award", precedence: 3, img: "ribbons/amelia_earhart_award.png" },
  { id: "billy_mitchell_award", name: "Billy Mitchell Award", precedence: 4, img: "ribbons/billy_mitchell_award.png" },
  { id: "neil_armstrong_award", name: "Neil Armstrong Achievement", precedence: 5, img: "ribbons/neil_armstrong_award.png" },
  { id: "general_curry_award", name: "Gen. J. F. Curry Achievement", precedence: 6, img: "ribbons/general_curry_award.png" },
  { id: "feik_achievement", name: "Mary Feik Achievement", precedence: 7, img: "ribbons/feik_achievement.png" },
  { id: "wright_brothers_award", name: "Wright Brothers Award", precedence: 8, img: "ribbons/wright_brothers_award.png" },
  { id: "lindbergh_achievement", name: "Charles Lindbergh Achievement", precedence: 9, img: "ribbons/lindbergh_achievement.png" },
  { id: "arnold_achievement", name: "Henry H. Arnold Achievement", precedence: 10, img: "ribbons/arnold_achievement.png" },
  { id: "ritchie_achievement", name: "Eddie Rickenbacker Achievement", precedence: 11, img: "ribbons/ritchie_achievement.png" },
  { id: "doolittle_achievement", name: "James Doolittle Achievement", precedence: 12, img: "ribbons/doolittle_achievement.png" },
  { id: "godfrey_achievement", name: "Frank Luke Achievement", precedence: 13, img: "ribbons/godfrey_achievement.png" },
  { id: "cadet_community_service_ribbon", name: "Cadet Community Service Ribbon", precedence: 14, img: "ribbons/cadet_community_service_ribbon.png" },
  { id: "encampment_ribbon", name: "Encampment Ribbon", precedence: 15, img: "ribbons/encampment_ribbon.png" },
  { id: "drill_team_ribbon", name: "National Cadet Competition Ribbon", precedence: 16, img: "ribbons/drill_team_ribbon.png" },
  { id: "cadet_of_the_year_ribbon", name: "Cadet of the Year Ribbon", precedence: 17, img: "ribbons/cadet_of_the_year_ribbon.png" },
  { id: "vfw_cadet_nco_award", name: "VFW Cadet NCO Award", precedence: 18, img: "ribbons/vfw_cadet_nco_award.png" },
  { id: "vfw_cadet_officer_award", name: "VFW Cadet Officer Award", precedence: 19, img: "ribbons/vfw_cadet_officer_award.png" },
  { id: "commanders_commendation", name: "Commander’s Commendation Award", precedence: 20, img: "ribbons/commanders_commendation.png" },
  { id: "achievement_award", name: "Achievement Award", precedence: 21, img: "ribbons/achievement_award.png" },
  { id: "cert_of_appreciation", name: "Certificate of Appreciation", precedence: 22, img: "ribbons/cert_of_appreciation.png" },
  { id: "disaster_relief_ribbon", name: "Disaster Relief Ribbon", precedence: 23, img: "ribbons/disaster_relief_ribbon.png" },
  { id: "community_service", name: "Community Service Ribbon", precedence: 24, img: "ribbons/community_service.png" },
  { id: "recruiter_ribbon", name: "Recruiter Ribbon", precedence: 25, img: "ribbons/recruiter_ribbon.png" },
  { id: "aerospace_education_ribbon", name: "Aerospace Education Ribbon", precedence: 26, img: "ribbons/aerospace_education_ribbon.png" },
  { id: "cadet_orientation_pilot_ribbon", name: "Cadet Orientation Pilot Ribbon", precedence: 27, img: "ribbons/cadet_orientation_pilot_ribbon.png" },
  { id: "model_rocketry_badge_ribbon", name: "Model Rocketry Ribbon", precedence: 28, img: "ribbons/model_rocketry_badge_ribbon.png" },
  { id: "air_force_association_award", name: "Air Force Association Award", precedence: 29, img: "ribbons/air_force_association_award.png" },
  { id: "color_guard_ribbon", name: "Color Guard Ribbon", precedence: 30, img: "ribbons/color_guard_ribbon.png" },
  { id: "red_service_ribbon", name: "Red Service Ribbon", precedence: 31, img: "ribbons/red_service_ribbon.png" },
];

/**
 * Map of known devices (stars, clasps, numerals, etc.)
 * used to augment ribbons visually.
 */
export const DEVICE_LIST = [
  "bronze_star",
  "silver_star",
  "bronze_clasp",
  "silver_clasp",
  "bronze_triangle",
  "silver_triangle",
  "propeller_device",
  "v_device",
];

export const DEVICE_META = {
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
export function sortRibbonsByPrecedence(ribbons) {
  return ribbons.sort((a, b) => a.precedence - b.precedence);
}

/**
 * Helper: get a ribbon by ID safely
 */
export function getRibbonById(id) {
  return RIBBONS.find((r) => r.id === id) || null;
}

/**
 * Helper: resolve full image path given a ribbon id and asset base
 */
export function resolveRibbonImg(id, assetBase = "images") {
  const ribbon = getRibbonById(id);
  if (!ribbon) return null;
  const base = assetBase.replace(/\/$/, "");
  const rel = ribbon.img.replace(/^images\//, "");
  return `${base}/${rel}`;
}

