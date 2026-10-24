import type { APIRoute, GetStaticPaths } from 'astro';
import { LANGS } from '../../lib/types';
import { loadChronicle } from '../../lib/data';
import { storiesBilingual } from '../../lib/story-cache';

// Only the claude.ai artifact export (PUBLIC_STORIES_BILINGUAL=1) builds these: one file per event with both
// languages, half the files of /<lang>/stories/<id>.json. The site itself builds none.
export const getStaticPaths: GetStaticPaths = async () => {
  if (!storiesBilingual()) return [];
  const { stories } = await loadChronicle(LANGS[0]);
  return Object.keys(stories).map((id) => ({ params: { id } }));
};

export const GET: APIRoute = async ({ params }) => {
  const both: Record<string, unknown> = {};
  for (const lang of LANGS) both[lang] = (await loadChronicle(lang)).stories[params.id!];
  return new Response(JSON.stringify(both), { headers: { 'Content-Type': 'application/json' } });
};
