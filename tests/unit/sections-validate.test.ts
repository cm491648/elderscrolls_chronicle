import { describe, expect, test } from 'vitest';
import { validateSections, type SectionsInput } from '../../src/lib/validate';

const both = { en: false, 'zh-tw': false };
const base = (): SectionsInput => ({
  topics: [{ id: 't', status: 'planned', events: ['e1'], hasBody: both }],
  biographies: [{ id: 'p', status: 'planned', hasBody: both }],
  translations: { topics: { en: ['t'], 'zh-tw': ['t'] }, biographies: { en: ['p'], 'zh-tw': ['p'] } },
  eventIds: ['e1'],
  personIds: ['p'],
  strict: false,
});

describe('validateSections', () => {
  test('planned entries with known events and people pass', () => {
    expect(validateSections(base())).toEqual([]);
  });

  test('unknown events, people and biographies are reported', () => {
    const input = base();
    input.topics[0].events = ['nope'];
    input.topics[0].people = ['nobody'];
    input.biographies[0].id = 'ghost';
    input.translations.biographies = { en: ['ghost'], 'zh-tw': ['ghost'] };
    expect(validateSections(input)).toEqual([
      'topic t: unknown event "nope"',
      'topic t: unknown person "nobody"',
      'biography ghost: not in people.json',
    ]);
  });

  test('planned entries have no text; published ones need text, sources, certainty and review', () => {
    const input = base();
    input.topics[0].hasBody = { en: true, 'zh-tw': false };
    input.biographies[0].status = 'published';
    expect(validateSections(input)).toEqual([
      'topic t: planned but has en text',
      'biography p: published without en text',
      'biography p: published without zh-tw text',
      'biography p: published without sources',
      'biography p: published without certainty',
      'biography p: published without review',
    ]);
  });

  test('strict builds refuse published entries whose review is unresolved', () => {
    const input = { ...base(), strict: true };
    input.biographies[0] = {
      id: 'p', status: 'published', hasBody: { en: true, 'zh-tw': true },
      sources: [{ title: 'A book', kind: 'book' }], certainty: 'canon', review: 'unresolved',
    };
    expect(validateSections(input)).toEqual(['biography p: review is unresolved']);
  });

  test('both languages need a file for every entry', () => {
    const input = base();
    input.translations.topics = { en: ['t'], 'zh-tw': ['t', 'extra'] };
    input.translations.biographies = { en: ['p'], 'zh-tw': [] };
    expect(validateSections(input)).toEqual([
      'topic extra: zh-tw file has no English entry',
      'biography p: missing zh-tw file',
    ]);
  });
});
