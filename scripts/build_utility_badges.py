"""Build OCP/utility badge artwork from the existing transparent badge PNGs."""

from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "images" / "badges"
OUTPUT_DIR = SOURCE_DIR / "utility"

BLUE = (11, 45, 79, 255)
MAX_ART_WIDTH = 86
MAX_ART_HEIGHT = 42
BLUE_BORDER = 6


def build_badge(source_path: Path, output_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    alpha = source.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return

    source = source.crop(bbox)
    alpha = source.getchannel("A")
    scale = min(MAX_ART_WIDTH / source.width, MAX_ART_HEIGHT / source.height)
    size = (
        max(1, round(source.width * scale)),
        max(1, round(source.height * scale)),
    )
    source = source.resize(size, Image.Resampling.LANCZOS)
    alpha = source.getchannel("A")

    # Preserve internal highlights and shadows while converting the artwork to
    # the light-silver embroidery specified for utility-uniform badges.
    gray = ImageOps.grayscale(source)
    silver = gray.point(lambda value: 165 + round(value * 0.33))
    embroidery = Image.merge("RGBA", (silver, silver, silver, alpha))

    canvas = Image.new(
        "RGBA",
        (size[0] + BLUE_BORDER * 2, size[1] + BLUE_BORDER * 2),
        BLUE,
    )
    canvas.alpha_composite(embroidery, (BLUE_BORDER, BLUE_BORDER))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, optimize=True)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for source_path in sorted(SOURCE_DIR.glob("*.png")):
        build_badge(source_path, OUTPUT_DIR / source_path.name)
        count += 1
    print(f"Built {count} utility badge images in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
