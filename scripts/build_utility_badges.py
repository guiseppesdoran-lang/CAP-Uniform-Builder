"""Extract only the utility/cloth occupational badges shown in CAPR 39-1."""

import argparse
from pathlib import Path

from pypdf import PdfReader


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
        artwork = find_image(reader.pages[page_index], image_name).convert("RGBA")
        artwork.save(OUTPUT_DIR / f"{badge_id}.png", optimize=True)

    print(f"Extracted {len(DOCUMENT_BADGES)} document-defined utility badges")


if __name__ == "__main__":
    main()
