#!/usr/bin/env python3
"""Measure the repository's McChord masters and generate visual QA sheets.

This script does not alter source artwork. It records geometry/color/alpha
characteristics and places repository assets at identical display scale so a
reviewer can spot incompatible padding, texture, sharpness, and lighting.
"""

from __future__ import annotations

import json
import math
import re
import shutil
import statistics
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageStat

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
DOCS = ROOT / "docs"
RIBBON_DIR = ROOT / "images" / "ribbons"
MINI_DIR = ROOT / "images" / "mini_medals" / "mcchord"
MILITARY_DIR = ROOT / "images" / "military-ribbons"


def image_paths(folder: Path):
    return sorted(p for p in folder.rglob("*") if p.suffix.lower() in {".png", ".webp", ".jpg", ".jpeg"})


def alpha_bbox(image: Image.Image):
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    return alpha.getbbox(), ImageStat.Stat(alpha).mean[0] / 255.0


def metrics(path: Path):
    with Image.open(path) as source:
        image = source.convert("RGBA")
        bbox, alpha_coverage = alpha_bbox(image)
        rgb = Image.new("RGB", image.size, "white")
        rgb.paste(image, mask=image.getchannel("A"))
        gray = rgb.convert("L")
        edges = gray.filter(ImageFilter.FIND_EDGES)
        hsv = rgb.convert("HSV")
        return {
            "path": path.relative_to(ROOT).as_posix(),
            "format": source.format,
            "width": image.width,
            "height": image.height,
            "aspectRatio": round(image.width / image.height, 4),
            "mode": source.mode,
            "alphaCoverage": round(alpha_coverage, 4),
            "contentBounds": list(bbox) if bbox else None,
            "meanSaturation": round(ImageStat.Stat(hsv.getchannel("S")).mean[0], 2),
            "lumaContrast": round(ImageStat.Stat(gray).stddev[0], 2),
            "edgeEnergy": round(ImageStat.Stat(edges).mean[0], 2),
        }


def summarize(records):
    dimensions = Counter((r["width"], r["height"]) for r in records)
    numeric = ("aspectRatio", "alphaCoverage", "meanSaturation", "lumaContrast", "edgeEnergy")
    summary = {
        "count": len(records),
        "commonDimensions": [
            {"width": w, "height": h, "count": count}
            for (w, h), count in dimensions.most_common(12)
        ],
    }
    for key in numeric:
        values = [r[key] for r in records]
        summary[key] = {
            "min": min(values) if values else None,
            "median": round(statistics.median(values), 4) if values else None,
            "max": max(values) if values else None,
        }
    return summary


def contain(image: Image.Image, size):
    copy = image.convert("RGBA")
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (255, 255, 255, 0))
    canvas.alpha_composite(copy, ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2))
    return canvas


