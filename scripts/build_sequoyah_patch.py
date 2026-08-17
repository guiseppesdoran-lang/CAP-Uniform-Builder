"""Build transparent full and OCP-sleeve Sequoyah patch assets."""

from collections import deque
from pathlib import Path

from PIL import Image


SOURCE = Path(r"C:\Users\guise\Downloads\CAP Sequoyah Cadet Squadron Patch V04.jpg")
ROOT = Path(__file__).resolve().parents[1]
FULL_OUTPUT = ROOT / "images" / "patches" / "sequoyah_cadet_squadron_patch.png"
OCP_OUTPUT = ROOT / "images" / "patches" / "ocp" / "TN-330_ocp_patch.png"


def remove_edge_white(image: Image.Image, threshold: int = 242) -> Image.Image:
    """Make only near-white pixels connected to an image edge transparent."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    queue: deque[tuple[int, int]] = deque()
    visited: set[tuple[int, int]] = set()

    def near_white(x: int, y: int) -> bool:
        red, green, blue, _ = pixels[x, y]
        return red >= threshold and green >= threshold and blue >= threshold

    for x in range(width):
        for y in (0, height - 1):
            if near_white(x, y):
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if near_white(x, y):
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not near_white(x, y):
            continue
        visited.add((x, y))
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                queue.append((next_x, next_y))
    return rgba


def fit(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    scale = min(max_width / image.width, max_height / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def main() -> None:
    patch = remove_edge_white(Image.open(SOURCE))
    bounds = patch.getbbox()
    if not bounds:
        raise RuntimeError("The source patch became empty after background removal.")
    patch = patch.crop(bounds)
    FULL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    patch.save(FULL_OUTPUT, optimize=True)

    full = fit(patch, 88, 88)
    full_layer = Image.new("RGBA", (92, 96), (0, 0, 0, 0))
    full_layer.alpha_composite(full, ((92 - full.width) // 2, (96 - full.height) // 2))

    # The sleeve view removes the patch's left half, then rotates the remaining
    # right half to follow the OCP sleeve angle.
    right_half = full.crop((full.width // 2, 0, full.width, full.height))
    adjusted = right_half.rotate(-30, resample=Image.Resampling.BICUBIC, expand=True)

    sprite = Image.new("RGBA", (200, 100), (0, 0, 0, 0))
    sprite.alpha_composite(full_layer, (2, 2))
    sprite.alpha_composite(adjusted, (116 + max(0, (96 - adjusted.width) // 2), max(0, (100 - adjusted.height) // 2)))
    OCP_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sprite.save(OCP_OUTPUT, optimize=True)


if __name__ == "__main__":
    main()
