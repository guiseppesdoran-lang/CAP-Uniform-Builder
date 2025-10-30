// js/state.js
// Centralized app state with a tiny observable store, persistence, and helpers.
// Works in plain ES modules. No external deps.

/**
 * @typedef {Object} RibbonSelection
 * @property {string} id
 * @property {{[deviceId: string]: number}} [devices]
 */

/**
 * @typedef {Object} AppState
 * @property {"cadet"|"senior"|"senior_nco"} member
 * @property {"male"|"female"} gender
 * @property {string} uniform           // e.g., "blues_a"
 * @property {string} assetBase         // e.g., "images"
 * @property {RibbonSelection[]} ribbons
 * @property {string[]} badges
 * @property {string[]} patches
 * @property {string|null} rank
 * @property {boolean} forceMini
 * @property {boolean} deviceApplyMode
 * @property {boolean} deviceRemoveMode
 * @property {{[deviceId: string]: number}} selectedDevices
 * @property {boolean} ribbonDragMode
 */

const PERSIST_KEY = "cap-uniform-builder:v1";

/** @type {AppState} */
const DEFAULT_STATE = {
  member: "cadet",
  gender: "male",
  uniform: "blues_a",
  assetBase: "images",

  ribbons: [],      // [{ id, devices: {devId:qty} }]
  badges: [],
  patches: [],
  rank: null,

  forceMini: false,

  deviceApplyMode: false,
  deviceRemoveMode: false,
  selectedDevices: {},

  ribbonDragMode: false,
};

/** Lightweight deep clone for our simple JSON-y state */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Debounce helper */
function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Tiny observable store
 */
