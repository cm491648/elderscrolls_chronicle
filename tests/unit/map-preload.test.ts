import { describe, expect, test } from 'vitest';
import { mapPreload, mapPreloadScript, preloadChoice, type MapPreload } from '../../src/lib/map-preload';
import { MAPS } from '../../src/components/MapView/shapes';
import { frameView, eventView } from '../../src/lib/map-layers';
import { deviceWidth, rasterFor, basemapFor } from '../../src/lib/map-source';

const plan: MapPreload = { w: 1000, h: 600, bw: null, bh: null, zoomMax: 8, own: null, limit: 1600, density: 2, small: 's.webp', full: 'f.webp' };

describe('preloadChoice', () => {
  test('the whole layer: small or full, whichever the cover zoom needs', () => {
    expect(preloadChoice(plan, 800, 400, 1)).toBe('s.webp');
    expect(preloadChoice(plan, 1200, 600, 2)).toBe('f.webp');
  });
  test('nothing when the guessed height could tip the choice', () => {
    // cover = 1550/1000 at this size: within 15% of the 1600 limit either way.
    expect(preloadChoice(plan, 1550, 400, 1)).toBeNull();
  });
  test('a framed event: only "small" is certain (the map may zoom out to fit its names)', () => {
    const framed = { ...plan, bw: 100, bh: 60 };
    expect(preloadChoice({ ...framed, own: 1.2 }, 800, 400, 1)).toBe('s.webp');
    expect(preloadChoice(framed, 800, 400, 2)).toBeNull();
  });
  test('the density is capped as the map caps it', () => {
    expect(preloadChoice(plan, 700, 300, 3)).toBe(preloadChoice(plan, 700, 300, 2));
  });
});

describe('mapPreload', () => {
  test('the home page starts on Tamriel, at the cover zoom; agrees with the map for that size', () => {
    const p = mapPreload(null, [], 'en')!;
    expect(p).not.toBeNull();
    expect([p.w, p.h]).toEqual(MAPS.tamriel.viewBox);
    expect(p.bw).toBeNull();
    const bm = basemapFor('tamriel')!;
    for (const [W, H, dpr] of [[1200, 500, 1], [1200, 500, 2], [380, 300, 3]] as const) {
      const choice = preloadChoice(p, W, H, dpr);
      if (choice === null) continue;
      const k = frameView('tamriel', null, W, H).k;
      const want = rasterFor(deviceWidth(k * MAPS.tamriel.viewBox[0], dpr), bm);
      expect(choice).toContain(want === 'full' ? bm.href : bm.hrefSmall);
    }
  });
  test('an event page uses its own layer', () => {
    const event = { mapLayer: 'tamriel' as const, locations: [], regions: [] };
    expect(mapPreload(event, [], 'en')?.w).toBe(MAPS[eventView(event, []).layer].viewBox[0]);
  });
  test('the script is self-contained and only preloads', () => {
    const src = mapPreloadScript(plan);
    expect(src).toContain("l.rel='preload'");
    expect(() => new Function(src)).not.toThrow();
  });
});
