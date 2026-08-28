# Military Asset Style Standard

The builder uses the existing McChord CAP ribbon artwork as its production visual reference. Regulatory data and artwork provenance remain separate: a regulation establishes authorization and order of precedence, while an approved local asset establishes what the builder may render.

## General rules

- Production rendering uses local repository assets only. Remote URLs are discovery metadata, never runtime dependencies.
- Do not substitute generic ribbons, pendants, badges, or devices for missing art.
- Preserve source artwork proportions. Do not stretch an asset independently by width or height.
- Transparent padding must be removed or normalized before dimensions are compared.
- Every production asset must have a manifest entry, file hash, representation type, and review status.
- Preview and exported PNG output must use the same flattened artwork.

## Ribbons

- Imported pattern references may use `207 × 56` or other source canvases; the production ribbon face uses the measured McChord `100 × 30` canvas.
- Production military ribbon assets are normalized to the builder's measured McChord `100 × 30` canvas by `scripts/build_mcchord_style_military_ribbons.py`. The deterministic generator retains each source award's stripe pattern and transfers only the common high-frequency weave, edge shading, lighting, and geometry measured from the local McChord masters.
- Original discovery artwork remains provenance; production mappings are recorded separately in `data/rules/verified/ribbon-style-overrides.json`, including the source path and source hash.
- Device combinations are deterministic flattened variants or deterministic local compositions from reviewed device sprites.
- Device rules are representation- and service-specific. A ribbon device rule must not be assumed to apply to a medal suspension ribbon.

## Medals

- Miniature and full-size medals are separate representations of one canonical award selection.
- Medal art must include the award-specific suspension ribbon and pendant. A ribbon image must never stand in for a medal.
- A missing reviewed representation is reported as `MISSING_ASSET`; it is not fabricated.

## Badges

- Badges require their own catalog, family, service authorization, precedence, quantity, uniform-placement, and representation records.
- Metallic and subdued/embroidered versions are separate representations.
- Visible background rectangles, accidental white mattes, and mismatched border colors are prohibited.

## Status meanings

- `AVAILABLE`: reviewed local asset exists and may render normally.
- `NOT_APPLICABLE`: the award or badge has no such representation.
- `MISSING_ASSET`: the representation should exist but no approved local asset is present.
- `UNVERIFIED`: candidate art exists but has not passed source/style review and must not render in normal mode.

The older [McChord asset analysis](MCCHORD_ASSET_STANDARD.md) contains the measured CAP reference-set details used to establish this standard.
