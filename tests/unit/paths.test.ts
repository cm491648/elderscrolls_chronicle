import { describe, expect, test } from 'vitest';
import { eventUrl, homeUrl, parseEventId, withBase } from '../../src/lib/paths';

describe('paths', () => {
  test('withBase prefixes the site base', () => {
    expect(withBase('/en/')).toBe('/en/');
  });

  test('builds home and event URLs', () => {
    expect(homeUrl('zh-tw')).toBe('/zh-tw/');
    expect(eventUrl('en', 'battle-of-red-mountain')).toBe('/en/events/battle-of-red-mountain/');
  });

  test('parses the event id from a pathname', () => {
    expect(parseEventId('/en/events/battle-of-red-mountain/')).toBe('battle-of-red-mountain');
    expect(parseEventId('/repo/zh-tw/events/great-war')).toBe('great-war');
    expect(parseEventId('/en/')).toBeNull();
  });

  test('can name the page file for hosts without directory indexes', () => {
    expect(homeUrl('en', 'index.html')).toBe('/en/index.html');
    expect(eventUrl('zh-tw', 'great-war', 'index.html')).toBe('/zh-tw/events/great-war/index.html');
    expect(parseEventId('/a/b/zh-tw/events/great-war/index.html')).toBe('great-war');
    expect(parseEventId('/en/index.html')).toBeNull();
  });
});
