import { withBase } from './paths';
import type { EventStory, Lang } from './types';

/**
 * Stories other than the page's own are built to /<lang>/stories/<id>.json and fetched when chosen. One promise per
 * `${lang}:${id}`: concurrent requests share it, and a failed one is dropped so the next request tries again.
 */
const cache = new Map<string, Promise<EventStory>>();
const key = (lang: Lang, id: string) => `${lang}:${id}`;

/** A request that hangs this long counts as failed, so the reader gets the retry instead of an endless "loading". */
export const REQUEST_TIMEOUT_MS = 15000;

/**
 * The claude.ai artifact export builds with PUBLIC_STORIES_BILINGUAL=1: one /stories/<id>.json per event holding
 * both languages ({ en, "zh-tw" }), to stay under the host's file limit. The site keeps one file per language.
 */
export function storiesBilingual(env: string | undefined = import.meta.env.PUBLIC_STORIES_BILINGUAL): boolean {
  return env === '1';
}
const BILINGUAL = storiesBilingual();

/**
 * Relative to the page's base, so the claude.ai artifact export (which serves the site under a `<base href>`) finds
 * the files too.
 */
export function storyUrl(lang: Lang, id: string, bilingual = BILINGUAL): string {
  return withBase(bilingual ? `/stories/${id}.json` : `/${lang}/stories/${id}.json`);
}

/** Puts the story a page already carries (an event page's own) in the cache, so it is never fetched. */
export function seedStory(lang: Lang, story: EventStory): void {
  cache.set(key(lang, story.id), Promise.resolve(story));
}

export function loadStory(
  lang: Lang,
  id: string,
  fetcher: typeof fetch = (...args) => fetch(...args),
  bilingual = BILINGUAL,
): Promise<EventStory> {
  const k = key(lang, id);
  const cached = cache.get(k);
  if (cached) return cached;
  const request = fetcher(storyUrl(lang, id, bilingual), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).then(async (res) => {
    if (!res.ok) throw new Error(`story ${id}: HTTP ${res.status}`);
    const json = await res.json();
    return (bilingual ? json[lang] : json) as EventStory;
  });
  cache.set(k, request);
  request.catch(() => {
    if (cache.get(k) === request) cache.delete(k);
  });
  return request;
}

/** Loads a story the reader is likely to open next; a failure is ignored (opening it later retries). */
export function prefetchStory(lang: Lang, id: string): void {
  loadStory(lang, id).catch(() => {});
}
