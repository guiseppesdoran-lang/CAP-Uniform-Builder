# Military badges: AUDIT + REWORK brief (round 3)

Context: Doran (the requester's reviewer) said some of the military badge redraws "look bad and wrong". An overview audit by eye already found
many are weak: wings that are smooth blobs with faint rays (real wings are rows of distinct overlapping feathers), centre emblems replaced by
abstract blobs, the wrong creature or tool, missing parts, hollow stand-ins. You are the deep, per-badge audit and the fix.

Repo: /Users/ethan/UniformBuilder/artwork-samples/assets/military. Read BRIEF2.md first: its flat/outline rules, reference caveats and tool
list still hold (all fills one flat #dfe3ea, outlines #3d4756, engraving #5f6b7d, no gradient/opacity/filter/text/raster, ids unique per file,
construct from measured primitives, never trace/auto-vectorise, curves >= 36 samples, one vertical axis). Skill: ~/.claude/skills/badge-replicator/SKILL.md.

## Where things are
- `<set>/ref/<design>__<variant>.png` references (set = af, af2, army, navy, usmc, uscg).
- `<set>/out-flat/<design>__<variant>.svg` = the CURRENT redraw (what is being criticised). Its generator is in `<set>/g*/` or `af/g1a g1b g2 g3`.
- WRITE YOUR NEW VERSIONS to `<set>/v2/<design>__<variant>.svg` (reference pixel grid as viewBox, same as out-flat). Do NOT edit out/, out-flat/, final/.
- `node gate2.js <set> <name>`  -> hard gates + silhouette IoU of v2/<name>.svg.   `node sbs2.js <set> <name> 3` -> `<set>/v2sbs/<name>.png`
  (reference LEFT, v2 RIGHT, same scale). Use `crop-compare.js` / `grid.js` / `render.js` from the skill for 8x part crops. You may Read PNGs.
- Work in your own scratch dir `<set>/v2work/<yourgroup>/` for generators; keep a generator script per family so variants share one body.

## The audit (do this FIRST, per design, before drawing anything)
For EVERY design in your list (all its variants), look at `ref/<n>.png` and the current out-flat render at 3x and at an 8x crop, then write a
feature inventory row: counted parts (feathers per wing and rows, leaves per branch, stars, rays, bolts, letters), what overlaps what, what
the centre emblem is in words. Then give a verdict:
- KEEP: every part is present with the right count, shape class and placement, and a stranger shown ref and mine would call them the same badge.
- REWORK: anything above fails. Rebuild the badge so that it passes. Typical failures to hunt (found by eye in the overview):
  wing feathers drawn as one smooth sheet instead of separate overlapping feathers with the right row count; wing tips/steps/leading edge
  shape wrong; shield/roundel contents invented or generic; birds drawn as blobs (an eagle has a head, beak, wing feathers, talons; say what
  the reference shows and draw that, or draw the correct simplified form); tools/weapons/aircraft unrecognisable; wrong proportions
  (aspect ratio differs > 3%); wreath leaves count/size inconsistent; plates or rim shapes the reference does not have (e.g. side "ear" tabs
  from rivets, a filled pill behind an open wreath); parts present in the reference but forgotten.
Be harsh. "Plausible" is not KEEP. If the reference is unusable or ambiguous (camouflage, glare, cropped), say so and build from the name and
the sibling variants, marking the call.

## Rebuild rules
1. Family first: levels of one design share one body; draw once, vary only the level device (basic: none; senior: star on post;
   master/chief: wreathed star). AF wreath badges already share `af/g2/make.js`; reuse its wreath body only if the reference wreath matches.
2. Measure: read coordinates from grid crops of the reference, put them in a named parameter table, construct, then compare.
3. At least TWO critique rounds per REWORKed design at 3x and 8x crops (counts, relative sizes, overlaps, silhouette, tiny essential parts).
   Then a cold read: look only at the final sbs and list every visible difference; fix what is material.
4. Gates: `gate2.js` pass:true where meaningful; silhouette IoU target >= 0.85, below 0.80 needs a written reason (camo/photo refs make IoU
   unreliable: say so and rely on sbs). A better IoU that looks worse is a regression: visual first.
5. Never leave a badge worse than the current out-flat version. If your rebuild is not clearly better, do not write a v2 file for it and
   verdict it KEEP (with its known weaknesses listed).
6. Do not touch files outside your group's v2/, v2sbs/, v2work/<group>/ paths.

## Deliverable: write `<set>/v2work/<yourgroup>/REPORT.md` AND return it
One table row per design: design | variants | verdict KEEP/REWORK | what was wrong (specific) | what you changed | IoU old -> new (or n/a) |
remaining differences (honest). Then one short paragraph: what you could not fix and why. List exactly which v2/ files exist.
