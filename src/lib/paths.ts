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

export function parseEventId(pathname: string): string | null {
  const match = pathname.match(/\/events\/([^/]+)\/?(?:index\.html)?$/);
  return match ? decodeURIComponent(match[1]) : null;
}
