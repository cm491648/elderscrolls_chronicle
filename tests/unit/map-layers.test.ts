import { describe, expect, test } from 'vitest';
import { MAPS, PROVINCE_CROPS, PROVINCE_GAME_MAPS, TAMRIEL_PX, regionContains } from '../../src/components/MapView/shapes';
import {
  childLayerOf,
  clampView,
  commonLayer,
  coverScale,
  eventView,
  frameView,
  frameFits,
  tagWidth,
  linkTo,
  maxScale,
  pathTo,
  placesOn,
  projectRegion,
  project,
  regionHome,
  regionOnLayer,
  viewOnParent,
  type Point,
} from '../../src/lib/map-layers';
import { MAP_LAYERS, PROVINCES, type EventMeta, type Location } from '../../src/lib/types';
import locationData from '../../src/content/locations.json';

const locations = locationData as Location[];
const loc = (id: string) => locations.find((l) => l.id === id)!;
const region = (layer: keyof typeof MAPS, id: string) => MAPS[layer].regions.find((r) => r.id === id)!;
const ev = (over: Partial<EventMeta>): Pick<EventMeta, 'mapLayer' | 'locations' | 'regions'> => ({
  mapLayer: 'tamriel',
  locations: [],
  ...over,
});

/**
 * Where R8 calibrated each place on the Tamriel map (Anthology pixels / 2.88), for the places R12 moved onto a province
 * without moving them (Helgen, Pale Pass, Saarthal and Windhelm were re-placed from the detailed Skyrim map).
 */
const R8_TAMRIEL: Record<string, Point> = {
  firsthold: [230, 419],
  'red-mountain': [724, 145],
};

describe('layer tree', () => {
  test('cosmos > Nirn > Tamriel > nine provinces', () => {
    expect(pathTo('skyrim')).toEqual(['cosmos', 'nirn', 'tamriel', 'skyrim']);
    expect(pathTo('cosmos')).toEqual(['cosmos']);
    for (const p of PROVINCES) expect(MAPS[p].parent?.layer).toBe('tamriel');
    expect(MAPS.tamriel.parent?.layer).toBe('nirn');
    expect(MAPS.nirn.parent?.layer).toBe('cosmos');
    expect(MAPS.cosmos.parent).toBeUndefined();
    expect(MAP_LAYERS).toHaveLength(12);
  });

  test('a region opens the layer of the same name one level down, and nothing else does', () => {
    expect(childLayerOf('cosmos', 'nirn')).toBe('nirn');
    expect(childLayerOf('nirn', 'tamriel')).toBe('tamriel');
    for (const p of PROVINCES) expect(childLayerOf('tamriel', p)).toBe(p);
    expect(childLayerOf('nirn', 'atmora')).toBeNull();
    expect(childLayerOf('cosmos', 'mundus')).toBeNull();
    expect(childLayerOf('skyrim', 'skyrim')).toBeNull(); // a province layer's own outline opens nothing
    expect(regionHome('skyrim')).toBe('tamriel');
    expect(regionHome('atmora')).toBe('nirn');
    expect(regionHome('nowhere')).toBeNull();
  });

  test('commonLayer is the deepest shared ancestor', () => {
    expect(commonLayer(['skyrim', 'skyrim'])).toBe('skyrim');
    expect(commonLayer(['skyrim', 'cyrodiil'])).toBe('tamriel');
    expect(commonLayer(['skyrim', 'nirn'])).toBe('nirn');
    expect(commonLayer(['morrowind', 'cosmos'])).toBe('cosmos');
  });
});

