#!/usr/bin/env python3
"""Import high-confidence naval-service badge artwork copies from Wikimedia Commons.

MyNavyHR is the regulatory authority and remains the catalog source. Its CDN
blocks unattended downloads, so this importer uses freely licensed/public-domain
copies only when the Commons filename strongly matches an explicit catalog
family/variant. Ambiguous searches remain MISSING_ASSET.
"""

from __future__ import annotations

import io
import json
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BADGES_PATH = ROOT / "data" / "military" / "badges.json"
MANIFEST_PATH = ROOT / "data" / "imports" / "commons_navy_badges.json"
OUT_ROOTS = {
    "navy": ROOT / "images" / "military-badges" / "navy",
    "marine-corps": ROOT / "images" / "military-badges" / "marine-corps",
    "coast-guard": ROOT / "images" / "military-badges" / "coast-guard",
}
API = "https://commons.wikimedia.org/w/api.php"
OFFICIAL_SOURCE = "https://www.mynavyhr.navy.mil/References/US-Navy-Uniforms/Uniform-Regulations/Chapter-5/5201-Breast-Insignia/"
USER_AGENT = "CAP-Uniform-Builder/1.0 (asset provenance audit)"
ALLOWED_LICENSE_MARKERS = ("public domain", "cc0", "cc by", "cc-by")
COMPOSITE_ASSET_MARKERS = (
    "integrated_undersea_surveillance_system_insignia",
    "navy_security_force_insignias",
    "navy_seabee_combat_warfare_specialist_insignia",
    "submarine_patrol_insignia",
)

QUERY_OVERRIDES = {
    "navy_aviator_insignia": {"default": "Naval Aviator Badge"},
    "navy_flight_officer_insignia": {"default": "Naval Flight Officer Badge"},
    "navy_enlisted_aviation_warfare_specialist_insignia": {"default": "Enlisted Aviation Warfare Specialist Badge"},
    "navy_aviation_supply_corps_insignia": {"default": "Naval Aviation Supply Corps insignia"},
    "navy_aircrew_warfare_specialist_insignia": {"default": "Naval Aircrew Warfare Specialist Badge"},
    "navy_marine_corps_combat_aircrew_insignia": {"base": "Marine Corps Combat Aircrew Badge"},
    "navy_marine_corps_combatant_diver_insignia": {"default": "Marine Corps Combatant Diver Badge"},
    "navy_parachutist_insignia": {"navy_marine_corps_parachutist": "Navy Marine Corps Parachutist Badge"},
    "navy_explosive_ordnance_disposal_insignia": {
        "officer": "Explosive Ordnance Disposal Officer Badge Navy",
        "basic": "Basic Explosive Ordnance Disposal Badge Navy",
        "senior": "Senior Explosive Ordnance Disposal Badge Navy",
        "master": "Master Explosive Ordnance Disposal Badge Navy",
    },
    "navy_fleet_marine_force_insignia": {
        "officer": "Fleet Marine Force Officer Insignia",
        "chaplain": "Fleet Marine Force Chaplain Insignia",
        "enlisted": "Fleet Marine Force Enlisted Warfare Specialist Insignia",
    },
    "navy_information_warfare_insignia": {
        "officer": "Information Warfare Officer Badge Navy",
        "enlisted": "Enlisted Information Warfare Specialist Badge",
    },
    "navy_special_warfare_insignia": {"default": "Special Warfare insignia SEAL Badge"},
    "navy_special_warfare_combatant_craft_crewman_insignia": {
        "basic": "Special Warfare Combatant Craft Crewman Badge",
        "senior": "Senior Special Warfare Combatant Craft Crewman Badge",
        "master": "Master Special Warfare Combatant Craft Crewman Badge",
    },
    "navy_submarine_warfare_insignia": {
        "officer": "Submarine Warfare Officer Badge",
        "enlisted": "Submarine Warfare Enlisted Badge",
        "medical": "Submarine Medical Badge",
        "engineering_duty": "Submarine Engineering Duty Badge",
        "supply": "Submarine Supply Corps Badge",
        "deep_submergence_officer": "Deep Submergence Officer Badge",
        "deep_submergence_enlisted": "Deep Submergence Enlisted Badge",
    },
    "navy_surface_warfare_insignia": {
        "officer": "Surface Warfare Officer Badge",
        "enlisted": "Enlisted Surface Warfare Specialist Badge",
        "dental": "Surface Warfare Dental Corps Badge",
        "medical": "Surface Warfare Medical Corps Badge",
        "medical_service": "Surface Warfare Medical Service Corps Badge",
        "nurse": "Surface Warfare Nurse Corps Badge",
        "supply": "Surface Warfare Supply Corps Badge",
    },
    "navy_diving_insignia": {
        "diving_officer": "Navy Diving Officer Badge",
        "master_diver": "Navy Master Diver Badge",
        "diving_officer_medical": "Navy Diving Medical Officer Badge",
        "diving_medical_technician": "Navy Diving Medical Technician Badge",
        "first_class_diver": "Navy First Class Diver Badge",
        "second_class_diver": "Navy Second Class Diver Badge",
        "scuba_diver": "Navy Scuba Diver Badge",
    },
    "marine_corps_aerial_navigator_insignia": {"default": "Marine Aerial Navigator Badge"},
    "marine_corps_naval_aviation_observer_insignia": {"default": "Naval Aviation Observer Badge"},
    "marine_corps_unmanned_aircraft_system_insignia": {
        "officer": "Marine Unmanned Aircraft System Officer Badge",
        "enlisted_operator": "Marine Unmanned Aircraft System Operator Badge",
    },
    "marine_corps_flight_surgeon_insignia": {"default": "Naval Flight Surgeon Badge"},
    "marine_corps_special_operator_insignia": {"default": "Marine Special Operator Insignia"},
}

