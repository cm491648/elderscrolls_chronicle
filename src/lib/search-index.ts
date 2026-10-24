import { createTimescale } from './timescale';
import type { SearchEntry } from './search';
import type { EventStory, EventSummary, Lang, Person } from './types';

interface IndexInput {
  lang: Lang;
  /** The page language's events, and the same events' titles in the other language. */
  summaries: EventSummary[];
  otherTitles: Record<string, string>;
  stories: Record<string, EventStory>;
  people: Person[];
  plainStories: Record<string, string>;
}

/**
 * The search index for one language (built to /<lang>/search.json), in timeline order: both titles, the names of
 * the people the event lists and of every term its story marks (both languages, no repeats), and the plain story.
 */
export function buildSearchIndex({ lang, summaries, otherTitles, stories, people, plainStories }: IndexInput): SearchEntry[] {
  const other: Lang = lang === 'en' ? 'zh-tw' : 'en';
  const byId = new Map(summaries.map((s) => [s.id, s]));
  const personById = new Map(people.map((p) => [p.id, p]));
  return createTimescale(summaries).ordered.map((id) => {
    const s = byId.get(id)!;
    const names = new Set<string>();
    for (const pid of s.people) {
      const p = personById.get(pid);
      if (p) for (const n of [p.name[lang], p.name[other]]) names.add(n);
    }
    for (const term of stories[id]?.terms ?? []) for (const n of [term.name[lang], term.name[other]]) names.add(n);
    const titles = [s.title];
    if (otherTitles[id] && otherTitles[id] !== s.title) titles.push(otherTitles[id]);
    return { id, titles, names: [...names], text: plainStories[id] ?? '' };
  });
}
