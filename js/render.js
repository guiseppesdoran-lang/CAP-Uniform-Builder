// js/render.js
// Centralized, modular rendering for the CAP Uniform Builder preview.

export function makeRenderer({
  canvasEl,
  uniforms,
  uiAuthz,
  ribbonsMeta,
  miniMedalMap,
  deviceMeta,
  patchMeta,
  badgeLocations,
  customBadgeSizes,
  allowedCadetBadgesSet,
  isFieldUniform,
  alternates,
  registerCalibratable,
}) {
  // -------------------------
  // Constants & helpers
  // -------------------------
  const RIBBON_WIDTH = 23;
  const RIBBON_HEIGHT = 7.2;
  const BOTTOM_ROW_Y = 206; // anchor for bottom ribbon row (tweak to your art)
  const RACK_CENTER_X = 293.5; // horizontal center (tweak to your art)

  // Fallback rack base (is made calibratable via ensureRackCalibrationElement)
  let rackBaseX = 259;
  let rackBaseY = 206;

  // ✨ Sync the external positioning engine (if present) to our exact dimensions
  if (window.UniformLayout) {
    UniformLayout.RIB.W = RIBBON_WIDTH;
    UniformLayout.RIB.H = RIBBON_HEIGHT;
    UniformLayout.RIB.GAP_X = 0;
    UniformLayout.RIB.GAP_Y = 0;
    UniformLayout.RACK.CENTER_X = RACK_CENTER_X;
    UniformLayout.RACK.BOTTOM_Y = BOTTOM_ROW_Y;
    // Optional rule after 9 ribbons:
    // UniformLayout.RACK.OFFSET_AFTER_9 = true;
  } else {
    console.warn("[UniformLayout] not loaded before render.js — using fallback guards");
  }

  const $$ = (sel) => canvasEl.querySelector(sel);
  const $$$ = (sel) => Array.from(canvasEl.querySelectorAll(sel));

  const ribbonsById = {};
  ribbonsMeta.forEach((r) => (ribbonsById[r.id] = r));

  function ASSET(state, p) {
    const base = (state.assetBase || "images").replace(/\/$/, "");
    return `${base}/${p}`;
  }

  function clearLayers(className) {
    const sel = className ? `.layer.${className}` : ".layer";
    $$$(`${sel}`).forEach((n) => n.remove());
  }

  // Default ON unless explicitly false
  function isUniformRibbonsAllowed(state) {
    const v = uniforms[state.uniform]?.ribbons;
    return v === undefined ? true : !!v;
  }
  function uniformPrefersMini(state) {
    return uniforms[state.uniform]?.mini === true;
  }

  // -------------------------
  // Jacket/base
  // -------------------------
  function applyJacket(state) {
    clearLayers("jacket");
    const base = uniforms[state.uniform]?.[state.gender];
    if (!base) {
      console.warn("[applyJacket] No base image for", { uniform: state.uniform, gender: state.gender, config: uniforms[state.uniform] });
      return;
    }
    const img = new Image();
    img.className = "layer jacket";
    img.src = ASSET(state, base);
    Object.assign(img.style, {
      position: "absolute",
      top: "0px",
      left: "0px",
      width: "100%",
      height: "100%",
      display: "block",
    });
    img.dataset.tooltipTitle = state.uniform.replace(/_/g, " ").toUpperCase();
    img.dataset.tooltipReg = "Base uniform image";
    img.dataset.tooltipWhy = "Selected uniform template for preview / alignment.";
    img.id = "jacketBaseImage";
    canvasEl.appendChild(img);
  }

  // -------------------------
  // Ribbon ordering helpers
  // -------------------------
  function sortRibbonsByPrecedence(state) {
    const arr = (state.ribbons || []).map((r) => {
      const m = ribbonsById[r.id];
      return { ...r, precedence: m ? m.precedence : 9999 };
    });
    arr.sort((a, b) => a.precedence - b.precedence);
    return arr;
  }

  function getTopRibbonY() {
    const layers = $$$(".layer.ribbonTile,.layer.ribbonMini");
    if (!layers.length) {
      // fallback to "where ribbons would be"
      return rackBaseY + 150;
    }
    return Math.min(...layers.map((l) => parseFloat(l.style.top) || 0));
  }

  // -------------------------
  // Devices on ribbon
  // -------------------------
  function drawDevicesOnRibbon(state, rid, leftPx, topPx, w, h) {
    const r = (state.ribbons || []).find((x) => x.id === rid);
    if (!r || !r.devices) return;
    const flat = [];
    for (const [devId, count] of Object.entries(r.devices)) {
      const meta = deviceMeta[devId];
      if (!meta) continue;
      for (let i = 0; i < count; i++) flat.push({ id: devId, ...meta });
    }
    if (!flat.length) return;
    flat.sort(
      (a, b) => b.weight - a.weight || (a.label || a.id).localeCompare(b.label || b.id)
    );

    const GAP = 3;
    const totalW = flat.reduce((s, d, i) => s + d.w + (i > 0 ? GAP : 0), 0);
    let x = Math.round(leftPx + (w - totalW) / 2);
    const y = Math.round(topPx + (h - 10) / 2) - 1;

    flat.forEach((d) => {
      const im = new Image();
      im.className = "layer ribbonDevice";
      im.dataset.parentRid = rid;
      im.src = ASSET(state, d.src.replace(/^images\//, ""));
      im.alt = d.label || d.id;
      Object.assign(im.style, {
        position: "absolute",
        display: "block",
        left: `${x}px`,
        top: `${y}px`,
        width: `${d.w}px`,
        height: `${d.h}px`,
      });
      im.dataset.tooltipTitle = d.label || d.id;
      im.dataset.tooltipReg = "Ribbon device";
      im.dataset.tooltipWhy = "Represents additional awards/credit per CAPR 39-3.";
      canvasEl.appendChild(im);
      x += d.w + GAP;
    });
  }

  // -------------------------
  // Rack calibration anchor
  // -------------------------
  function ensureRackCalibrationElement() {
    let el = document.getElementById("ribbonRack");
    if (!el) {
      el = document.createElement("div");
      el.id = "ribbonRack";
      Object.assign(el.style, {
        position: "absolute",
        width: "1px",
        height: "1px",
        pointerEvents: "none",
      });
      canvasEl.appendChild(el);
    }
    el.style.left = rackBaseX + "px";
    el.style.top = rackBaseY + "px";
    registerCalibratable?.("ribbonRack", "Ribbon Rack", rackBaseX, rackBaseY, 0);
  }

  // -------------------------
  // Render ribbons / mini medals
  // -------------------------
  function renderRack(state) {
    // Clear previous
    $$$(".layer.ribbonTile,.layer.ribbonMini,.layer.ribbonDevice").forEach((n) =>
      n.remove()
    );
    const allowRibbons = isUniformRibbonsAllowed(state);
    const prefersMini = uniformPrefersMini(state);
    const manualMini = !!state.forceMini;
    // Mess/semi-formal: always mini; manual override wins
    const useMini = manualMini || prefersMini;

    const ordered = sortRibbonsByPrecedence(state);
    if (!ordered.length) {
      ensureRackCalibrationElement();
      return;
    }

    // === RIBBONS MODE ===
    if (!useMini && allowRibbons) {
      // 1) Highest → lowest precedence
      const items = ordered.map(r => ({ id: r.id }));

      // 2) Compute precise geometry using the positioning engine (fallback safe)
      const positions = (window.UniformLayout && typeof UniformLayout.layoutRibbonRack === 'function')
        ? UniformLayout.layoutRibbonRack(items)
        : null;

      if (!positions) {
        ensureRackCalibrationElement();
        return;
      }

      // 3) Paint ribbons at returned coordinates
      positions.forEach((p) => {
        const meta = ribbonsById[p.id];
        if (!meta) { console.warn("[renderRack] ribbon id not in ribbonsMeta:", p.id); return; }

        const tile = new Image();
        tile.className = "layer ribbonTile";
        tile.src = ASSET(state, meta.img.replace(/^images\//, ""));
        Object.assign(tile.style, {
          position: "absolute",
          display: "block",
          left: `${p.x}px`,
          top: `${p.y}px`,
          width: `${p.w}px`,
          height: `${p.h}px`,
        });
        tile.dataset.rid = p.id;
        tile.dataset.tooltipTitle = (meta.name || p.id).toUpperCase();
        tile.dataset.tooltipReg = "CAPR 39-3 precedence applies";
        tile.dataset.tooltipWhy = "Highest awards sit top row, leftward.";
        canvasEl.appendChild(tile);

        // Devices on this ribbon
        drawDevicesOnRibbon(state, p.id, p.x, p.y, p.w, p.h);
      });

      // 4) Save layout for badge anchoring
      state._lastRibbonLayout = positions;

      ensureRackCalibrationElement();
      return;
    }

    // === MINI MEDALS MODE ===
    const MINI_W = 20;
    const MINI_H = 28;
    const MEDAL_PER_ROW = 5;
    const PAD = 6;

    const medals = [];
    for (const r of ordered) {
      const path = miniMedalMap[r.id];
      if (path) medals.push({ id: r.id, path });
    }
    if (!medals.length) {
      ensureRackCalibrationElement();
      return;
    }

    const lowestFirstMedals = [...medals].reverse();
    const medalRowsBottomFirst = [];
    for (let i = 0; i < lowestFirstMedals.length; i += MEDAL_PER_ROW) {
      medalRowsBottomFirst.push(lowestFirstMedals.slice(i, i + MEDAL_PER_ROW));
    }
    const medalRowsTopFirst = [...medalRowsBottomFirst].reverse();
    const totalMedalRows = medalRowsTopFirst.length;

    const BOTTOM_ROW_Y_MEDALS = BOTTOM_ROW_Y + 20;

    function medalRowLeftPositions(count) {
      const totalWidth = count * MINI_W + (count - 1) * PAD;
      const rowLeftBase = RACK_CENTER_X - totalWidth / 2;
      const arr = [];
      for (let i = 0; i < count; i++) arr.push(rowLeftBase + i * (MINI_W + PAD));
      return arr;
    }

    medalRowsTopFirst.forEach((row, topIndex) => {
      const indexFromBottom = totalMedalRows - 1 - topIndex;
      const rowTopPx = BOTTOM_ROW_Y_MEDALS - indexFromBottom * (MINI_H + PAD);
      const rowSortedForDisplay = [...row].reverse();
      const leftPositions = medalRowLeftPositions(rowSortedForDisplay.length);

      rowSortedForDisplay.forEach((entry, i) => {
        const mimg = new Image();
        let relPath = entry.path.replace(/^images\//, "");
        mimg.src = ASSET(state, relPath);
        mimg.className = "layer ribbonMini";
        Object.assign(mimg.style, {
          position: "absolute",
          display: "block",
          left: `${leftPositions[i]}px`,
          top: `${rowTopPx}px`,
          width: `${MINI_W}px`,
          height: `${MINI_H}px`,
        });
        mimg.dataset.tooltipTitle = entry.id.replace(/_/g, " ").toUpperCase();
        mimg.dataset.tooltipReg = "Miniature medal arrangement";
        mimg.dataset.tooltipWhy = "Highest awards sit top row, centered.";
        canvasEl.appendChild(mimg);
      });
    });

    ensureRackCalibrationElement();
  }

  // -------------------------
  // Badges
  // -------------------------
  const badgeSlots = { OLPA: [], OLPU: [], OLP: [], ORP: [], ON: [], UN: [], LRP: [], LP: [], OVERSTACK: [] };
  function resetBadgeSlots() {
    Object.keys(badgeSlots).forEach((k) => (badgeSlots[k] = []));
  }
  function isCadetAuthorized(id) {
    return allowedCadetBadgesSet?.has(id);
  }

  function placeBadgeByCategory(state, id) {
    const size = customBadgeSizes[id] || { width: 60, height: 25 };
    const overRibbonSlots = new Set(["OLP", "OLPU", "OLPA", "ORP"]);
    let slot = badgeLocations[id] || "UN";
    if (id === "nra_marksman_badge") slot = "LRP";
    if (id === "model_rocketry_badge") slot = "LP";

    const baseRibbonY = getTopRibbonY();

    // --- Over-the-rack badges (use real ribbon anchor if available) ---
    if (overRibbonSlots.has(slot)) {
      const stackIdx = badgeSlots.OVERSTACK.length;
      const spacing = 5;

      let anchor = null;
      if (window.UniformLayout && Array.isArray(state._lastRibbonLayout)) {
        anchor = UniformLayout.getOverRackBadgeAnchor(state._lastRibbonLayout); // { x, y } (y = 25px above)
      }

      const centerX = anchor ? anchor.x : RACK_CENTER_X;
      const topEdge = anchor ? (anchor.y - size.height) : (baseRibbonY - 25 - size.height);

      const topY  = Math.round(topEdge - stackIdx * (size.height + spacing));
      const leftX = Math.round(centerX - size.width / 2);

      const el = new Image();
      // If your badges live elsewhere, adjust this path:
      el.src = ASSET(state, `badges/${id}.png`);
      el.className = "layer badge";
      Object.assign(el.style, {
        position: "absolute",
        display: "block",
        top: `${topY}px`,
        left: `${leftX}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      });
      el.dataset.tooltipTitle = id.replace(/_/g, " ").toUpperCase();
      el.dataset.tooltipReg = "Over-rack qualification badge";
      el.dataset.tooltipWhy = "Centered above top ribbon row.";
      const elId = `badge-${slot}-${stackIdx}`;
      el.id = elId;
      canvasEl.appendChild(el);

      badgeSlots.OVERSTACK.push(id);
      registerCalibratable?.(elId, `${slot} Badge ${stackIdx}`, leftX, topY, 0);
      return;
    }

    // --- Other badge slots (original logic retained) ---
    if (!badgeSlots[slot]) badgeSlots[slot] = [];

    // Map default pocket/nameplate-relative coords from rack origin
    const spacing = 5;
    const xMap = {
      ON: rackBaseX - 105,
      UN: rackBaseX - 105,
      LRP: rackBaseX + RIBBON_WIDTH * 3 + 60,
      LP: rackBaseX + RIBBON_WIDTH * 3 + 80,
    };
    const yMap = {
      ON: baseRibbonY + 140,
      UN: baseRibbonY + 180,
      LRP: baseRibbonY + 199,
      LP: baseRibbonY + 244,
    };

    let y = yMap[slot] ?? baseRibbonY + 180;
    let x = xMap[slot] ?? rackBaseX - 105;

    if (slot === "ON" || slot === "UN") {
      const stackIdx = badgeSlots[slot].length;
      for (let i = 0; i < stackIdx; i++) {
        const prev = badgeSlots[slot][i];
        const ps = customBadgeSizes[prev] || { height: 25 };
        y += (ps.height || 25) + spacing;
      }
    }

    if (id === "model_rocketry_badge" && (state.badges || []).includes("nra_marksman_badge")) {
      y += 50; // simple interaction rule
    }

    const el = new Image();
    el.src = ASSET(state, `badges/${id}.png`);
    el.className = "layer badge";
    Object.assign(el.style, {
      position: "absolute",
      display: "block",
      top: `${y}px`,
      left: `${x}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
    });
    el.dataset.tooltipTitle = id.replace(/_/g, " ").toUpperCase();
    el.dataset.tooltipReg = "CAPR 39-1 badge placement";
    el.dataset.tooltipWhy = "Auto-placed relative to pockets / nameplate.";
    const stackPos = badgeSlots[slot].length;
    const elId = `badge-${slot}-${stackPos}`;
    el.id = elId;
    canvasEl.appendChild(el);

    badgeSlots[slot].push(id);
    registerCalibratable?.(elId, `${slot} Badge ${stackPos}`, x, y, 0);
  }

  function renderAllBadges(state) {
    $$$(".layer.badge").forEach((n) => n.remove());
    resetBadgeSlots();
    // default ON unless explicitly false
    if (uiAuthz[state.uniform] && uiAuthz[state.uniform].showBadges === false) return;

    const maxTotal = 5;
    const applied = [];
    for (const id of state.badges || []) {
      if (state.member === "cadet" && !isCadetAuthorized(id)) continue;
      if (applied.length >= maxTotal) break;
      placeBadgeByCategory(state, id);
      applied.push(id);
    }
  }

  // -------------------------
  // Patches
  // -------------------------
  const patchSlots = { L_SHOULDER: [], R_SHOULDER: [], CHEST_LEFT: [], CHEST_RIGHT: [] };
  function resetPatchSlots() {
    Object.keys(patchSlots).forEach((k) => (patchSlots[k] = []));
  }
  function planPatches(state, ids) {
    resetPatchSlots();
    const capsPer = {
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
    }[state.uniform] || { L_SHOULDER: 1, R_SHOULDER: 1, CHEST_LEFT: 1, CHEST_RIGHT: 1 };

    for (const id of ids) {
      const meta = patchMeta[id];
      if (!meta) continue;
      const hint = meta.slotHint || "L_SHOULDER";
      const cap = capsPer[hint] ?? 0;
      if (cap === 0) continue;
      if (patchSlots[hint].length >= cap) continue;
      patchSlots[hint].push(id);
    }
  }

  function renderPatches(state) {
    $$$(".layer.patch").forEach((n) => n.remove());
    // default ON unless explicitly false
    if (uiAuthz[state.uniform] && uiAuthz[state.uniform].showPatches === false) return;

    planPatches(state, state.patches || []);

    const coords = {
      L_SHOULDER: { x: 95, y: 250, dy: 80 },
      R_SHOULDER: { x: 505, y: 250, dy: 80 },
      CHEST_LEFT: { x: 260, y: 420, dy: 70 },
      CHEST_RIGHT: { x: 580, y: 420, dy: 70 },
    };

    for (const slot of Object.keys(patchSlots)) {
      const ids = patchSlots[slot];
      let { x, y, dy } = coords[slot] || { x: 0, y: 0, dy: 70 };
      ids.forEach((id, idx) => {
        const meta = patchMeta[id];
        if (!meta) return;

        const el = new Image();
        el.src = ASSET(state, meta.img.replace(/^images\//, ""));
        el.className = "layer patch";
        Object.assign(el.style, {
          position: "absolute",
          display: "block",
          left: `${x - meta.w / 2}px`,
          top: `${y - meta.h / 2}px`,
          width: `${meta.w}px`,
          height: `${meta.h}px`,
        });
        el.dataset.tooltipTitle = id.replace(/_/g, " ").toUpperCase();
        el.dataset.tooltipReg = "Field/utility patch placement";
        el.dataset.tooltipWhy = "Displayed per OCP/ABU/corporate field rules.";
        const elId = `patch-${slot}-${idx}`;
        el.id = elId;
        canvasEl.appendChild(el);

        registerCalibratable?.(elId, `Patch ${slot} ${idx}`, x - meta.w / 2, y - meta.h / 2, 0);
        y += dy;
      });
    }
  }

  // -------------------------
  // Rank & nameplate
  // -------------------------
  const OFFICER_RANKS = new Set(["C/2d Lt", "C/1st Lt", "C/Capt", "C/Maj", "C/Lt Col", "C/Col"]);

  function renderRank(state, rankId) {
    $$$(".layer.rank").forEach((n) => n.remove());
    if (!rankId) return;

    const isOfficer = OFFICER_RANKS.has(rankId);
    if (isOfficer) {
      const boardSrc = ASSET(state, "ranks/C/shoulder_board.png");
      const boardCfg = { width: 50, height: 100 };
      const insigniaCfg = { width: 32, height: 32 };
      const placements = [
        { left: 350, top: 160, rot: 90, side: "right" },
        { left: 100, top: 160, rot: -90, side: "left" },
      ];

      placements.forEach(({ left, top, rot, side }) => {
        const board = new Image();
        board.src = boardSrc;
        board.className = "layer rank";
        Object.assign(board.style, {
          position: "absolute",
          display: "block",
          left: `${left}px`,
          top: `${top}px`,
          width: `${boardCfg.width}px`,
          height: `${boardCfg.height}px`,
          transform: `rotate(${rot}deg)`,
          transformOrigin: "center center",
        });
        board.dataset.tooltipTitle = rankId;
        board.dataset.tooltipReg = "Officer shoulder board";
        board.dataset.tooltipWhy = "Displayed for cadet/senior officer grades.";
        const boardId = `shoulder-${side}-board`;
        board.id = boardId;
        canvasEl.appendChild(board);
        registerCalibratable?.(boardId, `Shoulder Board ${side}`, left, top, rot);

        const ins = new Image();
        ins.src = ASSET(state, `ranks/${rankId}.png`);
        ins.className = "layer rank";
        Object.assign(ins.style, {
          position: "absolute",
          display: "block",
          left: `${left + (boardCfg.width / 2 - insigniaCfg.width / 2)}px`,
          top: `${top + (boardCfg.height / 2 - insigniaCfg.height / 2)}px`,
          width: `${insigniaCfg.width}px`,
          height: `${insigniaCfg.height}px`,
          transform: `rotate(${rot}deg)`,
          transformOrigin: "center center",
        });
        ins.dataset.tooltipTitle = rankId;
        ins.dataset.tooltipReg = "Rank insignia";
        ins.dataset.tooltipWhy = "Placed on shoulder boards for officer grades.";
        const insId = `shoulder-${side}-insignia`;
        ins.id = insId;
        canvasEl.appendChild(ins);
        registerCalibratable?.(insId, `Shoulder Insignia ${side}`, parseFloat(ins.style.left), parseFloat(ins.style.top), rot);
      });
      return;
    }

    // Enlisted overlay
    const size = { w: 60, h: 60 };
    const pos = { left: 420, top: 200 };
    const icon = new Image();
    icon.src = ASSET(state, `ranks/${rankId}.png`);
    icon.className = "layer rank";
    Object.assign(icon.style, {
      position: "absolute",
      display: "block",
      left: `${pos.left}px`,
      top: `${pos.top}px`,
      width: `${size.w}px`,
      height: `${size.h}px`,
    });
    icon.dataset.tooltipTitle = rankId;
    icon.dataset.tooltipReg = "Enlisted/NCO rank placement";
    icon.dataset.tooltipWhy = "Displayed directly on the coat / sleeve area.";
    const rankElId = "enlisted-rank";
    icon.id = rankElId;
    canvasEl.appendChild(icon);
    registerCalibratable?.(rankElId, "Enlisted Rank", pos.left, pos.top, 0);
  }

  function renderNameplate(state) {
    $$$(".layer.nameplate").forEach((n) => n.remove());
    const baseRibbonY = getTopRibbonY();
    const npTop = baseRibbonY + 150;
    const npLeft = rackBaseX - 120;

    const el = new Image();
    el.src = ASSET(state, "nameplate/nameplate.png");
    el.className = "layer nameplate";
    Object.assign(el.style, {
      position: "absolute",
      display: "block",
      top: `${npTop}px`,
      left: `${npLeft}px`,
      width: "100px",
      height: "20px",
    });
    el.dataset.tooltipTitle = "Nameplate";
    el.dataset.tooltipReg = "CAPR 39-1 nameplate location";
    el.dataset.tooltipWhy = "Centered on pocket / aligned per spec.";
    const npId = "nameplate-el";
    el.id = npId;
    canvasEl.appendChild(el);
    registerCalibratable?.(npId, "Nameplate", npLeft, npTop, 0);
  }

  // -------------------------
  // Field/non-field alternates
  // -------------------------
  function applyAlternates(state, fromU, toU) {
    const fromField = isFieldUniform?.(fromU);
    const toField = isFieldUniform?.(toU);
    if (fromField === undefined || toField === undefined) return;

    if (!fromField && toField) {
      // Swap badges/ribbons -> patches
      Object.entries(alternates.badgeToPatch || {}).forEach(([badge, patch]) => {
        if (state.badges?.includes(badge) && !state.patches?.includes(patch)) {
          state.patches.push(patch);
        }
      });
      Object.entries(alternates.ribbonToPatch || {}).forEach(([rib, patch]) => {
        if (state.ribbons?.find((r) => r.id === rib) && !state.patches?.includes(patch)) {
          state.patches.push(patch);
        }
      });
    } else if (fromField && !toField) {
      // Swap patches -> badges/ribbons
      Object.entries(alternates.patchToBadge || {}).forEach(([patch, badge]) => {
        if (state.patches?.includes(patch) && badge && !state.badges?.includes(badge)) {
          state.badges.push(badge);
        }
      });
      Object.entries(alternates.patchToRibbon || {}).forEach(([patch, ribbon]) => {
        if (state.patches?.includes(patch) && ribbon && !state.ribbons?.find((r) => r.id === ribbon)) {
          state.ribbons.push({ id: ribbon, devices: {} });
        }
      });
    }

    if (state.member === "cadet") {
      state.badges = (state.badges || []).filter((b) => isCadetAuthorized(b));
    }
  }

  // -------------------------
  // Uniform auth changes & full render pipeline
  // -------------------------
  function renderUniformUIAvailability(_state, _prevUniform) {
    // Hook placeholder (canvas only in this module)
  }

  function fullRender(state, prevUniform) {
    // Normalize possible UI keys (optional; keep if your UI uses these names)
    const UNIFORM_ALIASES = {
      class_b:"blues_b", class_a:"blues_a",
      mess:"mess_dress", messdress:"mess_dress",
      flightsuit:"flight_suit", ocp:"corporate_field",
      abu:"abu", polo:"polo"
    };
    state.uniform = UNIFORM_ALIASES[state.uniform] || state.uniform;

    console.log("[fullRender] start", {
      uniform: state.uniform, gender: state.gender, member: state.member,
      ribbonsCount: state.ribbons?.length || 0,
      badgesCount: state.badges?.length || 0,
      patchesCount: state.patches?.length || 0,
      assetBase: state.assetBase
    });

    applyJacket(state);
    renderUniformUIAvailability(state, prevUniform);
    renderPatches(state);
    renderRack(state);
    renderAllBadges(state);
    renderRank(state, state.rank);
    // Nameplate remains callable on demand
  }

  // -------------------------
  // Public surface
  // -------------------------
  return {
    fullRender,
    applyJacket,
    renderRack,
    renderAllBadges,
    renderPatches,
    renderRank: (state) => renderRank(state, state.rank),
    renderNameplate,
    getTopRibbonY,
    ensureRackCalibrationElement,
    clearLayers,
    setRackBase(x, y) {
      rackBaseX = Number.isFinite(x) ? x : rackBaseX;
      rackBaseY = Number.isFinite(y) ? y : rackBaseY;
      ensureRackCalibrationElement();
    },
    getRackBase() {
      return { x: rackBaseX, y: rackBaseY };
    },
    applyAlternates,
  };
}
