import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { file, glob } from 'astro/loaders';
import { CATEGORIES, CERTAINTIES, ENTRY_STATUSES, ERAS, GAMES, GLOSSARY_CATEGORIES, MAP_LAYERS, REVIEW_STATES, SOURCE_KINDS } from './lib/types';

const bilingual = z.object({ en: z.string(), 'zh-tw': z.string() });

const events = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/events/en' }),
  schema: z.object({
    title: z.string(),
    era: z.enum(ERAS),
    year: z.number().int().nullable(),
    yearEnd: z.number().int().optional(),
    order: z.number().int().default(0),
    // The year is approximate (`c. 1E 792` / `約`): the sources give no exact year, only a rough one.
    circa: z.boolean().default(false),
    mapLayer: z.enum(MAP_LAYERS),
    locations: z.array(z.string()).default([]),
    // Whole areas to outline with the places (region ids such as `skyrim`); see EventMeta.regions.
    regions: z.array(z.string()).optional(),
    // Areas for the timeline's lanes only (the map keeps to the places and regions); see EventMeta.timelineRegions.
    timelineRegions: z.array(z.string()).optional(),
    categories: z.array(z.enum(CATEGORIES)).min(1),
    people: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),
    games: z.array(z.enum(GAMES)).default([]),
    sources: z
      .array(z.object({ title: z.string(), kind: z.enum(SOURCE_KINDS), url: z.url().optional() }))
      .min(1),
    certainty: z.enum(CERTAINTIES),
    review: z.enum(REVIEW_STATES),
  }),
});

const eventsZhTw = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/events/zh-tw' }),
  schema: z.object({ title: z.string() }),
});

const locations = defineCollection({
  loader: file('src/content/locations.json'),
  schema: z.object({
    layer: z.enum(MAP_LAYERS),
    region: z.string(),
    sea: z.boolean().optional(),
    x: z.number(),
    y: z.number(),
    // Where the place sits on the drawn (schematic) map: in the schematic Tamriel frame for places on Tamriel and the
    // provinces, in the schematic Nirn frame for places on Nirn (docs/research/schematic-locations.md).
    drawn: z.object({ x: z.number(), y: z.number() }),
    name: bilingual,
  }),
});

const people = defineCollection({
  loader: file('src/content/people.json'),
  // `category` files a person the glossary lists (one glossary.json has no entry for) under something other than
  // `person`, e.g. a Daedric Prince under `deity`.
  schema: z.object({ name: bilingual, summary: bilingual, category: z.enum(GLOSSARY_CATEGORIES).optional() }),
});

const glossary = defineCollection({
  loader: file('src/content/glossary.json'),
  schema: z.object({
    name: bilingual,
    category: z.enum(GLOSSARY_CATEGORIES),
    source: z.enum(['official-zh', 'university-hanhua', 'community', 'original', 'unverified']),
    note: z.string().optional(),
    summary: bilingual.optional(),
  }),
});

const articleMeta = {
  status: z.enum(ENTRY_STATUSES),
  // Required once published (src/lib/validate.ts validateSections), like an event's.
  sources: z.array(z.object({ title: z.string(), kind: z.enum(SOURCE_KINDS), url: z.url().optional() })).optional(),
  certainty: z.enum(CERTAINTIES).optional(),
  review: z.enum(REVIEW_STATES).optional(),
};

const topics = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/topics/en' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    events: z.array(z.string()).default([]),
    people: z.array(z.string()).optional(),
    ...articleMeta,
  }),
});

const topicsZhTw = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/topics/zh-tw' }),
  schema: z.object({ title: z.string(), summary: z.string() }),
});

const biographies = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/biographies/en' }),
  schema: z.object(articleMeta),
});

const biographiesZhTw = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/biographies/zh-tw' }),
  schema: z.object({}),
});

const about = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/about' }),
  schema: z.object({ title: z.string() }),
});

export const collections = { events, eventsZhTw, locations, people, glossary, topics, topicsZhTw, biographies, biographiesZhTw, about };
