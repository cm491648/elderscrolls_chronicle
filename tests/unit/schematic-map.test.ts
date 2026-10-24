import { readFileSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { BORDERS, COAST, HOLD_BORDERS, LAKES, SKYRIM_HOLDS, NIRN_REGIONS, NIRN_TAMRIEL, NIRN_VIEWBOX, PROVINCE_POLYGONS, RANGES, RIVERS, SCHEMATIC_VIEWBOX } from '../../src/components/MapView/schematic-shapes';
import { PROVINCES, type Province } from '../../src/lib/types';

type Pt = [number, number];
interface Params {
  ranges: { id: string; between: [Province, Province]; basis: string }[];
  adjacent: [Province, Province][];
  notAdjacent: [Province, Province][];
  checks: { at: Pt; is: Province | 'sea'; basis: string; note: string }[];
  holds: { centres: Record<string, Pt>; adjacent: [string, string][] };
  nirn: { checks: { continent: keyof typeof NIRN_REGIONS; direction: 'north' | 'east' | 'south' | 'west'; basis: string }[] };
  [k: string]: unknown;
}
const params = JSON.parse(readFileSync('src/content/schematic-map.json', 'utf-8')) as Params;
const basisDoc = readFileSync('docs/research/schematic-map.md', 'utf-8');
const key = (a: string, b: string) => [a, b].sort().join('|');

/** Even-odd point in polygon set (a mainland and its islands). */
function inside(polys: Pt[][], [x, y]: Pt) {
  let c = false;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[j];
      if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
    }
  }
  return c;
}
const where = (p: Pt) => PROVINCES.find((k) => inside(PROVINCE_POLYGONS[k], p)) ?? 'sea';

describe('schematic map', () => {
  test('every parameter names a basis that the basis table defines', () => {
    const bases = JSON.stringify(params).match(/"basis":"([^"]+)"/g)!.map((m) => m.slice(9, -1));
    expect(bases.length).toBeGreaterThan(40);
    for (const b of new Set(bases)) expect(basisDoc, b).toContain(`| ${b} |`);
  });

  test('every province has an area', () => {
    for (const p of PROVINCES) expect(PROVINCE_POLYGONS[p].length, p).toBeGreaterThan(0);
  });

  test('provinces the texts call neighbours share a border; ones they do not, do not', () => {
    for (const [a, b] of params.adjacent) expect(BORDERS[key(a, b)], `${a} / ${b}`).toBeDefined();
    for (const [a, b] of params.notAdjacent) expect(BORDERS[key(a, b)], `${a} / ${b}`).toBeUndefined();
  });

  test('bays, inner sea, peninsulas and islands are where the texts put them', () => {
    for (const c of params.checks) expect(where(c.at), `${c.note} (${c.basis})`).toBe(c.is);
  });

  test('each mountain range runs along the border it divides', () => {
    expect(RANGES.map((r) => r.name).sort()).toEqual(['druadach', 'jerall', 'valus', 'velothi']);
    for (const r of params.ranges) {
      const range = RANGES.find((x) => x.name === r.id)!;
      expect(range.line).toEqual(BORDERS[key(...r.between)]);
      const length = range.line.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - range.line[i][0], y - range.line[i][1]), 0);
      expect(length, r.id).toBeGreaterThan(60);
    }
  });

  test('rivers, lakes and the coast exist, and the generated file stays small', () => {
    expect(RIVERS.map((r) => r.name)).toEqual(['niben', 'white', 'bjoulsae']);
    expect(LAKES.map((l) => l.name)).toEqual(['rumare']);
    expect(COAST.startsWith('M')).toBe(true);
    expect(statSync('src/components/MapView/schematic-shapes.ts').size).toBeLessThan(60 * 1024);
  });
});

describe('schematic Nirn', () => {
  const centre = (polys: Pt[][]) => {
    const pts = polys.flat();
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length] as Pt;
  };

  test('each land lies the way the texts say from Tamriel', () => {
    const [tx, ty] = centre(NIRN_REGIONS.tamriel);
    for (const c of params.nirn.checks) {
      const [x, y] = centre(NIRN_REGIONS[c.continent]);
      const dx = x - tx;
      const dy = y - ty;
      const way = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
      expect(way, `${c.continent} (${c.basis})`).toBe(c.direction);
    }
  });

  test('the lands do not overlap, and Tamriel sits where its layer link puts it', () => {
    const lands = Object.keys(NIRN_REGIONS) as (keyof typeof NIRN_REGIONS)[];
    for (const a of lands) for (const b of lands) if (a !== b) expect(inside(NIRN_REGIONS[b], centre(NIRN_REGIONS[a])), `${a} in ${b}`).toBe(false);
    const [w, h] = SCHEMATIC_VIEWBOX;
    const { k, x, y } = NIRN_TAMRIEL;
    const [cx, cy] = centre(NIRN_REGIONS.tamriel);
    expect(Math.abs(cx - (x + (w * k) / 2))).toBeLessThan(40);
    expect(Math.abs(cy - (y + (h * k) / 2))).toBeLessThan(40);
    expect(x + w * k).toBeLessThan(NIRN_VIEWBOX[0]);
    expect(y + h * k).toBeLessThan(NIRN_VIEWBOX[1]);
  });
});

describe('Skyrim holds', () => {
  test('all nine, each name inside its own area, every area inside Skyrim', () => {
    expect(Object.keys(SKYRIM_HOLDS).sort()).toEqual(Object.keys(params.holds.centres).sort());
    expect(Object.keys(SKYRIM_HOLDS)).toHaveLength(9);
    for (const [h, { label, polygons }] of Object.entries(SKYRIM_HOLDS)) {
      expect(inside(polygons, label), h).toBe(true);
      expect(where(label), h).toBe('skyrim');
    }
  });

  test('holds the texts call neighbours share a border', () => {
    for (const [a, b] of params.holds.adjacent) expect(HOLD_BORDERS[key(a, b)], `${a} / ${b}`).toBeDefined();
  });
});
