// The section pages' data (topics, biographies, glossary) for one language, built once per build from the content
// collections and the chronicle data. Server only: pages embed what they show, never this whole object.
import { getCollection } from 'astro:content';
import { loadChronicle, renderArticle, type ArticleBody } from './data';
import { createTimescale } from './timescale';
import { eraSpan, formatSpan, originalTitle } from './format';
import { termIds } from './terms';
import {
  bindingOf, byFirstMainEvent, byLastEvent, glossaryEntries, glossaryTopics, personEvents, personTopics, sortByTimeline,
  termEventIndex,
} from './sections';
import type { EntryStatus, EventSummary, GlossaryCategory, Lang, PersonName } from './types';

export interface TopicView {
  id: string;
  title: string;
  /** The English title under a translated one; null on English pages. */
  titleEn: string | null;
  summary: string;
  status: EntryStatus;
  /** In timeline order. */
  events: EventSummary[];
  /** `1E 780 – 4E 180`; null for a topic with no events yet. */
  span: string | null;
  /** `第一至第四紀元` (format.ts eraSpan), for the topic's cover; null for a topic with no events yet. */
  eras: string | null;
  /** The cover's colour on the topics index (sections.ts bindingOf). */
  binding: string;
  people: PersonName[];
  /** Null while planned. */
  body: ArticleBody | null;
}

export interface SectionTopicLink {
  id: string;
  title: string;
  status: EntryStatus;
}

export interface PersonView {
  id: string;
  name: Record<Lang, string>;
  summary: string;
  /** In timeline order; `main` when the event lists them among its people. */
  events: { event: EventSummary; main: boolean }[];
  /** Their portrait's leather on the biographies index (sections.ts bindingOf, as the topics' books). */
  binding: string;
  topics: SectionTopicLink[];
  /** `body` is null while it is planned. */
  biography: { status: EntryStatus; body: ArticleBody | null };
}

export interface GlossaryView {
  id: string;
  name: Record<Lang, string>;
  category: GlossaryCategory;
  summary: string | null;
  /** The events whose text marks the term (for a person, also those listing them), in timeline order. */
  events: EventSummary[];
  /** Published topics whose text marks the term (for a person, also the topics about them). */
  topics: SectionTopicLink[];
  /** A person with a biography: link to it. */
  biography: boolean;
}

export interface SectionsData {
  /** Ordered by their last event (sections.ts byLastEvent); topics with no events last. */
  topics: TopicView[];
  /** The people with a biography (everyone else is in the glossary), by their first main event (sections.ts byFirstMainEvent). */
  people: PersonView[];
  /** glossary.json's terms and every person people.json has that it lacks. */
  glossary: GlossaryView[];
}

const cache = new Map<Lang, Promise<SectionsData>>();

export function loadSections(lang: Lang): Promise<SectionsData> {
  if (!cache.has(lang)) cache.set(lang, build(lang));
  return cache.get(lang)!;
}

