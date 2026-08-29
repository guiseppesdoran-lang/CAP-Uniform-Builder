#!/usr/bin/env python3
"""Merge reviewed service medal import manifests into canonical overrides."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OVERRIDES = ROOT / "data" / "rules" / "verified" / "representation-overrides.json"


def main() -> None:
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    merged = 0
    for manifest_path in sorted((ROOT / "data" / "imports").glob("vanguard_*_*Medal.json")):
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        representation = manifest.get("representation")
        if representation not in {"miniatureMedal", "fullSizeMedal"}:
            continue
        for record in manifest.get("imported", []):
            asset = record.get("asset")
            if not asset or not (ROOT / asset).exists():
                raise FileNotFoundError(f"{manifest_path.name}: missing {asset}")
            current = overrides.setdefault("awards", {}).setdefault(record["awardId"], {}).get(representation, {})
            if current.get("status") == "AVAILABLE":
                continue
            overrides["awards"][record["awardId"]][representation] = {
                "status": "AVAILABLE", "available": True, "asset": asset,
                "verificationStatus": "CATALOG_CROSS_REFERENCED",
                "sources": [record["productUrl"]], "style": "MCCHORD_DIGITAL_MEDAL",
                "sourceImage": record["image"]
            }
            merged += 1
    OVERRIDES.write_text(json.dumps(overrides, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"merged": merged}, indent=2))


if __name__ == "__main__":
    main()
