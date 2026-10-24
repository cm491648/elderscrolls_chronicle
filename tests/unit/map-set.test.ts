import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { MAPS, OFFICIAL_MAPS } from '../../src/components/MapView/shapes';
import { DRAWN_MAPS } from '../../src/components/MapView/shapes-drawn';
import { NIRN_TAMRIEL, SCHEMATIC_VIEWBOX } from '../../src/components/MapView/schematic-shapes';
import { locationPoint, placesOn, project } from '../../src/lib/map-layers';
import { basemapFor, currentMapSource } from '../../src/lib/map-source';
import { setMapSet } from '../../src/lib/map-set';
import type { Location } from '../../src/lib/types';

const locations = JSON.parse(readFileSync('src/content/locations.json', 'utf-8')) as Location[];
const byId = (id: string) => locations.find((l) => l.id === id)!;
afterEach(() => setMapSet('official'));

test('the official set is the default, and switching back restores it exactly', () => {
  expect(currentMapSource()).toBe('official');
  expect(MAPS).toBe(OFFICIAL_MAPS);
  const ic = byId('imperial-city');
  const before = project(locationPoint(ic), 'cyrodiil', 'tamriel');
  setMapSet('drawn');
  setMapSet('official');
  expect(MAPS).toBe(OFFICIAL_MAPS);
  expect(locationPoint(ic)).toEqual([ic.x, ic.y]);
  expect(project(locationPoint(ic), 'cyrodiil', 'tamriel')).toEqual(before);
});

test('the drawn set swaps the shapes, the places and the basemaps together', () => {
  setMapSet('drawn');
  expect(currentMapSource()).toBe('drawn');
  expect(MAPS).toBe(DRAWN_MAPS);
  expect(MAPS.tamriel.viewBox).toEqual(SCHEMATIC_VIEWBOX);
  expect(MAPS.tamriel.parent).toEqual({ layer: 'nirn', ...NIRN_TAMRIEL });
  expect(basemapFor('tamriel')?.href).toBe('/maps/drawn/schematic/tamriel.webp');
  // A province place carried up to Tamriel lands on its drawn position (no warps on the drawn map).
  for (const id of ['imperial-city', 'windhelm', 'daggerfall', 'vivec-city']) {
    const loc = byId(id);
    const [x, y] = project(locationPoint(loc), loc.layer, 'tamriel');
    expect(x, id).toBeCloseTo(loc.drawn!.x, 6);
    expect(y, id).toBeCloseTo(loc.drawn!.y, 6);
  }
  // Tamriel shows every province's places, as on the official map.
  expect(placesOn('tamriel', locations, new Set()).length).toBe(locations.filter((l) => l.layer !== 'nirn' && l.layer !== 'cosmos').length);
});
