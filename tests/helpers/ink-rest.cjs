'use strict';
// Where a piece's ink lies against the gorge seam, measured from the SVG itself (scripts/measure-ink-rest.cjs), so the
// tests check what is drawn, not the engine's own table.
const { compute } = require('../../scripts/measure-ink-rest.cjs');
const core = require('../../js/engine/core.js');

let hulls = null;
const allHulls = () => hulls || (hulls = compute());

const seamYAt = (spec, side, x) => {
  const p1 = core.anchor(spec, `gorge_seam_${side}_p1`), p2 = core.anchor(spec, `gorge_seam_${side}_p2`);
  return p1.y + (p2.y - p1.y) * (x - p1.x) / (p2.x - p1.x);
};

// Smallest vertical distance from the piece's ink up to the seam line (0 = resting on it, negative = over it).
// `layer` is an asset layer of a placed piece (chevron, collar insignia): the hull is in the box's own inches.
function placedInkGap(coatSpec, side, layer){
  const hull = allHulls()[layer.id];
  if(!hull) throw new Error('no ink hull for ' + layer.id);
  return Math.min(...hull.map(([px, py]) => seamYAt(coatSpec, side, layer.x + px) - (layer.y + py)));
}
// The lapel letters overlay: the hull is in sheet inches, moved by the layer's offset.
function overlayInkGap(coatSpec, side, layer){
  const hull = allHulls()[`${layer.id}#${side}`];
  if(!hull) throw new Error('no ink hull for ' + layer.id + ' ' + side);
  return Math.min(...hull.map(([x, y]) => seamYAt(coatSpec, side, x + layer.x) - (y + layer.y)));
}

module.exports = { allHulls, placedInkGap, overlayInkGap, seamYAt };
