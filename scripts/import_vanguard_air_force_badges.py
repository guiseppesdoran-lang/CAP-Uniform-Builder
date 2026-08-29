#!/usr/bin/env python3
"""Import Air Force metal-badge references and normalize them for runtime use.

Vanguard is used only as a product/catalog discovery reference. The source
photograph is background-masked, smoothed, desaturated, and posterized into a
deterministic digital silver rendering before it is written to the repository.
The runtime never points to the commercial source image.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import subprocess
from collections import deque
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "military" / "badges.json"
MANIFEST = ROOT / "data" / "imports" / "vanguard_air_force_badges.json"
OUT = ROOT / "images" / "military-badges" / "air-force"
COLLECTION = "https://www.vanguardmil.com/collections/badges/products.json?limit=250&page={}"


# Search names intentionally follow Vanguard's public product terminology.
FAMILIES = {
    "presidential_service_badge": {"default": "presidential service"},
    "vice_presidential_service_badge": {"default": "vice presidential service"},
    "headquarters_air_force_identification_badge": {"default": "air staff identification"},
    "air_force_pilot_badge": {
        "pilot": "pilot", "senior_pilot": "senior pilot", "command_pilot": "command pilot"
    },
    "air_force_remotely_piloted_aircraft_pilot_badge": {
        "basic": "unmanned aircraft systems basic", "senior": "unmanned aircraft systems senior",
        "command": "unmanned aircraft systems master",
    },
    "air_force_combat_systems_officer_badge": {
        "basic": "navigator", "senior": "navigator senior", "master": "navigator master",
    },
    "air_force_air_battle_manager_badge": {
        "basic": "air battle manager", "senior": "senior air battle manager", "master": "master air battle manager"
    },
    "air_force_observer_badge": {
        "basic": "observer", "senior": "senior observer", "master": "master observer"
    },
    "air_force_flight_surgeon_badge": {
        "basic": "flight surgeon", "senior": "senior flight surgeon", "chief": "chief flight surgeon"
    },
    "air_force_flight_nurse_badge": {
        "basic": "flight nurse", "senior": "senior flight nurse", "chief": "chief flight nurse"
    },
    "air_force_officer_aircrew_badge": {
        "basic": "officer aircrew", "senior": "senior officer aircrew", "master": "master officer aircrew"
    },
    "air_force_enlisted_aircrew_badge": {
        "basic": "aircrew", "senior": "senior aircrew", "chief": "chief aircrew"
    },
    "air_force_missile_operations_badge": {
        "basic": "missile operator", "senior": "senior missile operator", "master": "master missile operator"
    },
    "air_force_space_badge": {
        "basic": "space basic", "senior": "space senior", "command": "space master"
    },
    "air_force_cyberspace_operations_badge": {
        "basic": "basic cyberspace operator", "senior": "senior cyberspace operator",
        "master": "master cyberspace operator",
    },
    "air_force_cyberspace_support_badge": {
        "basic": "cyberspace support basic", "senior": "cyberspace support senior", "master": "cyberspace support master"
    },
    "air_force_parachutist_badge": {
        "basic": "parachutist", "senior": "senior parachutist", "master": "master parachutist"
    },
    "air_force_explosive_ordnance_disposal_badge": {
        "basic": "explosive ordnance disposal", "senior": "senior explosive ordnance disposal",
        "master": "master explosive ordnance disposal",
    },
    "air_force_force_support_badge": {
        "basic": "force support", "senior": "force support senior", "master": "force support master"
    },
    "air_force_logistics_readiness_badge": {
        "basic": "logistics readiness", "senior": "logistics readiness senior", "master": "logistics readiness master"
    },
    "air_force_religious_affairs_badge": {
        "basic": "chaplain assistant", "senior": "chaplain assistant senior", "master": "chaplain assistant master"
    },
    "air_force_fire_protection_badge": {"default": "fire fighter"},
    "air_force_security_forces_badge": {"default": "security forces"},
    "air_force_judge_advocate_badge": {"default": "judge advocate general"},
    "air_force_acquisition_financial_management_badge": {
        "basic": "acquisition", "senior": "acquisition senior", "master": "acquisition master",
    },
    "air_force_paralegal_badge": {
        "basic": "paralegal", "senior": "senior paralegal", "master": "master paralegal"
    },
    "air_force_dental_badge": {
        "basic": "dentist", "senior": "dentist senior", "master": "dentist chief"
    },
    "air_force_enlisted_medical_badge": {
        "basic": "medical technician", "senior": "medical technician senior", "master": "medical technician master"
    },
    "air_force_intelligence_badge": {
        "basic": "intelligence", "senior": "intelligence senior", "master": "intelligence master"
    },
    "air_force_historian_badge": {
        "basic": "historian", "senior": "historian senior", "master": "historian master"
    },
    "air_force_information_management_badge": {
        "basic": "administration", "senior": "administration senior"
    },
    "air_force_operations_support_badge": {
        "basic": "operations support", "senior": "operations support senior", "master": "operations support master",
    },
    "air_force_medical_service_badge": {
        "basic": "medical service", "senior": "medical service senior", "master": "medical service chief"
    },
    "air_force_civil_engineer_readiness_badge": {
        "basic": "civil engineer readiness basic", "senior": "civil engineer readiness senior",
        "master": "civil engineer readiness master",
    },
}


def fetch(url: str) -> bytes:
    result = subprocess.run(
        ["curl.exe", "-L", "--fail", "--silent", "--show-error", "--max-time", "60", url],
        check=True, capture_output=True,
    )
    return result.stdout


def normalized(value: str) -> str:
    value = value.lower().replace("cyber space", "cyberspace")
    value = re.sub(r"\b(?:air force|usaf|badge|regulation|size|full|mirror|finish)\b", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


def products() -> list[dict]:
    result = []
    for page in range(1, 5):
        payload = json.loads(fetch(COLLECTION.format(page)))
        batch = payload.get("products", [])
        if not batch:
            break
        result.extend(batch)
    return result


def usable_product(product: dict) -> bool:
    title = product.get("title", "").lower()
    tags = {str(tag).lower() for tag in product.get("tags", [])}
    if "air force" not in title and product.get("product_type") != "Air Force":
        return False
    if any(word in title for word in ("embroidered", "ocp", "rotc", "academy")):
        return False
    return (
        "full size" in tags or "regulation" in title or "identification badge" in title
        or "midsize" in title or "mid-size" in title or "miniature" in title
    )


def match_product(candidates: list[dict], query: str) -> tuple[dict | None, float]:
    query_norm = normalized(query)
    query_tokens = set(query_norm.split())
    rating_words = {"basic", "senior", "master", "chief", "command"}
    query_rating = query_tokens & rating_words
    scored = []
    for product in candidates:
        title_norm = normalized(product.get("title", ""))
        title_tokens = set(title_norm.split())
        title_rating = title_tokens & rating_words
        if query_rating != title_rating:
            continue
        overlap = len(query_tokens & title_tokens) / max(1, len(query_tokens | title_tokens))
        sequence = SequenceMatcher(None, query_norm, title_norm).ratio()
        containment = 1.0 if query_tokens and query_tokens <= title_tokens else 0.0
        # Prefer regulation-size references, but permit midsize/miniature listings
        # when Vanguard has no regulation product for the same official design.
        source_quality = 0.30 if "regulation" in product.get("title", "").lower() else 0.10
        if "miniature" in product.get("title", "").lower():
            source_quality = 0.0
        score = containment * 2 + overlap + sequence + source_quality
        scored.append((score, product))
    if not scored:
        return None, 0.0
    score, product = max(scored, key=lambda item: item[0])
    return (product, score) if score >= 1.35 else (None, score)


def remove_edge_background(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size

    def background(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return min(r, g, b) >= 225 and max(r, g, b) - min(r, g, b) <= 24

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
        pixels[x, y] = (255, 255, 255, 0)
        if x: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))
    return image


def digital_silver(source: bytes, canvas=(320, 180)) -> Image.Image:
    image = remove_edge_background(Image.open(io.BytesIO(source)))
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("source became empty during background removal")
    image = image.crop(bbox)
    alpha = image.getchannel("A")
    gray = ImageOps.grayscale(image).filter(ImageFilter.MedianFilter(3))
    gray = ImageOps.autocontrast(gray, cutoff=(1, 1))
    gray = ImageEnhance.Contrast(gray).enhance(1.25)
    # Five cool-silver levels remove camera color casts and specular noise.
    levels = (56, 92, 132, 178, 224)
    gray = gray.point(lambda value: levels[min(4, value * 5 // 256)])
    silver = ImageOps.colorize(gray, black="#26313f", white="#f3f7fb").convert("RGBA")
    silver.putalpha(alpha)
    silver.thumbnail((canvas[0] - 16, canvas[1] - 16), Image.Resampling.LANCZOS)
    output = Image.new("RGBA", canvas, (0, 0, 0, 0))
    output.alpha_composite(silver, ((canvas[0] - silver.width) // 2, (canvas[1] - silver.height) // 2))
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="download, generate, and update the catalog")
    args = parser.parse_args()
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    badges = {badge["id"]: badge for badge in catalog["badges"]}
    candidates = [product for product in products() if usable_product(product)]
    proposed = []
    unmatched = []
    for badge_id, variants in FAMILIES.items():
        for variant, query in variants.items():
            product, score = match_product(candidates, query)
            if not product or not product.get("images"):
                unmatched.append({"badgeId": badge_id, "variant": variant, "query": query, "score": round(score, 3)})
                continue
            proposed.append({
                "badgeId": badge_id, "variant": variant, "query": query,
                "productTitle": product["title"], "productUrl": f"https://www.vanguardmil.com/products/{product['handle']}",
                "image": product["images"][0]["src"], "score": round(score, 3),
            })
    duplicate_sources = {}
    for record in proposed:
        duplicate_sources.setdefault(record["productUrl"], []).append(
            f"{record['badgeId']}:{record['variant']}"
        )
    duplicate_sources = {
        source: uses for source, uses in duplicate_sources.items() if len(uses) > 1
    }
    if duplicate_sources:
        raise SystemExit(
            "Refusing ambiguous import; product references were reused: "
            + json.dumps(duplicate_sources, indent=2)
        )
    if not args.apply:
        print(json.dumps({"candidateProducts": len(candidates), "proposed": proposed, "unmatched": unmatched}, indent=2))
        return

    imported = []
    for record in proposed:
        relative = Path("images") / "military-badges" / "air-force" / record["badgeId"] / f"{record['variant']}.png"
        output = ROOT / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        digital_silver(fetch(record["image"])).save(output, optimize=True)
        representation = {
            "status": "AVAILABLE", "available": True, "asset": relative.as_posix(),
            "verificationStatus": "CATALOG_CROSS_REFERENCED", "source": record["productUrl"],
            "style": "MCCHORD_DIGITAL_SILVER", "sourceImage": record["image"],
        }
        badge = badges[record["badgeId"]]
        metal = badge.setdefault("representations", {}).setdefault("metal", {})
        metal.setdefault("variants", {})[record["variant"]] = representation
        imported.append({**record, "asset": relative.as_posix()})

    for badge_id, variants in FAMILIES.items():
        badge = badges[badge_id]
        metal = badge["representations"]["metal"]
        imported_variants = metal.get("variants", {})
        default_variant = next((variant for variant in (badge.get("variants") or []) if variant in imported_variants), None)
        default_variant = default_variant or next(iter(imported_variants), None)
        if default_variant:
            metal.update(imported_variants[default_variant])
            metal["defaultVariant"] = default_variant
            metal["variants"] = imported_variants

    CATALOG.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    MANIFEST.write_text(json.dumps({
        "source": "https://www.vanguardmil.com/collections/badges",
        "sourceType": "COMMERCIAL_CATALOG_DISCOVERY_REFERENCE",
        "accessed": date.today().isoformat(),
        "runtimePolicy": "Source photographs are not used directly. Runtime assets are deterministic posterized digital derivatives.",
        "style": {"name": "MCCHORD_DIGITAL_SILVER", "canvas": [320, 180], "transparent": True},
        "imported": imported, "unmatched": unmatched,
    }, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"importedVariants": len(imported), "families": len({item['badgeId'] for item in imported}), "unmatched": unmatched}, indent=2))


if __name__ == "__main__":
    main()
