#!/usr/bin/env python3
"""Audit rendered military medals for transparent breaks at the suspension joint."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "military" / "canonical-awards.json"
REPORT = ROOT / "reports" / "military-medal-connectivity-audit.json"
REPRESENTATIONS = {
    "miniatureMedal": {"suspensionHeight": 116, "joinEnd": 143},
    "fullSizeMedal": {"suspensionHeight": 132, "joinEnd": 159},
}


def transparent_rows(asset: Path, start: int, end: int) -> list[int]:
    with Image.open(asset).convert("RGBA") as image:
        alpha = image.getchannel("A")
        end = min(end, image.height - 1)
        return [y for y in range(max(0, start), end + 1) if not alpha.crop((0, y, image.width, y + 1)).getbbox()]


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    checked = 0
    issues: list[dict] = []
    for award in catalog:
        for representation, policy in REPRESENTATIONS.items():
            record = award.get("representations", {}).get(representation, {})
            if record.get("status") != "AVAILABLE" or not record.get("asset"):
                continue
            checked += 1
            asset = ROOT / record["asset"]
            if not asset.exists():
                issues.append({"awardId": award["id"], "representation": representation, "asset": record["asset"], "error": "missing-file"})
                continue
            blank = transparent_rows(asset, policy["suspensionHeight"] - 6, policy["joinEnd"])
            if blank:
                issues.append({
                    "awardId": award["id"],
                    "representation": representation,
                    "asset": record["asset"],
                    "transparentRows": blank,
                })
    report = {"checked": checked, "issueCount": len(issues), "issues": issues}
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(1 if issues else 0)


if __name__ == "__main__":
    main()
