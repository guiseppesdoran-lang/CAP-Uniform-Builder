#!/usr/bin/env python3
"""Build missing medal-size counterparts from reviewed source photographs.

The canonical catalog sometimes has only a miniature or a full-size medal even
though the same award authorizes both.  The available representation retains
the reviewed product source image, so this pass re-renders that source using
the target McChord geometry instead of scaling the existing production PNG.
Explicit NOT_APPLICABLE classifications are never changed.
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

from PIL import Image

from import_vanguard_air_force_mini_medals import ROOT, CATALOG, OVERRIDES, digital_medal, fetch

CANONICAL = ROOT / "data" / "military" / "canonical-awards.json"
CONFIG = {
    "miniatureMedal": {
        "other": "fullSizeMedal",
        "folder": "military-mini-medals",
        "canvas": (50, 176),
        "suspensionHeight": 116,
    },
    "fullSizeMedal": {
        "other": "miniatureMedal",
        "folder": "military-full-size-medals",
        "canvas": (100, 220),
        "suspensionHeight": 132,
    },
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--service", default="AIR_FORCE")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    service = args.service.upper()
    slug = service.lower().replace("_", "-")

    canonical_raw = json.loads(CANONICAL.read_text(encoding="utf-8"))
    canonical = canonical_raw.get("awards", canonical_raw) if isinstance(canonical_raw, dict) else canonical_raw
    source_catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    source_by_id = {award["id"]: award for award in source_catalog}
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    candidates = []

    for award in canonical:
        if service not in award.get("authorizedServices", []):
            continue
        representations = award.get("representations", {})
        for target, config in CONFIG.items():
            current = representations.get(target, {})
            source = representations.get(config["other"], {})
            if current.get("status") != "MISSING_ASSET":
                continue
            if source.get("status") != "AVAILABLE" or not source.get("sourceImage"):
                continue
            candidates.append({
                "awardId": award["id"],
                "name": award.get("officialName") or award.get("name"),
                "target": target,
                "sourceRepresentation": config["other"],
                "sourceImage": source["sourceImage"],
                "sources": source.get("sources", []),
            })

    if not args.apply:
        print(json.dumps({"service": service, "candidates": candidates}, indent=2))
        return

    imported = []
    failed = []
    for candidate in candidates:
        award_id = candidate["awardId"]
        target = candidate["target"]
        config = CONFIG[target]
        # Re-check the authoritative override so a stale canonical build can
        # never replace a ribbon-only decision.
        current_override = overrides.get("awards", {}).get(award_id, {}).get(target, {})
        if current_override.get("status") == "NOT_APPLICABLE":
            continue
        catalog_award = source_by_id.get(award_id, {})
        ribbon_asset = (
            catalog_award.get("representations", {}).get("ribbon", {}).get("asset")
            or catalog_award.get("images", {}).get("ribbon")
        )
        ribbon = Image.open(ROOT / ribbon_asset) if ribbon_asset and (ROOT / ribbon_asset).exists() else None
        relative = Path("images") / config["folder"] / slug / f"{award_id}.png"
        output = ROOT / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        try:
            source_bytes = fetch(candidate["sourceImage"])
            digital_medal(
                source_bytes,
                award_id,
                canvas=config["canvas"],
                ribbon=ribbon,
                suspension_height=config["suspensionHeight"],
            ).save(output, optimize=True)
        except Exception as error:
            failed.append({**candidate, "error": str(error)})
            continue
        representation = {
            "status": "AVAILABLE",
            "available": True,
            "asset": relative.as_posix(),
            "verificationStatus": "CATALOG_CROSS_REFERENCED",
            "sources": candidate["sources"],
            "style": "MCCHORD_DIGITAL_MEDAL",
            "sourceImage": candidate["sourceImage"],
            "derivedFromReviewedRepresentation": candidate["sourceRepresentation"],
        }
        overrides.setdefault("awards", {}).setdefault(award_id, {})[target] = representation
        imported.append({**candidate, "asset": relative.as_posix()})

    OVERRIDES.write_text(json.dumps(overrides, indent=2) + "\n", encoding="utf-8")
    manifest = ROOT / "data" / "imports" / f"reviewed_{slug}_medal_counterparts.json"
    manifest.write_text(json.dumps({
        "service": service,
        "accessed": date.today().isoformat(),
        "sourcePolicy": "Re-render the reviewed opposite-size source image; never stretch a production asset.",
        "imported": imported,
        "failed": failed,
    }, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"service": service, "imported": len(imported), "failed": len(failed)}, indent=2))


if __name__ == "__main__":
    main()
