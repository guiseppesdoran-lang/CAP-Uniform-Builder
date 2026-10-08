"""Re-encode the uniform artwork to WebP at the size it is actually rendered.

The builder shipped 68 MB of PNG, and the badge art alone accounted for
26.3 MB of the first page load. Almost none of that resolution reaches the
screen: badge PNGs up to 2.2 MB are drawn about 60 px wide, and the device
art is 600x600 for a 10 px mark.

This script is deliberately a manual, committed step rather than a build
pipeline. The repo stays drop-in static, and the optimized files are what
gets served.

Typical use:

    python3 scripts/optimize-images.py --dry-run     # report, touch nothing
    python3 scripts/optimize-images.py --apply --rewrite-code
    python3 scripts/optimize-images.py --check       # CI-style budget check

Requires Pillow (`pip install Pillow`), the same way the other scripts in
this directory require pypdf.
"""

import argparse
import json
import re
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "images"
MANIFEST = Path(__file__).resolve().parent / "optimize-images.manifest.json"

SOURCE_SUFFIXES = {".png", ".jpg", ".jpeg"}

# Longest edge to keep, per image directory.
#
# Each budget is 4x the largest size that category is ever drawn at inside the
# 450x600 preview canvas (969.6x707.52 for field uniforms). Exports run through
# composeUniformPngCanvas at outputScale 2, so 4x leaves a full 2x of headroom
# over the highest-resolution output the app can produce.
#
# Render sizes are read straight out of index.html: RIBBON_WIDTH/HEIGHT,
# deviceMeta, customBadgeSizes, PATCH_META, MINI_H, DEFAULT/FIELD_RENDER_AREA.
BUDGETS = {
    "badges": 240,      # customBadgeSizes tops out at 60x60
    "patches": 800,     # PATCH_META tops out at 200x200
    "mini_medals": 200,  # mini medals draw 50 px tall
    "medals": 200,
    "devices": 64,       # deviceMeta is 10x10; floored at 64 for Phase 4 headroom
    "cords": 400,
    "insignia": 240,
    "nameplate": 400,
    "cutouts": 400,
    "base": 2400,        # canvas is at most 969.6x707.52; 600 tall for blues
}

# images/ribbons is intentionally absent. It holds 422 pre-rendered device
# variants that the runtime-compositing work removes outright, so converting
# them now would be churn on files that are about to be deleted - and the whole
# directory is only ~446 KB, under 2% of the problem.
SKIP_DIRS = {"ribbons"}

WEBP_QUALITY = 85
WEBP_METHOD = 6

# Files whose string literals reference image paths.
CODE_FILES = [
    "index.html",
    "mcchord-ribbon-variants.js",
    "ocp-patch-variants.js",
    "purchase-catalog.js",
    "purchase-feature-core.js",
    "admin-history.js",
]

# Paths built at runtime as `dir/${expr}.png`. Rewriting the literal extension
# in the template keeps the resolver's first candidate correct instead of
# letting every request 404 and fall through the filename-variant chain.
TEMPLATE_PATTERNS = [
    (re.compile(r"(`badges/\$\{[^}]+\})\.png(`)"), r"\1.webp\2"),
    (re.compile(r"(`patches/\$\{[^}]+\})\.png(`)"), r"\1.webp\2"),
    (re.compile(r"(`base/\$\{[^}]+\})\.png(`)"), r"\1.webp\2"),
]


def category_of(path: Path) -> str:
    """Top-level images/ subdirectory a file belongs to."""
    rel = path.relative_to(IMAGES)
    return rel.parts[0] if len(rel.parts) > 1 else ""


