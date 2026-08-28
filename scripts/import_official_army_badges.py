#!/usr/bin/env python3
"""Import and normalize official U.S. Army badge artwork.

The Army uniform guide publishes named large JPEGs for combat, special-skill,
marksmanship, and identification badges. This importer keeps the official URL
as provenance, removes only edge-connected near-white page background, writes
deterministic transparent PNG canvases, and updates the canonical badge catalog.
"""

from __future__ import annotations

import html
import io
import json
import re
import subprocess
import urllib.parse
from collections import deque
from datetime import date
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "military" / "badges.json"
OUT = ROOT / "images" / "military-badges" / "army"
MANIFEST = ROOT / "data" / "imports" / "official_army_badges.json"
PAGE = "https://www.army.mil/uniforms/"


FAMILIES = {
    "office_of_secretary_of_defense_identification_badge": {"default": "Secretary of Defense Identification Badge"},
    "joint_chiefs_of_staff_identification_badge": {"default": "Joint Chiefs of Staff Identification Badge"},
    "army_air_assault_badge": {"default": "Air Assault Badge"},
    "army_aviator_badge": {
        "basic": "Army Aviator Badge", "senior": "Senior Army Aviator Badge", "master": "Master Army Aviator Badge"
    },
    "army_aviation_badge": {
        "basic": "Basic Aviation Badge", "senior": "Senior Aviation Badge", "master": "Master Aviation Badge"
    },
    "army_combat_action_badge": {
        "first_award": "Combat Action Badge",
        "master_first_award": "Master Combat Action Badge, First Award",
        "master_second_award": "Master Combat Action Badge, Second Award",
    },
    "army_combat_infantryman_badge": {
        "first_award": "Combat Infantryman Badge, First Award",
        "master_first_award": "Master Combat Infantryman Badge, First Award",
    },
    "army_combat_medical_badge": {"first_award": "Combat Medical Badge, First Award"},
    "army_diver_badge": {
        "second_class": "Second Class Diver Badge", "first_class": "First Class Diver Badge",
        "salvage": "Salvage Diver Badge", "master": "Master Diver Badge",
        "special_operations": "Special Operations Diver Badge",
        "special_operations_supervisor": "Special Operations Diving Supervisor Badge",
    },
    "army_driver_and_mechanic_badge": {"default": "Driver and Mechanic Badge"},
    "army_expert_field_medical_badge": {"default": "Expert Field Medical Badge"},
    "army_expert_infantryman_badge": {"default": "Expert Infantryman Badge"},
    "army_expert_soldier_badge": {"default": "Expert Soldier Badge"},
    "army_explosive_ordnance_disposal_badge": {
        "basic": "Explosive Ordnance Disposal Badge", "senior": "Senior Explosive Ordnance Disposal Badge",
        "master": "Master Explosive Ordnance Disposal Badge",
    },
    "army_flight_surgeon_badge": {
        "basic": "Flight Surgeon Badge", "senior": "Senior Flight Surgeon Badge", "master": "Master Flight Surgeon Badge"
    },
    "army_glider_badge": {"default": "Glider Badge"},
    "army_parachutist_badge": {
        "basic": "Parachutist Badge", "senior": "Senior Parachutist Badge", "master": "Master Parachutist Badge"
    },
    "army_military_freefall_parachutist_badge": {
        "basic": "Military Freefall Parachutist Basic Badge", "jumpmaster": "Military Freefall Parachutist Jumpmaster Badge"
    },
    "army_parachute_rigger_badge": {"default": "Parachute Rigger Badge"},
    "army_pathfinder_badge": {"default": "Pathfinder Badge"},
    "army_mariner_badge": {"basic": "Mariner Badge", "senior": "Mariner Senior Badge", "master": "Mariner Master Badge"},
    "army_space_badge": {"basic": "Space Badge", "senior": "Senior Space Badge", "master": "Master Space Badge"},
    "army_marksmanship_badge": {
        "marksman": "Marksmanship Badge", "sharpshooter": "Sharpshooter Marksmanship Badge", "expert": "Expert Marksmanship Badge"
    },
    "army_career_counselor_identification_badge": {"default": "Army Career Counselor Identification Badge"},
    "army_staff_identification_badge": {"default": "Army Staff Identification Badge"},
    "army_drill_sergeant_identification_badge": {"default": "Drill Sergeant Identification Badge"},
    "army_tomb_guard_identification_badge": {"default": "Guard, Tomb of the Unknown Soldier Identification Badge"},
    "army_instructor_identification_badge": {
        "basic": "Instructor Identification Badge", "senior": "Senior Instructor Identification Badge",
        "master": "Master Instructor Identification Badge",
    },
    "army_master_gunner_identification_badge": {"default": "Master Gunner Identification Badge"},
    "army_military_horseman_identification_badge": {"default": "Military Horseman Identification Badge"},
    "army_retired_service_identification_badge": {"default": "Retired Service Identification Badge"},
    "army_recruiter_identification_badge": {
        "basic": "U.S. Army Recruiter Identification Badge", "master": "U.S. Army Master Recruiter Identification Badge"
    },
}


