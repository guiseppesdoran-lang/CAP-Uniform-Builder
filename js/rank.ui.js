// js/rank.ui.js
// Minimal, modular UI wiring for Rank & Nameplate controls.
// Works standalone, but can also be paired with a separate ranks.data.js later.
//
// Exposes:
//   initRankUI({ state, renderRank, renderNameplate, onStateChange })
//   refreshRankUI({ state })
//
// Assumptions:
// - HTML has: <select id="rankSelect"></select>, <button id="addRank">, <button id="addNameplate">
// - renderRank(rankId) draws the correct officer/enlisted treatment.
// - renderNameplate() draws the nameplate (optional).

/* ===========================
 * Data (Cadet ranks)
 * If you later add Senior/Officer ranks, you can extend this list or
 * swap it to an imported source without changing this file's API.
 * =========================== */
export const RANK_LIST = [
  "C/AB",
  "C/Amn",
  "C/A1C",
  "C/SrA",
  "C/SSgt",
  "C/TSgt",
  "C/MSgt",
  "C/SMSgt",
  "C/CMSgt",
  "C/2d Lt",
  "C/1st Lt",
  "C/Capt",
  "C/Maj",
  "C/Lt Col",
  "C/Col",
];

// Helpful set if callers want to branch on officer vs enlisted.
// (Not used directly here, but exported for convenience.)
export const OFFICER_RANKS = new Set([
  "C/2d Lt",
  "C/1st Lt",
  "C/Capt",
  "C/Maj",
  "C/Lt Col",
  "C/Col",
]);

/* ===========================
 * Tiny DOM helpers
 * =========================== */
function $(id) {
  return document.getElementById(id);
}
function optionize(selectEl, values, selectedValue) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  values.forEach((val) => {
    const o = document.createElement("option");
    o.value = val;
    o.textContent = val;
    if (selectedValue && selectedValue === val) o.selected = true;
    selectEl.appendChild(o);
  });
}

/* ===========================
 * Public API
 * =========================== */
export function initRankUI({ state, renderRank, renderNameplate, onStateChange }) {
  // Build rank select (preselect current state, if any)
  optionize($("rankSelect"), RANK_LIST, state?.rank || null);

  // Set Rank button
  $("addRank")?.addEventListener("click", () => {
    const rank = $("rankSelect")?.value;
    if (!rank) return;
    state.rank = rank;
    renderRank?.(rank);
    onStateChange?.(state);
  });

  // Nameplate button (optional)
  $("addNameplate")?.addEventListener("click", () => {
    renderNameplate?.();
    onStateChange?.(state);
  });
}

export function refreshRankUI({ state }) {
  // Keep the dropdown in sync with the current state.rank
  optionize($("rankSelect"), RANK_LIST, state?.rank || null);
}

