import { describe, expect, test } from 'vitest';
import { plainText, renderTerms, splitNotes, termIds } from '../../src/lib/terms';
import type { TermInfo } from '../../src/lib/types';

const terms = new Map<string, TermInfo>([
  ['nords', { id: 'nords', name: { en: 'Nords', 'zh-tw': '諾德人' } }],
  ['skyrim', { id: 'skyrim', name: { en: 'Skyrim', 'zh-tw': '天際' }, summary: { en: 'A northern province.', 'zh-tw': '北方的省份。' } }],
]);

describe('termIds', () => {
  test('lists ids in order, with repeats', () => {
    expect(termIds('{{nords}} came to {{skyrim|the north}}; {{nords}} stayed.')).toEqual(['nords', 'skyrim', 'nords']);
  });
});

describe('splitNotes', () => {
  test('splits at a notes heading in either language', () => {
    expect(splitNotes('Story.\n\n## 註\n\nNote.')).toEqual({ story: 'Story.', notes: 'Note.' });
    expect(splitNotes('Story.\n\n## Notes\n\nNote.')).toEqual({ story: 'Story.', notes: 'Note.' });
  });
  test('no heading means no notes', () => {
    expect(splitNotes('Story only.')).toEqual({ story: 'Story only.', notes: null });
  });
});

describe('renderTerms', () => {
  test('zh: the name alone, every time (the English name is in the tooltip)', () => {
    expect(renderTerms('{{nords}}與{{nords}}', 'zh-tw', terms)).toBe(
      '<b class="term" data-term="nords" tabindex="0">諾德人</b>與<b class="term" data-term="nords" tabindex="0">諾德人</b>',
    );
  });
  test('en: plain bold; custom display text', () => {
    expect(renderTerms('{{skyrim|the north}}', 'en', terms)).toBe(
      '<b class="term" data-term="skyrim" tabindex="0">the north</b>',
    );
  });
  test('unknown ids throw', () => {
    expect(() => renderTerms('{{ghost}}', 'en', terms)).toThrow('Unknown term "ghost"');
  });
});

describe('plainText', () => {
  test('replaces markup and strips markdown', () => {
    expect(plainText('**{{nords}}** reached {{skyrim}}.', 'zh-tw', terms)).toBe('諾德人 reached 天際.');
  });
});
