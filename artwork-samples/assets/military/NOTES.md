# Military badges (metal/dress), flat single-tone silver redraws

- af/    USAF aviation + space (47)            -> af/final/<id>/, sheet af/ALL_AF_AVIATION.png
- af2/   USAF non-aviation (125)               -> af2/final/, sheet ALL_AF_OTHER.png
- army/  US Army (60)                          -> army/final/, sheet ALL_ARMY.png
- navy/  US Navy (40; SWCC skipped: reference is a photo of a scene) -> navy/final/
- usmc/ (5), uscg/ (4)                         -> usmc/final, uscg/final; sheet ALL_NAVY_USMC_USCG.png
Pipeline per set: ref/ -> workers write out/ (shaded or flat) -> flatten-shadows.js -> out-flat/ -> retrofit-*.js -> final/<id>/{svg,spec.json}.
All fills one flat #dfe3ea; outlines #3d4756, engraving #5f6b7d; no gradient/opacity/filter/text/raster.
Sizes: ESTIMATED from aspect (no service dimension tables in repo). Fit scores unreliable on camouflage/photo references (army, navy).
Not done: embroidered folder (271 cloth variants), SWCC, ICLs newer than 25-06 irrelevant here.
