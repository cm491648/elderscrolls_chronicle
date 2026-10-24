// tests/unit/location-names.test.ts
// A place's name on the map comes from locations.json, its name in the stories from glossary.json; a renamed term
// must be renamed in both (phase 3 final review: five places kept names the user had replaced).
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

type Name = { en: string; 'zh-tw': string };
const glossary = JSON.parse(readFileSync('src/content/glossary.json', 'utf-8')) as ({ id: string } & Name)[];
const locations = JSON.parse(readFileSync('src/content/locations.json', 'utf-8')) as { id: string; name: Name }[];
const terms = new Map(glossary.map((t) => [t.id, t]));

describe('place names', () => {
  test('every place has a glossary entry with the same English and Chinese name', () => {
    const mismatched = locations
      .filter((l) => {
        const t = terms.get(l.id);
        return !t || t.en !== l.name.en || t['zh-tw'] !== l.name['zh-tw'];
      })
      .map((l) => `${l.id}: ${l.name['zh-tw']} / ${terms.get(l.id)?.['zh-tw'] ?? '(no glossary entry)'}`);
    expect(mismatched).toEqual([]);
  });
});
