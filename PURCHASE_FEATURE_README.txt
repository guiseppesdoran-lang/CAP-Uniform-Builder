CAP Uniform Builder — Purchase List & Cost Feature
Catalog version: 2026.08.07.1

FILES
- purchase-catalog.js: Vendor/product/price database and uniform base-item recipes.
- purchase-feature.js: Builds a shopping list from the current Uniform Builder State.
- index.html: Loads the two files. The purchase feature does not replace the existing renderer.

HOW TO USE
1. Open index.html normally.
2. Build the uniform as usual.
3. In Output, click "Purchase List & Cost".
4. Use the "Use" checkbox to include/exclude optional items.
5. Use the "Own" checkbox for items already owned. The remaining-cost total updates automatically.
6. Open vendor links or click "Copy shopping list".

SOURCING LOGIC
CAP_ONLY
  CAP-specific item. Do not substitute a visually similar USAF/military item simply because it looks similar.
  The feature defaults these items to Vanguard/CAP-specific searches.

MILSPEC_OK
  Standard military-spec garment/component where the same USAF/military-spec component may be used when authorized.
  Vanguard, Uniforms-4U, and/or Ira Green may be listed.

GENERIC_SPEC
  Generic item that still must meet the exact color/material/style requirements.

VERIFY
  The exact authorized item depends on grade, uniform, or configuration. The feature links to a targeted search but deliberately does not guess a price.

PRICE BEHAVIOR
- Verified price: observed on the listed vendor page when the catalog was prepared.
- Estimate: budgeting value; recheck before purchase.
- Check price: deliberately left unpriced rather than inventing a value.
- Shipping, tax, tailoring, and optional alternates are not included.

UPDATING THE DATABASE
Edit purchase-catalog.js. Price and link data is intentionally separate from index.html so future price updates do not risk the uniform rendering/placement code.
