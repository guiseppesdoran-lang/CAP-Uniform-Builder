# Military Builder Architecture

## Existing CAP path

`index.html` remains the CAP application and source of truth for CAP uniforms. Its existing state, member-report parser, CAP ribbon precedence, CAP device expansion, badge/patch placement, calibration, PNG export, and male/female base selection are preserved. Selecting `CAP` routes rendering through that unchanged path.

## Military modules

- `military/military-core.js` contains organization normalization, service authorization, service-aware precedence, canonical merging, validation, and algorithmic device calculation. It has no DOM dependency and is tested in Node.
- `military/military-device-layout.js` contains independent normalized placement contexts for ribbon bars, miniature-medal suspension ribbons, and full-size-medal suspension ribbons. Award/service overrides can replace any slot table without changing CAP geometry.
- `military/military-data.js` is generated browser data. Do not edit it by hand.
- `data/import/raw/` preserves source material.
- `data/import/normalized/military-awards.json` is the generated canonical catalog.
- `data/rules/verified/` contains human-reviewed corrections. These files win over imported data.
- `data/imports/` contains machine-readable manifests.
- `reports/` contains human- and machine-readable audits.

The service selector keeps CAP and military selections in separate state. All federal military ribbons are selectable for every military branch, CAP awards remain isolated to CAP, and the rack is sorted by the selected service table. The military preview uses local assets only. A hatched tile means the record exists but its expected repository asset is missing.

## Canonical award and representation state

The selection is the award, not an image:

```json
{
  "awardId": "bronze_star_medal",
  "quantity": 3,
  "specialDevices": ["V_DEVICE"]
}
```

`normalizeRepresentations()` exposes `ribbon`, `miniatureMedal`, and `fullSizeMedal` independently. Switching the preview representation never changes award quantity or devices. A ribbon-only award remains ribbon-only. Reviewed medal mappings live in `data/rules/verified/representation-overrides.json`; absence is rendered as a clear missing-representation notice, never a generic pendant.

## Device validation and composition

Normal mode calls `calculateDevices()` only with explicit award/service rules. The category-based convention engine is disabled unless **Manual / unverified configuration** is enabled. Quantity is the actual number of awards; repeat devices represent `quantity - 1`, including silver-for-five conversion when an explicit rule requires it. M, hourglass, numeral, V/C/R, Arrowhead, star, and oak-leaf artwork is local, transparent raster artwork generated deterministically by `scripts/build_military_device_assets.py` and flagged for visual review independently of rule verification.

The browser creates one flattened PNG per deterministic award/device key and caches the promise. It does not create a DOM layer per device and does not pre-render thousands of award combinations. Ribbon output is 100 × 30. Medal output uses its own normalized canvas and suspension-device coordinates. The same flattened image is consumed by preview/export capture.

## Selector persistence fix

The collapse was caused by `buildRibbonGallery()` clearing `innerHTML`, followed by the modal cloning the rebuilt sidebar after every internal `change`. That destroyed the live `<details>` nodes and therefore their `open` state, scroll position, and focus. It was not an outside-click propagation problem.

Award state and `militaryUIState` are now separate. Before an unavoidable rebuild, the builder captures open section IDs, modal/sidebar/catalog scroll positions, search, filters, and focused control; it restores them after rebuilding. The standalone military catalog updates checkbox/count rows without reconstructing the list. The overlay closes only through its close button, Escape, or a click whose target is the overlay itself.

## Provenance states

- `DISCOVERED`: commercial catalog/reference only.
- `CROSS_REFERENCED`: a specific fact was matched to an official source, but not every property of the award is verified.
- `OFFICIALLY_VERIFIED`: the modeled rule itself was checked against the cited current publication.
- `CONFLICT`: sources disagree; no automatic winner except an official publication.
- `UNVERIFIED` / `PENDING`: not yet checked.

Commercial sources never become regulatory authority. Approved ribbon graphics are vendored into the repository with source metadata and checksums; source-service metadata remains separate from wear authorization and official precedence verification.

## Commands

```powershell
npm run import:military-catalog
npm run import:usamm-reference
npm run reconcile:military-sources
npm run audit:military-data
npm run build:military-browser-data
npm run apply:military-overrides
npm run build:military-device-assets
npm run audit:military-combinations
npm run audit:mcchord-assets
npm run check:inline-syntax
npm run smoke:military-ui
npm test
```

The OfficialMilitaryRibbons importer reuses saved raw pages by default. Use `-- --refresh` only when a fresh, rate-limited crawl is intended.

## Add an award manually

1. Add the correction under `awards` in `data/rules/verified/manual-overrides.json`, keyed by canonical ID.
2. Include official name, authorized services, local image path if approved, and source provenance.
3. If the award was not discovered at all, add a complete normalized record through a future `manual-additions.json` entry rather than editing generated browser data.
4. Run import, audit, browser-data build, and tests.

## Add a device

1. Add its metadata to `data/rules/verified/device-definitions.json`; artwork availability and regulatory verification are separate fields.
2. Add a transparent local raster source under `images/devices/military/`. Never use Unicode, emoji, or a live CSS/browser glyph.
3. Add physical display geometry to `deviceMeta` and, if necessary, a device/award/service override in `military-device-layout.js` or the award rule.
4. Add the device only to the exact award/service/representation rules supported by an official citation. Unknown rules remain unavailable in normal mode.
5. Run the combination audit, contact-sheet generator, browser smoke test, and full test suite.

## Add a McChord-style ribbon

1. Preserve the award's official stripe count, order, widths, and colors.
2. Match the measured geometry/alpha/texture ranges in `docs/MCCHORD_ASSET_STANDARD.md`.
3. Store the local base under `images/military-ribbons/`, add source/checksum metadata, and map it to the canonical award's `ribbon` representation.
4. Regenerate `reports/mcchord-ribbon-comparison.png` and review at identical scale before changing asset status from pending.

## Add a McChord-style miniature medal

1. Obtain or reconstruct the correct award pendant and suspension-ribbon design; never attach a generic circle to a ribbon bar.
2. Match the McChord canvas, padding, fabric, pendant, lighting, shadow, and alpha measurements in `docs/MCCHORD_ASSET_STANDARD.md`.
3. Add a reviewed mapping in `data/rules/verified/representation-overrides.json` with provenance.
4. Configure representation-specific authorized devices and placement. Ribbon coordinates are not valid miniature-medal coordinates.
5. Rebuild browser data and regenerate both miniature-medal QA sheets before marking the mapping reviewed.

## Add a verified precedence rule

1. Add the canonical award ID in order under the correct service in `data/rules/verified/service-precedence.json`.
2. Cite the exact official source URL and access/publication date.
3. Run import, audit, browser-data build, and tests.
4. Do not use a commercial chart as the verified source.

## Current progressive boundary

The military ribbon catalog, cross-service selection, sorting, quantity/device engine, persistent selector UI, representation-aware state, local raster compositor, source policy, and audit pipeline are integrated. The audit currently proves that military miniature/full-size medal mappings and most award-specific device rules remain incomplete; the UI exposes those gaps rather than hotlinking or fabricating them.
