#!/usr/bin/env python3
"""Normalize military ribbon artwork to the local McChord visual standard.

The source stripe design remains authoritative.  This deterministic pass only
normalizes canvas geometry and transfers the common high-frequency fabric and
edge-lighting treatment measured from the repository's McChord masters.
"""

from __future__ import annotations

import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from PIL import Image, ImageColor, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
CANONICAL = ROOT / "data" / "military" / "canonical-awards.json"
EXISTING = ROOT / "data" / "rules" / "verified" / "ribbon-style-overrides.json"
OUTPUT_DIR = ROOT / "images" / "military-ribbons" / "mcchord-style"
VARIANTS = ROOT / "mcchord-ribbon-variants.js"
MASTER_DIR = ROOT / "images" / "ribbons"
TARGET_SIZE = (100, 30)
GENERATOR_VERSION = 1


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def master_paths() -> list[Path]:
    text = VARIANTS.read_text(encoding="utf-8")
    names = list(dict.fromkeys(re.findall(r'"image":\s*"([^"]+)"', text)))
    return [MASTER_DIR / name for name in names if (MASTER_DIR / name).exists()]


def texture_template(paths: list[Path]) -> np.ndarray:
    ratios = []
    for path in paths:
        with Image.open(path) as source:
            image = source.convert("RGB").resize(TARGET_SIZE, Image.Resampling.LANCZOS)
        gray = np.asarray(image.convert("L"), dtype=np.float32)
        blur = np.asarray(image.convert("L").filter(ImageFilter.GaussianBlur(1.15)), dtype=np.float32)
        ratios.append(np.clip((gray + 2.0) / (blur + 2.0), 0.82, 1.18))
    return np.median(np.stack(ratios, axis=0), axis=0)


def load_source(source_path: Path) -> Image.Image:
    if source_path.suffix.lower() != ".svg":
        with Image.open(source_path) as source:
            return source.convert("RGB")
    root = ET.fromstring(source_path.read_text(encoding="utf-8"))
    width, height = int(float(root.attrib["width"])), int(float(root.attrib["height"]))
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    for node in root:
        if node.tag.rsplit("}", 1)[-1] != "rect":
            raise ValueError(f"Unsupported SVG element in {source_path}: {node.tag}")
        x, y = float(node.attrib.get("x", 0)), float(node.attrib.get("y", 0))
        w, h = float(node.attrib.get("width", width)), float(node.attrib.get("height", height))
        draw.rectangle((x, y, x + w, y + h), fill=ImageColor.getrgb(node.attrib["fill"]))
    return image


def render(source_path: Path, target_path: Path, texture: np.ndarray) -> None:
    rgb = load_source(source_path).resize(TARGET_SIZE, Image.Resampling.LANCZOS)
    pixels = np.asarray(rgb, dtype=np.float32)
    # Transfer the measured common weave, then retain the McChord-style darker
    # stitched top/bottom edges without changing the award stripe sequence.
    pixels *= texture[:, :, None]
    edge = np.ones((TARGET_SIZE[1], 1, 1), dtype=np.float32)
    edge[0:2] *= 0.82
    edge[-2:] *= 0.80
    edge[2:4] *= 0.94
    edge[-4:-2] *= 0.93
    pixels *= edge
    result = Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8), "RGB")
    target_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(target_path, "PNG", optimize=True)


def main() -> None:
    awards = json.loads(CANONICAL.read_text(encoding="utf-8"))
    existing = json.loads(EXISTING.read_text(encoding="utf-8")) if EXISTING.exists() else {"awards": {}}
    prior = existing.get("awards", {})
    texture = texture_template(master_paths())
    records = {}
    generated = 0
    for award in awards:
        representation = award.get("representations", {}).get("ribbon", {})
        if representation.get("status") != "AVAILABLE":
            continue
        old = prior.get(award["id"], {}).get("ribbon", {})
        source_asset = old.get("sourceAsset") or representation.get("asset")
        source_path = ROOT / source_asset
        if not source_path.exists():
            raise FileNotFoundError(f"{award['id']}: source ribbon missing: {source_asset}")
        target_asset = f"images/military-ribbons/mcchord-style/{award['id']}.png"
        target_path = ROOT / target_asset
        render(source_path, target_path, texture)
        records[award["id"]] = {
            "ribbon": {
                "status": "AVAILABLE",
                "available": True,
                "asset": target_asset,
                "sourceAsset": source_asset,
                "sourceSha256": sha256(source_path),
                "style": "MCCHORD_DERIVED",
                "reviewStatus": "GENERATED_PENDING_VISUAL_REVIEW",
                "generatorVersion": GENERATOR_VERSION,
            }
        }
        generated += 1
    payload = {
        "schemaVersion": 1,
        "notes": "Generated style mappings preserve source stripe designs and apply only repository-derived McChord geometry, weave, lighting, and edge treatment.",
        "awards": records,
    }
    EXISTING.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"generated": generated, "width": TARGET_SIZE[0], "height": TARGET_SIZE[1]}, indent=2))


if __name__ == "__main__":
    main()
