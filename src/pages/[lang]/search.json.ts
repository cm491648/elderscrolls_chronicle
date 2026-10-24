import type { APIRoute, GetStaticPaths } from 'astro';
import { LANGS, type Lang } from '../../lib/types';
import { loadChronicle } from '../../lib/data';
import { buildSearchIndex } from '../../lib/search-index';

export const getStaticPaths: GetStaticPaths = () => LANGS.map((lang) => ({ params: { lang } }));

/** The search index, fetched the first time a reader opens the search panel (src/lib/search.ts). */
export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang as Lang;
  const other: Lang = lang === 'en' ? 'zh-tw' : 'en';
  const [data, otherData] = await Promise.all([loadChronicle(lang), loadChronicle(other)]);
  const otherTitles = Object.fromEntries(otherData.summaries.map((s) => [s.id, s.title]));
  const index = buildSearchIndex({ lang, otherTitles, ...data });
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
};
