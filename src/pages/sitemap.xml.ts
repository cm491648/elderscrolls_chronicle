import type { APIRoute } from 'astro';
import { loadChronicle } from '../lib/data';
import { LANGS } from '../lib/types';

/**
 * Every page in both languages, each with its other-language alternate (decisions/launch-2: search engines may list
 * the site). Absolute addresses need the site's own, which only the deploy build sets (CHRONICLE_SITE); other builds
 * publish an empty list. A project site on GitHub Pages cannot serve /robots.txt at the host's root, so the sitemap is
 * submitted to the search engines instead (docs/deploy.md).
 */
export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const ids = (await loadChronicle('en')).summaries.map((e) => e.id);
  const paths = ['/', ...ids.map((id) => `/events/${id}/`)];
  const url = (lang: string, p: string) => new URL(`${base}/${lang}${p}`, site).href;
  const entries = site
    ? paths.flatMap((p) =>
        LANGS.map(
          (lang) =>
            `  <url><loc>${url(lang, p)}</loc>` +
            LANGS.map((alt) => `<xhtml:link rel="alternate" hreflang="${alt === 'zh-tw' ? 'zh-Hant-TW' : 'en'}" href="${url(alt, p)}"/>`).join('') +
            '</url>',
        ),
      )
    : [];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
