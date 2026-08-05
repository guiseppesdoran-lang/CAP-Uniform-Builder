"""Extract only the utility/cloth occupational badges shown in CAPR 39-1."""

import argparse
from pathlib import Path

from pypdf import PdfReader
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "images" / "badges" / "utility"

# Page indices and embedded-image names from Figure A7-3 (PDF pages 3-5).
# These are the cloth versions, already presented on the correct blue backing.
DOCUMENT_BADGES = {
    "MasterAirCrew1_72AC4CAE7A310": (0, "Im7.png"),
    "SeniorAirCrew1_B289BAE6E515C": (0, "Im9.jp2"),
    "AirCrew1_DB3F0FCC3650F": (0, "Im23.png"),
    "jewish_chaplin": (2, "Im4.png"),
    "christian_chaplin": (2, "Im5.png"),
    "buddist_chaplin": (2, "Im6.png"),
    "muslim_chaplin": (2, "Im7.png"),
    "medical_officer": (2, "Im10.png"),
    "nurse_officer": (2, "Im11.png"),
    "legal_officer": (2, "Im13.jp2"),
    "emt_paramedic": (3, "Im3.jp2"),
    "emt_intermediate": (3, "Im4.png"),
    "emt_basic_badge": (3, "Im11.jp2"),
    "incident_commander_1_badge": (3, "Im8.png"),
    "incident_commander_2_badge": (3, "Im9.png"),
    "basic_incident_commander_badge": (3, "Im10.png"),
    "master_ground_team_badge": (4, "Im3.png"),
    "senior_ground_team_badge": (4, "Im4.png"),
    "ground_team_basic_badge": (4, "Im5.png"),
}


def find_image(page, image_name: str):
    for image in page.images:
        if image.name == image_name:
            return image.image
    raise ValueError(f"Embedded image {image_name!r} was not found")


def blue_and_silver_only(artwork: Image.Image) -> Image.Image:
    """Remove paper-white/transparent pixels and restrict cloth art to blue/silver."""
    source = artwork.convert("RGBA")
    cleaned = Image.new("RGBA", source.size)
    output = []
    for red, green, blue, alpha in source.getdata():
        if alpha < 24:
            output.append((12, 31, 61, 255))
            continue

        # Blue-dominant and very dark pixels belong to the cloth backing/detail.
        if blue > red * 1.08 or (red < 85 and green < 105 and blue < 145):
            level = max(18, min(104, int((red + green + blue) / 3)))
            output.append((max(7, level // 3), max(22, level // 2), level, 255))
            continue

        # All embroidery and anti-aliasing becomes silver; cap the highlight so
        # no white pixels remain in either the canvas or picker preview.
        luminance = int(0.299 * red + 0.587 * green + 0.114 * blue)
        silver = max(118, min(205, luminance))
        output.append((silver, min(205, silver + 3), min(205, silver + 6), 255))

    cleaned.putdata(output)
    return cleaned


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path, help="CAPR 39-1 PDF containing Attachment 7")
    args = parser.parse_args()

    if OUTPUT_DIR.exists():
        for old_badge in OUTPUT_DIR.glob("*.png"):
            old_badge.unlink()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(args.pdf)
    for badge_id, (page_index, image_name) in DOCUMENT_BADGES.items():
        artwork = blue_and_silver_only(find_image(reader.pages[page_index], image_name))
        artwork.save(OUTPUT_DIR / f"{badge_id}.png", optimize=True)

    print(f"Extracted {len(DOCUMENT_BADGES)} document-defined utility badges")


if __name__ == "__main__":
    main()
