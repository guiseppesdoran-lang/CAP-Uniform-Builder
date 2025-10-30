// js/layout.js
// Layout & shell utilities for the CAP Uniform Builder
// - Sidebar (hamburger) open/close
// - Resizable control panel (desktop only)
// - Year autofill
// - Uniform button locking/highlighting
// - Section availability helpers

/**
 * Initialize hamburger -> sidebar toggle.
 * Adds/removes `sidebar-open` / `sidebar-collapsed` on the layout shell.
 */
export function initHamburgerToggle({ layoutShellEl, hamburgerBtnEl, defaultOpen = true }) {
  if (!layoutShellEl || !hamburgerBtnEl) return;

  layoutShellEl.classList.toggle("sidebar-open", !!defaultOpen);
  layoutShellEl.classList.toggle("sidebar-collapsed", !defaultOpen);

  hamburgerBtnEl.addEventListener("click", () => {
    const open = layoutShellEl.classList.contains("sidebar-open");
    layoutShellEl.classList.toggle("sidebar-open", !open);
    layoutShellEl.classList.toggle("sidebar-collapsed", open);
  });

  return {
    setOpen(nextOpen) {
      layoutShellEl.classList.toggle("sidebar-open", !!nextOpen);
      layoutShellEl.classList.toggle("sidebar-collapsed", !nextOpen);
    },
    isOpen() {
      return layoutShellEl.classList.contains("sidebar-open");
    },
  };
}

/**
 * Desktop-only panel resizer for the left controls column.
 * On mobile (matchMedia query true), the resizer is disabled.
 */
export function initPanelResizer({
  panelResizerEl,
  controlsPanelEl,
  minWidth = 260,
  maxWidth = 480,
  disableWhenMedia = "(max-width: 768px)",
}) {
  if (!panelResizerEl || !controlsPanelEl) return;

  let isDragging = false;
  let startX = 0;
  let startWidth = 0;

  const mql = window.matchMedia(disableWhenMedia);

  const onMouseDown = (e) => {
    if (mql.matches) return; // disabled on small screens
    isDragging = true;
    startX = e.clientX;
    startWidth = controlsPanelEl.getBoundingClientRect().width;
    document.body.style.userSelect = "none";
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    let newW = startWidth + (e.clientX - startX);
    if (newW < minWidth) newW = minWidth;
    if (newW > maxWidth) newW = maxWidth;
    controlsPanelEl.style.width = `${newW}px`;
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = "";
  };

  panelResizerEl.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  // In case viewport switches to mobile mid-drag
  mql.addEventListener?.("change", () => {
    if (mql.matches) {
      // collapse to full width on mobile; the sidebar component will manage visibility
      controlsPanelEl.style.removeProperty("width");
    }
  });

  return {
    destroy() {
      panelResizerEl.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    },
  };
}

/**
 * Fill year spans in footer/sidebar.
 */
export function fillYearSpans({ sidebarYearEl, footerYearEl }) {
  const y = new Date().getFullYear();
  if (sidebarYearEl) sidebarYearEl.textContent = y;
  if (footerYearEl) footerYearEl.textContent = y;
}

/**
 * From the uniform button list, return the first allowed uniform for a member type.
 * Buttons must have data-uniform-id and data-allowed-for="cadet,senior,..."
 */
export function firstAllowedUniform(uniformListEl, memberType) {
  if (!uniformListEl) return null;
  const opts = [...uniformListEl.querySelectorAll(".uniformOption")];
  for (const opt of opts) {
    const allowed = (opt.dataset.allowedFor || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.includes(memberType)) return opt.dataset.uniformId || null;
  }
  return null;
}

/**
 * Lock/unlock buttons based on memberType and highlight the active one.
 * Also writes a hover reason for locked items.
 */
