# Source and Asset Policy

OfficialMilitaryRibbons.com and the USAMM EZ Rack Builder are commercial discovery/reference sources. They may provide names, aliases, candidate relationships, source URLs, and behavior clues. They are not authoritative regulations.

Current official service publications control authorization, precedence, devices, and wear rules. Every verified rule must retain its official URL and date. Conflicts remain visible until resolved against an official source.

The runtime never hotlinks external catalog artwork. The repository owner has approved vendoring the ribbon graphics used by the military catalog. Imported files retain their source URL, checksum, media type, and local path in `data/imports/military_ribbon_assets_manifest.json`; the production runtime uses only the local copy. Reference composites that are not individual ribbon graphics remain outside production assets and are marked `useForProduction: false`.

The raw/import/verified separation is intentional. Re-running an importer may update raw and normalized data, but it must not overwrite manually verified corrections.