# Exact catalog-family searches for the remaining documented naval-service
# gaps.  These labels are deliberately narrow; the confidence and licensing
# gates below still reject portraits, ceremonies, manuals, and ambiguous art.
QUERY_OVERRIDES.update({
    "navy_astronaut_insignia": {"default": "United States Navy Astronaut Badge"},
    "navy_aviation_observer_insignia": {"default": "Naval Aviation Observer Badge"},
    "navy_flight_medical_insignia": {"default": "Naval Flight Surgeon Badge"},
    "navy_aviation_science_insignia": {"default": "Naval Aviation Science Badge"},
    "navy_professional_aviation_maintenance_officer_insignia": {"default": "Professional Aviation Maintenance Officer Badge"},
    "navy_aerial_vehicle_pilot_insignia": {"default": "Navy Aerial Vehicle Pilot Badge"},
    "navy_engineering_duty_officer_insignia": {"default": "Navy Engineering Duty Officer Badge"},
    "navy_expeditionary_warfare_insignia": {"default": "Navy Expeditionary Warfare Specialist Badge"},
    "navy_integrated_undersea_surveillance_insignia": {"default": "Integrated Undersea Surveillance Badge"},
    "navy_security_force_insignia": {"default": "Navy Security Force Badge"},
    "navy_nuclear_weapons_security_insignia": {"default": "Navy Nuclear Weapons Security Badge"},
    "navy_seabee_combat_warfare_insignia": {"default": "Seabee Combat Warfare Specialist Badge"},
    "navy_small_craft_insignia": {"default": "Navy Small Craft Insignia"},
    "navy_special_operations_warfare_insignia": {"default": "Navy Special Operations Warfare Badge"},
    "navy_strategic_sealift_officer_warfare_insignia": {"default": "Strategic Sealift Officer Warfare Insignia"},
    "navy_submarine_patrol_insignia": {"default": "Navy Submarine Patrol Insignia"},
    "navy_surface_chaplain_qualification_insignia": {"default": "Surface Warfare Chaplain Badge"},
    "marine_corps_astronaut_insignia": {"default": "United States Marine Corps Astronaut Badge"},
    "marine_corps_explosive_ordnance_disposal_insignia": {"default": "Marine Corps Explosive Ordnance Disposal Badge"},
    "marine_corps_diver_insignia": {"default": "Marine Corps Diver Badge"},
    "marine_corps_rifle_qualification_badge": {"default": "Marine Corps Rifle Qualification Badge"},
    "marine_corps_pistol_qualification_badge": {"default": "Marine Corps Pistol Qualification Badge"},
    "marine_corps_competition_marksmanship_badge": {"default": "Marine Corps Competition Marksmanship Badge"},
    "coast_guard_aviator_insignia": {"default": "Coast Guard Aviator Badge"},
    "coast_guard_air_crew_insignia": {"default": "Coast Guard Aircrew Badge"},
    "coast_guard_flight_officer_insignia": {"default": "Coast Guard Flight Officer Badge"},
    "coast_guard_flight_surgeon_insignia": {"default": "Coast Guard Flight Surgeon Badge"},
    "coast_guard_aviation_rescue_swimmer_insignia": {"default": "Coast Guard Aviation Rescue Swimmer Badge"},
    "coast_guard_astronaut_insignia": {"default": "Coast Guard Astronaut Badge"},
    "coast_guard_aviation_mission_specialist_insignia": {"default": "Coast Guard Aviation Mission Specialist Badge"},
    "coast_guard_cutterman_insignia": {"default": "Coast Guard Cutterman Insignia"},
    "coast_guard_boat_force_operations_insignia": {"default": "Coast Guard Boat Force Operations Insignia"},
    "coast_guard_coxswain_insignia": {"default": "Coast Guard Coxswain Insignia"},
    "coast_guard_enlisted_expeditionary_warfare_specialist_insignia": {"default": "Coast Guard Enlisted Expeditionary Warfare Specialist Badge"},
    "coast_guard_surfman_insignia": {"default": "Coast Guard Surfman Badge"},
    "coast_guard_scuba_diver_insignia": {"default": "Coast Guard Scuba Diver Badge"},
    "coast_guard_diver_insignia": {"default": "Coast Guard Diver Badge"},
    "coast_guard_port_security_insignia": {"default": "Coast Guard Port Security Badge"},
    "coast_guard_marine_safety_insignia": {"default": "Coast Guard Marine Safety Insignia"},
    "coast_guard_tactical_law_enforcement_insignia": {"default": "Coast Guard Tactical Law Enforcement Badge"},
    "coast_guard_ceremonial_honor_guard_insignia": {"default": "Coast Guard Ceremonial Honor Guard Badge"},
    "coast_guard_company_commander_insignia": {"default": "Coast Guard Company Commander Badge"},
    "coast_guard_physician_assistant_nurse_practitioner_insignia": {"default": "Coast Guard Physician Assistant Nurse Practitioner Badge"},
    "coast_guard_command_device": {"default": "Coast Guard Command Afloat Ashore Device"},
})

