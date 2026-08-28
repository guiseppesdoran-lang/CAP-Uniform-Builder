# Source and Asset Policy

OfficialMilitaryRibbons.com, the USAMM EZ Rack Builder, Medals of America, and UltraThin are commercial discovery/reference sources. They may provide names, aliases, candidate relationships, source URLs, product availability, and behavior clues. They are not authoritative regulations.

Current official service publications control authorization, precedence, devices, and wear rules. Every verified rule must retain its official URL and date. Conflicts remain visible until resolved against an official source.

The runtime never hotlinks external catalog artwork. The repository owner has approved vendoring the ribbon graphics used by the military catalog. Imported files retain their source URL, checksum, media type, and local path in `data/imports/military_ribbon_assets_manifest.json`; the production runtime uses only the local copy. Reference composites that are not individual ribbon graphics remain outside production assets and are marked `useForProduction: false`.

The raw/import/verified separation is intentional. Re-running an importer may update raw and normalized data, but it must not overwrite manually verified corrections.

## Commercial discovery findings (2026-08-27)

- Medals of America exposes separate ribbon, miniature-medal, full-size-medal, branch, and attachment product groupings through its public builders. Interactive state is JavaScript driven and is useful for candidate names and representations, not wear authorization.
- UltraThin's legacy order form exposes award choices and separate attachment/device counts in HTML form state. Its own order materials warn that catalog numbers are not necessarily precedence numbers, so the importer never treats ordering as authoritative.
- Production has no dependency on either site. `data/imports/commercial_award_discovery_manifest.json` records the inspected entry points and any extractor limitations.
- Official rules currently cited by verified overrides include DAFMAN 36-2806, Army HRC award guidance/AR 600-8-22 references, MyNavyHR Uniform Regulations chapter 5, and the Coast Guard Medals and Awards policy page. Each award-specific override must retain its precise official source.
