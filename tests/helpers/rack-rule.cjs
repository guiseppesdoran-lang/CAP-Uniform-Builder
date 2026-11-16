'use strict';
// The ribbon rack as CAPR 39-1 11.2.7 lays it down, as a check on a drawn rack (a list of what is wrong with it; empty when it is a layout the regulation allows). The rule, with
// its paragraphs, is in the comments; the geometry is the engine's scene (inches, the ribbon 1 3/8 by 3/8 in, 11.3).
//
//   11.2.7  Ribbons go on the wearer's left, the bottom row resting on, not over, the top edge of the left welt or pocket. Rows of three are centered above the pocket between its edges;
//           the top row is centered over the row immediately below; only to prevent the service coat lapel covering the ribbons, additional rows of fewer than three may be aligned with the
//           left ribbon edge. Only rows of three are authorized for the Blue Service uniform (Class B) and the Aviator Shirt Uniform. Rows of four are authorized only on the Service Dress
//           (Class A): the left edge of the ribbons aligned with the left edge of the welt or pocket, or centered above it; only to prevent the lapel covering the ribbons, an additional row of
//           fewer than four may be aligned with the left welt or pocket edge, the top row centered over the row below.
//   11.3.3  There is no space between the rows of ribbons.     11.1.8  The lapel of the service coat may cover a portion of the ribbons.     11.2.4  CAP awards follow the order of precedence.
//
// "Left" is the wearer's left: the edge of the rack toward the wearer's arm, the viewer's right in the front view.
const EPS = 1e-6;
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-4);

