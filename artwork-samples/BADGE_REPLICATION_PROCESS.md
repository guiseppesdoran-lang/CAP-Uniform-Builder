> Superseded by the installed skill: `~/.claude/skills/badge-replicator/SKILL.md` (generic scripts + worked example).

# Replicating a badge from reference art (measured, not eyeballed)

Worked example: `images/badges/senior_ground_team_badge.webp` -> `badges/senior_ground_team.svg`.
Scripts live next to this file. Everything below ran on macOS with only Node + `sips` + `qlmanage`.

## 0. Prep
1. `sips -s format png <ref>.webp --out ref.png` (reference has a transparent background; keep the alpha).
2. Note the reference size (`sips -g pixelWidth -g pixelHeight`). Draw the SVG in the same viewBox.

## 1. Measure the silhouette  (`measure.js`)
- Row-by-row min/max x of alpha>100. Gives overall bbox, centre line, and the width profile.
- Fit primitives to it: disc/circle from half-widths at several rows (r^2 = h^2 + dy^2), star from apex
  and arm-tip rows (arm y = cy - 0.309R, half-width = 0.951R), wreath as a piecewise ellipse
  (separate upper and lower semi-axes).
- Rows where alpha has transparent gaps show where the wreath does not touch the disc.

## 2. Read interior geometry  (`grid.js`)
- Render the reference with a labelled coordinate grid (10px lines) at 8-14x and read triangle apex/base,
  GT box, rim ring, stripe pitch directly in reference pixel coordinates.

## 3. Count and angle the leaves  (`leaves.js`)
- Tips: cast rays from the wreath centre, take the outermost alpha point, subtract a moving average;
  residual peaks = leaf tips on the outer row (cluster nearby peaks).
- Outlines: sample luminance along curves parallel to the outer edge (offsets 6..30px) and count dark
  minima; leaves per row ~ crossings / 2.
- Angles: structure tensor over a 13px window along the band centreline gives the stroke direction;
  subtract the band tangent to get a "rel" angle per position (+/- 10-30 degrees here).
- Encode as a table in the generator: leaf centres (degrees from straight-down), length, width, row
  offset, rel-angle table.

## 4. Generate and verify  (`make-gt-badge.js`, `diff.js`)
- All measured numbers sit in one `M = {...}` table at the top of the generator.
- Render the SVG (`qlmanage -t`), mask the background, normalise both silhouettes to their bounding
  boxes and print left/right edge error at 25 heights. Track "mean edge error (fraction of width)".
- Side-by-side image (`gt-badge-compare.png`) for the visual check.

## Gotchas
- `qlmanage` scales SVG thumbnails unpredictably: always compare normalised-to-bbox, never pixel-for-pixel.
- `sips -c` crops from the centre; pad the SVG so the content is centred before cropping.
- macOS `sed -i` needs `-i ''`.
- Silhouette error is not the whole story: a ring of 30 thin leaves scored best numerically but looked
  wrong. Always count leaves and compare the look.
- Result for this badge: 8 outer + 7 inner leaves per side, ~48x15 px, mean edge error ~2.0%.
