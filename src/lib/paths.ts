import type { Lang } from './types';

// Static hosts without directory indexes (the claude.ai artifact export) build with PUBLIC_PAGE_FILE=1,
// so page URLs name their index.html instead of ending in a slash.
const PAGE_FILE = import.meta.env.PUBLIC_PAGE_FILE === '1' ? 'index.html' : '';

export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path}`;
}

export function homeUrl(lang: Lang, pageFile: string = PAGE_FILE): string {
  return withBase(`/${lang}/${pageFile}`);
}

export function eventUrl(lang: Lang, id: string, pageFile: string = PAGE_FILE): string {
  return withBase(`/${lang}/events/${id}/${pageFile}`);
}

/** The sections' URL segments. The page folders under src/pages/[lang]/ must use the same names (tests/unit/paths.test.ts). */
export const SEGMENTS = { topics: 'topics', biographies: 'biographies', glossary: 'glossary', about: 'about' } as const;

export function topicIndexUrl(lang: Lang, pageFile: string = PAGE_FILE): string {
  return withBase(`/${lang}/${SEGMENTS.topics}/${pageFile}`);
}

export function topicUrl(lang: Lang, id: string, pageFile: string = PAGE_FILE): string {
  return withBase(`/${lang}/${SEGMENTS.topics}/${id}/${pageFile}`);
}

export function biographyIndexUrl(lang: Lang, pageFile: string = PAGE_FILE): string {
  return withBase(`/${lang}/${SEGMENTS.biographies}/${pageFile}`);
}

export function biographyUrl(lang: Lang, id: string, pageFile: string = PAGE_FILE): string {
  return withBase(`/${lang}/${SEGMENTS.biographies}/${id}/${pageFile}`);
}

/** The glossary page, or one term on it (its anchor). */
export function glossaryUrl(lang: Lang, termId?: string, pageFile: string = PAGE_FILE): string {
  return withBase(`/${lang}/${SEGMENTS.glossary}/${pageFile}`) + (termId ? `#${termId}` : '');
}

export function aboutUrl(lang: Lang, pageFile: string = PAGE_FILE): string {
  return withBase(`/${lang}/${SEGMENTS.about}/${pageFile}`);
}

/** The same page in another language: every page exists in both, under /<lang>/. */
export function otherLangUrl(pathname: string, lang: Lang): string {
  return pathname.replace(/\/(zh-tw|en)\//, `/${lang}/`);
}

export function parseEventId(pathname: string): string | null {
  const match = pathname.match(/\/events\/([^/]+)\/?(?:index\.html)?$/);
  return match ? decodeURIComponent(match[1]) : null;
}