def iter_sources():
    for path in sorted(IMAGES.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SOURCE_SUFFIXES:
            continue
        category = category_of(path)
        if category in SKIP_DIRS or category not in BUDGETS:
            continue
        yield path, category


def target_size(image: Image.Image, budget: int):
    """New (w, h) capped at `budget` on the longest edge, or None to keep as-is."""
    longest = max(image.width, image.height)
    if longest <= budget:
        return None
    scale = budget / longest
    return max(1, round(image.width * scale)), max(1, round(image.height * scale))


def convert(path: Path, budget: int, apply: bool):
    """Re-encode one file. Returns a record of what happened."""
    before = path.stat().st_size
    with Image.open(path) as image:
        image.load()
        # WebP needs a mode it understands; preserve alpha wherever it exists.
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() or image.mode == "P" else "RGB")
        source_dims = (image.width, image.height)
        resized = target_size(image, budget)
        if resized:
            image = image.resize(resized, Image.LANCZOS)
        out_dims = (image.width, image.height)

        destination = path.with_suffix(".webp")
        if apply:
            image.save(
                destination,
                "WEBP",
                quality=WEBP_QUALITY,
                method=WEBP_METHOD,
                lossless=False,
            )
            after = destination.stat().st_size
            # Only drop the original once the replacement is on disk and the
            # name actually changed.
            if destination != path:
                path.unlink()
        else:
            import io

            buffer = io.BytesIO()
            image.save(buffer, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
            after = buffer.tell()

    return {
        "from": str(path.relative_to(ROOT)),
        "to": str(path.with_suffix(".webp").relative_to(ROOT)),
        "bytes_before": before,
        "bytes_after": after,
        "dims_before": f"{source_dims[0]}x{source_dims[1]}",
        "dims_after": f"{out_dims[0]}x{out_dims[1]}",
        "resized": bool(resized),
    }


def rewrite_code(records, apply: bool):
    """Point path literals at the converted files."""
    renames = {}
    for record in records:
        old = record["from"][len("images/"):]
        new = record["to"][len("images/"):]
        if old != new:
            renames[old] = new

    touched = []
    for name in CODE_FILES:
        path = ROOT / name
        if not path.exists():
            continue
        original = path.read_text()
        text = original

        # Concrete literals, longest first so nested names cannot be partially
        # replaced (e.g. "a/b.png" before "b.png").
        for old in sorted(renames, key=len, reverse=True):
            if old in text:
                text = text.replace(old, renames[old])

        for pattern, replacement in TEMPLATE_PATTERNS:
            text = pattern.sub(replacement, text)

        if text != original:
            if apply:
                path.write_text(text)
            touched.append(name)
    return touched


def summarize(records):
    by_category = {}
    for record in records:
        category = Path(record["from"]).parts[1]
        bucket = by_category.setdefault(category, {"n": 0, "before": 0, "after": 0, "resized": 0})
        bucket["n"] += 1
        bucket["before"] += record["bytes_before"]
        bucket["after"] += record["bytes_after"]
        bucket["resized"] += 1 if record["resized"] else 0
    return by_category


def mb(value):
    return f"{value / 1048576:.2f} MB"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="report savings, change nothing")
    group.add_argument("--apply", action="store_true", help="rewrite images in place")
    group.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero if any image exceeds its budget (spots newly added art)",
    )
    parser.add_argument(
        "--rewrite-code",
        action="store_true",
        help="with --apply, also update path literals in index.html and the js files",
    )
    args = parser.parse_args()

    if args.check:
        offenders = []
        for path, category in iter_sources():
            with Image.open(path) as image:
                if max(image.width, image.height) > BUDGETS[category]:
                    offenders.append(
                        f"  {path.relative_to(ROOT)} "
                        f"({image.width}x{image.height} > {BUDGETS[category]})"
                    )
        source_count = sum(1 for _ in iter_sources())
        if offenders:
            print(f"{len(offenders)} image(s) over budget, and {source_count} still un-converted:")
            print("\n".join(offenders[:40]))
            print("\nRun: python3 scripts/optimize-images.py --apply --rewrite-code")
            return 1
        print(f"OK - no images over budget ({source_count} source files checked)")
        return 0

    records = []
    for path, category in iter_sources():
        records.append(convert(path, BUDGETS[category], apply=args.apply))

    if not records:
        print("Nothing to convert - all eligible images are already WebP.")
        return 0

    by_category = summarize(records)
    before_total = sum(r["bytes_before"] for r in records)
    after_total = sum(r["bytes_after"] for r in records)

    print(f"{'category':<14}{'files':>7}{'resized':>9}{'before':>12}{'after':>12}{'saved':>9}")
    print("-" * 63)
    for category in sorted(by_category):
        bucket = by_category[category]
        saved = 1 - (bucket["after"] / bucket["before"]) if bucket["before"] else 0
        print(
            f"{category:<14}{bucket['n']:>7}{bucket['resized']:>9}"
            f"{mb(bucket['before']):>12}{mb(bucket['after']):>12}{saved:>8.0%}"
        )
    print("-" * 63)
    total_saved = 1 - (after_total / before_total) if before_total else 0
    print(
        f"{'total':<14}{len(records):>7}{'':>9}"
        f"{mb(before_total):>12}{mb(after_total):>12}{total_saved:>8.0%}"
    )

    if args.apply:
        MANIFEST.write_text(json.dumps({"records": records}, indent=1))
        print(f"\nmanifest: {MANIFEST.relative_to(ROOT)}")
        if args.rewrite_code:
            touched = rewrite_code(records, apply=True)
            print(f"rewrote path literals in: {', '.join(touched) if touched else '(none)'}")
        else:
            print("NOTE: image paths in code still say .png - rerun with --rewrite-code")
    else:
        print("\n(dry run - nothing written)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
