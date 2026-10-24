import { getCollection } from 'astro:content';
import { marked } from 'marked';
import { validateContent } from './validate';
import { createTimescale } from './timescale';
import { originalTitle } from './format';
import { illustrationFor, type IllustrationEntry } from './illustrations';
import illustrationData from '../content/illustrations.json';
import { plainText, renderTerms, splitNotes, termIds } from './terms';
import type { EventMeta, EventStory, EventSummary, Lang, Location, Person, PersonName, TermInfo } from './types';

export interface ChronicleData {
  /** Every event's metadata and title, in content order: embedded in every page. */
  summaries: EventSummary[];
  /** Each event's story by id: a page embeds only its own, the rest are built to /<lang>/stories/<id>.json. */
  stories: Record<string, EventStory>;
  locations: Location[];
  people: Person[];
  /** The names of the people some event lists: embedded in every page for the story's people section. */
  personNames: PersonName[];
  /** Marker-free story text per event id, for meta descriptions (not sent to the client). */
  plainStories: Record<string, string>;
}

const cache = new Map<Lang, Promise<ChronicleData>>();

export function loadChronicle(lang: Lang): Promise<ChronicleData> {
  if (!cache.has(lang)) cache.set(lang, build(lang));
  return cache.get(lang)!;
}

async function build(lang: Lang): Promise<ChronicleData> {
  const [en, zhTw, locs, ppl, gloss] = await Promise.all([
    getCollection('events'),
    getCollection('eventsZhTw'),
    getCollection('locations'),
    getCollection('people'),
    getCollection('glossary'),
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

  // Glossary names win over people names; a glossary summary wins over a person's summary.
  const termMap = new Map<string, TermInfo>();
  for (const p of people) termMap.set(p.id, { id: p.id, name: p.name, summary: p.summary });
  for (const { id, data } of gloss) {
    termMap.set(id, {
      id,
      name: { en: data.en, 'zh-tw': data['zh-tw'] },
      summary: data.summary ?? termMap.get(id)?.summary,
    });
  }

  const texts = new Map((lang === 'en' ? en : zhTw).map((e) => [e.id, e]));
  // English is the source language: translated pages carry its title as a subtitle, read from the English file.
  const enTitles = new Map(en.map((e) => [e.id, e.data.title]));
  const plates = new Map((illustrationData as IllustrationEntry[]).map((p) => [p.id, p]));
  const rendered = new Map<string, EventSummary>();
  const stories: Record<string, EventStory> = {};
  const plainStories: Record<string, string> = {};
  for (const id of createTimescale(metas).ordered) {
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
      return summary ? { id: termId, name, summary: summary[lang] } : { id: termId, name };
    });
    stories[id] = { id, illustration: plate ? illustrationFor(plate, lang) : null, html, notesHtml, terms, sources };
  }
  const summaries = metas.map((m) => rendered.get(m.id)!);
  const listed = new Set(metas.flatMap((m) => m.people));
  const personNames = people.filter((p) => listed.has(p.id)).map(({ id, name }) => ({ id, name: name[lang] }));

  return { summaries, stories, locations, people, personNames, plainStories };
}
