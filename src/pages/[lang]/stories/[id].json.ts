import type { APIRoute, GetStaticPaths } from 'astro';
import { LANGS, type Lang } from '../../../lib/types';
import { loadChronicle } from '../../../lib/data';
import { storiesBilingual } from '../../../lib/story-cache';

// The artifact export builds both languages into one file per event instead (src/pages/stories/[id].json.ts).
export const getStaticPaths: GetStaticPaths = async () => {
  if (storiesBilingual()) return [];
  const paths = [];
  for (const lang of LANGS) {
    const { stories } = await loadChronicle(lang);
    for (const id of Object.keys(stories)) paths.push({ params: { lang, id } });
  }
  return paths;
};

export const GET: APIRoute = async ({ params }) => {
  const { stories } = await loadChronicle(params.lang as Lang);
  return new Response(JSON.stringify(stories[params.id!]), { headers: { 'Content-Type': 'application/json' } });
};
