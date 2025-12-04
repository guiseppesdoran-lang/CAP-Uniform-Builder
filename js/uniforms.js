// js/uniforms.js
// Uniform catalog, capability flags, and small helpers used by UI/rendering.
// No DOM work here—pure data + utilities.

/**
 * UNIFORMS
 * - key: uniform id
 * - value: {
 *     male:   base image path for male cut
 *     female: base image path for female cut
 *     ribbons: boolean   -> if full-size ribbons are worn
 *     mini:    boolean   -> if uniform uses miniature medals by default
 *   }
 */
const UNIFORMS = {
  blues_a: {
    male: "base/jacket_male.png",
    female: "base/jacket_female.png",
    ribbons: true,
    mini: false,
  },
  blues_b: {
    male: "base/blues_class_b_male.png",
    female: "base/blues_class_b_female.png",
    ribbons: true,
    mini: false,
  },
  mess_dress: {
    male: "base/mess_dress_male.png",
    female: "base/mess_dress_female.png",
    ribbons: false,
    mini: true,
  },
  semi_formal: {
    male: "base/semi_male.png",
    female: "base/semi_female.png",
    ribbons: false,
    mini: true,
  },
  aviator: {
    male: "base/aviator_shirt_male.png",
    female: "base/aviator_shirt_female.png",
    ribbons: true,
    mini: false,
  },
  aviator_blazer: {
    male: "base/aviator_blazer_male.png",
    female: "base/aviator_blazer_female.png",
    ribbons: true,
    mini: false,
  },
  corporate_field: {
    male: "base/corporate_field_male.png",
    female: "base/corporate_field_female.png",
    ribbons: true,
    mini: false,
  },
  abu: {
    male: "base/ABU_male.png",
    female: "base/ABU_female.png",
    ribbons: false,
    mini: false,
  },
  flight_suit: {
    male: "base/flight_suit_male.png",
    female: "base/flight_suit_female.png",
    ribbons: false,
    mini: false,
  },
  polo: {
    male: "base/polo_male.png",
    female: "base/polo_female.png",
    ribbons: false,
    mini: false,
  },
};

// Expose uniforms for non-module scripts
window.uniforms = UNIFORMS;

/**
 * UI_AUTHZ controls which side-panels are shown for each uniform.
 * It is UI-only; renderers should still check the presence of data.
 */
const UI_AUTHZ = {
  blues_a: { showRibbons: true, showBadges: true, showPatches: false },
  blues_b: { showRibbons: true, showBadges: true, showPatches: false },
  aviator: { showRibbons: true, showBadges: true, showPatches: false },
  aviator_blazer: { showRibbons: true, showBadges: true, showPatches: false },
  corporate_field: { showRibbons: true, showBadges: false, showPatches: true },
  mess_dress: { showRibbons: false, showBadges: true, showPatches: false },
  semi_formal: { showRibbons: false, showBadges: true, showPatches: false },
  abu: { showRibbons: false, showBadges: false, showPatches: true },
  flight_suit: { showRibbons: false, showBadges: false, showPatches: true },
  polo: { showRibbons: false, showBadges: false, showPatches: false },
};

/**
 * Some uniforms are "field" and trigger badge/patch/ribbon alternates.
 */
function isFieldUniform(uniformId) {
  return (
    uniformId === "abu" ||
    uniformId === "flight_suit" ||
    uniformId === "corporate_field"
  );
}

/**
 * Capabilities for patch slots by uniform (used by patches planner).
 * slots: L_SHOULDER, R_SHOULDER, CHEST_LEFT, CHEST_RIGHT
 */
