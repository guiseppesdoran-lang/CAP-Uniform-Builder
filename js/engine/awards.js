// Uniform engine, part 2: ribbon devices, the ribbon rack and miniature medals.
//
// Devices follow CAPR 39-3 paragraph 6b and the per-award paragraphs it cites:
//  - a bronze clasp per additional award; a silver clasp replaces five bronze and sits to the
//    wearer's right of the bronze ones; at most four devices on a ribbon, and when there are more a
//    second ribbon is worn to the wearer's left of the first (it counts as one award);
//  - a star or "V" that marks a level sits to the wearer's right of any clasps (9f(4), 21g);
//  - a propeller, the Lifesaving silver star and the longevity numeral stay centred, with the first
//    clasp halfway between the device and the wearer's left edge and the second opposite (9h, 21c, 21d).
// The rack follows CAPR 39-1 11.2.7: bottom row on the pocket or welt, rows of three (four only on the
// Class A coat), the top row centred over the row below, no space between rows.
// The view is the wearer seen from the front, so the wearer's right is the viewer's left.
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else { root.CAPUBEngine = root.CAPUBEngine || {}; root.CAPUBEngine.awards = api; }
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  const RIBBON_W = 1.375;          // CAPR 39-1 11.3
  const RIBBON_H = 0.375;
  const MAX_DEVICES = 4;           // CAPR 39-3 6b

  const DEVICE = {
    clasp_bronze: 'device-clasp-bronze',
    clasp_silver: 'device-clasp-silver',
    star_bronze: 'device-star-bronze',
    star_silver: 'device-star-silver',
    star_gold: 'device-star-gold',
    propeller_bronze: 'device-propeller-bronze',
    propeller_silver: 'device-propeller-silver',
    v_silver: 'device-v'
  };

  // Clasps for a number of ADDITIONAL awards: one bronze each, five bronze become one silver.
  function claspsFor(additional){
    const n = Math.max(0, additional | 0);
    const silver = Math.floor(n / 5), bronze = n % 5;
    return [...Array(silver).fill(DEVICE.clasp_silver), ...Array(bronze).fill(DEVICE.clasp_bronze)];
  }

  // Split a total award count into ribbons. Each ribbon counts one award for itself and one per
  // clasp; the first ribbon carries as many devices as it can (fixed devices take room first).
  function splitAwardCount(total, opts){
    const fixed = (opts && opts.fixed) || 0;              // non-clasp devices on the first ribbon
    const maxDevices = (opts && opts.maxDevices) || MAX_DEVICES;
    let remaining = Math.max(1, total | 0);
    const ribbons = [];
    let first = true;
    while(remaining > 0){
      const room = maxDevices - (first ? fixed : 0);
      // The most awards one ribbon can show with `room` clasps: silver clasps are worth five.
      let best = 1;
      for(let awards = 1; awards <= remaining; awards++){
        if(claspsFor(awards - 1).length <= room) best = awards;
      }
      ribbons.push(best);
      remaining -= best;
      first = false;
    }
    return ribbons;
  }

  // Lay out the devices on one ribbon. Returns centres in inches from the ribbon's top-left.
  // `devices` is in wearer's-right-first order (viewer's left first).
  function layoutDevices(devices, sizes, opts){
    const w = (opts && opts.ribbonW) || RIBBON_W;
    const h = (opts && opts.ribbonH) || RIBBON_H;
    const centered = opts && opts.centered;
    const cy = h / 2;
    if(!devices.length) return [];
    if(centered){
      // devices[0] is the centred device; the rest are clasps: first on the wearer's left (viewer's
      // right) halfway between the device and the edge, the second opposite.
      const c = devices[0];
      const half = sizes[c].w / 2;
      const out = [{ id: c, x: w / 2, y: cy }];
      const rightX = (w / 2 + half + w) / 2;
      const leftX = (w / 2 - half) / 2;
      if(devices[1]) out.push({ id: devices[1], x: rightX, y: cy });
      if(devices[2]) out.push({ id: devices[2], x: leftX, y: cy });
      return out;
    }
    // A run centred on the ribbon, devices touching (as on the measured McChord artwork) unless the
    // run is short enough to leave a small gap.
    const gap = devices.length <= 2 ? 0.04 : 0.01;
    const total = devices.reduce((s, d) => s + sizes[d].w, 0) + gap * (devices.length - 1);
    let x = (w - total) / 2;
    return devices.map(d => {
      const cx = x + sizes[d].w / 2;
      x += sizes[d].w + gap;
      return { id: d, x: cx, y: cy };
    });
  }

  // Precedence order for a free run (viewer's left first): level devices, then silver, then bronze.
  const RUN_ORDER = [DEVICE.v_silver, DEVICE.star_gold, DEVICE.star_silver, DEVICE.star_bronze, DEVICE.propeller_silver, DEVICE.propeller_bronze, DEVICE.clasp_silver, DEVICE.clasp_bronze];
  function sortRun(devices){
    return [...devices].sort((a, b) => {
      const ia = RUN_ORDER.indexOf(a), ib = RUN_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }

  // Rows for a rack, top row first. `perRow` 3 or 4. The partial row is the top row (Figure 11-1).
  function rackRows(items, perRow, countsBottomFirst){
    if(countsBottomFirst && countsBottomFirst.length){
      const rows = [];
      let cursor = 0;
      [...countsBottomFirst].reverse().forEach(c => { rows.push(items.slice(cursor, cursor + c)); cursor += c; });
      return rows.filter(r => r.length);
    }
    const rows = [];
    const rem = items.length % perRow;
    let cursor = 0;
    if(rem){ rows.push(items.slice(0, rem)); cursor = rem; }
    while(cursor < items.length){ rows.push(items.slice(cursor, cursor + perRow)); cursor += perRow; }
    return rows;
  }

  // Point-in-polygon and a sampled coverage ratio: how much of a ribbon a lapel polygon hides.
  function pointInPolygon(p, poly){
    let inside = false;
    for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
      const a = poly[i], b = poly[j];
      if(((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
    }
    return inside;
  }
  function coverage(rect, poly){
    if(!poly || poly.length < 3) return 0;
    let hit = 0, n = 0;
    for(let i = 0; i < 24; i++) for(let j = 0; j < 8; j++){
      n++;
      if(pointInPolygon({ x: rect.x + (i + 0.5) * rect.w / 24, y: rect.y + (j + 0.5) * rect.h / 8 }, poly)) hit++;
    }
    return hit / n;
  }

  // CAPR 39-1 11.2.7 lets a rack's rows be shortened and aligned to the wearer's left edge "to prevent the
  // service coat lapel from covering the ribbons". So in the automatic arrangement no ribbon may be
  // visibly covered by the lapel: the share of a ribbon's area the lapel polygon may hide is only what
  // anti-aliasing or the lapel's own stroke width can account for (about 0.02 in of a 1 3/8 in ribbon).
  const LAPEL_COVER_TOLERANCE = 0.02;

  // Positions for every ribbon of a rack, in inches. `slot` gives the pocket: bottom row rests on
  // `bottomY`, rows of the full width are centred on `centerX` between the pocket edges (or aligned
  // to the wearer's left edge `leftEdgeX` for the "4-left" option). `lapel` is the polygon of the
  // lapel on the award side; when the centred rack would put any ribbon (beyond LAPEL_COVER_TOLERANCE)
  // under it, the rows the lapel reaches shrink and align with the wearer's left edge (11.2.7, Figure 11-1).
  // Rows can never hold more than the row below. A ribbon that no row position keeps clear of the lapel
  // (a very tall rack) stays at the wearer's left edge and is counted in `lapelBlocked`.
  function layoutRack(items, opts){
    const perRow = opts.perRow || 3;
    const w = opts.ribbonW || RIBBON_W, h = opts.ribbonH || RIBBON_H;
    const centerX = opts.centerX, bottomY = opts.bottomY;
    // In a front view the wearer's left pocket edge is the edge farther from the garment centreline.
    const outboardX = opts.outboardX != null ? opts.outboardX : centerX + perRow * w / 2;
    const outboardSign = opts.outboardSign || 1; // +1 when the wearer's left edge is to the viewer's right
    const alignOutboard = opts.align === 'outboard';
    const lapel = opts.lapel || null;
    const maxCover = opts.maxCover != null ? opts.maxCover : LAPEL_COVER_TOLERANCE;

    function rowLeft(count, rowsBelowLeftCenter){
      if(rowsBelowLeftCenter != null) return rowsBelowLeftCenter - count * w / 2;
      return centerX - count * w / 2;
    }

    // The wearer's-left edge that shortened rows align with (11.2.7).
    // Rows of three: "aligned with the left ribbon edge", the edge of the full rows below, which is
    // the bottom row's own outboard edge (centred on the pocket, or on the welt edge for the 4-left option).
    // Rows of four: "aligned with the left welt or pocket edge", the garment's own edge.
    const fullEdge = alignOutboard ? outboardX : centerX + outboardSign * perRow * w / 2;
    const shortEdge = perRow === 4 ? outboardX : fullEdge;
    const edgeLeft = (count, edge) => outboardSign > 0 ? edge - count * w : edge;

    // Candidate left edges for a row of `count` ribbons, best first. The bottom row sits on the centre
    // line (a full row on the wearer's left edge for the 4-left option); every row above a full row centres
    // over the row below it; a shortened row aligns with the wearer's left edge, except the top row,
    // which 11.2.7 centres over the row immediately below, so it tries that first and falls back to the
    // aligned position only when the centred one would put a ribbon under the lapel.
    function candidates(count, fromBottom, belowCenter, isTop){
      const aligned = edgeLeft(count, shortEdge);
      if(fromBottom === 0){
        if(count === perRow) return [alignOutboard ? edgeLeft(count, outboardX) : centerX - count * w / 2];
        return isTop ? [centerX - count * w / 2, aligned] : [aligned];
      }
      if(count === perRow) return [rowLeft(count, belowCenter)];
      return isTop ? [rowLeft(count, belowCenter), aligned] : [aligned];
    }

    // `mode` 'center': every row centred over the row below (the plain arrangement). 'outboard': the
    // lefts the lapel search chose, bottom row first.
    function place(rowsTopFirst, mode, lefts){
      const out = [];
      const n = rowsTopFirst.length;
      let belowCenter = null;
      for(let r = n - 1; r >= 0; r--){
        const row = rowsTopFirst[r];
        const fromBottom = n - 1 - r;
        const y = bottomY - (fromBottom + 1) * h;
        const left = mode === 'outboard' ? lefts[fromBottom] : (fromBottom === 0 ? (alignOutboard && row.length === perRow ? edgeLeft(row.length, outboardX) : centerX - row.length * w / 2) : rowLeft(row.length, belowCenter));
        belowCenter = left + row.length * w / 2;
        row.forEach((item, i) => out.push({ item, x: left + i * w, y, w, h, row: r }));
      }
      return out;
    }

    const custom = opts.countsBottomFirst && opts.countsBottomFirst.reduce((a, b) => a + b, 0) === items.length ? opts.countsBottomFirst : null;
    const standardRows = rackRows(items, perRow, custom);
    const standard = place(standardRows, 'center');
    const worst = lapel ? Math.max(0, ...standard.map(p => coverage(p, lapel))) : 0;
    if(custom || !lapel || worst <= maxCover || opts.arrangement === 'standard'){
      return { placements: standard, rows: standardRows, mode: 'center', lapelCover: worst, lapelBlocked: 0 };
    }

    // Lapel avoidance: from the bottom up, each row holds as many ribbons as stay clear of the lapel when
    // placed as the layout will place them, never more than the row below. A top row is centred over the
    // row below when that is clear of the lapel (11.2.7: the lapel rule shortens rows, the top-row
    // centring yields to it only where the lapel would cover a ribbon).
    const counts = [], lefts = [];
    let left = items.length, cap = perRow, belowCenter = null, blocked = 0;
    for(let fromBottom = 0; left > 0 && fromBottom < 40; fromBottom++){
      const y = bottomY - (fromBottom + 1) * h;
      let fit = 0, fitLeft = null;
      for(let c = Math.min(cap, left); c >= 1 && !fit; c--){
        for(const x0 of candidates(c, fromBottom, belowCenter, c === left)){
          let ok = true;
          for(let i = 0; i < c; i++) if(coverage({ x: x0 + i * w, y, w, h }, lapel) > maxCover){ ok = false; break; }
          if(ok){ fit = c; fitLeft = x0; break; }
        }
      }
      if(!fit){ fit = 1; blocked++; fitLeft = candidates(1, fromBottom, belowCenter, false)[0]; }
      if(fit > left){ fit = left; }
      counts.push(fit);
      lefts.push(fitLeft);
      belowCenter = fitLeft + fit * w / 2;
      cap = Math.min(cap, fit);
      left -= fit;
    }
    const rows = rackRows(items, perRow, counts);
    return { placements: place(rows, 'outboard', lefts), rows, mode: 'outboard', lapelCover: worst, lapelBlocked: blocked };
  }

  // Miniature medals (CAPR 39-1 11.2.8 and Table 11-1): up to four in a row fully exposed; more in a
  // row overlap equally toward the wearer's left, never more than half, with the medal nearest the
  // lapel fully exposed; upper rows cover about half of the ribbon part of the row below.
  // `style` 'mounting' = rows of four (max 24), 'holding' = balanced rows of up to seven (max 28).
  function miniMedalRows(items, style){
    const max = style === 'holding' ? 28 : 24;
    const list = items.slice(0, max);
    if(style !== 'holding') return rackRows(list, 4);
    const rowCount = Math.max(1, Math.ceil(list.length / 7));
    const base = Math.floor(list.length / rowCount), extra = list.length % rowCount;
    const countsBottomFirst = Array.from({ length: rowCount }, (_, i) => base + (i < extra ? 1 : 0));
    return rackRows(list, 7, countsBottomFirst);
  }

  function layoutMiniMedals(items, opts){
    const style = opts.style || 'mounting';
    const rows = miniMedalRows(items, style);
    const medalW = opts.medalW;            // width of one medal (ribbon drape width)
    const totalH = opts.medalH;            // drape + body
    const drapeH = opts.drapeH;
    const slotW = opts.slotW;              // available width (lapel to arm seam)
    const out = [];
    const n = rows.length;
    let y = opts.bottomY;                  // bottom of the bottom row
    for(let r = n - 1; r >= 0; r--){
      const row = rows[r];
      const count = row.length;
      // Fully exposed when they fit; otherwise overlap equally, at most 50%.
      let step = medalW;
      if(count > 4 || count * medalW > slotW){
        step = Math.max(medalW * 0.5, Math.min(medalW, (slotW - medalW) / Math.max(1, count - 1)));
      }
      const rowW = medalW + step * (count - 1);
      const left = opts.centerX - rowW / 2;
      const top = y - totalH;
      // Draw order: the medal nearest the lapel (viewer's left on the wearer's left breast) is fully
      // exposed, so later medals in the row go under it: z decreases toward the viewer's right.
      row.forEach((item, i) => out.push({ item, x: left + i * step, y: top, row: r, z: count - i }));
      // The next row up covers about half of this row's ribbon drape.
      y = top + drapeH * 0.5;
    }
    return { placements: out, rows };
  }

  return {
    RIBBON_W, RIBBON_H, MAX_DEVICES, DEVICE,
    claspsFor, splitAwardCount, layoutDevices, sortRun,
    rackRows, layoutRack, coverage, pointInPolygon, LAPEL_COVER_TOLERANCE,
    miniMedalRows, layoutMiniMedals
  };
});
