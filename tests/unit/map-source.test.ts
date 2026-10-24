import { existsSync, statSync } from 'node:fs';
import { webpSize } from './helpers/webp';
import { describe, expect, test } from 'vitest';
import { BASEMAPS, FULL_RATIO, MAP_SOURCE, MAX_DENSITY, PREVIEW_WIDTH, basemapFor, deviceWidth, rasterFor, svgArtFor } from '../../src/lib/map-source';
import { MAPS, OFFICIAL_MAPS } from '../../src/components/MapView/shapes';
import { DRAWN_MAPS } from '../../src/components/MapView/shapes-drawn';
import { MAP_LAYERS, PROVINCES } from '../../src/lib/types';

const publicFile = (href: string) => `public${href}`;

describe('map source switch', () => {
  test('official source: the Anthology map for Tamriel, our drawn rasters for Nirn and the cosmos', () => {
    expect(MAP_SOURCE).toBe('official');
    expect(basemapFor('tamriel')?.href).toBe('/maps/official/tamriel-anthology.webp');
    expect(basemapFor('tamriel')?.credit).toBe('mapCreditAnthology');
    expect(basemapFor('nirn')?.href).toBe('/maps/drawn/nirn-drawn.webp');
    expect(basemapFor('cosmos')?.href).toBe('/maps/drawn/cosmos-drawn.webp');
    for (const layer of ['nirn', 'cosmos'] as const) expect(basemapFor(layer)?.credit).toBe('mapCreditDrawn');
    for (const layer of MAP_LAYERS) expect(svgArtFor(layer)).toBeNull();
  });

  test('official source: Skyrim and Cyrodiil are the game maps (two sizes), credited to the games, linked to UESP', () => {
    for (const [p, file, credit] of [
      ['skyrim', 'SR-map-Skyrim.jpg', 'mapCreditSkyrim'],
      ['cyrodiil', 'OB-map-Cyrodiil.jpg', 'mapCreditOblivion'],
    ] as const) {
      const map = basemapFor(p)!;
      expect(map.href).toBe(`/maps/official/provinces/${p}.webp`);
      expect(map.hrefSmall).toBe(`/maps/official/provinces/${p}-1024.webp`);
      expect(map.smallWidth).toBe(1024);
      expect([map.width, map.height]).toEqual(MAPS[p].viewBox);
      expect(map.credit).toBe(credit);
      expect(map.sourceUrl).toBe(`https://en.uesp.net/wiki/File:${file}`);
    }
  });

  test('official source: the other seven province layers are their Anthology crops, one size, linked to UESP', () => {
    for (const p of PROVINCES.filter((p) => p !== 'skyrim' && p !== 'cyrodiil')) {
      const map = basemapFor(p)!;
      expect(map.href).toBe(`/maps/official/provinces/${p}.webp`);
      expect(map.hrefSmall).toBe(map.href);
      expect(map.smallWidth).toBe(map.width);
      expect([map.width, map.height]).toEqual(MAPS[p].viewBox);
      expect(map.credit).toBe('mapCreditAnthology');
      expect(map.sourceUrl).toMatch(/^https:\/\/en\.uesp\.net\/wiki\/File:LO-map-[A-Za-z_]+_\(Anthology\)\.jpg$/);
    }
  });

  test('drawn source: the provinces are painted layers of our own, credited to the site', () => {
    for (const p of PROVINCES) {
      expect(basemapFor(p, 'drawn')?.href).toBe(`/maps/drawn/schematic/${p}.webp`);
      expect(basemapFor(p, 'drawn')?.credit).toBe('mapCreditSchematic');
      expect(svgArtFor(p, 'drawn')).toBeNull();
    }
  });

  test('drawn source: nothing official anywhere; Nirn, Tamriel and the provinces are painted over the schematic map', () => {
    for (const layer of ['nirn', 'tamriel', ...PROVINCES] as const) {
      expect(basemapFor(layer, 'drawn')?.href, layer).toBe(`/maps/drawn/schematic/${layer}.webp`);
      expect(svgArtFor(layer, 'drawn'), layer).toBeNull();
    }
    // The cosmos keeps its drawn raster (it never was the official map's).
    expect(basemapFor('cosmos', 'drawn')).toEqual(basemapFor('cosmos', 'official'));
    expect(Object.keys(BASEMAPS.drawn).sort()).toEqual(['cosmos', 'nirn', 'tamriel', ...PROVINCES].sort());
    for (const map of Object.values(BASEMAPS.drawn)) expect(map.href).toMatch(/^\/maps\/drawn\//);
  });

  test('every basemap file exists, is WebP under the size budget; official maps link their source', () => {
    for (const layers of Object.values(BASEMAPS)) {
      for (const map of Object.values(layers)) {
        for (const [href, budget] of [[map.href, 1024], [map.hrefSmall, 400]] as const) {
          expect(href).toMatch(/^\/maps\/(official|drawn)\/.+\.webp$/);
          expect(existsSync(publicFile(href)), href).toBe(true);
          expect(statSync(publicFile(href)).size / 1024, href).toBeLessThan(budget);
        }
        const ours = map.credit === 'mapCreditDrawn' || map.credit === 'mapCreditSchematic';
        if (!ours) expect(map.sourceUrl).toMatch(/^https:\/\/en\.uesp\.net\/wiki\/File:/);
        else expect(map.href).toMatch(/^\/maps\/drawn\//);
      }
    }
  });

  test('a basemap matches its declared size and the aspect ratio of its layer viewBox', () => {
    for (const [source, layers] of Object.entries(BASEMAPS)) {
      for (const [layer, map] of Object.entries(layers) as [keyof typeof MAPS, NonNullable<(typeof layers)['tamriel']>][]) {
        expect(webpSize(publicFile(map.href)), `${source}/${layer}`).toEqual({ width: map.width, height: map.height });
        const small = webpSize(publicFile(map.hrefSmall));
        expect(Math.abs(small.width / small.height - map.width / map.height), `${layer} small`).toBeLessThan(0.01);
        // Each source has its own layers (the drawn map's come from shapes-drawn.ts).
        const [w, h] = (source === 'drawn' ? DRAWN_MAPS : OFFICIAL_MAPS)[layer].viewBox;
        expect(Math.abs(map.width / map.height - w / h), `${layer} viewBox`).toBeLessThan(0.002);
      }
    }
  });

  test('one image per page: each map switches to its full image past its own small width x FULL_RATIO', () => {
    const anthology = basemapFor('tamriel')!;
    const nirn = basemapFor('nirn')!;
    const cosmos = basemapFor('cosmos')!;
    // The Anthology map keeps its 1600-device-pixel threshold.
    expect(anthology.smallWidth * FULL_RATIO).toBeCloseTo(1600, 6);
    expect(rasterFor(1600, anthology)).toBe('small');
    expect(rasterFor(1601, anthology)).toBe('full');
    // Pixel 7 focused on a place: 380 css px x 2.625 DPR x 2.5 zoom ~ 2490 device px -> full; whole map ~ 1000 -> small.
    expect(rasterFor(380 * 2.625 * 2.5, anthology)).toBe('full');
    expect(rasterFor(380 * 2.625, anthology)).toBe('small');
    // Desktop 1440x900 DPR 1, cosmos focused: the square map is ~585 px x 1.6 zoom ~ 936 device px -> never the
    // 512 px image stretched 1.8x; Nirn focused on a ~940 px plate x 2.5 -> full too.
    expect(rasterFor(585 * 1.6, cosmos)).toBe('full');
    expect(rasterFor(940 * 2.5, nirn)).toBe('full');
    // Small images are still used where they suffice: a phone showing the whole cosmos (~520 device px).
    expect(rasterFor(520, cosmos)).toBe('small');
    for (const map of [anthology, nirn, cosmos]) expect(webpSize(publicFile(map.hrefSmall)).width).toBe(map.smallWidth);
  });});

describe('screen density', () => {
  test('a dense phone screen counts as twice its CSS width, no more', () => {
    expect(MAX_DENSITY).toBe(2);
    expect(deviceWidth(700, 2.625)).toBe(1400);
    expect(deviceWidth(700, 1)).toBe(700);
    expect(deviceWidth(700, 1.5)).toBe(1050);
    expect(rasterFor(deviceWidth(700, 2.625), { smallWidth: 1440 })).toBe('small');
  });
});

describe('map previews', () => {
  test('every raster has a tiny preview of the same shape, shown while the plate loads', () => {
    let n = 0;
    for (const source of ['official', 'drawn'] as const) {
      for (const bm of Object.values(BASEMAPS[source])) {
        expect(bm.hrefPreview).toBe(bm.href.replace(/\.webp$/, '-preview.webp'));
        const file = `public${bm.hrefPreview}`;
        expect(existsSync(file), file).toBe(true);
        const { width, height } = webpSize(file);
        expect(width).toBe(PREVIEW_WIDTH);
        expect(Math.abs(height / width - bm.height / bm.width)).toBeLessThan(0.03);
        expect(statSync(file).size, file).toBeLessThan(2048);
        n++;
      }
    }
    expect(n).toBe(24); // official: Nirn, the cosmos, Tamriel and nine provinces; drawn: the same twelve, its own
  });
});
