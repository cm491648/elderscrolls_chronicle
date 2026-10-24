import { withBase } from './paths';
import type { Lang } from './types';
import { REQUEST_TIMEOUT_MS } from './story-cache';

/** One event in the search index (/<lang>/search.json), listed in timeline order. */
export interface SearchEntry {
  id: string;
  /** Titles in both languages, the page language first. */
  titles: string[];
  /** Names of the people and terms the event marks, in both languages. */
  names: string[];
  /** The story without markup, in the page language only. */
  text: string;
}

export type SearchField = 'title' | 'name' | 'text';

export interface Snippet {
  before: string;
  match: string;
  after: string;
}

export interface SearchHit {
  id: string;
  /** Where the event matched best: its title, a person or term it names, or its story. */
  field: SearchField;
  /** The person or term that matched (field 'name'); null otherwise. */
  name: string | null;
  /** The story around the match (field 'text'); null otherwise. */
  snippet: Snippet | null;
}

/** Characters on each side of a story match. */
const SNIPPET_SIDE = 20;

/**
 * For comparing names: NFKC (full-width letters), lowercase, Latin accents dropped, and spaces and the name dots
 * (· ‧ ・ •) removed, so 「莫拉格·巴爾」 matches 「莫拉格巴爾」 and `Molag  Bal` matches `molagbal`.
 */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·‧・•]/g, '');
}

/**
 * About SNIPPET_SIDE characters of `text` on each side of the first case-insensitive occurrence of `query`, with …
 * where cut; null when `query` is not in `text`. The story is matched without other folding, so the match can be
 * shown exactly where it is.
 */
export function snippetAround(text: string, query: string): Snippet | null {
  const q = query.trim();
  if (!q) return null;
  // Matched on the text itself (not a lowercased copy, whose length can differ), so the cut lines up with the match.
  const found = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').exec(text);
  if (!found) return null;
  const at = found.index;
  const to = at + found[0].length;
  const start = offPair(text, Math.max(0, at - SNIPPET_SIDE), -1);
  const end = offPair(text, Math.min(text.length, to + SNIPPET_SIDE), 1);
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, at),
    match: found[0],
    after: text.slice(to, end) + (end < text.length ? '…' : ''),
  };
}

/** Moves a cut that would fall inside a surrogate pair (an emoji, a rare CJK character) off it, in direction `dir`. */
function offPair(text: string, i: number, dir: 1 | -1): number {
  const low = text.charCodeAt(i);
  return i > 0 && i < text.length && low >= 0xdc00 && low <= 0xdfff ? i + (dir > 0 ? 1 : -1) : i;
}

/** Events matching `query`, best field first (title, then name, then story); each level keeps the index's order. */
export function searchEvents(index: SearchEntry[], query: string): SearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  const byField: Record<SearchField, SearchHit[]> = { title: [], name: [], text: [] };
  for (const e of index) {
    if (e.titles.some((t) => normalize(t).includes(q))) {
      byField.title.push({ id: e.id, field: 'title', name: null, snippet: null });
      continue;
    }
    const name = e.names.find((n) => normalize(n).includes(q));
    if (name) {
      byField.name.push({ id: e.id, field: 'name', name, snippet: null });
      continue;
    }
    const snippet = snippetAround(e.text, query);
    if (snippet) byField.text.push({ id: e.id, field: 'text', name: null, snippet });
  }
  return [...byField.title, ...byField.name, ...byField.text];
}

export function searchIndexUrl(lang: Lang): string {
  return withBase(`/${lang}/search.json`);
}

/** One request per language, shared by concurrent callers; a failed one is dropped so the next call retries. */
const indexes = new Map<Lang, Promise<SearchEntry[]>>();

export function loadSearchIndex(lang: Lang, fetcher: typeof fetch = (...args) => fetch(...args)): Promise<SearchEntry[]> {
  const cached = indexes.get(lang);
  if (cached) return cached;
  const request = fetcher(searchIndexUrl(lang), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).then((res) => {
    if (!res.ok) throw new Error(`search index: HTTP ${res.status}`);
    return res.json() as Promise<SearchEntry[]>;
  });
  indexes.set(lang, request);
  request.catch(() => {
    if (indexes.get(lang) === request) indexes.delete(lang);
  });
  return request;
}
