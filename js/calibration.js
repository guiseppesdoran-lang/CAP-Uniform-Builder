// js/calibration.js
// Lightweight calibration system (state + UI builders)
// Centralizes: registerCalibratable, apply-to-element, sidebar UI, floating “Rack” panel, and JSON export.

export function createCalibration({ onChange = () => {} } = {}) {
  // ---- Internal state -------------------------------------------------------
  /** @type {Record<string, {name:string,x:number,y:number,rotation:number}>} */
  const calibrationData = {};

  // ---- Core APIs ------------------------------------------------------------
  function applyCalibrationToElement(elementId) {
    const entry = calibrationData[elementId];
    const el = document.getElementById(elementId);
    if (!el || !entry) return;
    el.style.position = "absolute";
    el.style.left = entry.x + "px";
    el.style.top = entry.y + "px";
    el.style.transformOrigin = "center center";
    el.style.transform = `rotate(${entry.rotation}deg)`;
  }

  function registerCalibratable(elementId, displayName, initialX, initialY, initialRot = 0) {
    if (!calibrationData[elementId]) {
      calibrationData[elementId] = {
        name: displayName,
        x: initialX ?? 0,
        y: initialY ?? 0,
        rotation: initialRot ?? 0,
      };
    }
    applyCalibrationToElement(elementId);
    // If a sidebar UI is mounted, rebuild it and refresh export text.
    if (_sidebar) {
      rebuildCalibrationUI();
      exportCalibrationJSON();
    }
    onChange();
  }

  function exportCalibrationJSON() {
    const slim = {};
    Object.keys(calibrationData).forEach(id => {
      const { x, y, rotation } = calibrationData[id];
      slim[id] = { x, y, rotation };
    });
    const json = JSON.stringify(slim, null, 2);
    if (_sidebar?.exportTextareaEl) _sidebar.exportTextareaEl.value = json;
    return json;
  }

  // ---- Sidebar UI (full system) --------------------------------------------
  let _sidebar = null;
  /**
   * Mounts the full calibration panel (the one with per-element sliders).
   * @param {{containerEl:HTMLElement, exportTextareaEl?:HTMLTextAreaElement,
   *  xRange?:[number,number], yRange?:[number,number], rotRange?:[number,number]}} opts
   */
  function initSidebarUI(opts) {
    const {
      containerEl,
      exportTextareaEl,
      xRange = [-200, 400],
      yRange = [0, 600],
      rotRange = [-30, 30],
    } = opts || {};
    _sidebar = { containerEl, exportTextareaEl, xRange, yRange, rotRange };
    rebuildCalibrationUI();
    exportCalibrationJSON();
  }

  function rebuildCalibrationUI() {
    if (!_sidebar?.containerEl) return;
    const wrap = _sidebar.containerEl;
    wrap.innerHTML = "";

    const make = (tag, cls, html) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (html != null) el.innerHTML = html;
      return el;
    };

    Object.keys(calibrationData).forEach(elementId => {
      const item = calibrationData[elementId];

      const group = make("div", "calGroup");
      const header = make(
        "div",
        "calHeader",
        `<span>${item.name}</span><span style="font-size:11px;color:var(--muted);">id: ${elementId}</span>`
      );
      group.appendChild(header);

      // X Row
      group.appendChild(buildSliderRow({
        label: "X",
        min: _sidebar.xRange[0],
        max: _sidebar.xRange[1],
        step: 1,
        value: item.x,
        format: v => `${v}px`,
        onInput: v => {
          calibrationData[elementId].x = v;
          applyCalibrationToElement(elementId);
          exportCalibrationJSON();
          onChange();
        },
      }));

      // Y Row
      group.appendChild(buildSliderRow({
        label: "Y",
        min: _sidebar.yRange[0],
        max: _sidebar.yRange[1],
        step: 1,
        value: item.y,
        format: v => `${v}px`,
        onInput: v => {
          calibrationData[elementId].y = v;
          applyCalibrationToElement(elementId);
          exportCalibrationJSON();
          onChange();
        },
      }));

      // ROT Row
      group.appendChild(buildSliderRow({
        label: "ROT",
        min: _sidebar.rotRange[0],
        max: _sidebar.rotRange[1],
        step: 0.5,
        value: item.rotation,
        format: v => `${v}°`,
        onInput: v => {
          calibrationData[elementId].rotation = v;
          applyCalibrationToElement(elementId);
          exportCalibrationJSON();
          onChange();
        },
      }));

      wrap.appendChild(group);
    });

    function buildSliderRow({ label, min, max, step, value, format, onInput }) {
      const row = make("div", "calRow");
      const lab = make("label", null, label);
      const slider = make("input");
      slider.type = "range";
      slider.min = String(min);
      slider.max = String(max);
      slider.step = String(step);
      slider.value = String(value);
      const val = make("div", "calVal", format(value));

      slider.addEventListener("input", () => {
        const v = parseFloat(slider.value);
        val.textContent = format(v);
        onInput(v);
      });

      row.appendChild(lab);
      row.appendChild(slider);
      row.appendChild(val);
      return row;
    }
  }

  // ---- Floating “Ribbon Rack” mini panel -----------------------------------
  let _rackPanel = null;
  /**
   * Initializes the compact rack calibrator panel (toggle panel with X/Y + readouts).
   * @param {{
   *  tabEl:HTMLElement, panelEl:HTMLElement, arrowEl:HTMLElement,
   *  xRangeEl:HTMLInputElement, xNumEl:HTMLInputElement,
   *  yRangeEl:HTMLInputElement, yNumEl:HTMLInputElement,
   *  readXEl:HTMLElement, readYEl:HTMLElement, readSizeEl:HTMLElement,
   *  getRack:()=>{x:number,y:number}, setRack:(x:number,y:number)=>void,
   *  ribbonSizeProvider?:()=>{w:number,h:number}
   * }} ctx
   */
  function initFloatingRackUI(ctx) {
    _rackPanel = ctx;

    const {
      tabEl, panelEl, arrowEl,
      xRangeEl, xNumEl, yRangeEl, yNumEl,
      readXEl, readYEl, readSizeEl,
      getRack, setRack, ribbonSizeProvider = () => ({ w: 0, h: 0 }),
    } = ctx;

    // Seed values
    const { x, y } = getRack();
    xRangeEl.value = String(x);
    xNumEl.value = String(x);
    yRangeEl.value = String(y);
    yNumEl.value = String(y);
    readXEl.textContent = String(x);
    readYEl.textContent = String(y);
    const size = ribbonSizeProvider();
    readSizeEl.textContent = `${size.w}×${size.h}`;

    // Toggle
    let open = false;
    function toggle() {
      open = !open;
      panelEl.style.display = open ? "block" : "none";
      if (arrowEl) arrowEl.textContent = open ? "‹" : "›";
    }
    tabEl.addEventListener("click", toggle);

    // Apply + rerender helper
    const apply = () => {
      const { x: rx, y: ry } = getRack();
      readXEl.textContent = String(rx);
      readYEl.textContent = String(ry);
      onChange(); // caller should rerender ribbons/badges/nameplate/rank inside onChange
    };

    // Wire X
    xRangeEl.addEventListener("input", e => {
      const v = parseInt(e.target.value, 10);
      xNumEl.value = String(v);
      setRack(v, getRack().y);
      apply();
    });
    xNumEl.addEventListener("input", e => {
      const v = parseInt(e.target.value || "0", 10);
      xRangeEl.value = String(v);
      setRack(v, getRack().y);
      apply();
    });

    // Wire Y
    yRangeEl.addEventListener("input", e => {
      const v = parseInt(e.target.value, 10);
      yNumEl.value = String(v);
      setRack(getRack().x, v);
      apply();
    });
    yNumEl.addEventListener("input", e => {
      const v = parseInt(e.target.value || "0", 10);
      yRangeEl.value = String(v);
      setRack(getRack().x, v);
      apply();
    });

    // Public accessor for updating the shown ribbon size text
    ctx.updateReadSize = () => {
      const s = ribbonSizeProvider();
      readSizeEl.textContent = `${s.w}×${s.h}`;
    };
  }

  // ---- Utilities ------------------------------------------------------------
  /**
   * Ensures/updates a 1×1 anchor element; also registers with calibration.
   * Useful for a virtual “ribbonRack” anchor.
   */
  function ensureAnchor(elementId, displayName, x, y) {
    let el = document.getElementById(elementId);
    if (!el) {
      el = document.createElement("div");
      el.id = elementId;
      el.style.position = "absolute";
      el.style.width = "1px";
      el.style.height = "1px";
      el.style.pointerEvents = "none";
      // Caller must append to the right canvas/container
      // (we don't assume where you want it)
    }
    el.style.left = x + "px";
    el.style.top = y + "px";
    registerCalibratable(elementId, displayName, x, y, 0);
    return el;
  }

  // ---- Public API surface ---------------------------------------------------
  return {
    // state + actions
    registerCalibratable,
    applyCalibrationToElement,
    exportCalibrationJSON,

    // UIs
    initSidebarUI,
    rebuildCalibrationUI,
    initFloatingRackUI,

    // helpers
    ensureAnchor,

    // for advanced callers
    _getAll: () => ({ ...calibrationData }),
    _set: (id, patch) => {
      if (!calibrationData[id]) return;
      Object.assign(calibrationData[id], patch);
      applyCalibrationToElement(id);
      if (_sidebar) {
        rebuildCalibrationUI();
        exportCalibrationJSON();
      }
      onChange();
    },
  };
}

