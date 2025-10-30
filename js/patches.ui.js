// js/patches.ui.js
// UI wiring for Patches: populates selects, handles add/remove, and enforces simple caps.
// Depends on patches.data.js for catalog and helpers.

import {
  PATCH_LIST,
  PATCH_META,
  PATCH_SLOTS,
  getPatchCapsForUniform,
  slotHasCapacity,
} from "./patches.data.js";

/* ===========================
 * Small DOM helpers
 * =========================== */
function $(id) {
  return document.getElementById(id);
}
function optionize(selectEl, values) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  values.forEach((val) => {
    const o = document.createElement("option");
    o.value = val;
    // Friendlier label
    o.textContent = val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    selectEl.appendChild(o);
  });
}

/**
 * Refresh the "Remove Patch" select from the current state.
 */
function populateRemoveSelect(state) {
  const sel = $("removePatchSelect");
  if (!sel) return;
  sel.innerHTML = "";
  state.patches.forEach((id) => {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    sel.appendChild(o);
  });
}

/**
 * Given a patch id and the current uniform, returns whether the slot has remaining capacity.
 */
function canAddPatchToUniform(state, patchId) {
  const meta = PATCH_META[patchId];
  if (!meta) return true; // if unknown, don't block here (renderer may ignore)
  const slot = meta.slotHint || PATCH_SLOTS.L_SHOULDER;

  // Count how many of this slot are *planned* in state
  // (Renderer will also enforce caps at render-time; this is a UX pre-check.)
  const caps = getPatchCapsForUniform(state.uniform);
  const limit = caps[slot] ?? 0;
  if (limit === 0) return false;

  // Approximate: count of already-added patches that share this slotHint
  const countInSlot = state.patches.reduce((acc, pid) => {
    const m = PATCH_META[pid];
    return acc + (m && (m.slotHint || PATCH_SLOTS.L_SHOULDER) === slot ? 1 : 0);
  }, 0);

  return countInSlot < limit;
}

/* ===========================
 * Public API
 * =========================== */

/**
 * Initialize the patches UI.
 *
 * @param {Object} deps
 * @param {Object} deps.state            - Shared mutable state (expects .patches[], .uniform, etc.)
 * @param {Function} deps.renderPatches  - Callback to (re)render patches on the canvas
 * @param {Function} [deps.onStateChange]- Optional callback after state changes
 */
export function initPatchesUI({ state, renderPatches, onStateChange }) {
  // Build the main "add" select
  optionize($("patchSelect"), PATCH_LIST);
  // Build the "remove" select from current state
  populateRemoveSelect(state);

  // Wire: Add Patch
  $("addPatch")?.addEventListener("click", () => {
    const id = $("patchSelect")?.value;
    if (!id) return;

    // Avoid duplicates
    if (state.patches.includes(id)) {
      // Already present; just render to ensure position after other changes
      renderPatches?.();
      return;
    }

    // Capacity hint (non-fatal; renderer remains the source of truth)
    if (!canAddPatchToUniform(state, id)) {
      alert("That patch location is already at capacity for this uniform.");
      // We still bail out to avoid confusing the user
      return;
    }

    state.patches.push(id);
    populateRemoveSelect(state);
    renderPatches?.();
    onStateChange?.(state);
  });

  // Wire: Remove Patch
  $("removePatch")?.addEventListener("click", () => {
    const id = $("removePatchSelect")?.value;
    if (!id) return;
    state.patches = state.patches.filter((p) => p !== id);
    populateRemoveSelect(state);
    renderPatches?.();
    onStateChange?.(state);
  });
}

/**
 * Rebuilds the UI pieces that depend on state (call after uniform switch, etc.)
 * Safe to call often.
 */
export function refreshPatchesUI({ state }) {
  // The add list is static; only the remove list depends on state.
  populateRemoveSelect(state);
}

