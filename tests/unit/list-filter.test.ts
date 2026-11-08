import { describe, expect, test } from 'vitest';
import { matches } from '../../src/lib/list-filter';

describe('list filter', () => {
  test('an empty query matches everything', () => {
    expect(matches('Thalmor 梭默', '   ')).toBe(true);
  });
  test('case, spaces, dots and apostrophes do not matter', () => {
    expect(matches("Stros M'Kai 斯圖爾斯·邁凱", 'stros mkai')).toBe(true);
    expect(matches("Stros M'Kai 斯圖爾斯·邁凱", '斯圖爾斯邁凱')).toBe(true);
    expect(matches('Tiber Septim 泰伯·賽普汀', 'SEPTIM')).toBe(true);
  });
  test('full-width letters match their plain form', () => {
    expect(matches('Thalmor', 'ｔｈａｌ')).toBe(true);
  });
  test('no match', () => {
    expect(matches('Thalmor 梭默', 'dagon')).toBe(false);
  });
});
