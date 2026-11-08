import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatGlossary } from '../../scripts/glossary-format.mjs';

describe('glossary format', () => {
  test('one entry per line, keys and values separated by ", " and ": "', () => {
    const text = formatGlossary([{ id: 'a', name: { en: 'A', 'zh-tw': '甲' }, source: 'original' }]);
    expect(text).toBe('[\n  {"id": "a", "name": {"en": "A", "zh-tw": "甲"}, "source": "original"}\n]\n');
  });

  test('re-formatting the glossary file leaves it byte for byte the same', () => {
    const file = readFileSync('src/content/glossary.json', 'utf-8');
    expect(formatGlossary(JSON.parse(file))).toBe(file);
  });
});