export function updateUniformButtons({ uniformListEl, memberType, activeUniformId }) {
  if (!uniformListEl) return;

  const opts = uniformListEl.querySelectorAll(".uniformOption");

  opts.forEach((opt) => {
    const allowed = (opt.dataset.allowedFor || "")
      .split(",")
      .map((s) => s.trim());
    const isAllowed = allowed.includes(memberType);

    if (isAllowed) {
      opt.classList.remove("locked");
      opt.removeAttribute("data-locked-reason");
    } else {
      opt.classList.add("locked");
      const warn = memberType === "cadet"
        ? "This Uniform Is Not Authorized For Cadets"
        : "This Uniform Is Not Authorized For This Member Type";
      opt.setAttribute("data-locked-reason", warn);
    }

    // Visual highlight
    if ((opt.dataset.uniformId || "") === (activeUniformId || "")) {
      opt.style.outline = "2px solid var(--brand)";
      opt.style.boxShadow = "0 0 0 3px rgba(0,40,85,.15)";
      opt.style.background = "rgba(0,40,85,.05)";
    } else {
      opt.style.outline = "";
      opt.style.boxShadow = "";
      opt.style.background = "";
    }
  });
}

/**
 * Utility to wire clicks on the uniform list to a callback.
 * Skips locked buttons automatically.
 */
export function bindUniformListClicks(uniformListEl, onChoose) {
  if (!uniformListEl) return;
  uniformListEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".uniformOption");
    if (!btn) return;
    if (btn.classList.contains("locked")) return;
    const id = btn.dataset.uniformId;
    if (id) onChoose(id);
  });
}

/**
 * Show/hide availability-sensitive UI sections.
 * Example usage:
 *   applyAvailability({
 *     auth: { showRibbons:true, showBadges:false, showPatches:true },
 *     elements: { patchesGroupEl: document.getElementById('groupPatches') }
 *   })
 */
export function applyAvailability({ auth, elements }) {
  const { patchesGroupEl } = elements || {};
  if (patchesGroupEl) {
    patchesGroupEl.classList.toggle("hidden", !auth?.showPatches);
  }
  // Ribbons/badges panels may be managed elsewhere; keep this focused.
}

/**
 * Simple debounce helper for input-heavy UIs.
 */
export function debounce(fn, wait = 150) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Optional helper to reflect the current asset base input and notify on change.
 */
export function bindAssetBaseInput({ inputEl, onChange }) {
  if (!inputEl) return;
  const handler = () => {
    const val = (inputEl.value || "images").trim() || "images";
    onChange?.(val);
  };
  inputEl.addEventListener("change", handler);
  return {
    set(value) {
      inputEl.value = value;
    },
  };
}

/**
 * Convenience to set sidebar state programmatically.
 */
export function setSidebarOpen(layoutShellEl, open) {
  if (!layoutShellEl) return;
  layoutShellEl.classList.toggle("sidebar-open", !!open);
  layoutShellEl.classList.toggle("sidebar-collapsed", !open);
}

/**
 * Attach a focus style to buttons/controls (accessibility nicety).
 * No-op if not desired.
 */
export function enableFocusRingWithin(root = document) {
  let hadKeyboardEvent = false;

  function handleKeyDown(e) {
    if (e.metaKey || e.altKey || e.ctrlKey) return;
    hadKeyboardEvent = true;
  }
  function handlePointerDown() {
    hadKeyboardEvent = false;
  }
  function handleFocus(e) {
    if (hadKeyboardEvent) e.target.classList.add("focus-ring");
  }
  function handleBlur(e) {
    e.target.classList.remove("focus-ring");
  }

  root.addEventListener("keydown", handleKeyDown, true);
  root.addEventListener("mousedown", handlePointerDown, true);
  root.addEventListener("pointerdown", handlePointerDown, true);
  root.addEventListener("touchstart", handlePointerDown, true);
  root.addEventListener("focus", handleFocus, true);
  root.addEventListener("blur", handleBlur, true);

  return () => {
    root.removeEventListener("keydown", handleKeyDown, true);
    root.removeEventListener("mousedown", handlePointerDown, true);
    root.removeEventListener("pointerdown", handlePointerDown, true);
    root.removeEventListener("touchstart", handlePointerDown, true);
    root.removeEventListener("focus", handleFocus, true);
    root.removeEventListener("blur", handleBlur, true);
  };
}

