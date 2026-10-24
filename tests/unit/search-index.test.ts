import { describe, expect, test } from 'vitest';
import { buildSearchIndex } from '../../src/lib/search-index';
import type { EventStory, EventSummary } from '../../src/lib/types';

const summary = (id: string, era: EventSummary['era'], year: number | null, title: string, people: string[] = []): EventSummary => ({
  id, era, year, order: 0, mapLayer: 'tamriel', locations: [], categories: ['war'], people, related: [], games: [],
  certainty: 'canon', review: 'agreed', title, titleEn: null,
});
const story = (id: string, terms: EventStory['terms']): EventStory => ({ id, illustration: null, html: '', notesHtml: null, terms, sources: [] });

describe('buildSearchIndex', () => {
  const input = {
    lang: 'zh-tw' as const,
    summaries: [summary('great-war', '4E', 171, '浩大戰爭'), summary('tiber', '2E', 854, '泰伯加冕', ['tiber-septim'])],
    otherTitles: { 'great-war': 'The Great War', tiber: 'Tiber Septim Crowned' },
    stories: {
      'great-war': story('great-war', [{ id: 'talos', name: { en: 'Talos', 'zh-tw': '塔洛斯' } }]),
      tiber: story('tiber', [
        { id: 'talos', name: { en: 'Talos', 'zh-tw': '塔洛斯' } },
        { id: 'tiber-septim', name: { en: 'Tiber Septim', 'zh-tw': '泰伯·賽普汀' } },
      ]),
    },
    people: [{ id: 'tiber-septim', name: { en: 'Tiber Septim', 'zh-tw': '泰伯·賽普汀' }, summary: { en: '', 'zh-tw': '' } }],
    plainStories: { 'great-war': '大戰正文', tiber: '加冕正文' },
  };

  test('lists events in timeline order with both titles, page language first, and the plain story', () => {
    const index = buildSearchIndex(input);
    expect(index.map((e) => e.id)).toEqual(['tiber', 'great-war']);
    expect(index[0].titles).toEqual(['泰伯加冕', 'Tiber Septim Crowned']);
    expect(index[1].text).toBe('大戰正文');
  });

  test('names come from the listed people and the marked terms, both languages, without repeats', () => {
    const [tiber, war] = buildSearchIndex(input);
    expect(tiber.names).toEqual(['泰伯·賽普汀', 'Tiber Septim', '塔洛斯', 'Talos']);
    expect(war.names).toEqual(['塔洛斯', 'Talos']);
  });

  test('an English title that reads the same is not listed twice', () => {
    const [, war] = buildSearchIndex({ ...input, otherTitles: { ...input.otherTitles, 'great-war': '浩大戰爭' } });
    expect(war.titles).toEqual(['浩大戰爭']);
  });
});
