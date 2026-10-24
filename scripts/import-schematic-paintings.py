"""Import the painted drawn-map layers (P3-B, M7).

    python -I scripts/import-schematic-paintings.py <paint dir>

<paint dir>/<layer>/base.png is the generator's base (scripts/gen-schematic-map.py --bases, 2 px per layer unit) and
<layer>/painted.png Codex's painting over it (same aspect ratio). Writes, for each layer, public/maps/drawn/schematic/
<layer>.webp (1.5 px per layer unit) and <layer>-<w>.webp (1 px per unit), and src/content/drawn-basemaps.json
({layer: {width, height, smallWidth, paper}}, paper = mean colour of the outer 40 px). Run scripts/map-previews.py
afterwards for the 48 px previews. Requires Python 3 with Pillow and numpy; run from the repo root.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

LAYERS = ['nirn', 'tamriel', 'high-rock', 'skyrim', 'morrowind', 'hammerfell', 'cyrodiil', 'black-marsh', 'elsweyr',
          'valenwood', 'summerset']
OUT = Path('public/maps/drawn/schematic')
MANIFEST = Path('src/content/drawn-basemaps.json')
QUALITY = 74


def main():
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for layer in LAYERS:
        bw, bh = Image.open(src / layer / 'base.png').size
        painted = Image.open(src / layer / 'painted.png').convert('RGB')
        full = painted.resize((round(bw * 0.75), round(bh * 0.75)), Image.LANCZOS)
        small = painted.resize((round(bw * 0.5), round(bh * 0.5)), Image.LANCZOS)
        full.save(OUT / f'{layer}.webp', 'WEBP', quality=QUALITY, method=6)
        small.save(OUT / f'{layer}-{small.width}.webp', 'WEBP', quality=QUALITY, method=6)
        a = np.asarray(full, dtype=np.float32)
        edge = np.concatenate([a[:40].reshape(-1, 3), a[-40:].reshape(-1, 3), a[:, :40].reshape(-1, 3), a[:, -40:].reshape(-1, 3)])
        paper = '#' + ''.join(f'{int(round(c)):02x}' for c in edge.mean(0))
        manifest[layer] = {'width': full.width, 'height': full.height, 'smallWidth': small.width, 'paper': paper}
        print(layer, manifest[layer])
    MANIFEST.write_text(json.dumps(manifest, indent=1) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
