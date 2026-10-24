import { describe, expect, test } from 'vitest';
import { EMPTY_FILTER, FILTER_CATEGORIES, dimmedIds, filterCount, isFilterActive, matchesFilter, parseFilter, stepTarget } from '../../src/lib/filter';
import { CATEGORIES, type Category } from '../../src/lib/types';

const ev = (id: string, categories: Category[]) => ({ id, categories });
const myth = ev('creation-of-mundus', ['myth', 'divine']);
const war = ev('great-war', ['war', 'religion']);
const civil = ev('death-of-torygg', ['war', 'heroes']);
const ordered = [myth, war, civil];
const ids = ordered.map((e) => e.id);
const f = (categories: Category[]) => ({ categories });

describe('filter', () => {
  test('the panel offers the seven categories and nothing else', () => {
    expect(FILTER_CATEGORIES).toEqual(['myth', 'divine', 'war', 'religion', 'disaster', 'founding', 'heroes']);
    expect(FILTER_CATEGORIES).toEqual(CATEGORIES);
    expect(Object.keys(EMPTY_FILTER)).toEqual(['categories']);
  });
  test('an empty filter matches everything and dims nothing', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(matchesFilter(myth, EMPTY_FILTER)).toBe(true);
    expect(dimmedIds(ordered, EMPTY_FILTER).size).toBe(0);
  });
  test('any ticked category matches (OR)', () => {
    const two = f(['war', 'myth']);
    expect(isFilterActive(two)).toBe(true);
    expect(filterCount(two)).toBe(2);
    expect(matchesFilter(war, two)).toBe(true);
    expect(matchesFilter(myth, two)).toBe(true);
    expect(matchesFilter(ev('x', ['disaster']), two)).toBe(false);
  });
  test('the events a filter leaves out are dimmed', () => {
    expect([...dimmedIds(ordered, f(['war']))]).toEqual(['creation-of-mundus']);
    expect([...dimmedIds(ordered, f(['heroes']))]).toEqual(['creation-of-mundus', 'great-war']);
    expect([...dimmedIds(ordered, f(['war', 'myth']))]).toEqual([]);
  });
  test('a saved filter is read back, dropping unknown items and bad data', () => {
    expect(parseFilter(JSON.stringify(f(['war', 'heroes'])))).toEqual(f(['war', 'heroes']));
    // A filter saved while games could be ticked keeps its categories and drops the games.
    expect(parseFilter(JSON.stringify({ categories: ['war'], games: ['skyrim'] }))).toEqual(f(['war']));
    expect(parseFilter(JSON.stringify({ categories: ['politics', 'war'], games: ['fallout'] }))).toEqual(f(['war']));
    expect(parseFilter('not json')).toEqual(EMPTY_FILTER);
    expect(parseFilter(null)).toEqual(EMPTY_FILTER);
  });
});

describe('stepTarget', () => {
  test('without dimmed events it visits every neighbour, and → starts at the first', () => {
    expect(stepTarget(ids, 'creation-of-mundus', 1, new Set())).toBe('great-war');
    expect(stepTarget(ids, 'great-war', -1, new Set())).toBe('creation-of-mundus');
    expect(stepTarget(ids, null, 1, new Set())).toBe('creation-of-mundus');
    expect(stepTarget(ids, 'death-of-torygg', 1, new Set())).toBeNull();
  });
  test('it skips dimmed events, even from a dimmed one', () => {
    const dim = new Set(['great-war']);
    expect(stepTarget(ids, 'creation-of-mundus', 1, dim)).toBe('death-of-torygg');
    expect(stepTarget(ids, 'great-war', -1, dim)).toBe('creation-of-mundus');
    expect(stepTarget(ids, null, 1, new Set(['creation-of-mundus']))).toBe('great-war');
    expect(stepTarget(ids, 'death-of-torygg', -1, new Set(['great-war', 'creation-of-mundus']))).toBeNull();
  });
  test('← with nothing chosen does nothing', () => {
    expect(stepTarget(ids, null, -1, new Set())).toBeNull();
  });
});
