// tests/unit/visual-canon.test.ts
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { CANON_ERAS, CANON_REGIONS, checkCanon, itemsFor, parseEntry, parseRefs, pickVersion, resolveSnippet, resolveVersion } from '../../scripts/visual-canon.mjs';

const LEGION = `---
id: imperial-legion
category: factions
name: { en: Imperial Legion, zh-tw: 帝國軍團 }
variants:
  default: tes5
  tes4: "Oblivion legion: segmented steel lorica, red cloth"
  tes5: "Skyrim legion: red tunic, leather and steel plates, round-topped helmet"
refs: [legion-tes5-1]
sources: [https://en.uesp.net/wiki/Lore:Imperial_Legion]
---

## 必要特徵
- 紅色布料搭配皮革與鋼片
- 圓頂頭盔

## 常見錯誤
- Do not draw a Roman scutum shield.

## 版本差異
- 4 代是分段鋼甲
`;

describe('parseEntry', () => {
  test('reads frontmatter and the two checklists', () => {
    const e = parseEntry(LEGION, 'factions/imperial-legion.md');
    expect(e.id).toBe('imperial-legion');
    expect(e.name['zh-tw']).toBe('帝國軍團');
    expect(e.variants.default).toBe('tes5');
    expect(e.mustHave).toEqual([{ text: '紅色布料搭配皮革與鋼片', versions: null }, { text: '圓頂頭盔', versions: null }]);
    expect(e.mistakes).toEqual([{ text: 'Do not draw a Roman scutum shield.', versions: null }]);
  });
  test('rejects the literal "default" as the default version', () => {
    expect(() => parseEntry(LEGION.replace('default: tes5', 'default: default'), 'x.md')).toThrow(/default/);
  });
  test('rejects an unknown version key or a default that names no variant', () => {
    expect(() => parseEntry(LEGION.replace('tes4:', 'tes2:'), 'x.md')).toThrow(/tes2/);
    expect(() => parseEntry(LEGION.replace('default: tes5', 'default: tes3'), 'x.md')).toThrow(/default/);
  });
  test('rejects an entry without sources or without must-have features', () => {
    expect(() => parseEntry(LEGION.replace('sources: [https://en.uesp.net/wiki/Lore:Imperial_Legion]', 'sources: []'), 'x.md')).toThrow(/sources/);
    expect(() => parseEntry(LEGION.replace(/## 必要特徵\n- .*\n- .*\n/, '## 必要特徵\n'), 'x.md')).toThrow(/必要特徵/);
  });
});

describe('pickVersion', () => {
  test('follows the era and game rule', () => {
    expect(pickVersion({ era: '4E', year: 201, region: 'skyrim' })).toBe('tes5');
    expect(pickVersion({ era: '3E', year: 433, region: 'cyrodiil' })).toBe('tes4');
    expect(pickVersion({ era: '3E', year: 427, region: 'morrowind' })).toBe('tes3');
    expect(pickVersion({ era: '3E', year: 417, region: 'high-rock' })).toBeNull();
    expect(pickVersion({ era: '2E', year: 854, region: 'cyrodiil' })).toBe('eso');
    expect(pickVersion({ era: 'merethic', year: null, region: 'skyrim' })).toBeNull();
  });
});

describe('resolveVersion', () => {
  const e = parseEntry(LEGION, 'factions/imperial-legion.md');
  test('names the version key that resolveSnippet uses', () => {
    expect(resolveVersion(e, 'tes4')).toBe('tes4');
    expect(resolveVersion(e, 'eso')).toBe('tes5'); // eso falls back to tes5
    expect(resolveVersion(e, 'tes3')).toBe('tes5'); // no tes3 variant: default
    expect(resolveVersion(e, null)).toBe('tes5');
    for (const v of ['tes3', 'tes4', 'tes5', 'eso', null]) expect(resolveSnippet(e, v)).toBe(e.variants[resolveVersion(e, v)]);
  });
  test('eso falls back to the default when there is no tes5 variant', () => {
    const only4 = parseEntry(LEGION.replace(/ {2}tes5: .*\n/, '').replace('default: tes5', 'default: tes4'), 'x.md');
    expect(resolveVersion(only4, 'eso')).toBe('tes4');
  });
});

describe('resolveSnippet', () => {
  const e = parseEntry(LEGION, 'x.md');
  test('uses the asked version, falls back from eso to tes5, else the default', () => {
    expect(resolveSnippet(e, 'tes4')).toMatch(/Oblivion/);
    expect(resolveSnippet(e, 'eso')).toMatch(/Skyrim/);
    expect(resolveSnippet(e, 'tes3')).toMatch(/Skyrim/);
    expect(resolveSnippet(e, null)).toMatch(/Skyrim/);
  });
});

describe('parseRefs and checkCanon', () => {
  const refsMd = `| id | 條目 | 網址 | 說明 |\n|---|---|---|---|\n| legion-tes5-1 | imperial-legion | https://images.uesp.net/a/b.jpg | 軍團士兵 |\n`;
  test('parseRefs reads the table', () => {
    expect(parseRefs(refsMd)).toEqual([{ id: 'legion-tes5-1', entry: 'imperial-legion', url: 'https://images.uesp.net/a/b.jpg', note: '軍團士兵' }]);
  });
  test('checkCanon reports missing entries, refs and override versions', () => {
    const entries = new Map([['imperial-legion', parseEntry(LEGION, 'x.md')]]);
    const subjects = {
      'great-war': { era: '4E', year: 171, region: 'cyrodiil', phase: 1, entries: ['imperial-legion', 'thalmor'], overrides: { 'imperial-legion': 'tes3' } },
    };
    const problems = checkCanon({ entries, subjects, refs: [] });
    expect(problems).toContain('great-war: 條目 thalmor 不存在');
    expect(problems).toContain('great-war: imperial-legion 沒有 tes3 版本');
    expect(problems).toContain('imperial-legion: 參考圖 legion-tes5-1 不在 refs.md');
    expect(checkCanon({ entries, subjects: { 'great-war': { ...subjects['great-war'], entries: ['imperial-legion'], overrides: {} } }, refs: parseRefs(refsMd) })).toEqual([]);
  });
});

describe('version tags on 必要特徵 and 常見錯誤', () => {
  const TAGGED = LEGION.replace('- 圓頂頭盔\n', '- [tes5] 圓頂頭盔\n- [tes4, tes5] 金屬護頰\n').replace(
    '- Do not draw a Roman scutum shield.\n',
    '- Do not draw a Roman scutum shield.\n- [tes4] Do not draw red cloth on the plate.\n',
  );
  test('a leading [version, …] tag scopes an item; the tag is stripped from the text', () => {
    const e = parseEntry(TAGGED, 'x.md');
    expect(e.mustHave).toEqual([
      { text: '紅色布料搭配皮革與鋼片', versions: null },
      { text: '圓頂頭盔', versions: ['tes5'] },
      { text: '金屬護頰', versions: ['tes4', 'tes5'] },
    ]);
    expect(e.mistakes[1]).toEqual({ text: 'Do not draw red cloth on the plate.', versions: ['tes4'] });
  });
  test('itemsFor keeps untagged items and items tagged with the version', () => {
    const e = parseEntry(TAGGED, 'x.md');
    expect(itemsFor(e.mustHave, 'tes5')).toEqual(['紅色布料搭配皮革與鋼片', '圓頂頭盔', '金屬護頰']);
    expect(itemsFor(e.mustHave, 'tes4')).toEqual(['紅色布料搭配皮革與鋼片', '金屬護頰']);
    expect(itemsFor(e.mistakes, 'tes5')).toEqual(['Do not draw a Roman scutum shield.']);
  });
  test('rejects a tag naming an unknown version, a version the entry has no variant for, or an empty tag', () => {
    expect(() => parseEntry(TAGGED.replace('[tes5] 圓頂', '[tes2] 圓頂'), 'x.md')).toThrow(/tes2/);
    expect(() => parseEntry(TAGGED.replace('[tes5] 圓頂', '[tes3] 圓頂'), 'x.md')).toThrow(/tes3/);
    expect(() => parseEntry(TAGGED.replace('[tes5] 圓頂', '[default] 圓頂'), 'x.md')).toThrow(/default/);
    expect(() => parseEntry(TAGGED.replace('[tes5] 圓頂', '[] 圓頂'), 'x.md')).toThrow(/標記/);
  });
  test('every version the entry has must keep at least one 必要特徵', () => {
    const allTagged = LEGION.replace('- 紅色布料搭配皮革與鋼片\n- 圓頂頭盔\n', '- [tes5] 紅色布料搭配皮革與鋼片\n- [tes5] 圓頂頭盔\n');
    expect(() => parseEntry(allTagged, 'x.md')).toThrow(/tes4/);
  });
});

describe('era and region vocabulary', () => {
  test('the canon eras are the site eras', () => {
    const types = readFileSync('src/lib/types.ts', 'utf-8');
    const eras = JSON.parse(types.match(/export const ERAS = (\[.*?\]) as const/)![1].replace(/'/g, '"'));
    expect(CANON_ERAS).toEqual(eras);
  });
  test('checkCanon reports an unknown era or region, and an override that is not a version key', () => {
    const entries = new Map([['imperial-legion', parseEntry(LEGION, 'x.md')]]);
    const ok = { era: '4E', year: 171, region: 'cyrodiil', phase: 1, entries: ['imperial-legion'], overrides: {} };
    expect(CANON_REGIONS).toContain('cyrodiil');
    expect(checkCanon({ entries, subjects: { a: ok }, refs: [] })).toEqual(['imperial-legion: 參考圖 legion-tes5-1 不在 refs.md']);
    const problems = checkCanon({
      entries,
      subjects: { a: { ...ok, era: '5E' }, b: { ...ok, region: 'vvardenfell' }, c: { ...ok, overrides: { 'imperial-legion': 'default' } } },
      refs: [],
    });
    expect(problems).toContain('a: 不認得的紀元 5E');
    expect(problems).toContain('b: 不認得的地區 vvardenfell');
    expect(problems).toContain('c: imperial-legion 的覆寫 default 不是版本鍵');
  });
});