async function build(lang: Lang): Promise<SectionsData> {
  const chronicle = await loadChronicle(lang);
  const [evEn, evZh, topicsEn, topicsZh, biosEn, biosZh, gloss] = await Promise.all([
    getCollection('events'),
    getCollection('eventsZhTw'),
    getCollection('topics'),
    getCollection('topicsZhTw'),
    getCollection('biographies'),
    getCollection('biographiesZhTw'),
    getCollection('glossary'),
  ]);
  const events = chronicle.summaries;
  const byId = new Map(events.map((e) => [e.id, e]));
  const order = new Map(createTimescale(events).ordered.map((id, i) => [id, i]));
  const inOrder = (ids: string[]) => sortByTimeline(ids, order).map((id) => byId.get(id)!);
  const termIndex = termEventIndex(Object.fromEntries((lang === 'en' ? evEn : evZh).map((e) => [e.id, e.body ?? ''])));
  const hasBiography = new Set(biosEn.map((b) => b.id));
  // Every person, not only chronicle.personNames: a topic may name someone no event lists.
  const personName = new Map<string, PersonName>(
    chronicle.people.map(({ id, name }) => [id, { id, name: name[lang], ...(hasBiography.has(id) ? { biography: true as const } : {}) }]),
  );

  const topicText = new Map((lang === 'en' ? topicsEn : topicsZh).map((t) => [t.id, t]));
  const enTitles = new Map(topicsEn.map((t) => [t.id, t.data.title]));
  // Each topic sits where its story ends.
  const ordered = byLastEvent(topicsEn.map(({ id, data }) => ({ id, data, events: data.events })), order);
  const topics: TopicView[] = ordered.map(({ id, data }) => {
    const text = topicText.get(id)!;
    const evs = inOrder(data.events);
    const peopleIds = data.people ?? [...new Set(evs.flatMap((e) => e.people))];
    return {
      id,
      title: text.data.title,
      titleEn: originalTitle(lang, text.data.title, enTitles.get(id)),
      summary: text.data.summary,
      status: data.status,
      events: evs,
      span: evs.length ? formatSpan(evs[0], evs[evs.length - 1], lang) : null,
      eras: evs.length ? eraSpan(evs[0].era, evs[evs.length - 1].era, lang) : null,
      binding: bindingOf(id),
      people: peopleIds.map((pid) => personName.get(pid)!),
      body: data.status === 'published' ? renderArticle(text.body ?? '', lang, chronicle.terms, data.sources ?? []) : null,
    };
  });
  const topicRefs = topics.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    events: t.events.map((e) => e.id),
    people: t.people.map((p) => p.id),
  }));
  const link = ({ id, title, status }: SectionTopicLink) => ({ id, title, status });

  const bioText = new Map((lang === 'en' ? biosEn : biosZh).map((b) => [b.id, b]));
  const bios = new Map(
    biosEn.map(({ id, data }) => [
      id,
      {
        status: data.status,
        body: data.status === 'published' ? renderArticle(bioText.get(id)?.body ?? '', lang, chronicle.terms, data.sources ?? []) : null,
      },
    ]),
  );
  /** A person's events (main or only mentioned), in timeline order. */
  const lifeOf = (id: string) => {
    const found = personEvents(id, events, termIndex);
    const main = new Set(found.filter((f) => f.main).map((f) => f.id));
    const sorted = inOrder(found.map((f) => f.id)).map((event) => ({ event, main: main.has(event.id) }));
    return { main, sorted };
  };
  // Each person sits where they first take the stage.
  const people: PersonView[] = byFirstMainEvent(
    chronicle.people
      .filter((p) => bios.has(p.id))
      .map((p) => {
        const { main, sorted } = lifeOf(p.id);
        return {
          id: p.id,
          name: p.name,
          summary: p.summary[lang],
          events: sorted,
          binding: bindingOf(p.id),
          topics: personTopics(topicRefs, p.id, main).map(link),
          biography: bios.get(p.id)!,
        };
      }),
    order,
  );

  const peopleIds = new Set(chronicle.people.map((p) => p.id));
  const topicTerms = new Map(topicsEn.map((t) => [t.id, new Set(termIds(topicText.get(t.id)?.body ?? ''))]));
  const entries = glossaryEntries(
    gloss.map(({ id, data: { name, category, summary } }) => ({ id, name, category, summary })),
    chronicle.people,
  );
  const glossary: GlossaryView[] = entries.map((g) => {
    // A person's entry keeps what a page of their own would list: every event naming them, and the (published)
    // topics about them.
    const life = peopleIds.has(g.id) ? lifeOf(g.id) : null;
    return {
      id: g.id,
      name: g.name,
      category: g.category,
      summary: g.summary?.[lang] ?? null,
      events: life ? life.sorted.map((e) => e.event) : inOrder(termIndex.get(g.id) ?? []),
      topics: glossaryTopics(topicRefs, g.id, topicTerms, life?.main ?? null).map(link),
      biography: bios.has(g.id),
    };
  });

  return { topics, people, glossary };
}