// rows: top row first, each an array of { key, x, y, w, h } left to right as seen. `ctx`: { order: ribbon keys in precedence order, rest: { x, y } (the pocket's centre line and the line the
// bottom row rests on), outboardX: the wearer's-left edge of the welt or pocket, width: 3 or 4 (the choice), align: 'left' | 'center' (rows of four), lapelRule: whether the arrangement
// is the one that keeps the lapel clear (rows may be shortened only then), covered(rect): the share of a ribbon-sized rectangle the lapel covers (omitted: no lapel), tolerance, maxPerRow
// (3 for the shirts, 4 for the Class A coat), allowCovered: a ribbon under the lapel is not a fault (the standard arrangement: 11.1.8) }.
function violations(rows, ctx){
  const out = [];
  const W = ctx.width, w = 1.375, h = 0.375;
  const flat = rows.flat();
  if(ctx.order){
    if(flat.length !== ctx.order.length) out.push(`${flat.length} ribbons drawn for ${ctx.order.length}`);
    else if(flat.some((l, i) => l.key !== ctx.order[i])) out.push('the order of precedence is not kept (top row first, left to right as seen)');
  }
  if(!rows.length) return out;
  const most = Math.min(W, ctx.maxPerRow);
  // The arrangement that keeps the lapel clear shortens only rows ADDED above the bottom one (11.2.7): where the lapel covers the bottom row itself (a woman's coat with four across) it
  // cannot be kept clear by the paragraph's means, the rack is the regular one and the lapel covers a portion of it (11.1.8).
  if(ctx.lapelRule && ctx.covered){
    const count = Math.min(W, flat.length), y = ctx.rest.y - h;
    const places = W === 4 && count === 4 && ctx.align !== 'center' ? [ctx.outboardX - count * w] : [ctx.rest.x - count * w / 2].concat(count < W ? [(W === 4 ? ctx.outboardX : ctx.rest.x + 1.5 * w) - count * w] : []);
    const clear = places.some(left => !Array.from({ length: count }, (_, i) => ctx.covered({ x: left + i * w, y, w, h })).some(c => c > ctx.tolerance));
    if(!clear) ctx = Object.assign({}, ctx, { lapelRule: false, allowCovered: true });
  }
  rows.forEach((r, i) => {
    if(r.length > most) out.push(`row ${i + 1} holds ${r.length}, more than ${most} across`);
    for(let j = 1; j < r.length; j++) if(!near(r[j].x, r[j - 1].x + w)) out.push(`row ${i + 1}: a gap or overlap between ribbons`);
    if(i && !near(r[0].y, rows[i - 1][0].y + h)) out.push(`rows ${i} and ${i + 1} are not stacked with no space between (11.3.3)`);
  });
  const bottom = rows[rows.length - 1];
  if(ctx.rest.y != null && !near(bottom[0].y + h, ctx.rest.y)) out.push('the bottom row does not rest on the top edge of the welt or pocket');
  const edge = r => r[r.length - 1].x + w;                 // the row's wearer's-left edge
  const centre = r => (r[0].x + edge(r)) / 2;
  const centredOnPocket = r => near(centre(r), ctx.rest.x);
  const fullPlaced = r => W === 3 || ctx.align === 'center' ? centredOnPocket(r) : near(edge(r), ctx.outboardX);
  const shortEdge = W === 4 ? ctx.outboardX : ctx.rest.x + 1.5 * w;          // where a shortened row's wearer's-left edge lies: the welt's edge (four), the full rows' edge (three)
  const coveredAt = (r, count, left) => ctx.covered ? Array.from({ length: count }, (_, i) => ctx.covered({ x: left + i * w, y: r[0].y, w, h })).some(c => c > ctx.tolerance) : false;
  const up = [...rows].reverse();
  up.forEach((r, k) => {
    const below = up[k - 1];
    const isTop = k === up.length - 1;
    const label = `the row of ${r.length} at ${k + 1} from the bottom`;
    if(r.length === W){
      if(k === 0){ if(!fullPlaced(r)) out.push(`the bottom row of ${W} is not ${W === 3 || ctx.align === 'center' ? 'centered above the pocket' : 'aligned with the left edge of the welt'} (11.2.7)`); }
      else if(below.length !== W) out.push(`${label} is longer than the row below it`);
      else if(!near(r[0].x, below[0].x)) out.push(`${label} is not over the full row below it (11.2.7)`);
      return;
    }
    if(k === 0 && !isTop){ out.push(`the bottom row holds ${r.length}, not ${W}: rows are full from the bottom (11.2.7)`); return; }
    if(isTop){
      const centered = k === 0 ? centredOnPocket(r) : near(centre(r), centre(below));
      const aligned = near(edge(r), shortEdge);
      if(r.length > (below || r).length) out.push(`${label} is longer than the row below it`);
      if(centered) return;
      if(!(ctx.lapelRule && aligned)) out.push(`the top row of ${r.length} is not centered over the row below it (11.2.7)`);
      else if(ctx.covered){
        const left = k === 0 ? ctx.rest.x - r.length * w / 2 : centre(below) - r.length * w / 2;
        if(!coveredAt(r, r.length, left)) out.push(`the top row of ${r.length} is aligned to the edge though the lapel does not reach it centered (11.2.7)`);
      }
      return;
    }
    // a shortened row below the top: only to keep the lapel clear, aligned with the left edge, never longer than the row below
    if(!ctx.lapelRule){ out.push(`${label} is shorter than ${W} where the lapel is not being kept clear (11.2.7)`); return; }
    if(!near(edge(r), shortEdge)) out.push(`${label} is not aligned with the left edge (11.2.7)`);
    if(r.length > below.length) out.push(`${label} is longer than the row below it`);
    // (a row never holds more than the row below it, so one above a shortened row is shortened with it: the engine's reading, the paragraph does not say a row may not widen again)
    if(ctx.covered && r.length + 1 <= below.length && !coveredAt(r, r.length + 1, shortEdge - (r.length + 1) * w)) out.push(`${label} was shortened though ${r.length + 1} stand clear of the lapel (11.2.7: only to prevent the lapel covering the ribbons)`);
  });
  if(ctx.covered && !ctx.allowCovered) for(const l of flat) if(ctx.covered(l) > ctx.tolerance) out.push(`a ribbon is under the lapel (${l.key})`);
  return out;
}

const rowsOfLayers = layers => {
  const byY = new Map();
  for(const l of layers){ const k = l.y.toFixed(4); (byY.get(k) || byY.set(k, []).get(k)).push(l); }
  return [...byY.keys()].sort((a, b) => a - b).map(k => byY.get(k).sort((a, b) => a.x - b.x));
};

module.exports = { violations, rowsOfLayers, EPS };
