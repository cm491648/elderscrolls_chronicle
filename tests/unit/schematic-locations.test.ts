import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NIRN_REGIONS, PROVINCE_POLYGONS, SKYRIM_HOLDS } from '../../src/components/MapView/schematic-shapes';
import { PROVINCES } from '../../src/lib/types';

type Pt = [number, number];
const locations = JSON.parse(readFileSync('src/content/locations.json', 'utf-8')) as {
  id: string;
  layer: string;
  sea?: boolean;
  drawn: { x: number; y: number };
}[];
// Rows of the basis table: | id | province | hold | kind | clue | placement |
const rows = readFileSync('docs/research/schematic-locations.md', 'utf-8')
  .split('\n')
  .filter((l) => /^\| [a-z-]+ \|/.test(l) && !l.startsWith('| id |'))
  .map((l) => l.split('|').map((c) => c.trim()))
  .map((c) => ({ id: c[1], province: c[2], hold: c[3], kind: c[4] }));

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

test('every place has a row in the basis table, and every row is a place', () => {
  expect(rows.map((r) => r.id).sort()).toEqual(locations.map((l) => l.id).sort());
  for (const r of rows) expect(['文字', '遊戲地圖', '文字＋調整', '官方地圖換算'], r.id).toContain(r.kind);
});

test('each place lies in the province (and Skyrim hold) its row names; open water lies off the land', () => {
  for (const loc of locations) {
    const row = rows.find((r) => r.id === loc.id)!;
    const at: Pt = [loc.drawn.x, loc.drawn.y];
    if (loc.layer === 'nirn') {
      expect(inside(NIRN_REGIONS.tamriel, at), loc.id).toBe(true);
      continue;
    }
    const province = PROVINCES.find((p) => inside(PROVINCE_POLYGONS[p], at)) ?? '海';
    expect(province, loc.id).toBe(loc.sea ? '海' : row.province);
    if (row.hold) expect(inside(SKYRIM_HOLDS[row.hold].polygons, at), `${loc.id} in ${row.hold}`).toBe(true);
  }
});
