import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  SEGMENTS,
  aboutUrl,
  biographyIndexUrl,
  biographyUrl,
  eventUrl,
  glossaryUrl,
  homeUrl,
  otherLangUrl,
  parseEventId,
  topicIndexUrl,
  topicUrl,
  withBase,
} from '../../src/lib/paths';

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

  test('builds the section URLs', () => {
    expect(topicIndexUrl('zh-tw')).toBe('/zh-tw/topics/');
    expect(topicUrl('en', 'great-war')).toBe('/en/topics/great-war/');
    expect(biographyIndexUrl('en')).toBe('/en/biographies/');
    expect(biographyUrl('zh-tw', 'tiber-septim')).toBe('/zh-tw/biographies/tiber-septim/');
    expect(glossaryUrl('zh-tw')).toBe('/zh-tw/glossary/');
    expect(glossaryUrl('en', 'thalmor')).toBe('/en/glossary/#thalmor');
    expect(aboutUrl('en')).toBe('/en/about/');
    expect(topicUrl('en', 'great-war', 'index.html')).toBe('/en/topics/great-war/index.html');
    expect(glossaryUrl('en', 'thalmor', 'index.html')).toBe('/en/glossary/index.html#thalmor');
  });

  test('swaps the language in a pathname', () => {
    expect(otherLangUrl('/zh-tw/biographies/tiber-septim/', 'en')).toBe('/en/biographies/tiber-septim/');
    expect(otherLangUrl('/repo/en/glossary/', 'zh-tw')).toBe('/repo/zh-tw/glossary/');
  });

  test('every section segment has its page folder', () => {
    for (const seg of Object.values(SEGMENTS)) expect(existsSync(`src/pages/[lang]/${seg}/index.astro`), seg).toBe(true);
  });
});
