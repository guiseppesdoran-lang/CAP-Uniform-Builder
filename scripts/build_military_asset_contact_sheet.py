#!/usr/bin/env python3
"""Build deterministic visual-QA contact sheets for a service tranche."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]


def font(size: int) -> ImageFont.ImageFont:
    candidate = Path("C:/Windows/Fonts/arial.ttf")
    return ImageFont.truetype(str(candidate), size) if candidate.exists() else ImageFont.load_default()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--service", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    service = args.service.upper()
    awards = json.loads((ROOT / "data/military/canonical-awards.json").read_text(encoding="utf-8"))
    badges = json.loads((ROOT / "data/military/badges.json").read_text(encoding="utf-8"))["badges"]
    records = []
    for award in awards:
        if service not in award.get("authorizedServices", []):
            continue
        for name in ("ribbon", "miniatureMedal", "fullSizeMedal"):
            rep = award.get("representations", {}).get(name, {})
            if rep.get("status") == "AVAILABLE" and rep.get("asset"):
                records.append((award["id"], name, ROOT / rep["asset"]))
    for badge in badges:
        if service not in badge.get("authorizedServices", []):
            continue
        for name in ("metal", "embroidered"):
            configured = badge.get("representations", {}).get(name, {})
            rep = configured.get("byService", {}).get(service, configured)
            variants = rep.get("variants") or ({rep.get("defaultVariant", "default"): rep} if rep.get("asset") else {})
            for variant, item in variants.items():
                if item.get("status") == "AVAILABLE" and item.get("asset"):
                    records.append((f"{badge['id']}:{variant}", name, ROOT / item["asset"]))
    cell_w, cell_h, columns = 240, 170, 5
    rows = (len(records) + columns - 1) // columns
    sheet = Image.new("RGB", (cell_w * columns, cell_h * rows), "#f4f6f8")
    draw = ImageDraw.Draw(sheet)
    title_font, label_font = font(13), font(10)
    for index, (record_id, representation, path) in enumerate(records):
        x, y = (index % columns) * cell_w, (index // columns) * cell_h
        draw.rectangle((x, y, x + cell_w - 1, y + cell_h - 1), outline="#c3cad2")
        if path.exists():
            image = Image.open(path).convert("RGBA")
            image.thumbnail((cell_w - 24, cell_h - 48), Image.Resampling.LANCZOS)
            sheet.paste(image, (x + (cell_w - image.width) // 2, y + 8), image)
        draw.text((x + 6, y + cell_h - 35), representation, font=title_font, fill="#0b2744")
        label = record_id if len(record_id) <= 38 else record_id[:35] + "..."
        draw.text((x + 6, y + cell_h - 19), label, font=label_font, fill="#233241")
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)
    print(json.dumps({"records": len(records), "output": output.as_posix()}, indent=2))


if __name__ == "__main__":
    main()
