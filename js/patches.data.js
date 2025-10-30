// js/patches.data.js
// Patch catalog, metadata, sloting, and simple helpers (ES module)

/**
 * Canonical slot IDs used by the renderer:
 *  - L_SHOULDER, R_SHOULDER
 *  - CHEST_LEFT, CHEST_RIGHT
 */
export const PATCH_SLOTS = Object.freeze({
  L_SHOULDER: "L_SHOULDER",
  R_SHOULDER: "R_SHOULDER",
  CHEST_LEFT: "CHEST_LEFT",
  CHEST_RIGHT: "CHEST_RIGHT",
});

/**
 * List of selectable patch IDs (kept stable for saves).
 */
export const PATCH_LIST = [
  "us_flag_patch",
  "command_patch",
  "wing_patch",
  "unit_patch",
  "aerospace_education_patch",
  "communications_patch",
  "orientation_pilot_patch",
];

/**
 * Metadata per patch:
 *  - slotHint: suggested slot on first placement
 *  - w, h: default rendered size (px)
 *  - img: relative path under the asset base (e.g., `images/`)
 */
export const PATCH_META = {
  us_flag_patch: {
    slotHint: PATCH_SLOTS.R_SHOULDER,
    w: 60,
    h: 40,
    img: "patches/us_flag_patch.png",
  },
  command_patch: {
    slotHint: PATCH_SLOTS.L_SHOULDER,
    w: 70,
    h: 70,
    img: "patches/command_patch.png",
  },
  wing_patch: {
    slotHint: PATCH_SLOTS.L_SHOULDER,
    w: 60,
    h: 60,
    img: "patches/wing_patch.png",
  },
  unit_patch: {
    slotHint: PATCH_SLOTS.R_SHOULDER,
    w: 60,
    h: 60,
    img: "patches/unit_patch.png",
  },
  aerospace_education_patch: {
    slotHint: PATCH_SLOTS.CHEST_LEFT,
    w: 60,
    h: 60,
    img: "patches/aerospace_education_patch.png",
  },
  communications_patch: {
    slotHint: PATCH_SLOTS.CHEST_RIGHT,
    w: 60,
    h: 60,
    img: "patches/communications_patch.png",
  },
  orientation_pilot_patch: {
    slotHint: PATCH_SLOTS.CHEST_LEFT,
    w: 60,
    h: 60,
    img: "patches/orientation_pilot_patch.png",
  },
};

/**
 * Default capacity (how many patches allowed per slot) by uniform.
 * Keep in sync with the renderer’s logic.
 */
export const DEFAULT_PATCH_CAPS = Object.freeze({
  blues_a: { L_SHOULDER: 1, R_SHOULDER: 1, CHEST_LEFT: 1, CHEST_RIGHT: 1 },
  blues_b: { L_SHOULDER: 1, R_SHOULDER: 1, CHEST_LEFT: 1, CHEST_RIGHT: 1 },
  aviator: { L_SHOULDER: 1, R_SHOULDER: 1, CHEST_LEFT: 1, CHEST_RIGHT: 1 },
  aviator_blazer: { L_SHOULDER: 1, R_SHOULDER: 1, CHEST_LEFT: 0, CHEST_RIGHT: 0 },
  corporate_field: { L_SHOULDER: 2, R_SHOULDER: 2, CHEST_LEFT: 1, CHEST_RIGHT: 1 },
  abu: { L_SHOULDER: 2, R_SHOULDER: 2, CHEST_LEFT: 1, CHEST_RIGHT: 1 },
  flight_suit: { L_SHOULDER: 2, R_SHOULDER: 2, CHEST_LEFT: 2, CHEST_RIGHT: 2 },
  semi_formal: { L_SHOULDER: 0, R_SHOULDER: 0, CHEST_LEFT: 0, CHEST_RIGHT: 0 },
  mess_dress: { L_SHOULDER: 0, R_SHOULDER: 0, CHEST_LEFT: 0, CHEST_RIGHT: 0 },
  polo: { L_SHOULDER: 0, R_SHOULDER: 0, CHEST_LEFT: 0, CHEST_RIGHT: 0 },
});

/**
 * Alternates mapping when switching between field and non-field uniforms.
 * Used by higher-level logic to translate items automatically.
 */
export const PATCH_ALTERNATES = Object.freeze({
  // badge <-> patch
  badgeToPatch: { communications_technician_badge: "communications_patch" },
  patchToBadge: { communications_patch: "communications_technician_badge" },

  // ribbon <-> patch
  ribbonToPatch: { cadet_orientation_pilot_ribbon: "orientation_pilot_patch" },
  patchToRibbon: { orientation_pilot_patch: "cadet_orientation_pilot_ribbon" },
});

/* ===========================
 * Helper utilities
 * =========================== */

/**
 * Resolve the image URL for a patch id with a given asset base.
 * Falls back to the relative path if assetBase already included.
 */
export function resolvePatchImg(id, assetBase = "images") {
  const meta = PATCH_META[id];
  if (!meta) return null;
  const base = (assetBase || "images").replace(/\/$/, "");
  const rel = meta.img.replace(/^images\//, "");
  return `${base}/${rel}`;
}

/**
 * Get per-slot capacities for a uniform id, with a safe default.
 */
export function getPatchCapsForUniform(uniformId) {
  return (
    DEFAULT_PATCH_CAPS[uniformId] || {
      L_SHOULDER: 1,
      R_SHOULDER: 1,
      CHEST_LEFT: 1,
      CHEST_RIGHT: 1,
    }
  );
}

/**
 * Quick guard to see if a slot accepts more patches under a uniform’s caps.
 */
export function slotHasCapacity(uniformId, slot, currentCount) {
  const caps = getPatchCapsForUniform(uniformId);
  const limit = caps[slot] ?? 0;
  return currentCount < limit;
}

