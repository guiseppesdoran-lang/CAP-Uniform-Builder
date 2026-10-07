# Uniform render audit — 2026-10-07

## Coverage

- 458 CAP membership/cut/authorized-uniform/rank cases in Chromium.
- 2,506 individual option cases: eligible CAP badges, authorized patches, and basic/maximum award selection across representative ranks and both cuts.
- Zero page errors, broken base images, or broken rendered option images.
- 136 automated tests passed; military browser smoke checks passed.
- Targeted browser assertions verify regulation sources, independent grade/name layers, suppression of awards on applicable corporate/utility garments, and working PNG exports.
- Reviewed rendered Class A, Class B, OCP, Corporate Field, Flight Suit, Polo, Blazer and Corporate Semi-Formal samples for both cuts.

This covers every current base/rank/cut combination and individual eligible options. It does not enumerate the exponential product of award quantities, devices, badges, patches and saved calibrations. Image-load checks alone do not establish regulatory compliance.

## Artwork and placement fixes

- Replaced substitute white shirts with actual CAPR 39-1 figures: Corporate Service Dress 4.14/4.15, Corporate Field 5.4, Corporate Working 5.5 and Flight Duty 8.1.
- Corporate Semi-Formal now uses figures 4.12/4.13, including the correct female garment.
- Extracted original rasters are embedded unchanged in SVG. Local fabric masks cover baked decorations; no generated garment replacements are shipped. Source figures and page/figure provenance are checked in with a reproducible builder.
- Cleanup masks on utility figures are clipped to the source silhouette to avoid painting beyond sleeves. Pockets, seams, buttons, belt, zipper and scarf remain part of the original figures.
- CAP crest, flight command patch and flag are separate layers extracted from the regulation. Polo seal and personalized names render separately.
- Selected grades render independently on neutral service-shirt/coat artwork and the shared illustrated OCP base. This removes dependency on missing grade-specific garment files and relocates floating shoulder boards to the actual shoulders.
- Corrected female Class B shoulder-board height, Class A lapel lettering and cadet collar-layer ordering.
- New regulation sources do not inherit unrelated white-shirt collar masks or aviator base fitting. Existing service-coat masks remain available.
- Corporate field tapes, cloth badges and sleeve patches use garment-specific anchors. Flight wings sit inside the name patch; polo supports one optional badge. Blazer badge options are restricted to chaplain insignia.
- Corporate Semi-Formal uses CAP miniature medals with source-specific placement. Aviator and Corporate Semi-Formal racks exclude military awards.
- Blazer, Corporate Field, Flight Suit and Polo suppress ribbon/medal layers, including forced miniature mode. Existing selections remain available when switching to appropriate uniforms.
- Removed the unverified Aerospace Education placeholder from patch menus; legacy saved selections retain an explicit missing-artwork notice.

## Earlier recovery fixes retained

- Exhausted global image retries resume the renderer's original recovery callback.
- Base-load completion refreshes validation.
- Bulk military-ribbon selection skips records without available representation artwork.
- Legacy Communications patch resolves to its existing image.
- Shared OCP sleeve sprite geometry and officer tape-clearance defaults apply to both cuts.

## Availability limits

Official military badge records without approved local artwork, including some Space Force entries, remain explicit unavailable records. No replacement insignia was fabricated. Utility garments share the single relevant regulation figure across cuts where that figure is shared. Saved custom calibration can change the reviewed default positions.

Sources: [current CAPR 39-1 PDF](https://www.gocivilairpatrol.com/media/cms/CAPR_391_90e08bf91538b.pdf), [CAP publications and interim changes](https://www.gocivilairpatrol.com/members/publications/indexes-regulations-and-manuals-1700). Figure provenance: `data/regulation-uniform-bases.json`.
