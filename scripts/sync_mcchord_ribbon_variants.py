"""Mirror McChord's senior ribbon dropdown variants (labels, values and how many ribbons each takes; the ribbons are the measured SVGs)."""

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import re
from html import unescape
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "mcchord-ribbon-variants.js"
SOURCE_FORM = "https://mcchord.org/rack_builder/check_sr.html"
GENERATOR = "https://www.mcchord.org/rack_builder/check_sr2.asp"

ID_BY_SOURCE_IMAGE = {
    "usaf_aam01.png": "air_force_aerial_achievement_medal",
    "silver01.png": "silver_medal_of_valor",
    "bronze01.png": "bronze_medal_of_valor",
    "distin01.png": "distinguished_service_award",
    "except01.png": "exceptional_service_award",
    "meriti01.png": "meritorious_service_award",
    "cmdrco01.png": "commander_commendation_award",
    "AA01.png": "cap_achievment_award",
    "lifesa01.png": "lifesaving_award",
    "unitci-nat01.png": "national_commander_unit_citation_award",
    "unitci01.png": "unit_citation_award",
    "wilson.png": "cap_gill_robb_wilson_ribbon",
    "garber.png": "cap_paul_e_garber_ribbon",
    "leader.png": "cap_leadership_ribbon",
    "cmdser.png": "cap_command_service_ribbon",
    "redser-02yr.png": "red_service_ribbon",
    "find01.png": "search_find_ribbon",
    "sar01.png": "air_search_and_rescue_ribbon",
    "coudru01.png": "cap_counterdrug_ribbon",
    "disast01.png": "disaster_relief_ribbon",
    "homeland01.png": "homeland_security_ribbon",
    "cadpil01.png": "cap_cadet_orientation_pilot_ribbon",
    "commun01.png": "community_service_ribbon",
    "ncc.png": "national_cadet_competition_ribbon",
    "ncgc01.png": "national_color_guard_competition_ribbon",
    "cac.png": "cadet_advisory_council_ribbon",
    "ncsa01.png": "cadet_special_activity_ribbon",
    "encamp01.png": "encampment_ribbon",
    "senrec01.png": "cap_senior_recruiter_ribbon",
    "airmedal.png": "air_medal",
}


def source_rows():
    with urlopen(SOURCE_FORM, timeout=30) as response:
        html = response.read().decode("utf-8", errors="replace")
    work = []
    for row_match in re.finditer(r"<tr\b[^>]*>(.*?)</tr>", html, re.I | re.S):
        row = row_match.group(1)
        select = re.search(r"<select\b[^>]*>(.*?)</select>", row, re.I | re.S)
        image = re.search(r"<img\b[^>]*\bsrc=[\"']([^\"']+)", row, re.I)
        if not select or not image:
            continue
        source_name = Path(urlparse(image.group(1)).path).name
        ribbon_id = ID_BY_SOURCE_IMAGE.get(source_name)
        if not ribbon_id:
            continue
        for option in re.finditer(r"<option\b[^>]*\bvalue=[\"']?([^\"' >]+)[^>]*>(.*?)</option>", select.group(1), re.I | re.S):
            code = option.group(1).strip()
            if not code or code == "0":
                continue
            label = unescape(re.sub(r"<[^>]+>", " ", option.group(2)))
            work.append((len(work), ribbon_id, code, " ".join(label.split())))
    return work


def fetch_variant(item):
    sequence, ribbon_id, code, label = item
    body = urlencode({"awards": code}).encode("ascii")
    request = Request(GENERATOR, data=body, method="POST")
    with urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8", errors="replace")
    urls = []
    for image in re.finditer(r"<img\b[^>]*\bsrc=[\"']([^\"']+)", html, re.I):
        src = urljoin(GENERATOR, image.group(1))
        if "/images/ribbons/s/" in src and src not in urls:
            urls.append(src)
    if not urls:
        raise RuntimeError(f"No ribbon output for {ribbon_id} option {code}")
    return sequence, ribbon_id, code, label, urls


def main():
    variants = {}
    work = source_rows()
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = [pool.submit(fetch_variant, item) for item in work]
        for future in as_completed(futures):
            sequence, ribbon_id, code, label, urls = future.result()
            option = {
                "label": label,
                "value": f"mcchord_{code}",
                "devices": {},
            }
            if len(urls) > 1:
                option["duplicates"] = [
                    {"awardLabel": f"{label} - additional ribbon"}
                    for url in urls[1:]
                ]
            variants.setdefault(ribbon_id, []).append((sequence, option))

    ordered = {
        ribbon_id: [option for _, option in sorted(options, key=lambda pair: pair[0])]
        for ribbon_id, options in sorted(variants.items())
    }
    payload = json.dumps(ordered, indent=2, ensure_ascii=True)
    OUTPUT.write_text(
        "// Generated from McChord's senior rack builder. Do not edit by hand.\n"
        f"globalThis.MCCHORD_RIBBON_VARIANTS = {payload};\n",
        encoding="utf-8",
    )
    print(f"Mirrored {sum(map(len, ordered.values()))} options for {len(ordered)} ribbons")


if __name__ == "__main__":
    main()
