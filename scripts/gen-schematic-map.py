"""The schematic (drawn) Tamriel, generated only from written geography (P3-B).

    python -I scripts/gen-schematic-map.py [--preview out.png]

Reads src/content/schematic-map.json (every item names its basis in docs/research/schematic-map.md) and writes
src/components/MapView/schematic-shapes.ts. Steps, in a 1000 x 714 frame:
  1. Land = union of ellipses, edge softened and roughened with fixed-seed noise (a coast that wanders like a
     hand-drawn one), minus the seas; islands added; water enclosed by land (gaps between ellipses) filled.
  2. Provinces = weighted Voronoi of the province centres over the land, each area smoothed into rounded borders.
  3. Borders between each pair of provinces traced as polylines; mountain ranges follow the borders named in the
     parameters, so ranges and borders always agree.
Requires Python 3 with numpy and opencv-python. Output is deterministic for a given numpy / OpenCV.
"""
import json, sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path.cwd()
P = json.loads((ROOT / 'src/content/schematic-map.json').read_text(encoding='utf-8'))
OUT = ROOT / 'src/components/MapView/schematic-shapes.ts'
W, H = P['frame']
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def ellipses(items):
    m = np.zeros((H, W), np.uint8)
    for x, y, rx, ry, deg in items:
        cv2.ellipse(m, (int(x), int(y)), (int(rx), int(ry)), deg, 0, 360, 255, -1)
    return m


