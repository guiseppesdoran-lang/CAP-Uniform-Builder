# Notice

Uniform Builder for CAP members is an unofficial tool. It is not affiliated with or endorsed by
Civil Air Patrol or the U.S. Air Force.

## What the MIT license covers

The license in `LICENSE` covers the source code and documentation written for this project:
`index.html`, `config.js`, `favicon.svg`, the scripts at the top level, and the files in `js/`,
`styles/`, `scripts/`, `tests/`, `deploy/`, `google-apps-script/` and `docs/`.

## What it does not cover

- **Names and marks.** "Civil Air Patrol", "CAP", the U.S. Air Force and other names, and the
  insignia, emblems, badges, patches and uniform designs they refer to, belong to their owners.
  Nothing in this project grants any right to use them.
- **Artwork.** The images in `images/` depict those items. They are not licensed by this project.
  The next section says where they came from.
- **Fonts.** `vendor/fonts/` holds Rajdhani (SIL Open Font License 1.1) and Ubuntu (Ubuntu Font
  Licence 1.0), taken from the typography kit in the CAP Brand Guide. They keep their own licenses.
  The palette in `styles/app.css` follows that guide's colors; the page's interface uses none of
  CAP's logos, seal or wordmark.
- **Compiled data.** `military/military-data.js` (the award and badge catalog),
  `data/unit-options.js` (the unit list) and `purchase-catalog.js` (vendor product links) are
  compiled from public information and are not claimed as original. `military/military-data.js`
  records the web addresses of the regulation pages and the vendor product images its entries were
  compiled from. `purchase-catalog.js` holds product links, item numbers and prices for
  four sellers (Vanguard, Uniforms-4U, Ira Green, and the order form of Hawk Mountain Ranger School
  at capranger.org). A price is either one seen on the vendor's page or a budgeting estimate,
  with the date it was seen or made.
- **Mirrored data.** `mcchord-ribbon-variants.js` holds ribbon option labels, values and ribbon
  counts. Its first line says it is generated from McChord's senior rack builder, and
  `scripts/sync_mcchord_ribbon_variants.py` writes it. It holds no images. It is not original to
  this project.
- **Third-party code.** `vendor/pdfjs/` is pdf.js, under the Apache License 2.0, with its own
  license file.

## Where the artwork comes from

- **Drawn by this project.** Apart from the files named in the next item, the SVG files in
  `images/` were made by this project. Each carries a `data-source` attribute that says how:
  `reference-art-measured` (built by a generator script from measurements of a reference image),
  `reference-art-traced` (traced from a reference image), `regulation` or `original`. A
  `.spec.json` beside most files records the size basis, and many also name the generator and the
  reference. The references are CAP regulation figures, vendor product photographs (for example
  from Vanguard) and public reference images, some from Wikimedia Commons. The specs record that
  the vendor photographs were used for measurement only. The reference images and the generator
  scripts are not in this repository.
- **Official artwork as given.** The 32 unit and activity emblems at `images/patches/<id>/<id>.png`
  are taken as given. Each spec records `official-digital-artwork-as-given` and names the CAP Brand
  Tools repository (the CAP subordinate graphic generator) as the source. They were trimmed to
  their transparent edge, with no resampling and no color change. Three were lossless WebP files
  converted to PNG. `images/insignia/insignia-cap-seal.svg` is the official CAP seal vector, taken
  path for path and scaled, with no tracing or redrawing. Its spec names the Wikimedia Commons file
  it came from.
- **No other raster files.** A build publishes no PNG, JPG, WebP or GIF under `images/` except the
  emblems above (`tests/no-raster.test.cjs`).

Anyone who reuses the code needs their own permission for the artwork and the names.