STOP = {"badge", "insignia", "navy", "naval", "united", "states", "us", "the", "and"}


def request_json(params: dict) -> dict:
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(2):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                result = json.load(response)
            time.sleep(0.75)
            return result
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 1:
                raise
            time.sleep(5)
    raise RuntimeError("Commons API retry loop exhausted")


def download(title: str) -> bytes:
    filename = re.sub(r"^File:", "", title, flags=re.I)
    url = "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + urllib.parse.quote(filename)
    result = subprocess.run(
        ["curl.exe", "-L", "--silent", "--show-error", "--fail", "--connect-timeout", "15", "--max-time", "45",
         "--retry", "2", "--retry-all-errors", "--retry-delay", "2", "--user-agent", USER_AGENT, url],
        check=True, capture_output=True,
    )
    time.sleep(0.75)
    return result.stdout


def normalized_tokens(value: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", value.lower().replace("nfo", "flight officer").replace("eaws", "enlisted aviation warfare specialist"))
    return {word for word in words if len(word) > 2 and word not in STOP}


def candidate_score(query: str, title: str) -> float:
    clean_title = re.sub(r"^File:|\.[A-Za-z0-9]{2,5}$", "", title, flags=re.I)
    query_tokens, title_tokens = normalized_tokens(query), normalized_tokens(clean_title)
    overlap = len(query_tokens & title_tokens) / max(1, len(query_tokens))
    sequence = SequenceMatcher(None, query.lower(), clean_title.lower()).ratio()
    penalty_terms = (
        "uniforms", "manual", "poster", "portrait", "world war", "receives", "waits to receive",
        "ceremony", "memorial", "late husband", "hospital corpsman", "seaman jacob", " during ",
        "presents a", "presented a", "receiving a", "awarded a",
    )
    penalty = 0.65 if any(word in clean_title.lower() for word in penalty_terms) else 0
    return overlap * 0.75 + sequence * 0.25 - penalty


def search(query: str) -> list[dict]:
    result = request_json({
        "action": "query", "generator": "search", "gsrsearch": query,
        "gsrnamespace": 6, "gsrlimit": 10, "prop": "imageinfo",
        "iiprop": "url|mime|size|extmetadata", "format": "json",
    })
    candidates = []
    for page in result.get("query", {}).get("pages", {}).values():
        info = (page.get("imageinfo") or [{}])[0]
        metadata = info.get("extmetadata") or {}
        license_name = (metadata.get("LicenseShortName") or {}).get("value", "")
        usage_terms = (metadata.get("UsageTerms") or {}).get("value", "")
        license_text = f"{license_name} {usage_terms}".lower()
        if not any(marker in license_text for marker in ALLOWED_LICENSE_MARKERS):
            continue
        if not str(info.get("mime", "")).startswith("image/") or info.get("mime") == "image/svg+xml":
            continue
        candidate = {
            "title": page.get("title", ""), "url": info.get("url"),
            "descriptionUrl": info.get("descriptionurl"), "width": info.get("width"),
            "height": info.get("height"), "mime": info.get("mime"),
            "license": license_name or usage_terms,
        }
        # High-resolution JPEG search results are almost always event photographs,
        # not isolated insignia art. Keep them out even when their captions closely
        # match the requested badge name.
        if candidate["mime"] == "image/jpeg" and max(candidate.get("width") or 0, candidate.get("height") or 0) > 1200:
            continue
        candidate["score"] = round(candidate_score(query, candidate["title"]), 4)
        candidates.append(candidate)
    return sorted(candidates, key=lambda item: item["score"], reverse=True)


def transparent_canvas(data: bytes) -> Image.Image:
    source = Image.open(io.BytesIO(data)).convert("RGBA")
    pixels = source.load()
    queue, seen = [], set()
    for x in range(source.width):
        queue.extend(((x, 0), (x, source.height - 1)))
    for y in range(source.height):
        queue.extend(((0, y), (source.width - 1, y)))
    while queue:
        x, y = queue.pop()
        if (x, y) in seen or not (0 <= x < source.width and 0 <= y < source.height):
            continue
        seen.add((x, y))
        red, green, blue, alpha = pixels[x, y]
        if alpha and min(red, green, blue) >= 238 and max(red, green, blue) - min(red, green, blue) <= 14:
            pixels[x, y] = (red, green, blue, 0)
            queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    # Remove pale antialiasing connected to the cleared background without
    # stripping neutral silver highlights from the interior of the insignia.
    # Repeating the one-pixel boundary pass handles the two-to-three-pixel
    # white halos common in otherwise valid isolated Commons artwork.
    for _ in range(3):
        alpha_snapshot = source.getchannel("A")
        alpha_pixels = alpha_snapshot.load()
        changes = []
        for y in range(source.height):
            for x in range(source.width):
                red, green, blue, alpha = pixels[x, y]
                if not alpha or min(red, green, blue) < 190 or max(red, green, blue) - min(red, green, blue) > 24:
                    continue
                touches_clear = any(
                    0 <= nx < source.width and 0 <= ny < source.height and alpha_pixels[nx, ny] < 48
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
                )
                if touches_clear:
                    cleaned_alpha = min(alpha, max(0, (238 - min(red, green, blue)) * 5))
                    changes.append((x, y, cleaned_alpha))
        for x, y, cleaned_alpha in changes:
            red, green, blue, _ = pixels[x, y]
            pixels[x, y] = (red, green, blue, cleaned_alpha)
    alpha = source.getchannel("A")
    box = alpha.getbbox()
    if box:
        source = source.crop(box)
    canvas = Image.new("RGBA", (256, 160), (0, 0, 0, 0))
    source.thumbnail((236, 140), Image.Resampling.LANCZOS)
    canvas.alpha_composite(source, ((256 - source.width) // 2, (160 - source.height) // 2))
    return canvas


def main() -> None:
    catalog = json.loads(BADGES_PATH.read_text(encoding="utf-8"))
    by_id = {badge["id"]: badge for badge in catalog["badges"]}
    prior_manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8")) if MANIFEST_PATH.exists() else {}
    prior_imports = {
        (entry.get("badgeId"), entry.get("variant")): entry
        for entry in prior_manifest.get("imported", [])
    }
    imported, rejected = [], []

    def checkpoint() -> None:
        """Persist accepted/rejected work so an interrupted API pass can resume."""
        BADGES_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        manifest = {
            "officialCatalogSources": sorted({
                source
                for catalog_badge_id in QUERY_OVERRIDES
                if catalog_badge_id in by_id
                for source in (by_id[catalog_badge_id].get("sources") or [OFFICIAL_SOURCE])[:1]
            }),
            "artworkRepository": "https://commons.wikimedia.org/",
            "policy": "Only freely licensed/public-domain candidates scoring at least 0.76 are imported; ambiguous results remain missing.",
            "canvas": {"width": 256, "height": 160, "format": "transparent PNG"},
            "imported": imported,
            "rejected": rejected,
        }
        MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    for badge_id, variants in QUERY_OVERRIDES.items():
        if badge_id not in by_id:
            rejected.append({"badgeId": badge_id, "error": "Badge id is not present in the regulatory catalog"})
            checkpoint()
            continue
        badge = by_id[badge_id]
        official_source = (badge.get("sources") or [OFFICIAL_SOURCE])[0]
        service_folder = (
            "marine-corps" if badge_id.startswith("marine_corps_")
            else "coast-guard" if badge_id.startswith("coast_guard_")
            else "navy"
        )
        metal = badge.setdefault("representations", {}).setdefault("metal", {})
        variant_records = metal.setdefault("variants", {})
        for stale_variant, stale_record in list(variant_records.items()):
            source = str(stale_record.get("assetSource", "")).lower()
            if stale_record.get("verificationStatus") == "OFFICIALLY_DOCUMENTED_THIRD_PARTY_COPY" and any(
                marker in source for marker in (
                    "receives_the_badge", "memorial_service", "late_husband", "waits_to_receive", "hospital_corpsman",
                    "presents_a", "presented_a", "receiving_a", "awarded_a", *COMPOSITE_ASSET_MARKERS
                )
            ):
                existing_asset = stale_record.get("asset")
                if existing_asset:
                    (ROOT / existing_asset).unlink(missing_ok=True)
                del variant_records[stale_variant]
                continue
        for variant, query in variants.items():
            existing = variant_records.get(variant, {})
            existing_asset = existing.get("asset")
            if existing.get("status") == "AVAILABLE" and existing_asset and (ROOT / existing_asset).exists():
                imported.append(prior_imports.get((badge_id, variant), {
                    "badgeId": badge_id, "variant": variant, "query": query,
                    "asset": existing_asset, "title": "Previously reviewed local asset",
                    "descriptionUrl": existing.get("assetSource"),
                    "license": existing.get("license"), "score": 1.0,
                }))
                continue
            print(f"{badge_id}:{variant}", flush=True)
            try:
                candidates = search(query)
            except Exception as error:
                rejected.append({"badgeId": badge_id, "variant": variant, "query": query, "error": str(error)})
                checkpoint()
                continue
            best = candidates[0] if candidates else None
            if not best or best["score"] < 0.76 or not best.get("url"):
                rejected.append({"badgeId": badge_id, "variant": variant, "query": query, "candidates": candidates[:3]})
                checkpoint()
                continue
            normalized_title = re.sub(r"[^a-z0-9]+", "_", best.get("title", "").lower())
            if any(marker in normalized_title for marker in COMPOSITE_ASSET_MARKERS):
                rejected.append({
                    "badgeId": badge_id, "variant": variant, "query": query,
                    "candidate": best, "error": "candidate is a multi-insignia catalog plate",
                })
                checkpoint()
                continue
            try:
                destination = OUT_ROOTS[service_folder] / badge_id / f"{variant}.png"
                destination.parent.mkdir(parents=True, exist_ok=True)
                data = destination.read_bytes() if destination.exists() else download(best["title"])
                transparent_canvas(data).save(destination, "PNG", optimize=True)
            except Exception as error:
                destination.unlink(missing_ok=True)
                rejected.append({"badgeId": badge_id, "variant": variant, "query": query, "candidate": best, "error": str(error)})
                checkpoint()
                continue
            asset = destination.relative_to(ROOT).as_posix()
            record = {
                "status": "AVAILABLE", "available": True, "asset": asset,
                "verificationStatus": "OFFICIALLY_DOCUMENTED_THIRD_PARTY_COPY",
                "officialSource": official_source, "assetSource": best["descriptionUrl"],
                "license": best["license"],
            }
            variant_records[variant] = record
            imported.append({"badgeId": badge_id, "variant": variant, "query": query, **best, "asset": asset})
            # Make a newly accepted family usable immediately even if the API
            # interrupts the process before the remaining variants are queried.
            if metal.get("status") != "AVAILABLE":
                metal.update({key: value for key, value in record.items() if key != "license"})
                metal["defaultVariant"] = variant
                metal["variants"] = variant_records
            checkpoint()
        available_variants = {variant: record for variant, record in variant_records.items() if record.get("status") == "AVAILABLE"}
        if available_variants:
            default_variant = next((variant for variant in variants if variant in available_variants), next(iter(available_variants)))
            default = available_variants[default_variant]
            metal.update({key: value for key, value in default.items() if key != "license"})
            metal["defaultVariant"] = default_variant
            metal["variants"] = variant_records
        elif metal.get("verificationStatus") == "OFFICIALLY_DOCUMENTED_THIRD_PARTY_COPY":
            metal.clear()
            metal.update({"status": "MISSING_ASSET", "available": False, "asset": None})
    checkpoint()
    print(json.dumps({"imported": len(imported), "rejected": len(rejected)}, indent=2))


if __name__ == "__main__":
    main()
