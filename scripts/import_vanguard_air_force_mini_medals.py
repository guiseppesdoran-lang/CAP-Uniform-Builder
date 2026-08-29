#!/usr/bin/env python3
"""Import reviewed Air Force miniature-medal references as local digital assets.

Vanguard's public catalog is used only to identify the correct medal design. The
runtime never links to a remote product photo. Each source is background-masked,
color-normalized, lightly posterized, and fitted to the builder's 50 x 176 pixel
McChord miniature-medal canvas. Only conservative title matches are applied.
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
CATALOG = ROOT / "data" / "military" / "canonical-awards.json"
OVERRIDES = ROOT / "data" / "rules" / "verified" / "representation-overrides.json"
MANIFEST = ROOT / "data" / "imports" / "vanguard_air_force_mini_medals.json"
OUT = ROOT / "images" / "military-mini-medals" / "air-force"
COLLECTION = "https://www.vanguardmil.com/collections/miniature-medals/products.json?limit=250&page={}"

# Current product terminology differs from the current Department of the Air
# Force names. These aliases are deliberately narrow so similarly named medals
# cannot be silently merged.
DAF_TITLE_ALIASES = {
    "achievement": "air_and_space_achievement_medal",
    "aerial achievement": "aerial_achievement_medal",
    "air and space campaign": "air_and_space_campaign",
    "combat action": "air_force_combat_action",
    "combat readiness": "air_force_combat_readiness",
    "commendation": "air_and_space_commendation_medal",
    "distinguished service": "air_force_distinguishd_service",
    "good conduct": "air_force_good_condcut",
    "airman": "airmans_medal",
    "european african middle east campaign": "european_african_middle_eastern_campaign",
    "korea defense service": "korean_defense_service",
    "kuwait liberation government of kuwait": "kuwiat_liberation_kuwait",
    "military outstanding volunteer service": "outstanding_volunteer_service",
    "multinational force and observer": "multinational_force_and_observers",
    "national defense": "national_defense_military_service",
    "nuclear deterrence operations service": "nuclear_deterrence_operations_service_medal",
    "republic of korean war service no device": "korean_service",
    "remote combat effects campaign": "remote_combat_effects_campaign_medal",
    "vietnam campaign": "republic_of_vietnam_campaign",
    "wwii victory": "world_war_ii_victory",
}


def fetch(url: str) -> bytes:
    result = subprocess.run(
        ["curl.exe", "-L", "--fail", "--silent", "--show-error", "--max-time", "60", url],
        check=True,
        capture_output=True,
    )
    return result.stdout


def products() -> list[dict]:
    result = []
    for page in range(1, 5):
        batch = json.loads(fetch(COLLECTION.format(page))).get("products", [])
        if not batch:
            break
        result.extend(batch)
    return result


def normalized(value: str) -> str:
    value = value.lower().replace("&", " and ").replace("u.s.", " ")
    value = re.sub(r"\b(?:miniature|mini|medal|usaf|air force|full|24k|gold|plated|anodized|size)\b", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


def candidate_names(award: dict) -> set[str]:
    values = {award.get("id", ""), award.get("name", ""), award.get("officialName", "")}
    values.update(award.get("aliases", []))
    values.update(award.get("sourceIds", []))
    return {normalized(value) for value in values if normalized(value)}


def product_key(product: dict) -> str:
    return normalized(product.get("title", ""))


def score_name(product_name: str, award_names: set[str]) -> float:
    product_tokens = set(product_name.split())
    best = 0.0
    for name in award_names:
        name_tokens = set(name.split())
        if not name_tokens:
            continue
        exact = 2.0 if name == product_name else 0.0
        containment = 0.8 if name_tokens <= product_tokens or product_tokens <= name_tokens else 0.0
        overlap = len(name_tokens & product_tokens) / max(1, len(name_tokens | product_tokens))
        sequence = SequenceMatcher(None, name, product_name).ratio()
        best = max(best, exact + containment + overlap + sequence)
    return best


def match_products(catalog: list[dict], source_products: list[dict], required_keyword="miniature") -> tuple[list[dict], list[dict]]:
    air_force_awards = {
        award["id"]: award for award in catalog
        if "AIR_FORCE" in award.get("authorizedServices", [])
    }
    matches = []
    unmatched = []
    used_awards = set()
    for product in source_products:
        title = product.get("title", "")
        title_lower = title.lower()
        if required_keyword not in title_lower or not product.get("images"):
            continue
        if any(marker in title_lower for marker in ("24k", "gold plated", "mirror finish", "jrotc", "civil air patrol")):
            continue
        key = product_key(product)
        award_id = DAF_TITLE_ALIASES.get(key)
        score = 10.0 if award_id else 0.0
        if not award_id:
            scored = sorted(
                ((score_name(key, candidate_names(award)), candidate_id)
                 for candidate_id, award in air_force_awards.items()),
                reverse=True,
            )
            score, award_id = scored[0]
            runner_up = scored[1][0] if len(scored) > 1 else 0.0
            if score < 2.45 or score - runner_up < 0.30:
                unmatched.append({"title": title, "key": key, "score": round(score, 3), "runnerUp": round(runner_up, 3)})
                continue
        if award_id not in air_force_awards or award_id in used_awards:
            continue
        used_awards.add(award_id)
        matches.append({
            "awardId": award_id,
            "productTitle": title,
            "productUrl": f"https://www.vanguardmil.com/products/{product['handle']}",
            "image": product["images"][0]["src"],
            "score": round(score, 3),
        })
    return matches, unmatched


def remove_edge_background(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size

    def is_background(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return min(r, g, b) >= 220 and max(r, g, b) - min(r, g, b) <= 32

    queue = deque()
    seen = set()
    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not is_background(x, y):
            continue
        seen.add((x, y))
        pixels[x, y] = (255, 255, 255, 0)
        if x: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))
    return image


def digital_medal(source: bytes, canvas=(50, 176)) -> Image.Image:
    image = remove_edge_background(Image.open(io.BytesIO(source)))
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("source became empty during background removal")
    image = image.crop(bbox)
    alpha = image.getchannel("A")
    rgb = image.convert("RGB").filter(ImageFilter.MedianFilter(3))
    rgb = ImageEnhance.Contrast(rgb).enhance(1.10)
    rgb = ImageEnhance.Color(rgb).enhance(1.08)
    # A 32-level channel posterization removes camera noise while retaining the
    # official suspension-ribbon colors and pendant details.
    rgb = ImageOps.posterize(rgb, 5).convert("RGBA")
    rgb.putalpha(alpha)
    rgb.thumbnail((canvas[0], canvas[1] - 2), Image.Resampling.LANCZOS)
    output = Image.new("RGBA", canvas, (0, 0, 0, 0))
    output.alpha_composite(rgb, ((canvas[0] - rgb.width) // 2, 1))
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    matches, unmatched = match_products(catalog, products())
    if not args.apply:
        print(json.dumps({"matched": matches, "unmatched": unmatched}, indent=2))
        return

    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    imported = []
    for match in matches:
        relative = Path("images") / "military-mini-medals" / "air-force" / f"{match['awardId']}.png"
        output = ROOT / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        digital_medal(fetch(match["image"])).save(output, optimize=True)
        representation = {
            "status": "AVAILABLE",
            "available": True,
            "asset": relative.as_posix(),
            "verificationStatus": "CATALOG_CROSS_REFERENCED",
            "sources": [match["productUrl"]],
            "style": "MCCHORD_DIGITAL_MEDAL",
            "sourceImage": match["image"],
        }
        overrides.setdefault("awards", {}).setdefault(match["awardId"], {})["miniatureMedal"] = representation
        imported.append({**match, "asset": relative.as_posix()})

    OVERRIDES.write_text(json.dumps(overrides, indent=2) + "\n", encoding="utf-8")
    MANIFEST.write_text(json.dumps({
        "source": "https://www.vanguardmil.com/collections/miniature-medals",
        "sourceType": "COMMERCIAL_CATALOG_DISCOVERY_REFERENCE",
        "regulatoryAuthority": "DAFMAN 36-2806, Attachment 2 and Attachment 16",
        "accessed": date.today().isoformat(),
        "style": "MCCHORD_DIGITAL_MEDAL",
        "canvas": [50, 176],
        "imported": imported,
        "unmatched": unmatched,
    }, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"imported": len(imported), "unmatched": len(unmatched)}, indent=2))


if __name__ == "__main__":
    main()
