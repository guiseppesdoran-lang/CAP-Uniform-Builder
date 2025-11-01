/* =========================================================
   CAP Uniform Builder — Ribbon & Badge Positioning (self-contained)
   Exposes: window.UniformLayout { RIB, RACK, layoutRibbonRack, getOverRackBadgeAnchor }
   ========================================================= */
(function () {
  // ---- Tunables (adjust to your art) ----
  const RIB  = { W: 90, H: 30, GAP_X: 0, GAP_Y: 0, MAX_PER_ROW: 3 };
  const RACK = {
    CENTER_X: 440,                 // horizontal center over left pocket
    BOTTOM_Y: 560,                 // locked Y for *bottom* ribbon row
    OFFSET_AFTER_9: true,          // 2-wide offset after 9 ribbons
    OFFSET_RIGHT_PX: Math.round(RIB.W / 2)
  };

  // ---- Helpers ----
  function chunkRows(list, maxPerRow) {
    const rows = [];
    for (let i = 0; i < list.length; i += maxPerRow) rows.push(list.slice(i, i + maxPerRow));
    return rows; // top→bottom
  }
  function rowStartXCentered(k) {
    const totalW = k * RIB.W + (k - 1) * RIB.GAP_X;
    return Math.round(RACK.CENTER_X - totalW / 2);
  }

  // Standard 3-wide; bottom row locked; rows touch vertically
  function computeStandardLayout(items) {
    const rows = chunkRows(items, 3);
    const layout = [];
    let y = RACK.BOTTOM_Y;
    for (let r = rows.length - 1; r >= 0; r--) {
      const row = rows[r];
      const startX = rowStartXCentered(row.length);
      row.forEach((item, j) => {
        layout.push({ id: item.id, x: startX + j * (RIB.W + RIB.GAP_X), y, w: RIB.W, h: RIB.H, row: r, col: j });
      });
      y -= (RIB.H + RIB.GAP_Y);
    }
    return layout;
  }

  // Offset layout after 9 ribbons: rows of 2 offset right; singles centered above
  function computeOffsetLayout(items) {
    if (items.length <= 9) return computeStandardLayout(items);
    const rows = [];
    for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
    const layout = [];
    let y = RACK.BOTTOM_Y;
    for (let r = rows.length - 1; r >= 0; r--) {
      const row = rows[r];
      const startX = (row.length === 1)
        ? rowStartXCentered(1)
        : rowStartXCentered(2) + RACK.OFFSET_RIGHT_PX;
      row.forEach((item, j) => {
        layout.push({ id: item.id, x: startX + j * (RIB.W + RIB.GAP_X), y, w: RIB.W, h: RIB.H, row: r, col: j });
      });
      y -= (RIB.H + RIB.GAP_Y);
    }
    return layout;
  }

  function layoutRibbonRack(ordered /* highest→lowest */) {
    return (RACK.OFFSET_AFTER_9 && ordered.length > 9)
      ? computeOffsetLayout(ordered)
      : computeStandardLayout(ordered);
  }

  function getTopRowAnchor(layout) {
    if (!layout.length) return { topY: null, topCenterX: RACK.CENTER_X };
    const minY = Math.min(...layout.map(p => p.y));
    const topRow = layout.filter(p => p.y === minY);
    const left  = Math.min(...topRow.map(p => p.x));
    const right = Math.max(...topRow.map(p => p.x + p.w));
    return { topY: minY, topCenterX: Math.round((left + right) / 2) };
  }

  // Over-rack badges sit 25px above the highest ribbon row, centered
  function getOverRackBadgeAnchor(layout) {
    const { topY, topCenterX } = getTopRowAnchor(layout);
    if (topY == null) return { x: RACK.CENTER_X, y: RACK.BOTTOM_Y - RIB.H - 25 }; // estimate if no ribbons yet
    return { x: topCenterX, y: topY - 25 };
  }

  // Expose globals
  window.UniformLayout = { RIB, RACK, layoutRibbonRack, getOverRackBadgeAnchor };
})();
