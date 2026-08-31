#!/usr/bin/env python3
"""Build repository-native Air Force ribbon/device composites.

The verified device-rule compiler decides which combinations exist and how an
award count splits across physical ribbons.  This script only rasterizes those
already-approved combinations onto the local 100x30 McChord-style ribbon art.
No vendor image is copied into the generated output.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "military" / "device-variant-manifest.json"
DEFINITIONS = ROOT / "data" / "rules" / "verified" / "device-definitions.json"
TARGET_SIZE = (100, 30)
SLOTS = {
    1: (0.50,),
    2: (0.36, 0.64),
    3: (0.27, 0.50, 0.73),
    4: (0.20, 0.40, 0.60, 0.80),
}
MCCHORD_OLC_REFERENCES = {
    "BRONZE_OLC": ("images/ribbons/usaf_aam01.png", "images/ribbons/usaf_aam02.png"),
    "SILVER_OLC": ("images/ribbons/usaf_aam01.png", "images/ribbons/usaf_aam06.png"),
}
_REFERENCE_DEVICE_CACHE: dict[str, Image.Image] = {}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def device_box(device_id: str) -> tuple[int, int]:
    if device_id.endswith("_OLC"):
        # Match the existing McChord Aerial Achievement Medal series:
        # one cluster occupies about 21x14 pixels on a 100x30 ribbon.
        return (21, 14)
    if device_id.startswith("NUMERAL_"):
        return (16, 16)
    return (18, 18)


def fitted_device(path: Path, box: tuple[int, int]) -> Image.Image:
    """Crop transparent padding and fit the visible device without distortion."""
    with Image.open(path) as source:
        rgba = source.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    glyph = rgba.crop(bbox) if bbox else rgba
    max_width, max_height = box
    scale = min(max_width / glyph.width, max_height / glyph.height)
    size = (
        max(1, round(glyph.width * scale)),
        max(1, round(glyph.height * scale)),
    )
    return glyph.resize(size, Image.Resampling.LANCZOS)


def mcchord_reference_device(device_id: str) -> Image.Image | None:
    """Recover the exact McChord cluster footprint from the CAP AAM series."""
    if device_id not in MCCHORD_OLC_REFERENCES:
        return None
    if device_id in _REFERENCE_DEVICE_CACHE:
        return _REFERENCE_DEVICE_CACHE[device_id].copy()
    base_name, variant_name = MCCHORD_OLC_REFERENCES[device_id]
    with Image.open(ROOT / base_name) as source:
        base = source.convert("RGB")
    with Image.open(ROOT / variant_name) as source:
        variant = source.convert("RGB")
    difference = ImageChops.difference(base, variant)
    channels = difference.split()
    mask = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
    mask = mask.point(lambda value: 255 if value > 3 else 0)
    bbox = mask.getbbox()
    if not bbox:
        raise ValueError(f"McChord reference contains no visible {device_id} pixels")
    device = variant.crop(bbox).convert("RGBA")
    device.putalpha(mask.crop(bbox))
    _REFERENCE_DEVICE_CACHE[device_id] = device
    return device.copy()


def composite(base_path: Path, devices: list[str], device_assets: dict[str, str]) -> Image.Image:
    with Image.open(base_path) as source:
        canvas = source.convert("RGBA").resize(TARGET_SIZE, Image.Resampling.LANCZOS)
    centers = SLOTS[len(devices)]
    for index, device_id in enumerate(devices):
        asset = device_assets.get(device_id)
        if not asset:
            raise KeyError(f"No local device artwork configured for {device_id}")
        device_path = ROOT / asset
        if not device_path.exists():
            raise FileNotFoundError(device_path)
        device = mcchord_reference_device(device_id) or fitted_device(device_path, device_box(device_id))
        width, height = device.size
        x = round(TARGET_SIZE[0] * centers[index] - width / 2)
        y = round(TARGET_SIZE[1] * 0.5 - height / 2)
        canvas.alpha_composite(device, (x, y))
    return canvas


def main() -> None:
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    definitions = json.loads(DEFINITIONS.read_text(encoding="utf-8"))
    device_assets = {item["id"]: item.get("asset") for item in definitions if item.get("asset")}
    awards_path = ROOT / "data" / "military" / "canonical-awards.json"
    awards = {item["id"]: item for item in json.loads(awards_path.read_text(encoding="utf-8"))}

    generated = 0
    generated_records: list[dict] = []
    for record in payload.get("ribbonAssets", []):
        if record.get("service") != "AIR_FORCE" or record.get("strategy") != "PRECOMPOSED_PNG":
            continue
        devices = list(record.get("devices") or [])
        if not 1 <= len(devices) <= 4:
            raise ValueError(f"{record.get('key')}: expected one through four devices")
        award = awards.get(record["awardId"])
        base_asset = award.get("representations", {}).get("ribbon", {}).get("asset") if award else None
        if not base_asset:
            raise KeyError(f"{record['awardId']}: missing McChord-style base ribbon")
        target_path = ROOT / record["asset"]
        target_path.parent.mkdir(parents=True, exist_ok=True)
        composite(ROOT / base_asset, devices, device_assets).save(target_path, "PNG", optimize=True)
        record["sha256"] = sha256(target_path)
        record["generator"] = "scripts/build_air_force_ribbon_device_variants.py"
        record["deviceAspectPreserved"] = True
        record["deviceStyleReference"] = "CAP_McCHORD_AERIAL_ACHIEVEMENT"
        generated_records.append(record)
        generated += 1

    columns, cell_width, cell_height = 6, 190, 70
    rows = (len(generated_records) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#f3f4f6")
    draw = ImageDraw.Draw(sheet)
    for index, record in enumerate(generated_records):
        left = (index % columns) * cell_width
        top = (index // columns) * cell_height
        with Image.open(ROOT / record["asset"]) as source:
            preview = source.convert("RGB").resize((150, 45), Image.Resampling.NEAREST)
        sheet.paste(preview, (left + 20, top + 3))
        label = f"{record['awardId'][:15]} | {'+'.join(record['devices'])[:16]}"
        draw.text((left + 4, top + 52), label, fill="#111827")
    report_path = ROOT / "reports" / "air-force-ribbon-device-variants.png"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(report_path, "PNG", optimize=True)

    payload["airForceCompositeCount"] = generated
    payload["airForceCompositeContactSheet"] = "reports/air-force-ribbon-device-variants.png"
    MANIFEST.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"generated": generated, "canvas": TARGET_SIZE}, indent=2))


if __name__ == "__main__":
    main()
