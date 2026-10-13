# Builder artwork

Scale-accurate SVG artwork for the current CAP uniforms. See `MANIFEST.json` for every asset.

- Each SVG's root `width`/`height` are inches; the viewBox is 0.01 in per user unit.
- Each SVG has a `.spec.json` beside it with `size_source` (`regulation`, `measured` or `estimated`), the size basis, anchors and landmarks, in user units from the top-left of the artwork.
- Draw order: base garment, then layers registered at 0,0 to its box, then insignia at the layer slots.
- Hats align their `garment_attach_center` with the garment `top_center`. Cords sit at `shoulder_seam_attach`.
- Military ribbons, medals and badges (`military-*`, `mini_medals/mcchord`) are the earlier set and are replaced in a later import.
