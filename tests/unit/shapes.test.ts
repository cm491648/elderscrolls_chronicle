import { describe, expect, test } from 'vitest';
import { MAPS, focusTransform, pathData, regionContains } from '../../src/components/MapView/shapes';
import locations from '../../src/content/locations.json';

describe('map shapes', () => {
  test('region ids are unique per layer', () => {
    for (const map of Object.values(MAPS)) {
      const ids = map.regions.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test('regionContains works for polygons and circles', () => {
    const square = { id: 's', name: { en: '', 'zh-tw': '' }, label: [0, 0] as [number, number],
      geometry: { kind: 'polygon' as const, points: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][] } };
    expect(regionContains(square, 5, 5)).toBe(true);
    expect(regionContains(square, 15, 5)).toBe(false);
    const disc = { ...square, geometry: { kind: 'circle' as const, cx: 0, cy: 0, r: 5 } };
    expect(regionContains(disc, 3, 3)).toBe(true);
    expect(regionContains(disc, 4, 4)).toBe(false);
  });

  test('regionContains works for a region of several outlines (mainland and islands)', () => {
    const two = { id: 'm', name: { en: '', 'zh-tw': '' }, label: [0, 0] as [number, number],
      geometry: { kind: 'polygons' as const, parts: [
        [[0, 0], [10, 0], [10, 10], [0, 10]],
        [[20, 0], [30, 0], [30, 10], [20, 10]],
      ] as [number, number][][] } };
    expect(regionContains(two, 5, 5)).toBe(true);
    expect(regionContains(two, 25, 5)).toBe(true);
    expect(regionContains(two, 15, 5)).toBe(false);
    expect(pathData(two.geometry.parts)).toBe('M0,0L10,0L10,10L0,10ZM20,0L30,0L30,10L20,10Z');
  });

  test('every region outline and label stays inside its map', () => {
    for (const map of Object.values(MAPS)) {
      const [w, h] = map.viewBox;
      for (const r of map.regions) {
        const g = r.geometry;
        const pts = g.kind === 'polygons' ? g.parts.flat() : g.kind === 'polygon' ? g.points : [];
        for (const [x, y] of pts) {
          expect(x >= 0 && x <= w && y >= 0 && y <= h, `${map.layer}/${r.id} point ${x},${y}`).toBe(true);
        }
        expect(r.label[0] >= 0 && r.label[0] <= w && r.label[1] >= 0 && r.label[1] <= h, `${r.id} label`).toBe(true);
      }
    }
  });

  test('the Tamriel provinces do not swallow each other: each label point lies in its own province only', () => {
    const tamriel = MAPS.tamriel.regions;
    for (const r of tamriel) {
      // Labels sit under the map's lettering, inside the province (Summerset's lettering is offshore).
      if (r.id === 'summerset') continue;
      const owners = tamriel.filter((o) => regionContains(o, r.label[0], r.label[1])).map((o) => o.id);
      expect(owners, r.id).toEqual([r.id]);
    }
  });

  test('every location lies inside its region (open water only inside its layer)', () => {
    for (const loc of locations as { id: string; layer: string; region: string; x: number; y: number; sea?: boolean }[]) {
      const map = MAPS[loc.layer as keyof typeof MAPS];
      const region = map.regions.find((r) => r.id === loc.region);
      expect(region, `${loc.id}: region ${loc.region}`).toBeDefined();
      if (loc.sea) {
        const [w, h] = map.viewBox;
        expect(loc.x > 0 && loc.x < w && loc.y > 0 && loc.y < h, `${loc.id} on its layer`).toBe(true);
        expect(regionContains(region!, loc.x, loc.y), `${loc.id} is water, off the land outline`).toBe(false);
      } else expect(regionContains(region!, loc.x, loc.y), `${loc.id} outside ${loc.region}`).toBe(true);
    }
  });
});

describe('focus zoom per layer', () => {
  test('the cosmos zooms in gently (its drawn map is only 1024 px wide); Tamriel and Nirn at 2.5x', () => {
    expect(MAPS.cosmos.focusScale).toBe(1.6);
    expect(MAPS.tamriel.focusScale).toBe(2.5);
    expect(MAPS.nirn.focusScale).toBe(2.5);
    expect(MAPS.nirn.looseRegions).toBe(true);
    expect(MAPS.tamriel.looseRegions).toBeUndefined();
  });
});

describe('focusTransform', () => {
  test('centers a mid-map location', () => {
    // 500,350 on a 1000x700 map at k=2.5 -> translate so it sits at the viewport center
    expect(focusTransform(500, 350, 1000, 700, 2.5)).toEqual({ x: -750, y: -525, k: 2.5 });
  });

  test('clamps near the left/top edge to 0', () => {
    expect(focusTransform(50, 40, 1000, 700, 2.5)).toEqual({ x: 0, y: 0, k: 2.5 });
  });

  test('clamps near the right/bottom edge to w - k*w, h - k*h', () => {
    expect(focusTransform(980, 690, 1000, 700, 2.5)).toEqual({ x: -1500, y: -1050, k: 2.5 });
  });
});
