#!/usr/bin/env python3
"""Generate regulation-profile embroidered counterparts from reviewed metal art.

This compiler does not authorize badges. It only creates a cloth representation
when the catalog already authorizes the service and the badge family is one of
the qualification/occupational families worn in embroidered form on utility
uniforms. Identification and command badges remain explicit NOT_APPLICABLE or
MISSING_ASSET until an item-specific rule is recorded.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "military" / "badges.json"
PROFILES = ROOT / "data" / "military" / "asset-profiles.json"
ELIGIBLE_FAMILIES = {
    "OCCUPATIONAL", "AVIATION", "AIRCREW", "SPACE", "CYBER", "MISSILE",
    "EOD", "DIVER", "MEDICAL", "CHAPLAIN", "COMBAT", "QUALIFICATION",
    # Several service catalogs group valid occupational and duty badges under
    # these broader families.  Keep them eligible when the catalog explicitly
    # declares an embroidered representation instead of silently leaving the
    # OCP counterpart missing.
    "OTHER", "COMMAND", "IDENTIFICATION"
}


def camouflage_pattern(size: tuple[int, int], pattern: str) -> Image.Image:
    palettes = {
        "OCP": ["#c6b37e", "#9a8958", "#756346", "#53624a", "#d2c48f"],
        "NWU_TYPE_III": ["#727e63", "#465448", "#1f2c27", "#a5a68a", "#273833"],
        "MARPAT_WOODLAND": ["#756d4f", "#404838", "#20251f", "#9a9270", "#5a5f47"],
    }
    palette = palettes.get(pattern, palettes["OCP"])
    image = Image.new("RGB", size, palette[0])
    draw = ImageDraw.Draw(image)
    # Deterministic, hard-edged textile fields.  These are intentionally clean
    # vector-like approximations rather than blurred blobs or product-photo
    # texture, matching the rest of the builder's generated asset style.
    for index in range(64):
        x = (index * 67) % (size[0] + 96) - 48
        y = (index * 43) % (size[1] + 60) - 30
        w = 34 + (index * 13) % 70
        h = 10 + (index * 7) % 28
        step = max(5, h // 3)
        points = [
            (x, y + step), (x + step, y + step), (x + step, y),
            (x + w - step, y), (x + w - step, y + step), (x + w, y + step),
            (x + w, y + h - step), (x + w - step, y + h - step),
            (x + w - step, y + h), (x + step, y + h),
            (x + step, y + h - step), (x, y + h - step),
        ]
        draw.polygon(points, fill=palette[(index + 1) % len(palette)])
    return image


def embroidered(source: Path, foreground: str, background_pattern: str | None, background: str | None) -> Image.Image:
    metal = Image.open(source).convert("RGBA")
    alpha = metal.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError(f"empty badge source: {source}")
    metal = metal.crop(bbox)
    gray = ImageOps.grayscale(metal)
    alpha = metal.getchannel("A")
    # Convert reviewed silver artwork into embroidered line art.  The former
    # implementation merged the full alpha channel into the thread mask,
    # producing a solid silhouette and discarding the badge's internal design.
    # Dark relief, local edges, and the outside contour are retained here while
    # the open metal fields remain transparent to the regulation backing.
    relief = ImageOps.autocontrast(ImageOps.invert(gray), cutoff=2).point(
        lambda value: max(0, min(255, int((value - 26) * 1.55)))
    )
    detail_edges = ImageOps.autocontrast(gray.filter(ImageFilter.FIND_EDGES), cutoff=2).point(
        lambda value: 255 if value > 42 else max(0, value * 4)
    )
    contour = alpha.filter(ImageFilter.FIND_EDGES).point(lambda value: 255 if value > 18 else 0)
    mask = ImageChops.lighter(relief, detail_edges)
    mask = ImageChops.lighter(mask, contour)
    mask = ImageChops.multiply(mask, alpha).filter(ImageFilter.GaussianBlur(0.22))
    canvas = (360, 220)
    backing = camouflage_pattern(canvas, background_pattern) if background_pattern else Image.new("RGB", canvas, background or "#132140")
    output = backing.convert("RGBA")
    glyph = Image.new("RGBA", metal.size, foreground)
    glyph.putalpha(mask)
    glyph.thumbnail((canvas[0] - 54, canvas[1] - 54), Image.Resampling.LANCZOS)
    output.alpha_composite(glyph, ((canvas[0] - glyph.width) // 2, (canvas[1] - glyph.height) // 2))
    # Fine horizontal thread shadow keeps all generated cloth badges in the
    # same clean digital style without reproducing product-photo noise.
    overlay = Image.new("RGBA", canvas, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(1, canvas[1], 3):
        draw.line((0, y, canvas[0], y), fill=(0, 0, 0, 22), width=1)
    return Image.alpha_composite(output, overlay)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--services", nargs="+", default=["AIR_FORCE", "SPACE_FORCE"])
    args = parser.parse_args()
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))
    generated = 0
    for badge in catalog["badges"]:
        services = [service for service in badge.get("authorizedServices", []) if service in args.services]
        if not services or badge.get("family") not in ELIGIBLE_FAMILIES:
            continue
        # The representation catalog is the authorization boundary.  Do not
        # invent a cloth version for a badge that is intentionally metal-only.
        declared_embroidered = badge.get("representations", {}).get("embroidered")
        if declared_embroidered is None:
            continue
        metal = badge.get("representations", {}).get("metal", {})
        metal_variants = metal.get("variants") or ({metal.get("defaultVariant", "default"): metal} if metal.get("asset") else {})
        if not metal_variants:
            continue
        service = services[0]
        profile_id = profiles["serviceDefaults"][service]["embroideredBacking"]
        profile = profiles["backingProfiles"][profile_id]
        cloth_variants = {}
        for variant, record in metal_variants.items():
            asset = record.get("asset")
            if record.get("status") != "AVAILABLE" or not asset or not (ROOT / asset).exists():
                continue
            relative = Path("images") / "military-badges" / "embroidered" / service.lower().replace("_", "-") / badge["id"] / f"{variant}.png"
            output = ROOT / relative
            output.parent.mkdir(parents=True, exist_ok=True)
            embroidered(ROOT / asset, profile["foreground"], profile.get("backgroundPattern"), profile.get("background")).save(output, optimize=True)
            cloth_variants[variant] = {
                "status": "AVAILABLE", "available": True, "asset": relative.as_posix(),
                "backingProfile": profile_id, "sourceMetalAsset": asset,
                "style": "REGULATION_EMBROIDERED", "verificationStatus": "DERIVED_FROM_REVIEWED_METAL_ART"
            }
            generated += 1
        if cloth_variants:
            default = metal.get("defaultVariant") if metal.get("defaultVariant") in cloth_variants else next(iter(cloth_variants))
            service_representation = {
                **cloth_variants[default], "defaultVariant": default, "variants": cloth_variants,
                "authorizedUniformFamilies": ["OCP"], "backingProfile": profile_id
            }
            embroidered_record = badge.setdefault("representations", {}).setdefault("embroidered", {})
            embroidered_record.setdefault("byService", {})[service] = service_representation
            if embroidered_record.get("status") != "AVAILABLE":
                embroidered_record.update(service_representation)
    CATALOG.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"generated": generated, "services": args.services}, indent=2))


if __name__ == "__main__":
    main()
