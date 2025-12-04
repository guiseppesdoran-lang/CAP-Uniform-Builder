// js/util.js
// Shared helpers: geometry, images, async utilities, DOM-safe operations, etc.

/* ===========================
 * Async + image loading
 * =========================== */

/**
 * Preload a single image, returning a Promise that resolves when ready.
 */
function preloadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Preload multiple images in parallel.
 * @param {string[]} urls
 * @returns {Promise<Map<string, HTMLImageElement>>}
 */
async function preloadImages(urls) {
  const map = new Map();
  const tasks = urls.map(async (url) => {
    try {
      const img = await preloadImage(url);
      map.set(url, img);
    } catch (_) {
      map.set(url, null);
    }
  });
  await Promise.all(tasks);
  return map;
}

/* ===========================
 * Geometry / positioning
 * =========================== */

/**
 * Center an element horizontally.
 */
export function centerX(containerWidth, elementWidth) {
  return (containerWidth - elementWidth) / 2;
}

/**
 * Center an element vertically.
 */
export function centerY(containerHeight, elementHeight) {
  return (containerHeight - elementHeight) / 2;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Generate rows of up to N items, used for ribbons layout.
 */
export function chunkArray(arr, chunkSize = 3) {
  const out = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    out.push(arr.slice(i, i + chunkSize));
  }
  return out;
}

/**
 * Given total ribbons, compute how many full rows of 3,
 * and if top row should be centered (for 1–2 ribbons).
 */
export function layoutRibbonRows(ribbons, perRow = 3) {
  const total = ribbons.length;
  const rows = [];
  for (let i = 0; i < total; i += perRow) {
    const slice = ribbons.slice(i, i + perRow);
    rows.push(slice);
  }
  return rows;
}

/* ===========================
 * DOM helpers
 * =========================== */

/**
 * Quick DOM query
 */
export function $(sel, root = document) {
  return root.querySelector(sel);
}

/**
 * Create element with props
 */
export function create(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  children.forEach((c) => {
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else if (c instanceof Node) el.appendChild(c);
  });
  return el;
}

/**
 * Clear all child nodes from element.
 */
export function clear(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

/* ===========================
 * File + Canvas helpers
 * =========================== */

/**
 * Convert a DOM node to an image (using html2canvas).
 * The html2canvas library must be included in the HTML.
 */
export async function domToImage(element, scale = 2) {
  if (!window.html2canvas) throw new Error("html2canvas not loaded");
  const canvas = await window.html2canvas(element, {
    scale,
    backgroundColor: null,
  });
  return canvas.toDataURL("image/png");
}

/**
 * Download a base64 data URL as a file.
 */
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/* ===========================
 * Misc utilities
 * =========================== */

/**
 * Sleep helper
 */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Simple hash for deterministic ribbon sorting, etc.
 */
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Sort ribbons by known precedence (if array of precedence strings provided),
 * otherwise alphabetically.
 */
export function sortByPrecedence(items, precedenceList) {
  if (!Array.isArray(precedenceList) || !precedenceList.length) {
    return [...items].sort();
  }
  const rank = Object.fromEntries(precedenceList.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const ra = rank[a] ?? 9999;
    const rb = rank[b] ?? 9999;
    if (ra === rb) return a.localeCompare(b);
    return ra - rb;
  });
}

/**
 * Merge two device maps: {devId: count}.
 */
export function mergeDeviceMaps(base, add) {
  const result = { ...(base || {}) };
  for (const [dev, count] of Object.entries(add || {})) {
    result[dev] = (result[dev] || 0) + count;
  }
  return result;
}

/**
 * Serialize ribbons (for debugging)
 */
export function ribbonsToText(ribbons) {
  return ribbons
    .map((r) => {
      const devs = Object.entries(r.devices || {})
        .map(([d, c]) => `${d}${c > 1 ? `x${c}` : ""}`)
        .join(",");
      return `${r.id}${devs ? `(${devs})` : ""}`;
    })
    .join(", ");
}

/**
 * Create and attach a resize observer to trigger callback on container resize.
 */
export function observeResize(el, cb) {
  if (!el || typeof ResizeObserver === "undefined") return;
  const obs = new ResizeObserver(() => cb());
  obs.observe(el);
  return obs;
}

/**
 * Create a basic event emitter (used for calibration tools, etc.)
 */
export function createEmitter() {
  const listeners = {};
  return {
    on(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    off(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((f) => f !== fn);
    },
    emit(event, payload) {
      (listeners[event] || []).forEach((fn) => fn(payload));
    },
  };
}

/**
 * Debug logger that can be toggled globally.
 */
let debugEnabled = false;
function setDebug(on) {
  debugEnabled = !!on;
}
function log(...args) {
  if (debugEnabled) console.log("[UB]", ...args);
}

// Expose helpers globally for non-module scripts
window.preloadImage = preloadImage;
window.preloadImages = preloadImages;
window.setDebug = setDebug;
window.log = log;

// If you have other helpers you want globally, add them too, e.g.:
// window.clamp = clamp;
// window.chunkArray = chunkArray;