function getPatchCaps(uniformId) {
  const caps = {
    blues_a: { L_SHOULDER: 1, R_SHOULDER: 1, CHEST_LEFT: 1, CHEST_RIGHT: 1 },
    blues_b: { L_SHOULDER: 1, R_SHOULDER: 1, CHEST_LEFT: 1, CHEST_RIGHT: 1 },
    aviator: { L_SHOULDER: 1, R_SHOULDER: 1, CHEST_LEFT: 1, CHEST_RIGHT: 1 },
    aviator_blazer: {
      L_SHOULDER: 1,
      R_SHOULDER: 1,
      CHEST_LEFT: 0,
      CHEST_RIGHT: 0,
    },
    corporate_field: {
      L_SHOULDER: 2,
      R_SHOULDER: 2,
      CHEST_LEFT: 1,
      CHEST_RIGHT: 1,
    },
    abu: { L_SHOULDER: 2, R_SHOULDER: 2, CHEST_LEFT: 1, CHEST_RIGHT: 1 },
    flight_suit: {
      L_SHOULDER: 2,
      R_SHOULDER: 2,
      CHEST_LEFT: 2,
      CHEST_RIGHT: 2,
    },
    semi_formal: {
      L_SHOULDER: 0,
      R_SHOULDER: 0,
      CHEST_LEFT: 0,
      CHEST_RIGHT: 0,
    },
    mess_dress: {
      L_SHOULDER: 0,
      R_SHOULDER: 0,
      CHEST_LEFT: 0,
      CHEST_RIGHT: 0,
    },
    polo: { L_SHOULDER: 0, R_SHOULDER: 0, CHEST_LEFT: 0, CHEST_RIGHT: 0 },
  };
  return (
    caps[uniformId] || {
      L_SHOULDER: 1,
      R_SHOULDER: 1,
      CHEST_LEFT: 1,
      CHEST_RIGHT: 1,
    }
  );
}

/**
 * Alternate translations between badges/patches/ribbons when moving between
 * field ↔ non-field uniforms. Consumers can implement the switch policy.
 */
const ALTERNATES = {
  badgeToPatch: { communications_technician_badge: "communications_patch" },
  patchToBadge: { communications_patch: "communications_technician_badge" },
  ribbonToPatch: { cadet_orientation_pilot_ribbon: "orientation_pilot_patch" },
  patchToRibbon: { orientation_pilot_patch: "cadet_orientation_pilot_ribbon" },
};

/**
 * Determine if the uniform id is allowed for a given member type.
 * This mirrors the data used to render "locked" buttons in the UI.
 * @param {"cadet"|"senior"|"senior_nco"} memberType
 */
function isUniformAllowedFor(uniformId, memberType) {
  const allowed = {
    blues_a: ["cadet", "senior", "senior_nco"],
    blues_b: ["cadet", "senior", "senior_nco"],
    mess_dress: ["senior", "senior_nco"],
    semi_formal: ["senior", "senior_nco"],
    aviator: ["senior", "senior_nco"],
    aviator_blazer: ["senior", "senior_nco"],
    corporate_field: ["senior", "senior_nco"],
    abu: ["cadet", "senior", "senior_nco"],
    flight_suit: ["cadet", "senior", "senior_nco"],
    polo: ["senior", "senior_nco"],
  }[uniformId];

  if (!allowed) return false;
  return allowed.includes(memberType);
}

/**
 * Find the first allowed uniform id for a member type, given a preferred order.
 * Useful when switching member types (e.g., senior -> cadet) forces a fallback.
 */
function findFirstAllowedUniform(memberType, preferredOrder = null) {
  const order =
    preferredOrder ||
    [
      "blues_a",
      "blues_b",
      "aviator",
      "aviator_blazer",
      "corporate_field",
      "abu",
      "flight_suit",
      "mess_dress",
      "semi_formal",
      "polo",
    ];
  for (const u of order) {
    if (isUniformAllowedFor(u, memberType)) return u;
  }
  return "blues_a"; // safe default
}

/**
 * Quick feature helper, merges UNIFORMS + UI_AUTHZ flags into one object.
 */
function getUniformFeatures(uniformId) {
  const u = UNIFORMS[uniformId] || {};
  const ui =
    UI_AUTHZ[uniformId] || {
      showRibbons: true,
      showBadges: true,
      showPatches: true,
    };
  return {
    id: uniformId,
    male: u.male || "",
    female: u.female || "",
    ribbons: !!u.ribbons,
    mini: !!u.mini,
    ...ui,
  };
}

// Expose selected helpers / config to window if needed elsewhere
window.uiAuthz = UI_AUTHZ;
window.alternates = ALTERNATES;
window.isFieldUniform = isFieldUniform;
window.getPatchCaps = getPatchCaps;
window.isUniformAllowedFor = isUniformAllowedFor;
window.findFirstAllowedUniform = findFirstAllowedUniform;
window.getUniformFeatures = getUniformFeatures;