def noise(seed, cell):
    n = np.random.default_rng(seed).standard_normal((H // cell + 2, W // cell + 2)).astype(np.float32)
    return cv2.resize(n, (W, H), interpolation=cv2.INTER_CUBIC)


def roughen(mask, blur, amp, seed):
    f = cv2.GaussianBlur(mask.astype(np.float32), (blur, blur), 0) / 255.0
    f += amp * (noise(seed, 48) * 0.7 + noise(seed + 1, 16) * 0.3)
    return (f > 0.5).astype(np.uint8) * 255


def build():
    land = roughen(ellipses(i['ellipse'] for i in P['land']), 41, P['coastRoughness'], 1)
    land[roughen(ellipses(i['ellipse'] for i in P['seas']), 21, 0.12, 3) > 0] = 0
    islands = []
    for k, isl in enumerate(P['islands']):
        m = roughen(ellipses([isl['ellipse']]), 9, 0.15, 10 + k)
        land[m > 0] = 255
        islands.append((isl['province'], m))
    n, cc, stats, _ = cv2.connectedComponentsWithStats(255 - land, 4)
    for i in range(1, n):
        x0, y0, w0, h0 = stats[i, :4]
        if x0 > 0 and y0 > 0 and x0 + w0 < W and y0 + h0 < H:
            land[cc == i] = 255
    n, cc, stats, _ = cv2.connectedComponentsWithStats(land, 4)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 60:
            land[cc == i] = 0

    names = list(P['seeds'])
    d = np.stack([np.hypot(xx - s['at'][0], yy - s['at'][1]) / s['weight'] for s in P['seeds'].values()])
    for s in P.get('extraSeeds', []):
        i = names.index(s['province'])
        d[i] = np.minimum(d[i], np.hypot(xx - s['at'][0], yy - s['at'][1]) / s['weight'])
    d += noise(20, 40)[None] * 6
    label = np.argmin(d, axis=0)
    for prov, m in islands:
        label[m > 0] = names.index(prov)
    label[land == 0] = -1
    stack = np.stack([cv2.GaussianBlur(((label == i) * 255).astype(np.uint8), (21, 21), 0) for i in range(len(names))])
    label = np.argmax(stack.astype(np.int32), axis=0)
    label[land == 0] = -1
    return land, names, label


def trace(mask, eps, min_area):
    cs, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cs:
        if abs(cv2.contourArea(c)) < min_area:
            continue
        out.append([[int(p[0]), int(p[1])] for p in cv2.approxPolyDP(c, eps, True)[:, 0, :]])
    return out


def border(label, i, j):
    a, b = label == i, label == j
    e = a & (np.roll(b, 1, 0) | np.roll(b, -1, 0) | np.roll(b, 1, 1) | np.roll(b, -1, 1))
    pts = np.argwhere(e)[:, ::-1].astype(np.float32)
    if len(pts) < 4:
        return []
    c = pts.mean(0)
    left = list(range(len(pts)))
    order = [left.pop(int(np.argmax(((pts - c) ** 2).sum(1))))]
    while left:
        last = pts[order[-1]]
        k = int(np.argmin(((pts[left] - last) ** 2).sum(1)))
        if ((pts[left[k]] - last) ** 2).sum() > 400:
            break
        order.append(left.pop(k))
    line = cv2.approxPolyDP(pts[order].reshape(-1, 1, 2), 1.8, False)[:, 0, :]
    return [[round(float(p[0]), 1), round(float(p[1]), 1)] for p in line]


def path(polys):
    return ''.join('M' + 'L'.join(f'{x},{y}' for x, y in poly) + 'Z' for poly in polys)


def build_nirn(tamriel_land):
    """Nirn: the schematic Tamriel scaled into place, the other lands as roughened ellipse groups (written directions
    only). Returns the land mask and each land's own mask."""
    N = P['nirn']
    nw, nh = N['frame']
    t = N['tamriel']
    m = cv2.warpAffine(tamriel_land, np.float32([[t['k'], 0, t['x']], [0, t['k'], t['y']]]), (nw, nh), flags=cv2.INTER_AREA)
    lands = {'tamriel': (m > 127).astype(np.uint8) * 255}
    for k, l in enumerate(N['lands']):
        e = np.zeros((nh, nw), np.uint8)
        for x, y, rx, ry, deg in l['ellipses']:
            cv2.ellipse(e, (int(x), int(y)), (int(rx), int(ry)), deg, 0, 360, 255, -1)
        f = cv2.GaussianBlur(e.astype(np.float32), (15, 15), 0) / 255.0
        r = np.random.default_rng(50 + k)
        n = cv2.resize(r.standard_normal((nh // 20 + 2, nw // 20 + 2)).astype(np.float32), (nw, nh), interpolation=cv2.INTER_CUBIC)
        m = ((f + 0.16 * n) > 0.5).astype(np.uint8) * 255
        # Keep only the pieces that grew from the ellipses (noise alone can raise specks far out at sea).
        cnt, cc = cv2.connectedComponents(m, connectivity=4)
        keep = np.zeros_like(m)
        for i in range(1, cnt):
            if ((cc == i) & (e > 0)).any():
                keep[cc == i] = 255
        lands[l['id']] = keep
    land = np.zeros((nh, nw), np.uint8)
    for v in lands.values():
        land |= v
    return land, lands


def build_holds(label, names):
    """Skyrim's holds: centres (fractions of Skyrim's extent) placed in the schematic Skyrim, weighted Voronoi there."""
    Hd = P['holds']
    sky = label == names.index('skyrim')
    ys, xs = np.nonzero(sky)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    hold_names = list(Hd['centres'])
    centres = {h: (x0 + u * (x1 - x0), y0 + v * (y1 - y0)) for h, (u, v) in Hd['centres'].items()}
    dist = np.stack([np.hypot(xx - centres[h][0], yy - centres[h][1]) / Hd['weights'][h] for h in hold_names])
    dist += noise(60, 24)[None] * 3
    hl = np.argmin(dist, axis=0)
    hl[~sky] = -1
    stack = np.stack([cv2.GaussianBlur(((hl == i) * 255).astype(np.uint8), (11, 11), 0) for i in range(len(hold_names))])
    hl = np.argmax(stack.astype(np.int32), axis=0)
    hl[~sky] = -1
    return hold_names, hl, centres


def main():
    land, names, label = build()
    coast = trace(land, 1.3, 40)
    provinces = {k: trace(((label == i) * 255).astype(np.uint8), 1.8, 40) for i, k in enumerate(names)}
    borders = {}
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            b = border(label, i, j)
            if len(b) > 1:
                borders['|'.join(sorted([names[i], names[j]]))] = b
    ranges = []
    for r in P['ranges']:
        key = '|'.join(sorted(r['between']))
        if key not in borders:
            sys.exit(f"range {r['id']}: {key} share no border")
        ranges.append({'name': r['id'], 'line': borders[key]})
    lakes = []
    for k, l in enumerate(P['lakes']):
        m = roughen(ellipses([l['ellipse']]), 7, 0.1, 30 + k)
        lakes.append({'name': l['id'], 'd': path(trace(m, 1.0, 8))})
    rivers = [{'name': r['id'], 'line': r['line']} for r in P['rivers']]
    hold_names, hl, centres = build_holds(label, names)
    holds = {h: {'label': [round(float(centres[h][0]), 1), round(float(centres[h][1]), 1)],
                 'polygons': trace(((hl == i) * 255).astype(np.uint8), 1.2, 20)} for i, h in enumerate(hold_names)}
    hold_borders = {}
    for i in range(len(hold_names)):
        for k in range(i + 1, len(hold_names)):
            b = border(hl, i, k)
            if len(b) > 1:
                hold_borders['|'.join(sorted([hold_names[i], hold_names[k]]))] = b
    nirn_land, nirn_lands = build_nirn(land)
    # Hit regions on Nirn: each land grown ~18 px, so an archipelago reads as one area (as the old drawn Nirn did).
    grow = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (37, 37))
    nirn_regions = {k: trace(cv2.dilate(m, grow), 2.5, 200) for k, m in nirn_lands.items()}
    j = lambda v: json.dumps(v, separators=(',', ':'))
    ts = f"""// Generated by scripts/gen-schematic-map.py from src/content/schematic-map.json. Do not edit by hand.
// The drawn map's shapes, from written geography only (docs/research/schematic-map.md).
import type {{ Province }} from '../../lib/types';

type Pt = [number, number];
export const SCHEMATIC_VIEWBOX: [number, number] = {j([W, H])};
/** All land as one even-odd path. */
export const COAST = {j(path(coast))};
/** Each province's area (a mainland and its islands), for hit regions and the province layers. */
export const PROVINCE_POLYGONS: Record<Province, Pt[][]> = {j(provinces)};
/** Where two provinces meet, keyed 'a|b' (names sorted). */
export const BORDERS: Record<string, Pt[]> = {j(borders)};
/** Mountain ranges, each along the border it divides. */
export const RANGES: {{ name: string; line: Pt[] }}[] = {j(ranges)};
export const RIVERS: {{ name: string; line: Pt[] }}[] = {j(rivers)};
export const LAKES: {{ name: string; d: string }}[] = {j(lakes)};
export const VOLCANO: Pt = {j(P['volcano']['at'])};

/** Skyrim's holds, in the Tamriel frame: a name position and an area each (borders and names only, not hit areas). */
export const SKYRIM_HOLDS: Record<string, {{ label: Pt; polygons: Pt[][] }}> = {j(holds)};
export const HOLD_BORDERS: Record<string, Pt[]> = {j(hold_borders)};

/** Nirn: the lands of the world map, from written directions only. */
export const NIRN_VIEWBOX: [number, number] = {j(P['nirn']['frame'])};
export const NIRN_COAST = {j(path(trace(nirn_land, 1.3, 20)))};
/** Where Tamriel's layer sits on Nirn: a Tamriel point p is at p * k + (x, y). */
export const NIRN_TAMRIEL = {j({key: P['nirn']['tamriel'][key] for key in ('k', 'x', 'y')})};
/** Hit areas of the lands (grown so archipelagos read as one area). */
export const NIRN_REGIONS: Record<'tamriel' | 'atmora' | 'akavir' | 'yokuda' | 'pyandonea', Pt[][]> = {j(nirn_regions)};
"""
    OUT.write_text(ts, encoding='utf-8', newline='\n')
    print(f'{OUT.relative_to(ROOT)}: {len(ts)} bytes; borders {sorted(borders)}')
    if '--bases' in sys.argv:
        write_bases(sys.argv[sys.argv.index('--bases') + 1], land, names, label, borders, ranges, hold_borders, nirn_land, nirn_lands)
    if '--preview' in sys.argv:
        img = np.full((H, W, 3), (220, 210, 190), np.uint8)
        img[land > 0] = (235, 240, 245)
        for b in borders.values():
            cv2.polylines(img, [np.array(b, np.int32)], False, (90, 90, 90), 1)
        for r in ranges:
            cv2.polylines(img, [np.array(r['line'], np.int32)], False, (40, 60, 120), 3)
        cv2.imwrite(sys.argv[sys.argv.index('--preview') + 1], img)


COLOURS = {'skyrim': (234, 227, 223), 'high-rock': (182, 216, 201), 'hammerfell': (174, 217, 234), 'cyrodiil': (179, 203, 233),
           'morrowind': (214, 198, 217), 'black-marsh': (184, 211, 196), 'elsweyr': (166, 213, 236), 'valenwood': (176, 206, 182),
           'summerset': (198, 226, 233)}  # BGR, the flat colours of design sample B
SEA = (227, 226, 214)


def render_tamriel(scale, label, names, land, borders, ranges, lakes_masks, holds=None):
    """Flat base at `scale` x the Tamriel frame: coloured provinces, white borders, grey peaks, blue rivers and lakes."""
    h, w = land.shape
    img = np.zeros((h, w, 3), np.uint8)
    img[:] = SEA
    for i, k in enumerate(names):
        img[label == i] = COLOURS[k]
    for m in lakes_masks:
        img[m > 0] = SEA
    img = cv2.resize(img, (w * scale, h * scale), interpolation=cv2.INTER_NEAREST)
    pts = lambda line: (np.array(line) * scale).astype(np.int32)
    for b in borders.values():
        cv2.polylines(img, [pts(b)], False, (252, 252, 250), 2 * scale, cv2.LINE_AA)
    if holds:
        for b in holds.values():
            cv2.polylines(img, [pts(b)], False, (240, 240, 236), scale, cv2.LINE_AA)
    for r in P['rivers']:
        cv2.polylines(img, [pts(r['line'])], False, (196, 188, 159), 2 * scale, cv2.LINE_AA)
    for r in ranges:
        line = np.array(r['line'], np.float32)
        seg = np.hypot(*np.diff(line, axis=0).T)
        for k in range(len(seg)):
            n = max(1, int(seg[k] / 11))
            for t in range(n):
                x, y = (line[k] + (line[k + 1] - line[k]) * t / n) * scale
                tri = np.array([[x - 5 * scale, y + 3 * scale], [x, y - 4 * scale], [x + 5 * scale, y + 3 * scale]], np.int32)
                cv2.fillPoly(img, [tri], (116, 133, 143), cv2.LINE_AA)
    vx, vy = P['volcano']['at']
    cv2.fillPoly(img, [np.array([[(vx - 6) * scale, (vy + 4) * scale], [vx * scale, (vy - 6) * scale], [(vx + 6) * scale, (vy + 4) * scale]], np.int32)], (60, 80, 150), cv2.LINE_AA)
    return img


def write_bases(out_dir, land, names, label, borders, ranges, hold_borders, nirn_land, nirn_lands):
    """No-lettering bases for Codex to paint over (M7): Tamriel, Nirn and each province layer at 2x its own units."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    lakes_masks = [roughen(ellipses([l['ellipse']]), 7, 0.1, 30 + k) for k, l in enumerate(P['lakes'])]
    full = render_tamriel(4, label, names, land, borders, ranges, lakes_masks)
    cv2.imwrite(str(out / 'tamriel.png'), cv2.resize(full, (W * 2, H * 2), interpolation=cv2.INTER_AREA))
    with_holds = render_tamriel(4, label, names, land, borders, ranges, lakes_masks, hold_borders)
    # Nirn: lands in a neutral parchment, Tamriel in its colours.
    nw, nh = P['nirn']['frame']
    t = P['nirn']['tamriel']
    nirn = np.zeros((nh * 2, nw * 2, 3), np.uint8)
    nirn[:] = SEA
    big = cv2.resize(nirn_land, (nw * 2, nh * 2), interpolation=cv2.INTER_NEAREST)
    nirn[big > 0] = (205, 222, 232)
    tam = cv2.warpAffine(full, np.float32([[t['k'] / 2, 0, t['x'] * 2], [0, t['k'] / 2, t['y'] * 2]]), (nw * 2, nh * 2), flags=cv2.INTER_AREA, borderValue=SEA)
    tmask = cv2.warpAffine(cv2.resize(land, (W * 4, H * 4), interpolation=cv2.INTER_NEAREST), np.float32([[t['k'] / 2, 0, t['x'] * 2], [0, t['k'] / 2, t['y'] * 2]]), (nw * 2, nh * 2), flags=cv2.INTER_NEAREST)
    nirn[tmask > 0] = tam[tmask > 0]
    cv2.imwrite(str(out / 'nirn.png'), nirn)
    # Provinces: the Tamriel base cropped to each layer's frame (as shapes-drawn.ts computes it), neighbours greyed.
    for i, k in enumerate(names):
        pts = np.array([p for poly in trace(((label == i) * 255).astype(np.uint8), 1.8, 40) for p in poly], np.float32)
        side = max(pts[:, 0].max() - pts[:, 0].min(), pts[:, 1].max() - pts[:, 1].min())
        m = side * 0.08
        x0, y0 = pts[:, 0].min() - m, pts[:, 1].min() - m
        kk = (side + 2 * m) / 1000
        size = (round((pts[:, 0].max() + m - x0) / kk), round((pts[:, 1].max() + m - y0) / kk))
        src = with_holds if k == 'skyrim' else full
        # Layer unit u -> Tamriel u*kk + x0 -> base px (u*kk + x0) * 4; output at 2 px per layer unit.
        M = np.float32([[kk * 2, 0, x0 * 4], [0, kk * 2, y0 * 4]])
        crop = cv2.warpAffine(src, cv2.invertAffineTransform(M), (size[0] * 2, size[1] * 2), flags=cv2.INTER_AREA, borderValue=SEA)
        own = cv2.warpAffine(cv2.resize(((label == i) * 255).astype(np.uint8), (W * 4, H * 4), interpolation=cv2.INTER_NEAREST),
                             cv2.invertAffineTransform(M), (size[0] * 2, size[1] * 2), flags=cv2.INTER_NEAREST)
        lnd = cv2.warpAffine(cv2.resize(land, (W * 4, H * 4), interpolation=cv2.INTER_NEAREST), cv2.invertAffineTransform(M), (size[0] * 2, size[1] * 2), flags=cv2.INTER_NEAREST)
        grey = cv2.cvtColor(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
        dim = (lnd > 0) & (own == 0)
        crop[dim] = (grey[dim] * 0.55 + 200 * 0.45).astype(np.uint8)
        cv2.imwrite(str(out / f'{k}.png'), crop)
    print(f'bases written to {out}')


if __name__ == '__main__':
    main()