describe('coordinate transforms', () => {
  test('a province crop sits on Tamriel at its Anthology offset / 2.88 (corners and size)', () => {
    for (const p of Object.keys(PROVINCE_CROPS) as (keyof typeof PROVINCE_CROPS)[]) {
      const [ox, oy, w, h] = PROVINCE_CROPS[p]!;
      expect(MAPS[p].viewBox).toEqual([w, h]);
      const [x0, y0] = project([0, 0], p, 'tamriel');
      const [x1, y1] = project([w, h], p, 'tamriel');
      expect(x0).toBeCloseTo(ox / TAMRIEL_PX, 9);
      expect(y0).toBeCloseTo(oy / TAMRIEL_PX, 9);
      expect(x1 - x0).toBeCloseTo(w / TAMRIEL_PX, 9);
      expect(y1 - y0).toBeCloseTo(h / TAMRIEL_PX, 9);
      // Every crop lies inside the Tamriel map.
      expect(x0 >= 0 && y0 >= 0 && x1 <= 1000 && y1 <= 714.3, p).toBe(true);
    }
  });

  test('Skyrim and Cyrodiil are their game maps, fitted onto Tamriel within the fit residual of the Anthology cities', () => {
    expect(Object.keys(PROVINCE_GAME_MAPS).sort()).toEqual(['cyrodiil', 'skyrim']);
    expect(Object.keys(PROVINCE_CROPS)).toHaveLength(7);
    for (const p of ['skyrim', 'cyrodiil'] as const) {
      const g = PROVINCE_GAME_MAPS[p]!;
      expect(MAPS[p].viewBox).toEqual(g.size);
      expect(MAPS[p].parent).toEqual({ layer: 'tamriel', ...g.link, warp: g.warp });
      // The whole game map lies on Tamriel.
      const [x0, y0] = project([0, 0], p, 'tamriel');
      const [x1, y1] = project(g.size, p, 'tamriel');
      expect(x0 >= 0 && y0 >= 0 && x1 <= 1000 && y1 <= 714.3, p).toBe(true);
    }
    // Every control city lands on its Anthology glyph on Tamriel (the warp is exact there; plain link is not).
    for (const p of ['skyrim', 'cyrodiil'] as const) {
      for (const [from, to] of PROVINCE_GAME_MAPS[p]!.warp) {
        const [tx, ty] = project(from, p, 'tamriel');
        expect(Math.hypot(tx - to[0], ty - to[1]), `${p} ${from}`).toBeLessThan(1e-6);
      }
    }
    // The places that are control cities: on the province layer exactly on the game map's glyph (their stored
    // coordinates), on Tamriel within 2 units of the Anthology glyph (R8's estimate for Sancre Tor).
    const anthology: Record<string, Point> = {
      windhelm: [(820 + 855) / 2.88, (262 + 65) / 2.88],
      markarth: [(212 + 855) / 2.88, (339 + 65) / 2.88],
      'throat-of-the-world': [(677 + 855) / 2.88, (367 + 65) / 2.88],
      'imperial-city': [(694 + 881) / 2.88, (319 + 594) / 2.88],
      kvatch: [(260 + 881) / 2.88, (495 + 594) / 2.88],
      'sancre-tor': [491, 238],
    };
    for (const [id, at] of Object.entries(anthology)) {
      const l = loc(id);
      const ctrl = PROVINCE_GAME_MAPS[l.layer as 'skyrim' | 'cyrodiil']!.warp.find(([from]) => from[0] === l.x && from[1] === l.y);
      expect(ctrl, `${id} is a control city`).toBeDefined();
      const [tx, ty] = project([l.x, l.y], l.layer, 'tamriel');
      expect(Math.hypot(tx - at[0], ty - at[1]), id).toBeLessThan(2);
      expect(regionContains(region('tamriel', l.region), tx, ty), `${id} in ${l.region} on Tamriel`).toBe(true);
    }
    // Between the control cities the correction stays moderate (no spline overshoot): under 25 units.
    for (const l of locations.filter((l) => l.layer === 'skyrim' || l.layer === 'cyrodiil')) {
      const a = project([l.x, l.y], l.layer, 'tamriel');
      const b = project([l.x, l.y], l.layer, 'tamriel', true);
      expect(Math.hypot(a[0] - b[0], a[1] - b[1]), l.id).toBeLessThan(25);
      expect(regionContains(region('tamriel', l.region), ...a), `${l.id} in ${l.region}`).toBe(true);
    }
  });

  test('chained links equal stepping one layer at a time', () => {
    const pt: Point = [123, 456];
    const viaTamriel = project(project(pt, 'cyrodiil', 'tamriel'), 'tamriel', 'nirn');
    const direct = project(pt, 'cyrodiil', 'nirn');
    expect(direct[0]).toBeCloseTo(viaTamriel[0], 9);
    expect(direct[1]).toBeCloseTo(viaTamriel[1], 9);
    expect(linkTo('skyrim', 'skyrim')).toEqual({ k: 1, x: 0, y: 0 });
    expect(() => linkTo('tamriel', 'skyrim')).toThrow();
  });

  test('the Imperial City is the same place on Cyrodiil, Tamriel, Nirn and the cosmos', () => {
    const ic = loc('imperial-city');
    expect(ic.layer).toBe('cyrodiil');
    expect(regionContains(region('cyrodiil', 'cyrodiil'), ic.x, ic.y)).toBe(true);
    const onTamriel = project([ic.x, ic.y], 'cyrodiil', 'tamriel');
    // The Anthology map's glyph is at 547,317 (to the R8 unit); the game map's city lands on it through the warp.
    expect(Math.hypot(onTamriel[0] - 547, onTamriel[1] - 317)).toBeLessThan(2);
    expect(regionContains(region('tamriel', 'cyrodiil'), ...onTamriel)).toBe(true);
    const onNirn = project([ic.x, ic.y], 'cyrodiil', 'nirn');
    const viaTamriel = project(onTamriel, 'tamriel', 'nirn');
    expect(onNirn[0]).toBeCloseTo(viaTamriel[0], 9);
    expect(onNirn[1]).toBeCloseTo(viaTamriel[1], 9);
    expect(regionContains(region('nirn', 'tamriel'), ...onNirn)).toBe(true);
    const onCosmos = project([ic.x, ic.y], 'cyrodiil', 'cosmos');
    expect(regionContains(region('cosmos', 'nirn'), ...onCosmos)).toBe(true);
  });

  test('every place carried over from R8 projects back onto its R8 Tamriel spot (< 0.5 unit)', () => {
    for (const [id, [x, y]] of Object.entries(R8_TAMRIEL)) {
      const l = loc(id);
      expect(PROVINCES as readonly string[], id).toContain(l.layer);
      const [tx, ty] = project([l.x, l.y], l.layer, 'tamriel');
      expect(Math.hypot(tx - x, ty - y), id).toBeLessThan(0.5);
      expect(regionContains(region('tamriel', l.region), tx, ty), `${id} in ${l.region} on Tamriel`).toBe(true);
    }
  });

  test('every place of Tamriel and its provinces lands on Nirn inside Tamriel, and on the cosmos inside Nirn', () => {
    // Nirn v3c's Tamriel follows the province outlines (fit IoU 0.88): every place lands inside Nirn's Tamriel.
    const nirnTamriel = region('nirn', 'tamriel');
    for (const l of locations.filter((l) => pathTo(l.layer).includes('tamriel'))) {
      const at = project([l.x, l.y], l.layer, 'nirn');
      expect(regionContains(nirnTamriel, ...at), l.id).toBe(true);
      expect(regionContains(region('cosmos', 'nirn'), ...project([l.x, l.y], l.layer, 'cosmos')), l.id).toBe(true);
    }
    for (const l of locations.filter((l) => l.layer === 'nirn')) {
      expect(regionContains(region('cosmos', 'nirn'), ...project([l.x, l.y], 'nirn', 'cosmos')), l.id).toBe(true);
    }
  });

  test('Iliac Bay sits mid-bay on High Rock: open water, between the High Rock and Hammerfell coasts', () => {
    const bay = loc('iliac-bay');
    expect(bay).toMatchObject({ layer: 'high-rock', region: 'high-rock', sea: true });
    const onTamriel = project([bay.x, bay.y], 'high-rock', 'tamriel');
    for (const r of MAPS.tamriel.regions) expect(regionContains(r, ...onTamriel), r.id).toBe(false);
  });
});

