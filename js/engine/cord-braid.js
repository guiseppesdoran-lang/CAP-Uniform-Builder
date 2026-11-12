// The shoulder cord's braid, drawn once for the art generator (node) and the builder's engine (browser).
//
// What it is: the cord in the CAP Honor Guard uniform guidance figures, a flat box braid seen from the front. It is a chain of links along the
// cord. Each link is three columns: a left and a right lobe (a rounded, slightly barrelled rectangle, the loops that show at the edges) and between
// them a centre strip made of two cells; the strands cross there on a slant, so between the cells there is a dark rung that rises toward one side.
// Everything is a light fill with a darker outline and no shading. The lower end is closed with a plain flat cap.
//
// Measured on the figure the guidance prints for the Class A coat (the left figure's left sleeve, a picture 2048 px wide in which the cord is 38.65 px
// across) after straightening the cord along its own axis and averaging seven links: see LOOK.fig. The Class B figure's cord agrees (pitch 28.75 px,
// width within 4 percent). The guidance draws the cord about twice as thick as the 0.5 in the engine uses, so only its proportions are taken.
//
// One drawing function:  CordBraid.draw(points, cord, opts) -> { run, extras }.   Loads as a classic script (window.CordBraid) and as a CommonJS module.
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.CordBraid = api;
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  // ---- LOOK: the measured numbers --------------------------------------------------------------------------------------------------------------
  // fig: figure pixels, as measured. Everything else is fig / fig.width, so the braid scales with the width it is drawn at.
  const fig = {
    width: 38.65,          // widest extent across the braid, middle of a lobe, outer edge to outer edge (the per-row extents average 37.7 px, up to 39.3)
    widthAtBoundary: 35.0, // narrowest extent, at the line between two links: the two outer edges pinch in 1.8 px a side
    pitch: 28.0,           // one link, boundary line to boundary line (lines at 16.25, 44.25, 72.5, 100.5, 128, 156, 184.25 px of the straightened strip; Class B figure 28.75)
    outline: 2.2,          // thickness of the dark line down the braid: the outer rim and the two inner lines (area under the dips 2.2 px each, either line)
    boundary: 2.7,         // the dark line across the braid between two links (area under the dip: 2.5 to 2.9 px over six links)
    innerHalfGap: 7.4,     // half the distance between the two inner lines (lobe | centre strip), line centre to line centre, middle of a link (14.8 px; 13.3 at the boundary)
    cornerRadius: 1.5,     // corner of a lobe cell and of a centre cell (nearly square; the barrel is the visible rounding)
    // The centre strip's cells, from the dark bands in three columns (u = -5, 0, +5 px from the strip's axis) in the phase from a boundary line's centre.
    // Each edge is the line s = at0 + slope * u (u across to the right, s along the braid downward); at0 in figure px.
    cellA: { top: [5.4, -0.275], bottom: [14.0, -0.175] },     // upper cell: below the shadow wedge under the boundary line, down to the rung
    cellB: { top: [18.2, -0.175], bottom: [27.0, -0.1] },      // lower cell: below the rung, down to the next boundary line
    rungThickness: 4.2,    // the rung between the two cells, measured across it (the gap between cell A's lower edge and cell B's upper edge)
    capLength: 10.5,       // the end cap, outer edge to outer edge along the braid
    capWidth: 30.4,        // and across (0.79 of the braid)
    capRadius: 1.5
  };
  const WIDTH_IN = 0.5;                             // the engine's cord width (js/engine/core.js CORD_WIDTH)
  const R = v => v / fig.width;                     // figure px -> fraction of the braid width
  const IN = v => +(R(v) * WIDTH_IN).toFixed(4);    // figure px -> inches at the default width
  const LOOK = {
    width: WIDTH_IN,                       // inches across, widest point, outline included: the engine's cord width
    pitch: IN(fig.pitch),                  // inches along the braid for one link: 0.3623 (figure: 28.0 px of 38.65)
    outline: IN(fig.outline),              // the dark line down the braid, round the lobes and along the centre strip: 0.0285 (2.2 px)
    boundary: IN(fig.boundary),            // the dark line across the braid between two links: 0.0349 (2.7 px)
    lobe: {                                // each of the two outer columns
      width: IN(fig.width / 2 - fig.outline - fig.innerHalfGap - fig.outline / 2),   // the cell inside its outline: 0.1116 (8.6 px)
      length: IN(fig.pitch - fig.boundary),                                            // 0.3274 (the lobes touch: one line between neighbours)
      bulge: IN((fig.width - fig.widthAtBoundary) / 2)                                 // each outer edge bows out this far from a boundary to the middle of the lobe: 0.0235 (1.8 px)
    },
    centre: {                              // the strip between the lobes
      width: IN(fig.innerHalfGap * 2 - fig.outline),                                   // clear width at the middle of a link: 0.1630 (12.6 px: 14.8 between line centres, less one line)
      cells: 2,                                                                        // two cells per link, the strands crossing between them
      rungSlope: fig.cellA.bottom[1],                                                  // the rung rises 0.175 per unit across: 10 degrees
      rungThickness: IN(fig.rungThickness)                                             // 0.0543 (4.2 px)
    },
    radius: IN(fig.cornerRadius),          // corner radius of the cells: 0.0194 (1.5 px)
    cap: { length: IN(fig.capLength), width: IN(fig.capWidth), radius: IN(fig.capRadius) },   // 0.1358 long, 0.3933 wide (10.5 by 30.4 px)
    ratio: {                               // the same as fractions of the braid width
      pitch: +R(fig.pitch).toFixed(4), outline: +R(fig.outline).toFixed(4), narrowest: +(fig.widthAtBoundary / fig.width).toFixed(4),
      innerHalfGap: +R(fig.innerHalfGap).toFixed(4), cap: +R(fig.capLength).toFixed(4), capWidth: +R(fig.capWidth).toFixed(4)
    },
    fig,
    // Strand, tip and knot: the guidance's Georgia figure (photographs, first and fifth pictures) shows them. All in braid widths. Vanguard's 9 inch single gold strand
    // with silver tip (CAP0650J) was measured against them; see assets/ASSET_NOTES.md (cords-vanguard) for what it settled and what it left.
    extras: {
      strand: 0.16,          // thickness of the thin cord: 4.7 px in a braid 27 px across in the first picture (0.17); the aiguillette art uses 0.14
      drop: 6.8,             // from the shoulder end down to the tip's end: 187 px of 27 in the first picture (6.9)
      tipLength: 3.0,        // the pencil tip, first ring to point: 79 px of 27 (2.9)
      tipWidth: 0.30,        // its widest part: 8 px of 27
      knotWidth: 0.55,       // the wrapped knot, as the aiguillette's whipping (0.7 by 1.8 braid thicknesses), a little slimmer
      knotLength: 1.7,
      knotTurns: 7,
      strandGap: 0.35        // when a cord has two strands they hang this far either side of the shoulder end
    }
  };

  // The tip: the aiguillette art's pencil tip profile (fraction of length, half width in that art's units): cup, ring, body, ring, cone to the point.
  const TIP_PROF = [[0, 0.236], [0.158, 0.236], [0.158, 0.172], [0.19, 0.172], [0.19, 0.189], [0.317, 0.189], [0.317, 0.172], [0.35, 0.172], [0.983, 0.044], [1, 0.033]];
  const TIP_RINGS = [0.158, 0.317, 0.35];
  const TIP_SCALE = 0.5 / 0.236;      // times tipWidth gives the widest half width

  // ---- colours -----------------------------------------------------------------------------------------------------------------------------------
  function pair(table, name, what){
    if(name && typeof name === 'object' && name.main) return { main: name.main, dark: name.dark || name.main };
    const p = table && table[name];
    if(!p) throw new Error('cord colour "' + name + '" is not in the palette' + (what ? ' (' + what + ')' : ''));
    return { main: p.main, dark: p.dark };
  }
  // The cord entry with its colour names replaced by {main, dark} hexes. `chosenColour`: a palette name (or a {main, dark} pair) for a cord whose colour the
  // member picks. Returns null for an id that is not in the list.
  function resolve(cordsJson, id, chosenColour){
    const e = [].concat(cordsJson.regulation || [], cordsJson.supplement || []).find(c => c && c.id === id);
    if(!e) return null;
    const pal = cordsJson.palette || {}, metals = cordsJson.metals || {}, out = Object.assign({}, e);
    if(e.style === 'chosen'){
      if(chosenColour == null) throw new Error('cord ' + id + ' needs a chosen colour');
      out.colours = [pair(pal, chosenColour, id)];
    } else if(e.style === 'edge-centre'){
      out.edge = pair(pal, e.edge, id); out.centre = pair(pal, e.centre, id);
      out.colours = [out.edge, out.centre];
    } else out.colours = (e.colours || []).map(n => pair(pal, n, id));
    if(e.strand) out.strand = { colour: pair(pal, e.strand.colour, id), tip: pair(metals, e.strand.tip, id), knot: !!e.strand.knot };
    if(e.aiguillette) out.aiguillette = pair(pal, e.aiguillette, id);
    return out;
  }

  // Numbers fine enough to draw the braid at any size, short enough to keep the markup small.
  function formatter(W){
    const dp = Math.max(0, Math.ceil(Math.log10(1500 / Math.max(W, 1e-6))));
    return v => { const s = (+v).toFixed(dp); return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '').replace(/^-0$/, '0'); };
  }

  // ---- the path the braid lies on, by arc length ----------------------------------------------------------------------------------------------
  function pathOf(points){
    const P = points.map(p => [+p[0], +p[1]]), cum = [0];
    for(let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const len = cum[cum.length - 1];
    function pos(s){
      s = Math.max(0, Math.min(len, s));
      let lo = 0, hi = P.length - 1;
      while(hi - lo > 1){ const m = (lo + hi) >> 1; if(cum[m] <= s) lo = m; else hi = m; }
      const d = cum[hi] - cum[lo], t = d > 0 ? (s - cum[lo]) / d : 0;
      return [P[lo][0] + (P[hi][0] - P[lo][0]) * t, P[lo][1] + (P[hi][1] - P[lo][1]) * t];
    }
    return { len, pos };
  }
  // The frame at arc length s: the centre point and the unit direction across the braid (to the right when the braid runs down the page), from
  // the chord of the path h either side, so a corner of the polyline turns the links smoothly.
  function framer(path, h){
    const memo = new Map();
    return function(s){
      let f = memo.get(s);
      if(f) return f;
      const c = path.pos(s), a = path.pos(s - h), b = path.pos(s + h);
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      memo.set(s, f = { x: c[0], y: c[1], nx: ty / l, ny: -tx / l });
      return f;
    };
  }

  // ---- the drawing ---------------------------------------------------------------------------------------------------------------------------------
  // points: the braid's centre line, shoulder end first, y down, in the caller's own units; opts.unit says how many of those units make an inch (default 1),
  // so inch measures (the width) become units. The markup is in the same units. cord: a resolved entry (see resolve). opts: { unit, width (in), idPrefix, cap }.
  function draw(points, cord, opts){
    opts = opts || {};
    const unit = opts.unit > 0 ? opts.unit : 1;
    const W = (opts.width > 0 ? opts.width : LOOK.width) * unit;     // units across, widest
    const idp = opts.idPrefix || '';
    const fmt = formatter(W);
    const extras = cord ? drawExtras(points, cord, W, fmt, idp) : '';
    if(!points || points.length < 2 || !cord) return { run: '', extras };
    const path = pathOf(points), len = path.len;
    if(!(len > 0)) return { run: '', extras };

    const px = v => v / fig.width * W;                       // figure px -> units
    const rr = px(fig.cornerRadius), t = px(fig.outline), tb = px(fig.boundary), H = W / 2, Hi = px(fig.innerHalfGap), fmin = fig.widthAtBoundary / fig.width;
    const capH = opts.cap ? px(fig.capLength) : 0;
    const n = Math.max(1, Math.round((len - capH) / px(fig.pitch)));
    const P = (len - capH) / n;                              // the pitch, stretched a little so that a whole number of links fills the run
    const frame = framer(path, 0.3 * P);
    const Pt = (u, s) => { const f = frame(s); return fmt(f.x + u * f.nx) + ',' + fmt(f.y + u * f.ny); };
    const barrel = ph => fmin + (1 - fmin) * 4 * ph * (1 - ph);   // 1 in the middle of a link, fmin at its boundary lines

    // which colour the lobes and the centre cells are; the outline of a link is the dark of its lobes. Two colours go as the vendor's two-colour 2723 interwoven cords
    // are made (Vanguard: Royal Blue/Gold CAP0650H, Orange & Black CAP3740591, Scarlet Red and White 3740500 and seven more): the first colour is on the lobes, both
    // outside edges, the whole length, the second in the centre strip, never one colour then the other link by link. interwoven and edge-centre are the same drawing.
    const cols = cord.colours || [], style = cord.style || 'solid';
    const c0 = cols[0] || { main: '#cdd2d7', dark: '#7f8790' }, c1 = cols[1] || c0;
    const twoColour = style === 'edge-centre' || style === 'interwoven';
    const lobeCol = () => c0;
    const centreCol = () => twoColour ? c1 : c0;
    const groups = [];                                       // one per colour, in first-use order
    const grp = col => groups.find(g => g.col.main === col.main && g.col.dark === col.dark) || (groups[groups.push({ col, fill: [], ground: [], capFill: [], capGround: [], capR: 0 }) - 1]);

    // a lobe cell between s0 and s1 (link-local): outer side u = sgn*uo(s), inner side u = sgn*ui(s); both are quadratic in s, so each is one exact Bezier
    const lobe = (b, s0, s1, uo, ui, sgn) => {
      const sm = (s0 + s1) / 2, q = f => 2 * f(sm) - 0.5 * (f(s0) + f(s1));
      return 'M' + Pt(sgn * uo(s0), b + s0) + 'Q' + Pt(sgn * q(uo), b + sm) + ' ' + Pt(sgn * uo(s1), b + s1)
        + 'L' + Pt(sgn * ui(s1), b + s1) + 'Q' + Pt(sgn * q(ui), b + sm) + ' ' + Pt(sgn * ui(s0), b + s0) + 'Z';
    };

    for(let k = 0; k < n; k++){
      const b = k * P, gl = grp(lobeCol(k)), gc = grp(centreCol(k)), F = s => barrel(s / P);
      // the link's silhouette, boundary line to boundary line (the dark underneath: its outline is what the cells leave uncovered)
      const sil = s => H * F(s), sm = P / 2, qs = 2 * sil(sm) - 0.5 * (sil(0) + sil(P));
      gl.ground.push('M' + Pt(-sil(0), b) + 'Q' + Pt(-qs, b + sm) + ' ' + Pt(-sil(P), b + P) + 'L' + Pt(sil(P), b + P) + 'Q' + Pt(qs, b + sm) + ' ' + Pt(sil(0), b) + 'Z');
      // the two lobes, each inset by the corner radius (the stroke adds it back and rounds the corners)
      const sA = tb / 2 + rr, sB = P - tb / 2 - rr, uo = s => H * F(s) - t - rr, ui = s => Hi * F(s) + t / 2 + rr;
      gl.fill.push(lobe(b, sA, sB, uo, ui, -1), lobe(b, sA, sB, uo, ui, 1));
      // the centre strip's two cells: slanted top and bottom edges, sides on the strip's inner lines. A corner is where an edge meets the side (found by iterating).
      const hc = s => Hi * F(s) - t / 2 - rr;
      const edge = (e, u, off) => e[0] / fig.pitch * P + e[1] * u + off;
      const corner = (e, sign, off) => { let s = edge(e, 0, off), u = 0; for(let i = 0; i < 4; i++){ u = sign * hc(s); s = edge(e, u, off); } return { u, s }; };
      const side = (A, B, sgn) => { const m = (A.s + B.s) / 2; return Pt(sgn * (2 * hc(m) - 0.5 * (hc(A.s) + hc(B.s))), b + m) + ' ' + Pt(B.u, b + B.s); };
      for(const c of [fig.cellA, fig.cellB]){
        const TL = corner(c.top, -1, rr), TR = corner(c.top, 1, rr), BL = corner(c.bottom, -1, -rr), BR = corner(c.bottom, 1, -rr);
        gc.fill.push('M' + Pt(TL.u, b + TL.s) + 'L' + Pt(TR.u, b + TR.s) + 'Q' + side(TR, BR, 1) + 'L' + Pt(BL.u, b + BL.s) + 'Q' + side(BL, TL, -1) + 'Z');
      }
    }
    // the end cap: one plain flat band across the lower end, its top edge on the last boundary line
    if(capH > 0){
      const b = n * P, g = grp(lobeCol(n - 1)), hw = px(fig.capWidth) / 2, cr = px(fig.capRadius);
      const box = (u0, s0, u1, s1) => 'M' + Pt(u0, b + s0) + 'L' + Pt(u1, b + s0) + 'L' + Pt(u1, b + s1) + 'L' + Pt(u0, b + s1) + 'Z';
      g.capGround.push(box(-hw + cr, -tb / 2 + cr, hw - cr, capH - cr));
      g.capFill.push(box(-hw + t + cr, tb / 2 + cr, hw - t - cr, capH - t - cr));
      g.capR = cr;
    }

    const shape = (d, col, w) => '<path fill="' + col + '"' + (w ? ' stroke="' + col + '" stroke-width="' + fmt(w) + '" stroke-linejoin="round"' : '') + ' d="' + d + '"/>';
    const parts = [];
    for(const g of groups) if(g.ground.length) parts.push(shape(g.ground.join(''), g.col.dark, 0));
    for(const g of groups) if(g.capGround.length) parts.push(shape(g.capGround.join(''), g.col.dark, 2 * g.capR));
    for(const g of groups) if(g.fill.length) parts.push(shape(g.fill.join(''), g.col.main, 2 * rr));
    for(const g of groups) if(g.capFill.length) parts.push(shape(g.capFill.join(''), g.col.main, 2 * g.capR));
    return { run: '<g id="' + idp + 'braid">' + parts.join('') + '</g>', extras };
  }

  // ---- strand(s), knot and metal tip, hanging straight down from points[0] ----------------------------------------------------------------------
  function drawExtras(points, cord, W, fmt, idp){
    if(!points || !points.length || !(cord.strand || cord.knot)) return '';
    const E = LOOK.extras, x0 = +points[0][0], y0 = +points[0][1], cols = cord.colours || [];
    const metal = { main: '#c9ccd2', dark: '#2e3036' };
    const main = cord.strand || { colour: cols[cols.length - 1] || { main: '#cdd2d7', dark: '#7f8790' }, tip: metal };
    const strands = [];
    if(cord.knot){
      // the Georgia figure's overall cadet of the year cord has two strands, each knotted and tipped: the strand colour and the braid's other colour
      const other = cols.find(c => c.main !== main.colour.main) || cols[0] || main.colour;
      strands.push({ dx: -E.strandGap * W, col: other, tip: main.tip, knotAt: 0.5 }, { dx: E.strandGap * W, col: main.colour, tip: main.tip, knotAt: 0.64 });
    } else strands.push({ dx: 0, col: main.colour, tip: main.tip, knotAt: main.knot ? 0.5 : null });   // strand.knot: the wrapped knot of the 9 inch single strand (Vanguard CAP0650J: centre 23 percent of the way down from the pinned end, ours 28)
    const tipLen = E.tipLength * W, thick = E.strand * W, yHead = y0 + (E.drop - E.tipLength) * W, line = 0.03 * W;
    let out = '';
    strands.forEach((s, i) => {
      const x = x0 + s.dx, v = 'M' + fmt(x) + ',' + fmt(y0) + 'L' + fmt(x) + ',' + fmt(yHead + 0.02 * W);
      let g = '<g id="' + idp + 'strand' + i + '">';
      g += '<path d="' + v + '" fill="none" stroke="' + s.col.dark + '" stroke-width="' + fmt(thick + line) + '" stroke-linecap="round"/>';
      g += '<path d="' + v + '" fill="none" stroke="' + s.col.main + '" stroke-width="' + fmt(thick) + '" stroke-linecap="round"/>';
      if(s.knotAt != null){
        const kl = E.knotLength * W, kw = E.knotWidth * W, ky = y0 + s.knotAt * (E.drop - E.tipLength) * W - kl / 2, kx0 = x - kw / 2, kx1 = x + kw / 2;
        g += '<rect x="' + fmt(kx0) + '" y="' + fmt(ky) + '" width="' + fmt(kw) + '" height="' + fmt(kl) + '" rx="' + fmt(0.08 * W) + '" fill="' + s.col.main + '" stroke="' + s.col.dark + '" stroke-width="' + fmt(line) + '"/>';
        let d = '';
        for(let k = 1; k < E.knotTurns; k++){ const yy = ky + kl * k / E.knotTurns; d += 'M' + fmt(kx0) + ',' + fmt(yy) + 'L' + fmt(kx1) + ',' + fmt(yy); }
        g += '<path d="' + d + '" fill="none" stroke="' + s.col.dark + '" stroke-width="' + fmt(0.025 * W) + '"/>';
      }
      const half = p => p[1] * TIP_SCALE * E.tipWidth * W;
      const left = TIP_PROF.map(p => fmt(x - half(p)) + ',' + fmt(yHead + p[0] * tipLen)), right = TIP_PROF.slice().reverse().map(p => fmt(x + half(p)) + ',' + fmt(yHead + p[0] * tipLen));
      g += '<path d="M' + left.join('L') + 'L' + right.join('L') + 'Z" fill="' + s.tip.main + '" stroke="' + s.tip.dark + '" stroke-width="' + fmt(line) + '" stroke-linejoin="round"/>';
      let rings = '';
      for(const f of TIP_RINGS){ const p = TIP_PROF.find(q => q[0] === f), yy = yHead + f * tipLen; rings += 'M' + fmt(x - half(p)) + ',' + fmt(yy) + 'L' + fmt(x + half(p)) + ',' + fmt(yy); }
      g += '<path d="' + rings + '" fill="none" stroke="' + s.tip.dark + '" stroke-width="' + fmt(0.025 * W) + '"/>';
      out += g + '</g>';
    });
    return '<g id="' + idp + 'extras">' + out + '</g>';
  }

  return { LOOK, resolve, draw, pathOf };
});
