import { getCollection } from 'astro:content';
import { marked } from 'marked';
import { validateContent, validateSections } from './validate';
import { createTimescale } from './timescale';
import { originalTitle } from './format';
import { illustrationFor, type IllustrationEntry } from './illustrations';
import illustrationData from '../content/illustrations.json';
import { plainText, renderTerms, splitNotes, termIds } from './terms';
import { byLastEvent, eventTopics } from './sections';
import type { EventMeta, EventStory, EventSummary, Lang, Location, Person, PersonName, Source, TermInfo, TopicLink } from './types';

export interface ChronicleData {
  /** Every event's metadata and title, in content order: embedded in every page. */
  summaries: EventSummary[];
  /** Each event's story by id: a page embeds only its own, the rest are built to /<lang>/stories/<id>.json. */
  stories: Record<string, EventStory>;
  locations: Location[];
  people: Person[];
  /** The names of the people some event lists, and who has a biography: embedded in every page for the story's people section. */
  personNames: PersonName[];
  /** Marker-free story text per event id, for meta descriptions (not sent to the client). */
  plainStories: Record<string, string>;
  /** Every term by id (glossary entries over people), for rendering other texts with the same names. Server only. */
  terms: Map<string, TermInfo>;
}

/** Glossary names win over people names; a glossary summary wins over a person's summary. */
export function buildTermMap(
  people: Person[],
  glossary: { id: string; name: Record<Lang, string>; summary?: Record<Lang, string> }[],
): Map<string, TermInfo> {
  const map = new Map<string, TermInfo>();
  for (const p of people) map.set(p.id, { id: p.id, name: p.name, summary: p.summary });
  for (const g of glossary) map.set(g.id, { id: g.id, name: g.name, summary: g.summary ?? map.get(g.id)?.summary });
  return map;
}

export interface ArticleBody {
  html: string;
  notesHtml: string | null;
  sources: Source[];
}

/** A published topic's or biography's text, laid out like a story but without tooltips (section pages). */
export function renderArticle(md: string, lang: Lang, terms: Map<string, TermInfo>, sources: Source[]): ArticleBody {
  const { story, notes } = splitNotes(md);
  const html = marked.parse(renderTerms(story, lang, terms, false), { async: false }) as string;
  const notesHtml = notes === null ? null : (marked.parse(renderTerms(notes, lang, terms, false), { async: false }) as string);
  return { html, notesHtml, sources };
}

const cache = new Map<Lang, Promise<ChronicleData>>();

export function loadChronicle(lang: Lang): Promise<ChronicleData> {
  if (!cache.has(lang)) cache.set(lang, build(lang));
  return cache.get(lang)!;
}

