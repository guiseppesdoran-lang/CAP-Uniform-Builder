# Military Builder Architecture

## Existing CAP path

`index.html` remains the CAP application and source of truth for CAP uniforms. Its existing state, member-report parser, CAP ribbon precedence, CAP device expansion, badge/patch placement, calibration, PNG export, and male/female base selection are preserved. Selecting `CAP` routes rendering through that unchanged path.

## Military modules

- `military/military-core.js` contains organization normalization, service authorization, service-aware precedence, canonical merging, validation, and algorithmic device calculation. It has no DOM dependency and is tested in Node.
- `military/military-data.js` is generated browser data. Do not edit it by hand.
- `data/import/raw/` preserves source material.
- `data/import/normalized/military-awards.json` is the generated canonical catalog.
- `data/rules/verified/` contains human-reviewed corrections. These files win over imported data.
- `data/imports/` contains machine-readable manifests.
- `reports/` contains human- and machine-readable audits.

The service selector keeps CAP and military selections in separate state. Military awards are filtered by service/component and sorted by the selected service table. The military preview uses local assets only. A hatched tile is deliberate: it means the record exists but no production-safe local graphic has been supplied.

## Provenance states

- `DISCOVERED`: commercial catalog/reference only.
- `CROSS_REFERENCED`: a specific fact was matched to an official source, but not every property of the award is verified.
- `OFFICIALLY_VERIFIED`: the modeled rule itself was checked against the cited current publication.
- `CONFLICT`: sources disagree; no automatic winner except an official publication.
- `UNVERIFIED` / `PENDING`: not yet checked.

Commercial sources never become regulatory authority. External graphics are `SOURCE_ONLY` unless reuse rights are established or a separately supplied local asset is approved.

## Commands

```powershell
npm run import:military-catalog
npm run import:usamm-reference
npm run reconcile:military-sources
npm run audit:military-data
npm run build:military-browser-data
npm test
```

The OfficialMilitaryRibbons importer reuses saved raw pages by default. Use `-- --refresh` only when a fresh, rate-limited crawl is intended.

## Add an award manually

1. Add the correction under `awards` in `data/rules/verified/manual-overrides.json`, keyed by canonical ID.
2. Include official name, authorized services, local image path if approved, and source provenance.
3. If the award was not discovered at all, add a complete normalized record through a future `manual-additions.json` entry rather than editing generated browser data.
4. Run import, audit, browser-data build, and tests.

## Add a verified precedence rule

1. Add the canonical award ID in order under the correct service in `data/rules/verified/service-precedence.json`.
2. Cite the exact official source URL and access/publication date.
3. Run import, audit, browser-data build, and tests.
4. Do not use a commercial chart as the verified source.

## Current progressive boundary

The military rack catalog, filtering, sorting, count input, local-asset rendering, provenance, and device calculation foundation are integrated. Full uniform/base-art selection, all badge/rank placement rules, and a complete production-safe military artwork library remain later stages. The UI explicitly exposes missing assets instead of hotlinking them.
