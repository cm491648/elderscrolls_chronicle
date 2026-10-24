"""Tiny previews of the map rasters, shown blurred while a map plate loads (P3-A4).

    python -I scripts/map-previews.py

For every base map in public/maps/ (<name>.webp, not the -<width> copies), writes <name>-preview.webp: 48 px wide,
WebP quality 50, a few hundred bytes. Rerun after replacing a map. Requires Python 3 with Pillow; run from the repo root.
"""
import re
from pathlib import Path

from PIL import Image

WIDTH = 48  # PREVIEW_WIDTH in src/lib/map-source.ts
QUALITY = 50


def main():
    for src in sorted(Path('public/maps').rglob('*.webp')):
        if re.search(r'-(\d+|preview)$', src.stem):
            continue
        with Image.open(src) as im:
            height = round(im.height * WIDTH / im.width)
            small = im.convert('RGB').resize((WIDTH, height), Image.LANCZOS)
        out = src.with_name(f'{src.stem}-preview.webp')
        small.save(out, 'WEBP', quality=QUALITY, method=6)
        print(f'{out}: {WIDTH}x{height}, {out.stat().st_size} bytes')


if __name__ == '__main__':
    main()
