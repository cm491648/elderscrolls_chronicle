"""Prepares the interface textures (decisions/es-feel-spec-2): Codex's 1024px seamless vellum and leather become 512px
webp tiles in src/assets/textures/, with the colours the contrast test checks text against.
Usage: python -I scripts/make-textures.py <source dir holding vellum.png and leather.png>"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'textures'
SIZE = 512


def heal_seams(a):
    """Make a nearly seamless tile truly seamless: shift it half a tile (the seams move to the middle cross), then
    fade the unshifted image in over that cross. The edges come from the shifted copy, which wraps cleanly."""
    h, w = a.shape[:2]
    rolled = np.roll(np.roll(a, h // 2, axis=0), w // 2, axis=1)
    y = 1 - np.abs(np.linspace(-1, 1, h))[:, None]
    x = 1 - np.abs(np.linspace(-1, 1, w))[None, :]
    m = np.clip(np.maximum(y, x) * 1.6 - 0.6, 0, 1)[..., None]  # 1 on the middle cross, 0 at the edges
    return rolled * (1 - m) + a * m


def hexc(c):
    return '#%02x%02x%02x' % tuple(int(round(v)) for v in c)


def quantile_colour(a, q):
    lum = a @ np.array([0.2126, 0.7152, 0.0722])
    cut = np.quantile(lum, q)
    pick = a[lum <= cut] if q < 0.5 else a[lum >= cut]
    return pick.mean(axis=0)


def main(src):
    OUT.mkdir(parents=True, exist_ok=True)
    info = {}
    for name in ('vellum', 'leather'):
        a = np.asarray(Image.open(Path(src) / f'{name}.png').convert('RGB'), dtype=np.float64)
        a = heal_seams(a)
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((SIZE, SIZE), Image.LANCZOS)
        im.save(OUT / f'{name}.webp', 'WEBP', quality=76, method=6)
        px = np.asarray(im, dtype=np.float64).reshape(-1, 3)
        info[name] = {'mean': hexc(px.mean(axis=0))}
        if name == 'vellum':
            info[name]['dark'] = hexc(quantile_colour(px, 0.05))
        else:
            info[name]['light'] = hexc(quantile_colour(px, 0.95))
    (OUT / 'textures.json').write_text(json.dumps(info, indent=1) + '\n', encoding='utf-8')
    print(json.dumps(info))


if __name__ == '__main__':
    main(sys.argv[1])