async function build(lang: Lang): Promise<ChronicleData> {
  const [en, zhTw, locs, ppl, gloss, topicsEn, topicsZh, biosEn, biosZh] = await Promise.all([
    getCollection('events'),
    getCollection('eventsZhTw'),
    getCollection('locations'),
    getCollection('people'),
    getCollection('glossary'),
    getCollection('topics'),
    getCollection('topicsZhTw'),
    getCollection('biographies'),
    getCollection('biographiesZhTw'),
  ]);

  const metas: EventMeta[] = en.map(({ id, data }) => ({
    id,
    era: data.era,
    year: data.year,
    ...(data.circa ? { circa: true } : {}),
    yearEnd: data.yearEnd,
    order: data.order,
    mapLayer: data.mapLayer,
    locations: data.locations,
    ...(data.regions ? { regions: data.regions } : {}),
    ...(data.timelineRegions ? { timelineRegions: data.timelineRegions } : {}),
    categories: data.categories,
    people: data.people,
    related: data.related,
    games: data.games,
    sources: data.sources,
    certainty: data.certainty,
    review: data.review,
  }));
  const locations: Location[] = locs.map(({ id, data }) => ({ id, ...data }));
  const people: Person[] = ppl.map(({ id, data }) => ({ id, ...data }));

  const errors = validateContent({
    events: metas,
    translations: { en: en.map((e) => e.id), 'zh-tw': zhTw.map((e) => e.id) },
    locations,
    people,
    strict: process.env.CHRONICLE_STRICT === '1',
  });
  if (errors.length > 0) throw new Error(`Content validation failed:\n${errors.join('\n')}`);

  const hasText = (body: string | undefined) => (body ?? '').trim() !== '';
  const bodyOf = (list: { id: string; body?: string }[]) => new Map(list.map((e) => [e.id, hasText(e.body)]));
  const topicZhBody = bodyOf(topicsZh);
  const bioZhBody = bodyOf(biosZh);
  const sectionErrors = validateSections({
    topics: topicsEn.map(({ id, data, body }) => ({
      id, ...data, hasBody: { en: hasText(body), 'zh-tw': topicZhBody.get(id) ?? false },
    })),
    biographies: biosEn.map(({ id, data, body }) => ({
      id, ...data, hasBody: { en: hasText(body), 'zh-tw': bioZhBody.get(id) ?? false },
    })),
    translations: {
      topics: { en: topicsEn.map((e) => e.id), 'zh-tw': topicsZh.map((e) => e.id) },
      biographies: { en: biosEn.map((e) => e.id), 'zh-tw': biosZh.map((e) => e.id) },
    },
    eventIds: metas.map((m) => m.id),
    personIds: people.map((p) => p.id),
    strict: process.env.CHRONICLE_STRICT === '1',
  });
  if (sectionErrors.length > 0) throw new Error(`Section validation failed:\n${sectionErrors.join('\n')}`);

  // Glossary names win over people names; a glossary summary wins over a person's summary.
  const termMap = buildTermMap(people, gloss.map(({ id, data }) => ({ id, ...data })));
  // The glossary lists its own terms and every person (sections.ts glossaryEntries); only some people have a biography.
  const glossaryIds = new Set([...gloss.map((g) => g.id), ...people.map((p) => p.id)]);
  const biographyIds = new Set(biosEn.map((b) => b.id));
  const topicTitles = new Map((lang === 'en' ? topicsEn : topicsZh).map((t) => [t.id, t.data.title]));
  const timeline = createTimescale(metas).ordered;
  const timelineAt = new Map(timeline.map((id, i) => [id, i]));
  // Ordered by each topic's last event on the timeline, as the topics index is; topics with no events last.
  const topicList = byLastEvent(topicsEn.map(({ id, data }) => ({ id, events: data.events })), timelineAt);

  const texts = new Map((lang === 'en' ? en : zhTw).map((e) => [e.id, e]));
  // English is the source language: translated pages carry its title as a subtitle, read from the English file.
  const enTitles = new Map(en.map((e) => [e.id, e.data.title]));
  const plates = new Map((illustrationData as IllustrationEntry[]).map((p) => [p.id, p]));
  const rendered = new Map<string, EventSummary>();
  const stories: Record<string, EventStory> = {};
  const plainStories: Record<string, string> = {};
  for (const id of timeline) {
    const meta = metas.find((m) => m.id === id)!;
    const text = texts.get(id)!;
    const { story, notes } = splitNotes(text.body ?? '');
    const html = marked.parse(renderTerms(story, lang, termMap), { async: false }) as string;
    const notesHtml =
      notes === null ? null : (marked.parse(renderTerms(notes, lang, termMap), { async: false }) as string);
    plainStories[id] = plainText(story, lang, termMap);
    const title = text.data.title;
    const plate = plates.get(id);
    const { sources, ...summary } = meta;
    rendered.set(id, { ...summary, title, titleEn: originalTitle(lang, title, enTitles.get(id)) });
    // The tooltips' terms travel with the story, so no page carries the whole glossary.
    const used = termIds(story).concat(notes === null ? [] : termIds(notes));
    const terms = [...new Set(used)].map((t) => {
      const { id: termId, name, summary } = termMap.get(t)!;
      return {
        id: termId,
        name,
        ...(summary ? { summary: summary[lang] } : {}),
        ...(glossaryIds.has(termId) ? { glossary: true as const } : {}),
        ...(biographyIds.has(termId) ? { biography: true as const } : {}),
      };
    });
    const topics: TopicLink[] = eventTopics(topicList, id).map((t) => ({ id: t.id, title: topicTitles.get(t.id)! }));
    stories[id] = { id, illustration: plate ? illustrationFor(plate, lang) : null, html, notesHtml, terms, topics, sources };
  }
  const summaries = metas.map((m) => rendered.get(m.id)!);
  const listed = new Set(metas.flatMap((m) => m.people));
  const personNames: PersonName[] = people
    .filter((p) => listed.has(p.id))
    .map(({ id, name }) => ({ id, name: name[lang], ...(biographyIds.has(id) ? { biography: true as const } : {}) }));

  return { summaries, stories, locations, people, personNames, plainStories, terms: termMap };
}
