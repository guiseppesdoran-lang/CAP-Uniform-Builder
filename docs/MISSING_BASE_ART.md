# Missing base uniform art

Generated 2026-10-08 by asking the running app for the base-image candidates of
every membership x rank x cut x uniform combination (638 combinations, 117
distinct files) and checking each against `images/` with `.webp`, `.png`, `.jpg`
and `.jpeg`.

**47 rank-specific base images are requested but do not exist.** The combination
still renders - it falls back to the generic jacket for that uniform - but with no
rank insignia on it. Adding the files below (WebP, same canvas as their siblings)
removes the fallback and the extra 404 requests.

## Senior member, Class B shirt

`images/base/<rank>_blues_class_b_<cut>`

- Female: `1st_lt`, `2d_lt`, `brig_gen`, `capt`, `cmsgt`, `col`, `lt_col`, `maj`,
  `maj_gen`, `msgt`, `smsgt`, `ssgt`, `tsgt`
- Male: `1st_lt`, `2d_lt`, `brig_gen`, `capt`, `col`, `maj`, `maj_gen`

## Senior member, Class A jacket (female)

`images/base/CAP_female_<rank>`: `2d_lt`, `brig_gen`, `lt_col`, `maj_gen`

## Cadet, Class A jacket (female)

`images/base/blues_class_a_female_c_<grade>`: `1st_lt`, `2d_lt`, `ab`, `capt`,
`col`, `lt_col`, `maj`

## Cadet, Class B shirt

`images/base/blues_class_b_<cut>_c_<grade>`

- Female: `1st_lt`, `2d_lt`, `ab`, `capt`, `col`, `lt_col`, `maj`, `sra`, `ssgt`, `tsgt`
- Male: `1st_lt`, `ab`, `capt`, `col`, `lt_col`, `maj`

## Regenerating this list

Load the app, then in the browser console loop over `RANKS`, `UNIFORMS` and both
cuts, set `State.membership/rank/gender/uniform`, call `getBaseCandidates()`, and
`HEAD`-request each candidate with the four extensions. The app's own "Download
Missing Asset List" button covers other asset categories.
