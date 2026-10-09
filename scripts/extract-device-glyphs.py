"""Turn the device product photos into alpha-cut glyphs usable for compositing.

The files in images/devices are catalogue photographs: RGB with an opaque white
background, and each one shows TWO copies of the item stacked vertically. They
cannot be composited onto a ribbon as-is, which is why the builder shipped 422
pre-rendered ribbon variants instead of drawing devices at runtime.

This script produces images/devices/glyph/<name>.webp - one instance, background
removed, trimmed to the device itself, with alpha.

The background is removed by flood-filling near-white INWARD FROM THE BORDER
rather than by a global threshold. That distinction matters: silver and gold
devices contain near-white highlights, and a global threshold punches holes
through them.

Typical use:

    python3 scripts/extract-device-glyphs.py --dry-run
    python3 scripts/extract-device-glyphs.py --apply

Requires Pillow, the same way the other scripts here require pypdf.
"""

import argparse
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "images" / "devices"
OUT_DIR = SRC_DIR / "glyph"

# Devices render a few pixels wide on screen but are also drawn into the 2x PNG
# export, so keep a little headroom without carrying the 600x600 originals.
TARGET_MAX_EDGE = 96
WHITE_TOLERANCE = 28
MIN_RUN_FRACTION = 0.06


def key_out_background(image, tolerance=WHITE_TOLERANCE):
    """Flood-fill near-white from the border so interior highlights survive."""
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    seen = bytearray(width * height)
    queue = deque()

    def near_white(p):
        return p[0] >= 255 - tolerance and p[1] >= 255 - tolerance and p[2] >= 255 - tolerance

    for x in range(width):
        for y in (0, height - 1):
            if not seen[y * width + x] and near_white(pixels[x, y]):
                seen[y * width + x] = 1
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if not seen[y * width + x] and near_white(pixels[x, y]):
                seen[y * width + x] = 1
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (255, 255, 255, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height and not seen[ny * width + nx]:
                if near_white(pixels[nx, ny]):
                    seen[ny * width + nx] = 1
                    queue.append((nx, ny))
    return image


def content_runs(image):
    """Vertical spans containing opaque content, used to split stacked copies."""
    alpha = image.split()[3]
    width, height = image.size
    filled = [any(alpha.getpixel((x, y)) > 8 for x in range(0, width, 3)) for y in range(height)]
    runs, start = [], None
    for y, is_filled in enumerate(filled):
        if is_filled and start is None:
            start = y
        elif not is_filled and start is not None:
            if y - start > height * MIN_RUN_FRACTION:
                runs.append((start, y))
            start = None
    if start is not None and height - start > height * MIN_RUN_FRACTION:
        runs.append((start, height))
    return runs


def extract(path):
    image = key_out_background(Image.open(path))
    runs = content_runs(image)
    if runs:
        top, bottom = max(runs, key=lambda r: r[1] - r[0])
        image = image.crop((0, top, image.size[0], bottom))
    bbox = image.split()[3].getbbox()
    if bbox:
        image = image.crop(bbox)
    longest = max(image.size)
    if longest > TARGET_MAX_EDGE:
        scale = TARGET_MAX_EDGE / longest
        image = image.resize(
            (max(1, round(image.size[0] * scale)), max(1, round(image.size[1] * scale))),
            Image.LANCZOS,
        )
    return image, len(runs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write the glyph files")
    parser.add_argument("--dry-run", action="store_true", help="report only (default)")
    args = parser.parse_args()
    apply_changes = args.apply and not args.dry_run

    sources = sorted(
        p for p in SRC_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in (".webp", ".png", ".jpg", ".jpeg")
    )
    if apply_changes:
        OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"{'device':<34}{'source':>12}{'glyph':>12}{'copies':>8}{'bytes':>9}")
    total_before = total_after = 0
    for path in sources:
        before = Image.open(path).size
        glyph, copies = extract(path)
        out_path = OUT_DIR / f"{path.stem}.webp"
        if apply_changes:
            glyph.save(out_path, "WEBP", quality=92, method=6, lossless=False)
            size = out_path.stat().st_size
        else:
            size = 0
        total_before += path.stat().st_size
        total_after += size
        print(f"{path.stem:<34}{f'{before[0]}x{before[1]}':>12}"
              f"{f'{glyph.size[0]}x{glyph.size[1]}':>12}{copies:>8}{size:>9,}")

    print(f"\n{len(sources)} devices   before {total_before/1024:.0f} KB", end="")
    if apply_changes:
        print(f"   after {total_after/1024:.0f} KB")
        print(f"written to {OUT_DIR.relative_to(ROOT)}")
    else:
        print("   (dry run - nothing written; pass --apply)")


if __name__ == "__main__":
    main()