def sheet(title, groups, output: Path, cell=(180, 120), columns=4):
    label_height = 42
    group_title_height = 40
    rows = sum(math.ceil(max(1, len(items)) / columns) for _, items in groups)
    height = 70 + rows * (cell[1] + label_height) + len(groups) * group_title_height + 20
    width = columns * cell[0] + 40
    out = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(out)
    draw.text((20, 18), title, fill="#111827", font=ImageFont.load_default(size=20))
    y = 62
    for group_name, items in groups:
        draw.rectangle((10, y, width - 10, y + 30), fill="#e5e7eb")
        draw.text((20, y + 8), group_name, fill="#111827", font=ImageFont.load_default(size=14))
        y += group_title_height
        if not items:
            draw.text((20, y + 20), "No reviewed local assets are mapped in this category.", fill="#991b1b")
            y += cell[1] + label_height
            continue
        for index, path in enumerate(items):
            col = index % columns
            row = index // columns
            x = 20 + col * cell[0]
            top = y + row * (cell[1] + label_height)
            with Image.open(path) as source:
                art = contain(source, (cell[0] - 28, cell[1] - 18))
            checker = Image.new("RGB", art.size, "#f3f4f6")
            checker.paste("#d1d5db", (0, 0, art.width // 2, art.height // 2))
            checker.paste("#d1d5db", (art.width // 2, art.height // 2, art.width, art.height))
            checker.paste(art, mask=art.getchannel("A"))
            out.paste(checker, (x + 10, top + 4))
            label = path.name[:26]
            draw.text((x + 8, top + cell[1] + 4), label, fill="#374151")
        y += math.ceil(len(items) / columns) * (cell[1] + label_height)
    output.parent.mkdir(parents=True, exist_ok=True)
    out.save(output)


def main():
    REPORTS.mkdir(parents=True, exist_ok=True)
    DOCS.mkdir(parents=True, exist_ok=True)
    variant_text = (ROOT / "mcchord-ribbon-variants.js").read_text(encoding="utf-8")
    variant_names = list(dict.fromkeys(re.findall(r'"image":\s*"([^"]+)"', variant_text)))
    ribbon_paths = [RIBBON_DIR / name for name in variant_names if (RIBBON_DIR / name).exists()]
    mini_paths = image_paths(MINI_DIR)
    military_paths = image_paths(MILITARY_DIR)
    styled_military_paths = image_paths(MILITARY_DIR / "mcchord-style")
    representation_file = ROOT / "data" / "rules" / "verified" / "representation-overrides.json"
    representation_data = json.loads(representation_file.read_text(encoding="utf-8"))
    badge_catalog = json.loads((ROOT / "data" / "military" / "badges.json").read_text(encoding="utf-8"))
    reviewed_military_minis = []
    reviewed_military_full_size = []
    for award_id, representations in representation_data.get("awards", {}).items():
        miniature = representations.get("miniatureMedal", {})
        asset = miniature.get("asset") if miniature.get("available") else None
        asset_path = ROOT / asset if asset else None
        if asset_path and asset_path.exists() and asset_path not in reviewed_military_minis:
            reviewed_military_minis.append(asset_path)
        full_size = representations.get("fullSizeMedal", {})
        full_asset = full_size.get("asset") if full_size.get("available") else None
        full_path = ROOT / full_asset if full_asset else None
        if full_path and full_path.exists() and full_path not in reviewed_military_full_size:
            reviewed_military_full_size.append(full_path)
    reviewed_military_badges = []
    for badge in badge_catalog.get("badges", []):
        metal = badge.get("representations", {}).get("metal", {})
        candidates = [metal, *metal.get("variants", {}).values()]
        for representation in candidates:
            asset = representation.get("asset") if representation.get("available") else None
            asset_path = ROOT / asset if asset else None
            if asset_path and asset_path.exists() and asset_path not in reviewed_military_badges:
                reviewed_military_badges.append(asset_path)

    ribbon_records = [metrics(path) for path in ribbon_paths]
    mini_records = [metrics(path) for path in mini_paths]
    military_records = [metrics(path) for path in military_paths]
    styled_military_records = [metrics(path) for path in styled_military_paths]
    report = {
        "generated": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "mcchordRibbons": summarize(ribbon_records),
        "mcchordMiniatureMedals": summarize(mini_records),
        "importedMilitaryRibbons": summarize(military_records),
        "mcchordStyleMilitaryRibbons": summarize(styled_military_records),
        "records": {
            "mcchordRibbons": ribbon_records,
            "mcchordMiniatureMedals": mini_records,
            "importedMilitaryRibbons": military_records,
            "mcchordStyleMilitaryRibbons": styled_military_records,
        },
    }
    (REPORTS / "mcchord-asset-analysis.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    ribbon_summary = report["mcchordRibbons"]
    mini_summary = report["mcchordMiniatureMedals"]
    documentation = f"""# McChord Asset Standard

Generated from the unmodified local McChord master assets by `scripts/analyze_mcchord_assets.py`.

## Scope and provenance

- Ribbon masters are the {len(ribbon_paths)} unique image files referenced by `mcchord-ribbon-variants.js` and present in `images/ribbons/`.
- Miniature-medal masters are the {len(mini_paths)} local files in `images/mini_medals/mcchord/`.
- The script measures geometry, alpha coverage, saturation, luminance contrast, and edge energy without modifying source artwork.
- Commercial product images are **not** master artwork and are never used at runtime.

## Ribbon baseline

- Most common dimensions: `{ribbon_summary['commonDimensions'][:6]}`
- Median aspect ratio: {ribbon_summary['aspectRatio']['median']}
- Median alpha coverage: {ribbon_summary['alphaCoverage']['median']}
- Median saturation: {ribbon_summary['meanSaturation']['median']}
- Median luminance contrast: {ribbon_summary['lumaContrast']['median']}
- Median edge energy (sharpness proxy): {ribbon_summary['edgeEnergy']['median']}

Builder display geometry is normalized to a 100 × 30 pixel ribbon tile (the physical 1⅜ × ⅜ ratio is preserved by rack geometry). Newly composited output must retain the base stripe widths and ordering, then apply the same subtle vertical fabric modulation, edge shading, and highlight direction used by the current runtime compositor. Device artwork must be transparent, metallic, and rasterized into the same final 100 × 30 output; no separate browser glyph layer is acceptable.

## Miniature-medal baseline

- Most common dimensions: `{mini_summary['commonDimensions'][:8]}`
- Median aspect ratio: {mini_summary['aspectRatio']['median']}
- Median alpha coverage: {mini_summary['alphaCoverage']['median']}
- Median saturation: {mini_summary['meanSaturation']['median']}
- Median luminance contrast: {mini_summary['lumaContrast']['median']}
- Median edge energy (sharpness proxy): {mini_summary['edgeEnergy']['median']}

Miniature medals are not ribbon bars with generic pendants. Every reviewed mapping must retain its actual suspension-ribbon geometry and award pendant. Device placement uses a dedicated `miniatureMedal` context and may not reuse ribbon-bar coordinates.

## Acceptance gates

1. Asset dimensions and content bounds must fall within the measured family or carry a documented exception.
2. Transparent padding and pendant/suspension bounds must be reviewed visually on the contact sheet.
3. A military medal is unavailable until a canonical award has a reviewed local mapping in `data/rules/verified/representation-overrides.json`.
4. Inferred device rules remain hidden from normal mode; only official-source overrides may enable a combination there.
5. Preview and PNG export must consume the same flattened representation.

The complete per-file measurements are in `reports/mcchord-asset-analysis.json`.
"""
    (DOCS / "MCCHORD_ASSET_STANDARD.md").write_text(documentation, encoding="utf-8")

    sheet(
        "McChord ribbon visual comparison",
        [("Original McChord masters", ribbon_paths[:12]), ("Generated McChord-style military ribbons", styled_military_paths[:12])],
        REPORTS / "mcchord-ribbon-comparison.png",
        cell=(180, 85),
    )
    shutil.copyfile(REPORTS / "mcchord-ribbon-comparison.png", REPORTS / "military-ribbon-style-review.png")
    sheet(
        "McChord miniature-medal visual comparison",
        [
            ("Original McChord masters", mini_paths[:12]),
            ("Reviewed military mappings to McChord masters", reviewed_military_minis),
        ],
        REPORTS / "mcchord-mini-medal-comparison.png",
        cell=(180, 180),
    )
    shutil.copyfile(REPORTS / "mcchord-mini-medal-comparison.png", REPORTS / "military-mini-medal-style-review.png")
    sheet(
        "Military full-size medal style review",
        [("Reviewed full-size military medal assets", reviewed_military_full_size)],
        REPORTS / "military-full-size-medal-style-review.png",
        cell=(180, 180),
    )
    sheet(
        "Military badge style review",
        [("Approved local military badge assets", reviewed_military_badges[:36])],
        REPORTS / "military-badge-style-review.png",
        cell=(180, 180),
    )
    navy_badges = [path for path in reviewed_military_badges if "military-badges/navy/" in path.relative_to(ROOT).as_posix()]
    sheet(
        "Navy badge import review",
        [("High-confidence licensed copies of officially documented insignia", navy_badges)],
        REPORTS / "navy-badge-style-review.png",
        cell=(180, 180),
    )
    marine_badges = [path for path in reviewed_military_badges if "military-badges/marine-corps/" in path.relative_to(ROOT).as_posix()]
    sheet(
        "Marine Corps badge import review",
        [("High-confidence licensed copies of officially documented insignia", marine_badges)],
        REPORTS / "marine-corps-badge-style-review.png",
        cell=(180, 180),
    )
    # Existing McChord variants are purpose-built combination references. These
    # sheets intentionally do not fabricate unsupported military combinations.
    device_variants = [RIBBON_DIR / name for name in variant_names if any(token in name.lower() for token in ("02", "03", "04", "05", "06")) and (RIBBON_DIR / name).exists()][:20]
    sheet(
        "Ribbon device-combination QA references",
        [("Purpose-built McChord combination variants", device_variants)],
        REPORTS / "military-ribbon-device-contact-sheet.png",
        cell=(180, 85),
    )
    mini_variants = [path for path in mini_paths if re.search(r'(?:0[2-6]|sb|\d[bs])', path.stem.lower())][:20]
    sheet(
        "Miniature-medal device-combination QA references",
        [("Purpose-built McChord miniature variants", mini_variants)],
        REPORTS / "military-mini-medal-device-contact-sheet.png",
        cell=(180, 180),
    )
    print(json.dumps({
        "mcchordRibbons": len(ribbon_paths),
        "mcchordMiniatureMedals": len(mini_paths),
        "reviewedMilitaryMiniatureMedals": len(reviewed_military_minis),
        "reviewedMilitaryFullSizeMedals": len(reviewed_military_full_size),
        "importedMilitaryRibbons": len(military_paths),
    }, indent=2))


if __name__ == "__main__":
    main()
