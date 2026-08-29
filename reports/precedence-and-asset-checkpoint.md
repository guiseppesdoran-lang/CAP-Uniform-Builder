# Military precedence and asset checkpoint

Generated 2026-08-29 while auditing the military catalog expansion.

## Current coverage

- 176 canonical military awards.
- 175 reviewed local ribbon assets; one ribbon asset remains missing.
- 2 reviewed miniature-medal assets; 173 are missing and the Medal of Honor is intentionally not applicable as a miniature.
- 0 reviewed full-size medal assets; 176 are missing.
- 132 badge families, 256 explicit variants, and 312 total badge configurations.
- 44 reviewed badge-variant assets, one not-applicable variant, and 178 missing badge-variant assets.
- 142 awards have at least one verified service precedence record.
- 26 awards have an explicit device rule; 150 still require award-specific device verification.

These numbers come from `scripts/build-military-complete-audit.cjs` and
`scripts/build-military-award-audit.cjs`. They are regenerated in the other
reports in this directory.

## Precedence sources checked

- Army Institute of Heraldry ribbon order:
  https://tioh.army.mil/Catalog/PageFlow.aspx?CategoryId=5&grp=4&menu=Decorations+and+Medals
- Navy Uniform Regulations, chapter 5, articles 5304 through 5309:
  https://www.mynavyhr.navy.mil/References/US-Navy-Uniforms/Uniform-Regulations/Chapter-5/5301-Awards/
- Marine Corps Uniform Regulations, MCO 1020.34H, paragraph 5102:
  https://www.marines.mil/Portals/1/Publications/MCO%201020.34H%20v2.pdf#page=123
- Department of the Air Force decorations and ribbons precedence chart:
  https://www.afpc.af.mil/Portals/70/documents/RECOGNITION/Decorations%20and%20Ribbons.pdf

The Medal of Honor remains first in every service-aware sort. Shared awards
are canonicalized into one selection, while the selected wearer's service
table controls relative precedence.

## Verified gaps queued for correction

- The Army table does not yet include the complete historical campaign block
  shown by the Institute of Heraldry between the Navy Expeditionary Medal and
  American Defense Service Medal.
- The Navy table is missing records explicitly listed by article 5308,
  including the Selected Marine Corps Reserve Medal, Inherent Resolve Campaign
  Medal, and several Merchant Marine awards.
- A dedicated verified Coast Guard precedence table is not yet present; Coast
  Guard sorting currently relies on award records and deterministic fallback
  categories.
- `air_and_space_campaign`, `coast_guard_medal_of_honor`,
  `army_occupation_of_germany`, and `china_relief_expedition` still require
  catalog cleanup or explicit precedence mapping.

## Asset policy for the next batches

Vanguard product pages are used for catalog discovery and physical-reference
cross-checking. Official service publications remain authoritative for
authorization, precedence, devices, and placement. Production artwork is
stored locally and normalized into the builder's clean McChord-style digital
rendering; product photography is not used directly at runtime.
