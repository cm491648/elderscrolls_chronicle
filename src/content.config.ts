import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { file, glob } from 'astro/loaders';
import { CATEGORIES, CERTAINTIES, ERAS, GAMES, MAP_LAYERS, REVIEW_STATES, SOURCE_KINDS } from './lib/types';

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
  schema: z.object({ name: bilingual, summary: bilingual }),
});

const glossary = defineCollection({
  loader: file('src/content/glossary.json'),
  schema: z.object({
    en: z.string(),
    'zh-tw': z.string(),
    source: z.enum(['official-zh', 'university-hanhua', 'community', 'original', 'unverified']),
    note: z.string().optional(),
    summary: bilingual.optional(),
  }),
});

export const collections = { events, eventsZhTw, locations, people, glossary };
