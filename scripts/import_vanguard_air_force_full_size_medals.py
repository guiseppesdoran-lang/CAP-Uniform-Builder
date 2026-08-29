#!/usr/bin/env python3
"""Import normal-size Air Force medal references as local digital assets."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from PIL import Image

from import_vanguard_air_force_mini_medals import (
    ROOT,
    CATALOG,
    OVERRIDES,
    digital_medal,
    fetch,
    match_products,
)

MANIFEST = ROOT / "data" / "imports" / "vanguard_air_force_full_size_medals.json"
COLLECTION = "https://www.vanguardmil.com/collections/medals/products.json?limit=250&page={}"


def products() -> list[dict]:
    result = []
    for page in range(1, 6):
        batch = json.loads(fetch(COLLECTION.format(page))).get("products", [])
        if not batch:
            break
        result.extend(batch)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    matches, unmatched = match_products(catalog, products(), required_keyword="full size")
    # Product placeholders must never become award artwork.
    matches = [match for match in matches if "nophoto" not in match["image"].lower()]
    if not args.apply:
        print(json.dumps({"matched": matches, "unmatched": unmatched}, indent=2))
        return

    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    imported = []
    failed = []
    for match in matches:
        relative = Path("images") / "military-full-size-medals" / "air-force" / f"{match['awardId']}.png"
        output = ROOT / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        try:
            award = next(item for item in catalog if item["id"] == match["awardId"])
            ribbon_asset = award.get("representations", {}).get("ribbon", {}).get("asset") or award.get("images", {}).get("ribbon")
            ribbon = Image.open(ROOT / ribbon_asset) if ribbon_asset and (ROOT / ribbon_asset).exists() else None
            digital_medal(fetch(match["image"]), match["awardId"], canvas=(100, 220), ribbon=ribbon, suspension_height=132).save(output, optimize=True)
        except Exception as error:  # keep a transparent audit trail; never substitute generic art
            failed.append({**match, "error": str(error)})
            continue
        representation = {
            "status": "AVAILABLE",
            "available": True,
            "asset": relative.as_posix(),
            "verificationStatus": "CATALOG_CROSS_REFERENCED",
            "sources": [match["productUrl"]],
            "style": "MCCHORD_DIGITAL_MEDAL",
            "sourceImage": match["image"],
        }
        overrides.setdefault("awards", {}).setdefault(match["awardId"], {})["fullSizeMedal"] = representation
        imported.append({**match, "asset": relative.as_posix()})

    OVERRIDES.write_text(json.dumps(overrides, indent=2) + "\n", encoding="utf-8")
    MANIFEST.write_text(json.dumps({
        "source": "https://www.vanguardmil.com/collections/medals",
        "sourceType": "COMMERCIAL_CATALOG_DISCOVERY_REFERENCE",
        "regulatoryAuthority": "DAFMAN 36-2806, Attachment 2 and Attachment 16",
        "accessed": date.today().isoformat(),
        "style": "MCCHORD_DIGITAL_MEDAL",
        "canvas": [100, 220],
        "suspensionRibbonHeight": 132,
        "geometryPolicy": "Suspension ribbon and pendant are normalized independently; the photographed medal is never stretched as one image.",
        "imported": imported,
        "failed": failed,
        "unmatched": unmatched,
    }, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"imported": len(imported), "failed": len(failed), "unmatched": len(unmatched)}, indent=2))


if __name__ == "__main__":
    main()
