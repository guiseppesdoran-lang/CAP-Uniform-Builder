#!/usr/bin/env python3
"""Import missing service-specific medal art through the reviewed local pipeline."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from PIL import Image

from import_vanguard_air_force_mini_medals import ROOT, CATALOG, OVERRIDES, digital_medal, fetch, match_products

COLLECTIONS = {
    "miniatureMedal": ("https://www.vanguardmil.com/collections/miniature-medals/products.json?limit=250&page={}", "miniature", (50, 176), 116, "military-mini-medals"),
    "fullSizeMedal": ("https://www.vanguardmil.com/collections/medals/products.json?limit=250&page={}", "full size", (100, 220), 132, "military-full-size-medals"),
}


def products(template: str) -> list[dict]:
    result = []
    for page in range(1, 7):
        batch = json.loads(fetch(template.format(page))).get("products", [])
        if not batch:
            break
        result.extend(batch)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--service", required=True)
    parser.add_argument("--representation", choices=list(COLLECTIONS), required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    service = args.service.upper()
    template, keyword, canvas, suspension_height, folder = COLLECTIONS[args.representation]
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    matches, unmatched = match_products(catalog, products(template), required_keyword=keyword, service=service)
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    # Shared awards keep the first reviewed canonical representation. This pass
    # fills only actual gaps and never creates duplicate branch copies.
    missing = []
    for match in matches:
        current = overrides.get("awards", {}).get(match["awardId"], {}).get(args.representation, {})
        if current.get("status") != "AVAILABLE":
            missing.append(match)
    if not args.apply:
        print(json.dumps({"service": service, "representation": args.representation, "matches": missing, "unmatched": unmatched}, indent=2))
        return
    imported = []
    slug = service.lower().replace("_", "-")
    for match in missing:
        award = next(item for item in catalog if item["id"] == match["awardId"])
        ribbon_asset = award.get("representations", {}).get("ribbon", {}).get("asset") or award.get("images", {}).get("ribbon")
        ribbon = Image.open(ROOT / ribbon_asset) if ribbon_asset and (ROOT / ribbon_asset).exists() else None
        relative = Path("images") / folder / slug / f"{match['awardId']}.png"
        output = ROOT / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        digital_medal(fetch(match["image"]), match["awardId"], canvas=canvas, ribbon=ribbon, suspension_height=suspension_height).save(output, optimize=True)
        representation = {
            "status": "AVAILABLE", "available": True, "asset": relative.as_posix(),
            "verificationStatus": "CATALOG_CROSS_REFERENCED", "sources": [match["productUrl"]],
            "style": "MCCHORD_DIGITAL_MEDAL", "sourceImage": match["image"]
        }
        overrides.setdefault("awards", {}).setdefault(match["awardId"], {})[args.representation] = representation
        imported.append({**match, "asset": relative.as_posix()})
    OVERRIDES.write_text(json.dumps(overrides, indent=2) + "\n", encoding="utf-8")
    manifest = ROOT / "data" / "imports" / f"vanguard_{slug.replace('-', '_')}_{args.representation}.json"
    manifest.write_text(json.dumps({
        "source": template.split("/products.json", 1)[0], "sourceType": "COMMERCIAL_CATALOG_DISCOVERY_REFERENCE",
        "service": service, "representation": args.representation, "accessed": date.today().isoformat(),
        "canvas": list(canvas), "suspensionRibbonHeight": suspension_height,
        "geometryPolicy": "Suspension ribbon and pendant are normalized independently; the photographed medal is never stretched as one image.",
        "imported": imported, "unmatched": unmatched
    }, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"service": service, "representation": args.representation, "imported": len(imported), "unmatched": len(unmatched)}, indent=2))


if __name__ == "__main__":
    main()
