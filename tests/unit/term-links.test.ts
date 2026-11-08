import { describe, expect, test } from 'vitest';
import { personHref, primaryTermHref, termLinks } from '../../src/lib/term-links';

describe('term links', () => {
  test('a glossary term links to its entry', () => {
    expect(termLinks({ id: 'thalmor', glossary: true }, 'zh-tw')).toEqual({ glossary: '/zh-tw/glossary/#thalmor', biography: null });
    expect(primaryTermHref({ id: 'thalmor', glossary: true }, 'zh-tw')).toBe('/zh-tw/glossary/#thalmor');
  });
  test('a person with a biography links to it first', () => {
    const term = { id: 'titus-mede-ii', glossary: true as const, biography: true as const };
    expect(termLinks(term, 'en')).toEqual({ glossary: '/en/glossary/#titus-mede-ii', biography: '/en/biographies/titus-mede-ii/' });
    expect(primaryTermHref(term, 'en')).toBe('/en/biographies/titus-mede-ii/');
  });
  test('a person with no biography links to their glossary entry only', () => {
    const term = { id: 'lorkhan', glossary: true as const };
    expect(termLinks(term, 'zh-tw')).toEqual({ glossary: '/zh-tw/glossary/#lorkhan', biography: null });
    expect(primaryTermHref(term, 'zh-tw')).toBe('/zh-tw/glossary/#lorkhan');
  });
  test('a place with no glossary entry links nowhere', () => {
    expect(primaryTermHref({ id: 'somewhere' }, 'en')).toBeNull();
  });
});

describe('personHref', () => {
  test('a person with a biography links to it', () => {
    expect(personHref({ id: 'titus-mede-ii', biography: true }, 'zh-tw')).toBe('/zh-tw/biographies/titus-mede-ii/');
  });
  test('everyone else links to their glossary entry', () => {
    expect(personHref({ id: 'lorkhan' }, 'en')).toBe('/en/glossary/#lorkhan');
  });
});