def fetch(url: str) -> bytes:
    result = subprocess.run(
        ["curl.exe", "-L", "--fail", "--silent", "--show-error", "--max-time", "45", url],
        check=True, capture_output=True,
    )
    return result.stdout


def official_images(page: str) -> dict[str, str]:
    pattern = re.compile(r'<img\s+alt="([^"]+)"[^>]+(?:data-src-large|src)="([^"]+\.jpg)"', re.I)
    found = {}
    for name, src in pattern.findall(page):
        name = html.unescape(name.strip())
        url = urllib.parse.urljoin(PAGE, src)
        if name not in found or "_large.jpg" in url:
            found[name] = url
    return found


def transparent_badge(source: bytes, size=(256, 160)) -> Image.Image:
    image = Image.open(io.BytesIO(source)).convert("RGBA")
    pixels = image.load()
    width, height = image.size

    def background(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return min(r, g, b) >= 241 and max(r, g, b) - min(r, g, b) <= 18

    queue = deque()
    seen = set()
    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not background(x, y):
            continue
        seen.add((x, y))
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        if x: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))

    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("official image became empty during background removal")
    crop = image.crop(bbox)
    crop.thumbnail((size[0] - 16, size[1] - 16), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(crop, ((size[0] - crop.width) // 2, (size[1] - crop.height) // 2))
    return canvas


def main() -> None:
    page = fetch(PAGE).decode("utf-8", errors="replace")
    images = official_images(page)
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    badges = {badge["id"]: badge for badge in catalog["badges"]}
    records = []
    missing = []
    for badge_id, variants in FAMILIES.items():
        badge = badges[badge_id]
        imported = {}
        for variant, official_name in variants.items():
            url = images.get(official_name)
            if not url:
                missing.append({"badgeId": badge_id, "variant": variant, "officialName": official_name})
                continue
            relative = Path("images") / "military-badges" / "army" / badge_id / f"{variant}.png"
            output = ROOT / relative
            output.parent.mkdir(parents=True, exist_ok=True)
            if not output.exists():
                transparent_badge(fetch(url)).save(output, optimize=True)
            representation = {
                "status": "AVAILABLE", "available": True, "asset": relative.as_posix(),
                "verificationStatus": "OFFICIALLY_VERIFIED", "source": url,
            }
            imported[variant] = representation
            records.append({"badgeId": badge_id, "variant": variant, "officialName": official_name, "source": url, "asset": relative.as_posix()})
        if not imported:
            continue
        selectable_variants = [variant for variant in variants if variant != "default" and variant in imported]
        if selectable_variants and not badge.get("variants"):
            badge["variants"] = selectable_variants
        default_variant = next((variant for variant in (badge.get("variants") or []) if variant in imported), next(iter(imported)))
        default = imported[default_variant]
        badge["representations"]["metal"] = {**default, "defaultVariant": default_variant, "variants": imported}

    CATALOG.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "source": PAGE, "sourceType": "OFFICIAL_SERVICE_ARTWORK", "accessed": date.today().isoformat(),
        "licenseNote": "Official U.S. Army imagery; retain source attribution and applicable DoD marks/insignia limitations.",
        "canvas": {"width": 256, "height": 160, "format": "transparent PNG"},
        "imported": records, "missing": missing,
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"importedVariants": len(records), "families": len({record['badgeId'] for record in records}), "missing": missing}, indent=2))


if __name__ == "__main__":
    main()
