import { describe, expect, test } from 'vitest';
import { eraLabel, formatDate, gameName, originalTitle } from '../../src/lib/format';

describe('format', () => {
  test('era labels in both languages', () => {
    expect(eraLabel('merethic', 'en')).toBe('Merethic Era');
    expect(eraLabel('3E', 'zh-tw')).toBe('第三紀元');
  });

  test('single year', () => {
    expect(formatDate({ era: '1E', year: 700 }, 'en')).toBe('1E 700');
    expect(formatDate({ era: '1E', year: 700 }, 'zh-tw')).toBe('第一紀元 700 年');
  });

  test('year range', () => {
    expect(formatDate({ era: '4E', year: 171, yearEnd: 175 }, 'en')).toBe('4E 171–175');
    expect(formatDate({ era: '4E', year: 171, yearEnd: 175 }, 'zh-tw')).toBe('第四紀元 171–175 年');
  });

  test('dawn and merethic dated events use the English era label', () => {
    expect(formatDate({ era: 'merethic', year: 2500 }, 'en')).toBe('Merethic Era 2500');
    expect(formatDate({ era: 'merethic', year: 2500, yearEnd: 2600 }, 'en')).toBe('Merethic Era 2500–2600');
    expect(formatDate({ era: 'merethic', year: 2500 }, 'zh-tw')).toBe('神話紀元 2500 年');
  });

  test('undated events', () => {
    expect(formatDate({ era: 'dawn', year: null }, 'en')).toBe('Dawn Era (undated)');
    expect(formatDate({ era: 'dawn', year: null }, 'zh-tw')).toBe('黎明紀元（年代不可考）');
  });

  test('approximate years', () => {
    const e = { era: '1E', year: 792, circa: true } as const;
    expect(formatDate(e, 'en')).toBe('c. 1E 792');
    expect(formatDate(e, 'zh-tw')).toBe('第一紀元約 792 年');
    expect(formatDate({ ...e, year: 668, yearEnd: 700 }, 'en')).toBe('c. 1E 668–700');
    expect(formatDate({ ...e, year: 668, yearEnd: 700 }, 'zh-tw')).toBe('第一紀元約 668–700 年');
  });

  test('exact years read as before when circa is false', () => {
    expect(formatDate({ era: '4E', year: 201, circa: false }, 'zh-tw')).toBe('第四紀元 201 年');
    expect(formatDate({ era: '4E', year: 201, circa: false }, 'en')).toBe('4E 201');
  });

  test('circa says nothing about an undated event', () => {
    expect(formatDate({ era: 'dawn', year: null, circa: true }, 'zh-tw')).toBe('黎明紀元（年代不可考）');
  });

  test('game names', () => {
    expect(gameName('skyrim', 'en')).toBe('The Elder Scrolls V: Skyrim');
    expect(gameName('skyrim', 'zh-tw')).toBe('上古卷軸 V：無界天際');
  });

  test('the English source title is a subtitle on translated pages only', () => {
    expect(originalTitle('zh-tw', '紅山之戰', 'Battle of Red Mountain')).toBe('Battle of Red Mountain');
    expect(originalTitle('en', 'Battle of Red Mountain', 'Battle of Red Mountain')).toBeNull();
    expect(originalTitle('zh-tw', 'Mundus', 'Mundus')).toBeNull();
    expect(originalTitle('zh-tw', '紅山之戰', undefined)).toBeNull();
  });
});
