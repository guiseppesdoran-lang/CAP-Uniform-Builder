# Military badges, redraw brief for a worker (Air Force non-aviation, Army, Navy, Marine Corps, Coast Guard)

Repo: /Users/ethan/UniformBuilder/artwork-samples/assets/military. Work ONLY in your own subdirectory `<set>/<yourgroup>/` (create it),
node + macOS sips/qlmanage only, no installs. Your set directory (af2, army, navy, usmc, uscg) has `ref/<design>__<variant>.png` references,
`gate.js <name>` (hard gates + silhouette IoU) and `sbs.js <name> [scale]` (reference LEFT, mine RIGHT -> sbs/<name>.png), `refsheet.png`.
Write each result to `<set>/out/<design>__<variant>.svg` (reference pixel grid as viewBox: `0 0 W H` of the reference).

## What the art must look like  (HARD REQUIREMENT from the requester)
**Fully flat, no shadows.** Every fill is ONE flat silver `#dfe3ea`. Structure is drawn with outlines (`#3d4756`, 0.5-1.1 wide) and thin
engraving lines (`#5f6b7d`, 0.4-0.6 wide) only. NO gradients, NO dark or mid-tone fills, NO shadow/recess shapes, NO opacity tricks, no
highlights. Where the original shows structure only through tone (a dark half of a star, a shaded wing), draw the shape's OUTLINE and
leave it flat. No `<filter>`, no `<text>` (draw lettering as shapes only when it is large and legible; otherwise omit and say so), no
embedded raster. ids unique per file (prefix with the file name). A post-process will force-flatten anything that is not.

## References are NOT all clean
Air Force refs (320x180 RGBA) have transparent backgrounds. Army refs are mostly OCP/ABU **embroidered patches on camouflage cloth** (opaque
camo background; a few are metal on white): find the badge by LOOKING (it is the dark/thread-coloured object); `gate.js` silhouette IoU
is unreliable on those, so use sbs and your eyes as the judge and say so. Navy/USMC/USCG refs are photos of gold/silver badges on white or
other backgrounds. If a reference is unusable (a photo of a scene, badge cut off, ambiguous), say so in the report and build the badge from
the name and the other variants of the same design instead, clearly marked. Never invent decoration you cannot see; leave it out and report.
The badge is drawn as the METAL/DRESS badge shape (not the cloth thread texture); for embroidered refs draw the same design cleanly.

## Existing parts you may require/copy (read-only; copy into your dir if you need changes)
- `af/g2/make.js`: USAF oval-wreath badges (shared wreath body: wreathLeaves/hull/star/senior star/master wreathed star ring, 3 levels).
- `af/g1a/make-g1a.js`, `af/g1b/make-g1b.js`: USAF wings bodies. `af/g3/lib.js`: helpers (spline, star, leaf, wreathedStar).
- `../../wings/wreath-device.js` (wreathed-star ring), `../../silver/kit.js`, `../../enamel/shield.js`.
- Skill: ~/.claude/skills/badge-replicator/SKILL.md (measure -> structure -> critique), scripts `grid.js`, `crop-compare.js`, `render.js`.
- A finished example of the standard to meet: `af/out-flat/*.svg` and `af/ALL_AF_AVIATION.png` (flat, outline-only).

## Rules
1. Family first: levels/variants of one design share a body; draw it once, call it per variant (basic: none; senior: star above; master/chief:
   wreathed star above; Army: aviation basic/senior/master use star / wreathed star on the wings).
2. Never trace or auto-vectorise; measure and construct from clean primitives, curves with >= 36 samples. Parameters in a named table at the top.
3. Hard gates: gate.js pass:true where meaningful. Silhouette IoU >= 0.85 target; below 0.80 needs a written reason. Visual first.
4. At least two critique rounds per design: look at sbs at 3x, list differences (counts, relative sizes, overlaps), fix, redo. You may Read PNGs.
   Do not report done on a picture you have not looked at.
5. One vertical axis; symmetric where the original is; no gaps between parts that touch in the original (underlay hulls).
6. Make calls and document them; do not ask questions; do not touch files outside your subdirectory except out/ and sbs/ files named after
   your own badges.

## Deliverable (short report)
Per badge: out path, gate pass + IoU, sbs path; a candid list of what still differs and what you omitted (small lettering, texture);
unusable references; shared pieces.
