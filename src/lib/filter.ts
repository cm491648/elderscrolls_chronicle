import { CATEGORIES, type Category, type EventMeta } from './types';

/**
 * Filtering (docs/design/search-filter.md §2). Phase 3 settled the items: the seven event categories
 * (decisions/p3-retag). Any ticked category matches (OR). Filtering by game was tried and dropped
 * (decisions/p3-filter-review: many events cannot be told apart by game, and it is not what the site is for).
 * Events a filter leaves out are dimmed, never hidden.
 */
export interface FilterState {
  categories: Category[];
}

export const EMPTY_FILTER: FilterState = { categories: [] };

/** The filter items the panel offers: every category, in their canonical order. */
export const FILTER_CATEGORIES: readonly Category[] = CATEGORIES;

export function isFilterActive(f: FilterState): boolean {
  return f.categories.length > 0;
}

/** How many items are ticked (the count on the search button). */
export const filterCount = (f: FilterState): number => f.categories.length;

/** Any ticked category matches (OR); nothing ticked matches everything. */
export function matchesFilter(e: Pick<EventMeta, 'categories'>, f: FilterState): boolean {
  return f.categories.length === 0 || e.categories.some((c) => f.categories.includes(c));
}

/** The ids a filter leaves out: shown dimmed on the timeline and the map. */
export function dimmedIds(events: Pick<EventMeta, 'id' | 'categories'>[], f: FilterState): Set<string> {
  return new Set(isFilterActive(f) ? events.filter((e) => !matchesFilter(e, f)).map((e) => e.id) : []);
}

/**
 * The event to step to from `currentId` (previous/next, arrow keys): the nearest one in timeline order that is not
 * dimmed. With nothing chosen, next starts at the first such event and previous does nothing.
 */
export function stepTarget(ids: string[], currentId: string | null, dir: 1 | -1, dimmed: ReadonlySet<string>): string | null {
  const from = currentId === null ? -1 : ids.indexOf(currentId);
  if (from < 0 && dir < 0) return null;
  for (let i = from + dir; i >= 0 && i < ids.length; i += dir) if (!dimmed.has(ids[i])) return ids[i];
  return null;
}

/** The filter kept on this device (decisions/p3-design: not in the URL); unknown items and bad data are dropped. */
export const FILTER_KEY = 'chronicle.filter';
export function parseFilter(raw: string | null): FilterState {
  try {
    const v = JSON.parse(raw ?? '') as Partial<FilterState>;
    return { categories: Array.isArray(v.categories) ? CATEGORIES.filter((c) => v.categories!.includes(c)) : [] };
  } catch {
    return EMPTY_FILTER;
  }
}
export function readFilter(): FilterState {
  try {
    return parseFilter(localStorage.getItem(FILTER_KEY));
  } catch {
    return EMPTY_FILTER;
  }
}
export function saveFilter(f: FilterState): void {
  try {
    if (isFilterActive(f)) localStorage.setItem(FILTER_KEY, JSON.stringify(f));
    else localStorage.removeItem(FILTER_KEY);
  } catch {
    // Storage blocked: the filter lasts for this page only.
  }
}