function createStore(initial) {
  /** @type {AppState} */
  let state = clone(initial || DEFAULT_STATE);

  /** @type {Set<Function>} */
  const subs = new Set();

  const notify = (event, payload) => {
    subs.forEach((fn) => {
      try {
        fn({ type: event, state: get(), payload });
      } catch (_) {}
    });
  };

  function get() {
    // Always return a clone to avoid external mutation
    return clone(state);
  }

  /**
   * Shallow patch set (top-level keys only).
   * Emits a single "state:change" event with the changed keys list.
   */
  function set(patch) {
    if (!patch || typeof patch !== "object") return get();
    const changed = [];
    Object.keys(patch).forEach((k) => {
      if (JSON.stringify(state[k]) !== JSON.stringify(patch[k])) {
        state[k] = clone(patch[k]);
        changed.push(k);
      }
    });
    if (changed.length) {
      persistDebounced();
      notify("state:change", { changed });
    }
    return get();
  }

  /**
   * Functional update for complex mutations
   */
  function update(mutator) {
    const draft = get();
    const next = mutator(draft) || draft;
    return replace(next);
  }

  /**
   * Replace entire state (after validation/sanitization)
   */
  function replace(next) {
    state = sanitize(next);
    persistDebounced();
    notify("state:replace", null);
    return get();
  }

  function subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }

  // ---------- Domain helpers (ribbons) ----------

  function setRibbons(arr) {
    return set({ ribbons: Array.isArray(arr) ? arr : [] });
  }

  function addRibbon(id, devices = {}) {
    return update((s) => {
      if (!s.ribbons.find((r) => r.id === id)) {
        s.ribbons.push({ id, devices: { ...(devices || {}) } });
      }
    });
  }

  function removeRibbon(id) {
    return update((s) => {
      s.ribbons = s.ribbons.filter((r) => r.id !== id);
    });
  }

  function setRibbonDevices(id, devices = {}) {
    return update((s) => {
      const rec = s.ribbons.find((r) => r.id === id);
      if (rec) rec.devices = { ...(devices || {}) };
    });
  }

  // ---------- Domain helpers (badges) ----------

  function setBadges(arr) {
    return set({ badges: Array.isArray(arr) ? arr : [] });
  }

  function addBadge(id) {
    return update((s) => {
      if (!s.badges.includes(id)) s.badges.push(id);
    });
  }

  function removeBadge(id) {
    return update((s) => {
      s.badges = s.badges.filter((b) => b !== id);
    });
  }

  // ---------- Domain helpers (patches) ----------

  function setPatches(arr) {
    return set({ patches: Array.isArray(arr) ? arr : [] });
  }

  function addPatch(id) {
    return update((s) => {
      if (!s.patches.includes(id)) s.patches.push(id);
    });
  }

  function removePatch(id) {
    return update((s) => {
      s.patches = s.patches.filter((p) => p !== id);
    });
  }

  // ---------- Domain helpers (rank/uniform/etc.) ----------

  function setRank(rank) {
    return set({ rank: rank || null });
  }

  function setMember(member) {
    if (!["cadet", "senior", "senior_nco"].includes(member)) return get();
    return set({ member });
  }

  function setGender(gender) {
    if (!["male", "female"].includes(gender)) return get();
    return set({ gender });
  }

  function setUniform(uniformId) {
    // We don't validate the uniform id here to keep the store decoupled.
    return set({ uniform: String(uniformId || "blues_a") });
  }

  function setAssetBase(path) {
    return set({ assetBase: String(path || "images") });
  }

  function setForceMini(on) {
    return set({ forceMini: !!on });
  }

  function setRibbonDragMode(on) {
    return set({ ribbonDragMode: !!on });
  }

  function setDeviceApplyMode(on, selectedDevices = null) {
    return set({
      deviceApplyMode: !!on,
      deviceRemoveMode: on ? false : state.deviceRemoveMode,
      ...(selectedDevices ? { selectedDevices: clone(selectedDevices) } : {}),
    });
  }

  function setDeviceRemoveMode(on) {
    return set({
      deviceRemoveMode: !!on,
      deviceApplyMode: on ? false : state.deviceApplyMode,
    });
  }

  // ---------- Selectors ----------

  function isCadet() {
    return state.member === "cadet";
  }

  function getAssetBase() {
    return state.assetBase || "images";
  }

  // ---------- Persistence ----------

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(PERSIST_KEY);
      if (!raw) return;
      const next = JSON.parse(raw);
      state = sanitize({ ...DEFAULT_STATE, ...next });
      notify("state:load", null);
    } catch (_) {
      // ignore corrupted storage
    }
  }

  const persistDebounced = debounce(() => {
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
    } catch (_) {
      // storage may be full or blocked
    }
  }, 150);

  function resetToDefaults() {
    replace(DEFAULT_STATE);
    notify("state:reset", null);
  }

  // Minimal sanitization to keep structure intact
  function sanitize(s) {
    const base = { ...DEFAULT_STATE, ...(s || {}) };
    base.member =
      base.member === "senior" || base.member === "senior_nco" ? base.member : "cadet";
    base.gender = base.gender === "female" ? "female" : "male";
    base.uniform = String(base.uniform || "blues_a");
    base.assetBase = String(base.assetBase || "images");

    base.ribbons = Array.isArray(base.ribbons) ? base.ribbons : [];
    base.ribbons = base.ribbons.map((r) => ({
      id: String(r.id),
      devices: r && r.devices && typeof r.devices === "object" ? { ...r.devices } : {},
    }));

    base.badges = Array.isArray(base.badges) ? [...new Set(base.badges.map(String))] : [];
    base.patches = Array.isArray(base.patches) ? [...new Set(base.patches.map(String))] : [];

    base.rank = base.rank ? String(base.rank) : null;

    base.forceMini = !!base.forceMini;

    base.deviceApplyMode = !!base.deviceApplyMode;
    base.deviceRemoveMode = !!base.deviceRemoveMode;
    base.selectedDevices =
      base.selectedDevices && typeof base.selectedDevices === "object"
        ? { ...base.selectedDevices }
        : {};

    base.ribbonDragMode = !!base.ribbonDragMode;

    return base;
  }

  // public surface
  return {
    // core
    get,
    set,
    update,
    replace,
    subscribe,

    // ribbons
    setRibbons,
    addRibbon,
    removeRibbon,
    setRibbonDevices,

    // badges
    setBadges,
    addBadge,
    removeBadge,

    // patches
    setPatches,
    addPatch,
    removePatch,

    // rank / member / uniform
    setRank,
    setMember,
    setGender,
    setUniform,
    setAssetBase,
    setForceMini,
    setRibbonDragMode,
    setDeviceApplyMode,
    setDeviceRemoveMode,

    // selectors
    isCadet,
    getAssetBase,

    // persistence
    loadPersisted,
    resetToDefaults,
  };
}

// Singleton store for the app
export const store = createStore();

/**
 * Optional: call once at startup to hydrate from localStorage.
 * Example usage in your bootstrap:
 *   import { store, enableStatePersistence } from "./state.js";
 *   enableStatePersistence();
 *   store.loadPersisted();
 */
export function enableStatePersistence() {
  // Nothing else needed; store persists on every mutation via debounce.
  // This function exists for semantic clarity / future hooks.
  return true;
}

// Convenience typed events for consumers (documentation)
/*
store.subscribe(({ type, state, payload }) => {
  switch (type) {
    case "state:change":
      // payload.changed -> array of top-level keys that changed
      break;
    case "state:replace":
      break;
    case "state:load":
      break;
    case "state:reset":
      break;
  }
});
*/