describe('event views: the finest layer holding every place and region', () => {
  test('two Skyrim places: the Skyrim layer, framing both', () => {
    const v = eventView(ev({ locations: ['helgen', 'throat-of-the-world'] }), locations);
    expect(v.layer).toBe('skyrim');
    expect(v.places.map((p) => p.id)).toEqual(['helgen', 'throat-of-the-world']);
    expect(v.box).toEqual([1073, 897, 1247, 1135]);
  });

  test('places in two provinces: Tamriel', () => {
    const v = eventView(ev({ locations: ['red-mountain', 'imperial-city'] }), locations);
    expect(v.layer).toBe('tamriel');
    const ic = v.places.find((p) => p.id === 'imperial-city')!.at;
    expect(Math.hypot(ic[0] - 547, ic[1] - 317)).toBeLessThan(2);
  });

  test('Saarthal with Atmora and Skyrim (the Atmoran migration): Nirn, Atmora lit in place, Skyrim outlined', () => {
    const v = eventView(ev({ mapLayer: 'nirn', locations: ['saarthal'], regions: ['atmora', 'skyrim'] }), locations);
    expect(v.layer).toBe('nirn');
    expect(v.places.map((p) => p.id)).toEqual(['saarthal']);
    const saarthal = v.places[0].at;
    expect(regionContains(region('nirn', 'tamriel'), ...saarthal)).toBe(true);
    const [atmora, skyrim] = v.regions;
    expect(atmora).toMatchObject({ id: 'atmora', d: null });
    expect(skyrim.id).toBe('skyrim');
    expect(skyrim.d).toMatch(/^M[\d.]+,[\d.]+L/);
    // Skyrim's outline lands inside Nirn's Tamriel, and the frame holds Saarthal, Atmora and all of Skyrim.
    const [x0, y0, x1, y1] = skyrim.box;
    for (const pt of [[x0, y0], [x1, y1]] as Point[]) expect(regionContains(region('nirn', 'tamriel'), ...pt)).toBe(true);
    const all = [saarthal[0], saarthal[1], ...atmora.box, ...skyrim.box];
    expect(v.box).toEqual([
      Math.min(saarthal[0], atmora.box[0], x0),
      Math.min(saarthal[1], atmora.box[1], y0),
      Math.max(saarthal[0], atmora.box[2], x1),
      Math.max(saarthal[1], atmora.box[3], y1),
    ]);
    expect(all.every(Number.isFinite)).toBe(true);
  });

  test('a whole province is shown on Tamriel, highlighted in place (and in place on its own layer too)', () => {
    const v = eventView(ev({ regions: ['cyrodiil'] }), locations);
    expect(v.layer).toBe('tamriel');
    expect(v.regions).toEqual([{ id: 'cyrodiil', d: null, box: expect.any(Array) }]);
    expect(projectRegion('cyrodiil', 'cyrodiil')?.d).toBeNull();
    expect(projectRegion('cyrodiil', 'skyrim')).toBeNull();
    // A province region with a place inside it still shows on Tamriel.
    expect(eventView(ev({ locations: ['helgen'], regions: ['skyrim'] }), locations).layer).toBe('tamriel');
  });

  test('a cosmos place with a Nirn place: the cosmos; nothing named: the event layer, whole', () => {
    expect(eventView(ev({ locations: ['old-ehlnofey'], regions: ['mundus'] }), locations).layer).toBe('cosmos');
    expect(eventView(ev({ mapLayer: 'nirn' }), locations)).toEqual({ layer: 'nirn', places: [], regions: [], box: null, fitAll: false, frame: null });
  });

  test('every real event: its places and regions exist, and its map layer is the finest one holding them all', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const list = (fm: string, key: string) =>
      (fm.match(new RegExp(`^${key}:\\s*\\[(.*)\\]`, 'm'))?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const files = readdirSync('src/content/events/en');
    // Every event, whatever the batch: the English files pair one to one with the Chinese ones.
    expect(files.length).toBeGreaterThanOrEqual(20);
    expect([...files].sort()).toEqual([...readdirSync('src/content/events/zh-tw')].sort());
    for (const f of files) {
      const fm = readFileSync(`src/content/events/en/${f}`, 'utf-8');
      const ids = list(fm, 'locations');
      const regions = list(fm, 'regions');
      const mapLayer = fm.match(/^mapLayer:\s*(\S+)/m)![1] as EventMeta['mapLayer'];
      expect(ids.length + regions.length, `${f} names something`).toBeGreaterThan(0);
      for (const id of ids) expect(locations.some((l) => l.id === id), `${f}: location ${id}`).toBe(true);
      for (const id of regions) expect(regionHome(id), `${f}: region ${id}`).not.toBeNull();
      const v = eventView(ev({ mapLayer, locations: ids, regions }), locations);
      expect(v.layer, f).toBe(mapLayer);
      expect(v.places).toHaveLength(ids.length);
      expect(v.regions).toHaveLength(regions.length);
    }
  });
});

