import { describe, expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import zhTw from '../../src/i18n/zh-tw.json';
import { t } from '../../src/i18n';

describe('i18n', () => {
  test('both languages define the same keys', () => {
    expect(Object.keys(zhTw).sort()).toEqual(Object.keys(en).sort());
  });

  test('t looks up and fills variables', () => {
    expect(t('zh-tw', 'next')).toBe('下一則');
    expect(t('en', 'clusterLabel', { n: 3 })).toBe('3 events, zoom in');
  });
});
