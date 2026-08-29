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

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

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


def match_products(catalog: list[dict], source_products: list[dict], required_keyword="miniature", service="AIR_FORCE") -> tuple[list[dict], list[dict]]:
    air_force_awards = {
        award["id"]: award for award in catalog
        if service in award.get("authorizedServices", [])
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
        award_id = DAF_TITLE_ALIASES.get(key) if service in {"AIR_FORCE", "SPACE_FORCE"} else None
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


def normalize_national_defense_palette(image: Image.Image) -> Image.Image:
    """Match the clean scarlet/gold/navy/white National Defense reference.

    The catalog photograph used for discovery has a heavy bronze cast. Preserve
    its engraved shading, but map the suspension ribbon and pendant to the
    colors visible on the supplied physical reference instead of retaining the
    product-photo white balance.
    """
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size

    def shaded(base: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
        return tuple(max(0, min(255, round(channel * factor))) for channel in base)

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if not a:
                continue
            luminance = 0.299 * r + 0.587 * g + 0.114 * b
            # Reconstruct the suspension ribbon from its official stripe
            # proportions. The source photo is too brown/dark for reliable hue
            # sampling, especially after posterization.
            triangle_inset = max(0, y - 84)
            ribbon_zone = y < 116 and triangle_inset <= x < width - triangle_inset
            if ribbon_zone:
                if x <= 16 or x >= 33:
                    base = (218, 24, 48)  # scarlet
                elif x in (17, 20, 29, 32):
                    base = (248, 247, 238)  # warm white
                elif x in (18, 19, 30, 31):
                    base = (20, 35, 78)  # navy
                else:
                    base = (245, 184, 28)  # golden yellow
                # A restrained two-line weave matches the McChord artwork
                # without reintroducing the catalog photo's color cast.
                nr, ng, nb = shaded(base, 0.91 if y % 2 else 1.0)
            elif y >= 96:
                # Keep relief and lettering legible while removing the brown
                # cast from the photographed pendant.
                gold_level = 128 + round(127 * max(0.0, min(1.0, luminance / 210.0)))
                nr = min(255, gold_level)
                ng = min(235, round(gold_level * 0.78))
                nb = min(118, round(gold_level * 0.30))
            else:
                continue
            pixels[x, y] = (nr, ng, nb, a)
    return image


def suspension_from_ribbon(ribbon: Image.Image, width: int, height: int) -> Image.Image:
    """Build a regulation-shaped suspension from reviewed ribbon colors.

    Ribbon-rack artwork is the authoritative stripe source. Sampling the middle
    row removes product-photo color casts while preserving the exact stripe
    sequence. The lower chevron matches the McChord miniature template.
    """
    ribbon = ribbon.convert("RGB").resize((width, 30), Image.Resampling.LANCZOS)
    stripe = ribbon.crop((0, 14, width, 15)).resize((width, height), Image.Resampling.NEAREST)
    weave = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    weave.alpha_composite(stripe.convert("RGBA"))
    pixels = weave.load()
    for y in range(height):
        factor = 0.90 if y % 2 else 1.0
        for x in range(width):
            r, g, b, a = pixels[x, y]
            pixels[x, y] = (round(r * factor), round(g * factor), round(b * factor), a)
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    chevron = min(28, height // 4)
    draw.polygon([(0, 0), (width, 0), (width, height - chevron), (width // 2, height), (0, height - chevron)], fill=255)
    weave.putalpha(mask)
    return weave


def pendant_from_source(source: bytes) -> Image.Image:
    image = remove_edge_background(Image.open(io.BytesIO(source)))
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("source became empty during background removal")
    image = image.crop(bbox)
    alpha = image.getchannel("A")
    width, height = image.size
    rows = [sum(1 for x in range(width) if alpha.getpixel((x, y)) > 24) for y in range(height)]
    search_start, search_end = max(1, int(height * 0.34)), max(2, int(height * 0.72))
    split = min(range(search_start, search_end), key=lambda y: rows[y])
    pendant = image.crop((0, max(0, split - 2), width, height))
    pendant_bbox = pendant.getchannel("A").getbbox()
    if not pendant_bbox:
        raise ValueError("pendant became empty during suspension split")
    return pendant.crop(pendant_bbox)


def digital_medal(source: bytes, award_id: str, canvas=(50, 176), ribbon: Image.Image | None = None, suspension_height: int | None = None) -> Image.Image:
    image = pendant_from_source(source)
    alpha = image.getchannel("A")
    rgb = image.convert("RGB").filter(ImageFilter.MedianFilter(3))
    rgb = ImageEnhance.Contrast(rgb).enhance(1.10)
    rgb = ImageEnhance.Color(rgb).enhance(1.08)
    # A 32-level channel posterization removes camera noise while retaining the
    # official suspension-ribbon colors and pendant details.
    rgb = ImageOps.posterize(rgb, 5).convert("RGBA")
    rgb.putalpha(alpha)
    suspension_height = suspension_height or (116 if canvas == (50, 176) else round(canvas[1] * 0.60))
    output = Image.new("RGBA", canvas, (0, 0, 0, 0))
    if ribbon is not None:
        output.alpha_composite(suspension_from_ribbon(ribbon, canvas[0], suspension_height))
    else:
        # Legacy fallback remains proportional; it never stretches a complete
        # photographed medal into the production canvas.
        fallback = remove_edge_background(Image.open(io.BytesIO(source)))
        fallback.thumbnail((canvas[0], suspension_height), Image.Resampling.LANCZOS)
        output.alpha_composite(fallback, ((canvas[0] - fallback.width) // 2, 0))
    available_height = canvas[1] - suspension_height + min(12, canvas[1] // 14)
    rgb.thumbnail((canvas[0], available_height), Image.Resampling.LANCZOS)
    pendant_y = canvas[1] - rgb.height
    output.alpha_composite(rgb, ((canvas[0] - rgb.width) // 2, pendant_y))
    if award_id == "national_defense_military_service":
        output = normalize_national_defense_palette(output)
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--award-id", help="Regenerate only one matched canonical award")
    args = parser.parse_args()

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    matches, unmatched = match_products(catalog, products())
    if args.award_id:
        matches = [match for match in matches if match["awardId"] == args.award_id]
    if not args.apply:
        print(json.dumps({"matched": matches, "unmatched": unmatched}, indent=2))
        return

    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    imported = []
    for match in matches:
        relative = Path("images") / "military-mini-medals" / "air-force" / f"{match['awardId']}.png"
        output = ROOT / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        award = next(item for item in catalog if item["id"] == match["awardId"])
        ribbon_asset = award.get("representations", {}).get("ribbon", {}).get("asset") or award.get("images", {}).get("ribbon")
        ribbon = Image.open(ROOT / ribbon_asset) if ribbon_asset and (ROOT / ribbon_asset).exists() else None
        digital_medal(fetch(match["image"]), match["awardId"], ribbon=ribbon).save(output, optimize=True)
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
    manifest_imported = imported
    manifest_unmatched = unmatched
    if args.award_id and MANIFEST.exists():
        existing_manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        replacements = {record["awardId"]: record for record in imported}
        manifest_imported = [
            replacements.pop(record.get("awardId"), record)
            for record in existing_manifest.get("imported", [])
        ]
        manifest_imported.extend(replacements.values())
        manifest_unmatched = existing_manifest.get("unmatched", [])
    MANIFEST.write_text(json.dumps({
        "source": "https://www.vanguardmil.com/collections/miniature-medals",
        "sourceType": "COMMERCIAL_CATALOG_DISCOVERY_REFERENCE",
        "regulatoryAuthority": "DAFMAN 36-2806, Attachment 2 and Attachment 16",
        "accessed": date.today().isoformat(),
        "style": "MCCHORD_DIGITAL_MEDAL",
        "canvas": [50, 176],
        "suspensionRibbonHeight": 116,
        "geometryPolicy": "Suspension ribbon and pendant are normalized independently; the photographed medal is never stretched as one image.",
        "imported": manifest_imported,
        "unmatched": manifest_unmatched,
    }, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"imported": len(imported), "unmatched": len(unmatched)}, indent=2))


if __name__ == "__main__":
    main()
