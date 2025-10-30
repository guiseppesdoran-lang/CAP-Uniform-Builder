// js/ribbons.ui.js
// UI for building/selecting ribbons and devices, independent of rendering.
// Works with data from js/ribbons.data.js

import {
  RIBBONS,
  DEVICE_LIST,
  DEVICE_META,
  sortRibbonsByPrecedence,
  resolveRibbonImg,
} from "./ribbons.data.js";

/**
 * Light in-memory selection model:
 * selected = {
 *   ribbonId: { id: string, devices: { [deviceId]: number } }
 * }
 */
const selected = new Map();

/**
 * Default device list per ribbon. Override by passing deviceOptionsFor in init.
 */
const defaultDeviceOptions = ["", ...DEVICE_LIST];

/**
 * Utility to title-case ids for fallback text
 */
function nicifyId(id) {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Ensure a ribbon entry exists in selection map
 */
function ensureRibbon(id) {
  if (!selected.has(id)) {
    selected.set(id, { id, devices: {} });
  }
  return selected.get(id);
}

/**
 * Set a single-device choice (common UX). Clears other device counts unless
 * you pass multi = true.
 */
function setRibbonDevice(ribbonId, deviceId = "", qty = 1, { multi = false } = {}) {
  const rec = ensureRibbon(ribbonId);
  if (!multi) rec.devices = {};
  if (!deviceId) {
    rec.devices = {};
    return;
  }
  rec.devices[deviceId] = Math.max(1, Number(qty || 1));
}

/**
 * Read the selected device for a ribbon (single-select UX).
 * If multiple, returns the first in insertion order.
 */
function getRibbonDevice(ribbonId) {
  const rec = selected.get(ribbonId);
  if (!rec) return "";
  const keys = Object.keys(rec.devices || {});
  return keys.length ? keys[0] : "";
}

/**
 * Remove a ribbon from the current selection
 */
function removeRibbon(id) {
  selected.delete(id);
}

/**
 * Public API: replace entire selection
 */
export function setSelectedRibbons(ribbonsArray) {
  selected.clear();
  (ribbonsArray || []).forEach(({ id, devices }) => {
    selected.set(id, { id, devices: { ...(devices || {}) } });
  });
}

/**
 * Public API: snapshot the current selection as an array
 */
export function getSelectedRibbons() {
  return Array.from(selected.values()).map((r) => ({
    id: r.id,
    devices: { ...(r.devices || {}) },
  }));
}

/**
 * Build a single card for the ribbon grid
 */
function buildRibbonCard({
  ribbon,
  assetBase,
  deviceOptionsFor,
  isCadet,
  hideSeniorMemberOnly,
  onChange,
}) {
  const card = document.createElement("div");
  card.className = "ribbonCard";

  // Optional: hide ribbons for cadets if caller requests it
  if (hideSeniorMemberOnly && ribbon.smOnly && isCadet) {
    card.style.display = "none";
  }

  card.dataset.ribbonId = ribbon.id;
  card.dataset.ribbonName = ribbon.name || nicifyId(ribbon.id);

  const header = document.createElement("div");
  header.className = "ribbonHeader";

  const left = document.createElement("div");
  left.className = "ribbonLeft";

  // checkbox
  const boxWrap = document.createElement("div");
  boxWrap.className = "ribbonCheck";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = selected.has(ribbon.id);
  boxWrap.appendChild(check);

  // thumbnail
  const imgDiv = document.createElement("div");
  imgDiv.className = "ribbonImg";
  const resolved = resolveRibbonImg(ribbon.id, assetBase) || ribbon.img;
  imgDiv.style.backgroundImage = `url(${resolved})`;

  left.appendChild(boxWrap);
  left.appendChild(imgDiv);

  const nameDiv = document.createElement("div");
  nameDiv.className = "ribbonName";
  nameDiv.textContent = ribbon.name || nicifyId(ribbon.id);

  header.appendChild(left);
  header.appendChild(nameDiv);

  // body with device select
  const body = document.createElement("div");
  body.className = "ribbonBody";

  const deviceField = document.createElement("div");
  deviceField.className = "deviceField";

  const dLabel = document.createElement("label");
  dLabel.textContent = "Device";

  const dSel = document.createElement("select");
  const options = deviceOptionsFor
    ? deviceOptionsFor(ribbon.id, ribbon) || defaultDeviceOptions
    : defaultDeviceOptions;

  // Build options; "" means "None"
  options.forEach((devId) => {
    const opt = document.createElement("option");
    if (devId === "") {
      opt.value = "";
      opt.textContent = "None";
    } else {
      const meta = DEVICE_META[devId];
      opt.value = devId;
      opt.textContent = meta ? meta.label || nicifyId(devId) : nicifyId(devId);
    }
    dSel.appendChild(opt);
  });

  // Seed from current selection
  dSel.value = getRibbonDevice(ribbon.id);

  // Wire events
  check.addEventListener("change", () => {
    if (check.checked) {
      ensureRibbon(ribbon.id);
      // If user checked on and device dropdown has a value, set it
      const val = dSel.value || "";
      if (val) setRibbonDevice(ribbon.id, val, 1);
    } else {
      removeRibbon(ribbon.id);
    }
    onChange && onChange(getSelectedRibbons());
  });

  dSel.addEventListener("change", () => {
    // If device changed but ribbon was not selected yet, select it
    if (!selected.has(ribbon.id)) {
      check.checked = true;
      ensureRibbon(ribbon.id);
    }
    const val = dSel.value || "";
    setRibbonDevice(ribbon.id, val, 1);
    onChange && onChange(getSelectedRibbons());
  });

  deviceField.appendChild(dLabel);
  deviceField.appendChild(dSel);
  body.appendChild(deviceField);

  card.appendChild(header);
  card.appendChild(body);

  return card;
}

/**
 * Main initializer for the ribbons UI.
 *
 * @param {Object} cfg
 * @param {HTMLElement} cfg.gridEl - container where ribbon cards will be rendered
 * @param {HTMLButtonElement} [cfg.clearBtn] - button to clear all ribbons
 * @param {HTMLInputElement}  [cfg.toggleMiniEl] - checkbox that forces mini-medals (optional)
 * @param {HTMLInputElement}  [cfg.autoMiniEl] - checkbox for auto-converting based on uniform (optional)
 * @param {() => boolean} [cfg.isCadet] - returns true if member type is cadet
 * @param {() => string}  [cfg.assetBase] - returns current asset base path (defaults to "images")
 * @param {(ribbonId: string, ribbonMeta: object) => string[]} [cfg.deviceOptionsFor] - per-ribbon device options
 * @param {(payload: { type: string, value?: any }) => void} [cfg.emit] - optional lightweight event emitter
 * @param {(ribbons: Array) => void} [cfg.onChange] - callback when selection changes
 */
export function initRibbonsUI(cfg) {
  const {
    gridEl,
    clearBtn,
    toggleMiniEl,
    autoMiniEl,
    isCadet = () => false,
    assetBase = () => "images",
    deviceOptionsFor,
    emit,
    onChange,
  } = cfg;

  if (!gridEl) {
    throw new Error("initRibbonsUI: gridEl is required");
  }

  function rebuildGrid() {
    gridEl.innerHTML = "";
    const sorted = sortRibbonsByPrecedence([...RIBBONS]);
    sorted.forEach((rib) => {
      const card = buildRibbonCard({
        ribbon: rib,
        assetBase: assetBase(),
        deviceOptionsFor,
        isCadet: !!isCadet(),
        hideSeniorMemberOnly: true,
        onChange,
      });
      gridEl.appendChild(card);
    });
  }

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      selected.clear();
      rebuildGrid();
      onChange && onChange(getSelectedRibbons());
      emit && emit({ type: "ribbons:cleared" });
    });
  }

  // Mini/auto-mini checkboxes just propagate events; the renderer decides what to do
  if (toggleMiniEl) {
    toggleMiniEl.addEventListener("change", () => {
      emit && emit({ type: "ribbons:forceMini", value: !!toggleMiniEl.checked });
      onChange && onChange(getSelectedRibbons());
    });
  }
  if (autoMiniEl) {
    autoMiniEl.addEventListener("change", () => {
      emit && emit({ type: "ribbons:autoMini", value: !!autoMiniEl.checked });
      onChange && onChange(getSelectedRibbons());
    });
  }

  // Initial build
  rebuildGrid();

  // Return a small control surface for callers
  return {
    /** Force a refresh (use if asset base changes, member type flips, etc.) */
    refresh() {
      rebuildGrid();
    },
    /** Replace full selection and re-render checkboxes/dropdowns */
    setSelection(ribbonsArray) {
      setSelectedRibbons(ribbonsArray);
      rebuildGrid();
    },
    /** Snapshot current selection */
    getSelection() {
      return getSelectedRibbons();
    },
  };
}

