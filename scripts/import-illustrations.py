"""Import the story illustrations: PNG originals -> two WebP sizes in public/illustrations/, captions -> JSON.

    python -I scripts/import-illustrations.py <dir with <event-id>.png and captions.json>

Writes public/illustrations/<id>.webp (1200 wide), <id>-960.webp and <id>-640.webp (quality 80, lower only when a file
would exceed its size budget), and src/content/illustrations.json
([{id, width, height, caption: {en, zh-tw}}], sorted by id). The PNG originals stay where they are (not in git).
Requires Python 3 with Pillow. Run from the repo root.
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path.cwd()
OUT_DIR = ROOT / 'public/illustrations'
DATA = ROOT / 'src/content/illustrations.json'
SIZES = [(1200, '', 80), (960, '-960', 80), (640, '-640', 80)]  # width, file suffix, WebP quality
# Size budget per width in KiB (tests/unit/illustrations.test.ts); a busier image steps its quality down to fit.
BUDGET_KB = {1200: 300, 960: 200, 640: 120}


def main():
    src = Path(sys.argv[1])
    captions = json.loads((src / 'captions.json').read_text(encoding='utf-8'))
    events = {p.stem for p in (ROOT / 'src/content/events/en').glob('*.md')}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    entries = []
    for png in sorted(src.glob('*.png')):
        eid = png.stem
        if eid not in events:
            sys.exit(f'{png.name}: no event with id {eid}')
        cap = captions.get(eid)
        if not cap or not cap.get('en') or not cap.get('zh-tw'):
            sys.exit(f'{eid}: caption missing in captions.json')
        im = Image.open(png).convert('RGB')
        for width, suffix, quality in SIZES:
            h = round(im.height * width / im.width)
            out = OUT_DIR / f'{eid}{suffix}.webp'
            small = im.resize((width, h), Image.LANCZOS)
            q = quality
            small.save(out, 'WEBP', quality=q, method=6)
            while out.stat().st_size / 1024 >= BUDGET_KB[width] and q > 60:
                q -= 2
                small.save(out, 'WEBP', quality=q, method=6)
            print(f'{out.relative_to(ROOT)}  {width}x{h}  {out.stat().st_size // 1024} KB' + (f'  (quality {q})' if q != quality else ''))
        w, h = SIZES[0][0], round(im.height * SIZES[0][0] / im.width)
        entries.append({'id': eid, 'width': w, 'height': h, 'caption': {'en': cap['en'], 'zh-tw': cap['zh-tw']}})
    missing = sorted(set(captions) - {e['id'] for e in entries})
    if missing:
        sys.exit(f'captions without an image: {missing}')
    DATA.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'{len(entries)} illustrations -> {DATA.relative_to(ROOT)}')


main()