describe('places and highlights per layer', () => {
  test('Tamriel marks every province place; Nirn only its own and the selected ones', () => {
    const none = new Set<string>();
    const onTamriel = placesOn('tamriel', locations, none).map((p) => p.loc.id);
    expect(onTamriel).toEqual(expect.arrayContaining(Object.keys(R8_TAMRIEL)));
    expect(placesOn('nirn', locations, none).map((p) => p.loc.id)).toEqual(['old-ehlnofey']);
    expect(placesOn('nirn', locations, new Set(['helgen'])).map((p) => p.loc.id)).toContain('helgen');
    expect(placesOn('skyrim', locations, none).map((p) => p.loc.id)).not.toContain('red-mountain');
  });

  test('a selected place lights the region leading to it on each coarser layer', () => {
    const helgen = loc('helgen');
    expect(regionOnLayer(helgen, 'skyrim')).toBe('skyrim');
    expect(regionOnLayer(helgen, 'tamriel')).toBe('skyrim');
    expect(regionOnLayer(helgen, 'nirn')).toBe('tamriel');
    expect(regionOnLayer(helgen, 'cosmos')).toBe('nirn');
    expect(regionOnLayer(helgen, 'cyrodiil')).toBeNull();
  });
});

describe('views on the plate (cover, framing, zooming between layers)', () => {
  const W = 1200;
  const H = 480;

  test('a whole layer fills the plate: cover zoom, centred, no margin', () => {
    for (const layer of MAP_LAYERS) {
      const [w, h] = MAPS[layer].viewBox;
      const v = frameView(layer, null, W, H);
      expect(v.k).toBeCloseTo(coverScale(W, H, w, h), 9);
      expect(v.x).toBeLessThanOrEqual(1e-9);
      expect(v.y).toBeLessThanOrEqual(1e-9);
      expect(v.x + v.k * w).toBeGreaterThanOrEqual(W - 1e-9);
      expect(v.y + v.k * h).toBeGreaterThanOrEqual(H - 1e-9);
    }
  });

  test('a frame keeps every place on the plate and never shows a margin', () => {
    const v = eventView(ev({ locations: ['helgen', 'throat-of-the-world'] }), locations);
    for (const [pw, ph] of [[W, H], [360, 300], [800, 800]]) {
      const f = frameView(v.layer, v.frame, pw, ph);
      const [w, h] = MAPS[v.layer].viewBox;
      // Where both places and their tags fit at the cover zoom (the wide plate), no margin shows.
      if (pw === W) {
        expect(f.k).toBeGreaterThanOrEqual(coverScale(pw, ph, w, h) - 1e-9);
        expect(f.x).toBeLessThanOrEqual(1e-9);
        expect(f.x + f.k * w).toBeGreaterThanOrEqual(pw - 1e-9);
      }
      expect(frameFits(v.frame!, f, pw, ph)).toBe(true);
      for (const { at } of v.places) {
        const sx = at[0] * f.k + f.x;
        const sy = at[1] * f.k + f.y;
        expect(sx > 0 && sx < pw && sy > 0 && sy < ph, `${at} on a ${pw}x${ph} plate`).toBe(true);
      }
    }
  });

  test('an event too tall for a wide plate zooms out just enough to hold it all (Atmora, Saarthal, Skyrim on Nirn)', () => {
    const v = eventView(ev({ mapLayer: 'nirn', locations: ['saarthal'], regions: ['atmora', 'skyrim'] }), locations);
    const [pw, ph] = [1390, 370];
    const f = frameView('nirn', v.frame, pw, ph);
    expect(v.fitAll).toBe(true);
    const [w, h] = MAPS.nirn.viewBox;
    expect(f.k).toBeLessThan(coverScale(pw, ph, w, h));
    expect(f.k).toBeGreaterThanOrEqual(Math.min(pw / w, ph / h) - 1e-9);
    const [x0, y0, x1, y1] = v.box!;
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      expect(x * f.k + f.x).toBeGreaterThanOrEqual(-1e-6);
      expect(x * f.k + f.x).toBeLessThanOrEqual(pw + 1e-6);
      expect(y * f.k + f.y).toBeGreaterThanOrEqual(-1e-6);
      expect(y * f.k + f.y).toBeLessThanOrEqual(ph + 1e-6);
    }
    // The map still fills the plate top to bottom; only the sides show the sea colour.
    expect(f.y).toBeLessThanOrEqual(1e-9);
    expect(f.y + f.k * h).toBeGreaterThanOrEqual(ph - 1e-6);
  });

  test('every event, on the wide desktop plates and a phone: places with their tags and whole regions in view, none under the level path', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const list = (fm: string, key: string) =>
      (fm.match(new RegExp(`^${key}:\\s*\\[(.*)\\]`, 'm'))?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    // The plates measured in the R12 review (with a story open), and the level path's height along the top.
    const plates = [
      { W: 1380, H: 372, top: 44 },
      { W: 1860, H: 455, top: 44 },
      { W: 380, H: 253, top: 44 },
      { W: 380, H: 253, top: 80 }, // the path wrapped onto two rows
    ];
    for (const f of readdirSync('src/content/events/en')) {
      const fm = readFileSync(`src/content/events/en/${f}`, 'utf-8');
      const mapLayer = fm.match(/^mapLayer:\s*(\S+)/m)![1] as EventMeta['mapLayer'];
      const v = eventView(ev({ mapLayer, locations: list(fm, 'locations'), regions: list(fm, 'regions') }), locations);
      for (const p of plates) {
        const insets = { top: p.top, right: 14, bottom: 14, left: 14 };
        const view = frameView(v.layer, v.frame, p.W, p.H, insets);
        expect(frameFits(v.frame!, view, p.W, p.H, insets), `${f} on ${p.W}x${p.H} (path ${p.top}px)`).toBe(true);
      }
    }
  });

  test('an event with a region always fits it all; tag widths cover both languages', () => {
    const v = eventView(ev({ regions: ['cyrodiil'] }), locations);
    expect(v.fitAll).toBe(true);
    expect(eventView(ev({ locations: ['helgen'] }), locations).fitAll).toBe(false);
    expect(tagWidth({ en: 'Throat of the World', 'zh-tw': '世界之喉' })).toBeGreaterThan(tagWidth({ en: 'Kvatch', 'zh-tw': '科瓦奇' }));
    expect(tagWidth({ en: 'Kvatch', 'zh-tw': '科瓦奇' })).toBeGreaterThanOrEqual(36 + 3 * 13.5);
  });

  test('a single place on Nirn is framed at about the old focus zoom (1/2.5 of the map around it)', () => {
    const f = frameView('nirn', { points: [{ at: [470, 92], tag: 0 }], boxes: [], fitAll: false }, W, H);
    expect(f.k).toBeCloseTo(Math.min(W / 400, H / 240), 9);
    expect(f.y).toBe(0); // Atmora is near the top: clamped, no sea margin above
  });

  test('raster provinces stop at 2 screen px per map pixel (or cover, if that is already deeper); others at 8x cover', () => {
    expect(maxScale('summerset', 380, 253)).toBeCloseTo(2, 9);
    // A wide desktop plate needs more than 2x just to fill: cover is the limit then (no zooming in past it).
    expect(maxScale('summerset', 1380, 372)).toBeCloseTo(1380 / 566, 9);
    expect(maxScale('skyrim', 1380, 372)).toBeCloseTo(2, 9);
    expect(maxScale('tamriel', 1380, 372)).toBeCloseTo((1380 / 1000) * 8, 9);
    const f = frameView('summerset', { points: [{ at: [377, 44], tag: 0 }], boxes: [], fitAll: false }, 380, 253);
    expect(f.k).toBeLessThanOrEqual(2 + 1e-9);
  });

  test('clampView keeps zoom between cover and 8x cover', () => {
    const [w, h] = MAPS.tamriel.viewBox;
    const cover = coverScale(W, H, w, h);
    expect(clampView({ k: 0.1, x: 50, y: 50 }, W, H, w, h)).toEqual({ k: cover, x: 0, y: expect.any(Number) });
    expect(clampView({ k: 999, x: 0, y: 0 }, W, H, w, h).k).toBeCloseTo(cover * 8, 9);
  });

  test('viewOnParent draws a child point at the same screen pixel on the parent', () => {
    const v = { k: 2.2, x: -310, y: -95 };
    for (const child of ['skyrim', 'tamriel', 'nirn'] as const) {
      const pv = viewOnParent(v, child);
      const pt: Point = [400, 250];
      const [px, py] = project(pt, child, MAPS[child].parent!.layer, true);
      expect(px * pv.k + pv.x).toBeCloseTo(pt[0] * v.k + v.x, 9);
      expect(py * pv.k + pv.y).toBeCloseTo(pt[1] * v.k + v.y, 9);
    }
  });
});
