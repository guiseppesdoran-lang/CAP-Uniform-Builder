"""Normalize utility-badge artwork to the CAP dark-blue cloth field.

The source images come from several exports. Some include transparent padding,
white crop lines, or a slightly different navy. This script crops to the actual
cloth rectangle, composites transparency onto CAP dark blue, normalizes only
dark-navy background pixels, and guarantees a clean two-pixel source edge. The
builder supplies the physical 1/8-inch border at render time.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


CAP_DARK_BLUE = (19, 33, 64, 255)


def is_cloth_blue(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return (
        alpha > 16
        and red < 85
        and green < 100
        and blue < 135
        and blue >= red + 12
    )


def cloth_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    pixels = image.load()
    coordinates = [
        (x, y)
        for y in range(image.height)
        for x in range(image.width)
        if is_cloth_blue(pixels[x, y])
    ]
    if not coordinates:
        return (0, 0, image.width, image.height)
    xs, ys = zip(*coordinates)
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)


def normalize(path: Path) -> bool:
    original = Image.open(path).convert("RGBA")
    image = original.crop(cloth_bounds(original))
    pixels = image.load()

    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0 or is_cloth_blue((red, green, blue, alpha)):
                pixels[x, y] = CAP_DARK_BLUE

    # Remove one-pixel white export/crop lines without touching the embroidery.
    edge_depth = min(2, image.width // 2, image.height // 2)
    for offset in range(edge_depth):
        for x in range(image.width):
            pixels[x, offset] = CAP_DARK_BLUE
            pixels[x, image.height - 1 - offset] = CAP_DARK_BLUE
        for y in range(image.height):
            pixels[offset, y] = CAP_DARK_BLUE
            pixels[image.width - 1 - offset, y] = CAP_DARK_BLUE

    before = original.tobytes()
    changed = image.size != original.size or image.tobytes() != before
    if changed:
        image.save(path, optimize=True)
    return changed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "directory",
        nargs="?",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "images" / "badges" / "utility",
    )
    args = parser.parse_args()
    changed = [path.name for path in sorted(args.directory.glob("*.png")) if normalize(path)]
    print(f"Normalized {len(changed)} utility badge assets in {args.directory}")
    for filename in changed:
        print(filename)


if __name__ == "__main__":
    main()
