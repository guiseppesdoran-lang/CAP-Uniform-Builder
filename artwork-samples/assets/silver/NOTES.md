# Silver tier assets: notes
- All 32 emitted by `silver/retrofit-silver.js` (skill: `emit-asset.js` + `check-asset.js`). 1 user unit = 0.01 in; root width/height in inches.
- **Every size is `estimated`** (no regulation or supplier dimension was available). Basis per badge is in each `.spec.json` (`size_basis`).
  Classes: wings 3.0 in; ground team 2.0 in; incident commander 2.25 in; command/legal 1.6 in; national staff 1.5 in; caduceus 1.5 in;
  solo/pre-solo 1.0 in; model rocketry 0.55 in wide. Replace with CAPR 39-1 or supplier values when known (change the table, re-run).
- Geometry is script-generated but its parameters still live in the generator scripts, not in a JSON spec table (`spec.json` carries only
  size/anchors/reference-px scale). Making each family's body params a first-class spec table is the next retrofit step.
- Anchors are the five bbox anchors only; regulation-specific landmarks (wing centerline, star base, hanging edge...) are not added yet.
- `fit_score` is an approximate bbox-normalised 96x96 mask IoU, not the full score.js gate set.
- Gate failures (silhouette IoU < 0.80) are real: see ASSET_REPORT.json. Known weak designs, not a checker artefact.
- Air Force symbol (`af-symbol.json`) was re-measured from a rendered raster (pixel components -> hulls), not from path data.
- Fonts: Arial Bold outlines read from the macOS system font by `text2path.js` and baked into paths (no `<text>` ships).

## Update: spec tables + gate round 2
- Ground team + wings now carry named intra-badge dimensions (inches) and landmarks (disc/triangle/star/ribbon; roundel/star/wing tips) from `assets/gen-family-specs.js`.
- 31/32 pass the silhouette gate (>= 0.80). **master-pilot is 0.792, deliberately waived**: the only fix found (bigger wreath) crowded the roundel and departed from the approved thin ring.
- Weakest passes (IoU 0.81-0.82): group/squadron commander, legal officer, basic ground team: reference is a dense chrome mass; mine keeps clean outlines.
