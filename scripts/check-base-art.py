"""Check that the base uniform art in images/base/ is consistent within each family.

Rank-specific jackets in one family are the same garment with different insignia, so they
should share a canvas size and line up with each other. When they do, calibration belongs to
the family and a new rank image needs none. When one does not, it needs a calibration of its own
(or a fix to the image) and this script says so.

    python3 scripts/check-base-art.py            # report, always exits 0
    python3 scripts/check-base-art.py --check    # exit 1 if any image needs attention
    python3 scripts/check-base-art.py --verbose  # list every image, not only the exceptions

For each family it picks the image that agrees best with its siblings as the reference, then
reports every image whose canvas differs, or whose body (the part below the shoulders, where rank
insignia do not appear) correlates with the reference below THRESHOLD. For those it also searches
for the best shift of up to 12 px, to tell a slightly offset copy of the same garment from a
different drawing.

Requires Pillow and numpy (`pip install Pillow numpy`), like scripts/optimize-images.py.
"""
import argparse
import os
import re
import sys

import numpy as np
from PIL import Image

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'images', 'base')
THRESHOLD = 0.99
SHIFT = 12

# Family name -> pattern for the file name without its extension. Each image goes in the first
# family that matches. Images that match none are listed as unclassified (generic fallbacks).
FAMILIES = [
    ('senior male Class A jacket', r'^CAP_male_'),
    ('senior female Class A jacket', r'^CAP_female_'),
    ('senior NCO Class A jacket', r'^CAP_SM_'),
    ('cadet female Class A jacket', r'^blues_class_a_female_c_'),
    ('cadet female Class B shirt', r'^blues_class_b_female_c_'),
    ('cadet male Class B shirt', r'^blues_class_b_male_c_'),
    ('cadet male Class A officer jacket', r'^c_.*_jacket_male$'),
    ('senior male Class B shirt', r'_blues_class_b_male$'),
    ('OCP blouse', r'OCP_Blouse$'),
]


def load(name):
    image = Image.open(os.path.join(BASE, name)).convert('RGBA')
    pixels = np.asarray(image).astype(np.float32)
    return image.size, pixels[..., :3].mean(axis=2)


def correlation(a, b):
    a = a - a.mean()
    b = b - b.mean()
    denominator = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / denominator) if denominator else 0.0


def body(gray, dy=0, dx=0):
    # Below the shoulders and away from the sleeves' outer edge: no epaulets or lapel insignia here.
    h, w = gray.shape
    return gray[int(h * 0.38) + dy:int(h * 0.95) + dy, int(w * 0.12) + dx:int(w * 0.88) + dx]


def best_shift(reference, other):
    target = body(reference)
    best = (-2.0, 0, 0)
    for dy in range(-SHIFT, SHIFT + 1):
        for dx in range(-SHIFT, SHIFT + 1):
            candidate = body(other, dy, dx)
            if candidate.shape != target.shape:
                continue
            score = correlation(target, candidate)
            if score > best[0]:
                best = (score, dx, dy)
    return best


def check_family(label, names, verbose):
    images = {name: load(name) for name in names}
    sizes = {}
    for name, (size, _) in images.items():
        sizes.setdefault(size, []).append(name)
    main_size = max(sizes, key=lambda s: len(sizes[s]))
    same = [name for name in names if images[name][0] == main_size]

    # The reference is the image that agrees best with the others on the majority canvas.
    if len(same) > 1:
        scores = {a: np.mean([correlation(body(images[a][1]), body(images[b][1])) for b in same if b != a]) for a in same}
        reference = max(same, key=lambda a: scores[a])
    else:
        reference = same[0]

    problems = []
    for name in names:
        size, gray = images[name]
        if name == reference:
            continue
        if size != main_size:
            problems.append(f'{name[:-5]}: canvas {size[0]}x{size[1]}, the family is mostly {main_size[0]}x{main_size[1]}')
            continue
        score = correlation(body(images[reference][1]), body(gray))
        if score < THRESHOLD:
            fit, dx, dy = best_shift(images[reference][1], gray)
            if fit >= THRESHOLD:
                problems.append(f'{name[:-5]}: same garment offset by ({dx:+d}, {dy:+d}) px, correlation {fit:.3f} once shifted')
            else:
                problems.append(f'{name[:-5]}: a different drawing, correlation {score:.3f} with {reference[:-5]} (best shifted {fit:.3f})')
        elif verbose:
            print(f'    {name[:-5]}: ok ({score:.3f})')
    status = 'ok' if not problems else f'{len(problems)} to look at'
    print(f'{label}: {len(names)} images, reference {reference[:-5]}, {status}')
    for problem in problems:
        print(f'    {problem}')
    return len(problems)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true', help='exit 1 if any image needs attention')
    parser.add_argument('--verbose', action='store_true', help='list every image, not only the exceptions')
    args = parser.parse_args()

    files = sorted(f for f in os.listdir(BASE) if f.endswith('.webp'))
    claimed = set()
    total = 0
    for label, pattern in FAMILIES:
        names = [f for f in files if f not in claimed and re.search(pattern, f[:-5])]
        claimed.update(names)
        if len(names) < 2:
            print(f'{label}: {len(names)} image(s), nothing to compare')
            continue
        total += check_family(label, names, args.verbose)

    loose = [f[:-5] for f in files if f not in claimed]
    print(f'\nUnclassified ({len(loose)}, generic or single-image art): ' + ', '.join(loose))
    print(f'\n{total} image(s) need attention.')
    if args.check and total:
        sys.exit(1)


if __name__ == '__main__':
    main()
