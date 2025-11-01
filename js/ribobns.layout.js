/* =========================================================
   CAP Uniform Builder — Ribbon & Badge Positioning (drop-in)
   Pure positioning. No DOM structure changes.
   Exposes: window.UniformLayout
   ========================================================= */
(function () {
  const UL = {};

  /* ---------- Tunables (adjust to your art) ---------- */
  UL.RIB = {
    W: 90,        // ribbon width (px)
    H: 30,        // ribbon height (px)
    GAP_X: 0,     // no horizontal gap within a row
    GAP_Y: 0,     // rows touch vertically
    MAX_PER_ROW: 3
  };

  UL.RACK = {
    CENTER_X: 440,      // X center over left pocket (px)
    BOTTOM_Y: 560,      // locked Y for the *bottom* ribbon row (px)
    OFFSET_AFTER_9: true,                // special 2-wide mode after 9 ribbons
    OFFSET_RIGHT_PX: Math.round(UL.RIB.W / 2) // shift for 2-wide rows
  };

  /* ---------- Helpers ---------- */
  function chunkRows(list, maxPerRow) {
    const rows = [];
    for (let i = 0; i < list.length; i += maxPerRow) {
      rows.push(list.slice(i, i + maxPerRow));
    }
    return rows; // top→bottom chunks
  }

  function rowStartXCentered(k, centerX, ribW, gapX) {
    const totalW = k * ribW + (k - 1) * gapX;
    return Math.round(centerX - totalW / 2);
  }

  function computeStandardLayout(items, RIB, RACK) {
    const topToBottom = chunkRows(items, 3);     // top→bottom rows
    const layout = [];
    let y = RACK.BOTTOM_Y;

    // place bottom row first (so bottom Y is locked), then stack upwards
    for (let r = topToBottom.length - 1; r >= 0; r--) {
      const row = topToBottom[r];
      const k = row.length;
      const startX = rowStartXCentered(k, RACK.CENTER_X, RIB.W, RIB.GAP_X);

      for (let j = 0; j < k; j++) {
        const item = row[j];
        layout.push({
          id: item.id,
          x: startX + j * (RIB.W + RIB.GAP_X),
          y,
          row: r,
          col: j,
          w: RIB.W,
          h: RIB.H
        });
      }
      y -= (RIB.H + RIB.GAP_Y); // next row sits directly above (touching)
    }
    return layout; // array of {id,x,y,w,h,row,col}
  }

  function computeOffsetLayout(items, RIB, RACK) {
    // After 9 ribbons: force 2-wide rows; single rows centered above the two below
    if (items.length <= 9) return computeStandardLayout(items, RIB, RACK);

    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
      rows.push(items.slice(i, i + 2)); // top→bottom in precedence order
    }

    const layout = [];
    let y = RACK.BOTTOM_Y;

    for (let r = rows.length - 1; r >= 0; r--) {
      const row = rows[r];
      const k = row.length;
      let startX;

      if (k === 1) {
        startX = rowStartXCentered(1, RACK.CENTER_X, RIB.W, RIB.GAP_X);
      } else {
        startX = rowStartXCentered(2, RACK.CENTER_X, RIB.W, RIB.GAP_X) + RACK.OFFSET_RIGHT_PX;
      }

      for (let j = 0; j < k; j++) {
        const item = row[j];
        layout.push({
          id: item.id,
          x: startX + j * (RIB.W + RIB.GAP_X),
          y,
          row: r,
          col: j,
          w: RIB.W,
          h: RIB.H
        });
      }
      y -= (RIB.H + RIB.GAP_Y);
    }
    return layout;
  }

  UL.layoutRibbonRack = function (orderedRibbons /* highest→lowest */) {
    const RIB = UL.RIB, RACK = UL.RACK;
    if (RACK.OFFSET_AFTER_9 && orderedRibbons.length > 9) {
      return computeOffsetLayout(orderedRibbons, RIB, RACK);
    }
    return computeStandardLayout(orderedRibbons, RIB, RACK);
  };

  function getTopRowAnchor(layout, RACK) {
    if (!layout || !layout.length) {
      return { topY: null, topCenterX: RACK.CENTER_X };
    }
    // group by row; find the smallest Y (top-most)
    const byRow = new Map();
    for (const p of layout) {
      if (!byRow.has(p.row)) byRow.set(p.row, []);
      byRow.get(p.row).push(p);
    }
    let topRowIndex = null;
    let minY = Infinity;
    byRow.forEach((arr, row) => {
      const y = arr[0].y; // all have same y per row
      if (y < minY) { minY = y; topRowIndex = row; }
    });
    const topRow = byRow.get(topRowIndex);
    const left = Math.min(...topRow.map(p => p.x));
    const right = Math.max(...topRow.map(p => p.x + p.w));
    return { topY: minY, topCenterX: Math.round((left + right) / 2) };
  }

  /** Badges that go OVER the ribbons: 25px above top row, centered on top-center ribbon */
  UL.getOverRackBadgeAnchor = function (ribbonLayout) {
    const { topY, topCenterX } = getTopRowAnchor(ribbonLayout, UL.RACK);
    if (topY == null) {
      // No ribbons yet — estimate one row above the bottom lock
      return { x: UL.RACK.CENTER_X, y: UL.RACK.BOTTOM_Y - UL.RIB.H - 25 };
    }
    return { x: topCenterX, y: topY - 25 };
  };

  // expose
  window.UniformLayout = UL;
})();
