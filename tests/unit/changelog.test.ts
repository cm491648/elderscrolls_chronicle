import { describe, expect, test } from 'vitest';
import changelog from '../../src/content/changelog.json';

describe('changelog', () => {
  test('every entry has an ISO date and text in both languages', () => {
    expect(changelog.length).toBeGreaterThan(0);
    for (const c of changelog) {
      expect(c.date, JSON.stringify(c)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.en.trim(), c.date).not.toBe('');
      expect(c['zh-tw'].trim(), c.date).not.toBe('');
    }
  });
  test('newest first', () => {
    const dates = changelog.map((c) => c.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
