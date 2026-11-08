// Pure helpers for the section pages (topics, biographies, glossary): what links to what, and in which order.
// src/lib/sections-data.ts feeds them the content; every function here is unit-tested on small inputs.
import { termIds } from './terms';
import type { GlossaryCategory, Lang } from './types';

/** Term id → the events whose text marks it (`{{id}}`), each event once, in the order `bodies` lists them. */
export function termEventIndex(bodies: Record<string, string>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [eventId, body] of Object.entries(bodies)) {
    for (const term of new Set(termIds(body))) {
      const list = index.get(term);
      if (list) list.push(eventId);
      else index.set(term, [eventId]);
    }
  }
  return index;
}

/** Ids in timeline order (`order`: id → position); ids the timeline does not know go last, in their given order. */
export function sortByTimeline(ids: string[], order: Map<string, number>): string[] {
  const at = (id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER;
  return [...ids].sort((a, b) => at(a) - at(b));
}

/** The events a person appears in: listed among its people (main) or only marked in its text. Input order. */
export function personEvents(
  personId: string,
  events: { id: string; people: string[] }[],
  termIndex: Map<string, string[]>,
): { id: string; main: boolean }[] {
  const mentioned = new Set(termIndex.get(personId) ?? []);
  return events
    .filter((e) => e.people.includes(personId) || mentioned.has(e.id))
    .map((e) => ({ id: e.id, main: e.people.includes(personId) }));
}

/** The topics that hold an event. */
export function eventTopics<T extends { events: string[] }>(topics: T[], eventId: string): T[] {
  return topics.filter((t) => t.events.includes(eventId));
}

/** The topics about a person: those naming them, and those holding an event they are a main figure of. */
export function personTopics<T extends { people: string[]; events: string[] }>(
  topics: T[],
  personId: string,
  mainEvents: Set<string>,
): T[] {
  return topics.filter((t) => t.people.includes(personId) || t.events.some((e) => mainEvents.has(e)));
}

/**
 * The topics glossary entries list: the published topics whose text marks the term (`marks`: topic id → the term ids
 * its text marks), and for a person (`mainEvents` not null) also the published topics about them. Planned topics never.
 */
export function glossaryTopics<T extends { id: string; status: 'planned' | 'published'; people: string[]; events: string[] }>(
  topics: T[],
  termId: string,
  marks: Map<string, Set<string>>,
  mainEvents: Set<string> | null,
): T[] {
  const published = topics.filter((t) => t.status === 'published');
  const about = new Set(mainEvents ? personTopics(published, termId, mainEvents).map((t) => t.id) : []);
  return published.filter((t) => marks.get(t.id)?.has(termId) || about.has(t.id));
}

/**
 * Topics ordered by where their last event falls on the timeline (`order`: event id → position), so a story sits
 * where it ends; topics with no event the timeline knows go last. Ties keep their given order. A sorted copy.
 */
export function byLastEvent<T extends { events: string[] }>(topics: T[], order: Map<string, number>): T[] {
  const lastAt = (t: T) =>
    t.events.reduce((max, e) => (order.has(e) ? Math.max(max, order.get(e)!) : max), -1);
  const at = (t: T) => (lastAt(t) < 0 ? Number.MAX_SAFE_INTEGER : lastAt(t));
  return [...topics].sort((a, b) => at(a) - at(b));
}

/**
 * The bindings of the topics' covers and the people's portraits: deep leather tones — the site's brown, lapis,
 * oxblood, forest, aubergine, umber and slate — dark enough for --on-leather-soft text on them.
 */
export const BINDINGS = ['#4a2a22', '#1f3557', '#5c1d1b', '#213d2e', '#3b2742', '#5a3e1c', '#2b2f3a'] as const;

/**
 * The binding of a topic's book or a person's portrait, from its id (FNV-1a into the palette) and not its place in
 * the list, so adding or reordering entries never recolours the others. Neighbours may share a colour.
 */
export function bindingOf(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return BINDINGS[h % BINDINGS.length];
}

/**
 * People ordered by where they first appear on the timeline as a main figure (`order`: event id → position); someone
 * only ever mentioned, by their first mention; people with no event the timeline knows go last. Ties keep their given
 * order. A sorted copy.
 */
export function byFirstMainEvent<T extends { events: { event: { id: string }; main: boolean }[] }>(
  people: T[],
  order: Map<string, number>,
): T[] {
  const first = (evs: { event: { id: string } }[]) =>
    evs.reduce((min, e) => Math.min(min, order.get(e.event.id) ?? Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  const at = (p: T) => {
    const main = p.events.filter((e) => e.main && order.has(e.event.id));
    return main.length ? first(main) : first(p.events);
  };
  return [...people].sort((a, b) => at(a) - at(b));
}

/** Chinese names sort by stroke count (the order Taiwanese indexes use), English ones alphabetically. */
export function nameCollator(lang: Lang): Intl.Collator {
  return new Intl.Collator(lang === 'en' ? 'en' : 'zh-Hant-TW-u-co-stroke');
}

/** A sorted copy, by the name in `lang`. */
export function sortByName<T extends { name: Record<Lang, string> }>(items: T[], lang: Lang): T[] {
  const c = nameCollator(lang);
  return [...items].sort((a, b) => c.compare(a.name[lang], b.name[lang]));
}

/** A glossary entry before its links are worked out. */
export interface GlossaryEntry {
  id: string;
  name: Record<Lang, string>;
  category: GlossaryCategory;
  summary?: Record<Lang, string>;
}

/**
 * The glossary's entries: its own terms as they are, then the people it has no entry for (people.json stays their
 * only source), filed under `person` unless they give a category of their own.
 */
export function glossaryEntries(
  glossary: GlossaryEntry[],
  people: { id: string; name: Record<Lang, string>; summary: Record<Lang, string>; category?: GlossaryCategory }[],
): GlossaryEntry[] {
  const listed = new Set(glossary.map((g) => g.id));
  return [
    ...glossary,
    ...people
      .filter((p) => !listed.has(p.id))
      .map(({ id, name, summary, category }) => ({ id, name, category: category ?? 'person', summary })),
  ];
}
