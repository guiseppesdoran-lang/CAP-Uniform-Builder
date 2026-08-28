# McChord Asset Standard

Generated from the unmodified local McChord master assets by `scripts/analyze_mcchord_assets.py`.

## Scope and provenance

- Ribbon masters are the 409 unique image files referenced by `mcchord-ribbon-variants.js` and present in `images/ribbons/`.
- Miniature-medal masters are the 433 local files in `images/mini_medals/mcchord/`.
- The script measures geometry, alpha coverage, saturation, luminance contrast, and edge energy without modifying source artwork.
- Commercial product images are **not** master artwork and are never used at runtime.

## Ribbon baseline

- Most common dimensions: `[{'width': 100, 'height': 30, 'count': 409}]`
- Median aspect ratio: 3.3333
- Median alpha coverage: 1.0
- Median saturation: 171.82
- Median luminance contrast: 62.27
- Median edge energy (sharpness proxy): 84.67

Builder display geometry is normalized to a 100 × 30 pixel ribbon tile (the physical 1⅜ × ⅜ ratio is preserved by rack geometry). Newly composited output must retain the base stripe widths and ordering, then apply the same subtle vertical fabric modulation, edge shading, and highlight direction used by the current runtime compositor. Device artwork must be transparent, metallic, and rasterized into the same final 100 × 30 output; no separate browser glyph layer is acceptable.

## Miniature-medal baseline

- Most common dimensions: `[{'width': 50, 'height': 176, 'count': 433}]`
- Median aspect ratio: 0.2841
- Median alpha coverage: 0.8939
- Median saturation: 116.7
- Median luminance contrast: 84.61
- Median edge energy (sharpness proxy): 88.34

Miniature medals are not ribbon bars with generic pendants. Every reviewed mapping must retain its actual suspension-ribbon geometry and award pendant. Device placement uses a dedicated `miniatureMedal` context and may not reuse ribbon-bar coordinates.

## Acceptance gates

1. Asset dimensions and content bounds must fall within the measured family or carry a documented exception.
2. Transparent padding and pendant/suspension bounds must be reviewed visually on the contact sheet.
3. A military medal is unavailable until a canonical award has a reviewed local mapping in `data/rules/verified/representation-overrides.json`.
4. Inferred device rules remain hidden from normal mode; only official-source overrides may enable a combination there.
5. Preview and PNG export must consume the same flattened representation.

The complete per-file measurements are in `reports/mcchord-asset-analysis.json`.
